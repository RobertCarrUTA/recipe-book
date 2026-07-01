# Robert's Recipe Book and Grocery List

A mobile-first recipe book and grocery list app for cooking from saved recipes, managing shopping items, and keeping the phone screen useful while cooking.

The app is intentionally lightweight: no build step, no framework, and no backend. It uses native ES modules, runs from static files served by a local web server, and stores personal state in the browser.

## Features

- Browse saved recipes from `data/recipes.json`.
- Search recipe titles, authors, ingredients, notes, and instructions.
- Filter by status, rating, difficulty, equipment, selected recipes, and favorites.
- Sort recipes by favorites, grocery-list selections, fastest total time, rating, or easiest difficulty.
- Favorite recipes and keep them available with the Favorites filter.
- Plan recipes across a weekly meal plan and build the grocery list from the planned week.
- Open a full-screen Cooking Mode with a collapsible recipe header, ingredients, one instruction step at a time, progress, keyboard navigation, and mobile-friendly controls.
- Keep the screen awake while cooking when the browser supports Screen Wake Lock.
- Install the app from supported browsers and keep the recipe book/grocery list usable after the app shell and recipe data have been cached.
- Add selected recipe ingredients to a grocery list, adjust per-recipe quantities, or add all recipes at once.
- Add one-off manual grocery items.
- Group grocery items into collapsible shopping sections and combine compatible units.
- Check off grocery items, hide checked items while shopping, clear checked progress, and track progress with a mobile grocery badge.
- Review recipe sources for grocery items and jump back from a grocery item to its source recipe.
- Copy the current grocery list as clean text for notes, messages, or printing.
- Export and import a backup of browser state for moving favorites, meal plans, grocery selections, manual items, and preferences between browsers or devices.
- Persist search, sort, filters, selected recipes, recipe quantity multipliers, weekly meal plan, favorites, manual grocery items, grocery checks, grouping, collapsed controls/sections, and wake-lock preference with `localStorage`.
- Render recipe cards incrementally as you scroll, with recipe details built only when a card is opened, so the app can grow without paying the full DOM cost up front.
- Fetch recipe data with a per-load cache-busting URL so phone browsers and static hosts do not keep stale `data/recipes.json` around after recipe updates.

## How To Use

Use the Recipes view to search, filter, favorite, and open recipes. Expand a recipe card to see details, add it to the grocery list, adjust the recipe quantity used for grocery math, view the full source recipe when a link is available, or start Cooking Mode.

Use the Meal Plan panel to schedule recipes across the week. Recipe cards also include a day picker for quickly adding a recipe to the plan. Build list turns the planned week into recipe selections and grocery quantities.

Optionally use Cooking Mode when actively cooking. It shows the recipe ingredients alongside one instruction step at a time, and the recipe header can collapse to make more room for the current step. Use Previous and Next to move through the recipe, or press Escape to close it. The keep-awake toggle in Cooking Mode is synced with the main keep-awake toggle.

Use the Grocery List view to add one-off items, add all recipes, review combined shopping items, inspect which recipes contributed an item, group items into collapsible sections, hide checked items while shopping, clear checked progress, or clear the list.

Use Export backup and Import backup in the Grocery List controls when moving browser state to another browser or preserving a local copy before clearing site data.

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
- Recipe quantity multipliers
- Grocery item checkmarks
- Manual grocery items
- Weekly meal plan
- Favorite recipes
- Search text
- Active filters
- Selected-only and favorites-only toggles
- Grocery grouping
- Collapsed recipe and grocery controls
- Collapsed grocery sections
- Last mobile view
- Keep-awake preference
- Delete-all grocery confirmation preference

Clearing browser site data will reset these preferences.

The backup controls export these preferences and grocery selections to a JSON file. Imports are validated before the app applies them, and grocery totals are recomputed from the current recipe data after restore.

## Offline App

The app registers a service worker when served over `http://localhost`, `https`, or another service-worker-capable origin. It caches the static app shell and the latest successful `data/recipes.json` response so the app can reopen without a network connection after the first successful load.

