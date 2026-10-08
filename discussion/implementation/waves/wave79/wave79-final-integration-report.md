# Wave79 Final Integration Report: Viewer / Runtime View v0

## Status

- Target wave: Wave79 `viewer-runtime-view-v0`
- Report status: final complete / pass
- Wave status: final complete / pass after independent final clean integration review
- Final gate: `discussion/implementation/reviews/wave79/wave79-final-clean-integration-review.md` records `pass` after Fix loop 1 re-review.

Wave79 adds the first dedicated Viewer / Runtime View v0 for finished-model confirmation from the React Editor. The implemented scope is bounded to the current Editor Canvas evaluation path: a clean finished-model stage, Viewer-local Runtime Controls, dedicated navigation from the existing `viewer` entry, and suppression of authoring `ParameterBar` UI while Viewer is active.

## Domain Summary

| Domain | Report | Review status | Summary |
|---|---|---|---|
| A. Clean Stage Render Foundation | [wave79-domain-a-clean-stage-render-foundation-report.md](wave79-domain-a-clean-stage-render-foundation-report.md) | pass across Spec, Design / Development, and Test Adequacy lanes | Adds reusable Viewer Clean Stage projection/render helpers over existing Canvas projection and renderer paths, including clean overlay and origin-guide suppression. |
| B. Runtime Controls Session State + UI Foundation | [wave79-domain-b-runtime-controls-session-state-ui-foundation-report.md](wave79-domain-b-runtime-controls-session-state-ui-foundation-report.md) | pass after fix loop 1 and three Review-Sylph lanes | Adds Viewer-local runtime control state, parameter override normalization, search, reset helpers, and props-based Runtime Controls UI without authoring mutation. |
| C. Dedicated Viewer Screen Integration | [wave79-domain-c-dedicated-viewer-screen-integration-report.md](wave79-domain-c-dedicated-viewer-screen-integration-report.md) | pass across Spec, Design / Development, and Test Adequacy lanes | Wires the dedicated Viewer screen, App Bar Viewer activation, Back action, Clean Stage, Runtime Controls, and `ParameterBar` suppression. |

## Feature Meaning

Viewer / Runtime View v0 is a finished-model confirmation screen. It lets the user inspect the current committed project-defined model as a character preview, without authoring overlays or keyform authoring controls.

It is not an authoring surface, diagnostics surface, export surface, runtime package app, or parity expansion with runtime-core. It does not edit mesh, deformer, keyform, parameter definitions, hierarchy, clipping, opacity, storage, or package state.

## Clean Stage Evidence

Clean Stage uses the existing Editor Canvas lower-level path rather than a new renderer or `CanvasPreviewPanel` reuse:

- `createViewerCleanStageProjection(session, { parameterValues })`
- `createCanvasRenderProjection(session, null, { parameterValues })`
- `createCanvasEvaluatedScene` through the existing Canvas projection path
- `renderViewerCleanStageProjection(...)`
- `renderCanvasProjection(...)`

Overlay suppression is explicit through `VIEWER_CLEAN_STAGE_OVERLAYS`: grid, origin guide, canvas bounds, selection bounds, mesh overlay, deformer overlay, and isolate-selected dimming are disabled. Domain A also added `CanvasOverlayState.originGuide?: boolean` so existing authoring Canvas callers keep the default origin guide while Viewer Clean Stage suppresses it.

The Clean Stage keeps current Canvas evaluation behavior for clipping, opacity, mesh, deformer, and linear keyform evaluation. Domain A tests cover no-selection/no-draft projection, session-only parameter value projection, mask relation preservation, neutral gray background, clean overlay state, and Canvas renderer clean-overlay suppression.

## Runtime Controls Contract

Runtime Controls are Viewer-specific and session-only. The local state shape is:

```ts
{
  parameterOverrides: Partial<Record<ParameterId, number>>,
  search: string
}
```

The state helpers clamp values to parameter min/max, remove default-equivalent values from `parameterOverrides`, exclude `computedDynamics` parameters, and derive a runtime parameter value map for rendering. Row reset, reset changed, and reset all return new Viewer-local state only.

Runtime Controls do not import or call `ParameterBar`, `useEditorSession`, keyform operations, operation-core mutation, history commit helpers, save/load helpers, or parameter definition commands. Domain B's fix loop moved static UI assertions into the discovered `.test.ts` file; the final Domain B focused run covered 1 file / 10 tests.

## Screen And Navigation Evidence

