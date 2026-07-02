import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { getRecipeGroceryIngredients, createRecipeRuntimeState, selectAllRecipes } from "../js/grocery_model.js";
import { parseIngredient } from "../js/ingredient_parser.js";
import { normalizeRecipeBook } from "../js/recipe_schema.js";

const recipeDataUrl = new URL("../data/recipes.json", import.meta.url);
const rawRecipes = JSON.parse(await fs.readFile(recipeDataUrl, "utf8"));
const { recipes, warnings } = normalizeRecipeBook(rawRecipes);

assert.ok(recipes.length > 0, "recipe book should contain recipes");
assert.equal(new Set(recipes.map((recipe) => recipe.id)).size, recipes.length, "recipe ids should be unique");

recipes.forEach((recipe) => {
  assert.ok(recipe.id, "recipe id should be present");
  assert.ok(recipe.title, `recipe ${recipe.id} should have a title`);
  assert.ok(Array.isArray(recipe.ingredients), `${recipe.title} ingredients should be an array`);
  assert.ok(
    Array.isArray(recipe.groceryIngredients) && recipe.groceryIngredients.length > 0,
    `${recipe.title} should have grocery ingredient entries`
  );
  assert.ok(Array.isArray(recipe.instructions), `${recipe.title} instructions should be an array`);
  assert.ok(recipe.tags && recipe.tags.status, `${recipe.title} should have normalized tags`);
});

const flour = parseIngredient("2 cups all-purpose flour");
assert.equal(flour.canonical.base, "all-purpose flour");
assert.equal(flour.unitKey, "cup");
assert.deepEqual(flour.quantityRange, { min: 2, max: 2 });

const runtimeState = createRecipeRuntimeState();
selectAllRecipes(runtimeState, recipes);
const groceryItemCount = new Set([
  ...Object.keys(runtimeState.grocery.totalsByKey),
  ...Object.keys(runtimeState.grocery.notesByKey),
]).size;
assert.ok(groceryItemCount > 0, "selecting all recipes should create grocery items");

const firstRecipeIngredients = getRecipeGroceryIngredients(recipes[0]);
assert.ok(firstRecipeIngredients.length > 0, "first recipe should produce grocery ingredients");

console.log(
  `Verified ${recipes.length} recipes, ${groceryItemCount} grocery keys, ${warnings.length} data warnings.`
);
