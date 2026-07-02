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
