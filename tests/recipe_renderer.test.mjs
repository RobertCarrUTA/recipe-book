import assert from "node:assert/strict";

import { createRecipeRenderer } from "../js/recipe_renderer.js";
import {
  createFakeDocument,
  createFakeElement,
  createFakeWindow,
} from "./dom_test_helpers.mjs";
import { test } from "./test_helpers.mjs";

const recipes = [
  {
    id: "chili",
    ingredients: ["1 can beans"],
    instructions: ["Simmer until hot."],
    tags: { rating: "great", status: "tried" },
    title: "Chili",
  },
  {
    id: "cake",
    ingredients: ["1 cup flour"],
    instructions: ["Bake until set."],
    tags: { difficulty: "easy", status: "not-tried" },
    title: "Cake",
  },
  {
    id: "cookies",
    ingredients: ["1 cup sugar"],
    instructions: ["Bake until golden."],
    tags: { status: "tried" },
    title: "Cookies",
  },
];

function createRendererHarness(options = {}) {
  const container = createFakeElement({ id: "recipeContainer" });
  const elements = { recipeContainer: container };
  const document = createFakeDocument({ elements });
  const window = createFakeWindow();
  const selectedRecipeIds = new Set(options.selectedRecipeIds || []);
  const favoriteRecipeIds = new Set(options.favoriteRecipeIds || []);
  const plannedDayKeysById = { ...(options.plannedDayKeysById || {}) };
  const multipliersById = { ...(options.multipliersById || {}) };
  const batchNotifications = [];

  Object.assign(window, {
    matchMedia() {
      return {
        addEventListener() {},
        matches: false,
      };
    },
    scrollCalls: [],
    scrollTo(scrollOptions) {
      this.scrollCalls.push(scrollOptions);
      this.scrollY = scrollOptions.top;
    },
    scrollY: 100,
  });
  document.defaultView = window;

  const actions = {
    getRecipeKey: (recipe) => recipe.id,
    getRecipeMultiplier: (recipe) => multipliersById[recipe.id] || 1,
    getRecipePlannedDayKeys: (recipe) => plannedDayKeysById[recipe.id] || [],
    isRecipeFavorite: (recipe) => favoriteRecipeIds.has(recipe.id),
    isRecipeSelected: (recipe) => selectedRecipeIds.has(recipe.id),
    onRecipeBatchRendered: (payload) => batchNotifications.push(payload),
    onRecipeTagToggle() {},
    onRenderError() {},
    onSelectRecipe(recipe, _recipeIndex, selected) {
      if (selected) selectedRecipeIds.add(recipe.id);
      else selectedRecipeIds.delete(recipe.id);
    },
  };
  const renderer = createRecipeRenderer({
    actions,
    document,
    getRecipes: () => recipes,
    openCookingMode() {},
    recipeBatchSize: options.recipeBatchSize,
  });

  return {
    batchNotifications,
    container,
    document,
    favoriteRecipeIds,
    multipliersById,
    plannedDayKeysById,
    renderer,
    selectedRecipeIds,
    window,
  };
}

function getRenderedRecipeIds(container) {
  return container.children
    .filter((child) => child.classList.contains("recipe"))
    .map((child) => child.dataset.recipeId);
}

function findRecipeElement(document, recipeId) {
  return document.querySelectorAll(".recipe[data-recipe-id]")
    .find((element) => element.dataset.recipeId === recipeId);
}

function openRecipe(document, recipeId) {
  const recipeElement = findRecipeElement(document, recipeId);
  const header = recipeElement.querySelector(".accordion-header");
  header.click();
  return recipeElement;
}

test("recipe renderer batches recipes and keeps a manual load-more fallback", () => {
  const harness = createRendererHarness({ recipeBatchSize: 2 });

  harness.renderer.renderRecipes();

  assert.equal(harness.renderer.getRenderedRecipeCount(), 2);
  assert.deepEqual(getRenderedRecipeIds(harness.container), ["chili", "cake"]);

  const loadMore = harness.container.children[harness.container.children.length - 1];
  const fallbackButton = loadMore.querySelector("button");
  assert.equal(loadMore.hidden, false);
  assert.equal(fallbackButton.hidden, false);

  fallbackButton.click();

  assert.equal(harness.renderer.getRenderedRecipeCount(), 3);
  assert.deepEqual(getRenderedRecipeIds(harness.container), ["chili", "cake", "cookies"]);
  assert.equal(loadMore.hidden, true);
  assert.deepEqual(harness.batchNotifications, [
    { renderedCount: 2, totalCount: 3 },
    { renderedCount: 3, totalCount: 3 },
  ]);
});

