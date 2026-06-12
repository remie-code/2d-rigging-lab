# Wave65 Preplan Test Oracle Inventory

- verdict: `done`
- role: Sylph D - Test oracle inventory
- date: 2026-06-12
- scope: Parameter-driven preview / Canvas warp editing / Undo introduction test boundary inventory before Wave65 planning

## scope reviewed

- Basis docs:
  - `discussion/design/screen-design/e2e-oracle.md`
  - `discussion/design/screen-design/components/parameter-keyform.md`
  - `discussion/design/screen-design/components/rig-tool.md`
  - `discussion/implementation/waves/wave64/wave64-final-integration-report.md`
- Wave64 reviews used only where directly relevant:
  - `discussion/implementation/reviews/wave64/wave64-domain-a-test-adequacy-review.md`
  - `discussion/implementation/reviews/wave64/wave64-domain-b-test-adequacy-review.md`
  - `discussion/implementation/reviews/wave64/wave64-domain-b-design-development-review.md`
  - `discussion/implementation/reviews/wave64/wave64-domain-d-test-adequacy-review.md`
- Repository test/source surfaces sampled:
  - `apps/editor/e2e/psd-import.e2e.spec.ts`
  - Focused editor tests under `apps/editor/src/features/editor-session/model`, `apps/editor/src/workspace/panels`, `apps/editor/src/workspace/canvas`, and `apps/editor/src/workspace/parameter-manager`
  - Focused package tests for parameter/keyform/rig runtime and validation in `packages/operation-core`, `packages/authoring-core`, `packages/runtime-core`, and `packages/validator-core`
  - `package.json` and `apps/editor/package.json`

## basis documents used

- `discussion/design/screen-design/e2e-oracle.md` defines Playwright E2E as a small user-path/workspace-reflection oracle, not a layout, pixel, screenshot, canvas-rendering, parser, DTO, or internal-store oracle. It assigns internal correctness to unit/headless tests, local UI state to component/focused tests, and layout/UX naturalness to human visual check.
- `discussion/design/screen-design/components/parameter-keyform.md` defines Parameter Bar as the active-parameter/current-value/key-marker/keyform action surface, with keyform authoring coordinated through the selected target Inspector. It explicitly treats non-key positions as interpolated/locked until "Add Keyform Here".
- `discussion/design/screen-design/components/rig-tool.md` defines Rig Tool canvas overlay and Inspector responsibilities. Warp Deformer keyform authoring is `controlPointOffsets`; canvas overlay shows target bounds, lattice/control points, draft/committed state, and does not expose raw operation/evidence data.
- `discussion/implementation/waves/wave64/wave64-final-integration-report.md` records Wave64 status `pass`, but with clear residual boundaries: representative E2E covers Drawable opacity; rig rotation/opacity/warp paths are covered by model/component/command tests rather than separate Playwright paths; full mesh visual quality and human visual review remain deferred. It also records sandbox `spawn EPERM` failures for Vitest and Playwright before approved reruns passed.

## repository facts with file paths

### Existing E2E coverage

- `apps/editor/e2e/psd-import.e2e.spec.ts` contains 9 Playwright tests:
  - PSD import and workspace reflection at line 8.
  - Parts Tree and Inspector editing at line 86.
  - Drawable opacity keyform loop through Parameter Bar and Inspector at line 162.
  - Parts Tree drag/drop reorder at line 210.
  - Mesh draft/apply path at line 226.
  - Warp Deformer draft/apply/edit and Deformer Tree reflection at line 305.
  - Stale Warp draft rejection feedback at line 385.
  - Deformer reparenting without Parts order mutation at line 435.
  - Rotation Deformer creation and parent Warp insertion at line 488.
- The keyform E2E checks marker summary text and numeric current-value entry, not slider thumb drag geometry: marker assertions are at `apps/editor/e2e/psd-import.e2e.spec.ts:186` and `:187`; numeric value fills are at `:196` and `:199`.

### Existing editor focused tests

