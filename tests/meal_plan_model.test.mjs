import assert from "node:assert/strict";

import {
  addRecipeToMealPlan,
  applyMealPlanToGroceryList,
  clearMealPlan,
  createEmptyMealPlan,
  getMealPlanRecipeCounts,
  getMealPlanSummary,
  getRecipePlannedDayKeys,
  normalizeMealPlan,
  pruneMealPlanForRecipes,
  removeRecipeFromMealPlan,
} from "../js/meal_plan_model.js";
import { createRecipeRuntimeState } from "../js/grocery_model.js";
import { test } from "./test_helpers.mjs";

const recipes = [
  {
    id: "chili",
    groceryIngredients: [{ item: "kidney beans", quantity: 2, unit: "can" }],
    ingredients: [],
    instructions: [],
    title: "Chili",
  },
  {
    id: "soup",
    groceryIngredients: [{ item: "carrot", quantity: 3 }],
    ingredients: [],
    instructions: [],
    title: "Soup",
  },
];

test("normalizeMealPlan returns safe weekly day buckets", () => {
  const plan = normalizeMealPlan({
    monday: ["chili", "chili", "", "soup"],
    someday: ["ignored"],
  });

  assert.deepEqual(plan.days.monday, ["chili", "soup"]);
  assert.deepEqual(plan.days.tuesday, []);
  assert.equal(plan.days.someday, undefined);
});

test("meal plan add, remove, clear, and summary operations are stable", () => {
  const plan = createEmptyMealPlan();

  assert.equal(addRecipeToMealPlan(plan, "monday", "chili"), true);
  assert.equal(addRecipeToMealPlan(plan, "monday", "chili"), false);
  assert.equal(addRecipeToMealPlan(plan, "tuesday", "chili"), true);
  assert.equal(addRecipeToMealPlan(plan, "friday", "soup"), true);
  assert.deepEqual(getRecipePlannedDayKeys(plan, "chili"), ["monday", "tuesday"]);
  assert.deepEqual(getMealPlanRecipeCounts(plan), { chili: 2, soup: 1 });
  assert.deepEqual(getMealPlanSummary(plan), {
    dayCount: 3,
    plannedRecipeCount: 3,
    uniqueRecipeCount: 2,
  });

  assert.equal(removeRecipeFromMealPlan(plan, "monday", "chili"), true);
  assert.deepEqual(getRecipePlannedDayKeys(plan, "chili"), ["tuesday"]);

  clearMealPlan(plan);
  assert.deepEqual(getMealPlanSummary(plan), {
    dayCount: 0,
    plannedRecipeCount: 0,
    uniqueRecipeCount: 0,
  });
});

test("pruneMealPlanForRecipes removes recipe ids that are no longer available", () => {
  const plan = normalizeMealPlan({
    monday: ["chili", "missing"],
    sunday: ["soup"],
  });

  assert.equal(pruneMealPlanForRecipes(plan, recipes), true);
  assert.deepEqual(plan.days.monday, ["chili"]);
  assert.deepEqual(plan.days.sunday, ["soup"]);
});

test("applyMealPlanToGroceryList replaces recipe selections and applies repeat counts", () => {
  const plan = normalizeMealPlan({
    monday: ["chili"],
    tuesday: ["chili"],
    friday: ["soup"],
  });
  const runtime = createRecipeRuntimeState({
    recipeMultipliersById: { old: 4 },
    selectedRecipeIds: { old: true },
  });

  const selectedCount = applyMealPlanToGroceryList(runtime, recipes, plan);

  assert.equal(selectedCount, 2);
  assert.deepEqual(runtime.selectedRecipeIds, { chili: true, soup: true });
  assert.deepEqual(runtime.recipeMultipliersById, { chili: 2 });
  assert.deepEqual(runtime.grocery.totalsByKey["kidney beans"].can, { min: 4, max: 4 });
  assert.deepEqual(runtime.grocery.totalsByKey.carrot.item, { min: 3, max: 3 });
});
