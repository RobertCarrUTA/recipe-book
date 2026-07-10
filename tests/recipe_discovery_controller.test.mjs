import assert from "node:assert/strict";

import { createRecipeDiscoveryController } from "../js/recipe_discovery_controller.js";
import { buildRecipeSearchText } from "../js/recipe_filter.js";
import { recipeSortModes } from "../js/recipe_sort.js";
import {
  createFakeDocument,
  createFakeElement,
  createFakeEvent,
  createFakeWindow,
} from "./dom_test_helpers.mjs";
import { test } from "./test_helpers.mjs";

const recipes = [
  {
    collections: ["main-dishes", "soups-stews"],
    id: "chili",
    ingredients: ["beans", "tomatoes"],
    tags: { rating: "great", status: "tried" },
    title: "Dutch Oven Chili",
  },
  {
    collections: ["baking", "desserts"],
    id: "cake",
    ingredients: ["flour", "blueberries"],
    tags: { rating: "good", status: "not-tried" },
    title: "Blueberry Cake",
  },
];

function createFocusableElement(options = {}) {
  const element = createFakeElement(options);
  element.blurred = false;
  element.focused = false;
  element.blur = () => {
    element.blurred = true;
  };
  element.focus = () => {
    element.focused = true;
  };
  return element;
}

function createDiscoveryHarness(options = {}) {
  const recipeSearchWrap = createFakeElement({ classes: ["recipe-search"] });
  const recipeSearch = createFocusableElement({ id: "recipeSearch", tagName: "input", value: options.searchValue || "" });
  recipeSearch.closest = (selector) => (selector === ".recipe-search" ? recipeSearchWrap : null);
  const recipeCollectionControl = createFakeElement({
    classes: ["recipe-collection-control"],
    tagName: "label",
  });
  const recipeCollection = createFakeElement({
    disabled: true,
    id: "recipeCollection",
    tagName: "select",
  });
  recipeCollectionControl.appendChild(recipeCollection);

  const filters = options.filters || [];
  const elements = {
    clearFilters: createFakeElement({ id: "clearFilters", tagName: "button" }),
    clearRecipeDiscoveryFilters: createFakeElement({ id: "clearRecipeDiscoveryFilters", tagName: "button" }),
    clearRecipeSearch: createFakeElement({ hidden: true, id: "clearRecipeSearch", tagName: "button" }),
    recipeFilters: createFakeElement({ classes: ["hidden"], id: "recipeFilters" }),
    recipeNoResults: createFakeElement({ id: "recipeNoResults" }),
    recipeCollection,
    recipeCollectionControl,
    recipeSearch,
    recipeSearchMeta: createFakeElement({ id: "recipeSearchMeta" }),
    recipeSearchWrap,
    recipeSort: createFakeElement({ id: "recipeSort", tagName: "select", value: recipeSortModes.default }),
    showFavoriteRecipesOnly: createFakeElement({
      checked: Boolean(options.showFavoriteOnly),
      id: "showFavoriteRecipesOnly",
      tagName: "input",
    }),
    showSelectedRecipesOnly: createFakeElement({
      checked: Boolean(options.showSelectedOnly),
      id: "showSelectedRecipesOnly",
      tagName: "input",
    }),
    toggleFilters: createFakeElement({ id: "toggleFilters", tagName: "button" }),
  };
  const document = createFakeDocument({
    elements,
    queryResults: {
      ".recipe-filters input": filters,
    },
  });
  document.querySelectorAll = (selector) => {
    if (selector === ".recipe-filters input:checked") return filters.filter((filter) => filter.checked);
    if (selector === ".recipe-filters input") return filters;
    return [];
  };

  const renderCalls = [];
  const syncCalls = {
    favorites: 0,
    filters: [],
    mealPlan: 0,
    selection: 0,
  };
  const renderer = {
    renderRecipes({ recipeIndexes }) {
      renderCalls.push(recipeIndexes);
    },
    syncFavoriteRecipeIndicators() {
      syncCalls.favorites += 1;
    },
    syncMealPlanIndicators() {
      syncCalls.mealPlan += 1;
    },
    syncRecipeFilterTagStyles(selectedFilters) {
      syncCalls.filters.push(selectedFilters);
    },
    syncRecipeSelectionIndicators() {
      syncCalls.selection += 1;
    },
  };
  let saveCount = 0;
  const uiState = {
    filters: { ...(options.uiFilters || {}) },
    recipeSearch: options.searchValue || "",
    recipeSort: options.recipeSort || recipeSortModes.default,
    showFavoriteRecipesOnly: Boolean(options.showFavoriteOnly),
    showSelectedRecipesOnly: Boolean(options.showSelectedOnly),
  };
  let recipeItems = options.recipes === undefined ? recipes : options.recipes;
  const window = options.window || createFakeWindow();
  const controller = createRecipeDiscoveryController({
    debounceMs: 25,
    document,
    getRecipes: () => recipeItems,
    getRuntimeState: () => ({}),
    getSearchTexts: () => recipeItems.map(buildRecipeSearchText),
    getUiState: () => uiState,
    isFavorite: (_runtime, _recipe, index) => index === 0,
    isSelected: (_runtime, _recipe, index) => index === 1,
    renderer,
    saveState: () => {
      saveCount += 1;
    },
    window,
  });

  return {
    controller,
    document,
    elements,
    filters,
    getSaveCount: () => saveCount,
    renderCalls,
    setRecipes(nextRecipes) {
      recipeItems = nextRecipes;
    },
    syncCalls,
    uiState,
    window,
  };
}

