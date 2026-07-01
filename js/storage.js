import { normalizeMealPlan } from "./meal_plan_model.js";
import { normalizeRecipeMultiplierRecord } from "./recipe_multiplier.js";
import { normalizeRecipeSort, recipeSortModes } from "./recipe_sort.js";

export const storageKeys = Object.freeze({
  version: "offline_recipebook_storage_version",
  groceryState: "offline_recipebook_grocery_state_v1",
  groceryChecked: "offline_recipebook_grocery_checked_v1",
  manualGroceryItems: "offline_recipebook_manual_grocery_items_v1",
  favoriteRecipes: "offline_recipebook_favorite_recipes_v1",
  recipeMultipliers: "offline_recipebook_recipe_multipliers_v1",
  mealPlan: "offline_recipebook_meal_plan_v1",
  selectedRecipes: "offline_recipebook_selected_recipes_v1",
  collapsedGroceryGroups: "offline_recipebook_collapsed_grocery_groups_v1",
  skipClearGroceryConfirmation: "offline_recipebook_skip_clear_grocery_confirmation_v1",
  showFavoriteRecipesOnly: "offline_recipebook_show_favorite_recipes_only_v1",
  showSelectedRecipesOnly: "offline_recipebook_show_selected_recipes_only_v1",
  hideCheckedGroceryItems: "offline_recipebook_hide_checked_grocery_items_v1",
  groceryControlsCollapsed: "offline_recipebook_grocery_controls_collapsed_v1",
  recipeControlsCollapsed: "offline_recipebook_recipe_controls_collapsed_v1",
  groupToggle: "offline_recipebook_group_toggle_v1",
  keepScreenAwake: "offline_recipebook_keep_screen_awake_v1",
  mobileView: "offline_recipebook_mobile_view_v1",
  recipeSort: "offline_recipebook_recipe_sort_v1",
  recipeSearch: "offline_recipebook_recipe_search_v1",
  filters: "offline_recipebook_filters_v1",
});

