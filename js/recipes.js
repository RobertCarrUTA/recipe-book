/* ================================
RECIPES
================================ */
let recipes = [];

async function loadRecipes() {
  const response = await fetch("data/recipes.json", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Unable to load recipes.json (${response.status})`);
  }

  const loadedRecipes = await response.json();
  if (!Array.isArray(loadedRecipes)) {
    throw new Error("recipes.json must contain an array of recipes");
  }

  recipes = loadedRecipes.slice().sort(function (a, b) {
    return String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base" });
  });
}
