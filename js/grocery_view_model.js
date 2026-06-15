export function formatCount(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatCheckedGroceryGroupMessage(group) {
  const groupName = String(group || "").trim();
  return groupName ? `Everything in ${groupName} is checked.` : "Everything in this section is checked.";
}

export function getSortedGrocerySourceNames(sources) {
  return (sources || [])
    .map((source) => source && source.title)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
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

export function getDisplayNotes(notes) {
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
