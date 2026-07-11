import assert from "node:assert/strict";

import { createAppStatePersistenceController } from "../js/app_state_persistence.js";
import {
  createFakeDocument,
  createFakeEvent,
  createFakeWindow,
} from "./dom_test_helpers.mjs";
import { test } from "./test_helpers.mjs";

function runActiveTimer(window, index) {
  const timer = window.timers[index];
  assert.ok(timer, `expected timer ${index} to exist`);
  assert.equal(timer.cleared, false, `expected timer ${index} to be active`);
  timer.callback();
}

function createIdleWindow() {
  const window = createFakeWindow();
  const idleCallbacks = [];

  window.idleCallbacks = idleCallbacks;
  window.requestIdleCallback = (callback, options = {}) => {
    const idleCallback = {
      callback,
      canceled: false,
      id: idleCallbacks.length + 1,
      options,
    };
    idleCallbacks.push(idleCallback);
    return idleCallback.id;
  };
  window.cancelIdleCallback = (id) => {
    const idleCallback = idleCallbacks.find((item) => item.id === id);
    if (idleCallback) idleCallback.canceled = true;
  };

  return window;
}

test("app state persistence debounces repeated saves", () => {
  const window = createFakeWindow();
  let persistCount = 0;
  const controller = createAppStatePersistenceController({
    document: createFakeDocument(),
    persist: () => {
      persistCount += 1;
    },
    window,
  });

  controller.save();
  controller.save();

  assert.equal(window.timers.length, 2);
  assert.equal(window.timers[0].cleared, true);
  assert.equal(persistCount, 0);

  runActiveTimer(window, 1);
  assert.equal(persistCount, 1);
});

test("app state persistence uses idle callbacks when available", () => {
  const window = createIdleWindow();
  let persistCount = 0;
  const controller = createAppStatePersistenceController({
    document: createFakeDocument(),
    idleTimeoutMs: 25,
    persist: () => {
      persistCount += 1;
    },
    window,
  });

  controller.save();
  runActiveTimer(window, 0);

  assert.equal(persistCount, 0);
  assert.equal(window.idleCallbacks.length, 1);
  assert.deepEqual(window.idleCallbacks[0].options, { timeout: 25 });

  window.idleCallbacks[0].callback();
  assert.equal(persistCount, 1);
});

test("app state persistence flushes pending saves before the page is hidden", () => {
  const document = createFakeDocument();
  const window = createFakeWindow();
  let persistCount = 0;
  const controller = createAppStatePersistenceController({
    document,
    persist: () => {
      persistCount += 1;
    },
    window,
  });

  controller.attachFlushHandlers();
  controller.save();
  window.dispatchEvent(createFakeEvent("pagehide"));

  assert.equal(window.timers[0].cleared, true);
  assert.equal(persistCount, 1);

  controller.save();
  document.visibilityState = "hidden";
  document.dispatchEvent(createFakeEvent("visibilitychange"));

  assert.equal(window.timers[1].cleared, true);
  assert.equal(persistCount, 2);
});

test("app state persistence cancels idle saves before immediate writes", () => {
  const window = createIdleWindow();
  let persistCount = 0;
  const controller = createAppStatePersistenceController({
    document: createFakeDocument(),
    persist: () => {
      persistCount += 1;
    },
    window,
  });

  controller.save();
  runActiveTimer(window, 0);
  controller.save({ immediate: true });

  assert.equal(window.idleCallbacks[0].canceled, true);
  assert.equal(persistCount, 1);
});

test("app state persistence reports immediate and flushed write results", () => {
  const window = createFakeWindow();
  const results = [true, false];
  const controller = createAppStatePersistenceController({
    document: createFakeDocument(),
    persist: () => results.shift(),
    window,
  });

  assert.equal(controller.save({ immediate: true }), true);

  controller.save();
  assert.equal(controller.flush(), false);
  assert.equal(controller.flush(), undefined);
});