- `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts` covers:
  - Locking target editing between keys and evaluated Drawable opacity preview at line 39.
  - Ends + Center disabling for duplicate default endpoints at line 79.
  - Rotation `angleDegrees` / `opacityMultiplier` projection, payload, and preview state at line 87.
  - Warp `controlPointOffsets` / `opacityMultiplier` projection, payload, and preview state at line 179.
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts` covers:
  - Warp Deformer operation contract at line 75.
  - Deformer Tree bind/rebind/reparent without Parts or draw-order mutation at line 120.
  - Invalid Deformer Tree drops and duplicate/no-op rig rejections without mutation at lines 201 and 243.
  - Deformer Inspector updates and `operation.updateRigControl.keyformCardinalityConflict` when keyformed Warp divisions would change cardinality at line 298.
  - Drawable opacity keyform add/update/delete wrapper at line 393.
  - Rotation angle keyform add/update/delete wrapper at line 443.
- `apps/editor/src/workspace/panels/parameter-binding-section.test.ts` covers:
  - Rotation binding row exact-key enabled update/delete state at line 44.
  - Warp binding row between-key lock/disabled state for uniform offset editor at line 74.
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts` covers:
  - Keyformed Warp Deformer division fields disabled and omitted from update payload at line 32.
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts` covers:
  - Canvas render projection for bytes/opacity/visibility/draw order/masks at line 50.
  - Fit/zoom math at line 89.
  - Draft and committed Warp Deformer overlays at line 260.
  - Committed Rotation Deformer overlays at line 335.
  - Hidden Drawable temporary mesh preview at line 361.
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts` covers:
  - Warp draft creation and committed Deformer Tree projection at line 36.
  - Insertion payloads when a Drawable is already bound at line 82.
  - Drawable Pool semantics independent of Parts membership at line 130.
  - Parent Deformer payloads at line 164.
- `apps/editor/src/features/editor-session/model/parameter-manager-projection.test.ts` and `apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts` cover Parameter Manager v0 projection, route rendering, usage/delete blocking, and Set Active -> provider -> rendered Parameter Bar state.

### Existing package focused tests

- `packages/operation-core/src/operations/edit-keyform-key.test.ts` covers dry-run no mutation, add/update/delete, Ends/Ends+Center, duplicate/default endpoint rejection, v0 rig targets including Warp `controlPointOffsets`, and negative atomicity for duplicate/missing/out-of-range/unsupported-property cases.
- `packages/operation-core/src/operations/rig-control.test.ts` covers `createWarpDeformer`, insertion behavior, and `updateRigControl` cardinality conflict paths for keyformed Warp controls.
- `packages/runtime-core/src/rig-control-keyform-evidence.test.ts` covers rotation angle keyform evidence and semantic bilinear Warp deformation from `controlPointOffsets`, plus invalid Warp offset shape diagnostics.
- `packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts` covers keyformed rotation/warp opacity multipliers applied to descendant drawable opacity.
- `packages/authoring-core/src/parameter-surface.test.ts` covers initialized preset parameter listing and runtime graph projection from an empty graph.
- `packages/validator-core/src/parameter-keyform-package.test.ts` covers duplicate parameters, preset locked mutation, missing refs, out-of-range keyforms, unsupported properties, and preset catalog refs as initialized.

### Current implementation facts relevant to next-wave test boundaries

- `apps/editor/src/workspace/panels/parameter-bar.tsx` currently renders the Parameter Bar current value as a native `input type="range"` with `onChange` calling `setActiveParameterValue` at lines 131-138. Browser-native range inputs normally allow track clicks unless custom handling or replacement UI blocks them.
- Parameter key markers in `parameter-bar.tsx` are currently rendered as `aria-hidden` spans with `pointer-events-none` at lines 145-147, so marker click jump is not currently implemented.
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx` currently tracks only pointer drag modes `"select"` and `"pan"` at lines 56 and 63. Pointer down initializes pan or select at lines 304-326; pointer up for select performs drawable hit-test and `selectDrawable` at lines 372-394. There is no current pointer mode for Warp control point drag, marquee/range selection, or multi-point drag.
- `apps/editor/src/workspace/canvas/canvas-projection.ts` consumes `parameterValues` and evaluated keyforms at lines 122 and 163-165. It projects evaluated rotation angles and Warp `controlPointOffsets` into deformer overlays at lines 309-356.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts` uses evaluated angle for rotation overlay at line 181 and applies `controlPointOffsets` while drawing transform control points at line 610. This is overlay drawing, not direct canvas editing.
- Searching `apps/editor/src` and `packages` for `Undo`, `Redo`, `undo`, or `redo` returned no matches. Existing editor command paths update a single React `session` state in `EditorSessionProvider` (`apps/editor/src/features/editor-session/editor-session-context.tsx:207`) through command callbacks and `setSession`, with commit wrappers in `apps/editor/src/features/editor-session/model/editor-session-commands.ts`.
- Root `package.json` defines `test:unit` as `vitest run packages --exclude packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`; it does not include `apps/editor/src` tests by default. `apps/editor/package.json` defines Playwright E2E as `test:e2e:psd-import`.

