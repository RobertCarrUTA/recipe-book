import assert from "node:assert/strict";

import {
  DEFAULT_RECIPE_MULTIPLIER,
  MAX_RECIPE_MULTIPLIER,
  MIN_RECIPE_MULTIPLIER,
  formatRecipeMultiplier,
  formatRecipeMultiplierInputValue,
  normalizeRecipeMultiplier,
  normalizeRecipeMultiplierRecord,
  stepRecipeMultiplier,
} from "../js/recipe_multiplier.js";
import { test } from "./test_helpers.mjs";

test("normalizeRecipeMultiplier clamps, rounds, and falls back safely", () => {
  assert.equal(normalizeRecipeMultiplier(0.1), MIN_RECIPE_MULTIPLIER);
  assert.equal(normalizeRecipeMultiplier(99), MAX_RECIPE_MULTIPLIER);
  assert.equal(normalizeRecipeMultiplier("2.345"), 2.35);
  assert.equal(normalizeRecipeMultiplier("bad", 2.5), 2.5);
  assert.equal(normalizeRecipeMultiplier("bad", "also bad"), DEFAULT_RECIPE_MULTIPLIER);
});

test("normalizeRecipeMultiplierRecord keeps only non-default safe values", () => {
  assert.deepEqual(
    normalizeRecipeMultiplierRecord({
      defaulted: 1,
      invalid: "nope",
      clamped: 0.1,
      scaled: "2.5",
    }),
    {
      clamped: MIN_RECIPE_MULTIPLIER,
      scaled: 2.5,
    }
  );

  assert.deepEqual(normalizeRecipeMultiplierRecord(null), {});
  assert.deepEqual(normalizeRecipeMultiplierRecord(["2"]), {});
});

test("recipe multiplier formatting and stepping stay shopper-friendly", () => {
  assert.equal(formatRecipeMultiplier(2), "x2");
  assert.equal(formatRecipeMultiplier(2.5), "x2.5");
  assert.equal(formatRecipeMultiplierInputValue("2.50"), "2.5");

  assert.equal(stepRecipeMultiplier(1, 1), 1.25);
  assert.equal(stepRecipeMultiplier(1, -1), 0.75);
  assert.equal(stepRecipeMultiplier(MIN_RECIPE_MULTIPLIER, -1), MIN_RECIPE_MULTIPLIER);
  assert.equal(stepRecipeMultiplier(MAX_RECIPE_MULTIPLIER, 1), MAX_RECIPE_MULTIPLIER);
  assert.equal(stepRecipeMultiplier(3, "not-a-direction"), 3);
});
