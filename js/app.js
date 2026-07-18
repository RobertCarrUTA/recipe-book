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
  pruneRecipeRuntimeState,
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
import { downloadTextFile } from "./download.js";
import { createEmptyState, listen } from "./dom.js";
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
import { createMealPlanPanelController } from "./meal_plan_panel_controller.js";
import { createMobileViewController } from "./mobile_view_controller.js";
import { createOfflineController } from "./offline_controller.js";
import {
  buildRecipeSearchText,
} from "./recipe_filter.js";
import { createRecipeDiscoveryController } from "./recipe_discovery_controller.js";
import { createRecipeExportPayload } from "./recipe_exporter.js";
import { createGroceryListText } from "./grocery_list_exporter.js";
import { createRecipeRepository } from "./recipe_repository.js";
import { createRecipeSourceNavigationController } from "./recipe_source_navigation.js";
import { normalizeRecipeSort } from "./recipe_sort.js";
import { createRenderer } from "./render.js";
import {
  clearGroceryPersistence,
  normalizeUiState,
  restorePersistentState,
  savePersistentState,
} from "./storage.js";
import { createStatusMessageController } from "./status_message_controller.js";
import {
  applyUiStateToControls as applyUiStateToDomControls,
  readUiStateFromControls,
} from "./ui_state.js";
import { createWakeLockController } from "./wake_lock_controller.js";

const COMPACT_CONTROLS_MEDIA = "(max-width: 979px)";
const STATUS_TIMEOUT_MS = 3600;

