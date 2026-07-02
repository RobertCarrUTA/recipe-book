import assert from "node:assert/strict";

import { createRecipeSourceNavigationController } from "../js/recipe_source_navigation.js";
import { test } from "./test_helpers.mjs";

function createGroceryRow(canonicalKey, getTop) {
  return {
    dataset: { groceryKey: canonicalKey },
    getBoundingClientRect() {
      return { top: typeof getTop === "function" ? getTop() : getTop };
    },
  };
}

function createDocument({ elements = {}, rows = [] } = {}) {
  return {
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      return selector === "#groceryList li[data-grocery-key]" ? rows : [];
    },
  };
}

function createWindow({ compact = true, scrollY = 300 } = {}) {
  const historyCalls = [];
  const scrollCalls = [];
  const window = {
    history: {
      state: { existing: true },
      pushState(state, title, url) {
        historyCalls.push({ state, title, type: "push", url });
        this.state = state;
      },
      replaceState(state, title, url) {
        historyCalls.push({ state, title, type: "replace", url });
        this.state = state;
      },
    },
    historyCalls,
    location: { href: "https://example.test/recipes" },
    matchMedia() {
      return { matches: compact };
    },
    requestAnimationFrame(callback) {
      callback();
    },
    scrollCalls,
    scrollTo(options) {
      scrollCalls.push(options);
      this.scrollY = options.top;
    },
    scrollY,
    setTimeout(callback) {
      callback();
    },
  };

  return window;
}

test("recipe source navigation stores compact return history and reveals filtered recipes", () => {
  const document = createDocument({
    rows: [createGroceryRow("milk", 120)],
  });
  const window = createWindow({ compact: true, scrollY: 300 });
  const calls = {
    clearFilters: [],
    reveal: [],
    views: [],
    warnings: [],
  };
  let recipeVisible = false;

  const controller = createRecipeSourceNavigationController({
    clearRecipeDiscoveryFilters(options) {
      calls.clearFilters.push(options);
      recipeVisible = true;
    },
    document,
    getRecipeKey: (recipe) => recipe.id,
    getRecipes: () => [{ id: "recipe-a" }],
    logger: { warn: (...args) => calls.warnings.push(args) },
    revealRecipeById(recipeKey) {
      calls.reveal.push(recipeKey);
      return recipeVisible;
    },
    setMobileView(view, options) {
      calls.views.push({ options, view });
    },
    window,
  });

  controller.prepareRecipeSourceNavigation("milk");
  controller.viewRecipeSource("recipe-a", { canonicalKey: "milk" });

  assert.deepEqual(calls.views, [{ options: undefined, view: "recipes" }]);
  assert.deepEqual(calls.clearFilters, [{ focusSearch: false }]);
  assert.deepEqual(calls.reveal, ["recipe-a", "recipe-a"]);
  assert.deepEqual(calls.warnings, []);
  assert.equal(window.historyCalls.length, 2);

  const [replaceCall, pushCall] = window.historyCalls;
  assert.equal(replaceCall.type, "replace");
  assert.equal(replaceCall.url, "https://example.test/recipes");
  assert.equal(replaceCall.state.existing, true);
  assert.deepEqual(replaceCall.state.recipeBook, {
    groceryReturnPosition: {
      canonicalKey: "milk",
      rowTop: 120,
      scrollY: 300,
    },
    view: "grocery",
  });

  assert.equal(pushCall.type, "push");
  assert.equal(pushCall.state.existing, true);
  assert.deepEqual(pushCall.state.recipeBook, {
    groceryReturnPosition: {
      canonicalKey: "milk",
      rowTop: 120,
      scrollY: 300,
    },
    sourceRecipeId: "recipe-a",
    view: "recipes",
  });
});

test("recipe source history restores the grocery row to its previous viewport position", () => {
  let rowTop = 90;
  const document = createDocument({
    rows: [createGroceryRow("milk", () => rowTop)],
  });
  const window = createWindow({ compact: true, scrollY: 300 });
  const views = [];

  const controller = createRecipeSourceNavigationController({
    document,
    setMobileView(view, options) {
      views.push({ options, view });
    },
    window,
  });

  const handled = controller.handleHistoryNavigation({
    state: {
      recipeBook: {
        groceryReturnPosition: {
          canonicalKey: "milk",
          rowTop: 120,
          scrollY: 300,
        },
        view: "grocery",
      },
    },
  });

  assert.equal(handled, true);
  assert.deepEqual(views, [{ options: { trigger: "history" }, view: "grocery" }]);
  assert.equal(window.scrollCalls.length, 1);
  assert.deepEqual(window.scrollCalls[0], {
    behavior: "auto",
    left: 0,
    top: 270,
  });

  rowTop = 30;
  assert.equal(controller.restoreGroceryReturnPosition(), false, "return position should be consumed after restore");
});

test("recipe source navigation avoids return-history state on wide layouts", () => {
  const window = createWindow({ compact: false });
  const views = [];
  const controller = createRecipeSourceNavigationController({
    document: createDocument(),
    getRecipeKey: (recipe) => recipe.id,
    getRecipes: () => [{ id: "recipe-a" }],
    revealRecipeById: () => true,
    setMobileView(view, options) {
      views.push({ options, view });
    },
    window,
  });

  controller.viewRecipeSource("recipe-a", { canonicalKey: "milk" });

  assert.deepEqual(views, [{ options: undefined, view: "recipes" }]);
  assert.deepEqual(window.historyCalls, []);
});
