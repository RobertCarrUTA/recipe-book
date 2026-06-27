import { determineGroupForKey, sortGroceryGroups } from "./grouping.js";
import { isManualGroceryItemKey } from "./grocery_model.js";
import { formatCount, getDisplayNotes } from "./grocery_view_model.js";
import { formatTotalsForKey } from "./units.js";

function getAllGroceryKeys(groceryState = {}) {
  return new Set([
    ...Object.keys(groceryState.totalsByKey || {}),
    ...Object.keys(groceryState.notesByKey || {}),
    ...Object.keys(groceryState.sourcesByKey || {}),
  ]);
}

function getGroceryEntryGroup(canonicalKey) {
  return isManualGroceryItemKey(canonicalKey) ? "Manual Items" : determineGroupForKey(canonicalKey);
}

function sortGroceryEntries(entries) {
  return entries.slice().sort((left, right) => left.canonicalKey.localeCompare(right.canonicalKey));
}

export function getGroceryExportEntries(runtimeState = {}) {
  const groceryState = runtimeState.grocery || {};
  return Array.from(getAllGroceryKeys(groceryState)).map((canonicalKey) => ({
    canonicalKey,
    checked: Boolean(runtimeState.groceryCheckedByKey?.[canonicalKey]),
    group: getGroceryEntryGroup(canonicalKey),
    notes: groceryState.notesByKey?.[canonicalKey] || [],
    sources: groceryState.sourcesByKey?.[canonicalKey] || [],
    totals: groceryState.totalsByKey?.[canonicalKey] || null,
  }));
}

export function formatGroceryExportEntry(entry, runtimeState = {}) {
  const displayName = runtimeState.displayNamesByKey?.[entry.canonicalKey] || entry.canonicalKey;
  const totalsText = entry.totals
    ? formatTotalsForKey(entry.totals, { canonicalKey: entry.canonicalKey, displayName })
    : "";
  const displayNotes = getDisplayNotes(entry.notes, entry.sources);
  const notesText = displayNotes.length ? ` (${displayNotes.join(", ")})` : "";
  const itemText = totalsText ? `${displayName} - ${totalsText}${notesText}` : `${displayName}${notesText}`;
  return `${entry.checked ? "[x]" : "[ ]"} ${itemText}`;
}

export function createGroceryListText(runtimeState = {}, uiState = {}, options = {}) {
  const title = options.title || "Grocery List";
  const entries = getGroceryExportEntries(runtimeState);
  const visibleEntries = uiState.hideCheckedGroceryItems ? entries.filter((entry) => !entry.checked) : entries;
  const lines = [title, ""];

  if (!entries.length) {
    lines.push("No items yet.");
    return `${lines.join("\n")}\n`;
  }

  if (!visibleEntries.length) {
    lines.push("Everything visible is checked.");
    return `${lines.join("\n")}\n`;
  }

  const remainingCount = entries.filter((entry) => !entry.checked).length;
  const checkedCount = entries.length - remainingCount;
  const summaryParts = [formatCount(visibleEntries.length, "visible item", "visible items")];
  if (uiState.hideCheckedGroceryItems && checkedCount) {
    summaryParts.push(`${checkedCount} checked hidden`);
  } else if (checkedCount) {
    summaryParts.push(`${checkedCount} checked`);
  }
  lines.push(summaryParts.join(" - "));
  lines.push("");

  if (!uiState.groupItems) {
    sortGroceryEntries(visibleEntries).forEach((entry) => {
      lines.push(formatGroceryExportEntry(entry, runtimeState));
    });
    return `${lines.join("\n")}\n`;
  }

  const entriesByGroup = visibleEntries.reduce((groups, entry) => {
    groups[entry.group] = groups[entry.group] || [];
    groups[entry.group].push(entry);
    return groups;
  }, {});

  sortGroceryGroups(Object.keys(entriesByGroup)).forEach((group, index) => {
    if (index > 0) lines.push("");
    lines.push(group);
    sortGroceryEntries(entriesByGroup[group]).forEach((entry) => {
      lines.push(formatGroceryExportEntry(entry, runtimeState));
    });
  });

  return `${lines.join("\n")}\n`;
}
