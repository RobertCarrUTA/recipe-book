import { listen } from "./dom.js";
import {
  getRecipeDiscoveryResult,
  isRuntimeRecipeSort,
} from "./recipe_discovery.js";
import {
  getSelectedRecipeFilters,
  readFilterDataFromDom,
} from "./ui_state.js";

const DEFAULT_DEBOUNCE_MS = 150;

function noop() {}

function areRecipeIndexesEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;

  return left.every((value, index) => value === right[index]);
}

export function createRecipeDiscoveryController({
  debounceMs = DEFAULT_DEBOUNCE_MS,
  document = globalThis.document,
  getRecipes = () => [],
  getRuntimeState = () => ({}),
  getSearchTexts = () => [],
  getUiState = () => ({}),
  isFavorite = () => false,
  isSelected = () => false,
  renderer = null,
  saveState = noop,
  window = globalThis.window,
} = {}) {
  let lastRenderedRecipeIndexes = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function queryAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function getMutableUiState() {
    const uiState = getUiState();
    return uiState && typeof uiState === "object" ? uiState : {};
  }

  function renderFilteredRecipes(recipeIndexes) {
    if (!renderer) return;

    if (!areRecipeIndexesEqual(lastRenderedRecipeIndexes, recipeIndexes)) {
      renderer.renderRecipes({ recipeIndexes });
      lastRenderedRecipeIndexes = recipeIndexes.slice();
      return;
    }

    renderer.syncFavoriteRecipeIndicators();
    renderer.syncRecipeSelectionIndicators();
    renderer.syncMealPlanIndicators();
  }

  function syncRecipeSearchClearButton() {
    const recipeSearch = byId("recipeSearch");
    const clearSearchButton = byId("clearRecipeSearch");
    if (!clearSearchButton) return;

    clearSearchButton.hidden = !(recipeSearch && recipeSearch.value);
  }

  function syncRecipeFilterControls({
    activeDiscoveryFilterCount,
    filterText,
  }) {
    const filterToggle = byId("toggleFilters");
    const clearFiltersButton = byId("clearFilters");
    const recipeSearch = byId("recipeSearch");
    const recipeSearchWrap = recipeSearch ? recipeSearch.closest(".recipe-search") : null;
    const filterToggleText = activeDiscoveryFilterCount
      ? `Filters (${activeDiscoveryFilterCount})`
      : "Filters";

    if (filterToggle) {
      filterToggle.textContent = filterToggleText;
      filterToggle.classList.toggle("has-active-filters", activeDiscoveryFilterCount > 0);
      filterToggle.setAttribute(
        "aria-label",
        activeDiscoveryFilterCount
          ? `${activeDiscoveryFilterCount} recipe discovery controls active`
          : "Show recipe filters"
      );
    }

    if (clearFiltersButton) clearFiltersButton.disabled = activeDiscoveryFilterCount === 0;

    if (recipeSearchWrap) {
      recipeSearchWrap.classList.toggle("has-active-discovery-filters", activeDiscoveryFilterCount > 0);
      recipeSearchWrap.classList.toggle("has-search-text", Boolean(filterText));
    }

    syncRecipeSearchClearButton();
  }

  function updateSearchMeta(matchCount) {
    const meta = byId("recipeSearchMeta");
    const recipes = getRecipes();
    if (!meta) return;

    if (!recipes.length) {
      meta.textContent = "0 recipes";
      meta.classList.remove("is-filtered");
      return;
    }

    meta.classList.toggle("is-filtered", matchCount !== recipes.length);
    meta.textContent =
      matchCount === recipes.length
        ? `${recipes.length} recipes`
        : `${matchCount} matches of ${recipes.length}`;
  }

  function applyFilter(filterTextRaw) {
    const uiState = getMutableUiState();
    const selectedOnly = byId("showSelectedRecipesOnly");
    const favoriteOnly = byId("showFavoriteRecipesOnly");
    const recipes = getRecipes();
    const runtime = getRuntimeState();
    const discovery = getRecipeDiscoveryResult({
      filterText: filterTextRaw,
      isFavorite: (recipe, index) => isFavorite(runtime, recipe, index),
      isSelected: (recipe, index) => isSelected(runtime, recipe, index),
      recipes,
      searchTexts: getSearchTexts(),
      selectedFilters: getSelectedRecipeFilters(document),
      showFavoriteOnly: Boolean(favoriteOnly && favoriteOnly.checked),
      showSelectedOnly: Boolean(selectedOnly && selectedOnly.checked),
      sortMode: uiState.recipeSort,
    });

    renderFilteredRecipes(discovery.recipeIndexes);
    renderer.syncRecipeFilterTagStyles(discovery.selectedFilters);
    syncRecipeFilterControls({
      activeDiscoveryFilterCount: discovery.activeDiscoveryFilterCount,
      filterText: discovery.filterText,
    });
    updateSearchMeta(discovery.matchCount);

    const noResults = byId("recipeNoResults");
    if (noResults) noResults.hidden = !(recipes.length && discovery.matchCount === 0);
  }

  function refresh() {
    const recipeSearch = byId("recipeSearch");
    applyFilter(recipeSearch ? recipeSearch.value || "" : "");
  }

  function clear(options = {}) {
    const recipeSearch = byId("recipeSearch");
    const selectedOnly = byId("showSelectedRecipesOnly");
    const favoriteOnly = byId("showFavoriteRecipesOnly");
    const uiState = getMutableUiState();

    if (recipeSearch) recipeSearch.value = "";
    if (selectedOnly) selectedOnly.checked = false;
    if (favoriteOnly) favoriteOnly.checked = false;
    queryAll(".recipe-filters input").forEach((cb) => {
      cb.checked = false;
    });

    uiState.recipeSearch = "";
    uiState.filters = {};
    uiState.showSelectedRecipesOnly = false;
    uiState.showFavoriteRecipesOnly = false;
    refresh();
    saveState();
    if (options.focusSearch !== false && recipeSearch && typeof recipeSearch.focus === "function") {
      recipeSearch.focus();
    }
  }

  function findFilterCheckbox(filterKey, filterValue) {
    return queryAll(".recipe-filters input").find(
      (input) => input.dataset.filter === filterKey && input.value === filterValue
    );
  }

  function handleTagToggle(filterKey, filterValue) {
    const checkbox = findFilterCheckbox(filterKey, filterValue);
    if (!checkbox) return;

    checkbox.checked = !checkbox.checked;
    getMutableUiState().filters = readFilterDataFromDom(document);
    refresh();
    saveState();
  }

  function isControlChecked(id) {
    const control = byId(id);
    return Boolean(control && control.checked);
  }

  function isRecipeListRuntimeSorted() {
    return isRuntimeRecipeSort(getMutableUiState().recipeSort);
  }

  function shouldRefreshForFavoriteChange() {
    return isControlChecked("showFavoriteRecipesOnly") || isRecipeListRuntimeSorted();
  }

  function shouldRefreshForSelectionChange() {
    return isControlChecked("showSelectedRecipesOnly") || isRecipeListRuntimeSorted();
  }

  function attachRecipeSearch() {
    const recipeSearch = byId("recipeSearch");
    const clearSearchButton = byId("clearRecipeSearch");
    if (!recipeSearch) return;

    let debounceTimer = null;
    const clearRecipeSearchDebounce = () => {
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    };

    const runFilter = () => {
      clearRecipeSearchDebounce();
      getMutableUiState().recipeSearch = recipeSearch.value || "";
      applyFilter(getMutableUiState().recipeSearch);
      saveState();
    };

    listen(recipeSearch, "input", () => {
      clearRecipeSearchDebounce();
      syncRecipeSearchClearButton();
      debounceTimer = window.setTimeout(runFilter, debounceMs);
    });

    listen(recipeSearch, "keydown", (event) => {
      if (event.key !== "Escape") return;
      recipeSearch.value = "";
      runFilter();
      if (typeof recipeSearch.blur === "function") recipeSearch.blur();
    });

    listen(clearSearchButton, "click", () => {
      if (!recipeSearch.value) return;
      recipeSearch.value = "";
      runFilter();
      if (typeof recipeSearch.focus === "function") recipeSearch.focus();
    });

    syncRecipeSearchClearButton();
  }

  function attachFilterControls() {
    const filterToggle = byId("toggleFilters");
    const filters = byId("recipeFilters");
    const clearFiltersButton = byId("clearFilters");
    const clearDiscoveryButton = byId("clearRecipeDiscoveryFilters");

    if (filterToggle && filters) {
      listen(filterToggle, "click", () => {
        const isHidden = filters.classList.toggle("hidden");
        filterToggle.setAttribute("aria-expanded", isHidden ? "false" : "true");
      });
    }

    queryAll(".recipe-filters input").forEach((cb) => {
      listen(cb, "change", () => {
        getMutableUiState().filters = readFilterDataFromDom(document);
        refresh();
        saveState();
      });
    });

    listen(clearFiltersButton, "click", () => clear());
    listen(clearDiscoveryButton, "click", clear);
  }

  function attach() {
    attachRecipeSearch();
    attachFilterControls();
  }

  return {
    applyFilter,
    attach,
    clear,
    handleTagToggle,
    refresh,
    shouldRefreshForFavoriteChange,
    shouldRefreshForSelectionChange,
    updateSearchMeta,
  };
}
