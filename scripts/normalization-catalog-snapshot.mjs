import { buildCanonicalIngredient, normalizeUnit } from "../js/normalization.js";

export function createNormalizationCatalogSnapshot(recipes) {
  const labels = new Map();
  const units = new Set();

  recipes.forEach((recipe) => {
    (recipe.groceryIngredients || []).forEach((entry) => {
      if (!entry || typeof entry !== "object") return;

      const label = String(entry.item || entry.name || entry.canonical || entry.display || "").trim();
      if (label) labels.set(label.toLowerCase(), buildCanonicalIngredient(label.toLowerCase()));

      const unit = String(entry.unit || entry.units || "").trim();
      if (unit) units.add(unit);
    });
  });

  return {
    labels: [...labels]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([item, canonical]) => ({ item, canonical })),
    units: [...units].sort().map((unit) => ({ unit, normalized: normalizeUnit(unit) })),
  };
}
