import { createCookingRenderer } from "./cooking_renderer.js";
import { createGroceryRenderer } from "./grocery_renderer.js";
import { createRecipeRenderer } from "./recipe_renderer.js";

export function createRenderer({ document, getRecipes, getRuntimeState, getUiState, actions }) {
  const cookingRenderer = createCookingRenderer({ document });
  const groceryRenderer = createGroceryRenderer({
    actions,
    document,
    getRuntimeState,
    getUiState,
  });
  const recipeRenderer = createRecipeRenderer({
    actions,
    document,
    getRecipes,
    openCookingMode: cookingRenderer.openCookingMode,
  });

  return {
    closeCookingMode: cookingRenderer.closeCookingMode,
    goToNextCookingStep: cookingRenderer.goToNextCookingStep,
    goToPreviousCookingStep: cookingRenderer.goToPreviousCookingStep,
    handleCookingResize: cookingRenderer.handleCookingResize,
    isCookingModeOpen: cookingRenderer.isCookingModeOpen,
    renderGroceryList: groceryRenderer.renderGroceryList,
    renderRecipeLoadError: recipeRenderer.renderRecipeLoadError,
    renderRecipes: recipeRenderer.renderRecipes,
    syncFavoriteRecipeIndicators: recipeRenderer.syncFavoriteRecipeIndicators,
    syncRecipeCheckboxes: recipeRenderer.syncRecipeCheckboxes,
    syncRecipeFilterTagStyles: recipeRenderer.syncRecipeFilterTagStyles,
    syncRecipeSelectionIndicators: recipeRenderer.syncRecipeSelectionIndicators,
    toggleCookingIngredients: cookingRenderer.toggleCookingIngredients,
  };
}
