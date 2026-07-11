import assert from "node:assert/strict";

import { createBackupController } from "../js/backup_controller.js";
import { backupAppId, backupSchemaVersion } from "../js/storage.js";
import {
  createFakeDocument,
  createFakeElement,
  createFakeEvent,
  createFakeWindow,
} from "./dom_test_helpers.mjs";
import { test } from "./test_helpers.mjs";

function createBackupDom() {
  const elements = {
    exportStateBackup: createFakeElement({ id: "exportStateBackup", tagName: "button" }),
    importStateBackup: createFakeElement({ id: "importStateBackup", tagName: "button" }),
    stateBackupInput: createFakeElement({ id: "stateBackupInput", tagName: "input" }),
    stateBackupStatus: createFakeElement({ hidden: true, id: "stateBackupStatus" }),
  };

  return {
    document: createFakeDocument({ elements }),
    elements,
    window: createFakeWindow(),
  };
}

function createCompatibleBackup(data = {}) {
  return {
    app: backupAppId,
    schemaVersion: backupSchemaVersion,
    data,
  };
}

test("backup controller exports a dated JSON backup and reports success", async () => {
  const { document, elements, window } = createBackupDom();
  const objectUrls = [];
  const revokedUrls = [];
  const urlApi = {
    createObjectURL(blob) {
      objectUrls.push({ blob, url: `blob:backup-${objectUrls.length + 1}` });
      return objectUrls[objectUrls.length - 1].url;
    },
    revokeObjectURL(url) {
      revokedUrls.push(url);
    },
  };
  const controller = createBackupController({
    document,
    getState: () => ({
      runtime: {
        selectedRecipeIds: { chili: true },
      },
      ui: {
        recipeSearch: "chili",
      },
    }),
    urlApi,
    window,
  });

  controller.exportBackup();

  const link = document.createdElements.find((element) => element.tagName === "A");
  assert.ok(link, "export should create a temporary download link");
  assert.equal(link.href, "blob:backup-1");
  assert.match(link.download, /^recipe-book-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(link.removed, true);
  assert.equal(elements.stateBackupStatus.textContent, "Backup exported.");
  assert.equal(elements.stateBackupStatus.hidden, false);

  const exported = JSON.parse(await objectUrls[0].blob.text());
  assert.equal(exported.app, backupAppId);
  assert.deepEqual(exported.data.selectedRecipeIds, { chili: true });
  assert.equal(exported.data.ui.recipeSearch, "chili");

  const revokeTimer = window.timers.find((timer) => timer.delay === 0);
  assert.ok(revokeTimer, "object URL revocation should be scheduled");
  revokeTimer.callback();
  assert.deepEqual(revokedUrls, ["blob:backup-1"]);
});

test("backup controller imports valid backups through the file input", async () => {
  const { document, elements, window } = createBackupDom();
  const restoredStates = [];
  const controller = createBackupController({
    document,
    getState: () => ({}),
    onRestore(state) {
      restoredStates.push(state);
      return { applied: true, persisted: true };
    },
    window,
  });
  const backupFile = {
    async text() {
      return JSON.stringify(createCompatibleBackup({
        favoriteRecipeIds: { chili: true },
        ui: { mobileView: "grocery", recipeSort: "fastest" },
      }));
    },
  };

  controller.attach();
  elements.stateBackupInput.files = [backupFile];
  elements.stateBackupInput.value = "recipe-book-backup.json";
  elements.importStateBackup.click();
  elements.stateBackupInput.dispatchEvent(createFakeEvent("change", { target: elements.stateBackupInput }));
  await Promise.resolve();

  assert.equal(elements.stateBackupInput.value, "");
  assert.equal(restoredStates.length, 1);
  assert.deepEqual(restoredStates[0].favoriteRecipeIds, { chili: true });
  assert.equal(restoredStates[0].ui.mobileView, "grocery");
  assert.equal(restoredStates[0].ui.recipeSort, "fastest");
  assert.equal(elements.stateBackupStatus.textContent, "Backup restored.");
  assert.equal(elements.stateBackupStatus.hidden, false);
});

test("backup controller keeps import unavailable until the recipe catalog is ready", async () => {
  const { document, elements, window } = createBackupDom();
  let restoreCount = 0;
  const controller = createBackupController({
    document,
    getState: () => ({}),
    importAvailable: false,
    onRestore: () => {
      restoreCount += 1;
      return { applied: true, persisted: true };
    },
    window,
  });
  const backupFile = {
    text: async () => JSON.stringify(createCompatibleBackup()),
  };

  controller.attach();

  assert.equal(elements.importStateBackup.disabled, true);
  assert.equal(elements.stateBackupInput.disabled, true);
  assert.match(elements.importStateBackup.title, /until recipes finish loading/i);
  assert.equal(await controller.importBackup(backupFile), false);
  assert.equal(restoreCount, 0);
  assert.match(elements.stateBackupStatus.textContent, /until recipes finish loading/i);

  controller.setImportAvailable(true);
  assert.equal(elements.importStateBackup.disabled, false);
  assert.equal(elements.stateBackupInput.disabled, false);
  assert.equal(elements.importStateBackup.title, "");
  assert.equal(await controller.importBackup(backupFile), true);
  assert.equal(restoreCount, 1);
});

test("backup controller reports an in-memory restore that could not be persisted", async () => {
  const { document, elements, window } = createBackupDom();
  const controller = createBackupController({
    document,
    getState: () => ({}),
    onRestore: async () => ({ applied: true, persisted: false }),
    window,
  });

  const imported = await controller.importBackup({
    text: async () => JSON.stringify(createCompatibleBackup({ selectedRecipeIds: { chili: true } })),
  });

  assert.equal(imported, false);
  assert.match(elements.stateBackupStatus.textContent, /applied for this session/i);
  assert.equal(elements.stateBackupStatus.classList.contains("is-error"), true);
  assert.equal(window.timers.length, 0, "durability warnings should remain visible");
});

test("backup controller reports export failures without leaking an unhandled error", () => {
  const { document, elements, window } = createBackupDom();
  const warnings = [];
  const controller = createBackupController({
    document,
    getState: () => ({}),
    logger: { warn: (...args) => warnings.push(args) },
    urlApi: {
      createObjectURL() {
        throw new Error("downloads blocked");
      },
      revokeObjectURL() {},
    },
    window,
  });

  assert.equal(controller.exportBackup(), false);
  assert.equal(warnings.length, 1);
  assert.equal(elements.stateBackupStatus.textContent, "Backup could not be exported.");
  assert.equal(elements.stateBackupStatus.classList.contains("is-error"), true);
});

test("backup controller keeps invalid imports non-fatal and sticky", async () => {
  const { document, elements, window } = createBackupDom();
  const warnings = [];
  const restoredStates = [];
  const controller = createBackupController({
    document,
    getState: () => ({}),
    logger: { warn: (...args) => warnings.push(args) },
    onRestore: (state) => restoredStates.push(state),
    window,
  });

  await controller.importBackup({
    async text() {
      return "{not-json";
    },
  });

  assert.deepEqual(restoredStates, []);
  assert.equal(warnings.length, 1);
  assert.equal(elements.stateBackupStatus.textContent, "Backup could not be restored.");
  assert.equal(elements.stateBackupStatus.hidden, false);
  assert.equal(elements.stateBackupStatus.classList.contains("is-error"), true);
  assert.equal(window.timers.length, 0, "sticky error status should not schedule auto-clear");
});
