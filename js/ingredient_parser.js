/* ================================
PARSE INGREDIENT

This is the highest-risk logic in the system.

Why:
  - It translates human-written ingredient lines into structured data
  - Errors here propagate into incorrect grocery totals
  - It must balance permissiveness with correctness

The parser is intentionally conservative:
  - If something cannot be confidently parsed, it is preserved as-is
  - Optional and non-quantified ingredients are tracked as notes
================================ */

// Normalize parseIngredient output to a list (supports compound ingredients)
function normalizeParsedIngredients(parsed) {
  if (!parsed) return [];
  return Array.isArray(parsed) ? parsed : [parsed];
}

const ingredientUnitsPattern =
  "cups?|tbsp|tablespoons?|tsp|teaspoons?|lb|lbs|pound|pounds|oz|ounces?|g|grams?|kg|kilograms?|ml|milliliters?|l|liters?|bags?|blocks?|bottles?|bunch(?:es)?|cans?|cloves?|eggs?|jars?|leaves|leaf|packages?|pkgs?|sheets?|slices?|sprigs?|stalks?|sticks?|yolks?";
const ingredientQuantityPattern = "\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+|\\/\\d+)?(?:\\s*(?:-|to)\\s*\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+|\\/\\d+)?)?";
const parentheticalWeightQuantityPattern =
  "\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+|\\/\\d+)?(?:\\s*-\\s*(?:to\\s*)?\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+|\\/\\d+)?)?";

function makeParsedIngredient(original, canonical, unitKey, quantityRange, optional, nonQuantifiedMarker, notes) {
  return {
    original: original,
    canonical: canonical,
    unitKey: unitKey,
    quantityRange: quantityRange,
    optional: optional,
    nonQuantifiedMarker: nonQuantifiedMarker,
    notes: notes || [],
  };
}

function parseStructuredGroceryIngredient(entry) {
  if (!entry) return null;
  if (typeof entry === "string") return parseIngredient(entry);

  const item = entry.item || entry.name || entry.canonical || entry.display;
  if (!item) return null;

  const quantityValue = entry.quantity !== undefined ? entry.quantity : entry.amount;
  let quantityRange = null;
  if (typeof quantityValue === "number") {
    quantityRange = { min: quantityValue, max: quantityValue };
  } else if (quantityValue && typeof quantityValue === "object") {
    const min = Number(quantityValue.min);
    const max = Number(quantityValue.max);
    if (Number.isFinite(min) && Number.isFinite(max)) quantityRange = { min: min, max: max };
  } else if (typeof quantityValue === "string") {
    quantityRange = parseQuantityRange(quantityValue);
  }

  const canonical = buildCanonicalIngredient(String(item).toLowerCase());
  if (!canonical) return null;

  if (entry.display) canonical.display = entry.display;
  const notes = Array.isArray(entry.notes) ? entry.notes : entry.note ? [entry.note] : [];
  const optional = !!entry.optional || notes.some((note) => String(note).toLowerCase().includes("optional"));

  return makeParsedIngredient(
    entry.original || entry.text || String(item),
    canonical,
    normalizeUnit(entry.unit || entry.units) || null,
    quantityRange,
    optional,
    entry.marker || null,
    notes
  );
}

