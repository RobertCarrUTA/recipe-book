import assert from "node:assert/strict";

import {
  normalizeParsedIngredients,
  parseIngredient,
  parseStructuredGroceryIngredient,
} from "../js/ingredient_parser.js";
import { test } from "./test_helpers.mjs";

function parsedSnapshot(parsed) {
  return normalizeParsedIngredients(parsed).map((entry) => ({
    base: entry.canonical.base,
    display: entry.canonical.display,
    unitKey: entry.unitKey,
    quantityRange: entry.quantityRange,
    optional: entry.optional,
    nonQuantifiedMarker: entry.nonQuantifiedMarker,
    notes: entry.notes,
  }));
}

const ingredientCases = [
  {
    name: "simple measured staple",
    input: "2 cups all-purpose flour",
    expected: [
      {
        base: "all-purpose flour",
        display: "all-purpose flour",
        unitKey: "cup",
        quantityRange: { min: 2, max: 2 },
        optional: false,
        nonQuantifiedMarker: null,
        notes: [],
      },
    ],
  },
  {
    name: "mixed fraction quantity",
    input: "1 1/2 cups granulated sugar",
    expected: [
      {
        base: "granulated sugar",
        display: "granulated sugar",
        unitKey: "cup",
        quantityRange: { min: 1.5, max: 1.5 },
        optional: false,
        nonQuantifiedMarker: null,
        notes: [],
      },
    ],
  },
  {
    name: "split quantities for one ingredient",
    input: "1/2 cup + 2 tbsp olive oil",
    expected: [
      {
        base: "olive oil",
        display: "olive oil",
        unitKey: "cup",
        quantityRange: { min: 0.5, max: 0.5 },
        optional: false,
        nonQuantifiedMarker: null,
        notes: [],
      },
      {
        base: "olive oil",
        display: "olive oil",
        unitKey: "tbsp",
        quantityRange: { min: 2, max: 2 },
        optional: false,
        nonQuantifiedMarker: null,
        notes: [],
      },
    ],
  },
  {
    name: "optional ingredient marker",
    input: "Optional: 1 cup chopped walnuts",
    expected: [
      {
        base: "walnuts",
        display: "walnuts",
        unitKey: "cup",
        quantityRange: { min: 1, max: 1 },
        optional: true,
        nonQuantifiedMarker: null,
        notes: ["optional"],
      },
    ],
  },
  {
    name: "salt and pepper to taste split",
    input: "Salt and black pepper to taste",
    expected: [
      {
        base: "salt",
        display: "salt",
        unitKey: null,
        quantityRange: null,
        optional: false,
        nonQuantifiedMarker: "to taste",
        notes: ["to taste"],
      },
      {
        base: "black pepper",
        display: "black pepper",
        unitKey: null,
        quantityRange: null,
        optional: false,
        nonQuantifiedMarker: "to taste",
        notes: ["to taste"],
      },
    ],
  },
  {
    name: "parenthetical package weight",
    input: "1 (4-pound) chicken breast",
    expected: [
      {
        base: "chicken breast",
        display: "chicken breast",
        unitKey: "lb",
        quantityRange: { min: 4, max: 4 },
        optional: false,
        nonQuantifiedMarker: null,
        notes: ["1 piece"],
      },
    ],
  },
  {
    name: "counted cans with per-package weight note",
    input: "2 (15 ounce) cans kidney beans",
    expected: [
      {
        base: "kidney beans",
        display: "kidney beans",
        unitKey: "can",
        quantityRange: { min: 2, max: 2 },
        optional: false,
        nonQuantifiedMarker: null,
        notes: ["15 oz each"],
      },
    ],
  },
  {
    name: "juice of lemons with approximate volume",
    input: "juice of 2 lemons, about 3 tbsp",
    expected: [
      {
        base: "lemon juice",
        display: "lemon juice",
        unitKey: "tbsp",
        quantityRange: { min: 3, max: 3 },
        optional: false,
        nonQuantifiedMarker: null,
        notes: ["juice of 2 lemon"],
      },
    ],
  },
  {
    name: "trailing count unit",
    input: "3 garlic cloves",
    expected: [
      {
        base: "garlic",
        display: "garlic",
        unitKey: "clove",
        quantityRange: { min: 3, max: 3 },
        optional: false,
        nonQuantifiedMarker: null,
        notes: [],
      },
    ],
  },
  {
    name: "ignored optional toppings heading",
    input: "Optional toppings: sour cream, cheese, green onions",
    expected: [],
  },
];

