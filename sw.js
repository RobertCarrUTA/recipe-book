const CACHE_VERSION = "20260701-1";
const CACHE_PREFIX = "recipe-book-";
const SHELL_CACHE = `recipe-book-shell-${CACHE_VERSION}`;
const DATA_CACHE = `recipe-book-data-${CACHE_VERSION}`;
const RECIPE_DATA_URL = new URL("./data/recipes.json", self.location.href).href;

const SHELL_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./css/styles.css",
  "./js/app.js",
  "./js/backup_controller.js",
  "./js/cooking_controls.js",
  "./js/cooking_model.js",
  "./js/cooking_renderer.js",
  "./js/grocery_model.js",
  "./js/grocery_list_exporter.js",
  "./js/grocery_renderer.js",
  "./js/grocery_view_model.js",
  "./js/grouping.js",
  "./js/ingredient_parser.js",
  "./js/logger.js",
  "./js/meal_plan_model.js",
  "./js/meal_plan_renderer.js",
  "./js/mobile_view_controller.js",
  "./js/normalization.js",
  "./js/offline_controller.js",
  "./js/recipe_filter.js",
  "./js/recipe_formatting.js",
  "./js/recipe_multiplier.js",
  "./js/recipe_quality_report.js",
  "./js/recipe_renderer.js",
  "./js/recipe_repository.js",
  "./js/recipe_schema.js",
  "./js/recipe_sort.js",
  "./js/recipes.js",
  "./js/render.js",
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
  try {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(SHELL_URLS.map((url) => cache.add(url).catch(() => undefined)));
  } catch (error) {
    // Network fetches after activation can fill any missing shell cache entries.
  }
}

async function cacheRecipeDataOnInstall() {
  try {
    const cache = await caches.open(DATA_CACHE);
    await cache.add(RECIPE_DATA_URL);
  } catch (error) {
    // The app will cache recipe data after the next successful in-page load.
  }
}

async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put("./index.html", response.clone());
    return response;
  } catch (error) {
    return (await cache.match("./index.html")) || Response.error();
  }
}

async function handleRecipeData(request) {
  const cache = await caches.open(DATA_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(RECIPE_DATA_URL, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(RECIPE_DATA_URL)) || Response.error();
  }
}

async function handleShellAsset(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request, { ignoreSearch: true })) || Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      cacheShellOnInstall(),
      cacheRecipeDataOnInstall(),
    ])
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(deleteOldCaches().then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
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
