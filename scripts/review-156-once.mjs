// Temporary, branch-scoped review helper for PR #157; remove before final handoff.
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs/promises";

const ids = [
  "berbere-turkey-lentil-braise",
  "chermoula-chickpea-cauliflower-farro",
  "citrus-mojo-pork-with-black-bean-quinoa",
  "ginger-sesame-chicken-soba",
  "zaatar-pistachio-salmon-with-lemon-dill-barley",
];
const branch = childProcess.execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
assert.equal(branch, "recipes/156-heart-conscious-meal-prep");
const recipes = Object.fromEntries(await Promise.all(ids.map(async (id) => [id,
  JSON.parse(await fs.readFile(`data/recipes/${id}.json`, "utf8")),
])));
function replaceOne(text, before, after) {
  assert.equal(text.split(before).length, 2, `Expected one occurrence: ${before}`);
  return text.replace(before, after);
}
function changeStep(recipe, prefix, text) {
  const index = recipe.instructions.findIndex((step) => step.startsWith(prefix));
  assert.notEqual(index, -1, prefix);
  recipe.instructions[index] = text;
}
function changeIngredient(recipe, prefix, text) {
  const index = recipe.ingredients.findIndex((line) => line.startsWith(prefix));
  assert.notEqual(index, -1, prefix);
  recipe.ingredients[index] = text;
}

const salmon = recipes[ids[4]];
salmon.groceryIngredients.push({ item: "Dijon mustard", quantity: 2, unit: "tsp", note: "10 g; choose at most 120 mg sodium per teaspoon." });
salmon.groceryIngredients.find(({ item }) => item === "lemon").note = "Need 3 tablespoons juice and 2 teaspoons finely grated zest.";
changeIngredient(salmon, "Salmon: 2 teaspoons", "Salmon: 2 teaspoons extra-virgin olive oil and 2 teaspoons (10 g) Dijon mustard");
changeIngredient(salmon, "Salmon: 1 1/2 tablespoons", "Salmon: 1 1/2 tablespoons salt-free zaatar seasoning, 2 teaspoons finely grated lemon zest, 1/8 teaspoon (0.75 g) fine sea salt and 1/4 teaspoon black pepper");
changeStep(salmon, "Season the salmon:", "Season the salmon: Pat four 5-oz salmon portions, 20 oz (567 g) total, thoroughly dry. Mix 2 teaspoons olive oil, 2 teaspoons (10 g) Dijon mustard, 1 1/2 tablespoons salt-free zaatar, 2 teaspoons lemon zest, 1/8 teaspoon (0.75 g) fine sea salt and 1/4 teaspoon black pepper directly over the tops and sides of the four portions, rubbing into a thin, even coating. Wash your hands and sanitize the raw-fish preparation area before handling cooked food or sauce.");
salmon.notes.push("Flavor review: A thin measured Dijon coating helps the lemon-zaatar seasoning cling to the salmon. Zest supplies citrus aroma without an acidic overnight fish marinade. The 2 teaspoons mustard are included in the whole batch, not added to each serving. Mustard adds sodium, so the recipe does not increase its existing measured salt.");

const turkey = recipes[ids[0]];
turkey.groceryIngredients.push({ item: "red wine vinegar", quantity: 2, unit: "tsp" });
turkey.ingredients.push("Braise finish: 2 teaspoons (10 mL) red wine vinegar");
changeStep(turkey, "Build the braise:", "Build the braise: Add 225 g diced yellow onion to the turkey and cook for 5 minutes, stirring. Stir in 2 tablespoons (32 g) tomato paste and cook for 90 seconds until slightly darker. Lower the heat to medium. Add 9 g minced garlic, 1 tablespoon (12 g) grated ginger, 1 tablespoon mild salt-free berbere, 1 tablespoon sweet paprika, 1 teaspoon cumin and 1/4 teaspoon cinnamon; stir for 30 seconds, then proceed immediately to the liquid ingredients. Do not keep frying the ground spices until they blacken.");
changeStep(turkey, "Finish and check doneness:", "Finish and check doneness: Fold 8 oz (227 g) baby spinach into the braise in two additions of 4 oz (113-114 g) each. Cook for 2-3 minutes until wilted. Check that the turkey crumbles and the surrounding braise reach at least 165 F. Turn off the heat and stir in 2 teaspoons (10 mL) red wine vinegar to brighten the tomato-lentil mixture.");

