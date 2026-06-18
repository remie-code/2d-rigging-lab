# Wave84 Domain A Spec Compliance Review

## Verdict

pass

## Findings

None.

## Basis Documents Used

- `discussion/implementation/orchestration/wave84-plan.md`
- `discussion/design/screen-design/components/dynamics-tool.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/implementation/waves/wave83/wave83-final-integration-report.md`
- `discussion/implementation/reviews/wave83/wave83-final-clean-integration-review.md`
- `discussion/implementation/waves/wave84/wave84-domain-a-viewer-dynamics-playback-solver-consolidation-report.md`

## Source/Tests Reviewed

Required direct-review set:

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
- `packages/runtime-core/src/dynamics-evaluation.ts`
- `packages/runtime-core/src/dynamics-evaluation.test.ts`
- `packages/runtime-core/src/parameter-resolution.ts`
- `packages/runtime-core/src/runtime-core.ts`

Additional read-only cross-checks:

- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
- `apps/editor/package.json`
- `pnpm-lock.yaml`

## AC Coverage Notes

- Viewer advances Dynamics while open: pass. `ViewerRuntimeScreen` starts an rAF loop only when enabled Dynamics groups exist, advances session-local runtime state through `evaluateViewerRuntimePlaybackFrame`, and cancels the frame on cleanup (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:138`, `:161`, `:169`, `:173`).
- Runtime Controls driver changes feed Dynamics inputs: pass. Viewer builds `baseParameterValues` from authored values plus normalized Runtime Controls overrides, then passes that map into runtime playback evaluation (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:219`, `:226`, `:230`). Runtime controls keep driver parameters editable while excluding output parameters (`apps/editor/src/workspace/viewer/runtime-controls-state.ts:62`, `:108`).
- Dynamics output offsets are injected before keyform/deformer evaluation: pass. Viewer resolves runtime effective parameter values before calling the existing Clean Stage projection (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:230`, `:243`), and Clean Stage forwards those parameter values to existing Canvas projection (`apps/editor/src/workspace/viewer/viewer-clean-stage.ts:40`). A focused test proves an authored output override is dropped, Dynamics output becomes the effective value, and keyform evaluation moves artwork (`apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:308`, `:340`).
- Model artwork responds through existing parameter/keyform/deformer evaluation: pass. The Dynamics fixture binds the output parameter to a rig-control keyform set (`apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:582`) and verifies resulting drawable bounds (`apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:343`).
- Driver stops still allow pendulum motion to continue and converge: pass. Runtime-core stepping maintains state and velocity across held input frames (`packages/runtime-core/src/runtime-core.ts:120`, `packages/runtime-core/src/dynamics-evaluation.ts:75`), with focused Viewer and runtime-core tests for continued motion/convergence (`apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:266`, `packages/runtime-core/src/dynamics-evaluation.test.ts:58`).
- Viewer reset clears mutable simulation state without changing authored data or Runtime Controls overrides: pass. Reset creates a fresh runtime state from current base input values and does not touch Runtime Controls state or authoring session (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:123`, `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:60`); test coverage preserves overrides and `session.dirty === false` (`apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:346`, `:374`).
- Dynamics output parameters are excluded from Viewer Runtime Controls editing/display; no output meters/sliders: pass. `excludedParameterIds` is applied to editability, projection rows, override normalization, and runtime value-map creation (`apps/editor/src/workspace/viewer/runtime-controls-state.ts:62`, `:82`, `:108`, `:222`). Tests cover authored output exclusion and direct override attempts (`apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:53`, `:221`). `RuntimeControls` renders only editable rows plus `Reset simulation`, not output meters (`apps/editor/src/workspace/viewer/runtime-controls.tsx:121`, `:145`).
- Driver/input parameters remain editable: pass. The authored output exclusion test keeps `FACE_ANGLE_X` as the only visible/editable row while dropping `HAIR_SWAY` (`apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:53`, `:74`).
- Editor Dynamics Tool preview still advances and Quick Tune remains intact: pass. Preview advancement remains session-local (`apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:577`) and Quick Tune still applies live preview overrides and commits pendulum/output payloads on finalize (`apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:458`, `:477`, `:489`, `:543`, `:666`).
- Editor preview and runtime-core solver semantics are shared or parity-proven: pass. Editor preview imports `stepDynamics` and `computeDynamicsOutputOffsets` from runtime-core (`apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:8`) and its local helper only clamps/splits UI elapsed time around runtime-core calls (`apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:808`). A representative parity test compares preview advancement directly with runtime-core `stepDynamics` (`apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts:191`).
- Runtime effective values use additive base + offset: pass. Runtime-core computes `rawEffectiveValue = baseValue + offset` and clamps after addition (`packages/runtime-core/src/parameter-resolution.ts:44`, `:55`). Tests assert base `0.4`, offset `0.25`, effective `0.65` (`packages/runtime-core/src/parameter-resolution.test.ts:16`, `:49`).
- Playback ticks/reset do not create operation history entries or dirty project state: pass by source review. Viewer playback/reset update React state only (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:129`, `:155`), and targeted searches found no `runCommandWithHistory`, save, or operation call in the Viewer playback path. The reset test keeps `session.dirty` false (`apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:375`).

## Forbidden-Scope Review

- No schema, save/load, operation payload/schema, authoring-core, package-format, mesh/deformer/keyform authoring behavior, or Cubism compatibility changes were found in the reviewed Domain A diff.
- No multi-pendulum authoring/runtime, multiple-output implementation, same-output mixer, timeline, camera input, external transport, frame stepping, output meter, or raw Viewer solver diagnostics were found in the reviewed source.
- `RuntimeControls` adds only a minimal `Reset simulation` affordance under `Motion / Physics`; render tests assert no Play/Pause transport controls (`apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:381`).
- Dependency change is limited to a local workspace dependency on `@private-2d-rigging-lab/runtime-core` (`apps/editor/package.json:13`, `:19`; `pnpm-lock.yaml` importer link reviewed). No new external dependency was added.
- Worktree has unrelated `tmp/` image churn and map updates outside this review artifact; these were not edited for this review and are not needed for the spec verdict.

## Verification Considered

Domain A report records these passing checks:

- `pnpm.cmd typecheck`
- Focused Vitest: `viewer-runtime-screen.test.ts`, `runtime-controls-state.test.ts`, `dynamics-tool-state.test.ts`, `dynamics-tool-inspector.test.ts`, `dynamics-evaluation.test.ts`, `parameter-resolution.test.ts`, `viewer-evaluation.test.ts`, `runtime-core.test.ts` (8 files / 54 tests)
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check` with CRLF normalization warnings only

Reviewer-local checks were read-only: direct source/test inspection with line references, `git status --short -uall`, scoped `git diff --stat`, dependency diff review, and targeted `rg`/`Select-String` searches for operation/history calls and forbidden UI/scope terms. I did not rerun Vitest or typecheck in this review lane.

## Residual Risks

- No browser/manual visual QA was rerun by this reviewer; real Canvas motion smoothness and slider feel remain covered only by source review and the Domain A reported verification.
- Viewer still renders through the existing Editor Canvas projection rather than runtime-core drawable snapshots. This matches Wave84 scope but remains a future convergence risk.
- Output exclusion includes disabled Dynamics groups because the policy is based on parameters used as Dynamics outputs. This matches the Wave84 report and accepted output policy, but future UX could decide disabled groups should release controls.

## User-Decision Points

None.
