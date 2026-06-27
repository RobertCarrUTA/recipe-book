import { createCookingRenderer } from "./cooking_renderer.js";
import { createGroceryRenderer } from "./grocery_renderer.js";
import { createMealPlanRenderer } from "./meal_plan_renderer.js";
import { createRecipeRenderer } from "./recipe_renderer.js";

export function createRenderer({ document, getMealPlanState, getRecipes, getRuntimeState, getUiState, actions }) {
  const cookingRenderer = createCookingRenderer({ document });
  const groceryRenderer = createGroceryRenderer({
    actions,
    document,
    getRuntimeState,
    getUiState,
  });
  const mealPlanRenderer = createMealPlanRenderer({
    actions,
    document,
    getMealPlanState,
    getRecipes,
    openCookingMode: cookingRenderer.openCookingMode,
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
    getRenderedRecipeCount: recipeRenderer.getRenderedRecipeCount,
    handleCookingResize: cookingRenderer.handleCookingResize,
    isCookingModeOpen: cookingRenderer.isCookingModeOpen,
    renderGroceryList: groceryRenderer.renderGroceryList,
    renderMealPlan: mealPlanRenderer.renderMealPlan,
    renderRecipeLoadError: recipeRenderer.renderRecipeLoadError,
    renderRecipes: recipeRenderer.renderRecipes,
    revealRecipeById: recipeRenderer.revealRecipeById,
    syncMealPlanIndicators: recipeRenderer.syncMealPlanIndicators,
    syncFavoriteRecipeIndicators: recipeRenderer.syncFavoriteRecipeIndicators,
    syncRecipeCheckboxes: recipeRenderer.syncRecipeCheckboxes,
    syncRecipeFilterTagStyles: recipeRenderer.syncRecipeFilterTagStyles,
    syncRecipeSelectionIndicators: recipeRenderer.syncRecipeSelectionIndicators,
    toggleCookingHeader: cookingRenderer.toggleCookingHeader,
    toggleCookingIngredients: cookingRenderer.toggleCookingIngredients,
  };
}
