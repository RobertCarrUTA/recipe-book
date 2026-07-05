import fs from "node:fs/promises";

import { createNormalizationCatalogSnapshot } from "./normalization-catalog-snapshot.mjs";

const recipeDataUrl = new URL("../data/recipes.json", import.meta.url);
const snapshotUrl = new URL("../tests/fixtures/normalization_catalog_snapshot.json", import.meta.url);

const recipes = JSON.parse(await fs.readFile(recipeDataUrl, "utf8"));
const snapshot = createNormalizationCatalogSnapshot(recipes);

await fs.mkdir(new URL(".", snapshotUrl), { recursive: true });
await fs.writeFile(snapshotUrl, `${JSON.stringify(snapshot, null, 2)}\n`);

console.log(
  `Updated tests/fixtures/normalization_catalog_snapshot.json ` +
    `(${snapshot.labels.length} labels, ${snapshot.units.length} units).`
);
