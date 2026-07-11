import assert from "node:assert/strict";

import { createCookingRenderer } from "../js/cooking_renderer.js";
import { createFakeDocument, createFakeElement } from "./dom_test_helpers.mjs";
import { test } from "./test_helpers.mjs";

test("cooking renderer inerts the app while open and restores it when closed", () => {
  const appShell = createFakeElement({ classes: ["app-shell"] });
  const skipLink = createFakeElement({ classes: ["skip-link"], tagName: "a" });
  const elements = {
    cookingMode: createFakeElement({ hidden: true, id: "cookingMode", tagName: "section" }),
    nextCookingStep: createFakeElement({ id: "nextCookingStep", tagName: "button" }),
  };
  const document = createFakeDocument({
    elements,
    queryResults: {
      ".app-shell": [appShell],
      ".skip-link": [skipLink],
    },
  });
  appShell.inert = false;
  skipLink.inert = false;
  const renderer = createCookingRenderer({ document });

  renderer.openCookingMode({
    ingredients: ["1 cup beans"],
    instructions: ["Simmer until hot."],
    title: "Chili",
  }, 0);

  assert.equal(elements.cookingMode.hidden, false);
  assert.equal(document.body.classList.contains("is-cooking-mode"), true);
  assert.equal(appShell.inert, true);
  assert.equal(appShell.getAttribute("aria-hidden"), "true");
  assert.equal(skipLink.inert, true);
  assert.equal(skipLink.getAttribute("aria-hidden"), "true");
  assert.equal(elements.nextCookingStep.focused, true);

  renderer.closeCookingMode();

  assert.equal(elements.cookingMode.hidden, true);
  assert.equal(document.body.classList.contains("is-cooking-mode"), false);
  assert.equal(appShell.inert, false);
  assert.equal(appShell.getAttribute("aria-hidden"), null);
  assert.equal(skipLink.inert, false);
  assert.equal(skipLink.getAttribute("aria-hidden"), null);

  skipLink.inert = true;
  skipLink.setAttribute("aria-hidden", "true");
  renderer.openCookingMode({
    ingredients: ["1 cup beans"],
    instructions: ["Simmer until hot."],
    title: "Chili",
  }, 0);
  renderer.closeCookingMode();

  assert.equal(skipLink.inert, true);
  assert.equal(skipLink.getAttribute("aria-hidden"), "true");
});
