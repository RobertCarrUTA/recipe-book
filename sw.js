const CACHE_VERSION = "20260719-7";
const CACHE_PREFIX = "recipe-book-";
const SHELL_CACHE = `recipe-book-shell-${CACHE_VERSION}`;
const DATA_CACHE = `recipe-book-data-${CACHE_VERSION}`;
const INDEX_URL = new URL("./index.html", self.location.href).href;
const RECIPE_DATA_URL = new URL("./data/recipes.json", self.location.href).href;

const SHELL_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./css/styles.css",
  "./js/app.js",
  "./js/app_state_persistence.js",
  "./js/backup_controller.js",
  "./js/clipboard.js",
  "./js/collapsible_controls.js",
  "./js/cooking_controls.js",
  "./js/cooking_model.js",
  "./js/cooking_renderer.js",
  "./js/dom.js",
  "./js/download.js",
  "./js/grocery_ingredient_parser.js",
  "./js/grocery_list_exporter.js",
  "./js/grocery_model.js",
  "./js/grocery_renderer.js",
  "./js/grocery_view_model.js",
  "./js/grouping.js",
  "./js/logger.js",
  "./js/meal_plan_model.js",
  "./js/meal_plan_panel_controller.js",
  "./js/meal_plan_renderer.js",
  "./js/mobile_view_controller.js",
  "./js/normalization_rules.js",
  "./js/normalization.js",
  "./js/nutrition.js",
  "./js/offline_controller.js",
  "./js/recipe_actions_renderer.js",
  "./js/recipe_collections.js",
  "./js/recipe_discovery_controller.js",
  "./js/recipe_discovery.js",
  "./js/recipe_exporter.js",
  "./js/recipe_filter.js",
  "./js/recipe_formatting.js",
  "./js/recipe_multiplier.js",
  "./js/recipe_renderer.js",
  "./js/recipe_repository.js",
  "./js/recipe_schema.js",
  "./js/recipe_sort.js",
  "./js/recipe_source_navigation.js",
  "./js/recipes.js",
  "./js/render.js",
  "./js/status_message_controller.js",
  "./js/storage.js",
  "./js/ui_state.js",
  "./js/units.js",
  "./js/wake_lock_controller.js",
];

const SHELL_PATHS = new Set(
  SHELL_URLS.map((url) => new URL(url, self.location.href).pathname)
);

async function deleteOldCaches() {
  const expected = new Set([SHELL_CACHE, DATA_CACHE]);
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(CACHE_PREFIX) && !expected.has(name))
      .map((name) => caches.delete(name))
  );
}

async function cacheShellOnInstall() {
  const cache = await caches.open(SHELL_CACHE);
  const requests = SHELL_URLS.map(
    (url) => new Request(new URL(url, self.location.href).href, { cache: "reload" })
  );
  await cache.addAll(requests);
}

async function cacheRecipeDataOnInstall() {
  const cache = await caches.open(DATA_CACHE);
  const response = await fetch(RECIPE_DATA_URL, { cache: "reload" });
  if (!(await isValidRecipeDataResponse(response))) {
    throw new Error("Recipe data could not be validated during service worker installation.");
  }
  await cache.put(RECIPE_DATA_URL, response);
}

async function cacheRequiredAssetsOnInstall() {
  try {
    await Promise.all([cacheShellOnInstall(), cacheRecipeDataOnInstall()]);
  } catch (error) {
    await Promise.all([caches.delete(SHELL_CACHE), caches.delete(DATA_CACHE)]);
    throw error;
  }
}

function fetchFresh(request) {
  return fetch(request, { cache: "no-store" });
}

async function isValidRecipeDataResponse(response) {
  if (!response || !response.ok) return false;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("json")) return false;

  try {
    const recipes = await response.clone().json();
    return Boolean(
      Array.isArray(recipes) &&
      recipes.length &&
      recipes.every((recipe) => recipe && typeof recipe.id === "string" && typeof recipe.title === "string")
    );
  } catch (error) {
    return false;
  }
}

async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  let response = null;

  try {
    response = await fetchFresh(request);
    if (response.ok) {
      await cache.put(INDEX_URL, response.clone());
      return response;
    }
  } catch (error) {
    // Use the last complete shell below.
  }

  return (await cache.match(INDEX_URL)) || response || Response.error();
}

async function handleRecipeData(request) {
  const cache = await caches.open(DATA_CACHE);
  let response = null;

  try {
    response = await fetchFresh(request);
    if (await isValidRecipeDataResponse(response)) {
      await cache.put(RECIPE_DATA_URL, response.clone());
      return response;
    }
  } catch (error) {
    // Use the last validated recipe response below.
  }

  return (await cache.match(RECIPE_DATA_URL)) || response || Response.error();
}

async function handleShellAsset(request) {
  const cache = await caches.open(SHELL_CACHE);
  let response = null;

  try {
    response = await fetchFresh(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      return response;
    }
  } catch (error) {
    // Use the last complete shell below.
  }

  return (await cache.match(request, { ignoreSearch: true })) || response || Response.error();
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheRequiredAssetsOnInstall());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(deleteOldCaches().then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
  } else if (url.href.split("?")[0] === RECIPE_DATA_URL) {
    event.respondWith(handleRecipeData(request));
  } else if (SHELL_PATHS.has(url.pathname)) {
    event.respondWith(handleShellAsset(request));
  }
});
