/* ================================
STATE

This section defines the in-memory data model for the grocery list.

Why this matters:
  - Parsing ingredients is lossy; we store normalized "canonical" keys
    to ensure consistent merging across recipes.
  - We intentionally separate quantities (totalsByKey) from notes
    (notesByKey) so display logic can evolve without re-parsing input.
  - The shape of this state is mirrored in localStorage for persistence.
================================ */
const parsedCanonicalDisplayMap = {};

const groceryState = {
  selectedRecipeIds: {}, // { [recipeId]: true }
  totalsByKey: {}, // { [canonicalKey]: { [unitKey]: { min: number, max: number } } }
  notesByKey: {}, // { [canonicalKey]: string[] } e.g., ["pinch", "to taste"]
};

const favoriteRecipeIds = {}; // { [recipeId]: true }

const recipeContainer = document.getElementById("recipeContainer");

/* ================================
PERSISTENCE

localStorage is used instead of cookies or IndexedDB because:
  - The data is small and user-specific
  - It works offline and under file:// in most browsers
  - Failure is non-fatal; the app still functions without persistence

All storage access is defensive by design. Any exception should
degrade gracefully rather than break the UI.
================================ */
const storageKeys = {
  groceryState: "offline_recipebook_grocery_state_v1",
  groceryChecked: "offline_recipebook_grocery_checked_v1",
  favoriteRecipes: "offline_recipebook_favorite_recipes_v1",
  selectedRecipes: "offline_recipebook_selected_recipes_v1",
  showFavoriteRecipesOnly: "offline_recipebook_show_favorite_recipes_only_v1",
  showSelectedRecipesOnly: "offline_recipebook_show_selected_recipes_only_v1",
  groupToggle: "offline_recipebook_group_toggle_v1",
  keepScreenAwake: "offline_recipebook_keep_screen_awake_v1",
  mobileView: "offline_recipebook_mobile_view_v1",
  recipeSearch: "offline_recipebook_recipe_search_v1",
};

const groceryCheckedByKey = {}; // { [canonicalKey]: true }

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

function savePersistentState() {
  try {
    localStorage.setItem(storageKeys.groceryState, JSON.stringify(groceryState));
    localStorage.setItem(storageKeys.selectedRecipes, JSON.stringify(groceryState.selectedRecipeIds));
    localStorage.setItem(storageKeys.groceryChecked, JSON.stringify(groceryCheckedByKey));
    const groupToggleElement = document.getElementById("groupToggle");
    if (groupToggleElement) localStorage.setItem(storageKeys.groupToggle, groupToggleElement.checked ? "1" : "0");
    const selectedOnlyElement = document.getElementById("showSelectedRecipesOnly");
    if (selectedOnlyElement) {
      localStorage.setItem(storageKeys.showSelectedRecipesOnly, selectedOnlyElement.checked ? "1" : "0");
    }
    const favoriteOnlyElement = document.getElementById("showFavoriteRecipesOnly");
    if (favoriteOnlyElement) {
      localStorage.setItem(storageKeys.showFavoriteRecipesOnly, favoriteOnlyElement.checked ? "1" : "0");
    }
    const keepAwakeElement = document.getElementById("keepScreenAwake");
    if (keepAwakeElement) localStorage.setItem(storageKeys.keepScreenAwake, keepAwakeElement.checked ? "1" : "0");
    const recipeSearchElement = document.getElementById("recipeSearch");
    if (recipeSearchElement) localStorage.setItem(storageKeys.recipeSearch, recipeSearchElement.value || "");
    localStorage.setItem(storageKeys.favoriteRecipes, JSON.stringify(favoriteRecipeIds));
  } catch (err) {
    // localStorage can fail under some file:// settings; keep running without persistence
  }
}

function persistFilters() {
  const data = {};
  document.querySelectorAll(".recipe-filters input:checked").forEach((cb) => {
    if (!data[cb.dataset.filter]) data[cb.dataset.filter] = [];
    data[cb.dataset.filter].push(cb.value);
  });
  localStorage.setItem("offline_recipebook_filters_v1", JSON.stringify(data));
}

function restoreFilters() {
  const raw = localStorage.getItem("offline_recipebook_filters_v1");
  if (!raw) return;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }

  document.querySelectorAll(".recipe-filters input").forEach((cb) => {
    cb.checked = data[cb.dataset.filter]?.includes(cb.value) || false;
  });
}