const chicken = recipes[ids[3]];
chicken.equipment = chicken.equipment.map((item) => item === "Large saucepan" ? "6-quart pot for cooking noodles and combining the finished meal" : item);
changeStep(chicken, "Combine and finish:", "Combine and finish in the emptied 6-quart noodle pot, not the crowded skillet: Put the noodles cooked from 8 oz dry soba, the cooked chicken made from 1 1/2 lb raw chicken, the cooked 1 1/2 cups edamame, and the roasted vegetables made from 8 oz shiitakes and 12 oz carrots into the pot. Scrape the bok choy and sauce made in the preceding two steps into the same pot. This transfers the sauce made with 1 tablespoon miso, 1 tablespoon tamari, 3 tablespoons vinegar, 3 tablespoons water and 1 tablespoon maple syrup; it does not call for another batch. Toss gently over low heat until hot, then turn off the heat and add 2 tablespoons (30 mL) lime juice, 2 teaspoons toasted sesame oil and 1 teaspoon gochugaru. No extra salt or soy sauce is called for.");

const pork = recipes[ids[2]];
pork.groceryIngredients.find(({ item }) => item === "orange").note = "Need 1/2 cup freshly squeezed juice and 1 teaspoon finely grated zest.";
pork.ingredients.push("Pork: 1 teaspoon finely grated orange zest");
pork.equipment.push("Large heatproof mixing bowl");
pork.instructions[0] = replaceOne(pork.instructions[0], "2 teaspoons garlic powder,", "1 teaspoon orange zest, 2 teaspoons garlic powder,");
changeStep(pork, "Make the salsa", "Make the salsa while the hot components cook: Combine 120 g diced red onion, 15 g minced jalapeno and 2 tablespoons (30 mL) lime juice in a clean bowl. Let stand for 5-10 minutes while preparing 3 cups (495 g) diced pineapple and 300 g diced red bell pepper. Stir the prepared pineapple and bell pepper into the lime-onion mixture with 1/2 cup (16 g) chopped cilantro. Refrigerate until portioning. The measured lime juice is used once, at the start of this step.");
changeStep(pork, "Sauce the pork:", "Sauce the pork: Slice the rested pork made from 2 lb raw tenderloin across the grain into 1/2-inch slices and place in the large heatproof mixing bowl. Pour the prepared mojo made from 1/2 cup orange juice, 9 g garlic, 1 teaspoon cumin, 1 teaspoon oregano, 1/4 teaspoon black pepper and 2 tablespoons lime juice over the slices and turn gently to coat. These quantities identify the sauce already prepared, not new ingredient additions. The wide bowl gives the sliced pork room that the small saucepan does not.");

const farro = recipes[ids[1]];
farro.ingredients.push("Greens: 2 tablespoons (30 mL) water for briefly steaming the kale");
farro.equipment = farro.equipment.map((item) => item === "Medium saucepan" ? "3-quart saucepan with lid" : item === "Large mixing bowl" ? "6-quart mixing bowl" : item);
changeStep(farro, "Soften the kale:", "Soften the kale: In the cleaned 6-quart mixing bowl, toss 10 oz (284 g) thinly sliced kale leaves with 2 tablespoons (30 mL) lemon juice and massage for 90 seconds. Transfer the massaged kale to the 3-quart saucepan with the cooked farro made from 150 g dry farro and 2 tablespoons (30 mL) water. Cover and steam over medium-low heat for 2-3 minutes, stirring once, until the kale is tender enough to eat comfortably. Return the kale and farro to the mixing bowl. This avoids relying on barley-like residual heat from farro that finished cooking much earlier.");
farro.instructions = farro.instructions.map((step) => step.replace("barley-like residual heat", "residual heat"));

for (const recipe of Object.values(recipes)) {
  await fs.writeFile(`data/recipes/${recipe.id}.json`, JSON.stringify(recipe, null, 2) + "\n");
}

