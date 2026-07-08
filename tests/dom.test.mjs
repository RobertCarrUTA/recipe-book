import assert from "node:assert/strict";

import {
  appendChildren,
  createElement,
  createEmptyState,
  createTextElement,
  listen,
  setElementInert,
  syncDisclosureToggle,
} from "../js/dom.js";
import { createFakeDocument, createFakeElement, createFakeEvent } from "./dom_test_helpers.mjs";
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

test("createElement applies common DOM options and appends children", () => {
  const document = createFakeDocument();
  const child = createTextElement(document, "span", "Save");
  let clicked = false;
  const button = createElement(document, "button", {
    attributes: { "aria-label": "Save recipe" },
    checked: true,
    children: child,
    className: "primary-button",
    classList: ["is-ready"],
    dataset: { recipeId: "chili" },
    disabled: false,
    hidden: true,
    id: "saveRecipe",
    listeners: { click: () => { clicked = true; } },
    title: "Save",
    type: "button",
  });

  assert.equal(button.tagName, "BUTTON");
  assert.equal(button.id, "saveRecipe");
  assert.equal(button.className, "primary-button");
  assert.equal(button.classList.contains("is-ready"), true);
  assert.equal(button.checked, true);
  assert.equal(button.disabled, false);
  assert.equal(button.hidden, true);
  assert.equal(button.type, "button");
  assert.equal(button.title, "Save");
  assert.equal(button.getAttribute("aria-label"), "Save recipe");
  assert.equal(button.dataset.recipeId, "chili");
  assert.deepEqual(button.children, [child]);
  button.dispatchEvent(createFakeEvent("click"));
  assert.equal(clicked, true);
});

test("appendChildren skips empty children and preserves parent linkage", () => {
  const parent = createFakeElement({ tagName: "div" });
  const child = createFakeElement({ tagName: "span" });

  appendChildren(parent, [null, child, undefined]);

  assert.deepEqual(parent.children, [child]);
  assert.equal(child.parentElement, parent);
});

test("listen attaches optional DOM listeners and returns the target", () => {
  const button = createFakeElement({ tagName: "button" });
  let clicked = false;

  const result = listen(button, "click", () => {
    clicked = true;
  });

  assert.equal(result, button);
  button.dispatchEvent(createFakeEvent("click"));
  assert.equal(clicked, true);
  assert.equal(listen(null, "click", () => {}), null);
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

test("setElementInert syncs inert and aria-hidden state", () => {
  const section = createFakeElement({ tagName: "section" });
  section.inert = false;

  setElementInert(section, true);

  assert.equal(section.inert, true);
  assert.equal(section.getAttribute("aria-hidden"), "true");

  setElementInert(section, false);

  assert.equal(section.inert, false);
  assert.equal(section.getAttribute("aria-hidden"), null);
  assert.doesNotThrow(() => setElementInert(null, true));
});
