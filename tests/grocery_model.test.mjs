import assert from "node:assert/strict";

import {
  addManualGroceryItem,
  clearCheckedGroceryItems,
  clearGroceryState,
  createRecipeRuntimeState,
  getRecipeGroceryIngredients,
  getRecipeMultiplier,
  getManualGroceryItemKey,
  isRecipeSelected,
  removeManualGroceryItem,
  selectAllRecipes,
  setGroceryChecked,
  setRecipeMultiplier,
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

test("getRecipeGroceryIngredients ignores display ingredients when structured grocery data is missing", () => {
  const parsed = getRecipeGroceryIngredients({
    ingredients: ["3 garlic cloves"],
    instructions: ["Cook."],
    title: "Garlic Test",
  });

  assert.deepEqual(parsed, []);
});

test("recipe multipliers scale grocery totals and source details", () => {
  const runtime = createRecipeRuntimeState();
  setRecipeSelected(runtime, recipes, recipes[0], 0, true);
  const multiplier = setRecipeMultiplier(runtime, recipes, recipes[0], 0, 2.5);

  assert.equal(multiplier, 2.5);
  assert.equal(getRecipeMultiplier(runtime, recipes[0], 0), 2.5);
  assert.deepEqual(runtime.grocery.totalsByKey["kidney beans"].can, { min: 5, max: 5 });
  assert.deepEqual(runtime.grocery.totalsByKey.garlic.clove, { min: 7.5, max: 7.5 });
  assert.equal(runtime.grocery.sourcesByKey.garlic[0].multiplier, 2.5);
  assert.deepEqual(runtime.grocery.sourcesByKey.garlic[0].totals.clove, { min: 7.5, max: 7.5 });
});

test("deselecting a recipe clears its multiplier", () => {
  const runtime = createRecipeRuntimeState();
  setRecipeSelected(runtime, recipes, recipes[0], 0, true);
  setRecipeMultiplier(runtime, recipes, recipes[0], 0, 2);
  setRecipeSelected(runtime, recipes, recipes[0], 0, false);

  assert.equal(isRecipeSelected(runtime, recipes[0], 0), false);
  assert.deepEqual(runtime.recipeMultipliersById, {});
  assert.equal(getRecipeMultiplier(runtime, recipes[0], 0), 1);
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

test("grocery sources retain recipe-specific amount notes", () => {
  const runtime = createRecipeRuntimeState();
  const sourceRecipes = [
    {
      id: "cobbler",
      groceryIngredients: [{ item: "peach", quantity: 5 }],
      ingredients: [],
      instructions: [],
      title: "Cobbler",
    },
    {
      id: "garnish",
      groceryIngredients: [{ item: "peach", optional: true }],
      ingredients: [],
      instructions: [],
      title: "Garnish",
    },
  ];

  selectAllRecipes(runtime, sourceRecipes);

  assert.deepEqual(runtime.grocery.totalsByKey.peach.item, { min: 5, max: 5 });
  assert.deepEqual(runtime.grocery.notesByKey.peach, ["optional", "amount not specified"]);
  assert.deepEqual(runtime.grocery.sourcesByKey.peach[0].totals.item, { min: 5, max: 5 });
  assert.deepEqual(runtime.grocery.sourcesByKey.peach[1].notes, ["optional", "amount not specified"]);
  assert.equal(runtime.grocery.sourcesByKey.peach[1].totals, undefined);
});

test("grocery sources aggregate recipe-specific totals for repeated ingredients", () => {
  const runtime = createRecipeRuntimeState();
  const sourceRecipes = [
    {
      id: "dressing",
      groceryIngredients: [
        { item: "olive oil", quantity: 0.5, unit: "cup" },
        { item: "olive oil", quantity: 2, unit: "tbsp" },
      ],
      ingredients: [],
      instructions: [],
      title: "Dressing",
    },
  ];

  selectAllRecipes(runtime, sourceRecipes);

  assert.deepEqual(runtime.grocery.totalsByKey["olive oil"].tsp, { min: 30, max: 30 });
  assert.deepEqual(runtime.grocery.sourcesByKey["olive oil"][0].totals.tsp, { min: 30, max: 30 });
});

test("specific steak grocery items do not collapse into vague steak totals", () => {
  const runtime = createRecipeRuntimeState();
  const sourceRecipes = [
    {
      id: "garlic-steak-sandwiches",
      groceryIngredients: [{ item: "top sirloin steak, strip steak, or flat iron steak", quantity: 1.25, unit: "lb" }],
      ingredients: [],
      instructions: [],
      title: "Garlic Steak Sandwiches",
    },
    {
      id: "korean-bbq-bulgogi",
      groceryIngredients: [{ item: "boneless ribeye, top sirloin, or skirt steak", quantity: 2, unit: "lb" }],
      ingredients: [],
      instructions: [],
      title: "Korean BBQ Bulgogi",
    },
    {
      id: "oven-reverse-seared-wagyu-ribeye",
      groceryIngredients: [{ item: "thick-cut ribeye steak", quantity: 1, unit: "lb" }],
      ingredients: [],
      instructions: [],
      title: "Reverse-Seared Wagyu Ribeye",
    },
  ];

  selectAllRecipes(runtime, sourceRecipes);

  assert.equal(runtime.grocery.totalsByKey.steak, undefined);
  assert.deepEqual(runtime.grocery.totalsByKey["top sirloin steak, strip steak, or flat iron steak"].oz, { min: 20, max: 20 });
  assert.deepEqual(runtime.grocery.totalsByKey["boneless ribeye, top sirloin, or skirt steak"].oz, { min: 32, max: 32 });
  assert.deepEqual(runtime.grocery.totalsByKey["thick-cut ribeye steak"].oz, { min: 16, max: 16 });
  assert.equal(
    runtime.displayNamesByKey["top sirloin steak, strip steak, or flat iron steak"],
    "top sirloin steak, strip steak, or flat iron steak"
  );
});

test("specific onion grocery items do not collapse into vague onion totals", () => {
  const runtime = createRecipeRuntimeState();
  const sourceRecipes = [
    {
      id: "salsa",
      groceryIngredients: [{ item: "white onion", quantity: 0.5 }],
      ingredients: [],
      instructions: [],
      title: "Salsa",
    },
    {
      id: "sandwich",
      groceryIngredients: [{ item: "red onion", quantity: 1 }],
      ingredients: [],
      instructions: [],
      title: "Sandwich",
    },
  ];

  selectAllRecipes(runtime, sourceRecipes);

  assert.equal(runtime.grocery.totalsByKey.onion, undefined);
  assert.deepEqual(runtime.grocery.totalsByKey["white onion"].item, { min: 0.5, max: 0.5 });
  assert.deepEqual(runtime.grocery.totalsByKey["red onion"].item, { min: 1, max: 1 });
  assert.equal(runtime.displayNamesByKey["white onion"], "white onion");
  assert.equal(runtime.displayNamesByKey["red onion"], "red onion");
});

test("clearGroceryState resets selected, checked, totals, and display names", () => {
  const runtime = createRecipeRuntimeState();
  setRecipeSelected(runtime, recipes, recipes[0], 0, true);
  setRecipeMultiplier(runtime, recipes, recipes[0], 0, 2);
  addManualGroceryItem(runtime, "Seltzer", { id: "manual-1" });
  setGroceryChecked(runtime, "garlic", true);

  clearGroceryState(runtime);

  assert.deepEqual(runtime.selectedRecipeIds, {});
  assert.deepEqual(runtime.recipeMultipliersById, {});
  assert.deepEqual(runtime.groceryCheckedByKey, {});
  assert.deepEqual(runtime.manualGroceryItemsById, {});
  assert.deepEqual(runtime.grocery.totalsByKey, {});
  assert.deepEqual(runtime.displayNamesByKey, {});
});
