import assert from "node:assert/strict";

import { addRecipeDataCacheBuster } from "../js/recipes.js";
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
