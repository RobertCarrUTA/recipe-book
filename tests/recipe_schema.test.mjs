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
