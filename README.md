# Robert's Recipe Book and Grocery List

A mobile-first recipe book, meal planner, cooking companion, and grocery list for saved recipes.

The project is intentionally small and durable: static files, native browser APIs, no framework, no backend, and no required build step for the app shell. Recipe source files are maintained as individual JSON files and bundled into the runtime recipe file with one npm script.

## Table of Contents

- [At a Glance](#at-a-glance)
- [Quick Start](#quick-start)
- [Using the App](#using-the-app)
- [Recipe Data](#recipe-data)
- [Structured Grocery Ingredients](#structured-grocery-ingredients)
- [Browser State and Backups](#browser-state-and-backups)
- [Offline Behavior](#offline-behavior)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Verification](#verification)
- [Cache Busting](#cache-busting)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## At a Glance

Robert's Recipe Book helps with the whole home-cooking loop:

- Browse, search, sort, filter, favorite, and open saved recipes.
- Plan recipes across a week and turn the plan into grocery selections.
- Build a combined grocery list from selected recipes, adjusted quantities, and one-off manual items.
- Group grocery items by shopping section, check items off while shopping, hide checked items, and copy the list as clean text.
- Cook from a focused full-screen Cooking Mode with ingredients, one instruction step at a time, progress, keyboard controls, and optional screen wake lock.
- Export and import browser-state backups for favorites, grocery selections, meal plans, manual items, checks, quantities, and preferences.
- Reopen after the first successful load when the app shell and recipe data have been cached by the service worker.

The app runs from static files served by a local or hosted web server. Personal state stays in the browser through `localStorage`.

## Quick Start

Install dependencies:

```bash
npm install
```

Verify the project:

```bash
npm run verify
```

Serve the static app from the repository root with any simple web server. One common option is:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

The app does not need a JavaScript build step. CSS and JavaScript are loaded directly by `index.html` as static assets.

## Using the App

### Recipes

Use the Recipes view to search, filter, sort, favorite, select, and open recipes. Expanding a recipe card shows recipe details, source links when available, grocery controls, quantity controls, meal-plan controls, and the Cooking Mode entry point.

Recipes can be filtered by status, rating, difficulty, equipment, selected recipes, and favorites. Sorting supports favorites, grocery-list selections, fastest total time, rating, and easiest difficulty.

### Meal Plan

Use the Meal Plan panel to schedule recipes across the week. Recipe cards also include a day picker for quickly adding a recipe to the plan.

When the week is planned, use Build list to convert planned recipes into recipe selections and grocery quantities.

### Cooking Mode

Cooking Mode is designed for the moment the phone is on the counter and your hands are busy. It shows ingredients beside one instruction step at a time, tracks progress, supports Previous and Next navigation, and closes with Escape.

When supported by the browser, the keep-awake toggle uses Screen Wake Lock. The Cooking Mode toggle and the main keep-awake toggle stay in sync.

### Grocery List

Use the Grocery List view to:

- Add ingredients from selected recipes.
- Add all recipes at once.
- Adjust per-recipe quantities.
- Add one-off manual grocery items.
- Review combined shopping items.
- Inspect which recipes contributed to a grocery item.
- Group items into collapsible shopping sections.
- Check items off while shopping.
- Hide checked items.
- Clear checked progress or clear the list.
- Copy the current grocery list as clean text.

Compatible grocery units are combined where possible, and recipe sources remain available so a shopping item can be traced back to the recipes that need it.

## Recipe Data

Recipe source files live in `data/recipes/`, with one recipe object per file.

Use this filename pattern:

```text
data/recipes/<recipe-id>.json
```

The source filename must match the recipe `id`:

```text
data/recipes/chicken-fried-steak.json
```

```json
{
  "id": "chicken-fried-steak",
  "title": "Chicken Fried Steak"
}
```

Keep recipe IDs as simple dish-name slugs. Keep titles literal and modest; let the ingredients, method, notes, and result carry the quality.

The browser loads `data/recipes.json`, but that file is generated. After adding or editing files in `data/recipes/`, rebuild the generated bundle:

```bash
npm run build:recipes
```

Do not hand-edit `data/recipes.json` unless you are intentionally repairing the generated bundle.

### Recommended Fields

- `id`: Stable unique identifier.
- `title`: Recipe title.
- `ingredients`: Human-readable ingredient lines.
- `instructions`: Ordered cooking steps.
- `groceryIngredients`: Structured grocery data used for shopping math.

### Optional Fields

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

## Structured Grocery Ingredients

For the most accurate grocery list, add `groceryIngredients`. These entries override the fallback parser used for regular ingredient text.

```json
{
  "groceryIngredients": [
    { "item": "garlic", "quantity": 3, "unit": "clove" },
    { "item": "crushed tomatoes", "quantity": 1, "unit": "can", "note": "28 oz can" }
  ]
}
```

Use grocery items as shopping labels. Preserve meaningful distinctions, such as `fire-roasted diced tomatoes` versus `diced tomatoes`, or `chipotle peppers in adobo sauce` versus generic peppers.

Keep notes useful for shopping. Avoid noisy notes such as `to taste` or `plus more` unless the note changes what should be bought.

## Browser State and Backups

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

Clearing browser site data resets these preferences.

Use Export backup and Import backup in the Grocery List controls when moving state to another browser or preserving a local copy before clearing site data. Imports are validated before they are applied, and grocery totals are recomputed from the current recipe data after restore.

## Offline Behavior

The app registers a service worker when served from `http://localhost`, `https`, or another service-worker-capable origin. The service worker caches the static app shell and the latest successful `data/recipes.json` response so the app can reopen without a network connection after the first successful load.

When a newer service worker is ready, the header shows an update status with a Refresh button.

Recipe data is requested with `cache: "no-store"` and a per-load cache-busting query string, which helps phone browsers and static hosts pick up fresh recipe data after updates.

## Project Structure

```text
.
|-- index.html                 Static app entry point
|-- css/styles.css             App styles
|-- js/                        Native ES modules
|-- data/recipes/              Recipe source files
|-- data/recipes.json          Generated runtime recipe bundle
|-- scripts/                   Validation, build, and utility scripts
|-- tests/                     Focused unit and smoke-test helpers
|-- sw.js                      Service worker
|-- manifest.webmanifest       Installable app manifest
|-- LICENSE.md                 Full license text
`-- NOTICE                     Project notice
```

### JavaScript Map

- `js/app.js`: Application composition, event wiring, filtering, mobile view, wake lock, and persistence orchestration.
- `js/render.js`: Renderer composition boundary that exposes one renderer API to the app.
- `js/recipe_renderer.js`: Recipe card and recipe-detail rendering.
- `js/meal_plan_renderer.js`: Weekly meal-plan rendering.
- `js/grocery_renderer.js`: Grocery-list rendering.
- `js/cooking_renderer.js`: Cooking Mode rendering.
- `js/recipe_sort.js`: Recipe list ranking for browse sort controls.
- `js/grocery_model.js`: Grocery aggregation for selected recipes, quantities, favorites, checks, source details, and parsed display names.
- `js/grocery_list_exporter.js`: Plain-text grocery list export.
- `js/meal_plan_model.js`: Weekly meal-plan model and plan-to-grocery generation.
- `js/recipe_filter.js`, `js/recipe_formatting.js`, `js/grocery_view_model.js`, `js/cooking_model.js`: Pure UI and domain helpers.
- `js/recipe_repository.js`: Recipe loading boundary for bundled and future recipe sources.
- `js/recipe_schema.js`: Recipe normalization, schema defaults, ID de-duplication, and data warnings.
- `js/storage.js`: Versioned `localStorage` adapter with defensive reads, writes, and migrations.
- `js/backup_controller.js`: Browser-state backup and import flow.
- `js/offline_controller.js` and `sw.js`: Service-worker registration and offline cache behavior.
- `js/ui_state.js`, `js/mobile_view_controller.js`, `js/wake_lock_controller.js`, `js/cooking_controls.js`, `js/collapsible_controls.js`, `js/status_message_controller.js`, `js/clipboard.js`: Browser UI controllers and browser API adapters.
- `js/grocery_ingredient_parser.js`, `js/normalization.js`, `js/units.js`, `js/grouping.js`: Pure parsing, normalization, unit conversion, and grouping helpers.

The app exposes `window.recipeBookDebug` only when the URL includes `?debug=1`.

## Development Workflow

### Add or Edit Recipes

1. Add or edit one JSON file in `data/recipes/`.
2. Keep the filename and recipe `id` matched.
3. Prefer structured `groceryIngredients` for accurate grocery math.
4. Run `npm run build:recipes`.
5. Run `npm run verify`.

Recipe-only changes do not require an asset-version bump.

### Change CSS or JavaScript

1. Make the focused app change.
2. Bump the asset version in `index.html`:

   ```bash
   npm run set-asset-version -- YYYYMMDD-N
   ```

3. Run `npm run verify`.
4. Run `npm run smoke:browser` for user-facing UI, rendering, or browser-loading changes.

Use the current date for `YYYYMMDD` and increment `N` if multiple CSS or JavaScript changes happen on the same day.

### Change Documentation

Documentation-only changes do not require rebuilding recipes or bumping asset versions.

## Verification

Run the standard local check after code or recipe-data changes:

```bash
npm run verify
```

On Windows PowerShell, if script execution policy blocks `npm`, use:

```bash
npm.cmd run verify
```

`npm run verify`:

- Syntax-checks JavaScript modules.
- Confirms `data/recipes.json` is current with the recipe source files.
- Runs focused unit tests.
- Validates the app and recipe data.
- Exercises ingredient parsing.
- Recomputes grocery totals from real recipe data.

For an advisory recipe data quality report:

```bash
npm run report:data-quality
```

The report highlights schema warnings, structured grocery coverage, source link coverage, metadata coverage, parser issues, amountless grocery items, ungrouped grocery labels, and near-duplicate shopping labels worth reviewing.

For browser-level smoke coverage:

```bash
npm run smoke:browser
```

The browser smoke test starts a local static server and runs focused Playwright checks for recipe loading, search/filter behavior, grocery list updates, Cooking Mode, and mobile view tabs. It uses `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when set, then local Chrome or Edge, then Playwright's managed Chromium when installed.

For the strictest local gate before a PR:

```bash
npm run verify:full
```

If a constrained environment intentionally cannot run browser smoke tests, set `RECIPE_BOOK_ALLOW_SMOKE_SKIP=1` before `npm run smoke:browser` or `npm run verify:full`.

Pull requests and pushes to `main` run `npm run verify:full` in GitHub Actions, including a Playwright Chromium install for the browser smoke checks.

## Cache Busting

`index.html` uses a release-style asset version on local CSS and JavaScript URLs, such as:

```text
?v=20260614-1
```

When CSS or JavaScript changes, bump local asset URLs with:

```bash
npm run set-asset-version -- 20260614-2
```

Recipe data does not use the asset version. It is fetched with `cache: "no-store"` and a per-load cache-busting query string.

## Troubleshooting

### Recipes changed but the app still shows old data

Run:

```bash
npm run build:recipes
```

Then refresh the browser. If the app reports an available update, use Refresh in the app header.

### `npm run verify` says `data/recipes.json` is stale

The generated recipe bundle does not match the source files in `data/recipes/`. Run:

```bash
npm run build:recipes
```

Then run:

```bash
npm run verify
```

### PowerShell blocks npm scripts

Use `npm.cmd`:

```bash
npm.cmd run verify
```

### Browser smoke tests cannot find Chromium

Install Playwright browsers or point the test at an existing Chromium-based browser with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

```bash
npm run smoke:browser
```

## License

This project is available for noncommercial use only.

- App code is licensed under the PolyForm Noncommercial License 1.0.0.
- Project-owned recipes, notes, documentation, and other non-software content are licensed under CC BY-NC-SA 4.0.

You may use, copy, modify, and share the app and content for noncommercial purposes with credit. You may not sell the app as-is, charge for copies, include it in a paid or commercial product or service, or sell modified versions without separate written permission.

Some recipe entries may contain or reference recipes from other authors or sources. Those third-party materials remain owned by their original rights holders and are not relicensed by this project.

See `LICENSE.md` and `NOTICE` for the full project licensing notice.
