import assert from "node:assert/strict";

import { formatNutritionLabel, getNutritionEntries } from "../js/nutrition.js";
import { test } from "./test_helpers.mjs";

test("nutrition entries preserve preferred order and include extension fields", () => {
  assert.deepEqual(
    getNutritionEntries({
      vitaminC: "12mg",
      calories: "100",
      customMineral: "3mg",
      protein: "4g",
      empty: "  ",
    }),
    [
      { key: "calories", label: "Calories", value: "100" },
      { key: "protein", label: "Protein", value: "4g" },
      { key: "vitaminC", label: "Vitamin C", value: "12mg" },
      { key: "customMineral", label: "Custom Mineral", value: "3mg" },
    ]
  );
});

test("nutrition labels remain readable for schema extension keys", () => {
  assert.equal(formatNutritionLabel("totalCarbohydrates"), "Total Carbohydrates");
  assert.equal(formatNutritionLabel("omega3Fat"), "Omega 3 Fat");
  assert.equal(formatNutritionLabel("vitamin_k"), "Vitamin K");
});
