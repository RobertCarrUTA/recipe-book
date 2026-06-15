export const storageKeys = Object.freeze({
  version: "offline_recipebook_storage_version",
  groceryState: "offline_recipebook_grocery_state_v1",
  groceryChecked: "offline_recipebook_grocery_checked_v1",
  manualGroceryItems: "offline_recipebook_manual_grocery_items_v1",
  favoriteRecipes: "offline_recipebook_favorite_recipes_v1",
  selectedRecipes: "offline_recipebook_selected_recipes_v1",
  collapsedGroceryGroups: "offline_recipebook_collapsed_grocery_groups_v1",
  showFavoriteRecipesOnly: "offline_recipebook_show_favorite_recipes_only_v1",
  showSelectedRecipesOnly: "offline_recipebook_show_selected_recipes_only_v1",
  hideCheckedGroceryItems: "offline_recipebook_hide_checked_grocery_items_v1",
  groupToggle: "offline_recipebook_group_toggle_v1",
  keepScreenAwake: "offline_recipebook_keep_screen_awake_v1",
  mobileView: "offline_recipebook_mobile_view_v1",
  recipeSearch: "offline_recipebook_recipe_search_v1",
  filters: "offline_recipebook_filters_v1",
});

export const currentStorageVersion = 2;

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

function truthyRecord(value) {
  if (!isPlainObject(value)) return {};

  return Object.keys(value).reduce((record, key) => {
    if (value[key]) record[key] = true;
    return record;
  }, {});
}

function readManualGroceryItems(storage) {
  const value = readObject(storage, storageKeys.manualGroceryItems);

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
    groupItems: false,
    hideCheckedGroceryItems: false,
    keepScreenAwake: false,
    mobileView: "recipes",
    recipeSearch: "",
    showFavoriteRecipesOnly: false,
    showSelectedRecipesOnly: false,
  };
}

export function restorePersistentState(storage = globalThis.localStorage) {
  const ui = createDefaultUiState();
  if (!storage) {
    return {
      favoriteRecipeIds: {},
      groceryCheckedByKey: {},
      manualGroceryItemsById: {},
      selectedRecipeIds: {},
      ui,
    };
  }

  migratePersistentState(storage);

  const savedGroceryState = readObject(storage, storageKeys.groceryState);
  const selectedFromLegacyState = truthyRecord(savedGroceryState.selectedRecipeIds);

  ui.filters = readObject(storage, storageKeys.filters);
  ui.collapsedGroceryGroups = truthyRecord(readObject(storage, storageKeys.collapsedGroceryGroups));
  ui.groupItems = readBoolean(storage, storageKeys.groupToggle);
  ui.hideCheckedGroceryItems = readBoolean(storage, storageKeys.hideCheckedGroceryItems);
  ui.keepScreenAwake = readBoolean(storage, storageKeys.keepScreenAwake);
  ui.mobileView = read(storage, storageKeys.mobileView) === "grocery" ? "grocery" : "recipes";
  ui.recipeSearch = read(storage, storageKeys.recipeSearch) || "";
  ui.showFavoriteRecipesOnly = readBoolean(storage, storageKeys.showFavoriteRecipesOnly);
  ui.showSelectedRecipesOnly = readBoolean(storage, storageKeys.showSelectedRecipesOnly);

  return {
    favoriteRecipeIds: truthyRecord(readObject(storage, storageKeys.favoriteRecipes)),
    groceryCheckedByKey: truthyRecord(readObject(storage, storageKeys.groceryChecked)),
    manualGroceryItemsById: readManualGroceryItems(storage),
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
    })),
    write(storage, storageKeys.selectedRecipes, JSON.stringify(runtime.selectedRecipeIds || {})),
    write(storage, storageKeys.groceryChecked, JSON.stringify(runtime.groceryCheckedByKey || {})),
    write(storage, storageKeys.manualGroceryItems, JSON.stringify(runtime.manualGroceryItemsById || {})),
    write(storage, storageKeys.favoriteRecipes, JSON.stringify(runtime.favoriteRecipeIds || {})),
    write(storage, storageKeys.collapsedGroceryGroups, JSON.stringify(ui.collapsedGroceryGroups || {})),
    write(storage, storageKeys.filters, JSON.stringify(ui.filters || {})),
    write(storage, storageKeys.groupToggle, ui.groupItems ? "1" : "0"),
    write(storage, storageKeys.hideCheckedGroceryItems, ui.hideCheckedGroceryItems ? "1" : "0"),
    write(storage, storageKeys.keepScreenAwake, ui.keepScreenAwake ? "1" : "0"),
    write(storage, storageKeys.mobileView, ui.mobileView === "grocery" ? "grocery" : "recipes"),
    write(storage, storageKeys.recipeSearch, ui.recipeSearch || ""),
    write(storage, storageKeys.showFavoriteRecipesOnly, ui.showFavoriteRecipesOnly ? "1" : "0"),
    write(storage, storageKeys.showSelectedRecipesOnly, ui.showSelectedRecipesOnly ? "1" : "0"),
  ];

  return writes.every(Boolean);
}

export function clearGroceryPersistence(storage = globalThis.localStorage) {
  if (!storage) return;

  remove(storage, storageKeys.groceryState);
  remove(storage, storageKeys.groceryChecked);
  remove(storage, storageKeys.manualGroceryItems);
  remove(storage, storageKeys.selectedRecipes);
}
