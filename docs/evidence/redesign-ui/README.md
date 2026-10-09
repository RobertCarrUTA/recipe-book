# Implemented frontend review

Updated 2026-10-08 from the actual production build, Windows Chromium 154.0.8037.99, clean application source `0ea45243b8b2abd0a44ff94b4b92ecdb77a979f6`, version `20261008-10`. `report.json` records exact built asset hashes and 70 passing local browser cases. Two recipe-download cases are locally blocked by an injected browser hook and remain mandatory in Linux CI. Final integration/preview evidence is linked from [release review](../../redesign-release.md).

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

Root subsequently inspected 430px light recipe detail, 1024px dark groceries, 1280px light browse and 1920px dark settings, completing representative visual inspection at all eight required sizes. These samples had no additional material clipping or overlap findings. This is not a claim that every pixel of all 128 captures was manually inspected.

Windows WebKit exposed a pointer-focus difference absent from the passing Linux CI run: its mousedown default blurred a button before a dialog captured its opener. The shared application click-capture boundary now focuses the activated button before its action runs. All 52 WebKit behavior/recovery/theme journeys passed locally after this correction, including source return, cancel confirmation and nested cooking. The first parallel local rerun also had one browser startup crash; the complete single-worker rerun passed. Local Firefox could not launch (`spawn UNKNOWN`); Linux CI runs both Firefox and WebKit and passed at `0440d15`, with the focus-fix head requiring a fresh CI result.

New grocery options start collapsed so ingredients appear immediately; explicit old expanded/collapsed preferences remain intact. Card metadata and navigation labels are at least 12px. Recipe search controls retain their saved collapse preference, and the filter dialog preserves multiple collection selections.

## Evidence limits

Automated contrast/semantic checks do not prove full accessibility. No physical device or assistive-technology session is claimed. Browser-specific runs, original-worker lifecycle tests and final exact-head signoff are tracked separately. Data-recovery tests use isolated synthetic personal state and real public recipe content; no personal browser data is included.

## Version-10 visual pass

Root inspected the fresh 360px Light browse, 390px Dark filters, 430px Light recipe, 768px Dark cooking, 1024px Light groceries, 1280px Dark confirmation, 1440px Light planner and 1920px Dark settings captures. These cover every required size and major screen without a blocking clipping/overlap/readability finding. This is not a claim that all 128 images received pixel-by-pixel manual review. The complete matrix passed overflow and axe assertions. Earlier review history above remains historical; current CI/preview details are in #174 and the final release PR.
