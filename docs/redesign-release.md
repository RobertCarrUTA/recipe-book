# Redesign release review

Parent [#168](https://github.com/RobertCarrUTA/recipe-book/issues/168); delivery [#174](https://github.com/RobertCarrUTA/recipe-book/issues/174). Production remains on main `3117d47b9cdd3a844d063fbde2ca6cd5ff3a83d2`. Human review of the final open dev→main PR is the release boundary. Final integration SHA, live preview verification and exact-head CI are recorded in #174 and that PR, avoiding a circular commit stamp in this document.

## Product and preserved behavior

React 19.3, TypeScript 6.0, Vite 8.3, Radix Dialog 1.2 and Lucide 1.53 provide a static app with custom Light/Dark/System themes, desktop navigation and reachable mobile navigation. Kitchen notebook was selected after comparing two working concepts. [Architecture/design rationale](redesign-architecture.md) records exact versions, alternatives and free licenses.

All 128 recipe source objects and their generated bundle are unchanged. Browsing retains collections, combined filters, sorting, favorites, selection, keyboard boundaries and progressive display. Recipe detail retains authored fields, sources, text/JSON exports, print and shopping multipliers. Groceries retain aggregation, source quantities, grouping, manual items, checking/hiding/clearing/deleting, formatted copy and search suffix. Weekly planning feeds repeated quantities into groceries. Cooking retains ingredients, progress, keyboard/swipe navigation and supported wake lock. Settings includes portable backups, validated restore and recovery notices. The [preservation matrix](preservation-matrix.md) maps these and less-visible contracts to tests.

Usability improvements include a compact grocery toolbar, visible mobile sorting, consistent nested-dialog return focus, immediate authoritative search state, print isolation, backup access during catalog failure and clipboard fallback. A final measured loading shift was reproduced and fixed without suppressing the offline warning.

## Preview access

No externally hosted preview was deployed. Available Sites tools exposed production publication rather than an isolated preview; no separately authorized preview-host configuration or credentials were present. Production Pages remains `main:/`. This is the explicitly permitted **local production-preview fallback**, on the shared Windows computer only, dependent on its server remaining running. It is not a public URL.

The final verified URL/build SHA are recorded in #174 and the release PR. Reproduce with Node >=22.12 and PowerShell:

```powershell
npm.cmd ci
npx.cmd playwright install chromium
$env:RECIPE_BOOK_BASE = '/recipe-book/'
npm.cmd run verify
npm.cmd run check:release
npm.cmd run preview -- --pages-404
```

Open <http://127.0.0.1:4183/recipe-book/>. On another computer, check out the final dev SHA and run there. `/recipe-book/build-info.json` identifies actual build source and dirty flag. External access would need an authorized isolated host. [Deployment](deployment.md) covers static paths, headers, Pages 404 behavior and output files.

## Evidence and limits

- [Before screenshots](evidence/baseline/README.md): original dark-only app at `3117d47`, 52 captures, measurements and baseline mobile pointer defect.
- [Current screenshot index](evidence/redesign-ui/README.md): 128 captures from clean application source `0ea4524`, all eight required sizes × both palettes × eight screens. Root inspected representative images covering every size and major screen. Independent review also covered the design.
- Linux CI compares 128 committed platform-specific visual baselines without automatic regeneration. Axe/overflow checks, keyboard focus, 320px reflow, intermediate widths, reduced motion and System changes supplement visual review. No physical-device, screen-reader or complete WCAG-conformance claim is made.
- [Performance comparisons](evidence/release-performance/README.md) include every critical journey and large recipe/grocery/planning fixtures, retained failure, explicit tradeoffs and reproducible budgets.

At version-10 application source, `npm run verify` passed 178 Node tests, 73 component cases, formatting, strict types, 128 recipes/391 grocery keys/zero warnings and build integrity. Local Chromium passed 70 cases; `npm run smoke:offline` passed 13 lifecycle scenarios. The complete configured browser gate is 72 Chromium cases and 56 each in Firefox/WebKit. Final CI must be read from the final head, not inferred from prior runs.

Two recipe-download checks are blocked on this Windows machine by an injected `Web of Trust.user.js` anchor-click hook; its stack was observed. They remain mandatory in Linux CI and passed there for PR #178. Backup download tests passed locally. Local Firefox cannot launch (`spawn UNKNOWN`), while Linux CI runs it. Local WebKit passed all 52 then-current pre-cutover behavior cases. No security software was disabled or bypassed.

## Review, security and recovery

Independent agents reviewed persistence, worker failures, workflows, design and the complete main→feature diff. Material findings were reproduced, fixed and protected: failed import/storage reads, snapshot/fence ordering, stale catalog requests, history/source routing, focus, wake-lock races, incomplete legacy-worker upgrades, malformed cached groceries, missing license text and initial loading shift. Last complete-diff and follow-up reviews had no material finding.

The [security review](redesign-security-review.md) documents input/URL handling, CSP, dependency/license checks and limits. Fresh production/all-dependency advisory audits reported zero vulnerabilities. Full notices for 29 runtime identities are generated, empty notices fail, and staged output contains the corrected supplementary MIT grant. This is not proof against unknown vulnerabilities or an exhaustive secret-history audit.

State uses one atomic v7 snapshot with an old-writer fence before adoption; portable v1 backups remain supported. Restore commits validated data before visible replacement. Failed, stale and future state is preserved; browser eviction and simultaneous last-writer races are not eliminated. [Migration/recovery](redesign-migration.md) explains these limits.

Offline builds use complete immutable scope-specific shells, validated recipe cache, explicit Refresh after saving pending changes, and retained old-tab assets. Thirteen scenarios exercise actual historical workers, failed new worker/chunks, root/subpath routes, update UI and preserved v7 bytes. See [independent review](redesign-offline-review.md) and [build contract](build-and-offline.md).

Rollback requires a complete release with a v7-compatible reader/writer. A Git revert to v6 cannot read current data; never lower the fence or clear site data. Keep a current portable backup. Tracked Pages artifacts record clean source commit plus hashes, and `check:release` reproduces every byte despite the necessary later artifact commit. A future human production merge needs real-origin CDN/cache/device verification. No production deployment was performed here.
