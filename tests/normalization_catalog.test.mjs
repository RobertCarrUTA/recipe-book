import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { buildCanonicalIngredient, normalizeUnit } from "../js/normalization.js";
import { test } from "./test_helpers.mjs";

async function loadBundledRecipes() {
  const recipeDataUrl = new URL("../data/recipes.json", import.meta.url);
  return JSON.parse(await fs.readFile(recipeDataUrl, "utf8"));
}

async function loadExpectedCatalogSnapshot() {
  const snapshotUrl = new URL("./fixtures/normalization_catalog_snapshot.json", import.meta.url);
  return JSON.parse(await fs.readFile(snapshotUrl, "utf8"));
}

function createCatalogNormalizationSnapshot(recipes) {
  const labels = new Map();
  const units = new Set();

  recipes.forEach((recipe) => {
    (recipe.groceryIngredients || []).forEach((entry) => {
      if (!entry || typeof entry !== "object") return;

      const label = String(entry.item || entry.name || entry.canonical || entry.display || "").trim();
      if (label) labels.set(label.toLowerCase(), buildCanonicalIngredient(label.toLowerCase()));

      const unit = String(entry.unit || entry.units || "").trim();
      if (unit) units.add(unit);
    });
  });

  return {
    labels: [...labels]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([item, canonical]) => ({ item, canonical })),
    units: [...units].sort().map((unit) => ({ unit, normalized: normalizeUnit(unit) })),
  };
}

test("bundled grocery catalog normalization stays intentionally stable", async () => {
  const actual = createCatalogNormalizationSnapshot(await loadBundledRecipes());
  const expected = await loadExpectedCatalogSnapshot();

  assert.deepEqual(
    actual,
    expected,
    JSON.stringify(
      {
        actualLabelCount: actual.labels.length,
        expectedLabelCount: expected.labels.length,
        actualUnitCount: actual.units.length,
        expectedUnitCount: expected.units.length,
      },
      null,
      2
    )
  );
});
