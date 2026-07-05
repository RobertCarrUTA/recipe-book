import {
  canonicalNoteTokens,
  commodityIngredientRules,
  ingredientRules,
  leadingIngredientRules,
  unitAliasEntries,
} from "./normalization_rules.js";

/*=============================================================================
NORMALIZATION OVERVIEW

These helpers are deliberately free of DOM and storage dependencies.
They normalize inconsistent recipe text into stable strings and canonical
ingredient labels used by structured grocery parsing and aggregation.

=============================================================================*/

function createCanonicalIngredient(base, display = base, extras = null) {
  return extras ? { base, display, ...extras } : { base, display };
}

function ruleMatches(raw, rule) {
  if (rule.match) return rule.match(raw);
  if (rule.pattern) return rule.pattern.test(raw);
  if (rule.includesAll) return rule.includesAll.every((term) => raw.includes(term));
  if (rule.includesAny) return rule.includesAny.some((term) => raw.includes(term));
  if (rule.includes) return raw.includes(rule.includes);
  return false;
}

function canonicalFromRule(rule) {
  return createCanonicalIngredient(rule.base, rule.display || rule.base, rule.extras);
}

function findCanonicalRule(raw, rules) {
  const rule = rules.find((candidate) => ruleMatches(raw, candidate));
  return rule ? canonicalFromRule(rule) : null;
}

function extractNotesStrict(raw) {
  return canonicalNoteTokens.filter((note) => raw.includes(note));
}

const unicodeFractionMap = {
  "\u00bc": "1/4",
  "\u00bd": "1/2",
  "\u00be": "3/4",
  "\u00c2\u00bc": "1/4",
  "\u00c2\u00bd": "1/2",
  "\u00c2\u00be": "3/4",
  "\u2150": "1/7",
  "\u2151": "1/9",
  "\u2152": "1/10",
  "\u2153": "1/3",
  "\u2154": "2/3",
  "\u2155": "1/5",
  "\u2156": "2/5",
  "\u2157": "3/5",
  "\u2158": "4/5",
  "\u2159": "1/6",
  "\u215a": "5/6",
  "\u215b": "1/8",
  "\u215c": "3/8",
  "\u215d": "5/8",
  "\u215e": "7/8",
  "Â¼": "1/4",
  "Â½": "1/2",
  "Â¾": "3/4",
  "â…": "1/7",
  "â…‘": "1/9",
  "â…’": "1/10",
  "â…“": "1/3",
  "â…”": "2/3",
  "â…•": "1/5",
  "â…–": "2/5",
  "â…—": "3/5",
  "â…˜": "4/5",
  "â…™": "1/6",
  "â…š": "5/6",
  "â…›": "1/8",
  "â…œ": "3/8",
  "â…": "5/8",
  "â…ž": "7/8",
};
const unicodeFractionSymbols = Object.keys(unicodeFractionMap).sort((a, b) => b.length - a.length);
const unitAliases = new Map(unitAliasEntries);

export function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUnicodeFractions(text) {
  let result = String(text || "");
  unicodeFractionSymbols.forEach((symbol) => {
    result = result.replace(new RegExp(`(\\d)${symbol}`, "g"), `$1 ${unicodeFractionMap[symbol]}`);
    result = result.replace(new RegExp(symbol, "g"), unicodeFractionMap[symbol]);
  });
  return result;
}

export function parseNumberToken(token) {
  const trimmed = token.trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (/^\d+\/\d+$/.test(trimmed)) {
    const parts = trimmed.split("/");
    const numerator = Number(parts[0]);
    const denominator = Number(parts[1]);
    if (!denominator) return null;
    return numerator / denominator;
  }

  return null;
}

export function parseQuantityRange(quantityText) {
  const cleaned = normalizeWhitespace(normalizeUnicodeFractions(quantityText || "").replace(/-\s*to\s+/gi, "-"));
  if (!cleaned) return null;

  const rangeMatch = cleaned.match(/^(.+?)(?:\s*(?:-|to)\s*)(.+)$/i);
  if (rangeMatch) {
    const left = parseQuantityRange(rangeMatch[1]);
    const right = parseQuantityRange(rangeMatch[2]);
    if (!left || !right) return null;
    return { min: left.min, max: right.max };
  }

  const mixedMatch = cleaned.match(/^(\d+)\s+(\d+\/\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const frac = parseNumberToken(mixedMatch[2]);
    if (frac === null) return null;
    const value = whole + frac;
    return { min: value, max: value };
  }

  const value = parseNumberToken(cleaned);
  if (value === null) return null;
  return { min: value, max: value };
}

export function normalizeUnit(unitRaw) {
  const unit = (unitRaw || "").toLowerCase().trim();

  if (!unit) return null;
  return unitAliases.get(unit) || unit;
}

export function removeParentheticalsAndTrailingNotes(nameText) {
  let name = String(nameText || "");

  // Preserve primary imperial weight inside parentheses, e.g. "(4-pound / 1.8 kg)"
  const weightMatch = name.match(/\(([^)]*?)(\d+(?:\.\d+)?)[\s-]*(pound|pounds|lb|lbs)[^)]*\)/i);
  let preservedWeight = "";
  if (weightMatch) {
    preservedWeight = ` ${weightMatch[2]} lb`;
  }

  name = name.replace(/\([^)]*\)/g, " ");

  // Remove slash-weight fragments like "/ 1.8 kg" or "/1.8kg"
  name = name.replace(/\/\s*\d+(?:\.\d+)?\s*(kg|g)\b/gi, " ");

  // Do NOT truncate at commas; commas often separate important words
  name = name.replace(/,/g, " ");

  return normalizeWhitespace(name + preservedWeight);
}

export function buildCanonicalIngredient(nameLower) {
  const raw = normalizeWhitespace(removeParentheticalsAndTrailingNotes(nameLower)).toLowerCase();
  if (!raw) return null;

  const leadingRule = findCanonicalRule(raw, leadingIngredientRules);
  if (leadingRule) return leadingRule;

  const commodity = findCanonicalRule(raw, commodityIngredientRules);
  if (commodity) {
    return {
      ...commodity,
      notes: extractNotesStrict(raw),
    };
  }

  return findCanonicalRule(raw, ingredientRules) || createCanonicalIngredient(raw);
}

export function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function repairTextEncoding(value) {
  if (typeof value !== "string") return value;

  const replacements = {
    "\u00c2\u00b0F": "\u00b0F",
    "\u00c2\u00b0C": "\u00b0C",
    "\u00c2\u00bc": "1/4",
    "\u00c2\u00bd": "1/2",
    "\u00c2\u00be": "3/4",
    "\u00e2\u0080\u0093": "-",
    "\u00e2\u0080\u0094": "-",
    "\u00e2\u0080\u0098": "'",
    "\u00e2\u0080\u0099": "'",
    "\u00e2\u0080\u009c": "\"",
    "\u00e2\u0080\u009d": "\"",
    "\u00c3\u00a9": "\u00e9",
    "\u00c3\u00a8": "\u00e8",
    "\u00c3\u00a1": "\u00e1",
    "\u00c3\u00a2": "\u00e2",
    "\u00c3\u00b1": "\u00f1",
    "\u00c3\u00bc": "\u00fc",
    "\u00c3\u00a7": "\u00e7",
  };

  return Object.keys(replacements).reduce(
    (text, token) => text.replace(new RegExp(escapeRegex(token), "g"), replacements[token]),
    value
  );
}
