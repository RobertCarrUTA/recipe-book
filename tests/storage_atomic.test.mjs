import assert from "node:assert/strict";
import * as persistence from "../js/storage.js";
import { test } from "./test_helpers.mjs";
import { saveLegacyV6Selection } from "./fixtures/legacy_v6_storage.mjs";

const { storageKeys, restorePersistentState, savePersistentState, normalizePersistentStateBackup } = persistence;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    failWrites: false,
    failKeys: new Set(),
    writes: [],
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) {
      if (this.failWrites || this.failKeys.has(key)) throw new Error("Quota exceeded");
      this.writes.push(key);
      values.set(key, String(value));
    },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); },
  };
}

function state(id) {
  return { runtime: { selectedRecipeIds: { [id]: true }, favoriteRecipeIds: { [id]: true } }, ui: {} };
}

test("snapshot migration preserves legacy multipliers and its recovery source", () => {
  for (let version = 1; version <= 6; version += 1) {
    const legacy = JSON.stringify({ selectedRecipeIds: { chili: true }, recipeMultipliersById: { chili: 3 } });
    const storage = memoryStorage({ [storageKeys.version]: String(version), [storageKeys.groceryState]: legacy });
    const restored = restorePersistentState(storage);
    assert.deepEqual(restored.recipeMultipliersById, { chili: 3 });
    assert.deepEqual(restored.selectedRecipeIds, { chili: true });
    assert.equal(storage.getItem(storageKeys.groceryState), legacy);
    assert.equal(storage.getItem(storageKeys.version), String(persistence.currentStorageVersion));
    assert.deepEqual(restorePersistentState(storage), restored);
  }
});

test("a failed snapshot commit changes no durable field", () => {
  const storage = memoryStorage();
  assert.equal(savePersistentState(state("before"), storage), true);
  const before = storage.snapshot();
  storage.failWrites = true;
  assert.equal(savePersistentState(state("after"), storage), false);
  assert.deepEqual(storage.snapshot(), before);
  assert.deepEqual(restorePersistentState(storage).selectedRecipeIds, { before: true });
});

test("a snapshot commit makes exactly one atomic storage write", () => {
  const storage = memoryStorage();
  restorePersistentState(storage);
  storage.writes.length = 0;
  assert.equal(savePersistentState(state("chili"), storage), true);
  assert.deepEqual(storage.writes, [storageKeys.snapshot]);
});

test("interrupted migration remains retryable without modifying legacy keys", () => {
  const initial = { [storageKeys.selectedRecipes]: '{"chili":true}', [storageKeys.recipeMultipliers]: '{"chili":2}' };
  const storage = memoryStorage(initial);
  storage.failWrites = true;
  assert.deepEqual(restorePersistentState(storage).recipeMultipliersById, { chili: 2 });
  assert.deepEqual(storage.snapshot(), initial);
  storage.failWrites = false;
  const restored = restorePersistentState(storage);
  assert.deepEqual(restored.recipeMultipliersById, { chili: 2 });
  assert.ok(storage.getItem(storageKeys.snapshot));
  assert.equal(storage.getItem(storageKeys.recipeMultipliers), initial[storageKeys.recipeMultipliers]);
});

test("a stale tab cannot overwrite a newer snapshot", () => {
  const first = memoryStorage();
  const second = { getItem: first.getItem.bind(first), setItem: first.setItem.bind(first), removeItem: first.removeItem.bind(first) };
  restorePersistentState(first);
  restorePersistentState(second);
  assert.equal(savePersistentState(state("newer"), second), true);
  const before = first.snapshot();
  assert.equal(savePersistentState(state("stale"), first), false);
  assert.deepEqual(first.snapshot(), before);
  assert.deepEqual(restorePersistentState(first).selectedRecipeIds, { newer: true });
  assert.equal(savePersistentState(state("refreshed"), first), true);
});

test("future and malformed snapshots are preserved rather than overwritten", () => {
  for (const raw of ['{"storageVersion":999,"data":{}}', '{broken']) {
    const storage = memoryStorage({ [storageKeys.snapshot]: raw });
    restorePersistentState(storage);
    assert.equal(savePersistentState(state("chili"), storage), false);
    assert.equal(storage.getItem(storageKeys.snapshot), raw);
  }
});

test("backup validation rejects malformed recognized structures before replacement", () => {
  for (const data of [undefined, null, [], "bad", { selectedRecipeIds: [] }, { ui: [] }, { mealPlan: { days: { monday: "chili" } } }]) {
    assert.throws(() => normalizePersistentStateBackup({ app: "robert-recipe-book", schemaVersion: 1, data }));
  }
});

