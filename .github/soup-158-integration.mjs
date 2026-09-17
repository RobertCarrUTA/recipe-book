import assert from "node:assert/strict";
import fs from "node:fs";

function editRecipe(id, transform) {
  const path = `data/recipes/${id}.json`;
  const recipe = JSON.parse(fs.readFileSync(path, "utf8"));
  assert.equal(recipe.id, id);
  transform(recipe);
  fs.writeFileSync(path, JSON.stringify(recipe, null, 2) + "\n");
}

// First written post-PR review: retain every ingredient total.
editRecipe("harissa-red-lentil-sweet-potato-chickpea-soup", (recipe) => {
  if (recipe.instructions[2].includes("1 lb (454 g) sweet potato cubes")) {
    assert.equal(recipe.instructions.length, 6);
    recipe.instructions[2] = "Add 6 cups (1.44 L) low-sodium vegetable broth, 1 1/2 cups (300 g) rinsed split red lentils, 1/4 tsp (1.5 g) fine sea salt, and 1/2 tsp black pepper. Scrape the base of the pot, bring to a boil, then simmer gently with the lid slightly ajar for 8 minutes. Stir every few minutes, scraping the bottom.";
    recipe.instructions.splice(3, 0, "Add 1 lb (454 g) sweet potato cut into 1/2-inch cubes. Continue simmering gently for 12-15 minutes, stirring regularly, until the lentils are breaking down and the sweet potato is almost tender. Giving the lentils an 8-minute head start helps the sweet potato retain pieces rather than dissolve during cooking and reheating.");
  }
  assert.equal(recipe.instructions.length, 7);
});

editRecipe("roasted-tomatillo-chicken-pozole-verde", (recipe) => {
  recipe.instructions[2] = "Let the roasted vegetables cool for 5 minutes. Peel the 6 roasted garlic cloves and remove any loose, blackened pepper skin. Divide the complete roasted vegetable mixture and pan juices into 2 equal portions. Blend the first vegetable portion with 1/4 cup (30 g) toasted pepitas, 1/4 cup (8 g) cilantro, and 1/2 cup (120 mL) chicken broth until mostly smooth; transfer to a bowl. Blend the second vegetable portion with 1/4 cup (30 g) toasted pepitas, 1/4 cup (8 g) cilantro, and 1/2 cup (120 mL) chicken broth, then combine the two purees. Use a blender rated for warm liquids, leave the manufacturer's required headroom and vent its lid as directed; do not use a sealed personal-blender cup with hot ingredients.";
  if (!recipe.equipment.includes("Mixing bowl for the two puree batches")) {
    recipe.equipment.push("Mixing bowl for the two puree batches");
  }
});

const ids = [
  "beef-mushroom-barley-soup",
  "harissa-red-lentil-sweet-potato-chickpea-soup",
  "lemon-rosemary-chicken-white-bean-kale-soup",
  "roasted-tomatillo-chicken-pozole-verde",
  "thai-red-curry-chicken-edamame-vegetable-soup",
];
for (const id of ids) {
  const recipe = JSON.parse(fs.readFileSync(`data/recipes/${id}.json`, "utf8"));
  assert.equal(recipe.rating, null);
  assert.equal(recipe.tags.status, "not-tried");
  assert.ok(!/\btofu\b/i.test(recipe.ingredients.join(" ")));
  assert.ok(!/\bremaining\b|\brest of (?:the )?(?:salt|oil|broth)\b/i.test(recipe.instructions.join(" ")));
}
console.log("Applied first post-PR flavor/texture review without changing ingredient totals.");
