import fs from "node:fs/promises";

import {
  analyzeRecipeDataQuality,
  formatRecipeDataQualityReport,
} from "../js/recipe_quality_report.js";
import { normalizeRecipeBook } from "../js/recipe_schema.js";

const recipeDataUrl = new URL("../data/recipes.json", import.meta.url);
const rawRecipes = JSON.parse(await fs.readFile(recipeDataUrl, "utf8"));
const { recipes, warnings } = normalizeRecipeBook(rawRecipes);
const report = analyzeRecipeDataQuality(recipes, { schemaWarnings: warnings });

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(formatRecipeDataQualityReport(report, { sourceLabel: "data/recipes.json" }));
}
