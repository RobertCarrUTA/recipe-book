import {
  normalizeParsedIngredients,
  parseIngredient,
  parseStructuredGroceryIngredient,
} from "./ingredient_parser.js";
import { addRange, convertToBaseUnits } from "./units.js";

export function createEmptyGroceryState() {
  return {
    selectedRecipeIds: {},
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
    selectedRecipeIds: { ...(savedState.selectedRecipeIds || {}) },
  };
}

export function getRecipeKey(recipe, index) {
  return recipe && recipe.id ? String(recipe.id) : `recipe-${index}`;
}

export function getRecipeIndexByKey(recipes, recipeKey) {
  return recipes.findIndex((recipe, index) => getRecipeKey(recipe, index) === recipeKey);
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

function addNoteForKey(groceryState, canonicalKey, note) {
  if (!note) return;
  groceryState.notesByKey[canonicalKey] = groceryState.notesByKey[canonicalKey] || [];
  if (!groceryState.notesByKey[canonicalKey].includes(note)) {
    groceryState.notesByKey[canonicalKey].push(note);
  }
}

function addSourceForKey(groceryState, canonicalKey, recipe, index) {
  if (!recipe || !canonicalKey) return;

  const recipeId = getRecipeKey(recipe, index);
  const source = {
    id: recipeId,
    title: recipe.title || "Untitled recipe",
  };

  groceryState.sourcesByKey[canonicalKey] = groceryState.sourcesByKey[canonicalKey] || [];
  if (!groceryState.sourcesByKey[canonicalKey].some((existing) => existing.id === recipeId)) {
    groceryState.sourcesByKey[canonicalKey].push(source);
  }
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
  runtimeState.displayNamesByKey[canonicalKey] = parsed.canonical.display || canonicalKey;
  addSourceForKey(groceryState, canonicalKey, sourceRecipe, sourceIndex);

  if (!groceryState.totalsByKey[canonicalKey]) {
    groceryState.totalsByKey[canonicalKey] = {};
  }

  if (parsed.optional) addNoteForKey(groceryState, canonicalKey, "optional");
  if (Array.isArray(parsed.notes)) {
    parsed.notes.forEach((note) => addNoteForKey(groceryState, canonicalKey, note));
  }
  if (parsed.nonQuantifiedMarker) addNoteForKey(groceryState, canonicalKey, parsed.nonQuantifiedMarker);

  if (!parsed.quantityRange) {
    addNoteForKey(groceryState, canonicalKey, "amount not specified");
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
  runtimeState.grocery = {
    ...createEmptyGroceryState(),
    selectedRecipeIds: runtimeState.selectedRecipeIds,
  };
  runtimeState.displayNamesByKey = {};

  recipes.forEach((recipe, index) => {
    if (!isRecipeSelected(runtimeState, recipe, index)) return;
    getRecipeGroceryIngredients(recipe).forEach((parsed) => {
      addParsedIngredientToTotals(runtimeState, parsed, recipe, index);
    });
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
  runtimeState.grocery = createEmptyGroceryState();
  runtimeState.displayNamesByKey = {};
}
