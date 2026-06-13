# Wave66 Domain A Test Adequacy Review

verdict: `pass`

Loop: 2 final re-review

## Loop History Summary

- Loop 1 verdict was `needs_changes`.
- Loop 1 blocking issue: adapter-level interpolation/clamp coverage was missing for `AuthoringSession + parameterValues -> CanvasEvaluatedScene`.
- Loop 1 low warnings: rotation `rigDraft.kind: "rotation"` branch and preview-over-existing-keyform composition were not directly tested.
- Loop 2 Gnome changed tests/report only. The source implementation file `apps/editor/src/workspace/canvas/canvas-evaluation.ts` was not part of the loop 2 fix scope per the handoff.
- Loop 2 adds 3 focused tests, raising the focused file from 5 to 8 tests. The prior blocking and low coverage gaps are now covered.

## Evidence Reviewed

- Basis:
  - `discussion/implementation/orchestration/wave66-plan.md` lines 91-103, 147-168, 207-223, 255-305, 442-507, 509-525.
  - `discussion/implementation/waves/wave66/wave66-preplan-canvas-evaluation-inventory.md` lines 47-85.
  - `discussion/design/canvas-evaluation/canvas-evaluation-pipeline-v0.md` lines 35-192 and 241-280.
  - `discussion/design/screen-design/components/canvas-preview.md` lines 5-83 and 145-151.
  - `discussion/design/screen-design/components/parameter-keyform.md` lines 31-135, 206-234, 341-356.
  - `discussion/design/screen-design/components/rig-tool.md` lines 63-147, 234-333, 393-475.
- Source and tests:
  - `apps/editor/src/workspace/canvas/canvas-evaluation.ts`.
  - `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`.
  - `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`.
  - `packages/authoring-core/src/parameter-surface.ts`.
  - `packages/package-format/src/parameter-presets.ts`.
  - Gnome report `discussion/implementation/waves/wave66/wave66-domain-a-canvas-evaluation-foundation-report.md`.
  - Prior report `discussion/implementation/reviews/wave66/wave66-domain-a-test-adequacy-review.md`.
- Diff reproduction:
  - `git diff --no-index -- NUL apps\editor\src\workspace\canvas\canvas-evaluation.ts`.
  - `git diff --no-index -- NUL apps\editor\src\workspace\canvas\canvas-evaluation.test.ts`.
  - `git diff --no-index -- NUL discussion\implementation\waves\wave66\wave66-domain-a-canvas-evaluation-foundation-report.md`.
  - All three returned exit code 1 as expected for new-file differences against `NUL`; full new-file diffs were reviewed. Git also emitted LF-to-CRLF working-copy warnings, which do not affect test adequacy.

## Requirement-to-Test Coverage

