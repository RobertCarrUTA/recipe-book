import {
  normalizeParsedIngredients,
  parseIngredient,
  parseStructuredGroceryIngredient,
} from "./ingredient_parser.js";
import { normalizeWhitespace } from "./normalization.js";
import { addRange, convertToBaseUnits } from "./units.js";

const manualGroceryKeyPrefix = "manual:";

export function createEmptyGroceryState() {
  return {
    totalsByKey: {},
    notesByKey: {},
    sourcesByKey: {},
  };
}

export function createRecipeRuntimeState(savedState = {}) {
  return {
    displayNamesByKey: {},
    favoriteRecipeIds: { ...(savedState.favoriteRecipeIds || {}) },
    grocery: {
      ...createEmptyGroceryState(),
      selectedRecipeIds: { ...(savedState.selectedRecipeIds || {}) },
    },
    groceryCheckedByKey: { ...(savedState.groceryCheckedByKey || {}) },
    manualGroceryItemsById: { ...(savedState.manualGroceryItemsById || {}) },
    selectedRecipeIds: { ...(savedState.selectedRecipeIds || {}) },
  };
}

export function getRecipeKey(recipe, index) {
  return recipe && recipe.id ? String(recipe.id) : `recipe-${index}`;
}

export function isRecipeSelected(runtimeState, recipe, index) {
  return Boolean(runtimeState.selectedRecipeIds[getRecipeKey(recipe, index)]);
}

export function isRecipeFavorite(runtimeState, recipe, index) {
  return Boolean(runtimeState.favoriteRecipeIds[getRecipeKey(recipe, index)]);
}

export function setRecipeFavorite(runtimeState, recipe, index, favorite) {
  const recipeKey = getRecipeKey(recipe, index);
  if (favorite) {
    runtimeState.favoriteRecipeIds[recipeKey] = true;
  } else {
    delete runtimeState.favoriteRecipeIds[recipeKey];
  }
}

export function setRecipeSelected(runtimeState, recipes, recipe, index, selected) {
  const recipeKey = getRecipeKey(recipe, index);
  if (selected) {
    runtimeState.selectedRecipeIds[recipeKey] = true;
  } else {
    delete runtimeState.selectedRecipeIds[recipeKey];
  }

  recomputeGroceryState(runtimeState, recipes);
}

export function setGroceryChecked(runtimeState, canonicalKey, checked) {
  if (checked) {
    runtimeState.groceryCheckedByKey[canonicalKey] = true;
  } else {
    delete runtimeState.groceryCheckedByKey[canonicalKey];
  }
}

export function getManualGroceryItemKey(id) {
  return `${manualGroceryKeyPrefix}${id}`;
}

export function isManualGroceryItemKey(canonicalKey) {
  return String(canonicalKey || "").startsWith(manualGroceryKeyPrefix);
}

function createManualGroceryItemId() {
  const randomPart =
    globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return String(randomPart).replace(/[^a-zA-Z0-9-]/g, "-");
}

function addManualItemToGroceryState(runtimeState, item) {
  if (!item || !item.id || !item.name) return;

  const key = getManualGroceryItemKey(item.id);
  runtimeState.displayNamesByKey[key] = item.name;
  runtimeState.grocery.notesByKey[key] = item.note ? [item.note] : ["manual item"];
  runtimeState.grocery.sourcesByKey[key] = [{ id: key, title: "Manual item" }];
}

export function addManualGroceryItem(runtimeState, name, options = {}) {
  const itemName = normalizeWhitespace(name);
  const note = normalizeWhitespace(options.note || "");
  if (!itemName) return null;

  const id = options.id || createManualGroceryItemId();
  const item = {
    id,
    name: itemName,
  };
  if (note) item.note = note;

  runtimeState.manualGroceryItemsById[id] = item;
  addManualItemToGroceryState(runtimeState, item);

  return item;
}

export function removeManualGroceryItem(runtimeState, canonicalKey) {
  if (!isManualGroceryItemKey(canonicalKey)) return false;

  const id = String(canonicalKey).slice(manualGroceryKeyPrefix.length);
  delete runtimeState.manualGroceryItemsById[id];
  delete runtimeState.groceryCheckedByKey[canonicalKey];
  delete runtimeState.displayNamesByKey[canonicalKey];
  delete runtimeState.grocery.totalsByKey[canonicalKey];
  delete runtimeState.grocery.notesByKey[canonicalKey];
  delete runtimeState.grocery.sourcesByKey[canonicalKey];
  return true;
}

export function clearCheckedGroceryItems(runtimeState) {
  Object.keys(runtimeState.groceryCheckedByKey || {}).forEach((canonicalKey) => {
    if (isManualGroceryItemKey(canonicalKey)) {
      removeManualGroceryItem(runtimeState, canonicalKey);
      return;
    }

    delete runtimeState.groceryCheckedByKey[canonicalKey];
  });
}

function addNoteForKey(groceryState, canonicalKey, note) {
  if (!note) return;
  groceryState.notesByKey[canonicalKey] = groceryState.notesByKey[canonicalKey] || [];
  if (!groceryState.notesByKey[canonicalKey].includes(note)) {
    groceryState.notesByKey[canonicalKey].push(note);
  }
}

function addUniqueNote(notes, note) {
  const normalized = normalizeWhitespace(note);
  if (normalized && !notes.includes(normalized)) notes.push(normalized);
}

