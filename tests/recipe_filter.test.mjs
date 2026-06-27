import assert from "node:assert/strict";

import {
  buildRecipeSearchText,
  getMatchingRecipeIndexes,
  normalizeForSearch,
  recipeSearchTextMatches,
  recipeMatchesSelectedFilters,
  recipeMatchesVisibilityOptions,
} from "../js/recipe_filter.js";
import { test } from "./test_helpers.mjs";

const recipe = {
  author: "Robert",
  description: "Weeknight dinner",
  ingredients: ["1 can beans", "2 tbsp chili powder"],
  instructions: ["Simmer until thick"],
  notes: ["freezes well"],
  tags: {
    difficulty: "easy",
    equipment: ["dutch-oven"],
    rating: "great",
    status: "tried",
  },
  title: "Dutch Oven Chili",
};

test("buildRecipeSearchText includes searchable recipe fields", () => {
  const searchText = buildRecipeSearchText(recipe);
  assert.ok(searchText.includes("dutch oven chili"));
  assert.ok(searchText.includes("beans"));
  assert.ok(searchText.includes("simmer"));
  assert.ok(searchText.includes("freezes well"));
});

test("recipeMatchesSelectedFilters applies tag groups", () => {
  assert.equal(recipeMatchesSelectedFilters(recipe, { status: new Set(["tried"]) }), true);
  assert.equal(recipeMatchesSelectedFilters(recipe, { difficulty: new Set(["hard"]) }), false);
  assert.equal(recipeMatchesSelectedFilters(recipe, { equipment: new Set(["dutch-oven"]) }), true);
});

test("recipeMatchesVisibilityOptions combines search, favorites, selection, and tags", () => {
  const searchText = buildRecipeSearchText(recipe);

  assert.equal(
    recipeMatchesVisibilityOptions({
      filterText: "chili",
      isFavorite: false,
      isSelected: true,
      recipe,
      searchText,
      selectedFilters: { status: new Set(["tried"]) },
      showFavoriteOnly: false,
      showSelectedOnly: true,
    }),
    true
  );

  assert.equal(
    recipeMatchesVisibilityOptions({
      filterText: "cake",
      isFavorite: true,
      isSelected: true,
      recipe,
      searchText,
      selectedFilters: {},
      showFavoriteOnly: true,
      showSelectedOnly: true,
    }),
    false
  );
});

test("normalizeForSearch collapses whitespace and case", () => {
  assert.equal(normalizeForSearch("  Dutch   Oven  "), "dutch oven");
});

test("recipeSearchTextMatches supports out-of-order search terms", () => {
  const searchText = buildRecipeSearchText(recipe);

  assert.equal(recipeSearchTextMatches(searchText, "dutch chili"), true);
  assert.equal(recipeSearchTextMatches(searchText, "oven dutch"), true);
  assert.equal(recipeSearchTextMatches(searchText, "dutch cake"), false);
});

test("getMatchingRecipeIndexes filters recipe data without rendered DOM", () => {
  const recipes = [
    recipe,
    {
      ingredients: ["2 cups flour"],
      instructions: ["Bake until set"],
      tags: {
        difficulty: "medium",
        status: "not-tried",
      },
      title: "Blueberry Cake",
    },
  ];

  assert.deepEqual(
    getMatchingRecipeIndexes({
      filterText: "blueberry",
      isFavorite: () => false,
      isSelected: () => false,
      recipes,
      searchTexts: recipes.map(buildRecipeSearchText),
      selectedFilters: {},
      showFavoriteOnly: false,
      showSelectedOnly: false,
    }),
    [1]
  );

  assert.deepEqual(
    getMatchingRecipeIndexes({
      filterText: "",
      isFavorite: (_item, index) => index === 0,
      isSelected: () => false,
      recipes,
      searchTexts: recipes.map(buildRecipeSearchText),
      selectedFilters: { status: new Set(["tried"]) },
      showFavoriteOnly: true,
      showSelectedOnly: false,
    }),
    [0]
  );
});