ingredientCases.forEach((item) => {
  test(`parseIngredient golden - ${item.name}`, () => {
    assert.deepEqual(parsedSnapshot(parseIngredient(item.input)), item.expected);
  });
});

test("parseStructuredGroceryIngredient preserves explicit shopping notes", () => {
  assert.deepEqual(
    parsedSnapshot(parseStructuredGroceryIngredient({
      item: "crushed tomatoes",
      note: "28 oz can",
      quantity: 1,
      unit: "can",
    })),
    [
      {
        base: "crushed tomatoes",
        display: "crushed tomatoes",
        unitKey: "can",
        quantityRange: { min: 1, max: 1 },
        optional: false,
        nonQuantifiedMarker: null,
        notes: ["28 oz can"],
      },
    ]
  );
});

test("parseStructuredGroceryIngredient keeps prepared potato sides separate from raw potatoes", () => {
  assert.deepEqual(
    parsedSnapshot(parseStructuredGroceryIngredient({
      item: "mashed potatoes",
      optional: true,
    })),
    [
      {
        base: "mashed potatoes",
        display: "mashed potatoes",
        unitKey: null,
        quantityRange: null,
        optional: true,
        nonQuantifiedMarker: null,
        notes: [],
      },
    ]
  );
});

test("parseStructuredGroceryIngredient preserves shopping-critical burger labels", () => {
  assert.deepEqual(
    [
      parseStructuredGroceryIngredient({ item: "80/20 ground beef", quantity: 1.5, unit: "lb" }),
      parseStructuredGroceryIngredient({ item: "potato bun", quantity: 4 }),
      parseStructuredGroceryIngredient({ item: "American cheese slice", quantity: 8 }),
      parseStructuredGroceryIngredient({ item: "iceberg lettuce", quantity: 2, unit: "cup" }),
      parseStructuredGroceryIngredient({ item: "dill pickle chips", quantity: 1, unit: "cup" }),
      parseStructuredGroceryIngredient({ item: "Louisiana-style cayenne hot sauce", quantity: 1, unit: "tsp" }),
    ].map((entry) => ({
      base: entry.canonical.base,
      display: entry.canonical.display,
      unitKey: entry.unitKey,
      quantityRange: entry.quantityRange,
    })),
    [
      {
        base: "80/20 ground beef",
        display: "80/20 ground beef",
        unitKey: "lb",
        quantityRange: { min: 1.5, max: 1.5 },
      },
      {
        base: "potato bun",
        display: "potato bun",
        unitKey: null,
        quantityRange: { min: 4, max: 4 },
      },
      {
        base: "american cheese slice",
        display: "American cheese slice",
        unitKey: null,
        quantityRange: { min: 8, max: 8 },
      },
      {
        base: "iceberg lettuce",
        display: "iceberg lettuce",
        unitKey: "cup",
        quantityRange: { min: 2, max: 2 },
      },
      {
        base: "dill pickle chips",
        display: "dill pickle chips",
        unitKey: "cup",
        quantityRange: { min: 1, max: 1 },
      },
      {
        base: "louisiana-style cayenne hot sauce",
        display: "Louisiana-style cayenne hot sauce",
        unitKey: "tsp",
        quantityRange: { min: 1, max: 1 },
      },
    ]
  );
});