Domain C connects the existing `viewer` workspace entry to a dedicated `ViewerRuntimeScreen` branch in `AuthoringWorkspaceContent`. The right-side App Bar Viewer icon now uses the same `activateEntry("viewer")` path as the normal task/view entries.

The Viewer screen provides:

- Viewer header with Back, model identity, and Reset pose.
- Clean Stage with neutral gray background and view controls.
- Runtime Controls with search, sliders, numeric inputs, changed indication, reset actions, and non-interactive Future Playback Slot.

Back currently calls `setActiveEntry("import")`, returning to the canonical Authoring Workspace branch. `EditorSessionProvider` remains mounted above the workspace screen switch, and Viewer open/back does not call active tool, selection, active parameter, authoring parameter value, operation, history, save, or load mutation paths.

## Authoring Parameter Bar Suppression

`AuthoringWorkspaceContent` renders the dedicated Viewer branch when `activeEntry === "viewer"` and renders `ParameterBar` only when Viewer is not active. Domain C tests assert the Viewer screen does not include Authoring `ParameterBar`, keyform add/update/delete UI, authoring overlay toggles, screenshot/export, Compare, Favorite, or Group UI.

The shared global App Bar remains visible while Viewer is active. Existing global Open/Save/Undo/Redo controls therefore remain reachable from the shell; Domain C reviews treated those as pre-existing shell controls outside Viewer-owned screen semantics.

## Runtime Parity Boundary

Wave79 proves this bounded parity only:

```text
Authoring Canvas current committed/evaluated result
= Viewer v0 current committed/evaluated result, minus authoring overlays
```

The Viewer path uses the current Editor Canvas evaluation and rendering helpers with Viewer session overrides merged over authoring parameter values.

Wave79 explicitly does not implement or claim:

- runtime-core semantic evaluator full parity;
- `grid2d` / `parameter-grid-2d-v1` full parity;
- dynamics / physics playback;
- standalone runtime package rendering parity;
- export, Compare / Diff, screenshot, presentation frame, or crop guide behavior.

## Verification

Domain A verification recorded:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-renderer.test.ts apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts`
  - sandbox run hit esbuild/Vitest `spawn EPERM`; approved rerun passed, 2 files / 13 tests.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- scoped `git diff --check`: pass, with CRLF normalization warnings only.

Domain B verification recorded:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - sandbox run hit esbuild `spawn EPERM`; approved rerun passed, 1 file / 10 tests.
- `pnpm.cmd typecheck`: pass.
- scoped temporary `tsc --noEmit`: pass.
- scoped `git diff --check`: pass.
- forbidden coupling search over Runtime Controls source/tests: no production matches.

Domain C verification recorded:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - sandbox run hit esbuild `spawn EPERM`; approved rerun passed, 3 files / 18 tests.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- touched-file `git diff --check`: pass, with CRLF normalization warnings only.

Fresh final verification from Orch-Sylph recorded:

- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-renderer.test.ts apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - sandbox run was blocked by Vitest/esbuild `spawn EPERM`; approved escalated rerun passed, 4 files / 29 tests.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check`: pass, with Git CRLF normalization warnings only.

## Residual Risks

- Browser / pixel-level smoke was not run for the final integrated Viewer screen.
- Browser-level slider-to-React-state-to-canvas-repaint smoke was not run. Current proof is component/state/projection coverage plus focused renderer tests.
- Back returns to the canonical `import` workspace entry, not an arbitrary previous task/view entry.
- Shared App Bar global controls remain visible in Viewer, including Open, Save, Undo, and Redo.
- Full runtime-core parity, grid2d parity, dynamics playback, export, Compare / Diff, screenshot, crop guide, and standalone runtime package behavior remain out of scope.

## User Decision Points

None.

Future UX observations, outside the current Wave79 final gate, are whether Back should restore the previous workspace entry instead of canonical `import`, and whether Viewer should hide or disable shared global App Bar controls under a stricter non-mutating Viewer shell mode.

## Final Clean Review Fix Loop Status

- Fix loop 1 documentation finding from the independent final clean integration Review-Sylph was addressed by adding explicit child started/completed/closed traceability to the Domain B report.
- Final clean integration re-review passed with no new findings.

## Final Gate

The independent final clean integration review is recorded at `discussion/implementation/reviews/wave79/wave79-final-clean-integration-review.md` with verdict `pass`. Wave79 `viewer-runtime-view-v0` is final complete / pass.
