import assert from "node:assert/strict";

import { createMealPlanPanelController } from "../js/meal_plan_panel_controller.js";
import { createFakeDocument, createFakeElement, createFakeEvent } from "./dom_test_helpers.mjs";
import { test } from "./test_helpers.mjs";

function makeFocusable(element, document) {
  element.focusCount = 0;
  element.focus = () => {
    element.focusCount += 1;
    document.activeElement = element;
  };
  return element;
}

function createMealPlanPanelFixture() {
  const appHeader = createFakeElement({ classes: ["app-header"] });
  const mobileTabs = createFakeElement({ classes: ["mobile-view-tabs"] });
  const elements = {
    buildGroceryListFromMealPlan: createFakeElement({ id: "buildGroceryListFromMealPlan", tagName: "button" }),
    clearMealPlan: createFakeElement({ id: "clearMealPlan", tagName: "button" }),
    closeMealPlanPanel: createFakeElement({ id: "closeMealPlanPanel", tagName: "button" }),
    groceryPanel: createFakeElement({ id: "groceryPanel", tagName: "aside" }),
    mealPlanPanel: createFakeElement({ id: "mealPlanPanel", tagName: "aside" }),
    openMealPlan: createFakeElement({ id: "openMealPlan", tagName: "button" }),
    recipesPanel: createFakeElement({ id: "recipesPanel", tagName: "section" }),
  };
  const queryResults = {
    ".app-header": appHeader,
    ".mobile-view-tabs": mobileTabs,
  };
  const document = createFakeDocument({ elements });
  const containedElements = new Set([
    appHeader,
    mobileTabs,
    ...Object.values(elements),
  ]);

  Object.values(queryResults).forEach((element) => { element.inert = false; });
  elements.recipesPanel.inert = false;
  elements.groceryPanel.inert = false;

  document.querySelector = (selector) => queryResults[selector] || null;
  document.contains = (element) => containedElements.has(element);
  makeFocusable(elements.openMealPlan, document);
  makeFocusable(elements.closeMealPlanPanel, document);

  return {
    backgroundElements: [
      appHeader,
      elements.recipesPanel,
      elements.groceryPanel,
      mobileTabs,
    ],
    document,
    elements,
  };
}

test("meal plan panel controller opens, closes, and restores focus", () => {
  const { backgroundElements, document, elements } = createMealPlanPanelFixture();
  const controller = createMealPlanPanelController({
    document,
    onBuildGroceryList() {},
    onClearMealPlan() {},
  });
  document.activeElement = elements.openMealPlan;

  controller.open();

  assert.equal(controller.isOpen(), true);
  assert.equal(document.body.classList.contains("is-meal-plan-open"), true);
  assert.equal(elements.closeMealPlanPanel.focusCount, 1);
  backgroundElements.forEach((element) => {
    assert.equal(element.inert, true);
    assert.equal(element.getAttribute("aria-hidden"), "true");
  });

  controller.open();
  assert.equal(elements.closeMealPlanPanel.focusCount, 1);

  controller.close();

  assert.equal(controller.isOpen(), false);
  assert.equal(elements.openMealPlan.focusCount, 1);
  backgroundElements.forEach((element) => {
    assert.equal(element.inert, false);
    assert.equal(element.getAttribute("aria-hidden"), null);
  });
});

test("meal plan panel controller attaches controls and Escape handling", () => {
  const { document, elements } = createMealPlanPanelFixture();
  let buildCount = 0;
  let clearCount = 0;
  const controller = createMealPlanPanelController({
    document,
    onBuildGroceryList() { buildCount += 1; },
    onClearMealPlan() { clearCount += 1; },
  });

  controller.attach();
  elements.buildGroceryListFromMealPlan.dispatchEvent(createFakeEvent("click"));
  elements.clearMealPlan.dispatchEvent(createFakeEvent("click"));
  elements.openMealPlan.dispatchEvent(createFakeEvent("click"));

  const escapeEvent = createFakeEvent("keydown");
  escapeEvent.key = "Escape";
  document.dispatchEvent(escapeEvent);

  assert.equal(buildCount, 1);
  assert.equal(clearCount, 1);
  assert.equal(escapeEvent.defaultPrevented, true);
  assert.equal(controller.isOpen(), false);
});

test("meal plan panel controller can close without restoring focus", () => {
  const { document, elements } = createMealPlanPanelFixture();
  const controller = createMealPlanPanelController({
    document,
    onBuildGroceryList() {},
    onClearMealPlan() {},
  });
  document.activeElement = elements.openMealPlan;

  controller.open();
  controller.close({ restoreFocus: false });

  assert.equal(controller.isOpen(), false);
  assert.equal(elements.openMealPlan.focusCount, 0);
});
