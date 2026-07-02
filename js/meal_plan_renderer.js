import {
  getMealPlanSummary,
  mealPlanDays,
} from "./meal_plan_model.js";
import { appendChildren, createElement, createTextElement } from "./dom.js";
import { getRecipeHeaderMeta } from "./recipe_formatting.js";

export function createMealPlanRenderer({
  actions,
  document,
  getMealPlanState,
  getRecipes,
  openCookingMode,
}) {
  const byId = (id) => document.getElementById(id);
  let recipeCache = null;

  function getRecipeCache() {
    const recipes = getRecipes();
    if (recipeCache && recipeCache.recipes === recipes) return recipeCache;

    const lookup = new Map();
    const optionsFragment = document.createDocumentFragment();

    recipes.forEach((recipe, index) => {
      const recipeKey = actions.getRecipeKey(recipe, index);
      const option = createElement(document, "option", {
        textContent: recipe.title || "Untitled recipe",
        value: recipeKey,
      });
      lookup.set(recipeKey, { index, recipe });
      optionsFragment.appendChild(option);
    });

    recipeCache = { lookup, optionsFragment, recipes };
    return recipeCache;
  }

  function formatCount(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function updateMealPlanSummary() {
    const mealPlan = getMealPlanState();
    const summary = getMealPlanSummary(mealPlan);
    const summaryEl = byId("mealPlanSummary");
    const badge = byId("mobileMealPlanBadge");
    const openPlanButton = byId("openMealPlan");
    const buildButton = byId("buildGroceryListFromMealPlan");
    const clearButton = byId("clearMealPlan");

    if (summaryEl) {
      summaryEl.textContent = summary.plannedRecipeCount
        ? `${formatCount(summary.plannedRecipeCount, "meal", "meals")} - ${formatCount(summary.dayCount, "day", "days")}`
        : "No meals planned";
    }

    if (badge) {
      badge.hidden = summary.plannedRecipeCount === 0;
      badge.textContent = summary.plannedRecipeCount > 99 ? "99+" : String(summary.plannedRecipeCount);
    }

    if (openPlanButton) {
      openPlanButton.setAttribute(
        "aria-label",
        summary.plannedRecipeCount
          ? `Meal Plan, ${summary.plannedRecipeCount} planned meals`
          : "Meal Plan"
      );
    }

    const hasMeals = summary.plannedRecipeCount > 0;
    if (buildButton) buildButton.disabled = !hasMeals;
    if (clearButton) clearButton.disabled = !hasMeals;
  }

  function appendRecipeOptions(select, recipeOptionsFragment) {
    if (recipeOptionsFragment) select.appendChild(recipeOptionsFragment.cloneNode(true));
  }

  function createDayAddForm(day, recipeOptionsFragment) {
    const selectId = `meal-plan-add-${day.key}`;
    const form = createElement(document, "form", {
      className: "meal-plan-add-form",
      dataset: { day: day.key },
    });
    const label = createElement(document, "label", {
      attributes: { for: selectId },
      className: "visually-hidden",
      textContent: `Add recipe to ${day.label}`,
    });
    const select = createElement(document, "select", {
      attributes: { "aria-label": `Add recipe to ${day.label}` },
      id: selectId,
      name: "recipeId",
    });
    const placeholder = createElement(document, "option", {
      textContent: "Add recipe...",
      value: "",
    });

    select.appendChild(placeholder);
    appendRecipeOptions(select, recipeOptionsFragment);

    select.addEventListener("change", () => {
      if (!select.value) return;
      actions.onAddRecipeToMealPlan(day.key, select.value);
      select.value = "";
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
    });

    appendChildren(form, [label, select]);
    return form;
  }

  function createRecipeMeta(recipe) {
    const metaItems = getRecipeHeaderMeta(recipe).slice(0, 3);
    if (!metaItems.length) return null;

    return createTextElement(document, "span", metaItems.map((item) => item.text).join(" - "), {
      className: "meal-plan-item-meta",
    });
  }

  function createPlanItem(day, recipeId, lookup) {
    const item = lookup.get(recipeId);
    const titleText = item ? item.recipe.title || "Untitled recipe" : "Recipe no longer available";
    const li = createElement(document, "li", { className: "meal-plan-item" });
    const copy = createElement(document, "span", { className: "meal-plan-item-copy" });
    const title = createElement(document, "span", {
      className: "meal-plan-item-title",
      textContent: titleText,
    });
    const actionsWrap = createElement(document, "span", { className: "meal-plan-item-actions" });

    copy.appendChild(title);

    if (item) {
      const meta = createRecipeMeta(item.recipe);
      if (meta) copy.appendChild(meta);
    }

    if (item) {
      const cookButton = createElement(document, "button", {
        className: "secondary-button",
        textContent: "Cook",
        type: "button",
      });
      cookButton.addEventListener("click", () => openCookingMode(item.recipe, item.index));
      actionsWrap.appendChild(cookButton);
    }

    const removeButton = createElement(document, "button", {
      attributes: { "aria-label": `Remove ${titleText} from ${day.label}` },
      className: "meal-plan-remove-button",
      textContent: "Remove",
      type: "button",
    });
    removeButton.addEventListener("click", () => actions.onRemoveRecipeFromMealPlan(day.key, recipeId));
    actionsWrap.appendChild(removeButton);

    appendChildren(li, [copy, actionsWrap]);
    return li;
  }

  function renderEmptyDay(list) {
    list.appendChild(createTextElement(document, "li", "No meals planned.", {
      className: "meal-plan-empty-day",
    }));
  }

  function renderDay(container, day, lookup, recipeOptionsFragment) {
    const mealPlan = getMealPlanState();
    const recipeIds = mealPlan.days[day.key] || [];
    const section = createElement(document, "section", {
      className: "meal-plan-day",
      dataset: { day: day.key },
    });
    const header = createElement(document, "div", { className: "meal-plan-day-header" });
    const title = createElement(document, "h3", { textContent: day.label });
    const count = createElement(document, "span", {
      className: "meal-plan-day-count",
      textContent: recipeIds.length ? formatCount(recipeIds.length, "meal", "meals") : "Open",
    });
    const list = createElement(document, "ul", { className: "meal-plan-day-list" });

    appendChildren(header, [title, count]);

    if (recipeIds.length) {
      recipeIds.forEach((recipeId) => {
        list.appendChild(createPlanItem(day, recipeId, lookup));
      });
    } else {
      renderEmptyDay(list);
    }

    appendChildren(section, [
      header,
      list,
      createDayAddForm(day, recipeOptionsFragment),
    ]);
    container.appendChild(section);
  }

  function renderMealPlan() {
    const board = byId("mealPlanBoard");
    if (!board) return;

    const { lookup, optionsFragment } = getRecipeCache();
    const fragment = document.createDocumentFragment();
    mealPlanDays.forEach((day) => renderDay(fragment, day, lookup, optionsFragment));
    board.replaceChildren(fragment);
    updateMealPlanSummary();
  }

  return { renderMealPlan, updateMealPlanSummary };
}
