# Wave65 Preplan Canvas Warp Editing Inventory

verdict: `done`

## scope reviewed

- Basis docs:
  - `discussion/design/screen-design/components/rig-tool.md`
  - `discussion/design/screen-design/components/parameter-keyform.md`
  - `discussion/implementation/waves/wave64/wave64-domain-b-editor-parameter-keyform-editing-loop-report.md`
  - `discussion/implementation/waves/wave64/wave64-final-integration-report.md`
- Repository code:
  - `apps/editor/src/workspace/canvas/canvas-projection.ts`
  - `apps/editor/src/workspace/canvas/canvas-renderer.ts`
  - `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
  - `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
  - `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
  - `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `apps/editor/src/features/editor-session/model/editor-selection.ts`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
  - `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`
  - `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
  - `packages/authoring-core/src/linear-keyform-editing.ts`
  - `packages/runtime-core/src/rig-control-warp-lattice.ts`
- Focused tests inspected:
  - `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
  - `apps/editor/src/workspace/panels/parameter-binding-section.test.ts`
  - `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`

## basis documents used

- `rig-tool.md` says Rig overlay belongs in the central Canvas / Preview, not a separate editor, and should show target bounds, warp lattice bounds, lattice control points, draft / committed state, hover, and selected state.
- `rig-tool.md` describes Warp Deformer as a user-facing primitive with transform grid / lattice plus Bezier edit surface; keyform authoring edits `controlPointOffsets`.
- `parameter-keyform.md` says Parameter Bar owns active parameter/current value, while the selected target Inspector owns property/keyform operations.
- `parameter-keyform.md` explicitly locks direct property editing when current parameter value is not at a keyform position; the available operation is adding a keyform at the current value.
- Wave64 Domain B report says Canvas direct manipulation was intentionally deferred; current warp editing is Inspector/Parameter Bar driven with uniform X/Y offsets across the lattice.
- Wave64 final integration report says the current baseline passed with representative E2E for Drawable opacity and focused model/component/command tests for rig paths.

## repository facts with file paths

