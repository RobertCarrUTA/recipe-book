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
  grocerySearchSuffix: "offline_recipebook_grocery_search_suffix_v1",
  recipeControlsCollapsed: "offline_recipebook_recipe_controls_collapsed_v1",
  groupToggle: "offline_recipebook_group_toggle_v1",
  keepScreenAwake: "offline_recipebook_keep_screen_awake_v1",
  mobileView: "offline_recipebook_mobile_view_v1",
  recipeSort: "offline_recipebook_recipe_sort_v1",
  recipeSearch: "offline_recipebook_recipe_search_v1",
  filters: "offline_recipebook_filters_v1",
});

export const currentStorageVersion = 6;
export const backupAppId = "robert-recipe-book";
export const backupSchemaVersion = 1;
const mobileViews = new Set(["recipes", "grocery"]);
const uiBooleanStorageBindings = Object.freeze([
  ["groceryControlsCollapsed", storageKeys.groceryControlsCollapsed],
  ["groupItems", storageKeys.groupToggle],
  ["hideCheckedGroceryItems", storageKeys.hideCheckedGroceryItems],
  ["keepScreenAwake", storageKeys.keepScreenAwake],
  ["recipeControlsCollapsed", storageKeys.recipeControlsCollapsed],
  ["showFavoriteRecipesOnly", storageKeys.showFavoriteRecipesOnly],
  ["showSelectedRecipesOnly", storageKeys.showSelectedRecipesOnly],
  ["skipClearGroceryConfirmation", storageKeys.skipClearGroceryConfirmation],
]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getDefaultStorage() {
  try {
    return globalThis.localStorage;
  } catch (error) {
    return null;
  }
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

function writeJson(storage, key, value) {
  return write(storage, key, JSON.stringify(value));
}

function writeBoolean(storage, key, value) {
  return write(storage, key, value ? "1" : "0");
}

function remove(storage, key) {
  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    // Storage failures are non-fatal; the app remains usable in-memory.
    return false;
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

    const itemId = String(item.id || id).trim() || String(id);
    items[itemId] = {
      id: itemId,
      name,
    };

    const note = String(item.note || "").trim();
    if (note) items[itemId].note = note;

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

export function normalizeUiState(uiState) {
  const ui = isPlainObject(uiState) ? uiState : {};
  const defaults = createDefaultUiState();

  return {
    ...defaults,
    collapsedGroceryGroups: truthyRecord(ui.collapsedGroceryGroups),
    filters: normalizeFilterData(ui.filters),
    groceryControlsCollapsed: Boolean(ui.groceryControlsCollapsed),
    grocerySearchSuffix: String(ui.grocerySearchSuffix || "").trim(),
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
  return write(storage, storageKeys.version, String(version));
}

function readStorageVersion(storage) {
  const version = Number(read(storage, storageKeys.version));
  return Number.isInteger(version) && version > 0 ? version : 1;
}

function hasFutureStorageVersion(storage) {
  return readStorageVersion(storage) > currentStorageVersion;
}

export function migratePersistentState(storage = getDefaultStorage()) {
  if (!storage) return { fromVersion: 0, toVersion: currentStorageVersion, migrated: false };

  const fromVersion = readStorageVersion(storage);
  if (fromVersion > currentStorageVersion) {
    return {
      fromVersion,
      incompatible: true,
      migrated: false,
      toVersion: currentStorageVersion,
    };
  }

  if (fromVersion < 2) {
    const savedGroceryState = readObject(storage, storageKeys.groceryState);
    const selectedFromLegacyState = truthyRecord(savedGroceryState.selectedRecipeIds);
    const selectedRecipes = readObject(storage, storageKeys.selectedRecipes);

    if (Object.keys(selectedFromLegacyState).length && !Object.keys(selectedRecipes).length) {
      if (!writeJson(storage, storageKeys.selectedRecipes, selectedFromLegacyState)) {
        return {
          failed: true,
          fromVersion,
          migrated: false,
          toVersion: fromVersion,
        };
      }
    }
  }

  if (fromVersion !== currentStorageVersion && !writeStorageVersion(storage, currentStorageVersion)) {
    return {
      failed: true,
      fromVersion,
      migrated: false,
      toVersion: fromVersion,
    };
  }

  if (fromVersion < 6) remove(storage, storageKeys.groceryState);

  return {
    fromVersion,
    toVersion: currentStorageVersion,
    migrated: fromVersion !== currentStorageVersion,
  };
}

export function createDefaultUiState() {
  return {
    collapsedGroceryGroups: {},
    filters: {},
    groceryControlsCollapsed: false,
    grocerySearchSuffix: "",
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

function readPersistedUiState(storage) {
  const ui = createDefaultUiState();

  ui.filters = normalizeFilterData(readObject(storage, storageKeys.filters));
  ui.collapsedGroceryGroups = truthyRecord(readObject(storage, storageKeys.collapsedGroceryGroups));
  ui.grocerySearchSuffix = read(storage, storageKeys.grocerySearchSuffix) || "";
  ui.mobileView = normalizeMobileView(read(storage, storageKeys.mobileView));
  ui.recipeSearch = read(storage, storageKeys.recipeSearch) || "";
  ui.recipeSort = normalizeRecipeSort(read(storage, storageKeys.recipeSort));

  uiBooleanStorageBindings.forEach(([key, storageKey]) => {
    ui[key] = readBoolean(storage, storageKey);
  });

  return ui;
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

export function restorePersistentState(storage = getDefaultStorage()) {
  if (!storage) {
    return {
      favoriteRecipeIds: {},
      groceryCheckedByKey: {},
      manualGroceryItemsById: {},
      mealPlan: normalizeMealPlan(),
      recipeMultipliersById: {},
      selectedRecipeIds: {},
      ui: createDefaultUiState(),
    };
  }

  migratePersistentState(storage);

  const savedGroceryState = readObject(storage, storageKeys.groceryState);
  const selectedFromLegacyState = truthyRecord(savedGroceryState.selectedRecipeIds);
  const recipeMultipliers = normalizeRecipeMultiplierRecord({
    ...(savedGroceryState.recipeMultipliersById || {}),
    ...readObject(storage, storageKeys.recipeMultipliers),
  });

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
    ui: readPersistedUiState(storage),
  };
}

export function savePersistentState(state, storage = getDefaultStorage()) {
  if (!storage || hasFutureStorageVersion(storage)) return false;

  const runtime = state.runtime || {};
  const ui = state.ui || createDefaultUiState();
  const writes = [
    write(storage, storageKeys.version, String(currentStorageVersion)),
    writeJson(storage, storageKeys.selectedRecipes, runtime.selectedRecipeIds || {}),
    writeJson(storage, storageKeys.recipeMultipliers, runtime.recipeMultipliersById || {}),
    writeJson(storage, storageKeys.groceryChecked, runtime.groceryCheckedByKey || {}),
    writeJson(storage, storageKeys.manualGroceryItems, runtime.manualGroceryItemsById || {}),
    writeJson(storage, storageKeys.favoriteRecipes, runtime.favoriteRecipeIds || {}),
    writeJson(storage, storageKeys.mealPlan, normalizeMealPlan(state.mealPlan)),
    writeJson(storage, storageKeys.collapsedGroceryGroups, ui.collapsedGroceryGroups || {}),
    writeJson(storage, storageKeys.filters, ui.filters || {}),
    write(storage, storageKeys.grocerySearchSuffix, ui.grocerySearchSuffix || ""),
    write(storage, storageKeys.mobileView, normalizeMobileView(ui.mobileView)),
    write(storage, storageKeys.recipeSearch, ui.recipeSearch || ""),
    write(storage, storageKeys.recipeSort, normalizeRecipeSort(ui.recipeSort)),
    ...uiBooleanStorageBindings.map(([key, storageKey]) => writeBoolean(storage, storageKey, ui[key])),
  ];

  return writes.every(Boolean);
}

export function clearGroceryPersistence(storage = getDefaultStorage()) {
  if (!storage || hasFutureStorageVersion(storage)) return;

  remove(storage, storageKeys.groceryState);
  remove(storage, storageKeys.groceryChecked);
  remove(storage, storageKeys.manualGroceryItems);
  remove(storage, storageKeys.recipeMultipliers);
  remove(storage, storageKeys.selectedRecipes);
}
