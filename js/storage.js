import { normalizeMealPlan } from "./meal_plan_model.js";
import { normalizeRecipeMultiplierRecord } from "./recipe_multiplier.js";
import { normalizeRecipeSort, recipeSortModes } from "./recipe_sort.js";

export const storageKeys = Object.freeze({
  snapshot: "offline_recipebook_state_snapshot",
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

export const currentStorageVersion = 7;
export const backupAppId = "robert-recipe-book";
export const backupSchemaVersion = 1;
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_LENGTH = 20000;
const unsafeKeys = new Set(["__proto__", "prototype", "constructor"]);
const unobservedSnapshot = Symbol("unobserved snapshot");
const sessions = new WeakMap();
const storageStatuses = new WeakMap();
let defaultStorageAccessFailed = false;
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
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function getDefaultStorage() {
  try {
    const storage = globalThis.localStorage;
    if (storage && defaultStorageAccessFailed) {
      sessions.set(storage, unobservedSnapshot);
      defaultStorageAccessFailed = false;
    }
    return storage;
  } catch (error) {
    defaultStorageAccessFailed = true;
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
    setStorageStatus(storage, "unavailable");
    return null;
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
    if (!unsafeKeys.has(key) && value[key]) record[key] = true;
    return record;
  }, {});
}

function normalizeManualGroceryItems(value) {
  if (!isPlainObject(value)) return {};
  return Object.keys(value).reduce((items, id) => {
    if (unsafeKeys.has(id)) return items;
    const item = value[id];
    if (!isPlainObject(item)) return items;

    const name = String(item.name || "").trim();
    if (!name) return items;

    const itemId = String(item.id || id).trim() || String(id);
    if (unsafeKeys.has(itemId)) return items;
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
    if (normalizedKey && !unsafeKeys.has(normalizedKey) && selected.length) filters[normalizedKey] = selected;
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
    // Keep bounded additive preferences in v1 backups when a newer UI introduces them.
    ...Object.fromEntries(Object.entries(ui).filter(([key]) => !unsafeKeys.has(key))),
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

function readStorageVersion(storage) {
  const version = Number(read(storage, storageKeys.version));
  return Number.isInteger(version) && version > 0 ? version : 1;
}

export function migratePersistentState(storage = getDefaultStorage()) {
  if (!storage) return { fromVersion: 0, toVersion: currentStorageVersion, migrated: false };
  setStorageStatus(storage);
  const snapshot = inspectSnapshot(storage);
  if (snapshot.data) {
    sessions.set(storage, snapshot.raw);
    const fenced = ensureVersionFence(storage);
    return { fromVersion: currentStorageVersion, toVersion: currentStorageVersion, migrated: false, ...(fenced ? {} : { failed: true }) };
  }
  const fromVersion = readStorageVersion(storage);
  if (snapshot.reason || fromVersion > currentStorageVersion) {
    const reason = snapshot.reason || "future-version";
    if (reason === "unavailable") sessions.set(storage, unobservedSnapshot);
    setStorageStatus(storage, reason);
    return {
      fromVersion,
      incompatible: reason === "future-version",
      failed: true,
      migrated: false,
      toVersion: fromVersion,
    };
  }
  const data = readLegacyState(storage);
  const observed = getPersistentStateStatus(storage).reason !== "unavailable";
  sessions.set(storage, observed ? null : unobservedSnapshot);
  const committed = observed && commitSnapshot(data, storage);
  return {
    fromVersion,
    toVersion: committed ? currentStorageVersion : fromVersion,
    migrated: committed,
    ...(committed ? {} : { failed: true }),
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
  assertBoundedJson(backup);
  if (backup.storageVersion !== undefined && (
    !Number.isInteger(backup.storageVersion) || backup.storageVersion < 1 || backup.storageVersion > currentStorageVersion
  )) throw new Error("Backup storage version is not compatible with this recipe book.");
  validatePersistentData(backup.data);
  return normalizePersistentData(backup.data);
}

export function parsePersistentStateBackup(text) {
  if (typeof text !== "string" || text.length > MAX_BACKUP_BYTES || new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) {
    throw new Error("Backup exceeds the 2 MiB limit.");
  }
  return normalizePersistentStateBackup(safeJsonParse(text));
}

function normalizePersistentData(data) {
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

function assertBoundedJson(value) {
  let nodes = 0;
  const visited = new WeakSet();
  function visit(item, depth) {
    if (++nodes > 50000 || depth > 12) throw new Error("Backup is too complex.");
    if (typeof item === "string" && item.length > MAX_TEXT_LENGTH) throw new Error("Backup text is too long.");
    if (item === null || typeof item === "string" || typeof item === "boolean") return;
    if (typeof item === "number" && Number.isFinite(item)) return;
    if (!Array.isArray(item) && !isPlainObject(item)) throw new Error("Backup contains invalid data.");
    if (visited.has(item)) throw new Error("Backup contains circular data.");
    visited.add(item);
    const keys = Object.keys(item);
    if (keys.length > 5000) throw new Error("Backup contains too many items.");
    for (const key of keys) {
      if (unsafeKeys.has(key) || key.length > 1000) throw new Error("Backup contains an invalid key.");
      visit(item[key], depth + 1);
    }
    visited.delete(item);
  }
  visit(value, 0);
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_BACKUP_BYTES) {
    throw new Error("Backup exceeds the 2 MiB limit.");
  }
}

function validatePersistentData(data) {
  if (!isPlainObject(data)) throw new Error("Backup data must be an object.");
  const requireRecord = (record) => {
    if (!isPlainObject(record)) throw new Error("Backup contains an invalid record.");
  };
  const booleanRecord = (record) => {
    requireRecord(record);
    if (Object.values(record).some((value) => ![true, false, 0, 1].includes(value))) {
      throw new Error("Backup contains an invalid selection.");
    }
  };
  for (const key of ["favoriteRecipeIds", "groceryCheckedByKey", "selectedRecipeIds"]) {
    if (Object.hasOwn(data, key)) booleanRecord(data[key]);
  }
  if (Object.hasOwn(data, "recipeMultipliersById")) {
    requireRecord(data.recipeMultipliersById);
    if (Object.values(data.recipeMultipliersById).some((value) => typeof value !== "number" || !Number.isFinite(value) || value <= 0)) {
      throw new Error("Backup contains an invalid multiplier.");
    }
  }
  if (Object.hasOwn(data, "manualGroceryItemsById")) {
    requireRecord(data.manualGroceryItemsById);
    for (const item of Object.values(data.manualGroceryItemsById)) {
      requireRecord(item);
      if (typeof item.name !== "string" || !item.name.trim() ||
        (item.id !== undefined && (typeof item.id !== "string" || unsafeKeys.has(item.id))) ||
        (item.note !== undefined && typeof item.note !== "string")) {
        throw new Error("Backup contains an invalid grocery item.");
      }
    }
  }
  if (Object.hasOwn(data, "mealPlan")) {
    requireRecord(data.mealPlan);
    const days = Object.hasOwn(data.mealPlan, "days") ? data.mealPlan.days : data.mealPlan;
    requireRecord(days);
    for (const ids of Object.values(days)) {
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) throw new Error("Backup contains an invalid meal plan.");
    }
  }
  if (Object.hasOwn(data, "ui")) {
    requireRecord(data.ui);
    for (const [key] of uiBooleanStorageBindings) {
      if (Object.hasOwn(data.ui, key) && typeof data.ui[key] !== "boolean") throw new Error("Backup contains an invalid preference.");
    }
    for (const key of ["grocerySearchSuffix", "mobileView", "recipeSearch", "recipeSort"]) {
      if (Object.hasOwn(data.ui, key) && typeof data.ui[key] !== "string") throw new Error("Backup contains an invalid preference.");
    }
    if (Object.hasOwn(data.ui, "collapsedGroceryGroups")) booleanRecord(data.ui.collapsedGroceryGroups);
    if (Object.hasOwn(data.ui, "filters")) {
      requireRecord(data.ui.filters);
      for (const values of Object.values(data.ui.filters)) {
        if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) throw new Error("Backup contains an invalid filter.");
      }
    }
  }
}

function readLegacyState(storage) {
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

function setStorageStatus(storage, reason = null) {
  if (storage && typeof storage === "object") storageStatuses.set(storage, { reason, writable: reason === null });
}

export function getPersistentStateStatus(storage = getDefaultStorage()) {
  if (!storage) return { reason: "unavailable", writable: false };
  return { ...(storageStatuses.get(storage) || { reason: null, writable: true }) };
}

function inspectSnapshot(storage) {
  let raw;
  try {
    raw = storage.getItem(storageKeys.snapshot);
    if (Number(storage.getItem(storageKeys.version)) > currentStorageVersion) return { raw, reason: "future-version" };
  } catch (error) {
    return { raw, reason: "unavailable" };
  }
  try {
    if (raw === null) return { raw, data: null };
    if (raw.length > MAX_BACKUP_BYTES) return { raw, reason: "corrupt-snapshot" };
    const snapshot = JSON.parse(raw);
    if (snapshot?.storageVersion > currentStorageVersion) return { raw, reason: "future-version" };
    if (!isPlainObject(snapshot) || snapshot.storageVersion !== currentStorageVersion ||
      typeof snapshot.revision !== "string" || !snapshot.revision) throw new Error("Invalid snapshot");
    assertBoundedJson(snapshot);
    validatePersistentData(snapshot.data);
    for (const key of ["favoriteRecipeIds", "groceryCheckedByKey", "manualGroceryItemsById", "mealPlan", "recipeMultipliersById", "selectedRecipeIds", "ui"]) {
      if (!Object.hasOwn(snapshot.data, key)) throw new Error("Incomplete snapshot");
    }
    return { raw, data: normalizePersistentData(snapshot.data) };
  } catch (error) {
    return { raw, reason: "corrupt-snapshot" };
  }
}

function ensureVersionFence(storage) {
  try {
    const version = Number(storage.getItem(storageKeys.version));
    if (version > currentStorageVersion) {
      setStorageStatus(storage, "future-version");
      return false;
    }
    if (version !== currentStorageVersion) storage.setItem(storageKeys.version, String(currentStorageVersion));
    return true;
  } catch (error) {
    setStorageStatus(storage, "write-failed");
    return false;
  }
}

function commitSnapshot(data, storage, { replaceCorrupt = false } = {}) {
  if (!storage) return false;
  const previous = inspectSnapshot(storage);
  if (previous.reason && !(replaceCorrupt && previous.reason === "corrupt-snapshot")) {
    if (previous.reason === "unavailable") sessions.set(storage, unobservedSnapshot);
    setStorageStatus(storage, previous.reason);
    return false;
  }
  const baseline = sessions.get(storage);
  const observed = sessions.has(storage) && baseline !== unobservedSnapshot;
  if (!replaceCorrupt && (baseline === unobservedSnapshot || (!observed && previous.raw !== null))) {
    setStorageStatus(storage, "restore-required");
    return false;
  }
  if (observed && baseline !== previous.raw) {
    setStorageStatus(storage, "conflict");
    return false;
  }
  let serialized;
  try {
    const snapshot = {
      storageVersion: currentStorageVersion,
      revision: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      data,
    };
    assertBoundedJson(snapshot);
    validatePersistentData(data);
    serialized = JSON.stringify(snapshot);
  } catch (error) {
    setStorageStatus(storage, "invalid-data");
    return false;
  }
  // Fence older clients before adopting the snapshot. If the following commit is
  // interrupted, legacy fields remain intact and this version can retry migration.
  if (!ensureVersionFence(storage)) return false;
  try {
    // One setItem is the commit point. Failure leaves the previous snapshot intact.
    storage.setItem(storageKeys.snapshot, serialized);
    sessions.set(storage, serialized);
    setStorageStatus(storage);
    return true;
  } catch (error) {
    setStorageStatus(storage, "write-failed");
    return false;
  }
}

export function restorePersistentState(storage = getDefaultStorage()) {
  if (!storage) return normalizePersistentData({});
  setStorageStatus(storage);
  const snapshot = inspectSnapshot(storage);
  if (snapshot.data) {
    sessions.set(storage, snapshot.raw);
    ensureVersionFence(storage);
    return snapshot.data;
  }
  const legacy = readLegacyState(storage);
  if (snapshot.reason) {
    sessions.set(storage, snapshot.reason === "unavailable" ? unobservedSnapshot : snapshot.raw);
    setStorageStatus(storage, snapshot.reason);
    return legacy;
  }
  if (getPersistentStateStatus(storage).reason === "unavailable") {
    sessions.set(storage, unobservedSnapshot);
    return legacy;
  }
  sessions.set(storage, snapshot.raw);
  commitSnapshot(normalizePersistentData(legacy), storage);
  return legacy;
}

export function savePersistentState(state, storage = getDefaultStorage()) {
  if (!storage) return false;
  try {
    return commitSnapshot(createPersistentStateBackup(state).data, storage);
  } catch (error) {
    setStorageStatus(storage, "invalid-data");
    return false;
  }
}

// Validate and persist a staged restore before replacing any live application state.
// An explicit backup restore may repair corrupt storage, but never a future version.
export function commitRestoredPersistentState(data, storage = getDefaultStorage()) {
  if (!storage) return false;
  try {
    assertBoundedJson(data);
    validatePersistentData(data);
    return commitSnapshot(normalizePersistentData(data), storage, { replaceCorrupt: true });
  } catch (error) {
    setStorageStatus(storage, "invalid-data");
    return false;
  }
}

export function clearGroceryPersistence(storage = getDefaultStorage()) {
  if (!storage) return false;
  const snapshot = inspectSnapshot(storage);
  if (snapshot.reason) {
    if (snapshot.reason === "unavailable") sessions.set(storage, unobservedSnapshot);
    setStorageStatus(storage, snapshot.reason);
    return false;
  }
  const data = snapshot.data || readLegacyState(storage);
  return commitSnapshot({ ...data, selectedRecipeIds: {}, recipeMultipliersById: {}, groceryCheckedByKey: {}, manualGroceryItemsById: {} }, storage);
}