function restorePersistentState() {
  const groupToggleElement = document.getElementById("groupToggle");
  const savedGroup = localStorage.getItem(storageKeys.groupToggle);
  if (groupToggleElement && (savedGroup === "0" || savedGroup === "1")) {
    groupToggleElement.checked = savedGroup === "1";
  }

  const selectedOnlyElement = document.getElementById("showSelectedRecipesOnly");
  const savedSelectedOnly = localStorage.getItem(storageKeys.showSelectedRecipesOnly);
  if (selectedOnlyElement && (savedSelectedOnly === "0" || savedSelectedOnly === "1")) {
    selectedOnlyElement.checked = savedSelectedOnly === "1";
  }

  const favoriteOnlyElement = document.getElementById("showFavoriteRecipesOnly");
  const savedFavoriteOnly = localStorage.getItem(storageKeys.showFavoriteRecipesOnly);
  if (favoriteOnlyElement && (savedFavoriteOnly === "0" || savedFavoriteOnly === "1")) {
    favoriteOnlyElement.checked = savedFavoriteOnly === "1";
  }

  const keepAwakeElement = document.getElementById("keepScreenAwake");
  const savedKeepAwake = localStorage.getItem(storageKeys.keepScreenAwake);
  if (keepAwakeElement && (savedKeepAwake === "0" || savedKeepAwake === "1")) {
    keepAwakeElement.checked = savedKeepAwake === "1";
  }

  const savedGroceryStateText = localStorage.getItem(storageKeys.groceryState);
  const savedGroceryState = safeJsonParse(savedGroceryStateText);
  if (savedGroceryState && typeof savedGroceryState === "object") {
    if (savedGroceryState.selectedRecipeIds && typeof savedGroceryState.selectedRecipeIds === "object") {
      groceryState.selectedRecipeIds = savedGroceryState.selectedRecipeIds;
    }
    if (savedGroceryState.totalsByKey && typeof savedGroceryState.totalsByKey === "object") {
      groceryState.totalsByKey = savedGroceryState.totalsByKey;
    }
    if (savedGroceryState.notesByKey && typeof savedGroceryState.notesByKey === "object") {
      groceryState.notesByKey = savedGroceryState.notesByKey;
    }
  }

  const savedSelectedText = localStorage.getItem(storageKeys.selectedRecipes);
  const savedSelected = safeJsonParse(savedSelectedText);
  if (savedSelected && typeof savedSelected === "object") {
    groceryState.selectedRecipeIds = savedSelected;
  }

  const savedCheckedText = localStorage.getItem(storageKeys.groceryChecked);
  const savedChecked = safeJsonParse(savedCheckedText);
  if (savedChecked && typeof savedChecked === "object") {
    Object.keys(savedChecked).forEach((key) => {
      if (savedChecked[key]) groceryCheckedByKey[key] = true;
    });
  }

  const savedFavoritesText = localStorage.getItem(storageKeys.favoriteRecipes);
  const savedFavorites = safeJsonParse(savedFavoritesText);
  if (savedFavorites && typeof savedFavorites === "object") {
    Object.keys(savedFavorites).forEach((key) => {
      if (savedFavorites[key]) favoriteRecipeIds[key] = true;
    });
  }

  const recipeSearchElement = document.getElementById("recipeSearch");
  if (recipeSearchElement) {
    const savedSearch = localStorage.getItem(storageKeys.recipeSearch) || "";
    recipeSearchElement.value = savedSearch;
  }
}

/* ================================
GROCERY AGGREGATION

Selected recipes are the source of truth. Totals are rebuilt from scratch
instead of incremented/decremented so the list cannot drift over time.
================================ */

function getRecipeKey(recipe, index) {
  return recipe && recipe.id ? String(recipe.id) : `recipe-${index}`;
}

function getRecipeIndexByKey(recipeKey) {
  return recipes.findIndex((recipe, index) => getRecipeKey(recipe, index) === recipeKey);
}

function isRecipeSelected(recipe, index) {
  return !!groceryState.selectedRecipeIds[getRecipeKey(recipe, index)];
}

