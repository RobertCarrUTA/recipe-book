import assert from "node:assert/strict";

import { createRecipeRepository } from "../js/recipe_repository.js";
import { test } from "./test_helpers.mjs";

async function withMockFetch(fetchImplementation, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImplementation;

  try {
    await run();
  } finally {
    if (originalFetch === undefined) {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = originalFetch;
    }
  }
}

test("createRecipeRepository loads bundled recipes and tags their source", async () => {
  const requestedUrls = [];
  const repository = createRecipeRepository({
    bundledUrl: "data/custom-recipes.json",
    logger: { warn() {} },
  });

  await withMockFetch(
    async (url) => {
      requestedUrls.push(url);
      return {
        ok: true,
        async json() {
          return [
            {
              id: "toast",
              ingredients: ["1 slice bread"],
              instructions: ["Toast bread."],
              title: "Toast",
            },
          ];
        },
      };
    },
    async () => {
      const result = await repository.loadAllRecipes();

      assert.match(requestedUrls[0], /^data\/custom-recipes\.json\?_=.+/);
      assert.deepEqual(result.warnings, []);
      assert.equal(result.recipes[0].id, "toast");
      assert.equal(result.recipes[0].source, "bundled");
    }
  );
});
