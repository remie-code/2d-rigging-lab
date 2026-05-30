# Wave 15 Domain B Completion: Created Drawable Runtime Evidence Regression

> Wave: `editor-drawable-mesh-authoring-vertical-slice`
> Domain: `wave15-created-drawable-runtime-evidence-regression`
> Verdict: `pass`
> Date: 2026-05-30

## Files Changed

- `packages/operation-core/src/created-drawable-runtime-evidence.test.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/snapshot-comparison.test.ts`
- `fixtures/contracts/created-drawable-runtime-evidence/fixture-manifest.json`
- `fixtures/contracts/created-drawable-runtime-evidence/request/create-drawable-commit.request.json`
- `fixtures/contracts/created-drawable-runtime-evidence/request/generate-mesh-commit.request.json`
- `fixtures/contracts/created-drawable-runtime-evidence/expected/created-drawable-runtime-evidence-summary.json`
- `discussion/implementation/waves/wave15/wave15-created-drawable-runtime-evidence-regression-completion.md`
- `discussion/implementation/reviews/wave15/wave15-created-drawable-runtime-evidence-regression-review.md`

## Implementation Summary

- Added a compact `created-drawable-runtime-evidence` contract fixture using the existing `minimal-valid-package` as baseline.
- Added a focused operation-core regression that commits `createDrawable` then `generateMesh` through the real operation lifecycle and evidence provider hook.
- The regression builds runtime evidence from `toRuntimeGraph(...)`, materializes runtime artifacts, builds validation reports and validation diffs, and verifies operation result evidence refs.
- The oracle proves:
  - `createDrawable` candidate runtime snapshot contains `draw_runtime_oracle` with `mesh_runtime_oracle`.
  - `generateMesh` candidate runtime snapshot keeps the drawable and changes its mesh evidence from vertexCount `0` to `4`.
  - runtime diff records added drawable evidence in `drawableChanges` and added drawList membership in `drawListChanges`.
  - validation report evidence keeps the runtime snapshot IDs for the created drawable path.
  - operation result evidence carries runtime snapshot IDs, runtime state refs, runtime state sequence refs, final runtime state ref, and validation report IDs.
- Fixed a minimal runtime-core bug: added drawables were previously omitted from `drawableChanges`; they now produce a deterministic drawable change with `vertexHashAfter`.

## Tests Run

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/snapshot-comparison.test.ts packages/operation-core/src/created-drawable-runtime-evidence.test.ts` | pass after sandbox escalation | 2 files / 5 tests passed. Initial sandbox run failed with `EPERM` reading Vitest from pnpm `node_modules`; escalated rerun passed. |
| `pnpm.cmd exec vitest run packages/operation-core/src/created-drawable-runtime-evidence.test.ts packages/operation-core/src/runtime-validation-evidence-fixture.test.ts packages/operation-core/src/persisted-operation-evidence-fixture.test.ts packages/runtime-core/src/runtime-evidence.test.ts packages/runtime-core/src/runtime-evidence-artifacts.test.ts packages/runtime-core/src/snapshot-comparison.test.ts packages/validator-core/src/runtime-evidence-report.test.ts packages/validator-core/src/validation-report-artifacts.test.ts` | pass after sandbox escalation | 8 files / 24 tests passed. Initial sandbox run failed with `EPERM` reading Vitest from pnpm `node_modules`; escalated rerun passed. |
| `pnpm.cmd exec vitest run packages/operation-core/src/created-drawable-runtime-evidence.test.ts` | pass after sandbox escalation | 1 file / 2 tests passed after artifact-content assertions were added. |
| `pnpm.cmd typecheck` | pass | Root and editor typecheck passed. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- packages/operation-core/src/created-drawable-runtime-evidence.test.ts packages/runtime-core/src/snapshot-comparison.ts packages/runtime-core/src/snapshot-comparison.test.ts fixtures/contracts/created-drawable-runtime-evidence` | pass | LF/CRLF working-copy warnings only. |

## Review Findings And Fixes Applied

- Finding: runtime snapshot comparison did not emit a dedicated `drawableChanges` entry for a newly added drawable, so createDrawable evidence depended on drawList diff only.
  - Fix: `compareRuntimeSnapshots(...)` now reports added drawables with `vertexHashAfter`.
  - Regression: `snapshot-comparison.test.ts` now covers added drawable plus drawList membership changes.
- Finding: materialized runtime artifact content should be asserted directly, not only the in-memory `RuntimeEvidenceResult`.
  - Fix: `created-drawable-runtime-evidence.test.ts` now parses candidate runtime snapshot artifacts and asserts the created drawable survives artifact materialization for both create and generate operations.

## Remaining Issues

- None blocking for Domain B.
- Snapshot IDs are still based on package ID and frame index, so the compact oracle uses the same `snap_minimal-valid-package_0/1` IDs for the create and generate operation evidence runs. Artifact refs remain operation/revision-specific.

## User-Decision Points

- None.

## Provisional Assumptions

- A `createDrawable` placeholder mesh with zero vertices is valid runtime evidence as long as the runtime snapshot contains the drawable/mesh and the later `generateMesh` operation proves generated geometry.
- The compact fixture can reuse `minimal-valid-package` as a rights-clean baseline instead of duplicating all model files.