test("recipe discovery controller filters recipes and syncs search controls", () => {
  const harness = createDiscoveryHarness();

  harness.controller.applyFilter("chili");

  assert.deepEqual(harness.renderCalls, [[0]]);
  assert.equal(harness.elements.recipeSearchMeta.textContent, "1 matches of 2");
  assert.equal(harness.elements.recipeSearchMeta.classList.contains("is-filtered"), true);
  assert.equal(harness.elements.recipeNoResults.hidden, true);
  assert.equal(harness.elements.toggleFilters.textContent, "Filters (1)");
  assert.equal(harness.elements.clearFilters.disabled, false);
  assert.equal(harness.elements.recipeSearchWrap.classList.contains("has-search-text"), true);

  harness.controller.applyFilter("chili");

  assert.deepEqual(harness.renderCalls, [[0]]);
  assert.equal(harness.syncCalls.favorites, 1);
  assert.equal(harness.syncCalls.selection, 1);
  assert.equal(harness.syncCalls.mealPlan, 1);
});

test("recipe discovery controller clears search, filters, visibility toggles, and ui state", () => {
  const filters = [
    createFakeElement({ checked: true, dataset: { filter: "status" }, tagName: "input", value: "tried" }),
    createFakeElement({ checked: true, dataset: { filter: "rating" }, tagName: "input", value: "great" }),
  ];
  const harness = createDiscoveryHarness({
    filters,
    searchValue: "cake",
    showFavoriteOnly: true,
    showSelectedOnly: true,
    uiFilters: { collection: ["desserts"] },
  });
  harness.controller.attach();

  assert.equal(harness.elements.recipeCollection.value, "desserts");

  harness.controller.clear();

  assert.equal(harness.elements.recipeSearch.value, "");
  assert.equal(harness.elements.recipeSearch.focused, true);
  assert.equal(harness.elements.showFavoriteRecipesOnly.checked, false);
  assert.equal(harness.elements.showSelectedRecipesOnly.checked, false);
  assert.equal(harness.elements.recipeCollection.value, "");
  assert.deepEqual(filters.map((filter) => filter.checked), [false, false]);
  assert.deepEqual(harness.uiState, {
    filters: {},
    recipeSearch: "",
    recipeSort: recipeSortModes.default,
    showFavoriteRecipesOnly: false,
    showSelectedRecipesOnly: false,
  });
  assert.equal(harness.getSaveCount(), 1);
});