function createRecipeBookState(restoredState = {}) {
  return {
    recipes: [],
    mealPlan: normalizeMealPlan(restoredState.mealPlan),
    recipeSearchTexts: [],
    runtime: createRecipeRuntimeState(restoredState),
    ui: normalizeUiState(restoredState.ui),
  };
}

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
  const appState = createRecipeBookState(restored);
  let renderer = null;
  let backupController = null;
  let mobileViewController = null;
  let mealPlanPanelController = null;
  let recipeDiscoveryController = null;
  let recipeSourceNavigationController = null;
  let wakeLockController = null;
  let recipesReady = false;
  const stateToolsStatus = createStatusMessageController({
    document,
    statusId: "stateBackupStatus",
    timeoutMs: STATUS_TIMEOUT_MS,
    window,
  });
  const setStateToolsStatus = stateToolsStatus.set;
  const persistenceStatus = createStatusMessageController({
    document,
    statusId: "statePersistenceStatus",
    window,
  });
  let persistenceFailureReported = false;

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

  function attachCheckboxUiControl(id, uiKey, onChange) {
    onControlChange(id, (control) => {
      appState.ui[uiKey] = control.checked;
      onChange();
      saveAppState();
    });
  }

  function attachCollapsedPanelToggle(id, uiKey, syncPanel) {
    onId(id, "click", () => {
      appState.ui[uiKey] = !appState.ui[uiKey];
      syncPanel();
      saveAppState();
    });
  }

  function syncUiStateFromControls() {
    appState.ui = readUiStateFromControls(document, appState.ui);
  }

  function persistAppState() {
    syncUiStateFromControls();
    const saved = savePersistentState(appState);
    if (saved) {
      if (persistenceFailureReported) {
        persistenceFailureReported = false;
        persistenceStatus.clear();
      }
      return true;
    }
    if (persistenceFailureReported) return false;

    persistenceFailureReported = true;
    logger.warn("App state could not be saved");
    persistenceStatus.set("Changes could not be saved. Export a backup before refreshing.", {
      kind: "error",
      sticky: true,
    });
    return false;
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

  function applyRestoredPersistentState(restoredState) {
    if (!recipesReady) {
      return { applied: false, persisted: false, reason: "recipes-not-ready" };
    }

    appState.runtime = createRecipeRuntimeState(restoredState);
    appState.mealPlan = normalizeMealPlan(restoredState.mealPlan);
    appState.ui = normalizeUiState(restoredState.ui);

    applyUiStateToControls();
    wakeLockController?.applyPreference(appState.ui.keepScreenAwake);
    syncRecipeControlsPanel();
    syncGroceryControlsPanel();
    prepareRecipeRuntimeState();
    renderLoadedAppState();
    closeMealPlanPanel({ restoreFocus: false });
    return {
      applied: true,
      persisted: saveAppState({ immediate: true }) === true,
    };
  }

  function prepareRecipeRuntimeState() {
    const mealPlanChanged = pruneMealPlanForRecipes(appState.mealPlan, appState.recipes);
    const runtimeChanged = pruneRecipeRuntimeState(appState.runtime, appState.recipes);
    recomputeGroceryState(appState.runtime, appState.recipes);
    return mealPlanChanged || runtimeChanged;
  }

  function renderLoadedAppState() {
    renderer.renderGroceryList();
    renderer.renderMealPlan();
    recipeDiscoveryController.applyFilter(appState.ui.recipeSearch || "");
    mobileViewController.setMobileView(appState.ui.mobileView, { skipSave: true });
  }

  function isCompactControlsLayout() {
    return isMediaQueryActive(window, COMPACT_CONTROLS_MEDIA);
  }

  function refreshRecipeListFilter() {
    recipeDiscoveryController?.refresh();
  }

  function clearRecipeDiscoveryFilters(options = {}) {
    recipeDiscoveryController?.clear(options);
  }

  function shouldRefreshRecipesForFavoriteChange() {
    return Boolean(recipeDiscoveryController?.shouldRefreshForFavoriteChange());
  }

  function shouldRefreshRecipesForSelectionChange() {
    return Boolean(recipeDiscoveryController?.shouldRefreshForSelectionChange());
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

  function handleRecipeTagToggle(filterKey, filterValue, options) {
    recipeDiscoveryController?.handleTagToggle(filterKey, filterValue, options);
  }

  function updateRecipeSearchMeta(matchCount) {
    recipeDiscoveryController?.updateSearchMeta(matchCount);
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

  function openMealPlanPanel() {
    mealPlanPanelController?.open();
  }

  function closeMealPlanPanel(options = {}) {
    mealPlanPanelController?.close(options);
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

  async function copyTextWithStatus(text, {
    failureMessage,
    logContext,
    logMessage,
    successMessage,
  }) {
    try {
      await writeTextToClipboard(text, { document, logger, navigator });
      setStateToolsStatus(successMessage);
      return true;
    } catch (error) {
      logger.warn(logMessage, logContext ? { error, ...logContext } : error);
      setStateToolsStatus(failureMessage, { kind: "error", sticky: true });
      return false;
    }
  }

  async function handleCopyGroceryList() {
    syncUiStateFromControls();
    return copyTextWithStatus(createGroceryListText(appState.runtime, appState.ui), {
      failureMessage: "Grocery list could not be copied.",
      logMessage: "Grocery list copy failed",
      successMessage: "Grocery list copied.",
    });
  }

  function handleExportRecipe(recipe, recipeIndex, format) {
    try {
      const payload = createRecipeExportPayload(recipe, format);
      downloadTextFile(payload, { document, window });
      setStateToolsStatus(`Recipe exported as ${payload.format.toUpperCase()}.`);
      return true;
    } catch (error) {
      logger.warn("Recipe export failed", { error, recipeIndex });
      setStateToolsStatus("Recipe could not be exported.", { kind: "error", sticky: true });
      return false;
    }
  }

  async function handleCopyRecipeText(recipe, recipeIndex) {
    const payload = createRecipeExportPayload(recipe, "text");
    return copyTextWithStatus(payload.text, {
      failureMessage: "Recipe text could not be copied.",
      logContext: { recipeIndex },
      logMessage: "Recipe text copy failed",
      successMessage: "Recipe text copied.",
    });
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

  function attachGrocerySearchSuffixControl() {
    const input = byId("grocerySearchSuffix");
    if (!input) return;

    listen(input, "input", () => {
      appState.ui.grocerySearchSuffix = input.value || "";
      renderer.renderGroceryList();
      saveAppState();
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

  function attachPrimaryControls() {
    syncRecipeControlsPanel();
    syncGroceryControlsPanel();
    attachResponsiveControlsSync();

    attachCheckboxUiControl("groupToggle", "groupItems", () => renderer.renderGroceryList());
    attachCheckboxUiControl("showSelectedRecipesOnly", "showSelectedRecipesOnly", refreshRecipeListFilter);
    attachCheckboxUiControl("showFavoriteRecipesOnly", "showFavoriteRecipesOnly", refreshRecipeListFilter);
    attachCheckboxUiControl("hideCheckedGroceryItems", "hideCheckedGroceryItems", () => renderer.renderGroceryList());

    onControlChange("recipeSort", (control) => {
      appState.ui.recipeSort = normalizeRecipeSort(control.value);
      refreshRecipeListFilter();
      saveAppState();
    });

    onId("clearGroceryList", "click", openClearGroceryDialog);
    onId("clearCheckedGroceryItems", "click", clearCheckedGroceryListItems);
    onId("addAllRecipesToGroceryList", "click", addAllRecipesToGroceryList);
    onId("copyGroceryList", "click", handleCopyGroceryList);
    attachCollapsedPanelToggle("toggleRecipeControls", "recipeControlsCollapsed", syncRecipeControlsPanel);
    attachCollapsedPanelToggle("toggleGroceryControls", "groceryControlsCollapsed", syncGroceryControlsPanel);
    attachGrocerySearchSuffixControl();
  }

  function createRendererActions() {
    return {
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
      onCopyRecipeText: handleCopyRecipeText,
      onExportRecipe: handleExportRecipe,
      onRecipeMultiplierChange: handleRecipeMultiplierChange,
      onRemoveRecipeFromMealPlan: handleRemoveRecipeFromMealPlan,
      onRecipeTagToggle: handleRecipeTagToggle,
      onRenderError: (error) => logger.error(error),
      onSelectRecipe: handleSelectRecipe,
      onViewGroceryList: handleViewGroceryList,
      onViewMealPlan: handleViewMealPlan,
      onViewRecipeSource: handleViewRecipeSource,
    };
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
      actions: createRendererActions(),
    });
    recipeDiscoveryController = createRecipeDiscoveryController({
      document,
      getRecipes: () => appState.recipes,
      getRuntimeState: () => appState.runtime,
      getSearchTexts: () => appState.recipeSearchTexts,
      getUiState: () => appState.ui,
      isFavorite: (runtime, recipe, index) => isRecipeFavorite(runtime, recipe, index),
      isSelected: (runtime, recipe, index) => isRecipeSelected(runtime, recipe, index),
      renderer,
      saveState: saveAppState,
      window,
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
    mealPlanPanelController = createMealPlanPanelController({
      document,
      onBuildGroceryList: handleBuildGroceryListFromMealPlan,
      onClearMealPlan: handleClearMealPlan,
    });

    applyUiStateToControls();
    attachPrimaryControls();
    recipeDiscoveryController.attach();
    attachClearGroceryDialog();
    attachManualGroceryForm();
    mealPlanPanelController.attach();
    backupController = createBackupController({
      document,
      getState: () => {
        syncUiStateFromControls();
        return appState;
      },
      logger,
      importAvailable: false,
      onRestore: applyRestoredPersistentState,
      setStatus: setStateToolsStatus,
      window,
    });
    backupController.attach();
    createOfflineController({ document, logger, navigator, window }).attach();
    mobileViewController.attach();
    window.addEventListener("popstate", handleRecipeBookHistoryNavigation);
    attachCookingModeControls({ document, renderer, window });

    try {
      const result = await recipeRepository.loadAllRecipes();
      appState.recipes = result.recipes;
      appState.recipeSearchTexts = appState.recipes.map(buildRecipeSearchText);
      recipeDiscoveryController.syncRecipeCollectionOptions();
      const loadedStateChanged = prepareRecipeRuntimeState();
      recipesReady = true;
      backupController.setImportAvailable(true);
      if (loadedStateChanged) saveAppState({ immediate: true });
    } catch (error) {
      recipesReady = false;
      backupController.setImportAvailable(
        false,
        "Backup import is unavailable because recipes did not load."
      );
      setStateToolsStatus("Backup import is unavailable because recipes did not load.", {
        kind: "error",
        sticky: true,
      });
      renderer.renderRecipeLoadError(error);
      return;
    }

    renderLoadedAppState();
    wakeLockController.attach();
    exposeDebugApi();
  }

  return { start };
}

function renderFatalAppError(error) {
  console.error("[recipe-book] App startup failed", error);
  const recipeContainer = document.getElementById("recipeContainer");
  if (!recipeContainer) return;

  recipeContainer.setAttribute("aria-busy", "false");
  recipeContainer.replaceChildren(createEmptyState(document, {
    body: "Refresh the page. If the problem continues, restore a recent backup after the app loads.",
    className: "recipe-list-state",
    title: "The recipe book could not start.",
  }));
}

async function startRecipeBookApp() {
  const app = createRecipeBookApp();
  await app.start();
}

startRecipeBookApp().catch(renderFatalAppError);
