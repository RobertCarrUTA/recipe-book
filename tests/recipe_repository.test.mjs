import assert from "node:assert/strict";

import { createRecipeRepository } from "../js/recipe_repository.js";
import { test } from "./test_helpers.mjs";

test("createRecipeRepository loads bundled recipes and tags their source", async () => {
  const requestedUrls = [];
  const repository = createRecipeRepository({
    bundledUrl: "data/custom-recipes.json",
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      return {
        ok: true,
        async json() {
          return [
            {
              collections: ["breakfast"],
              id: "toast",
              groceryIngredients: [{ item: "bread", quantity: 1, unit: "slice" }],
              ingredients: ["1 slice bread"],
              instructions: ["Toast bread."],
              title: "Toast",
            },
          ];
        },
      };
    },
    logger: { warn() {} },
  });

  const result = await repository.loadAllRecipes();

  assert.match(requestedUrls[0], /^data\/custom-recipes\.json\?_=.+/);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.recipes[0].id, "toast");
  assert.equal(result.recipes[0].source, "bundled");
});
