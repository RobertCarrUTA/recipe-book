# Baseline evidence and design comparison

Original application commit: `3117d47b9cdd3a844d063fbde2ca6cd5ff3a83d2`.
Captured October 8, 2026 using headless local Chrome/Chromium `154.0.8037.98`, Playwright, Node `v24.16.0`, uncompressed loopback HTTP on an ephemeral port. All user state was synthetic and browser-context isolated. Authored recipes were unchanged. The original application has one dark theme.

## Results and limitations

- 52 unique baseline screenshots cover 14 workflow states on desktop 1440×900, mobile 390×844, and tablet 768×1024; eight additional browse viewport captures and two subpath/offline captures are included in that total.
- All eight required browse widths were measured: 360×800, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080. There was no document horizontal overflow or horizontally offscreen visible control in 28 collected layout measurements. This does not establish vertical visibility, all-state reflow, or physical-device compatibility.
- Desktop and tablet pointer journeys completed. The mobile pointer journey hit repeated interception by the sticky grocery toolbar and bottom navigation while checking the fifth item (`potato - 2 potatoes`). The original failure remains in `baseline-report.json`. A separate keyboard completion journey filled in all remaining mobile screenshot states; this is not a claimed fix of the pointer problem.
- Actual `/recipe-book/<recipe-id>` direct navigation and offline reload both loaded the expected opened recipe. This is a local emulation of the hosting fallback, not a deployed-site check or a previous-version service-worker upgrade test.
- Ordinary visual/layout/offline runs produced no recorded console errors, page errors, failed requests, or HTTP errors. Performance contexts deliberately blocked service workers, producing six Playwright warnings and six caught app registration warnings; these 12 messages are preserved and classified as instrumentation effects.
- An initial default-sandbox loopback attempt failed with `ERR_NETWORK_ACCESS_DENIED`. Its local report remains in ignored test results. The same local harness succeeded with approved escalation.
- All images are browser viewport emulation; no physical devices or screen readers were exercised. Automated measurements do not establish WCAG conformance.

## Performance baseline

Three fresh browser contexts per viewport; no CPU or network throttling; cold HTTP resource loads; service workers blocked. LCP/CLS sampled after app readiness plus 500 ms. Search latency includes the intentional 150 ms debounce and ends after two animation frames following matching DOM output. Open latency is synchronous click to two frames. These are lab interaction observations, not INP.

| Median metric | Desktop 1440×900 | Mobile layout 390×844 |
| --- | ---: | ---: |
| LCP | 604 ms | 612 ms |
| CLS | 0 | 0 |
| Search event → settled paint | 171.5 ms | 169.2 ms |
| Detail click → settled paint | 15.5 ms | 15.7 ms |
| Resource requests including document | 53 | 53 |
| Resource Timing transfer bytes | 3,719,040 | 3,719,040 |
| Encoded response body bytes | 3,704,340 | 3,704,340 |

Resource Timing is the source for these counts and bytes, not a packet trace. Full samples and resource breakdowns are in `baseline-report.json`.

## Curated before screenshots

All files below are in this directory. Timestamp/viewport/index metadata and original failures are preserved in `baseline-report.json`; private machine paths in error stacks have been replaced with `<workspace>`.

