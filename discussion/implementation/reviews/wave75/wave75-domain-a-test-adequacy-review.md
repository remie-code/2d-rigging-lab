# Wave75 Domain A Test Adequacy Review

## Verdict

pass

No blocking or needs-change test adequacy findings were found.

## Basis Reviewed

- `discussion/implementation/orchestration/wave75-plan.md`
- `discussion/implementation/waves/wave75/wave75-domain-a-deformer-keyform-authoring-inspector-density-cleanup-report.md`
- `discussion/implementation/orchestration/wave74-plan.md`
- `discussion/implementation/waves/wave74/wave74-final-integration-report.md`
- `discussion/implementation/reviews/wave74/wave74-final-clean-integration-review.md`
- `discussion/implementation/waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md`
- `discussion/implementation/waves/wave74/wave74-domain-b-save-load-keyform-visibility-hardening-report.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/parameter-keyform.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- Relevant Wave75 source and tests in `apps/editor/**`.

## Coverage Matrix

| Required evidence item | Verdict | Direct evidence |
|---|---:|---|
| Focused Playwright coverage for the exact PSD -> mesh -> Rotation Deformer -> `Face Angle Z` -> `Ends + Center` -> max key -> angle drag -> translation drag -> midpoint slider workflow | covered | `apps/editor/e2e/psd-import.e2e.spec.ts:538` defines the focused workflow. It imports PSD, applies mesh, creates Rotation Deformer, selects `Face Angle Z`, and presses `Ends + Center` at `apps/editor/e2e/psd-import.e2e.spec.ts:541`, `apps/editor/e2e/psd-import.e2e.spec.ts:550`, `apps/editor/e2e/psd-import.e2e.spec.ts:557`, `apps/editor/e2e/psd-import.e2e.spec.ts:559`, and `apps/editor/e2e/psd-import.e2e.spec.ts:561`. |
| Browser proof asserts angle and translation interpolation, not only UI click success | covered | The same test asserts max angle changed after angle handle drag at `apps/editor/e2e/psd-import.e2e.spec.ts:569` through `apps/editor/e2e/psd-import.e2e.spec.ts:572`, asserts translation handle drag switches to keyform mode and produces non-zero translation at `apps/editor/e2e/psd-import.e2e.spec.ts:574` through `apps/editor/e2e/psd-import.e2e.spec.ts:579`, then asserts midpoint translation x/y and angle are approximately half at `apps/editor/e2e/psd-import.e2e.spec.ts:587` through `apps/editor/e2e/psd-import.e2e.spec.ts:596`. Artwork/evaluated movement is asserted via `data-primary-hit-screen-x/y` delta at `apps/editor/e2e/psd-import.e2e.spec.ts:581` through `apps/editor/e2e/psd-import.e2e.spec.ts:603`. |
| Unit/model coverage for missing translation keyform materialization from existing Rotation key positions | covered | `createMaterializedEditKeyformPayloads` sorts/dedupes source keys and refuses non-exact current values at `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:394` through `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:417`. Tests assert materialized payloads from existing key positions at `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:245` through `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:291`, and reject non-exact current values at `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:293` through `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:320`. |
| Coverage that one exact-key drag updates only that key without clobbering other materialized keys | covered | Canvas commit tests materialize keys at `-30`, `0`, and `30`, then update only the exact `30` key while preserving `-30` and `0` at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:291` through `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:353`. Existing exact translation keyform update also preserves `restTranslation` at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:252` through `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:288`. |
| Translation drag without active keyform context remains setup/rest editing if fallback remains rest/setup editing | covered | Hook-level test starts with no active keyform context and asserts `translationEditMode` is `restTranslation`, commit count is one, and `restTranslation` changes at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:487` through `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:537`. Source fallback is explicit at `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:742` through `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:745`. |
| Ambiguous between-key translation drag does not silently clobber data | covered | Hook-level test asserts locked `missingCurrentKeyform`, no commit, empty undo stack, and existing key unchanged at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:680` through `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:703`. |
| UI tests prove removed Rotation Parameter Binding per-card Add/Update/Delete buttons are gone and remaining value controls are reachable | covered | Rotation binding test asserts angle, translation, and opacity cards remain visible, omits per-card Add/Update/Delete controls, and keeps angle/translation inputs enabled at `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:45` through `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:93`. |
| UI tests prove removed Warp Parameter Binding Add/Update/Delete buttons are gone and remaining controls are reachable | covered | Warp binding test asserts lattice and opacity cards remain visible, point count remains visible, per-card Add/Update/Delete controls are absent, and lattice value controls still exist at `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:95` through `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:137`. |
| UI tests prove duplicate Rotation/Warp Inspector opacity fields and Rotation summary rows are gone, while setup fields remain editable/compact | covered | Warp Inspector opacity removal is asserted at `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:37` through `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:81`. Rotation Inspector setup field reachability and removed `Bound children`, `Angle keyforms`, explanatory copy, and opacity field are asserted at `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:84` through `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:125`. Source compact setup layout is at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:730` through `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:799`. |
| Remaining intended authoring controls are reachable after per-card button removal | covered | Parameter Bar exposes `Keyform target` and Add/Update/Delete/Ends/Ends+Center controls at `apps/editor/src/workspace/panels/parameter-bar.tsx:152` through `apps/editor/src/workspace/panels/parameter-bar.tsx:260`; target selector rendering for Rotation angle, Translation, and Opacity multiplier is tested at `apps/editor/src/workspace/panels/parameter-bar.test.ts:87` through `apps/editor/src/workspace/panels/parameter-bar.test.ts:100`. Portable save/load e2e uses the selector for Translation and Warp lattice offsets at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:76` through `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:93`. |
| Save/load coverage is updated or has clear Wave74 rationale | covered with residual risk | Wave74 final report and clean review establish save/load for existing deformer keyforms and Rotation translation interpolation. Wave75 additionally updates portable save/load e2e to use the new Parameter Bar target selector for Rotation translation and Warp lattice authoring at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:69` through `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:99`, then verifies restored Rotation angle/translation and Warp offsets after load at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:236` through `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:258`. No blocker: the new canvas-materialization workflow is browser-proven before save/load, and save/load is property-keyform based once the keyform exists. |
| Gnome verification matrix was reviewed and focused checks were rerun where feasible | covered | Gnome's report verification was cross-checked against source/tests. This review reran focused Vitest and both Playwright specs listed below. |

## Findings

No blocking findings.

No needs-change findings.

## Verification Commands Run

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts apps/editor/src/workspace/panels/parameter-bar.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts` | Initial sandbox attempt failed during Vitest config startup with esbuild `spawn EPERM`. Escalated rerun passed: 5 files / 29 tests. |
| `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/psd-import.e2e.spec.ts` | First attempt failed because `http://127.0.0.1:4173` was already in use. After the transient listener cleared, a sandbox rerun failed with `spawn EPERM`. Escalated rerun passed: 10 tests, including the focused Rotation angle + translation keyform workflow. |
| `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts` | Escalated rerun passed: 1 test. |

Playwright generated test-results output during verification. The generated portable-project JSON and empty result directory were removed. The tracked `.last-run.json` metadata was restored to its original content after cleanup.

## Fix Loop 1 Re-review

### Verdict

pass

The Fix Loop 1 changes do not weaken the test adequacy basis for Wave75 Domain A. The focused affected tests still cover materialization, exact-key editing, fallback/lock behavior, and UI cleanup after the type fixes.

### Scope Reviewed

- Gnome's Fix Loop 1 update in `discussion/implementation/waves/wave75/wave75-domain-a-deformer-keyform-authoring-inspector-density-cleanup-report.md:128`.
- `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts`
- `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`

### Test Adequacy Impact

- `materializeKeyform` now belongs to `RotationTranslationEditMode`, the consumer-facing edit-mode union, at `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:37`. `useRotationDeformerInteraction` routes that mode to `createRotationMaterializedTranslationKeyformGesture` at `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:520`.
- Existing Rotation angle key positions are still the source for translation materialization via `listRotationAngleKeyformValues` at `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:100` and the interaction hook wiring at `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:624`.
- Exact current-key materialization remains guarded by a source-key match at `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:723`; no-key fallback remains `restTranslation` at `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:743`.
- The focused canvas tests still assert materialized non-current keys preserve fallback values and a later exact-key drag updates only the current key at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:292` through `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:353`.
- Hook-level drag coverage still exercises `materializeKeyform` mode, editability, commit count, materialized key values, and unchanged `restTranslation` at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:543` through `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:595`.
- Rig Tool Inspector test fixtures now include `keyformSetCount` / `keyformKeyCount` at `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:145` and `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:175`, while the UI cleanup assertions still prove removed duplicate Rotation summaries and opacity field absence at `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:84`.

### Commands Run After Fix Loop 1

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts apps/editor/src/workspace/panels/parameter-bar.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts` | Sandbox attempt failed with esbuild `spawn EPERM`; escalated rerun passed: 5 files / 29 tests. |
| `pnpm.cmd --dir apps/editor run typecheck` | Failed. Remaining errors are in `editor-session-context-history.test.ts`, `editor-project-storage.test.ts`, `canvas-render-scene-adapter.ts`, and `project-storage-screen.test.ts`. No errors were reported in the Wave75 Domain A changed files or focused affected tests. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `pnpm.cmd typecheck` | Passed. |

### Remaining Findings

No blocking findings.

No needs-change findings for this Test Adequacy Review lane.

The remaining `apps/editor` package typecheck failures do not affect the Wave75 Domain A test adequacy verdict: the focused affected tests compile and pass, and the reported type errors are outside the materialization/edit-mode, Parameter Binding, Parameter Bar, and Rig Tool Inspector cleanup surfaces reviewed here. They remain broader app/package typecheck debt or cross-domain integration risk, not a test adequacy gap for this domain.

## Residual Risks

- There is no single Playwright test that performs the canvas-materialized Rotation translation workflow, saves that exact project, reloads it, and verifies the materialized translation keys after load. This is non-blocking because Wave75 browser coverage proves materialization and interpolation before save/load, while Wave74 plus the updated portable save/load e2e prove persisted Rotation translation keyforms restore correctly once present.
- The exact workflow e2e locates Rotation handles by probing current overlay geometry. This is acceptable for current coverage and already passed, but future handle geometry changes may require test helper maintenance.
- UI removal assertions are mostly static markup/component assertions for absence of controls. User-level reachability is supplemented by e2e use of Parameter Bar Add and target selection.

## User-Decision Points

None.
