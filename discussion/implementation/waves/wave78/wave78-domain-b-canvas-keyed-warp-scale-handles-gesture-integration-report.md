# Wave78 Domain B Report: Canvas Keyed Warp Scale Handles + Gesture Integration

- verdict: pass
- domain: `wave78-canvas-keyed-warp-scale-handles-gesture-integration`
- scope: Canvas Warp scale handle projection, rendering, hit testing, preview, and pointerup commit integration

## Files Changed

- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
  - Exposes evaluated Warp `restControlPoints` alongside current offsets and evaluated control points.
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
  - Projects Warp `restControlPoints` onto the Canvas overlay.
- `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts`
  - Adds keyed Warp `scale-drag` mode, handle hit priority, preview, pointerup commit, and pointercancel discard.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
  - Draws keyed Warp scale handles only when the hook marks them visible.
- `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts`
  - Adds hook lifecycle coverage for exact-key visibility, off-key unavailability, corner/edge priority, preview, single commit, and cancel discard.
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - Adds rest point projection coverage and scaled preview geometry regression.
- `discussion/implementation/waves/wave78/wave78-domain-b-canvas-keyed-warp-scale-handles-gesture-integration-report.md`
  - This report.

## Basis Coverage Self-Report

Read required basis:

- `discussion/implementation/orchestration/wave78-plan.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/implementation/waves/wave78/wave78-domain-a-warp-scale-geometry-keyform-safety-model-report.md`
- `discussion/implementation/reviews/wave78/wave78-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave78/wave78-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave78/wave78-domain-a-test-adequacy-review.md`

Optional Wave65/Wave74/Wave77 baseline docs were not needed after the required plan and current-state confirmation matched the source structure.

## User-Facing UX Trace

- Scale handles are visible only for the active committed Warp overlay when `controlPointOffsets` is editable at the exact active keyform.
- Off-key states keep existing readonly/control-point behavior but hide scale handles and cannot enter scale drag.
- Corner handles and edge handles are hit-tested before control points; marquee remains the fallback.
- Scale preview updates the Canvas projection during pointermove.
- Pointerup commits once through the existing Warp `editKeyformKey(updateCurrent)` gesture path.
- Pointercancel clears preview and does not commit.
- Renderer uses amber square/bar transform handles, separate from teal Warp control points and dashed rest/draft styling.

## Data / Keyform / Gesture Contract Trace

- The hook calls `computeWarpDeformerScaledControlPointOffsets` with full `restControlPoints`, full current `controlPointOffsets`, lattice dimensions, handle id, and canvas drag delta.
- Preview uses `compositionMode: "replaceEvaluated"` and supplies a full `controlPointOffsets` array.
- Commit reuses `createWarpControlPointOffsetUpdateGesture`, which calls `editKeyformKey` with `action: "updateCurrent"`.
- No new operation type was added.
- `domainBounds`, `restControlPoints`, lattice rows/columns, mesh generation, Deformer Tree, and Viewer behavior were not mutated.

## Must-Not Compliance Evidence

- Did not edit `discussion/implementation/orchestration/wave78-plan.md`.
- Did not edit implementation/review maps.
- Did not add dependencies and did not run `pnpm install`.
- Did not implement rest-frame resize, selected-control-point-only scale, Alt/Shift modifiers, additiveDelta authoring expansion, or implicit off-key keyform creation.
- Did not add package operation types or bypass Operation Core.
- Did not edit Deformer Tree, Viewer, mesh generation, `domainBounds`, source package rest points, or lattice dimensions.
- Existing Rotation Deformer pointer priority remains intact in `CanvasPreviewPanel`; pointerdown still delegates Rotation before Warp.
- Existing dirty Domain A and map/package files were left in place and not reverted.

## Tests / Commands Run

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-renderer.test.ts`
  - sandbox attempt failed during Vitest config load with esbuild `spawn EPERM`;
  - approved escalated rerun passed: 4 files / 44 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
  - sandbox attempt failed during Vitest config load with esbuild `spawn EPERM`;
  - approved escalated rerun passed: 1 file / 10 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts`
  - approved escalated rerun after the final lattice-dimension gate tightening passed: 1 file / 8 tests.
- `pnpm.cmd typecheck`
  - pass; rerun after final hook gate tightening also passed.
- `node scripts/check-source-organization.mjs`
  - pass.
- `node scripts/check-dependencies.mjs`
  - pass.
- `git diff --check -- apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts apps/editor/src/workspace/canvas/canvas-renderer.ts apps/editor/src/workspace/canvas/canvas-evaluation.ts apps/editor/src/workspace/canvas/canvas-projection.ts apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - pass with Git LF/CRLF normalization warnings only.

## Playwright Smoke

Not run. The only allowed e2e target called out for this domain is `apps/editor/e2e/psd-import.e2e.spec.ts`, which does not exercise Canvas Warp scale handle pointer gestures. The focused hook/projection/renderer Vitest coverage directly exercises the changed interaction and evaluated geometry paths without requiring a broad dev-server browser run.

## Residual Risks

- Parent-transformed Warp coordinate precision inherits the existing point-drag limitation noted in the wave plan; this domain did not redesign Canvas/local coordinate conversion.
- Scale handle position logic is intentionally local to the allowed hook/renderer files instead of a new shared helper file, to stay inside the Domain B write scope.
- No pixel-level browser screenshot was captured; renderer behavior is covered by source review and focused renderer/unit regressions rather than Playwright visual proof.
