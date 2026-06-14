import { getCookingIngredients, getCookingSteps } from "./cooking_model.js";
import { determineGroupForKey } from "./grouping.js";
import {
  formatGrocerySourceSummary,
  getDisplayNotes,
  getSortedGrocerySourceNames,
  formatCount,
} from "./grocery_view_model.js";
import {
  formatRatingText,
  formatServingsText,
  getRecipeHeaderMeta,
  getRecipeServingsText,
} from "./recipe_formatting.js";
import { formatTotalsForKey } from "./units.js";

export function createRenderer({ document, getRecipes, getRuntimeState, getUiState, actions }) {
  const byId = (id) => document.getElementById(id);

  const cookingModeState = {
    recipe: null,
    recipeIndex: -1,
    stepIndex: 0,
    lastRenderedStepIndex: -1,
    ingredientsExpanded: true,
  };

  function updateGrocerySummary(allKeys) {
    const runtimeState = getRuntimeState();
    const summary = byId("grocerySummary");
    const progressBar = byId("groceryProgressBar");
    const mobileBadge = byId("mobileGroceryBadge");

    const itemCount = allKeys ? allKeys.size : 0;
    const selectedRecipeCount = Object.keys(runtimeState.selectedRecipeIds || {}).length;
    const checkedCount = Array.from(allKeys || []).filter((key) => runtimeState.groceryCheckedByKey[key]).length;
    const progress = itemCount ? Math.round((checkedCount / itemCount) * 100) : 0;

    if (progressBar) {
      progressBar.style.width = `${progress}%`;
      if (progressBar.parentElement) progressBar.parentElement.hidden = itemCount === 0;
    }

    if (mobileBadge) {
      mobileBadge.hidden = itemCount === 0;
      mobileBadge.textContent = itemCount > 99 ? "99+" : String(itemCount);
    }

    const groceryTab = document.querySelector('.mobile-view-tab[data-view="grocery"]');
    if (groceryTab) {
      groceryTab.setAttribute(
        "aria-label",
        itemCount ? `Grocery List, ${itemCount} items, ${checkedCount} checked` : "Grocery List"
      );
    }

    if (!summary) return;

    if (!selectedRecipeCount) {
      summary.textContent = "No recipes selected";
      return;
    }

    const parts = [
      formatCount(itemCount, "item", "items"),
      `from ${formatCount(selectedRecipeCount, "recipe", "recipes")}`,
    ];

    if (checkedCount) parts.push(`${checkedCount} checked`);
    summary.textContent = parts.join(" - ");
  }

  function renderGrocerySource(content, sources, selectedRecipeCount) {
    const sourceSummary = formatGrocerySourceSummary(sources, selectedRecipeCount);
    if (!sourceSummary) return;

    const sourceNames = getSortedGrocerySourceNames(sources);

    if (sourceNames.length <= 1) {
      const source = document.createElement("span");
      source.className = "grocery-item-source";
      source.textContent = sourceSummary;
      content.appendChild(source);
      return;
    }

    const sourceToggle = document.createElement("button");
    sourceToggle.className = "grocery-item-source grocery-item-source-toggle";
    sourceToggle.type = "button";
    sourceToggle.textContent = sourceSummary;
    sourceToggle.setAttribute("aria-expanded", "false");

    const sourceDetails = document.createElement("span");
    sourceDetails.className = "grocery-item-source-list";
    sourceDetails.hidden = true;
    sourceNames.forEach((sourceName) => {
      const sourceItem = document.createElement("span");
      sourceItem.className = "grocery-item-source-list-item";
      sourceItem.textContent = sourceName;
      sourceDetails.appendChild(sourceItem);
    });

    sourceToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isExpanded = sourceToggle.getAttribute("aria-expanded") === "true";
      sourceToggle.setAttribute("aria-expanded", isExpanded ? "false" : "true");
      sourceDetails.hidden = isExpanded;
    });
    sourceDetails.addEventListener("click", (event) => event.stopPropagation());

    content.appendChild(sourceToggle);
    content.appendChild(sourceDetails);
  }

  function renderGroceryList() {
    const container = byId("groceryList");
    if (!container) return;

    const runtimeState = getRuntimeState();
    const uiState = getUiState();
    const groceryState = runtimeState.grocery;
    const selectedRecipeCount = Object.keys(runtimeState.selectedRecipeIds || {}).length;
    const allKeys = new Set([...Object.keys(groceryState.totalsByKey), ...Object.keys(groceryState.notesByKey)]);
    const display = {};

    container.innerHTML = "";
    updateGrocerySummary(allKeys);

    Array.from(allKeys).forEach((canonicalKey) => {
      const group = determineGroupForKey(canonicalKey);
      if (!display[group]) display[group] = {};
      display[group][canonicalKey] = {
        totals: groceryState.totalsByKey[canonicalKey] || null,
        notes: groceryState.notesByKey[canonicalKey] || [],
        sources: groceryState.sourcesByKey[canonicalKey] || [],
      };
    });

    Object.keys(display)
      .sort()
      .forEach((group) => {
        if (uiState.groupItems) {
          const title = document.createElement("div");
          title.className = "group-title";
          title.textContent = group;
          container.appendChild(title);
        }

        const ul = document.createElement("ul");

        Object.keys(display[group])
          .sort()
          .forEach((canonicalKey) => {
            const entry = display[group][canonicalKey];
            const li = document.createElement("li");
            const cb = document.createElement("input");
            const content = document.createElement("span");
            const itemName = document.createElement("span");
            const totalsText = entry.totals ? formatTotalsForKey(entry.totals) : "";
            const displayNotes = getDisplayNotes(entry.notes);
            const notesText = displayNotes.length ? ` (${displayNotes.join(", ")})` : "";
            const displayName = runtimeState.displayNamesByKey[canonicalKey] || canonicalKey;

            li.tabIndex = 0;
            cb.type = "checkbox";
            cb.checked = Boolean(runtimeState.groceryCheckedByKey[canonicalKey]);
            content.className = "grocery-item-content";
            itemName.className = "grocery-item-name";
            itemName.textContent = totalsText
              ? `${displayName} - ${totalsText}${notesText}`
              : `${displayName}${notesText}`;
            content.appendChild(itemName);
            renderGrocerySource(content, entry.sources, selectedRecipeCount);

            li.classList.toggle("checked", cb.checked);
            cb.addEventListener("change", () => {
              li.classList.toggle("checked", cb.checked);
              actions.onGroceryCheckedChange(canonicalKey, cb.checked);
              updateGrocerySummary(allKeys);
            });

            li.addEventListener("click", (event) => {
              if (event.target === cb) return;
              cb.checked = !cb.checked;
              cb.dispatchEvent(new Event("change"));
            });

            li.addEventListener("keydown", (event) => {
              if (event.target !== li) return;
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event("change"));
              }
            });

            li.appendChild(cb);
            li.appendChild(content);
            ul.appendChild(li);
          });

        container.appendChild(ul);
      });

    if (!container.children.length) {
      const empty = document.createElement("div");
      const title = document.createElement("strong");
      const body = document.createElement("span");

      empty.className = "empty-state";
      title.textContent = "Your grocery list is empty.";
      body.textContent = "Add recipes from the Recipes view and their shopping items will appear here.";
      empty.appendChild(title);
      empty.appendChild(body);
      container.appendChild(empty);
    }
  }

  function renderRecipeTags(tags) {
    const t = tags || {};
    const wrap = document.createElement("div");
    wrap.className = "recipe-tags";

    function add(label, className, filterKey, filterValue) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `recipe-tag ${className}`;
      el.dataset.filterKey = filterKey;
      el.dataset.filterValue = filterValue;
      el.setAttribute("aria-pressed", "false");
      el.textContent = label;
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        actions.onRecipeTagToggle(filterKey, filterValue);
      });
      wrap.appendChild(el);
    }

    const status = t.status === "tried" ? "tried" : "not-tried";
    add(status === "tried" ? "Tried" : "Not Tried", status === "tried" ? "tag-tried" : "tag-not-tried", "status", status);

    if (t.rating) add(t.rating.charAt(0).toUpperCase() + t.rating.slice(1), `tag-${t.rating}`, "rating", t.rating);
    if (t.difficulty) {
      add(t.difficulty.charAt(0).toUpperCase() + t.difficulty.slice(1), `tag-${t.difficulty}`, "difficulty", t.difficulty);
    }
    if (Array.isArray(t.equipment)) {
      t.equipment.forEach((eq) => add(eq.replace(/-/g, " "), "tag-equipment", "equipment", eq));
    }

    return wrap;
  }

  function renderRecipeActions(recipe, recipeIndex) {
    const actionsWrap = document.createElement("div");
    const favoriteButton = document.createElement("button");
    const cookButton = document.createElement("button");
    const toggle = document.createElement("label");
    const addToListCheckbox = document.createElement("input");
    const addToListText = document.createElement("span");
    const viewGroceryButton = document.createElement("button");

    actionsWrap.className = "recipe-actions";

    favoriteButton.className = "favorite-recipe-button";
    favoriteButton.type = "button";
    favoriteButton.setAttribute("aria-pressed", actions.isRecipeFavorite(recipe, recipeIndex) ? "true" : "false");
    favoriteButton.textContent = actions.isRecipeFavorite(recipe, recipeIndex) ? "Favorited" : "Favorite";
    favoriteButton.addEventListener("click", () => {
      actions.onFavoriteRecipe(recipe, recipeIndex, !actions.isRecipeFavorite(recipe, recipeIndex));
    });
    actionsWrap.appendChild(favoriteButton);

    cookButton.className = "primary-button cooking-mode-button";
    cookButton.type = "button";
    cookButton.textContent = "Cook mode";
    cookButton.addEventListener("click", () => openCookingMode(recipe, recipeIndex));
    actionsWrap.appendChild(cookButton);

    toggle.className = "checkbox-inline recipe-add-toggle";
    addToListCheckbox.type = "checkbox";
    addToListCheckbox.dataset.recipeId = actions.getRecipeKey(recipe, recipeIndex);
    addToListCheckbox.checked = actions.isRecipeSelected(recipe, recipeIndex);
    addToListText.textContent = "Add to grocery list";
    toggle.appendChild(addToListCheckbox);
    toggle.appendChild(addToListText);
    actionsWrap.appendChild(toggle);

    viewGroceryButton.className = "view-grocery-button";
    viewGroceryButton.type = "button";
    viewGroceryButton.textContent = "View list";
    viewGroceryButton.hidden = !addToListCheckbox.checked;
    viewGroceryButton.addEventListener("click", actions.onViewGroceryList);
    actionsWrap.appendChild(viewGroceryButton);

    addToListCheckbox.addEventListener("change", () => {
      actions.onSelectRecipe(recipe, recipeIndex, addToListCheckbox.checked);
      viewGroceryButton.hidden = !addToListCheckbox.checked;
    });

    if (recipe.link) {
      const link = document.createElement("a");
      link.className = "recipe-link recipe-action-link";
      link.href = recipe.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View full recipe";
      actionsWrap.appendChild(link);
    }

    return actionsWrap;
  }

  function appendSectionList(content, titleText, items, ordered = false) {
    if (!Array.isArray(items) || !items.length) return;

    const title = document.createElement("h4");
    const list = document.createElement(ordered ? "ol" : "ul");
    title.className = "recipe-section-title";
    title.textContent = titleText;

    items.forEach((item) => {
      const li = document.createElement("li");
      li.tabIndex = 0;
      li.textContent = item;
      list.appendChild(li);
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

    const metaWrap = document.createElement("div");
    const grid = document.createElement("div");
    metaWrap.className = "recipe-meta";
    grid.className = "recipe-meta-grid";

    metaItems.forEach((item) => {
      const p = document.createElement("p");
      const label = document.createElement("span");
      const value = document.createElement("span");
      p.className = "recipe-meta-item";
      label.className = "recipe-meta-label";
      label.textContent = `${item.label}:`;
      value.textContent = ` ${item.value}`;
      p.appendChild(label);
      p.appendChild(value);
      grid.appendChild(p);
    });

    metaWrap.appendChild(grid);
    content.appendChild(metaWrap);
  }

  function appendPersonalNotes(content, notes) {
    if (!Array.isArray(notes) || !notes.length) return;

    const personalNotesWrap = document.createElement("div");
    const title = document.createElement("div");
    const label = document.createElement("span");
    personalNotesWrap.className = "recipe-meta personal-notes";
    title.className = "recipe-meta-item";
    label.className = "recipe-meta-label";
    label.textContent = "Personal Notes:";
    title.appendChild(label);
    personalNotesWrap.appendChild(title);

    notes.forEach((note) => {
      const noteItem = document.createElement("div");
      noteItem.className = "recipe-meta-item";
      noteItem.textContent = `- ${note}`;
      personalNotesWrap.appendChild(noteItem);
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
    const title = document.createElement("h4");
    const list = document.createElement("ul");
    title.className = "recipe-section-title";
    title.textContent = "Nutrition";

    nutritionLabelOrder.forEach(([key, label]) => {
      if (!nutrition[key]) return;
      const li = document.createElement("li");
      li.tabIndex = 0;
      li.textContent = `${label}: ${nutrition[key]}`;
      list.appendChild(li);
    });

    if (!list.children.length) return;
    content.appendChild(title);
    content.appendChild(list);
  }

  function renderRecipes() {
    const recipeContainer = byId("recipeContainer");
    if (!recipeContainer) return;

    recipeContainer.innerHTML = "";
    getRecipes().forEach((recipe, recipeIndex) => {
      const recipeKey = actions.getRecipeKey(recipe, recipeIndex);
      const wrap = document.createElement("div");
      const header = document.createElement("div");
      const headerTop = document.createElement("div");
      const title = document.createElement("span");
      const headerBadges = document.createElement("span");
      const favoriteBadge = document.createElement("span");
      const selectedBadge = document.createElement("span");
      const content = document.createElement("div");

      wrap.className = "recipe";
      wrap.classList.toggle("recipe-selected", actions.isRecipeSelected(recipe, recipeIndex));
      wrap.classList.toggle("recipe-favorite", actions.isRecipeFavorite(recipe, recipeIndex));
      wrap.dataset.recipeIndex = String(recipeIndex);
      wrap.dataset.recipeId = recipeKey;
      wrap.dataset.searchText = actions.buildRecipeSearchText(recipe);

      header.className = "accordion-header";
      header.tabIndex = 0;
      header.setAttribute("role", "button");
      header.setAttribute("aria-expanded", "false");

      headerTop.className = "recipe-header-top";
      title.className = "recipe-title";
      title.textContent = recipe.title;
      headerTop.appendChild(title);

      headerBadges.className = "recipe-header-badges";
      favoriteBadge.className = "recipe-favorite-badge";
      favoriteBadge.textContent = "Favorite";
      favoriteBadge.hidden = !actions.isRecipeFavorite(recipe, recipeIndex);
      selectedBadge.className = "recipe-selected-badge";
      selectedBadge.textContent = "In list";
      selectedBadge.hidden = !actions.isRecipeSelected(recipe, recipeIndex);
      headerBadges.appendChild(favoriteBadge);
      headerBadges.appendChild(selectedBadge);
      headerTop.appendChild(headerBadges);
      header.appendChild(headerTop);

      const headerMetaItems = getRecipeHeaderMeta(recipe);
      if (headerMetaItems.length) {
        const headerMeta = document.createElement("div");
        headerMeta.className = "recipe-header-meta";
        headerMetaItems.forEach((item) => {
          const chip = document.createElement("span");
          chip.className = "recipe-header-chip";
          if (item.primary) chip.classList.add("primary");
          if (item.variant) chip.classList.add(item.variant);
          chip.textContent = item.text;
          headerMeta.appendChild(chip);
        });
        header.appendChild(headerMeta);
      }

      content.className = "accordion-content";
      content.appendChild(renderRecipeTags(recipe.tags));
      content.appendChild(renderRecipeActions(recipe, recipeIndex));

      header.addEventListener("click", () => {
        const isOpen = content.classList.toggle("open");
        header.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
      header.addEventListener("keydown", (event) => handleRecipeHeaderKeydown(event, header));

      if (recipe.category) {
        const tag = document.createElement("div");
        tag.className = "category-tag";
        tag.textContent = recipe.category;
        content.appendChild(tag);
      }

      appendRecipeMeta(content, recipe);
      appendPersonalNotes(content, recipe.personalNotes);

      if (recipe.description) {
        const p = document.createElement("p");
        p.className = "recipe-description";
        p.textContent = recipe.description;
        content.appendChild(p);
      }

      appendSectionList(content, "Equipment", recipe.equipment);
      appendNutrition(content, recipe.nutrition);
      appendSectionList(content, "Ingredients", recipe.ingredients);
      appendSectionList(content, "Instructions", recipe.instructions, true);
      appendSectionList(content, "Notes", recipe.notes);

      wrap.appendChild(header);
      wrap.appendChild(content);
      recipeContainer.appendChild(wrap);
    });
  }

  function handleRecipeHeaderKeydown(event, header) {
    const allHeaders = Array.from(document.querySelectorAll(".accordion-header"));
    const currentIndex = allHeaders.indexOf(header);

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      header.click();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
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
      if (badge) badge.hidden = !isSelected;

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

  function syncRecipeCheckboxes() {
    const recipes = getRecipes();
    document.querySelectorAll('.checkbox-inline input[type="checkbox"][data-recipe-id]').forEach((cb) => {
      const recipeIndex = Number(cb.closest(".recipe")?.dataset.recipeIndex);
      const recipe = recipes[recipeIndex];
      cb.checked = recipe ? actions.isRecipeSelected(recipe, recipeIndex) : false;
    });
    syncRecipeSelectionIndicators();
  }

  function syncRecipeFilterTagStyles(selected) {
    document.querySelectorAll(".recipe-tag[data-filter-key][data-filter-value]").forEach((tagEl) => {
      const key = tagEl.dataset.filterKey;
      const value = tagEl.dataset.filterValue;
      const selectedValues = selected[key];
      const isActive =
        selectedValues instanceof Set
          ? selectedValues.has(value)
          : Array.isArray(selectedValues) && selectedValues.includes(value);
      tagEl.classList.toggle("active", isActive);
      tagEl.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function isMobileCookingLayout() {
    return window.matchMedia && window.matchMedia("(max-width: 979px)").matches;
  }

  function openCookingMode(recipe, recipeIndex) {
    cookingModeState.recipe = recipe;
    cookingModeState.recipeIndex = recipeIndex;
    cookingModeState.stepIndex = 0;
    cookingModeState.lastRenderedStepIndex = -1;
    cookingModeState.ingredientsExpanded = !isMobileCookingLayout();

    const cookingMode = byId("cookingMode");
    if (!cookingMode) return;

    cookingMode.hidden = false;
    document.body.classList.add("is-cooking-mode");
    renderCookingMode();

    const nextButton = byId("nextCookingStep");
    if (nextButton) nextButton.focus();
  }

  function closeCookingMode() {
    const cookingMode = byId("cookingMode");
    if (cookingMode) cookingMode.hidden = true;
    document.body.classList.remove("is-cooking-mode");
  }

  function isCookingModeOpen() {
    const cookingMode = byId("cookingMode");
    return Boolean(cookingMode && !cookingMode.hidden);
  }

  function setCookingStep(nextIndex) {
    const steps = getCookingSteps(cookingModeState.recipe);
    cookingModeState.stepIndex = Math.max(0, Math.min(steps.length - 1, nextIndex));
    renderCookingMode();
  }

  function goToPreviousCookingStep() {
    if (cookingModeState.stepIndex > 0) setCookingStep(cookingModeState.stepIndex - 1);
  }

  function goToNextCookingStep(options = {}) {
    const steps = getCookingSteps(cookingModeState.recipe);
    if (cookingModeState.stepIndex >= steps.length - 1) {
      if (options.finishOnLast) closeCookingMode();
      return;
    }

    setCookingStep(cookingModeState.stepIndex + 1);
  }

  function setCookingIngredientsExpanded(isExpanded) {
    cookingModeState.ingredientsExpanded = Boolean(isExpanded);
    renderCookingMode();
  }

  function toggleCookingIngredients() {
    setCookingIngredientsExpanded(!cookingModeState.ingredientsExpanded);
  }

  function handleCookingResize() {
    if (!isCookingModeOpen()) return;
    if (!isMobileCookingLayout()) cookingModeState.ingredientsExpanded = true;
    renderCookingMode();
  }

  function renderCookingIngredients(recipe) {
    const container = byId("cookingIngredients");
    if (!container) return;

    container.innerHTML = "";
    const ingredients = getCookingIngredients(recipe);
    if (!ingredients.length) {
      const empty = document.createElement("p");
      empty.className = "cooking-empty";
      empty.textContent = "No ingredients are listed for this recipe.";
      container.appendChild(empty);
      return;
    }

    const ul = document.createElement("ul");
    ingredients.forEach((ingredient) => {
      const li = document.createElement("li");
      li.textContent = ingredient;
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  function renderCookingMode() {
    const recipe = cookingModeState.recipe;
    if (!recipe) return;

    const steps = getCookingSteps(recipe);
    const ingredients = getCookingIngredients(recipe);
    const stepIndex = Math.max(0, Math.min(cookingModeState.stepIndex, steps.length - 1));
    const canCollapseIngredients = isMobileCookingLayout();
    const ingredientsExpanded = !canCollapseIngredients || cookingModeState.ingredientsExpanded;
    cookingModeState.stepIndex = stepIndex;

    const title = byId("cookingTitle");
    const meta = byId("cookingMeta");
    const stepCount = byId("cookingStepCount");
    const stepText = byId("cookingStepText");
    const stepPanel = document.querySelector(".cooking-step-panel");
    const progressBar = byId("cookingProgressBar");
    const previousButton = byId("previousCookingStep");
    const nextButton = byId("nextCookingStep");
    const ingredientsPanel = byId("cookingIngredientsPanel");
    const ingredientsContainer = byId("cookingIngredients");
    const ingredientsSummary = byId("cookingIngredientsSummary");
    const ingredientsToggle = byId("toggleCookingIngredients");

    if (title) title.textContent = recipe.title || "Recipe";
    if (meta) {
      meta.textContent = getRecipeHeaderMeta(recipe)
        .filter((item) => !item.primary)
        .map((item) => item.text)
        .join(" - ");
    }
    if (stepCount) stepCount.textContent = `Step ${stepIndex + 1} of ${steps.length}`;
    if (stepText) stepText.textContent = steps[stepIndex];
    if (stepPanel && cookingModeState.lastRenderedStepIndex !== stepIndex) {
      stepPanel.scrollTop = 0;
      cookingModeState.lastRenderedStepIndex = stepIndex;
    }
    if (progressBar) progressBar.style.width = `${Math.round(((stepIndex + 1) / steps.length) * 100)}%`;
    if (previousButton) previousButton.disabled = stepIndex === 0;
    if (nextButton) nextButton.textContent = stepIndex === steps.length - 1 ? "Finish" : "Next";
    if (ingredientsPanel) ingredientsPanel.classList.toggle("is-collapsed", !ingredientsExpanded);
    if (ingredientsContainer) ingredientsContainer.hidden = !ingredientsExpanded;
    if (ingredientsSummary) {
      ingredientsSummary.textContent = ingredients.length === 1 ? "1 item" : `${ingredients.length || "No"} items`;
    }
    if (ingredientsToggle) {
      ingredientsToggle.disabled = !canCollapseIngredients;
      ingredientsToggle.setAttribute(
        "aria-label",
        canCollapseIngredients ? `${ingredientsExpanded ? "Collapse" : "Expand"} ingredients` : "Ingredients"
      );
      ingredientsToggle.setAttribute("aria-expanded", ingredientsExpanded ? "true" : "false");
    }

    renderCookingIngredients(recipe);
  }

  function renderRecipeLoadError(error) {
    const recipeContainer = byId("recipeContainer");
    if (!recipeContainer) return;

    actions.onRenderError(error);
    recipeContainer.innerHTML = "";

    const message = document.createElement("p");
    message.className = "recipe-description";
    message.textContent =
      window.location.protocol === "file:"
        ? "Recipe data could not be loaded from data/recipes.json. Start a local web server for this folder, then refresh."
        : "Recipe data could not be loaded from data/recipes.json.";
    recipeContainer.appendChild(message);

    const meta = byId("recipeSearchMeta");
    if (meta) meta.textContent = "Showing 0";
  }

  return {
    closeCookingMode,
    goToNextCookingStep,
    goToPreviousCookingStep,
    handleCookingResize,
    isCookingModeOpen,
    renderGroceryList,
    renderRecipeLoadError,
    renderRecipes,
    syncFavoriteRecipeIndicators,
    syncRecipeCheckboxes,
    syncRecipeFilterTagStyles,
    syncRecipeSelectionIndicators,
    toggleCookingIngredients,
  };
}
