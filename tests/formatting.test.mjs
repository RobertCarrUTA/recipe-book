import assert from "node:assert/strict";

import { formatGrocerySourceSummary, getDisplayNotes } from "../js/grocery_view_model.js";
import { formatRatingText, formatServingsText, getRecipeHeaderMeta } from "../js/recipe_formatting.js";
import { test } from "./test_helpers.mjs";

test("formatServingsText normalizes simple serving counts", () => {
  assert.equal(formatServingsText("6"), "6 servings");
  assert.equal(formatServingsText("1"), "1 serving");
  assert.equal(formatServingsText("12 cookies"), "12 cookies");
});

test("formatRatingText handles rating values and review counts", () => {
  assert.equal(formatRatingText({ count: 1, value: 4.9 }), "4.9 stars (1 review)");
  assert.equal(formatRatingText({ count: 12, value: 4.9 }, "chip"), "4.9 rating (12 reviews)");
});

test("getRecipeHeaderMeta limits and orders compact recipe metadata", () => {
  const meta = getRecipeHeaderMeta({
    category: "Dinner",
    rating: { count: 5, value: 4.8 },
    servings: "6",
    tags: { difficulty: "easy" },
    totalTime: "1 hour",
  });

  assert.deepEqual(
    meta.map((item) => item.text),
    ["Dinner", "4.8 rating (5 reviews)", "1 hour", "6 servings"]
  );
});

test("grocery view helpers hide noisy notes and summarize sources", () => {
  assert.deepEqual(getDisplayNotes(["to taste", "optional", "divided"]), ["optional"]);
  assert.equal(formatGrocerySourceSummary([{ title: "Chili" }, { title: "Soup" }], 2), "From 2 recipes");
});
