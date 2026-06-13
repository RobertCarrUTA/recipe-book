/* ================================
RENDER GROCERY LIST
================================ */
function renderGroceryList() {
  const container = document.getElementById("groceryList");
  container.innerHTML = "";

  const grouped = document.getElementById("groupToggle").checked;

  const display = {};

  const allKeys = new Set([...Object.keys(groceryState.totalsByKey), ...Object.keys(groceryState.notesByKey)]);
  updateGrocerySummary(allKeys);

  Array.from(allKeys).forEach((canonicalKey) => {
    const group = determineGroupForKey(canonicalKey);

    if (!display[group]) display[group] = {};
    display[group][canonicalKey] = {
      totals: groceryState.totalsByKey[canonicalKey] || null,
      notes: groceryState.notesByKey[canonicalKey] || [],
    };
  });

  Object.keys(display)
    .sort()
    .forEach((group) => {
      if (grouped) {
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
          li.tabIndex = 0;
          const cb = document.createElement("input");
          cb.type = "checkbox";

          const span = document.createElement("span");

          const totalsText = entry.totals ? formatTotalsForKey(entry.totals) : "";
          const displayNotes = getDisplayNotes(entry.notes);
          const notesText = displayNotes.length ? ` (${displayNotes.join(", ")})` : "";

          const displayName =
            (parsedCanonicalDisplayMap && parsedCanonicalDisplayMap[canonicalKey]) || canonicalKey;

          span.textContent = totalsText
            ? `${displayName} - ${totalsText}${notesText}`
            : `${displayName}${notesText}`;

          cb.checked = !!groceryCheckedByKey[canonicalKey];
          li.classList.toggle("checked", cb.checked);

          cb.onchange = () => {
            li.classList.toggle("checked", cb.checked);
            if (cb.checked) {
              groceryCheckedByKey[canonicalKey] = true;
            } else {
              delete groceryCheckedByKey[canonicalKey];
            }
            updateGrocerySummary(allKeys);
            savePersistentState();
          };

          li.addEventListener("click", (event) => {
            if (event.target === cb) return;
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event("change"));
          });

          li.onkeydown = (event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              cb.checked = !cb.checked;
              cb.dispatchEvent(new Event("change"));
            }
          };

          li.appendChild(cb);
          li.appendChild(span);
          ul.appendChild(li);
        });

      container.appendChild(ul);
    });

  if (!container.children.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = "Your grocery list is empty.";
    const body = document.createElement("span");
    body.textContent = "Add recipes from the Recipes view and their shopping items will appear here.";
    empty.appendChild(title);
    empty.appendChild(body);
    container.appendChild(empty);
  }
}

