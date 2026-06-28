import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { getRecipeGroceryIngredients } from "../js/grocery_model.js";
import { analyzeRecipeDataQuality } from "../js/recipe_quality_report.js";
import { normalizeRecipeBook } from "../js/recipe_schema.js";
import { test } from "./test_helpers.mjs";

async function loadNormalizedRecipes() {
  const recipeDataUrl = new URL("../data/recipes.json", import.meta.url);
  const rawRecipes = JSON.parse(await fs.readFile(recipeDataUrl, "utf8"));
  return normalizeRecipeBook(rawRecipes);
}

test("current recipe data keeps bundled grocery labels out of Other", async () => {
  const { recipes, warnings } = await loadNormalizedRecipes();
  const report = analyzeRecipeDataQuality(recipes, { schemaWarnings: warnings });
  const ungroupedLabels = report.grocery.ungroupedLabels
    .map((item) => `${item.display} (${item.count})`);

  assert.deepEqual(ungroupedLabels, []);
});

test("Robert Carr grocery labels keep shopping-specific recipe wording", async () => {
  const { recipes } = await loadNormalizedRecipes();
  const recipesById = Object.fromEntries(recipes.map((recipe) => [recipe.id, recipe]));
  const expectedLabels = [
    ["oven-reverse-seared-wagyu-ribeye", "thick-cut ribeye steak"],
    ["garlic-steak-sandwiches", "top sirloin steak, strip steak, or flat iron steak"],
    ["korean-bbq-bulgogi", "boneless ribeye, top sirloin, or skirt steak"],
    ["chicken-fried-steak", "low-sodium beef broth"],
    ["nashville-hot-chicken-sandwich", "plain shredded cabbage and carrot coleslaw mix"],
    ["nashville-hot-chicken-sandwich", "celery seed"],
    ["mojo-roast-pork-cubano-sandwiches", "yellow mustard seed"],
    ["mojo-roast-pork-cubano-sandwiches", "lard or unsalted butter"],
    ["mojo-roast-pork-cubano-sandwiches", "low-sodium chicken broth"],
    ["hot-honey-chicken-cutlet-sandwiches", "boneless skinless chicken breast"],
    ["garlic-steak-sandwiches", "extra-virgin olive oil"],
    ["korean-bbq-bulgogi", "butter lettuce or red leaf lettuce"],
    ["korean-bbq-galbi", "red leaf lettuce"],
  ];

  expectedLabels.forEach(([recipeId, label]) => {
    const recipe = recipesById[recipeId];
    assert.ok(recipe, `${recipeId} should exist`);

    const parsed = getRecipeGroceryIngredients(recipe).find((entry) => entry.original === label);
    assert.ok(parsed, `${recipeId} should include ${label}`);
    assert.equal(parsed.canonical.base, label);
    assert.equal(parsed.canonical.display, label);
  });
});
