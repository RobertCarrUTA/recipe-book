// Shared domain modules remain the tested validation and calculation boundary.
// These structural types describe their normalized output; raw input stays unknown.
import { normalizeRecipeBook } from "../js/recipe_schema.js";
import {
  createRecipeRuntimeState,
  recomputeGroceryState,
} from "../js/grocery_model.js";
import {
  restorePersistentState,
  savePersistentState,
  getPersistentStateStatus,
} from "../js/storage.js";
import type { Recipe, Runtime, DurableState, UiState, MealPlan } from "./types";

export function normalizeRecipes(raw: unknown): Recipe[] {
  const result = normalizeRecipeBook(raw);
  if (
    !result.recipes.length ||
    !Array.isArray(raw) ||
    result.recipes.length !== raw.length
  )
    throw new Error(
      "Recipe data is incomplete. Your saved data has been kept. Please try again.",
    );
  return result.recipes as Recipe[];
}
export function restoreState(): DurableState {
  const saved = restorePersistentState();
  return {
    runtime: createRecipeRuntimeState(saved) as Runtime,
    mealPlan: saved.mealPlan as MealPlan,
    ui: saved.ui as UiState,
  };
}
export function persistState(state: DurableState): boolean {
  return savePersistentState(state);
}
export { getPersistentStateStatus };
export function recompute(runtime: Runtime, recipes: Recipe[]) {
  recomputeGroceryState(runtime, recipes);
}
export * from "../js/grocery_model.js";
export * from "../js/meal_plan_model.js";
export * from "../js/recipe_collections.js";
export * from "../js/recipe_formatting.js";
export * from "../js/recipe_multiplier.js";
export * from "../js/recipe_exporter.js";
export * from "../js/grocery_view_model.js";
export * from "../js/grocery_list_exporter.js";
export * from "../js/grouping.js";
export * from "../js/units.js";
