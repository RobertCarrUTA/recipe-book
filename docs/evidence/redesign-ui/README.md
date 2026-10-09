# Implemented frontend review

Captured 2026-10-08 from the actual Vite production build on Windows, Chrome 154.0.8037.98. This is implementation evidence before final offline/release integration; `report.json` records the dirty working-tree status, checked-out commit, exact built asset hashes and 68 passing browser cases. It is not represented as final exact-head release evidence.

All eight required viewports were captured in Light and Dark across browse, filters, recipe, cooking, groceries, confirmation, planning and settings: **128 viewport captures**. Each capture also passed page-overflow assertions and axe WCAG A/AA checks. Three additional cases verify System changes, state continuity and keyboard/reflow at 320, 640, 641, 850 and 1100 CSS pixels. These are browser-emulated layouts, not physical-device or screen-reader testing.

Files follow `chromium-WIDTHxHEIGHT-THEME-SCREEN.png`. The reproducible source is `tests/e2e/design-system.spec.ts`; `npm run collect:evidence` materializes its attachments without deleting other reports. These inspected captures are not automatically approved visual-diff goldens. Final regression baselines and review evidence must identify their exact source build.

| Layout | Light browse | Dark browse |
| --- | --- | --- |
| 360 × 800 | [Light](chromium-360x800-light-browse.png) | [Dark](chromium-360x800-dark-browse.png) |
| 390 × 844 | [Light](chromium-390x844-light-browse.png) | [Dark](chromium-390x844-dark-browse.png) |
| 430 × 932 | [Light](chromium-430x932-light-browse.png) | [Dark](chromium-430x932-dark-browse.png) |
| 768 × 1024 | [Light](chromium-768x1024-light-browse.png) | [Dark](chromium-768x1024-dark-browse.png) |
| 1024 × 768 | [Light](chromium-1024x768-light-browse.png) | [Dark](chromium-1024x768-dark-browse.png) |
| 1280 × 800 | [Light](chromium-1280x800-light-browse.png) | [Dark](chromium-1280x800-dark-browse.png) |
| 1440 × 900 | [Light](chromium-1440x900-light-browse.png) | [Dark](chromium-1440x900-dark-browse.png) |
| 1920 × 1080 | [Light](chromium-1920x1080-light-browse.png) | [Dark](chromium-1920x1080-dark-browse.png) |

Representative [recipe](chromium-1440x900-dark-recipe.png), [mobile recipe](chromium-390x844-light-recipe.png), [cooking](chromium-768x1024-dark-cooking.png), [shopping](chromium-360x800-dark-groceries.png), [planner](chromium-1440x900-light-planner.png), [settings](chromium-390x844-dark-settings.png), [filters](chromium-390x844-dark-filters.png), and [confirmation](chromium-390x844-light-confirmation.png).

## Independent review and remediation

Actual browser review reproduced and protected these defects: queued back navigation undoing View grocery list, lost source-return route after restoring the grocery view, confirmation/cooking focus restoration, mobile sorting hidden by a breakpoint, quantity Escape closing the whole dialog, underlying recipe cards appearing in print, backups unavailable during catalog failure, and denied Clipboard API calls not falling back. Automated matrix expansion also caught nonfocusable scrollable cooking ingredients at tablet/desktop widths. The fixes pass the component and browser regressions.

The specialist visually inspected 15 prior captures spanning all eight screens, desktop/mobile themes, tablet cooking/planning and 360px groceries. Root additionally inspected mobile browse, 360px dark groceries, tablet dark cooking and desktop light planning. They reported no other blocking clipping/contrast/layout problem in those samples. The review found a lingering success toast over cooking controls; cooking now clears stale messages and places new notices above the footer. Final captures use viewport-sized images to avoid full-page screenshot artifacts around fixed navigation and modal overlays.

New grocery options start collapsed so ingredients appear immediately; explicit old expanded/collapsed preferences remain intact. Card metadata and navigation labels are at least 12px. Recipe search controls retain their saved collapse preference, and the filter dialog preserves multiple collection selections.

## Evidence limits

Automated contrast/semantic checks do not prove full accessibility. No physical device or assistive-technology session is claimed. Browser-specific runs, original-worker lifecycle tests and final exact-head signoff are tracked separately. Data-recovery tests use isolated synthetic personal state and real public recipe content; no personal browser data is included.
