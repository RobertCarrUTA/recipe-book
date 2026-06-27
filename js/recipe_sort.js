export const recipeSortModes = Object.freeze({
  default: "default",
  easiest: "easiest",
  fastest: "fastest",
  favoritesFirst: "favorites-first",
  highestRated: "highest-rated",
  selectedFirst: "selected-first",
});

const validRecipeSortModes = new Set(Object.values(recipeSortModes));

export function normalizeRecipeSort(value) {
  return validRecipeSortModes.has(value) ? value : recipeSortModes.default;
}

export function parseRecipeDurationMinutes(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;

  const isoMatch = text.match(/^pt(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?$/i);
  if (isoMatch) {
    const hours = Number(isoMatch[1] || 0);
    const minutes = Number(isoMatch[2] || 0);
    const total = hours * 60 + minutes;
    return total > 0 ? total : null;
  }

  let total = 0;
  let matched = false;
  const durationPattern = /(\d+(?:\.\d+)?)\s*(days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m)\b/g;
  let match = durationPattern.exec(text);
  while (match) {
    const amount = Number(match[1]);
    const unit = match[2];
    if (Number.isFinite(amount)) {
      matched = true;
      if (unit.startsWith("d")) total += amount * 24 * 60;
      else if (unit.startsWith("h")) total += amount * 60;
      else total += amount;
    }
    match = durationPattern.exec(text);
  }

  if (matched && total > 0) return total;

  const hourMinuteMatch = text.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (hourMinuteMatch) {
    const hours = Number(hourMinuteMatch[1]);
    const minutes = Number(hourMinuteMatch[2]);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) return hours * 60 + minutes;
  }

  return null;
}

export function getRecipeDurationMinutes(recipe) {
  if (!recipe) return null;

  const totalTime = parseRecipeDurationMinutes(recipe.totalTime);
  if (totalTime !== null) return totalTime;

  const parts = [recipe.prepTime, recipe.cookTime, recipe.additionalTime]
    .map(parseRecipeDurationMinutes)
    .filter((minutes) => minutes !== null);

  if (!parts.length) return null;
  return parts.reduce((sum, minutes) => sum + minutes, 0);
}

function parseNumber(value) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized) return null;

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function getRecipeRatingScore(recipe) {
  const numericRating = parseNumber(recipe?.rating?.value);
  if (numericRating !== null) return numericRating;

  const ratingRanks = {
    great: 5,
    good: 4,
    okay: 3,
  };
  const tagRating = String(recipe?.tags?.rating || "").toLowerCase();
  return ratingRanks[tagRating] || null;
}

export function getRecipeReviewCount(recipe) {
  return parseNumber(recipe?.rating?.count) || 0;
}

function getRecipeDifficultyScore(recipe) {
  const difficultyRanks = {
    easy: 1,
    medium: 2,
    hard: 3,
  };
  const difficulty = String(recipe?.tags?.difficulty || "").toLowerCase();
  return difficultyRanks[difficulty] || null;
}

function compareNullableAscending(left, right) {
  const leftMissing = left === null || left === undefined || Number.isNaN(left);
  const rightMissing = right === null || right === undefined || Number.isNaN(right);
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  return left - right;
}

function compareNullableDescending(left, right) {
  return compareNullableAscending(right, left);
}

function compareBooleanDescending(left, right) {
  return Number(Boolean(right)) - Number(Boolean(left));
}

function compareIndex(leftIndex, rightIndex) {
  return leftIndex - rightIndex;
}

export function sortRecipeIndexes(recipeIndexes, recipes, options = {}) {
  const indexes = Array.isArray(recipeIndexes) ? recipeIndexes.slice() : [];
  const items = Array.isArray(recipes) ? recipes : [];
  const sortMode = normalizeRecipeSort(options.sortMode);
  const isFavorite = typeof options.isFavorite === "function" ? options.isFavorite : () => false;
  const isSelected = typeof options.isSelected === "function" ? options.isSelected : () => false;

  if (sortMode === recipeSortModes.default) return indexes;

  return indexes.sort((leftIndex, rightIndex) => {
    const leftRecipe = items[leftIndex];
    const rightRecipe = items[rightIndex];

    if (sortMode === recipeSortModes.favoritesFirst) {
      return (
        compareBooleanDescending(isFavorite(leftRecipe, leftIndex), isFavorite(rightRecipe, rightIndex)) ||
        compareBooleanDescending(isSelected(leftRecipe, leftIndex), isSelected(rightRecipe, rightIndex)) ||
        compareIndex(leftIndex, rightIndex)
      );
    }

    if (sortMode === recipeSortModes.selectedFirst) {
      return (
        compareBooleanDescending(isSelected(leftRecipe, leftIndex), isSelected(rightRecipe, rightIndex)) ||
        compareBooleanDescending(isFavorite(leftRecipe, leftIndex), isFavorite(rightRecipe, rightIndex)) ||
        compareIndex(leftIndex, rightIndex)
      );
    }

    if (sortMode === recipeSortModes.fastest) {
      return (
        compareNullableAscending(getRecipeDurationMinutes(leftRecipe), getRecipeDurationMinutes(rightRecipe)) ||
        compareNullableDescending(getRecipeRatingScore(leftRecipe), getRecipeRatingScore(rightRecipe)) ||
        compareIndex(leftIndex, rightIndex)
      );
    }

    if (sortMode === recipeSortModes.highestRated) {
      return (
        compareNullableDescending(getRecipeRatingScore(leftRecipe), getRecipeRatingScore(rightRecipe)) ||
        getRecipeReviewCount(rightRecipe) - getRecipeReviewCount(leftRecipe) ||
        compareNullableAscending(getRecipeDurationMinutes(leftRecipe), getRecipeDurationMinutes(rightRecipe)) ||
        compareIndex(leftIndex, rightIndex)
      );
    }

    if (sortMode === recipeSortModes.easiest) {
      return (
        compareNullableAscending(getRecipeDifficultyScore(leftRecipe), getRecipeDifficultyScore(rightRecipe)) ||
        compareNullableAscending(getRecipeDurationMinutes(leftRecipe), getRecipeDurationMinutes(rightRecipe)) ||
        compareNullableDescending(getRecipeRatingScore(leftRecipe), getRecipeRatingScore(rightRecipe)) ||
        compareIndex(leftIndex, rightIndex)
      );
    }

    return compareIndex(leftIndex, rightIndex);
  });
}