function formatCount(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function updateGrocerySummary(allKeys) {
  const summary = document.getElementById("grocerySummary");
  const progressBar = document.getElementById("groceryProgressBar");
  const mobileBadge = document.getElementById("mobileGroceryBadge");

  const itemCount = allKeys ? allKeys.size : 0;
  const selectedRecipeCount = Object.keys(groceryState.selectedRecipeIds || {}).length;
  const checkedCount = Array.from(allKeys || []).filter((key) => groceryCheckedByKey[key]).length;
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

  if (checkedCount) {
    parts.push(`${checkedCount} checked`);
  }

  summary.textContent = parts.join(" - ");
}

function getDisplayNotes(notes) {
  const hiddenNotes = new Set([
    "as needed",
    "divided",
    "for filling",
    "for frosting",
    "for syrup",
    "for topping",
    "plus more",
    "to taste",
  ]);

  return (notes || []).filter((note) => !hiddenNotes.has(String(note).toLowerCase()));
}

/* ================================
RECIPE TAG RENDERING
================================ */

function renderRecipeTags(tags) {
  const t = tags || {};
  const wrap = document.createElement("div");
  wrap.className = "recipe-tags";

  function add(label, className, filterKey, filterValue) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "recipe-tag " + className;
    el.dataset.filterKey = filterKey;
    el.dataset.filterValue = filterValue;
    el.setAttribute("aria-pressed", "false");
    el.textContent = label;

    el.addEventListener("click", function (event) {
      event.stopPropagation();

      const checkbox = document.querySelector(
        '.recipe-filters input[data-filter="' + filterKey + '"][value="' + filterValue + '"]'
      );

      if (!checkbox) {
        return;
      }

      checkbox.checked = !checkbox.checked;
      el.classList.toggle("active", checkbox.checked);
      el.setAttribute("aria-pressed", checkbox.checked ? "true" : "false");

      persistFilters();

      applyRecipeFilter(document.getElementById("recipeSearch").value || "");
    });

    wrap.appendChild(el);
  }

  const status = t.status === "tried" ? "tried" : "not-tried";
  add(
    status === "tried" ? "Tried" : "Not Tried",
    status === "tried" ? "tag-tried" : "tag-not-tried",
    "status",
    status
  );

  if (t.rating) {
    add(t.rating.charAt(0).toUpperCase() + t.rating.slice(1), "tag-" + t.rating, "rating", t.rating);
  }

  if (t.difficulty) {
    add(
      t.difficulty.charAt(0).toUpperCase() + t.difficulty.slice(1),
      "tag-" + t.difficulty,
      "difficulty",
      t.difficulty
    );
  }

  if (Array.isArray(t.equipment)) {
    t.equipment.forEach(function (eq) {
      add(eq.replace(/-/g, " "), "tag-equipment", "equipment", eq);
    });
  }

  return wrap;
}

function renderRecipeActions(recipe, recipeIndex) {
  const actions = document.createElement("div");
  actions.className = "recipe-actions";

  const favoriteButton = document.createElement("button");
  favoriteButton.className = "favorite-recipe-button";
  favoriteButton.type = "button";
  favoriteButton.setAttribute("aria-pressed", isRecipeFavorite(recipe, recipeIndex) ? "true" : "false");
  favoriteButton.textContent = isRecipeFavorite(recipe, recipeIndex) ? "Favorited" : "Favorite";
  favoriteButton.addEventListener("click", () => {
    setRecipeFavorite(recipe, recipeIndex, !isRecipeFavorite(recipe, recipeIndex));
  });
  actions.appendChild(favoriteButton);

  const cookButton = document.createElement("button");
  cookButton.className = "primary-button cooking-mode-button";
  cookButton.type = "button";
  cookButton.textContent = "Cook mode";
  cookButton.addEventListener("click", () => {
    openCookingMode(recipe, recipeIndex);
  });
  actions.appendChild(cookButton);

  const toggle = document.createElement("label");
  toggle.className = "checkbox-inline recipe-add-toggle";

  const addToListCheckbox = document.createElement("input");
  addToListCheckbox.type = "checkbox";
  addToListCheckbox.dataset.recipeId = getRecipeKey(recipe, recipeIndex);
  addToListCheckbox.checked = isRecipeSelected(recipe, recipeIndex);

  const addToListText = document.createElement("span");
  addToListText.textContent = "Add to grocery list";

  toggle.appendChild(addToListCheckbox);
  toggle.appendChild(addToListText);
  actions.appendChild(toggle);

  const viewGroceryButton = document.createElement("button");
  viewGroceryButton.className = "view-grocery-button";
  viewGroceryButton.type = "button";
  viewGroceryButton.textContent = "View list";
  viewGroceryButton.hidden = !addToListCheckbox.checked;
  viewGroceryButton.addEventListener("click", () => {
    if (typeof setMobileView === "function") setMobileView("grocery");
    const groceryPanel = document.getElementById("groceryPanel");
    if (groceryPanel) groceryPanel.scrollIntoView({ block: "start" });
  });
  actions.appendChild(viewGroceryButton);

  addToListCheckbox.addEventListener("change", () => {
    setRecipeSelected(recipe, recipeIndex, addToListCheckbox.checked);
    viewGroceryButton.hidden = !addToListCheckbox.checked;
  });

  if (recipe.link) {
    const a = document.createElement("a");
    a.className = "recipe-link recipe-action-link";
    a.href = recipe.link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "View full recipe";
    actions.appendChild(a);
  }

  return actions;
}

