import assert from "node:assert/strict";

import { normalizeRecipeBook } from "../js/recipe_schema.js";
import { test } from "./test_helpers.mjs";

test("normalizeRecipeBook repairs text, defaults tags, and de-duplicates ids", () => {
  const { recipes, warnings } = normalizeRecipeBook([
    {
      id: "same",
      ingredients: ["1 cup water"],
      instructions: ["Bake at 350Â°F."],
      title: "SautÃ© Test",
    },
    {
      id: "same",
      ingredients: [],
      instructions: [],
      title: "Second",
    },
  ]);

  assert.equal(recipes.length, 2);
  assert.equal(recipes[0].title, "Sauté Test");
  assert.equal(recipes[0].instructions[0], "Bake at 350°F.");
  assert.equal(recipes[0].tags.status, "not-tried");
  assert.notEqual(recipes[0].id, recipes[1].id);
  assert.ok(warnings.some((warning) => warning.includes("Duplicate recipe id")));
});

test("normalizeRecipeBook rejects non-array data", () => {
  assert.throws(() => normalizeRecipeBook({}), /recipes\.json must contain an array/);
  assert.throws(() => normalizeRecipeBook([]), /at least one recipe/);
});

test("normalizeRecipeBook resolves generated id collisions", () => {
  const recipe = (id, title) => ({
    groceryIngredients: [{ item: "flour", quantity: 1, unit: "cup" }],
    id,
    ingredients: ["1 cup flour"],
    instructions: ["Mix."],
    title,
  });
  const { recipes } = normalizeRecipeBook([
    recipe("dish-2", "A"),
    recipe("dish", "B"),
    recipe("dish", "C"),
  ]);

  assert.equal(new Set(recipes.map(({ id }) => id)).size, recipes.length);
  assert.deepEqual(recipes.map(({ id }) => id), ["dish-2", "dish", "dish-3"]);
});

test("normalizeRecipeBook rejects malformed field types and unsafe numeric values", () => {
  const { recipes, warnings } = normalizeRecipeBook([
    {
      author: { name: "Not a string" },
      groceryIngredients: [
        { item: "salt", quantity: -1, unit: "pinch" },
        { item: "flour", quantity: { min: 4, max: 2 }, unit: "cup" },
        { item: "sugar", quantity: "many", unit: "cup" },
      ],
      id: { invalid: true },
      ingredients: ["1 cup flour", 42],
      instructions: ["Mix."],
      nutrition: { protein: { amount: "4g" } },
      rating: { count: -2, value: 8 },
      tags: { equipment: ["!!!", 5], status: { invalid: true } },
      title: { invalid: true },
    },
  ]);

  const [recipe] = recipes;
  assert.equal(recipe.title, "Untitled Recipe 1");
  assert.equal(recipe.id, "untitled-recipe-1");
  assert.deepEqual(recipe.ingredients, ["1 cup flour"]);
  assert.deepEqual(recipe.groceryIngredients.map(({ quantity }) => quantity), [undefined, undefined, undefined]);
  assert.equal(recipe.author, undefined);
  assert.equal(recipe.rating, undefined);
  assert.equal(recipe.nutrition, undefined);
  assert.equal(recipe.tags.equipment, undefined);
  assert.equal(recipe.tags.status, "not-tried");
  assert.ok(warnings.some((warning) => warning.includes("invalid title")));
  assert.ok(warnings.some((warning) => warning.includes("invalid rating value")));
  assert.ok(warnings.some((warning) => warning.includes("invalid rating count")));
  assert.equal(warnings.filter((warning) => warning.includes("invalid grocery quantity")).length, 3);
});

test("normalizeRecipeBook normalizes valid recipe collections", () => {
  const { recipes, warnings } = normalizeRecipeBook([
    {
      collections: [" Pizza ", "SANDWICHES"],
      groceryIngredients: [{ item: "flour", quantity: 1, unit: "cup" }],
      ingredients: ["1 cup flour"],
      instructions: ["Cook."],
      title: "Collection Test",
    },
  ]);

  assert.deepEqual(recipes[0].collections, ["pizza", "sandwiches"]);
  assert.deepEqual(
    warnings.filter((warning) => warning.includes("recipe collections")),
    []
  );
});

test("normalizeRecipeBook warns about invalid, duplicate, and missing recipe collections", () => {
  const completeRecipe = {
    groceryIngredients: [{ item: "flour", quantity: 1, unit: "cup" }],
    ingredients: ["1 cup flour"],
    instructions: ["Cook."],
  };
  const { recipes, warnings } = normalizeRecipeBook([
    {
      ...completeRecipe,
      collections: ["pizza", " PIZZA ", "unknown"],
      title: "Invalid Collections",
    },
    {
      ...completeRecipe,
      collections: "drinks",
      title: "Missing Collections",
    },
  ]);

  assert.deepEqual(
    recipes.find(({ title }) => title === "Invalid Collections").collections,
    ["pizza"]
  );
  assert.deepEqual(
    recipes.find(({ title }) => title === "Missing Collections").collections,
    []
  );
  assert.ok(
    warnings.includes('"Invalid Collections" has invalid or duplicate recipe collections.')
  );
  assert.ok(
    warnings.includes('"Missing Collections" has no recognized recipe collections.')
  );
});

test("normalizeRecipeBook rejects free-text grocery ingredient entries", () => {
  const { recipes, warnings } = normalizeRecipeBook([
    {
      groceryIngredients: ["1 cup flour"],
      ingredients: ["1 cup flour"],
      instructions: ["Mix."],
      title: "String Grocery",
    },
  ]);

  assert.equal(recipes[0].groceryIngredients, undefined);
  assert.ok(warnings.some((warning) => warning.includes("invalid grocery ingredient entries")));
  assert.ok(warnings.some((warning) => warning.includes("no grocery ingredient entries")));
});

test("normalizeRecipeBook keeps only http source links", () => {
  const { recipes, warnings } = normalizeRecipeBook([
    {
      groceryIngredients: [{ item: "egg", quantity: 1 }],
      ingredients: ["1 egg"],
      instructions: ["Cook."],
      link: "https://example.com/eggs#recipe",
      title: "Linked Eggs",
    },
    {
      groceryIngredients: [{ item: "flour", quantity: 1, unit: "cup" }],
      ingredients: ["1 cup flour"],
      instructions: ["Mix."],
      link: "javascript:alert(1)",
      title: "Unsafe Link",
    },
  ]);

  const linkedRecipe = recipes.find((recipe) => recipe.title === "Linked Eggs");
  const unsafeRecipe = recipes.find((recipe) => recipe.title === "Unsafe Link");

  assert.equal(linkedRecipe.link, "https://example.com/eggs#recipe");
  assert.equal(unsafeRecipe.link, undefined);
  assert.ok(warnings.some((warning) => warning.includes("invalid source link")));
});