## findings

### 1. Existing tests protect Parameter Manager/Bar/keyform commands well for Wave64 scope, but not new slider geometry behavior

Facts:

- Parameter Manager Set Active and rendered Parameter Bar state are covered by focused React/provider tests.
- Parameter Bar current-value behavior is covered through projection/state and E2E numeric fill, not through pointer drag/click geometry on the slider.
- Current key markers are non-interactive spans.

Recommendation:

- For Wave65 parameter track/marker/thumb behavior, do not rely only on the existing keyform E2E. Add a small focused interaction test around the Parameter Bar behavior and one Playwright smoke only if pointer geometry matters.

### 2. Existing tests protect Warp data contracts, command wrappers, projection, and overlay rendering, but not direct canvas Warp editing

Facts:

- Warp creation/edit/update/cardinality, `controlPointOffsets` payload/evaluation, and overlay projection are covered.
- Canvas pointer handling currently supports select/pan only.
- Wave64 reviews explicitly state Warp control point UI remains uniform X/Y offset editor, not future per-point UX.

Recommendation:

- Canvas Warp editing needs new focused tests for interaction state and edit payload construction before Playwright. Do not use screenshot/pixel assertions as the primary oracle.

### 3. Existing E2E oracle should remain narrow

Facts:

- Accepted E2E oracle excludes layout beauty, pixel positions/sizes, visual regression screenshots, Canvas image correctness, DTO fields, operation IDs, raw evidence, and internal store shape.
- Wave64 E2E already carries many representative editor workflows in one file.

Recommendation:

- Add at most 1 targeted Playwright path per user-visible workflow class, and keep assertions to visible controls, accessible names, stable data attributes that summarize state, and workspace reflection. Put algorithmic correctness in unit/focused tests.

### 4. Undo is a new test boundary, not covered by current source or tests

Facts:

- No Undo/Redo source or tests were found under `apps/editor/src` or `packages`.
- Operation lifecycle tests cover commit/dry-run/revision/log behavior, but not inversion, history stacks, UI command availability, or selection/preview restoration.

Recommendation:

- Treat Undo as its own domain with a model-level history reducer/manager test first, then command integration tests, then one E2E smoke for a high-value workflow after semantics are settled.

### 5. Verification needs escalation awareness

Facts:

- Wave64 final report and reviews record sandboxed Vitest/Playwright failures with Vite/esbuild or Playwright `spawn EPERM`; approved reruns passed.
- Focused editor Vitest is not covered by root `test:unit` and must be called explicitly.

Recommendation:

- Wave65 plans should list focused editor Vitest commands explicitly and record that `spawn EPERM` may require approved rerun. Avoid interpreting first sandbox EPERM as a test failure.

## risks / gaps

- Parameter slider track click disabled behavior is currently unimplemented with the native `range` input. If this is a requirement, tests must first define whether the implementation remains native range with event guards or moves to a custom slider.
- Key marker click jump is currently unimplemented because markers are `aria-hidden` and `pointer-events-none`. Testing should wait for an accessible marker/button representation or an explicit interaction contract.
- Thumb drag scrub is not directly covered. Numeric fill proves value propagation but not pointer/drag usability.
- Canvas Warp direct manipulation has no existing interaction state, hit testing, selection model, drag payload, or commit/draft boundary test.
- Multi-point/range selection has no existing source vocabulary in the reviewed canvas panel. Any tests here will be greenfield.
- Undo semantics are undecided: session-only snapshot history, operation-log replay/inversion, and transient preview/selection restoration imply different tests.
- Canvas visual quality, mesh deformation appearance, handle readability, hover affordance, and dense-layout ergonomics remain human visual check areas unless a future plan intentionally introduces a non-pixel semantic oracle.

## recommended planning implications

### Minimal unit/focused test candidates

