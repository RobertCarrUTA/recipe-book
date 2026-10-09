# Redesign execution record

Parent: [#168](https://github.com/RobertCarrUTA/recipe-book/issues/168). Implementation is in final integration; it is **not yet release-ready**. Production remains unchanged.

## Branch and release boundary

- Baseline/latest observed `main`: `3117d47b9cdd3a844d063fbde2ca6cd5ff3a83d2`.
- Current integrated `dev`: `562b41034ecf20043258ad800f4ef3c6e56cd1c0` (PR #177). The original checkout remains untouched; work uses isolated worktrees.
- Active feature: `codex/173-release-integration`. It includes the reviewed offline implementation, lifecycle fixes, obsolete-UI retirement, documentation and build gates. Root static artifacts are about to be generated from a clean source commit.
- Production Pages still publishes `main:/`. No protection or hosting setting changed. Final delivery is one open, unmerged `dev` → `main` PR with auto-merge disabled.

## Completed integration

| Work | Evidence |
| --- | --- |
| #169 baseline/design/architecture | PR #175; integration `123bef7`; baseline screenshots and measurements |
| #172/#141 atomic persistence and backup recovery | PR #176; integration `aec6001`; independent reproduced defects and remediation |
| #170/#171/#142 complete frontend and authoritative UI state | PR #177; integration `562b410`; [CI 37867107467](https://github.com/RobertCarrUTA/recipe-book/actions/runs/37867107467) passed Ubuntu, Windows, Firefox and WebKit; clean dev install/verify passed 256 Node + 27 component cases |

#169, #170, #171, #172, #141 and #142 are closed. #173/#140 remain open for offline/cutover integration. #174 remains open for the final preview, exact-head verification and release PR; #168 remains open for human release approval.

## Current feature evidence

- The redesigned UI has 128 captures across all eight required viewports and both palettes, plus intermediate/reflow, keyboard, recovery and workflow tests. Linux CI images now seed reviewed platform-specific visual comparisons; CI never updates expectations automatically.
- Local Windows WebKit passed all 52 pre-cutover behavior journeys after fixing pointer-opener focus. Firefox cannot launch locally (`spawn UNKNOWN`); both Firefox and WebKit passed Linux CI. Physical devices and screen-reader sessions are not claimed.
- Offline review reproduced and fixed two P1s: old-worker navigation poisoning when the new worker/chunks fail, and malformed structured groceries replacing good cached data. [Independent replay](redesign-offline-review.md) confirms recovery and unchanged v7 snapshot bytes. The integrated Refresh UI saves pending changes; 13 production lifecycle scenarios passed before final cutover.
- Replacement lifecycle tests found and fixed stale request overwrites/pruning, duplicate and unknown history links, a wake-lock rejection race, removed-collection restoration, and failed-download cleanup. Shared domain modules and historical compatibility fixtures remain; obsolete controller implementations/tests were retired only with replacement coverage.
- Current core gate passed 178 retained Node tests, 73 component cases, strict types, formatting, 128 recipes/391 grocery keys/zero warnings, build and 14-file integrity checks. The 71-case local Chromium run passed 68; the mocked retry case then passed with its worker interception correctly isolated. Two real recipe-download checks are blocked locally by an injected Web of Trust script (call stack recorded), so they remain mandatory in Linux CI. All 13 integrated offline scenarios passed after cleanup. A further reproduced Back-then-reload persistence case is fixed and protected.
- Attribution review found an empty supplementary MIT notice. The exact upstream license is restored; generation rejects empty notices and regression fixtures protect both installed and supplementary cases. Fresh all-dependency and production-only npm audits each reported zero vulnerabilities. Final rebuilt/staged notices remain a release gate.

## Environment and preview

Networked CLI and browser checks require elevated execution in this environment; no approval review was bypassed. GitHub Projects listing lacks `read:project`, so issues provide tracking without changing scopes. A disk-space failure interrupted a clean install and artifact download; only task-owned reproducible dependencies and the unusable Firefox binary were removed. The clean dev install/verify then passed. Source, Git and review evidence were retained.

No externally hosted preview is deployed. Available Sites publication tools expose a production publication contract rather than an isolated preview facility; no separate preview hosting credentials/configuration are present. Production Pages is not repointed. The authorized fallback is a locally running production build on this shared Windows computer, port 4183, at the configured build base. Its final source SHA and live verification are still pending #174.

## Next action

Finish the current browser gate, commit verified source, build for `/recipe-book/`, stage reviewed root artifacts and prove exact reproduction. Open the #173 feature PR into dev, inspect exact-head CI and merge only after review. Then perform final clean-dev verification, uncontended performance measurements, current screenshot/preview evidence and complete main-to-dev review. Open the single final dev→main PR and leave it unmerged with auto-merge off. Never deploy production or mark the goal complete before those gates are satisfied.
