import { normalizeRecipeBook } from "./recipe_schema.js";

const defaultRecipeUrl = "data/recipes.json";

export function addRecipeDataCacheBuster(url, cacheBuster = Date.now()) {
  const rawUrl = String(url || defaultRecipeUrl);
  const rawCacheBuster = String(cacheBuster || "").trim();
  if (!rawCacheBuster) return rawUrl;

  const hashIndex = rawUrl.indexOf("#");
  const baseUrl = hashIndex === -1 ? rawUrl : rawUrl.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : rawUrl.slice(hashIndex);
  const separator = baseUrl.includes("?") ? "&" : "?";

  return `${baseUrl}${separator}_=${encodeURIComponent(rawCacheBuster)}${hash}`;
}

export async function loadRecipes(options = {}) {
  const baseUrl = options.url || defaultRecipeUrl;
  const url = options.cacheBust === false
    ? baseUrl
    : addRecipeDataCacheBuster(baseUrl, options.cacheBuster === undefined ? Date.now() : options.cacheBuster);
  const logger = options.logger || console;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Recipe loading requires the Fetch API.");
  }
  const response = await fetchImpl(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Unable to load recipes.json (${response.status})`);
  }

  const rawRecipes = await response.json();
  const result = normalizeRecipeBook(rawRecipes);

  if (result.warnings.length) {
    logger.warn(`${result.warnings.length} recipe data warnings`, result.warnings);
  }

  return result;
}
