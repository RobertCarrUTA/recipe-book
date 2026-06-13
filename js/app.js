/* ================================
INIT: Restore state, render grocery, and enable recipe search
================================ */
function normalizeForSearch(text) {
  return normalizeWhitespace(String(text || "")).toLowerCase();
}

function buildRecipeSearchText(recipe) {
  const parts = [];
  if (recipe.title) parts.push(recipe.title);
  if (recipe.author) parts.push(recipe.author);
  if (recipe.description) parts.push(recipe.description);
  if (recipe.ingredients && recipe.ingredients.length) parts.push(recipe.ingredients.join(" "));
  if (recipe.notes && recipe.notes.length) parts.push(recipe.notes.join(" "));
  if (recipe.instructions && recipe.instructions.length) parts.push(recipe.instructions.join(" "));
  return normalizeForSearch(parts.join(" "));
}

function getSelectedRecipeFilters() {
  const selected = {};
  document.querySelectorAll(".recipe-filters input:checked").forEach((cb) => {
    const key = cb.dataset.filter;
    if (!key) return;
    if (!selected[key]) selected[key] = new Set();
    selected[key].add(cb.value);
  });
  return selected;
}

function recipeMatchesSelectedFilters(recipe, selected) {
  const tags = recipe && recipe.tags ? recipe.tags : {};
  const statusValue = tags.status ? String(tags.status) : "not-tried";
  const ratingValue = tags.rating ? String(tags.rating) : "";
  const difficultyValue = tags.difficulty ? String(tags.difficulty) : "";
  const equipmentValues = Array.isArray(tags.equipment) ? tags.equipment.map((v) => String(v)) : [];

  const statusSelected = selected.status;
  if (statusSelected && statusSelected.size) {
    if (!statusSelected.has(statusValue)) return false;
  }

  const ratingSelected = selected.rating;
  if (ratingSelected && ratingSelected.size) {
    if (!ratingSelected.has(ratingValue)) return false;
  }

  const difficultySelected = selected.difficulty;
  if (difficultySelected && difficultySelected.size) {
    if (!difficultySelected.has(difficultyValue)) return false;
  }

  const equipmentSelected = selected.equipment;
  if (equipmentSelected && equipmentSelected.size) {
    const hasAny = equipmentValues.some((v) => equipmentSelected.has(v));
    if (!hasAny) return false;
  }

  return true;
}

function updateRecipeTagActiveStyles(selected) {
  document.querySelectorAll(".recipe-tag[data-filter-key][data-filter-value]").forEach((tagEl) => {
    const key = tagEl.dataset.filterKey;
    const val = tagEl.dataset.filterValue;

    const set = selected[key];
    const isActive = !!(set && set.size && set.has(val));
    tagEl.classList.toggle("active", isActive);
    tagEl.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function applyRecipeFilter(filterTextRaw) {
  const filterText = normalizeForSearch(filterTextRaw);
  const selected = getSelectedRecipeFilters();
  const recipeElements = Array.from(document.querySelectorAll(".recipe"));
  const showSelectedOnlyElement = document.getElementById("showSelectedRecipesOnly");
  const showFavoriteOnlyElement = document.getElementById("showFavoriteRecipesOnly");
  const showSelectedOnly = !!(showSelectedOnlyElement && showSelectedOnlyElement.checked);
  const showFavoriteOnly = !!(showFavoriteOnlyElement && showFavoriteOnlyElement.checked);

  let visibleCount = 0;

  recipeElements.forEach((recipeElement) => {
    const recipeIndexRaw = recipeElement.dataset.recipeIndex;
    const recipeIndex = recipeIndexRaw ? Number(recipeIndexRaw) : NaN;
    const recipe = Number.isFinite(recipeIndex) ? recipes[recipeIndex] : null;

    const haystack = recipeElement.dataset.searchText || "";
    const matchesSearch = !filterText || haystack.includes(filterText);
    const matchesTags = recipe ? recipeMatchesSelectedFilters(recipe, selected) : true;
    const matchesSelectedOnly = !showSelectedOnly || (recipe ? isRecipeSelected(recipe, recipeIndex) : true);
    const matchesFavoriteOnly = !showFavoriteOnly || (recipe ? isRecipeFavorite(recipe, recipeIndex) : true);

    const matches = matchesSearch && matchesTags && matchesSelectedOnly && matchesFavoriteOnly;

    recipeElement.style.display = matches ? "" : "none";

    if (!matches) {
      const content = recipeElement.querySelector(".accordion-content");
      if (content) content.classList.remove("open");
    } else {
      visibleCount += 1;
    }
  });

  updateRecipeTagActiveStyles(selected);

  const meta = document.getElementById("recipeSearchMeta");
  if (meta) {
    meta.textContent = recipeElements.length
      ? `Showing ${visibleCount} of ${recipeElements.length}`
      : `Showing ${recipeElements.length}`;
  }
}

function attachRecipeSearch() {
  const recipeSearchElement = document.getElementById("recipeSearch");
  if (!recipeSearchElement) return;

  let debounceTimer = null;

  const runFilter = () => {
    applyRecipeFilter(recipeSearchElement.value);
    savePersistentState();
  };

  recipeSearchElement.addEventListener("input", () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(runFilter, 150);
  });

  recipeSearchElement.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      recipeSearchElement.value = "";
      runFilter();
      recipeSearchElement.blur();
    }
  });

  const recipeElements = Array.from(document.querySelectorAll(".recipe"));
  recipeElements.forEach((recipeElement, index) => {
    const recipeData = recipes[index];
    recipeElement.dataset.searchText = buildRecipeSearchText(recipeData);
  });

  applyRecipeFilter(recipeSearchElement.value || "");
}