function isRecipeFavorite(recipe, index) {
  return !!favoriteRecipeIds[getRecipeKey(recipe, index)];
}

function setRecipeFavorite(recipe, index, favorite) {
  const recipeKey = getRecipeKey(recipe, index);
  if (favorite) {
    favoriteRecipeIds[recipeKey] = true;
  } else {
    delete favoriteRecipeIds[recipeKey];
  }

  if (typeof syncFavoriteRecipeIndicators === "function") syncFavoriteRecipeIndicators();
  refreshRecipeListFilter();
  savePersistentState();
}

function setRecipeSelected(recipe, index, selected) {
  const recipeKey = getRecipeKey(recipe, index);
  if (selected) {
    groceryState.selectedRecipeIds[recipeKey] = true;
  } else {
    delete groceryState.selectedRecipeIds[recipeKey];
  }
  recomputeGroceryState();
  renderGroceryList();
  if (typeof syncRecipeSelectionIndicators === "function") syncRecipeSelectionIndicators();
  refreshRecipeListFilter();
  savePersistentState();
}

function syncRecipeCheckboxes() {
  document.querySelectorAll('.checkbox-inline input[type="checkbox"][data-recipe-id]').forEach((cb) => {
    cb.checked = !!groceryState.selectedRecipeIds[cb.dataset.recipeId];
  });
  if (typeof syncRecipeSelectionIndicators === "function") syncRecipeSelectionIndicators();
}

function refreshRecipeListFilter() {
  if (typeof applyRecipeFilter !== "function") return;
  const recipeSearchElement = document.getElementById("recipeSearch");
  applyRecipeFilter(recipeSearchElement ? recipeSearchElement.value || "" : "");
}

function addNoteForKey(canonicalKey, note) {
  if (!note) return;
  groceryState.notesByKey[canonicalKey] = groceryState.notesByKey[canonicalKey] || [];
  if (!groceryState.notesByKey[canonicalKey].includes(note)) {
    groceryState.notesByKey[canonicalKey].push(note);
  }
}

function getEffectiveUnit(parsed) {
  if (parsed.unitKey) return parsed.unitKey;

  const original = String(parsed.original || "").toLowerCase();
  const base = parsed.canonical ? parsed.canonical.base : "";

  if (base === "egg" && /\beggs?\b/.test(original)) return "egg";
  if (base === "egg yolk" || /\byolks?\b/.test(original)) return "yolk";
  if (base === "garlic" && /\bcloves?\b/.test(original)) return "clove";
  if (/\bsprigs?\b/.test(original)) return "sprig";
  if (/\bleaves\b|\bleaf\b/.test(original)) return "leaf";
  if (/\bstalks?\b/.test(original)) return "stalk";
  if (/\bsheets?\b/.test(original)) return "sheet";
  if (/\bslices?\b/.test(original)) return "slice";
  if (/\bsticks?\b/.test(original)) return "stick";
  if (/\bblocks?\b/.test(original)) return "block";
  if (/\bbags?\b/.test(original)) return "bag";
  if (/\bcans?\b/.test(original)) return "can";

  return "item";
}

function addParsedIngredientToTotals(parsed) {
  if (!parsed || !parsed.canonical || !parsed.canonical.base) return;

  const canonicalKey = parsed.canonical.base;
  parsedCanonicalDisplayMap[canonicalKey] = parsed.canonical.display || canonicalKey;

  if (!groceryState.totalsByKey[canonicalKey]) {
    groceryState.totalsByKey[canonicalKey] = {};
  }

  if (parsed.optional) addNoteForKey(canonicalKey, "optional");
  if (Array.isArray(parsed.notes)) {
    parsed.notes.forEach((note) => addNoteForKey(canonicalKey, note));
  }
  if (parsed.nonQuantifiedMarker) addNoteForKey(canonicalKey, parsed.nonQuantifiedMarker);

  if (!parsed.quantityRange) {
    addNoteForKey(canonicalKey, "amount not specified");
    if (Object.keys(groceryState.totalsByKey[canonicalKey]).length === 0) {
      delete groceryState.totalsByKey[canonicalKey];
    }
    return;
  }

  const effectiveUnit = getEffectiveUnit(parsed);
  const converted = convertToBaseUnits(parsed.quantityRange, effectiveUnit);
  if (!converted) return;

  if (!groceryState.totalsByKey[canonicalKey]) {
    groceryState.totalsByKey[canonicalKey] = {};
  }

  if (!groceryState.totalsByKey[canonicalKey][converted.baseUnit]) {
    groceryState.totalsByKey[canonicalKey][converted.baseUnit] = { min: 0, max: 0 };
  }

  groceryState.totalsByKey[canonicalKey][converted.baseUnit] = addRange(
    groceryState.totalsByKey[canonicalKey][converted.baseUnit],
    { min: converted.min, max: converted.max }
  );
}

