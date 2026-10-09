# Redesign architecture and design decision

Decision date: 2026-10-08. Parent [#168](https://github.com/RobertCarrUTA/recipe-book/issues/168), baseline/decision [#169](https://github.com/RobertCarrUTA/recipe-book/issues/169). This records the selected direction; installation and implementation evidence must be recorded separately.

## Architecture

Use React and TypeScript with Vite to produce a static application. Use custom semantic-token CSS, native controls, selective Radix Dialog primitives, and named Lucide icons. Preserve the existing tested recipe, grocery, search, sorting, normalization, unit-conversion, planning and export modules behind a typed adapter. Keep browser storage, clipboard, downloads, wake lock and worker lifecycle at explicit boundaries. No backend, account system, router dependency, remote fonts, telemetry or runtime CDN is needed.

React was compared with [Preact](https://preactjs.com/guide/v11/differences-to-react/) and [Svelte](https://svelte.dev/docs/svelte/overview) with [Bits UI](https://www.bits-ui.com/docs/introduction). Preact offers a smaller runtime but adds a compatibility layer for the selected primitives; Svelte is credible but provides no repository-specific benefit sufficient to justify a different primitive and test ecosystem. React directly supports the selected primitives and component testing. Its extra runtime must be measured against the old app and limited by named imports and a modest dependency set.

Tailwind and shadcn were evaluated rather than installed automatically. This application has a small, heavily customized component vocabulary that shared CSS tokens can express directly. Current [shadcn Dialog documentation](https://ui.shadcn.com/docs/components/dialog) distinguishes primitive families and defaults to Base UI; it must not be assumed to generate Radix components. Direct [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) wrappers avoid copying an unused component catalog or mixing focus systems. Native selects and checkboxes remain appropriate.

| Package | Selected stable target | License / verification source |
| --- | --- | --- |
| React / React DOM | 19.3.0 | MIT; [versions](https://react.dev/versions), [license](https://github.com/facebook/react/blob/main/LICENSE) |
| Vite | 8.3.4 | MIT; [releases](https://github.com/vitejs/vite/releases), [static build/base paths](https://vite.dev/guide/build.html) |
| TypeScript | 6.0.3 | Apache-2.0; [releases](https://github.com/microsoft/TypeScript/releases). Latest is 7.0.2; bounded choice of supported 6.0 compiler avoids changing compiler generation at the same time as UI architecture. |
| Radix React Dialog | 1.2.0 | MIT; [source/license](https://github.com/radix-ui/primitives), React 19 peer verified |
| Lucide React | 1.53.0 | ISC plus MIT notices for Feather-derived icons; preserve [complete license](https://github.com/lucide-icons/lucide/blob/main/LICENSE) |
| Vitest | 5.0.3 | MIT; [requirements](https://vitest.dev/guide/), Node >=22.12 |
| React Testing Library / user-event | 16.3.3 / 14.6.7 | MIT; [source](https://github.com/testing-library/react-testing-library), [user-event](https://github.com/testing-library/user-event) |
| Playwright test | 1.64.0 | Apache-2.0; [releases](https://github.com/microsoft/playwright/releases) |
| axe-core Playwright | 4.13.0 | License to verify with installed package and transitive notices before adoption |

Official releases/docs and npm metadata were checked on the decision date; the committed lockfile will be authoritative for installed versions. Use Node >=22.12, verify engines/peers, inspect install scripts and scan the actual dependency graph. Preserve all third-party notices and the repository's existing noncommercial code/content licenses. System Georgia and system sans-serif typography require no downloaded font. No external product asset is copied.

## Boundaries and migration

- `data/recipes/*.json`, recipe IDs, source attribution, `build:recipes`, recipe schemas and normalization snapshots remain the authoring contract. Never rewrite recipe content for the redesign.
- One authoritative UI state feeds discovery, rendering and backups. Input handlers update that state immediately; expensive derived search rendering can be deferred independently. Save/export must not reread controls (#142).
- Domain models that mutate passed state receive a fresh state copy at the React boundary; no mutation of previously rendered state. Grocery totals remain derived, not imported authoritative values.
- New React components replace DOM renderers by cohesive workflow. Retain the old working application during a parallel complete vertical slice. Remove obsolete layers only when full parity is verified.
- Harden persistence before migration (#141/#172). A single versioned snapshot replaces independent durable writes; retain legacy sources for recovery. Backup schema version 1 remains independently compatible. Imports validate and stage before replacement. Reject future versions and report unavailable/corrupt storage distinctly.
- Use a same-origin external theme initializer before meaningful paint, with persisted Light/Dark/System preference and live `matchMedia` handling. Portal overlays inherit tokens from `html`. Production script CSP permits `self` and one generated exact SHA-256 hash for the small legacy-cache recovery bootstrap; never add `unsafe-eval` or script `unsafe-inline`. The bootstrap must run even when the new worker and entry chunks cannot download; see [build and offline recovery](build-and-offline.md).
- Vite output must include all essential shell chunks, manifest, icons and recipe data. Generate the worker's shell inventory from output, not a manually maintained source list. Retain the purpose of existing asset-version and integrity checks with tested output equivalents.
- Preserve clean `/recipe-book/<id>` and legacy hash links, refresh, back/forward and deployment at `/` or a configured subpath. GitHub Pages currently publishes repository root; switching production to a build artifact would require a human release decision/configuration and must not be silently performed during this assignment.
- Worker upgrades wait for an explicit Refresh action; flush state first. Use immutable release shells and scoped cache ownership, independently refreshable validated recipe data, and tests against the actual old worker. Never remove unrelated origin caches. Preview requires a separate origin because legacy localStorage keys are origin-wide.

## Design comparison

The coded study is [design/concepts.html](design/concepts.html), with `?concept=notebook` and `?concept=workbench`. Both use the same real repository recipes. It is a design study, not the finished app; decorative prototype controls do not represent implemented behavior.

**Kitchen notebook:** warm ivory/forest/rust palette, editorial Georgia headings, restrained cards and fine dividers; slim desktop navigation, readable detail columns, bottom mobile navigation. Dark mode uses deliberately chosen green-black surfaces and warm text. No fabricated recipe photography. Groceries and planning should use practical rows rather than turning every item into a large card.

**Recipe workbench:** neutral/sage palette, sans-serif headings, dense library list and persistent desktop detail pane. Mobile becomes a compact drill-in list. Faster desktop comparison is its main benefit; visual hierarchy and the three-pane model risk making cooking feel like an administrative interface.

Selected after browser review: **Kitchen notebook**. Both concepts were captured at 1440×900 and 390×844, plus notebook dark desktop, and visually inspected. It better fits the food/cooking brief and readable content at narrow widths. Borrow the workbench's row density for shopping. Corrected dark body token inheritance and duplicated serving text before recapture. Production must reduce mobile header height, enlarge metadata to 12–13px minimum, use named icons and preserve 44px primary controls. See the [review and screenshots](evidence/baseline/README.md#coded-design-comparison--prototypes-only).

Working product references: [Mela](https://mela.recipes/) for calm reading and focused steps, [Paprika](https://www.paprikaapp.com/) for recipe-to-plan-to-grocery continuity, [AnyList](https://www.anylist.com/lists) for quick checkable grouped rows, and [Crouton](https://crouton.app/) for approachable day assignment. These are makers' descriptions/screenshots of real products; native apps were not executed. Some are paid products used only as design references, not assets or dependencies.

## Verification plan

Retain all useful Node domain tests. Add strict type checking, component interaction tests, Playwright production-output journeys, reviewed screenshots, axe plus manual keyboard/contrast/reflow review, malformed/legacy/quota imports, worker upgrade/failure scenarios, root/subpath navigation, and measured resource/interaction budgets. Preserve baseline screenshots separately from new regression expectations. CI must test PRs to dev/main and dev integration. Report untested physical devices or assistive technology explicitly; no automated suite proves full accessibility or absence of defects.
