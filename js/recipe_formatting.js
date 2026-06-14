import { normalizeWhitespace } from "./normalization.js";

export function formatHeaderLabel(value) {
  return String(value || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getRecipeServingsText(recipe) {
  return recipe && (recipe.servings || recipe.yield) ? String(recipe.servings || recipe.yield) : "";
}

export function formatServingsText(rawServings) {
  const text = normalizeWhitespace(rawServings);
  if (!text) return "";

  const lower = text.toLowerCase();
  const descriptiveServingWords = [
    "serving",
    "servings",
    "bar",
    "bars",
    "biscuit",
    "biscuits",
    "cake",
    "cakes",
    "churro",
    "churros",
    "cookie",
    "cookies",
    "cupcake",
    "cupcakes",
    "donut",
    "donuts",
    "hole",
    "holes",
    "hush",
    "minis",
    "pancake",
    "pancakes",
    "pizza",
    "roll",
    "rolls",
    "skillet",
  ];

  if (descriptiveServingWords.some((word) => new RegExp(`\\b${word}\\b`).test(lower))) return text;

  const rangeWithDetail = text.match(/^(\d+(?:\s*-\s*\d+)?)\s*\((.+)\)$/);
  if (rangeWithDetail) return `${rangeWithDetail[1].replace(/\s*-\s*/g, "-")} servings (${rangeWithDetail[2]})`;

  if (/^\d+(?:\s*-\s*\d+)?$/.test(text)) {
    const normalizedCount = text.replace(/\s*-\s*/g, "-");
    return `${normalizedCount} ${normalizedCount === "1" ? "serving" : "servings"}`;
  }

  return text;
}

export function formatReviewCount(count) {
  if (count === undefined || count === null || count === "") return "";

  const numericCount = Number(String(count).replace(/,/g, ""));
  const displayCount = Number.isFinite(numericCount)
    ? new Intl.NumberFormat().format(numericCount)
    : String(count);

  return `${displayCount} ${String(displayCount) === "1" ? "review" : "reviews"}`;
}

export function formatRatingText(rating, mode) {
  if (!rating || (!rating.value && !rating.count)) return "";

  const ratingValue = rating.value !== undefined && rating.value !== null ? String(rating.value) : "";
  const reviewText = formatReviewCount(rating.count);
  if (!ratingValue) return reviewText;

  const label = mode === "chip" ? "rating" : "stars";
  return reviewText ? `${ratingValue} ${label} (${reviewText})` : `${ratingValue} ${label}`;
}

export function getRecipeHeaderMeta(recipe) {
  const meta = [];

  if (recipe.category) meta.push({ text: recipe.category, primary: true });

  const ratingText = formatRatingText(recipe.rating, "chip");
  if (ratingText) meta.push({ text: ratingText, variant: "rating" });

  if (recipe.totalTime) meta.push({ text: recipe.totalTime });
  else if (recipe.cookTime) meta.push({ text: recipe.cookTime });

  const servingsText = formatServingsText(getRecipeServingsText(recipe));
  if (servingsText) meta.push({ text: servingsText });
  if (recipe.tags && recipe.tags.difficulty) meta.push({ text: formatHeaderLabel(recipe.tags.difficulty) });

  return meta.slice(0, 4);
}
