import { useDeferredValue, useMemo, useState } from "react";
import {
  BookOpen,
  Clock3,
  Heart,
  Search,
  SlidersHorizontal,
  X,
  ShoppingBasket,
  ChevronDown,
} from "lucide-react";
import { useApp, appBase } from "../store";
import { getRecipeDiscoveryResult } from "../../js/recipe_discovery.js";
import { buildRecipeSearchText } from "../../js/recipe_filter.js";
import {
  getRecipeCollectionOptions,
  getRecipeCollectionDescription,
  getRecipeCollectionBadges,
  formatServingsText,
  formatRatingText,
  formatHeaderLabel,
} from "../domain";
import { Dialog } from "../components/Dialog";
import type { FilterKey, Recipe } from "../types";

const filterLabels: Record<Exclude<FilterKey, "collection">, string> = {
  status: "Tried status",
  rating: "Personal rating",
  difficulty: "Difficulty",
  equipment: "Equipment",
};
const label = (value: string) =>
  value.replaceAll("-", " ").replace(/^./, (char) => char.toUpperCase());
const sorts = [
  ["default", "Recipe order"],
  ["favorites-first", "Favorites first"],
  ["selected-first", "In list first"],
  ["fastest", "Fastest"],
  ["highest-rated", "Highest rated"],
  ["easiest", "Easiest"],
];

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { state, openRecipe, setFavorite, setSelected } = useApp();
  const favorite = Boolean(state.runtime.favoriteRecipeIds[recipe.id]);
  const selected = Boolean(state.runtime.selectedRecipeIds[recipe.id]);
  const planned = Object.values(state.mealPlan.days).some((ids) =>
    ids.includes(recipe.id),
  );
  const badges = getRecipeCollectionBadges(recipe.collections);
  return (
    <article className="recipe-card" data-recipe-id={recipe.id}>
      <div className="recipe-card-top">
        <p className="eyebrow">
          {recipe.category ||
            recipe.collections[0]?.replaceAll("-", " ") ||
            "Recipe"}
        </p>
        <button
          className={`icon-button favorite ${favorite ? "is-active" : ""}`}
          aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${recipe.title}`}
          aria-pressed={favorite}
          onClick={() => setFavorite(recipe, !favorite)}
        >
          <Heart
            size={19}
            aria-hidden="true"
            fill={favorite ? "currentColor" : "none"}
          />
        </button>
      </div>
      <h2>
        <a
          href={`${appBase}${recipe.id}`}
          onClick={(event) => {
            if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
              event.preventDefault();
              openRecipe(recipe.id);
            }
          }}
        >
          {recipe.title}
        </a>
      </h2>
      {recipe.description && (
        <p className="recipe-description">{recipe.description}</p>
      )}
      {(badges.length > 0 || planned || selected) && (
        <div className="recipe-badges">
          {selected && (
            <span>
              <ShoppingBasket size={13} aria-hidden="true" /> In groceries
            </span>
          )}
          {planned && <span>Planned</span>}
          {badges.map((badge) => (
            <span key={badge.id}>{badge.label}</span>
          ))}
        </div>
      )}
      <div className="recipe-badges">
        {recipe.rating && (
          <span>{formatRatingText(recipe.rating, "chip")}</span>
        )}
        {recipe.tags.difficulty && (
          <span>{formatHeaderLabel(recipe.tags.difficulty)}</span>
        )}
        {recipe.tags.status && (
          <span>{formatHeaderLabel(recipe.tags.status)}</span>
        )}
        {recipe.tags.rating && (
          <span>{formatHeaderLabel(recipe.tags.rating)}</span>
        )}
      </div>
      <footer className="recipe-card-meta">
        <div>
          <span>
            <Clock3 size={14} aria-hidden="true" />
            {recipe.totalTime || recipe.cookTime || "Time not listed"}
          </span>
          {recipe.servings && (
            <span>{formatServingsText(recipe.servings)}</span>
          )}
        </div>
        <button
          className="icon-button"
          aria-label={`${selected ? "Remove" : "Add"} ${recipe.title} ${selected ? "from" : "to"} groceries`}
          aria-pressed={selected}
          onClick={() => setSelected(recipe, !selected)}
        >
          {selected ? (
            <ShoppingBasket size={20} aria-hidden="true" />
          ) : (
            <ShoppingBasket size={20} aria-hidden="true" />
          )}
        </button>
      </footer>
    </article>
  );
}

export function Recipes() {
  const { state, setUi } = useApp();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(24);
  const search = useDeferredValue(state.ui.recipeSearch);
  const searchTexts = useMemo(
    () => state.recipes.map(buildRecipeSearchText),
    [state.recipes],
  );
  const collections = useMemo(
    () => getRecipeCollectionOptions(state.recipes),
    [state.recipes],
  );
  const collection = state.ui.filters.collection?.[0] || "";
  const result = useMemo(
    () =>
      getRecipeDiscoveryResult({
        recipes: state.recipes,
        filterText: search,
        searchTexts,
        selectedFilters: state.ui.filters,
        sortMode: state.ui.recipeSort,
        showFavoriteOnly: state.ui.showFavoriteRecipesOnly,
        showSelectedOnly: state.ui.showSelectedRecipesOnly,
        isFavorite: (_recipe: Recipe, index: number) =>
          Boolean(state.runtime.favoriteRecipeIds[state.recipes[index]?.id]),
        isSelected: (_recipe: Recipe, index: number) =>
          Boolean(state.runtime.selectedRecipeIds[state.recipes[index]?.id]),
      }),
    [
      state.recipes,
      search,
      searchTexts,
      state.ui.filters,
      state.ui.recipeSort,
      state.ui.showFavoriteRecipesOnly,
      state.ui.showSelectedRecipesOnly,
      state.runtime.favoriteRecipeIds,
      state.runtime.selectedRecipeIds,
    ],
  );
  const filterValues = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(filterLabels).map((key) => [
          key,
          Array.from(
            new Set(
              state.recipes
                .flatMap((recipe) =>
                  key === "equipment"
                    ? recipe.tags.equipment || []
                    : [
                        recipe.tags[
                          key as "status" | "rating" | "difficulty"
                        ] || (key === "status" ? "not-tried" : ""),
                      ],
                )
                .filter(Boolean),
            ),
          ).sort(),
        ]),
      ),
    [state.recipes],
  );
  const reset = () => {
    setUi({
      recipeSearch: "",
      filters: {},
      showFavoriteRecipesOnly: false,
      showSelectedRecipesOnly: false,
    });
    setLimit(24);
  };
  const chooseCollection = (value: string) => {
    setUi({
      filters: { ...state.ui.filters, collection: value ? [value] : [] },
    });
    setLimit(24);
  };
  function toggleFilter(key: FilterKey, value: string) {
    const values = state.ui.filters[key] || [];
    setUi({
      filters: {
        ...state.ui.filters,
        [key]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      },
    });
    setLimit(24);
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">A collection to cook from</p>
          <h1 tabIndex={-1}>Your recipe book</h1>
          <p>Find something you’ll look forward to making.</p>
        </div>
        <button
          className={`button quiet ${state.ui.showFavoriteRecipesOnly ? "is-active" : ""}`}
          aria-pressed={state.ui.showFavoriteRecipesOnly}
          onClick={() =>
            setUi({
              showFavoriteRecipesOnly: !state.ui.showFavoriteRecipesOnly,
            })
          }
        >
          <Heart size={17} aria-hidden="true" />
          Favorites
        </button>
      </header>
      <button
        className="text-button discovery-toggle"
        aria-expanded={!state.ui.recipeControlsCollapsed}
        aria-controls="recipeDiscovery"
        onClick={() =>
          setUi({ recipeControlsCollapsed: !state.ui.recipeControlsCollapsed })
        }
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        {state.ui.recipeControlsCollapsed
          ? "Show search & filters"
          : "Hide search & filters"}
      </button>
      <section
        id="recipeDiscovery"
        className="discovery"
        aria-label="Find recipes"
        hidden={state.ui.recipeControlsCollapsed}
      >
        <div className="search-row">
          <div className="search-field">
            <Search size={20} aria-hidden="true" />
            <label className="sr-only" htmlFor="recipeSearch">
              Search recipes
            </label>
            <input
              id="recipeSearch"
              type="search"
              placeholder="Search your recipes"
              value={state.ui.recipeSearch}
              onChange={(event) => {
                setUi({ recipeSearch: event.target.value });
                setLimit(24);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setUi({ recipeSearch: "" });
                  event.currentTarget.blur();
                }
              }}
            />
            {state.ui.recipeSearch && (
              <button
                className="icon-button"
                onClick={() => setUi({ recipeSearch: "" })}
                aria-label="Clear search"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
          <button className="button" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={18} aria-hidden="true" />
            Filters
            {result.activeDiscoveryFilterCount > 0 && (
              <span className="count-badge">
                {result.activeDiscoveryFilterCount}
              </span>
            )}
          </button>
          <label className="sort-field">
            <span>Sort</span>
            <select
              value={state.ui.recipeSort}
              onChange={(event) => setUi({ recipeSort: event.target.value })}
            >
              {sorts.map(([value, text]) => (
                <option value={value} key={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="collection-row">
          <div className="collection-tabs" aria-label="Recipe collections">
            <button
              aria-pressed={!collection}
              onClick={() => chooseCollection("")}
            >
              All recipes
            </button>
            {collections.slice(0, 4).map((option) => (
              <button
                key={option.id}
                aria-pressed={collection === option.id}
                onClick={() => chooseCollection(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="collection-select">
            <span className="sr-only">All collections</span>
            <select
              aria-label="Collection"
              value={collection}
              onChange={(event) => chooseCollection(event.target.value)}
            >
              <option value="">All collections</option>
              {collections.map((option) => (
                <option value={option.id} key={option.id}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
        </div>
        {getRecipeCollectionDescription(collection) && (
          <p className="collection-description">
            {getRecipeCollectionDescription(collection)}
          </p>
        )}
        {result.activeDiscoveryFilterCount > 0 && (
          <div className="active-discovery">
            <span>
              {state.ui.recipeSearch
                ? `Searching “${state.ui.recipeSearch}”`
                : state.ui.showFavoriteRecipesOnly
                  ? "Favorite recipes"
                  : state.ui.showSelectedRecipesOnly
                    ? "Recipes in your grocery list"
                    : "Filters applied"}
            </span>
            <button className="text-button" onClick={reset}>
              Clear all filters <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </section>
      <div className="section-heading">
        <h2>
          {collection
            ? collections.find((item) => item.id === collection)?.label
            : "From your collection"}
        </h2>
        <p role="status" aria-live="polite">
          {result.matchCount} {result.matchCount === 1 ? "recipe" : "recipes"}
        </p>
      </div>
      {!result.matchCount ? (
        <div className="empty-state">
          <BookOpen size={32} aria-hidden="true" />
          <h2>No recipes found</h2>
          <p>
            Try another ingredient or clear your filters to see the whole
            collection.
          </p>
          <button className="button primary" onClick={reset}>
            Show all recipes
          </button>
        </div>
      ) : (
        <>
          <div
            className="recipe-grid"
            onKeyDown={(event) => {
              if (
                event.target instanceof HTMLAnchorElement &&
                ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
              ) {
                const links = Array.from(
                  event.currentTarget.querySelectorAll<HTMLAnchorElement>(
                    "h2 a",
                  ),
                );
                const index = links.indexOf(event.target);
                if (index < 0) return;
                event.preventDefault();
                if (
                  event.key === "End" &&
                  result.recipeIndexes.length > limit
                ) {
                  setLimit(result.recipeIndexes.length);
                  requestAnimationFrame(() =>
                    document
                      .querySelector<HTMLAnchorElement>(
                        ".recipe-card:last-child h2 a",
                      )
                      ?.focus(),
                  );
                  return;
                }
                links[
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? links.length - 1
                      : Math.min(
                          links.length - 1,
                          Math.max(
                            0,
                            index + (event.key === "ArrowDown" ? 1 : -1),
                          ),
                        )
                ]?.focus();
              }
            }}
          >
            {result.recipeIndexes.slice(0, limit).map((index: number) => (
              <RecipeCard
                recipe={state.recipes[index]}
                key={state.recipes[index].id}
              />
            ))}
          </div>
          {result.matchCount > limit && (
            <div className="load-more">
              <button
                className="button"
                onClick={() => setLimit((value) => value + 24)}
              >
                Show more recipes <ChevronDown size={18} aria-hidden="true" />
              </button>
              <span>
                {Math.min(limit, result.matchCount)} of {result.matchCount}
              </span>
            </div>
          )}
        </>
      )}
      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Find your next recipe"
        description="Combine filters to narrow your collection."
        footer={
          <>
            <button className="button" onClick={reset}>
              Reset filters
            </button>
            <button
              className="button primary"
              onClick={() => setFiltersOpen(false)}
            >
              Show {result.matchCount} recipes
            </button>
          </>
        }
      >
        <div className="filter-options">
          <label>
            <input
              type="checkbox"
              checked={state.ui.showFavoriteRecipesOnly}
              onChange={(event) =>
                setUi({ showFavoriteRecipesOnly: event.target.checked })
              }
            />
            Favorites only
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.ui.showSelectedRecipesOnly}
              onChange={(event) =>
                setUi({ showSelectedRecipesOnly: event.target.checked })
              }
            />
            In my grocery list
          </label>
        </div>
        <fieldset className="filter-group">
          <legend>Collections</legend>
          <div className="filter-options">
            {collections.map((option) => (
              <label key={option.id}>
                <input
                  type="checkbox"
                  checked={
                    state.ui.filters.collection?.includes(option.id) || false
                  }
                  onChange={() => toggleFilter("collection", option.id)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        {Object.entries(filterLabels).map(([key, title]) => (
          <fieldset className="filter-group" key={key}>
            <legend>{title}</legend>
            <div className="filter-options">
              {filterValues[key].map((value: string) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={
                      state.ui.filters[key as FilterKey]?.includes(value) ||
                      false
                    }
                    onChange={() => toggleFilter(key as FilterKey, value)}
                  />
                  {label(value)}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </Dialog>
    </>
  );
}
