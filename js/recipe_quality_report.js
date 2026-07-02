import {
  normalizeParsedIngredients,
  parseStructuredGroceryIngredient,
} from "./grocery_ingredient_parser.js";
import { determineGroupForKey } from "./grouping.js";
import { normalizeWhitespace } from "./normalization.js";

const knownGroceryUnits = new Set([
  "tsp",
  "tbsp",
  "cup",
  "oz",
  "lb",
  "g",
  "kg",
  "ml",
  "l",
  "bag",
  "block",
  "bottle",
  "bunch",
  "can",
  "clove",
  "egg",
  "egg white",
  "jar",
  "leaf",
  "package",
  "sheet",
  "slice",
  "sprig",
  "stalk",
  "stick",
  "yolk",
  "item",
]);

const noisyStructuredNotePatterns = [
  /\bto taste\b/i,
  /\bas needed\b/i,
  /\bas desired\b/i,
  /\bplus more\b/i,
  /\boptional\b/i,
  /\bdivided\b/i,
];

const duplicateReviewStopWords = new Set([
  "chopped",
  "diced",
  "dried",
  "fresh",
  "grated",
  "ground",
  "minced",
  "shredded",
  "sliced",
  "whole",
]);

function recipeRef(recipe, index) {
  return {
    id: String(recipe.id || `recipe-${index + 1}`),
    title: String(recipe.title || `Untitled Recipe ${index + 1}`),
  };
}

function hasStructuredGroceryIngredients(recipe) {
  return Array.isArray(recipe.groceryIngredients) && recipe.groceryIngredients.length > 0;
}

function hasValidHttpUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function describeEntry(entry) {
  if (typeof entry === "string") return normalizeWhitespace(entry);
  if (!entry || typeof entry !== "object") return "";

  return normalizeWhitespace(
    entry.original ||
      entry.text ||
      entry.display ||
      entry.item ||
      entry.name ||
      entry.canonical ||
      JSON.stringify(entry)
  );
}

function collectRecipeEntries(recipe) {
  if (!hasStructuredGroceryIngredients(recipe)) return [];

  return recipe.groceryIngredients.map((entry) => ({
    input: describeEntry(entry),
    parsed: normalizeParsedIngredients(parseStructuredGroceryIngredient(entry)),
    source: "structured",
  }));
}

function addRecipeToSet(target, recipe) {
  target.set(recipe.id, recipe.title);
}

function sortedRecipeTitles(recipeMap) {
  return [...recipeMap.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function labelReviewKey(label) {
  const normalized = normalizeWhitespace(String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, " "));
  if (!normalized) return "";

  return normalized
    .split(" ")
    .filter((word) => !duplicateReviewStopWords.has(word))
    .map((word) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word))
    .join(" ");
}

function createLabelRecord(parsed, recipe) {
  const key = parsed.canonical?.base;
  if (!key) return null;

  return {
    display: parsed.canonical.display || key,
    key,
    recipe,
  };
}

function incrementLabelMap(map, record) {
  if (!record) return;

  const current = map.get(record.key) || {
    count: 0,
    display: record.display,
    key: record.key,
    recipes: new Map(),
  };

  current.count += 1;
  addRecipeToSet(current.recipes, record.recipe);
  map.set(record.key, current);
}

function compareCountThenName(a, b) {
  if (b.count !== a.count) return b.count - a.count;
  return a.key.localeCompare(b.key, undefined, { sensitivity: "base" });
}

function summarizeLabelRecords(labelMap) {
  return [...labelMap.values()]
    .map((item) => ({
      count: item.count,
      display: item.display,
      key: item.key,
      recipeCount: item.recipes.size,
      recipes: sortedRecipeTitles(item.recipes),
    }))
    .sort(compareCountThenName);
}

function buildDuplicateReviewGroups(labelMap) {
  const groupsByReviewKey = new Map();

  labelMap.forEach((item) => {
    const reviewKey = labelReviewKey(item.display || item.key);
    if (!reviewKey) return;

    const group = groupsByReviewKey.get(reviewKey) || new Map();
    group.set(item.key, item);
    groupsByReviewKey.set(reviewKey, group);
  });

  return [...groupsByReviewKey.entries()]
    .map(([reviewKey, variants]) => ({
      reviewKey,
      variants: summarizeLabelRecords(variants),
    }))
    .filter((group) => group.variants.length > 1)
    .sort((a, b) => {
      const aCount = a.variants.reduce((sum, item) => sum + item.count, 0);
      const bCount = b.variants.reduce((sum, item) => sum + item.count, 0);
      if (bCount !== aCount) return bCount - aCount;
      return a.reviewKey.localeCompare(b.reviewKey, undefined, { sensitivity: "base" });
    });
}

function isNoisyStructuredNote(note) {
  return noisyStructuredNotePatterns.some((pattern) => pattern.test(note));
}

function normalizeSchemaWarnings(warnings) {
  return Array.isArray(warnings) ? warnings.map(String).filter(Boolean) : [];
}

