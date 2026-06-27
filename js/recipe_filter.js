import { normalizeWhitespace } from "./normalization.js";

export function normalizeForSearch(text) {
  return normalizeWhitespace(String(text || "")).toLowerCase();
}

export function buildRecipeSearchText(recipe) {
  const parts = [];
  if (recipe.title) parts.push(recipe.title);
  if (recipe.author) parts.push(recipe.author);
  if (recipe.description) parts.push(recipe.description);
  if (recipe.ingredients && recipe.ingredients.length) parts.push(recipe.ingredients.join(" "));
  if (recipe.notes && recipe.notes.length) parts.push(recipe.notes.join(" "));
  if (recipe.instructions && recipe.instructions.length) parts.push(recipe.instructions.join(" "));
  return normalizeForSearch(parts.join(" "));
}

function getSearchTerms(normalizedFilterText) {
  return String(normalizedFilterText || "")
    .split(/\s+/)
    .filter(Boolean);
}

function normalizedRecipeSearchTextMatches(normalizedSearchText, normalizedFilterText, searchTerms) {
  if (!normalizedFilterText) return true;

  if (normalizedSearchText.includes(normalizedFilterText)) return true;

  return searchTerms.every((term) => normalizedSearchText.includes(term));
}

export function recipeSearchTextMatches(searchText, filterText) {
  const normalizedFilterText = normalizeForSearch(filterText);
  const normalizedSearchText = normalizeForSearch(searchText);
  return normalizedRecipeSearchTextMatches(
    normalizedSearchText,
    normalizedFilterText,
    getSearchTerms(normalizedFilterText)
  );
}

export function recipeMatchesSelectedFilters(recipe, selected) {
  const tags = recipe && recipe.tags ? recipe.tags : {};
  const statusValue = tags.status ? String(tags.status) : "not-tried";
  const ratingValue = tags.rating ? String(tags.rating) : "";
  const difficultyValue = tags.difficulty ? String(tags.difficulty) : "";
  const equipmentValues = Array.isArray(tags.equipment) ? tags.equipment.map((value) => String(value)) : [];

  if (selected.status?.size && !selected.status.has(statusValue)) return false;
  if (selected.rating?.size && !selected.rating.has(ratingValue)) return false;
  if (selected.difficulty?.size && !selected.difficulty.has(difficultyValue)) return false;
  if (selected.equipment?.size && !equipmentValues.some((value) => selected.equipment.has(value))) return false;

  return true;
}

export function recipeMatchesVisibilityOptions({
  filterText,
  isFavorite,
  isSelected,
  recipe,
  searchText,
  selectedFilters,
  showFavoriteOnly,
  showSelectedOnly,
}) {
  const matchesSearch = recipeSearchTextMatches(searchText, filterText);
  const matchesTags = recipe ? recipeMatchesSelectedFilters(recipe, selectedFilters || {}) : true;
  const matchesSelectedOnly = !showSelectedOnly || Boolean(isSelected);
  const matchesFavoriteOnly = !showFavoriteOnly || Boolean(isFavorite);

  return matchesSearch && matchesTags && matchesSelectedOnly && matchesFavoriteOnly;
}

export function getMatchingRecipeIndexes({
  filterText,
  isFavorite,
  isSelected,
  recipes,
  searchTexts,
  searchTextsAreNormalized = false,
  selectedFilters,
  showFavoriteOnly,
  showSelectedOnly,
}) {
  const items = Array.isArray(recipes) ? recipes : [];
  const indexedSearchTexts = Array.isArray(searchTexts) ? searchTexts : [];
  const normalizedFilterText = normalizeForSearch(filterText);
  const searchTerms = getSearchTerms(normalizedFilterText);

  return items.reduce((matches, recipe, index) => {
    const searchText = indexedSearchTexts[index] || buildRecipeSearchText(recipe);
    const normalizedSearchText = searchTextsAreNormalized ? String(searchText || "") : normalizeForSearch(searchText);

    if (
      normalizedRecipeSearchTextMatches(normalizedSearchText, normalizedFilterText, searchTerms) &&
      recipeMatchesSelectedFilters(recipe, selectedFilters || {}) &&
      (!showFavoriteOnly || (typeof isFavorite === "function" && isFavorite(recipe, index))) &&
      (!showSelectedOnly || (typeof isSelected === "function" && isSelected(recipe, index)))
    ) {
      matches.push(index);
    }

    return matches;
  }, []);
}