| Workflow | Desktop | Mobile | Tablet |
| --- | --- | --- | --- |
| Browse | [desktop-browse.png](desktop-browse.png) | [mobile-browse.png](mobile-browse.png) | [tablet-browse.png](tablet-browse.png) |
| Recipe | [desktop-detail.png](desktop-detail.png) | [mobile-detail.png](mobile-detail.png) | [tablet-detail.png](tablet-detail.png) |
| Full recipe content | [desktop-detail-content.png](desktop-detail-content.png) | [mobile-detail-content.png](mobile-detail-content.png) | [tablet-detail-content.png](tablet-detail-content.png) |
| Search and filters | [desktop-search-filters.png](desktop-search-filters.png) | [mobile-search-filters.png](mobile-search-filters.png) | [tablet-search-filters.png](tablet-search-filters.png) |
| Groceries | [desktop-grocery-populated.png](desktop-grocery-populated.png) | [mobile-grocery-populated.png](mobile-grocery-populated.png) | [tablet-grocery-populated.png](tablet-grocery-populated.png) |
| Completed grocery list | [desktop-grocery-completed.png](desktop-grocery-completed.png) | [mobile-grocery-completed.png](mobile-grocery-completed.png) | [tablet-grocery-completed.png](tablet-grocery-completed.png) |
| Plan | [desktop-planner.png](desktop-planner.png) | [mobile-planner.png](mobile-planner.png) | [tablet-planner.png](tablet-planner.png) |
| Cooking | [desktop-cooking.png](desktop-cooking.png) | [mobile-cooking.png](mobile-cooking.png) | [tablet-cooking.png](tablet-cooking.png) |
| Confirmation | [desktop-delete-dialog.png](desktop-delete-dialog.png) | [mobile-delete-dialog.png](mobile-delete-dialog.png) | [tablet-delete-dialog.png](tablet-delete-dialog.png) |

Additional files cover empty plan/list, no search results, checked groceries, collapsed cooking header, all eight browse viewport sizes, direct subpath recipe, and offline subpath recipe.

The reviewer actually inspected desktop/mobile browse and recipe, mobile grocery/cooking/confirmation, and tablet planner images. Observed baseline issue: expanded mobile search controls occupy about half the viewport and overlap the recipe header when the browser scrolls it into view; expanded grocery tools similarly dominate the shopping viewport. Horizontal-overflow checks alone do not detect these vertical usability problems.

## Coded design comparison — prototypes only

| Concept | Desktop | Mobile |
| --- | --- | --- |
| Kitchen notebook | [Light](prototype-notebook-desktop-light.png), [Dark](prototype-notebook-desktop-dark.png) | [Light](prototype-notebook-mobile-light.png) |
| Recipe workbench | [Light](prototype-workbench-desktop-light.png) | [Light](prototype-workbench-mobile-light.png) |

All five prototypes were captured and visually inspected. None has page-level horizontal overflow at these viewports. The notebook better supports consumer browsing with clear serif recipe titles, warm paper surfaces, descriptions and a calm mobile card rhythm. The workbench packs more recipes into view and provides a useful side reader on desktop, but is more utilitarian and loses that reader at mobile width.

Two demonstrated prototype problems were reported to the owner and corrected before final recapture: the dark body did not apply its color/background tokens, and serving metadata duplicated the word `servings`. The corrected dark screenshot was reinspected and shows readable light text with dark page/card surfaces.

Implementation requirements from this review:

- Use the notebook direction while reducing mobile header/discovery height so recipes appear sooner.
- Use at least 12–13 px for metadata and comfortable body reading sizes; retain hierarchy without faint tiny text.
- Use the concise mobile search placeholder “Search your recipes”.
- Replace prototype glyphs with named accessible Lucide icons; decorative icons must be hidden from assistive technology.
- Keep primary touch controls at least 44 px and preserve visible keyboard focus.
- Keep sticky regions compact and verify that focused/activated content is not obscured vertically.
- Apply semantic theme tokens to all surfaces and inherited text, including root/body, dialogs, inputs and menus.

## Reproducing the baseline

The two `.mjs.txt` files in this directory preserve the reviewed evidence runners. In a clean checkout of the stated baseline, install its lockfile, copy these files to `test-results/baseline/` while removing `.txt`, and run the commands below. The prototype runner additionally needs the three `docs/design/concepts.*` files from this evidence commit. Outputs remain ignored. The historical baseline suite is evidence tooling, not a gate that a redesign should match visually.

`node test-results/baseline/capture-baseline.mjs` captures the original full baseline. It asserts the audited commit and uses a strict app-publish-file HTTP allowlist.

`node test-results/baseline/capture-baseline.mjs --mobile-completion` appends a keyboard completion pass while retaining the original pointer failure.

`node test-results/baseline/capture-prototypes.mjs` captures both coded concepts from `docs/design/concepts.html` with an explicit static-file allowlist.

The baseline runner deliberately exits nonzero while the original pointer failure remains recorded. These runners are evidence tooling ready for review; they have not been adopted as production regression gates.
