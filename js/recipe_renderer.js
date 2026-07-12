import {
  formatRatingText,
  formatServingsText,
  getRecipeHeaderMeta,
  getRecipeServingsText,
} from "./recipe_formatting.js";
import { createRecipeActionsRenderer } from "./recipe_actions_renderer.js";
import { createElement, createEmptyState, createTextElement } from "./dom.js";
import { mealPlanDays } from "./meal_plan_model.js";
import {
  DEFAULT_RECIPE_MULTIPLIER,
  formatRecipeMultiplier,
} from "./recipe_multiplier.js";

const DEFAULT_RECIPE_BATCH_SIZE = 24;
const COMPACT_RECIPE_BATCH_SIZE = 16;
const COMPACT_RECIPE_BATCH_QUERY = "(max-width: 979px)";
const DEFAULT_RECIPE_LOAD_AHEAD_MARGIN = "900px 0px";
const COMPACT_RECIPE_LOAD_AHEAD_MARGIN = "120px 0px";

function capitalizeLabel(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

export function createRecipeRenderer({
  document,
  getRecipes,
  actions,
  openCookingMode,
  recipeBatchSize,
}) {
  const byId = (id) => document.getElementById(id);
  const windowLike = document.defaultView || globalThis;
  const configuredBatchSize = Math.max(1, Number(recipeBatchSize) || DEFAULT_RECIPE_BATCH_SIZE);
  const shouldAdaptBatchSize = recipeBatchSize === undefined;
  const compactRecipeBatchMedia =
    typeof windowLike.matchMedia === "function"
      ? windowLike.matchMedia(COMPACT_RECIPE_BATCH_QUERY)
      : null;
  let currentRecipeIndexes = [];
  let currentSelectedFilters = {};
  let loadMoreObserver = null;
  let loadMoreSentinel = null;
  let pendingRecipeBatchHandle = null;
  let revealedRecipeElement = null;
  let revealHighlightTimer = null;
  let renderedCount = 0;
  const recipeActions = createRecipeActionsRenderer({
    actions,
    document,
    getRecipeMultiplier,
    getRecipePlanDayKeys,
    openCookingMode,
    windowLike,
  });

  function setRecipeContainerBusy(recipeContainer, busy) {
    if (recipeContainer) recipeContainer.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function cancelScheduledRecipeBatch() {
    if (!pendingRecipeBatchHandle) return;

    if (
      pendingRecipeBatchHandle.type === "animationFrame" &&
      typeof windowLike.cancelAnimationFrame === "function"
    ) {
      windowLike.cancelAnimationFrame(pendingRecipeBatchHandle.id);
    } else if (typeof windowLike.clearTimeout === "function") {
      windowLike.clearTimeout(pendingRecipeBatchHandle.id);
    }

    pendingRecipeBatchHandle = null;
  }

  function disconnectLoadMoreObserver() {
    if (loadMoreObserver && typeof loadMoreObserver.disconnect === "function") {
      loadMoreObserver.disconnect();
    }
    cancelScheduledRecipeBatch();
    loadMoreObserver = null;
  }

  function hasMoreRecipes() {
    return renderedCount < currentRecipeIndexes.length;
  }

  function isCompactRecipeViewport() {
    return Boolean(compactRecipeBatchMedia && compactRecipeBatchMedia.matches);
  }

  function getRecipeBatchSize() {
    if (!shouldAdaptBatchSize || !isCompactRecipeViewport()) return configuredBatchSize;
    return Math.min(configuredBatchSize, COMPACT_RECIPE_BATCH_SIZE);
  }

  function getRecipeLoadAheadMargin() {
    return isCompactRecipeViewport()
      ? COMPACT_RECIPE_LOAD_AHEAD_MARGIN
      : DEFAULT_RECIPE_LOAD_AHEAD_MARGIN;
  }

  function notifyRecipeBatchRendered() {
    if (typeof actions.onRecipeBatchRendered === "function") {
      actions.onRecipeBatchRendered({
        renderedCount,
        totalCount: currentRecipeIndexes.length,
      });
    }
  }

  function isFilterValueActive(filterKey, filterValue) {
    const selectedValues = currentSelectedFilters[filterKey];
    return selectedValues instanceof Set
      ? selectedValues.has(filterValue)
      : Array.isArray(selectedValues) && selectedValues.includes(filterValue);
  }

  function getRecipeMultiplier(recipe, recipeIndex) {
    return typeof actions.getRecipeMultiplier === "function"
      ? actions.getRecipeMultiplier(recipe, recipeIndex)
      : DEFAULT_RECIPE_MULTIPLIER;
  }

  function getSelectedBadgeText(recipe, recipeIndex) {
    const multiplier = getRecipeMultiplier(recipe, recipeIndex);
    return Math.abs(multiplier - DEFAULT_RECIPE_MULTIPLIER) > 1e-9
      ? `In list ${formatRecipeMultiplier(multiplier)}`
      : "In list";
  }

  function getRecipePlanDayKeys(recipe, recipeIndex) {
    return typeof actions.getRecipePlannedDayKeys === "function"
      ? actions.getRecipePlannedDayKeys(recipe, recipeIndex)
      : [];
  }

  function isRecipePlanned(recipe, recipeIndex) {
    return getRecipePlanDayKeys(recipe, recipeIndex).length > 0;
  }

  function formatPlannedBadgeText(plannedDayKeys) {
    if (!plannedDayKeys.length) return "Planned";
    if (plannedDayKeys.length > 2) return `Planned x${plannedDayKeys.length}`;

    const labels = plannedDayKeys
      .map((dayKey) => mealPlanDays.find((day) => day.key === dayKey))
      .filter(Boolean)
      .map((day) => day.shortLabel);

    return labels.length ? `Planned ${labels.join(", ")}` : "Planned";
  }

  function getPlannedBadgeText(recipe, recipeIndex) {
    return formatPlannedBadgeText(getRecipePlanDayKeys(recipe, recipeIndex));
  }

  function renderRecipeTags(tags, recipeKey) {
    const t = tags || {};
    const wrap = createElement(document, "div", { className: "recipe-tags" });

    function add(label, className, filterKey, filterValue) {
      const isActive = isFilterValueActive(filterKey, filterValue);
      wrap.appendChild(createElement(document, "button", {
        attributes: { "aria-pressed": isActive ? "true" : "false" },
        className: `recipe-tag ${className}${isActive ? " active" : ""}`,
        dataset: { filterKey, filterValue },
        textContent: label,
        type: "button",
        listeners: {
          click: (event) => {
            event.stopPropagation();
            actions.onRecipeTagToggle(filterKey, filterValue, { recipeId: recipeKey });
          },
        },
      }));
    }

    const status = t.status === "tried" ? "tried" : "not-tried";
    add(status === "tried" ? "Tried" : "Not Tried", status === "tried" ? "tag-tried" : "tag-not-tried", "status", status);

    if (t.rating) add(capitalizeLabel(t.rating), `tag-${t.rating}`, "rating", t.rating);
    if (t.difficulty) {
      add(capitalizeLabel(t.difficulty), `tag-${t.difficulty}`, "difficulty", t.difficulty);
    }
    if (Array.isArray(t.equipment)) {
      t.equipment.forEach((eq) => add(eq.replace(/-/g, " "), "tag-equipment", "equipment", eq));
    }

    return wrap;
  }

  function appendSectionList(content, titleText, items, ordered = false) {
    if (!Array.isArray(items) || !items.length) return;

    const title = document.createElement("h4");
    const list = document.createElement(ordered ? "ol" : "ul");
    title.className = "recipe-section-title";
    title.textContent = titleText;

    items.forEach((item) => {
      list.appendChild(createTextElement(document, "li", item));
    });

    content.appendChild(title);
    content.appendChild(list);
  }

  function appendRecipeMeta(content, recipe) {
    const metaItems = [];
    if (recipe.author) metaItems.push({ label: "Author", value: recipe.author });
    if (recipe.rating && (recipe.rating.value || recipe.rating.count)) {
      metaItems.push({ label: "Rating", value: formatRatingText(recipe.rating).trim() });
    }
    if (recipe.prepTime) metaItems.push({ label: "Prep Time", value: recipe.prepTime });
    if (recipe.cookTime) metaItems.push({ label: "Cook Time", value: recipe.cookTime });
    if (recipe.additionalTime) metaItems.push({ label: "Additional Time", value: recipe.additionalTime });
    if (recipe.totalTime) metaItems.push({ label: "Total Time", value: recipe.totalTime });

    const servingsText = formatServingsText(getRecipeServingsText(recipe));
    if (servingsText) metaItems.push({ label: "Servings", value: servingsText });
    if (!metaItems.length) return;

    const grid = createElement(document, "div", {
      children: metaItems.map((item) =>
        createElement(document, "p", {
          children: [
            createTextElement(document, "span", `${item.label}:`, { className: "recipe-meta-label" }),
            createTextElement(document, "span", ` ${item.value}`),
          ],
          className: "recipe-meta-item",
        })
      ),
      className: "recipe-meta-grid",
    });
    const metaWrap = createElement(document, "div", {
      children: grid,
      className: "recipe-meta",
    });

    content.appendChild(metaWrap);
  }

  function appendPersonalNotes(content, notes) {
    if (!Array.isArray(notes) || !notes.length) return;

    const personalNotesWrap = createElement(document, "div", {
      children: [
        createElement(document, "div", {
          children: createTextElement(document, "span", "Personal Notes:", { className: "recipe-meta-label" }),
          className: "recipe-meta-item",
        }),
        ...notes.map((note) => createTextElement(document, "div", `- ${note}`, {
          className: "recipe-meta-item",
        })),
      ],
      className: "recipe-meta personal-notes",
    });

    content.appendChild(personalNotesWrap);
  }

  function appendNutrition(content, nutrition) {
    if (!nutrition || !Object.keys(nutrition).length) return;

    const nutritionLabelOrder = [
      ["calories", "Calories"],
      ["carbohydrates", "Carbohydrates"],
      ["protein", "Protein"],
      ["fat", "Fat"],
      ["saturatedFat", "Saturated Fat"],
      ["polyunsaturatedFat", "Polyunsaturated Fat"],
      ["monounsaturatedFat", "Monounsaturated Fat"],
      ["transFat", "Trans Fat"],
      ["cholesterol", "Cholesterol"],
      ["sodium", "Sodium"],
      ["fiber", "Fiber"],
      ["sugar", "Sugar"],
    ];
    const nutritionItems = nutritionLabelOrder
      .filter(([key]) => nutrition[key])
      .map(([key, label]) => createTextElement(document, "li", `${label}: ${nutrition[key]}`));

    if (!nutritionItems.length) return;
    content.appendChild(createTextElement(document, "h4", "Nutrition", { className: "recipe-section-title" }));
    content.appendChild(createElement(document, "ul", { children: nutritionItems }));
  }

  function ensureRecipeContent(recipe, recipeIndex, content) {
    if (!content || content.dataset.rendered === "true") return;

    content.dataset.rendered = "true";
    content.appendChild(renderRecipeTags(recipe.tags, actions.getRecipeKey(recipe, recipeIndex)));
    content.appendChild(recipeActions.createRecipeActions(recipe, recipeIndex));

    if (recipe.category) {
      content.appendChild(createTextElement(document, "div", recipe.category, { className: "category-tag" }));
    }

    appendRecipeMeta(content, recipe);
    appendPersonalNotes(content, recipe.personalNotes);

    if (recipe.description) {
      content.appendChild(createTextElement(document, "p", recipe.description, { className: "recipe-description" }));
    }

    appendSectionList(content, "Equipment", recipe.equipment);
    appendNutrition(content, recipe.nutrition);
    appendSectionList(content, "Ingredients", recipe.ingredients);
    appendSectionList(content, "Instructions", recipe.instructions, true);
    appendSectionList(content, "Notes", recipe.notes);
  }

  function setRecipeContentOpen(recipe, recipeIndex, header, content, open) {
    if (open) ensureRecipeContent(recipe, recipeIndex, content);
    content.classList.toggle("open", open);
    header.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function pointerSelectionIncludesTitle(event, title) {
    const clickCount = Number(event?.detail);
    if (!Number.isFinite(clickCount) || clickCount <= 0 || !title || typeof windowLike.getSelection !== "function") {
      return false;
    }

    const selection = windowLike.getSelection();
    if (!selection || selection.isCollapsed) return false;

    if (typeof selection.containsNode === "function") {
      try {
        return selection.containsNode(title, true);
      } catch (error) {
        // Fall back to checking the selection endpoints below.
      }
    }

    return Boolean(
      (selection.anchorNode && title.contains?.(selection.anchorNode)) ||
      (selection.focusNode && title.contains?.(selection.focusNode))
    );
  }

  function renderRecipeShell(recipeIndex) {
    const recipes = getRecipes();
    const recipe = recipes[recipeIndex];
    const recipeKey = actions.getRecipeKey(recipe, recipeIndex);
    const contentId = `recipe-content-${recipeIndex}`;
    const titleId = `recipe-title-${recipeIndex}`;
    const statusId = `recipe-status-${recipeIndex}`;
    const metaId = `recipe-meta-${recipeIndex}`;
    const isSelected = actions.isRecipeSelected(recipe, recipeIndex);
    const isFavorite = actions.isRecipeFavorite(recipe, recipeIndex);
    const plannedDayKeys = getRecipePlanDayKeys(recipe, recipeIndex);
    const planned = plannedDayKeys.length > 0;
    const content = createElement(document, "div", {
      className: "accordion-content",
      id: contentId,
    });
    const headerBadges = createElement(document, "span", {
      children: [
        createTextElement(document, "span", "Favorite", {
          className: "recipe-favorite-badge",
          hidden: !isFavorite,
        }),
        createTextElement(document, "span", formatPlannedBadgeText(plannedDayKeys), {
          className: "recipe-planned-badge",
          hidden: !planned,
        }),
        createTextElement(document, "span", getSelectedBadgeText(recipe, recipeIndex), {
          className: "recipe-selected-badge",
          hidden: !isSelected,
        }),
      ],
      className: "recipe-header-badges",
      id: statusId,
    });
    const title = createTextElement(document, "span", recipe.title, {
      className: "recipe-title",
      id: titleId,
    });
    const headerTop = createElement(document, "div", {
      children: [
        title,
        headerBadges,
      ],
      className: "recipe-header-top",
    });
    const headerMetaItems = getRecipeHeaderMeta(recipe);
    const header = createElement(document, "button", {
      attributes: {
        "aria-controls": contentId,
        "aria-describedby": [statusId, headerMetaItems.length ? metaId : ""].filter(Boolean).join(" "),
        "aria-expanded": "false",
        "aria-labelledby": titleId,
      },
      children: headerTop,
      className: "accordion-header",
      type: "button",
      listeners: {
        click: (event) => {
          if (pointerSelectionIncludesTitle(event, title)) return;
          setRecipeContentOpen(recipe, recipeIndex, header, content, !content.classList.contains("open"));
        },
        keydown: (event) => handleRecipeHeaderKeydown(event, header),
      },
    });

    if (headerMetaItems.length) {
      header.appendChild(createElement(document, "div", {
        children: headerMetaItems.map((item) =>
          createTextElement(document, "span", item.text, {
            className: [
              "recipe-header-chip",
              item.primary ? "primary" : "",
              item.variant || "",
            ].filter(Boolean).join(" "),
          })
        ),
        className: "recipe-header-meta",
        id: metaId,
      }));
    }

    const heading = createElement(document, "h3", {
      children: header,
      className: "recipe-heading",
    });

    return createElement(document, "article", {
      attributes: { "aria-labelledby": titleId },
      children: [heading, content],
      classList: [
        isSelected ? "recipe-selected" : "",
        isFavorite ? "recipe-favorite" : "",
        planned ? "recipe-planned" : "",
      ],
      className: "recipe",
      dataset: {
        recipeId: recipeKey,
        recipeIndex,
      },
    });
  }

  function setupLoadMoreObserver() {
    if (!loadMoreSentinel || loadMoreObserver || typeof windowLike.IntersectionObserver !== "function") return;

    loadMoreObserver = new windowLike.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) scheduleNextRecipeBatch();
      },
      { rootMargin: getRecipeLoadAheadMargin() }
    );
    loadMoreObserver.observe(loadMoreSentinel);
  }

  function createLoadMoreSentinel() {
    const status = createTextElement(document, "span", "Loading more recipes...", {
      className: "recipe-load-more-status",
    });
    const button = createElement(document, "button", {
      className: "secondary-button",
      textContent: "Show more recipes",
      type: "button",
      listeners: { click: renderNextRecipeBatch },
    });

    return createElement(document, "div", {
      attributes: { "aria-live": "polite" },
      children: [status, button],
      className: "recipe-load-more",
    });
  }

  function scheduleNextRecipeBatch() {
    if (pendingRecipeBatchHandle || !hasMoreRecipes()) return;

    const recipeContainer = byId("recipeContainer");
    setRecipeContainerBusy(recipeContainer, true);

    const render = () => {
      pendingRecipeBatchHandle = null;
      renderNextRecipeBatch();
    };

    if (typeof windowLike.requestAnimationFrame === "function") {
      pendingRecipeBatchHandle = {
        id: windowLike.requestAnimationFrame(render),
        type: "animationFrame",
      };
      return;
    }

    pendingRecipeBatchHandle = {
      id: windowLike.setTimeout(render, 0),
      type: "timeout",
    };
  }

  function updateLoadMoreSentinel() {
    if (!loadMoreSentinel) return;

    const hasMore = hasMoreRecipes();
    const supportsIntersectionObserver = typeof windowLike.IntersectionObserver === "function";
    const fallbackButton = loadMoreSentinel.querySelector("button");
    const status = loadMoreSentinel.querySelector(".recipe-load-more-status");

    loadMoreSentinel.hidden = !hasMore;
    if (fallbackButton) fallbackButton.hidden = supportsIntersectionObserver;
    if (status) status.hidden = !supportsIntersectionObserver;

    if (!hasMore) {
      disconnectLoadMoreObserver();
      return;
    }

    setupLoadMoreObserver();
  }

  function refreshLoadMoreObserverForViewportChange() {
    if (!loadMoreSentinel || !hasMoreRecipes()) return;

    disconnectLoadMoreObserver();
    updateLoadMoreSentinel();
  }

  function renderNextRecipeBatch(options = {}) {
    cancelScheduledRecipeBatch();
    const recipeContainer = byId("recipeContainer");
    if (!recipeContainer || !hasMoreRecipes()) {
      setRecipeContainerBusy(recipeContainer, false);
      updateLoadMoreSentinel();
      notifyRecipeBatchRendered();
      return;
    }

    setRecipeContainerBusy(recipeContainer, true);
    const minimumRenderedCount = Number(options.minimumRenderedCount);
    const end = Math.min(
      currentRecipeIndexes.length,
      Math.max(
        renderedCount + getRecipeBatchSize(),
        Number.isFinite(minimumRenderedCount) ? minimumRenderedCount : 0
      )
    );
    const fragment = document.createDocumentFragment();

    for (let index = renderedCount; index < end; index += 1) {
      fragment.appendChild(renderRecipeShell(currentRecipeIndexes[index]));
    }

    renderedCount = end;
    if (loadMoreSentinel && loadMoreSentinel.parentElement === recipeContainer) {
      recipeContainer.insertBefore(fragment, loadMoreSentinel);
    } else {
      recipeContainer.appendChild(fragment);
    }

    updateLoadMoreSentinel();
    notifyRecipeBatchRendered();
    setRecipeContainerBusy(recipeContainer, false);
  }

  function renderAllRecipeBatches() {
    renderNextRecipeBatch({ minimumRenderedCount: currentRecipeIndexes.length });
  }

  function findRenderedRecipeElement(recipeId) {
    const targetRecipeId = String(recipeId || "");
    if (!targetRecipeId) return null;

    if (windowLike.CSS && typeof windowLike.CSS.escape === "function") {
      const directMatch = document.querySelector(
        `.recipe[data-recipe-id="${windowLike.CSS.escape(targetRecipeId)}"]`
      );
      if (directMatch) return directMatch;
    }

    return Array.from(document.querySelectorAll(".recipe[data-recipe-id]"))
      .find((recipeElement) => recipeElement.dataset.recipeId === targetRecipeId) || null;
  }

  function ensureRecipeRendered(recipeId) {
    const targetRecipeId = String(recipeId || "");
    if (!targetRecipeId) return null;

    const renderedElement = findRenderedRecipeElement(targetRecipeId);
    if (renderedElement) return renderedElement;

    const recipes = getRecipes();
    const targetPosition = currentRecipeIndexes.findIndex((recipeIndex) => {
      const recipe = recipes[recipeIndex];
      return recipe && actions.getRecipeKey(recipe, recipeIndex) === targetRecipeId;
    });
    if (targetPosition < 0) return null;

    if (renderedCount <= targetPosition && hasMoreRecipes()) {
      renderNextRecipeBatch({ minimumRenderedCount: targetPosition + 1 });
    }

    return findRenderedRecipeElement(targetRecipeId);
  }

  function getRevealScrollBehavior() {
    const prefersReducedMotion =
      typeof windowLike.matchMedia === "function" &&
      windowLike.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return prefersReducedMotion ? "auto" : "smooth";
  }

  function focusWithoutScrolling(element) {
    if (!element || typeof element.focus !== "function") return;

    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      element.focus();
    }
  }

  function getRevealScrollOffset() {
    const searchPanel = document.querySelector(".recipe-search");
    if (!searchPanel) return 0;

    const styles = typeof windowLike.getComputedStyle === "function"
      ? windowLike.getComputedStyle(searchPanel)
      : null;
    if (styles && (styles.display === "none" || styles.visibility === "hidden")) return 0;

    const rect = searchPanel.getBoundingClientRect();
    if (!rect.height) return 0;

    const stickyTop = styles ? Number.parseFloat(styles.top) : 0;
    return Math.ceil((Number.isFinite(stickyTop) ? Math.max(0, stickyTop) : 0) + rect.height + 8);
  }

  function scrollRecipeToRevealPosition(recipeElement) {
    if (!recipeElement || typeof windowLike.scrollTo !== "function") {
      recipeElement?.scrollIntoView({
        block: "start",
        behavior: getRevealScrollBehavior(),
        inline: "nearest",
      });
      return;
    }

    const scrollToCurrentRecipeTop = () => {
      const currentScrollY = Number.isFinite(windowLike.scrollY)
        ? windowLike.scrollY
        : Number(windowLike.pageYOffset) || 0;
      const targetTop = Math.max(
        0,
        currentScrollY + recipeElement.getBoundingClientRect().top - getRevealScrollOffset()
      );

      windowLike.scrollTo({
        behavior: "auto",
        left: 0,
        top: targetTop,
      });
    };

    scrollToCurrentRecipeTop();
    // Offscreen cards use content-visibility, so their measured position can settle after the first jump.
    if (typeof windowLike.requestAnimationFrame === "function") {
      windowLike.requestAnimationFrame(() => windowLike.requestAnimationFrame(scrollToCurrentRecipeTop));
    } else {
      windowLike.setTimeout(scrollToCurrentRecipeTop, 0);
    }
  }

  function highlightRevealedRecipe(recipeElement) {
    if (!recipeElement) return;
    if (revealedRecipeElement && revealedRecipeElement !== recipeElement) {
      revealedRecipeElement.classList.remove("recipe-reveal-highlight");
    }

    recipeElement.classList.remove("recipe-reveal-highlight");
    recipeElement.getBoundingClientRect();
    recipeElement.classList.add("recipe-reveal-highlight");
    revealedRecipeElement = recipeElement;

    if (revealHighlightTimer && typeof windowLike.clearTimeout === "function") {
      windowLike.clearTimeout(revealHighlightTimer);
    }

    if (typeof windowLike.setTimeout === "function") {
      revealHighlightTimer = windowLike.setTimeout(() => {
        recipeElement.classList.remove("recipe-reveal-highlight");
        if (revealedRecipeElement === recipeElement) revealedRecipeElement = null;
        revealHighlightTimer = null;
      }, 1800);
    }
  }

  function revealRecipeById(recipeId) {
    const recipeElement = ensureRecipeRendered(recipeId);
    if (!recipeElement) return false;

    const recipeIndex = Number(recipeElement.dataset.recipeIndex);
    const recipe = getRecipes()[recipeIndex];
    const header = recipeElement.querySelector(".accordion-header");
    const content = recipeElement.querySelector(".accordion-content");
    if (!recipe || !header || !content) return false;

    setRecipeContentOpen(recipe, recipeIndex, header, content, true);
    scrollRecipeToRevealPosition(recipeElement);
    focusWithoutScrolling(header);
    highlightRevealedRecipe(recipeElement);
    return true;
  }

  function renderRecipes(options = {}) {
    const recipeContainer = byId("recipeContainer");
    if (!recipeContainer) return;

    disconnectLoadMoreObserver();
    setRecipeContainerBusy(recipeContainer, true);
    recipeContainer.replaceChildren();
    renderedCount = 0;
    loadMoreSentinel = null;

    const recipes = getRecipes();
    currentRecipeIndexes = Array.isArray(options.recipeIndexes)
      ? options.recipeIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < recipes.length)
      : recipes.map((_recipe, index) => index);

    if (!recipes.length) {
      const empty = createEmptyState(document, {
        body: "Add recipes to the collection, then refresh the app.",
        className: "empty-state recipe-list-state",
        title: "No recipes are available.",
      });
      empty.setAttribute("role", "status");
      recipeContainer.appendChild(empty);
      setRecipeContainerBusy(recipeContainer, false);
      notifyRecipeBatchRendered();
      return;
    }

    if (!currentRecipeIndexes.length) {
      setRecipeContainerBusy(recipeContainer, false);
      notifyRecipeBatchRendered();
      return;
    }

    loadMoreSentinel = createLoadMoreSentinel();
    recipeContainer.appendChild(loadMoreSentinel);
    renderNextRecipeBatch();
  }

  function getRecipeHeaders() {
    return Array.from(document.querySelectorAll(".accordion-header"));
  }

  function handleRecipeHeaderKeydown(event, header) {
    let allHeaders = getRecipeHeaders();
    const currentIndex = allHeaders.indexOf(header);

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      header.click();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (currentIndex === allHeaders.length - 1 && hasMoreRecipes()) {
        renderNextRecipeBatch();
        allHeaders = getRecipeHeaders();
      }
      const next = allHeaders[Math.min(allHeaders.length - 1, currentIndex + 1)];
      if (next) next.focus();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = allHeaders[Math.max(0, currentIndex - 1)];
      if (prev) prev.focus();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      if (allHeaders.length) allHeaders[0].focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      if (hasMoreRecipes()) {
        renderAllRecipeBatches();
        allHeaders = getRecipeHeaders();
      }
      if (allHeaders.length) allHeaders[allHeaders.length - 1].focus();
    }
  }

  function syncRecipeSelectionIndicators() {
    const recipes = getRecipes();
    document.querySelectorAll(".recipe[data-recipe-id]").forEach((recipeElement) => {
      const recipeIndex = Number(recipeElement.dataset.recipeIndex);
      const recipe = recipes[recipeIndex];
      const isSelected = recipe ? actions.isRecipeSelected(recipe, recipeIndex) : false;
      recipeElement.classList.toggle("recipe-selected", isSelected);

      const badge = recipeElement.querySelector(".recipe-selected-badge");
      if (badge) {
        badge.hidden = !isSelected;
        badge.textContent = getSelectedBadgeText(recipe, recipeIndex);
      }

      const checkbox = recipeElement.querySelector('.recipe-add-toggle input[type="checkbox"]');
      if (checkbox) checkbox.checked = isSelected;
      recipeActions.syncRecipeAddToggleText(recipeElement.querySelector(".recipe-add-toggle"), isSelected);

      recipeActions.syncRecipeScaleControl(
        recipeElement.querySelector(".recipe-scale-control"),
        recipe,
        recipeIndex,
        isSelected
      );

      const viewButton = recipeElement.querySelector(".view-grocery-button");
      if (viewButton) viewButton.hidden = !isSelected;
    });
  }

  function syncFavoriteRecipeIndicators() {
    const recipes = getRecipes();
    document.querySelectorAll(".recipe[data-recipe-id]").forEach((recipeElement) => {
      const recipeIndex = Number(recipeElement.dataset.recipeIndex);
      const recipe = recipes[recipeIndex];
      const isFavorite = recipe ? actions.isRecipeFavorite(recipe, recipeIndex) : false;
      recipeElement.classList.toggle("recipe-favorite", isFavorite);

      const button = recipeElement.querySelector(".favorite-recipe-button");
      if (button) {
        button.setAttribute("aria-pressed", isFavorite ? "true" : "false");
        button.textContent = isFavorite ? "Favorited" : "Favorite";
      }

      const badge = recipeElement.querySelector(".recipe-favorite-badge");
      if (badge) badge.hidden = !isFavorite;
    });
  }

  function syncMealPlanIndicators() {
    const recipes = getRecipes();
    document.querySelectorAll(".recipe[data-recipe-id]").forEach((recipeElement) => {
      const recipeIndex = Number(recipeElement.dataset.recipeIndex);
      const recipe = recipes[recipeIndex];
      const planned = recipe ? isRecipePlanned(recipe, recipeIndex) : false;
      recipeElement.classList.toggle("recipe-planned", planned);

      const badge = recipeElement.querySelector(".recipe-planned-badge");
      if (badge) {
        badge.hidden = !planned;
        if (planned) badge.textContent = getPlannedBadgeText(recipe, recipeIndex);
      }

      recipeActions.syncRecipePlanSelect(recipeElement.querySelector(".recipe-plan-select"), recipe, recipeIndex);

      const viewButton = recipeElement.querySelector(".view-plan-button");
      if (viewButton) viewButton.hidden = !planned;
    });
  }

  function syncRecipeFilterTagStyles(selected) {
    currentSelectedFilters = selected || {};
    document.querySelectorAll(".recipe-tag[data-filter-key][data-filter-value]").forEach((tagEl) => {
      const key = tagEl.dataset.filterKey;
      const value = tagEl.dataset.filterValue;
      const isActive = isFilterValueActive(key, value);
      tagEl.classList.toggle("active", isActive);
      tagEl.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function renderRecipeLoadError(error) {
    const recipeContainer = byId("recipeContainer");
    if (!recipeContainer) return;

    disconnectLoadMoreObserver();
    setRecipeContainerBusy(recipeContainer, false);
    actions.onRenderError(error);

    const message = createEmptyState(document, {
      body: windowLike.location?.protocol === "file:"
        ? "Recipe data could not be loaded from data/recipes.json. Start a local web server for this folder, then refresh."
        : "Recipe data could not be loaded from data/recipes.json.",
      className: "empty-state recipe-list-state",
      title: "Recipes could not load.",
    });
    message.setAttribute("role", "alert");
    recipeContainer.replaceChildren(message);

    const meta = byId("recipeSearchMeta");
    if (meta) meta.textContent = "0 recipes";
  }

  if (compactRecipeBatchMedia && typeof compactRecipeBatchMedia.addEventListener === "function") {
    compactRecipeBatchMedia.addEventListener("change", refreshLoadMoreObserverForViewportChange);
  } else if (compactRecipeBatchMedia && typeof compactRecipeBatchMedia.addListener === "function") {
    compactRecipeBatchMedia.addListener(refreshLoadMoreObserverForViewportChange);
  }

  return {
    getRenderedRecipeCount: () => renderedCount,
    renderRecipeLoadError,
    renderRecipes,
    revealRecipeById,
    syncMealPlanIndicators,
    syncFavoriteRecipeIndicators,
    syncRecipeFilterTagStyles,
    syncRecipeSelectionIndicators,
  };
}
