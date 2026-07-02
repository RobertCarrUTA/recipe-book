import {
  getRecipeKey,
  recomputeGroceryState,
} from "./grocery_model.js";
import {
  DEFAULT_RECIPE_MULTIPLIER,
  normalizeRecipeMultiplier,
} from "./recipe_multiplier.js";

export const mealPlanDays = Object.freeze([
  { key: "monday", label: "Monday", shortLabel: "Mon" },
  { key: "tuesday", label: "Tuesday", shortLabel: "Tue" },
  { key: "wednesday", label: "Wednesday", shortLabel: "Wed" },
  { key: "thursday", label: "Thursday", shortLabel: "Thu" },
  { key: "friday", label: "Friday", shortLabel: "Fri" },
  { key: "saturday", label: "Saturday", shortLabel: "Sat" },
  { key: "sunday", label: "Sunday", shortLabel: "Sun" },
]);

const mealPlanDayKeys = new Set(mealPlanDays.map((day) => day.key));

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeRecipeId(value) {
  return String(value || "").trim();
}

function normalizeRecipeIdList(value) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map(normalizeRecipeId)
        .filter(Boolean)
    )
  );
}

export function createEmptyMealPlan() {
  return {
    days: mealPlanDays.reduce((days, day) => {
      days[day.key] = [];
      return days;
    }, {}),
  };
}

export function normalizeMealPlan(value) {
  const source = isPlainObject(value && value.days)
    ? value.days
    : isPlainObject(value)
      ? value
      : {};
  const plan = createEmptyMealPlan();

  mealPlanDays.forEach((day) => {
    plan.days[day.key] = normalizeRecipeIdList(source[day.key]);
  });

  return plan;
}

export function isMealPlanDayKey(dayKey) {
  return mealPlanDayKeys.has(String(dayKey || ""));
}

export function getMealPlanDay(dayKey) {
  return mealPlanDays.find((day) => day.key === dayKey) || null;
}

export function addRecipeToMealPlan(mealPlan, dayKey, recipeId) {
  const normalizedDayKey = String(dayKey || "");
  const normalizedRecipeId = normalizeRecipeId(recipeId);
  if (!isMealPlanDayKey(normalizedDayKey) || !normalizedRecipeId) return false;

  const plan = normalizeMealPlan(mealPlan);
  mealPlan.days = plan.days;
  const dayRecipeIds = mealPlan.days[normalizedDayKey];
  if (dayRecipeIds.includes(normalizedRecipeId)) return false;

  dayRecipeIds.push(normalizedRecipeId);
  return true;
}

export function removeRecipeFromMealPlan(mealPlan, dayKey, recipeId) {
  const normalizedDayKey = String(dayKey || "");
  const normalizedRecipeId = normalizeRecipeId(recipeId);
  if (!isMealPlanDayKey(normalizedDayKey) || !normalizedRecipeId) return false;

  const plan = normalizeMealPlan(mealPlan);
  const current = plan.days[normalizedDayKey];
  const next = current.filter((id) => id !== normalizedRecipeId);
  mealPlan.days = plan.days;
  mealPlan.days[normalizedDayKey] = next;

  return next.length !== current.length;
}

export function clearMealPlan(mealPlan) {
  const plan = normalizeMealPlan(mealPlan);
  const changed = mealPlanDays.some((day) => plan.days[day.key].length > 0);
  mealPlan.days = createEmptyMealPlan().days;
  return changed;
}

export function getRecipePlannedDayKeys(mealPlan, recipeId) {
  const normalizedRecipeId = normalizeRecipeId(recipeId);
  if (!normalizedRecipeId) return [];

  const plan = normalizeMealPlan(mealPlan);
  return mealPlanDays
    .filter((day) => plan.days[day.key].includes(normalizedRecipeId))
    .map((day) => day.key);
}

export function isRecipeInMealPlan(mealPlan, recipeId) {
  return getRecipePlannedDayKeys(mealPlan, recipeId).length > 0;
}

export function getMealPlanRecipeCounts(mealPlan) {
  const plan = normalizeMealPlan(mealPlan);
  return mealPlanDays.reduce((counts, day) => {
    plan.days[day.key].forEach((recipeId) => {
      counts[recipeId] = (counts[recipeId] || 0) + 1;
    });
    return counts;
  }, {});
}

export function getMealPlanSummary(mealPlan) {
  const plan = normalizeMealPlan(mealPlan);
  const recipeCounts = getMealPlanRecipeCounts(plan);
  const plannedRecipeCount = Object.values(recipeCounts).reduce((total, count) => total + count, 0);
  const dayCount = mealPlanDays.filter((day) => plan.days[day.key].length > 0).length;

  return {
    dayCount,
    plannedRecipeCount,
    uniqueRecipeCount: Object.keys(recipeCounts).length,
  };
}

export function pruneMealPlanForRecipes(mealPlan, recipes) {
  const validRecipeIds = new Set(
    (Array.isArray(recipes) ? recipes : []).map((recipe, index) => getRecipeKey(recipe, index))
  );
  const plan = normalizeMealPlan(mealPlan);
  let changed = false;

  mealPlanDays.forEach((day) => {
    const current = plan.days[day.key];
    const next = current.filter((recipeId) => validRecipeIds.has(recipeId));
    if (next.length !== current.length) changed = true;
    plan.days[day.key] = next;
  });

  mealPlan.days = plan.days;
  return changed;
}

export function applyMealPlanToGroceryList(runtimeState, recipes, mealPlan) {
  const counts = getMealPlanRecipeCounts(mealPlan);
  runtimeState.selectedRecipeIds = {};
  runtimeState.recipeMultipliersById = {};

  (Array.isArray(recipes) ? recipes : []).forEach((recipe, index) => {
    const recipeId = getRecipeKey(recipe, index);
    const plannedCount = counts[recipeId] || 0;
    if (!plannedCount) return;

    runtimeState.selectedRecipeIds[recipeId] = true;
    const multiplier = normalizeRecipeMultiplier(plannedCount);
    if (Math.abs(multiplier - DEFAULT_RECIPE_MULTIPLIER) > 1e-9) {
      runtimeState.recipeMultipliersById[recipeId] = multiplier;
    }
  });

  recomputeGroceryState(runtimeState, recipes);
  return Object.keys(runtimeState.selectedRecipeIds).length;
}
