import assert from "node:assert/strict";

import {
  buildRecipeSearchText,
  countActiveRecipeDiscoveryFilters,
  countSelectedRecipeFilters,
  getMatchingRecipeIndexes,
  normalizeForSearch,
  recipeSearchTextMatches,
  recipeMatchesSelectedFilters,
  recipeMatchesVisibilityOptions,
} from "../js/recipe_filter.js";
import { test } from "./test_helpers.mjs";

const recipe = {
  author: "Robert",
  category: "Dinner",
  collections: ["main-dishes", "soups-stews"],
  description: "Weeknight dinner",
  equipment: ["Dutch oven"],
  ingredients: ["1 can beans", "2 tbsp chili powder"],
  instructions: ["Simmer until thick"],
  notes: ["freezes well"],
  personalNotes: ["Add extra chipotle next time"],
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
  assert.ok(searchText.includes("dinner"));
  assert.ok(searchText.includes("dutch oven"));
  assert.ok(searchText.includes("simmer"));
  assert.ok(searchText.includes("extra chipotle"));
  assert.ok(searchText.includes("freezes well"));
  assert.ok(searchText.includes("soups stews"));
});

test("recipeMatchesSelectedFilters applies tag groups", () => {
  assert.equal(recipeMatchesSelectedFilters(recipe, { status: new Set(["tried"]) }), true);
  assert.equal(recipeMatchesSelectedFilters(recipe, { difficulty: new Set(["hard"]) }), false);
  assert.equal(recipeMatchesSelectedFilters(recipe, { equipment: new Set(["dutch-oven"]) }), true);
});

test("recipeMatchesSelectedFilters accepts array-backed selected filters", () => {
  assert.equal(
    recipeMatchesSelectedFilters(recipe, {
      equipment: ["dutch-oven"],
      rating: ["great"],
      status: ["tried"],
    }),
    true
  );
  assert.equal(recipeMatchesSelectedFilters(recipe, { status: ["not-tried"] }), false);
  assert.equal(recipeMatchesSelectedFilters(recipe, { equipment: ["instant-pot"] }), false);
});

test("recipeMatchesSelectedFilters supports multi-collection membership and within-group OR", () => {
  const steakSandwich = {
    collections: ["main-dishes", "sandwiches", "steak"],
    tags: {
      difficulty: "easy",
      status: "tried",
    },
  };

  assert.equal(
    recipeMatchesSelectedFilters(steakSandwich, {
      collection: new Set(["pizza", "steak"]),
    }),
    true
  );
  assert.equal(
    recipeMatchesSelectedFilters(steakSandwich, {
      collection: ["pizza", "desserts"],
    }),
    false
  );
  assert.equal(
    recipeMatchesSelectedFilters({ tags: { status: "tried" } }, {
      collection: ["steak"],
    }),
    false
  );
});

test("recipeMatchesSelectedFilters combines collection and tag groups with AND", () => {
  const steakSandwich = {
    collections: ["sandwiches", "steak"],
    tags: {
      difficulty: "easy",
      status: "tried",
    },
  };

  assert.equal(
    recipeMatchesSelectedFilters(steakSandwich, {
      collection: ["steak"],
      difficulty: ["easy"],
      status: ["tried"],
    }),
    true
  );
  assert.equal(
    recipeMatchesSelectedFilters(steakSandwich, {
      collection: ["steak"],
      status: ["not-tried"],
    }),
    false
  );
});

test("countSelectedRecipeFilters accepts set and array backed filter groups", () => {
  assert.equal(
    countSelectedRecipeFilters({
      difficulty: ["easy"],
      equipment: new Set(["dutch-oven", "instant-pot"]),
      status: [],
    }),
    3
  );
});

