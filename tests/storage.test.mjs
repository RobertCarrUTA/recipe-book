import assert from "node:assert/strict";

import {
  currentStorageVersion,
  migratePersistentState,
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