function attachSelectedRecipesToggle() {
  const selectedOnlyElement = document.getElementById("showSelectedRecipesOnly");
  if (!selectedOnlyElement) return;

  selectedOnlyElement.addEventListener("change", () => {
    refreshRecipeListFilter();
    savePersistentState();
  });
}

function attachFavoriteRecipesToggle() {
  const favoriteOnlyElement = document.getElementById("showFavoriteRecipesOnly");
  if (!favoriteOnlyElement) return;

  favoriteOnlyElement.addEventListener("change", () => {
    refreshRecipeListFilter();
    savePersistentState();
  });
}

function attachCookingModeControls() {
  const closeButton = document.getElementById("closeCookingMode");
  const previousButton = document.getElementById("previousCookingStep");
  const nextButton = document.getElementById("nextCookingStep");
  const ingredientsToggle = document.getElementById("toggleCookingIngredients");

  if (closeButton) closeButton.addEventListener("click", closeCookingMode);

  if (ingredientsToggle) {
    ingredientsToggle.addEventListener("click", () => {
      setCookingIngredientsExpanded(!cookingModeState.ingredientsExpanded);
    });
  }

  if (previousButton) {
    previousButton.addEventListener("click", () => {
      setCookingStep(cookingModeState.stepIndex - 1);
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", () => {
      const steps = getCookingSteps(cookingModeState.recipe);
      if (cookingModeState.stepIndex >= steps.length - 1) {
        closeCookingMode();
        return;
      }
      setCookingStep(cookingModeState.stepIndex + 1);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (!isCookingModeOpen()) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeCookingMode();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      const steps = getCookingSteps(cookingModeState.recipe);
      if (cookingModeState.stepIndex < steps.length - 1) setCookingStep(cookingModeState.stepIndex + 1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (cookingModeState.stepIndex > 0) setCookingStep(cookingModeState.stepIndex - 1);
    }
  });

  window.addEventListener("resize", () => {
    if (!isCookingModeOpen()) return;
    if (!isMobileCookingLayout()) cookingModeState.ingredientsExpanded = true;
    renderCookingMode();
  });
}

function setMobileView(view, options) {
  const nextView = view === "grocery" ? "grocery" : "recipes";
  const settings = options || {};
  document.body.classList.toggle("app-mode-grocery", nextView === "grocery");
  document.body.classList.toggle("app-mode-recipes", nextView === "recipes");

  document.querySelectorAll(".mobile-view-tab").forEach((button) => {
    const isActive = button.dataset.view === nextView;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  if (!settings.skipSave) {
    try {
      localStorage.setItem(storageKeys.mobileView, nextView);
    } catch (error) {
      // Ignore storage failures; the view toggle should still work
    }
  }
}

function restoreMobileView() {
  let savedView = "recipes";
  try {
    savedView = localStorage.getItem(storageKeys.mobileView) || "recipes";
  } catch (error) {
    savedView = "recipes";
  }
  setMobileView(savedView === "grocery" ? "grocery" : "recipes", { skipSave: true });
}

function attachMobileViewTabs() {
  document.querySelectorAll(".mobile-view-tab").forEach((button) => {
    button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
    button.addEventListener("click", () => {
      setMobileView(button.dataset.view);
    });
  });
}

function attachFilterControls() {
  const filterToggle = document.getElementById("toggleFilters");
  const filters = document.getElementById("recipeFilters");
  const clearFiltersButton = document.getElementById("clearFilters");

  if (filterToggle && filters) {
    filterToggle.addEventListener("click", () => {
      const isHidden = filters.classList.toggle("hidden");
      filterToggle.setAttribute("aria-expanded", isHidden ? "false" : "true");
    });
  }

  document.querySelectorAll(".recipe-filters input").forEach((cb) => {
    cb.addEventListener("change", () => {
      persistFilters();
      applyRecipeFilter(document.getElementById("recipeSearch").value || "");
    });
  });

  if (clearFiltersButton) {
    clearFiltersButton.addEventListener("click", () => {
      document.querySelectorAll(".recipe-filters input").forEach((cb) => {
        cb.checked = false;
      });
      localStorage.removeItem("offline_recipebook_filters_v1");
      applyRecipeFilter(document.getElementById("recipeSearch").value || "");
    });
  }
}

let screenWakeLock = null;
let wantsScreenWakeLock = false;

function getKeepScreenAwakeToggles() {
  return Array.from(document.querySelectorAll("#keepScreenAwake, #cookingKeepScreenAwake")).filter(Boolean);
}

function getKeepScreenAwakeToggle() {
  return getKeepScreenAwakeToggles()[0] || null;
}

function syncKeepScreenAwakeToggles(checked) {
  getKeepScreenAwakeToggles().forEach((toggle) => {
    toggle.checked = checked;
  });
}

function isScreenWakeLockSupported() {
  return !!(
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator &&
    navigator.wakeLock &&
    navigator.wakeLock.request
  );
}

async function requestScreenWakeLock() {
  if (!isScreenWakeLockSupported() || screenWakeLock || document.visibilityState !== "visible") return;

  try {
    screenWakeLock = await navigator.wakeLock.request("screen");
    screenWakeLock.addEventListener("release", () => {
      screenWakeLock = null;
      if (wantsScreenWakeLock && document.visibilityState === "visible") {
        window.setTimeout(requestScreenWakeLock, 0);
      }
    });
  } catch (error) {
    const keepAwakeToggle = getKeepScreenAwakeToggle();
    wantsScreenWakeLock = false;
    if (keepAwakeToggle) syncKeepScreenAwakeToggles(false);
    savePersistentState();
  }
}

async function releaseScreenWakeLock() {
  if (!screenWakeLock) return;

  const lockToRelease = screenWakeLock;
  screenWakeLock = null;
  try {
    await lockToRelease.release();
  } catch (error) {
    // The browser may have already released it when visibility changed
  }
}

function syncScreenWakeLock() {
  const keepAwakeToggle = getKeepScreenAwakeToggle();
  wantsScreenWakeLock = !!(keepAwakeToggle && keepAwakeToggle.checked);

  if (wantsScreenWakeLock && document.visibilityState === "visible") {
    requestScreenWakeLock();
  } else {
    releaseScreenWakeLock();
  }
}

function attachKeepScreenAwakeToggle() {
  const keepAwakeToggle = getKeepScreenAwakeToggle();
  if (!keepAwakeToggle) return;

  if (!isScreenWakeLockSupported()) {
    syncKeepScreenAwakeToggles(false);
    getKeepScreenAwakeToggles().forEach((toggle) => {
      toggle.disabled = true;
      toggle.title = "Screen wake lock is not supported in this browser.";
    });
    savePersistentState();
    return;
  }

  syncKeepScreenAwakeToggles(keepAwakeToggle.checked);

  getKeepScreenAwakeToggles().forEach((toggle) => {
    toggle.addEventListener("change", () => {
      syncKeepScreenAwakeToggles(toggle.checked);
      syncScreenWakeLock();
      savePersistentState();
    });
  });

  document.addEventListener("visibilitychange", syncScreenWakeLock);
  syncScreenWakeLock();
}

function renderRecipeLoadError(error) {
  console.error(error);

  recipeContainer.innerHTML = "";
  const message = document.createElement("p");
  message.className = "recipe-description";
  message.textContent =
    window.location.protocol === "file:"
      ? "Recipe data could not be loaded from data/recipes.json. Start a local web server for this folder, then refresh."
      : "Recipe data could not be loaded from data/recipes.json.";
  recipeContainer.appendChild(message);

  const meta = document.getElementById("recipeSearchMeta");
  if (meta) meta.textContent = "Showing 0";
}

(async function initPage() {
  try {
    await loadRecipes();
  } catch (error) {
    renderRecipeLoadError(error);
    return;
  }

  restorePersistentState();
  restoreFilters();
  renderRecipes();
  recomputeGroceryState();
  syncRecipeCheckboxes();
  attachFilterControls();

  applyRecipeFilter(document.getElementById("recipeSearch").value || "");

  renderGroceryList();
  attachMobileViewTabs();
  restoreMobileView();
  attachRecipeSearch();
  attachSelectedRecipesToggle();
  attachFavoriteRecipesToggle();
  attachCookingModeControls();
  attachKeepScreenAwakeToggle();
})();
