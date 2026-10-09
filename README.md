# Robert's Recipe Book and Grocery List

A static recipe application for browsing, weekly planning, focused cooking, and
grocery-list building. React and TypeScript provide the interface; Vite produces
self-hosted static files. Tested recipe and grocery domain modules remain shared
behind a typed boundary. There is no application server, account system,
analytics, advertising, or cloud synchronization.

## Features and privacy

- Browse by collection, search, status, rating, difficulty, equipment, favorites,
  and grocery selection; sort by the existing recipe criteria.
- Plan a Monday–Sunday week and turn repeated recipes into grocery quantities.
- Combine structured ingredients, unit conversions, recipe multipliers, and
  manual items in grouped, checkable shopping lists with source tracing.
- Read recipe detail and use focused Cooking Mode, keyboard controls, and
  optional Screen Wake Lock.
- Choose Light, Dark, or System appearance on desktop, tablet, and mobile.
- Export recipes and import/export portable backups in **Settings & data**.
- Reopen a complete cached release offline; choose when to refresh an update.

Favorites, plans, groceries, and preferences stay in browser `localStorage`.
Backups are the portable copy; clearing site data removes the local copy. Every
deployed recipe and application file is public. Optional clipboard, installation,
and wake-lock support varies by browser and must not block core workflows.

The fifteen individually reviewed recipes remain available in **Health-conscious**
and **Meal-prep friendly** collections. See the
[editorial criteria](docs/recipe-schema.md#editorial-collections); other recipes
have not been assessed.

## Start locally

Use Node.js >=22.12, npm, and an evergreen browser. Install the locked tools:

```bash
npm ci
npm run dev
```

Use the URL printed by Vite for development. For the built application:

```bash
npm run verify
npx playwright install chromium
npm run smoke:browser
npm run preview
```

The production preview serves `dist/` at <http://127.0.0.1:4183/> by default.
Use HTTP/HTTPS, not `file://`. On Windows PowerShell, use `npm.cmd` if execution
policy blocks `npm` (and `npx.cmd` for `npx`). The browser install supplies the
executable; `npm ci` alone does not. On Linux use
`npx playwright install --with-deps chromium` to include system libraries. The
local runner can also use an existing Chrome/Edge installation or an explicit
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Service-worker behavior is verified against the
production build rather than the development server.

## Project layout

```text
frontend/                  React components, store, themes, and browser adapters
js/                        Retained domain, storage, formatting, and export modules
data/recipes/              Authoritative recipe source files
data/recipes.json          Generated runtime recipe bundle
public/                    Self-hosted build inputs
scripts/                   Generation, verification, release, and browser tools
tests/                     Domain contracts and Playwright journeys
docs/                      Architecture, recipe schema, recovery, and test guides
dist/                      Ignored production build
index.html, assets/, sw.js  Reviewed generated Pages release
```

The former DOM application was retired during root cutover. Historical code remains
available through fixed Git fixtures for upgrade tests; it is not a second UI
to maintain. Root HTML, hashed assets, and the worker are generated output.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Vite development server. |
| `npm run build` | Produce a complete, stamped static release in `dist/`. |
| `npm run preview` | Serve the built release locally on port 4183. |
| `npm run build:recipes` | Regenerate the runtime catalog from recipe files. |
| `npm run check:recipes` | Fail when the generated catalog is stale. |
| `npm run update:normalization-snapshot` | Record an intentionally reviewed grocery normalization catalog. |
| `npm run set-asset-version -- YYYYMMDD-N` | Update build metadata before rebuilding app changes. |
| `npm run report:data-quality` | Print the advisory recipe/grocery report; add `-- --json` for JSON. |
| `npm test` | Run shared domain, persistence, build, and worker regressions. |
| `npm run test:components` | Run React component interaction tests. |
| `npm run verify` | Check syntax, recipes, domain/data contracts, types, components, build, and output integrity. |
| `npm run smoke:browser` | Run modern Playwright journeys and production offline lifecycle checks. |
| `npm run verify:full` | Run verification and browser gates together. |
| `npm run stage:release` | Copy verified Pages artifacts into the working tree for review. |
| `npm run check:release` | Rebuild and compare every tracked production artifact. |

Record actual check results and remaining gaps in the pull request. Do not skip browser
gates or treat development-server behavior as production offline verification.

## Recipe and application changes

Edit one object per `data/recipes/*.json` file. Keep the filename equal to the
recipe ID, preserve literal and modest dish names, and run `npm run build:recipes`.
Never hand-edit `data/recipes.json`. Recipe-only changes do not require an app
version bump, but still require regeneration, verification, and a complete
release artifact when publishing. The [recipe schema](docs/recipe-schema.md)
covers grocery quantities, collections, tags, attribution, and normalization.

Edit application source under `frontend/` and retained shared modules. For app,
CSS, shell, or worker changes, increment the current-date version in
`app-version.json` through `set-asset-version`, then rebuild and verify. Do not
hand-edit generated HTML or worker inventories.

Persistence uses an atomic v7 snapshot and compatible schema-v1 backups. Imports
validate and commit before replacing live state. Storage errors, stale tabs, and
future versions require explicit recovery rather than silently overwriting
existing data. See [migration and recovery](docs/data-recovery.md).

## Deployment and documentation

GitHub Pages publishes reviewed generated root artifacts from `main:/` at
[Robert's Recipe Book](https://robertcarruta.github.io/recipe-book/). The redesign
merged in [PR #180](https://github.com/RobertCarrUTA/recipe-book/pull/180).
See [deployment](docs/deployment.md) for base paths, release staging,
reproducibility, local previews, and recovery.

- [Architecture](docs/architecture.md) — state, component/domain boundaries, security, and offline design.
- [Build and offline](docs/build-and-offline.md) — complete release caches, explicit refresh, interrupted upgrades, and CSP.
- [Contributing](CONTRIBUTING.md) and [agent notes](AGENTS.md) — authoring and change conventions.
- [Preservation matrix](docs/preservation-matrix.md) — capability contracts and protecting checks.
- [Performance budgets](docs/performance-budgets.md) and [journey timings](docs/performance-journeys.md) — repeatable measurement methods and limitations.
- [Redesign history](docs/redesign-history.md) — merged release, design decisions, and archived review evidence.

Browser emulation, automated accessibility checks, and local timing measurements
do not establish physical-device, screen-reader, hosted-network, or field results.

## License

This project is available for noncommercial use only.

- App code is licensed under the PolyForm Noncommercial License 1.0.0.
- Project-owned recipes, notes, documentation, and other non-software content are licensed under CC BY-NC-SA 4.0.
- Third-party recipe material remains owned by its original rights holders and is not relicensed by this project.

See [LICENSE.md](LICENSE.md) and [NOTICE](NOTICE) for the complete terms. Preserve
the generated `THIRD_PARTY_NOTICES.txt` dependency notices in production artifacts.