function formatHeaderLabel(value) {
  return String(value || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRecipeServingsText(recipe) {
  return recipe && (recipe.servings || recipe.yield) ? String(recipe.servings || recipe.yield) : "";
}

function formatServingsText(rawServings) {
  const text = normalizeWhitespace(rawServings);
  if (!text) return "";

  const lower = text.toLowerCase();
  const descriptiveServingWords = [
    "serving",
    "servings",
    "bar",
    "bars",
    "biscuit",
    "biscuits",
    "cake",
    "cakes",
    "churro",
    "churros",
    "cookie",
    "cookies",
    "cupcake",
    "cupcakes",
    "donut",
    "donuts",
    "hole",
    "holes",
    "hush",
    "minis",
    "pancake",
    "pancakes",
    "pizza",
    "roll",
    "rolls",
    "skillet",
  ];

  if (descriptiveServingWords.some((word) => new RegExp(`\\b${word}\\b`).test(lower))) {
    return text;
  }

  const rangeWithDetail = text.match(/^(\d+(?:\s*-\s*\d+)?)\s*\((.+)\)$/);
  if (rangeWithDetail) {
    return `${rangeWithDetail[1].replace(/\s*-\s*/g, "-")} servings (${rangeWithDetail[2]})`;
  }

  if (/^\d+(?:\s*-\s*\d+)?$/.test(text)) {
    const normalizedCount = text.replace(/\s*-\s*/g, "-");
    return `${normalizedCount} ${normalizedCount === "1" ? "serving" : "servings"}`;
  }

  return text;
}

function formatReviewCount(count) {
  if (count === undefined || count === null || count === "") return "";

  const numericCount = Number(String(count).replace(/,/g, ""));
  const displayCount = Number.isFinite(numericCount)
    ? new Intl.NumberFormat().format(numericCount)
    : String(count);

  return `${displayCount} ${String(displayCount) === "1" ? "review" : "reviews"}`;
}

function formatRatingText(rating, mode) {
  if (!rating || (!rating.value && !rating.count)) return "";

  const ratingValue = rating.value !== undefined && rating.value !== null ? String(rating.value) : "";
  const reviewText = formatReviewCount(rating.count);

  if (!ratingValue) return reviewText;

  const label = mode === "chip" ? "rating" : "stars";
  return reviewText ? `${ratingValue} ${label} (${reviewText})` : `${ratingValue} ${label}`;
}

function getRecipeHeaderMeta(recipe) {
  const meta = [];

  if (recipe.category) {
    meta.push({ text: recipe.category, primary: true });
  }

  const ratingText = formatRatingText(recipe.rating, "chip");
  if (ratingText) {
    meta.push({ text: ratingText, variant: "rating" });
  }

  if (recipe.totalTime) {
    meta.push({ text: recipe.totalTime });
  } else if (recipe.cookTime) {
    meta.push({ text: recipe.cookTime });
  }

  const servingsText = formatServingsText(getRecipeServingsText(recipe));
  if (servingsText) {
    meta.push({ text: servingsText });
  }

  if (recipe.tags && recipe.tags.difficulty) {
    meta.push({ text: formatHeaderLabel(recipe.tags.difficulty) });
  }

  return meta.slice(0, 4);
}

function syncRecipeSelectionIndicators() {
  document.querySelectorAll(".recipe[data-recipe-id]").forEach((recipeElement) => {
    const recipeId = recipeElement.dataset.recipeId;
    const isSelected = !!groceryState.selectedRecipeIds[recipeId];
    recipeElement.classList.toggle("recipe-selected", isSelected);

    const badge = recipeElement.querySelector(".recipe-selected-badge");
    if (badge) badge.hidden = !isSelected;

    const viewButton = recipeElement.querySelector(".view-grocery-button");
    if (viewButton) viewButton.hidden = !isSelected;
  });
}

function syncFavoriteRecipeIndicators() {
  document.querySelectorAll(".recipe[data-recipe-id]").forEach((recipeElement) => {
    const recipeId = recipeElement.dataset.recipeId;
    const isFavorite = !!favoriteRecipeIds[recipeId];
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

const cookingModeState = {
  recipe: null,
  recipeIndex: -1,
  stepIndex: 0,
  ingredientsExpanded: true,
};

function getCookingSteps(recipe) {
  return Array.isArray(recipe && recipe.instructions) && recipe.instructions.length
    ? recipe.instructions
    : ["No instructions are available for this recipe yet."];
}

function isMobileCookingLayout() {
  return window.matchMedia && window.matchMedia("(max-width: 979px)").matches;
}

function openCookingMode(recipe, recipeIndex) {
  cookingModeState.recipe = recipe;
  cookingModeState.recipeIndex = recipeIndex;
  cookingModeState.stepIndex = 0;
  cookingModeState.ingredientsExpanded = !isMobileCookingLayout();

  const cookingMode = document.getElementById("cookingMode");
  if (!cookingMode) return;

  cookingMode.hidden = false;
  document.body.classList.add("is-cooking-mode");
  renderCookingMode();

  const nextButton = document.getElementById("nextCookingStep");
  if (nextButton) nextButton.focus();
}

function closeCookingMode() {
  const cookingMode = document.getElementById("cookingMode");
  if (cookingMode) cookingMode.hidden = true;
  document.body.classList.remove("is-cooking-mode");
}

function isCookingModeOpen() {
  const cookingMode = document.getElementById("cookingMode");
  return !!(cookingMode && !cookingMode.hidden);
}

function setCookingStep(nextIndex) {
  const steps = getCookingSteps(cookingModeState.recipe);
  cookingModeState.stepIndex = Math.max(0, Math.min(steps.length - 1, nextIndex));
  renderCookingMode();
}

function setCookingIngredientsExpanded(isExpanded) {
  cookingModeState.ingredientsExpanded = !!isExpanded;
  renderCookingMode();
}

function getCookingIngredients(recipe) {
  return Array.isArray(recipe && recipe.ingredients) ? recipe.ingredients : [];
}

function renderCookingIngredients(recipe) {
  const container = document.getElementById("cookingIngredients");
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
  const ingredientsExpanded = !isMobileCookingLayout() || cookingModeState.ingredientsExpanded;
  cookingModeState.stepIndex = stepIndex;

  const title = document.getElementById("cookingTitle");
  const meta = document.getElementById("cookingMeta");
  const stepCount = document.getElementById("cookingStepCount");
  const stepText = document.getElementById("cookingStepText");
  const progressBar = document.getElementById("cookingProgressBar");
  const previousButton = document.getElementById("previousCookingStep");
  const nextButton = document.getElementById("nextCookingStep");
  const ingredientsPanel = document.getElementById("cookingIngredientsPanel");
  const ingredientsContainer = document.getElementById("cookingIngredients");
  const ingredientsSummary = document.getElementById("cookingIngredientsSummary");
  const ingredientsToggle = document.getElementById("toggleCookingIngredients");

  if (title) title.textContent = recipe.title || "Recipe";
  if (meta) {
    const metaItems = getRecipeHeaderMeta(recipe)
      .filter((item) => !item.primary)
      .map((item) => item.text);
    meta.textContent = metaItems.join(" - ");
  }
  if (stepCount) stepCount.textContent = `Step ${stepIndex + 1} of ${steps.length}`;
  if (stepText) stepText.textContent = steps[stepIndex];
  if (progressBar) progressBar.style.width = `${Math.round(((stepIndex + 1) / steps.length) * 100)}%`;

  if (previousButton) previousButton.disabled = stepIndex === 0;
  if (nextButton) nextButton.textContent = stepIndex === steps.length - 1 ? "Finish" : "Next";
  if (ingredientsPanel) ingredientsPanel.classList.toggle("is-collapsed", !ingredientsExpanded);
  if (ingredientsContainer) ingredientsContainer.hidden = !ingredientsExpanded;
  if (ingredientsSummary) {
    ingredientsSummary.textContent =
      ingredients.length === 1 ? "1 item" : `${ingredients.length || "No"} items`;
  }
  if (ingredientsToggle) {
    ingredientsToggle.textContent = ingredientsExpanded ? "Hide" : "Show";
    ingredientsToggle.setAttribute("aria-expanded", ingredientsExpanded ? "true" : "false");
  }

  renderCookingIngredients(recipe);
}

/* ================================
RENDER RECIPES
================================ */
function renderRecipes() {
  recipeContainer.innerHTML = "";

  recipes.forEach((recipe, recipeIndex) => {
    const recipeKey = getRecipeKey(recipe, recipeIndex);
    const wrap = document.createElement("div");
    wrap.className = "recipe";
    wrap.classList.toggle("recipe-selected", isRecipeSelected(recipe, recipeIndex));
    wrap.classList.toggle("recipe-favorite", isRecipeFavorite(recipe, recipeIndex));
    wrap.dataset.recipeIndex = String(recipeIndex);
    wrap.dataset.recipeId = recipeKey;
    wrap.dataset.searchText = buildRecipeSearchText(recipe);

    const header = document.createElement("div");
    header.className = "accordion-header";
    header.tabIndex = 0;
    header.setAttribute("role", "button");
    header.setAttribute("aria-expanded", "false");

    const headerTop = document.createElement("div");
    headerTop.className = "recipe-header-top";

    const title = document.createElement("span");
    title.className = "recipe-title";
    title.textContent = recipe.title;
    headerTop.appendChild(title);

    const headerBadges = document.createElement("span");
    headerBadges.className = "recipe-header-badges";

    const favoriteBadge = document.createElement("span");
    favoriteBadge.className = "recipe-favorite-badge";
    favoriteBadge.textContent = "Favorite";
    favoriteBadge.hidden = !isRecipeFavorite(recipe, recipeIndex);
    headerBadges.appendChild(favoriteBadge);

    const selectedBadge = document.createElement("span");
    selectedBadge.className = "recipe-selected-badge";
    selectedBadge.textContent = "In list";
    selectedBadge.hidden = !isRecipeSelected(recipe, recipeIndex);
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

    const content = document.createElement("div");
    content.className = "accordion-content";

    content.appendChild(renderRecipeTags(recipe.tags));
    content.appendChild(renderRecipeActions(recipe, recipeIndex));

    function setExpandedState(isOpen) {
      header.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    header.onclick = () => {
      const isOpen = content.classList.toggle("open");
      setExpandedState(isOpen);
    };

    header.onkeydown = (event) => {
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
        return;
      }
    };

    if (recipe.category) {
      const tag = document.createElement("div");
      tag.className = "category-tag";
      tag.textContent = recipe.category;
      content.appendChild(tag);
    }

    const metaItems = [];

    if (recipe.author) metaItems.push({ label: "Author", value: recipe.author });

    if (recipe.rating && (recipe.rating.value || recipe.rating.count)) {
      const ratingText = formatRatingText(recipe.rating);
      metaItems.push({ label: "Rating", value: ratingText.trim() });
    }

    if (recipe.prepTime) metaItems.push({ label: "Prep Time", value: recipe.prepTime });
    if (recipe.cookTime) metaItems.push({ label: "Cook Time", value: recipe.cookTime });
    if (recipe.additionalTime) metaItems.push({ label: "Additional Time", value: recipe.additionalTime });
    if (recipe.totalTime) metaItems.push({ label: "Total Time", value: recipe.totalTime });

    const servingsText = formatServingsText(getRecipeServingsText(recipe));
    if (servingsText) metaItems.push({ label: "Servings", value: servingsText });
    if (metaItems.length) {
      const metaWrap = document.createElement("div");
      metaWrap.className = "recipe-meta";

      const grid = document.createElement("div");
      grid.className = "recipe-meta-grid";

      metaItems.forEach((item) => {
        const p = document.createElement("p");
        p.className = "recipe-meta-item";

        const label = document.createElement("span");
        label.className = "recipe-meta-label";
        label.textContent = item.label + ":";

        const value = document.createElement("span");
        value.textContent = " " + item.value;

        p.appendChild(label);
        p.appendChild(value);
        grid.appendChild(p);
      });

      metaWrap.appendChild(grid);
      content.appendChild(metaWrap);
    }

    if (Array.isArray(recipe.personalNotes) && recipe.personalNotes.length > 0) {
      const personalNotesWrap = document.createElement("div");
      personalNotesWrap.className = "recipe-meta personal-notes";

      const title = document.createElement("div");
      title.className = "recipe-meta-item";
      title.innerHTML = `<span class="recipe-meta-label">Personal Notes:</span>`;

      personalNotesWrap.appendChild(title);

      recipe.personalNotes.forEach((note) => {
        const noteItem = document.createElement("div");
        noteItem.className = "recipe-meta-item";
        noteItem.textContent = "- " + note;
        personalNotesWrap.appendChild(noteItem);
      });

      content.appendChild(personalNotesWrap);
    }

    if (recipe.description) {
      const p = document.createElement("p");
      p.className = "recipe-description";
      p.textContent = recipe.description;
      content.appendChild(p);
    }

    // Not part of grocery list
    if (recipe.equipment && recipe.equipment.length) {
      const eqTitle = document.createElement("h4");
      eqTitle.className = "recipe-section-title";
      eqTitle.textContent = "Equipment";
      content.appendChild(eqTitle);

      const ulEq = document.createElement("ul");
      recipe.equipment.forEach((item) => {
        const li = document.createElement("li");
        li.tabIndex = 0;
        li.textContent = item;
        ulEq.appendChild(li);
      });
      content.appendChild(ulEq);
    }

    if (recipe.nutrition && Object.keys(recipe.nutrition).length) {
      const nutTitle = document.createElement("h4");
      nutTitle.className = "recipe-section-title";
      nutTitle.textContent = "Nutrition";
      content.appendChild(nutTitle);

      const ulNut = document.createElement("ul");

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

      nutritionLabelOrder.forEach((pair) => {
        const key = pair[0];
        const label = pair[1];
        if (recipe.nutrition[key]) {
          const li = document.createElement("li");
          li.tabIndex = 0;
          li.textContent = `${label}: ${recipe.nutrition[key]}`;
          ulNut.appendChild(li);
        }
      });

      content.appendChild(ulNut);
    }
    if (recipe.ingredients && recipe.ingredients.length) {
      const ingTitle = document.createElement("h4");
      ingTitle.className = "recipe-section-title";
      ingTitle.textContent = "Ingredients";
      content.appendChild(ingTitle);

      const ul = document.createElement("ul");
      recipe.ingredients.forEach((i) => {
        const li = document.createElement("li");
        li.tabIndex = 0;
        li.textContent = i;
        ul.appendChild(li);
      });
      content.appendChild(ul);
    }

    if (recipe.instructions && recipe.instructions.length) {
      const instTitle = document.createElement("h4");
      instTitle.className = "recipe-section-title";
      instTitle.textContent = "Instructions";
      content.appendChild(instTitle);

      const ol = document.createElement("ol");
      recipe.instructions.forEach((step) => {
        const li = document.createElement("li");
        li.tabIndex = 0;
        li.textContent = step;
        ol.appendChild(li);
      });
      content.appendChild(ol);
    }

    if (recipe.notes && recipe.notes.length) {
      const notesTitle = document.createElement("h4");
      notesTitle.className = "recipe-section-title";
      notesTitle.textContent = "Notes";
      content.appendChild(notesTitle);

      const ulNotes = document.createElement("ul");
      recipe.notes.forEach((note) => {
        const li = document.createElement("li");
        li.tabIndex = 0;
        li.textContent = note;
        ulNotes.appendChild(li);
      });
      content.appendChild(ulNotes);
    }

    wrap.appendChild(header);
    wrap.appendChild(content);
    recipeContainer.appendChild(wrap);
  });
}
