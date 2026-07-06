import { normalizeWhitespace } from "./normalization.js";

const searchSeparatorPattern = /[\u2010-\u2015/_-]+/g;

export function normalizeForSearch(text) {
  return normalizeWhitespace(String(text || "").replace(searchSeparatorPattern, " ")).toLowerCase();
}

function addSearchParts(parts, value) {
  if (Array.isArray(value)) {
    if (value.length) parts.push(value.join(" "));
    return;
  }

  if (value) parts.push(value);
}

export function buildRecipeSearchText(recipe) {
  const parts = [];

  addSearchParts(parts, recipe.title);
  addSearchParts(parts, recipe.author);
  addSearchParts(parts, recipe.category);
  addSearchParts(parts, recipe.description);
  addSearchParts(parts, recipe.equipment);
  addSearchParts(parts, recipe.ingredients);
  addSearchParts(parts, recipe.personalNotes);
  addSearchParts(parts, recipe.notes);
  addSearchParts(parts, recipe.instructions);

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

export function countSelectedRecipeFilters(selected) {
  return Object.values(selected || {}).reduce(
    (count, values) => count + getSelectedFilterValueCount(values),
    0
  );
}

export function countActiveRecipeDiscoveryFilters({
  filterText,
  selected,
  showFavoriteOnly,
  showSelectedOnly,
}) {
  return (
    countSelectedRecipeFilters(selected) +
    (normalizeForSearch(filterText) ? 1 : 0) +
    (showFavoriteOnly ? 1 : 0) +
    (showSelectedOnly ? 1 : 0)
  );
}

function getAllRecipeIndexes(items) {
  return Array.from({ length: items.length }, (_item, index) => index);
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

  if (!hasSearchText && !shouldCheckTags && !showFavoriteOnly && !showSelectedOnly) {
    return getAllRecipeIndexes(items);
  }

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
