import assert from "node:assert/strict";

import {
  backupAppId,
  backupSchemaVersion,
  createPersistentStateBackup,
  currentStorageVersion,
  migratePersistentState,
  normalizePersistentStateBackup,
  restorePersistentState,
  savePersistentState,
  storageKeys,
} from "../js/storage.js";
import { test } from "./test_helpers.mjs";

function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    removeItem: (key) => data.delete(key),
    setItem: (key, value) => data.set(key, String(value)),
    snapshot: () => Object.fromEntries(data),
  };
}

test("restorePersistentState returns safe defaults when storage is unavailable", () => {
  const restored = restorePersistentState(null);
  assert.deepEqual(restored.selectedRecipeIds, {});
  assert.deepEqual(restored.groceryCheckedByKey, {});
  assert.deepEqual(restored.manualGroceryItemsById, {});
  assert.deepEqual(restored.recipeMultipliersById, {});
  assert.deepEqual(restored.ui.collapsedGroceryGroups, {});
  assert.equal(restored.ui.hideCheckedGroceryItems, false);
  assert.equal(restored.ui.groceryControlsCollapsed, false);
  assert.equal(restored.ui.mobileView, "recipes");
  assert.equal(restored.ui.recipeControlsCollapsed, false);
  assert.equal(restored.ui.skipClearGroceryConfirmation, false);
});

test("restorePersistentState reads safe recipe multipliers", () => {
  const storage = createMemoryStorage({
    [storageKeys.recipeMultipliers]: JSON.stringify({ chili: 2, soup: "bad", stew: 0.5 }),
  });

  const restored = restorePersistentState(storage);

  assert.deepEqual(restored.recipeMultipliersById, { chili: 2, stew: 0.5 });
});

test("migratePersistentState promotes legacy selected recipes", () => {
  const storage = createMemoryStorage({
    [storageKeys.groceryState]: JSON.stringify({ selectedRecipeIds: { chili: true } }),
  });

  const result = migratePersistentState(storage);
  assert.equal(result.migrated, true);
  assert.equal(storage.getItem(storageKeys.version), String(currentStorageVersion));
  assert.deepEqual(JSON.parse(storage.getItem(storageKeys.selectedRecipes)), { chili: true });
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
      ui: {
        collapsedGroceryGroups: { Produce: true },
        filters: { status: ["tried"] },
        groceryControlsCollapsed: true,
        groupItems: true,
        hideCheckedGroceryItems: true,
        keepScreenAwake: false,
        mobileView: "grocery",
        recipeControlsCollapsed: true,
        recipeSearch: "chili",
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
  assert.deepEqual(JSON.parse(storage.getItem(storageKeys.recipeMultipliers)), { chili: 2 });
  assert.deepEqual(JSON.parse(storage.getItem(storageKeys.collapsedGroceryGroups)), { Produce: true });
  assert.equal(storage.getItem(storageKeys.groceryControlsCollapsed), "1");
  assert.equal(storage.getItem(storageKeys.hideCheckedGroceryItems), "1");
  assert.equal(storage.getItem(storageKeys.mobileView), "grocery");
  assert.equal(storage.getItem(storageKeys.recipeControlsCollapsed), "1");
  assert.equal(storage.getItem(storageKeys.showSelectedRecipesOnly), "1");
  assert.equal(storage.getItem(storageKeys.skipClearGroceryConfirmation), "1");
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
      ui: {
        collapsedGroceryGroups: { Produce: true, Dairy: false },
        filters: { status: ["tried", "tried", ""], empty: [] },
        groupItems: true,
        mobileView: "grocery",
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
  assert.deepEqual(backup.data.recipeMultipliersById, { chili: 2 });
  assert.deepEqual(backup.data.ui.collapsedGroceryGroups, { Produce: true });
  assert.deepEqual(backup.data.ui.filters, { status: ["tried"] });
  assert.equal(backup.data.ui.mobileView, "grocery");
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
      manualGroceryItemsById: { manual1: { id: "manual1", name: "Dish soap" } },
      recipeMultipliersById: { chili: 3, soup: "bad" },
      selectedRecipeIds: { chili: true },
      ui: {
        filters: { difficulty: ["easy", ""] },
        hideCheckedGroceryItems: true,
        mobileView: "bad",
        recipeSearch: "beans",
      },
    },
  });

  assert.deepEqual(restored.favoriteRecipeIds, { chili: true });
  assert.deepEqual(restored.groceryCheckedByKey, { beans: true });
  assert.deepEqual(restored.manualGroceryItemsById, { manual1: { id: "manual1", name: "Dish soap" } });
  assert.deepEqual(restored.recipeMultipliersById, { chili: 3 });
  assert.deepEqual(restored.selectedRecipeIds, { chili: true });
  assert.deepEqual(restored.ui.filters, { difficulty: ["easy"] });
  assert.equal(restored.ui.hideCheckedGroceryItems, true);
  assert.equal(restored.ui.mobileView, "recipes");
  assert.equal(restored.ui.recipeSearch, "beans");
});
