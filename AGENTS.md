# Agent Notes

This is a static React/TypeScript recipe application built with Vite. Production
needs no application server. Edit source in `frontend/`, retained shared domain
modules in `js/`, and build scripts; root HTML, hashed assets, and `sw.js` are
reviewed generated release artifacts after cutover. The former DOM UI is retired;
keep historical fixtures only for compatibility tests. Verify locally and keep
domain behavior, data, backups, and offline upgrades intact.

## Recipe Naming

- Keep recipe titles and recipe ids literal and modest. Do not add hype words like "ultimate", "best", "perfect", "phenomenal", "maximum flavor", "restaurant-style", or "from scratch" to titles or ids unless the user explicitly asks for that exact wording.
- Use ids as simple slugs of the dish name, such as `chicken-fried-steak`. Let the ingredients, instructions, and results carry the quality.

## Recipe Data

- Edit recipe source files in `data/recipes/*.json`, one recipe object per file.
- Keep each source filename matched to its recipe id, such as `data/recipes/chicken-fried-steak.json` for `"id": "chicken-fried-steak"`.
- Do not hand-edit `data/recipes.json`; it is the generated runtime bundle. Run `npm run build:recipes` after recipe source changes.
- Preserve authored ingredients, instructions, identifiers, attribution, and license notices unless a requested recipe change specifically concerns them.

## Versions and Generated Artifacts

For application JavaScript/TypeScript, CSS, HTML, or worker changes, bump the build
version before finishing:

```bash
npm run set-asset-version -- YYYYMMDD-N
```

- Use the current date and increment `N` for further app changes that day.
- The command updates `app-version.json`; generated assets carry content hashes.
- Recipe-only source/bundle changes do not need an app-version bump. Recipes use independently validated network-first requests with a per-load cache key.
- Rebuild and run output integrity checks. Do not edit root HTML, hashed chunks, generated worker code, or cache inventories by hand.
- Stage reviewed release output with `npm run stage:release`; require `npm run check:release` to reproduce every artifact. Source commit and content hash are explicit provenance; do not pretend generated artifacts embed their own containing commit SHA.

## Verification

Run the full local gate after code or data changes:

```bash
npm run verify
```

This includes syntax, generated recipes, domain/data tests, types, component
tests, the production build, and `verify:build` integrity checks.

After user-facing UI, rendering, loading, routing, or offline changes, run:

```bash
npm run smoke:browser
```

The maintained browser gate combines modern Playwright journeys with production
offline lifecycle regressions, including actual historical worker fixtures.
Fetch full Git history in CI. Do not replace failed checks with skips, relax
budgets without an explicit reviewed reason, or claim device/assistive-technology
coverage that was not exercised. Keep failures and precise environment limits
visible in the release evidence.

Use `npm run build` and `npm run preview` for the production preview on port 4183.
Validate root and `/recipe-book/` paths; the development server does not establish
production offline behavior. On Windows PowerShell, use `npm.cmd` if needed.

## Data, Security, and Release Boundaries

- Keep persistence behind `js/storage.js`; stage and commit validated imports before replacing live state. Do not lower a storage-version fence or discard legacy recovery data to make a migration pass.
- Preserve the generated script CSP: self-hosted scripts plus the exact recovery-bootstrap hash. Do not add arbitrary inline-script or eval permissions, alter security software, or bypass a browser/platform restriction.
- Keep previews on a separate origin from real personal data. localStorage is origin-wide, not pathname-isolated.
- Preserve dependency and content licenses, including generated third-party notices. Essential startup assets must remain self-hosted.
- Use a focused feature branch and reviewed pull request. Merge only after relevant checks pass and the user has authorized the merge. Merging into `main` publishes through the existing Pages configuration; changes to production settings need their own authorization.

See [architecture](docs/architecture.md), [deployment](docs/deployment.md),
[build/offline](docs/build-and-offline.md), and
[migration/recovery](docs/data-recovery.md) for the maintained contracts.
