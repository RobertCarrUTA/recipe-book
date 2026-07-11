import assert from "node:assert/strict";

import { writeTextToClipboard } from "../js/clipboard.js";
import {
  isMediaQueryActive,
  listenToMediaQueryChanges,
  syncCollapsibleControlsPanel,
} from "../js/collapsible_controls.js";
import { createStatusMessageController } from "../js/status_message_controller.js";
import { createFakeDocument, createFakeElement, createFakeWindow } from "./dom_test_helpers.mjs";
import { test } from "./test_helpers.mjs";

test("writeTextToClipboard uses the Clipboard API when available", async () => {
  let copiedText = "";
  const navigator = {
    clipboard: {
      writeText: async (text) => {
        copiedText = text;
      },
    },
  };

  const copied = await writeTextToClipboard("eggs\nmilk", { navigator });

  assert.equal(copied, true);
  assert.equal(copiedText, "eggs\nmilk");
});

test("writeTextToClipboard falls back to a temporary textarea", async () => {
  const document = createFakeDocument();
  const logger = { warnings: [], warn(...args) { this.warnings.push(args); } };
  const navigator = {
    clipboard: {
      writeText: async () => {
        throw new Error("clipboard denied");
      },
    },
  };
  let selected = false;
  let execCommandName = "";
  const createElement = document.createElement;

  document.createElement = (tagName) => {
    const element = createElement(tagName);
    element.select = () => {
      selected = true;
    };
    return element;
  };
  document.execCommand = (command) => {
    execCommandName = command;
    return true;
  };

  const copied = await writeTextToClipboard("flour", { document, logger, navigator });

  assert.equal(copied, true);
  assert.equal(selected, true);
  assert.equal(execCommandName, "copy");
  assert.equal(logger.warnings.length, 1);
  assert.equal(document.createdElements[0].value, "flour");
  assert.equal(document.createdElements[0].removed, true);
});

test("writeTextToClipboard removes its fallback control when copying throws", async () => {
  const document = createFakeDocument();
  const createElement = document.createElement;
  document.createElement = (tagName) => {
    const element = createElement(tagName);
    element.select = () => {};
    return element;
  };
  document.execCommand = () => {
    throw new Error("copy blocked");
  };

  await assert.rejects(
    writeTextToClipboard("flour", { document, navigator: {} }),
    /copy blocked/
  );
  assert.equal(document.createdElements[0].removed, true);
});

test("syncCollapsibleControlsPanel syncs visibility, container class, and toggle labels", () => {
  const container = createFakeElement({ tagName: "section" });
  const panel = createFakeElement({ id: "recipeControlsPanel" });
  const toggle = createFakeElement({ id: "toggleRecipeControls", tagName: "button" });
  panel.closest = (selector) => (selector === ".recipe-search" ? container : null);
  const document = createFakeDocument({
    elements: {
      recipeControlsPanel: panel,
      toggleRecipeControls: toggle,
    },
  });

  syncCollapsibleControlsPanel(document, {
    collapsed: true,
    collapsedClass: "is-compact",
    collapsedLabel: "Show recipe controls",
    containerSelector: ".recipe-search",
    expandedLabel: "Hide recipe controls",
    panelId: "recipeControlsPanel",
    toggleId: "toggleRecipeControls",
  });

  assert.equal(panel.hidden, true);
  assert.equal(container.classList.contains("is-compact"), true);
  assert.equal(toggle.textContent, "Show");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(toggle.getAttribute("aria-label"), "Show recipe controls");

  syncCollapsibleControlsPanel(document, {
    collapsed: false,
    collapsedClass: "is-compact",
    collapsedLabel: "Show recipe controls",
    containerSelector: ".recipe-search",
    expandedLabel: "Hide recipe controls",
    panelId: "recipeControlsPanel",
    toggleId: "toggleRecipeControls",
  });

  assert.equal(panel.hidden, false);
  assert.equal(container.classList.contains("is-compact"), false);
  assert.equal(toggle.textContent, "Hide");
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(toggle.getAttribute("aria-label"), "Hide recipe controls");
});

test("media query helpers expose matching state and attach change listeners", () => {
  let subscribedType = "";
  let subscribedListener = null;
  const media = {
    matches: true,
    addEventListener(type, listener) {
      subscribedType = type;
      subscribedListener = listener;
    },
  };
  const window = {
    matchMedia(query) {
      assert.equal(query, "(max-width: 979px)");
      return media;
    },
  };

  const listener = () => {};

  assert.equal(isMediaQueryActive(window, "(max-width: 979px)"), true);
  assert.equal(listenToMediaQueryChanges(window, "(max-width: 979px)", listener), media);
  assert.equal(subscribedType, "change");
  assert.equal(subscribedListener, listener);
});

test("status message controller auto-clears transient messages", () => {
  const status = createFakeElement({ id: "stateBackupStatus" });
  const document = createFakeDocument({ elements: { stateBackupStatus: status } });
  const window = createFakeWindow();
  const controller = createStatusMessageController({ document, timeoutMs: 25, window });

  controller.set("Grocery list copied.");

  assert.equal(status.textContent, "Grocery list copied.");
  assert.equal(status.hidden, false);
  assert.equal(window.timers.length, 1);
  assert.equal(window.timers[0].delay, 25);

  window.timers[0].callback();

  assert.equal(status.textContent, "");
  assert.equal(status.hidden, true);
});

test("status message controller clears old timers before sticky errors", () => {
  const status = createFakeElement({ id: "stateBackupStatus" });
  const document = createFakeDocument({ elements: { stateBackupStatus: status } });
  const window = createFakeWindow();
  const controller = createStatusMessageController({ document, window });

  controller.set("Saved.");
  controller.set("Backup could not be imported.", { kind: "error", sticky: true });

  assert.equal(window.timers[0].cleared, true);
  assert.equal(window.timers.length, 1);
  assert.equal(status.textContent, "Backup could not be imported.");
  assert.equal(status.hidden, false);
  assert.equal(status.classList.contains("is-error"), true);
});

test("status message controller works without timer APIs", () => {
  const status = createFakeElement({ id: "stateBackupStatus" });
  const document = createFakeDocument({ elements: { stateBackupStatus: status } });
  const controller = createStatusMessageController({ document, window: {} });

  controller.set("Saved.");
  controller.clear();

  assert.equal(status.textContent, "");
  assert.equal(status.hidden, true);
  assert.equal(status.classList.contains("is-error"), false);
});