test("backup validation rejects dangerous keys and unreasonable input size", () => {
  const hostile = JSON.parse('{"app":"robert-recipe-book","schemaVersion":1,"data":{"manualGroceryItemsById":{"__proto__":{"name":"bad"}}}}');
  assert.throws(() => normalizePersistentStateBackup(hostile));
  assert.throws(() => normalizePersistentStateBackup({ app: "robert-recipe-book", schemaVersion: 1, data: { ui: { recipeSearch: "x".repeat(100000) } } }));
  assert.equal({}.name, undefined);
});

test("valid empty and partial schema-v1 backups remain supported", () => {
  for (const data of [{}, { selectedRecipeIds: { chili: true } }, { ui: { recipeSearch: "soup" } }]) {
    const restored = normalizePersistentStateBackup({ app: "robert-recipe-book", schemaVersion: 1, data });
    assert.deepEqual(restored.selectedRecipeIds, data.selectedRecipeIds || {});
  }
});

test("staged backup commit keeps prior data when storage fails and can retry", () => {
  const storage = memoryStorage();
  savePersistentState(state("before"), storage);
  const before = storage.snapshot();
  const imported = normalizePersistentStateBackup({ app: "robert-recipe-book", schemaVersion: 1, data: { selectedRecipeIds: { after: true } } });
  storage.failWrites = true;
  assert.equal(persistence.commitRestoredPersistentState(imported, storage), false);
  assert.deepEqual(storage.snapshot(), before);
  assert.equal(persistence.getPersistentStateStatus(storage).reason, "write-failed");
  storage.failWrites = false;
  assert.equal(persistence.commitRestoredPersistentState(imported, storage), true);
  assert.deepEqual(restorePersistentState(storage).selectedRecipeIds, { after: true });
});

test("explicit valid backup restore repairs corrupt snapshots but protects future versions", () => {
  for (const [raw, expected] of [['{broken', true], ['{"storageVersion":999,"data":{}}', false]]) {
    const storage = memoryStorage({ [storageKeys.snapshot]: raw });
    restorePersistentState(storage);
    assert.equal(persistence.commitRestoredPersistentState({ selectedRecipeIds: { chili: true } }, storage), expected);
    if (expected) assert.deepEqual(restorePersistentState(storage).selectedRecipeIds, { chili: true });
    else assert.equal(storage.getItem(storageKeys.snapshot), raw);
  }
});

test("snapshot ignores later legacy edits and retains additive UI preferences", () => {
  const storage = memoryStorage({ [storageKeys.selectedRecipes]: '{"legacy":true}' });
  restorePersistentState(storage);
  assert.equal(savePersistentState({ ...state("current"), ui: { theme: "system", density: "comfortable" } }, storage), true);
  storage.setItem(storageKeys.selectedRecipes, '{"old-tab":true}');
  const restored = restorePersistentState(storage);
  assert.deepEqual(restored.selectedRecipeIds, { current: true });
  assert.equal(restored.ui.theme, "system");
  assert.equal(restored.ui.density, "comfortable");
  const backup = persistence.createPersistentStateBackup({ runtime: restored, ui: restored.ui });
  assert.equal(normalizePersistentStateBackup(backup).ui.theme, "system");
});

test("blocked reads cannot cause a default snapshot to overwrite existing data", () => {
  const storage = memoryStorage();
  savePersistentState(state("before"), storage);
  const before = storage.snapshot();
  const originalRead = storage.getItem;
  storage.getItem = () => { throw new Error("Storage blocked"); };
  restorePersistentState(storage);
  assert.equal(savePersistentState(state("after"), storage), false);
  assert.deepEqual(storage.snapshot(), before);
  assert.equal(persistence.getPersistentStateStatus(storage).reason, "unavailable");
  storage.getItem = originalRead;
  assert.equal(savePersistentState(state("retry"), storage), false, "read recovery alone must not authorize a save");
  restorePersistentState(storage);
  assert.equal(savePersistentState(state("retry"), storage), true);
});

test("fresh startup read failure requires restore before saving when reads recover", () => {
  const seeded = memoryStorage();
  savePersistentState(state("saved-before-boot"), seeded);
  const before = seeded.snapshot();
  let blocked = true;
  const freshSession = {
    getItem(key) { if (blocked) throw new Error("Storage unavailable at startup"); return seeded.getItem(key); },
    setItem: seeded.setItem.bind(seeded),
  };
  const fallback = restorePersistentState(freshSession);
  assert.deepEqual(fallback.selectedRecipeIds, {});
  blocked = false;
  assert.equal(savePersistentState({ runtime: fallback, ui: fallback.ui }, freshSession), false);
  assert.deepEqual(seeded.snapshot(), before);
  assert.equal(persistence.getPersistentStateStatus(freshSession).reason, "restore-required");
  assert.deepEqual(restorePersistentState(freshSession).selectedRecipeIds, { "saved-before-boot": true });
  assert.equal(savePersistentState(state("after-explicit-restore"), freshSession), true);
});