function parseIngredient(text) {
  const original = String(text || "");
  if (original.toLowerCase().startsWith("optional toppings:")) return null;
  const normalizedText = normalizeWhitespace(
    normalizeUnicodeFractions(original)
      .replace(/(\d)([a-zA-Z])/g, "$1 $2")
      .replace(/[–—]/g, "-")
  );
  const textLower = normalizedText.toLowerCase();
  const nonQuantifiedMarker = classifyNonQuantified(textLower);
  const optional = textLower.startsWith("optional:");

  if (/^\d.*\bof the .*(batter|glaze)\b/i.test(normalizedText)) {
    return null;
  }

  const splitQuantitySameIngredientMatch = normalizedText.match(
    new RegExp(`^(${ingredientQuantityPattern})\\s+(${ingredientUnitsPattern})\\s+\\+\\s+(${ingredientQuantityPattern})\\s+(${ingredientUnitsPattern})\\s+(.*)$`, "i")
  );
  if (splitQuantitySameIngredientMatch) {
    const first = `${splitQuantitySameIngredientMatch[1]} ${splitQuantitySameIngredientMatch[2]} ${splitQuantitySameIngredientMatch[5]}`;
    const second = `${splitQuantitySameIngredientMatch[3]} ${splitQuantitySameIngredientMatch[4]} ${splitQuantitySameIngredientMatch[5]}`;
    return [parseIngredient(first), parseIngredient(second)].flatMap(normalizeParsedIngredients);
  }

  if (/^salt and (?:black )?pepper\b/i.test(normalizedText)) {
    return [
      makeParsedIngredient(original, buildCanonicalIngredient("salt"), null, null, optional, "to taste", extractUsageNotes(original)),
      makeParsedIngredient(original, buildCanonicalIngredient("black pepper"), null, null, optional, "to taste", extractUsageNotes(original)),
    ];
  }

  if (/\s\+\s/.test(normalizedText)) {
    const parts = normalizedText.split(/\s+\+\s+/).map((part) => parseIngredient(part));
    const parsedParts = parts.flatMap(normalizeParsedIngredients);
    if (parsedParts.length) return parsedParts;
  }

  const lemonJuiceMatch = normalizedText.match(/juice of\s+(.+?)\s+(?:a\s+)?lemons?.*?about\s+(.+?)\s+(tbsp|tablespoons?|tsp|teaspoons?|cups?)/i);
  if (lemonJuiceMatch) {
    const quantityRange = parseQuantityRange(lemonJuiceMatch[2]);
    const canonical = buildCanonicalIngredient("lemon juice");
    if (canonical) {
      return makeParsedIngredient(
        original,
        canonical,
        normalizeUnit(lemonJuiceMatch[3]),
        quantityRange,
        false,
        null,
        [`juice of ${lemonJuiceMatch[1]} lemon`]
      );
    }
  }

  const withoutOptional = optional
    ? normalizeWhitespace(normalizedText.replace(/^optional:\s*/i, ""))
    : normalizedText;

  let workingText = withoutOptional.replace(/\bplus\s+(?:about\s+)?\d.*$/i, " ");
  workingText = normalizeWhitespace(workingText);

  const parentheticalWeightMatch = workingText.match(
    new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*\\((?:about\\s*)?(${parentheticalWeightQuantityPattern})\\s*[- ]?(pound|pounds|lb|lbs|ounce|ounces|oz)\\b[^)]*\\)\\s+(.*)$`, "i")
  );

  if (parentheticalWeightMatch) {
    const canonical = buildCanonicalIngredient(parentheticalWeightMatch[4].toLowerCase());
    if (!canonical) return null;
    const countText = `${parentheticalWeightMatch[1]} ${parentheticalWeightMatch[1] === "1" ? "piece" : "pieces"}`;
    return makeParsedIngredient(
      original,
      canonical,
      normalizeUnit(parentheticalWeightMatch[3]),
      parseQuantityRange(parentheticalWeightMatch[2]),
      optional,
      nonQuantifiedMarker,
      uniqueNotes([...extractUsageNotes(original), countText])
    );
  }

  const packageMatch = workingText.match(
    new RegExp(`^(${ingredientQuantityPattern})\\s*\\((\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+|\\/\\d+)?)\\s*[- ]?(ounce|ounces|oz|pound|pounds|lb|lbs)\\)\\s+(${ingredientUnitsPattern})\\s+(.*)$`, "i")
  );

  if (packageMatch) {
    const quantityRange = parseQuantityRange(packageMatch[1]);
    const unitKey = normalizeUnit(packageMatch[4]);
    const namePart = packageMatch[5];
    const canonical = buildCanonicalIngredient(namePart.toLowerCase());
    if (!canonical) return null;
    return makeParsedIngredient(original, canonical, unitKey, quantityRange, optional, nonQuantifiedMarker, [
      `${packageMatch[2]} ${normalizeUnit(packageMatch[3])} each`,
    ]);
  }

  let match =
    workingText.match(new RegExp(`^(.+?)\\s+(${ingredientUnitsPattern})\\s+(.*)$`, "i")) ||
    workingText.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${ingredientUnitsPattern})\\s+(.*)$`, "i"));

  let quantityRange = null;
  let unitKey = null;
  let namePart = null;

  if (match) {
    quantityRange = parseQuantityRange(match[1]);
    if (quantityRange) {
      unitKey = normalizeUnit(match[2]);
      namePart = match[3];
      if (unitKey === "egg" && /^\s*yolks?\b/i.test(namePart)) {
        unitKey = "yolk";
        namePart = "egg yolk";
      } else if (unitKey === "egg" && /^\s*whites?\b/i.test(namePart)) {
        unitKey = "egg white";
        namePart = "egg whites";
      }
    } else {
      match = null;
    }
  }

  if (!match) {
    const noUnitMatch = workingText.match(/^(.+?)\s+(.*)$/);
    if (noUnitMatch) {
      const candidateQuantity = parseQuantityRange(noUnitMatch[1]);
      if (candidateQuantity) {
        quantityRange = candidateQuantity;
        unitKey = null;
        namePart = noUnitMatch[2];
      } else {
        namePart = workingText;
      }
    } else {
      namePart = workingText;
    }
  }

  let rawNameLower = normalizeWhitespace(String(namePart || "")).toLowerCase();
  if (quantityRange && !unitKey) {
    const groceryNameCandidate = normalizeWhitespace(rawNameLower.replace(/,.*$/, ""));
    const trailingCountUnitMatch = groceryNameCandidate.match(/^(.+?)\s+(cloves?|stalks?)$/i);
    if (trailingCountUnitMatch) {
      unitKey = normalizeUnit(trailingCountUnitMatch[2]);
      rawNameLower = trailingCountUnitMatch[1];
    } else if (/\bbay\s+(?:leaf|leaves)$/i.test(groceryNameCandidate)) {
      unitKey = "leaf";
      rawNameLower = "bay leaf";
    }
  }

  const canonical = buildCanonicalIngredient(rawNameLower);
  if (!canonical) return null;

  const notes = extractUsageNotes(original);
  const countNoteMatch = original.match(/\((?:about\s*)?(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s+(?:steaks?|pieces?|sheets?|blocks?|packages?|cans?))\b/i);
  if (countNoteMatch) notes.push(countNoteMatch[1].replace(/\s+/g, " "));
  const weightNoteMatch = original.match(/\((?:about\s*)?(\d+(?:\.\d+)?(?:\s+\d+\/\d+|\/\d+)?)\s*[- ]?(pounds?|lbs?|ounces?|oz)\b/i);
  if (weightNoteMatch && unitKey !== "lb" && unitKey !== "oz") {
    notes.push(`about ${weightNoteMatch[1]} ${normalizeUnit(weightNoteMatch[2])} total`);
  }

  return makeParsedIngredient(original, canonical, unitKey, quantityRange, optional, nonQuantifiedMarker, uniqueNotes(notes));
}

function uniqueNotes(notes) {
  return [...new Set((notes || []).filter(Boolean))];
}