export const currentStorageVersion = 5;
export const backupAppId = "robert-recipe-book";
export const backupSchemaVersion = 1;
const mobileViews = new Set(["recipes", "grocery"]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function safeJsonParse(text, fallback = null) {
  if (!text) return fallback;

  try {
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

function read(storage, key) {
  try {
    return storage.getItem(key);
  } catch (error) {
    return null;
  }
}

function write(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

function remove(storage, key) {
  try {
    storage.removeItem(key);
  } catch (error) {
    // Storage failures are non-fatal; the app remains usable in-memory.
  }
}

function readBoolean(storage, key, fallback = false) {
  const value = read(storage, key);
  if (value === "1") return true;
  if (value === "0") return false;
  return fallback;
}

function readObject(storage, key) {
  const value = safeJsonParse(read(storage, key), {});
  return isPlainObject(value) ? value : {};
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function truthyRecord(value) {
  if (!isPlainObject(value)) return {};

  return Object.keys(value).reduce((record, key) => {
    if (value[key]) record[key] = true;
    return record;
  }, {});
}

function normalizeManualGroceryItems(value) {
  if (!isPlainObject(value)) return {};
  return Object.keys(value).reduce((items, id) => {
    const item = value[id];
    if (!isPlainObject(item)) return items;

    const name = String(item.name || "").trim();
    if (!name) return items;

    items[id] = {
      id: String(item.id || id),
      name,
    };

    const note = String(item.note || "").trim();
    if (note) items[id].note = note;

    return items;
  }, {});
}

function readManualGroceryItems(storage) {
  return normalizeManualGroceryItems(readObject(storage, storageKeys.manualGroceryItems));
}

function normalizeFilterData(value) {
  if (!isPlainObject(value)) return {};

  return Object.keys(value).reduce((filters, key) => {
    const normalizedKey = String(key || "").trim();
    const selected = normalizeStringList(value[key]);
    if (normalizedKey && selected.length) filters[normalizedKey] = selected;
    return filters;
  }, {});
}

function normalizeMobileView(value) {
  return mobileViews.has(value) ? value : "recipes";
}

function normalizeUiState(uiState) {
  const ui = isPlainObject(uiState) ? uiState : {};
  const defaults = createDefaultUiState();

  return {
    ...defaults,
    collapsedGroceryGroups: truthyRecord(ui.collapsedGroceryGroups),
    filters: normalizeFilterData(ui.filters),
    groceryControlsCollapsed: Boolean(ui.groceryControlsCollapsed),
    groupItems: Boolean(ui.groupItems),
    hideCheckedGroceryItems: Boolean(ui.hideCheckedGroceryItems),
    keepScreenAwake: Boolean(ui.keepScreenAwake),
    mobileView: normalizeMobileView(ui.mobileView),
    recipeControlsCollapsed: Boolean(ui.recipeControlsCollapsed),
    recipeSearch: String(ui.recipeSearch || "").trim(),
    recipeSort: normalizeRecipeSort(ui.recipeSort),
    showFavoriteRecipesOnly: Boolean(ui.showFavoriteRecipesOnly),
    showSelectedRecipesOnly: Boolean(ui.showSelectedRecipesOnly),
    skipClearGroceryConfirmation: Boolean(ui.skipClearGroceryConfirmation),
  };
}

function writeStorageVersion(storage, version) {
  write(storage, storageKeys.version, String(version));
}

export function migratePersistentState(storage = globalThis.localStorage) {
  if (!storage) return { fromVersion: 0, toVersion: currentStorageVersion, migrated: false };

  const rawVersion = Number(read(storage, storageKeys.version));
  const fromVersion = Number.isFinite(rawVersion) && rawVersion > 0 ? rawVersion : 1;
  let migrated = false;

  if (fromVersion < 2) {
    const savedGroceryState = readObject(storage, storageKeys.groceryState);
    const selectedFromLegacyState = truthyRecord(savedGroceryState.selectedRecipeIds);
    const selectedRecipes = readObject(storage, storageKeys.selectedRecipes);

    if (Object.keys(selectedFromLegacyState).length && !Object.keys(selectedRecipes).length) {
      write(storage, storageKeys.selectedRecipes, JSON.stringify(selectedFromLegacyState));
    }
    migrated = true;
  }

  if (fromVersion !== currentStorageVersion) {
    writeStorageVersion(storage, currentStorageVersion);
    migrated = true;
  }

  return { fromVersion, toVersion: currentStorageVersion, migrated };
}

export function createDefaultUiState() {
  return {
    collapsedGroceryGroups: {},
    filters: {},
    groceryControlsCollapsed: false,
    groupItems: false,
    hideCheckedGroceryItems: false,
    keepScreenAwake: false,
    mobileView: "recipes",
    recipeControlsCollapsed: false,
    recipeSearch: "",
    recipeSort: recipeSortModes.default,
    showFavoriteRecipesOnly: false,
    showSelectedRecipesOnly: false,
    skipClearGroceryConfirmation: false,
  };
}

export function createPersistentStateBackup(state, options = {}) {
  const runtime = state && state.runtime ? state.runtime : {};
  const ui = normalizeUiState(state && state.ui);
  const exportedAt = options.exportedAt || new Date().toISOString();

  return {
    app: backupAppId,
    schemaVersion: backupSchemaVersion,
    storageVersion: currentStorageVersion,
    exportedAt,
    data: {
      favoriteRecipeIds: truthyRecord(runtime.favoriteRecipeIds),
      groceryCheckedByKey: truthyRecord(runtime.groceryCheckedByKey),
      manualGroceryItemsById: normalizeManualGroceryItems(runtime.manualGroceryItemsById),
      mealPlan: normalizeMealPlan(state && state.mealPlan),
      recipeMultipliersById: normalizeRecipeMultiplierRecord(runtime.recipeMultipliersById),
      selectedRecipeIds: truthyRecord(runtime.selectedRecipeIds),
      ui,
    },
  };
}

export function normalizePersistentStateBackup(backup) {
  if (!isPlainObject(backup)) {
    throw new Error("Backup file is not a recipe book backup.");
  }

  if (backup.app !== backupAppId || backup.schemaVersion !== backupSchemaVersion) {
    throw new Error("Backup file is not compatible with this recipe book.");
  }

  const data = isPlainObject(backup.data) ? backup.data : {};
  return {
    favoriteRecipeIds: truthyRecord(data.favoriteRecipeIds),
    groceryCheckedByKey: truthyRecord(data.groceryCheckedByKey),
    manualGroceryItemsById: normalizeManualGroceryItems(data.manualGroceryItemsById),
    mealPlan: normalizeMealPlan(data.mealPlan),
    recipeMultipliersById: normalizeRecipeMultiplierRecord(data.recipeMultipliersById),
    selectedRecipeIds: truthyRecord(data.selectedRecipeIds),
    ui: normalizeUiState(data.ui),
  };
}

export function restorePersistentState(storage = globalThis.localStorage) {
  const ui = createDefaultUiState();
  if (!storage) {
    return {
      favoriteRecipeIds: {},
      groceryCheckedByKey: {},
      manualGroceryItemsById: {},
      mealPlan: normalizeMealPlan(),
      recipeMultipliersById: {},
      selectedRecipeIds: {},
      ui,
    };
  }

  migratePersistentState(storage);

  const savedGroceryState = readObject(storage, storageKeys.groceryState);
  const selectedFromLegacyState = truthyRecord(savedGroceryState.selectedRecipeIds);
  const recipeMultipliers = normalizeRecipeMultiplierRecord({
    ...(savedGroceryState.recipeMultipliersById || {}),
    ...readObject(storage, storageKeys.recipeMultipliers),
  });

  ui.filters = normalizeFilterData(readObject(storage, storageKeys.filters));
  ui.collapsedGroceryGroups = truthyRecord(readObject(storage, storageKeys.collapsedGroceryGroups));
  ui.groceryControlsCollapsed = readBoolean(storage, storageKeys.groceryControlsCollapsed);
  ui.groupItems = readBoolean(storage, storageKeys.groupToggle);
  ui.hideCheckedGroceryItems = readBoolean(storage, storageKeys.hideCheckedGroceryItems);
  ui.keepScreenAwake = readBoolean(storage, storageKeys.keepScreenAwake);
  ui.mobileView = normalizeMobileView(read(storage, storageKeys.mobileView));
  ui.recipeControlsCollapsed = readBoolean(storage, storageKeys.recipeControlsCollapsed);
  ui.recipeSearch = read(storage, storageKeys.recipeSearch) || "";
  ui.recipeSort = normalizeRecipeSort(read(storage, storageKeys.recipeSort));
  ui.showFavoriteRecipesOnly = readBoolean(storage, storageKeys.showFavoriteRecipesOnly);
  ui.showSelectedRecipesOnly = readBoolean(storage, storageKeys.showSelectedRecipesOnly);
  ui.skipClearGroceryConfirmation = readBoolean(storage, storageKeys.skipClearGroceryConfirmation);

  return {
    favoriteRecipeIds: truthyRecord(readObject(storage, storageKeys.favoriteRecipes)),
    groceryCheckedByKey: truthyRecord(readObject(storage, storageKeys.groceryChecked)),
    manualGroceryItemsById: readManualGroceryItems(storage),
    mealPlan: normalizeMealPlan(readObject(storage, storageKeys.mealPlan)),
    recipeMultipliersById: recipeMultipliers,
    selectedRecipeIds: {
      ...selectedFromLegacyState,
      ...truthyRecord(readObject(storage, storageKeys.selectedRecipes)),
    },
    ui,
  };
}

export function savePersistentState(state, storage = globalThis.localStorage) {
  if (!storage) return false;

  const runtime = state.runtime || {};
  const ui = state.ui || createDefaultUiState();
  const grocery = runtime.grocery || {};

  const writes = [
    write(storage, storageKeys.version, String(currentStorageVersion)),
    write(storage, storageKeys.groceryState, JSON.stringify({
      selectedRecipeIds: runtime.selectedRecipeIds || {},
      totalsByKey: grocery.totalsByKey || {},
      notesByKey: grocery.notesByKey || {},
      sourcesByKey: grocery.sourcesByKey || {},
      recipeMultipliersById: runtime.recipeMultipliersById || {},
    })),
    write(storage, storageKeys.selectedRecipes, JSON.stringify(runtime.selectedRecipeIds || {})),
    write(storage, storageKeys.recipeMultipliers, JSON.stringify(runtime.recipeMultipliersById || {})),
    write(storage, storageKeys.groceryChecked, JSON.stringify(runtime.groceryCheckedByKey || {})),
    write(storage, storageKeys.manualGroceryItems, JSON.stringify(runtime.manualGroceryItemsById || {})),
    write(storage, storageKeys.favoriteRecipes, JSON.stringify(runtime.favoriteRecipeIds || {})),
    write(storage, storageKeys.mealPlan, JSON.stringify(normalizeMealPlan(state.mealPlan))),
    write(storage, storageKeys.collapsedGroceryGroups, JSON.stringify(ui.collapsedGroceryGroups || {})),
    write(storage, storageKeys.filters, JSON.stringify(ui.filters || {})),
    write(storage, storageKeys.groceryControlsCollapsed, ui.groceryControlsCollapsed ? "1" : "0"),
    write(storage, storageKeys.groupToggle, ui.groupItems ? "1" : "0"),
    write(storage, storageKeys.hideCheckedGroceryItems, ui.hideCheckedGroceryItems ? "1" : "0"),
    write(storage, storageKeys.keepScreenAwake, ui.keepScreenAwake ? "1" : "0"),
    write(storage, storageKeys.mobileView, normalizeMobileView(ui.mobileView)),
    write(storage, storageKeys.recipeControlsCollapsed, ui.recipeControlsCollapsed ? "1" : "0"),
    write(storage, storageKeys.recipeSearch, ui.recipeSearch || ""),
    write(storage, storageKeys.recipeSort, normalizeRecipeSort(ui.recipeSort)),
    write(storage, storageKeys.showFavoriteRecipesOnly, ui.showFavoriteRecipesOnly ? "1" : "0"),
    write(storage, storageKeys.showSelectedRecipesOnly, ui.showSelectedRecipesOnly ? "1" : "0"),
    write(storage, storageKeys.skipClearGroceryConfirmation, ui.skipClearGroceryConfirmation ? "1" : "0"),
  ];

  return writes.every(Boolean);
}

export function clearGroceryPersistence(storage = globalThis.localStorage) {
  if (!storage) return;

  remove(storage, storageKeys.groceryState);
  remove(storage, storageKeys.groceryChecked);
  remove(storage, storageKeys.manualGroceryItems);
  remove(storage, storageKeys.recipeMultipliers);
  remove(storage, storageKeys.selectedRecipes);
}
