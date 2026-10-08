# Wave78 Domain B Spec Compliance Review

- lane: Spec Compliance Review
- target: `wave78-canvas-keyed-warp-scale-handles-gesture-integration`
- verdict: pass
- reviewer: Review-Sylph

## Scope Reviewed

Source and tests inspected directly:

- `apps/editor/src/workspace/canvas/warp-deformer-scale.ts`
- `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- relevant existing gesture, parameter, rotation, and control-point helpers

Basis documents read:

- `discussion/implementation/orchestration/wave78-plan.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/implementation/waves/wave78/wave78-domain-a-warp-scale-geometry-keyform-safety-model-report.md`
- `discussion/implementation/reviews/wave78/wave78-domain-a-spec-compliance-review.md`
- `discussion/implementation/waves/wave78/wave78-domain-b-canvas-keyed-warp-scale-handles-gesture-integration-report.md`

Additional entry/policy context read:

- `discussion/_conventions.md`
- `discussion/_map.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/discussion-management/SKILL.md`

## Requirement Classification

| Requirement | Classification | Evidence |
| --- | --- | --- |
| Scale handles appear for editable committed Warp Deformers only at exact keyform positions. | implemented | The edit state is only created for committed Warp overlays at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:608`; `editable` requires the existing keyform edit gate at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:202`; scale visibility combines editability and lattice availability at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:204`. Exact-key editability is defined by `hasCurrentKeyform` at `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:326`. Test coverage is at `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:205`. |
| Scale handles unavailable/off-key when `canEditValue === false`. | implemented | `canCommitWarpControlPointOffsetUpdate` returns true only when `projection.canEditValue` and `parameter` are present at `apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts:15`; scale hit entry is gated by `scaleHandlesVisible` and the same commit gate at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:233` and `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:241`. Off-key test coverage is at `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:229`. |
| Hit priority: corner scale handle -> edge scale handle -> control point -> marquee. | implemented | Pointerdown tests scale handles before control points at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:233`, then control points at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:280`, then marquee fallback at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:333`. Scale hit testing checks corners before edges at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:695`. Tests cover corner and edge priority at `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:252` and `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:325`. |
| Dragging a handle previews scaled Warp lattice offsets on Canvas. | implemented | Scale-drag pointermove computes scaled offsets through the Domain A helper at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:424`, stores them in the existing gesture preview path at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:442`, and sets preview state at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:445`. The hook feeds preview into Canvas evaluation as `replaceEvaluated` at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:168`; evaluation composes the preview at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:392` and `apps/editor/src/workspace/canvas/canvas-evaluation.ts:899`. Tests assert preview offsets and evaluated geometry at `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:297` and `apps/editor/src/workspace/canvas/canvas-projection.test.ts:656`. |
| Pointerup commits exactly once through existing gesture/history path. | implemented | Canvas pointerup calls `finishPointerDrag(..., { commit: true })` at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:743`. Scale drag commits only through `input.commitGestureController(drag.controller)` at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:501`. The reused Warp gesture calls `commitEditKeyformKey` with `action: "updateCurrent"` at `apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts:23`; the controller enforces `commitOnce` at `apps/editor/src/features/editor-session/model/editor-session-gesture-commit.ts:60`. Commit-once test coverage is at `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:305`. |
| Pointercancel clears preview without commit. | implemented | Canvas pointercancel passes `commit: false` at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:732`. Scale finish always clears preview, and the commit branch requires `eventInput.commit` at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:501`. Test coverage is at `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:364`. |
| Existing point drag and marquee selection remain usable. | implemented | Existing point-drag setup remains at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:280`, point preview remains at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:393`, point commit remains at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:486`, and marquee fallback/selection remains at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:333` and `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:514`. Existing tests cover marquee and point drag at `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:110` and `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:136`. |
| Existing Rotation Deformer interaction priority remains intact. | implemented | `CanvasPreviewPanel` still delegates pointerdown, pointermove, and finish to Rotation before Warp at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:379`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:415`, and `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:467`. Focused rotation regression tests passed. |
| Styling distinguishes keyed lattice transform handles from rest frame resize handles. | implemented | Renderer draws scale handles only when interaction says they are visible at `apps/editor/src/workspace/canvas/canvas-renderer.ts:352`. It uses amber rectangular edge/corner handles with hover styling at `apps/editor/src/workspace/canvas/canvas-renderer.ts:366`, distinct from Warp control point circles drawn at `apps/editor/src/workspace/canvas/canvas-renderer.ts:701` and domain/rest grid strokes at `apps/editor/src/workspace/canvas/canvas-renderer.ts:320`. |
| Always scales all control points. | implemented | The scale helper loops over every current point and returns a full `nextOffsets` array at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:150`. Domain B passes full lattice dimensions and full base offsets without selected indices at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:431`. Tests assert a 3x3 full preview at `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:350`. |
| Source points are `restControlPoints + currentOffsets` and commit payload is full `controlPointOffsets`. | implemented | The helper constructs current source points as rest plus offset at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:106` and derives next offsets as scaled point minus rest point at `apps/editor/src/workspace/canvas/warp-deformer-scale.ts:150`. Domain B passes `editState.restControlPoints` and `editState.currentOffsets` into the helper at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:431`; the commit gesture payload value is `input.getNextOffsets()` for `controlPointOffsets` at `apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts:35`. Canvas projection carries rest points and offsets at `apps/editor/src/workspace/canvas/canvas-projection.ts:463`. |
| Does not change `domainBounds`, `restControlPoints`, lattice rows/columns, mesh generation, renderer architecture, Deformer Tree, Viewer. | implemented | Reviewed target files add preview/projection/renderer interaction state only. No new update-rig-control, rest-frame, lattice-resize, Deformer Tree, Viewer, or package operation path appears in the inspected target files. `domainBounds` and lattice values are read/cloned/projected at `apps/editor/src/workspace/canvas/canvas-projection.ts:454`, `apps/editor/src/workspace/canvas/canvas-evaluation.ts:415`, and `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:638`. |
| Does not implement selected-control-point-only scale, Alt/Shift semantics, implicit keyform creation, or new operation type. | explicit non-goal | Scale drag does not consume selection or modifier inputs; it starts only when exact-key editing is available at `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:233`. Off-key state uses `canAddCurrent` but scale handles stay unavailable, so no implicit keyform is created. Commit reuses `editKeyformKey(updateCurrent)` at `apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts:35`. Focused search found no Warp-scale operation type under the inspected operation/session paths. |

