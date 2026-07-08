import assert from "node:assert/strict";

import {
  getRecipeDiscoveryResult,
  isRuntimeRecipeSort,
} from "../js/recipe_discovery.js";
import { buildRecipeSearchText } from "../js/recipe_filter.js";
import { recipeSortModes } from "../js/recipe_sort.js";
import { test } from "./test_helpers.mjs";

const recipes = [
  {
    id: "chili",
    ingredients: ["beans", "tomatoes"],
    tags: { difficulty: "easy", rating: "great", status: "tried" },
    title: "Dutch Oven Chili",
    totalTime: "45 mins",
  },
  {
    id: "cake",
    ingredients: ["flour", "blueberries"],
    tags: { difficulty: "medium", rating: "good", status: "not-tried" },
    title: "Blueberry Cake",
    totalTime: "30 mins",
  },
  {
    id: "pasta",
    ingredients: ["noodles", "tomatoes"],
    tags: { difficulty: "easy", rating: "okay", status: "tried" },
    title: "Tomato Pasta",
    totalTime: "20 mins",
  },
];

const searchTexts = recipes.map(buildRecipeSearchText);

test("getRecipeDiscoveryResult filters recipes and reports discovery state", () => {
  const result = getRecipeDiscoveryResult({
    filterText: "tomato",
    isFavorite: (_recipe, index) => index === 0,
    isSelected: (_recipe, index) => index === 2,
    recipes,
    searchTexts,
    selectedFilters: { status: new Set(["tried"]) },
    showFavoriteOnly: false,
    showSelectedOnly: false,
    sortMode: recipeSortModes.default,
  });

  assert.deepEqual(result.recipeIndexes, [0, 2]);
  assert.deepEqual(result.matchingRecipeIndexes, [0, 2]);
  assert.equal(result.filterText, "tomato");
  assert.equal(result.matchCount, 2);
  assert.equal(result.totalCount, 3);
  assert.equal(result.activeDiscoveryFilterCount, 2);
  assert.equal(result.sortMode, recipeSortModes.default);
});

test("getRecipeDiscoveryResult applies runtime-aware sorting after filtering", () => {
  const result = getRecipeDiscoveryResult({
    filterText: "",
    isFavorite: (_recipe, index) => index === 1,
    isSelected: (_recipe, index) => index === 2,
    recipes,
    searchTexts,
    selectedFilters: {},
    showFavoriteOnly: false,
    showSelectedOnly: false,
    sortMode: recipeSortModes.selectedFirst,
  });

  assert.deepEqual(result.matchingRecipeIndexes, [0, 1, 2]);
  assert.deepEqual(result.recipeIndexes, [2, 1, 0]);
  assert.equal(result.activeDiscoveryFilterCount, 0);
});

test("getRecipeDiscoveryResult normalizes invalid sort and empty recipe inputs", () => {
  const result = getRecipeDiscoveryResult({
    filterText: " chili ",
    recipes: null,
    searchTexts: null,
    selectedFilters: null,
    showFavoriteOnly: true,
    showSelectedOnly: true,
    sortMode: "surprise-me",
  });

  assert.deepEqual(result.recipeIndexes, []);
  assert.deepEqual(result.selectedFilters, {});
  assert.equal(result.sortMode, recipeSortModes.default);
  assert.equal(result.activeDiscoveryFilterCount, 3);
});

test("isRuntimeRecipeSort identifies sorts that depend on favorite or selected state", () => {
  assert.equal(isRuntimeRecipeSort(recipeSortModes.favoritesFirst), true);
  assert.equal(isRuntimeRecipeSort(recipeSortModes.selectedFirst), true);
  assert.equal(isRuntimeRecipeSort(recipeSortModes.fastest), false);
  assert.equal(isRuntimeRecipeSort("surprise-me"), false);
});
