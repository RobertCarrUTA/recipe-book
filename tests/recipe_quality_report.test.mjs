import assert from "node:assert/strict";

import {
  analyzeRecipeDataQuality,
  formatRecipeDataQualityReport,
} from "../js/recipe_quality_report.js";
import { test } from "./test_helpers.mjs";

const recipes = [
  {
    id: "clean",
    title: "Clean Recipe",
    ingredients: ["1 cup flour"],
    instructions: ["Mix."],
    link: "https://example.com/clean",
    tags: { rating: "great", difficulty: "easy", status: "tried" },
    groceryIngredients: [
      { item: "all-purpose flour", quantity: 1, unit: "cup" },
      { item: "mystery crunch", quantity: 2, unit: "tsp" },
    ],
  },
  {
    id: "review",
    title: "Review Recipe",
    ingredients: ["Optional toppings: herbs"],
    instructions: ["Serve."],
    link: "notaurl",
    tags: { status: "not-tried" },
    groceryIngredients: [
      { item: "fresh baby spinach", quantity: 2, unit: "bundle", note: "to taste" },
      { item: "flaky salt" },
    ],
  },
  {
    id: "fallback",
    title: "Fallback Recipe",
    ingredients: ["3 garlic cloves"],
    instructions: ["Cook."],
    tags: { status: "not-tried" },
  },
  {
    id: "empty-fallback",
    title: "Empty Fallback Recipe",
    ingredients: ["Optional toppings: sour cream"],
    instructions: ["Top."],
    link: "https://example.com/empty",
    tags: { status: "not-tried" },
  },
  {
    id: "duplicate",
    title: "Duplicate Label Recipe",
    ingredients: ["1 cup baby spinach"],
    instructions: ["Cook."],
    link: "https://example.com/duplicate",
    tags: { difficulty: "easy", status: "not-tried" },
    groceryIngredients: [
      { item: "baby spinach", quantity: 1, unit: "cup" },
    ],
  },
];

test("analyzeRecipeDataQuality summarizes structural and advisory recipe data signals", () => {
  const report = analyzeRecipeDataQuality(recipes, { schemaWarnings: ["Example warning"] });

  assert.equal(report.recipeCount, 5);
  assert.deepEqual(report.schemaWarnings, ["Example warning"]);
  assert.equal(report.coverage.structuredGrocery.count, 3);
  assert.deepEqual(report.coverage.structuredGrocery.missing.map((item) => item.id), ["fallback", "empty-fallback"]);
  assert.equal(report.coverage.sourceLinks.count, 3);
  assert.deepEqual(report.coverage.sourceLinks.invalid.map((item) => item.title), ["Review Recipe"]);
  assert.equal(report.coverage.ratings.count, 1);
  assert.equal(report.coverage.difficulties.count, 2);
  assert.equal(report.grocery.parseFailures.length, 1);
  assert.equal(report.grocery.parseFailures[0].title, "Empty Fallback Recipe");
  assert.equal(report.grocery.unknownUnits.length, 1);
  assert.equal(report.grocery.unknownUnits[0].unit, "bundle");
  assert.equal(report.grocery.amountlessItems.length, 1);
  assert.equal(report.grocery.amountlessItems[0].item, "flaky salt");
  assert.equal(report.grocery.noisyStructuredNotes.length, 1);
  assert.equal(report.grocery.noisyStructuredNotes[0].note, "to taste");
  assert.ok(report.grocery.ungroupedLabels.some((item) => item.key === "mystery crunch"));
  assert.ok(report.grocery.duplicateLabelReviewGroups.some((group) => group.reviewKey === "baby spinach"));
});

test("formatRecipeDataQualityReport prints a readable Markdown report", () => {
  const report = analyzeRecipeDataQuality(recipes);
  const output = formatRecipeDataQualityReport(report, {
    maxItems: 2,
    sourceLabel: "fixture recipes",
  });

  assert.match(output, /^# Recipe Data Quality Report/m);
  assert.match(output, /Source: fixture recipes/);
  assert.match(output, /Structured grocery coverage: 3\/5/);
  assert.match(output, /Unknown grocery units: 1/);
  assert.match(output, /## Recommended Next Cleanup/);
  assert.match(output, /Review Recipe: fresh baby spinach uses unit "bundle"/);
  assert.match(output, /\.\.\.and 2 more recipes\./);
});
