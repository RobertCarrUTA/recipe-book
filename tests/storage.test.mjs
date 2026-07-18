import assert from "node:assert/strict";

import {
  backupAppId,
  backupSchemaVersion,
  clearGroceryPersistence,
  createPersistentStateBackup,
  currentStorageVersion,
  migratePersistentState,
  normalizeUiState,
  normalizePersistentStateBackup,
  restorePersistentState,
  savePersistentState,
  storageKeys,
} from "../js/storage.js";
import { test } from "./test_helpers.mjs";

function createMemoryStorage(initial = {}, options = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    removeItem(key) {
      if (options.failRemovals?.has(key)) throw new Error(`remove blocked: ${key}`);
      data.delete(key);
    },
    setItem(key, value) {
      if (options.failWrites?.has(key)) throw new Error(`write blocked: ${key}`);
      data.set(key, String(value));
    },
    snapshot: () => Object.fromEntries(data),
  };
}

test("restorePersistentState returns safe defaults when storage is unavailable", () => {
  const restored = restorePersistentState(null);
  assert.deepEqual(restored.selectedRecipeIds, {});
  assert.deepEqual(restored.groceryCheckedByKey, {});
  assert.deepEqual(restored.manualGroceryItemsById, {});
  assert.deepEqual(restored.mealPlan.days.monday, []);
  assert.deepEqual(restored.recipeMultipliersById, {});
  assert.deepEqual(restored.ui.collapsedGroceryGroups, {});
  assert.equal(restored.ui.hideCheckedGroceryItems, false);
  assert.equal(restored.ui.groceryControlsCollapsed, false);
  assert.equal(restored.ui.grocerySearchSuffix, "");
  assert.equal(restored.ui.mobileView, "recipes");
  assert.equal(restored.ui.recipeControlsCollapsed, false);
  assert.equal(restored.ui.recipeSort, "default");
  assert.equal(restored.ui.skipClearGroceryConfirmation, false);
});

test("restorePersistentState survives blocked localStorage access", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });

    assert.deepEqual(restorePersistentState().selectedRecipeIds, {});
    assert.equal(savePersistentState({ runtime: {}, ui: {} }), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});

test("restorePersistentState reads safe recipe multipliers", () => {
  const storage = createMemoryStorage({
    [storageKeys.recipeMultipliers]: JSON.stringify({ chili: 2, soup: "bad", stew: 0.5 }),
  });

  const restored = restorePersistentState(storage);

  assert.deepEqual(restored.recipeMultipliersById, { chili: 2, stew: 0.5 });
});

test("restorePersistentState normalizes persisted UI filters", () => {
  const storage = createMemoryStorage({
    [storageKeys.filters]: JSON.stringify({
      difficulty: ["easy", "", "easy"],
      empty: [],
      rating: "great",
      status: ["tried", "not-tried"],
    }),
    [storageKeys.mobileView]: "menu",
    [storageKeys.recipeSort]: "old-sort",
  });

  const restored = restorePersistentState(storage);

  assert.deepEqual(restored.ui.filters, {
    difficulty: ["easy"],
    status: ["tried", "not-tried"],
  });
  assert.equal(restored.ui.mobileView, "recipes");
  assert.equal(restored.ui.recipeSort, "default");
});

test("restorePersistentState reads persisted UI preferences", () => {
  const storage = createMemoryStorage({
    [storageKeys.collapsedGroceryGroups]: JSON.stringify({ Produce: true, Dairy: false }),
    [storageKeys.groceryControlsCollapsed]: "1",
    [storageKeys.grocerySearchSuffix]: " Central Market ",
    [storageKeys.groupToggle]: "1",
    [storageKeys.hideCheckedGroceryItems]: "1",
    [storageKeys.keepScreenAwake]: "1",
    [storageKeys.mobileView]: "grocery",
    [storageKeys.recipeControlsCollapsed]: "1",
    [storageKeys.recipeSearch]: "beans",
    [storageKeys.recipeSort]: "selected-first",
    [storageKeys.showFavoriteRecipesOnly]: "1",
    [storageKeys.showSelectedRecipesOnly]: "1",
    [storageKeys.skipClearGroceryConfirmation]: "1",
  });

  const restored = restorePersistentState(storage);

  assert.deepEqual(restored.ui.collapsedGroceryGroups, { Produce: true });
  assert.equal(restored.ui.groceryControlsCollapsed, true);
  assert.equal(restored.ui.grocerySearchSuffix, " Central Market ");
  assert.equal(restored.ui.groupItems, true);
  assert.equal(restored.ui.hideCheckedGroceryItems, true);
  assert.equal(restored.ui.keepScreenAwake, true);
  assert.equal(restored.ui.mobileView, "grocery");
  assert.equal(restored.ui.recipeControlsCollapsed, true);
  assert.equal(restored.ui.recipeSearch, "beans");
  assert.equal(restored.ui.recipeSort, "selected-first");
  assert.equal(restored.ui.showFavoriteRecipesOnly, true);
  assert.equal(restored.ui.showSelectedRecipesOnly, true);
  assert.equal(restored.ui.skipClearGroceryConfirmation, true);
});

