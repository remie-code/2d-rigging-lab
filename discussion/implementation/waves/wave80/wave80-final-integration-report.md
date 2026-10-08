# Wave80 Final Integration Report: Viewer Interaction + Runtime Controls Density Follow-up

## Status

- Target wave: Wave80 `viewer-interaction-controls-density-followup`
- Report status: final complete / pass
- Domain B: `wave80-final-integration-clean-review-map-closeout`
- Final clean review: `discussion/implementation/reviews/wave80/wave80-final-clean-integration-review.md`
- Final gate status: pass
- Date: 2026-06-17

Wave80 is a local Viewer follow-up on top of the Wave79 dedicated Viewer / Runtime View v0 baseline. The wave fixes Viewer Parts Container visibility parity, adds Viewer-local Clean Stage wheel zoom and left-drag pan, and compacts Runtime Controls without expanding runtime-core parity or authoring scope.

## Domain A Status And Artifacts

| Artifact | Status | Notes |
|---|---|---|
| [wave80-domain-a-viewer-interaction-controls-density-followup-report.md](wave80-domain-a-viewer-interaction-controls-density-followup-report.md) | pass | Source implementation completed in Viewer scope with final focused verification. |
| [../../reviews/wave80/wave80-domain-a-spec-compliance-review.md](../../reviews/wave80/wave80-domain-a-spec-compliance-review.md) | pass | Confirms Wave80 accepted requirements and non-goals. |
| [../../reviews/wave80/wave80-domain-a-design-development-review.md](../../reviews/wave80/wave80-domain-a-design-development-review.md) | pass | Confirms Viewer-local state, source boundaries, accessibility semantics, and no authoring mutation. |
| [../../reviews/wave80/wave80-domain-a-test-adequacy-review.md](../../reviews/wave80/wave80-domain-a-test-adequacy-review.md) | pass | Confirms focused Viewer coverage is adequate, with non-blocking browser-event and pixel-smoke residuals. |

## Implemented Behavior Summary

- Parts Container visibility parity in Viewer: `ViewerRuntimeScreen` reads `editorHiddenPartIds`, forwards them through `createViewerRuntimeCleanStageProjection`, and `createViewerCleanStageProjection` passes them to the existing Canvas projection/evaluation path, where direct and ancestor hidden Parts Containers gate descendant Drawables.
- Drawable visibility regression preserved: existing Drawable `runtimeVisibility` remains combined with Parts Container gating, and focused tests keep a visible sibling/mask Drawable visible while hiding a target Drawable.
- Clean Stage wheel zoom: the Viewer Clean Stage canvas handles `onWheel`, calls `preventDefault()`, and updates Viewer-local view state with pointer-position anchoring through `zoomViewerStageViewAtPoint`.
- Clean Stage left-drag pan: left pointer down/move/up/cancel handlers pan Viewer-local view state, use pointer capture/release, and expose `grab` / `grabbing` cursor affordance.
- Dense Runtime Controls rows: Runtime Controls rows are compact horizontal grids with parameter name, slider, numeric input, and row reset icon button.
- Min/max text and visible `Changed` removed: min/max remain input attributes only, and changed state is represented through `data-changed` plus row styling rather than visible text.
- `Reset changed` removed: no global reset-changed control remains in the visible Runtime Controls UI.
- Icon-only `Reset all` with tooltip and aria label: the remaining global reset button is icon-only, has `title="Reset all"`, and has `aria-label="Reset all parameter overrides"`.

## Verification Commands And Results

Domain A reported verification:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Sandbox run failed with known Vitest/esbuild `spawn EPERM`.
  - Approved escalated rerun passed: 3 files / 21 tests.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check -- apps/editor/src/workspace/viewer discussion/implementation/waves/wave80 discussion/implementation/reviews/wave80`: pass.

Fresh Domain B final verification:

- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check`: pass; Git emitted CRLF normalization warnings only.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Sandbox run failed with known Vitest/esbuild `spawn EPERM`.
  - Escalated rerun passed: 3 files / 21 tests.

## Must-Not Compliance

- No runtime-core parity expansion was implemented.
- No dynamics / physics playback was implemented.
- No save/load schema or portable project format changes were made.
- No mesh, deformer, or keyform authoring changes were made.
- No dependency, package manifest, lockfile, or `packages/**` changes were made for Wave80.
- No `CanvasPreviewPanel` wholesale reuse or full `ParameterBar` reuse was introduced.
- Viewer pan/zoom and Runtime Controls parameter overrides remain Viewer-local/session-only.

## Orchestration Notes

- Domain A is pass-classified with all three required review lanes recorded.
- An optional independent final Review-Sylph child was started for Domain B, but it returned an unrelated process-cleanup note rather than a review verdict. That child was closed and is not counted as pass evidence.
- Domain B final clean review is therefore based on direct Orch-Sylph clean review of the plan, reports, source/tests, maps, and fresh final verification.

## Residual Risks

- Browser-level wheel/pan event smoke was not run; current evidence is source review plus helper/component tests.
- Pixel or human visual density review was not run; Runtime Controls density evidence is static markup/source/test based.
- `git diff --check` does not inspect untracked file content, and this workspace has intentionally untracked Wave79/Wave80 files. Functional risk is covered by focused tests, typecheck, source review, and repository guards.
- The workspace remains dirty with Wave79 baseline source/docs and Wave80 artifacts; no unrelated changes were reverted.
- Full runtime-core parity, grid2d parity, dynamics playback, export/screenshot, compare/diff, crop guide, favorite parameters, parameter grouping, mesh/deformer/keyform authoring, and save/load schema work remain out of scope.

## User Decision Points

None.

## Final Gate

Wave80 `viewer-interaction-controls-density-followup` is final complete / pass. The final clean integration review records `pass`, and maps are updated accordingly.
