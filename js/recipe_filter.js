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
  const terms = String(normalizedFilterText || "")
    .split(/\s+/)
    .filter(Boolean);

  return terms.length > 1 ? Array.from(new Set(terms)) : terms;
}

function getSelectedFilterValueCount(values) {
  if (values instanceof Set) return values.size;
  return Array.isArray(values) ? values.length : 0;
}

function selectedFilterIncludes(values, value) {
  const normalizedValue = String(value);
  if (values instanceof Set) return values.has(normalizedValue);
  return Array.isArray(values) && values.includes(normalizedValue);
}

function hasSelectedFilterValues(selected) {
  return Object.values(selected || {}).some((values) => getSelectedFilterValueCount(values) > 0);
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

  if (getSelectedFilterValueCount(selected.status) && !selectedFilterIncludes(selected.status, statusValue)) return false;
  if (getSelectedFilterValueCount(selected.rating) && !selectedFilterIncludes(selected.rating, ratingValue)) return false;
  if (getSelectedFilterValueCount(selected.difficulty) && !selectedFilterIncludes(selected.difficulty, difficultyValue)) {
    return false;
  }
  if (
    getSelectedFilterValueCount(selected.equipment) &&
    !equipmentValues.some((value) => selectedFilterIncludes(selected.equipment, value))
  ) {
    return false;
  }

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
  const normalizedFilterText = normalizeForSearch(filterText);
  let matchesSearch = true;

  if (normalizedFilterText) {
    matchesSearch = normalizedRecipeSearchTextMatches(
      normalizeForSearch(searchText),
      normalizedFilterText,
      getSearchTerms(normalizedFilterText)
    );
  }

  const matchesTags = recipe ? recipeMatchesSelectedFilters(recipe, selectedFilters || {}) : true;
  const matchesSelectedOnly = !showSelectedOnly || Boolean(isSelected);
  const matchesFavoriteOnly = !showFavoriteOnly || Boolean(isFavorite);

  return matchesSearch && matchesTags && matchesSelectedOnly && matchesFavoriteOnly;
}

export function getMatchingRecipeIndexes({
  filterText,
  filterTextIsNormalized = false,
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
  const selected = selectedFilters || {};
  const normalizedFilterText = filterTextIsNormalized ? String(filterText || "") : normalizeForSearch(filterText);
  const hasSearchText = Boolean(normalizedFilterText);
  const searchTerms = hasSearchText ? getSearchTerms(normalizedFilterText) : [];
  const shouldCheckTags = hasSelectedFilterValues(selected);
  const canCheckFavorite = typeof isFavorite === "function";
  const canCheckSelected = typeof isSelected === "function";
  const matches = [];

  for (let index = 0; index < items.length; index += 1) {
    const recipe = items[index];

    if (shouldCheckTags && !recipeMatchesSelectedFilters(recipe, selected)) continue;
    if (showFavoriteOnly && (!canCheckFavorite || !isFavorite(recipe, index))) continue;
    if (showSelectedOnly && (!canCheckSelected || !isSelected(recipe, index))) continue;

    if (hasSearchText) {
      const searchText = indexedSearchTexts[index] || buildRecipeSearchText(recipe);
      const normalizedSearchText = searchTextsAreNormalized ? String(searchText || "") : normalizeForSearch(searchText);

      if (!normalizedRecipeSearchTextMatches(normalizedSearchText, normalizedFilterText, searchTerms)) continue;
    }

    matches.push(index);
  }

  return matches;
}
