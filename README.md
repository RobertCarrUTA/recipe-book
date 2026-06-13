# Robert's Recipe Book and Grocery List

A mobile-first recipe book and grocery list app for cooking from saved recipes, managing shopping items, and keeping the phone screen useful while cooking.

The app is intentionally lightweight: no build step, no framework, and no backend. It runs from static files and stores personal state in the browser.

## Features

- Browse saved recipes from `data/recipes.json`.
- Search recipe titles, authors, ingredients, notes, and instructions.
- Filter by status, rating, difficulty, equipment, selected recipes, and favorites.
- Favorite recipes and keep them available with the Favorites filter.
- Open a full-screen Cooking Mode with ingredients, one instruction step at a time, progress, keyboard navigation, and mobile-friendly controls.
- Keep the screen awake while cooking when the browser supports Screen Wake Lock.
- Add selected recipe ingredients to a grocery list.
- Group grocery items and combine compatible units.
- Check off grocery items with a progress summary and mobile grocery badge.
- Persist search, filters, selected recipes, favorites, grocery checks, grouping, and wake-lock preference with `localStorage`.

## How To Use

Use the Recipes view to search, filter, favorite, and open recipes. Expand a recipe card to see details, add it to the grocery list, view the full source recipe when a link is available, or start Cooking Mode.

Optionally use Cooking Mode when actively cooking. It shows the recipe ingredients alongside one instruction step at a time. Use Previous and Next to move through the recipe, or press Escape to close it. The keep-awake toggle in Cooking Mode is synced with the main keep-awake toggle.

Use the Grocery List view to review combined shopping items, group them, check items off while shopping, or clear the list.

## Recipe Data

Recipes live in `data/recipes.json`. To add a recipe, add a new recipe object to the JSON array using the existing entries as a template.

Recommended fields:

- `id`: Stable unique identifier.
- `title`: Recipe title.
- `ingredients`: Human-readable ingredient lines.
- `instructions`: Ordered cooking steps.
- `groceryIngredients`: Structured grocery data used for shopping math.

Optional fields:

- `author`
- `description`
- `category`
- `prepTime`
- `cookTime`
- `additionalTime`
- `totalTime`
- `servings`
- `yield`
- `rating`
- `tags`
- `equipment`
- `nutrition`
- `notes`
- `personalNotes`
- `link`

## Grocery Ingredients

For the most accurate grocery list, use `groceryIngredients`. These entries override the fallback parser used for regular ingredient text.

Example:

```json
"groceryIngredients": [
  { "item": "garlic", "quantity": 3, "unit": "clove" },
  { "item": "crushed tomatoes", "quantity": 1, "unit": "can", "note": "28 oz can" }
]
```

Use grocery items as shopping labels. Preserve meaningful distinctions such as `fire-roasted diced tomatoes` versus `diced tomatoes`, and `chipotle peppers in adobo sauce` versus generic peppers.

Avoid noisy notes like `to taste` or `plus more` in structured grocery data unless the note is genuinely useful while shopping.

## Browser State

The app stores personal state in `localStorage`, including:

- Grocery list recipe selections
- Grocery item checkmarks
- Favorite recipes
- Search text
- Active filters
- Selected-only and favorites-only toggles
- Grocery grouping
- Last mobile view
- Keep-awake preference

Clearing browser site data will reset these preferences.
