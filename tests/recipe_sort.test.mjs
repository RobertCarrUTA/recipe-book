import assert from "node:assert/strict";

import {
  getRecipeDurationMinutes,
  normalizeRecipeSort,
  parseRecipeDurationMinutes,
  recipeSortModes,
  sortRecipeIndexes,
} from "../js/recipe_sort.js";
import { test } from "./test_helpers.mjs";

const recipes = [
  {
    id: "slow",
    rating: { value: "4.9", count: "10" },
    tags: { difficulty: "hard", rating: "great" },
    title: "Slow Braise",
    totalTime: "2 hrs 15 mins",
  },
  {
    id: "quick",
    rating: { value: "4.2", count: "1,250" },
    tags: { difficulty: "easy", rating: "good" },
    title: "Quick Pasta",
    totalTime: "25 mins",
  },
  {
    id: "medium",
    rating: { value: "4.8", count: "80" },
    tags: { difficulty: "medium", rating: "great" },
    title: "Skillet Dinner",
    prepTime: "10 mins",
    cookTime: "20 mins",
  },
  {
    id: "unknown",
    tags: { difficulty: "easy", rating: "okay" },
    title: "Mystery Bake",
  },
];

test("parseRecipeDurationMinutes handles common recipe time labels", () => {
  assert.equal(parseRecipeDurationMinutes("1 hr 15 mins"), 75);
  assert.equal(parseRecipeDurationMinutes("2 hours"), 120);
  assert.equal(parseRecipeDurationMinutes("PT1H30M"), 90);
  assert.equal(parseRecipeDurationMinutes("1:05"), 65);
  assert.equal(parseRecipeDurationMinutes(""), null);
});

test("getRecipeDurationMinutes falls back to prep and cook time parts", () => {
  assert.equal(getRecipeDurationMinutes(recipes[2]), 30);
});

test("normalizeRecipeSort protects persisted sort values", () => {
  assert.equal(normalizeRecipeSort(recipeSortModes.fastest), recipeSortModes.fastest);
  assert.equal(normalizeRecipeSort("surprise-me"), recipeSortModes.default);
});

test("sortRecipeIndexes ranks recipes by fastest known total time", () => {
  assert.deepEqual(
    sortRecipeIndexes([0, 1, 2, 3], recipes, { sortMode: recipeSortModes.fastest }),
    [1, 2, 0, 3]
  );
});

test("sortRecipeIndexes ranks favorites and selected recipes first without losing stable order", () => {
  assert.deepEqual(
    sortRecipeIndexes([0, 1, 2, 3], recipes, {
      isFavorite: (_recipe, index) => index === 2,
      isSelected: (_recipe, index) => index === 1,
      sortMode: recipeSortModes.favoritesFirst,
    }),
    [2, 1, 0, 3]
  );

  assert.deepEqual(
    sortRecipeIndexes([0, 1, 2, 3], recipes, {
      isFavorite: (_recipe, index) => index === 2,
      isSelected: (_recipe, index) => index === 1,
      sortMode: recipeSortModes.selectedFirst,
    }),
    [1, 2, 0, 3]
  );
});

test("sortRecipeIndexes ranks by rating and difficulty signals", () => {
  const recipesWithUnrated = [
    ...recipes,
    {
      id: "unrated",
      title: "No-Rating Snack",
      totalTime: "5 mins",
    },
  ];

  assert.deepEqual(
    sortRecipeIndexes([0, 1, 2, 3, 4], recipesWithUnrated, { sortMode: recipeSortModes.highestRated }),
    [0, 2, 1, 3, 4]
  );
  assert.deepEqual(
    sortRecipeIndexes([0, 1, 2, 3], recipes, { sortMode: recipeSortModes.easiest }),
    [1, 3, 2, 0]
  );
});
