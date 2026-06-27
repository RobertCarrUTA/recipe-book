import assert from "node:assert/strict";

import {
  addManualGroceryItem,
  createRecipeRuntimeState,
  selectAllRecipes,
  setGroceryChecked,
} from "../js/grocery_model.js";
import {
  createGroceryListText,
  formatGroceryExportEntry,
  getGroceryExportEntries,
} from "../js/grocery_list_exporter.js";
import { test } from "./test_helpers.mjs";

const recipes = [
  {
    id: "chili",
    groceryIngredients: [
      { item: "yellow onion", quantity: 1 },
      { item: "kidney beans", quantity: 2, unit: "can" },
    ],
    ingredients: [],
    instructions: [],
    title: "Chili",
  },
];

test("getGroceryExportEntries creates display entries from recipe and manual grocery state", () => {
  const runtime = createRecipeRuntimeState();
  selectAllRecipes(runtime, recipes);
  addManualGroceryItem(runtime, "Paper towels", { id: "manual-1" });

  const entries = getGroceryExportEntries(runtime);

  assert.equal(entries.length, 3);
  assert.ok(entries.some((entry) => entry.canonicalKey === "kidney beans" && entry.group === "Pantry"));
  assert.ok(entries.some((entry) => entry.group === "Manual Items"));
});

test("formatGroceryExportEntry mirrors grocery item quantities and checkmarks", () => {
  const runtime = createRecipeRuntimeState();
  selectAllRecipes(runtime, recipes);
  setGroceryChecked(runtime, "kidney beans", true);

  const beans = getGroceryExportEntries(runtime).find((entry) => entry.canonicalKey === "kidney beans");

  assert.equal(formatGroceryExportEntry(beans, runtime), "[x] kidney beans - 2 cans");
});

test("createGroceryListText can copy a grouped visible shopping list", () => {
  const runtime = createRecipeRuntimeState();
  selectAllRecipes(runtime, recipes);
  addManualGroceryItem(runtime, "Paper towels", { id: "manual-1" });
  setGroceryChecked(runtime, "kidney beans", true);

  assert.equal(
    createGroceryListText(runtime, { groupItems: true, hideCheckedGroceryItems: true }),
    [
      "Grocery List",
      "",
      "2 visible items - 1 checked hidden",
      "",
      "Manual Items",
      "[ ] Paper towels",
      "",
      "Produce",
      "[ ] yellow onion - 1 yellow onion",
      "",
    ].join("\n")
  );
});
