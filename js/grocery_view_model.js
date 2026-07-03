import {
  DEFAULT_RECIPE_MULTIPLIER,
  formatRecipeMultiplier,
  normalizeRecipeMultiplier,
} from "./recipe_multiplier.js";
import { formatTotalsForKey } from "./units.js";

const GROCERY_SEARCH_URL = "https://www.google.com/search";

export function formatCount(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function createGrocerySearchUrl(searchText) {
  const query = String(searchText || "").trim().replace(/\s+/g, " ");
  if (!query) return "";

  const url = new URL(GROCERY_SEARCH_URL);
  url.searchParams.set("q", query);
  return url.href;
}

export function formatCheckedGroceryGroupMessage(group) {
  const groupName = String(group || "").trim();
  return groupName ? `Everything in ${groupName} is checked.` : "Everything in this section is checked.";
}

export function getSortedGrocerySourceNames(sources) {
  return getSortedGrocerySources(sources).map((source) => source.title);
}

export function formatGrocerySourceSummary(sources, selectedRecipeCount) {
  if (!Array.isArray(sources) || sources.length === 0) return "";

  const sortedSources = getSortedGrocerySources(sources);
  const sourceNames = sortedSources.map((source) => source.title);
  const scaledSource = sortedSources.find((source) => isScaledSource(source));
  if (!sourceNames.length) return "";
  if (selectedRecipeCount <= 1 && !scaledSource) return "";
  if (sourceNames.length === 1) {
    const multiplierText = scaledSource ? ` ${formatRecipeMultiplier(scaledSource.multiplier)}` : "";
    if (selectedRecipeCount <= 1) return `From ${sourceNames[0]}${multiplierText}`;
    return selectedRecipeCount > 8 ? `From 1 recipe${multiplierText}` : `From ${sourceNames[0]}${multiplierText}`;
  }

  return `From ${formatCount(sourceNames.length, "recipe", "recipes")}`;
}

function isScaledSource(source) {
  const multiplier = normalizeRecipeMultiplier(source?.multiplier);
  return Math.abs(multiplier - DEFAULT_RECIPE_MULTIPLIER) > 1e-9;
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
  const multiplierText = isScaledSource(source) ? formatRecipeMultiplier(source.multiplier) : "";
  const notesText = [...notes, multiplierText].filter(Boolean).join(", ");
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