test("countActiveRecipeDiscoveryFilters includes search and visibility toggles", () => {
  assert.equal(
    countActiveRecipeDiscoveryFilters({
      filterText: "  chili  ",
      selected: { status: new Set(["tried"]) },
      showFavoriteOnly: true,
      showSelectedOnly: false,
    }),
    3
  );
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

test("recipeMatchesVisibilityOptions skips search text work when search is blank", () => {
  assert.equal(
    recipeMatchesVisibilityOptions({
      filterText: "",
      isFavorite: false,
      isSelected: false,
      recipe,
      searchText: {
        toString() {
          throw new Error("blank searches should not normalize recipe search text");
        },
      },
      selectedFilters: {},
      showFavoriteOnly: false,
      showSelectedOnly: false,
    }),
    true
  );
});

test("normalizeForSearch collapses whitespace and case", () => {
  assert.equal(normalizeForSearch("  Dutch   Oven  "), "dutch oven");
});

test("normalizeForSearch makes common separators searchable as spaces", () => {
  assert.equal(normalizeForSearch("Instant-Pot/Slow_Cooker"), "instant pot slow cooker");
});

test("recipeSearchTextMatches supports out-of-order search terms", () => {
  const searchText = buildRecipeSearchText(recipe);

  assert.equal(recipeSearchTextMatches(searchText, "dutch chili"), true);
  assert.equal(recipeSearchTextMatches(searchText, "oven dutch"), true);
  assert.equal(recipeSearchTextMatches(searchText, "dutch cake"), false);
});

test("recipeSearchTextMatches accepts raw search text", () => {
  assert.equal(recipeSearchTextMatches("Dutch Oven Chili with Beans", "oven beans"), true);
});

test("recipeSearchTextMatches matches hyphenated recipe text with spaced search terms", () => {
  assert.equal(recipeSearchTextMatches("semi-sweet chocolate chips", "semi sweet"), true);
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

test("getMatchingRecipeIndexes honors array-backed selected filters", () => {
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
      filterText: "",
      isFavorite: () => false,
      isSelected: () => false,
      recipes,
      searchTexts: recipes.map(buildRecipeSearchText),
      selectedFilters: { difficulty: ["medium"] },
      showFavoriteOnly: false,
      showSelectedOnly: false,
    }),
    [1]
  );
});

test("getMatchingRecipeIndexes composes collections with search and status filters", () => {
  const recipes = [
    {
      collections: ["main-dishes", "pizza", "baking"],
      ingredients: ["pepperoni"],
      tags: { status: "tried" },
      title: "Hot Honey Pizza",
    },
    {
      collections: ["main-dishes", "sandwiches", "steak"],
      ingredients: ["garlic", "sirloin"],
      tags: { status: "tried" },
      title: "Garlic Steak Sandwiches",
    },
    {
      collections: ["baking", "cookies", "desserts"],
      ingredients: ["chocolate chips"],
      tags: { status: "not-tried" },
      title: "Chocolate Chip Cookies",
    },
  ];

  assert.deepEqual(
    getMatchingRecipeIndexes({
      filterText: "garlic",
      isFavorite: () => false,
      isSelected: () => false,
      recipes,
      searchTexts: recipes.map(buildRecipeSearchText),
      selectedFilters: {
        collection: new Set(["pizza", "sandwiches"]),
        status: new Set(["tried"]),
      },
      showFavoriteOnly: false,
      showSelectedOnly: false,
    }),
    [1]
  );
});

test("getMatchingRecipeIndexes can reuse normalized filter and search text", () => {
  assert.deepEqual(
    getMatchingRecipeIndexes({
      filterText: "dutch chili",
      filterTextIsNormalized: true,
      isFavorite: () => false,
      isSelected: () => false,
      recipes: [recipe],
      searchTexts: [buildRecipeSearchText(recipe)],
      searchTextsAreNormalized: true,
      selectedFilters: {},
      showFavoriteOnly: false,
      showSelectedOnly: false,
    }),
    [0]
  );
});

test("getMatchingRecipeIndexes skips runtime state checks when visibility toggles are off", () => {
  let favoriteChecks = 0;
  let selectedChecks = 0;

  assert.deepEqual(
    getMatchingRecipeIndexes({
      filterText: "",
      isFavorite: () => {
        favoriteChecks += 1;
        return false;
      },
      isSelected: () => {
        selectedChecks += 1;
        return false;
      },
      recipes: [recipe],
      searchTexts: [buildRecipeSearchText(recipe)],
      searchTextsAreNormalized: true,
      selectedFilters: {},
      showFavoriteOnly: false,
      showSelectedOnly: false,
    }),
    [0]
  );

  assert.equal(favoriteChecks, 0);
  assert.equal(selectedChecks, 0);
});

test("getMatchingRecipeIndexes skips recipe reads when discovery controls are neutral", () => {
  const recipes = new Array(2);
  Object.defineProperty(recipes, "0", {
    get() {
      throw new Error("neutral filtering should not inspect recipe data");
    },
  });
  Object.defineProperty(recipes, "1", {
    get() {
      throw new Error("neutral filtering should not inspect recipe data");
    },
  });

  assert.deepEqual(
    getMatchingRecipeIndexes({
      filterText: "",
      isFavorite: () => {
        throw new Error("neutral filtering should not inspect favorite state");
      },
      isSelected: () => {
        throw new Error("neutral filtering should not inspect selected state");
      },
      recipes,
      searchTexts: [],
      selectedFilters: {},
      showFavoriteOnly: false,
      showSelectedOnly: false,
    }),
    [0, 1]
  );
});

test("getMatchingRecipeIndexes skips search text work when tag filters exclude a recipe", () => {
  const searchTexts = [];
  Object.defineProperty(searchTexts, "0", {
    get() {
      throw new Error("tag-excluded recipes should not read indexed search text");
    },
  });

  assert.deepEqual(
    getMatchingRecipeIndexes({
      filterText: "chili",
      isFavorite: () => false,
      isSelected: () => false,
      recipes: [recipe],
      searchTexts,
      searchTextsAreNormalized: true,
      selectedFilters: { status: new Set(["not-tried"]) },
      showFavoriteOnly: false,
      showSelectedOnly: false,
    }),
    []
  );
});

test("getMatchingRecipeIndexes skips search text work when search is blank", () => {
  const searchTexts = [];
  Object.defineProperty(searchTexts, "0", {
    get() {
      throw new Error("blank searches should not read indexed search text");
    },
  });

  assert.deepEqual(
    getMatchingRecipeIndexes({
      filterText: "",
      isFavorite: () => false,
      isSelected: () => false,
      recipes: [recipe],
      searchTexts,
      searchTextsAreNormalized: true,
      selectedFilters: {},
      showFavoriteOnly: false,
      showSelectedOnly: false,
    }),
    [0]
  );
});