// Preserve exact editorial scoping rather than weakening the membership assertions.
const expectedIds = [...ids, "chipotle-lime-chicken-with-sweet-potatoes", "oatmeal-with-fruit", "orange-ginger-chicken-with-brown-rice", "smoky-lemon-chicken-with-brown-rice", "tomato-balsamic-chicken-with-white-beans"].sort();
const qualityPath = "tests/recipe_data_quality.test.mjs";
let quality = await fs.readFile(qualityPath, "utf8");
quality = replaceOne(quality, "editorial collections are assigned only to the five reviewed oatmeal and chicken recipes", "editorial collections are assigned only to the ten individually reviewed recipes");
const oldList = /const expectedIds = \[\s*"chipotle-lime-chicken-with-sweet-potatoes",\s*"oatmeal-with-fruit",\s*"orange-ginger-chicken-with-brown-rice",\s*"smoky-lemon-chicken-with-brown-rice",\s*"tomato-balsamic-chicken-with-white-beans",\s*\];/;
assert.ok(oldList.test(quality));
quality = quality.replace(oldList, `const expectedIds = ${JSON.stringify(expectedIds, null, 2)};`);
await fs.writeFile(qualityPath, quality);
const smokePath = "scripts/smoke-browser.mjs";
let smoke = await fs.readFile(smokePath, "utf8");
assert.ok(oldList.test(smoke));
smoke = smoke.replace(oldList, `const expectedIds = ${JSON.stringify(expectedIds, null, 2)};`);
const smokeStart = smoke.indexOf('name: "editorial collections filter, persist, reset, and show badges');
const smokeEnd = smoke.indexOf('await page.fill("#recipeSearch", "oatmeal")', smokeStart);
assert.ok(smokeStart >= 0 && smokeEnd > smokeStart);
let scope = smoke.slice(smokeStart, smokeEnd);
scope = scope.replaceAll('document.querySelectorAll(".recipe").length === 5', 'document.querySelectorAll(".recipe").length === 10');
scope = scope.replaceAll('await visibleRecipeCount(page), 5', 'await visibleRecipeCount(page), 10');
scope = scope.replaceAll('loc ator', 'locator');
scope = scope.replaceAll('locator(".recipe-collection-badge:visible").count(), 10', 'locator(".recipe-collection-badge:visible").count(), 20');
smoke = smoke.slice(0, smokeStart) + scope + smoke.slice(smokeEnd);
await fs.writeFile(smokePath, smoke);

let readme = await fs.readFile("README.md", "utf8");
readme = replaceOne(readme, "the five reviewed oatmeal/chicken recipes", "the ten individually reviewed recipes");
await fs.writeFile("README.md", readme);
let schema = await fs.readFile("docs/recipe-schema.md", "utf8");
schema = replaceOne(schema, "Only the following recipes receive both labels in the initial reviewed set:", "The following recipes receive both labels after individual editorial review:");
schema = replaceOne(schema, "- `tomato-balsamic-chicken-with-white-beans`", "- `tomato-balsamic-chicken-with-white-beans`\n" + ids.map((id) => `- \`${id}\``).join("\n"));
await fs.writeFile("docs/recipe-schema.md", schema);

// Add missing grocery groups without collapsing specific low-sodium shopping labels.
const additions = {
  "almonds": "Baking", "barley": "Pantry", "bok choy": "Vegetables",
  "cabbage": "Vegetables", "cauliflower": "Vegetables", "chickpeas": "Pantry",
  "edamame": "Vegetables", "farro": "Pantry", "gochugaru": "Spices",
  "kale": "Vegetables", "lentils": "Pantry", "Medjool dates": "Fruit",
  "pepitas": "Pantry", "pineapple": "Fruit", "pomegranate": "Fruit",
  "quinoa": "Pantry", "salmon": "Meat", "scallion": "Vegetables",
  "soba noodles": "Pantry", "tahini": "Sauces, Marinades, & Condiments",
  "tamari": "Sauces, Marinades, & Condiments", "turmeric": "Spices",
  "white miso": "Sauces, Marinades, & Condiments",
};
let grouping = await fs.readFile("js/grouping.js", "utf8");
const groupLines = Object.entries(additions).map(([key, value]) => `  ${JSON.stringify(key.toLowerCase())}: ${JSON.stringify(value)},`).join("\n");
grouping = replaceOne(grouping, "const ingredientGroups = {", `const ingredientGroups = {\n${groupLines}`);
await fs.writeFile("js/grouping.js", grouping);
const html = await fs.readFile("index.html", "utf8");
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("-", "");
const versions = [...html.matchAll(new RegExp(`${date}-(\\d+)`, "g"))].map((m) => Number(m[1]));
const version = `${date}-${Math.max(0, ...versions) + 1}`;
childProcess.execFileSync("npm", ["run", "set-asset-version", "--", version], { stdio: "inherit" });
childProcess.execFileSync("npm", ["run", "build:recipes"], { stdio: "inherit" });
childProcess.execFileSync("npm", ["run", "update:normalization-snapshot"], { stdio: "inherit" });
console.log("Review 1 changes and generated catalog prepared. Inspect tests and diff before committing.");
