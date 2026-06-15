# Wave72 Domain A Rotation Deformer Edit UX Report

## Verdict

done

Domain A implemented undoable Rotation Deformer edit UX for operation payloads, authoring mutations, Inspector numeric fields, Canvas handle projection/hit-testing, drag preview, and keyform-aware angle commit behavior.

## Files Changed

- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operations/update-rig-control.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
- `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`

Observed unrelated/parallel dirty state was left untouched, including orchestration map/plan files, Project Storage files, App Bar/authoring workspace changes, portable bundle files, and Playwright test-results state. Domain A touched `apps/editor/src/features/editor-session/editor-session-context.tsx` narrowly for provider testability (`initialSession` / `initialSelection`) during fix loop 2; existing parallel Project Storage edits in that file were not modified as Domain A behavior.

## Validation Commands / Results

- `pnpm.cmd exec vitest run packages/authoring-core/src/rig-control-mutations.test.ts packages/operation-core/src/operations/rig-control.test.ts`: passed, 2 files / 28 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/rig-control.test.ts packages/authoring-core/src/rig-control-mutations.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/canvas/canvas-renderer.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts`: passed, 9 files / 74 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: passed; only existing CRLF conversion warnings were reported.

Initial sandboxed Vitest attempts failed with `spawn EPERM` from esbuild startup; focused Vitest runs were rerun with approved escalation.

Playwright/e2e: not run. The existing editor Playwright script is PSD-import focused (`apps/editor` `test:e2e:psd-import`) and no stable Rotation Deformer edit path exists yet. Closest browser-facing evidence is covered through projection, renderer data attributes, Inspector static markup, and focused Canvas gesture/helper tests.

## Basis Coverage Self-Report

- Operation policy: Rotation pivot/rest edits now travel through `updateRigControl`; Canvas drags commit via existing editor gesture commit controller.
- UX-backed package logic: Persistent fields are accepted in Operation Core and Authoring Core before UI uses them.
- Source organization/dependency policy: no new dependencies; new Canvas helpers are under the existing Canvas workspace boundary; source/dependency guards passed.
- Schema/id conventions: reused existing `Vec2Schema`, `RigControlIdSchema`, deterministic keyform IDs, and existing operation diagnostics pattern.
- Rig tool design: committed Rotation Inspector still exposes name, parent, opacity, children summary, parent creation actions, and parameter binding section; it now adds editable pivot/rest angle controls.
- Parameter/keyform design: direct angle drag only updates an exact editable keyform or unkeyed rest angle; ambiguous between-keyform state is locked.
- Canvas preview design: selected Rotation overlay now has pivot and angle handles, hover/lock state, preview rendering, and test-facing state attributes.
- Wave71 boundary: no mesh generation algorithm or mesh default changes.

## Intentionally Deferred Basis Items

- Full Playwright Rotation editing scenario was not added because there is no existing stable Rotation e2e path and current e2e coverage is PSD import oriented.
- Canvas direct editing for parented/nested Rotation Deformers is explicitly blocked. The stored pivot is local while projected overlay pivot is evaluated/world space; no inverse-transform edit contract is defined in the basis. Inspector numeric local-field editing remains available.
- No Domain B save/load UI, archive/filesystem, browser-local slot, App Bar Open/Save, or session hydration work was implemented.

## User-Facing UX Trace

- Selecting a committed Rotation Deformer in Rig Tool shows editable pivot X/Y and rest angle numeric controls.
- Inspector copy states that rest angle is the unkeyed fallback and that existing Rotation angle keyforms stay authoritative at keyed parameter values.
- Canvas overlay draws a pivot handle and an angle handle for committed selected Rotation Deformers.
- Pointer drag previews geometry during drag; pointer-up commits through one history entry; pointer-cancel/abort discards preview with no commit.
- Unsupported parented/nested Canvas direct edits show non-editable handle state and expose `data-rotation-deformer-angle-lock-reason`.

## Operation / Package Contract Trace

- `UpdateRigControlPayloadSchema` now accepts `pivot` and `restAngleDegrees`.
- Authoring update validates finite Rotation pivot/rest angle, rejects Rotation fields on non-`rotation2d`, preserves hierarchy and keyforms, and participates in no-op detection.
- Operation diff reports `/pivot` and `/restAngleDegrees`; diagnostics map invalid Rotation fields and wrong-kind use.
- No package-format or portable bundle schema changes were required; existing Rotation fields are already persistent model fields.

## Inspector and Canvas UX Trace

- Inspector: `CommittedRotationDeformerInspector` supports pivot/rest edits and `createRotationUpdatePayload` emits minimal Rotation update payloads.
- Canvas projection/evaluation: `rotationPreview` updates overlay and evaluated drawable mesh geometry.
- Canvas renderer: Rotation overlay handle rendering uses shared handle geometry and editable/hover state.
- Canvas preview panel: Rotation interaction is wired alongside Warp interaction and exposes test-facing attributes for mode, lock reason, editable flags, hover handle, preview active, and evaluated overlay state.

## Keyform-Aware Angle Behavior Trace

- If no Rotation angle keyforms exist, Canvas angle drag edits `restAngleDegrees`.
- If the active parameter is exactly on an editable Rotation angle keyform, Canvas angle drag updates that keyform's `angleDegrees`.
- If angle keyforms exist but the active parameter is between keys or otherwise not exactly editable, Canvas angle drag is locked and does not silently create or overwrite keyforms.
- Existing numeric `ParameterBindingSection` behavior remains available and was covered by existing/focused tests.

## Save/Load State Preservation Trace

N/A for Domain A implementation scope. Rotation persistence contract is covered by operation/authoring updates to existing persistent fields (`pivot`, `restAngleDegrees`) and no package storage/save/load wiring was changed.

## Must-not Compliance Evidence

- Did not implement Project Storage, portable bundle import/export, App Bar Open/Save, browser-local save slot, archive/filesystem, or session hydration.
- Did not touch mesh generation algorithms, renderer architecture rewrite, Viewer, or Runtime View.
- Did not add dependencies.
- Did not revert or normalize unrelated dirty changes.
- Preserved Warp editing behavior and tests.

## Residual Risk Classification

- Low: Rotation edit operations, Inspector payloads, projection preview, hit testing, and gesture commit behavior are covered by focused tests and typecheck.
- Medium: Parented/nested Rotation Canvas direct manipulation is blocked rather than solved; needs a future design for local/world inverse transform editing if required.
- Medium: No Playwright Rotation workflow exists; current confidence comes from component/model/projection/gesture tests rather than a full browser e2e flow.

## Domain B Overlap

No Domain B save/load implementation was added or changed by Domain A. The workspace contains parallel dirty/untracked Project Storage and portable bundle files, plus App Bar/workspace changes. Fix loop 2 did touch already-dirty editor context/test files narrowly for provider testability and Domain A selection coverage; the Project Storage behavior in those files is not claimed as Domain A work.

## Fix Loop 1 Update

### Fix Loop 1 Verdict

done

### Fix Loop 1 Changes

- Fixed the Editor package typecheck blocker in `apps/editor/src/workspace/canvas/canvas-renderer.ts` by aligning the renderer import/call with `listRotationDeformerHandlePositions`.
- Fixed the Editor package typecheck blocker in `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts` by narrowing scalar Rotation angle key shapes before reading `value` / `statePatch`.
- Added rotation-specific history coverage in `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts` for pivot/rest edits and angle keyform edits with undo/redo. The initial local selection assertion from this loop was later removed and replaced by the stateful provider test in fix loop 2.
- Added hook-level lifecycle coverage in `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts` for pointer down/move/up commit, pointer-cancel no commit, preview state, single history commit, parented `parentedUnsupported` lock state, and no commit for locked parented Rotation edits.

### Fix Loop 1 Validation

- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`: failed, but no remaining Domain A errors were reported after the fixes. Remaining failures are outside Domain A:
  - `src/features/editor-session/editor-session-context-history.test.ts` branded mesh fixture cast.
  - `src/features/project-storage/model/editor-project-storage.test.ts` branded triangle id fixture.
  - `src/workspace/canvas/canvas-render-scene-adapter.ts` shared tuple narrowing issue.
  - `src/workspace/project-storage/project-storage-screen.test.ts` Project Storage fixture typing.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/authoring-core/src/rig-control-mutations.test.ts`: passed, 6 files / 65 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: passed, CRLF conversion warnings only.

### Fix Loop 1 Evidence Notes

- Playwright Rotation edit path remains intentionally not added in Domain A because the available e2e script is PSD-import focused. The replacement evidence is now stronger than the initial pass: hook-level pointer lifecycle tests exercise the actual `useRotationDeformerInteraction` API without adding dependencies, model/history tests cover redo, and fix loop 2 adds stateful provider/context selection preservation.
- The parented/nested unsupported path is now test-covered through hook state: `angleEditMode="locked"`, `angleLockReason="parentedUnsupported"`, disabled renderer state, and no commit/history entry after attempted drag.

## Fix Loop 2 Update

### Fix Loop 2 Verdict

done

### Fix Loop 2 Changes

- Replaced the vacuous local-constant selection assertion with a stateful `EditorSessionProvider` history integration test in `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`.
- The new provider test selects a Rotation Deformer through `context.selectRigControl`, commits pivot/rest edits through `context.updateRigControl`, commits an angle keyform edit through `context.editKeyformKey`, and asserts `context.selection` remains `{ kind: "rigControl", id }` across commit, undo, and redo.
- Added narrow `EditorSessionProvider` testability props (`initialSession`, `initialSelection`) in `apps/editor/src/features/editor-session/editor-session-context.tsx`; no save/load behavior was changed for Domain A.
- Removed the previous local selection assertion from `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`; the model test now only claims redo/history coverage.

### Fix Loop 2 Validation

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/authoring-core/src/rig-control-mutations.test.ts`: passed after sandbox escalation, 7 files / 74 tests. The first sandboxed attempt failed during Vitest config load with esbuild `spawn EPERM`.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`: failed, with no remaining Domain A selection/provider errors. Remaining failures are existing non-Domain-A/shared failures: the branded mesh fixture cast in `editor-session-context-history.test.ts`, Project Storage fixture typing in `editor-project-storage.test.ts` and `project-storage-screen.test.ts`, and tuple narrowing in `canvas-render-scene-adapter.ts`.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: passed; CRLF conversion warnings only.

### Fix Loop 2 Evidence Notes

- The remaining Test Adequacy blocker is addressed by the provider/context path, not by a standalone model constant. Selection is read from live `context.selection` after each state transition.
- Domain B overlap is limited to touching already-dirty `editor-session-context.tsx` and `editor-session-context-history.test.ts` for provider testability and the Domain A selection test. No portable save/load, App Bar, archive/filesystem, or browser-local save-slot implementation was added or changed by Domain A.
