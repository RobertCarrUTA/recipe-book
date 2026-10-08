# Redesign execution record

Parent: [#168](https://github.com/RobertCarrUTA/recipe-book/issues/168). The implementation is **in progress**, not release-ready. Production has not been changed.

## Safe integration boundary

- Baseline and latest observed `main`: `3117d47b9cdd3a844d063fbde2ca6cd5ff3a83d2` (2026-10-08).
- `dev` created and published at that baseline. Final delivery must be one open, unmerged `dev` → `main` PR with automatic merging disabled.
- Original checkout was clean on the earlier `codex/166-recipe-controls-scroll-position` branch; left untouched. Work uses isolated Git worktrees.
- Active baseline branch: `codex/169-baseline-architecture`; independent storage branch: `codex/172-data-safety`.
- Production Pages is legacy branch deployment from `main:/`. Only `verify.yml` is present on audited main. Feature/dev pushes do not publish production.
- Main protection enforces admins and prevents force pushes/deletion, but requires zero approvals and has no required status checks. No protections were changed. Repository auto-merge is disabled.

## Work map

| Issue | Work | Current state |
| --- | --- | --- |
| [#169](https://github.com/RobertCarrUTA/recipe-book/issues/169) | Baseline, preservation, architecture, two concepts | In progress |
| [#170](https://github.com/RobertCarrUTA/recipe-book/issues/170), existing [#142](https://github.com/RobertCarrUTA/recipe-book/issues/142) | Frontend, navigation, themes, recipe workflows, state ownership | Pending baseline |
| [#171](https://github.com/RobertCarrUTA/recipe-book/issues/171) | Groceries, planning, cooking, settings | Pending frontend contracts |
| [#172](https://github.com/RobertCarrUTA/recipe-book/issues/172), existing [#141](https://github.com/RobertCarrUTA/recipe-book/issues/141) | Persistence/import recovery | In progress, independent branch |
| [#173](https://github.com/RobertCarrUTA/recipe-book/issues/173), existing [#140](https://github.com/RobertCarrUTA/recipe-book/issues/140) | Offline build, test gates, accessibility/security/performance | Audit complete; implementation pending |
| [#174](https://github.com/RobertCarrUTA/recipe-book/issues/174) | Preview, final review, docs, release PR | Pending integration |

Existing #143 is an optional test-lifecycle improvement, not grounds to replace working test coverage gratuitously.

## Current evidence and findings

- Clean baseline `npm ci --no-audit --no-fund`: passed; Node 24.16.0, npm 8.15.1, Windows.
- `npm run verify`: passed, 232 tests; 128 recipes, 391 grocery keys, zero data warnings.
- `npm audit --json`: passed, zero reported vulnerabilities for the original lockfile.
- Baseline Chromium smoke: passed 24 checks. [Visual/performance evidence](evidence/baseline/README.md): 52 baseline screenshots and five corrected concepts; Chrome 154.0.8037.98, all eight browse viewports without horizontal overflow. A separate pointer journey reproduced sticky grocery controls intercepting a mobile checkbox; this is preserved as a pre-existing finding. Subpath direct/offline reload passed.
- Three-run unthrottled cold lab medians: desktop/mobile LCP 604/612ms; CLS 0/0; search 171.5/169.2ms; open 15.5/15.7ms. 53 requests, 3,704,340 body bytes. Icon alone is 2,181,203 bytes. These are lab observations, not field INP.
- Independent read-only storage/offline audit: 36 targeted tests passed, but reproductions exposed three missing protections: partial multi-key writes, missing-data backup reset, and legacy multiplier loss. These are pre-existing findings, being fixed under #172/#141.
- Existing worker has origin-wide cache naming/cleanup and can mix shell versions. Reuse #140; a preview must have a separate origin.
- Preserve authored recipe ingredients/instructions; multipliers scale shopping quantities only. The planner is a Monday–Sunday template, not a dated calendar. The old app has only dark mode.

## Environment and preview

Sandboxed network requests fail for GitHub/npm; authorized elevated CLI access works. No credentials are written to files. GitHub Projects listing lacks `read:project`; issues provide adequate tracking without changing account scopes. A managed worktree outside writable roots was archived unused; active worktrees are within the workspace.

Hosted preview not configured; final preview must match the reviewed dev commit. Local production preview is the permitted fallback only if hosting cannot be authorized or provided. Neither is claimed complete yet.

## Next action

Baseline evidence and the coded comparison are complete; Kitchen notebook selected after actual screenshot review. Open/review #169's documentation/evidence PR into dev. Data-safety commit `e055880` passes 249 tests/25 browser checks but is under independent review; do not integrate until findings are resolved. Frontend branch `codex/170-frontend` has an unintegrated typed-state foundation; independent `codex/171-kitchen-workflows` branches from that local contract. No unfinished frontend is on dev. Keep all implementation PRs explicitly based on dev and record exact integration SHAs.
