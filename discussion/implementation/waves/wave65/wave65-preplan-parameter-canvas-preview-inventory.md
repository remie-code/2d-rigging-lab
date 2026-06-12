# Wave65 Preplan: Parameter Canvas Preview Inventory

## verdict

done

## scope reviewed

- Basis documents:
  - `discussion/design/screen-design/components/parameter-keyform.md`
  - `discussion/design/parameter-preset-ecosystem.md`
  - `discussion/implementation/waves/wave64/wave64-domain-a-parameter-keyform-package-operation-foundation-report.md`
  - `discussion/implementation/waves/wave64/wave64-domain-b-editor-parameter-keyform-editing-loop-report.md`
  - `discussion/implementation/waves/wave64/wave64-final-integration-report.md`
- Repository source files:
  - `packages/authoring-core/src/parameter-surface.ts`
  - `packages/authoring-core/src/runtime-graph-parameters.ts`
  - `packages/authoring-core/src/runtime-graph-keyforms.ts`
  - `packages/authoring-core/src/to-runtime-graph.ts`
  - `packages/authoring-core/src/linear-keyform-editing.ts`
  - `packages/authoring-core/src/keyform-mutations.ts`
  - `packages/runtime-core/src/runtime-core.ts`
  - `packages/runtime-core/src/runtime-input.ts`
  - `packages/runtime-core/src/parameter-resolution.ts`
  - `packages/runtime-core/src/keyform-sampling.ts`
  - `packages/runtime-core/src/keyform-target-application.ts`
  - `packages/runtime-core/src/rig-control-evaluation.ts`
  - `packages/runtime-core/src/rig-control-keyform-state.ts`
  - `packages/runtime-core/src/rig-control-opacity-keyform-state.ts`
  - `packages/runtime-core/src/rig-control-warp-lattice.ts`
  - `packages/runtime-core/src/snapshot.ts`
  - `packages/runtime-core/src/normalized-runtime-graph.ts`
  - `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
  - `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`
  - `apps/editor/src/workspace/panels/parameter-bar.tsx`
  - `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
  - `apps/editor/src/workspace/panels/inspector-panel.tsx`
  - `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
  - `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
  - `apps/editor/src/workspace/canvas/canvas-projection.ts`
  - `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- Focused test evidence checked:
  - `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts`
  - `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - `apps/editor/e2e/psd-import.e2e.spec.ts`
  - `packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts`
  - `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`

## basis documents used

- `parameter-keyform.md` defines Parameter Bar as the shared active-parameter current value surface, with Canvas / Preview expected to show current-value preview and Inspector expected to lock property editing between key positions.
- `parameter-preset-ecosystem.md` classifies Canvas Preview Evaluation as a non-semantic parameter consumer requiring parameter value and keyform interpolation result, not semantic role inference.
- Wave64 Domain A report records the package / operation foundation for initialized parameters, `editKeyformKey`, and runtime sampling for `drawable.opacity`, `rigControl.angleDegrees`, `rigControl.controlPointOffsets`, and `rigControl.opacityMultiplier`.
- Wave64 Domain B report records the editor loop: Parameter Bar current-value scrub, parameter-aware Inspector, and Canvas preview consuming evaluated keyform state.
- Wave64 final integration report records A/B/D integration as pass, including the B/D shared active parameter contract and Domain B keyform loop preservation.

## repository facts with file paths

### Parameter Bar state ownership and propagation

