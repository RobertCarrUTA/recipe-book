# Robert's Recipe Book and Grocery List

A mobile-first static web app for saved recipes, weekly meal planning, focused cooking, and grocery-list building.

The project intentionally has no framework, backend, database, bundler, or transpiler. The browser loads native ES modules from static files, recipes are authored as individual JSON documents, and personal state stays in the browser.

## Privacy and Scope

- There are no accounts, analytics, advertisements, or cloud synchronization.
- Favorites, meal plans, grocery state, filters, and preferences are stored in `localStorage`.
- Exported backups are the portable copy of that state. Clearing site data removes the browser copy.
- Every deployed recipe and source file is public to anyone who can access the static site.
- This is a personal recipe application, not a hosted recipe service or shared database.

## Key Features

- Browse recipes by collection, search text, status, rating, difficulty, equipment, favorites, and grocery selection.
- Sort by favorites, grocery selection, time, rating, or difficulty.
- Plan recipes across a week and turn the plan into grocery quantities.
- Aggregate structured grocery ingredients, compatible units, recipe multipliers, and manual items.
- Shop from grouped, collapsible, checkable sections with source tracing and plain-text copy.
- Use a full-screen Cooking Mode with one step at a time, progress, keyboard controls, and optional Screen Wake Lock.
- Export individual recipes and import or export browser-state backups.
- Reopen the installed app offline after a successful online load.

## Requirements

- Node.js and npm for validation and recipe generation. CI currently tests Node.js 22.
- An evergreen browser with native ES module support. Automated browser coverage runs in Chromium.
- A local HTTP server. Do not open `index.html` directly from `file://`.

Screen Wake Lock, service workers, installation prompts, and clipboard behavior vary by browser. Unsupported optional APIs degrade without blocking the core recipe and grocery workflows.

## Quick Start

Install the locked development dependencies:

```bash
npm ci
```

Run the standard verification gate:

```bash
npm run verify
```

Serve the repository root with any static server. Python is one convenient option:

```bash
python -m http.server 8080
```

Open <http://localhost:8080>.

On Windows PowerShell, use `npm.cmd` when script execution policy blocks `npm`:

```powershell
npm.cmd run verify
```

## Architecture at a Glance

```text
data/recipes/*.json
        |
        | npm run build:recipes
        v
data/recipes.json --> repository + schema normalization --> runtime state --> renderers
                                                                  |
                         localStorage <--> persistence/controllers |
                                                                  |
                         service worker <---- shell and recipe cache
```

The checked-in source files are the recipe authoring boundary. `data/recipes.json` is generated for the browser and must not be edited by hand. Pure model and normalization modules hold domain behavior; controllers adapt browser APIs and events; renderers own DOM output; `js/app.js` composes those boundaries.

The service worker uses network-first requests for the app shell and recipe data, then falls back to its latest complete shell and validated recipe cache. The first successful online load is therefore required before offline use.

See [Architecture](docs/architecture.md) for state ownership, module boundaries, rendering, persistence, and offline behavior.

## Project Layout

```text
.
|-- index.html              Static entry point and app structure
|-- css/                    Theme and responsive layout
|-- js/                     Native ES modules
|-- data/recipes/           Authoritative recipe source files
|-- data/recipes.json       Generated runtime bundle
|-- scripts/                Build, validation, reporting, and smoke tools
|-- tests/                  Unit, integration, and data contract tests
|-- docs/                   Architecture, schema, and deployment guides
|-- CONTRIBUTING.md         Change workflow and review checklist
|-- sw.js                   Service worker and cache policy
|-- manifest.webmanifest    Installable app metadata
`-- .github/workflows/      Continuous verification
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run build:recipes` | Rebuild `data/recipes.json` from recipe source files. |
| `npm run check:recipes` | Fail when the generated recipe bundle is stale. |
| `npm run update:normalization-snapshot` | Record an intentionally reviewed grocery normalization catalog. |
| `npm run set-asset-version -- YYYYMMDD-N` | Synchronize CSS, JavaScript, and service-worker cache versions. |
| `npm run check:syntax` | Parse-check project JavaScript. |
| `npm run report:data-quality` | Print the advisory recipe and grocery data report. |
| `npm test` | Run the focused unit and integration tests. |
| `npm run verify` | Run syntax, bundle, test, and application-data checks. |
| `npm run smoke:browser` | Run the Chromium browser workflows against a local server. |
| `npm run verify:full` | Run the standard gate and browser smoke suite. |

`npm run report:data-quality -- --json` emits the report as JSON. The report is advisory; investigate parser failures and unknown units before treating a change as ready.

## Common Changes

### Recipes

Edit one file in `data/recipes/`, keep its filename equal to `<recipe-id>.json`, rebuild the bundle, and run verification. Recipe-only changes do not need an asset-version bump.

The [Recipe Schema](docs/recipe-schema.md) documents the full field contract, structured grocery quantities, tags versus ratings, collections, attribution, and normalization snapshot workflow.

### JavaScript, CSS, or App Shell

Keep domain logic in testable modules and browser behavior behind controllers or adapters. Changes to `index.html`, JavaScript, or CSS require a synchronized asset-version bump before verification.

The complete workflow, test expectations, naming rules, and PR checklist live in [Contributing](CONTRIBUTING.md).

### Deployment

Deploy the repository as one static revision over HTTPS. Correct MIME types, cache headers, security headers, service-worker scope, and atomic updates matter because the app has no server-side runtime to correct a partial deployment.

See [Deployment](docs/deployment.md) for the production hosting contract, release checks, rollback guidance, and post-deploy validation.

## Local State and Backups

Stored browser state includes:

- recipe selections, quantity multipliers, and grocery checkmarks;
- manual grocery items and collapsed grocery sections;
- the weekly meal plan and favorite recipes;
- search, collection, sort, filter, and mobile-view preferences;
- the keep-awake preference;
- confirmation and control-collapse preferences.

Use **Export backup** and **Import backup** in the Grocery List controls when moving devices or before clearing site data. Imports are validated, and grocery totals are recomputed against the current recipe data.

## Browser Verification

The browser smoke suite checks recipe loading, discovery controls, exports, sorting, meal planning, grocery interactions, Cooking Mode, and mobile navigation. It uses, in order:

1. `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, when set;
2. a common local Chrome, Edge, or Chromium installation on Windows, macOS, or Linux;
3. Playwright's managed Chromium, when installed.

`RECIPE_BOOK_SMOKE_PORT` overrides the default local smoke-test port. `RECIPE_BOOK_ALLOW_SMOKE_SKIP=1` permits an intentional prerequisite skip; never use it to hide a browser regression or in the normal CI gate.

## Detailed Guides

- [Contributing](CONTRIBUTING.md) — change workflows, verification, asset versions, and PR checklist.
- [Architecture](docs/architecture.md) — data flow, dependency boundaries, state, rendering, and offline design.
- [Recipe Schema](docs/recipe-schema.md) — recipe fields, grocery structure, normalization, and attribution.
- [Deployment](docs/deployment.md) — hosting, headers, caching, releases, rollbacks, and validation.

## License

This project is available for noncommercial use only.

- App code is licensed under the PolyForm Noncommercial License 1.0.0.
- Project-owned recipes, notes, documentation, and other non-software content are licensed under CC BY-NC-SA 4.0.
- Third-party recipe material remains owned by its original rights holders and is not relicensed by this project.

See [LICENSE.md](LICENSE.md) and [NOTICE](NOTICE) for the complete terms.
