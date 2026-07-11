# Contributing

This project favors a lightweight static architecture, explicit data files, and focused tests. Preserve those qualities unless a larger change clearly improves reliability or maintainability.

## Before You Change Anything

1. Install the locked dependencies with `npm ci`.
2. Run `npm run verify` to establish a clean baseline.
3. Read the guide for the area you are changing:
   - [Recipe Schema](docs/recipe-schema.md)
   - [Architecture](docs/architecture.md)
   - [Deployment](docs/deployment.md)
4. Keep unrelated work and generated noise out of the change.

On Windows PowerShell, use `npm.cmd` when execution policy blocks `npm`.

## Project Conventions

- Keep the app usable as static HTML, CSS, JavaScript, JSON, and a service worker.
- Prefer pure domain helpers, small browser adapters, and dependency injection over hidden global state.
- Keep source recipes in `data/recipes/*.json`, one recipe object per file.
- Treat `data/recipes.json` as generated output; never make an authored change there.
- Preserve stored-state migrations and backup compatibility when changing persistence.
- Add or update tests for behavior, data contracts, and failure paths affected by a change.
- Keep user-facing copy direct and modest.

## Recipe Changes

### Naming

Recipe IDs are simple dish-name slugs, and each filename must match its ID:

```text
data/recipes/chicken-fried-steak.json
"id": "chicken-fried-steak"
```

Keep titles and IDs literal. Do not add hype such as “ultimate,” “best,” “perfect,” “phenomenal,” “maximum flavor,” “restaurant-style,” or “from scratch” unless the requested recipe name explicitly uses that wording.

### Workflow

1. Add or edit the matching file in `data/recipes/`.
2. Assign at least one collection defined in `js/recipe_collections.js`.
3. Prefer structured `groceryIngredients` for every shopping item.
4. Rebuild the runtime bundle:

   ```bash
   npm run build:recipes
   ```

5. Review the advisory data report:

   ```bash
   npm run report:data-quality
   ```

6. Run `npm run verify`.
7. Commit both the source file and the regenerated `data/recipes.json`.

Recipe-only changes do not require an asset-version bump.

### Normalization Snapshot

`tests/fixtures/normalization_catalog_snapshot.json` records the expected canonical grocery labels and normalized units across the checked-in recipe bundle. A new recipe or an intentional grocery-label change can make its test fail.

When the catalog change is intentional:

```bash
npm run update:normalization-snapshot
```

Review the snapshot diff before accepting it. Confirm that specific shopping labels have not collapsed into vague ingredients, units normalize as expected, and unrelated entries did not change. Never refresh the snapshot merely to silence an unexplained failure.

The recipe field and grocery contracts are documented in [Recipe Schema](docs/recipe-schema.md).

## JavaScript and CSS Changes

Keep dependencies flowing toward explicit boundaries:

- models and normalization helpers should not depend on the DOM;
- controllers should translate events and browser APIs into model operations;
- renderers should build and synchronize DOM output;
- `js/app.js` should compose modules rather than accumulate domain rules.

When `index.html`, `css/styles.css`, `js/app.js`, an imported JavaScript module, or service-worker behavior changes, set a new asset version:

```bash
npm run set-asset-version -- YYYYMMDD-N
```

Use the current date and increment `N` for another app-shell change on the same date. The command synchronizes the HTML asset references, service-worker cache version, and generated shell URL list. Review both `index.html` and `sw.js` afterward.

Add focused tests near the affected responsibility. Browser-visible rendering, interaction, responsive behavior, or loading changes also require the browser smoke suite.

## Documentation Changes

Keep each fact in its durable home:

- `README.md` is the concise entry point and command index.
- `CONTRIBUTING.md` owns change workflow and review expectations.
- `docs/recipe-schema.md` owns recipe and grocery fields.
- `docs/architecture.md` owns boundaries and state flow.
- `docs/deployment.md` owns the hosting and release contract.

Documentation-only changes do not require a recipe build or asset-version bump. Check relative links and keep examples synchronized with actual commands.

## Verification Strategy

| Change | Minimum verification |
| --- | --- |
| Documentation only | Review rendered Markdown and links. |
| Recipe data | Rebuild recipes, review the data report, then `npm run verify`. |
| Pure model or utility | Add focused tests, then `npm run verify`. |
| Controller, renderer, HTML, or CSS | `npm run verify:full`. |
| Service worker, loading, or deployment behavior | `npm run verify:full` plus the relevant checks in the deployment guide. |

The standard gate parses JavaScript, confirms the recipe bundle is current, runs focused tests, and validates application data. The full gate adds Chromium browser workflows.

### Browser Smoke Configuration

The smoke runner recognizes:

| Variable | Meaning |
| --- | --- |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE` | Explicit Chromium, Chrome, or Edge executable path. |
| `RECIPE_BOOK_SMOKE_PORT` | Override the local server port used by the smoke run. |
| `RECIPE_BOOK_ALLOW_SMOKE_SKIP=1` | Allow a missing browser prerequisite to skip intentionally. |

The skip flag is for constrained local environments only. Do not set it in the normal CI gate or use it after a browser assertion fails.

## Pull Request Checklist

- [ ] The change has one clear purpose and avoids unrelated rewrites.
- [ ] Authored recipe edits are in `data/recipes/*.json`, not only in the generated bundle.
- [ ] Recipe filenames, IDs, collections, and naming follow the project rules.
- [ ] `data/recipes.json` was rebuilt after recipe changes.
- [ ] Any normalization snapshot update was intentional and its diff was reviewed.
- [ ] Runtime app-shell changes include a current asset-version bump.
- [ ] New or changed behavior has focused test coverage.
- [ ] `npm run verify` passes.
- [ ] `npm run smoke:browser` passes when UI, rendering, loading, or offline behavior changed.
- [ ] User, schema, architecture, or deployment documentation was updated when its contract changed.
- [ ] No local state, secrets, machine-specific paths, or generated test artifacts were committed.

## Licensing and Attribution

Only contribute material you have the right to share. Preserve recipe authorship and source links, distinguish project-authored notes from third-party material, and do not assume the project license grants rights to external recipe text or media.

See [LICENSE.md](LICENSE.md) for the code and content terms.
