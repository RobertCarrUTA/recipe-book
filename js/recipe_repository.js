import { loadRecipes } from "./recipes.js";

export function createRecipeRepository({ logger, bundledUrl = "data/recipes.json" } = {}) {
  async function loadAllRecipes() {
    const result = await loadRecipes({ logger, url: bundledUrl });
    return {
      recipes: result.recipes.map((recipe) => ({ ...recipe, source: recipe.source || "bundled" })),
      warnings: result.warnings,
    };
  }

  return { loadAllRecipes };
}
