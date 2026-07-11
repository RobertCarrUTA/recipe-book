import assert from "node:assert/strict";

import { downloadTextFile } from "../js/download.js";
import { createFakeDocument, createFakeWindow } from "./dom_test_helpers.mjs";
import { test } from "./test_helpers.mjs";

test("downloadTextFile creates a temporary text download link", async () => {
  const document = createFakeDocument();
  const window = createFakeWindow();
  const createdBlobs = [];
  const revokedUrls = [];
  const urlApi = {
    createObjectURL(blob) {
      createdBlobs.push(blob);
      return "blob:recipe-export";
    },
    revokeObjectURL(url) {
      revokedUrls.push(url);
    },
  };

  downloadTextFile(
    {
      fileName: "recipe.txt",
      mimeType: "text/plain;charset=utf-8",
      text: "2 eggs\n1 cup flour",
    },
    { document, urlApi, window }
  );

  const link = document.createdElements[0];
  assert.equal(link.tagName, "A");
  assert.equal(link.href, "blob:recipe-export");
  assert.equal(link.download, "recipe.txt");
  assert.equal(link.hidden, true);
  assert.equal(link.removed, true);
  assert.deepEqual(document.body.children, []);
  assert.equal(await createdBlobs[0].text(), "2 eggs\n1 cup flour");

  window.timers[0].callback();
  assert.deepEqual(revokedUrls, ["blob:recipe-export"]);
});

test("downloadTextFile reports unavailable browser download APIs", () => {
  const document = createFakeDocument();
  const window = createFakeWindow();

  assert.throws(
    () =>
      downloadTextFile(
        { fileName: "recipe.txt", mimeType: "text/plain", text: "" },
        { document, urlApi: null, window }
      ),
    /Downloads are not available/
  );
});

test("downloadTextFile cleans up when the browser rejects the download click", () => {
  const document = createFakeDocument();
  const window = createFakeWindow();
  const revokedUrls = [];
  const createElement = document.createElement;
  document.createElement = (tagName) => {
    const element = createElement(tagName);
    element.click = () => {
      throw new Error("download blocked");
    };
    return element;
  };
  const urlApi = {
    createObjectURL: () => "blob:blocked-download",
    revokeObjectURL: (url) => revokedUrls.push(url),
  };

  assert.throws(
    () => downloadTextFile(
      { fileName: "recipe.txt", mimeType: "text/plain", text: "Recipe" },
      { document, urlApi, window }
    ),
    /download blocked/
  );

  assert.equal(document.createdElements[0].removed, true);
  assert.deepEqual(document.body.children, []);
  assert.equal(window.timers.length, 1);
  window.timers[0].callback();
  assert.deepEqual(revokedUrls, ["blob:blocked-download"]);
});