1. Parameter Bar interaction model
   - Level: component/focused unit.
   - Candidate oracle:
     - Track click outside the thumb does not call `setActiveParameterValue`.
     - Thumb drag/scrub calls value change with clamped parameter values.
     - Marker click jump calls value change with the marker's exact key value.
   - Notes:
     - If native `input type="range"` remains, track-vs-thumb geometry is hard to make deterministic in headless component tests. Prefer extracting slider interaction math/state into a small testable module, then one Playwright smoke for real pointer behavior.

2. Keyform marker behavior
   - Level: component/focused test first, Playwright optional.
   - Candidate oracle:
     - Markers render as accessible controls when interactive.
     - Clicking marker at `-30` updates active parameter value to `-30`.
     - Selected marker state follows current value.
   - Do not assert pixel marker position beyond a stable semantic percent helper/unit if introduced.

3. Parameter-driven preview preservation
   - Level: existing model tests extended.
   - Candidate oracle:
     - `createEvaluatedParameterKeyformState` and `createCanvasRenderProjection` propagate changed parameter value to drawable opacity, rotation angle overlay, and Warp offset overlay.
     - This should remain unit/focused, not E2E, except one representative Playwright path.

4. Canvas Warp edit state reducer / hit testing
   - Level: unit/focused model test.
   - Candidate oracle:
     - Pointer near a control point resolves the expected control point id/index in canvas coordinates.
     - Range/marquee selects expected point indices from projection coordinates.
     - Multi-point drag applies identical delta to selected control-point offsets.
     - Drag result creates an `editKeyformKey` update payload for `rigControl.controlPointOffsets` only when the current parameter value is an exact/editable keyform.
     - Between-key/interpolated state blocks direct edit and exposes add-keyform path instead.

5. Canvas Warp component integration
   - Level: focused React/component test if practical, otherwise one Playwright workflow after reducer is unit-covered.
   - Candidate oracle:
     - Selecting Rig/Warp Deformer shows overlay metadata attributes.
     - Dragging one point updates `data-deformer-overlay-control-point-offset-count`/a future semantic offset attribute and Inspector binding state.
     - Range selection + multi-drag changes selected point count and one summarized offset value.
   - Avoid screenshot/pixel oracle.

6. Undo history model
   - Level: unit/focused model first.
   - Candidate oracle:
     - Committed operation pushes previous/current snapshot or inverse entry.
     - Rejected operation does not push history.
     - Parameter preview-only value changes either do not push history or push according to explicit product decision.
     - Undo restores graph, selection, active tool/draft state, and parameter current value according to the chosen scope.
     - Redo restores the undone command and clears on new branch commit.

7. Undo command integration
   - Level: editor command/provider focused test.
   - Candidate oracle:
     - Apply keyform update -> Undo restores previous keyform set and canvas projection summary -> Redo reapplies.
     - Apply Warp point drag/edit -> Undo restores offsets and overlay summary.
     - Apply Parameter Manager custom create/update/delete -> Undo behavior follows chosen scope.

### Minimal E2E candidates

1. Parameter marker/slider smoke
   - Level: Playwright.
   - Candidate path:
     - Import fixture PSD, select drawable, create keyforms, click marker, assert numeric current value and canvas summary attribute update.
     - Drag thumb to another value, assert value and one preview summary attribute.
     - Click slider track away from thumb, assert value unchanged if track-click-disabled is accepted.
   - Keep to one test, no screenshots, no pixel assertions.

2. Canvas Warp edit smoke
   - Level: Playwright only after unit/focused reducer coverage exists.
   - Candidate path:
     - Import fixture PSD, create/select Warp Deformer, create/add editable keyform, drag one visible control point, assert semantic overlay/keyform summary changed.
     - If range/multi-drag is in scope, use one deterministic marquee/drag and assert selected point count plus summarized offset, not exact rendered pixels.

3. Undo smoke
   - Level: Playwright only after unit/provider coverage exists.
   - Candidate path:
     - Perform one visible committed change, click Undo, assert UI/workspace summary restored; click Redo, assert reapplied.
   - Prefer one cross-cutting scenario. Avoid covering every command in E2E.

## level recommendations for requested interactions

### Track click disabled / keyform marker click jump / thumb drag scrub

- Track click disabled:
  - Primary: Playwright or extracted slider interaction unit, because browser/native range geometry matters.
  - Secondary: component test for event guards if custom slider is introduced.
  - Not human-only; this is behavioral.
