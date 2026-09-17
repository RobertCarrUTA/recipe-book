import assert from "node:assert/strict";
import fs from "node:fs";

const ids = [
  "beef-mushroom-barley-soup",
  "harissa-red-lentil-sweet-potato-chickpea-soup",
  "lemon-rosemary-chicken-white-bean-kale-soup",
  "roasted-tomatillo-chicken-pozole-verde",
  "thai-red-curry-chicken-edamame-vegetable-soup",
];
const recipes = Object.fromEntries(ids.map((id) => [id, JSON.parse(fs.readFileSync(`data/recipes/${id}.json`, "utf8"))]));

const lemon = recipes["lemon-rosemary-chicken-white-bean-kale-soup"];
lemon.instructions[0] = "Pat 1 1/2 lb (680 g) chicken breast pieces dry. Toss with 1/4 tsp (1.5 g) fine sea salt and 1/4 tsp black pepper. Drain and rinse 3 cans (15 oz each) cannellini beans. Mash the contents of 1 can (about 240 g) with a fork; keep the contents of 2 cans (about 480 g) whole. Zest 2 lemons to obtain 2 tsp zest, then squeeze them to measure 1/4 cup (60 mL) juice.";
lemon.instructions[4] = "Pour in 6 cups (1.44 L) low-sodium chicken broth and scrape up the browned coating. Stir in the mashed beans from 1 can (about 240 g) and the whole beans from 2 cans (about 480 g). Bring to a gentle simmer, then cook partially covered for 8 minutes, until the carrots are nearly tender. Stir occasionally to prevent the mashed beans from sticking.";
lemon.instructions[5] = "Stir in 8 oz (227 g) chopped kale and simmer gently for 3 minutes. Add all browned chicken from the 680 g raw batch, including its collected juices, and simmer gently for 5-8 minutes, stirring occasionally, until several of the largest chicken pieces reach 165 F (74 C). The kale should be tender; if it needs longer, lift the cooked chicken into a clean bowl, finish the kale, then return the chicken off heat. Do not keep cooking chicken that has reached its temperature just to soften the greens.";
lemon.cookTime = "50 minutes";
lemon.totalTime = "1 hour 15 minutes";

const beef = recipes["beef-mushroom-barley-soup"];
beef.cookTime = "1 hour 20 minutes";
beef.totalTime = "1 hour 45 minutes";

const harissa = recipes["harissa-red-lentil-sweet-potato-chickpea-soup"];
assert.equal(harissa.instructions.length, 7, "First review's staged sweet-potato step must be present");
harissa.cookTime = "50 minutes";
harissa.totalTime = "1 hour 15 minutes";
const sweetPotato = harissa.groceryIngredients.find((entry) => entry.item === "sweet potato");
assert.ok(sweetPotato);
sweetPotato.quantity = 1.25;
sweetPotato.note = "buy about 567 g whole to supply the 454 g peeled cooking quantity";

const pozole = recipes["roasted-tomatillo-chicken-pozole-verde"];
assert.ok(pozole.instructions[2].includes("first vegetable portion"), "First review's two-batch puree must be present");
pozole.cookTime = "55 minutes";
pozole.totalTime = "1 hour 25 minutes";
pozole.instructions[4] = "Add 5 cups (1.2 L) chicken broth, about 500 g drained hominy from 2 cans, 1/4 tsp (1.5 g) fine sea salt, and 1/2 tsp black pepper. Bring just to a simmer. Halve 2 lb (907 g) chicken breasts horizontally where needed to make cutlets no thicker than 3/4 inch. Lower the cutlets into the broth, submerge them and return to a gentle simmer. Cook for 12-18 minutes, turning once, until each cutlet reaches 165 F (74 C) in its thickest part. Remove individual pieces as they reach temperature rather than continuing to cook the thinner ones.";

const thai = recipes["thai-red-curry-chicken-edamame-vegetable-soup"];
thai.notes = thai.notes.filter((note) => !note.startsWith("The tofu proposal"));

function sumDoses(recipe, ingredient) {
  const pattern = new RegExp(`(\\d+(?:/\\d+)?) tsp \\([\\d.]+ g\\) ${ingredient}`, "g");
  return [...recipe.instructions.join(" ").matchAll(pattern)].reduce((total, match) => {
    const [numerator, denominator = "1"] = match[1].split("/");
    return total + Number(numerator) / Number(denominator);
  }, 0);
}

// This audit is execution-only and is removed with the temporary helper.
assert.equal(sumDoses(lemon, "olive oil"), 6);
assert.equal(sumDoses(lemon, "fine sea salt"), 0.75);
assert.equal(sumDoses(beef, "olive oil"), 6);
assert.equal(sumDoses(beef, "fine sea salt"), 0.5);
assert.equal(sumDoses(harissa, "fine sea salt"), 0.5);
assert.equal(sumDoses(pozole, "fine sea salt"), 0.25);
assert.equal(sumDoses(thai, "canola oil"), 6);
assert.ok(thai.instructions[3].includes("1/2 cup (120 mL)"));
assert.ok(thai.instructions[4].includes("280 mL light coconut milk"));
assert.equal(120 + 280, 400);
assert.equal((pozole.instructions[2].match(/1\/4 cup \(30 g\) toasted pepitas/g) || []).length, 2);
assert.equal((pozole.instructions[2].match(/1\/4 cup \(8 g\) cilantro/g) || []).length, 2);
assert.equal((pozole.instructions[2].match(/1\/2 cup \(120 mL\) chicken broth/g) || []).length, 2);

for (const [id, recipe] of Object.entries(recipes)) {
  recipe.notes = recipe.notes.map((note) => note.startsWith("Developed and reviewed in writing;") ? "Developed and reviewed in writing; not yet kitchen-tested." : note);
  assert.equal(recipe.rating, null);
  assert.equal(recipe.tags.status, "not-tried");
  assert.equal(recipe.nutrition, null);
  assert.ok(!/\btofu\b/i.test(recipe.ingredients.join(" ")));
  assert.ok(!/\bremaining\b|\brest of (?:the )?(?:salt|oil|broth)\b/i.test(recipe.instructions.join(" ")));
  assert.ok(recipe.groceryIngredients.every((entry) => Number.isFinite(entry.quantity) && entry.quantity > 0 && entry.unit));
  fs.writeFileSync(`data/recipes/${id}.json`, JSON.stringify(recipe, null, 2) + "\n");
}
console.log("Second post-PR review applied; explicit split-dose audit passed for all five soups.");
