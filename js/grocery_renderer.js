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
import { createElement, createEmptyState, createTextElement } from "./dom.js";
import { formatTotalsForKey } from "./units.js";

export function createGroceryRenderer({ document, getRuntimeState, getUiState, actions }) {
  const byId = (id) => document.getElementById(id);
  let sourceDetailsIdCounter = 0;

  function createButton(options = {}) {
    return createElement(document, "button", {
      type: "button",
      ...options,
    });
  }

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

  function createRecipeSourceControl({
    canonicalKey,
    className,
    label,
    linkClassName,
    sourceId,
    sourceTitle,
  }) {
    const canOpen = sourceId && typeof actions.onViewRecipeSource === "function";
    const control = createElement(document, canOpen ? "button" : "span", {
      attributes: canOpen ? { "aria-label": `Open ${sourceTitle} in recipes` } : undefined,
      className: canOpen ? `${className} ${linkClassName}` : className,
      textContent: label,
      title: canOpen ? `Open ${sourceTitle}` : undefined,
      type: canOpen ? "button" : undefined,
    });

    if (!canOpen) return control;

    attachRecipeSourcePreparation(control, canonicalKey);
    control.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      actions.onViewRecipeSource(sourceId, { canonicalKey });
    });
    return control;
  }

  function createGrocerySearchLink(displayName) {
    const href = createGrocerySearchUrl(displayName);
    if (!href) return null;

    return createElement(document, "a", {
      attributes: {
        "aria-label": `Search for ${displayName} in a new tab`,
        referrerpolicy: "no-referrer",
      },
      className: "grocery-item-search-link",
      href,
      listeners: { click: (event) => event.stopPropagation() },
      rel: "noopener noreferrer",
      target: "_blank",
      textContent: "Search",
      title: `Search for ${displayName}`,
    });
  }

  function isInteractiveGroceryTarget(target) {
    return Boolean(target && target.closest && target.closest("a, button, input, select, textarea"));
  }

  function renderGrocerySource(content, sources, selectedRecipeCount, canonicalKey) {
    const runtimeState = getRuntimeState();
    const displayName = runtimeState.displayNamesByKey[canonicalKey] || canonicalKey;
    const detailOptions = { canonicalKey, displayName };

    if (actions.isManualGroceryItem(canonicalKey)) {
      content.appendChild(createTextElement(document, "span", "Manual item", {
        className: "grocery-item-source",
      }));
      return;
    }

    const sourceSummary = formatGrocerySourceSummary(sources, selectedRecipeCount);
    if (!sourceSummary) return;

    const sortedSources = getSortedGrocerySources(sources);
    const sourceNames = sortedSources.map((source) => source.title);
    const shouldRenderDetails = sourceNames.length > 1 || sourceSummary === "From 1 recipe";
    const singleSource = sortedSources.length === 1 ? sortedSources[0] : null;

    if (!shouldRenderDetails) {
      content.appendChild(createRecipeSourceControl({
        canonicalKey,
        className: "grocery-item-source",
        label: sourceSummary,
        linkClassName: "grocery-source-single-link",
        sourceId: singleSource?.id,
        sourceTitle: singleSource?.title,
      }));
      return;
    }

    const sourceDetailsId = `grocery-source-details-${sourceDetailsIdCounter}`;
    sourceDetailsIdCounter += 1;
    const sourceDetails = createElement(document, "span", {
      className: "grocery-item-source-list",
      hidden: true,
      id: sourceDetailsId,
      listeners: { click: (event) => event.stopPropagation() },
    });
    const sourceToggle = createButton({
      attributes: {
        "aria-controls": sourceDetailsId,
        "aria-expanded": "false",
      },
      className: "grocery-item-source grocery-item-source-toggle",
      textContent: sourceSummary,
      listeners: {
        click: (event) => {
          event.stopPropagation();
          const isExpanded = sourceToggle.getAttribute("aria-expanded") === "true";
          sourceToggle.setAttribute("aria-expanded", isExpanded ? "false" : "true");
          sourceDetails.hidden = isExpanded;
        },
      },
    });

    sortedSources.forEach((sourceEntry) => {
      const detail = getGrocerySourceDetail(sourceEntry, detailOptions);
      const sourceTitle = createRecipeSourceControl({
        canonicalKey,
        className: "grocery-source-title",
        label: detail.title,
        linkClassName: "grocery-source-link",
        sourceId: sourceEntry.id,
        sourceTitle: detail.title,
      });

      const sourceItem = createElement(document, "span", {
        children: [
          sourceTitle,
          detail.metaText
            ? createTextElement(document, "span", detail.metaText, { className: "grocery-source-meta" })
            : null,
        ],
        className: "grocery-item-source-list-item",
      });
      sourceDetails.appendChild(sourceItem);
    });

    content.appendChild(sourceToggle);
    content.appendChild(sourceDetails);
  }

  function createGroceryItem(canonicalKey, entry, allKeys, selectedRecipeCount) {
    const runtimeState = getRuntimeState();
    const displayNotes = getDisplayNotes(entry.notes, entry.sources);
    const notesText = displayNotes.length ? ` (${displayNotes.join(", ")})` : "";
    const displayName = runtimeState.displayNamesByKey[canonicalKey] || canonicalKey;
    const searchLink = createGrocerySearchLink(displayName);
    const totalsText = entry.totals ? formatTotalsForKey(entry.totals, { canonicalKey, displayName }) : "";
    const isManual = actions.isManualGroceryItem(canonicalKey);
    const cb = createElement(document, "input", {
      checked: Boolean(runtimeState.groceryCheckedByKey[canonicalKey]),
      type: "checkbox",
      listeners: {
        change: () => {
          actions.onGroceryCheckedChange(canonicalKey, cb.checked);
          if (getUiState().hideCheckedGroceryItems) {
            renderGroceryList();
            return;
          }

          li.classList.toggle("checked", cb.checked);
          updateGrocerySummary(allKeys);
          syncGroceryGroupCountFromRow(li);
        },
      },
    });
    const content = createElement(document, "span", {
      children: createTextElement(
        document,
        "span",
        totalsText ? `${displayName} - ${totalsText}${notesText}` : `${displayName}${notesText}`,
        { className: "grocery-item-name" }
      ),
      className: "grocery-item-content",
    });
    const itemActions = createElement(document, "span", { className: "grocery-item-actions" });
    const li = createElement(document, "li", {
      children: [cb, content],
      classList: [
        isManual ? "manual-item" : "",
        cb.checked ? "checked" : "",
      ],
      dataset: { groceryKey: canonicalKey },
      tabIndex: 0,
      listeners: {
        click: (event) => {
          if (isInteractiveGroceryTarget(event.target)) return;
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event("change"));
        },
        keydown: (event) => {
          if (event.target !== li) return;
          if (event.key !== " " && event.key !== "Enter") return;

          event.preventDefault();
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event("change"));
        },
      },
    });

    renderGrocerySource(content, entry.sources, selectedRecipeCount, canonicalKey);
    if (searchLink) itemActions.appendChild(searchLink);

    if (isManual) {
      itemActions.appendChild(createButton({
        attributes: { "aria-label": `Remove ${displayName}` },
        className: "grocery-item-remove",
        textContent: "x",
        title: `Remove ${displayName}`,
        listeners: {
          click: (event) => {
            event.stopPropagation();
            actions.onManualGroceryRemove(canonicalKey);
          },
        },
      }));
    }

    if (itemActions.children.length) li.appendChild(itemActions);

    return li;
  }

  function createGroupHeader(group, entries) {
    const uiState = getUiState();
    const checkedCount = entries.filter((entry) => entry.checked).length;
    const isCollapsed = Boolean(uiState.collapsedGroceryGroups && uiState.collapsedGroceryGroups[group]);
    const countText = checkedCount
      ? `${checkedCount}/${entries.length} checked`
      : formatCount(entries.length, "item", "items");

    return createButton({
      attributes: { "aria-expanded": isCollapsed ? "false" : "true" },
      children: [
        createTextElement(document, "span", group, { className: "grocery-group-title" }),
        createTextElement(document, "span", countText, { className: "grocery-group-count" }),
      ],
      className: "grocery-group-header",
      listeners: { click: () => actions.onGroceryGroupToggle(group, !isCollapsed) },
    });
  }

  function renderGroceryGroup(container, group, entries, allKeys, selectedRecipeCount) {
    const uiState = getUiState();
    const visibleEntries = uiState.hideCheckedGroceryItems ? entries.filter((entry) => !entry.checked) : entries;
    const isCollapsed = Boolean(uiState.collapsedGroceryGroups && uiState.collapsedGroceryGroups[group]);
    const list = createElement(document, "ul", { hidden: isCollapsed });

    visibleEntries.forEach((entry) => {
      list.appendChild(createGroceryItem(entry.canonicalKey, entry, allKeys, selectedRecipeCount));
    });

    if (!visibleEntries.length && entries.length) {
      list.appendChild(createTextElement(document, "li", formatCheckedGroceryGroupMessage(group), {
        className: "grocery-group-empty",
      }));
    }

    container.appendChild(createElement(document, "section", {
      children: [createGroupHeader(group, entries), list],
      className: "grocery-group",
    }));
  }

  function renderUngroupedGroceryList(container, entries, allKeys, selectedRecipeCount) {
    const uiState = getUiState();
    const visibleEntries = uiState.hideCheckedGroceryItems ? entries.filter((entry) => !entry.checked) : entries;
    const ul = createElement(document, "ul");

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
