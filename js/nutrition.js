const nutritionFieldDefinitions = Object.freeze([
  ["calories", "Calories"],
  ["carbohydrates", "Carbohydrates"],
  ["totalCarbohydrates", "Total Carbohydrates"],
  ["protein", "Protein"],
  ["fat", "Fat"],
  ["saturatedFat", "Saturated Fat"],
  ["polyunsaturatedFat", "Polyunsaturated Fat"],
  ["monounsaturatedFat", "Monounsaturated Fat"],
  ["unsaturatedFat", "Unsaturated Fat"],
  ["transFat", "Trans Fat"],
  ["cholesterol", "Cholesterol"],
  ["sodium", "Sodium"],
  ["fiber", "Fiber"],
  ["sugar", "Sugar"],
  ["calcium", "Calcium"],
  ["iron", "Iron"],
  ["potassium", "Potassium"],
  ["vitaminA", "Vitamin A"],
  ["vitaminC", "Vitamin C"],
]);

const nutritionLabels = new Map(nutritionFieldDefinitions);

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function formatNutritionLabel(key) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return "Nutrition";
  if (nutritionLabels.has(normalizedKey)) return nutritionLabels.get(normalizedKey);

  const words = normalizedKey
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return words
    .split(" ")
    .map((word) => word ? word.charAt(0).toUpperCase() + word.slice(1) : "")
    .filter(Boolean)
    .join(" ") || "Nutrition";
}

export function getNutritionEntries(nutrition) {
  if (!nutrition || typeof nutrition !== "object" || Array.isArray(nutrition)) return [];

  const entries = [];
  const includedKeys = new Set();

  nutritionFieldDefinitions.forEach(([key, label]) => {
    if (!hasValue(nutrition[key])) return;
    entries.push({ key, label, value: nutrition[key] });
    includedKeys.add(key);
  });

  Object.keys(nutrition)
    .filter((key) => !includedKeys.has(key) && hasValue(nutrition[key]))
    .sort((left, right) => formatNutritionLabel(left).localeCompare(formatNutritionLabel(right)))
    .forEach((key) => {
      entries.push({ key, label: formatNutritionLabel(key), value: nutrition[key] });
    });

  return entries;
}
