const DEFAULT_COMPACT_LAYOUT_QUERY = "(max-width: 979px)";
const HISTORY_STATE_KEY = "recipeBook";

function noop() {}

function getScrollY(windowLike) {
  if (Number.isFinite(windowLike?.scrollY)) return windowLike.scrollY;
  return Number(windowLike?.pageYOffset) || 0;
}

function callNextFrame(windowLike, callback) {
  if (windowLike && typeof windowLike.requestAnimationFrame === "function") {
    windowLike.requestAnimationFrame(() => windowLike.requestAnimationFrame(callback));
    return;
  }

  if (windowLike && typeof windowLike.setTimeout === "function") {
    windowLike.setTimeout(callback, 0);
    return;
  }

  callback();
}

function normalizeGroceryReturnPosition(position) {
  if (!position || typeof position !== "object") return null;

  const scrollY = Number(position.scrollY);
  const rowTop = Number(position.rowTop);
  const canonicalKey = String(position.canonicalKey || "");
  if (!canonicalKey) return null;

  return {
    canonicalKey,
    rowTop: Number.isFinite(rowTop) ? rowTop : null,
    scrollY: Number.isFinite(scrollY) ? scrollY : 0,
  };
}

export function createRecipeSourceNavigationController({
  clearRecipeDiscoveryFilters = noop,
  compactLayoutQuery = DEFAULT_COMPACT_LAYOUT_QUERY,
  document = globalThis.document,
  getRecipeKey = () => "",
  getRecipes = () => [],
  logger = console,
  revealRecipeById = () => false,
  setMobileView = noop,
  window = globalThis.window,
} = {}) {
  let groceryReturnPosition = null;

  function byId(id) {
    return document && typeof document.getElementById === "function"
      ? document.getElementById(id)
      : null;
  }

  function isCompactLayout() {
    if (!window || typeof window.matchMedia !== "function") return true;
    return window.matchMedia(compactLayoutQuery).matches;
  }

  function findGroceryRowByKey(canonicalKey) {
    const targetKey = String(canonicalKey || "");
    if (!targetKey || !document || typeof document.querySelectorAll !== "function") return null;

    return Array.from(document.querySelectorAll("#groceryList li[data-grocery-key]"))
      .find((row) => row.dataset && row.dataset.groceryKey === targetKey) || null;
  }

  function captureGroceryReturnPosition(canonicalKey) {
    const row = findGroceryRowByKey(canonicalKey);
    return {
      canonicalKey: String(canonicalKey || ""),
      rowTop: row && typeof row.getBoundingClientRect === "function"
        ? row.getBoundingClientRect().top
        : null,
      scrollY: getScrollY(window),
    };
  }

  function restoreGroceryReturnPosition(position = groceryReturnPosition) {
    const targetPosition = normalizeGroceryReturnPosition(position);
    if (!targetPosition) return false;
    groceryReturnPosition = null;

    const restore = () => {
      const row = findGroceryRowByKey(targetPosition.canonicalKey);
      let nextScrollY = targetPosition.scrollY;

      if (row && Number.isFinite(targetPosition.rowTop) && typeof row.getBoundingClientRect === "function") {
        nextScrollY = getScrollY(window) + row.getBoundingClientRect().top - targetPosition.rowTop;
      }

      if (window && typeof window.scrollTo === "function") {
        window.scrollTo({
          behavior: "auto",
          left: 0,
          top: Math.max(0, nextScrollY),
        });
      }
    };

    callNextFrame(window, restore);
    return true;
  }

  function createHistoryState(recipeBookState) {
    const currentState = window?.history?.state;
    const nextState =
      currentState && typeof currentState === "object" && !Array.isArray(currentState)
        ? { ...currentState }
        : {};
    nextState[HISTORY_STATE_KEY] = recipeBookState;
    return nextState;
  }

  function syncRecipeSourceHistory(recipeKey, returnPosition) {
    if (
      !returnPosition ||
      !isCompactLayout() ||
      !window?.history ||
      typeof window.history.pushState !== "function" ||
      typeof window.history.replaceState !== "function"
    ) {
      return;
    }

    try {
      const href = window.location?.href || "";
      window.history.replaceState(
        createHistoryState({
          groceryReturnPosition: returnPosition,
          view: "grocery",
        }),
        "",
        href
      );
      window.history.pushState(
        createHistoryState({
          groceryReturnPosition: returnPosition,
          sourceRecipeId: String(recipeKey),
          view: "recipes",
        }),
        "",
        href
      );
    } catch (error) {
      logger.warn("Recipe source history navigation could not be updated", error);
    }
  }

  function hasRecipeSource(recipeKey) {
    const targetRecipeKey = String(recipeKey || "");
    return Boolean(
      targetRecipeKey &&
      getRecipes().some((recipe, index) => getRecipeKey(recipe, index) === targetRecipeKey)
    );
  }

  function revealRecipeSourceById(recipeKey) {
    const targetRecipeKey = String(recipeKey || "");
    if (!hasRecipeSource(targetRecipeKey)) {
      if (targetRecipeKey) logger.warn("Grocery source recipe was not found", targetRecipeKey);
      return false;
    }

    if (revealRecipeById(targetRecipeKey)) return true;

    clearRecipeDiscoveryFilters({ focusSearch: false });
    if (!revealRecipeById(targetRecipeKey)) {
      logger.warn("Grocery source recipe could not be revealed", targetRecipeKey);
      return false;
    }
    return true;
  }

  function prepareRecipeSourceNavigation(canonicalKey) {
    if (isCompactLayout()) {
      groceryReturnPosition = captureGroceryReturnPosition(canonicalKey);
    }
  }

  function viewRecipeSource(recipeKey, options = {}) {
    if (!hasRecipeSource(recipeKey)) {
      const targetRecipeKey = String(recipeKey || "");
      if (targetRecipeKey) logger.warn("Grocery source recipe was not found", targetRecipeKey);
      return false;
    }

    let returnPosition = null;
    if (isCompactLayout()) {
      const preparedPosition = normalizeGroceryReturnPosition(groceryReturnPosition);
      returnPosition =
        preparedPosition && preparedPosition.canonicalKey === String(options.canonicalKey || "")
          ? preparedPosition
          : captureGroceryReturnPosition(options.canonicalKey);
    }

    groceryReturnPosition = returnPosition;
    syncRecipeSourceHistory(recipeKey, returnPosition);
    setMobileView("recipes");
    return revealRecipeSourceById(recipeKey);
  }

  function viewGroceryList() {
    setMobileView("grocery");
    const groceryPanel = byId("groceryPanel");
    if (groceryPanel && typeof groceryPanel.scrollIntoView === "function") {
      groceryPanel.scrollIntoView({ block: "start" });
    }
  }

  function getRecipeBookHistoryState(state) {
    if (!state || typeof state !== "object") return null;
    const recipeBookState = state[HISTORY_STATE_KEY];
    return recipeBookState && typeof recipeBookState === "object" ? recipeBookState : null;
  }

  function handleHistoryNavigation(event) {
    const recipeBookState = getRecipeBookHistoryState(event?.state);
    if (!recipeBookState) return false;

    groceryReturnPosition =
      normalizeGroceryReturnPosition(recipeBookState.groceryReturnPosition) || groceryReturnPosition;

    if (recipeBookState.view === "grocery") {
      setMobileView("grocery", { trigger: "history" });
      restoreGroceryReturnPosition();
      return true;
    }

    if (recipeBookState.view === "recipes") {
      setMobileView("recipes", { trigger: "history" });
      if (recipeBookState.sourceRecipeId) {
        callNextFrame(window, () => revealRecipeSourceById(recipeBookState.sourceRecipeId));
      }
      return true;
    }

    return false;
  }

  function handleMobileViewChange({ view } = {}) {
    if (view === "grocery" && groceryReturnPosition) {
      restoreGroceryReturnPosition();
    }
  }

  return {
    handleHistoryNavigation,
    handleMobileViewChange,
    prepareRecipeSourceNavigation,
    revealRecipeSourceById,
    restoreGroceryReturnPosition,
    viewGroceryList,
    viewRecipeSource,
  };
}