- Keyform marker click jump:
  - Primary: component/focused test around marker controls and `setActiveParameterValue`.
  - Secondary: one Playwright assertion in the representative Parameter Bar path.
  - Not visual/pixel.
- Thumb drag scrub:
  - Primary: Playwright smoke for real pointer behavior.
  - Secondary: unit test for clamp/value mapping if custom math is introduced.
  - Existing numeric-fill E2E is not sufficient to prove drag.

### Warp control point drag / range selection / multi-point drag

- Control point hit testing and delta math:
  - Primary: unit tests against extracted canvas-coordinate/warp-edit state functions.
- Range selection:
  - Primary: unit tests for rectangle-to-point selection and modifier behavior.
  - Secondary: focused component/Playwright smoke only for event wiring.
- Multi-point drag:
  - Primary: unit tests for selected-point delta application and payload cardinality.
  - Secondary: Playwright smoke if this becomes a first-class user path.
- Visual placement/readability of points/handles:
  - Human visual check, not screenshot oracle.

### Undo stack

- History semantics:
  - Primary: unit tests for history model/reducer.
- Command integration:
  - Primary: editor provider/command focused tests.
- User-visible toolbar/menu/keyboard wiring:
  - Secondary: one Playwright smoke after semantics settle.
- Full operation inversion across every operation:
  - Do not put in E2E. Use unit/command tables or operation-level tests.

## human visual check boundary

Keep these as human visual checks for Wave65 unless a plan explicitly introduces a non-pixel semantic oracle:

- Parameter Bar layout density, label clarity, marker readability, and whether track/markers/thumb feel discoverable.
- Canvas overlay visual quality: control point size, hover/selected styling, handle visibility, grid/readability, and whether points are easy to grab at different zoom levels.
- Mesh/warp visual deformation quality, including whether the rendered shape "looks right". Existing automated tests should assert data/projection summaries, not pixels.
- Panel spacing, toolbar ergonomics, responsive layout, and whether UI text overlaps.
- UX naturalness of Undo feedback and disabled states.

## verification notes

- Known sandbox issue:
  - Wave64 recorded Vitest and Playwright first attempts failing with `spawn EPERM` before approved reruns passed.
  - Treat Vite/esbuild/Playwright `spawn EPERM` as an environment verification issue requiring approved rerun, not as product test failure.
- Existing useful focused commands from Wave64:
  - `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
  - `pnpm.cmd exec vitest run packages/package-format/src/parameter-presets.test.ts packages/authoring-core/src/parameter-surface.test.ts packages/authoring-core/src/runtime-graph-adapter.test.ts packages/operation-core/src/operations/create-parameter.test.ts packages/operation-core/src/operations/parameter-definition.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/validator-core/src/parameter-keyform-package.test.ts`
  - `pnpm.cmd --dir apps/editor exec playwright test -c playwright.config.ts e2e/psd-import.e2e.spec.ts -g "authors drawable opacity keyforms"`
- Root `pnpm.cmd test:unit` does not include editor focused tests by default. Plan editor Vitest commands explicitly.

## user-decision points

- Decide whether Parameter Bar slider remains native `input type="range"` or becomes a custom slider. Track-click-disabled plus marker-click-jump is easier to specify and test with a custom slider/state module.
- Decide whether track click disabled is a hard product requirement. Native range behavior conflicts with it unless custom behavior is introduced.
- Decide Undo scope:
  - Graph/package mutations only.
  - Graph plus selection/active tool/drafts.
  - Graph plus transient preview values such as active parameter current value.
- Decide Undo mechanism:
  - Snapshot history in editor session.
  - Operation-log replay/inversion.
  - Hybrid.
- Decide canvas Warp edit commit timing:
  - Live draft during drag and commit on pointer up.
  - Commit every drag step.
  - Explicit Apply after drag.
- Decide whether range selection/multi-point drag is Wave65 must-have or should trail single-point drag.

## provisional assumptions

- Wave65 should continue the accepted E2E oracle: E2E proves user-path wiring and workspace reflection, not layout or pixel correctness.
- The next wave should minimize new Playwright coverage to 1-3 focused smoke paths and put most correctness in unit/focused tests.
- For Canvas Warp editing, a small extracted interaction/model layer is worth testing before UI wiring because current canvas pointer code has no warp-edit mode.
- Undo is sufficiently cross-cutting that it should be planned as its own test slice, not appended as incidental assertions to every feature test.
