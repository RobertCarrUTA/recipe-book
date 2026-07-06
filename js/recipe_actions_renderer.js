import { mealPlanDays } from "./meal_plan_model.js";
import {
  DEFAULT_RECIPE_MULTIPLIER,
  MAX_RECIPE_MULTIPLIER,
  MIN_RECIPE_MULTIPLIER,
  RECIPE_MULTIPLIER_STEP,
  formatRecipeMultiplierInputValue,
  stepRecipeMultiplier,
} from "./recipe_multiplier.js";

export function createRecipeActionsRenderer({
  actions,
  document,
  getRecipeMultiplier,
  getRecipePlanDayKeys,
  openCookingMode,
  windowLike = document.defaultView || globalThis,
}) {
  function syncRecipePlanSelect(select, recipe, recipeIndex) {
    if (!select) return;

    const plannedDayKeys = new Set(getRecipePlanDayKeys(recipe, recipeIndex));
    select.value = "";
    select.querySelectorAll("option[data-day]").forEach((option) => {
      option.disabled = plannedDayKeys.has(option.dataset.day);
    });
  }

  function syncRecipeScaleControl(control, recipe, recipeIndex, selected) {
    if (!control) return;

    const multiplier = getRecipeMultiplier(recipe, recipeIndex);
    const input = control.querySelector(".recipe-scale-input");
    control.hidden = !selected;
    control.querySelectorAll("button, input").forEach((field) => {
      field.disabled = !selected;
    });

    if (input && document.activeElement !== input) {
      input.value = formatRecipeMultiplierInputValue(multiplier);
    }
  }

  function syncRecipeAddToggleText(toggle, selected) {
    const text = toggle ? toggle.querySelector(".recipe-add-toggle-text") : null;
    if (text) text.textContent = selected ? "Added to grocery list" : "Add to grocery list";
  }

  function createRecipeScaleControl(recipe, recipeIndex) {
    const control = document.createElement("div");
    const label = document.createElement("label");
    const decreaseButton = document.createElement("button");
    const input = document.createElement("input");
    const increaseButton = document.createElement("button");
    const inputId = `recipe-scale-${recipeIndex}`;

    function commitMultiplier(nextValue) {
      const normalized =
        typeof actions.onRecipeMultiplierChange === "function"
          ? actions.onRecipeMultiplierChange(recipe, recipeIndex, nextValue)
          : getRecipeMultiplier(recipe, recipeIndex);
      input.value = formatRecipeMultiplierInputValue(normalized);
    }

    control.className = "recipe-scale-control";
    label.className = "recipe-scale-label";
    label.htmlFor = inputId;
    label.textContent = "Qty";

    decreaseButton.className = "recipe-scale-step";
    decreaseButton.type = "button";
    decreaseButton.textContent = "-";
    decreaseButton.setAttribute("aria-label", `Decrease quantity for ${recipe.title || "recipe"}`);
    decreaseButton.addEventListener("click", () => commitMultiplier(stepRecipeMultiplier(input.value, -1)));

    input.className = "recipe-scale-input";
    input.id = inputId;
    input.type = "number";
    input.inputMode = "decimal";
    input.min = String(MIN_RECIPE_MULTIPLIER);
    input.max = String(MAX_RECIPE_MULTIPLIER);
    input.step = String(RECIPE_MULTIPLIER_STEP);
    input.value = formatRecipeMultiplierInputValue(getRecipeMultiplier(recipe, recipeIndex));
    input.setAttribute("aria-label", `Quantity multiplier for ${recipe.title || "recipe"}`);
    input.addEventListener("change", () => commitMultiplier(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitMultiplier(input.value);
        input.blur();
      }
      if (event.key === "Escape") {
        input.value = formatRecipeMultiplierInputValue(getRecipeMultiplier(recipe, recipeIndex));
        input.blur();
      }
    });

    increaseButton.className = "recipe-scale-step";
    increaseButton.type = "button";
    increaseButton.textContent = "+";
    increaseButton.setAttribute("aria-label", `Increase quantity for ${recipe.title || "recipe"}`);
    increaseButton.addEventListener("click", () => commitMultiplier(stepRecipeMultiplier(input.value, 1)));

    control.appendChild(label);
    control.appendChild(decreaseButton);
    control.appendChild(input);
    control.appendChild(increaseButton);
    syncRecipeScaleControl(control, recipe, recipeIndex, actions.isRecipeSelected(recipe, recipeIndex));

    return control;
  }

  function createRecipePlanSelect(recipe, recipeIndex) {
    const select = document.createElement("select");
    const placeholder = document.createElement("option");

    select.className = "recipe-plan-select";
    select.setAttribute("aria-label", `Plan ${recipe.title || "recipe"}`);
    placeholder.value = "";
    placeholder.textContent = "Plan meal";
    select.appendChild(placeholder);

    mealPlanDays.forEach((day) => {
      const option = document.createElement("option");
      option.value = day.key;
      option.dataset.day = day.key;
      option.textContent = day.label;
      select.appendChild(option);
    });

    select.addEventListener("change", () => {
      if (!select.value || typeof actions.onPlanRecipe !== "function") return;
      actions.onPlanRecipe(recipe, recipeIndex, select.value);
      syncRecipePlanSelect(select, recipe, recipeIndex);
    });
    syncRecipePlanSelect(select, recipe, recipeIndex);

    return select;
  }

  function createRecipeExportActions(recipe, recipeIndex) {
    const wrap = document.createElement("div");
    const label = document.createElement("span");
    const status = document.createElement("span");
    const recipeTitle = recipe.title || "recipe";
    let statusTimer = null;

    function setStatus(message, options = {}) {
      if (statusTimer && typeof windowLike.clearTimeout === "function") {
        windowLike.clearTimeout(statusTimer);
        statusTimer = null;
      }

      status.textContent = message || "";
      status.hidden = !message;
      status.classList.toggle("is-error", options.kind === "error");

      if (message && typeof windowLike.setTimeout === "function") {
        statusTimer = windowLike.setTimeout(() => {
          status.textContent = "";
          status.hidden = true;
          status.classList.remove("is-error");
          statusTimer = null;
        }, 2600);
      }
    }

    async function runAction(action, successText, errorText) {
      try {
        const result = await action();
        setStatus(result === false ? errorText : successText, {
          kind: result === false ? "error" : "success",
        });
      } catch (error) {
        setStatus(errorText, { kind: "error" });
      }
    }

    function addButton(text, exportLabel, action, className = "") {
      const button = document.createElement("button");
      button.className = `recipe-export-button${className ? ` ${className}` : ""}`;
      button.type = "button";
      button.textContent = text;
      button.title = exportLabel;
      button.setAttribute("aria-label", `${exportLabel} for ${recipeTitle}`);
      button.addEventListener("click", action);
      wrap.appendChild(button);
    }

    wrap.className = "recipe-export-actions";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", `Export ${recipeTitle}`);
    label.className = "recipe-export-label";
    label.textContent = "Export";
    status.className = "recipe-export-status";
    status.setAttribute("aria-live", "polite");
    status.hidden = true;

    wrap.appendChild(label);
    if (typeof actions.onCopyRecipeText === "function") {
      addButton(
        "Copy",
        "Copy formatted text",
        () =>
          runAction(
            () => actions.onCopyRecipeText(recipe, recipeIndex),
            "Copied.",
            "Copy failed."
          ),
        "recipe-export-copy-button"
      );
    }
    addButton(
      "Text",
      "Export formatted text",
      () =>
        runAction(
          () => actions.onExportRecipe(recipe, recipeIndex, "text"),
          "Downloaded text.",
          "Download failed."
        )
    );
    addButton(
      "JSON",
      "Export JSON",
      () =>
        runAction(
          () => actions.onExportRecipe(recipe, recipeIndex, "json"),
          "Downloaded JSON.",
          "Download failed."
        )
    );
    wrap.appendChild(status);

    return wrap;
  }

  function isRecipePlanned(recipe, recipeIndex) {
    return getRecipePlanDayKeys(recipe, recipeIndex).length > 0;
  }

  function createRecipeActions(recipe, recipeIndex) {
    const actionsWrap = document.createElement("div");
    const favoriteButton = document.createElement("button");
    const cookButton = document.createElement("button");
    const planSelect = createRecipePlanSelect(recipe, recipeIndex);
    const toggle = document.createElement("label");
    const addToListCheckbox = document.createElement("input");
    const addToListText = document.createElement("span");
    const scaleControl = createRecipeScaleControl(recipe, recipeIndex);
    const viewPlanButton = document.createElement("button");
    const viewGroceryButton = document.createElement("button");

    actionsWrap.className = "recipe-actions";

    favoriteButton.className = "favorite-recipe-button";
    favoriteButton.type = "button";
    favoriteButton.setAttribute("aria-pressed", actions.isRecipeFavorite(recipe, recipeIndex) ? "true" : "false");
    favoriteButton.textContent = actions.isRecipeFavorite(recipe, recipeIndex) ? "Favorited" : "Favorite";
    favoriteButton.addEventListener("click", () => {
      actions.onFavoriteRecipe(recipe, recipeIndex, !actions.isRecipeFavorite(recipe, recipeIndex));
    });
    actionsWrap.appendChild(favoriteButton);

    cookButton.className = "primary-button cooking-mode-button";
    cookButton.type = "button";
    cookButton.textContent = "Cook mode";
    cookButton.addEventListener("click", () => openCookingMode(recipe, recipeIndex));
    actionsWrap.appendChild(cookButton);
    actionsWrap.appendChild(planSelect);

    toggle.className = "checkbox-inline recipe-add-toggle";
    addToListCheckbox.type = "checkbox";
    addToListCheckbox.dataset.recipeId = actions.getRecipeKey(recipe, recipeIndex);
    addToListCheckbox.checked = actions.isRecipeSelected(recipe, recipeIndex);
    addToListText.className = "recipe-add-toggle-text";
    addToListText.textContent = "Add to grocery list";
    toggle.appendChild(addToListCheckbox);
    toggle.appendChild(addToListText);
    syncRecipeAddToggleText(toggle, addToListCheckbox.checked);
    actionsWrap.appendChild(toggle);
    actionsWrap.appendChild(scaleControl);

    if (typeof actions.onExportRecipe === "function") {
      actionsWrap.appendChild(createRecipeExportActions(recipe, recipeIndex));
    }

    viewPlanButton.className = "view-plan-button";
    viewPlanButton.type = "button";
    viewPlanButton.textContent = "View plan";
    viewPlanButton.hidden = !isRecipePlanned(recipe, recipeIndex);
    viewPlanButton.addEventListener("click", actions.onViewMealPlan);
    actionsWrap.appendChild(viewPlanButton);

    viewGroceryButton.className = "view-grocery-button";
    viewGroceryButton.type = "button";
    viewGroceryButton.textContent = "View list";
    viewGroceryButton.hidden = !addToListCheckbox.checked;
    viewGroceryButton.addEventListener("click", actions.onViewGroceryList);
    actionsWrap.appendChild(viewGroceryButton);

    addToListCheckbox.addEventListener("change", () => {
      actions.onSelectRecipe(recipe, recipeIndex, addToListCheckbox.checked);
      viewGroceryButton.hidden = !addToListCheckbox.checked;
      syncRecipeScaleControl(scaleControl, recipe, recipeIndex, addToListCheckbox.checked);
      syncRecipeAddToggleText(toggle, addToListCheckbox.checked);
    });

    if (recipe.link) {
      const link = document.createElement("a");
      link.className = "recipe-link recipe-action-link";
      link.href = recipe.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View full recipe";
      actionsWrap.appendChild(link);
    }

    return actionsWrap;
  }

  return {
    createRecipeActions,
    syncRecipeAddToggleText,
    syncRecipePlanSelect,
    syncRecipeScaleControl,
  };
}
