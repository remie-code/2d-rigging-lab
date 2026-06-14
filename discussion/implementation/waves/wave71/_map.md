# Wave71 Implementation Map

> Local map for Wave71 `mesh-generation-v6d-adaptive-staggered-band` implementation artifacts.

## Entry Points

- Plan: [../../orchestration/wave71-plan.md](../../orchestration/wave71-plan.md)
- Design basis: [../../../design/mesh-generation/auto-outline-v6d-adaptive-staggered-band.md](../../../design/mesh-generation/auto-outline-v6d-adaptive-staggered-band.md)
- Final clean review: [../../reviews/wave71/wave71-final-clean-integration-review.md](../../reviews/wave71/wave71-final-clean-integration-review.md)

## Status

| Artifact | Status | Notes |
|---|---|---|
| [wave71-domain-a-adaptive-staggered-band-backend-default-route-report.md](wave71-domain-a-adaptive-staggered-band-backend-default-route-report.md) | `pass` | Domain A added the new adaptive staggered-band backend, Operation/Core alignment, Editor default route, and focused tests. |
| [wave71-final-integration-report.md](wave71-final-integration-report.md) | `pass` | Domain B final validation, independent clean review consumption, child closeout, and map closeout. |

## Current State

- New method/source/backend ids are implemented:
  - `auto-outline-v6d-adaptive-staggered-band`
  - `outline-v6d-adaptive-staggered-band-rgba`
  - `v6d-adaptive-staggered-band`
- Wave70 support-ring v6D remains registered, routed, and used as fallback before coarse fallback.
- Adaptive density uses the tuned `high` / `medium` / `low` values as reference baselines and scales by component/alpha-bounds area.
- The staggered alpha-to-inner strip is explicit, diagnosed, and test-covered.
- Editor Mesh Tool default preview/apply route uses the new method while preserving visible presets and keeping algorithm selection UI absent.
- Domain A review lanes pass:
  - Spec Compliance Review: `pass`
  - Design / Development Compliance Review: `pass`
  - Test Adequacy Review: `pass`
- Domain B final validation passes:
  - `pnpm.cmd typecheck`
  - focused authoring-core / operation-core / editor model-command Vitest, 4 files / 112 tests after approved sandbox-EPERM rerun
  - focused PSD import e2e, 9 tests after approved sandbox-EPERM rerun
  - source organization guard, dependency guard, and `git diff --check`
- Independent final clean integration review passes.

## Next Actions

1. Wave71 is closed as final `pass`.
2. Later human visual review can tune adaptive clamp ranges, partial local strip output, or a second inner support ring if broad artwork inspection shows a need.

## Unresolved Questions

- None blocking Wave71 final acceptance.
