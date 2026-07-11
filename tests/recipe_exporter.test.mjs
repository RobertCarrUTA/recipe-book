import assert from "node:assert/strict";

import {
  createRecipeExportPayload,
  createRecipeFormattedText,
  getRecipeExportFileName,
} from "../js/recipe_exporter.js";
import { test } from "./test_helpers.mjs";

test("createRecipeFormattedText exports readable recipe sections", () => {
  const text = createRecipeFormattedText({
    author: "Robert",
    category: "Dinner",
    description: "A steady pot of chili.",
    equipment: ["Dutch oven"],
    ingredients: ["1 can beans", "2 cups broth"],
    instructions: ["Brown beef.", "Simmer."],
    link: "https://example.test/chili",
    notes: ["Serve with rice."],
    nutrition: {
      calories: "320",
      potassium: "410mg",
      protein: "18g",
      vitaminK2: "8mcg",
    },
    personalNotes: ["Use less salt."],
    prepTime: "10 minutes",
    rating: { count: 12, value: 4.8 },
    servings: "6",
    tags: {
      difficulty: "easy",
      status: "tried",
    },
    title: "Weeknight Chili",
    totalTime: "1 hour",
  });

  assert.match(text, /^Weeknight Chili\n\nCategory: Dinner\nAuthor: Robert\nRating: 4\.8 stars \(12 reviews\)/);
  assert.match(text, /\nIngredients\n- 1 can beans\n- 2 cups broth\n\nInstructions\n1\. Brown beef\.\n2\. Simmer\./);
  assert.match(text, /\nNutrition\n- Calories: 320\n- Protein: 18g/);
  assert.match(text, /- Potassium: 410mg/);
  assert.match(text, /- Vitamin K 2: 8mcg/);
  assert.match(text, /\nPersonal Notes\n- Use less salt\./);
  assert.ok(text.endsWith("https://example.test/chili\n"));
});

test("createRecipeExportPayload builds JSON recipe downloads", () => {
  const recipe = {
    id: "weeknight-chili",
    ingredients: ["1 can beans"],
    instructions: ["Simmer."],
    title: "Weeknight Chili",
  };
  const payload = createRecipeExportPayload(recipe, "json");

  assert.equal(payload.fileName, "weeknight-chili.json");
  assert.equal(payload.format, "json");
  assert.equal(payload.mimeType, "application/json");
  assert.deepEqual(JSON.parse(payload.text), recipe);
});

test("recipe export file names use simple safe slugs", () => {
  assert.equal(getRecipeExportFileName({ title: "Dad's Chili & Rice" }, "text"), "dad-s-chili-and-rice.txt");
  assert.equal(getRecipeExportFileName({ id: "chicken-fried-steak" }, "json"), "chicken-fried-steak.json");
});
