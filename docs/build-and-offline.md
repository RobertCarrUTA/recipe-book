# Built releases, offline behavior, and Pages cutover

The new application remains a static site. Vite builds `frontend/` into `dist/`;
`prepare-public.mjs` copies the generated recipes and essential public assets. The
finalizer records every output file and generates the worker from
`scripts/release-worker-template.js`. The root legacy application remains intact
until full workflow parity is accepted. Do not hand-edit generated workers.

## Commands

```powershell
npm.cmd ci
npm.cmd run build
node scripts/verify-build.mjs
node scripts/serve-build.mjs
```

The default preview is `http://127.0.0.1:4173/`. For the production subpath:

```powershell
$env:RECIPE_BOOK_BASE = '/recipe-book/'
npm.cmd run build
node scripts/verify-build.mjs
node scripts/serve-build.mjs --pages-404
```

The expected URL becomes `http://127.0.0.1:4173/recipe-book/`. `--pages-404`
models Pages' custom-404 response for first visits to direct recipe paths. Its
404 status is expected; the shell and relative-to-base assets still load. Once
controlled, navigation uses the cached release shell. Query and legacy hash
recipe links remain supported by the application route adapter.

Use `npm run set-asset-version -- YYYYMMDD-N --build` during migration, or the
same command without `--build` after root cutover. This writes `app-version.json`.
Rebuild and verify afterward. Vite content hashes and the finalized release ID
replace manually maintained module URL lists. Legacy mode remains available
while the old root entry point is present.

## Integrity and provenance

`build-info.json` contains the full checked-out `sourceCommit`, a dirty-source
flag, app version, base path, content hash, and release ID. A clean preview build
at the final integration commit identifies that exact commit. A dirty build is
explicitly labeled; it must not be presented as a clean commit artifact.

`release-manifest.json` lists all file hashes and byte lengths and the complete
shell precache. Every built chunk, stylesheet, theme initializer, icon, manifest,
and local notice is included. Recipe JSON is independent. The worker and release
manifest are not precached: the browser updates the worker independently, and
the manifest is a verification artifact. `verify-build.mjs` checks all bytes,
the complete file set, HTML fallback, local startup assets, base path, generated
worker configuration, and reproducible content hash. The finalizer canonicalizes
generated text assets and the worker template to LF line endings before hashing;
binary assets are preserved. This prevents Windows checkout line endings from
changing a release relative to Linux CI. Every canonical output byte is still
compared, with no asset exclusions.

## Offline lifecycle

Each release installs only after every shell response matches its SHA-256 hash.
The generated worker embeds the exact canonical HTML and creates its cached HTML
responses from those bytes. This binds the document and its CSP to the release's
bundle references without fetching a second, potentially transformed navigation
response. Other shell assets are fetched and verified. Local testing observed
AdGuard rewriting network HTML and injecting scripts even with `no-transform`;
its settings were not changed. Canonical HTML transport preserves the original
production CSP and the integrity check instead of accepting modified bytes.
Installation failure discards only that release's partial shell. Navigation and
shell assets are immutable cache-first within a release; network requests never
replace its HTML with a different release's HTML. Recipes use a separate
scope-specific schema-v1 cache and validated network-first requests, falling back
only to a previously validated nonempty collection with unique IDs, titles,
ingredients, instructions, and structured grocery entries. The wire validator
checks recognized optional field shapes and grocery quantities before replacing
the cache; a tolerant UI normalizer alone would silently discard malformed data.
Optional null values and additional fields remain compatible. If any recipe has
malformed recognized data, the entire incoming collection is rejected and the
previous complete collection remains available.

Cache names include the complete registration scope and use `rb-release-v1-`,
which also avoids the old worker's broad `recipe-book-` cleanup. New code does
not delete unrelated caches. Prior release shells remain available for existing
tabs and their chunks. Cleanup requires every controlled window to identify its
release; unknown or suspended windows cause conservative retention. Installing
and waiting releases also suspend pruning. A future
worker activation or client report can complete deferred cleanup.

The React `useOffline(flush)` hook registers only in a secure production context.
It exposes `updateReady`, `updating`, `error`, and `refresh()`. A waiting worker
stays waiting until the user chooses Refresh. The requesting tab flushes durable
state first; failed persistence prevents activation. Other tabs keep their views
and receive their own refresh opportunity. They are never force-reloaded.

