# Architecture

Recipe Book is a React and TypeScript browser application built with Vite. The
output is static HTML, CSS, JavaScript, JSON, and a service worker; hosting requires
no application server, database, accounts, or runtime secrets. Essential assets
are self-hosted. The [architecture decision](architecture-decisions.md) records the
stack comparison and design direction; this document describes the maintained
application after the root cutover.

## Source and generated output

```text
data/recipes/*.json -- build:recipes --> data/recipes.json
                                             |
frontend/ + shared js/ domain modules --------+-- Vite --> dist/
                                                        |
                                         finalizer: hashes, CSP, worker, 404
                                                        |
                                         reviewed stage:release --> root
```

Recipe files remain the authoring boundary. Edit one object per file, keep the
filename matched to its literal recipe ID, and regenerate the runtime bundle.
Never hand-edit generated recipes, hashed assets, root HTML, or the generated
worker. The root artifacts are reviewed output for the existing Pages publisher.

`frontend/main.tsx` composes the application. `frontend/App.tsx` owns the shell and
navigation; feature components implement browsing, recipe detail, groceries,
planning, cooking, and settings. Shared controls and Radix Dialog wrappers own
consistent keyboard, focus, dismissal, and accessible-name behavior. Semantic CSS
tokens provide Light, Dark, and System themes. The external theme initializer
runs before meaningful paint; React follows runtime system-preference changes.

The old DOM application and its stylesheet are retired at cutover. Twenty-one
shared JavaScript modules retain tested domain rules, storage, clipboard/export
behavior, nutrition formatting, and authoring quality checks. The typed
`frontend/domain.ts` adapter exposes those boundaries. Historical UI and worker
fixtures are loaded from fixed Git commits only for compatibility regressions.

## State and behavior

`frontend/store.tsx` owns observable state. React reads that state through
`useSyncExternalStore`; handlers update it before rendering or export. Domain
functions that mutate inputs receive a fresh durable-state copy. Filtering and
sorting operate on recipe data, independent of how many cards are rendered.

| Area | Ownership |
| --- | --- |
| Recipe catalog | Loaded JSON, validated at the cache boundary and normalized for the UI. |
| Durable state | Favorites, selections, multipliers, manual groceries, checks, meal plan, and UI preferences. |
| Derived state | Grocery totals, sources, discovery results, and display summaries. |
| Transient state | Open dialogs, current route, cooking step, loading, notifications, and errors. |

Grocery totals are recomputed from current recipes rather than trusted from a
backup. Recipe scaling affects shopping quantities; it does not rewrite authored
ingredients or instructions. The planner remains a Monday–Sunday template.

The route adapter preserves clean recipe paths, legacy hash links, browser
back/forward, and a configured deployment base. Optional clipboard, installation,
and Screen Wake Lock support must degrade without blocking core workflows.

## Durable data and backups

`js/storage.js` is the durable-state contract. Version 7 stores one serialized
snapshot with a revision; one `localStorage.setItem` is the commit point. Legacy
v1–v6 fields remain recovery material, and the version fence prevents v6 clients
from overwriting the newer snapshot. A failed write retains the prior snapshot.

Backup schema version 1 is separate from storage version 7. Imports validate and
commit before replacing live state. Future versions, stale tabs, unreadable
startup state, corrupt snapshots, oversized inputs, and malformed recognized
fields have explicit failure paths. Failed persistence keeps current work in
memory and makes backup recovery available. It never reports an unsuccessful
import as restored.

Storage is origin-wide, not isolated by pathname. Stale-tab detection is not a
cross-tab transaction lock; localStorage has no compare-and-swap operation.
Use a separate origin for preview data. See [migration and recovery](data-recovery.md)
for exact limits, portable backups, old-client behavior, and rollback procedures.

## Build, offline, and security boundaries

The finalizer inventories every production file, records its SHA-256 and byte
length, and generates a complete immutable release shell. It embeds canonical
HTML in the worker so a transformed navigation response cannot replace a
release's document or bundle references. Generated text uses canonical LF bytes
for Windows/Linux reproducibility.

Recipe data uses a separate scope-specific cache and validated network-first
requests. Malformed recognized fields, including structured grocery entries,
cannot replace the last valid collection. Shell assets never update individually
inside an active release. Cache cleanup retains releases needed by open tabs,
unknown clients, and installing or waiting workers; unrelated caches are kept.

`frontend/offline.ts` exposes the update state. A waiting worker activates only
after the user chooses Refresh and durable-state flushing succeeds. Other tabs
retain their views and receive their own refresh opportunity.

A small pre-entry recovery bootstrap repairs recognized legacy navigation
caches even if the new worker cannot download or parse. The production script
policy permits self-hosted scripts plus the exact bootstrap SHA-256 hash; it
does not permit arbitrary inline scripts or eval. An older fallback page explains
that it cannot show or save newer v7 data and directs the user to reconnect and
reload. That fallback does not replace the newer snapshot.

Recipe and manual text render as values, never executable HTML. Source URLs are
limited to HTTP(S), outbound links suppress opener/referrer access, and backup
input is bounded and validated before replacement. Asset hashes detect incomplete
or mismatched output; they are not signatures against a compromised publisher.
Preserve complete dependency notices; the notice generator rejects empty licenses.

See [build and offline details](build-and-offline.md) for the generated contracts,
failure regressions, CSP authorization, and complete update lifecycle. See
[deployment](deployment.md) for Pages staging and provenance.

## Verification and extension

Keep domain rules independently testable. Put browser APIs behind focused
adapters, expose stable accessible controls, and define migrations before adding
durable fields. Do not restore retired renderers to implement a new feature.

`npm run verify` covers syntax, recipe generation, domain tests, data checks,
types, component tests, the production build, and output integrity.
`npm run smoke:browser` covers modern Playwright journeys and production offline
lifecycle regressions. CI needs complete Git history for the historical worker
fixtures. Commands describe required gates; release-specific results belong in
the reviewed evidence and final PR.

Relevant guides: [preservation matrix](preservation-matrix.md),
[performance budgets](performance-budgets.md), [journey timings](performance-journeys.md),
and [archived redesign evidence](redesign-history.md).
Browser emulation and local lab measurements do not establish physical-device,
screen-reader, field-performance, or hosted-production behavior.
