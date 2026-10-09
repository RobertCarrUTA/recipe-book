# Production UI performance report

Commit: `0ea45243b8b2abd0a44ff94b4b92ecdb77a979f6`; working tree dirty: false. Captured 2026-10-09T01:34:38.691Z.

Production dist served by loopback Vite preview with Accept-Encoding: identity; 3 fresh browser contexts for each desktop/mobile layout, dark theme, service workers blocked, no CPU/network throttling. Initial LCP and accumulated non-input CLS sampled after networkidle, visible recipes, and 500 ms (same baseline observation window). Resource Timing includes document plus all recorded resources. Search ends after matching rendered cards plus two animation frames. Detail reports both click-to-two-frames and dialog-ready-plus-two-frames. These are synthetic lab interaction latencies, not field INP. Large fixture uses intercepted local JSON and must not be used for transfer-byte comparisons.

## Baseline comparison (medians)

| Viewport | Metric | Baseline | Redesign | Delta |
| --- | --- | ---: | ---: | ---: |
| desktop | lcp | 604 | 788 | 184 |
| desktop | cls | 0 | 0 | 0 |
| desktop | searchLatency | 171.5 | 24.8 | -146.7 |
| desktop | openLatency | 15.5 | 26 | 10.5 |
| desktop | requestCount | 53 | 10 | -43 |
| desktop | bodyBytes | 3704340 | 1559582 | -2144758 |
| desktop | transferBytes | 3719040 | 1561382 | -2157658 |
| desktop | jsBytes | 312517 | 399833 | 87316 |
| mobile | lcp | 612 | 788 | 176 |
| mobile | cls | 0 | 0 | 0 |
| mobile | searchLatency | 169.2 | 25.2 | -144 |
| mobile | openLatency | 15.7 | 31.1 | 15.4 |
| mobile | requestCount | 53 | 10 | -43 |
| mobile | bodyBytes | 3704340 | 1559582 | -2144758 |
| mobile | transferBytes | 3719040 | 1561382 | -2157658 |
| mobile | jsBytes | 312517 | 399833 | 87316 |

## Predeclared budgets

| Scenario | Viewport | Statistic | Metric | Actual | Limit | Result |
| --- | --- | --- | --- | ---: | ---: | --- |
| production | desktop | median | lcp | 788 | 800 | PASS |
| production | desktop | median | cls | 0 | 0.05 | PASS |
| production | desktop | median | searchLatency | 24.8 | 200 | PASS |
| production | desktop | median | openLatency | 26 | 50 | PASS |
| production | desktop | median | requestCount | 10 | 53 | PASS |
| production | desktop | median | bodyBytes | 1559582 | 3704340 | PASS |
| production | desktop | median | transferBytes | 1561382 | 3719040 | PASS |
| production | desktop | median | jsBytes | 399833 | 409600 | PASS |
| production | desktop | maximum | cls | 0 | 0.1 | PASS |
| large | desktop | median | searchLatency | 17.2 | 200 | PASS |
| large | desktop | median | groceryCheckLatency | 135.4 | 200 | PASS |
| large | desktop | maximum | searchLatency | 17.5 | 400 | PASS |
| large | desktop | maximum | groceryCheckLatency | 145.4 | 400 | PASS |
| production | mobile | median | lcp | 788 | 800 | PASS |
| production | mobile | median | cls | 0 | 0.05 | PASS |
| production | mobile | median | searchLatency | 25.2 | 200 | PASS |
| production | mobile | median | openLatency | 31.1 | 50 | PASS |
| production | mobile | median | requestCount | 10 | 53 | PASS |
| production | mobile | median | bodyBytes | 1559582 | 3704340 | PASS |
| production | mobile | median | transferBytes | 1561382 | 3719040 | PASS |
| production | mobile | median | jsBytes | 399833 | 409600 | PASS |
| production | mobile | maximum | cls | 0 | 0.1 | PASS |
| large | mobile | median | searchLatency | 18.1 | 200 | PASS |
| large | mobile | median | groceryCheckLatency | 142.3 | 200 | PASS |
| large | mobile | maximum | searchLatency | 19.8 | 400 | PASS |
| large | mobile | maximum | groceryCheckLatency | 164.1 | 400 | PASS |

## Limitations

These are unthrottled loopback lab observations on a desktop CPU, including the mobile layout. They are not physical-device, field INP, or production-network measurements. The original baseline contains browser-injected zero-byte /adguard resources; full recorded request counts are retained for transparency. Response body bytes are uncompressed; per-asset gzip sizes are only potential deployment sizes. Large-fixture bytes use route interception and are excluded from bandwidth budgets. Raw samples, exact dist hashes, long tasks, browser messages, failures, and fixture hash are in redesign-report.json.

Execution failures: 0; failed budgets: 0.
