const definitions = [
  { id: "breakfast", label: "Breakfast" },
  { id: "main-dishes", label: "Main Dishes" },
  { id: "pizza", label: "Pizza" },
  { id: "sandwiches", label: "Sandwiches" },
  { id: "burgers", label: "Burgers" },
  { id: "steak", label: "Steak" },
  { id: "soups-stews", label: "Soups & Stews" },
  { id: "sides-snacks", label: "Sides & Snacks" },
  { id: "salsas-sauces", label: "Salsas & Sauces" },
  { id: "baking", label: "Baking" },
  { id: "cookies", label: "Cookies & Bars" },
  { id: "desserts", label: "Desserts" },
  { id: "drinks", label: "Drinks" },
];

export const recipeCollectionDefinitions = Object.freeze(
  definitions.map((definition) => Object.freeze({ ...definition }))
);

const definitionById = new Map(
  recipeCollectionDefinitions.map((definition) => [definition.id, definition])
);

function normalizeCollectionId(value) {
  return String(value || "").trim().toLowerCase();
}

export function isRecipeCollectionId(value) {
  return definitionById.has(String(value || ""));
}

export function getRecipeCollectionLabel(value) {
  return definitionById.get(String(value || ""))?.label || String(value || "");
}

export function normalizeRecipeCollections(value) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map(normalizeCollectionId)
        .filter((collectionId) => definitionById.has(collectionId))
    )
  );
}

export function getRecipeCollectionOptions(recipes, { includeEmpty = false } = {}) {
  const counts = new Map(recipeCollectionDefinitions.map(({ id }) => [id, 0]));

  (Array.isArray(recipes) ? recipes : []).forEach((recipe) => {
    const recipeCollections = new Set(normalizeRecipeCollections(recipe?.collections));
    recipeCollections.forEach((collectionId) => {
      counts.set(collectionId, counts.get(collectionId) + 1);
    });
  });

  return recipeCollectionDefinitions
    .map((definition) => ({
      ...definition,
      count: counts.get(definition.id),
    }))
    .filter((option) => includeEmpty || option.count > 0);
}
