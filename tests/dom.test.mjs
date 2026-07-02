import assert from "node:assert/strict";

import {
  createEmptyState,
  createTextElement,
  syncDisclosureToggle,
} from "../js/dom.js";
import { createFakeDocument, createFakeElement } from "./dom_test_helpers.mjs";
import { test } from "./test_helpers.mjs";

test("createTextElement applies concise text element options", () => {
  const document = createFakeDocument();
  const element = createTextElement(document, "li", "Ingredients", {
    className: "recipe-section-item",
    id: "ingredients-item",
    tabIndex: 0,
  });

  assert.equal(element.tagName, "LI");
  assert.equal(element.id, "ingredients-item");
  assert.equal(element.className, "recipe-section-item");
  assert.equal(element.tabIndex, 0);
  assert.equal(element.textContent, "Ingredients");
});

test("createEmptyState renders a standard empty-state block", () => {
  const document = createFakeDocument();
  const empty = createEmptyState(document, {
    body: "Add recipes to get started.",
    title: "No recipes yet.",
  });

  assert.equal(empty.className, "empty-state");
  assert.equal(empty.children.length, 2);
  assert.equal(empty.children[0].tagName, "STRONG");
  assert.equal(empty.children[0].textContent, "No recipes yet.");
  assert.equal(empty.children[1].tagName, "SPAN");
  assert.equal(empty.children[1].textContent, "Add recipes to get started.");
});

test("syncDisclosureToggle keeps text, labels, and expanded state together", () => {
  const toggle = createFakeElement({ tagName: "button" });

  syncDisclosureToggle(toggle, false, {
    collapsedLabel: "Show recipe controls",
    collapsedText: "Show",
    collapsedTitle: "Show recipe controls",
    expandedLabel: "Hide recipe controls",
    expandedText: "Hide",
    expandedTitle: "Hide recipe controls",
  });

  assert.equal(toggle.textContent, "Show");
  assert.equal(toggle.title, "Show recipe controls");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(toggle.getAttribute("aria-label"), "Show recipe controls");

  syncDisclosureToggle(toggle, true, {
    collapsedLabel: "Show recipe controls",
    collapsedText: "Show",
    collapsedTitle: "Show recipe controls",
    expandedLabel: "Hide recipe controls",
    expandedText: "Hide",
    expandedTitle: "Hide recipe controls",
  });

  assert.equal(toggle.textContent, "Hide");
  assert.equal(toggle.title, "Hide recipe controls");
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(toggle.getAttribute("aria-label"), "Hide recipe controls");
});
