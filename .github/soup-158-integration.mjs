import assert from "node:assert/strict";
import fs from "node:fs";

const soupIds = [
  "beef-mushroom-barley-soup",
  "harissa-red-lentil-sweet-potato-chickpea-soup",
  "lemon-rosemary-chicken-white-bean-kale-soup",
  "roasted-tomatillo-chicken-pozole-verde",
  "thai-red-curry-chicken-edamame-vegetable-soup",
];
const groups = [
  ["harissa paste", "Sauces, Marinades, & Condiments"],
  ["poblano pepper", "Vegetables"],
  ["thai red curry paste", "Sauces, Marinades, & Condiments"],
  ["white hominy", "Pantry"],
];

function edit(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) fs.writeFileSync(path, after);
}

function extendIds(text, indent) {
  const match = text.match(/const expectedIds = (\[[\s\S]*?\]);/);
  assert.ok(match, "Expected the existing scoped editorial-ID array");
  const ids = [...new Set([...JSON.parse(match[1]), ...soupIds])].sort();
  assert.equal(ids.length, 15);
  const array = `[\n${ids.map((id) => `${indent}  ${JSON.stringify(id)}`).join(",\n")}\n${indent}]`;
  return text.replace(match[0], `const expectedIds = ${array};`);
}

edit("tests/recipe_data_quality.test.mjs", (text) => {
  text = text.replace("the ten individually reviewed recipes", "the fifteen individually reviewed recipes");
  text = extendIds(text, "  ");
  if (!text.includes("const soupIds =")) {
    const array = JSON.stringify(soupIds, null, 2).replaceAll("\n", "\n  ");
    text = text.replace("  const expectedIds =", `  const soupIds = ${array};\n  const expectedIds =`);
  }
  const line = '      id === "oatmeal-with-fruit" ? "breakfast" : "main-dishes",';
  assert.ok(text.includes(line));
  if (!text.includes('...(soupIds.includes(id) ? ["soups-stews"] : [])')) {
    text = text.replace(line, `${line}\n      ...(soupIds.includes(id) ? ["soups-stews"] : []),`);
  }
  return text;
});

edit("scripts/smoke-browser.mjs", (text) => {
  text = extendIds(text, "      ");
  const start = text.indexOf("const browserChecks = [");
  const end = text.indexOf('name: "loads recipe data and renders the initial recipe stream"', start);
  assert.ok(start >= 0 && end > start);
  let section = text.slice(start, end);
  section = section.replace(
    'await page.waitForFunction(() => document.querySelectorAll(".recipe").length === 10);',
    'await page.waitForFunction((count) => document.querySelectorAll(".recipe").length === count, expectedIds.length);'
  );
  section = section.replace('await page.locator(".recipe-collection-badge:visible").count(), 20', 'await page.locator(".recipe-collection-badge:visible").count(), expectedIds.length * 2');
  section = section.replaceAll('await visibleRecipeCount(page), 10', 'await visibleRecipeCount(page), expectedIds.length');
  return text.slice(0, start) + section + text.slice(end);
});

edit("README.md", (text) => {
  assert.ok(text.includes("individually reviewed recipes under"));
  return text.replace("the ten individually reviewed recipes under", "the fifteen individually reviewed recipes under");
});

edit("docs/recipe-schema.md", (text) => {
  const anchor = "- `zaatar-pistachio-salmon-with-lemon-dill-barley`";
  assert.ok(text.includes(anchor));
  if (!text.includes("- `beef-mushroom-barley-soup`")) {
    text = text.replace(anchor, anchor + "\n" + soupIds.map((id) => `- \`${id}\``).join("\n"));
  }
  return text.replace("Preserve their existing Breakfast/Main Dishes membership.", "Preserve their Breakfast/Main Dishes membership and the five soups' Soups & Stews membership.");
});

edit("js/grouping.js", (text) => {
  const entries = groups.filter(([key]) => !text.includes(`${JSON.stringify(key)}:`));
  return text.replace("const ingredientGroups = {", "const ingredientGroups = {" + entries.map(([key, value]) => `\n  ${JSON.stringify(key)}: ${JSON.stringify(value)},`).join(""));
});

edit("tests/grouping.test.mjs", (text) => {
  const entries = groups.filter(([key]) => !text.includes(`[${JSON.stringify(key)},`));
  return text.replace("  const cases = [", "  const cases = [" + entries.map((entry) => `\n    ${JSON.stringify(entry)},`).join(""));
});

for (const id of soupIds) {
  const recipe = JSON.parse(fs.readFileSync(`data/recipes/${id}.json`, "utf8"));
  assert.equal(recipe.id, id);
  assert.equal(recipe.rating, null);
  assert.equal(recipe.tags.status, "not-tried");
  assert.equal(recipe.nutrition, null);
  assert.deepEqual(recipe.collections, ["main-dishes", "soups-stews", "health-conscious", "meal-prep-friendly"]);
  assert.ok(!/\btofu\b/i.test(recipe.ingredients.join(" ")));
  assert.ok(!/\bremaining\b|\brest of (?:the )?(?:salt|oil|broth)\b/i.test(recipe.instructions.join(" ")));
  assert.ok(recipe.groceryIngredients.every((entry) => Number.isFinite(entry.quantity) && entry.quantity > 0 && entry.unit));
  // Apply the same stable authoring format to only these five new source files.
  const sorted = Object.fromEntries(Object.entries(recipe).sort(([left], [right]) => left.localeCompare(right)));
  fs.writeFileSync(`data/recipes/${id}.json`, JSON.stringify(sorted, null, 2) + "\n");
}
console.log("Integrated five explicitly scoped soup recipes; temporary helper must be removed before completion.");
