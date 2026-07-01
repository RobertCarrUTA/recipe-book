import assert from "node:assert/strict";

import {
  addRange,
  convertToBaseUnits,
  formatRange,
  formatScaledRange,
  formatTotalsForKey,
} from "../js/units.js";
import { test } from "./test_helpers.mjs";

test("convertToBaseUnits normalizes supported units and preserves custom units", () => {
  assert.deepEqual(convertToBaseUnits({ min: 1, max: 2 }, "cup"), { baseUnit: "tsp", min: 48, max: 96 });
  assert.deepEqual(convertToBaseUnits({ min: 0.5, max: 1 }, "lb"), { baseUnit: "oz", min: 8, max: 16 });
  assert.deepEqual(convertToBaseUnits({ min: 1, max: 1.5 }, "kg"), { baseUnit: "g", min: 1000, max: 1500 });
  assert.deepEqual(convertToBaseUnits({ min: 1, max: 2 }, "l"), { baseUnit: "ml", min: 1000, max: 2000 });
  assert.deepEqual(convertToBaseUnits({ min: 2, max: 3 }, "jar"), { baseUnit: "jar", min: 2, max: 3 });
  assert.equal(convertToBaseUnits(null, "cup"), null);
  assert.equal(convertToBaseUnits({ min: 1, max: 1 }, ""), null);
});

test("addRange and range formatting keep shopper-friendly quantities", () => {
  assert.deepEqual(addRange(null, { min: 1, max: 2 }), { min: 1, max: 2 });
  assert.deepEqual(addRange({ min: 0.5, max: 1.25 }, { min: 1.5, max: 2.75 }), { min: 2, max: 4 });

  assert.equal(formatRange({ min: 0.5, max: 0.5 }), "1/2");
  assert.equal(formatRange({ min: 1.25, max: 1.25 }), "1 1/4");
  assert.equal(formatRange({ min: 1, max: 1.5 }), "1-1 1/2");
  assert.equal(formatScaledRange({ min: 6, max: 12 }, 3), "2-4");
});

test("formatTotalsForKey converts base totals back into readable shopping amounts", () => {
  assert.equal(formatTotalsForKey({ tsp: { min: 6, max: 6 } }), "2 tbsp");
  assert.equal(formatTotalsForKey({ tsp: { min: 48, max: 72 } }), "1-1 1/2 cups");
  assert.equal(formatTotalsForKey({ oz: { min: 24, max: 24 } }), "1 1/2 lb");
  assert.equal(formatTotalsForKey({ ml: { min: 1500, max: 1500 } }), "1 1/2 L");
  assert.equal(
    formatTotalsForKey({ item: { min: 1, max: 2 }, jar: { min: 1, max: 1 } }, { canonicalKey: "potato" }),
    "1-2 potatoes + 1 jar"
  );
});