- `CanvasDeformerOverlayProjection` already carries warp/rotation overlay data: `domainBounds`, transform columns/rows, Bezier columns/rows, optional evaluated `controlPointOffsets`, children, and draft/committed status. See `apps/editor/src/workspace/canvas/canvas-projection.ts:73`.
- `createCanvasRenderProjection` projects draft warp overlays from `rigDraft` and committed rig overlays only when `selection.kind === "rigControl"`. Draft warp overlays do not include `rigControlId` or `controlPointOffsets`. See `apps/editor/src/workspace/canvas/canvas-projection.ts:284` and `apps/editor/src/workspace/canvas/canvas-projection.ts:299`.
- Committed warp overlays pull evaluated offsets from `createEvaluatedParameterKeyformState(...).rigControlPointOffsetsById` and expose them as `controlPointOffsets`. See `apps/editor/src/workspace/canvas/canvas-projection.ts:340`.
- Canvas projection provides point transforms `screenToCanvasPoint` and `canvasToScreenPoint`, plus fit/zoom helpers. It does not expose rectangle transforms or deformer control-point hit tests. See `apps/editor/src/workspace/canvas/canvas-projection.ts:451`.
- The only exported hit test is `hitTestTopmostDrawable`, which tests stage/canvas point against visible renderable Drawable bounds. See `apps/editor/src/workspace/canvas/canvas-projection.ts:394`.
- Deformer overlay drawing is in `canvas-renderer.ts`. Warp overlays draw domain bounds, transform grid lines, transform control point circles, and Bezier guide grid. See `apps/editor/src/workspace/canvas/canvas-renderer.ts:125`.
- The warp control point position formula is private to the renderer: base grid point inside `domainBounds` plus optional offset at `row * transformColumns + column`. See `apps/editor/src/workspace/canvas/canvas-renderer.ts:601`.
- Control point visual radius is computed from zoom in renderer-local drawing code. Hit testing should not depend on this private function; a larger screen-space tolerance should be defined for pointer usability. See `apps/editor/src/workspace/canvas/canvas-renderer.ts:273`.
- `CanvasPreviewPanel` builds the projection from `session`, `selection`, `meshDraft`, `rigDraft`, and `parameterValues`, then renders a single `<canvas>`. See `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:123` and `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:216`.
- `CanvasPreviewPanel` auto-enables deformer overlay when `activeTool === "rig"`. See `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:231`.
- Current pointer state has only `select` and `pan` modes. Pan starts on middle mouse or left mouse while Space is pressed. Plain left drag is tracked as selection movement but currently has no rectangle-selection behavior; left click without movement selects a topmost Drawable. See `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:54` and `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:304`.
- Space key panning is guarded by Canvas hover/focus and ignores editable targets. See `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:237`.
- `EditorSelection` supports only `part`, `drawable`, and `rigControl`; it has no control-point or sub-selection variant. See `apps/editor/src/features/editor-session/model/editor-selection.ts`.
- `EditorSessionContext` already owns editor-local UI/session state that is not package model data: `selection`, `meshDraft`, `rigDraft`, active parameter, parameter values, and operation feedback. It exposes `editKeyformKey`. See `apps/editor/src/features/editor-session/editor-session-context.tsx:110` and `apps/editor/src/features/editor-session/editor-session-context.tsx:355`.
- `RigToolInspector` renders `ParameterBindingSection` for committed Warp and Rotation deformers. See `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:555` and `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:801`.
- `createRigControlParameterBindings` exposes Warp `controlPointOffsets` and `opacityMultiplier`; the Warp offsets binding uses the full rest-control-point count and `compositionMode: "replace"`. See `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:580`.
- `createParameterBindingProjection` already determines whether the current active parameter value is editable: `canEditValue` is true only when an active parameter exists and a keyform exists exactly at the current value. Otherwise `canAddCurrent` is true and the disabled reason asks to add a keyform first. See `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:251`.
- `createEditKeyformPayload` emits `editKeyformKey` payloads for `addCurrent`, `updateCurrent`, `deleteCurrent`, `createEnds`, and `createEndsCenter`. See `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:306`.
- `ParameterBindingSection` currently edits Warp offsets as uniform X/Y across all points, then commits with `editKeyformKey`. See `apps/editor/src/workspace/panels/parameter-binding-section.tsx:83` and `apps/editor/src/workspace/panels/parameter-binding-section.tsx:208`.
- Authoring-core validates `controlPointOffsets` keyforms only for `warpLattice2d`, with `replace` or `additiveDelta`, and requires a full Vec2 array matching the rig control point count. See `packages/authoring-core/src/linear-keyform-editing.ts:396`.
- Runtime-core indexes warp offsets by `row * latticeColumns + column`, matching renderer/projection row-major assumptions. See `packages/runtime-core/src/rig-control-warp-lattice.ts:307`.
- `canvas-projection.test.ts` covers draft/committed warp overlay projection and updateRigControl projection changes, but not deformer point hit testing or pointer drag. See `apps/editor/src/workspace/canvas/canvas-projection.test.ts:282`.
- `parameter-keyform-state.test.ts` covers exact-vs-interpolated lock behavior and full-array Warp `controlPointOffsets` payload construction. See `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:216`.

## findings

1. Canvas projection is sufficient for stage point <-> screen point conversion, but not for control-point interaction.
   - Existing helpers can convert pointer-local screen points to stage/canvas coordinates and back.
   - Missing pieces are exported control-point geometry, rectangle selection geometry, and hit-test helpers.

2. Warp overlay drawing already has the needed visual source data, but the reusable interaction geometry is trapped inside renderer-private helpers.
   - The next wave should extract or duplicate a pure helper for `toUnitGridPosition` / `getWarpControlPointPosition` outside the renderer before adding hit tests.
   - This helper should be unit-tested independently from canvas drawing.

3. Current pointer handling has a simple priority model: Space/middle pan, otherwise left click/drag, and only click selection commits.
   - A Warp point drag can fit into the existing pointer capture model.
   - Range selection and point drag need explicit new modes; otherwise plain left drag will continue to mean "moved, so do nothing."

4. The natural state boundary for Warp control-point selection is editor UI/session state, not package data and not `EditorSelection`.
   - `EditorSelection` should continue to represent selected Part/Drawable/RigControl for tree/canvas/inspector integration.
   - Control point selection is ephemeral sub-selection scoped to the selected Warp rig control and transform grid cardinality.

5. The keyform lock constraint is already modelable from existing Parameter state.
   - For the selected Warp rig control, create the `controlPointOffsets` binding and call `createParameterBindingProjection`.
   - Permit direct Canvas drag only when `projection.canEditValue === true`.
   - At non-keyform positions, Canvas may allow hover/range selection, but direct point movement should be blocked unless the user explicitly adds a keyform.

