# Completed redesign

The redesign merged into `main` in [PR #180](https://github.com/RobertCarrUTA/recipe-book/pull/180)
on 2026-10-08 (America/Chicago; 2026-10-09 UTC), at
`fa5377b6c952e179d24ab740cde4377273c1d954`.
[Epic #168](https://github.com/RobertCarrUTA/recipe-book/issues/168) and
[delivery #174](https://github.com/RobertCarrUTA/recipe-book/issues/174) record the
work. The [architecture decision](architecture-decisions.md) explains the chosen
stack and Kitchen notebook design.

That release uses app version `20261008-10`, clean source
`e0ad7858b9232f38fb2ae6541cc3b3ea85f48447`, and release identity
`195518e6ee331c5c71aaf36b`. Source provenance and the merge commit are distinct;
see [deployment](deployment.md#versioning-staging-and-reproducibility).
[Final dev checks](https://github.com/RobertCarrUTA/recipe-book/actions/runs/37871764602)
and [PR checks](https://github.com/RobertCarrUTA/recipe-book/actions/runs/37872178491)
passed. These are historical results, not substitutes for checking future changes
or the real production origin.

## Archived evidence

One-time review screenshots, prototypes, and execution reports were removed from
the current tree in [cleanup #181](https://github.com/RobertCarrUTA/recipe-book/issues/181).
They remain accessible at the immutable release commit:

- [Original UI, baseline runner, and concept captures](https://github.com/RobertCarrUTA/recipe-book/tree/fa5377b6c952e179d24ab740cde4377273c1d954/docs/evidence/baseline).
- [Design prototypes](https://github.com/RobertCarrUTA/recipe-book/tree/fa5377b6c952e179d24ab740cde4377273c1d954/docs/design).
- [128 redesigned UI review captures](https://github.com/RobertCarrUTA/recipe-book/tree/fa5377b6c952e179d24ab740cde4377273c1d954/docs/evidence/redesign-ui).
- [Early performance comparison](https://github.com/RobertCarrUTA/recipe-book/tree/fa5377b6c952e179d24ab740cde4377273c1d954/docs/evidence/redesign-performance) and [final measurements, including the corrected loading-shift failure](https://github.com/RobertCarrUTA/recipe-book/tree/fa5377b6c952e179d24ab740cde4377273c1d954/docs/evidence/release-performance).
- [Offline review](https://github.com/RobertCarrUTA/recipe-book/blob/fa5377b6c952e179d24ab740cde4377273c1d954/docs/redesign-offline-review.md), [security and attribution review](https://github.com/RobertCarrUTA/recipe-book/blob/fa5377b6c952e179d24ab740cde4377273c1d954/docs/redesign-security-review.md), [release review](https://github.com/RobertCarrUTA/recipe-book/blob/fa5377b6c952e179d24ab740cde4377273c1d954/docs/redesign-release.md), and [execution record](https://github.com/RobertCarrUTA/recipe-book/blob/fa5377b6c952e179d24ab740cde4377273c1d954/docs/redesign-state.md).

Archived reports describe their checkpoints, including then-pending release work.
The merged PR above establishes completion. Review screenshots from Windows are
separate from the maintained Linux [visual regression goldens](../tests/e2e/__snapshots__/README.md).
Those 128 PNG test inputs remain committed. The unchanged
[performance baseline](../tests/fixtures/performance-baseline.json) remains an
input to the [measurement runner](performance-budgets.md).

For ongoing work, use the [capability/test matrix](preservation-matrix.md),
[data recovery contract](data-recovery.md), and [build/offline guide](build-and-offline.md).
New diagnostic output belongs in ignored `test-results/` and CI artifacts, with
results linked from the relevant PR. Deleting old files does not rewrite Git
history or reduce the size of historical clones.
