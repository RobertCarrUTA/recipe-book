import { appendChildren, createElement } from "./dom.js";
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
  function createButton({ listeners, onClick, ...options }) {
    return createElement(document, "button", {
      type: "button",
      ...options,
      listeners: onClick ? { ...(listeners || {}), click: onClick } : listeners,
    });
  }

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
    const inputId = `recipe-scale-${recipeIndex}`;

    function commitMultiplier(nextValue) {
      const normalized =
        typeof actions.onRecipeMultiplierChange === "function"
          ? actions.onRecipeMultiplierChange(recipe, recipeIndex, nextValue)
          : getRecipeMultiplier(recipe, recipeIndex);
      input.value = formatRecipeMultiplierInputValue(normalized);
    }

    const label = createElement(document, "label", {
      className: "recipe-scale-label",
      htmlFor: inputId,
      textContent: "Qty",
    });
    const decreaseButton = createButton({
      attributes: { "aria-label": `Decrease quantity for ${recipe.title || "recipe"}` },
      className: "recipe-scale-step",
      onClick: () => commitMultiplier(stepRecipeMultiplier(input.value, -1)),
      textContent: "-",
    });
    const input = createElement(document, "input", {
      attributes: { "aria-label": `Quantity multiplier for ${recipe.title || "recipe"}` },
      className: "recipe-scale-input",
      id: inputId,
      inputMode: "decimal",
      max: MAX_RECIPE_MULTIPLIER,
      min: MIN_RECIPE_MULTIPLIER,
      step: RECIPE_MULTIPLIER_STEP,
      type: "number",
      value: formatRecipeMultiplierInputValue(getRecipeMultiplier(recipe, recipeIndex)),
      listeners: {
        change: () => commitMultiplier(input.value),
        keydown: (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitMultiplier(input.value);
            input.blur();
          }
          if (event.key === "Escape") {
            input.value = formatRecipeMultiplierInputValue(getRecipeMultiplier(recipe, recipeIndex));
            input.blur();
          }
        },
      },
    });
    const increaseButton = createButton({
      attributes: { "aria-label": `Increase quantity for ${recipe.title || "recipe"}` },
      className: "recipe-scale-step",
      onClick: () => commitMultiplier(stepRecipeMultiplier(input.value, 1)),
      textContent: "+",
    });
    const control = createElement(document, "div", {
      children: [label, decreaseButton, input, increaseButton],
      className: "recipe-scale-control",
    });

    syncRecipeScaleControl(control, recipe, recipeIndex, actions.isRecipeSelected(recipe, recipeIndex));

    return control;
  }

  function createRecipePlanSelect(recipe, recipeIndex) {
    const dayOptions = mealPlanDays.map((day) => createElement(document, "option", {
      dataset: { day: day.key },
      textContent: day.label,
      value: day.key,
    }));
    const select = createElement(document, "select", {
      attributes: { "aria-label": `Plan ${recipe.title || "recipe"}` },
      children: [
        createElement(document, "option", {
          textContent: "Plan meal",
          value: "",
        }),
        ...dayOptions,
      ],
      className: "recipe-plan-select",
      listeners: {
        change: () => {
          if (!select.value || typeof actions.onPlanRecipe !== "function") return;
          actions.onPlanRecipe(recipe, recipeIndex, select.value);
          syncRecipePlanSelect(select, recipe, recipeIndex);
        },
      },
    });
    syncRecipePlanSelect(select, recipe, recipeIndex);

    return select;
  }

  function createRecipeExportActions(recipe, recipeIndex) {
    const recipeTitle = recipe.title || "recipe";
    const wrap = createElement(document, "div", {
      attributes: {
        "aria-label": `Export ${recipeTitle}`,
        role: "group",
      },
      className: "recipe-export-actions",
    });
    const label = createElement(document, "span", {
      className: "recipe-export-label",
      textContent: "Export",
    });
    const status = createElement(document, "span", {
      attributes: { "aria-live": "polite" },
      className: "recipe-export-status",
      hidden: true,
    });
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
      wrap.appendChild(createButton({
        attributes: { "aria-label": `${exportLabel} for ${recipeTitle}` },
        className: `recipe-export-button${className ? ` ${className}` : ""}`,
        onClick: action,
        textContent: text,
        title: exportLabel,
      }));
    }

    wrap.appendChild(label);
    [
      typeof actions.onCopyRecipeText === "function" && {
        className: "recipe-export-copy-button",
        errorText: "Copy failed.",
        exportLabel: "Copy formatted text",
        run: () => actions.onCopyRecipeText(recipe, recipeIndex),
        successText: "Copied.",
        text: "Copy",
      },
      {
        errorText: "Download failed.",
        exportLabel: "Export formatted text",
        run: () => actions.onExportRecipe(recipe, recipeIndex, "text"),
        successText: "Downloaded text.",
        text: "Text",
      },
      {
        errorText: "Download failed.",
        exportLabel: "Export JSON",
        run: () => actions.onExportRecipe(recipe, recipeIndex, "json"),
        successText: "Downloaded JSON.",
        text: "JSON",
      },
    ].filter(Boolean).forEach((exportAction) => {
      addButton(
        exportAction.text,
        exportAction.exportLabel,
        () => runAction(exportAction.run, exportAction.successText, exportAction.errorText),
        exportAction.className
      );
    });
    wrap.appendChild(status);

    return wrap;
  }

  function isRecipePlanned(recipe, recipeIndex) {
    return getRecipePlanDayKeys(recipe, recipeIndex).length > 0;
  }

  function createRecipeActions(recipe, recipeIndex) {
    const recipeTitle = recipe.title || "recipe";
    const isFavorite = actions.isRecipeFavorite(recipe, recipeIndex);
    const isSelected = actions.isRecipeSelected(recipe, recipeIndex);
    const actionsWrap = createElement(document, "div", { className: "recipe-actions" });
    const planSelect = createRecipePlanSelect(recipe, recipeIndex);
    const addToListCheckbox = createElement(document, "input", {
      attributes: { "aria-label": `Include ${recipeTitle} in grocery list` },
      checked: isSelected,
      dataset: { recipeId: actions.getRecipeKey(recipe, recipeIndex) },
      type: "checkbox",
    });
    const addToListText = createElement(document, "span", {
      className: "recipe-add-toggle-text",
      textContent: "Add to grocery list",
    });
    const toggle = createElement(document, "label", {
      children: [addToListCheckbox, addToListText],
      className: "checkbox-inline recipe-add-toggle",
    });
    const scaleControl = createRecipeScaleControl(recipe, recipeIndex);
    const favoriteButton = createButton({
      attributes: {
        "aria-label": `Favorite ${recipeTitle}`,
        "aria-pressed": isFavorite ? "true" : "false",
      },
      className: "favorite-recipe-button",
      onClick: () => actions.onFavoriteRecipe(recipe, recipeIndex, !actions.isRecipeFavorite(recipe, recipeIndex)),
      textContent: isFavorite ? "Favorited" : "Favorite",
    });
    const cookButton = createButton({
      attributes: { "aria-label": `Cook ${recipeTitle}` },
      className: "primary-button cooking-mode-button",
      onClick: () => openCookingMode(recipe, recipeIndex),
      textContent: "Cook mode",
    });
    const viewPlanButton = createButton({
      attributes: { "aria-label": `View meal plan for ${recipeTitle}` },
      className: "view-plan-button",
      hidden: !isRecipePlanned(recipe, recipeIndex),
      onClick: actions.onViewMealPlan,
      textContent: "View plan",
    });
    const viewGroceryButton = createButton({
      attributes: { "aria-label": `View grocery list for ${recipeTitle}` },
      className: "view-grocery-button",
      hidden: !addToListCheckbox.checked,
      onClick: actions.onViewGroceryList,
      textContent: "View list",
    });

    appendChildren(actionsWrap, [favoriteButton, cookButton, planSelect, toggle, scaleControl]);
    if (typeof actions.onExportRecipe === "function") {
      actionsWrap.appendChild(createRecipeExportActions(recipe, recipeIndex));
    }
    appendChildren(actionsWrap, [viewPlanButton, viewGroceryButton]);
    syncRecipeAddToggleText(toggle, addToListCheckbox.checked);

    addToListCheckbox.addEventListener("change", () => {
      actions.onSelectRecipe(recipe, recipeIndex, addToListCheckbox.checked);
      viewGroceryButton.hidden = !addToListCheckbox.checked;
      syncRecipeScaleControl(scaleControl, recipe, recipeIndex, addToListCheckbox.checked);
      syncRecipeAddToggleText(toggle, addToListCheckbox.checked);
    });

    if (recipe.link) {
      actionsWrap.appendChild(createElement(document, "a", {
        attributes: { "aria-label": `View full recipe for ${recipeTitle} (opens in a new tab)` },
        className: "recipe-link recipe-action-link",
        href: recipe.link,
        rel: "noopener noreferrer",
        target: "_blank",
        textContent: "View full recipe",
      }));
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