| Requirement | Basis | Observed coverage | Assessment |
|---|---|---|---|
| Pure evaluation tests pass | Wave plan lines 290-292 | Focused Vitest now reports 1 file / 8 tests passed. | Covered. |
| Parameter scrub changes evaluated bounds / vertices / opacity | Wave plan lines 149-168, 292-294; pipeline lines 81-100, 151-160 | Endpoint scrub test asserts moved bounds/vertex and effective opacity at `canvas-evaluation.test.ts` lines 40-90. Loop 2 in-between test asserts interpolated vertex, bounds, and opacity at lines 122-162. | Covered. |
| Adapter-level in-between keyform interpolation | Preplan lines 70-74; pipeline lines 83-91, 265-266 | `parameterValues: { [FACE_ANGLE_X]: 0 }` is evaluated through `createCanvasEvaluatedScene` at `canvas-evaluation.test.ts` lines 143-148, with interpolated geometry/opacity assertions at lines 156-158. | Fixed in loop 2. |
| Adapter-level out-of-range parameter clamp | Preplan lines 70-74; pipeline lines 90-91 | `parameterValues: { [FACE_ANGLE_X]: 99 }` is evaluated at `canvas-evaluation.test.ts` lines 149-154, with max-endpoint assertions at lines 159-161. The adapter calls `createEvaluatedParameterKeyformState` at `canvas-evaluation.ts` lines 157-160; that helper resolves and clamps parameter values at `parameter-keyform-state.ts` lines 433-458 and 146-154. Empty fixtures still include `param_face_angle_x` through preset initialization at `parameter-surface.ts` lines 11-14 and `parameter-presets.ts` lines 29-34, 138-149, 180-198. | Fixed in loop 2. |
| Parameter scrub does not mutate `AuthoringSession` | Wave plan lines 153, 167, 294; pipeline lines 275-277 | JSON snapshot before/after assertions at `canvas-evaluation.test.ts` lines 60 and 90. | Covered. |
| Drag preview does not mutate `AuthoringSession` | Wave plan lines 168, 216-220; pipeline lines 174-190 | Control point preview test records `before` at `canvas-evaluation.test.ts` line 215 and asserts unchanged session at line 233. | Covered. |
| Parent deformer influence reaches child/drawable | Wave plan lines 166, 282-284, 295; pipeline lines 109-127 | Parent/child rig chain test builds parent -> child -> drawable at `canvas-evaluation.test.ts` lines 93-110 and asserts chain ids plus moved vertex/bounds at lines 117-119. | Covered for Domain A v0. |
| Control point preview is represented as input | Wave plan lines 158-160, 286-288, 296; pipeline lines 65-79, 174-190 | Option/type shape is present at `canvas-evaluation.ts` lines 70-109. Runtime input is exercised at `canvas-evaluation.test.ts` lines 209-233. | Covered. |
| Preview-over-existing-keyform composition | Pipeline lines 132-135 | Loop 2 test adds committed warp keyform offsets at `canvas-evaluation.test.ts` lines 236-247, passes `compositionMode: "additiveDelta"` at lines 249-255, and asserts composed evaluated geometry/bounds at lines 259-260. Source composition path is `canvas-evaluation.ts` lines 694-708. | Fixed in loop 2. |
| Evaluated drawable output includes geometry, opacity, visibility, draw order, texture refs | Wave plan lines 158-160, 274-276; pipeline lines 35-64 | Output types include evaluated mesh vertices/UVs/triangles/bounds, opacity, visibility, draw order, and texture refs at `canvas-evaluation.ts` lines 25-62. Tests assert vertices, triangles, texture refs, draw order, visibility, and bounds at `canvas-evaluation.test.ts` lines 71-89 and 156-161. | Covered. |
| Drawable opacity, warp offsets, warp opacity multiplier | Wave plan lines 161-165, 278-280; pipeline lines 93-100, 151-160 | Test keyforms at `canvas-evaluation.test.ts` lines 46-58 and assertions at lines 71-73; interpolation/clamp assertions at lines 156-161. | Covered. |
| Rotation angle and rotation opacity multiplier | Wave plan lines 164-165, 278-280; pipeline lines 140-149 | Rotation keyform test at `canvas-evaluation.test.ts` lines 164-187 asserts rotated vertices and opacity multiplier. | Covered. |
| Rotation `rigDraft.kind: "rotation"` branch | Pipeline lines 174-184 | Loop 2 test passes rotation draft at `canvas-evaluation.test.ts` lines 189-201 and asserts rotated vertices/opacity at lines 204-206. Source branch is `canvas-evaluation.ts` lines 386-409. | Fixed in loop 2. |
| `meshDraft`, `rigDraft`, control point preview input shape | Wave plan lines 158-160, 286-288; pipeline lines 65-79, 174-184 | Option and union types are at `canvas-evaluation.ts` lines 70-109. Control point preview is tested at `canvas-evaluation.test.ts` lines 209-233; mesh draft + warp rig draft at lines 263-291; rotation rig draft at lines 189-207. | Covered. |
| Forbidden Domain B / integration items are not claimed as done | Wave plan lines 298-305 and Domain B lines 306-360 | Tests remain pure evaluation tests. Gnome report defers renderer, overlay, hit test, clipping, and panel wiring at lines 74-80. | Covered; no false Domain B completion claim found. |

## Remaining Findings

No blocking or low findings remain for Domain A test adequacy.

The earlier medium finding is resolved by `canvas-evaluation.test.ts` lines 122-162. The earlier low warnings are resolved by `canvas-evaluation.test.ts` lines 189-207 and 236-260.

## Verification Commands / Results Assessment

- Review-Sylph rerun: `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`.
  - Sandbox result: failed before config load with Windows `spawn EPERM`.
  - Escalated rerun result: pass, 1 test file passed, 8 tests passed.
  - Assessment: the sandbox failure is an environment startup limitation, not a test failure. The escalated run verifies the loop 2 focused tests.
- Review-Sylph rerun: `pnpm.cmd --dir apps/editor typecheck`.
  - Sandbox result: pass.
  - Assessment: supports the option/input/output shape and TypeScript integration claims.
- Gnome-reported loop 2 verification is consistent with the rerun:
  - Focused Vitest: sandbox `spawn EPERM`, escalated pass, 1 file / 8 tests passed.
  - Editor typecheck: pass.

## Residual Risks

- Renderer triangle texture drawing, evaluated overlay, hit test migration, viewport preservation, and live Canvas UI wiring remain untested in this lane. This is acceptable for Domain A because Wave66 assigns those to Domain B.
- Deformed clipping/mask pixel behavior is not tested. This is acceptable for Domain A because v0 keeps mask refs/composition slots and does not require full deformed mask rendering.
- Parent/child coverage proves parent influence and chain order for a simple parent warp. Exact non-linear parent-local semantics remain a future/runtime-alignment risk, consistent with Gnome's report. This is acceptable for Domain A v0 because the current basis requires parent influence and order, not full runtime parity.
- Mesh draft and rig draft are covered as input/evaluation shapes. Only control point drag preview and parameter scrub have explicit non-mutation assertions, matching the re-review focus. Implementation uses cloned/read-only evaluation paths; this residual is acceptable for Domain A.

## Domain B Readiness Recommendation

Domain A is test-adequate for the Domain B gate.

Domain B may consume `createCanvasEvaluatedScene`, but must add its own renderer, overlay, hit test, viewport preservation, and live drag preview integration tests. Domain B must not count these Domain A pure evaluation tests as rendering or interaction coverage.