Legacy workers kept their pristine scope-root HTML but overwrote cached
`index.html` on successful online navigation. Generated HTML therefore contains
a small recovery bootstrap before the application entry module. Its exact
SHA-256 hash is added to `script-src 'self'`; arbitrary inline scripts and eval
remain prohibited. This follows the browser's
[hash-source CSP mechanism](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).
An external recovery file would itself fail when new worker and asset downloads
are interrupted, so recovery must travel with the complete navigation response.
Build integrity checks require the exact bootstrap hash in the policy.

The bootstrap restores pristine HTML only in a recognized legacy shell cache
containing this exact registration scope's entries. Recovery therefore runs even
when `sw.js` cannot download or parse and its install handler never starts. The
worker also uses the same recovery function when a later install step fails.
An unavailable entry module shows a retry message; if an already-poisoned document
is opened offline, recovery can reload the repaired cached shell. Only entry-load
failure before the new app runs permits this automatic recovery reload. Normal
application updates still require the explicit Refresh action.

The restored older page displays an interrupted-update notice and directs the
user to reconnect and reload while retaining site data. If the newer app has
already migrated storage to v7, old v6 code cannot display the newer snapshot and
the version fence prevents it from overwriting that snapshot. The older page is
a temporary viewing fallback, not a current editable copy of v7 data. The new
snapshot is retained byte for byte through old-app interactions and reloads.
Completing the update restores the compatible reader. Legacy data and unrelated
cache contents are retained. Normal browser cache eviction and an uncached first
visit still require a connection.

## Existing GitHub Pages publishing contract

Read-only API inspection on 2026-10-08 confirmed `build_type: legacy`, source
`main:/`, and `https://robertcarruta.github.io/recipe-book/`. GitHub's official
[publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
requires explicitly enabling Actions publishing before using a custom build
workflow. Adding a deployment workflow alone is not a complete cutover.

The chosen no-settings-change strategy is reviewed, tracked root release
artifacts. After full parity and offline review, build from a clean source commit
with `/recipe-book/`, run all gates, then deliberately run:

```powershell
node scripts/stage-pages-release.mjs --stage
node scripts/check-staged-release.mjs
```

Staging copies only verified allowlisted outputs to the root and removes only
obsolete assets identified by the prior release manifest. It does not deploy,
commit, push, or change Pages settings. The final reviewed `dev` to `main` human
merge lets the existing Pages publisher serve those files. `.nojekyll` prevents
Jekyll from rewriting the bundle. Do not stage while the legacy UI still supplies
unmigrated capabilities, and do not publish from a feature branch.

Generated artifacts cannot embed the SHA of the later commit containing those
same artifacts without a circular self-reference. Tracked output therefore
records its explicit clean **source commit plus content hash**. The reproducibility
check rebuilds current source using only those provenance fields and compares
every generated byte/hash; it does not ignore chunks or arbitrary metadata.
Do not claim the embedded source SHA is the artifact-containing commit.

Rollback requires compatible state handling: version-7 storage fences version-6
writers. A code revert does not restore current user data. Preserve backups and
the current snapshot; release a compatible recovery reader rather than lowering
the fence. Service-worker rollback must itself be a complete new hashed release.

## Verification

`node scripts/smoke-offline-build.mjs` builds isolated fixture releases and runs
Chromium against loopback servers. It covers `/` and `/recipe-book/`, direct
navigation/back/reload, all shell entries, offline reload, explicit waiting-worker
activation, multiple tabs, malformed recipe responses, interrupted installation,
unavailable or invalid worker scripts alongside unavailable entry assets,
malformed structured grocery data, v7 snapshot retention during legacy fallback,
and upgrades from actual Git objects `3117d47` and `aec6001`. It also stages and
rebuilds an isolated Pages artifact fixture to prove byte-for-byte reproducibility
without replacing the checkout's root files. Fixture output and
synthetic browser data stay local. The result report records the browser version,
source commit, fixture commits, and scenario outcomes in
`test-results/offline-lifecycle.json`. This is browser emulation, not physical
device or hosted-production testing.

Worker unit regressions run with `npm test`; explicit refresh controller tests
run with `npx vitest run frontend/offline.test.ts`. Existing legacy integrity
tests remain until the integration cutover replaces them with built-output
checks. CI should run core verification, types, component tests, build integrity,
browser UI parity, and production lifecycle tests before the release is ready.
The lifecycle CI checkout must use `fetch-depth: 0` so both historical Git fixture
commits remain available. The staging allowlist includes the generated
`THIRD_PARTY_NOTICES.txt` dependency notices.
