# Wave66 Domain A Canvas Evaluation Foundation Report

- Verdict recommendation: `ready_for_review`
- Domain: `wave66-canvas-evaluation-foundation-v0`
- Agent: Gnome
- Date: 2026-06-13

## Changed Files

- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
  - Added `createCanvasEvaluatedScene(session, options)` adapter.
  - Added evaluated scene/drawable/mesh/texture-ref types.
  - Evaluates committed mesh or mesh draft, parameter keyforms, deformer chain, and control point preview into drawable vertices, triangles, bounds, opacity, visibility, draw order, and texture refs.
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
  - Added focused pure evaluation tests for parameter scrub, interpolation/clamp, non-mutation, parent deformer influence, rotation, control point preview, additive preview composition, mesh/rig draft inputs, and scene metadata.
- `discussion/implementation/waves/wave66/wave66-domain-a-canvas-evaluation-foundation-report.md`
  - This report.

No `canvas-renderer.ts`, save/load format, package dependency, Mesh V2.6, or `packages/**` changes were made by this Gnome.

## Loop 2 Review Fixes

Test Adequacy finding fixed:

- Adapter-level interpolation/clamp coverage:
  - Added a `createCanvasEvaluatedScene` test for in-between parameter scrub value `0`, asserting interpolated Warp vertices/bounds and effective opacity.
  - Added an outside-range parameter value `99` assertion, proving evaluation clamps through the existing parameter helper to the `param_face_angle_x` max endpoint.

Low findings fixed:

- Added `rigDraft.kind: "rotation"` coverage, asserting rotated vertices and draft opacity multiplier.
- Added control point preview over existing keyform coverage with `compositionMode: "additiveDelta"`, asserting preview offsets compose over evaluated keyform offsets.

Loop 2 touched only:

- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- `discussion/implementation/waves/wave66/wave66-domain-a-canvas-evaluation-foundation-report.md`

## Verification Commands / Results

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
  - First sandbox run: failed before config load with Windows sandbox `spawn EPERM`.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
  - Rerun outside sandbox after escalation: pass.
  - Loop 1 result: 1 test file passed, 5 tests passed.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
  - Loop 2 sandbox run: failed before config load with Windows sandbox `spawn EPERM`.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
  - Loop 2 rerun outside sandbox after escalation: pass.
  - Loop 2 result: 1 test file passed, 8 tests passed.
- `pnpm.cmd --dir apps/editor typecheck`
  - Loop 1 result: pass.
- `pnpm.cmd --dir apps/editor typecheck`
  - Loop 2 result: pass.

## Basis Coverage Self-Report

- `CanvasEvaluatedScene` boundary: implemented as editor-owned `createCanvasEvaluatedScene`.
- Input shape: accepts `AuthoringSession`, `parameterValues`, `meshDraft`, `rigDraft`, `controlPointPreview`, `selection`, and `overlayToggles`.
- Output shape: each evaluated drawable includes evaluated mesh vertices, UVs, triangles, bounds, opacity, visible, draw order, texture refs, mask source refs, and rig chain ids.
- Keyform reuse: uses existing editor helper `createEvaluatedParameterKeyformState`.
- Drawable opacity: evaluated and clamped.
- Warp offsets: evaluated through bilinear-grid-v1 style offset sampling.
- Warp opacity multiplier: multiplied into effective drawable opacity.
- Rotation angle: evaluated and applied to mesh vertices.
- Rotation opacity multiplier: multiplied into effective drawable opacity.
- Deformer chain: drawable direct parent is resolved, then ancestors are applied parent -> child -> drawable.
- Control point preview: represented as `controlPointPreview` and tested to affect evaluated geometry without mutating `AuthoringSession`.
- Interpolation and clamp path: adapter-level tests cover in-between scrub interpolation and out-of-range parameter value clamp.
- Draft coverage: tests cover both Warp and Rotation rig draft evaluation.
- Preview composition: tests cover additive control point preview over evaluated keyform offsets.
- Parameter scrub non-mutation: covered by JSON snapshot assertions before/after evaluation.

## Intentionally Deferred Basis Items

- Renderer triangle texture drawing is not implemented; this remains Domain B.
- Overlay and hit test migration to evaluated coordinates are not implemented here; this remains Domain B.
- Full deformed clipping/mask behavior is not implemented; scene keeps mask source refs for downstream composition.
- Canvas panel wiring to consume `CanvasEvaluatedScene` is not completed in Domain A; Domain B should integrate the adapter into projection/rendering.
- Exact child-local coordinate inversion for a child warp under a non-linear parent warp is a v0 residual risk. The adapter applies effects in parent-first order and covers parent influence, but Domain B/future runtime alignment should revisit precise local-space semantics.

## User Workflow Trace

- Parameter scrub:
  - Current parameter values enter `createCanvasEvaluatedScene`.
  - Existing keyform evaluation samples drawable opacity, warp offsets, warp opacity, rotation angle, and rotation opacity.
  - Evaluated drawable mesh vertices/bounds/opacity are returned without writing to session.
- Control point drag preview:
  - Drag offsets enter `controlPointPreview`.
  - Preview offsets override or add to evaluated warp offsets for the matching rig control.
  - Evaluated vertices change while the committed keyform/session remains unchanged.
- Parent/child deformer:
  - Parent rig controls are resolved before child rig controls.
  - Drawable geometry receives parent influence through the rig chain.

## Must-not Compliance Evidence

- No raw `AuthoringSession` knowledge was added to `apps/editor/src/workspace/canvas/canvas-renderer.ts`.
- No renderer triangle drawing was added.
- No save/load project format expansion was added.
- No Viewer / Runtime Preview integration was added.
- No WebGL renderer rewrite was added.
- No Mesh V2.6 implementation or package-side algorithm work was added.
- No dependency was added and `apps/editor/package.json` was not changed.
- Evaluation is pure with respect to `AuthoringSession`; focused tests assert non-mutation.

## Residual Risk Classification

- Domain A residual risk: low to medium.
- Reason:
  - Pure evaluation behavior is covered by focused tests and typecheck, including loop 2 interpolation/clamp and preview composition coverage.
  - Integration into actual Canvas rendering/overlay/hit test is intentionally deferred to Domain B.
  - Parent-first chain exists, but exact non-linear parent-local math should be revisited when renderer integration exposes more complex nested deformer cases.

## Domain B Handoff Notes

- Consume `createCanvasEvaluatedScene` from `apps/editor/src/workspace/canvas/canvas-evaluation.ts`.
- Use `CanvasEvaluatedDrawable.evaluatedMesh.vertices`, `uvs`, and `triangles` for Canvas2D triangle texture drawing.
- Use `bounds` from evaluated drawables for selection bounds and hit test migration.
- Feed active drag preview into `controlPointPreview` so artwork, not only overlay, follows pointermove.
- Preserve renderer session-free boundary: Domain B should pass evaluated scene/projection data into renderer rather than importing `AuthoringSession` into `canvas-renderer.ts`.
