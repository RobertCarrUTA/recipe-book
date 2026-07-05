import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { createNormalizationCatalogSnapshot } from "../scripts/normalization-catalog-snapshot.mjs";
import { test } from "./test_helpers.mjs";

async function loadBundledRecipes() {
  const recipeDataUrl = new URL("../data/recipes.json", import.meta.url);
  return JSON.parse(await fs.readFile(recipeDataUrl, "utf8"));
}

async function loadExpectedCatalogSnapshot() {
  const snapshotUrl = new URL("./fixtures/normalization_catalog_snapshot.json", import.meta.url);
  return JSON.parse(await fs.readFile(snapshotUrl, "utf8"));
}

test("bundled grocery catalog normalization stays intentionally stable", async () => {
  const actual = createNormalizationCatalogSnapshot(await loadBundledRecipes());
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
