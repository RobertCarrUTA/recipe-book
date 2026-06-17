import { getCookingIngredients, getCookingSteps } from "./cooking_model.js";
import { getRecipeHeaderMeta } from "./recipe_formatting.js";

export function createCookingRenderer({ document }) {
  const byId = (id) => document.getElementById(id);
  const windowLike = document.defaultView || globalThis;

  const cookingModeState = {
    recipe: null,
    recipeIndex: -1,
    stepIndex: 0,
    lastRenderedStepIndex: -1,
    headerCollapsed: false,
    ingredientsExpanded: true,
  };

  function isMobileCookingLayout() {
    return windowLike.matchMedia && windowLike.matchMedia("(max-width: 979px)").matches;
  }

  function openCookingMode(recipe, recipeIndex) {
    cookingModeState.recipe = recipe;
    cookingModeState.recipeIndex = recipeIndex;
    cookingModeState.stepIndex = 0;
    cookingModeState.lastRenderedStepIndex = -1;
    cookingModeState.ingredientsExpanded = !isMobileCookingLayout();

    const cookingMode = byId("cookingMode");
    if (!cookingMode) return;

    cookingMode.hidden = false;
    document.body.classList.add("is-cooking-mode");
    renderCookingMode();

    const nextButton = byId("nextCookingStep");
    if (nextButton) nextButton.focus();
  }

  function closeCookingMode() {
    const cookingMode = byId("cookingMode");
    if (cookingMode) cookingMode.hidden = true;
    document.body.classList.remove("is-cooking-mode");
  }

  function isCookingModeOpen() {
    const cookingMode = byId("cookingMode");
    return Boolean(cookingMode && !cookingMode.hidden);
  }

  function setCookingStep(nextIndex) {
    const steps = getCookingSteps(cookingModeState.recipe);
    cookingModeState.stepIndex = Math.max(0, Math.min(steps.length - 1, nextIndex));
    renderCookingMode();
  }

  function goToPreviousCookingStep() {
    if (cookingModeState.stepIndex > 0) setCookingStep(cookingModeState.stepIndex - 1);
  }

  function goToNextCookingStep(options = {}) {
    const steps = getCookingSteps(cookingModeState.recipe);
    if (cookingModeState.stepIndex >= steps.length - 1) {
      if (options.finishOnLast) closeCookingMode();
      return;
    }

    setCookingStep(cookingModeState.stepIndex + 1);
  }

  function setCookingIngredientsExpanded(isExpanded) {
    cookingModeState.ingredientsExpanded = Boolean(isExpanded);
    renderCookingMode();
  }

  function toggleCookingIngredients() {
    setCookingIngredientsExpanded(!cookingModeState.ingredientsExpanded);
  }

  function setCookingHeaderCollapsed(isCollapsed) {
    cookingModeState.headerCollapsed = Boolean(isCollapsed);
    renderCookingMode();
  }

  function toggleCookingHeader() {
    setCookingHeaderCollapsed(!cookingModeState.headerCollapsed);
  }

  function handleCookingResize() {
    if (!isCookingModeOpen()) return;
    if (!isMobileCookingLayout()) cookingModeState.ingredientsExpanded = true;
    renderCookingMode();
  }

  function renderCookingIngredients(recipe) {
    const container = byId("cookingIngredients");
    if (!container) return;

    container.innerHTML = "";
    const ingredients = getCookingIngredients(recipe);
    if (!ingredients.length) {
      const empty = document.createElement("p");
      empty.className = "cooking-empty";
      empty.textContent = "No ingredients are listed for this recipe.";
      container.appendChild(empty);
      return;
    }

    const ul = document.createElement("ul");
    ingredients.forEach((ingredient) => {
      const li = document.createElement("li");
      li.textContent = ingredient;
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  function renderCookingMode() {
    const recipe = cookingModeState.recipe;
    if (!recipe) return;

    const steps = getCookingSteps(recipe);
    const ingredients = getCookingIngredients(recipe);
    const stepIndex = Math.max(0, Math.min(cookingModeState.stepIndex, steps.length - 1));
    const canCollapseIngredients = isMobileCookingLayout();
    const headerCollapsed = cookingModeState.headerCollapsed;
    const ingredientsExpanded = !canCollapseIngredients || cookingModeState.ingredientsExpanded;
    cookingModeState.stepIndex = stepIndex;

    const shell = document.querySelector(".cooking-shell");
    const header = byId("cookingHeader");
    const headerKicker = byId("cookingHeaderKicker");
    const headerStep = byId("cookingHeaderStep");
    const headerToggle = byId("toggleCookingHeader");
    const title = byId("cookingTitle");
    const meta = byId("cookingMeta");
    const stepCount = byId("cookingStepCount");
    const stepText = byId("cookingStepText");
    const stepPanel = document.querySelector(".cooking-step-panel");
    const progressBar = byId("cookingProgressBar");
    const previousButton = byId("previousCookingStep");
    const nextButton = byId("nextCookingStep");
    const ingredientsPanel = byId("cookingIngredientsPanel");
    const ingredientsContainer = byId("cookingIngredients");
    const ingredientsSummary = byId("cookingIngredientsSummary");
    const ingredientsToggle = byId("toggleCookingIngredients");

    const stepCountText = `Step ${stepIndex + 1} of ${steps.length}`;
    const metaText = getRecipeHeaderMeta(recipe)
      .filter((item) => !item.primary)
      .map((item) => item.text)
      .join(" - ");

    if (shell) shell.classList.toggle("is-header-collapsed", headerCollapsed);
    if (header) header.classList.toggle("is-collapsed", headerCollapsed);
    if (headerKicker) headerKicker.hidden = headerCollapsed;
    if (headerStep) {
      headerStep.textContent = stepCountText;
      headerStep.hidden = !headerCollapsed;
    }
    if (headerToggle) {
      headerToggle.textContent = headerCollapsed ? "Show" : "Hide";
      headerToggle.setAttribute("aria-label", headerCollapsed ? "Show recipe details" : "Hide recipe details");
      headerToggle.setAttribute("aria-expanded", headerCollapsed ? "false" : "true");
      headerToggle.title = headerCollapsed ? "Show recipe details" : "Hide recipe details";
    }
    if (title) title.textContent = recipe.title || "Recipe";
    if (meta) {
      meta.textContent = metaText;
      meta.hidden = headerCollapsed || !metaText;
    }
    if (stepCount) stepCount.textContent = stepCountText;
    if (stepText) stepText.textContent = steps[stepIndex];
    if (stepPanel && cookingModeState.lastRenderedStepIndex !== stepIndex) {
      stepPanel.scrollTop = 0;
      cookingModeState.lastRenderedStepIndex = stepIndex;
    }
    if (progressBar) progressBar.style.width = `${Math.round(((stepIndex + 1) / steps.length) * 100)}%`;
    if (previousButton) previousButton.disabled = stepIndex === 0;
    if (nextButton) nextButton.textContent = stepIndex === steps.length - 1 ? "Finish" : "Next";
    if (ingredientsPanel) ingredientsPanel.classList.toggle("is-collapsed", !ingredientsExpanded);
    if (ingredientsContainer) ingredientsContainer.hidden = !ingredientsExpanded;
    if (ingredientsSummary) {
      ingredientsSummary.textContent = ingredients.length === 1 ? "1 item" : `${ingredients.length || "No"} items`;
    }
    if (ingredientsToggle) {
      ingredientsToggle.disabled = !canCollapseIngredients;
      ingredientsToggle.setAttribute(
        "aria-label",
        canCollapseIngredients ? `${ingredientsExpanded ? "Collapse" : "Expand"} ingredients` : "Ingredients"
      );
      ingredientsToggle.setAttribute("aria-expanded", ingredientsExpanded ? "true" : "false");
    }

    renderCookingIngredients(recipe);
  }

  return {
    closeCookingMode,
    goToNextCookingStep,
    goToPreviousCookingStep,
    handleCookingResize,
    isCookingModeOpen,
    openCookingMode,
    toggleCookingHeader,
    toggleCookingIngredients,
  };
}