## risks / gaps

- No current Canvas hit test exists for deformer points, mesh vertices, selection rectangles, or overlay affordances.
- No current Canvas interaction state exists for hover point, selected point indices, marquee rectangle, drag origin, original offsets, or pending drag preview.
- `createEvaluatedParameterKeyformState` derives preview offsets from committed session/keyforms only. Smooth drag preview will require a local pending-offset overlay override or a transient editing projection layer before the final `editKeyformKey(updateCurrent)` commit.
- `editKeyformKey` requires full `controlPointOffsets` arrays, so single-point/multi-point drag must read the current full array, patch selected indices, normalize cardinality, and commit the whole array.
- Transform division changes can invalidate point indices and keyform array cardinality. Existing `updateRigControl` blocks division edits when keyforms exist in Inspector, but Canvas selection state must still be cleared when rig id, transform columns/rows, or active parameter/keyform state changes.
- Pointer priority can conflict with existing Drawable click selection. Without a modifier or mode gate, plain drag in Rig Tool could be ambiguous between range-selecting Warp points and selecting/doing nothing on Drawables.
- There is no current E2E coverage for Canvas pointer drag. Unit tests can cover geometry/state/payload; Playwright should cover at least one pointer drag path once implemented.

## recommended planning implications

- Split the next wave into small vertical slices:
  1. Geometry foundation: exported pure helpers for Warp control point positions, screen-space hit testing, and stage rectangle containment.
  2. Selection UI state: ephemeral selected point indices scoped to `{ rigControlId, transformColumns, transformRows }`, with clear-on-selection/cardinality changes.
  3. Read-only Canvas affordance: hover/selected rendering and hit-test data without mutation.
  4. Single-point drag: exact keyform only, commit `editKeyformKey(updateCurrent)` on pointer up, with optional transient preview during drag.
  5. Range selection and multi-point drag: marquee selects indices; dragging any selected point applies the same stage delta to all selected offsets.
- Keep Canvas drag commits on the existing `editKeyformKey` route rather than adding a new package operation in this wave.
- Add a Canvas-specific helper that constructs the next full offset array from `{ currentOffsets, selectedIndices, delta }`; do not embed this in React event handlers.
- Prefer a screen-space hit tolerance such as 8-10 CSS pixels rather than the visual dot radius, then convert to stage/canvas units using current zoom.
- Keep non-keyform direct drag blocked. If a user starts dragging at a non-keyform position, surface the same locked reason used by `ParameterBindingSection` and offer existing Add Keyform behavior through the Inspector/Parameter section.
- Use focused tests before E2E:
  - control-point geometry / hit-test helper
  - range selection helper
  - multi-point offset patch helper
  - `canEditValue` gate for exact vs interpolated positions
  - one component or Playwright test for pointer-to-commit behavior

## user-decision points

- Range selection gesture:
  - Option A: plain left drag in Rig Tool when a committed Warp overlay is active.
  - Option B: require Shift-drag or a dedicated select mode to avoid stealing future Canvas drag semantics.
- Non-keyform Canvas interaction:
  - Current design says direct edit is locked. Decide whether clicking/dragging a point at a non-keyform position should only show a locked hint, or should present an explicit "Add Keyform Here" affordance near the Canvas.
- Drag commit timing:
  - Commit on pointer up with transient preview during drag.
  - Or commit continuously while dragging. This is likely higher risk because it can create many operation commits.
- Control point selection visibility:
  - Decide whether selected point count/status appears only on Canvas or also in Rig Inspector / Parameter Binding section.
- Multi-selection modifiers:
  - Decide whether Shift toggles points, drag rectangle replaces selection, and Ctrl/Cmd adds/removes from existing selection.

## provisional assumptions

- Next wave targets committed Warp Deformer `controlPointOffsets`, not draft Warp bounds editing or Bezier edit-surface handle editing.
- Direct manipulation uses the active Parameter Bar parameter/current value and the existing `editKeyformKey` operation.
- The stored target value remains a full `Vec2[]` offset array in row-major order.
- Transform grid control points, not Bezier edit surface points, are the first Canvas-editable points.
- Canvas control-point selection is editor-local UI state and should not be persisted into the package.
- A transient drag preview is acceptable if it never claims to be committed until pointer up succeeds.
