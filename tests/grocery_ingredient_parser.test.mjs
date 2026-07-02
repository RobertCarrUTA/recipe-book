import assert from "node:assert/strict";

import {
  normalizeParsedIngredients,
  parseStructuredGroceryIngredient,
} from "../js/grocery_ingredient_parser.js";
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

test("parseStructuredGroceryIngredient rejects free-text grocery entries", () => {
  assert.equal(parseStructuredGroceryIngredient("3 garlic cloves"), null);
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

test("parseStructuredGroceryIngredient normalizes structured quantities", () => {
  assert.deepEqual(
    parsedSnapshot(parseStructuredGroceryIngredient({
      item: "all-purpose flour",
      quantity: "1 1/2",
      unit: "cups",
    })),
    [
      {
        base: "all-purpose flour",
        display: "all-purpose flour",
        unitKey: "cup",
        quantityRange: { min: 1.5, max: 1.5 },
        optional: false,
        nonQuantifiedMarker: null,
        notes: [],
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

test("parseStructuredGroceryIngredient preserves shopping-critical specific labels", () => {
  assert.deepEqual(
    [
      parseStructuredGroceryIngredient({ item: "thick-cut ribeye steak", quantity: 1, unit: "lb" }),
      parseStructuredGroceryIngredient({ item: "top sirloin steak, strip steak, or flat iron steak", quantity: 1.25, unit: "lb" }),
      parseStructuredGroceryIngredient({ item: "boneless ribeye, top sirloin, or skirt steak", quantity: 2, unit: "lb" }),
      parseStructuredGroceryIngredient({ item: "plain shredded cabbage and carrot coleslaw mix", quantity: 10, unit: "oz" }),
      parseStructuredGroceryIngredient({ item: "celery seed", quantity: 0.5, unit: "tsp" }),
      parseStructuredGroceryIngredient({ item: "yellow mustard seed", quantity: 1, unit: "tsp" }),
      parseStructuredGroceryIngredient({ item: "butter lettuce or red leaf lettuce", quantity: 1, unit: "head" }),
      parseStructuredGroceryIngredient({ item: "red leaf lettuce", quantity: 1, unit: "head" }),
      parseStructuredGroceryIngredient({ item: "low-sodium beef broth", quantity: 0.5, unit: "cup" }),
      parseStructuredGroceryIngredient({ item: "low-sodium chicken broth", quantity: 0.5, unit: "cup" }),
      parseStructuredGroceryIngredient({ item: "boneless skinless chicken breast", quantity: 1.5, unit: "lb" }),
      parseStructuredGroceryIngredient({ item: "fresh ginger", quantity: 1, unit: "tbsp" }),
      parseStructuredGroceryIngredient({ item: "extra-virgin olive oil", quantity: 1, unit: "tsp" }),
      parseStructuredGroceryIngredient({ item: "lard or unsalted butter", quantity: 3, unit: "tbsp" }),
    ].map((entry) => ({
      base: entry.canonical.base,
      display: entry.canonical.display,
      unitKey: entry.unitKey,
      quantityRange: entry.quantityRange,
    })),
    [
      {
        base: "thick-cut ribeye steak",
        display: "thick-cut ribeye steak",
        unitKey: "lb",
        quantityRange: { min: 1, max: 1 },
      },
      {
        base: "top sirloin steak, strip steak, or flat iron steak",
        display: "top sirloin steak, strip steak, or flat iron steak",
        unitKey: "lb",
        quantityRange: { min: 1.25, max: 1.25 },
      },
      {
        base: "boneless ribeye, top sirloin, or skirt steak",
        display: "boneless ribeye, top sirloin, or skirt steak",
        unitKey: "lb",
        quantityRange: { min: 2, max: 2 },
      },
      {
        base: "plain shredded cabbage and carrot coleslaw mix",
        display: "plain shredded cabbage and carrot coleslaw mix",
        unitKey: "oz",
        quantityRange: { min: 10, max: 10 },
      },
      {
        base: "celery seed",
        display: "celery seed",
        unitKey: "tsp",
        quantityRange: { min: 0.5, max: 0.5 },
      },
      {
        base: "yellow mustard seed",
        display: "yellow mustard seed",
        unitKey: "tsp",
        quantityRange: { min: 1, max: 1 },
      },
      {
        base: "butter lettuce or red leaf lettuce",
        display: "butter lettuce or red leaf lettuce",
        unitKey: "head",
        quantityRange: { min: 1, max: 1 },
      },
      {
        base: "red leaf lettuce",
        display: "red leaf lettuce",
        unitKey: "head",
        quantityRange: { min: 1, max: 1 },
      },
      {
        base: "low-sodium beef broth",
        display: "low-sodium beef broth",
        unitKey: "cup",
        quantityRange: { min: 0.5, max: 0.5 },
      },
      {
        base: "low-sodium chicken broth",
        display: "low-sodium chicken broth",
        unitKey: "cup",
        quantityRange: { min: 0.5, max: 0.5 },
      },
      {
        base: "boneless skinless chicken breast",
        display: "boneless skinless chicken breast",
        unitKey: "lb",
        quantityRange: { min: 1.5, max: 1.5 },
      },
      {
        base: "fresh ginger",
        display: "fresh ginger",
        unitKey: "tbsp",
        quantityRange: { min: 1, max: 1 },
      },
      {
        base: "extra-virgin olive oil",
        display: "extra-virgin olive oil",
        unitKey: "tsp",
        quantityRange: { min: 1, max: 1 },
      },
      {
        base: "lard or unsalted butter",
        display: "lard or unsalted butter",
        unitKey: "tbsp",
        quantityRange: { min: 3, max: 3 },
      },
    ]
  );
});