When a newer service worker is ready, the header shows an update status with a Refresh button.

## Code Architecture

The code is split by responsibility:

- `js/app.js`: Application composition, event wiring, filtering, mobile view, wake lock, and persistence orchestration.
- `js/render.js`: Renderer composition boundary that joins feature renderers while preserving one renderer API for the app.
- `js/recipe_renderer.js`, `js/meal_plan_renderer.js`, `js/grocery_renderer.js`, `js/cooking_renderer.js`: DOM rendering for recipe cards, the meal plan, the grocery list, and Cooking Mode. State changes are sent through injected actions.
- Recipe browsing filters against cached recipe data first, then streams matching recipe cards into the DOM in scroll-loaded batches. Hidden recipe details are rendered lazily when the card is expanded.
- `js/recipe_sort.js`: Recipe list ranking for the browse sort control without requiring rendered recipe cards.
- `js/grocery_model.js`: Grocery aggregation domain model for selected recipes, recipe quantity multipliers, favorites, checkmarks, source details, and parsed display names.
- `js/grocery_list_exporter.js`: Plain-text grocery list export built from the same runtime grocery state and source-aware display helpers used by the renderer.
- `js/meal_plan_model.js`: Weekly meal-plan domain model for scheduled recipes and grocery-list generation from a plan.
- `js/recipe_filter.js`, `js/recipe_formatting.js`, `js/grocery_view_model.js`, `js/cooking_model.js`: Pure UI/domain helper modules used by the renderer and controller.
- `js/recipe_repository.js`: Recipe loading boundary for bundled recipes and future user/imported recipe sources.
- `js/recipe_schema.js`: Recipe data normalization, schema defaults, ID de-duplication, and data warnings.
- `js/storage.js`: Versioned `localStorage` adapter with defensive reads, writes, and migrations.
- `js/backup_controller.js`, `js/offline_controller.js`, `sw.js`: Browser-state backup/import, service-worker registration, and offline cache behavior.
- `js/ui_state.js`, `js/mobile_view_controller.js`, `js/wake_lock_controller.js`, `js/cooking_controls.js`: Browser UI controllers isolated from the app composition root.
- `js/ingredient_parser.js`, `js/normalization.js`, `js/units.js`, `js/grouping.js`: Pure parsing, normalization, unit conversion, and grouping helpers.

The app exposes `window.recipeBookDebug` only when the URL includes `?debug=1`.

## Verification

Run the local verification script after code or data changes:

```bash
npm run verify
```

On Windows PowerShell, if script execution policy blocks `npm`, use:

```bash
npm.cmd run verify
```

It syntax-checks JavaScript modules, runs focused unit tests, validates the recipe schema, checks unique IDs, exercises ingredient parsing, and recomputes grocery totals from the real recipe data.

For an advisory recipe data quality report:

```bash
npm run report:data-quality
```

The report highlights schema warnings, structured grocery coverage, source link coverage, metadata coverage, parser issues, amountless grocery items, ungrouped grocery labels, and near-duplicate shopping labels worth reviewing.

For an optional browser-level smoke test:

```bash
npm run smoke:browser
```

The browser smoke test starts a local static server and runs focused Playwright checks for recipe loading, search/filter behavior, grocery list updates, Cooking Mode, and mobile view tabs. It requires Playwright and a local Chrome/Edge executable by default; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a Chromium-based browser when auto-detection is not enough.

For the strictest local gate before a PR:

```bash
npm run verify:full
```

If a constrained environment intentionally cannot run browser smoke tests, set `RECIPE_BOOK_ALLOW_SMOKE_SKIP=1` before `npm run smoke:browser` or `npm run verify:full`.

## Cache Busting

`index.html` uses a neutral release-style asset version on local CSS and JS URLs, such as `?v=20260614-1`.
Recipe data is fetched with `cache: "no-store"` and a per-load cache-busting query string, so refreshing the app asks for the newest `data/recipes.json` instead of reusing a stale copy.

When CSS or JavaScript changes, bump both asset URLs with:

```bash
npm run set-asset-version -- 20260614-2
```
