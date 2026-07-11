import { normalizeWhitespace, parseQuantityRange, repairTextEncoding } from "./normalization.js";
import { normalizeRecipeCollections } from "./recipe_collections.js";

const VALID_STATUS = new Set(["tried", "not-tried"]);
const VALID_RATING = new Set(["great", "good", "okay"]);
const VALID_DIFFICULTY = new Set(["easy", "medium", "hard"]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeString(value) {
  if (typeof value !== "string") return "";
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

function normalizeOptionalString(target, key, value, title, warnings) {
  if (value === undefined || value === null || value === "") return;
  if (typeof value !== "string") {
    warnings.push(`"${title}" has an invalid ${key} value and it was ignored.`);
    return;
  }

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
  if (value !== undefined && value !== null && typeof value !== "string") {
    warnings.push(`"${title}" has an invalid source link and it was ignored.`);
    return;
  }
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

function normalizeRatingObject(value, title, warnings) {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) {
    warnings.push(`"${title}" has an invalid rating and it was ignored.`);
    return null;
  }

  const rating = {};
  if (value.value !== undefined && value.value !== null && value.value !== "") {
    if (typeof value.value === "number" && Number.isFinite(value.value) && value.value >= 0 && value.value <= 5) {
      rating.value = value.value;
    } else {
      warnings.push(`"${title}" has an invalid rating value and it was ignored.`);
    }
  }

  if (value.count !== undefined && value.count !== null && value.count !== "") {
    if (typeof value.count === "number" && Number.isSafeInteger(value.count) && value.count >= 0) {
      rating.count = value.count;
    } else {
      warnings.push(`"${title}" has an invalid rating count and it was ignored.`);
    }
  }

  return Object.keys(rating).length ? rating : null;
}

function normalizeTags(value, title, warnings) {
  if (value !== undefined && value !== null && !isPlainObject(value)) {
    warnings.push(`"${title}" has invalid tags and defaults were used.`);
  }
  const input = isPlainObject(value) ? value : {};
  const tags = {};

  const status = normalizeString(input.status || "not-tried");
  tags.status = VALID_STATUS.has(status) ? status : "not-tried";
  if (input.status !== undefined && input.status !== null && !VALID_STATUS.has(status)) {
    warnings.push(`"${title}" has an invalid status tag and it was defaulted.`);
  }

  const rating = normalizeString(input.rating);
  if (VALID_RATING.has(rating)) tags.rating = rating;
  else if (input.rating !== undefined && input.rating !== null && input.rating !== "") {
    warnings.push(`"${title}" has an invalid rating tag and it was ignored.`);
  }

  const difficulty = normalizeString(input.difficulty);
  if (VALID_DIFFICULTY.has(difficulty)) tags.difficulty = difficulty;
  else if (input.difficulty !== undefined && input.difficulty !== null && input.difficulty !== "") {
    warnings.push(`"${title}" has an invalid difficulty tag and it was ignored.`);
  }

  const equipment = normalizeStringArray(input.equipment)
    .map((item) => slugify(item, ""))
    .filter(Boolean);
  if (equipment.length) tags.equipment = [...new Set(equipment)];
  if (
    input.equipment !== undefined &&
    (!Array.isArray(input.equipment) || equipment.length !== input.equipment.length)
  ) {
    warnings.push(`"${title}" has invalid equipment tags and they were ignored.`);
  }

  return tags;
}

function normalizeQuantity(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;

  if (typeof value === "string") {
    const normalized = normalizeString(value);
    const range = parseQuantityRange(normalized);
    if (
      range &&
      Number.isFinite(range.min) &&
      Number.isFinite(range.max) &&
      range.min >= 0 &&
      range.max >= range.min
    ) {
      return normalized;
    }
    return undefined;
  }

  if (isPlainObject(value)) {
    const { min, max } = value;
    if (
      typeof min === "number" &&
      typeof max === "number" &&
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      min >= 0 &&
      max >= min
    ) {
      return { min, max };
    }
  }

  return undefined;
}

function normalizeGroceryIngredient(entry, title, warnings) {
  if (!isPlainObject(entry)) return null;

  const itemSource = [entry.item, entry.name, entry.canonical, entry.display]
    .find((value) => typeof value === "string" && normalizeString(value));
  const item = normalizeString(itemSource);
  if (!item) return null;

  const normalized = { item };
  const quantitySource = entry.quantity !== undefined ? entry.quantity : entry.amount;
  const quantity = normalizeQuantity(quantitySource);
  if (quantity !== undefined) normalized.quantity = quantity;
  else if (quantitySource !== undefined && quantitySource !== null && quantitySource !== "") {
    warnings.push(`"${title}" has an invalid grocery quantity for "${item}" and it was ignored.`);
  }

  normalizeOptionalString(normalized, "unit", entry.unit ?? entry.units, title, warnings);
  normalizeOptionalString(normalized, "display", entry.display, title, warnings);
  normalizeOptionalString(normalized, "note", entry.note, title, warnings);
  normalizeOptionalString(normalized, "marker", entry.marker, title, warnings);
  normalizeOptionalString(normalized, "original", entry.original ?? entry.text, title, warnings);

  const notes = normalizeStringArray(entry.notes);
  if (notes.length) normalized.notes = notes;
  if (entry.notes !== undefined && (!Array.isArray(entry.notes) || notes.length !== entry.notes.length)) {
    warnings.push(`"${title}" has invalid grocery notes for "${item}" and they were ignored.`);
  }
  if (entry.optional === true) normalized.optional = true;
  else if (entry.optional !== undefined && entry.optional !== false) {
    warnings.push(`"${title}" has an invalid optional flag for "${item}" and it was ignored.`);
  }

  return normalized;
}

function normalizeGroceryIngredients(value, title, warnings) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeGroceryIngredient(entry, title, warnings)).filter(Boolean);
}

