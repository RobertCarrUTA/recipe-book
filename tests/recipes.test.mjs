import assert from "node:assert/strict";

import { addRecipeDataCacheBuster, loadRecipes } from "../js/recipes.js";
import { test } from "./test_helpers.mjs";

test("addRecipeDataCacheBuster appends a cache key to recipe data urls", () => {
  assert.equal(
    addRecipeDataCacheBuster("data/recipes.json", "release-1"),
    "data/recipes.json?_=release-1"
  );
  assert.equal(
    addRecipeDataCacheBuster("data/recipes.json?v=release", "phone refresh"),
    "data/recipes.json?v=release&_=phone%20refresh"
  );
  assert.equal(
    addRecipeDataCacheBuster("data/recipes.json#recipes", "fresh"),
    "data/recipes.json?_=fresh#recipes"
  );
});

test("loadRecipes fetches, cache-busts, normalizes, and reports warnings", async () => {
  const requests = [];
  const warnings = [];

  const fetchImpl = async (url, options) => {
      requests.push({ options, url });
      return {
        ok: true,
        async json() {
          return [
            {
              collections: ["breakfast", "baking"],
              id: "banana-bread",
              groceryIngredients: [{ item: "banana", quantity: 2 }],
              ingredients: ["2 bananas"],
              instructions: ["Bake."],
              tags: { status: "tried" },
              title: "Banana Bread",
            },
            {
              collections: ["baking", "desserts"],
              id: "apple-crisp",
              groceryIngredients: [{ item: "apple", quantity: 4 }],
              ingredients: [],
              instructions: ["Bake."],
              title: "Apple Crisp",
            },
          ];
        },
      };
    };
  const result = await loadRecipes({
    cacheBuster: "unit test",
    fetchImpl,
    logger: { warn: (...args) => warnings.push(args) },
    url: "data/test-recipes.json",
  });

  assert.deepEqual(requests, [
    {
      options: { cache: "no-store" },
      url: "data/test-recipes.json?_=unit%20test",
    },
  ]);
  assert.deepEqual(result.recipes.map((recipe) => recipe.title), ["Apple Crisp", "Banana Bread"]);
  assert.equal(result.recipes[0].tags.status, "not-tried");
  assert.equal(result.warnings.length, 1);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], "1 recipe data warnings");
  assert.deepEqual(warnings[0][1], result.warnings);
});

test("loadRecipes can skip cache busting and fails clearly on bad responses", async () => {
  const requests = [];

  await loadRecipes({
    cacheBust: false,
    fetchImpl: async (url, options) => {
      requests.push({ options, url });
      return {
        ok: true,
        async json() {
          return [
            {
              collections: ["breakfast"],
              groceryIngredients: [{ item: "egg", quantity: 1 }],
              ingredients: ["1 egg"],
              instructions: ["Cook."],
              title: "Eggs",
            },
          ];
        },
      };
    },
    url: "data/plain.json",
  });
  assert.deepEqual(requests, [{ options: { cache: "no-store" }, url: "data/plain.json" }]);

  await assert.rejects(
    () => loadRecipes({
      cacheBust: false,
      fetchImpl: async () => ({ ok: false, status: 503 }),
      url: "data/missing.json",
    }),
    /Unable to load recipes\.json \(503\)/
  );
});
