# Redesign execution record

Parent: [#168](https://github.com/RobertCarrUTA/recipe-book/issues/168). The implementation is **in progress**, not release-ready. Production has not been changed.

## Safe integration boundary

- Baseline and latest observed `main`: `3117d47b9cdd3a844d063fbde2ca6cd5ff3a83d2` (2026-10-08).
- `dev` created and published at that baseline. Final delivery must be one open, unmerged `dev` → `main` PR with automatic merging disabled.
- Original checkout was clean on the earlier `codex/166-recipe-controls-scroll-position` branch; left untouched. Work uses isolated Git worktrees.
- Baseline PR #175 merged after Ubuntu/Windows CI at integration `123bef712924a13d98dcb59abc9e6918649408e8`. Storage PR #176 merged after independent review, remediation and CI at `aec600142706c90f72ad52bcb97a32ee0555de3f` (current integrated dev).
- Active frontend branch: `codex/170-frontend`; #171 workflow components and independent browser regressions are included there. Offline work is isolated on `codex/173-offline-build` until its lifecycle verification passes.
- Production Pages is legacy branch deployment from `main:/`. Only `verify.yml` is present on audited main. Feature/dev pushes do not publish production.
- Main protection enforces admins and prevents force pushes/deletion, but requires zero approvals and has no required status checks. No protections were changed. Repository auto-merge is disabled.

## Work map

| Issue | Work | Current state |
| --- | --- | --- |
| [#169](https://github.com/RobertCarrUTA/recipe-book/issues/169) | Baseline, preservation, architecture, two concepts | Integrated and closed; PR #175 |
| [#170](https://github.com/RobertCarrUTA/recipe-book/issues/170), existing [#142](https://github.com/RobertCarrUTA/recipe-book/issues/142) | Frontend, navigation, themes, recipe workflows, state ownership | Implemented; browser and specialist review/remediation in progress |
| [#171](https://github.com/RobertCarrUTA/recipe-book/issues/171) | Groceries, planning, cooking, settings | Implemented; 23 browser workflow cases passed before final matrix |
| [#172](https://github.com/RobertCarrUTA/recipe-book/issues/172), existing [#141](https://github.com/RobertCarrUTA/recipe-book/issues/141) | Persistence/import recovery | Integrated and closed; PR #176; 255 tests at exact dev integration |
| [#173](https://github.com/RobertCarrUTA/recipe-book/issues/173), existing [#140](https://github.com/RobertCarrUTA/recipe-book/issues/140) | Offline build, test gates, accessibility/security/performance | Hashed build and explicit-update implementation under real-browser lifecycle verification |
| [#174](https://github.com/RobertCarrUTA/recipe-book/issues/174) | Preview, final review, docs, release PR | Pending integration |

Existing #143 is an optional test-lifecycle improvement, not grounds to replace working test coverage gratuitously.

## Current evidence and findings

- Clean baseline `npm ci --no-audit --no-fund`: passed; Node 24.16.0, npm 8.15.1, Windows.
- `npm run verify`: passed, 232 tests; 128 recipes, 391 grocery keys, zero data warnings.
- `npm audit --json`: passed, zero reported vulnerabilities for the original lockfile.
- Baseline Chromium smoke: passed 24 checks. [Visual/performance evidence](evidence/baseline/README.md): 52 baseline screenshots and five corrected concepts; Chrome 154.0.8037.98, all eight browse viewports without horizontal overflow. A separate pointer journey reproduced sticky grocery controls intercepting a mobile checkbox; this is preserved as a pre-existing finding. Subpath direct/offline reload passed.
- Three-run unthrottled cold lab medians: desktop/mobile LCP 604/612ms; CLS 0/0; search 171.5/169.2ms; open 15.5/15.7ms. 53 requests, 3,704,340 body bytes. Icon alone is 2,181,203 bytes. These are lab observations, not field INP.
- Independent storage audit reproduced partial multi-key writes, missing-data backup reset, and legacy multiplier loss. PR #176 fixed them with atomic v7 snapshots, an old-client write fence, bounded schema-v1 import validation and commit-before-replace recovery. Follow-up review found and fixed two more failure-path issues. Exact dev integration passed 255 tests; source branch browser smoke passed 25 checks.
- New React UI production slice was inspected at desktop, tablet and mobile in both palettes. Component suite passes 27 cases. Independent browser review reproduced navigation/history, mobile sorting, confirmation focus, quantity Escape, print isolation, catalog-outage backup and clipboard fallback defects; all have source fixes with regression coverage. The complete 8×2 viewport/theme matrix is running, not yet claimed complete.
- Runtime license generation now retains full installed notices for 29 packages, plus an exact upstream supplemental MIT notice omitted from one tarball. Installed dependency audit reported zero vulnerabilities. Final audit and release provenance remain pending.
- Existing worker has origin-wide cache naming/cleanup and can mix shell versions. Reuse #140; a preview must have a separate origin.
- Preserve authored recipe ingredients/instructions; multipliers scale shopping quantities only. The planner is a Monday–Sunday template, not a dated calendar. The old app has only dark mode.

## Environment and preview

Sandboxed network requests fail for GitHub/npm; authorized elevated CLI access works. No credentials are written to files. GitHub Projects listing lacks `read:project`; issues provide adequate tracking without changing account scopes. A managed worktree outside writable roots was archived unused; active worktrees are within the workspace.

Hosted preview not configured; final preview must match the reviewed dev commit. Local production preview is the permitted fallback only if hosting cannot be authorized or provided. Neither is claimed complete yet.

## Next action

Complete frontend regression/visual review, then open its feature PR explicitly into dev. Integrate #173 only after original-worker upgrade, incomplete-install, root/subpath and multi-tab lifecycle checks pass. Production still uses main:/; preserve that configuration by staging reviewed generated static artifacts only at deliberate final cutover. Final preview, exact-head CI, performance/cross-browser checks, preservation matrix completion and one open dev→main PR are still required. Do not mark the goal complete or publish production.
