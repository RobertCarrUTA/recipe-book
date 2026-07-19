import assert from "node:assert/strict";

import {
  createRecipeDeepLinkUrl,
  createRecipeSourceNavigationController,
  getRecipeDeepLinkIdFromHash,
  getRecipeDeepLinkBasePath,
  getRecipeDeepLinkIdFromLocation,
  getRecipeDeepLinkIdFromPathname,
} from "../js/recipe_source_navigation.js";
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

function createWindow({
  compact = true,
  location = { href: "https://example.test/recipes", hash: "" },
  scrollY = 300,
} = {}) {
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
    location,
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

test("recipe deep link parser accepts only explicit safe recipe slugs", () => {
  assert.equal(getRecipeDeepLinkIdFromHash("#recipe=a5-wagyu-burger"), "a5-wagyu-burger");
  assert.equal(getRecipeDeepLinkIdFromHash("#source=grocery&recipe=recipe-a"), "recipe-a");
  assert.equal(getRecipeDeepLinkIdFromHash("#recipe=a5%2Dwagyu%2Dburger"), "a5-wagyu-burger");
  assert.equal(getRecipeDeepLinkIdFromPathname("/recipe-book/a5-wagyu-burger"), "a5-wagyu-burger");
  assert.equal(getRecipeDeepLinkIdFromPathname("/recipe-book/a5-wagyu-burger/"), "a5-wagyu-burger");
  assert.equal(getRecipeDeepLinkIdFromPathname("/recipe-book/a5%2Dwagyu%2Dburger"), "a5-wagyu-burger");
  assert.equal(
    getRecipeDeepLinkIdFromLocation({ href: "https://example.test/recipe-book/chili" }),
    "chili"
  );
  assert.equal(
    getRecipeDeepLinkIdFromLocation({
      hash: "#recipe=a5-wagyu-burger",
      pathname: "/recipe-book/chili",
    }),
    "a5-wagyu-burger"
  );

  assert.equal(getRecipeDeepLinkIdFromHash("#a5-wagyu-burger"), "");
  assert.equal(getRecipeDeepLinkIdFromHash("#recipe="), "");
  assert.equal(getRecipeDeepLinkIdFromHash("#recipe=A5-Wagyu-Burger"), "");
  assert.equal(getRecipeDeepLinkIdFromHash("#recipe=../data/recipes.json"), "");
  assert.equal(getRecipeDeepLinkIdFromHash("#recipe=%3Cscript%3Ealert(1)%3C%2Fscript%3E"), "");
  assert.equal(getRecipeDeepLinkIdFromHash("#recipe=recipe-a&recipe=recipe-b"), "");
  assert.equal(getRecipeDeepLinkIdFromHash(`#recipe=${"a".repeat(161)}`), "");
  assert.equal(getRecipeDeepLinkIdFromPathname("/recipe-book/"), "");
  assert.equal(getRecipeDeepLinkIdFromPathname("/recipe-book/index.html"), "");
  assert.equal(getRecipeDeepLinkIdFromPathname("/recipe-book/A5-Wagyu-Burger"), "");
  assert.equal(getRecipeDeepLinkIdFromPathname("/recipe-book/..%2Fdata%2Frecipes.json"), "");
  assert.equal(getRecipeDeepLinkIdFromPathname("/recipe-book/%3Cscript%3Ealert(1)%3C%2Fscript%3E"), "");
  assert.equal(getRecipeDeepLinkIdFromPathname(`/recipe-book/${"a".repeat(161)}`), "");
});

test("recipe deep link URL builder creates clean share URLs from app paths", () => {
  const recipeIds = new Set(["a5-wagyu-burger", "chili"]);

  assert.equal(getRecipeDeepLinkBasePath("/recipe-book/"), "/recipe-book");
  assert.equal(getRecipeDeepLinkBasePath("/recipe-book", { recipeIds }), "/recipe-book");
  assert.equal(getRecipeDeepLinkBasePath("/recipe-book/a5-wagyu-burger", { recipeIds }), "/recipe-book");
  assert.equal(getRecipeDeepLinkBasePath("/recipe-book/index.html", { recipeIds }), "/recipe-book");
  assert.equal(getRecipeDeepLinkBasePath("/recipe-book/%3Cscript%3Ealert(1)%3C%2Fscript%3E", { recipeIds }), "/recipe-book");

  assert.equal(
    createRecipeDeepLinkUrl("chili", {
      href: "https://example.test/recipe-book/?debug=1#recipe=a5-wagyu-burger",
    }, { recipeIds }),
    "https://example.test/recipe-book/chili"
  );
  assert.equal(
    createRecipeDeepLinkUrl("chili", {
      href: "https://example.test/recipe-book/a5-wagyu-burger?debug=1",
    }, { recipeIds }),
    "https://example.test/recipe-book/chili"
  );
  assert.equal(createRecipeDeepLinkUrl("../data/recipes.json", {
    href: "https://example.test/recipe-book/",
  }, { recipeIds }), "");
  assert.equal(createRecipeDeepLinkUrl("chili", { href: "not a url" }, { recipeIds }), "");
});

test("recipe deep links switch to recipes and reveal matching loaded recipes", () => {
  const window = createWindow({
    compact: false,
    location: {
      hash: "",
      href: "https://example.test/recipe-book/recipe-a",
      pathname: "/recipe-book/recipe-a",
    },
  });
  const calls = {
    reveal: [],
    views: [],
    warnings: [],
  };
  const controller = createRecipeSourceNavigationController({
    document: createDocument(),
    getRecipeKey: (recipe) => recipe.id,
    getRecipes: () => [{ id: "recipe-a" }],
    logger: { warn: (...args) => calls.warnings.push(args) },
    revealRecipeById(recipeKey) {
      calls.reveal.push(recipeKey);
      return true;
    },
    setMobileView(view, options) {
      calls.views.push({ options, view });
    },
    window,
  });

  assert.equal(controller.viewDeepLinkedRecipeFromLocation(), true);
  assert.deepEqual(calls.views, [{ options: undefined, view: "recipes" }]);
  assert.deepEqual(calls.reveal, ["recipe-a"]);
  assert.deepEqual(calls.warnings, []);
});

test("recipe deep links clear discovery filters before revealing filtered recipes", () => {
  const window = createWindow({
    compact: true,
    location: {
      hash: "#recipe=recipe-a",
      href: "https://example.test/recipes#recipe=recipe-a",
    },
  });
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
    document: createDocument(),
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

  assert.equal(controller.viewDeepLinkedRecipeFromLocation(), true);
  assert.deepEqual(calls.views, [{ options: undefined, view: "recipes" }]);
  assert.deepEqual(calls.clearFilters, [{ focusSearch: false }]);
  assert.deepEqual(calls.reveal, ["recipe-a", "recipe-a"]);
  assert.deepEqual(calls.warnings, []);
});

test("recipe deep links ignore unsafe ids without revealing recipes", () => {
  const calls = {
    reveal: [],
    views: [],
    warnings: [],
  };
  const controller = createRecipeSourceNavigationController({
    document: createDocument(),
    getRecipeKey: (recipe) => recipe.id,
    getRecipes: () => [{ id: "recipe-a" }],
    logger: { warn: (...args) => calls.warnings.push(args) },
    revealRecipeById(recipeKey) {
      calls.reveal.push(recipeKey);
      return true;
    },
    setMobileView(view, options) {
      calls.views.push({ options, view });
    },
    window: createWindow({
      location: {
        hash: "#recipe=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
        href: "https://example.test/recipes#recipe=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
      },
    }),
  });

  assert.equal(controller.viewDeepLinkedRecipeFromLocation(), false);
  assert.deepEqual(calls.views, []);
  assert.deepEqual(calls.reveal, []);
  assert.deepEqual(calls.warnings, []);
});

test("recipe deep links reject unknown recipe ids before changing view", () => {
  const calls = {
    reveal: [],
    views: [],
    warnings: [],
  };
  const controller = createRecipeSourceNavigationController({
    document: createDocument(),
    getRecipeKey: (recipe) => recipe.id,
    getRecipes: () => [{ id: "recipe-a" }],
    logger: { warn: (...args) => calls.warnings.push(args) },
    revealRecipeById(recipeKey) {
      calls.reveal.push(recipeKey);
      return true;
    },
    setMobileView(view, options) {
      calls.views.push({ options, view });
    },
    window: createWindow({
      location: {
        hash: "",
        href: "https://example.test/recipe-book/missing",
        pathname: "/recipe-book/missing",
      },
    }),
  });

  assert.equal(controller.viewDeepLinkedRecipeFromLocation(), false);
  assert.deepEqual(calls.views, []);
  assert.deepEqual(calls.reveal, []);
  assert.equal(calls.warnings.length, 1);
});

test("recipe source navigation creates share links only for loaded safe recipe ids", () => {
  const warnings = [];
  const controller = createRecipeSourceNavigationController({
    document: createDocument(),
    getRecipeKey: (recipe) => recipe.id,
    getRecipes: () => [{ id: "recipe-a" }],
    logger: { warn: (...args) => warnings.push(args) },
    window: createWindow({
      location: {
        hash: "",
        href: "https://example.test/recipe-book/",
        pathname: "/recipe-book/",
      },
    }),
  });

  assert.equal(controller.getRecipeDeepLinkUrl("recipe-a"), "https://example.test/recipe-book/recipe-a");
  assert.equal(controller.getRecipeDeepLinkUrl("%3Cscript%3E"), "");
  assert.equal(controller.getRecipeDeepLinkUrl("missing"), "");
  assert.equal(warnings.length, 1);
});

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

test("recipe source navigation rejects stale recipe ids before changing view or history", () => {
  const window = createWindow({ compact: true });
  const views = [];
  const warnings = [];
  const controller = createRecipeSourceNavigationController({
    document: createDocument({ rows: [createGroceryRow("milk", 100)] }),
    getRecipeKey: (recipe) => recipe.id,
    getRecipes: () => [{ id: "recipe-a" }],
    logger: { warn: (...args) => warnings.push(args) },
    revealRecipeById: () => {
      throw new Error("invalid ids must not reach the renderer");
    },
    setMobileView: (view) => views.push(view),
    window,
  });

  controller.prepareRecipeSourceNavigation("milk");
  assert.equal(controller.viewRecipeSource("missing", { canonicalKey: "milk" }), false);
  assert.deepEqual(views, []);
  assert.deepEqual(window.historyCalls, []);
  assert.equal(warnings.length, 1);
});
