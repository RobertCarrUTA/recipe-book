import { normalizeRecipeBook } from "./recipe_schema.js";

export async function loadRecipes(options = {}) {
  const url = options.url || "data/recipes.json";
  const logger = options.logger || console;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Unable to load recipes.json (${response.status})`);
  }

  const rawRecipes = await response.json();
  const result = normalizeRecipeBook(rawRecipes);

  if (result.warnings.length) {
    logger.warn(`${result.warnings.length} recipe data warnings`, result.warnings);
  }

  return result;
}