- `apps/editor/src/features/editor-session/editor-session-context.tsx:121-132` exposes `parameterBar`, `activeParameterId`, `parameterValues`, `setActiveParameterId`, `setActiveParameterValue`, and `resetActiveParameterValue` through `EditorSessionContextValue`.
- `apps/editor/src/features/editor-session/editor-session-context.tsx:209-210` stores `activeParameterId` and `parameterValues` as React provider state. This is editor-local session UI state, not package data.
- `apps/editor/src/features/editor-session/editor-session-context.tsx:246-248` derives `parameterBar` by calling `createParameterBarProjection(session, resolvedActiveParameterId, parameterValues)`.
- `apps/editor/src/features/editor-session/editor-session-context.tsx:423-439` clamps `setActiveParameterValue(value)` to the initialized active parameter range before updating `parameterValues[resolvedActiveParameterId]`.
- `apps/editor/src/features/editor-session/editor-session-context.tsx:444-459` resets the active parameter value to its initialized default.
- `apps/editor/src/features/editor-session/editor-session-context.tsx:776-778` and `:784-787` publish `parameterBar`, `activeParameterId`, `parameterValues`, and setter callbacks to consumers.
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:108-135` computes `ParameterBarProjection.currentValue`, marker list, and Ends / Ends + Center availability from initialized parameters plus `parameterValues`.
- `apps/editor/src/workspace/panels/parameter-bar.tsx:26-39` consumes context state and callbacks.
- `apps/editor/src/workspace/panels/parameter-bar.tsx:130-139` wires the range input to `setActiveParameterValue(...)`; `:159-169` wires the numeric input to the same setter.
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:80-89` reads `parameterValues` from `useEditorSession()`.
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:123-134` passes `parameterValues` into `createCanvasRenderProjection(...)`.
- `apps/editor/src/workspace/panels/parameter-binding-section.tsx:58-67` passes `activeParameterId` and `parameterValues` into `createParameterBindingProjection(...)`, so Inspector rows and Canvas preview read the same current-value state.

### Keyform evaluation support

- Editor projection support:
  - `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:23-30` defines editor-supported keyform properties as `opacity`, `angleDegrees`, `controlPointOffsets`, and `opacityMultiplier`.
  - `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:192-217` creates the Drawable opacity binding.
  - `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:219-245` creates Rotation bindings for `angleDegrees` and `opacityMultiplier`, and Warp bindings for `controlPointOffsets` and `opacityMultiplier`.
  - `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:638-725` samples linear 1D keyforms and interpolates both numbers and Vec2 arrays.
  - `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:404-503` creates evaluated preview maps for drawable opacity, rig opacity multiplier, rig angle degrees, and rig control point offsets.
- Editor Inspector support:
  - `apps/editor/src/workspace/panels/inspector-panel.tsx:179-181` creates a Drawable opacity binding for selected Drawable.
  - `apps/editor/src/workspace/panels/inspector-panel.tsx:252` renders `ParameterBindingSection` for that binding.
  - `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:555-557` and `:801-803` render `ParameterBindingSection` for selected Warp / Rotation rig control bindings.
  - `apps/editor/src/workspace/panels/parameter-binding-section.tsx:65-80` derives binding projection from active parameter values.
  - `apps/editor/src/workspace/panels/parameter-binding-section.tsx:133-144` disables direct property editing when `projection.canEditValue` is false and shows the lock reason.
  - `apps/editor/src/workspace/panels/parameter-binding-section.tsx:197-230` edits Warp `controlPointOffsets` only as uniform X/Y offsets over the full control point array in current v0 UI.
- Operation / authoring support:
  - `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:306-360` creates `editKeyformKey` payloads for add/update/delete/current and Ends / Ends + Center.
  - `apps/editor/src/features/editor-session/model/editor-session-commands.ts:376` routes `commitEditKeyformKey` through operation-core.
  - `packages/operation-core/src/operations/edit-keyform-key.ts:273-286` accepts `drawable` and `rigControl` targets for the v0 operation path.
  - `packages/authoring-core/src/linear-keyform-editing.ts:358-417` is the v0 `editLinear1dKeyformSet` whitelist:
    - `drawable.opacity`: finite number `0..1`, composition `replace` or `multiplyOpacity`.
    - `rigControl.angleDegrees`: `rotation2d` only, finite number, composition `replace` or `additiveDelta`.
    - `rigControl.controlPointOffsets`: `warpLattice2d` only, Vec2 array with exact lattice control point count, composition `replace` or `additiveDelta`.
    - `rigControl.opacityMultiplier`: finite number `0..1`, composition `replace` or `multiplyOpacity`.
  - `packages/authoring-core/src/keyform-mutations.ts:202-227` shows older/broader package keyform target-property support, including mesh vertices, drawable visibility/draw order, and additional rigControl properties. This is broader than the new v0 editing operation and should not be treated as the Wave64 editor loop surface.
- Runtime support:
  - `packages/authoring-core/src/runtime-graph-parameters.ts:6-22` projects initialized parameters into runtime parameters.
  - `packages/authoring-core/src/runtime-graph-keyforms.ts:6-46` projects package keyform sets into runtime keyform bindings.
  - `packages/authoring-core/src/to-runtime-graph.ts:31-44` builds `NormalizedRuntimeGraph` with parameters, drawables, rig controls, and keyform bindings.
  - `packages/runtime-core/src/runtime-input.ts:20-27` accepts `authoredParameterValues`.
  - `packages/runtime-core/src/parameter-resolution.ts:35-69` resolves effective parameter values from authored values, defaults, and computed dynamics.
  - `packages/runtime-core/src/keyform-sampling.ts:47-96` samples runtime keyform bindings using effective parameter values.
  - `packages/runtime-core/src/keyform-target-application.ts:221-233` applies drawable opacity patches to evaluated drawables.
  - `packages/runtime-core/src/rig-control-keyform-state.ts:49-67` applies `angleDegrees` samples to rotation local state.
  - `packages/runtime-core/src/rig-control-opacity-keyform-state.ts:7-40` and `:62-79` apply `opacityMultiplier` samples for rig controls.
  - `packages/runtime-core/src/rig-control-warp-lattice.ts:129-177` applies `controlPointOffsets` samples to warp local state.
  - `packages/runtime-core/src/rig-control-warp-lattice.ts:98-110` and `:194-219` apply warp lattice displacement to vertices.
  - `packages/runtime-core/src/rig-control-evaluation.ts:235-245` evaluates rotation opacity multiplier and rotation angle samples.
  - `packages/runtime-core/src/rig-control-evaluation.ts:290-300` evaluates warp opacity multiplier and warp lattice samples.
  - `packages/runtime-core/src/rig-control-evaluation.ts:360-392` applies rig control effects to drawable opacity and vertices.
  - `packages/runtime-core/src/rig-control-evaluation.ts:395-409` applies descendant opacity multiplier chains.
  - `packages/runtime-core/src/snapshot.ts:166-190` runs parameter resolution, keyform sampling, non-rig target application, then rig-control evaluation when creating a runtime snapshot.

### Canvas renderer inputs and current display behavior

- `apps/editor/src/workspace/canvas/canvas-projection.ts:105-123` defines `CanvasProjectionOptions.parameterValues`.
- `apps/editor/src/workspace/canvas/canvas-projection.ts:163-170` creates editor-local evaluated keyform state from `session` and `parameterValues`.
- `apps/editor/src/workspace/canvas/canvas-projection.ts:213-219` sets `CanvasRenderableDrawable.opacity` from evaluated drawable opacity multiplied by evaluated rig opacity multiplier chain.
- `apps/editor/src/workspace/canvas/canvas-projection.ts:308-329` passes evaluated rotation angle into `CanvasDeformerOverlayProjection`.
- `apps/editor/src/workspace/canvas/canvas-projection.ts:340-356` passes evaluated warp control point offsets into `CanvasDeformerOverlayProjection`.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts:28-83` renders a `CanvasRenderProjection`, not a runtime snapshot directly.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts:111-118` draws each renderable drawable using `context.globalAlpha = resolveDrawableAlpha(...)`.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts:454-462` returns `drawable.opacity` multiplied by selection-isolation dimming.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts:171-214` draws rotation overlay using `overlay.evaluatedAngleDegrees ?? overlay.restAngleDegrees`.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts:226-249` draws a warped transform grid when `overlay.controlPointOffsets` are available.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts:602-618` offsets displayed deformer grid points by `overlay.controlPointOffsets`.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts:355-361` draws drawable images as rectangular image draws at `drawable.bounds`. Current Canvas renderer does not draw textured mesh triangles or apply evaluated rotation/warp vertices to the bitmap itself.

