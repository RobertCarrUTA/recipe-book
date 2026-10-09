# Independent offline release review

Reviewed the release implementation at `771d3873a78c9daea2f73bafcf1a10f47dfc30aa` and independently replayed both concrete failures against the fixed build from `9f9c1142565166ba92c28cd4a197c4aaa3dbba78` on 2026-10-08. The fixed build records `dirty: false`, asset version `20261008-6`, root base `/`, and release `e1538608c619b11dec3fa97d`. Browser: Windows Chromium `154.0.8037.99`; isolated synthetic storage, local HTTP server, actual historical application files from `3117d47`.

## Resolved findings

1. **Legacy navigation recovery before worker installation.** The original application could cache new HTML under the old worker's `index.html` entry. If the new worker download and entry assets both failed, repair inside the new worker's install handler could never run; the next offline reload displayed no recipes. With the fix, an explicitly observed worker HTTP 503 and two entry-asset HTTP 503 responses left the old root entry intact, repaired the old index entry, and rendered 24 legacy recipe cards offline without JavaScript errors. The inline bootstrap runs before the entry module and has an independently verified exact SHA-256 CSP authorization, with no `unsafe-inline` or `unsafe-eval` allowance.
2. **Degraded recognized recipe fields replacing last-good data.** An HTTP 200 collection with valid basic recipe fields but a free-text string in `groceryIngredients` previously replaced the cached catalog. The tolerant UI normalizer then dropped those entries, reducing the selected recipe's grocery list from 24 rows to zero. Replaying the same response against the fix preserved 24 structured entries in the returned response and cache, and 24 grocery rows after offline reload. The shared wire validator accepts the actual 128-recipe catalog, optional null metadata, and unknown additive fields while rejecting malformed structured groceries.

## New-state preservation and fallback wording

A separate independent browser check loaded the historical worker, adopted the new UI, saved a real recipe selection in version 7, explicitly failed the new worker download with HTTP 503, and reloaded offline. The older UI rendered its recovery notice. Checking a real older-UI recipe toggle and reloading did not alter the raw 719-byte version-7 snapshot: its SHA-256 hash was identical before the fallback, after the attempted older-UI edit, and after reload. The stored version remained `7`.

The visible notice states that the older version **cannot show or save newer changes**, that saved data is retained, and that reconnecting and reloading completes the update. It does not promise that the fallback displays the latest saved state. The screenshot was visually inspected.

## Scope and retained evidence

No remaining actionable finding was identified in the reviewed release consistency, canonical HTML/CSP, scoped cache repair/cleanup, explicit update handling, or staging allowlist. This is a local Chromium re-review, not a claim of independent hosted, cross-browser, or physical-device verification; the broader production lifecycle and CI suites provide separate evidence.

The exact original failure scripts, independent byte-preservation script, JSON reports, and screenshots were retained under the reviewing worktree's ignored `test-results/review/` directory as `legacy-worker-unavailable`, `degraded-recipe-cache`, and `v7-fallback-preservation`. No production source was changed during this review. This document preserves the findings and provenance without requiring those local artifacts to be committed.
