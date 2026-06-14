import {
  clearGroceryState,
  createRecipeRuntimeState,
  getRecipeKey,
  isRecipeFavorite,
  isRecipeSelected,
  recomputeGroceryState,
  selectAllRecipes,
  setGroceryChecked,
  setRecipeFavorite,
  setRecipeSelected,
} from "./grocery_model.js";
import { attachCookingModeControls } from "./cooking_controls.js";
import { createLogger, isDebugEnabled } from "./logger.js";
import { createMobileViewController } from "./mobile_view_controller.js";
import {
  buildRecipeSearchText,
  normalizeForSearch,
  recipeMatchesVisibilityOptions,
} from "./recipe_filter.js";
import { createRecipeRepository } from "./recipe_repository.js";
import { createRenderer } from "./render.js";
import {
  clearGroceryPersistence,
  createDefaultUiState,
  restorePersistentState,
  savePersistentState,
} from "./storage.js";
import {
  applyUiStateToControls as applyUiStateToDomControls,
  getSelectedRecipeFilters,
  readFilterDataFromDom,
  readUiStateFromControls,
} from "./ui_state.js";
import { createWakeLockController } from "./wake_lock_controller.js";

const DEBOUNCE_MS = 150;

function attachGlobalErrorHandlers(logger) {
  window.addEventListener("error", (event) => {
    logger.error("Unhandled error", event.error || event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    logger.error("Unhandled promise rejection", event.reason);
  });
}

function createRecipeBookApp() {
  const logger = createLogger("recipe-book", { debugEnabled: isDebugEnabled() });
  const recipeRepository = createRecipeRepository({ logger });
  const restored = restorePersistentState();
  const appState = {
    recipes: [],
    runtime: createRecipeRuntimeState(restored),
    ui: {
      ...createDefaultUiState(),
      ...(restored.ui || {}),
    },
  };
  let renderer = null;
  let mobileViewController = null;
  let wakeLockController = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function syncUiStateFromControls() {
    appState.ui = readUiStateFromControls(document, appState.ui);
  }

  function saveAppState() {
    syncUiStateFromControls();
    savePersistentState(appState);
  }

  function applyUiStateToControls() {
    applyUiStateToDomControls(document, appState.ui);
  }

  function applyRecipeFilter(filterTextRaw) {
    const filterText = normalizeForSearch(filterTextRaw);
    const selected = getSelectedRecipeFilters(document);
    const recipeElements = Array.from(document.querySelectorAll(".recipe"));
    const selectedOnly = byId("showSelectedRecipesOnly");
    const favoriteOnly = byId("showFavoriteRecipesOnly");
    const showSelectedOnly = Boolean(selectedOnly && selectedOnly.checked);
    const showFavoriteOnly = Boolean(favoriteOnly && favoriteOnly.checked);
    let visibleCount = 0;

    recipeElements.forEach((recipeElement) => {
      const recipeIndex = Number(recipeElement.dataset.recipeIndex);
      const recipe = Number.isFinite(recipeIndex) ? appState.recipes[recipeIndex] : null;
      const haystack = recipeElement.dataset.searchText || "";
      const matches = recipeMatchesVisibilityOptions({
        filterText,
        isFavorite: recipe ? isRecipeFavorite(appState.runtime, recipe, recipeIndex) : true,
        isSelected: recipe ? isRecipeSelected(appState.runtime, recipe, recipeIndex) : true,
        recipe,
        searchText: haystack,
        selectedFilters: selected,
        showFavoriteOnly,
        showSelectedOnly,
      });

      recipeElement.style.display = matches ? "" : "none";

      if (!matches) {
        const content = recipeElement.querySelector(".accordion-content");
        if (content) content.classList.remove("open");
      } else {
        visibleCount += 1;
      }
    });

    renderer.syncRecipeFilterTagStyles(selected);

    const meta = byId("recipeSearchMeta");
    if (meta) {
      meta.textContent = recipeElements.length
        ? `Showing ${visibleCount} of ${recipeElements.length}`
        : `Showing ${recipeElements.length}`;
    }
  }

  function refreshRecipeListFilter() {
    const recipeSearch = byId("recipeSearch");
    applyRecipeFilter(recipeSearch ? recipeSearch.value || "" : "");
  }

  function findFilterCheckbox(filterKey, filterValue) {
    return Array.from(document.querySelectorAll(".recipe-filters input")).find(
      (input) => input.dataset.filter === filterKey && input.value === filterValue
    );
  }

  function handleRecipeTagToggle(filterKey, filterValue) {
    const checkbox = findFilterCheckbox(filterKey, filterValue);
    if (!checkbox) return;

    checkbox.checked = !checkbox.checked;
    appState.ui.filters = readFilterDataFromDom(document);
    refreshRecipeListFilter();
    saveAppState();
  }

  function handleFavoriteRecipe(recipe, recipeIndex, favorite) {
    setRecipeFavorite(appState.runtime, recipe, recipeIndex, favorite);
    renderer.syncFavoriteRecipeIndicators();
    refreshRecipeListFilter();
    saveAppState();
  }

  function handleSelectRecipe(recipe, recipeIndex, selected) {
    setRecipeSelected(appState.runtime, appState.recipes, recipe, recipeIndex, selected);
    renderer.renderGroceryList();
    renderer.syncRecipeSelectionIndicators();
    refreshRecipeListFilter();
    saveAppState();
  }

  function handleViewGroceryList() {
    mobileViewController.setMobileView("grocery");
    const groceryPanel = byId("groceryPanel");
    if (groceryPanel) groceryPanel.scrollIntoView({ block: "start" });
  }

  function handleGroceryCheckedChange(canonicalKey, checked) {
    setGroceryChecked(appState.runtime, canonicalKey, checked);
    saveAppState();
  }

  function clearGroceryList() {
    clearGroceryState(appState.runtime);
    clearGroceryPersistence();
    renderer.renderGroceryList();
    renderer.syncRecipeCheckboxes();
    refreshRecipeListFilter();
    saveAppState();
  }

  function addAllRecipesToGroceryList() {
    clearGroceryState(appState.runtime);
    selectAllRecipes(appState.runtime, appState.recipes);
    renderer.renderGroceryList();
    renderer.syncRecipeCheckboxes();
    refreshRecipeListFilter();
    saveAppState();
  }

  function attachRecipeSearch() {
    const recipeSearch = byId("recipeSearch");
    if (!recipeSearch) return;

    let debounceTimer = null;
    const runFilter = () => {
      appState.ui.recipeSearch = recipeSearch.value || "";
      applyRecipeFilter(appState.ui.recipeSearch);
      saveAppState();
    };

    recipeSearch.addEventListener("input", () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(runFilter, DEBOUNCE_MS);
    });

    recipeSearch.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      recipeSearch.value = "";
      runFilter();
      recipeSearch.blur();
    });
  }

  function attachFilterControls() {
    const filterToggle = byId("toggleFilters");
    const filters = byId("recipeFilters");
    const clearFiltersButton = byId("clearFilters");

    if (filterToggle && filters) {
      filterToggle.addEventListener("click", () => {
        const isHidden = filters.classList.toggle("hidden");
        filterToggle.setAttribute("aria-expanded", isHidden ? "false" : "true");
      });
    }

    document.querySelectorAll(".recipe-filters input").forEach((cb) => {
      cb.addEventListener("change", () => {
        appState.ui.filters = readFilterDataFromDom(document);
        refreshRecipeListFilter();
        saveAppState();
      });
    });

    if (clearFiltersButton) {
      clearFiltersButton.addEventListener("click", () => {
        document.querySelectorAll(".recipe-filters input").forEach((cb) => {
          cb.checked = false;
        });
        appState.ui.filters = {};
        refreshRecipeListFilter();
        saveAppState();
      });
    }
  }

  function attachPrimaryControls() {
    const groupToggle = byId("groupToggle");
    const selectedOnly = byId("showSelectedRecipesOnly");
    const favoriteOnly = byId("showFavoriteRecipesOnly");
    const clearButton = byId("clearGroceryList");
    const addAllButton = byId("addAllRecipesToGroceryList");

    if (groupToggle) {
      groupToggle.addEventListener("change", () => {
        appState.ui.groupItems = groupToggle.checked;
        renderer.renderGroceryList();
        saveAppState();
      });
    }

    if (selectedOnly) {
      selectedOnly.addEventListener("change", () => {
        appState.ui.showSelectedRecipesOnly = selectedOnly.checked;
        refreshRecipeListFilter();
        saveAppState();
      });
    }

    if (favoriteOnly) {
      favoriteOnly.addEventListener("change", () => {
        appState.ui.showFavoriteRecipesOnly = favoriteOnly.checked;
        refreshRecipeListFilter();
        saveAppState();
      });
    }

    if (clearButton) clearButton.addEventListener("click", clearGroceryList);
    if (addAllButton) addAllButton.addEventListener("click", addAllRecipesToGroceryList);
  }

  function exposeDebugApi() {
    if (!isDebugEnabled()) return;

    window.recipeBookDebug = Object.freeze({
      getState: () => ({
        recipes: appState.recipes,
        runtime: appState.runtime,
        ui: appState.ui,
      }),
      refreshRecipeListFilter,
      renderGroceryList: () => renderer.renderGroceryList(),
    });
  }

  async function start() {
    attachGlobalErrorHandlers(logger);

    renderer = createRenderer({
      document,
      getRecipes: () => appState.recipes,
      getRuntimeState: () => appState.runtime,
      getUiState: () => appState.ui,
      actions: {
        buildRecipeSearchText,
        getRecipeKey,
        isRecipeFavorite: (recipe, index) => isRecipeFavorite(appState.runtime, recipe, index),
        isRecipeSelected: (recipe, index) => isRecipeSelected(appState.runtime, recipe, index),
        onFavoriteRecipe: handleFavoriteRecipe,
        onGroceryCheckedChange: handleGroceryCheckedChange,
        onRecipeTagToggle: handleRecipeTagToggle,
        onRenderError: (error) => logger.error(error),
        onSelectRecipe: handleSelectRecipe,
        onViewGroceryList: handleViewGroceryList,
      },
    });
    mobileViewController = createMobileViewController({
      document,
      getUiState: () => appState.ui,
      saveState: saveAppState,
    });
    wakeLockController = createWakeLockController({
      document,
      getUiState: () => appState.ui,
      logger,
      navigator,
      saveState: saveAppState,
      window,
    });

    applyUiStateToControls();
    attachPrimaryControls();
    attachFilterControls();
    mobileViewController.attach();
    attachRecipeSearch();
    attachCookingModeControls({ document, renderer, window });

    try {
      const result = await recipeRepository.loadAllRecipes();
      appState.recipes = result.recipes;
      recomputeGroceryState(appState.runtime, appState.recipes);
    } catch (error) {
      renderer.renderRecipeLoadError(error);
      return;
    }

    renderer.renderRecipes();
    renderer.syncRecipeCheckboxes();
    renderer.renderGroceryList();
    applyRecipeFilter(appState.ui.recipeSearch || "");
    mobileViewController.setMobileView(appState.ui.mobileView, { skipSave: true });
    wakeLockController.attach();
    exposeDebugApi();
  }

  return { start };
}

createRecipeBookApp().start();
