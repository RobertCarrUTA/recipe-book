import { formatTotalsForKey } from "./units.js";

export function formatCount(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatCheckedGroceryGroupMessage(group) {
  const groupName = String(group || "").trim();
  return groupName ? `Everything in ${groupName} is checked.` : "Everything in this section is checked.";
}

export function getSortedGrocerySourceNames(sources) {
  return getSortedGrocerySources(sources).map((source) => source.title);
}

export function formatGrocerySourceSummary(sources, selectedRecipeCount) {
  if (!Array.isArray(sources) || sources.length === 0 || selectedRecipeCount <= 1) return "";

  const sourceNames = getSortedGrocerySourceNames(sources);
  if (!sourceNames.length) return "";
  if (sourceNames.length === 1) {
    return selectedRecipeCount > 8 ? "From 1 recipe" : `From ${sourceNames[0]}`;
  }

  return `From ${formatCount(sourceNames.length, "recipe", "recipes")}`;
}

function sourceHasNote(source, note) {
  const target = String(note || "").toLowerCase();
  return (source?.notes || []).some((sourceNote) => String(sourceNote).toLowerCase() === target);
}

function shouldShowOptionalNote(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return true;
  return sources.every((source) => sourceHasNote(source, "optional"));
}

export function getDisplayNotes(notes, sources = []) {
  const hiddenNotes = new Set([
    "amount not specified",
    "as needed",
    "divided",
    "for filling",
    "for frosting",
    "for syrup",
    "for topping",
    "manual item",
    "plus more",
    "to taste",
  ]);

  return (notes || []).filter((note) => {
    const lower = String(note).toLowerCase();
    if (lower === "optional" && !shouldShowOptionalNote(sources)) return false;
    return !hiddenNotes.has(lower) && !/^juice of\b/.test(lower);
  });
}

export function getSourceDetailNotes(notes) {
  const hiddenNotes = new Set([
    "as needed",
    "divided",
    "for filling",
    "for frosting",
    "for syrup",
    "for topping",
    "manual item",
    "plus more",
    "to taste",
  ]);

  return (notes || []).filter((note) => !hiddenNotes.has(String(note).toLowerCase()));
}

export function getSortedGrocerySources(sources) {
  return (sources || [])
    .filter((source) => source && source.title)
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

export function getGrocerySourceDetail(source, options = {}) {
  const title = source && source.title ? source.title : "";
  if (!title) return { metaText: "", title: "" };

  const notes = getSourceDetailNotes(source.notes);
  const totalsText = source.totals ? formatTotalsForKey(source.totals, options) : "";
  const notesText = notes.join(", ");
  let metaText = "";

  if (totalsText && notesText) metaText = `${totalsText} (${notesText})`;
  else metaText = totalsText || notesText;

  return { metaText, title };
}

export function formatGrocerySourceDetail(source, options = {}) {
  const detail = getGrocerySourceDetail(source, options);
  if (!detail.title) return "";
  return detail.metaText ? `${detail.title} - ${detail.metaText}` : detail.title;
}
