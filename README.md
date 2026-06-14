# Robert's Recipe Book and Grocery List

A mobile-first recipe book and grocery list app for cooking from saved recipes, managing shopping items, and keeping the phone screen useful while cooking.

The app is intentionally lightweight: no build step, no framework, and no backend. It uses native ES modules, runs from static files served by a local web server, and stores personal state in the browser.

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

## Code Architecture

The code is split by responsibility:

- `js/app.js`: Application composition, event wiring, filtering, mobile view, wake lock, and persistence orchestration.
- `js/render.js`: DOM rendering only. State changes are sent through injected actions.
- `js/grocery_model.js`: Grocery aggregation domain model for selected recipes, favorites, checkmarks, and parsed display names.
- `js/recipe_filter.js`, `js/recipe_formatting.js`, `js/grocery_view_model.js`, `js/cooking_model.js`: Pure UI/domain helper modules used by the renderer and controller.
- `js/recipe_repository.js`: Recipe loading boundary for bundled recipes and future user/imported recipe sources.
- `js/recipe_schema.js`: Recipe data normalization, schema defaults, ID de-duplication, and data warnings.
- `js/storage.js`: Versioned `localStorage` adapter with defensive reads, writes, and migrations.
- `js/ui_state.js`, `js/mobile_view_controller.js`, `js/wake_lock_controller.js`, `js/cooking_controls.js`: Browser UI controllers isolated from the app composition root.
- `js/ingredient_parser.js`, `js/normalization.js`, `js/units.js`, `js/grouping.js`: Pure parsing, normalization, unit conversion, and grouping helpers.

The app exposes `window.recipeBookDebug` only when the URL includes `?debug=1`.

## Verification

Run the local verification script after code or data changes:

```bash
npm run verify
```

It runs focused unit tests, validates the recipe schema, checks unique IDs, exercises ingredient parsing, and recomputes grocery totals from the real recipe data.

For an optional browser-level smoke test:

```bash
npm run smoke:browser
```

The browser smoke test starts a local static server and exercises search, grocery list updates, grouping, cooking mode, and clearing the list when Playwright and a local Chrome/Edge executable are available.

## Asset Cache Busting

`index.html` uses a neutral release-style asset version on local CSS and JS URLs, such as `?v=20260614-1`.

When CSS or JavaScript changes, bump both asset URLs with:

```bash
npm run set-asset-version -- 20260614-2
```
