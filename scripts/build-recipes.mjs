import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeRecipeBook } from "../js/recipe_schema.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const recipeSourceDir = path.join(rootDir, "data", "recipes");
const recipeBundlePath = path.join(rootDir, "data", "recipes.json");
const recipeIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function relativePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function validateRecipeSource(recipe, filePath) {
  if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) {
    throw new Error(`${relativePath(filePath)} must contain one recipe object.`);
  }

  if (typeof recipe.id !== "string" || !recipeIdPattern.test(recipe.id)) {
    throw new Error(`${relativePath(filePath)} must include a simple slug id.`);
  }

  const expectedFileName = `${recipe.id}.json`;
  if (path.basename(filePath) !== expectedFileName) {
    throw new Error(`${relativePath(filePath)} must be named ${expectedFileName}.`);
  }
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${relativePath(filePath)}: ${error.message}`);
  }
}

async function collectRecipeSourceFiles() {
  const entries = await fs.readdir(recipeSourceDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(recipeSourceDir, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

async function loadRecipeSources() {
  const filePaths = await collectRecipeSourceFiles();
  if (!filePaths.length) {
    throw new Error(`${relativePath(recipeSourceDir)} must contain recipe JSON files.`);
  }

  const recipes = [];
  const seenIds = new Set();

  for (const filePath of filePaths) {
    const recipe = await readJsonFile(filePath);
    validateRecipeSource(recipe, filePath);

    if (seenIds.has(recipe.id)) {
      throw new Error(`Duplicate recipe id "${recipe.id}" found in ${relativePath(filePath)}.`);
    }

    seenIds.add(recipe.id);
    recipes.push(recipe);
  }

  const { warnings } = normalizeRecipeBook(recipes);
  if (warnings.length) {
    console.warn(`${warnings.length} recipe data warnings found while building recipes.`);
  }

  return recipes;
}

async function readExistingBundleOrder() {
  try {
    const bundle = await readJsonFile(recipeBundlePath);
    if (!Array.isArray(bundle)) return [];
    return bundle.map((recipe) => recipe?.id).filter((id) => typeof id === "string");
  } catch (error) {
    return [];
  }
}

function orderRecipesForBundle(recipes, existingOrder) {
  const existingIndexById = new Map(existingOrder.map((id, index) => [id, index]));
  const newRecipeIndex = Number.MAX_SAFE_INTEGER;

  return [...recipes].sort((a, b) => {
    const aIndex = existingIndexById.has(a.id) ? existingIndexById.get(a.id) : newRecipeIndex;
    const bIndex = existingIndexById.has(b.id) ? existingIndexById.get(b.id) : newRecipeIndex;

    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.id.localeCompare(b.id);
  });
}

async function buildRecipeBundle() {
  const recipes = await loadRecipeSources();
  const existingOrder = await readExistingBundleOrder();
  return orderRecipesForBundle(recipes, existingOrder);
}

async function checkRecipeBundle(nextText) {
  let currentText = "";

  try {
    currentText = await fs.readFile(recipeBundlePath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read ${relativePath(recipeBundlePath)}: ${error.message}`);
  }

  if (currentText !== nextText) {
    console.error("data/recipes.json is out of date. Run npm run build:recipes.");
    process.exit(1);
  }

  console.log("Recipe bundle is up to date.");
}

async function main() {
  const args = process.argv.slice(2);
  const unknownArgs = args.filter((arg) => arg !== "--check");
  if (unknownArgs.length) {
    throw new Error(`Unknown option: ${unknownArgs.join(", ")}`);
  }

  const bundle = await buildRecipeBundle();
  const nextText = formatJson(bundle);

  if (args.includes("--check")) {
    await checkRecipeBundle(nextText);
    return;
  }

  await fs.writeFile(recipeBundlePath, nextText);
  console.log(`Built ${relativePath(recipeBundlePath)} from ${bundle.length} recipe source files.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
