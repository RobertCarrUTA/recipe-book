import assert from "node:assert/strict";

import { createWakeLockController } from "../js/wake_lock_controller.js";
import {
  createFakeDocument,
  createFakeElement,
  createFakeEvent,
  createFakeEventTarget,
  createFakeWindow,
} from "./dom_test_helpers.mjs";
import { test } from "./test_helpers.mjs";

function createWakeLockDom({ checked = false, visibilityState = "visible" } = {}) {
  const toggles = [
    createFakeElement({ checked, id: "keepScreenAwake", tagName: "input" }),
    createFakeElement({ checked, id: "cookingKeepScreenAwake", tagName: "input" }),
  ];
  const document = createFakeDocument({
    queryResults: {
      "#keepScreenAwake, #cookingKeepScreenAwake": toggles,
    },
    visibilityState,
  });

  return { document, toggles };
}

test("wake lock controller disables keep-awake toggles when unsupported", () => {
  const { document, toggles } = createWakeLockDom({ checked: true });
  const ui = { keepScreenAwake: true };
  let saveCount = 0;

  createWakeLockController({
    document,
    getUiState: () => ui,
    logger: { warn() {} },
    navigator: {},
    saveState: () => {
      saveCount += 1;
    },
    window: createFakeWindow(),
  }).attach();

  assert.deepEqual(toggles.map((toggle) => toggle.checked), [false, false]);
  assert.deepEqual(toggles.map((toggle) => toggle.disabled), [true, true]);
  assert.equal(toggles[0].title, "Screen wake lock is not supported in this browser.");
  assert.equal(ui.keepScreenAwake, false);
  assert.equal(saveCount, 1);
});

test("wake lock controller requests, releases, and re-requests screen wake locks", async () => {
  const { document, toggles } = createWakeLockDom({ checked: true });
  const ui = { keepScreenAwake: true };
  const releasedLocks = [];
  const requestedTypes = [];
  const locks = [];
  const window = createFakeWindow();
  const navigator = {
    wakeLock: {
      async request(type) {
        requestedTypes.push(type);
        const lock = createFakeEventTarget({
          async release() {
            releasedLocks.push(lock);
          },
        });
        locks.push(lock);
        return lock;
      },
    },
  };
  let saveCount = 0;

  createWakeLockController({
    document,
    getUiState: () => ui,
    logger: { debug() {}, warn() {} },
    navigator,
    saveState: () => {
      saveCount += 1;
    },
    window,
  }).attach();
  await Promise.resolve();

  assert.deepEqual(requestedTypes, ["screen"]);
  assert.equal(ui.keepScreenAwake, true);

  locks[0].dispatchEvent(createFakeEvent("release"));
  assert.equal(window.timers.length, 1, "release while wanted should schedule a retry");
  window.timers[0].callback();
  await Promise.resolve();
  assert.deepEqual(requestedTypes, ["screen", "screen"]);

  toggles[0].checked = false;
  toggles[0].dispatchEvent(createFakeEvent("change", { target: toggles[0] }));
  await Promise.resolve();

  assert.deepEqual(toggles.map((toggle) => toggle.checked), [false, false]);
  assert.equal(ui.keepScreenAwake, false);
  assert.equal(saveCount, 1);
  assert.deepEqual(releasedLocks, [locks[1]]);
});
