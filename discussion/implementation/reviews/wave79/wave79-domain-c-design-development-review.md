# Wave79 Domain C Design / Development Compliance Review

- verdict: `pass`
- target wave: Wave79 `viewer-runtime-view-v0`
- domain: C `wave79-dedicated-viewer-screen-integration`
- review lane: Design / Development Compliance Review
- date: 2026-06-17

## Findings

No blocking, major, or minor design/development compliance findings.

## Scope Reviewed

- Domain C source and test files:
  - `apps/editor/src/workspace/authoring-workspace.tsx`
  - `apps/editor/src/workspace/app-bar.tsx`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- Accepted dependency files inspected as needed:
  - `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
  - `apps/editor/src/workspace/viewer/runtime-controls.tsx`
  - `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
  - `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`
- Supporting context checked for boundaries/discoverability:
  - `apps/editor/src/app/editor-app.tsx`
  - `apps/editor/src/state/editor-ui-store.ts`
  - `apps/editor/src/workspace/workspace-data.ts`
  - `vitest.config.ts`

## Basis Used

- `discussion/implementation/orchestration/wave79-plan.md`
- `discussion/implementation/waves/wave79/wave79-domain-a-clean-stage-render-foundation-report.md`
- `discussion/implementation/waves/wave79/wave79-domain-b-runtime-controls-session-state-ui-foundation-report.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Compliance Notes

- Dedicated Viewer integration is scoped to the workspace shell and Viewer screen. `AuthoringWorkspaceContent` branches on `activeEntry === "viewer"` and renders `ViewerRuntimeScreen` instead of the authoring panel layout at `apps/editor/src/workspace/authoring-workspace.tsx:32`, `apps/editor/src/workspace/authoring-workspace.tsx:40`, and `apps/editor/src/workspace/authoring-workspace.tsx:43`.
- Authoring `ParameterBar` is suppressed only while Viewer is active at `apps/editor/src/workspace/authoring-workspace.tsx:83`; normal authoring branches still render it.
- The App Bar Viewer icon activates the same `activeEntry` path as the workspace Viewer entry through `activateEntry("viewer")` at `apps/editor/src/workspace/app-bar.tsx:32` and `apps/editor/src/workspace/app-bar.tsx:137`. The existing `viewer` entry remains defined as a view entry at `apps/editor/src/workspace/workspace-data.ts:53`.
- Providers/stores remain mounted. `EditorSessionProvider` wraps `FoundationWorkspace` at `apps/editor/src/app/editor-app.tsx:8`, so the Viewer branch is an in-provider display switch rather than a session remount.
- Viewer open/back does not reset authoring session state. `ViewerRuntimeScreen` reads `session` and `parameterValues`, keeps Viewer controls in local React state, and the Back helper only calls `setActiveEntry("import")` at `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:69`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:72`, and `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:159`.
- Runtime Controls state is Viewer-local/session-only. The state shape is `parameterOverrides` plus `search` at `apps/editor/src/workspace/viewer/runtime-controls-state.ts:14`, and reset/update helpers return new local state rather than calling session setters at `apps/editor/src/workspace/viewer/runtime-controls-state.ts:122`, `apps/editor/src/workspace/viewer/runtime-controls-state.ts:152`, and `apps/editor/src/workspace/viewer/runtime-controls-state.ts:187`.
- Runtime overrides feed Clean Stage through a new parameter value map. `createViewerRuntimeCleanStageProjection` merges authoring parameter values with normalized runtime overrides and passes the result into `createViewerCleanStageProjection` at `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:140`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:144`, and `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:152`.
- Clean Stage uses Domain A lower-level helpers, not `CanvasPreviewPanel`. `viewer-clean-stage.ts` calls `createCanvasRenderProjection` with `selection = null` and renders through `renderCanvasProjection` with clean overlays at `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:38` and `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:47`.
- Runtime Controls use the Domain B props/state primitive, not the full `ParameterBar`. `RuntimeControlsProps` accepts only `parameters`, `state`, and `onStateChange` at `apps/editor/src/workspace/viewer/runtime-controls.tsx:18`, and the component does not import `useEditorSession`.
- UI semantics stay within Viewer v0. Static inspection found no Viewer-owned keyform add/update/delete controls, authoring overlay toggles, Parameter Manager editing, screenshot/export, Compare/Diff, category/group filter, favorites, crop guide, or functional playback transport.
- Source organization is acceptable. New production files under `apps/editor/src/workspace/viewer/` are cohesive (`viewer-runtime-screen`, `viewer-clean-stage`, `runtime-controls`, `runtime-controls-state`); no `index.ts`, broad `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` implementation file was introduced.
- Test discoverability is compliant. Root Vitest includes `apps/*/src/**/*.test.ts` at `vitest.config.ts:5`, and Domain C uses `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`.

## Boundary / Mutation / Dependency Notes

- No Domain C change was found under `packages/runtime-core/**`, package manifests, lockfile, save/load schema files, operation-core implementation, mesh/deformer/keyform operation code, or broad renderer/evaluation code.
- Static search over reviewed Viewer files found no production calls to `editKeyformKey`, keyform payload creation, operation/history commit helpers, `setActiveParameterValue`, `resetActiveParameterValue`, `saveProject`, or `openProjectFile`.
- `computedDynamics` parameters remain excluded by the Domain B state helper at `apps/editor/src/workspace/viewer/runtime-controls-state.ts:57`; Domain C does not bypass that helper.
- `git status --short -uall package.json pnpm-lock.yaml packages/runtime-core apps/editor/package.json` returned no changed dependency/package files.
- `rg` checks over reviewed Domain C and accepted dependency files found no Cubism SDK/Core dependency, Cubism format import/export path, or positive runtime/oracle compatibility claim.

## Verification Considered / Performed

Considered Orch-Sylph verification:

- Focused Viewer Vitest command passed: 3 files / 18 tests after sandbox escalation for esbuild spawn.
- `pnpm.cmd typecheck` passed.
- `node scripts/check-source-organization.mjs` passed.
- `node scripts/check-dependencies.mjs` passed.
- Touched-file `git diff --check` with temporary intent-to-add for new Domain C files passed, with CRLF warnings only.

Performed in this review:

- Read the Wave79 plan, Domain A/B reports, Viewer screen spec, and listed development policies.
- Inspected Domain C source/test files directly from current workspace content and diffs for existing tracked files.
- Read accepted dependency files for Clean Stage, Runtime Controls, editor session context, and parameter helper boundaries.
- Ran static searches for forbidden authoring mutation, operation/history, save/load, dependency/Cubism, export/diff/playback, and UI leakage terms.
- Checked package/runtime-core status and root Vitest include pattern.

## Residual Risks

- No browser or pixel-level smoke was performed by this reviewer; integrated visual correctness relies on the focused Viewer tests, Domain A renderer tests, and later final integration review.
- The shared global App Bar remains visible while Viewer is active, including existing Open/Save/Undo/Redo controls. This review treats those as pre-existing shell controls outside the Viewer-owned screen semantics, but a future UX decision may need a stricter non-mutating Viewer shell mode.
- Back returns to the canonical Authoring Workspace entry `"import"` rather than restoring a previous task/view entry. This matches the current routing model and does not reset active tool, selection, active parameter, or parameter values, but it is a future UX refinement point if "return to previous entry" becomes required.
- Full runtime-core parity, grid2d parity, dynamics playback, export, Compare/Diff, and crop/presentation guide remain explicitly out of Wave79 scope.

## User-Decision Points

None. No design/development decision is needed to accept Domain C.
