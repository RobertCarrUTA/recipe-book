# Supplemental production journey measurements

Commit: `14c1056324ea6c464d009b6bd7a53a33dc7baca8`; dirty: false; build source: `5afe991610b8d5a761380a92d7056297ad72e43d`; release: `9f84c40ac9c107a7fef88ef4`.

Unthrottled local production server; three fresh isolated contexts per desktop/mobile layout. Real authored catalog, synthetic 35-assignment week across seven days (five recipe/components per day), eight selected recipes and two manual items. Service workers remain enabled; timed actions begin only after activation, control and network idle. Action latency starts immediately before browser click/change dispatch and ends two animation frames after asserted rendered output. Persisted reload uses a new-document animation-frame readiness observer and navigation-relative performance.now(). These are lab event-to-render timings, not field INP or physical-device measurements.

| Layout | Statistic | Metric | Actual ms | Limit ms | Result |
| --- | --- | --- | ---: | ---: | --- |
| desktop | median | filterLatency | 13.2 | 200 | PASS |
| desktop | median | planLatency | 35.5 | 200 | PASS |
| desktop | median | cookingLatency | 27 | 200 | PASS |
| desktop | median | themeLatency | 13.1 | 200 | PASS |
| desktop | median | persistedReloadLatency | 153.9 | 1500 | PASS |
| desktop | maximum | filterLatency | 15 | 400 | PASS |
| desktop | maximum | planLatency | 36.5 | 400 | PASS |
| desktop | maximum | cookingLatency | 28 | 400 | PASS |
| desktop | maximum | themeLatency | 13.3 | 400 | PASS |
| desktop | maximum | persistedReloadLatency | 155.6 | 2500 | PASS |
| mobile | median | filterLatency | 12.3 | 200 | PASS |
| mobile | median | planLatency | 35.8 | 200 | PASS |
| mobile | median | cookingLatency | 25.2 | 200 | PASS |
| mobile | median | themeLatency | 13.2 | 200 | PASS |
| mobile | median | persistedReloadLatency | 163.8 | 1500 | PASS |
| mobile | maximum | filterLatency | 12.4 | 400 | PASS |
| mobile | maximum | planLatency | 42.3 | 400 | PASS |
| mobile | maximum | cookingLatency | 25.2 | 400 | PASS |
| mobile | maximum | themeLatency | 13.7 | 400 | PASS |
| mobile | maximum | persistedReloadLatency | 166.3 | 2500 | PASS |

Complete samples: 6/6. Execution failures: 0. Failed budgets: 0.

Raw samples, fixture IDs, browser/version, build metadata and all artifact hashes are in journeys-report.json. Three repetitions cannot establish reliable tail latency; mobile is viewport emulation on the desktop CPU. No field INP, physical-device or hosted-network result is claimed.
