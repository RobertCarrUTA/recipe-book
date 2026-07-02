import {
  getMealPlanSummary,
  mealPlanDays,
} from "./meal_plan_model.js";
import { createTextElement } from "./dom.js";
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
      const option = document.createElement("option");
      option.value = recipeKey;
      option.textContent = recipe.title || "Untitled recipe";
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
    const form = document.createElement("form");
    const label = document.createElement("label");
    const select = document.createElement("select");
    const placeholder = document.createElement("option");

    form.className = "meal-plan-add-form";
    form.dataset.day = day.key;
    label.className = "visually-hidden";
    label.htmlFor = `meal-plan-add-${day.key}`;
    label.textContent = `Add recipe to ${day.label}`;
    select.id = `meal-plan-add-${day.key}`;
    select.name = "recipeId";
    select.setAttribute("aria-label", `Add recipe to ${day.label}`);
    placeholder.value = "";
    placeholder.textContent = "Add recipe...";
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

    form.appendChild(label);
    form.appendChild(select);
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
    const li = document.createElement("li");
    const copy = document.createElement("span");
    const title = document.createElement("span");
    const actionsWrap = document.createElement("span");
    const cookButton = document.createElement("button");
    const removeButton = document.createElement("button");

    li.className = "meal-plan-item";
    copy.className = "meal-plan-item-copy";
    title.className = "meal-plan-item-title";
    title.textContent = item ? item.recipe.title || "Untitled recipe" : "Recipe no longer available";
    copy.appendChild(title);

    if (item) {
      const meta = createRecipeMeta(item.recipe);
      if (meta) copy.appendChild(meta);
    }

    actionsWrap.className = "meal-plan-item-actions";

    if (item) {
      cookButton.className = "secondary-button";
      cookButton.type = "button";
      cookButton.textContent = "Cook";
      cookButton.addEventListener("click", () => openCookingMode(item.recipe, item.index));
      actionsWrap.appendChild(cookButton);
    }

    removeButton.className = "meal-plan-remove-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove ${title.textContent} from ${day.label}`);
    removeButton.addEventListener("click", () => actions.onRemoveRecipeFromMealPlan(day.key, recipeId));
    actionsWrap.appendChild(removeButton);

    li.appendChild(copy);
    li.appendChild(actionsWrap);
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
    const section = document.createElement("section");
    const header = document.createElement("div");
    const title = document.createElement("h3");
    const count = document.createElement("span");
    const list = document.createElement("ul");

    section.className = "meal-plan-day";
    section.dataset.day = day.key;
    header.className = "meal-plan-day-header";
    title.textContent = day.label;
    count.className = "meal-plan-day-count";
    count.textContent = recipeIds.length ? formatCount(recipeIds.length, "meal", "meals") : "Open";
    header.appendChild(title);
    header.appendChild(count);

    list.className = "meal-plan-day-list";
    if (recipeIds.length) {
      recipeIds.forEach((recipeId) => {
        list.appendChild(createPlanItem(day, recipeId, lookup));
      });
    } else {
      renderEmptyDay(list);
    }

    section.appendChild(header);
    section.appendChild(list);
    section.appendChild(createDayAddForm(day, recipeOptionsFragment));
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
