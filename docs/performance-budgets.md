# Production UI performance checks

Run `npm.cmd run build`, then `node scripts/measure-redesign.mjs` from the frontend checkout. The script starts and closes an ephemeral loopback Vite preview server and local Chromium using the existing browser executable helper. It does not build or edit the application. Results go to ignored `test-results/performance/redesign-report.json` and `README.md`; set `PERFORMANCE_OUTPUT` to use another output directory. Dependencies resolve from the working directory, so a reviewer can run the script by absolute path from another worktree.

The baseline is commit `3117d47b9cdd3a844d063fbde2ca6cd5ff3a83d2`, with raw samples and its original runner preserved in [baseline evidence](evidence/baseline/README.md). The budgets below were specified before measuring the redesign, rather than fitted to its result.

| Median budget, separately for each viewport | Limit | Baseline desktop / mobile | Reason |
| --- | ---: | ---: | --- |
| Initial LCP | 800 ms | 604 / 612 ms | Allow modest local scheduling variance while limiting a material startup regression. |
| Initial accumulated non-input layout shift | 0.05 | 0 / 0 | Keep startup stable; an individual sample also must stay at or below 0.1. |
| Search event to settled rendered result | 200 ms | 171.5 / 169.2 ms | Preserve or improve the old search response, which included a 150 ms debounce. |
| Recipe detail click to two animation frames | 50 ms | 15.5 / 15.7 ms | Allow the new accessible dialog without a perceptible long synchronous open. The dialog must actually be visible. |
| Recorded resource requests, including document | 53 | 53 / 53 | Bundling should not increase the request fan-out. |
| Encoded response body bytes, uncompressed | 3,704,340 | Same | Do not increase the complete startup payload. |
| Resource Timing transfer bytes | 3,719,040 | Same | Companion to the body budget, retaining browser-reported header overhead. |
| JavaScript response body bytes, uncompressed | 409,600 (400 KiB) | 312,517 | Explicit maximum of about 31% added JS for React, accessible primitives, and redesign behavior; actual growth still needs review. |
| Synthetic 1,000-recipe search | 200 ms | No old large-catalog sample | Keep large-catalog searching responsive; maximum individual sample 400 ms. |
| Synthetic 1,002-row grocery check | 200 ms | No old large-list sample | Bound state update and rendered check feedback; maximum individual sample 400 ms. |

The harness exits nonzero for execution errors, missing samples, compressed responses, or exceeded budgets. Retain failing reports. Investigate functional defects or resource regressions before deciding whether repeat measurements are justified; do not silently relax the budget. Three samples provide a regression signal, not a reliable tail-latency estimate.

## Sampling definitions

- Three fresh browser contexts at 1440×900 and three at 390×844 for the real catalog, followed by three fresh contexts per viewport for the deterministic large fixture. All use dark theme, blocked service workers, no network or CPU throttling, and `Accept-Encoding: identity`.
- Startup sampling matches the historical runner: navigation to `networkidle`, visible recipe readiness, then another 500 ms. Performance observers collect LCP and the sum of layout shifts without recent input. This short-window accumulated shift measure matches the baseline; it is not a complete field CLS session calculation.
- Request, transfer, and encoded body totals come from document Navigation Timing plus Resource Timing entries. Browser-injected entries are retained. The old report includes zero-byte `/adguard` requests, so request deltas have that known source of noise. Full resource tables allow review.
- The production search query is the same `Dutch Oven Chicken Pot Pie` used by the original runner. It matches notes in other recipes too. As in the original runner, the catalog's expected matches are computed with the existing search helper before timing; their IDs are saved in the report. Timing starts immediately before the input event and ends two animation frames after the DOM contains exactly that matching ID set. Native input setters ensure React receives the event. A timeout fails instead of accepting stale content.
- Detail latency starts immediately before clicking the target recipe link and ends after two animation frames, matching the old synchronous-open definition. The new dialog must be visible at that point or the run fails. The recorded `dialogReadyLatency` is the same observation, not an independent metric.
- Grocery check timing starts before clicking the unchecked input and ends two animation frames after the application marks its row checked. The harness confirms exactly one checked row. Large-list navigation time is also reported, but includes Playwright action delivery and is diagnostic only.
- The large fixture generates exactly 1,000 unique synthetic recipes from a deterministic alphabetic sequence. Each has one distinct ingredient and shared rice/salt, producing exactly 1,002 grocery rows with all recipes selected. Its JSON is intercepted locally without changing repository recipes. Recipe IDs, fixture size, and SHA-256 make the run reproducible. Synthetic transfer totals are recorded only as diagnostics and excluded from bandwidth comparisons.

These measurements are lab event-to-render observations, **not field INP**. Mobile results emulate layout on the same desktop CPU. They do not establish performance on physical low-end devices, hosted-network behavior, service-worker upgrade speed, or accessibility. Exact built asset hashes, on-disk/gzip sizes, browser version, dirty-tree status, and startup long-task samples accompany each report so results can be tied to the measured artifact. A dirty working tree is explicitly identified, not represented as an immutable release.

[Current version-10 measurements](evidence/release-performance/README.md) include the retained pre-fix shift failure and its correction. [Supplemental journey timings](performance-journeys.md) cover filtering, populated planning, cooking, themes and reopening persisted state. Run both scripts without concurrent browser jobs.
