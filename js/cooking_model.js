export function getCookingSteps(recipe) {
  return Array.isArray(recipe && recipe.instructions) && recipe.instructions.length
    ? recipe.instructions
    : ["No instructions are available for this recipe yet."];
}

export function getCookingIngredients(recipe) {
  return Array.isArray(recipe && recipe.ingredients) ? recipe.ingredients : [];
}
