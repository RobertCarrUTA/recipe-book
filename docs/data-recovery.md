# Data migration and recovery

Recipe Book keeps personal data in the browser and authored recipes in `data/recipes/*.json`, with `data/recipes.json` generated for reading. It has no account, server database or synchronization service. This document describes the maintained storage and backup contracts; [redesign history](redesign-history.md) records their introduction and release.

## Durable state and migration

| Boundary | Contract |
| --- | --- |
| Authoritative personal state | `localStorage.offline_recipebook_state_snapshot`: one JSON object `{storageVersion: 7, revision, data}`. `revision` is an opaque change token, not a merge clock. |
| Complete snapshot data | `favoriteRecipeIds`, `selectedRecipeIds`, `recipeMultipliersById`, `groceryCheckedByKey`, `manualGroceryItemsById`, `mealPlan`, `ui`. All seven fields are required in a stored v7 snapshot. Derived grocery totals/sources are recomputed from current recipes. |
| Old-client fence | `offline_recipebook_storage_version` is set to `7` **before** adopting the snapshot. Baseline v6 clients see a newer version and refuse persistence. |
| Legacy recovery source | Existing per-field keys listed in `js/storage.js:storageKeys` are retained, including selections, favorites, quantities, manual items, checks, meal plan and preferences. They are not continuously updated after v7 adoption. |
| Theme preference | `offline_recipebook_theme_v1` stores `light`, `dark` or `system` for the blocking prepaint initializer. Backup `ui.theme` carries the current theme between browsers. Denied theme storage falls back to System at startup; a session-only choice remains usable and is reported. |

On a successful restore, `js/storage.js` reads and validates the snapshot first. With no snapshot, it reads the legacy keys, preserves legacy quantities, normalizes a complete state, writes the version fence, then commits the snapshot with one `setItem`. The snapshot write is the complete-state commit point: it cannot leave favorites from one save and a grocery list from another. Quota failure leaves the previous snapshot intact.

The fence and snapshot are two ordered writes. Interruption after the fence can leave version `7` with no snapshot; the v7 reader retries from retained legacy fields. Old v6 writers remain blocked during that interval. Do not lower the fence or delete the legacy fields to “finish” migration.

Stored snapshots with malformed/missing fields or future versions are preserved and ordinary writes are blocked. If startup cannot read storage, later successful reads alone do not authorize saving startup defaults over it: a successful restore/reload or explicit valid import is required. The UI warns immediately, allows work in memory, and offers backup export. Any displayed legacy/default fallback may be older than the inaccessible snapshot; exporting it does not recover bytes the app could not read.

## Portable backup and restore

Portable backups retain `app: "robert-recipe-book"` and `schemaVersion: 1`, independently of internal storage version 7. Exports include `storageVersion`, `exportedAt` and the seven data fields. Older schema-v1 backups remain accepted when their recognized fields are valid. A portable backup may contain partial `data` (including `{}`); a missing, non-object or malformed `data` field is rejected. This compatibility does **not** permit incomplete authoritative v7 snapshots.

The file input checks size before reading; parsing and structural validation finish before the replacement confirmation. Limits are 2 MiB of UTF-8 JSON, depth 12, 50,000 visited nodes, 5,000 entries per object/array, 20,000 characters per string and 1,000 per key. Unsafe prototype-related keys are rejected. Recognized records, quantities, plan arrays, filters and preference types are checked; unsupported future versions are rejected. Bounded additive UI preferences survive normalization so a new theme/view preference does not break v1 portability.

After confirmation, Settings constructs the candidate state, prunes IDs absent from the loaded catalog, recomputes groceries, and calls `commitRestoredPersistentState` **before** changing live state. Only a successful durable commit cancels the queued save and replaces live state. A failed commit reports failure and retains the preceding live/durable data; it never announces a successful restore. A validated explicit import may repair a corrupt snapshot, but cannot overwrite future-version state or bypass a detected change from another tab.

Export reads the current in-memory state, including the latest search before its scheduled save. It remains available while recipe loading fails. Import waits for successful catalog loading because pruning against an empty/unavailable catalog would discard valid IDs. Imported theme is applied after a successful data commit.

## Tabs, save failures and recovery

