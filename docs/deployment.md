# Deployment

Recipe Book deploys as a complete static build. Node.js is build tooling only;
production needs HTTPS and correct file responses, with no application server,
database, credentials, or runtime environment configuration.

## Existing Pages contract

Read-only inspection confirmed GitHub Pages publishes `main:/` at
<https://robertcarruta.github.io/recipe-book/>. The redesign preserves that source:
reviewed generated files are tracked at the repository root. A later human merge
of the final `dev` → `main` PR lets the existing publisher serve the built app.
No production settings change or production publication is part of the redesign.

Adding an Actions deployment workflow alone does not switch a branch-based
Pages site to Actions publishing. See GitHub's
[publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
The chosen staging contract is detailed in [build and offline](build-and-offline.md).

## Build and local preview

Use Node.js >=22.12 and the committed lockfile:

```bash
npm ci
npm run verify
npx playwright install chromium
npm run smoke:browser
npm run preview
```

The maintained preview command serves `dist/` with the production server helper
at <http://127.0.0.1:4183/>. It is a local preview, not public hosting. The browser
executable is a separate prerequisite; on Linux use
`npx playwright install --with-deps chromium`. On Windows, use `npm.cmd` and
`npx.cmd` when needed. To model the production path:

```powershell
$env:RECIPE_BOOK_BASE = '/recipe-book/'
npm.cmd run build
npm.cmd run verify:build
npm.cmd run preview -- --pages-404
```

Open <http://127.0.0.1:4183/recipe-book/>. The configured base determines every
startup asset, recipe request, and worker scope. A first direct recipe navigation
through Pages' `404.html` may have HTTP status 404 while successfully loading the
app. Missing assets must remain real failures instead of returning HTML.

The authorized Sites capability available during this work provides production
publication, not an isolated preview facility. It was not used to publish this
redesign. The permitted fallback is a locally served production build tied to
the reviewed commit. The [#174 delivery record](https://github.com/RobertCarrUTA/recipe-book/issues/174)
and [execution record](redesign-state.md) own the final tested URL, commit and
browser evidence; that current live-preview check remains pending.
Use a separate origin for synthetic preview state because localStorage is
origin-wide.

## Complete release artifact

The publishable set is the finalized `dist/` directory, including:

```text
index.html, 404.html, .nojekyll
assets/                      content-hashed JavaScript and CSS
data/recipes.json             independently refreshed recipe catalog
icons/, manifest.webmanifest, theme-init.js
sw.js, build-info.json, release-manifest.json
LICENSE.md, NOTICE, THIRD_PARTY_NOTICES.txt
```

Never edit these generated files independently. `verify:build` checks every file,
hash, byte length, startup reference, deployment base, fallback HTML, CSP, and
complete precache inventory. `build-info.json` records the full source commit,
dirty-source flag, app version, content hash, and release identity.

Do not publish `.git/`, dependencies, personal backups, private editor state, or
test output. Authored recipes and deployed application files are public; personal
grocery, plan, and preference state remains in the browser.

## Versioning, staging, and reproducibility

1. Change source under `frontend/`, shared `js/`, or build scripts. For recipe
   changes, edit `data/recipes/*.json` and run `npm run build:recipes`.
2. For app, CSS, HTML, or worker changes, run
   `npm run set-asset-version -- YYYYMMDD-N` using the current date and next suffix.
   This updates `app-version.json`.
   Recipe-only changes do not require an app-version bump.
3. Commit the reviewed source, then build a clean checkout with
   `RECIPE_BOOK_BASE=/recipe-book/`. Run `verify`, `smoke:browser`, and the relevant
   accessibility, visual, performance, and migration checks for that revision.
4. After full parity and offline review, run `npm run stage:release`, then
   `npm run check:release`. Staging copies only allowlisted verified artifacts and
   removes only obsolete generated chunks listed in the previous manifest.
5. Review and commit the resulting root artifact diff. Re-run the reproducibility
   gate in CI. Leave the final `dev` → `main` PR open for human review and merge.

Staging does not deploy, push, or change Pages settings. The artifact-containing
commit cannot embed its own SHA without a circular reference: tracked output
records the clean **source commit plus content hash**. `check:release` rebuilds
current source with those explicit provenance fields and compares all artifact
bytes. Only those stamp fields are pinned; no chunks or arbitrary metadata are
ignored. A clean local preview built at the final integration commit can record
that exact integration SHA separately.

## Hosting and browser policy

Serve HTML as `text/html`, JavaScript as `text/javascript`, CSS as `text/css`, JSON
as `application/json`, the web manifest as `application/manifest+json`, and SVG
as `image/svg+xml`. UTF-8 and compression are appropriate for textual assets.
Keep all essential runtime resources on the same origin.

Where a host supports configurable headers, revalidate HTML, the worker, recipe
JSON, and stable-name metadata. Content-hashed `assets/` files can use a long
immutable HTTP lifetime. GitHub Pages' host headers are platform-controlled;
do not represent recommended headers as a configuration already applied there.

Use the emitted CSP, including its exact recovery-bootstrap hash. Do not replace
it with a generic `script-src 'self'` header that blocks recovery, and do not add
script `unsafe-inline` or `unsafe-eval`. The generated policy restricts startup
resources to self, blocks objects and base URLs, and retains the existing style
allowance required by the UI. The build check verifies the exact script policy.
Additional `nosniff`, referrer, permissions, and framing headers can be reviewed
on hosts that support them; `frame-ancestors` cannot be enforced by a meta tag.

Offline shell caches are immutable and scope-specific. Recipe requests are
validated network-first. Updates wait for a user Refresh and a successful state
flush; open tabs retain their needed release assets. The recovery bootstrap
protects old cached apps when the new worker or bundles are unavailable. These
mechanics and their limits are documented in [build and offline](build-and-offline.md).

## Release evidence and recovery

Offline integration and generated root cutover (#173) merged through
[PR #178](https://github.com/RobertCarrUTA/recipe-book/pull/178) into dev
`af08710a726af8e24fb34807d890c8f8daa2cd19`. [CI 37869671954](https://github.com/RobertCarrUTA/recipe-book/actions/runs/37869671954)
passed all three jobs at PR head `971b195ae49efaa475e24e13edb046af188d463f`:
Ubuntu/Windows core checks and tracked-release reproduction, Ubuntu browser and
offline lifecycle checks, and Firefox/WebKit journeys. That tracked artifact
records clean source `f9b7ea9e48684cd202d8fbb37e355aceec8d8425`, version
`20261008-9`, base `/recipe-book/`, and release `a4146a26e10f472179471217`;
the source and artifact-containing commits are intentionally distinct.

[Final delivery #174](https://github.com/RobertCarrUTA/recipe-book/issues/174)
still owns the current live preview, final release PR and verification of any
subsequent changes. Supplemental journey performance and the initial
offline-error/loading layout shift remain under investigation. Follow the
[execution record](redesign-state.md) for current status; successful #173 CI
does not establish final readiness or production deployment.

Check direct recipe links, back/refresh, theme initialization, exports/imports,
worker scope, waiting updates, interrupted installs, and offline reload at both
`/` and `/recipe-book/`. The offline suite has thirteen lifecycle scenarios and
uses actual `3117d47` and `aec6001` worker fixtures; CI must fetch full Git history.
Modern Playwright coverage and [performance budgets](performance-budgets.md)
complement those checks. Record actual runs and remaining limitations in the
[UI](evidence/redesign-ui/README.md) and
[performance](evidence/redesign-performance/README.md) evidence, not as assumed
successes in this procedure.

After a future human production release, verify the real public origin as well.
Local and CI tests cannot prove its final CDN headers, cache state, or device
behavior. Cache Storage can be evicted, and an uncached first visit needs a
connection.

A rollback must be another complete, verified release with compatible data
handling. v6 code cannot read the current v7 snapshot; its retained legacy fields
are only pre-migration recovery data. Do not lower the fence, delete the snapshot,
or assume a Git revert restores current user data. Export a current backup and
test a compatible recovery reader. See [migration and recovery](redesign-migration.md).
