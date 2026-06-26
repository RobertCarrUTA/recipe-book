import {
  addManualGroceryItem,
  clearCheckedGroceryItems,
  clearGroceryState,
  createRecipeRuntimeState,
  getRecipeMultiplier,
  getRecipeKey,
  isRecipeFavorite,
  isManualGroceryItemKey,
  isRecipeSelected,
  recomputeGroceryState,
  removeManualGroceryItem,
  selectAllRecipes,
  setGroceryChecked,
  setRecipeFavorite,
  setRecipeMultiplier,
  setRecipeSelected,
} from "./grocery_model.js";
import { createBackupController } from "./backup_controller.js";
import { attachCookingModeControls } from "./cooking_controls.js";
import { createLogger, isDebugEnabled } from "./logger.js";
import { createMobileViewController } from "./mobile_view_controller.js";
import { createOfflineController } from "./offline_controller.js";
import {
  buildRecipeSearchText,
  getMatchingRecipeIndexes,
  normalizeForSearch,
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
const COMPACT_CONTROLS_MEDIA = "(max-width: 979px)";

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
    recipeSearchTexts: [],
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

  function applyRestoredPersistentState(restoredState) {
    appState.runtime = createRecipeRuntimeState(restoredState);
    appState.ui = {
      ...createDefaultUiState(),
      ...(restoredState.ui || {}),
    };

    recomputeGroceryState(appState.runtime, appState.recipes);
    applyUiStateToControls();
    syncRecipeControlsPanel();
    syncGroceryControlsPanel();
    renderer.renderGroceryList();
    refreshRecipeListFilter();
    mobileViewController.setMobileView(appState.ui.mobileView, { skipSave: true });
    savePersistentState(appState);
  }

  function isCompactControlsLayout() {
    return typeof window.matchMedia !== "function" || window.matchMedia(COMPACT_CONTROLS_MEDIA).matches;
  }

  function applyRecipeFilter(filterTextRaw) {
    const filterText = normalizeForSearch(filterTextRaw);
    const selected = getSelectedRecipeFilters(document);
    const selectedOnly = byId("showSelectedRecipesOnly");
    const favoriteOnly = byId("showFavoriteRecipesOnly");
    const showSelectedOnly = Boolean(selectedOnly && selectedOnly.checked);
    const showFavoriteOnly = Boolean(favoriteOnly && favoriteOnly.checked);

    const matchingRecipeIndexes = getMatchingRecipeIndexes({
      filterText,
      isFavorite: (recipe, index) => isRecipeFavorite(appState.runtime, recipe, index),
      isSelected: (recipe, index) => isRecipeSelected(appState.runtime, recipe, index),
      recipes: appState.recipes,
      searchTexts: appState.recipeSearchTexts,
      selectedFilters: selected,
      showFavoriteOnly,
      showSelectedOnly,
    });

    renderer.renderRecipes({ recipeIndexes: matchingRecipeIndexes });
    renderer.syncRecipeFilterTagStyles(selected);
    updateRecipeSearchMeta(matchingRecipeIndexes.length);

    const noResults = byId("recipeNoResults");
    if (noResults) noResults.hidden = !(appState.recipes.length && matchingRecipeIndexes.length === 0);
  }

  function refreshRecipeListFilter() {
    const recipeSearch = byId("recipeSearch");
    applyRecipeFilter(recipeSearch ? recipeSearch.value || "" : "");
  }

  function clearRecipeDiscoveryFilters() {
    const recipeSearch = byId("recipeSearch");
    const selectedOnly = byId("showSelectedRecipesOnly");
    const favoriteOnly = byId("showFavoriteRecipesOnly");

    if (recipeSearch) recipeSearch.value = "";
    if (selectedOnly) selectedOnly.checked = false;
    if (favoriteOnly) favoriteOnly.checked = false;
    document.querySelectorAll(".recipe-filters input").forEach((cb) => {
      cb.checked = false;
    });

    appState.ui.recipeSearch = "";
    appState.ui.filters = {};
    appState.ui.showSelectedRecipesOnly = false;
    appState.ui.showFavoriteRecipesOnly = false;
    refreshRecipeListFilter();
    saveAppState();
    if (recipeSearch) recipeSearch.focus();
  }

  function findFilterCheckbox(filterKey, filterValue) {
    return Array.from(document.querySelectorAll(".recipe-filters input")).find(
      (input) => input.dataset.filter === filterKey && input.value === filterValue
    );
  }

  function isControlChecked(id) {
    const control = byId(id);
    return Boolean(control && control.checked);
  }

  function handleRecipeTagToggle(filterKey, filterValue) {
    const checkbox = findFilterCheckbox(filterKey, filterValue);
    if (!checkbox) return;

    checkbox.checked = !checkbox.checked;
    appState.ui.filters = readFilterDataFromDom(document);
    refreshRecipeListFilter();
    saveAppState();
  }

  function updateRecipeSearchMeta(matchCount) {
    const meta = byId("recipeSearchMeta");
    if (!meta) return;

    if (!appState.recipes.length) {
      meta.textContent = "0 recipes";
      return;
    }

    meta.textContent =
      matchCount === appState.recipes.length
        ? `${appState.recipes.length} recipes`
        : `${matchCount} matches of ${appState.recipes.length}`;
  }

  function handleFavoriteRecipe(recipe, recipeIndex, favorite) {
    setRecipeFavorite(appState.runtime, recipe, recipeIndex, favorite);
    renderer.syncFavoriteRecipeIndicators();
    if (isControlChecked("showFavoriteRecipesOnly")) refreshRecipeListFilter();
    saveAppState();
  }

  function handleSelectRecipe(recipe, recipeIndex, selected) {
    setRecipeSelected(appState.runtime, appState.recipes, recipe, recipeIndex, selected);
    renderer.renderGroceryList();
    renderer.syncRecipeSelectionIndicators();
    if (isControlChecked("showSelectedRecipesOnly")) refreshRecipeListFilter();
    saveAppState();
  }

  function handleRecipeMultiplierChange(recipe, recipeIndex, multiplier) {
    const normalized = setRecipeMultiplier(appState.runtime, appState.recipes, recipe, recipeIndex, multiplier);
    renderer.renderGroceryList();
    renderer.syncRecipeSelectionIndicators();
    saveAppState();
    return normalized;
  }

  function handleViewGroceryList() {
    mobileViewController.setMobileView("grocery");
    const groceryPanel = byId("groceryPanel");
    if (groceryPanel) groceryPanel.scrollIntoView({ block: "start" });
  }

  function syncRecipeControlsPanel() {
    const panel = byId("recipeControlsPanel");
    const toggle = byId("toggleRecipeControls");
    const recipeSearch = panel ? panel.closest(".recipe-search") : null;
    const collapsed = Boolean(appState.ui.recipeControlsCollapsed) && isCompactControlsLayout();

    if (panel) panel.hidden = collapsed;
    if (recipeSearch) recipeSearch.classList.toggle("is-compact", collapsed);
    if (toggle) {
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggle.textContent = collapsed ? "Show" : "Hide";
      toggle.title = collapsed ? "Show recipe controls" : "Hide recipe controls";
      toggle.setAttribute("aria-label", collapsed ? "Show recipe controls" : "Hide recipe controls");
    }
  }

  function syncGroceryControlsPanel() {
    const panel = byId("groceryControlsPanel");
    const toggle = byId("toggleGroceryControls");
    const shoppingBar = panel ? panel.closest(".grocery-shopping-bar") : null;
    const collapsed = Boolean(appState.ui.groceryControlsCollapsed) && isCompactControlsLayout();

    if (panel) panel.hidden = collapsed;
    if (shoppingBar) shoppingBar.classList.toggle("is-compact", collapsed);
    if (toggle) {
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggle.textContent = collapsed ? "Show" : "Hide";
      toggle.title = collapsed ? "Show grocery controls" : "Hide grocery controls";
      toggle.setAttribute("aria-label", collapsed ? "Show grocery controls" : "Hide grocery controls");
    }
  }

  function attachResponsiveControlsSync() {
    if (typeof window.matchMedia !== "function") return;

    const media = window.matchMedia(COMPACT_CONTROLS_MEDIA);
    const syncControls = () => {
      syncRecipeControlsPanel();
      syncGroceryControlsPanel();
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncControls);
    } else if (typeof media.addListener === "function") {
      media.addListener(syncControls);
    }
  }

  function handleGroceryCheckedChange(canonicalKey, checked) {
    setGroceryChecked(appState.runtime, canonicalKey, checked);
    saveAppState();
  }

  function handleGroceryGroupToggle(group, collapsed) {
    appState.ui.collapsedGroceryGroups = appState.ui.collapsedGroceryGroups || {};
    if (collapsed) {
      appState.ui.collapsedGroceryGroups[group] = true;
    } else {
      delete appState.ui.collapsedGroceryGroups[group];
    }
    renderer.renderGroceryList();
    saveAppState();
  }

  function handleManualGroceryRemove(canonicalKey) {
    if (!removeManualGroceryItem(appState.runtime, canonicalKey)) return;
    renderer.renderGroceryList();
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

  function openClearGroceryDialog() {
    if (appState.ui.skipClearGroceryConfirmation) {
      clearGroceryList();
      return;
    }

    const dialog = byId("confirmClearGroceryDialog");
    if (!dialog || typeof dialog.showModal !== "function") {
      if (window.confirm("Delete every grocery item and clear recipe selections for this list?")) {
        clearGroceryList();
      }
      return;
    }

    if (!dialog.open) dialog.showModal();
    const skipConfirmation = byId("skipClearGroceryConfirmation");
    if (skipConfirmation) skipConfirmation.checked = false;
    const cancelButton = byId("cancelClearGroceryList");
    if (cancelButton) cancelButton.focus();
  }

  function clearCheckedGroceryListItems() {
    clearCheckedGroceryItems(appState.runtime);
    renderer.renderGroceryList();
    saveAppState();
  }

  function addAllRecipesToGroceryList() {
    selectAllRecipes(appState.runtime, appState.recipes);
    renderer.renderGroceryList();
    renderer.syncRecipeCheckboxes();
    refreshRecipeListFilter();
    saveAppState();
  }

  function attachManualGroceryForm() {
    const form = byId("manualGroceryForm");
    const input = byId("manualGroceryInput");
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    if (!form || !input) return;

    const syncManualGrocerySubmit = () => {
      if (submitButton) submitButton.disabled = !input.value.trim();
    };

    input.addEventListener("input", syncManualGrocerySubmit);
    syncManualGrocerySubmit();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const item = addManualGroceryItem(appState.runtime, input.value);
      if (!item) return;

      input.value = "";
      syncManualGrocerySubmit();
      renderer.renderGroceryList();
      saveAppState();
    });
  }

  function attachClearGroceryDialog() {
    const dialog = byId("confirmClearGroceryDialog");
    const confirmButton = byId("confirmClearGroceryList");
    if (!dialog || !confirmButton) return;

    confirmButton.addEventListener("click", () => {
      const skipConfirmation = byId("skipClearGroceryConfirmation");
      if (skipConfirmation && skipConfirmation.checked) {
        appState.ui.skipClearGroceryConfirmation = true;
      }
      clearGroceryList();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close("cancel");
    });
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
    const clearDiscoveryButton = byId("clearRecipeDiscoveryFilters");

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

    if (clearDiscoveryButton) clearDiscoveryButton.addEventListener("click", clearRecipeDiscoveryFilters);
  }

  function attachPrimaryControls() {
    const groupToggle = byId("groupToggle");
    const selectedOnly = byId("showSelectedRecipesOnly");
    const favoriteOnly = byId("showFavoriteRecipesOnly");
    const hideChecked = byId("hideCheckedGroceryItems");
    const clearButton = byId("clearGroceryList");
    const clearCheckedButton = byId("clearCheckedGroceryItems");
    const addAllButton = byId("addAllRecipesToGroceryList");
    const controlsToggle = byId("toggleGroceryControls");
    const recipeControlsToggle = byId("toggleRecipeControls");

    syncRecipeControlsPanel();
    syncGroceryControlsPanel();
    attachResponsiveControlsSync();

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

    if (hideChecked) {
      hideChecked.addEventListener("change", () => {
        appState.ui.hideCheckedGroceryItems = hideChecked.checked;
        renderer.renderGroceryList();
        saveAppState();
      });
    }

    if (clearButton) clearButton.addEventListener("click", openClearGroceryDialog);
    if (clearCheckedButton) clearCheckedButton.addEventListener("click", clearCheckedGroceryListItems);
    if (addAllButton) addAllButton.addEventListener("click", addAllRecipesToGroceryList);
    if (recipeControlsToggle) {
      recipeControlsToggle.addEventListener("click", () => {
        appState.ui.recipeControlsCollapsed = !appState.ui.recipeControlsCollapsed;
        syncRecipeControlsPanel();
        saveAppState();
      });
    }
    if (controlsToggle) {
      controlsToggle.addEventListener("click", () => {
        appState.ui.groceryControlsCollapsed = !appState.ui.groceryControlsCollapsed;
        syncGroceryControlsPanel();
        saveAppState();
      });
    }
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
        getRecipeMultiplier: (recipe, index) => getRecipeMultiplier(appState.runtime, recipe, index),
        getRecipeSearchText: (_recipe, index) => appState.recipeSearchTexts[index] || "",
        isRecipeFavorite: (recipe, index) => isRecipeFavorite(appState.runtime, recipe, index),
        isManualGroceryItem: (canonicalKey) => isManualGroceryItemKey(canonicalKey),
        isRecipeSelected: (recipe, index) => isRecipeSelected(appState.runtime, recipe, index),
        onFavoriteRecipe: handleFavoriteRecipe,
        onGroceryCheckedChange: handleGroceryCheckedChange,
        onGroceryGroupToggle: handleGroceryGroupToggle,
        onManualGroceryRemove: handleManualGroceryRemove,
        onRecipeBatchRendered: ({ totalCount }) => updateRecipeSearchMeta(totalCount),
        onRecipeMultiplierChange: handleRecipeMultiplierChange,
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
      window,
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
    attachClearGroceryDialog();
    attachManualGroceryForm();
    createBackupController({
      document,
      getState: () => {
        syncUiStateFromControls();
        return appState;
      },
      logger,
      onRestore: applyRestoredPersistentState,
      window,
    }).attach();
    createOfflineController({ document, logger, navigator, window }).attach();
    mobileViewController.attach();
    attachRecipeSearch();
    attachCookingModeControls({ document, renderer, window });

    try {
      const result = await recipeRepository.loadAllRecipes();
      appState.recipes = result.recipes;
      appState.recipeSearchTexts = appState.recipes.map(buildRecipeSearchText);
      recomputeGroceryState(appState.runtime, appState.recipes);
    } catch (error) {
      renderer.renderRecipeLoadError(error);
      return;
    }

    renderer.renderGroceryList();
    applyRecipeFilter(appState.ui.recipeSearch || "");
    mobileViewController.setMobileView(appState.ui.mobileView, { skipSave: true });
    wakeLockController.attach();
    exposeDebugApi();
  }

  return { start };
}

createRecipeBookApp().start();
