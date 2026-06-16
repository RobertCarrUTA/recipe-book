import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { analyzeRecipeDataQuality } from "../js/recipe_quality_report.js";
import { normalizeRecipeBook } from "../js/recipe_schema.js";
import { test } from "./test_helpers.mjs";

test("current recipe data keeps bundled grocery labels out of Other", async () => {
  const recipeDataUrl = new URL("../data/recipes.json", import.meta.url);
  const rawRecipes = JSON.parse(await fs.readFile(recipeDataUrl, "utf8"));
  const { recipes, warnings } = normalizeRecipeBook(rawRecipes);
  const report = analyzeRecipeDataQuality(recipes, { schemaWarnings: warnings });
  const ungroupedLabels = report.grocery.ungroupedLabels
    .map((item) => `${item.display} (${item.count})`);

  assert.deepEqual(ungroupedLabels, []);
});