export function analyzeRecipeDataQuality(recipes, options = {}) {
  const recipeList = Array.isArray(recipes) ? recipes : [];
  const schemaWarnings = normalizeSchemaWarnings(options.schemaWarnings || options.warnings);
  const allLabelsByKey = new Map();
  const ungroupedLabelsByKey = new Map();

  const report = {
    recipeCount: recipeList.length,
    schemaWarnings,
    coverage: {
      structuredGrocery: {
        count: 0,
        missing: [],
      },
      sourceLinks: {
        count: 0,
        invalid: [],
        missing: [],
      },
      ratings: {
        count: 0,
        missing: [],
      },
      difficulties: {
        count: 0,
        missing: [],
      },
    },
    grocery: {
      amountlessItems: [],
      parseFailures: [],
      noisyStructuredNotes: [],
      unknownUnits: [],
      ungroupedLabels: [],
      duplicateLabelReviewGroups: [],
    },
  };

  recipeList.forEach((recipe, index) => {
    const ref = recipeRef(recipe, index);
    const hasStructured = hasStructuredGroceryIngredients(recipe);

    if (hasStructured) {
      report.coverage.structuredGrocery.count += 1;
    } else {
      report.coverage.structuredGrocery.missing.push(ref);
    }

    if (recipe.link) {
      if (hasValidHttpUrl(recipe.link)) {
        report.coverage.sourceLinks.count += 1;
      } else {
        report.coverage.sourceLinks.invalid.push({ ...ref, link: recipe.link });
      }
    } else {
      report.coverage.sourceLinks.missing.push(ref);
    }

    if (recipe.tags?.rating) {
      report.coverage.ratings.count += 1;
    } else {
      report.coverage.ratings.missing.push(ref);
    }

    if (recipe.tags?.difficulty) {
      report.coverage.difficulties.count += 1;
    } else {
      report.coverage.difficulties.missing.push(ref);
    }

    collectRecipeEntries(recipe).forEach((entry) => {
      if (!entry.parsed.length) {
        report.grocery.parseFailures.push({
          ...ref,
          input: entry.input,
          source: entry.source,
        });
        return;
      }

      entry.parsed.forEach((parsed) => {
        const labelRecord = createLabelRecord(parsed, ref);
        incrementLabelMap(allLabelsByKey, labelRecord);

        if (labelRecord && determineGroupForKey(labelRecord.key) === "Other") {
          incrementLabelMap(ungroupedLabelsByKey, labelRecord);
        }

        if (parsed.unitKey && !knownGroceryUnits.has(parsed.unitKey)) {
          report.grocery.unknownUnits.push({
            ...ref,
            input: entry.input,
            item: labelRecord?.display || labelRecord?.key || "",
            unit: parsed.unitKey,
          });
        }

        if (!parsed.quantityRange) {
          report.grocery.amountlessItems.push({
            ...ref,
            input: entry.input,
            item: labelRecord?.display || labelRecord?.key || "",
            notes: parsed.notes || [],
            source: entry.source,
          });
        }

        if (entry.source === "structured" && Array.isArray(parsed.notes)) {
          parsed.notes.filter(isNoisyStructuredNote).forEach((note) => {
            report.grocery.noisyStructuredNotes.push({
              ...ref,
              input: entry.input,
              item: labelRecord?.display || labelRecord?.key || "",
              note,
            });
          });
        }
      });
    });
  });

  report.grocery.ungroupedLabels = summarizeLabelRecords(ungroupedLabelsByKey);
  report.grocery.duplicateLabelReviewGroups = buildDuplicateReviewGroups(allLabelsByKey);

  return report;
}

