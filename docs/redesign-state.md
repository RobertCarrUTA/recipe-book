# Redesign execution record

Parent [#168](https://github.com/RobertCarrUTA/recipe-book/issues/168); delivery [#174](https://github.com/RobertCarrUTA/recipe-book/issues/174). See [release review](redesign-release.md) for product/evidence/preview/recovery details. Production is unchanged; the final release PR must remain open and unmerged, auto-merge off.

- Baseline/latest checked main: `3117d47b9cdd3a844d063fbde2ca6cd5ff3a83d2`; Pages `main:/`; protections and settings unchanged.
- Integrated dev before this delivery feature: `af08710a726af8e24fb34807d890c8f8daa2cd19`, PR #178. [Exact-dev CI 37870053545](https://github.com/RobertCarrUTA/recipe-book/actions/runs/37870053545) passed all three jobs. Local core/reproduction passed after refreshing old worktree CRLF files to the new LF checkout policy; that refresh changed no Git content.
- Active branch: `codex/174-release-validation`, isolated frontend worktree. Original checkout untouched. Final integration SHA/live preview/PR checks belong in #174 and the release PR, avoiding a circular stamp here.

## Integrated work

| Issues | Feature PR | Result |
| --- | --- | --- |
| #169 | #175 | Baseline, architecture, two working concepts and evidence |
| #172, #141 | #176 | Atomic persistence and backup recovery, independent review |
| #170, #171, #142 | #177 | Complete responsive frontend/workflows/themes and tests |
| #173, #140 | #178 | Offline/build cutover, old-code retirement, reproducible artifacts, independent review and all CI |

These child issues are closed. #174 covers delivery; #168 remains open awaiting human release review. Optional #143 is outside mandatory scope.

## Delivery feature evidence

The complete integration review found no material finding. Final performance then exposed the initial offline error moving the loading screen (mobile shift 0.055 > 0.05). Commit `0ea4524` fixes it, adds a reproduced browser regression and advances version to `20261008-10`. Independent follow-up review found no concern. Twelve repeated samples passed all 26 unchanged budgets with zero shift; the supplemental runner passed all 20 budgets across filtering, populated planning, cooking, themes and saved-state reload. Exact provenance and the failing report are retained.

Version-10 checks passed 178 Node tests, 73 component tests, formatting/types/data/build integrity, 70 available local Chromium cases and 13 production lifecycle scenarios. There are 128 current captures; root inspected representatives across every required size and major screen. Two local recipe-download checks are blocked by an injected browser hook and remain mandatory in Linux CI. Firefox is unavailable locally; Linux CI tests Firefox and WebKit. No physical-device or screen-reader test is claimed.

Docs/prerequisites/migration/release guidance are current; all 128 recipe sources and generated data are unchanged. Rebuilt notices retain full licenses; fresh audits reported zero vulnerabilities. Version-10 root artifacts must reproduce before feature integration, followed by exact-dev checks and live preview.

## Final delivery gates

Commit reviewed evidence/source, stage from that clean source, prove reproduction and merge the #174 feature PR only after review and current CI. Then check clean exact-dev installation/build/tests/performance/preview, open the single dev→main PR, and record actual SHA/CI/preview/open-unmerged-auto-merge-off state in #174 and the epic. Production deployment remains prohibited.

Hosting fallback is local because available Sites tools expose production publication and no isolated preview host is configured/authorized. Projects scope is unavailable, so issues provide tracking. Network/browser runs require approved elevation; no security control was bypassed. A disk-space interruption was recovered by removing only task-owned reproducible dependencies; source, Git and evidence were retained.
