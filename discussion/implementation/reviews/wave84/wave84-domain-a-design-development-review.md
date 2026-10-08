# Wave84 Domain A Design / Development Compliance Review

## Verdict

pass

## Findings

No active Design / Development compliance findings remain after fix loop 1.

### Superseded Finding: Viewer runtime simulation state can leak across project/session changes

Status: superseded by fix loop 1.

The prior review found that `runtimePlaybackState` could be reused across project/session/runtime model changes when the next model still had enabled Dynamics and reused a Dynamics Group ID. Re-review confirms the stale-state path is now closed:

- `viewer-runtime-playback.ts` adds `stateIdentityKey` to the playback model from package identity (`apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:23-28`, `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:43-59`, `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:157-158`).
- `evaluateViewerRuntimePlaybackFrame(...)` now rejects incompatible caller-provided `previousState` and creates a fresh initial runtime state instead (`apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:76-87`).
- Compatibility checks compare package id, package revision, and package hash (`apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:122-128`).
- `ViewerRuntimeScreen` filters stale playback state before render/projection (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:101-112`) and again before rAF advancement (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:161-178`).
- `ViewerRuntimeScreen` also clears mutable simulation state when the playback model identity key changes (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:190-192`).
- The new focused test builds a stale state from an old project, switches to a new project with enabled Dynamics and the same Dynamics Group ID, and verifies old `angle`, `angularVelocity`, `previousSource`, and `previousSourceVelocity` are not reused (`apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:378-432`).

## Fix Loop 1 Re-review

- Stale Viewer runtime simulation state: pass. The model-level evaluator rejects incompatible previous state, and the React screen prevents incompatible state from entering both projection and rAF evaluation.
- Runtime Controls overrides: pass. Runtime Controls state remains a separate `useState` from runtime simulation state (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:93-95`). The identity-change effect only calls `setRuntimePlaybackState(null)` and does not reset `runtimeControlsState` (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:190-192`). Runtime values still feed `baseParameterValues` through `createRuntimeParameterValueMap(...)` (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:232-251`).
- Session-local/UI boundary: pass. The fix is confined to Viewer playback/screen/test logic; no schema, persistence, operation, dependency, package-format, or unrelated runtime-core behavior change was found in the re-review scope.
- Report evidence: pass. The Domain report records the fix trigger, implementation, focused test, and verification results (`discussion/implementation/waves/wave84/wave84-domain-a-viewer-dynamics-playback-solver-consolidation-report.md:7-21`).

## Basis Documents Used

- `discussion/implementation/orchestration/wave84-plan.md`
- `discussion/design/screen-design/components/dynamics-tool.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/implementation/waves/wave84/wave84-domain-a-viewer-dynamics-playback-solver-consolidation-report.md`
- Prior review at this path.

## Source / Tests / Metadata Reviewed

- `discussion/implementation/reviews/wave84/wave84-domain-a-design-development-review.md`
- `discussion/implementation/waves/wave84/wave84-domain-a-viewer-dynamics-playback-solver-consolidation-report.md`
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`

## Dependency / Source Organization / Operation Boundary Notes

- No new dependency or package metadata change was required for fix loop 1.
- No `index.ts` implementation logic or broad catch-all helper file was added by the fix.
- The fix keeps mutable Viewer Dynamics state in React/session-local code and does not introduce operation history, save/load, dirty-state, schema, or package-format writes.
- `apps/editor` continues to call `runtime-core` for evaluation; the fix does not move solver ownership to `authoring-core` or add Editor-local physics formulas.

## Must-Not Compliance Notes

- No new schema, persistence, operation payload/schema, package-format, Cubism compatibility, mesh generation, persistent WebGL cache, external dependency, frame stepping, timeline, play/pause, diagnostics, or output-meter scope was found in the fix loop re-review.
- Runtime Controls output exclusion and override behavior remain derived from Viewer playback model output IDs and local Runtime Controls state; the fix does not mutate parameter schema or `valueSource`.

## Verification Considered

Ran during re-review:

- `pnpm.cmd typecheck`: passed.
- `git diff --check -- apps/editor/src/workspace/viewer/viewer-runtime-playback.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts discussion/implementation/waves/wave84/wave84-domain-a-viewer-dynamics-playback-solver-consolidation-report.md`: passed with CRLF normalization warnings only.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`: sandbox run failed with `esbuild spawn EPERM`; approved rerun outside sandbox passed, 1 file / 12 tests.

## Residual Risks

- No browser/manual visual QA was run for real Canvas motion smoothness or pointer/slider feel.
- The original residual maintainability concern remains: `dynamics-tool-state.ts` is still a large existing multi-concern file, though it was not part of this fix loop.
- Runtime Controls currently hides Dynamics output IDs broadly, including disabled groups; this remains an accepted current behavior with potential future UX refinement.

## User-Decision Points

None.