function ratio(count, total) {
  if (!total) return "0/0";
  return `${count}/${total}`;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function limited(items, maxItems) {
  return items.slice(0, maxItems);
}

function hiddenCount(items, maxItems) {
  return Math.max(0, items.length - maxItems);
}

function formatRecipeRefs(refs, maxItems) {
  if (!refs.length) return ["None."];

  const lines = limited(refs, maxItems).map((item) => `- ${item.title}`);
  const remaining = hiddenCount(refs, maxItems);
  if (remaining) lines.push(`- ...and ${pluralize(remaining, "more recipe")}.`);
  return lines;
}

function formatIssueRows(items, maxItems, formatter) {
  if (!items.length) return ["None."];

  const lines = limited(items, maxItems).map(formatter);
  const remaining = hiddenCount(items, maxItems);
  if (remaining) lines.push(`- ...and ${pluralize(remaining, "more item")}.`);
  return lines;
}

function formatCoverageLine(label, count, total) {
  return `- ${label}: ${ratio(count, total)}`;
}

function formatRecipesSample(recipes) {
  if (!recipes.length) return "";
  const sample = recipes.slice(0, 3).join("; ");
  const suffix = recipes.length > 3 ? `; +${recipes.length - 3} more` : "";
  return ` (${sample}${suffix})`;
}

function formatRecommendations(report) {
  const recommendations = [];

  if (report.grocery.parseFailures.length || report.grocery.unknownUnits.length) {
    recommendations.push("Fix parser failures and unknown grocery units first; they can directly affect shopping totals.");
  }

  if (report.grocery.ungroupedLabels.length) {
    recommendations.push("Add grouping rules for the highest-frequency grocery labels currently landing in Other.");
  }

  if (report.grocery.amountlessItems.length) {
    recommendations.push("Review amountless grocery items and add quantities where the source gives a clear shopping amount.");
  }

  if (report.coverage.ratings.missing.length || report.coverage.difficulties.missing.length) {
    recommendations.push("Fill rating and difficulty tags gradually as recipes are cooked or reviewed.");
  }

  if (!recommendations.length) {
    recommendations.push("No immediate cleanup recommendations. Keep running this report after recipe data changes.");
  }

  return recommendations.map((item, index) => `${index + 1}. ${item}`);
}

export function formatRecipeDataQualityReport(report, options = {}) {
  const maxItems = Number.isInteger(options.maxItems) ? options.maxItems : 10;
  const sourceLabel = options.sourceLabel || "data/recipes.json";
  const total = report.recipeCount;
  const lines = [
    "# Recipe Data Quality Report",
    "",
    `Source: ${sourceLabel}`,
    "",
    "## Summary",
    `- Recipes analyzed: ${total}`,
    `- Schema warnings: ${report.schemaWarnings.length}`,
    formatCoverageLine("Structured grocery coverage", report.coverage.structuredGrocery.count, total),
    formatCoverageLine("Source link coverage", report.coverage.sourceLinks.count, total),
    formatCoverageLine("Rating coverage", report.coverage.ratings.count, total),
    formatCoverageLine("Difficulty coverage", report.coverage.difficulties.count, total),
    `- Grocery parse failures: ${report.grocery.parseFailures.length}`,
    `- Unknown grocery units: ${report.grocery.unknownUnits.length}`,
    `- Amountless grocery items: ${report.grocery.amountlessItems.length}`,
    `- Grocery labels in Other: ${report.grocery.ungroupedLabels.length}`,
    `- Near-duplicate label review groups: ${report.grocery.duplicateLabelReviewGroups.length}`,
    "",
    "## Recommended Next Cleanup",
    ...formatRecommendations(report),
    "",
    "## Schema Warnings",
    ...formatIssueRows(report.schemaWarnings, maxItems, (warning) => `- ${warning}`),
    "",
    "## Structural Issues",
    "### Missing Structured Grocery Data",
    ...formatRecipeRefs(report.coverage.structuredGrocery.missing, maxItems),
    "",
    "### Invalid Source Links",
    ...formatIssueRows(report.coverage.sourceLinks.invalid, maxItems, (item) => `- ${item.title}: ${item.link}`),
    "",
    "### Grocery Parse Failures",
    ...formatIssueRows(report.grocery.parseFailures, maxItems, (item) => `- ${item.title}: ${item.input}`),
    "",
    "### Unknown Grocery Units",
    ...formatIssueRows(report.grocery.unknownUnits, maxItems, (item) => `- ${item.title}: ${item.item} uses unit \"${item.unit}\"`),
    "",
    "## Grocery Cleanup Targets",
    "### Highest-Frequency Labels In Other",
    ...formatIssueRows(
      report.grocery.ungroupedLabels,
      maxItems,
      (item) => `- ${item.display}: ${pluralize(item.count, "entry", "entries")} across ${pluralize(item.recipeCount, "recipe")}${formatRecipesSample(item.recipes)}`
    ),
    "",
    "### Amountless Grocery Items",
    ...formatIssueRows(
      report.grocery.amountlessItems,
      maxItems,
      (item) => `- ${item.title}: ${item.item || item.input}${item.notes.length ? ` (${item.notes.join("; ")})` : ""}`
    ),
    "",
    "### Noisy Structured Notes",
    ...formatIssueRows(
      report.grocery.noisyStructuredNotes,
      maxItems,
      (item) => `- ${item.title}: ${item.item || item.input} has note \"${item.note}\"`
    ),
    "",
    "### Near-Duplicate Label Review",
    ...formatIssueRows(
      report.grocery.duplicateLabelReviewGroups,
      maxItems,
      (group) => `- ${group.reviewKey}: ${group.variants.map((item) => `${item.display} (${item.count})`).join(", ")}`
    ),
    "",
    "## Metadata Coverage",
    "### Missing Source Links",
    ...formatRecipeRefs(report.coverage.sourceLinks.missing, maxItems),
    "",
    "### Missing Ratings",
    ...formatRecipeRefs(report.coverage.ratings.missing, maxItems),
    "",
    "### Missing Difficulties",
    ...formatRecipeRefs(report.coverage.difficulties.missing, maxItems),
  ];

  return `${lines.join("\n")}\n`;
}
