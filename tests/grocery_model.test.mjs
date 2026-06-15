import assert from "node:assert/strict";

import {
  addManualGroceryItem,
  clearCheckedGroceryItems,
  clearGroceryState,
  createRecipeRuntimeState,
  getManualGroceryItemKey,
  isRecipeSelected,
  removeManualGroceryItem,
  selectAllRecipes,
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

test("manual grocery items are included in grocery state and removable", () => {
  const runtime = createRecipeRuntimeState();
  const item = addManualGroceryItem(runtime, "  Paper towels  ", { id: "manual-1" });
  const key = getManualGroceryItemKey(item.id);

  assert.equal(runtime.displayNamesByKey[key], "Paper towels");
  assert.deepEqual(runtime.grocery.notesByKey[key], ["manual item"]);

  removeManualGroceryItem(runtime, key);

  assert.deepEqual(runtime.manualGroceryItemsById, {});
  assert.equal(runtime.displayNamesByKey[key], undefined);
  assert.equal(runtime.grocery.notesByKey[key], undefined);
});

test("clearCheckedGroceryItems removes checked manual items and unchecks recipe items", () => {
  const runtime = createRecipeRuntimeState();
  setRecipeSelected(runtime, recipes, recipes[0], 0, true);
  const item = addManualGroceryItem(runtime, "Seltzer", { id: "manual-1" });
  const manualKey = getManualGroceryItemKey(item.id);

  setGroceryChecked(runtime, "garlic", true);
  setGroceryChecked(runtime, manualKey, true);
  clearCheckedGroceryItems(runtime);

  assert.deepEqual(runtime.groceryCheckedByKey, {});
  assert.equal(runtime.manualGroceryItemsById[item.id], undefined);
  assert.ok(runtime.grocery.totalsByKey.garlic, "recipe-derived items should remain in the list");
});

test("selectAllRecipes preserves manual grocery items", () => {
  const runtime = createRecipeRuntimeState();
  const item = addManualGroceryItem(runtime, "Paper towels", { id: "manual-1" });
  const manualKey = getManualGroceryItemKey(item.id);

  selectAllRecipes(runtime, recipes);

  assert.equal(runtime.manualGroceryItemsById[item.id].name, "Paper towels");
  assert.equal(runtime.displayNamesByKey[manualKey], "Paper towels");
  assert.deepEqual(runtime.grocery.totalsByKey["kidney beans"].can, { min: 2, max: 2 });
});

test("clearGroceryState resets selected, checked, totals, and display names", () => {
  const runtime = createRecipeRuntimeState();
  setRecipeSelected(runtime, recipes, recipes[0], 0, true);
  addManualGroceryItem(runtime, "Seltzer", { id: "manual-1" });
  setGroceryChecked(runtime, "garlic", true);

  clearGroceryState(runtime);

  assert.deepEqual(runtime.selectedRecipeIds, {});
  assert.deepEqual(runtime.groceryCheckedByKey, {});
  assert.deepEqual(runtime.manualGroceryItemsById, {});
  assert.deepEqual(runtime.grocery.totalsByKey, {});
  assert.deepEqual(runtime.displayNamesByKey, {});
});
