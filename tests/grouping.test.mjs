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
    ["wheat sandwich bread", "Pantry"],
    ["coconut milk", "Pantry"],
    ["cream of coconut", "Pantry"],
    ["sesame oil", "Pantry"],
    ["tomato sauce", "Pantry"],
    ["shallot", "Produce"],
    ["half-and-half", "Dairy"],
    ["blueberries", "Fruit"],
    ["banana", "Fruit"],
    ["asian pear or bosc pear", "Fruit"],
    ["frozen pineapple chunks", "Fruit"],
    ["pineapple juice", "Fruit"],
    ["basil", "Herbs"],
    ["cilantro", "Herbs"],
    ["flank steak", "Meat"],
    ["deli pepperoni", "Deli Meats"],
    ["deli salami", "Deli Meats"],
    ["mortadella", "Deli Meats"],
    ["prosciutto", "Deli Meats"],
    ["thin-sliced smoked deli ham", "Deli Meats"],
    ["dijon mustard", "Sauces, Marinades, & Condiments"],
    ["doenjang or white miso", "Sauces, Marinades, & Condiments"],
    ["gochujang", "Sauces, Marinades, & Condiments"],
    ["kimchi", "Sauces, Marinades, & Condiments"],
    ["olives", "Sauces, Marinades, & Condiments"],
    ["pickle brine", "Sauces, Marinades, & Condiments"],
    ["sliced pickled hot cherry peppers", "Sauces, Marinades, & Condiments"],
    ["sliced pepperoncini peppers", "Sauces, Marinades, & Condiments"],
    ["soy sauce", "Sauces, Marinades, & Condiments"],
    ["anchovy paste", "Sauces, Marinades, & Condiments"],
    ["italian seasoning", "Spices"],
    ["dried chile de arbol", "Spices"],
    ["dried guajillo chile", "Spices"],
    ["poppy seeds", "Spices"],
    ["pumpkin pie spice", "Spices"],
    ["baby arugula", "Vegetables"],
    ["baby spinach", "Vegetables"],
    ["artichoke hearts", "Vegetables"],
    ["avocado", "Vegetables"],
    ["broccoli", "Vegetables"],
    ["fresh shiitake or cremini mushrooms", "Vegetables"],
    ["jalapeno", "Vegetables"],
    ["mashed potatoes", "Vegetables"],
    ["roma tomato", "Vegetables"],
    ["tomatillo", "Vegetables"],
    ["bourbon whiskey", "Wine"],
    ["dark rum", "Wine"],
    ["dry white wine", "Wine"],
    ["vodka", "Wine"],
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
      "Deli Meats",
      "Manual Items",
      "Pantry",
      "Sauces, Marinades, & Condiments",
      "Mystery",
    ]),
    [
      "Manual Items",
      "Deli Meats",
      "Baking",
      "Pantry",
      "Sauces, Marinades, & Condiments",
      "Mystery",
      "Other",
    ]
  );
});
