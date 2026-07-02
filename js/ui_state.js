import { normalizeRecipeSort } from "./recipe_sort.js";

const checkedControlBindings = Object.freeze([
  ["groupItems", "groupToggle"],
  ["hideCheckedGroceryItems", "hideCheckedGroceryItems"],
  ["keepScreenAwake", "keepScreenAwake"],
  ["showFavoriteRecipesOnly", "showFavoriteRecipesOnly"],
  ["showSelectedRecipesOnly", "showSelectedRecipesOnly"],
]);

function byId(document, id) {
  return document.getElementById(id);
}

function readCheckedControl(document, id, fallback) {
  const control = byId(document, id);
  return control ? Boolean(control.checked) : Boolean(fallback);
}

function writeCheckedControl(document, id, checked) {
  const control = byId(document, id);
  if (control) control.checked = Boolean(checked);
}

export function readFilterDataFromDom(document) {
  const data = {};
  document.querySelectorAll(".recipe-filters input:checked").forEach((checkbox) => {
    if (!checkbox.dataset.filter) return;
    if (!data[checkbox.dataset.filter]) data[checkbox.dataset.filter] = [];
    data[checkbox.dataset.filter].push(checkbox.value);
  });
  return data;
}

export function applyFilterDataToDom(document, data) {
  const selected = data || {};
  document.querySelectorAll(".recipe-filters input").forEach((checkbox) => {
    checkbox.checked =
      Array.isArray(selected[checkbox.dataset.filter]) && selected[checkbox.dataset.filter].includes(checkbox.value);
  });
}

export function getSelectedRecipeFilters(document) {
  const selected = {};
  document.querySelectorAll(".recipe-filters input:checked").forEach((checkbox) => {
    const key = checkbox.dataset.filter;
    if (!key) return;
    if (!selected[key]) selected[key] = new Set();
    selected[key].add(checkbox.value);
  });
  return selected;
}

export function readUiStateFromControls(document, currentUiState = {}) {
  const recipeSearch = byId(document, "recipeSearch");
  const recipeSort = byId(document, "recipeSort");
  const nextState = {
    ...currentUiState,
    filters: readFilterDataFromDom(document),
    recipeSearch: recipeSearch ? recipeSearch.value || "" : currentUiState.recipeSearch || "",
    recipeSort: normalizeRecipeSort(recipeSort ? recipeSort.value : currentUiState.recipeSort),
  };

  checkedControlBindings.forEach(([key, id]) => {
    nextState[key] = readCheckedControl(document, id, currentUiState[key]);
  });

  return nextState;
}

export function applyUiStateToControls(document, uiState) {
  const recipeSearch = byId(document, "recipeSearch");
  const recipeSort = byId(document, "recipeSort");

  checkedControlBindings.forEach(([key, id]) => {
    writeCheckedControl(document, id, uiState[key]);
  });
  if (recipeSearch) recipeSearch.value = uiState.recipeSearch || "";
  if (recipeSort) recipeSort.value = normalizeRecipeSort(uiState.recipeSort);
  applyFilterDataToDom(document, uiState.filters);
}