test("explicit validated import can recover a fresh unreadable startup", () => {
  const seeded = memoryStorage();
  savePersistentState(state("before"), seeded);
  let blocked = true;
  const freshSession = {
    getItem(key) { if (blocked) throw new Error("blocked"); return seeded.getItem(key); },
    setItem: seeded.setItem.bind(seeded),
  };
  restorePersistentState(freshSession);
  blocked = false;
  assert.equal(persistence.commitRestoredPersistentState({ selectedRecipeIds: { imported: true } }, freshSession), true);
  assert.deepEqual(restorePersistentState(freshSession).selectedRecipeIds, { imported: true });
});

test("blocked default-storage getter cannot authorize a save when it recovers", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = memoryStorage();
  savePersistentState(state("before"), storage);
  const before = storage.snapshot();
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked getter"); } });
    restorePersistentState();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    assert.equal(savePersistentState(state("defaults")), false);
    assert.deepEqual(storage.snapshot(), before);
    assert.deepEqual(restorePersistentState().selectedRecipeIds, { before: true });
    assert.equal(savePersistentState(state("after-restore")), true);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});

test("version fence prevents baseline-v6 tabs from saving after snapshot adoption", () => {
  const storage = memoryStorage({ [storageKeys.version]: "6", [storageKeys.selectedRecipes]: '{"legacy":true}' });
  restorePersistentState(storage);
  assert.equal(storage.getItem(storageKeys.version), "7");
  const before = storage.snapshot();
  assert.equal(saveLegacyV6Selection(storage, "old-tab-edit"), false);
  assert.deepEqual(storage.snapshot(), before);
});

test("interruption after the version fence keeps legacy recovery data and blocks old saves", () => {
  const initial = { [storageKeys.version]: "6", [storageKeys.selectedRecipes]: '{"legacy":true}', [storageKeys.recipeMultipliers]: '{"legacy":3}' };
  const storage = memoryStorage(initial);
  storage.failKeys.add(storageKeys.snapshot);
  assert.deepEqual(restorePersistentState(storage).recipeMultipliersById, { legacy: 3 });
  assert.equal(storage.getItem(storageKeys.version), "7");
  assert.equal(storage.getItem(storageKeys.snapshot), null);
  assert.equal(storage.getItem(storageKeys.selectedRecipes), initial[storageKeys.selectedRecipes]);
  assert.equal(saveLegacyV6Selection(storage, "old-tab-edit"), false);
  storage.failKeys.clear();
  assert.deepEqual(restorePersistentState(storage).recipeMultipliersById, { legacy: 3 });
  assert.ok(storage.getItem(storageKeys.snapshot));
});

test("failure to write the version fence leaves both old data and snapshot untouched", () => {
  const initial = { [storageKeys.version]: "6", [storageKeys.selectedRecipes]: '{"legacy":true}' };
  const storage = memoryStorage(initial);
  storage.failKeys.add(storageKeys.version);
  assert.deepEqual(restorePersistentState(storage).selectedRecipeIds, { legacy: true });
  assert.deepEqual(storage.snapshot(), initial);
  assert.equal(persistence.commitRestoredPersistentState({ selectedRecipeIds: { imported: true } }, storage), false);
  assert.deepEqual(storage.snapshot(), initial);
});

test("backup validation rejects invalid values, future formats and excessive nesting", () => {
  for (const data of [
    { selectedRecipeIds: { chili: "yes" } },
    { recipeMultipliersById: { chili: "bad" } },
    { manualGroceryItemsById: { soap: { name: 3 } } },
    { ui: { hideCheckedGroceryItems: "false" } },
    { ui: { filters: { status: [3] } } },
  ]) assert.throws(() => normalizePersistentStateBackup({ app: "robert-recipe-book", schemaVersion: 1, data }));
  assert.throws(() => normalizePersistentStateBackup({ app: "robert-recipe-book", schemaVersion: 2, data: {} }));
  assert.throws(() => normalizePersistentStateBackup({ app: "robert-recipe-book", schemaVersion: 1, storageVersion: 999, data: {} }));
  const nested = {};
  let child = nested;
  for (let index = 0; index < 20; index += 1) child = child.next = {};
  assert.throws(() => normalizePersistentStateBackup({ app: "robert-recipe-book", schemaVersion: 1, data: { ui: { nested } } }));
});
