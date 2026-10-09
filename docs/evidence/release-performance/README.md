# Release implementation performance

Measured October 8, 2026 (UTC reports cross into October 9), Windows, Chromium 154.0.8037.99, Node 24.16.0. These are unthrottled loopback lab measurements on a desktop CPU, including mobile layouts; **not field INP or physical-device measurements**. No competing browser/performance jobs ran.

The [startup report](startup-report.md) and [raw samples](redesign-report.json) identify clean application commit `0ea45243b8b2abd0a44ff94b4b92ecdb77a979f6`, version `20261008-10`, and exact asset hashes. All 26 unchanged budgets passed in twelve samples. The [supplemental journey report](journey-report.md) and [raw samples](journeys-report.json) identify runner commit `14c1056` and build source `5afe991`; intervening changes are documentation/measurement tooling, with identical application JS/CSS. All 20 supplemental budgets passed in six samples. Final integration evidence is linked from [release review](../../redesign-release.md).

| Median | Baseline desktop / mobile | Release implementation desktop / mobile |
| --- | ---: | ---: |
| LCP | 604 / 612 ms | 788 / 788 ms |
| Initial non-input layout shift | 0 / 0 | 0 / 0 |
| Search | 171.5 / 169.2 ms | 24.8 / 25.2 ms |
| Recipe opening | 15.5 / 15.7 ms | 26.0 / 31.1 ms |
| Requests | 53 / 53 | 10 / 10 |
| Uncompressed response bodies | 3,704,340 bytes | 1,559,582 bytes |
| JavaScript responses | 312,517 bytes | 399,833 bytes |
| Search among 1,000 recipes | Not collected | 17.2 / 18.1 ms |
| Check among 1,002 grocery rows | Not collected | 135.4 / 142.3 ms |
| Collection filtering | Not collected | 13.2 / 12.3 ms |
| Open 35-assignment plan | Not collected | 35.5 / 35.8 ms |
| Enter cooking mode | Not collected | 27.0 / 25.2 ms |
| Dark → Light | Not collected | 13.1 / 13.2 ms |
| Reopen saved 36-assignment plan | Not collected | 153.9 / 163.8 ms |

Startup bodies fell 57.9%, largely from replacing the oversized old icon; JS grew 27.9%. The main JS is 399,250 bytes (121,120 with the harness's local gzip), CSS 35,064 bytes. Search improved by removing the old debounce, while recipe opening and LCP are slower. Both LCP medians have only 12 ms headroom under the stricter 800 ms lab budget; the largest startup sample was 812 ms. Three repetitions do not establish reliable tail performance. The largest grocery check was 164.1 ms. These results are not universal device/network guarantees.

The first final run at `af08710` failed mobile shift: 0.055 versus 0.05. Its [unaltered report](before-loading-fix.json) is retained. A trace identified a registration-error banner moving the loading screen by 106.8 px when the benchmark deliberately blocked workers; a normal worker-enabled run had no shift. The app now shows this initial error with loaded content or catalog failure, while update availability and persistence warnings remain immediate. The new regression failed before the fix and passed after; both blocked/allowed-worker traces then showed zero shift. No budget was relaxed.

The supplemental runner initially stopped before browser launch because the local Playwright entry exposed CommonJS exports; interoperability was corrected before sampling. The runtime run completed without failures or browser messages. It uses the real catalog and a busy but plausible week, verifies every planned title and exact snapshot bytes after reload. Its [method](../../performance-journeys.md) records budgets declared before running. Original [budgets](../../performance-budgets.md) are unchanged; [earlier implementation measurements](../redesign-performance/README.md) remain historical evidence.
