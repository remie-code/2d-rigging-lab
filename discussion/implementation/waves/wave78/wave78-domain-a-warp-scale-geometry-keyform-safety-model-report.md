# Wave78 Domain A Report: Warp Scale Geometry + Keyform Safety Model

- verdict: pass
- domain: `wave78-warp-scale-geometry-keyform-safety-model`
- scope: pure keyed Warp lattice scale math and full-offset cardinality safety tests

## Files Changed

- `apps/editor/src/workspace/canvas/warp-deformer-scale.ts`
  - New focused pure helper for keyed Warp edge/corner scale geometry.
- `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts`
  - New focused tests for edge/corner scale, 2x2 and 3x2 lattices, guards, full output, and input immutability.
- `packages/authoring-core/src/keyform-mutations.test.ts`
  - Added package-level invalid `warpLattice2d.controlPointOffsets` cardinality rejection coverage.
- `packages/operation-core/src/operations/edit-keyform-key.test.ts`
  - Added operation-level invalid `controlPointOffsets` cardinality rejection coverage.
- `discussion/implementation/waves/wave78/wave78-domain-a-warp-scale-geometry-keyform-safety-model-report.md`
  - This report.

## Basis Coverage Self-Report

Read required basis:

- `discussion/implementation/orchestration/wave78-plan.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`

Optional Wave77/Wave65/Wave74 references were not needed after the required plan and current-state confirmation matched the existing source structure.

## User-Facing UX Trace / Domain B Handoff

Domain B can call `computeWarpDeformerScaledControlPointOffsets` with:

- `restControlPoints`
- current full `controlPointOffsets`
- `latticeColumns` / `latticeRows`
- a `WarpDeformerScaleHandle`
- `dragDeltaCanvas`

The helper returns `ok: true` with full `nextOffsets` or `ok: false` with stable reason codes. It does not know about selection, keyform editability, hit testing, rendering, pointer capture, or commit timing; those remain Domain B responsibilities.

Scale semantics implemented:

- edge handles scale one axis with the opposite side fixed;
- corner handles scale both axes with the opposite corner fixed;
- source points are `restControlPoints[i] + controlPointOffsets[i]`;
- committed values are `scaledPoint[i] - restControlPoints[i]`;
- zero-offset keyforms scale normally because raw offsets are not multiplied.

## Data / Keyform / Gesture Contract Trace

- Helper requires exact `latticeColumns * latticeRows` cardinality for both rest points and current offsets.
- Helper returns full replacement `controlPointOffsets`; it never returns sparse or selected-only patches.
- Expected guard failures are deterministic result values, not thrown exceptions.
- Existing gesture path remains unchanged: Domain B should still route pointerup through existing `editKeyformKey(updateCurrent)` / `commitEditKeyformKey` machinery.
- Authoring and operation tests now prove short Warp offset arrays are rejected before becoming committed keyform state.
- Runtime invalid cardinality coverage already existed in `packages/runtime-core/src/rig-control-keyform-evidence.test.ts` and was rerun.

## Must-Not Compliance Evidence

- Did not edit `discussion/implementation/orchestration/wave78-plan.md`.
- Did not edit root maps; existing dirty map files were left untouched.
- Did not edit `use-warp-deformer-control-point-interaction.ts`.
- Did not implement Canvas handle rendering, hit testing, pointer drag mode, or `CanvasPreviewPanel` integration.
- Did not change `domainBounds`, `restControlPoints`, lattice rows/columns, mesh generation, renderer architecture, Deformer Tree, or Viewer.
- Did not implement rest-frame resize, selected-control-point-only scale, Alt/Shift semantics, additiveDelta expansion, implicit off-key keyform creation, or a new operation type.
- Did not add dependencies and did not run `pnpm install`.

## Tests / Commands Run

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts packages/authoring-core/src/keyform-mutations.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts`
  - Initial sandbox run failed with `spawn EPERM` during esbuild startup.
  - Re-run with approved escalation: pass, 3 files / 36 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
  - pass, 2 files / 10 tests.
- `pnpm.cmd typecheck`
  - pass.
- `pnpm.cmd exec tsc --noEmit -p apps/editor/tsconfig.json`
  - fail due existing unrelated app test/adapter typing errors outside Domain A files; no error referenced `warp-deformer-scale.ts` or `warp-deformer-scale.test.ts`.
- `pnpm.cmd exec tsc --noEmit --pretty false --noEmit -p tsconfig.json`
  - pass.
- `node scripts/check-source-organization.mjs`
  - pass.
- `node scripts/check-dependencies.mjs`
  - pass.
- `git diff --check`
  - pass with existing LF/CRLF normalization warnings.

## Cardinality Coverage Decision

Added narrow package-level and operation-level coverage because explicit Warp `controlPointOffsets` cardinality rejection was not covered at those layers:

- package-level: `createLinear1dKeyformSet` rejects a 3-entry patch for a 2x2 Warp lattice;
- operation-level: `editKeyformKey(addCurrent)` rejects a 3-entry patch and preserves session state.

No runtime test was added because deterministic runtime invalid cardinality coverage already existed and was rerun successfully.

## Residual Risks

- Domain B still needs to enforce exact-key editability, handle visibility/unavailability off-key, hit priority, preview, commit-once, and cancel discard.
- Helper consumes `dragDeltaCanvas`; Domain B must pass deltas in the same coordinate space as existing Warp point dragging.
- Full editor app tsconfig still has unrelated pre-existing typing failures, so app-wide typecheck is not a clean gate yet.
