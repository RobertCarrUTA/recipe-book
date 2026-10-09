# Visual regression baseline

`chromium-linux/` contains 128 production-browser captures: eight screens at all
eight required viewports in Light and Dark. They were extracted from successful
[CI run 37867107467](https://github.com/RobertCarrUTA/recipe-book/actions/runs/37867107467)
for PR #177 head `c1c9eaca134461c8134b6887e5abfe998aed63fe`, tested merge
`8000803a5d867324f90998038611c62b7b592457`. The run passed all 68 browser cases,
including overflow and axe assertions. Environment: Ubuntu GitHub runner,
Playwright 1.64.0 Chromium 156.0.8078.4, default device scale, reduced motion.

Root visually reviewed these Linux samples before accepting the initial baseline:
360 light browse, 390 dark filters, 430 light recipe, 768 dark cooking, 1024 light
groceries, 1280 dark confirmation, 1440 light planner and 1920 dark settings.
All eight screens and sizes are represented; the earlier Windows review covers
additional palette/state combinations. No material clipping or overlap was found
in those samples. Not every image was manually inspected pixel by pixel.

The Linux Chromium CI smoke job sets `VISUAL_REGRESSION=1` to compare these images.
The per-pixel color threshold is 0.2 and at most 0.1% of pixels may differ;
structural/axe assertions still run independently. The baseline is intentionally
platform-specific because system-font rasterization differs on Windows. Other
browser/platform runs exercise behavior, semantics and reflow without claiming
pixel identity to Linux.

On Linux with the pinned browser installed, build then run:

```sh
VISUAL_REGRESSION=1 npx playwright test --project=chromium --grep 'complete screen and accessibility matrix'
```

Do not update snapshots merely to turn a failure green. Inspect actual/diff images,
resolve unexpected changes, document intentional design changes and their source
commit, then review regenerated expectations. CI does not update baselines.
