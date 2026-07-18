import assert from "node:assert/strict";

import {
  createGrocerySearchUrl,
  formatGrocerySourceDetail,
  formatCheckedGroceryGroupMessage,
  formatGrocerySourceSummary,
  getGrocerySourceDetail,
  getDisplayNotes,
  getGrocerySearchQuery,
} from "../js/grocery_view_model.js";
import { formatRatingText, formatServingsText, getRecipeHeaderMeta } from "../js/recipe_formatting.js";
import { formatTotalsForKey } from "../js/units.js";
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
  assert.deepEqual(
    getDisplayNotes(["to taste", "optional", "manual item", "divided", "amount not specified", "juice of 1/2 lemon"]),
    ["optional"]
  );
  assert.deepEqual(
    getDisplayNotes(["optional"], [{ title: "Required Recipe", notes: [] }, { title: "Optional Recipe", notes: ["optional"] }]),
    []
  );
  assert.deepEqual(
    getDisplayNotes(["optional"], [{ title: "Optional Recipe", notes: ["optional"] }]),
    ["optional"]
  );
  assert.equal(formatGrocerySourceSummary([{ title: "Chili" }, { title: "Soup" }], 2), "From 2 recipes");
  assert.equal(formatGrocerySourceSummary([{ title: "Chili", multiplier: 2 }], 1), "From Chili x2");
  assert.equal(formatGrocerySourceDetail({ title: "Cake", notes: ["optional", "amount not specified"] }), "Cake - optional, amount not specified");
  assert.equal(
    formatGrocerySourceDetail({ title: "Chili", multiplier: 2, totals: { can: { min: 4, max: 4 } } }),
    "Chili - 4 cans (x2)"
  );
  assert.equal(
    formatGrocerySourceDetail(
      { title: "Dutch Oven Chicken Pot Pie", totals: { item: { min: 1, max: 1 } } },
      { canonicalKey: "potato" }
    ),
    "Dutch Oven Chicken Pot Pie - 1 potato"
  );
  assert.deepEqual(
    getGrocerySourceDetail(
      { title: "Cobbler", notes: ["optional"], totals: { item: { min: 5, max: 5 } } },
      { canonicalKey: "peach" }
    ),
    { title: "Cobbler", metaText: "5 peaches (optional)" }
  );
  assert.equal(formatCheckedGroceryGroupMessage("Baking"), "Everything in Baking is checked.");
  assert.equal(formatCheckedGroceryGroupMessage("Manual Items"), "Everything in Manual Items is checked.");
});

test("grocery search URLs use a fixed destination with encoded item text", () => {
  const searchUrl = createGrocerySearchUrl(
    "  whole milk  <script>alert(1)</script>  ",
    "  Central   Market  "
  );
  const parsed = new URL(searchUrl);

  assert.equal(parsed.origin, "https://www.google.com");
  assert.equal(parsed.pathname, "/search");
  assert.equal(parsed.searchParams.get("q"), "whole milk <script>alert(1)</script> Central Market");
  assert.equal(getGrocerySearchQuery("whole milk", "Walmart"), "whole milk Walmart");
  assert.equal(getGrocerySearchQuery("   ", "Walmart"), "");
  assert.equal(createGrocerySearchUrl("   "), "");
});

test("grocery totals use shopper-friendly quantities", () => {
  assert.equal(formatTotalsForKey({ item: { min: 8, max: 8 } }, { canonicalKey: "peach" }), "8 peaches");
  assert.equal(formatTotalsForKey({ item: { min: 0.625, max: 0.625 } }, { canonicalKey: "white onion" }), "5/8 white onion");
  assert.equal(formatTotalsForKey({ item: { min: 3, max: 3 } }, { canonicalKey: "white onion" }), "3 white onions");
  assert.equal(formatTotalsForKey({ item: { min: 1, max: 1 } }, { canonicalKey: "red onion" }), "1 red onion");
  assert.equal(formatTotalsForKey({ item: { min: 5, max: 5 } }, { canonicalKey: "roma tomato" }), "5 Roma tomatoes");
  assert.equal(formatTotalsForKey({ item: { min: 2, max: 2 } }, { canonicalKey: "jalapeno" }), "2 jalapenos");
  assert.equal(formatTotalsForKey({ item: { min: 3, max: 3 } }, { canonicalKey: "10-inch flour tortilla" }), "3 tortillas");
  assert.equal(
    formatTotalsForKey({ item: { min: 20, max: 20 } }, { canonicalKey: "maraschino cherries" }),
    "20 cherries"
  );
  assert.equal(formatTotalsForKey({ tsp: { min: 36, max: 36 } }, { canonicalKey: "mozzarella cheese" }), "3/4 cup");
  assert.equal(formatTotalsForKey({ tsp: { min: 40, max: 40 } }, { canonicalKey: "lemon juice" }), "5/6 cup");
});
