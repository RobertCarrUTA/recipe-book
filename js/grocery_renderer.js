import { determineGroupForKey, sortGroceryGroups } from "./grouping.js";
import {
  createGrocerySearchUrl,
  formatCheckedGroceryGroupMessage,
  formatGrocerySourceSummary,
  getGrocerySourceDetail,
  getDisplayNotes,
  getSortedGrocerySources,
  formatCount,
} from "./grocery_view_model.js";
import { createEmptyState } from "./dom.js";
import { formatTotalsForKey } from "./units.js";

export function createGroceryRenderer({ document, getRuntimeState, getUiState, actions }) {
  const byId = (id) => document.getElementById(id);
  let sourceDetailsIdCounter = 0;

  function getAllGroceryKeys(groceryState) {
    return new Set([
      ...Object.keys(groceryState.totalsByKey || {}),
      ...Object.keys(groceryState.notesByKey || {}),
      ...Object.keys(groceryState.sourcesByKey || {}),
    ]);
  }

  function getGroceryCounts(allKeys) {
    const runtimeState = getRuntimeState();
    const keys = Array.from(allKeys || []);
    const checkedCount = keys.filter((key) => runtimeState.groceryCheckedByKey[key]).length;

    return {
      checkedCount,
      itemCount: keys.length,
      remainingCount: keys.length - checkedCount,
      selectedRecipeCount: Object.keys(runtimeState.selectedRecipeIds || {}).length,
    };
  }

  function syncGroceryControls(counts) {
    const clearButton = byId("clearGroceryList");
    const clearCheckedButton = byId("clearCheckedGroceryItems");
    const copyButton = byId("copyGroceryList");
    const hideCheckedToggle = byId("hideCheckedGroceryItems");

    if (clearButton) clearButton.disabled = counts.itemCount === 0;
    if (clearCheckedButton) clearCheckedButton.disabled = counts.checkedCount === 0;
    if (copyButton) copyButton.disabled = counts.itemCount === 0;
    if (hideCheckedToggle) hideCheckedToggle.disabled = counts.itemCount === 0;
  }

  function updateGrocerySummary(allKeys) {
    const runtimeState = getRuntimeState();
    const summary = byId("grocerySummary");
    const progressBar = byId("groceryProgressBar");
    const mobileBadge = byId("mobileGroceryBadge");
    const counts = getGroceryCounts(allKeys);
    const progress = counts.itemCount ? Math.round((counts.checkedCount / counts.itemCount) * 100) : 0;

    syncGroceryControls(counts);

    if (progressBar) {
      progressBar.style.transform = `scaleX(${progress / 100})`;
      if (progressBar.parentElement) {
        progressBar.parentElement.hidden = counts.itemCount === 0;
        progressBar.parentElement.setAttribute("aria-valuenow", String(progress));
        progressBar.parentElement.setAttribute(
          "aria-valuetext",
          counts.itemCount
            ? `${counts.checkedCount} of ${counts.itemCount} grocery items checked`
            : "No grocery items"
        );
      }
    }

    if (mobileBadge) {
      mobileBadge.hidden = counts.itemCount === 0;
      mobileBadge.textContent = counts.itemCount > 99 ? "99+" : String(counts.itemCount);
    }

    const groceryTab = document.querySelector('.mobile-view-tab[data-view="grocery"]');
    if (groceryTab) {
      groceryTab.setAttribute(
        "aria-label",
        counts.itemCount
          ? `Grocery List, ${counts.itemCount} items, ${counts.checkedCount} checked`
          : "Grocery List"
      );
    }

    if (!summary) return;

    if (!counts.itemCount) {
      summary.textContent = "No items yet";
      return;
    }

    const parts = [
      formatCount(counts.itemCount, "item", "items"),
      `${counts.remainingCount} left`,
    ];

    if (counts.selectedRecipeCount) {
      parts.push(`from ${formatCount(counts.selectedRecipeCount, "recipe", "recipes")}`);
    }
    if (counts.checkedCount) parts.push(`${counts.checkedCount} checked`);

    summary.textContent = parts.join(" - ");
  }

  function syncGroceryGroupCountFromRow(row) {
    const group = row ? row.closest(".grocery-group") : null;
    const count = group ? group.querySelector(".grocery-group-count") : null;
    if (!group || !count) return;

    const checkboxes = Array.from(group.querySelectorAll('li:not(.grocery-group-empty) input[type="checkbox"]'));
    const checkedCount = checkboxes.filter((checkbox) => checkbox.checked).length;

    count.textContent = checkedCount
      ? `${checkedCount}/${checkboxes.length} checked`
      : formatCount(checkboxes.length, "item", "items");
  }

  function prepareRecipeSourceNavigation(canonicalKey) {
    if (typeof actions.onPrepareRecipeSourceNavigation === "function") {
      actions.onPrepareRecipeSourceNavigation(canonicalKey);
    }
  }

  function attachRecipeSourcePreparation(sourceControl, canonicalKey) {
    sourceControl.addEventListener("pointerdown", () => prepareRecipeSourceNavigation(canonicalKey));
    sourceControl.addEventListener("touchstart", () => prepareRecipeSourceNavigation(canonicalKey), { passive: true });
  }

  function createGrocerySearchLink(displayName) {
    const href = createGrocerySearchUrl(displayName);
    if (!href) return null;

    const link = document.createElement("a");
    link.className = "grocery-item-search-link";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Search";
    link.title = `Search for ${displayName}`;
    link.setAttribute("aria-label", `Search for ${displayName} in a new tab`);
    link.setAttribute("referrerpolicy", "no-referrer");
    link.addEventListener("click", (event) => event.stopPropagation());
    return link;
  }

  function isInteractiveGroceryTarget(target) {
    return Boolean(target && target.closest && target.closest("a, button, input, select, textarea"));
  }

  function renderGrocerySource(content, sources, selectedRecipeCount, canonicalKey) {
    const runtimeState = getRuntimeState();
    const displayName = runtimeState.displayNamesByKey[canonicalKey] || canonicalKey;
    const detailOptions = { canonicalKey, displayName };

    if (actions.isManualGroceryItem(canonicalKey)) {
      const source = document.createElement("span");
      source.className = "grocery-item-source";
      source.textContent = "Manual item";
      content.appendChild(source);
      return;
    }

    const sourceSummary = formatGrocerySourceSummary(sources, selectedRecipeCount);
    if (!sourceSummary) return;

    const sortedSources = getSortedGrocerySources(sources);
    const sourceNames = sortedSources.map((source) => source.title);
    const shouldRenderDetails = sourceNames.length > 1 || sourceSummary === "From 1 recipe";
    const singleSource = sortedSources.length === 1 ? sortedSources[0] : null;
    const canOpenSingleSource =
      singleSource && singleSource.id && typeof actions.onViewRecipeSource === "function";

    if (!shouldRenderDetails) {
      const source = document.createElement(canOpenSingleSource ? "button" : "span");
      source.className = canOpenSingleSource
        ? "grocery-item-source grocery-source-single-link"
        : "grocery-item-source";
      source.textContent = sourceSummary;
      if (canOpenSingleSource) {
        source.type = "button";
        source.title = `Open ${singleSource.title}`;
        source.setAttribute("aria-label", `Open ${singleSource.title} in recipes`);
        attachRecipeSourcePreparation(source, canonicalKey);
        source.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          actions.onViewRecipeSource(singleSource.id, { canonicalKey });
        });
      }
      content.appendChild(source);
      return;
    }

    const sourceToggle = document.createElement("button");
    sourceToggle.className = "grocery-item-source grocery-item-source-toggle";
    sourceToggle.type = "button";
    sourceToggle.textContent = sourceSummary;
    sourceToggle.setAttribute("aria-expanded", "false");

    const sourceDetails = document.createElement("span");
    const sourceDetailsId = `grocery-source-details-${sourceDetailsIdCounter}`;
    sourceDetailsIdCounter += 1;
    sourceDetails.className = "grocery-item-source-list";
    sourceDetails.id = sourceDetailsId;
    sourceDetails.hidden = true;
    sourceToggle.setAttribute("aria-controls", sourceDetailsId);

    sortedSources.forEach((sourceEntry) => {
      const detail = getGrocerySourceDetail(sourceEntry, detailOptions);
      const sourceItem = document.createElement("span");
      const canOpenSourceRecipe =
        sourceEntry.id && typeof actions.onViewRecipeSource === "function";
      const sourceTitle = document.createElement(canOpenSourceRecipe ? "button" : "span");
      sourceItem.className = "grocery-item-source-list-item";
      sourceTitle.className = canOpenSourceRecipe
        ? "grocery-source-title grocery-source-link"
        : "grocery-source-title";
      sourceTitle.textContent = detail.title;

      if (canOpenSourceRecipe) {
        sourceTitle.type = "button";
        sourceTitle.title = `Open ${detail.title}`;
        sourceTitle.setAttribute("aria-label", `Open ${detail.title} in recipes`);
        attachRecipeSourcePreparation(sourceTitle, canonicalKey);
        sourceTitle.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          actions.onViewRecipeSource(sourceEntry.id, { canonicalKey });
        });
      }

      sourceItem.appendChild(sourceTitle);

      if (detail.metaText) {
        const sourceMeta = document.createElement("span");
        sourceMeta.className = "grocery-source-meta";
        sourceMeta.textContent = detail.metaText;
        sourceItem.appendChild(sourceMeta);
      }

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

  function createGroceryItem(canonicalKey, entry, allKeys, selectedRecipeCount) {
    const runtimeState = getRuntimeState();
    const li = document.createElement("li");
    const cb = document.createElement("input");
    const content = document.createElement("span");
    const itemName = document.createElement("span");
    const itemActions = document.createElement("span");
    const displayNotes = getDisplayNotes(entry.notes, entry.sources);
    const notesText = displayNotes.length ? ` (${displayNotes.join(", ")})` : "";
    const displayName = runtimeState.displayNamesByKey[canonicalKey] || canonicalKey;
    const searchLink = createGrocerySearchLink(displayName);
    const totalsText = entry.totals ? formatTotalsForKey(entry.totals, { canonicalKey, displayName }) : "";
    const isManual = actions.isManualGroceryItem(canonicalKey);

    li.tabIndex = 0;
    li.dataset.groceryKey = canonicalKey;
    li.classList.toggle("manual-item", isManual);
    cb.type = "checkbox";
    cb.checked = Boolean(runtimeState.groceryCheckedByKey[canonicalKey]);
    content.className = "grocery-item-content";
    itemActions.className = "grocery-item-actions";
    itemName.className = "grocery-item-name";
    itemName.textContent = totalsText ? `${displayName} - ${totalsText}${notesText}` : `${displayName}${notesText}`;
    content.appendChild(itemName);
    renderGrocerySource(content, entry.sources, selectedRecipeCount, canonicalKey);
    if (searchLink) itemActions.appendChild(searchLink);

    li.classList.toggle("checked", cb.checked);
    cb.addEventListener("change", () => {
      actions.onGroceryCheckedChange(canonicalKey, cb.checked);
      if (getUiState().hideCheckedGroceryItems) {
        renderGroceryList();
        return;
      }

      li.classList.toggle("checked", cb.checked);
      updateGrocerySummary(allKeys);
      syncGroceryGroupCountFromRow(li);
    });

    li.addEventListener("click", (event) => {
      if (isInteractiveGroceryTarget(event.target)) return;
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

    if (isManual) {
      const removeButton = document.createElement("button");
      removeButton.className = "grocery-item-remove";
      removeButton.type = "button";
      removeButton.setAttribute("aria-label", `Remove ${displayName}`);
      removeButton.title = `Remove ${displayName}`;
      removeButton.textContent = "x";
      removeButton.addEventListener("click", (event) => {
        event.stopPropagation();
        actions.onManualGroceryRemove(canonicalKey);
      });
      itemActions.appendChild(removeButton);
    }

    if (itemActions.children.length) li.appendChild(itemActions);

    return li;
  }

  function createGroupHeader(group, entries) {
    const uiState = getUiState();
    const checkedCount = entries.filter((entry) => entry.checked).length;
    const isCollapsed = Boolean(uiState.collapsedGroceryGroups && uiState.collapsedGroceryGroups[group]);
    const header = document.createElement("button");
    const title = document.createElement("span");
    const count = document.createElement("span");

    header.className = "grocery-group-header";
    header.type = "button";
    header.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    title.className = "grocery-group-title";
    title.textContent = group;
    count.className = "grocery-group-count";
    count.textContent = checkedCount
      ? `${checkedCount}/${entries.length} checked`
      : formatCount(entries.length, "item", "items");

    header.appendChild(title);
    header.appendChild(count);
    header.addEventListener("click", () => actions.onGroceryGroupToggle(group, !isCollapsed));

    return header;
  }

  function renderGroceryGroup(container, group, entries, allKeys, selectedRecipeCount) {
    const uiState = getUiState();
    const section = document.createElement("section");
    const visibleEntries = uiState.hideCheckedGroceryItems ? entries.filter((entry) => !entry.checked) : entries;
    const isCollapsed = Boolean(uiState.collapsedGroceryGroups && uiState.collapsedGroceryGroups[group]);
    const list = document.createElement("ul");

    section.className = "grocery-group";
    section.appendChild(createGroupHeader(group, entries));
    list.hidden = isCollapsed;

    visibleEntries.forEach((entry) => {
      list.appendChild(createGroceryItem(entry.canonicalKey, entry, allKeys, selectedRecipeCount));
    });

    if (!visibleEntries.length && entries.length) {
      const hiddenState = document.createElement("li");
      hiddenState.className = "grocery-group-empty";
      hiddenState.textContent = formatCheckedGroceryGroupMessage(group);
      list.appendChild(hiddenState);
    }

    section.appendChild(list);
    container.appendChild(section);
  }

  function renderUngroupedGroceryList(container, entries, allKeys, selectedRecipeCount) {
    const uiState = getUiState();
    const visibleEntries = uiState.hideCheckedGroceryItems ? entries.filter((entry) => !entry.checked) : entries;
    const ul = document.createElement("ul");

    visibleEntries.forEach((entry) => {
      ul.appendChild(createGroceryItem(entry.canonicalKey, entry, allKeys, selectedRecipeCount));
    });

    container.appendChild(ul);
  }

  function renderHiddenCheckedEmptyState(container) {
    container.appendChild(createEmptyState(document, {
      body: "Turn off Hide checked to review completed items.",
      title: "Everything visible is checked.",
    }));
  }

  function renderEmptyState(container) {
    container.appendChild(createEmptyState(document, {
      body: "Add recipes or type a one-off item above.",
      title: "Your grocery list is empty.",
    }));
  }

  function renderGroceryList() {
    const container = byId("groceryList");
    if (!container) return;

    const runtimeState = getRuntimeState();
    const uiState = getUiState();
    const groceryState = runtimeState.grocery;
    const selectedRecipeCount = Object.keys(runtimeState.selectedRecipeIds || {}).length;
    const allKeys = getAllGroceryKeys(groceryState);
    const display = {};
    const entries = [];
    const fragment = document.createDocumentFragment();

    sourceDetailsIdCounter = 0;
    updateGrocerySummary(allKeys);

    Array.from(allKeys).forEach((canonicalKey) => {
      const group = actions.isManualGroceryItem(canonicalKey) ? "Manual Items" : determineGroupForKey(canonicalKey);
      const entry = {
        canonicalKey,
        checked: Boolean(runtimeState.groceryCheckedByKey[canonicalKey]),
        group,
        notes: groceryState.notesByKey[canonicalKey] || [],
        sources: groceryState.sourcesByKey[canonicalKey] || [],
        totals: groceryState.totalsByKey[canonicalKey] || null,
      };

      if (!display[group]) display[group] = [];
      display[group].push(entry);
      entries.push(entry);
    });

    if (!entries.length) {
      renderEmptyState(fragment);
      container.replaceChildren(fragment);
      return;
    }

    if (uiState.hideCheckedGroceryItems && entries.every((entry) => entry.checked)) {
      renderHiddenCheckedEmptyState(fragment);
      container.replaceChildren(fragment);
      return;
    }

    if (!uiState.groupItems) {
      renderUngroupedGroceryList(
        fragment,
        entries.sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey)),
        allKeys,
        selectedRecipeCount
      );
      container.replaceChildren(fragment);
      return;
    }

    sortGroceryGroups(Object.keys(display))
      .forEach((group) => {
        renderGroceryGroup(
          fragment,
          group,
          display[group].sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey)),
          allKeys,
          selectedRecipeCount
        );
      });
    container.replaceChildren(fragment);
  }

  return { renderGroceryList };
}
