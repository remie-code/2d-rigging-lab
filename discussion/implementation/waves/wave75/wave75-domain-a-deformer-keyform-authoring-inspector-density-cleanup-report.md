# Wave75 Domain A: Deformer Keyform Authoring + Inspector Density Cleanup Report

## Verdict

pass

Domain A passed after Fix Loop 1 and independent Spec Compliance, Design / Development Compliance, and Test Adequacy review lanes.

## Scope Implemented

- Rotation translation handle authoring now supports the real workflow where Rotation angle keyforms exist but the active parameter has no matching translation keyform set yet.
- Missing Rotation translation keyforms are materialized deterministically from the active parameter and the existing Rotation angle key positions when the current parameter value is exactly on one of those keys.
- Non-current materialized translation keys use the current evaluated/rest translation fallback; the dragged exact key receives the handle value.
- Existing Rotation Vec2 interpolation and portable save/load behavior were preserved and re-verified.
- Rotation Parameter Binding cards no longer expose per-card Add / Update / Delete action buttons.
- Parameter Bar now has a keyform target selector for multi-property rig controls, so Rotation translation / opacity and Warp lattice / opacity remain authorable after per-card action removal.
- Rotation Inspector basic density was reduced: Name and Parent deformer remain in the basic card, Bound children and Angle keyforms rows were removed, setup transform fields were compacted, and the standalone Rotation Opacity section was removed.
- Warp Inspector cleanup removed the basic-card Opacity multiplier field, while preserving Warp Parameter Binding lattice offset controls, point count, and opacity slider/value display.
- Warp Parameter Binding cards no longer expose per-card Add / Update / Delete action buttons.

## Files Changed

- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts`
- `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
- `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
- `apps/editor/src/workspace/panels/parameter-binding-section.test.ts`
- `apps/editor/src/workspace/panels/parameter-bar.tsx`
- `apps/editor/src/workspace/panels/parameter-bar.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`
- `discussion/implementation/waves/wave75/_map.md`
- `discussion/implementation/waves/wave75/wave75-domain-a-deformer-keyform-authoring-inspector-density-cleanup-report.md`

## Domain A Ownership Boundary

This lane did not edit `packages/**` and did not change package schema, package format, runtime interpolation, renderer architecture, mesh generation, or save/load archive/filesystem behavior.

The shared worktree already contained unrelated Wave74 / Wave75 dirty files outside this lane, including `apps/editor/src/features/editor-session/model/rig-tool-state.*`, `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`, `apps/editor/src/workspace/panels/deformer-tree-view.tsx`, root implementation maps, Wave74 documents, and package tests. Those files were observed but not reverted or claimed by this report.

## Basis Coverage Self-Report

- `wave75-plan.md`: implemented Domain A requirements for Rotation translation materialization, Parameter Binding action cleanup, Rotation Inspector density cleanup, and Warp cleanup.
- `wave74-plan.md` and Wave74 final / review reports: preserved Wave74 lower-level Vec2 interpolation and portable save/load behavior; no lower runtime rewrite was introduced.
- Wave74 Domain A / B reports: kept existing deformer foundation and save/load keyform evidence intact; touched e2e expectations only where the Wave75 UI route replaced removed per-card buttons.
- Source organization policy: no new catch-all production modules; guard passed.
- UX-backed package logic authority: no package logic change was required because the existing Operation Core edit-keyform path could express deterministic materialization.
- Dependency policy: no dependency or lockfile change; dependency guard passed.
- Operation policy: materialization and later exact-key edits route through existing `editKeyformKey` Operation Core payloads.
- Schema and ID conventions: no schema, ID format, or package serialization changes.
- Rig Tool / Parameter Keyform / Canvas Preview design: canvas handles and Parameter Bar are now the intended authoring routes for deformer keyforms; older per-card button design was superseded by Wave75 scope.

## User-Facing UX Trace

1. User imports a PSD, selects a drawable, generates and applies a mesh, creates a Rotation Deformer, and selects `Face Angle Z`.
2. User presses `Ends + Center`; Rotation angle keys are created at the parameter endpoints and center.
3. User sets the parameter numeric value to `30`; the Rotation angle handle is in keyform mode and the Rotation translation handle enters `materializeKeyform` mode when no translation binding exists for that active parameter.
4. User drags the angle handle; the current Rotation angle key updates.
5. User drags the translation handle; a translation keyform set is materialized at the same key positions as the angle set, with only the current max key receiving the dragged translation.
6. Moving the parameter slider between `0` and `30` interpolates both Rotation angle and Rotation translation.
7. Rotation and Warp Parameter Binding cards remain visible for value inspection/editing, but keyform Add / Update / Delete actions are centralized in the Parameter Bar.

## Keyform Authoring Contract Trace

- `createMaterializedEditKeyformPayloads` sorts and deduplicates source key positions, requires the current parameter value to exactly match one source key, and returns deterministic `addCurrent` payloads.
- Rotation translation materialization sources key positions from the same rig control's Rotation angle binding for the same active parameter.
- Non-current translation keys use the current evaluated/rest translation fallback, preventing a single drag from clobbering other materialized keys with the dragged value.
- Existing exact translation keys continue to use `updateCurrent`; coverage verifies a later exact-key drag updates only that key and preserves other materialized keys.
- If there is no exact active keyform context, translation dragging falls back to rest/setup editing only when no translation keyforms exist; otherwise it remains locked as before.
- Materialization uses sequential existing `commitEditKeyformKey` operation results and returns the original session if any operation fails before exposing a committed result.

## UI Removal / Density Cleanup Trace

- Rotation Parameter Binding cards for angle, translation, and opacity multiplier no longer render per-card Add / Update / Delete buttons.
- Warp Parameter Binding cards for lattice offsets and opacity multiplier no longer render per-card Add / Update / Delete buttons.
- Parameter Bar includes a `Keyform target` selector for multi-property rig controls so users can choose Rotation angle, Translation, Opacity multiplier, Warp lattice offsets, or Warp opacity before using Add / Update / Delete / Ends controls.
- Rotation Inspector basic card keeps `Name` and `Parent deformer`.
- Rotation Inspector removed non-editable `Bound children` and `Angle keyforms` rows.
- Rotation setup fields are compacted into a short-label grid: `Pivot X`, `Pivot Y`, `Rest X`, `Rest Y`, and `Rest angle`.
- Standalone Rotation `Opacity` Inspector section was removed.
- Warp Deformer basic-card `Opacity multiplier` field was removed.
- Warp lattice offset controls, point count display, and opacity slider/value display remain in Parameter Binding.

## Must-not Compliance Evidence

- No mesh generation algorithm changes.
- No runtime interpolation rewrite.
- No renderer architecture change.
- No package format, schema, ID, or archive/filesystem change.
- No Viewer / Runtime View, Texture Atlas, Variant, Dynamics, Cubism SDK, `.moc3`, `.model3.json`, external transport, or LLM/provider expansion.
- No browser-local save, archive, filesystem, or File System Access API work.
- No new dependencies.
- No slider performance optimization was attempted.
- Existing unrelated dirty worktree files were not reverted.

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts apps/editor/src/workspace/panels/parameter-bar.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
  - sandbox startup failed earlier with esbuild `spawn EPERM`.
  - escalated rerun passed: 5 files / 29 tests.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/psd-import.e2e.spec.ts`
  - escalated run passed: 10 tests / 1.0m.
  - Includes focused real workflow coverage for PSD import, mesh generation, Rotation Deformer creation, `Face Angle Z`, `Ends + Center`, max `30`, angle handle drag, translation handle drag, and midpoint slider interpolation.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts`
  - escalated run passed: 1 test / 36.4s.
- `pnpm.cmd typecheck`
  - passed.
- `node scripts/check-source-organization.mjs`
  - passed.
- `node scripts/check-dependencies.mjs`
  - passed.
- `git diff --check`
  - passed with CRLF normalization warnings only.
- Wave75 docs trailing whitespace scan
  - passed for `_map.md` and this report; these files were untracked at verification time, so they are not covered by `git diff --check`.

## Residual Risk Classification

low-to-medium

- Parameter Binding value editors now commit immediately when an exact current key exists, because the old per-card Update button was removed. This preserves reachable value editing but may create denser undo/history entries during slider drags; slider performance/undo optimization was out of scope.
- Rotation translation materialization is intentionally exact-key only. Between-key translation handle edits still use the existing rest/setup or locked behavior to avoid implicit key creation at ambiguous positions.
- The Playwright Rotation handle workflow uses canvas data attributes plus hover-state probing against the sample PSD and current overlay geometry. It is deterministic for the tested path but should be maintained if handle geometry changes.
- The worktree remains dirty from unrelated Wave74 / Wave75 artifacts owned by other lanes.

## Fix Loop 1

### Findings Addressed

- Fixed the edit-mode union mismatch by moving `materializeKeyform` onto `RotationTranslationEditMode`, where `useRotationDeformerInteraction` consumes it.
- Fixed `listRotationAngleKeyformValues` key narrowing for the editor package TypeScript config.
- Added the missing `ParameterId` type import for Rotation Deformer editing test helpers.
- Updated Rig Tool Inspector read-model test fixtures with `keyformSetCount` and `keyformKeyCount`.

### Files Changed In Fix Loop 1

- `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts`
- `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
- `discussion/implementation/waves/wave75/wave75-domain-a-deformer-keyform-authoring-inspector-density-cleanup-report.md`

### Verification After Fix Loop 1

- `pnpm.cmd --dir apps/editor run typecheck`
  - still failed, but the Wave75 Domain A errors reported by review are gone.
  - Remaining errors are outside the Wave75 Domain A changed files, including `editor-session-context-history.test.ts`, `editor-project-storage.test.ts`, `canvas-render-scene-adapter.ts`, and `project-storage-screen.test.ts`.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts apps/editor/src/workspace/panels/parameter-bar.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
  - escalated rerun passed: 5 files / 29 tests.
- `pnpm.cmd typecheck`
  - passed.
- `node scripts/check-source-organization.mjs`
  - passed.
- `node scripts/check-dependencies.mjs`
  - passed.
- `git diff --check`
  - passed with CRLF normalization warnings only.

### Residual Risk Update

low-to-medium remains unchanged.

- The blocking Wave75 type mismatches are fixed.
- Full `apps/editor` package typecheck still has unrelated existing or cross-domain errors outside this fix loop's ownership boundary.

## Independent Review Gate

All required Wave75 Domain A review lanes passed after Fix Loop 1:

- Spec Compliance Review: `pass` at [../../reviews/wave75/wave75-domain-a-spec-compliance-review.md](../../reviews/wave75/wave75-domain-a-spec-compliance-review.md).
- Design / Development Compliance Review: `pass` at [../../reviews/wave75/wave75-domain-a-design-development-review.md](../../reviews/wave75/wave75-domain-a-design-development-review.md).
- Test Adequacy Review: `pass` at [../../reviews/wave75/wave75-domain-a-test-adequacy-review.md](../../reviews/wave75/wave75-domain-a-test-adequacy-review.md).

The remaining `apps/editor` package typecheck failures are recorded by the reviews as outside the Wave75 Domain A changed/expected files and outside this domain's ownership boundary.

## User Decision Points

None.