function addSourceForKey(groceryState, canonicalKey, recipe, index, notes = []) {
  if (!recipe || !canonicalKey) return;

  const recipeId = getRecipeKey(recipe, index);
  const source = {
    id: recipeId,
    notes: [],
    title: recipe.title || "Untitled recipe",
  };

  groceryState.sourcesByKey[canonicalKey] = groceryState.sourcesByKey[canonicalKey] || [];
  const existingSource = groceryState.sourcesByKey[canonicalKey].find((existing) => existing.id === recipeId);
  if (existingSource) {
    existingSource.notes = existingSource.notes || [];
    notes.forEach((note) => addUniqueNote(existingSource.notes, note));
  } else {
    notes.forEach((note) => addUniqueNote(source.notes, note));
    groceryState.sourcesByKey[canonicalKey].push(source);
  }
}

function getParsedIngredientNotes(parsed) {
  const notes = [];
  if (parsed.optional) addUniqueNote(notes, "optional");
  if (Array.isArray(parsed.notes)) {
    parsed.notes.forEach((note) => addUniqueNote(notes, note));
  }
  if (parsed.nonQuantifiedMarker) addUniqueNote(notes, parsed.nonQuantifiedMarker);
  if (!parsed.quantityRange) addUniqueNote(notes, "amount not specified");
  return notes;
}

function getEffectiveUnit(parsed) {
  if (parsed.unitKey) return parsed.unitKey;

  const original = String(parsed.original || "").toLowerCase();
  const base = parsed.canonical ? parsed.canonical.base : "";

  if (base === "egg" && /\beggs?\b/.test(original)) return "egg";
  if (base === "egg yolk" || /\byolks?\b/.test(original)) return "yolk";
  if (base === "garlic" && /\bcloves?\b/.test(original)) return "clove";
  if (/\bsprigs?\b/.test(original)) return "sprig";
  if (/\bleaves\b|\bleaf\b/.test(original)) return "leaf";
  if (/\bstalks?\b/.test(original)) return "stalk";
  if (/\bsheets?\b/.test(original)) return "sheet";
  if (/\bslices?\b/.test(original)) return "slice";
  if (/\bsticks?\b/.test(original)) return "stick";
  if (/\bblocks?\b/.test(original)) return "block";
  if (/\bbags?\b/.test(original)) return "bag";
  if (/\bcans?\b/.test(original)) return "can";

  return "item";
}

function addParsedIngredientToTotals(runtimeState, parsed, sourceRecipe, sourceIndex) {
  if (!parsed || !parsed.canonical || !parsed.canonical.base) return;

  const groceryState = runtimeState.grocery;
  const canonicalKey = parsed.canonical.base;
  const ingredientNotes = getParsedIngredientNotes(parsed);
  runtimeState.displayNamesByKey[canonicalKey] = parsed.canonical.display || canonicalKey;
  addSourceForKey(groceryState, canonicalKey, sourceRecipe, sourceIndex, ingredientNotes);

  if (!groceryState.totalsByKey[canonicalKey]) {
    groceryState.totalsByKey[canonicalKey] = {};
  }

  ingredientNotes.forEach((note) => addNoteForKey(groceryState, canonicalKey, note));

  if (!parsed.quantityRange) {
    if (Object.keys(groceryState.totalsByKey[canonicalKey]).length === 0) {
      delete groceryState.totalsByKey[canonicalKey];
    }
    return;
  }

  const converted = convertToBaseUnits(parsed.quantityRange, getEffectiveUnit(parsed));
  if (!converted) return;

  if (!groceryState.totalsByKey[canonicalKey]) {
    groceryState.totalsByKey[canonicalKey] = {};
  }

  if (!groceryState.totalsByKey[canonicalKey][converted.baseUnit]) {
    groceryState.totalsByKey[canonicalKey][converted.baseUnit] = { min: 0, max: 0 };
  }

  groceryState.totalsByKey[canonicalKey][converted.baseUnit] = addRange(
    groceryState.totalsByKey[canonicalKey][converted.baseUnit],
    { min: converted.min, max: converted.max }
  );
}

export function getRecipeGroceryIngredients(recipe) {
  if (Array.isArray(recipe.groceryIngredients) && recipe.groceryIngredients.length) {
    return recipe.groceryIngredients.flatMap((entry) => normalizeParsedIngredients(parseStructuredGroceryIngredient(entry)));
  }

  if (!Array.isArray(recipe.ingredients)) return [];
  return recipe.ingredients.flatMap((ingredient) => normalizeParsedIngredients(parseIngredient(ingredient)));
}

export function recomputeGroceryState(runtimeState, recipes) {
  runtimeState.grocery = createEmptyGroceryState();
  runtimeState.displayNamesByKey = {};

  recipes.forEach((recipe, index) => {
    if (!isRecipeSelected(runtimeState, recipe, index)) return;
    getRecipeGroceryIngredients(recipe).forEach((parsed) => {
      addParsedIngredientToTotals(runtimeState, parsed, recipe, index);
    });
  });

  Object.values(runtimeState.manualGroceryItemsById || {}).forEach((item) => {
    addManualItemToGroceryState(runtimeState, item);
  });
}

export function selectAllRecipes(runtimeState, recipes) {
  runtimeState.selectedRecipeIds = {};
  recipes.forEach((recipe, index) => {
    runtimeState.selectedRecipeIds[getRecipeKey(recipe, index)] = true;
  });
  recomputeGroceryState(runtimeState, recipes);
}

export function clearGroceryState(runtimeState) {
  runtimeState.selectedRecipeIds = {};
  runtimeState.groceryCheckedByKey = {};
  runtimeState.manualGroceryItemsById = {};
  runtimeState.grocery = createEmptyGroceryState();
  runtimeState.displayNamesByKey = {};
}
