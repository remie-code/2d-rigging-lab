# Wave78 Domain A Test Adequacy Review

- date: 2026-06-16
- lane: `wave78-domain-a-test-adequacy-review`
- target: `wave78-warp-scale-geometry-keyform-safety-model`
- verdict: pass

## Scope

Reviewed Domain A test adequacy from the actual source/tests plus the Wave78 plan and implementation report. Gnome's report was used only as orientation.

Files inspected:

- `apps/editor/src/workspace/canvas/warp-deformer-scale.ts`
- `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts`
- `packages/authoring-core/src/keyform-mutations.test.ts`
- `packages/operation-core/src/operations/edit-keyform-key.test.ts`
- `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts`
- `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
- `packages/authoring-core/src/keyform-mutations.ts`
- `packages/authoring-core/src/linear-keyform-editing.ts`
- `packages/operation-core/src/operations/edit-keyform-key.ts`
- `discussion/implementation/waves/wave78/wave78-domain-a-warp-scale-geometry-keyform-safety-model-report.md`

Basis documents read:

- `discussion/implementation/orchestration/wave78-plan.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/operation-policy.md`

## Adequacy Matrix

| Requirement | Evidence | Result |
|---|---|---|
| left/right/top/bottom edge scale | Edge parameterized cases cover all four handles and include orthogonal drag deltas in `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:11` and `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:53`. | adequate |
| all four corner handles | Corner parameterized cases cover top-left, top-right, bottom-left, and bottom-right in `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:70` and `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:111`. | adequate |
| 2x2 and non-square 3x2 lattice | 2x2 is used for edge/corner cases; 3x2 full-array behavior is covered in `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:130`. | adequate |
| all-points scaling and opposite side/corner fixed behavior | Expected full arrays assert fixed opposite side/corner and transformed interior points; 3x2 right-edge case proves a middle column is scaled, not only edge points. | adequate |
| unchanged orthogonal axis for edge handles | Edge tests pass large orthogonal drag values and assert unchanged orthogonal offsets in `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:11`. Source also leaves an axis untransformed when no transform is configured in `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:130` and `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:140`. | adequate |
| zero/near-zero span guard | Zero and near-zero source spans are rejected deterministically in `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:252`. | adequate |
| non-finite/cardinality mismatch guard | Cardinality mismatch is covered in `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:212`; non-finite values are covered in `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:231`. | adequate |
| helper returns full arrays and does not mutate inputs | Full 3x2 output is asserted in `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:130`; input immutability and new offset objects are asserted in `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:184`. | adequate |
| zero-offset keys are scalable by point-position semantics | Zero-offset edge/corner cases produce non-zero offsets; the source-point semantics are directly covered in `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:159`. | adequate |
| package-level full-offset cardinality rejection | Authoring mutation rejects a 3-entry patch for a 2x2 Warp lattice in `packages/authoring-core/src/keyform-mutations.test.ts:81`; production validation checks all key patches in `packages/authoring-core/src/keyform-mutations.ts:160` and `packages/authoring-core/src/keyform-mutations.ts:187`. | adequate |
| operation-level full-offset cardinality rejection | Operation test rejects a short Warp `controlPointOffsets` patch without mutation in `packages/operation-core/src/operations/edit-keyform-key.test.ts:310`. This uses `addCurrent`, but source review shows the validation is shared before action-specific create/update/delete handling in `packages/authoring-core/src/linear-keyform-editing.ts:80`, `packages/authoring-core/src/linear-keyform-editing.ts:358`, `packages/authoring-core/src/linear-keyform-editing.ts:412`, and `packages/authoring-core/src/linear-keyform-editing.ts:511`. | adequate |
| existing Warp point drag regression remains covered | Existing multi-point drag commit/undo and off-key direct drag block tests remain in `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:124` and `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:181`. | adequate |
| runtime invalid cardinality regression remains covered | Runtime valid Warp sampling and invalid cardinality blocking remain covered in `packages/runtime-core/src/rig-control-keyform-evidence.test.ts:393` and `packages/runtime-core/src/rig-control-keyform-evidence.test.ts:458`. | adequate |
| report command sufficiency | The implementation report records focused new tests, existing regression tests, typecheck, source organization, dependency, and diff checks in `discussion/implementation/waves/wave78/wave78-domain-a-warp-scale-geometry-keyform-safety-model-report.md:73`. | adequate |

## Commands Run

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts packages/authoring-core/src/keyform-mutations.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
  - sandbox result: failed during Vitest config load with `spawn EPERM` from esbuild.
  - escalated rerun result: pass, 5 files / 46 tests.

## Findings

No blocking test adequacy findings.

The only noteworthy review judgment is that operation invalid-cardinality coverage is not duplicated for `updateCurrent`, which Domain B will use for scale commits. I do not consider that a required change for Domain A because the authoring-core validation is shared before action-specific mutation handling, and the operation test already proves the operation gateway maps that rejection to `operation.editKeyformKey.invalidPatchShape` without mutation.

## Residual Risks

- Domain B still owns off-key scale handle unavailability, handle hit priority, pointermove preview, pointerup single commit, and pointercancel discard coverage.
- The edge orthogonal-axis tests use zero baseline offsets but intentionally include non-zero orthogonal drag deltas; source review confirms the inactive axis is preserved.
- The implementation report records an unrelated app-specific `tsc -p apps/editor/tsconfig.json` failure. That is not a Domain A test adequacy blocker because focused Domain A tests and repo typecheck evidence are present in the report.