function getRecipeGroceryIngredients(recipe) {
  if (Array.isArray(recipe.groceryIngredients) && recipe.groceryIngredients.length) {
    return recipe.groceryIngredients.flatMap((entry) => normalizeParsedIngredients(parseStructuredGroceryIngredient(entry)));
  }

  if (!Array.isArray(recipe.ingredients)) return [];
  return recipe.ingredients.flatMap((ingredient) => normalizeParsedIngredients(parseIngredient(ingredient)));
}

function recomputeGroceryState() {
  groceryState.totalsByKey = {};
  groceryState.notesByKey = {};

  Object.keys(parsedCanonicalDisplayMap).forEach((key) => {
    delete parsedCanonicalDisplayMap[key];
  });

  recipes.forEach((recipe, index) => {
    if (!isRecipeSelected(recipe, index)) return;
    getRecipeGroceryIngredients(recipe).forEach(addParsedIngredientToTotals);
  });
}

function addIngredient(text) {
  const parsedItems = normalizeParsedIngredients(parseIngredient(text));
  if (!parsedItems.length) return;

  parsedItems.forEach(addParsedIngredientToTotals);
  renderGroceryList();
}

function removeIngredient(text) {
  const parsedItems = normalizeParsedIngredients(parseIngredient(text));
  if (!parsedItems.length) return;

  parsedItems.forEach((parsed) => {
    if (!groceryState.totalsByKey[parsed.canonical.base]) return;

    const effectiveQuantityRange = parsed.quantityRange || { min: 1, max: 1 };
    const effectiveUnit = parsed.unitKey || "item";

    const converted = convertToBaseUnits(effectiveQuantityRange, effectiveUnit);
    const totalsForKey = groceryState.totalsByKey[parsed.canonical.base];

    if (!totalsForKey[converted.baseUnit]) return;

    totalsForKey[converted.baseUnit] = subtractRange(totalsForKey[converted.baseUnit], {
      min: converted.min,
      max: converted.max,
    });

    if (isEffectivelyZero(totalsForKey[converted.baseUnit])) {
      delete totalsForKey[converted.baseUnit];
    }

    if (Object.keys(totalsForKey).length === 0) {
      delete groceryState.totalsByKey[parsed.canonical.base];
      delete groceryState.notesByKey[parsed.canonical.base];
    }
  });

  renderGroceryList();
}

/* ================================
DEBUG: ADD ALL RECIPES TO GROCERY LIST
================================ */
function addAllRecipesToGroceryList() {
  clearGroceryList();

  recipes.forEach((recipe, index) => {
    groceryState.selectedRecipeIds[getRecipeKey(recipe, index)] = true;
  });

  recomputeGroceryState();
  syncRecipeCheckboxes();
  renderGroceryList();
  refreshRecipeListFilter();
  savePersistentState();
}

/* ================================
CLEAR
================================ */
function clearGroceryList() {
  groceryState.selectedRecipeIds = {};
  groceryState.totalsByKey = {};
  groceryState.notesByKey = {};
  Object.keys(groceryCheckedByKey).forEach((key) => {
    delete groceryCheckedByKey[key];
  });

  const recipeCheckboxes = document.querySelectorAll('.checkbox-inline input[type="checkbox"]');
  recipeCheckboxes.forEach((cb) => {
    cb.checked = false;
  });

  renderGroceryList();
  if (typeof syncRecipeSelectionIndicators === "function") syncRecipeSelectionIndicators();
  try {
    localStorage.removeItem(storageKeys.groceryState);
    localStorage.removeItem(storageKeys.groceryChecked);
    localStorage.removeItem(storageKeys.selectedRecipes);
  } catch (err) { }
  refreshRecipeListFilter();
  savePersistentState();
}
