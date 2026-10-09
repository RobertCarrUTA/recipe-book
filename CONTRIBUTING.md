# Contributing

This is a React/TypeScript application with a Vite build and static deployment.
Keep recipe authoring explicit, shared domain rules testable, and production
artifacts reproducible. The retired DOM application is retained only through
historical compatibility fixtures.

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

- Keep the built app deployable as static HTML, CSS, JavaScript, JSON, and a service worker, without an application server.
- Edit `frontend/`, retained shared `js/` modules, and build scripts. Do not hand-edit generated root HTML, hashed assets, or `sw.js`.
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
3. Provide nonempty structured `groceryIngredients` for shopping items. Malformed recognized fields cannot replace a valid offline catalog.
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

## Application and Build Changes

Keep dependencies flowing toward explicit boundaries:

- models and normalization helpers should not depend on the DOM;
- browser adapters should translate events and optional APIs into store operations;
- React components should render authoritative state through accessible controls;
- `frontend/store.tsx` should own state transitions, with shared domain behavior behind `frontend/domain.ts`;
- durable writes and backup validation should remain behind `js/storage.js`.

When application JavaScript/TypeScript, CSS, HTML, or worker behavior changes, set a new build version:

```bash
npm run set-asset-version -- YYYYMMDD-N
```

Use the current date and increment `N` for another app change that day. The
command updates `app-version.json`. Rebuild and run `verify:build`. Content
hashes and the generated release inventory replace manual module lists and
asset-query synchronization.

Do not change the generated script CSP to accommodate a convenience script.
Self-hosted startup code and the exact SHA-authorized recovery bootstrap are the
allowed script boundary; arbitrary inline scripts and eval remain prohibited.
Keep licenses and generated dependency notices with the deployed artifact.

Add focused tests near the affected responsibility. Browser-visible rendering, interaction, responsive behavior, or loading changes also require the browser smoke suite.

## Documentation Changes

Keep each fact in its durable home:

- `README.md` is the concise entry point and command index.
- `CONTRIBUTING.md` owns change workflow and review expectations.
- `docs/recipe-schema.md` owns recipe and grocery fields.
- `docs/architecture.md` owns boundaries and state flow.
- `docs/deployment.md` owns the hosting and release contract.
- `docs/build-and-offline.md` owns release integrity, worker updates, and interrupted-upgrade recovery.
- `docs/data-recovery.md` owns storage/backup compatibility and rollback limits.
- Pull requests and CI artifacts record measured results, exact metadata, and test limitations; generated screenshots and reports belong in ignored `test-results/`.
- `tests/e2e/__snapshots__/` owns reviewed visual regression expectations. These are test inputs, not disposable screenshots.
- `docs/redesign-history.md` links the archived one-time redesign evidence.

Documentation-only changes do not require a recipe build or asset-version bump. Check relative links and keep examples synchronized with actual commands.

## Verification Strategy

| Change | Minimum verification |
| --- | --- |
| Documentation only | Review rendered Markdown and links. |
| Recipe data | Rebuild recipes, review the data report, then `npm run verify`. |
| Pure model or utility | Add focused tests, then `npm run verify`. |
| Component, store, browser adapter, HTML, or CSS | `npm run verify:full`. |
| Service worker, loading, or deployment behavior | `npm run verify:full` plus the relevant checks in the deployment guide. |

The standard gate checks syntax, generated recipes, domain/data contracts,
TypeScript, component interactions, the production build, and output integrity.
The full gate adds modern Playwright journeys and the production offline suite.
Use the relevant visual, accessibility, cross-browser, migration, and performance
checks when their behavior changes. Record actual results rather than treating
these instructions as evidence that a release passed.

### Browser Smoke Configuration

Install a browser executable after `npm ci`, before running browser gates:

```bash
npx playwright install chromium
```

On Linux, use `npx playwright install --with-deps chromium` to install required
system libraries too. `npm ci` installs the runner, not its browser binaries.
The local executable helper can use an existing Chrome/Edge installation or
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`. For the optional cross-browser projects, also
run `npx playwright install firefox webkit` (add `--with-deps` on Linux), then
enable `CROSS_BROWSER=1`. Use `npx.cmd` on Windows if execution policy requires it.

The modern Playwright runner supports:

| Variable | Meaning |
| --- | --- |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE` | Explicit local Chromium, Chrome, or Edge path used by the executable helper. |
| `RECIPE_BOOK_TEST_PORT` | Override the local Playwright server port. |
| `RECIPE_BOOK_TEST_URL` | Test an explicitly provided local built-app URL. |
| `CROSS_BROWSER=1` | Include configured Firefox and WebKit projects. |
| `RECIPE_BOOK_REPORT` | Override the Playwright JSON report path. |

Install the required Playwright browsers for the selected projects. The offline
lifecycle runner uses isolated ephemeral ports and actual Git fixtures; CI needs
`fetch-depth: 0`. Missing prerequisites and failed assertions must remain visible,
not become silent skips. Keep traces and failure evidence; do not blindly replace
visual baselines or relax performance budgets.

## Reviewed Release Output

Build from clean reviewed source with `RECIPE_BOOK_BASE=/recipe-book/` for Pages.
After parity and offline gates, `npm run stage:release` copies verified generated
output to the root; `npm run check:release` reproduces and compares every artifact.
Review that diff before committing. Staging neither publishes nor changes Pages
settings. The source commit and content hash identify tracked output; the later
artifact-containing commit cannot embed its own SHA.

Use a focused branch and pull request; merge after review and passing checks.
Merging into `main` publishes through the existing Pages configuration. Keep
production setting changes explicit and separately reviewed. The local production
preview runs with `npm run preview` on port 4183; preview results must identify
the actual tested commit and URL. See
[Deployment](docs/deployment.md) for the complete release and rollback contract.

## Pull Request Checklist

- [ ] The change has one clear purpose and avoids unrelated rewrites.
- [ ] Authored recipe edits are in `data/recipes/*.json`, not only in the generated bundle.
- [ ] Recipe filenames, IDs, collections, and naming follow the project rules.
- [ ] `data/recipes.json` was rebuilt after recipe changes.
- [ ] Any normalization snapshot update was intentional and its diff was reviewed.
- [ ] Application or worker changes include a current build-version bump and verified generated output.
- [ ] New or changed behavior has focused test coverage.
- [ ] `npm run verify` passes.
- [ ] `npm run smoke:browser` passes when UI, rendering, loading, or offline behavior changed.
- [ ] Staged release artifacts pass `npm run check:release`, when the change includes release output.
- [ ] User, schema, architecture, or deployment documentation was updated when its contract changed.
- [ ] No local state, secrets, machine-specific paths, or generated test artifacts were committed.

## Licensing and Attribution

Only contribute material you have the right to share. Preserve recipe authorship and source links, distinguish project-authored notes from third-party material, and do not assume the project license grants rights to external recipe text or media.

See [LICENSE.md](LICENSE.md) and [NOTICE](NOTICE) for the code and content terms.
Preserve the generated `THIRD_PARTY_NOTICES.txt` for included dependency licenses.
