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
  assert.equal(restored.ui.mobileView, "recipes");
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
        selectedRecipeIds: { chili: true },
      },
      ui: {
        filters: { status: ["tried"] },
        groupItems: true,
        keepScreenAwake: false,
        mobileView: "grocery",
        recipeSearch: "chili",
        showFavoriteRecipesOnly: false,
        showSelectedRecipesOnly: true,
      },
    },
    storage
  );

  assert.equal(saved, true);
  assert.equal(storage.getItem(storageKeys.version), String(currentStorageVersion));
  assert.deepEqual(JSON.parse(storage.getItem(storageKeys.favoriteRecipes)), { chili: true });
  assert.equal(storage.getItem(storageKeys.mobileView), "grocery");
  assert.equal(storage.getItem(storageKeys.showSelectedRecipesOnly), "1");
});
