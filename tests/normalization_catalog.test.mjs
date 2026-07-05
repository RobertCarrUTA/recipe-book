import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";

import { buildCanonicalIngredient, normalizeUnit } from "../js/normalization.js";
import { test } from "./test_helpers.mjs";

const expectedCatalogNormalizationDigest = "5147c91e2cbc1bc4dbd462ff00c1c1ac9937b0146748f280933981b1815cd4ba";
const expectedCatalogLabelCount = 323;
const expectedCatalogUnitCount = 19;

async function loadBundledRecipes() {
  const recipeDataUrl = new URL("../data/recipes.json", import.meta.url);
  return JSON.parse(await fs.readFile(recipeDataUrl, "utf8"));
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

function createDigest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

test("bundled grocery catalog normalization stays intentionally stable", async () => {
  const snapshot = createCatalogNormalizationSnapshot(await loadBundledRecipes());
  const digest = createDigest(snapshot);

  assert.equal(snapshot.labels.length, expectedCatalogLabelCount);
  assert.equal(snapshot.units.length, expectedCatalogUnitCount);
  assert.equal(
    digest,
    expectedCatalogNormalizationDigest,
    JSON.stringify(
      {
        actualDigest: digest,
        expectedDigest: expectedCatalogNormalizationDigest,
        labelCount: snapshot.labels.length,
        unitCount: snapshot.units.length,
      },
      null,
      2
    )
  );
});
