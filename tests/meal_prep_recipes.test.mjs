import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { determineGroupForKey } from "../js/grouping.js";
import { test } from "./test_helpers.mjs";

const fixture = JSON.parse(await fs.readFile(new URL("./fixtures/meal_prep_156_nutrition.json", import.meta.url), "utf8"));
const recipes = await Promise.all(Object.keys(fixture.recipes).map(async (id) => JSON.parse(
  await fs.readFile(new URL(`../data/recipes/${id}.json`, import.meta.url), "utf8")
)));
const fields = {
  calories: ["Calories", 10, "kcal"], protein: ["Protein", 1, "g"],
  carbohydrates: ["Carbohydrates", 1, "g"], fat: ["Fat", 1, "g"],
  fiber: ["Fiber", 1, "g"], saturatedFat: ["Saturated fat", 0.5, "g"],
  sodium: ["Sodium", 25, "mg"],
};

test("five meal-prep recipes retain reviewed metadata, safety notes and explicit additions", () => {
  assert.equal(recipes.length, 5);
  assert.equal(recipes.reduce((sum, recipe) => sum + Number(recipe.servings), 0), 23);
  for (const recipe of recipes) {
    assert.equal(recipe.tags.status, "not-tried");
    assert.equal(recipe.rating, null);
    assert.deepEqual(recipe.collections, ["main-dishes", "health-conscious", "meal-prep-friendly"]);
    assert.match(recipe.totalTime, /^\d+ minutes$/);
    assert.ok(parseInt(recipe.totalTime, 10) <= 60);
    assert.ok(recipe.groceryIngredients.every((item) => Number.isFinite(item.quantity) && item.quantity > 0));
    assert.ok(recipe.groceryIngredients.every((item) => !/\btofu\b/i.test(item.item)));
    const notes = recipe.notes.join(" ");
    assert.match(notes, /3-4 days/);
    assert.match(notes, /40 F/);
    assert.match(notes, /165 F/);
    assert.match(notes, /not kitchen-tested/);
    assert.match(notes, /freeze/i);
    assert.doesNotMatch(recipe.instructions.join(" "), /\b(?:remaining|rest of|half (?:of )?the|divided (?:salt|oil))\b/i);
    // Text checks catch known regressions, not every possible ingredient error.
  }
});

test("meal-prep nutrition remains tied to the reviewed base ingredients and arithmetic", () => {
  for (const recipe of recipes) {
    const model = fixture.recipes[recipe.id];
    assert.equal(Number(recipe.servings), model.servings);
    assert.deepEqual(recipe.ingredients, model.ingredients, `${recipe.id}: review nutrition after changing base ingredients`);
    for (const [key, [label, increment, unit]] of Object.entries(fields)) {
      const total = Object.entries(model.batchGrams).reduce((sum, [profileId, grams]) => {
        const value = fixture.profiles[profileId]?.per100g[key];
        assert.ok(Number.isFinite(value) && value >= 0, `${profileId}.${key}`);
        assert.ok(Number.isFinite(grams) && grams > 0);
        return sum + value * grams / 100;
      }, 0) / model.servings;
      assert.ok(Math.abs(total - model.unroundedPerServing[key]) < 0.00001);
      const rounded = Math.round(total / increment) * increment;
      assert.equal(rounded, model.roundedPerServing[key]);
      assert.equal(recipe.nutrition[label], `About ${rounded} ${unit}`);
    }
  }
});

test("meal-prep split quantities, component yields and grocery groups retain fixes", () => {
  const byId = Object.fromEntries(recipes.map((recipe) => [recipe.id, recipe]));
  const salmon = byId["zaatar-pistachio-salmon-with-lemon-dill-barley"];
  const chicken = byId["ginger-sesame-chicken-soba"];
  assert.equal(salmon.groceryIngredients.find(({ item }) => item === "extra-virgin olive oil").quantity, 5);
  assert.equal(salmon.groceryIngredients.find(({ item }) => item === "Dijon mustard").quantity, 2);
  assert.match(salmon.notes.join(" "), /Allergens:.*mustard/);
  assert.match(chicken.instructions[0], /10 cups unsalted water/);
  assert.match(chicken.instructions[3], /already heating/);
  assert.match(chicken.instructions[6], /6-quart noodle pot/);
  assert.match(chicken.instructions.at(-1), /3 g toasted sesame seeds and 6 g sliced scallions/);
  assert.equal(determineGroupForKey("red wine vinegar"), "Sauces, Marinades, & Condiments");
  assert.equal(determineGroupForKey("red wine"), "Wine");
  assert.equal(determineGroupForKey("no-salt-added lentils"), "Pantry");
  assert.equal(determineGroupForKey("no-salt-added chickpeas"), "Pantry");
});
