import assert from "node:assert/strict";

import { createOfflineController } from "../js/offline_controller.js";
import {
  createFakeDocument,
  createFakeElement,
  createFakeEvent,
  createFakeEventTarget,
  createFakeWindow,
} from "./dom_test_helpers.mjs";
import { test } from "./test_helpers.mjs";

function createOfflineDom() {
  const elements = {
    offlineStatus: createFakeElement({ hidden: true, id: "offlineStatus" }),
    refreshAppUpdate: createFakeElement({ hidden: false, id: "refreshAppUpdate", tagName: "button" }),
  };

  return {
    document: createFakeDocument({ elements }),
    elements,
  };
}

test("offline controller stays quiet when service workers are unavailable", async () => {
  const { document, elements } = createOfflineDom();
  const window = createFakeWindow();

  await createOfflineController({
    document,
    navigator: {},
    window,
  }).attach();

  assert.equal(elements.offlineStatus.textContent, "");
  assert.equal(elements.offlineStatus.hidden, true);
  assert.equal(elements.refreshAppUpdate.hidden, true);
});

test("offline controller reports offline-ready and connection changes after registration", async () => {
  const { document, elements } = createOfflineDom();
  const registration = createFakeEventTarget({});
  const serviceWorker = createFakeEventTarget({
    controller: {},
    async register(url) {
      serviceWorker.registeredUrl = url;
      return registration;
    },
  });
  const navigator = { onLine: false, serviceWorker };
  const window = createFakeWindow();

  await createOfflineController({ document, navigator, window }).attach();

  assert.equal(serviceWorker.registeredUrl, "./sw.js");
  assert.equal(elements.offlineStatus.textContent, "Offline");
  assert.equal(elements.offlineStatus.dataset.state, "offline");
  assert.equal(elements.refreshAppUpdate.hidden, true);

  navigator.onLine = true;
  window.dispatchEvent(createFakeEvent("online"));
  assert.equal(elements.offlineStatus.textContent, "Offline ready");
  assert.equal(elements.offlineStatus.dataset.state, "ready");
});

test("offline controller exposes waiting updates and reloads only after refresh is requested", async () => {
  const { document, elements } = createOfflineDom();
  const postedMessages = [];
  let reloadCount = 0;
  const waitingWorker = createFakeEventTarget({
    postMessage(message) {
      postedMessages.push(message);
    },
  });
  const registration = createFakeEventTarget({ waiting: waitingWorker });
  const serviceWorker = createFakeEventTarget({
    controller: {},
    async register() {
      return registration;
    },
  });
  const window = createFakeWindow({
    location: {
      protocol: "http:",
      reload() {
        reloadCount += 1;
      },
    },
  });

  await createOfflineController({
    document,
    navigator: { onLine: true, serviceWorker },
    window,
  }).attach();

  assert.equal(elements.offlineStatus.textContent, "Update ready");
  assert.equal(elements.offlineStatus.dataset.state, "update");
  assert.equal(elements.refreshAppUpdate.hidden, false);

  serviceWorker.dispatchEvent(createFakeEvent("controllerchange"));
  assert.equal(reloadCount, 0, "passive controller changes should not reload the app");

  elements.refreshAppUpdate.click();
  assert.equal(elements.refreshAppUpdate.disabled, true);
  assert.deepEqual(postedMessages, [{ type: "SKIP_WAITING" }]);

  serviceWorker.dispatchEvent(createFakeEvent("controllerchange"));
  serviceWorker.dispatchEvent(createFakeEvent("controllerchange"));
  assert.equal(reloadCount, 1, "the requested refresh should reload once");
});

test("offline controller surfaces registration failures without breaking the app", async () => {
  const { document, elements } = createOfflineDom();
  const warnings = [];
  const serviceWorker = createFakeEventTarget({
    controller: null,
    async register() {
      throw new Error("blocked");
    },
  });

  await createOfflineController({
    document,
    logger: { warn: (...args) => warnings.push(args) },
    navigator: { onLine: true, serviceWorker },
    window: createFakeWindow(),
  }).attach();

  assert.equal(warnings.length, 1);
  assert.equal(elements.offlineStatus.textContent, "Offline unavailable");
  assert.equal(elements.offlineStatus.dataset.state, "error");
});