### Parameter Bar marker and scrub UX

- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:168-190` creates marker values and marks the current key as selected.
- `apps/editor/src/workspace/panels/parameter-bar.tsx:125-127` renders marker summary text.
- `apps/editor/src/workspace/panels/parameter-bar.tsx:143-154` renders key markers as `span` elements with `pointer-events-none`, so marker click is currently impossible.
- `apps/editor/src/workspace/panels/parameter-bar.tsx:130-139` uses a native `input type="range"` for scrub. Native range track click and thumb drag both call `onChange`; there is no current separation between track click and thumb drag.

## findings

1. Parameter Bar current value is already centralized in `EditorSessionProvider` as `parameterValues`, and the same state propagates to Parameter Bar, parameter-aware Inspector, and Canvas projection. It is session-local UI state and is not persisted as package data.
2. The Wave64 v0 editor/keyform authoring surface supports `drawable.opacity`, `rotation2d rigControl.angleDegrees`, `warpLattice2d rigControl.controlPointOffsets`, and `rotation2d/warpLattice2d rigControl.opacityMultiplier`. Runtime-core can evaluate the same target family, while older package/runtime paths have broader legacy target support that should not be used as the v0 editor contract.
3. Existing Canvas preview already consumes evaluated parameter keyform state for drawable opacity, rig opacity multiplier chains, rotation overlay angle, and warp overlay control point offsets.
4. Existing Canvas renderer does not currently render the drawable bitmap through evaluated rotation or warp geometry. Rotation/warp scrub can be visible in overlays, and opacity is visible in the image stack, but full deformed artwork preview requires additional Canvas projection/renderer work or a runtime snapshot bridge.
5. Temporary mutation of the session graph is not required for parameter scrub preview. Existing structures can pass preview state / evaluated pose into Canvas. The unresolved implementation choice is whether to extend editor-local `createEvaluatedParameterKeyformState` or route through runtime-core snapshot evaluation for the Canvas visual pose.
6. The requested marker/track/thumb UX is not implemented. Marker click jump needs interactive marker controls. Track click disabled while thumb drag scrubs is not achievable with the current native range input alone in a reliable cross-browser way; it implies a custom slider or pointer-layer implementation.

## risks / gaps

- Canvas deformation gap: runtime-core can evaluate transformed vertices, but editor Canvas renderer currently draws rectangular images by bounds. Implementing full rotation/warp image preview is larger than passing `parameterValues`; it needs an evaluated geometry-to-renderer path.
- Evaluation duplication risk: editor currently has `createEvaluatedParameterKeyformState` while runtime-core has runtime snapshot evaluation. Expanding editor-local evaluation may diverge from runtime-core behavior, especially for hierarchy, composition order, masks, and future target properties.
- UX accessibility risk: replacing native range input to disable track click requires preserving keyboard operation, ARIA slider semantics, focus behavior, numeric fallback, and deterministic Playwright selectors.
- Scope ambiguity risk: "Canvas preview" may mean opacity/overlay feedback or actual deformed artwork feedback. These have different implementation sizes.
- Existing Warp UI limitation: `ParameterBindingSection` edits warp offsets as uniform X/Y offsets across all points, not per-control-point values. That is sufficient for v0 payload shape but not full lattice authoring.
- Operation boundary risk: `keyform-mutations.ts` supports broader legacy package targets, but Wave64 v0 editor loop is intentionally limited to `editKeyformKey`; using legacy paths would widen scope unexpectedly.
- Performance risk: using runtime-core snapshot evaluation on every scrub event may be acceptable for small fixtures but should be measured for larger scenes before becoming the default Canvas path.

## recommended planning implications

- Treat the next wave as two separable increments:
  1. Parameter scrub UX polish: key marker click jump, native track-click policy replacement if accepted, and tests around Parameter Bar state changes.
  2. Parameter-driven Canvas visual preview: decide whether overlay/opacity preview is enough for the wave, or whether full deformed artwork preview is required.
- For minimal implementation, keep `parameterValues` as the active scrub state and pass evaluated preview data into Canvas. Do not mutate session graph for preview.
- If full deformed artwork is required, prefer making runtime-core evaluation the preview authority, then adapt runtime-evaluated drawables/vertices back into `CanvasRenderProjection`. This reduces long-term divergence from runtime/viewer semantics, but it is a broader renderer task than the current Parameter Bar loop.
- If the wave only needs visible confirmation for the existing v0 authoring loop, extend tests around:
  - drawable opacity image-stack preview,
  - rotation overlay angle changing during scrub,
  - warp overlay grid changing during scrub,
  - key marker click jump,
  - track click ignored if custom slider is chosen.
- Keep `editKeyformKey` as the only v0 editor save operation for this loop. Do not route new UI through legacy `addKeyform` / `addKeyformGrid2d` paths.
- Preserve the shared B/D contract: `EditorSessionProvider` owns `activeParameterId`, `parameterValues`, `parameterBar`, and setter callbacks; Parameter Manager should continue setting active parameter rather than owning scrub state.

## user-decision points

- Decide whether Wave65 acceptance requires full deformed artwork rendering on Canvas, or whether opacity plus evaluated rotation/warp overlays is sufficient for the next increment.
- Decide whether disabling track click is a hard UX requirement. If yes, plan a custom accessible slider; if no, keep native range input and add marker click jump only.
- Decide whether runtime-core snapshot evaluation should become the single preview authority for Canvas, or whether editor-local evaluated preview maps remain acceptable for the next wave.
- Decide whether Parameter Control Palette values, when implemented, should share the same `parameterValues` map or use a separate preview override layer.

## provisional assumptions

- Next wave should not change package schema or operation contracts unless the plan explicitly expands beyond the Wave64 v0 editor loop.
- `parameterValues` remains session-local and non-persistent.
- `Canvas Preview` in current code means `CanvasRenderProjection` rendered by `canvas-renderer.ts`, not the full runtime viewer surface.
- The existing rights-clean / private prototype boundaries remain unchanged.
- No source files were edited for this inventory.
