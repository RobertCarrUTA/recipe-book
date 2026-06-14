import assert from "node:assert/strict";

import {
  clearGroceryState,
  createRecipeRuntimeState,
  isRecipeSelected,
  setGroceryChecked,
  setRecipeSelected,
} from "../js/grocery_model.js";
import { test } from "./test_helpers.mjs";

const recipes = [
  {
    id: "chili",
    groceryIngredients: [
      { item: "kidney beans", quantity: 2, unit: "can" },
      { item: "garlic", quantity: 3, unit: "clove" },
    ],
    ingredients: [],
    instructions: [],
    title: "Chili",
  },
];

test("setRecipeSelected recomputes grocery totals from structured ingredients", () => {
  const runtime = createRecipeRuntimeState();
  setRecipeSelected(runtime, recipes, recipes[0], 0, true);

  assert.equal(isRecipeSelected(runtime, recipes[0], 0), true);
  assert.deepEqual(runtime.grocery.totalsByKey["kidney beans"].can, { min: 2, max: 2 });
  assert.deepEqual(runtime.grocery.totalsByKey.garlic.clove, { min: 3, max: 3 });
  assert.equal(runtime.displayNamesByKey.garlic, "garlic");
});

test("setGroceryChecked toggles checked keys", () => {
  const runtime = createRecipeRuntimeState();
  setGroceryChecked(runtime, "garlic", true);
  assert.equal(runtime.groceryCheckedByKey.garlic, true);
  setGroceryChecked(runtime, "garlic", false);
  assert.equal(runtime.groceryCheckedByKey.garlic, undefined);
});

test("clearGroceryState resets selected, checked, totals, and display names", () => {
  const runtime = createRecipeRuntimeState();
  setRecipeSelected(runtime, recipes, recipes[0], 0, true);
  setGroceryChecked(runtime, "garlic", true);

  clearGroceryState(runtime);

  assert.deepEqual(runtime.selectedRecipeIds, {});
  assert.deepEqual(runtime.groceryCheckedByKey, {});
  assert.deepEqual(runtime.grocery.totalsByKey, {});
  assert.deepEqual(runtime.displayNamesByKey, {});
});
