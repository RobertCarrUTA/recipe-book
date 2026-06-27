import assert from "node:assert/strict";

import { determineGroupForKey, sortGroceryGroups } from "../js/grouping.js";
import { test } from "./test_helpers.mjs";

test("determineGroupForKey classifies common recipe catalog grocery labels", () => {
  const cases = [
    ["baking powder", "Baking"],
    ["baking soda", "Baking"],
    ["sourdough discard", "Baking"],
    ["active dry yeast", "Baking"],
    ["graham crackers", "Baking"],
    ["dark chocolate", "Baking"],
    ["red food coloring", "Baking"],
    ["sweetened shredded coconut", "Baking"],
    ["honey", "Pantry"],
    ["avocado oil", "Pantry"],
    ["ciabatta roll or sturdy hoagie roll", "Pantry"],
    ["jasmine rice", "Pantry"],
    ["pasta", "Pantry"],
    ["sesame oil", "Pantry"],
    ["tomato sauce", "Pantry"],
    ["blueberries", "Fruit"],
    ["banana", "Fruit"],
    ["asian pear or bosc pear", "Fruit"],
    ["basil", "Herbs"],
    ["flank steak", "Meat"],
    ["deli pepperoni", "Meat"],
    ["dijon mustard", "Sauces, Marinades, & Condiments"],
    ["gochujang", "Sauces, Marinades, & Condiments"],
    ["kimchi", "Sauces, Marinades, & Condiments"],
    ["pickle brine", "Sauces, Marinades, & Condiments"],
    ["sliced pepperoncini peppers", "Sauces, Marinades, & Condiments"],
    ["soy sauce", "Sauces, Marinades, & Condiments"],
    ["italian seasoning", "Spices"],
    ["poppy seeds", "Spices"],
    ["pumpkin pie spice", "Spices"],
    ["baby arugula", "Vegetables"],
    ["baby spinach", "Vegetables"],
    ["broccoli", "Vegetables"],
    ["fresh shiitake or cremini mushrooms", "Vegetables"],
    ["mashed potatoes", "Vegetables"],
    ["bourbon whiskey", "Wine"],
    ["dry white wine", "Wine"],
  ];

  cases.forEach(([key, expected]) => {
    assert.equal(determineGroupForKey(key), expected, key);
  });
});

test("determineGroupForKey prefers specific matches before broad words", () => {
  assert.equal(determineGroupForKey("chipotle peppers in adobo sauce"), "Sauces, Marinades, & Condiments");
  assert.equal(determineGroupForKey("unsalted butter"), "Dairy");
  assert.equal(determineGroupForKey("semi-sweet chocolate chips"), "Baking");
});

test("sortGroceryGroups uses shopping flow order and keeps Other last", () => {
  assert.deepEqual(
    sortGroceryGroups([
      "Other",
      "Baking",
      "Manual Items",
      "Pantry",
      "Sauces, Marinades, & Condiments",
      "Mystery",
    ]),
    [
      "Manual Items",
      "Baking",
      "Pantry",
      "Sauces, Marinades, & Condiments",
      "Mystery",
      "Other",
    ]
  );
});
