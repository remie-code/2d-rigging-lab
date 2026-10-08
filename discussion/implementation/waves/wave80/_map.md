# Wave80 Implementation Map

> Lightweight map for Wave80 `viewer-interaction-controls-density-followup` implementation artifacts.

## Entry Points

- Plan: [../../orchestration/wave80-plan.md](../../orchestration/wave80-plan.md)
- Final integration report: [wave80-final-integration-report.md](wave80-final-integration-report.md)
- Review map: [../../reviews/wave80/_map.md](../../reviews/wave80/_map.md)
- Final clean review: [../../reviews/wave80/wave80-final-clean-integration-review.md](../../reviews/wave80/wave80-final-clean-integration-review.md)

## Domain Reports

| Path | Domain | Status |
|---|---|---|
| [wave80-domain-a-viewer-interaction-controls-density-followup-report.md](wave80-domain-a-viewer-interaction-controls-density-followup-report.md) | Viewer Interaction + Runtime Controls Density Follow-up | pass |
| [wave80-final-integration-report.md](wave80-final-integration-report.md) | Final Integration / Clean Review / Map Closeout | final complete / pass |

## Current State

- Domain A completed with all required review lanes passing.
- Domain B final verification passed: root typecheck, focused Viewer tests, source organization guard, dependency guard, and `git diff --check`.
- Final clean integration review is recorded as `pass`.
- Wave80 overall status: final complete / pass.

## Residual Risks

- Browser-event and pixel/layout smoke were not run.
- `git diff --check` has the normal limitation that untracked file content is not inspected.
- Wave80-era out-of-scope snapshot: runtime-core full parity, grid2d parity, dynamics, export, mesh/deformer/keyform authoring, parameter grouping/favorites, and save/load schema changes were outside this wave. Later Wave84 added Viewer Dynamics playback and Wave92 added Runtime Export; do not read this line as current product scope.
