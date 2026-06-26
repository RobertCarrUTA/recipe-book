export const DEFAULT_RECIPE_MULTIPLIER = 1;
export const MIN_RECIPE_MULTIPLIER = 0.25;
export const MAX_RECIPE_MULTIPLIER = 12;
export const RECIPE_MULTIPLIER_STEP = 0.25;

export function normalizeRecipeMultiplier(value, fallback = DEFAULT_RECIPE_MULTIPLIER) {
  const number = Number(value);
  const fallbackNumber = Number(fallback);
  const safeFallback = Number.isFinite(fallbackNumber) && fallbackNumber > 0
    ? fallbackNumber
    : DEFAULT_RECIPE_MULTIPLIER;

  if (!Number.isFinite(number) || number <= 0) {
    return normalizeRecipeMultiplier(safeFallback, DEFAULT_RECIPE_MULTIPLIER);
  }

  const clamped = Math.min(MAX_RECIPE_MULTIPLIER, Math.max(MIN_RECIPE_MULTIPLIER, number));
  return Math.round(clamped * 100) / 100;
}

export function normalizeRecipeMultiplierRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.keys(value).reduce((record, key) => {
    const multiplier = normalizeRecipeMultiplier(value[key]);
    if (Math.abs(multiplier - DEFAULT_RECIPE_MULTIPLIER) > 1e-9) {
      record[key] = multiplier;
    }
    return record;
  }, {});
}

export function formatRecipeMultiplier(value) {
  const multiplier = normalizeRecipeMultiplier(value);
  return `x${String(multiplier).replace(/\.0+$/, "")}`;
}

export function formatRecipeMultiplierInputValue(value) {
  return String(normalizeRecipeMultiplier(value));
}

export function stepRecipeMultiplier(value, direction) {
  const current = normalizeRecipeMultiplier(value);
  const offset = Number(direction) * RECIPE_MULTIPLIER_STEP;
  return normalizeRecipeMultiplier(current + offset, current);
}
