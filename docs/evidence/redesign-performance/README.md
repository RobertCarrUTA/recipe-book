# Redesign performance evidence

Measured October 8, 2026 against the production build available at frontend commit `3b5745383a108527ed5e676b98480b5fd20be724` with uncommitted changes. This is evidence for the exact built artifact below, not a claim that the commit alone recreates it. No other browser suites ran during the final measurement. Chromium was `154.0.8037.99`, Node `v24.16.0`.

- Main JS: `assets/index-Cah8RF7I.js`, SHA-256 `b37e2cdaf90a18ce7688a0b09724eada81d9bfd5707c2caf34b0fa17ce88baac`.
- Main CSS: `assets/index-Pi3jcX3A.css`, SHA-256 `43b9c362e12ca47b14864a635011e6e05d941b9aebd5ac38223d1a69d8528f42`.
- All captured HTML/asset hashes were unchanged at the end of the run. The runner recorded no execution failures, browser messages, or failed budgets.

See [raw samples and asset metadata](redesign-report.json), [predeclared budgets and reproduction instructions](../../performance-budgets.md), and [original baseline](../baseline/README.md). The complete run has three cold contexts per viewport for the real catalog and three per viewport for the deterministic large fixture, twelve samples total. Reports from incomplete fixture diagnostics or the interrupted run during another browser suite are excluded.

| Median metric | Old desktop | New desktop | Old mobile layout | New mobile layout |
| --- | ---: | ---: | ---: | ---: |
| LCP | 604 ms | 512 ms | 612 ms | 776 ms |
| Initial accumulated non-input layout shift | 0 | 0 | 0 | 0 |
| Search event → matching output + two frames | 171.5 ms | 28.7 ms | 169.2 ms | 25.6 ms |
| Detail click → two frames, visible detail | 15.5 ms | 26.4 ms | 15.7 ms | 30.7 ms |
| Requests including document | 53 | 10 | 53 | 10 |
| Uncompressed response body bytes | 3,704,340 | 1,552,293 | 3,704,340 | 1,552,293 |
| Resource Timing transfer bytes | 3,719,040 | 1,554,093 | 3,719,040 | 1,554,093 |
| JavaScript response body bytes | 312,517 | 395,961 | 312,517 | 395,961 |

The total response body shrank 58.1%, chiefly because the old 2.18 MB SVG icon was replaced with a small SVG. JavaScript **grew 26.7%**, by 83,444 bytes; the React/Radix redesign is not a JS-size reduction. The main JS bundle is 395,378 bytes uncompressed and 119,764 bytes with local gzip. Gzip is reported for context; the timing comparison explicitly requested uncompressed responses.

The search response improved substantially by avoiding the old 150 ms debounce. Detail opening is slower by 10.9–15.0 ms but stays below the 50 ms budget. Mobile-layout LCP increased 164 ms and is only 24 ms below the 800 ms median budget. Startup varied: desktop samples were 820/512/512 ms; mobile samples were 516/800/776 ms. Three local samples are too few to infer reliable tail behavior, and the budget pass does not establish a mobile startup improvement.

## Large catalog and grocery list

The deterministic fixture contains 1,000 distinct recipes, all selected, with one unique ingredient each plus shared rice and salt. The browser verified exactly 1,002 rendered grocery rows and exactly one checked row after each shopping interaction. No recipe source file was modified.

| Lab interaction | Desktop median / maximum | Mobile-layout median / maximum |
| --- | ---: | ---: |
| Search among 1,000 recipes | 23.7 / 37.0 ms | 34.3 / 34.8 ms |
| Check an item among 1,002 grocery rows | 173.9 / 301.6 ms | 152.6 / 153.5 ms |

The large-list check has much less headroom than search: one desktop sample exceeded 300 ms. The current store clones durable state and the grocery component recomputes/render-maps the whole list, so reducing work per check is a sensible follow-up if real users approach this list size. This is a source inspection consistent with the measurement, not a profiler-derived allocation of the latency. No speculative optimization was made in this evidence change.

These are unthrottled local lab measurements on a desktop CPU, including the mobile viewport. They are **not field INP**, physical-device results, or hosted-network measurements. The baseline browser patch version differs by one, and both resource tables include browser-injected request noise. The full raw samples are retained so improvements, regressions, and variability remain visible.
