import assert from "node:assert/strict";

import {
  applyUiStateToControls,
  getSelectedRecipeFilters,
  readUiStateFromControls,
} from "../js/ui_state.js";
import { recipeSortModes } from "../js/recipe_sort.js";
import { test } from "./test_helpers.mjs";

function createElement(options = {}) {
  return {
    checked: Boolean(options.checked),
    dataset: options.dataset || {},
    value: options.value || "",
  };
}

function createFakeDocument({ controls = {}, filters = [] } = {}) {
  return {
    getElementById(id) {
      return controls[id] || null;
    },
    querySelectorAll(selector) {
      if (selector === ".recipe-filters input:checked") {
        return filters.filter((filter) => filter.checked);
      }
      if (selector === ".recipe-filters input") return filters;
      return [];
    },
  };
}

test("readUiStateFromControls normalizes stale recipe sort values", () => {
  const controls = {
    groupToggle: createElement({ checked: true }),
    hideCheckedGroceryItems: createElement({ checked: true }),
    keepScreenAwake: createElement({ checked: true }),
    recipeSearch: createElement({ value: "chili" }),
    recipeSort: createElement({ value: "old-sort" }),
    showFavoriteRecipesOnly: createElement({ checked: true }),
    showSelectedRecipesOnly: createElement({ checked: true }),
  };
  const filters = [
    createElement({ checked: true, dataset: { filter: "status" }, value: "tried" }),
    createElement({ checked: false, dataset: { filter: "rating" }, value: "great" }),
  ];

  const uiState = readUiStateFromControls(createFakeDocument({ controls, filters }));

  assert.equal(uiState.recipeSort, recipeSortModes.default);
  assert.equal(uiState.recipeSearch, "chili");
  assert.equal(uiState.groupItems, true);
  assert.equal(uiState.hideCheckedGroceryItems, true);
  assert.equal(uiState.keepScreenAwake, true);
  assert.equal(uiState.showFavoriteRecipesOnly, true);
  assert.equal(uiState.showSelectedRecipesOnly, true);
  assert.deepEqual(uiState.filters, { status: ["tried"] });
});

test("applyUiStateToControls restores controls and falls back to default sort", () => {
  const controls = {
    groupToggle: createElement(),
    hideCheckedGroceryItems: createElement(),
    keepScreenAwake: createElement(),
    recipeSearch: createElement(),
    recipeSort: createElement({ value: recipeSortModes.fastest }),
    showFavoriteRecipesOnly: createElement(),
    showSelectedRecipesOnly: createElement(),
  };
  const filters = [
    createElement({ dataset: { filter: "status" }, value: "tried" }),
    createElement({ dataset: { filter: "status" }, value: "not-tried" }),
    createElement({ dataset: { filter: "rating" }, value: "great" }),
  ];

  applyUiStateToControls(createFakeDocument({ controls, filters }), {
    filters: {
      rating: ["great"],
      status: ["tried"],
    },
    groupItems: true,
    hideCheckedGroceryItems: true,
    keepScreenAwake: true,
    recipeSearch: "beans",
    recipeSort: "surprise-me",
    showFavoriteRecipesOnly: true,
    showSelectedRecipesOnly: true,
  });

  assert.equal(controls.recipeSort.value, recipeSortModes.default);
  assert.equal(controls.recipeSearch.value, "beans");
  assert.equal(controls.groupToggle.checked, true);
  assert.equal(controls.hideCheckedGroceryItems.checked, true);
  assert.equal(controls.keepScreenAwake.checked, true);
  assert.equal(controls.showFavoriteRecipesOnly.checked, true);
  assert.equal(controls.showSelectedRecipesOnly.checked, true);
  assert.deepEqual(filters.map((filter) => filter.checked), [true, false, true]);
});

test("getSelectedRecipeFilters returns set-backed checked filter groups", () => {
  const filters = [
    createElement({ checked: true, dataset: { filter: "status" }, value: "tried" }),
    createElement({ checked: true, dataset: { filter: "equipment" }, value: "dutch-oven" }),
    createElement({ checked: false, dataset: { filter: "equipment" }, value: "instant-pot" }),
  ];

  const selected = getSelectedRecipeFilters(createFakeDocument({ filters }));

  assert.deepEqual(selected.status, new Set(["tried"]));
  assert.deepEqual(selected.equipment, new Set(["dutch-oven"]));
});
