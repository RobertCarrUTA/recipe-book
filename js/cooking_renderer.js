import { getCookingIngredients, getCookingSteps } from "./cooking_model.js";
import { setElementInert, syncDisclosureToggle } from "./dom.js";
import { getRecipeHeaderMeta } from "./recipe_formatting.js";

const BACKGROUND_SELECTORS = [".skip-link", ".app-shell"];

export function createCookingRenderer({ document }) {
  const byId = (id) => document.getElementById(id);
  const windowLike = document.defaultView || globalThis;

  const cookingModeState = {
    backgroundState: [],
    recipe: null,
    recipeIndex: -1,
    stepIndex: 0,
    lastRenderedStepIndex: -1,
    lastIngredientsRenderKey: "",
    headerCollapsed: false,
    ingredientsExpanded: true,
    returnFocusTarget: null,
  };

  function isMobileCookingLayout() {
    return windowLike.matchMedia && windowLike.matchMedia("(max-width: 979px)").matches;
  }

  function setBackgroundInert(inert) {
    if (inert) {
      if (cookingModeState.backgroundState.length) return;
      cookingModeState.backgroundState = BACKGROUND_SELECTORS
        .map((selector) => document.querySelector(selector))
        .filter(Boolean)
        .map((element) => ({
          ariaHidden: element.getAttribute("aria-hidden"),
          element,
          inert: Boolean(element.inert),
        }));
      cookingModeState.backgroundState.forEach(({ element }) => setElementInert(element, true));
      return;
    }

    cookingModeState.backgroundState.forEach(({ ariaHidden, element, inert: wasInert }) => {
      if ("inert" in element) element.inert = wasInert;
      if (ariaHidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", ariaHidden);
    });
    cookingModeState.backgroundState = [];
  }

  function openCookingMode(recipe, recipeIndex) {
    const HTMLElementCtor = windowLike.HTMLElement;
    cookingModeState.recipe = recipe;
    cookingModeState.recipeIndex = recipeIndex;
    cookingModeState.stepIndex = 0;
    cookingModeState.lastRenderedStepIndex = -1;
    cookingModeState.lastIngredientsRenderKey = "";
    cookingModeState.ingredientsExpanded = !isMobileCookingLayout();
    cookingModeState.returnFocusTarget =
      HTMLElementCtor && document.activeElement instanceof HTMLElementCtor
        ? document.activeElement
        : null;

    const cookingMode = byId("cookingMode");
    if (!cookingMode) return;

    setBackgroundInert(true);
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
    setBackgroundInert(false);

    const focusTarget = cookingModeState.returnFocusTarget;
    cookingModeState.returnFocusTarget = null;
    if (!focusTarget || !document.contains(focusTarget) || typeof focusTarget.focus !== "function") return;

    try {
      focusTarget.focus({ preventScroll: true });
    } catch (error) {
      focusTarget.focus();
    }
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

  function renderCookingIngredients(recipe, ingredients) {
    const container = byId("cookingIngredients");
    if (!container) return;

    const renderKey = `${cookingModeState.recipeIndex}:${ingredients.length}:${ingredients.join("\n")}`;
    if (renderKey === cookingModeState.lastIngredientsRenderKey) return;

    cookingModeState.lastIngredientsRenderKey = renderKey;
    if (!ingredients.length) {
      const empty = document.createElement("p");
      empty.className = "cooking-empty";
      empty.textContent = "No ingredients are listed for this recipe.";
      container.replaceChildren(empty);
      return;
    }

    const ul = document.createElement("ul");
    ingredients.forEach((ingredient) => {
      const li = document.createElement("li");
      li.textContent = ingredient;
      ul.appendChild(li);
    });
    container.replaceChildren(ul);
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
    syncDisclosureToggle(headerToggle, !headerCollapsed, {
      collapsedLabel: "Show recipe details",
      collapsedText: "Show",
      collapsedTitle: "Show recipe details",
      expandedLabel: "Hide recipe details",
      expandedText: "Hide",
      expandedTitle: "Hide recipe details",
    });
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
    if (progressBar) {
      const progress = Math.round(((stepIndex + 1) / steps.length) * 100);
      progressBar.style.transform = `scaleX(${progress / 100})`;
      if (progressBar.parentElement) {
        progressBar.parentElement.setAttribute("aria-valuenow", String(progress));
        progressBar.parentElement.setAttribute("aria-valuetext", `${stepCountText}, ${progress}% complete`);
      }
    }
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

    renderCookingIngredients(recipe, ingredients);
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
