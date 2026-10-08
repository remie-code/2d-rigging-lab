# Wave78 Domain A Spec Compliance Review

- lane: Spec Compliance Review
- target: `wave78-warp-scale-geometry-keyform-safety-model`
- verdict: pass
- reviewer: Review-Sylph

## Scope Reviewed

Primary target files:

- `apps/editor/src/workspace/canvas/warp-deformer-scale.ts`
- `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts`
- `packages/authoring-core/src/keyform-mutations.test.ts`
- `packages/operation-core/src/operations/edit-keyform-key.test.ts`
- `discussion/implementation/waves/wave78/wave78-domain-a-warp-scale-geometry-keyform-safety-model-report.md`

Relevant existing files inspected:

- `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts`
- `apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts`
- `packages/authoring-core/src/keyform-mutations.ts`
- `packages/authoring-core/src/linear-keyform-editing.ts`
- `packages/operation-core/src/operations/edit-keyform-key.ts`
- `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`

Basis documents read:

- `discussion/implementation/orchestration/wave78-plan.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`

## Requirement Classification

| Requirement | Classification | Evidence |
| --- | --- | --- |
| Pure helper computes scaled full `controlPointOffsets` from rest points, current offsets, and handle movement. | implemented | `computeWarpDeformerScaledControlPointOffsets` is a pure helper with those inputs and `nextOffsets` output in `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:71`; full output loop is at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:150`. |
| Source points are computed as `restControlPoints[i] + controlPointOffsets[i]`. | implemented | Source points are built at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:119`; regression coverage is in `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:159`. |
| Bounds are computed from all source points. | implemented | The helper pushes every current point before calling `getPointBounds(currentPoints)` at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:106` and `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:129`. |
| Left/right edge handles scale X only with the opposite side fixed. | implemented | Left/right map to `movingX` at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:196`; fixed X coordinate selection and scale math are at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:229`; tests cover left/right with Y deltas ignored at `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:11`. |
| Top/bottom edge handles scale Y only with the opposite side fixed. | implemented | Top/bottom map to `movingY` at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:200`; fixed Y coordinate selection and scale math are at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:267`; tests cover top/bottom with X deltas ignored at `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:32`. |
| Corner handles scale X/Y with the opposite corner fixed. | implemented | Four corner handles configure both axes at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:204`; tests cover all four corners at `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:70`. |
| Orthogonal axis remains unchanged for edge handles. | implemented | Omitted axis returns no transform at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:225` and `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:263`; tests use large orthogonal deltas and expect no orthogonal offset change at `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:14` and `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:34`. |
| All control points are transformed. | implemented | The output loop iterates over `currentPoints.length` at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:150`; 3x2 full output coverage is at `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:130`. |
| Selected control point state does not affect scale output. | implemented | The scale helper has no selection input and always maps all points in `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:150`; selection-aware point drag remains separate in `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts`. |
| New offsets are computed as `scaledP - restPoint`. | implemented | `nextOffset` is derived from `scaledPoint - restPoint` at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:162`. |
| Raw offset-vector multiplication is not used; zero-offset keys scale. | implemented | Geometry is based on current positions and then subtracts rest at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:119` and `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:162`; zero-offset edge/corner tests expect nonzero new offsets at `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:11` and `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:70`; nonzero raw-offset regression is at `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:159`. |
| Zero/near-zero span, non-finite values, invalid lattice dimensions, invalid handles, and cardinality mismatch are guarded deterministically. | implemented | Guards are result values, not exceptions, at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:79`, `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:88`, `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:93`, `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:110`, `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:229`, and `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:267`; tests cover these at `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:212`, `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:231`, `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:252`, and `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:301`. |
| `domainBounds`, `restControlPoints`, and lattice row/column counts are not mutated. | implemented | Helper only reads inputs and constructs `nextOffsets`; immutability coverage is at `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts:184`. No rest/domain/lattice mutation operation was introduced. |
| Selected-control-point-only scale and Alt/Shift semantics are not added. | implemented | No selection or modifier inputs exist in `ComputeWarpDeformerScaledControlPointOffsetsInput`; plan marks these as must-not items in `discussion/implementation/orchestration/wave78-plan.md:209`. |
| Domain A does not integrate Canvas handles, pointer gestures, or off-key behavior. | deferred by plan | Wave78 plan assigns handle rendering, hit testing, preview, commit-once, cancel, and off-key availability to Domain B at `discussion/implementation/orchestration/wave78-plan.md:173` and `discussion/implementation/orchestration/wave78-plan.md:217`; Domain A expected areas are pure helper and safety tests at `discussion/implementation/orchestration/wave78-plan.md:285`. |
| Existing `editKeyformKey(updateCurrent)` remains the intended commit path; no new operation type is introduced. | implemented | Existing gesture still commits through `commitEditKeyformKey(createEditKeyformPayload({ action: "updateCurrent" ... }))` at `apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts:23`; operation handler remains `operationType: "editKeyformKey"` at `packages/operation-core/src/operations/edit-keyform-key.ts:36`. Search for Warp scale operation names under operation/session code returned no matches. |
| Full-offset cardinality shape is guarded at helper, package, operation, and runtime layers. | implemented | Helper cardinality guard is at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:93`; package create guard is at `packages/authoring-core/src/keyform-mutations.ts:185`; authoring edit guard is at `packages/authoring-core/src/linear-keyform-editing.ts:407` and `packages/authoring-core/src/linear-keyform-editing.ts:511`; operation maps this to `operation.editKeyformKey.invalidPatchShape` at `packages/operation-core/src/operations/edit-keyform-key.ts:346`; tests cover package and operation rejection at `packages/authoring-core/src/keyform-mutations.test.ts:81` and `packages/operation-core/src/operations/edit-keyform-key.test.ts:310`; runtime invalid cardinality coverage exists at `packages/runtime-core/src/rig-control-keyform-evidence.test.ts:458`. |
| Runtime sampling still applies scaled/full offsets deterministically. | implemented | Existing runtime evidence applies full `controlPointOffsets` samples and asserts deterministic snapshots/diffs at `packages/runtime-core/src/rig-control-keyform-evidence.test.ts:393`; invalid cardinality blocks deterministically at `packages/runtime-core/src/rig-control-keyform-evidence.test.ts:458`. |
| Save/load behavior remains covered by existing keyform persistence path. | not relevant | Domain A did not change package save/load or keyform serialization. It returns the same `controlPointOffsets` patch shape used by existing keyform paths. |
| AdditiveDelta authoring expansion is not broadened. | explicit non-goal | The plan says additiveDelta support is out of scope unless already transparently handled; Domain A does not add additiveDelta-specific scale semantics. Existing package helpers already allow `replace` and `additiveDelta` for Warp offset keyforms at `packages/authoring-core/src/keyform-mutations.ts:178` and `packages/authoring-core/src/linear-keyform-editing.ts:409`. |

