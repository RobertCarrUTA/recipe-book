import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  createRecipeRuntimeState,
  getRecipeGroceryIngredients,
  selectAllRecipes,
} from "../js/grocery_model.js";
import { analyzeRecipeDataQuality } from "../js/recipe_quality_report.js";
import { recipeCollectionDefinitions } from "../js/recipe_collections.js";
import { normalizeRecipeBook } from "../js/recipe_schema.js";
import { formatTotalsForKey } from "../js/units.js";
import { test } from "./test_helpers.mjs";

async function loadRawRecipes() {
  const recipeDataUrl = new URL("../data/recipes.json", import.meta.url);
  return JSON.parse(await fs.readFile(recipeDataUrl, "utf8"));
}

async function loadNormalizedRecipes() {
  return normalizeRecipeBook(await loadRawRecipes());
}

test("current recipe data uses nonempty known collections", async () => {
  const rawRecipes = await loadRawRecipes();
  const knownCollectionIds = new Set(recipeCollectionDefinitions.map(({ id }) => id));
  const missingCollections = rawRecipes
    .filter((recipe) => !Array.isArray(recipe.collections) || !recipe.collections.length)
    .map((recipe) => recipe.id);
  const unknownCollections = rawRecipes.flatMap((recipe) =>
    (Array.isArray(recipe.collections) ? recipe.collections : [])
      .filter((collectionId) => !knownCollectionIds.has(collectionId))
      .map((collectionId) => `${recipe.id}: ${collectionId}`)
  );
  const duplicateCollections = rawRecipes
    .filter((recipe) =>
      Array.isArray(recipe.collections) &&
      new Set(recipe.collections).size !== recipe.collections.length
    )
    .map((recipe) => recipe.id);
  const usedCollectionIds = new Set(rawRecipes.flatMap((recipe) => recipe.collections || []));
  const unusedCollections = recipeCollectionDefinitions
    .map(({ id }) => id)
    .filter((collectionId) => !usedCollectionIds.has(collectionId));

  assert.deepEqual(missingCollections, []);
  assert.deepEqual(unknownCollections, []);
  assert.deepEqual(duplicateCollections, []);
  assert.deepEqual(unusedCollections, []);
});

test("current recipe data preserves representative collection overlaps", async () => {
  const rawRecipes = await loadRawRecipes();
  const recipesById = Object.fromEntries(rawRecipes.map((recipe) => [recipe.id, recipe]));
  const expectedMemberships = {
    "baking-steel-pepperoni-sausage-ricotta-pizza": ["main-dishes", "pizza", "baking"],
    "best-chewy-chocolate-chip-cookies": ["baking", "cookies", "desserts"],
    "garlic-steak-sandwiches": ["main-dishes", "sandwiches", "steak"],
    "nonalcoholic-pina-colada": ["drinks"],
  };

  Object.entries(expectedMemberships).forEach(([recipeId, expectedCollections]) => {
    const recipe = recipesById[recipeId];
    assert.ok(recipe, `${recipeId} should exist`);
    expectedCollections.forEach((collectionId) => {
      assert.ok(
        recipe.collections.includes(collectionId),
        `${recipeId} should belong to ${collectionId}`
      );
    });
  });
});

test("current recipe data keeps bundled grocery labels out of Other", async () => {
  const { recipes, warnings } = await loadNormalizedRecipes();
  const report = analyzeRecipeDataQuality(recipes, { schemaWarnings: warnings });
  const ungroupedLabels = report.grocery.ungroupedLabels
    .map((item) => `${item.display} (${item.count})`);

  assert.deepEqual(ungroupedLabels, []);
});

test("current recipe data has no grocery parse failures or unknown units", async () => {
  const { recipes, warnings } = await loadNormalizedRecipes();
  const report = analyzeRecipeDataQuality(recipes, { schemaWarnings: warnings });

  assert.deepEqual(report.grocery.parseFailures, []);
  assert.deepEqual(report.grocery.unknownUnits, []);
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

test("current salsa recipe data keeps white onion quantities recipe-specific", async () => {
  const { recipes } = await loadNormalizedRecipes();
  const recipeIds = [
    "fresh-table-salsa",
    "roasted-tomato-tomatillo-taqueria-roja-salsa",
    "sausage-egg-potato-cheese-breakfast-burritos-with-simmered-guajillo-arbol-drip-sauce",
  ];
  const selectedRecipes = recipeIds.map((recipeId) => recipes.find((recipe) => recipe.id === recipeId));
  assert.equal(selectedRecipes.filter(Boolean).length, recipeIds.length);

  const runtime = createRecipeRuntimeState();
  selectAllRecipes(runtime, selectedRecipes);

  assert.deepEqual(runtime.grocery.totalsByKey["white onion"], {
    item: { min: 0.625, max: 0.625 },
    tsp: { min: 16, max: 16 },
  });
  assert.equal(
    formatTotalsForKey(runtime.grocery.totalsByKey["white onion"], { canonicalKey: "white onion" }),
    "1/3 cup + 5/8 white onion"
  );

  const sourceTotalsById = Object.fromEntries(
    runtime.grocery.sourcesByKey["white onion"].map((source) => [
      source.id,
      formatTotalsForKey(source.totals, { canonicalKey: "white onion" }),
    ])
  );

  assert.deepEqual(sourceTotalsById, {
    "fresh-table-salsa": "1/3 cup",
    "roasted-tomato-tomatillo-taqueria-roja-salsa": "1/2 white onion",
    "sausage-egg-potato-cheese-breakfast-burritos-with-simmered-guajillo-arbol-drip-sauce": "1/8 white onion",
  });
});
