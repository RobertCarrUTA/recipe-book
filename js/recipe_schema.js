import { normalizeWhitespace, repairTextEncoding } from "./normalization.js";
import { normalizeRecipeCollections } from "./recipe_collections.js";

const VALID_STATUS = new Set(["tried", "not-tried"]);
const VALID_RATING = new Set(["great", "good", "okay"]);
const VALID_DIFFICULTY = new Set(["easy", "medium", "hard"]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeString(value) {
  return normalizeWhitespace(repairTextEncoding(value));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeString).filter(Boolean);
}

function normalizeStringRecord(value) {
  if (!isPlainObject(value)) return {};

  return Object.keys(value).reduce((record, key) => {
    const normalizedKey = normalizeString(key);
    const normalizedValue = normalizeString(value[key]);
    if (normalizedKey && normalizedValue) record[normalizedKey] = normalizedValue;
    return record;
  }, {});
}

function normalizeOptionalString(target, key, value) {
  const normalized = normalizeString(value);
  if (normalized) target[key] = normalized;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function normalizeOptionalSourceLink(target, value, title, warnings) {
  const normalized = normalizeString(value);
  if (!normalized) return;

  if (isHttpUrl(normalized)) {
    target.link = normalized;
    return;
  }

  warnings.push(`"${title}" has an invalid source link and it was ignored.`);
}

function slugify(value, fallback) {
  const slug = normalizeString(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function normalizeRatingObject(value) {
  if (!isPlainObject(value)) return null;

  const rating = {};
  if (value.value !== undefined && value.value !== null && value.value !== "") {
    const numericValue = Number(String(value.value).replace(/,/g, ""));
    rating.value = Number.isFinite(numericValue) ? numericValue : normalizeString(value.value);
  }

  if (value.count !== undefined && value.count !== null && value.count !== "") {
    const numericCount = Number(String(value.count).replace(/,/g, ""));
    rating.count = Number.isFinite(numericCount) ? numericCount : normalizeString(value.count);
  }

  return Object.keys(rating).length ? rating : null;
}

function normalizeTags(value) {
  const input = isPlainObject(value) ? value : {};
  const tags = {};

  const status = normalizeString(input.status || "not-tried");
  tags.status = VALID_STATUS.has(status) ? status : "not-tried";

  const rating = normalizeString(input.rating);
  if (VALID_RATING.has(rating)) tags.rating = rating;

  const difficulty = normalizeString(input.difficulty);
  if (VALID_DIFFICULTY.has(difficulty)) tags.difficulty = difficulty;

  const equipment = normalizeStringArray(input.equipment).map((item) => slugify(item, ""));
  if (equipment.length) tags.equipment = [...new Set(equipment)];

  return tags;
}

function normalizeQuantity(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const normalized = normalizeString(value);
    return normalized || undefined;
  }

  if (isPlainObject(value)) {
    const min = Number(value.min);
    const max = Number(value.max);
    if (Number.isFinite(min) && Number.isFinite(max)) return { min, max };
  }

  return undefined;
}

function normalizeGroceryIngredient(entry) {
  if (!isPlainObject(entry)) return null;

  const item = normalizeString(entry.item || entry.name || entry.canonical || entry.display);
  if (!item) return null;

  const normalized = { item };
  const quantity = normalizeQuantity(entry.quantity !== undefined ? entry.quantity : entry.amount);
  if (quantity !== undefined) normalized.quantity = quantity;

  normalizeOptionalString(normalized, "unit", entry.unit || entry.units);
  normalizeOptionalString(normalized, "display", entry.display);
  normalizeOptionalString(normalized, "note", entry.note);
  normalizeOptionalString(normalized, "marker", entry.marker);
  normalizeOptionalString(normalized, "original", entry.original || entry.text);

  const notes = normalizeStringArray(entry.notes);
  if (notes.length) normalized.notes = notes;
  if (entry.optional) normalized.optional = true;

  return normalized;
}

function normalizeGroceryIngredients(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeGroceryIngredient).filter(Boolean);
}

export function normalizeRecipe(recipe, index, warnings = []) {
  if (!isPlainObject(recipe)) {
    warnings.push(`Recipe at index ${index} is not an object and was skipped.`);
    return null;
  }

  const title = normalizeString(recipe.title) || `Untitled Recipe ${index + 1}`;
  const collections = normalizeRecipeCollections(recipe.collections);
  const normalized = {
    id: slugify(recipe.id || title, `recipe-${index + 1}`),
    title,
    collections,
    ingredients: normalizeStringArray(recipe.ingredients),
    instructions: normalizeStringArray(recipe.instructions),
    tags: normalizeTags(recipe.tags),
  };

  if (!Array.isArray(recipe.collections) || !collections.length) {
    warnings.push(`"${title}" has no recognized recipe collections.`);
  } else if (collections.length !== recipe.collections.length) {
    warnings.push(`"${title}" has invalid or duplicate recipe collections.`);
  }

  normalizeOptionalString(normalized, "author", recipe.author);
  normalizeOptionalString(normalized, "description", recipe.description);
  normalizeOptionalString(normalized, "category", recipe.category);
  normalizeOptionalString(normalized, "prepTime", recipe.prepTime);
  normalizeOptionalString(normalized, "cookTime", recipe.cookTime);
  normalizeOptionalString(normalized, "additionalTime", recipe.additionalTime);
  normalizeOptionalString(normalized, "totalTime", recipe.totalTime);
  normalizeOptionalString(normalized, "servings", recipe.servings);
  normalizeOptionalString(normalized, "yield", recipe.yield);
  normalizeOptionalSourceLink(normalized, recipe.link, title, warnings);

  const equipment = normalizeStringArray(recipe.equipment);
  if (equipment.length) normalized.equipment = equipment;

  const notes = normalizeStringArray(recipe.notes);
  if (notes.length) normalized.notes = notes;

  const personalNotes = normalizeStringArray(recipe.personalNotes);
  if (personalNotes.length) normalized.personalNotes = personalNotes;

  const groceryIngredients = normalizeGroceryIngredients(recipe.groceryIngredients);
  if (Array.isArray(recipe.groceryIngredients) && groceryIngredients.length < recipe.groceryIngredients.length) {
    warnings.push(`"${title}" has invalid grocery ingredient entries.`);
  }
  if (groceryIngredients.length) normalized.groceryIngredients = groceryIngredients;

  const rating = normalizeRatingObject(recipe.rating);
  if (rating) normalized.rating = rating;

  const nutrition = normalizeStringRecord(recipe.nutrition);
  if (Object.keys(nutrition).length) normalized.nutrition = nutrition;

  if (!normalized.ingredients.length) {
    warnings.push(`"${normalized.title}" has no ingredient lines.`);
  }

  if (!normalized.groceryIngredients?.length) {
    warnings.push(`"${normalized.title}" has no grocery ingredient entries.`);
  }

  if (!normalized.instructions.length) {
    warnings.push(`"${normalized.title}" has no instruction steps.`);
  }

  return normalized;
}

export function normalizeRecipeBook(rawRecipes) {
  const warnings = [];

  if (!Array.isArray(rawRecipes)) {
    throw new Error("recipes.json must contain an array of recipes");
  }

  const recipes = rawRecipes
    .map((recipe, index) => normalizeRecipe(recipe, index, warnings))
    .filter(Boolean);

  const seenIds = new Set();
  recipes.forEach((recipe, index) => {
    if (!seenIds.has(recipe.id)) {
      seenIds.add(recipe.id);
      return;
    }

    warnings.push(`Duplicate recipe id "${recipe.id}" was made unique at index ${index}.`);
    recipe.id = `${recipe.id}-${index + 1}`;
    seenIds.add(recipe.id);
  });

  recipes.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

  return { recipes, warnings };
}
