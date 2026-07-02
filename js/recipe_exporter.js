import {
  formatRatingText,
  formatServingsText,
  getRecipeServingsText,
} from "./recipe_formatting.js";

const recipeExportFormats = new Set(["json", "text"]);
const recipeExportMimeTypes = Object.freeze({
  json: "application/json",
  text: "text/plain",
});
const recipeExportExtensions = Object.freeze({
  json: "json",
  text: "txt",
});

const nutritionLabelOrder = Object.freeze([
  ["calories", "Calories"],
  ["carbohydrates", "Carbohydrates"],
  ["protein", "Protein"],
  ["fat", "Fat"],
  ["saturatedFat", "Saturated Fat"],
  ["polyunsaturatedFat", "Polyunsaturated Fat"],
  ["monounsaturatedFat", "Monounsaturated Fat"],
  ["transFat", "Trans Fat"],
  ["cholesterol", "Cholesterol"],
  ["sodium", "Sodium"],
  ["fiber", "Fiber"],
  ["sugar", "Sugar"],
]);

function normalizeExportFormat(format) {
  const normalized = String(format || "text").toLowerCase();
  return recipeExportFormats.has(normalized) ? normalized : "text";
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function getRecipeSlug(recipe = {}) {
  const source = recipe.id || recipe.title || "recipe";
  const slug = String(source)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "recipe";
}

function pushMetaLine(lines, label, value) {
  if (hasValue(value)) lines.push(`${label}: ${value}`);
}

function pushListSection(lines, title, items, options = {}) {
  if (!Array.isArray(items) || !items.length) return;

  lines.push("", title);
  items.forEach((item, index) => {
    lines.push(options.ordered ? `${index + 1}. ${item}` : `- ${item}`);
  });
}

function getNutritionLines(nutrition) {
  if (!nutrition || !Object.keys(nutrition).length) return [];

  return nutritionLabelOrder
    .filter(([key]) => hasValue(nutrition[key]))
    .map(([key, label]) => `${label}: ${nutrition[key]}`);
}

export function getRecipeExportFileName(recipe = {}, format = "text") {
  const normalizedFormat = normalizeExportFormat(format);
  return `${getRecipeSlug(recipe)}.${recipeExportExtensions[normalizedFormat]}`;
}

export function createRecipeFormattedText(recipe = {}) {
  const lines = [recipe.title || "Recipe"];
  const metaLines = [];
  const servingsText = formatServingsText(getRecipeServingsText(recipe));
  const ratingText = formatRatingText(recipe.rating).trim();

  pushMetaLine(metaLines, "Category", recipe.category);
  pushMetaLine(metaLines, "Author", recipe.author);
  pushMetaLine(metaLines, "Rating", ratingText);
  pushMetaLine(metaLines, "Prep Time", recipe.prepTime);
  pushMetaLine(metaLines, "Cook Time", recipe.cookTime);
  pushMetaLine(metaLines, "Additional Time", recipe.additionalTime);
  pushMetaLine(metaLines, "Total Time", recipe.totalTime);
  pushMetaLine(metaLines, "Servings", servingsText);

  if (recipe.tags) {
    pushMetaLine(metaLines, "Status", recipe.tags.status);
    pushMetaLine(metaLines, "Difficulty", recipe.tags.difficulty);
  }

  if (metaLines.length) lines.push("", ...metaLines);
  if (recipe.description) lines.push("", recipe.description);

  pushListSection(lines, "Equipment", recipe.equipment);
  pushListSection(lines, "Ingredients", recipe.ingredients);
  pushListSection(lines, "Instructions", recipe.instructions, { ordered: true });
  pushListSection(lines, "Nutrition", getNutritionLines(recipe.nutrition));
  pushListSection(lines, "Notes", recipe.notes);
  pushListSection(lines, "Personal Notes", recipe.personalNotes);

  if (recipe.link) {
    lines.push("", "Source", recipe.link);
  }

  return `${lines.join("\n")}\n`;
}

export function createRecipeJsonText(recipe = {}) {
  return `${JSON.stringify(recipe, null, 2)}\n`;
}

export function createRecipeExportPayload(recipe = {}, format = "text") {
  const normalizedFormat = normalizeExportFormat(format);

  return {
    fileName: getRecipeExportFileName(recipe, normalizedFormat),
    format: normalizedFormat,
    mimeType: recipeExportMimeTypes[normalizedFormat],
    text: normalizedFormat === "json" ? createRecipeJsonText(recipe) : createRecipeFormattedText(recipe),
  };
}
