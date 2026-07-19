const DEFAULT_COMPACT_LAYOUT_QUERY = "(max-width: 979px)";
const HISTORY_STATE_KEY = "recipeBook";
const MAX_RECIPE_DEEP_LINK_ID_LENGTH = 160;
const NON_RECIPE_PATH_SEGMENTS = new Set(["404.html", "index.html", "recipe-book"]);
const SHELL_FILE_PATH_SEGMENTS = new Set(["404.html", "index.html"]);
const RECIPE_DEEP_LINK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RECIPE_DEEP_LINK_PARAM = "recipe";

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

function normalizeRecipeDeepLinkId(value) {
  const recipeId = typeof value === "string" ? value : "";
  if (!recipeId || recipeId.length > MAX_RECIPE_DEEP_LINK_ID_LENGTH) return "";
  return RECIPE_DEEP_LINK_ID_PATTERN.test(recipeId) ? recipeId : "";
}

function getLocationHash(locationLike) {
  const hash = typeof locationLike?.hash === "string" ? locationLike.hash : "";
  if (hash) return hash;

  const href = typeof locationLike?.href === "string" ? locationLike.href : "";
  const hashIndex = href.indexOf("#");
  return hashIndex === -1 ? "" : href.slice(hashIndex);
}

function getLocationPathname(locationLike) {
  const pathname = typeof locationLike?.pathname === "string" ? locationLike.pathname : "";
  if (pathname) return pathname;

  const href = typeof locationLike?.href === "string" ? locationLike.href : "";
  if (!href) return "";

  try {
    return new URL(href).pathname;
  } catch (error) {
    return "";
  }
}

function decodePathSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch (error) {
    return "";
  }
}

function toRecipeIdSet(recipeIds) {
  if (recipeIds instanceof Set) return recipeIds;
  return new Set(Array.isArray(recipeIds) ? recipeIds.map((recipeId) => String(recipeId || "")) : []);
}

export function getRecipeDeepLinkIdFromHash(hash) {
  const rawHash = typeof hash === "string" ? hash : "";
  const fragment = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
  if (!fragment) return "";

  try {
    const params = new URLSearchParams(fragment);
    const recipeIds = params.getAll(RECIPE_DEEP_LINK_PARAM);
    return recipeIds.length === 1 ? normalizeRecipeDeepLinkId(recipeIds[0]) : "";
  } catch (error) {
    return "";
  }
}

export function getRecipeDeepLinkIdFromPathname(pathname) {
  const rawPathname = typeof pathname === "string" ? pathname : "";
  if (!rawPathname || rawPathname === "/") return "";

  const segments = rawPathname.split("/").filter(Boolean);
  const encodedRecipeId = segments.at(-1) || "";
  if (!encodedRecipeId || NON_RECIPE_PATH_SEGMENTS.has(encodedRecipeId)) return "";

  return normalizeRecipeDeepLinkId(decodePathSegment(encodedRecipeId));
}

export function getRecipeDeepLinkIdFromLocation(locationLike) {
  const hash = getLocationHash(locationLike);
  if (hash) return getRecipeDeepLinkIdFromHash(hash);
  return getRecipeDeepLinkIdFromPathname(getLocationPathname(locationLike));
}

export function getRecipeDeepLinkBasePath(pathname, options = {}) {
  const rawPathname = typeof pathname === "string" ? pathname : "/";
  if (!rawPathname || rawPathname === "/") return "";
  if (rawPathname.endsWith("/")) return rawPathname.replace(/\/+$/, "");

  const recipeIds = toRecipeIdSet(options.recipeIds);
  const segments = rawPathname.split("/").filter(Boolean);
  const encodedLastSegment = segments.at(-1) || "";
  const lastSegment = decodePathSegment(encodedLastSegment);
  const lastSegmentIsShellFile = SHELL_FILE_PATH_SEGMENTS.has(lastSegment);
  const lastSegmentIsKnownRecipe = recipeIds.has(lastSegment);
  const lastSegmentLooksLikeFile = /\.[^./]+$/.test(lastSegment);

  if (
    lastSegmentIsShellFile ||
    lastSegmentIsKnownRecipe ||
    (!lastSegmentLooksLikeFile && segments.length > 1)
  ) {
    segments.pop();
  }

  return segments.length ? `/${segments.join("/")}` : "";
}

export function createRecipeDeepLinkUrl(recipeId, locationLike, options = {}) {
  const recipeKey = normalizeRecipeDeepLinkId(recipeId);
  if (!recipeKey) return "";

  try {
    const url = new URL(String(locationLike?.href || ""));
    const basePath = getRecipeDeepLinkBasePath(url.pathname, options);
    url.pathname = `${basePath}/${encodeURIComponent(recipeKey)}`;
    url.search = "";
    url.hash = "";
    return url.href;
  } catch (error) {
    return "";
  }
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

  function getRecipeSourceKeys() {
    return new Set(getRecipes().map((recipe, index) => getRecipeKey(recipe, index)));
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

  function getRecipeDeepLinkUrl(recipeKey) {
    const targetRecipeKey = normalizeRecipeDeepLinkId(recipeKey);
    if (!targetRecipeKey) return "";
    if (!hasRecipeSource(targetRecipeKey)) {
      logger.warn("Recipe share link target was not found", targetRecipeKey);
      return "";
    }

    return createRecipeDeepLinkUrl(targetRecipeKey, window?.location, {
      recipeIds: getRecipeSourceKeys(),
    });
  }

  function viewDeepLinkedRecipeFromLocation() {
    const recipeKey = getRecipeDeepLinkIdFromLocation(window?.location);
    if (!recipeKey) return false;
    if (!hasRecipeSource(recipeKey)) {
      logger.warn("Recipe deep link was not found", recipeKey);
      return false;
    }

    setMobileView("recipes");
    return revealRecipeSourceById(recipeKey);
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
    getRecipeDeepLinkUrl,
    revealRecipeSourceById,
    restoreGroceryReturnPosition,
    viewDeepLinkedRecipeFromLocation,
    viewGroceryList,
    viewRecipeSource,
  };
}
