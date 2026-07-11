import {
  normalizeParsedIngredients,
  parseStructuredGroceryIngredient,
} from "./grocery_ingredient_parser.js";
import { normalizeWhitespace } from "./normalization.js";
import {
  DEFAULT_RECIPE_MULTIPLIER,
  normalizeRecipeMultiplier,
  normalizeRecipeMultiplierRecord,
} from "./recipe_multiplier.js";
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
    },
    groceryCheckedByKey: { ...(savedState.groceryCheckedByKey || {}) },
    manualGroceryItemsById: { ...(savedState.manualGroceryItemsById || {}) },
    recipeMultipliersById: normalizeRecipeMultiplierRecord(savedState.recipeMultipliersById),
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

export function getRecipeMultiplier(runtimeState, recipe, index) {
  const recipeKey = getRecipeKey(recipe, index);
  return normalizeRecipeMultiplier(runtimeState.recipeMultipliersById?.[recipeKey]);
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
    delete runtimeState.recipeMultipliersById[recipeKey];
  }

  recomputeGroceryState(runtimeState, recipes);
}

export function setRecipeMultiplier(runtimeState, recipes, recipe, index, multiplier) {
  const recipeKey = getRecipeKey(recipe, index);
  const normalized = normalizeRecipeMultiplier(multiplier, getRecipeMultiplier(runtimeState, recipe, index));

  if (Math.abs(normalized - DEFAULT_RECIPE_MULTIPLIER) < 1e-9) {
    delete runtimeState.recipeMultipliersById[recipeKey];
  } else {
    runtimeState.recipeMultipliersById[recipeKey] = normalized;
  }

  recomputeGroceryState(runtimeState, recipes);
  return normalized;
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

function addTotalsForSource(source, totals) {
  if (!totals) return;

  source.totals = source.totals || {};
  Object.keys(totals).forEach((unit) => {
    source.totals[unit] = addRange(source.totals[unit], totals[unit]);
  });
}

function applySourceMultiplier(source, multiplier) {
  if (Math.abs(multiplier - DEFAULT_RECIPE_MULTIPLIER) < 1e-9) {
    delete source.multiplier;
    return;
  }
  source.multiplier = multiplier;
}

function addSourceForKey(groceryState, canonicalKey, recipe, index, options = {}) {
  if (!recipe || !canonicalKey) return;

  const notes = options.notes || [];
  const totals = options.totals || null;
  const multiplier = normalizeRecipeMultiplier(options.multiplier);
  const recipeId = getRecipeKey(recipe, index);
  const source = {
    id: recipeId,
    notes: [],
    title: recipe.title || "Untitled recipe",
  };
  applySourceMultiplier(source, multiplier);

  groceryState.sourcesByKey[canonicalKey] = groceryState.sourcesByKey[canonicalKey] || [];
  const existingSource = groceryState.sourcesByKey[canonicalKey].find((existing) => existing.id === recipeId);
  if (existingSource) {
    existingSource.notes = existingSource.notes || [];
    notes.forEach((note) => addUniqueNote(existingSource.notes, note));
    applySourceMultiplier(existingSource, multiplier);
    addTotalsForSource(existingSource, totals);
  } else {
    notes.forEach((note) => addUniqueNote(source.notes, note));
    addTotalsForSource(source, totals);
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

function scaleRange(range, multiplier) {
  return {
    min: range.min * multiplier,
    max: range.max * multiplier,
  };
}

function addParsedIngredientToTotals(runtimeState, parsed, sourceRecipe, sourceIndex) {
  if (!parsed || !parsed.canonical || !parsed.canonical.base) return;

  const groceryState = runtimeState.grocery;
  const canonicalKey = parsed.canonical.base;
  const ingredientNotes = getParsedIngredientNotes(parsed);
  const multiplier = getRecipeMultiplier(runtimeState, sourceRecipe, sourceIndex);
  runtimeState.displayNamesByKey[canonicalKey] = parsed.canonical.display || canonicalKey;

  ingredientNotes.forEach((note) => addNoteForKey(groceryState, canonicalKey, note));

  if (!parsed.quantityRange) {
    addSourceForKey(groceryState, canonicalKey, sourceRecipe, sourceIndex, { multiplier, notes: ingredientNotes });
    return;
  }

  const converted = convertToBaseUnits(parsed.quantityRange, getEffectiveUnit(parsed));
  if (!converted) {
    addSourceForKey(groceryState, canonicalKey, sourceRecipe, sourceIndex, { multiplier, notes: ingredientNotes });
    return;
  }

  const scaledRange = scaleRange({ min: converted.min, max: converted.max }, multiplier);
  const convertedTotals = {
    [converted.baseUnit]: scaledRange,
  };
  addSourceForKey(groceryState, canonicalKey, sourceRecipe, sourceIndex, {
    multiplier,
    notes: ingredientNotes,
    totals: convertedTotals,
  });

  if (!groceryState.totalsByKey[canonicalKey]) {
    groceryState.totalsByKey[canonicalKey] = {};
  }

  if (!groceryState.totalsByKey[canonicalKey][converted.baseUnit]) {
    groceryState.totalsByKey[canonicalKey][converted.baseUnit] = { min: 0, max: 0 };
  }

  groceryState.totalsByKey[canonicalKey][converted.baseUnit] = addRange(
    groceryState.totalsByKey[canonicalKey][converted.baseUnit],
    scaledRange
  );
}

export function getRecipeGroceryIngredients(recipe) {
  const groceryIngredients = Array.isArray(recipe?.groceryIngredients) ? recipe.groceryIngredients : [];
  return groceryIngredients.flatMap((entry) => normalizeParsedIngredients(parseStructuredGroceryIngredient(entry)));
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

export function pruneRecipeRuntimeState(runtimeState, recipes) {
  const validRecipeIds = new Set(
    (Array.isArray(recipes) ? recipes : []).map((recipe, index) => getRecipeKey(recipe, index))
  );
  let changed = false;

  ["favoriteRecipeIds", "recipeMultipliersById", "selectedRecipeIds"].forEach((field) => {
    const record = runtimeState[field] || {};
    Object.keys(record).forEach((recipeId) => {
      if (validRecipeIds.has(recipeId)) return;
      delete record[recipeId];
      changed = true;
    });
    runtimeState[field] = record;
  });

  return changed;
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
  runtimeState.recipeMultipliersById = {};
  runtimeState.groceryCheckedByKey = {};
  runtimeState.manualGroceryItemsById = {};
  runtimeState.grocery = createEmptyGroceryState();
  runtimeState.displayNamesByKey = {};
}
