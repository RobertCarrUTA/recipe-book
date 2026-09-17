import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";

const labels = [
  "95% lean ground beef",
  "dried rosemary",
  "dried thyme",
  "fine sea salt",
  "light coconut milk",
  "no-salt-added black beans",
  "no-salt-added cannellini beans",
  "no-salt-added chickpeas",
  "no-salt-added crushed tomatoes",
  "no-salt-added diced tomatoes",
  "no-salt-added lentils",
  "no-salt-added tomato paste",
  "thai basil",
];

const rulesPath = "js/normalization_rules.js";
let rules = fs.readFileSync(rulesPath, "utf8");
const anchor = "export const leadingIngredientRules = freezeRuleList([";
assert.ok(rules.includes(anchor));
const entries = labels.filter((label) => !rules.includes(`includes: ${JSON.stringify(label)}, base: ${JSON.stringify(label)}`));
if (entries.length) {
  const inserted = entries.map((label) => `  { includes: ${JSON.stringify(label)}, base: ${JSON.stringify(label)} },`).join("\n");
  rules = rules.replace(anchor, `${anchor}\n  // Preserve shopping-critical qualifiers before salt, milk, meat and herb fallbacks.\n${inserted}`);
  fs.writeFileSync(rulesPath, rules);
}

const testsPath = "tests/grocery_ingredient_parser.test.mjs";
let tests = fs.readFileSync(testsPath, "utf8");
const title = "parseStructuredGroceryIngredient preserves sodium, fat and herb shopping distinctions";
if (!tests.includes(title)) {
  const testLabels = JSON.stringify(labels, null, 2).replaceAll("\n", "\n  ");
  tests += `\n\ntest(${JSON.stringify(title)}, () => {\n  const labels = ${testLabels};\n  for (const item of labels) {\n    const entry = parseStructuredGroceryIngredient({ item, quantity: 2, unit: "tbsp", note: "keep label specification" });\n    assert.equal(entry.canonical.base, item, item);\n    assert.equal(entry.canonical.display, item, item);\n    assert.deepEqual(entry.quantityRange, { min: 2, max: 2 });\n    assert.equal(entry.unitKey, "tbsp");\n    assert.deepEqual(entry.notes, ["keep label specification"]);\n  }\n  assert.equal(parseStructuredGroceryIngredient({ item: "salt", quantity: 1, unit: "tsp" }).canonical.base, "salt");\n  assert.equal(parseStructuredGroceryIngredient({ item: "coconut milk", quantity: 1, unit: "can" }).canonical.base, "coconut milk");\n  assert.equal(parseStructuredGroceryIngredient({ item: "basil", quantity: 1, unit: "cup" }).canonical.base, "basil");\n});\n`;
  fs.writeFileSync(testsPath, tests);
}

// These two exact source paths join the workflow's explicit generated-file allowlist.
// The workflow commits only after its full verification gate succeeds.
if (process.env.GITHUB_ACTIONS === "true") {
  childProcess.execFileSync("git", ["add", "--", rulesPath, testsPath], { stdio: "inherit" });
}
console.log("Preserved sodium, fat and herb shopping distinctions with a generic parser regression test.");
