import assert from "node:assert/strict";

import { writeTextToClipboard } from "../js/clipboard.js";
import { createFakeDocument } from "./dom_test_helpers.mjs";
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