## Findings

No blocking or non-blocking spec-compliance findings.

## Verification

Commands run:

- `rg -n "scale|Scale|handle|Handle|restControlPoints|controlPointOffsets|pointercancel|pointerup|commit|preview|canEditValue|marquee|rotation|Rotation|replaceEvaluated|latticeColumns|latticeRows|domainBounds|selectedControlPoint" apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts`
  - Confirmed gates, hit paths, preview, commit, and cancel code locations.
- `rg -n "restControlPoints|controlPointOffsets|evaluatedControlPoints|domainBounds|latticeColumns|latticeRows|warp|Warp|preview|replaceEvaluated" apps/editor/src/workspace/canvas/canvas-evaluation.ts apps/editor/src/workspace/canvas/canvas-projection.ts apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
  - Confirmed projection/evaluation and panel event wiring.
- `rg -n "editKeyformKey|updateCurrent|commitEditKeyformKey|createWarpControlPointOffsetUpdateGesture|controlPointOffsets" apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts apps/editor/src/features/editor-session/model -g"*.ts"`
  - Confirmed existing `editKeyformKey(updateCurrent)` path.
- `rg -n "Alt|Shift|altKey|shiftKey|selected.*scale|implicit|addCurrent|operationType|scaleWarp|warpScale|updateRigControl|domainBounds|restControlPoints|latticeColumns|latticeRows" apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts apps/editor/src/workspace/canvas/canvas-renderer.ts apps/editor/src/workspace/canvas/canvas-evaluation.ts apps/editor/src/workspace/canvas/canvas-projection.ts apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
  - No selected-only scale, modifier semantics, new operation type, or rest/lattice update path found in the target files.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - sandbox attempt failed during Vitest config load with esbuild `spawn EPERM`.
  - approved external rerun passed: 2 files / 25 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
  - approved external run passed: 1 file / 10 tests.
- `git diff --check -- apps/editor/src/workspace/canvas/warp-deformer-scale.ts apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts apps/editor/src/workspace/canvas/canvas-renderer.ts apps/editor/src/workspace/canvas/canvas-evaluation.ts apps/editor/src/workspace/canvas/canvas-projection.ts apps/editor/src/workspace/panels/canvas-preview-panel.tsx apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - pass with Git LF/CRLF normalization warnings only.

Accepted report evidence from `discussion/implementation/waves/wave78/wave78-domain-b-canvas-keyed-warp-scale-handles-gesture-integration-report.md`:

- broader focused canvas test run passed: 4 files / 44 tests.
- `pnpm.cmd typecheck` passed.
- `node scripts/check-source-organization.mjs` passed.
- `node scripts/check-dependencies.mjs` passed.

## Residual Risks

- Parent-transformed Warp coordinate precision still inherits the existing Canvas/local-coordinate limitation noted in the Wave78 plan; this review did not find a new Domain B regression there.
- Canvas evaluation currently projects Warp rest control points from the evaluated domain grid, matching current editor-created grid-rest behavior. A future non-grid stored `restControlPoints` workflow would need separate coverage to prove keyed scale uses the stored rest lattice rather than a regenerated domain grid.
- No browser pixel screenshot was captured in this lane; renderer styling was verified by source review plus the existing/accepted focused renderer evidence in the Domain B report.