function normalizeRecipeStringArray(recipe, key, title, warnings) {
  const value = recipe[key];
  if (value === undefined || value === null) return [];

  const normalized = normalizeStringArray(value);
  if (!Array.isArray(value) || normalized.length !== value.length) {
    warnings.push(`"${title}" has invalid ${key} entries and they were ignored.`);
  }
  return normalized;
}

export function normalizeRecipe(recipe, index, warnings = []) {
  if (!isPlainObject(recipe)) {
    warnings.push(`Recipe at index ${index} is not an object and was skipped.`);
    return null;
  }

  const title = normalizeString(recipe.title) || `Untitled Recipe ${index + 1}`;
  if (typeof recipe.title !== "string" || !normalizeString(recipe.title)) {
    warnings.push(`Recipe at index ${index} has an invalid title and a fallback was used.`);
  }
  const collections = normalizeRecipeCollections(recipe.collections);
  const rawId = typeof recipe.id === "string" ? recipe.id : title;
  if (recipe.id !== undefined && recipe.id !== null && typeof recipe.id !== "string") {
    warnings.push(`"${title}" has an invalid id and a fallback was used.`);
  }
  const normalized = {
    id: slugify(rawId || title, `recipe-${index + 1}`),
    title,
    collections,
    ingredients: normalizeRecipeStringArray(recipe, "ingredients", title, warnings),
    instructions: normalizeRecipeStringArray(recipe, "instructions", title, warnings),
    tags: normalizeTags(recipe.tags, title, warnings),
  };

  if (!Array.isArray(recipe.collections) || !collections.length) {
    warnings.push(`"${title}" has no recognized recipe collections.`);
  } else if (collections.length !== recipe.collections.length) {
    warnings.push(`"${title}" has invalid or duplicate recipe collections.`);
  }

  normalizeOptionalString(normalized, "author", recipe.author, title, warnings);
  normalizeOptionalString(normalized, "description", recipe.description, title, warnings);
  normalizeOptionalString(normalized, "category", recipe.category, title, warnings);
  normalizeOptionalString(normalized, "prepTime", recipe.prepTime, title, warnings);
  normalizeOptionalString(normalized, "cookTime", recipe.cookTime, title, warnings);
  normalizeOptionalString(normalized, "additionalTime", recipe.additionalTime, title, warnings);
  normalizeOptionalString(normalized, "totalTime", recipe.totalTime, title, warnings);
  normalizeOptionalString(normalized, "servings", recipe.servings, title, warnings);
  normalizeOptionalString(normalized, "yield", recipe.yield, title, warnings);
  normalizeOptionalSourceLink(normalized, recipe.link, title, warnings);

  const equipment = normalizeRecipeStringArray(recipe, "equipment", title, warnings);
  if (equipment.length) normalized.equipment = equipment;

  const notes = normalizeRecipeStringArray(recipe, "notes", title, warnings);
  if (notes.length) normalized.notes = notes;

  const personalNotes = normalizeRecipeStringArray(recipe, "personalNotes", title, warnings);
  if (personalNotes.length) normalized.personalNotes = personalNotes;

  const groceryIngredients = normalizeGroceryIngredients(recipe.groceryIngredients, title, warnings);
  if (
    recipe.groceryIngredients !== undefined &&
    (!Array.isArray(recipe.groceryIngredients) || groceryIngredients.length < recipe.groceryIngredients.length)
  ) {
    warnings.push(`"${title}" has invalid grocery ingredient entries.`);
  }
  if (groceryIngredients.length) normalized.groceryIngredients = groceryIngredients;

  const rating = normalizeRatingObject(recipe.rating, title, warnings);
  if (rating) normalized.rating = rating;

  const nutrition = normalizeStringRecord(recipe.nutrition);
  if (
    recipe.nutrition !== undefined &&
    recipe.nutrition !== null &&
    (!isPlainObject(recipe.nutrition) || Object.keys(nutrition).length !== Object.keys(recipe.nutrition).length)
  ) {
    warnings.push(`"${title}" has invalid nutrition entries and they were ignored.`);
  }
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
  if (!rawRecipes.length) {
    throw new Error("recipes.json must contain at least one recipe");
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
    const baseId = recipe.id;
    let suffix = 2;
    while (seenIds.has(`${baseId}-${suffix}`)) suffix += 1;
    recipe.id = `${baseId}-${suffix}`;
    seenIds.add(recipe.id);
  });

  recipes.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

  return { recipes, warnings };
}
