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
  const byId = (id) => document.getElementById(id);
  const groupToggle = byId("groupToggle");
  const selectedOnly = byId("showSelectedRecipesOnly");
  const favoriteOnly = byId("showFavoriteRecipesOnly");
  const keepAwake = byId("keepScreenAwake");
  const recipeSearch = byId("recipeSearch");

  return {
    ...currentUiState,
    filters: readFilterDataFromDom(document),
    groupItems: groupToggle ? Boolean(groupToggle.checked) : Boolean(currentUiState.groupItems),
    keepScreenAwake: keepAwake ? Boolean(keepAwake.checked) : Boolean(currentUiState.keepScreenAwake),
    recipeSearch: recipeSearch ? recipeSearch.value || "" : currentUiState.recipeSearch || "",
    showFavoriteRecipesOnly: favoriteOnly
      ? Boolean(favoriteOnly.checked)
      : Boolean(currentUiState.showFavoriteRecipesOnly),
    showSelectedRecipesOnly: selectedOnly
      ? Boolean(selectedOnly.checked)
      : Boolean(currentUiState.showSelectedRecipesOnly),
  };
}

export function applyUiStateToControls(document, uiState) {
  const byId = (id) => document.getElementById(id);
  const groupToggle = byId("groupToggle");
  const selectedOnly = byId("showSelectedRecipesOnly");
  const favoriteOnly = byId("showFavoriteRecipesOnly");
  const keepAwake = byId("keepScreenAwake");
  const recipeSearch = byId("recipeSearch");

  if (groupToggle) groupToggle.checked = Boolean(uiState.groupItems);
  if (selectedOnly) selectedOnly.checked = Boolean(uiState.showSelectedRecipesOnly);
  if (favoriteOnly) favoriteOnly.checked = Boolean(uiState.showFavoriteRecipesOnly);
  if (keepAwake) keepAwake.checked = Boolean(uiState.keepScreenAwake);
  if (recipeSearch) recipeSearch.value = uiState.recipeSearch || "";
  applyFilterDataToDom(document, uiState.filters);
}
