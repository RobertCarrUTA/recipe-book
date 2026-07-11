import {
  countActiveRecipeDiscoveryFilters,
  getMatchingRecipeIndexes,
  normalizeForSearch,
} from "./recipe_filter.js";
import { normalizeRecipeSort, recipeSortModes, sortRecipeIndexes } from "./recipe_sort.js";

const runtimeRecipeSortModes = new Set([
  recipeSortModes.favoritesFirst,
  recipeSortModes.selectedFirst,
]);

export function isRuntimeRecipeSort(sortMode) {
  return runtimeRecipeSortModes.has(normalizeRecipeSort(sortMode));
}

export function getRecipeDiscoveryResult({
  filterText,
  isFavorite,
  isSelected,
  recipes,
  searchTexts,
  selectedFilters,
  showFavoriteOnly,
  showSelectedOnly,
  sortMode,
}) {
  const items = Array.isArray(recipes) ? recipes : [];
  const selected = selectedFilters || {};
  const normalizedFilterText = normalizeForSearch(filterText);
  const normalizedSortMode = normalizeRecipeSort(sortMode);
  const matchingRecipeIndexes = getMatchingRecipeIndexes({
    filterText: normalizedFilterText,
    filterTextIsNormalized: true,
    isFavorite,
    isSelected,
    recipes: items,
    searchTexts,
    selectedFilters: selected,
    showFavoriteOnly: Boolean(showFavoriteOnly),
    showSelectedOnly: Boolean(showSelectedOnly),
  });
  const recipeIndexes = normalizedSortMode === recipeSortModes.default
    ? matchingRecipeIndexes
    : sortRecipeIndexes(matchingRecipeIndexes, items, {
      isFavorite,
      isSelected,
      sortMode: normalizedSortMode,
    });

  return {
    activeDiscoveryFilterCount: countActiveRecipeDiscoveryFilters({
      filterText: normalizedFilterText,
      selected,
      showFavoriteOnly,
      showSelectedOnly,
    }),
    filterText: normalizedFilterText,
    matchCount: matchingRecipeIndexes.length,
    matchingRecipeIndexes,
    recipeIndexes,
    selectedFilters: selected,
    sortMode: normalizedSortMode,
    totalCount: items.length,
  };
}
