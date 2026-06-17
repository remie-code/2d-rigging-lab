# Wave81 Domain B: Editor Dynamics Tool Authoring Preview Report

## Verdict / Result

Verdict: done.

Implemented Editor-side Dynamics Tool authoring and preview for the active v2 contract:
`dynamics-file-v2`, `inputs[] / pendulums[] / outputs[]`, multiple driver inputs, v0 one
pendulum and one output, additive output as `base + offset`, operation-backed
create/update/delete, and session-only preview state.

## Basis Coverage Self-Report

Read and applied the requested Wave81 plan, Dynamics Tool screen design, Domain A report,
Domain A review lanes, component/implementation maps, backlog, and the requested development
conventions.

No basis documents were deferred.

## Files Changed

Dynamics model and session integration:
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`

Inspector/UI:
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/panels/inspector-panel.test.ts`

Parameter Bar and Canvas gating/preview injection:
- `apps/editor/src/workspace/panels/parameter-bar.tsx`
- `apps/editor/src/workspace/panels/parameter-bar.test.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/panels/canvas-preview-panel.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`

No package manifests, package dependencies, Runtime Viewer, or Viewer controls were changed.

## UI / Preview Trace

`activeTool === "dynamics"` now renders `DynamicsToolInspector` from `InspectorPanel`.

The inspector provides:
- Tool-local group list and group selection, with no global `EditorSelection` expansion.
- New/create, apply/update, delete controls.
- Name, enabled toggle, preset/defaults.
- Multiple driver input rows with parameter, kind, influence, invert.
- Advanced normalization min/center/max fields.
- One pendulum editor.
- One output editor with `angle | positionX | positionY`, defaulting to `angle`.
- Validation section that blocks create/apply on error.
- Session-local preview driver controls and reset.

Preview driver values live in `EditorSessionProvider` local state and are not written to the
authoring session, portable project, or operation history.

## Additive Offset Contract Trace

Editor preview uses the v2 additive contract:
- Base parameter map starts from parameter defaults.
- Inspector-local driver values override only driver input parameters.
- The selected group simulation state is stepped/reset in Editor-local preview state.
- Output summary computes `offset = clamp(state.angle * strength * sign, -limit, limit)`.
- Effective output value is `baseValue + offset`, then clamped to the output parameter range.

Covered by `dynamics-tool-state.test.ts` and `canvas-projection.test.ts`.

## Effective Parameter Injection Trace

`CanvasPreviewPanel` now chooses the parameter map explicitly:
- Normal modes use existing `parameterValues`.
- Dynamics mode uses `dynamicsToolPreviewEvaluation.parameterValues`.

That map is passed into `createCanvasRenderProjection`, which already feeds
`canvas-projection.ts` / `canvas-evaluation.ts` before keyform/deformer evaluation. The new
Canvas projection test verifies additive Dynamics output drives a rotation keyform through the
existing evaluation path.

## Operation / History Proof

Committed group authoring uses Operation Core wrappers:
- `commitCreateDynamicsGroup`
- `commitUpdateDynamicsGroup`
- `commitDeleteDynamicsGroup`

`EditorSessionProvider` exposes corresponding commands through `runCommandWithHistory`, so
committed create/update/delete are undoable/redoable.

Preview-only methods:
- `setDynamicsToolPreviewGroupId`
- `setDynamicsToolPreviewDriverValue`
- `resetDynamicsToolPreviewSimulation`

These only update React local state and never call Operation Core or history recording. The
history integration test creates a group, performs preview select/driver/reset, then Undo removes
the created group, proving preview did not add a history entry.

## Save / Load / Session-Only Trace

No save/load schema or package persistence code was changed. Dynamics group commits persist
through the existing authoring session and package save/load path from Domain A.

Preview state is reset by local state initialization and cleared on project load plus undo/redo
transient cleanup. It is not operation-backed and not included in portable project export.

## Parameter Bar And Canvas Gating Proof

Parameter Bar:
- Renders read-only/disabled controls when `activeTool === "dynamics"`.
- Slider thumb and key markers do not call value mutation while disabled.
- Context-level guards also prevent `setActiveParameterValue`, reset, and keyform edits in
Dynamics mode.

Canvas:
- Dynamics mode passes the Dynamics effective parameter map to Canvas evaluation.
- Dynamics mode disables authoring selection via `isCanvasAuthoringSelectionEnabled`.
- Left-click Drawable selection and Rig/Mesh edit starts are gated; pan/zoom navigation remains.

## Must-Not Compliance Evidence

Did not reintroduce `computedDynamics` or replace-output semantics.

Did not implement Viewer v1, Viewer playback/time controls, frame stepping UI, mixer,
same-output multi-group blending, multi-pendulum or multi-output authoring, collision, cloth, IK,
Cubism compatibility, unrelated mesh/deformer/keyform changes, or new external dependencies.

Did not add a global `EditorSelection` kind for Dynamics Group.

Did not put Dynamics Group management in Parameter Manager.

Did not make preview state persistent or operation-history-backed.

## Verification Performed

`pnpm.cmd typecheck`
- Passed.

Focused tests:
`pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts apps/editor/src/workspace/panels/inspector-panel.test.ts apps/editor/src/workspace/panels/parameter-bar.test.ts apps/editor/src/workspace/panels/canvas-preview-panel.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- Initial sandbox run failed with `spawn EPERM` from esbuild.
- Re-run with escalation passed: 7 files, 47 tests passed.

`node scripts/check-source-organization.mjs`
- Passed: `Source organization guard passed.`

`node scripts/check-dependencies.mjs`
- Passed: `Dependency guard passed.`

`git diff --check -- apps/editor/src discussion/implementation/waves/wave81`
- Exit 0.
- Git emitted CRLF conversion warnings for existing dirty worktree files.

PowerShell trailing-whitespace scan for new Wave81 Domain B files
- Passed: `No trailing whitespace in new Wave81 Domain B files.`

## Residual Risks

No browser/manual visual QA was run; coverage is by typecheck, SSR/component tests, model tests,
provider history tests, and Canvas projection tests.

Current authoring mutation validation checks Dynamics bindings against `graph.parameters`.
Focused committed-operation tests therefore use explicit graph parameters. Editor surfaces
initialized preset parameters through existing parameter helpers, so sessions with only initialized
preset parameters may still receive Operation Core rejection until the parameter persistence /
preset-binding authority is resolved outside Domain B.

## User-Decision Points

None for this implementation wave.