test("normalizeUiState returns safe defaults for partial restored UI state", () => {
  const ui = normalizeUiState({
    collapsedGroceryGroups: { Produce: true, Dairy: false },
    filters: { difficulty: ["easy", "", "easy"], rating: "great" },
    mobileView: "bad",
    grocerySearchSuffix: " Walmart ",
    recipeSearch: " pasta ",
    recipeSort: "old-sort",
    showSelectedRecipesOnly: 1,
  });

  assert.deepEqual(ui.collapsedGroceryGroups, { Produce: true });
  assert.deepEqual(ui.filters, { difficulty: ["easy"] });
  assert.equal(ui.mobileView, "recipes");
  assert.equal(ui.grocerySearchSuffix, "Walmart");
  assert.equal(ui.recipeSearch, "pasta");
  assert.equal(ui.recipeSort, "default");
  assert.equal(ui.showSelectedRecipesOnly, true);
  assert.equal(ui.hideCheckedGroceryItems, false);
});

test("migratePersistentState promotes legacy selected recipes", () => {
  const storage = createMemoryStorage({
    [storageKeys.groceryState]: JSON.stringify({ selectedRecipeIds: { chili: true } }),
  });

  const result = migratePersistentState(storage);
  assert.equal(result.migrated, true);
  assert.equal(storage.getItem(storageKeys.version), String(currentStorageVersion));
  assert.deepEqual(JSON.parse(storage.getItem(storageKeys.selectedRecipes)), { chili: true });
  assert.equal(storage.getItem(storageKeys.groceryState), null);
});

test("migration preserves legacy selections when promotion cannot be written", () => {
  const legacyState = JSON.stringify({ selectedRecipeIds: { chili: true } });
  const storage = createMemoryStorage(
    { [storageKeys.groceryState]: legacyState },
    { failWrites: new Set([storageKeys.selectedRecipes]) }
  );

  const result = migratePersistentState(storage);

  assert.equal(result.failed, true);
  assert.equal(result.migrated, false);
  assert.equal(storage.getItem(storageKeys.version), null);
  assert.equal(storage.getItem(storageKeys.groceryState), legacyState);
  assert.deepEqual(restorePersistentState(storage).selectedRecipeIds, { chili: true });
});

test("migration remains retryable when the version write fails", () => {
  const legacyState = JSON.stringify({ selectedRecipeIds: { chili: true } });
  const storage = createMemoryStorage(
    { [storageKeys.groceryState]: legacyState },
    { failWrites: new Set([storageKeys.version]) }
  );

  const result = migratePersistentState(storage);

  assert.equal(result.failed, true);
  assert.equal(result.migrated, false);
  assert.deepEqual(JSON.parse(storage.getItem(storageKeys.selectedRecipes)), { chili: true });
  assert.equal(storage.getItem(storageKeys.groceryState), legacyState);
  assert.equal(storage.getItem(storageKeys.version), null);
});

test("newer storage versions are preserved for a newer app", () => {
  const storage = createMemoryStorage({
    [storageKeys.groceryState]: JSON.stringify({ selectedRecipeIds: { chili: true } }),
    [storageKeys.selectedRecipes]: JSON.stringify({ chili: true }),
    [storageKeys.version]: String(currentStorageVersion + 1),
  });

  const result = migratePersistentState(storage);

  assert.equal(result.incompatible, true);
  assert.equal(result.migrated, false);
  assert.equal(storage.getItem(storageKeys.version), String(currentStorageVersion + 1));
  assert.equal(savePersistentState({ runtime: {}, ui: {} }, storage), false);
  clearGroceryPersistence(storage);
  assert.deepEqual(JSON.parse(storage.getItem(storageKeys.selectedRecipes)), { chili: true });
  assert.notEqual(storage.getItem(storageKeys.groceryState), null);
});

