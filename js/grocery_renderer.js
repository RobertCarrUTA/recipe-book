import { determineGroupForKey } from "./grouping.js";
import {
  formatGrocerySourceSummary,
  getDisplayNotes,
  getSortedGrocerySourceNames,
  formatCount,
} from "./grocery_view_model.js";
import { formatTotalsForKey } from "./units.js";

export function createGroceryRenderer({ document, getRuntimeState, getUiState, actions }) {
  const byId = (id) => document.getElementById(id);

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

  return { renderGroceryList };
}
