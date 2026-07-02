import {
  buildCanonicalIngredient,
  normalizeUnit,
  normalizeWhitespace,
  parseQuantityRange,
} from "./normalization.js";

export function normalizeParsedIngredients(parsed) {
  if (!parsed) return [];
  return Array.isArray(parsed) ? parsed : [parsed];
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeQuantityRange(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { min: value, max: value };
  }

  if (typeof value === "string") {
    return parseQuantityRange(value);
  }

  if (isPlainObject(value)) {
    const min = Number(value.min);
    const max = Number(value.max);
    if (Number.isFinite(min) && Number.isFinite(max)) return { min, max };
  }

  return null;
}

function normalizeNotes(entry) {
  if (Array.isArray(entry.notes)) {
    return entry.notes.map(normalizeWhitespace).filter(Boolean);
  }

  const note = normalizeWhitespace(entry.note);
  return note ? [note] : [];
}

export function parseStructuredGroceryIngredient(entry) {
  if (!isPlainObject(entry)) return null;

  const item = normalizeWhitespace(entry.item || entry.name || entry.canonical || entry.display);
  if (!item) return null;

  const quantityValue = entry.quantity !== undefined ? entry.quantity : entry.amount;
  const canonical = buildCanonicalIngredient(item.toLowerCase());
  if (!canonical) return null;

  const display = normalizeWhitespace(entry.display);
  if (display) canonical.display = display;

  const notes = normalizeNotes(entry);
  const optional = !!entry.optional || notes.some((note) => note.toLowerCase().includes("optional"));

  return {
    original: normalizeWhitespace(entry.original || entry.text || item),
    canonical,
    unitKey: normalizeUnit(normalizeWhitespace(entry.unit || entry.units)) || null,
    quantityRange: normalizeQuantityRange(quantityValue),
    optional,
    nonQuantifiedMarker: normalizeWhitespace(entry.marker) || null,
    notes,
  };
}
