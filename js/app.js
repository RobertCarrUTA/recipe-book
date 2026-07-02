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
import { createAppStatePersistenceController } from "./app_state_persistence.js";
import { createBackupController } from "./backup_controller.js";
import { writeTextToClipboard } from "./clipboard.js";
import {
  isMediaQueryActive,
  listenToMediaQueryChanges,
  syncCollapsibleControlsPanel,
} from "./collapsible_controls.js";
import { attachCookingModeControls } from "./cooking_controls.js";
import { listen } from "./dom.js";
import { createLogger, isDebugEnabled } from "./logger.js";
import {
  addRecipeToMealPlan,
  applyMealPlanToGroceryList,
  clearMealPlan as clearMealPlanState,
  getRecipePlannedDayKeys,
  normalizeMealPlan,
  pruneMealPlanForRecipes,
  removeRecipeFromMealPlan,
} from "./meal_plan_model.js";
import { createMobileViewController } from "./mobile_view_controller.js";
import { createOfflineController } from "./offline_controller.js";
import {
  buildRecipeSearchText,
  getMatchingRecipeIndexes,
  normalizeForSearch,
} from "./recipe_filter.js";
import { createGroceryListText } from "./grocery_list_exporter.js";
import { createRecipeRepository } from "./recipe_repository.js";
import { createRecipeSourceNavigationController } from "./recipe_source_navigation.js";
import { normalizeRecipeSort, recipeSortModes, sortRecipeIndexes } from "./recipe_sort.js";
import { createRenderer } from "./render.js";
import {
  clearGroceryPersistence,
  createDefaultUiState,
  restorePersistentState,
  savePersistentState,
} from "./storage.js";
import { createStatusMessageController } from "./status_message_controller.js";
import {
  applyUiStateToControls as applyUiStateToDomControls,
  getSelectedRecipeFilters,
  readFilterDataFromDom,
  readUiStateFromControls,
} from "./ui_state.js";
import { createWakeLockController } from "./wake_lock_controller.js";