test("recipe discovery controller toggles recipe tag filters through matching controls", () => {
  const statusFilter = createFakeElement({
    checked: false,
    dataset: { filter: "status" },
    tagName: "input",
    value: "tried",
  });
  const harness = createDiscoveryHarness({ filters: [statusFilter] });

  harness.controller.handleTagToggle("status", "tried");

  assert.equal(statusFilter.checked, true);
  assert.deepEqual(harness.uiState.filters, { status: ["tried"] });
  assert.deepEqual(harness.renderCalls, [[0]]);
  assert.equal(harness.getSaveCount(), 1);
});

test("recipe discovery controller populates collection options and restores selection after recipes load", () => {
  const harness = createDiscoveryHarness({
    recipes: [],
    uiFilters: { collection: ["desserts"] },
  });

  harness.controller.attach();

  assert.equal(harness.elements.recipeCollection.disabled, true);
  assert.equal(harness.elements.recipeCollection.value, "desserts");
  assert.equal(harness.elements.recipeCollection.children[0].textContent, "All recipe types");
  assert.ok(
    harness.elements.recipeCollection.children.some(
      (option) => option.value === "desserts" && option.textContent === "Desserts"
    )
  );

  harness.setRecipes(recipes);
  harness.controller.syncRecipeCollectionOptions();
  harness.controller.refresh();

  assert.equal(harness.elements.recipeCollection.disabled, false);
  assert.equal(harness.elements.recipeCollection.value, "desserts");
  assert.deepEqual(
    harness.elements.recipeCollection.children.map((option) => [option.value, option.textContent]),
    [
      ["", "All recipe types"],
      ["main-dishes", "Main Dishes"],
      ["soups-stews", "Soups & Stews"],
      ["baking", "Baking"],
      ["desserts", "Desserts"],
    ]
  );
  assert.deepEqual(harness.renderCalls, [[1]]);
  assert.equal(harness.elements.recipeCollectionControl.classList.contains("has-selection"), true);
});

test("recipe discovery controller filters and persists collection changes", () => {
  const harness = createDiscoveryHarness();
  harness.controller.attach();

  harness.elements.recipeCollection.value = "soups-stews";
  harness.elements.recipeCollection.dispatchEvent(createFakeEvent("change"));

  assert.deepEqual(harness.uiState.filters, { collection: ["soups-stews"] });
  assert.deepEqual(harness.renderCalls, [[0]]);
  assert.equal(harness.elements.recipeSearchMeta.textContent, "1 matches of 2");
  assert.equal(harness.elements.toggleFilters.textContent, "Filters (1)");
  assert.equal(harness.elements.recipeCollectionControl.classList.contains("has-selection"), true);
  assert.equal(harness.getSaveCount(), 1);
});

test("recipe discovery controller attaches debounced search and filter controls", () => {
  const window = createFakeWindow();
  const harness = createDiscoveryHarness({ window });
  harness.controller.attach();

  harness.elements.recipeSearch.value = "cake";
  harness.elements.recipeSearch.dispatchEvent(createFakeEvent("input"));

  assert.equal(harness.elements.clearRecipeSearch.hidden, false);
  assert.equal(harness.renderCalls.length, 0);
  assert.equal(window.timers.length, 1);

  window.timers[0].callback();
  assert.deepEqual(harness.renderCalls, [[1]]);
  assert.equal(harness.uiState.recipeSearch, "cake");
  assert.equal(harness.getSaveCount(), 1);

  harness.elements.clearRecipeSearch.click();

  assert.equal(harness.elements.recipeSearch.value, "");
  assert.equal(harness.elements.recipeSearch.focused, true);
  assert.equal(harness.getSaveCount(), 2);

  harness.elements.toggleFilters.click();
  assert.equal(harness.elements.recipeFilters.classList.contains("hidden"), false);
  assert.equal(harness.elements.toggleFilters.getAttribute("aria-expanded"), "true");
});