The store updates UI immediately and schedules persistence after 180 ms; it flushes on page hide/hidden visibility. A save failure keeps unsaved state in that tab and presents a backup action. Snapshot/version storage events warn when another tab changes durable state. The storage layer compares the last observed serialized snapshot with the current bytes and refuses a stale write.

This is **not transactional multi-tab synchronization**. There is no lock, compare-and-swap primitive, automatic merge or conflict history. Two tabs that both pass the byte check before either writes can still race; the last complete snapshot wins. Theme has its own preference key and does not trigger a personal-data conflict. Prefer one editing tab; if a conflict appears, export any unsaved work before reloading to read the latest durable state.

| Situation | Safe next step |
| --- | --- |
| Quota or denied storage | Export the current visible state while the tab is open. Restore storage availability, then retry/reload after keeping that copy. Browser eviction or site-data deletion is not recoverable without a backup. |
| Another tab changed data | Export this tab's unsaved work, reload to read current durable state, then intentionally choose which backup to restore. There is no automatic combination. |
| Corrupt saved snapshot | Keep site data; use a known-good portable backup for explicit recovery. A legacy/default fallback is not necessarily current. |
| Future storage/backup version | Use a compatible newer reader. Do not remove the version marker or force an old writer to run. |
| Catalog unavailable | Export still works. Reconnect/retry before importing so current recipe IDs can be validated. |

Preview must use a separate **origin**, not merely another pathname. These localStorage keys are origin-wide, and visiting a preview on the production origin can migrate or conflict with production state. Cache Storage/service workers are separate from personal state: deleting worker caches is not a data migration, and clearing all site data deletes personal state too.

## Interrupted offline updates and rollback

The integrated worker builds immutable, verified release shells and retains a separately validated recipe-data cache. Normal updates wait for explicit Refresh; the requesting tab flushes first, and failed persistence blocks activation. Other tabs are not force-reloaded. See [build and offline](build-and-offline.md) for the build, scope and cache contracts.

An interrupted upgrade from an actual legacy worker can have cached new HTML without its complete assets. The #173 recovery bootstrap repairs only recognized legacy caches for the matching worker scope, restoring the pristine old shell with an interrupted-update notice. Entry-module failure before the new app starts may trigger that recovery reload; this does not change the explicit-refresh rule for a running new app. The notice asks users to reconnect/reload and retain site data.

**An old v6 page is only a temporary fallback, not a current editable copy of v7 data.** It cannot read the latest snapshot, and its version guard prevents saving over it. Old visible values or an apparent in-memory interaction must not be mistaken for a durable current change. Retained legacy keys describe pre-migration recovery state; they are not a mirror of recent v7 edits. Completing the update restores the compatible reader and the latest snapshot.

A code revert therefore cannot roll back personal data. A safe rollback is another complete release with a v7-compatible reader/writer and a new release identity. Preserve the current snapshot and backups; never lower the fence, clear site data, or assume old multi-key values are current. Portable schema-v1 continuity also does not guarantee that an old v6 UI can safely write on an origin already migrated to v7.

## Protecting checks

- `tests/storage.test.mjs` and `storage_atomic.test.mjs` cover version fencing with a baseline-v6 fixture, legacy quantities, complete commits, interrupted migration, corrupt/future state, failed initial reads, validation and stale tabs. `tests/fixtures/legacy_v6_storage.mjs` remains after the obsolete UI source removal.
- `tests/e2e/data-recovery.spec.ts` exercises actual downloads/import, immediate export/reload, pending-save cancellation, malformed/oversized backups, quota failures, denied/recovered reads and multiple tabs. Component tests protect startup warnings and theme/storage-event separation.
- #173 worker/controller/build tests and `scripts/smoke-offline-build.mjs` cover complete shells, failed installs, explicit refresh, root/subpath navigation, old-tab assets, malformed recipe fallback and upgrades from actual Git commits `3117d47b9cdd3a844d063fbde2ca6cd5ff3a83d2` and `aec600142706c90f72ad52bcb97a32ee0555de3f`. Lifecycle CI needs those historical objects (`fetch-depth: 0` or explicit fetch); obsolete current-tree UI files are not needed to reconstruct them.

The [preservation matrix](preservation-matrix.md) maps the maintained contracts to tests. Run the relevant gates for each change and record actual results in its PR; earlier passing runs do not establish current production-origin behavior. See [deployment](deployment.md#release-evidence-and-recovery) for release checks.