const DEBOUNCE_MS = 150;
const COMPACT_CONTROLS_MEDIA = "(max-width: 979px)";
const STATUS_TIMEOUT_MS = 3600;

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
    mealPlan: normalizeMealPlan(restored.mealPlan),
    recipeSearchTexts: [],
    runtime: createRecipeRuntimeState(restored),
    ui: {
      ...createDefaultUiState(),
      ...(restored.ui || {}),
    },
  };
  appState.ui.recipeSort = normalizeRecipeSort(appState.ui.recipeSort);
  let renderer = null;
  let mobileViewController = null;
  let mealPlanReturnFocus = null;
  let lastRenderedRecipeIndexes = null;
  let recipeSourceNavigationController = null;
  let wakeLockController = null;
  const stateToolsStatus = createStatusMessageController({
    document,
    statusId: "stateBackupStatus",
    timeoutMs: STATUS_TIMEOUT_MS,
    window,
  });
  const setStateToolsStatus = stateToolsStatus.set;

  function byId(id) {
    return document.getElementById(id);
  }

  function onId(id, type, listener, options) {
    return listen(byId(id), type, listener, options);
  }

  function onControlChange(id, listener) {
    const control = byId(id);
    listen(control, "change", (event) => listener(control, event));
    return control;
  }

  function queryAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function syncUiStateFromControls() {
    appState.ui = readUiStateFromControls(document, appState.ui);
  }

  function persistAppState() {
    syncUiStateFromControls();
    savePersistentState(appState);
  }

  const appStatePersistence = createAppStatePersistenceController({
    document,
    persist: persistAppState,
    window,
  });
  const saveAppState = appStatePersistence.save;

  function applyUiStateToControls() {
    applyUiStateToDomControls(document, appState.ui);
  }

  function countSelectedRecipeFilters(selected) {
    return Object.values(selected || {}).reduce((count, values) => {
      if (values instanceof Set) return count + values.size;
      return count + (Array.isArray(values) ? values.length : 0);
    }, 0);
  }

  function countActiveDiscoveryFilters({
    filterText,
    selected,
    showFavoriteOnly,
    showSelectedOnly,
  }) {
    return (
      countSelectedRecipeFilters(selected) +
      (filterText ? 1 : 0) +
      (showFavoriteOnly ? 1 : 0) +
      (showSelectedOnly ? 1 : 0)
    );
  }

  function isRecipeListRuntimeSorted() {
    return appState.ui.recipeSort === recipeSortModes.favoritesFirst ||
      appState.ui.recipeSort === recipeSortModes.selectedFirst;
  }

  function areRecipeIndexesEqual(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;

    return left.every((value, index) => value === right[index]);
  }

  function renderFilteredRecipes(recipeIndexes) {
    if (!areRecipeIndexesEqual(lastRenderedRecipeIndexes, recipeIndexes)) {
      renderer.renderRecipes({ recipeIndexes });
      lastRenderedRecipeIndexes = recipeIndexes.slice();
      return;
    }

    renderer.syncFavoriteRecipeIndicators();
    renderer.syncRecipeSelectionIndicators();
    renderer.syncMealPlanIndicators();
  }

  function syncRecipeFilterControls({
    filterText,
    selected,
    showFavoriteOnly,
    showSelectedOnly,
  }) {
    const filterToggle = byId("toggleFilters");
    const clearFiltersButton = byId("clearFilters");
    const recipeSearch = byId("recipeSearch");
    const recipeSearchWrap = recipeSearch ? recipeSearch.closest(".recipe-search") : null;
    const activeDiscoveryFilterCount = countActiveDiscoveryFilters({
      filterText,
      selected,
      showFavoriteOnly,
      showSelectedOnly,
    });
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

  function syncRecipeSearchClearButton() {
    const recipeSearch = byId("recipeSearch");
    const clearSearchButton = byId("clearRecipeSearch");
    if (!clearSearchButton) return;

    clearSearchButton.hidden = !(recipeSearch && recipeSearch.value);
  }

  function applyRestoredPersistentState(restoredState) {
    appState.runtime = createRecipeRuntimeState(restoredState);
    appState.mealPlan = normalizeMealPlan(restoredState.mealPlan);
    appState.ui = {
      ...createDefaultUiState(),
      ...(restoredState.ui || {}),
    };
    appState.ui.recipeSort = normalizeRecipeSort(appState.ui.recipeSort);

    pruneMealPlanForRecipes(appState.mealPlan, appState.recipes);
    recomputeGroceryState(appState.runtime, appState.recipes);
    applyUiStateToControls();
    syncRecipeControlsPanel();
    syncGroceryControlsPanel();
    renderer.renderGroceryList();
    renderer.renderMealPlan();
    renderer.syncMealPlanIndicators();
    refreshRecipeListFilter();
    closeMealPlanPanel({ restoreFocus: false });
    mobileViewController.setMobileView(appState.ui.mobileView, { skipSave: true });
    saveAppState({ immediate: true });
  }

  function isCompactControlsLayout() {
    return isMediaQueryActive(window, COMPACT_CONTROLS_MEDIA);
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
      filterTextIsNormalized: true,
      isFavorite: (recipe, index) => isRecipeFavorite(appState.runtime, recipe, index),
      isSelected: (recipe, index) => isRecipeSelected(appState.runtime, recipe, index),
      recipes: appState.recipes,
      searchTexts: appState.recipeSearchTexts,
      searchTextsAreNormalized: true,
      selectedFilters: selected,
      showFavoriteOnly,
      showSelectedOnly,
    });

    let sortedRecipeIndexes = matchingRecipeIndexes;
    if (appState.ui.recipeSort !== recipeSortModes.default) {
      sortedRecipeIndexes = sortRecipeIndexes(matchingRecipeIndexes, appState.recipes, {
        isFavorite: (recipe, index) => isRecipeFavorite(appState.runtime, recipe, index),
        isSelected: (recipe, index) => isRecipeSelected(appState.runtime, recipe, index),
        sortMode: appState.ui.recipeSort,
      });
    }

    renderFilteredRecipes(sortedRecipeIndexes);
    renderer.syncRecipeFilterTagStyles(selected);
    syncRecipeFilterControls({
      filterText,
      selected,
      showFavoriteOnly,
      showSelectedOnly,
    });
    updateRecipeSearchMeta(matchingRecipeIndexes.length);

    const noResults = byId("recipeNoResults");
    if (noResults) noResults.hidden = !(appState.recipes.length && matchingRecipeIndexes.length === 0);
  }

  function refreshRecipeListFilter() {
    const recipeSearch = byId("recipeSearch");
    applyRecipeFilter(recipeSearch ? recipeSearch.value || "" : "");
  }

  function clearRecipeDiscoveryFilters(options = {}) {
    const recipeSearch = byId("recipeSearch");
    const selectedOnly = byId("showSelectedRecipesOnly");
    const favoriteOnly = byId("showFavoriteRecipesOnly");

    if (recipeSearch) recipeSearch.value = "";
    if (selectedOnly) selectedOnly.checked = false;
    if (favoriteOnly) favoriteOnly.checked = false;
    queryAll(".recipe-filters input").forEach((cb) => {
      cb.checked = false;
    });

    appState.ui.recipeSearch = "";
    appState.ui.filters = {};
    appState.ui.showSelectedRecipesOnly = false;
    appState.ui.showFavoriteRecipesOnly = false;
    refreshRecipeListFilter();
    saveAppState();
    if (options.focusSearch !== false && recipeSearch) recipeSearch.focus();
  }

  function findFilterCheckbox(filterKey, filterValue) {
    return queryAll(".recipe-filters input").find(
      (input) => input.dataset.filter === filterKey && input.value === filterValue
    );
  }

  function isControlChecked(id) {
    const control = byId(id);
    return Boolean(control && control.checked);
  }

  function shouldRefreshRecipesForFavoriteChange() {
    return isControlChecked("showFavoriteRecipesOnly") || isRecipeListRuntimeSorted();
  }

  function shouldRefreshRecipesForSelectionChange() {
    return isControlChecked("showSelectedRecipesOnly") || isRecipeListRuntimeSorted();
  }

  function syncFavoriteRecipeUi() {
    if (shouldRefreshRecipesForFavoriteChange()) {
      refreshRecipeListFilter();
    } else {
      renderer.syncFavoriteRecipeIndicators();
    }
  }

  function syncRecipeSelectionUi(options = {}) {
    if (options.renderGroceryList !== false) renderer.renderGroceryList();

    if (options.refreshRecipeList) {
      refreshRecipeListFilter();
    } else {
      renderer.syncRecipeSelectionIndicators();
    }
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
      meta.classList.remove("is-filtered");
      return;
    }

    meta.classList.toggle("is-filtered", matchCount !== appState.recipes.length);
    meta.textContent =
      matchCount === appState.recipes.length
        ? `${appState.recipes.length} recipes`
        : `${matchCount} matches of ${appState.recipes.length}`;
  }

  function handleFavoriteRecipe(recipe, recipeIndex, favorite) {
    setRecipeFavorite(appState.runtime, recipe, recipeIndex, favorite);
    syncFavoriteRecipeUi();
    saveAppState();
  }

  function handleSelectRecipe(recipe, recipeIndex, selected) {
    setRecipeSelected(appState.runtime, appState.recipes, recipe, recipeIndex, selected);
    syncRecipeSelectionUi({
      refreshRecipeList: shouldRefreshRecipesForSelectionChange(),
    });
    saveAppState();
  }

  function handleRecipeMultiplierChange(recipe, recipeIndex, multiplier) {
    const normalized = setRecipeMultiplier(appState.runtime, appState.recipes, recipe, recipeIndex, multiplier);
    syncRecipeSelectionUi();
    saveAppState();
    return normalized;
  }

  function refreshMealPlanUi() {
    renderer.renderMealPlan();
    renderer.syncMealPlanIndicators();
  }

  function commitMealPlanChange(changed) {
    if (!changed) return;

    refreshMealPlanUi();
    saveAppState();
  }

  function handlePlanRecipe(recipe, recipeIndex, dayKey) {
    commitMealPlanChange(addRecipeToMealPlan(appState.mealPlan, dayKey, getRecipeKey(recipe, recipeIndex)));
  }

  function handleAddRecipeToMealPlan(dayKey, recipeKey) {
    commitMealPlanChange(addRecipeToMealPlan(appState.mealPlan, dayKey, recipeKey));
  }

  function handleRemoveRecipeFromMealPlan(dayKey, recipeKey) {
    commitMealPlanChange(removeRecipeFromMealPlan(appState.mealPlan, dayKey, recipeKey));
  }

  function handleClearMealPlan() {
    commitMealPlanChange(clearMealPlanState(appState.mealPlan));
  }

  function handleBuildGroceryListFromMealPlan() {
    const selectedCount = applyMealPlanToGroceryList(appState.runtime, appState.recipes, appState.mealPlan);
    if (!selectedCount) return;

    syncRecipeSelectionUi({
      refreshRecipeList: shouldRefreshRecipesForSelectionChange(),
    });
    saveAppState();
    closeMealPlanPanel({ restoreFocus: false });
    handleViewGroceryList();
  }

  function setElementInert(element, inert) {
    if (!element) return;

    if ("inert" in element) {
      element.inert = inert;
    }

    if (inert) {
      element.setAttribute("aria-hidden", "true");
    } else {
      element.removeAttribute("aria-hidden");
    }
  }

  function setMealPlanBackgroundInert(inert) {
    setElementInert(document.querySelector(".app-header"), inert);
    setElementInert(byId("recipesPanel"), inert);
    setElementInert(byId("groceryPanel"), inert);
    setElementInert(document.querySelector(".mobile-view-tabs"), inert);
  }

  function openMealPlanPanel() {
    const mealPlanPanel = byId("mealPlanPanel");
    if (!mealPlanPanel) return;

    const HTMLElementCtor = document.defaultView && document.defaultView.HTMLElement;
    mealPlanReturnFocus = HTMLElementCtor && document.activeElement instanceof HTMLElementCtor
      ? document.activeElement
      : byId("openMealPlan");
    setMealPlanBackgroundInert(true);
    document.body.classList.add("is-meal-plan-open");
    const closeButton = byId("closeMealPlanPanel");
    if (closeButton) closeButton.focus();
  }

  function closeMealPlanPanel(options = {}) {
    if (!document.body.classList.contains("is-meal-plan-open")) return;

    document.body.classList.remove("is-meal-plan-open");
    setMealPlanBackgroundInert(false);

    if (options.restoreFocus === false) {
      mealPlanReturnFocus = null;
      return;
    }

    const focusTarget = mealPlanReturnFocus && document.contains(mealPlanReturnFocus)
      ? mealPlanReturnFocus
      : byId("openMealPlan");
    mealPlanReturnFocus = null;
    if (focusTarget) focusTarget.focus();
  }

  function handleViewMealPlan() {
    openMealPlanPanel();
  }

  function handleViewGroceryList() {
    recipeSourceNavigationController?.viewGroceryList();
  }

  function handlePrepareRecipeSourceNavigation(canonicalKey) {
    recipeSourceNavigationController?.prepareRecipeSourceNavigation(canonicalKey);
  }

  function handleViewRecipeSource(recipeKey, options = {}) {
    recipeSourceNavigationController?.viewRecipeSource(recipeKey, options);
  }

  function handleRecipeBookHistoryNavigation(event) {
    recipeSourceNavigationController?.handleHistoryNavigation(event);
  }

  function handleMobileViewChange(event) {
    recipeSourceNavigationController?.handleMobileViewChange(event);
  }

  function syncRecipeControlsPanel() {
    syncCollapsibleControlsPanel(document, {
      collapsed: Boolean(appState.ui.recipeControlsCollapsed) && isCompactControlsLayout(),
      collapsedClass: "is-compact",
      collapsedLabel: "Show recipe controls",
      containerSelector: ".recipe-search",
      expandedLabel: "Hide recipe controls",
      panelId: "recipeControlsPanel",
      toggleId: "toggleRecipeControls",
    });
  }

  function syncGroceryControlsPanel() {
    syncCollapsibleControlsPanel(document, {
      collapsed: Boolean(appState.ui.groceryControlsCollapsed),
      collapsedClass: "is-compact",
      collapsedLabel: "Show grocery controls",
      containerSelector: ".grocery-shopping-bar",
      expandedLabel: "Hide grocery controls",
      panelId: "groceryControlsPanel",
      toggleId: "toggleGroceryControls",
    });
  }

  function attachResponsiveControlsSync() {
    const syncControls = () => {
      syncRecipeControlsPanel();
      syncGroceryControlsPanel();
    };
    listenToMediaQueryChanges(window, COMPACT_CONTROLS_MEDIA, syncControls);
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
    syncRecipeSelectionUi({ refreshRecipeList: true });
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
    syncRecipeSelectionUi({ refreshRecipeList: true });
    saveAppState();
  }

  async function handleCopyGroceryList() {
    syncUiStateFromControls();
    const text = createGroceryListText(appState.runtime, appState.ui);

    try {
      await writeTextToClipboard(text, { document, logger, navigator });
      setStateToolsStatus("Grocery list copied.");
    } catch (error) {
      logger.warn("Grocery list copy failed", error);
      setStateToolsStatus("Grocery list could not be copied.", { kind: "error", sticky: true });
    }
  }

  function attachManualGroceryForm() {
    const form = byId("manualGroceryForm");
    const input = byId("manualGroceryInput");
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    if (!form || !input) return;

    const syncManualGrocerySubmit = () => {
      if (submitButton) submitButton.disabled = !input.value.trim();
    };

    listen(input, "input", syncManualGrocerySubmit);
    syncManualGrocerySubmit();

    listen(form, "submit", (event) => {
      event.preventDefault();
      const item = addManualGroceryItem(appState.runtime, input.value);
      if (!item) return;

      input.value = "";
      syncManualGrocerySubmit();
      renderer.renderGroceryList();
      saveAppState();
    });
  }

  function attachMealPlanControls() {
    onId("openMealPlan", "click", openMealPlanPanel);
    onId("buildGroceryListFromMealPlan", "click", handleBuildGroceryListFromMealPlan);
    onId("clearMealPlan", "click", handleClearMealPlan);
    onId("closeMealPlanPanel", "click", closeMealPlanPanel);

    listen(document, "keydown", (event) => {
      if (event.key === "Escape" && document.body.classList.contains("is-meal-plan-open")) {
        event.preventDefault();
        closeMealPlanPanel();
      }
    });
  }

  function attachClearGroceryDialog() {
    const dialog = byId("confirmClearGroceryDialog");
    const confirmButton = byId("confirmClearGroceryList");
    if (!dialog || !confirmButton) return;

    listen(confirmButton, "click", () => {
      const skipConfirmation = byId("skipClearGroceryConfirmation");
      if (skipConfirmation && skipConfirmation.checked) {
        appState.ui.skipClearGroceryConfirmation = true;
      }
      clearGroceryList();
    });
    listen(dialog, "click", (event) => {
      if (event.target === dialog) dialog.close("cancel");
    });
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
      appState.ui.recipeSearch = recipeSearch.value || "";
      applyRecipeFilter(appState.ui.recipeSearch);
      saveAppState();
    };

    listen(recipeSearch, "input", () => {
      clearRecipeSearchDebounce();
      syncRecipeSearchClearButton();
      debounceTimer = window.setTimeout(runFilter, DEBOUNCE_MS);
    });

    listen(recipeSearch, "keydown", (event) => {
      if (event.key !== "Escape") return;
      recipeSearch.value = "";
      runFilter();
      recipeSearch.blur();
    });

    listen(clearSearchButton, "click", () => {
      if (!recipeSearch.value) return;
      recipeSearch.value = "";
      runFilter();
      recipeSearch.focus();
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
        appState.ui.filters = readFilterDataFromDom(document);
        refreshRecipeListFilter();
        saveAppState();
      });
    });

    listen(clearFiltersButton, "click", () => clearRecipeDiscoveryFilters());
    listen(clearDiscoveryButton, "click", clearRecipeDiscoveryFilters);
  }

  function attachPrimaryControls() {
    syncRecipeControlsPanel();
    syncGroceryControlsPanel();
    attachResponsiveControlsSync();

    onControlChange("groupToggle", (control) => {
      appState.ui.groupItems = control.checked;
      renderer.renderGroceryList();
      saveAppState();
    });

    onControlChange("showSelectedRecipesOnly", (control) => {
      appState.ui.showSelectedRecipesOnly = control.checked;
      refreshRecipeListFilter();
      saveAppState();
    });

    onControlChange("showFavoriteRecipesOnly", (control) => {
      appState.ui.showFavoriteRecipesOnly = control.checked;
      refreshRecipeListFilter();
      saveAppState();
    });

    onControlChange("hideCheckedGroceryItems", (control) => {
      appState.ui.hideCheckedGroceryItems = control.checked;
      renderer.renderGroceryList();
      saveAppState();
    });

    onControlChange("recipeSort", (control) => {
      appState.ui.recipeSort = normalizeRecipeSort(control.value);
      refreshRecipeListFilter();
      saveAppState();
    });

    onId("clearGroceryList", "click", openClearGroceryDialog);
    onId("clearCheckedGroceryItems", "click", clearCheckedGroceryListItems);
    onId("addAllRecipesToGroceryList", "click", addAllRecipesToGroceryList);
    onId("copyGroceryList", "click", handleCopyGroceryList);
    onId("toggleRecipeControls", "click", () => {
      appState.ui.recipeControlsCollapsed = !appState.ui.recipeControlsCollapsed;
      syncRecipeControlsPanel();
      saveAppState();
    });
    onId("toggleGroceryControls", "click", () => {
      appState.ui.groceryControlsCollapsed = !appState.ui.groceryControlsCollapsed;
      syncGroceryControlsPanel();
      saveAppState();
    });
  }

  function exposeDebugApi() {
    if (!isDebugEnabled()) return;

    window.recipeBookDebug = Object.freeze({
      getState: () => ({
        recipes: appState.recipes,
        mealPlan: appState.mealPlan,
        runtime: appState.runtime,
        ui: appState.ui,
      }),
      refreshRecipeListFilter,
      renderGroceryList: () => renderer.renderGroceryList(),
    });
  }

  async function start() {
    attachGlobalErrorHandlers(logger);
    appStatePersistence.attachFlushHandlers();

    renderer = createRenderer({
      document,
      getMealPlanState: () => appState.mealPlan,
      getRecipes: () => appState.recipes,
      getRuntimeState: () => appState.runtime,
      getUiState: () => appState.ui,
      actions: {
        getRecipeKey,
        getRecipeMultiplier: (recipe, index) => getRecipeMultiplier(appState.runtime, recipe, index),
        getRecipePlannedDayKeys: (recipe, index) =>
          getRecipePlannedDayKeys(appState.mealPlan, getRecipeKey(recipe, index)),
        isRecipeFavorite: (recipe, index) => isRecipeFavorite(appState.runtime, recipe, index),
        isManualGroceryItem: (canonicalKey) => isManualGroceryItemKey(canonicalKey),
        isRecipeSelected: (recipe, index) => isRecipeSelected(appState.runtime, recipe, index),
        onFavoriteRecipe: handleFavoriteRecipe,
        onGroceryCheckedChange: handleGroceryCheckedChange,
        onGroceryGroupToggle: handleGroceryGroupToggle,
        onManualGroceryRemove: handleManualGroceryRemove,
        onAddRecipeToMealPlan: handleAddRecipeToMealPlan,
        onPlanRecipe: handlePlanRecipe,
        onPrepareRecipeSourceNavigation: handlePrepareRecipeSourceNavigation,
        onRecipeBatchRendered: ({ totalCount }) => updateRecipeSearchMeta(totalCount),
        onRecipeMultiplierChange: handleRecipeMultiplierChange,
        onRemoveRecipeFromMealPlan: handleRemoveRecipeFromMealPlan,
        onRecipeTagToggle: handleRecipeTagToggle,
        onRenderError: (error) => logger.error(error),
        onSelectRecipe: handleSelectRecipe,
        onViewGroceryList: handleViewGroceryList,
        onViewMealPlan: handleViewMealPlan,
        onViewRecipeSource: handleViewRecipeSource,
      },
    });
    mobileViewController = createMobileViewController({
      document,
      getUiState: () => appState.ui,
      onViewChange: handleMobileViewChange,
      saveState: saveAppState,
      window,
    });
    recipeSourceNavigationController = createRecipeSourceNavigationController({
      clearRecipeDiscoveryFilters,
      compactLayoutQuery: COMPACT_CONTROLS_MEDIA,
      document,
      getRecipeKey,
      getRecipes: () => appState.recipes,
      logger,
      revealRecipeById: (recipeKey) => renderer.revealRecipeById(recipeKey),
      setMobileView: (view, options) => mobileViewController.setMobileView(view, options),
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
    attachMealPlanControls();
    createBackupController({
      document,
      getState: () => {
        syncUiStateFromControls();
        return appState;
      },
      logger,
      onRestore: applyRestoredPersistentState,
      setStatus: setStateToolsStatus,
      window,
    }).attach();
    createOfflineController({ document, logger, navigator, window }).attach();
    mobileViewController.attach();
    window.addEventListener("popstate", handleRecipeBookHistoryNavigation);
    attachRecipeSearch();
    attachCookingModeControls({ document, renderer, window });

    try {
      const result = await recipeRepository.loadAllRecipes();
      appState.recipes = result.recipes;
      appState.recipeSearchTexts = appState.recipes.map(buildRecipeSearchText);
      pruneMealPlanForRecipes(appState.mealPlan, appState.recipes);
      recomputeGroceryState(appState.runtime, appState.recipes);
    } catch (error) {
      renderer.renderRecipeLoadError(error);
      return;
    }

    renderer.renderGroceryList();
    renderer.renderMealPlan();
    applyRecipeFilter(appState.ui.recipeSearch || "");
    mobileViewController.setMobileView(appState.ui.mobileView, { skipSave: true });
    wakeLockController.attach();
    exposeDebugApi();
  }

  return { start };
}

createRecipeBookApp().start();
