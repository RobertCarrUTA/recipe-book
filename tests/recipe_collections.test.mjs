import assert from "node:assert/strict";

import {
  getRecipeCollectionLabel,
  getRecipeCollectionOptions,
  isRecipeCollectionId,
  normalizeRecipeCollections,
  recipeCollectionDefinitions,
} from "../js/recipe_collections.js";
import { test } from "./test_helpers.mjs";

const expectedDefinitions = [
  { id: "breakfast", label: "Breakfast" },
  { id: "main-dishes", label: "Main Dishes" },
  { id: "pizza", label: "Pizza" },
  { id: "sandwiches", label: "Sandwiches" },
  { id: "burgers", label: "Burgers" },
  { id: "steak", label: "Steak" },
  { id: "soups-stews", label: "Soups & Stews" },
  { id: "sides-snacks", label: "Sides & Snacks" },
  { id: "salsas-sauces", label: "Salsas & Sauces" },
  { id: "baking", label: "Baking" },
  { id: "cookies", label: "Cookies & Bars" },
  { id: "desserts", label: "Desserts" },
  { id: "drinks", label: "Drinks" },
];

test("recipe collection catalog keeps its curated ids, labels, and order", () => {
  assert.deepEqual(recipeCollectionDefinitions, expectedDefinitions);
  assert.equal(recipeCollectionDefinitions.length, 13);
  assert.equal(
    new Set(recipeCollectionDefinitions.map(({ id }) => id)).size,
    recipeCollectionDefinitions.length
  );
  assert.ok(Object.isFrozen(recipeCollectionDefinitions));
  assert.ok(recipeCollectionDefinitions.every((definition) => Object.isFrozen(definition)));
});

test("recipe collection options follow catalog order and count each recipe once", () => {
  const recipes = [
    { collections: ["pizza", "main-dishes", "pizza"] },
    { collections: ["sandwiches", "main-dishes"] },
    { collections: [" PIZZA ", "unknown"] },
    { collections: null },
  ];

  assert.deepEqual(getRecipeCollectionOptions(recipes), [
    { id: "main-dishes", label: "Main Dishes", count: 2 },
    { id: "pizza", label: "Pizza", count: 2 },
    { id: "sandwiches", label: "Sandwiches", count: 1 },
  ]);

  const optionsWithEmpty = getRecipeCollectionOptions(recipes, { includeEmpty: true });
  assert.deepEqual(
    optionsWithEmpty.map(({ id }) => id),
    recipeCollectionDefinitions.map(({ id }) => id)
  );
  assert.equal(optionsWithEmpty.length, recipeCollectionDefinitions.length);
  assert.equal(optionsWithEmpty.find(({ id }) => id === "drinks").count, 0);
});

test("recipe collection helpers normalize and identify canonical ids", () => {
  assert.deepEqual(
    normalizeRecipeCollections([" Pizza ", "SANDWICHES", "pizza", "unknown", null]),
    ["pizza", "sandwiches"]
  );
  assert.deepEqual(normalizeRecipeCollections("pizza"), []);
  assert.equal(isRecipeCollectionId("pizza"), true);
  assert.equal(isRecipeCollectionId(" Pizza "), false);
  assert.equal(isRecipeCollectionId("unknown"), false);
  assert.equal(getRecipeCollectionLabel("soups-stews"), "Soups & Stews");
  assert.equal(getRecipeCollectionLabel("unknown"), "unknown");
});