test("savePersistentState writes versioned runtime and ui state", () => {
  const storage = createMemoryStorage();
  const saved = savePersistentState(
    {
      runtime: {
        favoriteRecipeIds: { chili: true },
        grocery: { totalsByKey: {}, notesByKey: {}, sourcesByKey: {} },
        groceryCheckedByKey: { beans: true },
        manualGroceryItemsById: { "manual-1": { id: "manual-1", name: "Paper towels" } },
        recipeMultipliersById: { chili: 2 },
        selectedRecipeIds: { chili: true },
      },
      mealPlan: { days: { monday: ["chili"] } },
      ui: {
        collapsedGroceryGroups: { Produce: true },
        filters: { status: ["tried"] },
        groceryControlsCollapsed: true,
        grocerySearchSuffix: "Central Market",
        groupItems: true,
        hideCheckedGroceryItems: true,
        keepScreenAwake: false,
        mobileView: "grocery",
        recipeControlsCollapsed: true,
        recipeSearch: "chili",
        recipeSort: "fastest",
        showFavoriteRecipesOnly: false,
        showSelectedRecipesOnly: true,
        skipClearGroceryConfirmation: true,
      },
    },
    storage
  );

  assert.equal(saved, true);
  assert.equal(storage.getItem(storageKeys.version), String(currentStorageVersion));
  assert.deepEqual(JSON.parse(storage.getItem(storageKeys.favoriteRecipes)), { chili: true });
  assert.deepEqual(JSON.parse(storage.getItem(storageKeys.manualGroceryItems)), {
    "manual-1": { id: "manual-1", name: "Paper towels" },
  });
  assert.deepEqual(JSON.parse(storage.getItem(storageKeys.mealPlan)).days.monday, ["chili"]);
  assert.deepEqual(JSON.parse(storage.getItem(storageKeys.recipeMultipliers)), { chili: 2 });
  assert.deepEqual(JSON.parse(storage.getItem(storageKeys.collapsedGroceryGroups)), { Produce: true });
  assert.equal(storage.getItem(storageKeys.groceryControlsCollapsed), "1");
  assert.equal(storage.getItem(storageKeys.grocerySearchSuffix), "Central Market");
  assert.equal(storage.getItem(storageKeys.hideCheckedGroceryItems), "1");
  assert.equal(storage.getItem(storageKeys.mobileView), "grocery");
  assert.equal(storage.getItem(storageKeys.recipeControlsCollapsed), "1");
  assert.equal(storage.getItem(storageKeys.recipeSort), "fastest");
  assert.equal(storage.getItem(storageKeys.showSelectedRecipesOnly), "1");
  assert.equal(storage.getItem(storageKeys.skipClearGroceryConfirmation), "1");
  assert.equal(storage.getItem(storageKeys.groceryState), null, "derived grocery totals should not be persisted");
});

test("clearGroceryPersistence removes list state without clearing preferences", () => {
  const storage = createMemoryStorage({
    [storageKeys.favoriteRecipes]: JSON.stringify({ chili: true }),
    [storageKeys.groceryChecked]: JSON.stringify({ beans: true }),
    [storageKeys.groceryControlsCollapsed]: "1",
    [storageKeys.groceryState]: JSON.stringify({ selectedRecipeIds: { chili: true } }),
    [storageKeys.groupToggle]: "1",
    [storageKeys.manualGroceryItems]: JSON.stringify({ manual1: { id: "manual1", name: "Dish soap" } }),
    [storageKeys.recipeMultipliers]: JSON.stringify({ chili: 2 }),
    [storageKeys.selectedRecipes]: JSON.stringify({ chili: true }),
  });

  clearGroceryPersistence(storage);

  assert.equal(storage.getItem(storageKeys.groceryState), null);
  assert.equal(storage.getItem(storageKeys.groceryChecked), null);
  assert.equal(storage.getItem(storageKeys.manualGroceryItems), null);
  assert.equal(storage.getItem(storageKeys.recipeMultipliers), null);
  assert.equal(storage.getItem(storageKeys.selectedRecipes), null);
  assert.deepEqual(JSON.parse(storage.getItem(storageKeys.favoriteRecipes)), { chili: true });
  assert.equal(storage.getItem(storageKeys.groupToggle), "1");
  assert.equal(storage.getItem(storageKeys.groceryControlsCollapsed), "1");
});

