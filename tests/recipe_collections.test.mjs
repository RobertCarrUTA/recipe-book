import assert from "node:assert/strict";

import {
  getRecipeCollectionBadges,
  getRecipeCollectionDescription,
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
  { id: "health-conscious", label: "Health-conscious" },
  { id: "meal-prep-friendly", label: "Meal-prep friendly" },
];

test("recipe collection catalog keeps its curated ids, labels, and order", () => {
  assert.deepEqual(recipeCollectionDefinitions.map(({ id, label }) => ({ id, label })), expectedDefinitions);
  assert.equal(recipeCollectionDefinitions.length, 15);
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


test("editorial collection badges are opt-in, normalized, and in catalog order", () => {
  const badges = getRecipeCollectionBadges([
    "meal-prep-friendly", " Breakfast ", " HEALTH-CONSCIOUS ", "health-conscious", "unknown",
  ]);
  assert.deepEqual(badges.map(({ id }) => id), ["health-conscious", "meal-prep-friendly"]);
  assert.ok(badges.every(({ description, showOnCard }) => description && showOnCard));
  assert.deepEqual(getRecipeCollectionBadges(null), []);
  assert.deepEqual(getRecipeCollectionBadges(["breakfast", "main-dishes"]), []);
  assert.match(getRecipeCollectionDescription("health-conscious"), /Not a nutrition certification/);
  assert.match(getRecipeCollectionDescription("meal-prep-friendly"), /storage/);
  assert.equal(getRecipeCollectionDescription("breakfast"), "");
  assert.equal(getRecipeCollectionDescription("unknown"), "");
});
