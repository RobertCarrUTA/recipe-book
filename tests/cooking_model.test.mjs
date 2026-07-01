import assert from "node:assert/strict";

import { getCookingIngredients, getCookingSteps } from "../js/cooking_model.js";
import { test } from "./test_helpers.mjs";

test("getCookingSteps returns recipe instructions when available", () => {
  const steps = ["Season the pan.", "Cook until done."];

  assert.equal(getCookingSteps({ instructions: steps }), steps);
});

test("getCookingSteps falls back for missing or empty instructions", () => {
  assert.deepEqual(getCookingSteps(null), ["No instructions are available for this recipe yet."]);
  assert.deepEqual(getCookingSteps({ instructions: [] }), ["No instructions are available for this recipe yet."]);
  assert.deepEqual(getCookingSteps({ instructions: "Cook it." }), ["No instructions are available for this recipe yet."]);
});

test("getCookingIngredients returns an ingredient array or a safe empty list", () => {
  const ingredients = ["2 eggs", "1 cup flour"];

  assert.equal(getCookingIngredients({ ingredients }), ingredients);
  assert.deepEqual(getCookingIngredients(null), []);
  assert.deepEqual(getCookingIngredients({ ingredients: "2 eggs" }), []);
});