test("recipe renderer uses article and heading semantics without static Tab stops", () => {
  const harness = createRendererHarness({ recipeBatchSize: 3 });

  harness.renderer.renderRecipes();
  const recipeElement = openRecipe(harness.document, "chili");
  const heading = recipeElement.querySelector(".recipe-heading");
  const header = recipeElement.querySelector(".accordion-header");
  const title = recipeElement.querySelector(".recipe-title");
  const listItems = recipeElement.querySelectorAll(".accordion-content li");

  assert.equal(recipeElement.tagName, "ARTICLE");
  assert.equal(heading.tagName, "H3");
  assert.equal(header.parentElement, heading);
  assert.equal(header.getAttribute("aria-labelledby"), title.id);
  assert.equal(recipeElement.getAttribute("aria-labelledby"), title.id);
  assert.ok(listItems.length > 0);
  assert.equal(listItems.every((item) => item.tabIndex === undefined), true);
});

test("recipe renderer renders offscreen recipes before revealing them", () => {
  const harness = createRendererHarness({ recipeBatchSize: 1 });

  harness.renderer.renderRecipes();
  const revealed = harness.renderer.revealRecipeById("cookies");

  assert.equal(revealed, true);
  assert.equal(harness.renderer.getRenderedRecipeCount(), 3);

  const recipeElement = findRecipeElement(harness.document, "cookies");
  const header = recipeElement.querySelector(".accordion-header");
  const content = recipeElement.querySelector(".accordion-content");

  assert.equal(header.getAttribute("aria-expanded"), "true");
  assert.equal(header.focused, true);
  assert.equal(content.classList.contains("open"), true);
  assert.equal(content.dataset.rendered, "true");
  assert.equal(recipeElement.classList.contains("recipe-reveal-highlight"), true);
  assert.equal(harness.window.scrollCalls.length, 1);
});

test("recipe renderer syncs runtime badges and opened recipe controls", () => {
  const harness = createRendererHarness({
    favoriteRecipeIds: ["cake"],
    plannedDayKeysById: { cake: ["monday", "wednesday"] },
    recipeBatchSize: 3,
    selectedRecipeIds: ["chili"],
  });

  harness.renderer.renderRecipes();
  const chili = openRecipe(harness.document, "chili");
  const cake = openRecipe(harness.document, "cake");

  assert.equal(chili.classList.contains("recipe-selected"), true);
  assert.equal(chili.querySelector(".recipe-selected-badge").hidden, false);
  assert.equal(chili.querySelector('.recipe-add-toggle input[type="checkbox"]').checked, true);
  assert.equal(cake.classList.contains("recipe-favorite"), true);
  assert.equal(cake.querySelector(".favorite-recipe-button").textContent, "Favorited");
  assert.equal(cake.classList.contains("recipe-planned"), true);
  assert.equal(cake.querySelector(".recipe-planned-badge").textContent, "Planned Mon, Wed");

  harness.selectedRecipeIds.delete("chili");
  harness.selectedRecipeIds.add("cake");
  harness.favoriteRecipeIds.delete("cake");
  harness.favoriteRecipeIds.add("chili");
  harness.plannedDayKeysById.cake = [];
  harness.plannedDayKeysById.chili = ["friday"];
  harness.multipliersById.cake = 2;

  harness.renderer.syncRecipeSelectionIndicators();
  harness.renderer.syncFavoriteRecipeIndicators();
  harness.renderer.syncMealPlanIndicators();

  assert.equal(chili.classList.contains("recipe-selected"), false);
  assert.equal(chili.querySelector(".recipe-selected-badge").hidden, true);
  assert.equal(chili.querySelector('.recipe-add-toggle input[type="checkbox"]').checked, false);
  assert.equal(chili.querySelector(".recipe-scale-control").hidden, true);
  assert.equal(chili.querySelector(".view-grocery-button").hidden, true);
  assert.equal(chili.classList.contains("recipe-favorite"), true);
  assert.equal(chili.querySelector(".favorite-recipe-button").textContent, "Favorited");
  assert.equal(chili.classList.contains("recipe-planned"), true);
  assert.equal(chili.querySelector(".recipe-planned-badge").textContent, "Planned Fri");

  assert.equal(cake.classList.contains("recipe-selected"), true);
  assert.equal(cake.querySelector(".recipe-selected-badge").textContent, "In list x2");
  assert.equal(cake.querySelector(".recipe-scale-control").hidden, false);
  assert.equal(cake.querySelector(".view-grocery-button").hidden, false);
  assert.equal(cake.classList.contains("recipe-favorite"), false);
  assert.equal(cake.querySelector(".favorite-recipe-button").textContent, "Favorite");
  assert.equal(cake.classList.contains("recipe-planned"), false);
  assert.equal(cake.querySelector(".view-plan-button").hidden, true);
});