## Findings

No blocking spec-compliance findings.

## Commands Run

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts packages/authoring-core/src/keyform-mutations.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
  - First sandbox attempt failed with `spawn EPERM` while loading Vitest config via esbuild.
  - Re-run outside sandbox with approval: pass, 4 files / 42 tests.
- `pnpm.cmd typecheck`
  - pass.
- `git diff --check -- apps/editor/src/workspace/canvas/warp-deformer-scale.ts apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts packages/authoring-core/src/keyform-mutations.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts discussion/implementation/waves/wave78/wave78-domain-a-warp-scale-geometry-keyform-safety-model-report.md`
  - pass with existing LF/CRLF normalization warnings for the two package test files.
- `rg -n "warp.*scale|scale.*warp|WarpScale|warpScale|scaleWarp" packages/operation-core packages/contracts apps/editor/src/features/editor-session/model`
  - no matches.

## Residual Risks

- Domain B still owns exact-key editability, off-key handle unavailability, handle hit priority, pointermove preview, pointerup single commit, pointercancel discard, and visual styling.
- Domain B must pass `dragDeltaCanvas` in the same coordinate space as existing Warp point dragging.
- The pure helper exposes deterministic failure reasons; Domain B still needs to decide how failed scale attempts are surfaced or ignored during interaction.