test("createPersistentStateBackup exports portable runtime and ui state", () => {
  const backup = createPersistentStateBackup(
    {
      runtime: {
        favoriteRecipeIds: { chili: true, soup: false },
        groceryCheckedByKey: { beans: true },
        manualGroceryItemsById: {
          manual1: { id: "manual1", name: " Paper towels ", note: " 2 rolls " },
          ignored: { id: "ignored", name: " " },
        },
        recipeMultipliersById: { chili: 2, soup: 1 },
        selectedRecipeIds: { chili: true },
      },
      mealPlan: { days: { monday: ["chili", "soup"], tuesday: ["soup"] } },
      ui: {
        collapsedGroceryGroups: { Produce: true, Dairy: false },
        filters: { status: ["tried", "tried", ""], empty: [] },
        grocerySearchSuffix: " Walmart ",
        groupItems: true,
        mobileView: "grocery",
        recipeSort: "highest-rated",
        recipeSearch: " chili ",
        showSelectedRecipesOnly: true,
      },
    },
    { exportedAt: "2026-06-26T12:00:00.000Z" }
  );

  assert.equal(backup.app, backupAppId);
  assert.equal(backup.schemaVersion, backupSchemaVersion);
  assert.equal(backup.storageVersion, currentStorageVersion);
  assert.equal(backup.exportedAt, "2026-06-26T12:00:00.000Z");
  assert.deepEqual(backup.data.favoriteRecipeIds, { chili: true });
  assert.deepEqual(backup.data.manualGroceryItemsById, {
    manual1: { id: "manual1", name: "Paper towels", note: "2 rolls" },
  });
  assert.deepEqual(backup.data.mealPlan.days.monday, ["chili", "soup"]);
  assert.deepEqual(backup.data.mealPlan.days.tuesday, ["soup"]);
  assert.deepEqual(backup.data.recipeMultipliersById, { chili: 2 });
  assert.deepEqual(backup.data.ui.collapsedGroceryGroups, { Produce: true });
  assert.deepEqual(backup.data.ui.filters, { status: ["tried"] });
  assert.equal(backup.data.ui.grocerySearchSuffix, "Walmart");
  assert.equal(backup.data.ui.mobileView, "grocery");
  assert.equal(backup.data.ui.recipeSort, "highest-rated");
});

test("normalizePersistentStateBackup rejects incompatible files", () => {
  assert.throws(() => normalizePersistentStateBackup(null), /not a recipe book backup/);
  assert.throws(
    () => normalizePersistentStateBackup({ app: "other", schemaVersion: backupSchemaVersion }),
    /not compatible/
  );
});

test("normalizePersistentStateBackup returns safe restored state", () => {
  const restored = normalizePersistentStateBackup({
    app: backupAppId,
    schemaVersion: backupSchemaVersion,
    data: {
      favoriteRecipeIds: { chili: true, soup: 0 },
      groceryCheckedByKey: { beans: true },
      manualGroceryItemsById: {
        manual1: { id: "manual1", name: "Dish soap" },
        staleKey: { id: "canonical-id", name: "Paper towels" },
      },
      mealPlan: { days: { monday: ["chili", "chili", ""], friday: ["soup"] } },
      recipeMultipliersById: { chili: 3, soup: "bad" },
      selectedRecipeIds: { chili: true },
      ui: {
        filters: { difficulty: ["easy", ""] },
        hideCheckedGroceryItems: true,
        grocerySearchSuffix: "Central Market",
        mobileView: "bad",
        recipeSort: "selected-first",
        recipeSearch: "beans",
      },
    },
  });

  assert.deepEqual(restored.favoriteRecipeIds, { chili: true });
  assert.deepEqual(restored.groceryCheckedByKey, { beans: true });
  assert.deepEqual(restored.manualGroceryItemsById, {
    "canonical-id": { id: "canonical-id", name: "Paper towels" },
    manual1: { id: "manual1", name: "Dish soap" },
  });
  assert.deepEqual(restored.mealPlan.days.monday, ["chili"]);
  assert.deepEqual(restored.mealPlan.days.friday, ["soup"]);
  assert.deepEqual(restored.recipeMultipliersById, { chili: 3 });
  assert.deepEqual(restored.selectedRecipeIds, { chili: true });
  assert.deepEqual(restored.ui.filters, { difficulty: ["easy"] });
  assert.equal(restored.ui.grocerySearchSuffix, "Central Market");
  assert.equal(restored.ui.hideCheckedGroceryItems, true);
  assert.equal(restored.ui.mobileView, "recipes");
  assert.equal(restored.ui.recipeSort, "selected-first");
  assert.equal(restored.ui.recipeSearch, "beans");
});
