import { loadRecipes } from "./recipes.js";

export function createRecipeRepository({ fetchImpl, logger, bundledUrl = "data/recipes.json" } = {}) {
  async function loadAllRecipes() {
    const result = await loadRecipes({ fetchImpl, logger, url: bundledUrl });
    return {
      recipes: result.recipes.map((recipe) => ({ ...recipe, source: recipe.source || "bundled" })),
      warnings: result.warnings,
    };
  }

  return { loadAllRecipes };
}
