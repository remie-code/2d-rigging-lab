# Wave84 Domain A: Viewer Dynamics Playback + Solver Consolidation Report

## Verdict

done / implementation complete.

## Fix Loop 1 Evidence

- Trigger: `discussion/implementation/reviews/wave84/wave84-domain-a-design-development-review.md` finding "Viewer runtime simulation state can leak across project/session changes".
- Fix date: 2026-06-19.
- Implementation:
  - `viewer-runtime-playback.ts` now gives each playback model a `stateIdentityKey` derived from runtime package identity.
  - `evaluateViewerRuntimePlaybackFrame(...)` ignores a caller-provided previous `RuntimeStateDto` when package id, package revision, or package hash do not match the current playback model.
  - `ViewerRuntimeScreen` filters `runtimePlaybackState` before render/projection and before rAF advancement, and clears simulation state when the playback model identity changes.
  - Runtime Controls overrides remain unchanged; only mutable simulation state is discarded.
- Focused test:
  - `viewer-runtime-screen.test.ts` now covers switching to a new project with enabled Dynamics and the same Dynamics Group id, proving old `angle`, `angularVelocity`, `previousSource`, and `previousSourceVelocity` are not reused.
- Verification after fix:
  - `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`: passed, 1 file / 12 tests.
  - `pnpm.cmd typecheck`: passed.
  - `git diff --check`: passed with CRLF normalization warnings only.

## Basis Coverage Self-Report

- Read and applied `discussion/implementation/orchestration/wave84-plan.md`.
- Read and applied `discussion/design/screen-design/components/dynamics-tool.md`.
- Read and applied `discussion/design/screen-design/screens/viewer-runtime-view.md`.
- Read and applied `discussion/development_convention/source-file-organization-policy.md`.
- Read and applied `discussion/development_convention/dependency-policy.md`.
- Read and applied `discussion/development_convention/operation-policy.md`.
- Read and applied `discussion/development_convention/ux-backed-package-logic-authority.md`.
- Read Wave83 final report and final clean review as the accepted baseline.
- Deferred basis items: no authoring-core/package-format persistence tests were run because no save/load schema, operation payload, package-format, or authoring-to-runtime adapter source was changed.

## Current-State Confirmation

- `packages/runtime-core/src/dynamics-evaluation.ts` already owned `stepDynamics`, output offset computation, reset state semantics, and fixed substep advancement.
- `packages/runtime-core/src/parameter-resolution.ts` already resolved effective parameter values as additive `baseValue + dynamicsOffset` and ignored duplicate same-output ownership.
- `packages/runtime-core/src/runtime-core.ts` already exposed runtime state creation and frame/sequence evaluation with caller-owned previous state.
- `packages/authoring-core/src/to-runtime-graph.ts` and `runtime-graph-dynamics.ts` remained adapter-only; no solver logic was moved there.
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx` previously sent authored/runtime-control parameter maps directly to Canvas without runtime Dynamics state.
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts` previously excluded only `computedDynamics`; authored output parameters remained editable.
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts` previously contained an editor-local copy of the pendulum stepping formula.

## Solver Ownership / Dependency Decision Trace

- Added direct `apps/editor` dependency on existing workspace package `@private-2d-rigging-lab/runtime-core`.
- Updated `pnpm-lock.yaml` importer metadata for the local workspace link.
- No external dependency was added.
- `runtime-core` remains the owner of Dynamics stepping and output offset semantics.
- `apps/editor` now owns only Viewer rAF/session state, Runtime Controls state, reset affordance, and Dynamics Tool UI/session adapters.
- `authoring-core` was not changed and did not gain physics solver ownership.

Changed files for this decision:

- `apps/editor/package.json`
- `pnpm-lock.yaml`
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`

## Runtime Playback Integration Trace

- Added `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`.
- Viewer builds a runtime playback model through existing `toRuntimeGraph(...)`.
- Viewer keeps `RuntimeStateDto` in React state only.
- Viewer rAF advances runtime state with `evaluateRuntimeFrame(...)`, clamps frame elapsed time to 100ms, and uses nominal `16.6666667ms` fixed stepping with `maxSubSteps: 6`.
- Viewer computes effective runtime parameter values from runtime-core snapshot parameters, then passes that parameter map to existing `createViewerCleanStageProjection(...)`.
- Dynamics output offsets are therefore injected before existing Canvas keyform/deformer evaluation.
- `Reset simulation` calls `createInitialRuntimeState(...)` for runtime session state only and keeps Runtime Controls overrides unchanged.

Focused evidence:

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts` covers time-progressing Viewer Dynamics frames, continued motion/convergence after driver stop, output injection into Clean Stage keyform evaluation, and reset state without override mutation.
- `packages/runtime-core/src/dynamics-evaluation.test.ts` now covers continued motion and convergence in runtime-core itself.

## Runtime Controls Output Exclusion Trace

- `runtime-controls-state.ts` now accepts `excludedParameterIds`.
- Viewer derives excluded ids from authored/runtime graph Dynamics outputs.
- Output parameters are excluded even when their `valueSource` is still `authoredInput`.
- Driver/input parameters remain editable.
- Runtime override normalization and runtime parameter value map creation drop excluded output overrides.
- Runtime Controls footer exposes only `Reset simulation` when Dynamics is configured; no output sliders/meters, play/pause, or frame stepping were added.

Focused evidence:

- `runtime-controls-state.test.ts` covers authored Dynamics output exclusion, driver retention, override-count normalization, ignored direct output override attempts, and `Reset simulation` UI without transport controls.

## Editor Preview Parity Trace

- `dynamics-tool-state.ts` no longer owns the independent pendulum stepping formula.
- The remaining `stepDynamicsToolPreview(...)` helper is a UI/session adapter that clamps/splits Editor preview elapsed time and calls runtime-core `stepDynamics(...)` for each step.
- Preview output summary uses runtime-core `computeDynamicsOutputOffsets(...)`; local code only adds UI base/effective value and parameter clamp summary.
- Quick Tune and preview rAF behavior remain in Editor UI/session state.

Focused evidence:

- `dynamics-tool-state.test.ts` adds a representative parity test comparing Preview advancement with runtime-core `stepDynamics(...)`.
- Existing Dynamics Tool Inspector tests still cover preview rAF, Quick Tune live preview, commit behavior, and hidden raw solver summary.

## History / Persistence Boundary Trace

- Viewer playback ticks update React `RuntimeStateDto` only.
- Viewer reset updates React runtime simulation state only.
- Runtime Controls overrides remain session-local as before.
- No operation-core API, history command, package document, package-format schema, or save/load path was changed.
- Dynamics Tool Quick Tune committed edits still use the existing operation-backed path; preview ticks remain session-local.

## Must-not Compliance Evidence

- No `dynamics-file-v2` schema changes.
- No save/load format changes.
- No operation payload/schema changes.
- No multi-pendulum, multiple-output, same-output mixer, or additive blending across groups.
- No frame stepping, timeline, camera input, external transport, play/pause, raw solver diagnostics, output meters, or output sliders.
- No mesh/deformer/keyform authoring behavior changes unrelated to runtime parameter evaluation.
- No mesh generation changes.
- No persistent WebGL buffer/cache architecture.
- No new external dependency.
- No Cubism SDK/runtime/export compatibility work.
- `authoring-core` and `package-format` were not edited.

## Verification

Passed:

- `pnpm.cmd typecheck`
- Focused Vitest after sandbox `esbuild spawn EPERM` and approved rerun:
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
  - `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
  - `packages/runtime-core/src/dynamics-evaluation.test.ts`
  - `packages/runtime-core/src/parameter-resolution.test.ts`
  - `packages/runtime-core/src/viewer-evaluation.test.ts`
  - `packages/runtime-core/src/runtime-core.test.ts`
  - Result: 8 files / 54 tests passed.
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`
  - Result: passed with CRLF normalization warnings only.

Not run:

- Persistence tests: not run because persistence, package-format, authoring package conversion, and operation payload/schema files were not changed.
- Browser/manual visual QA: not run in this Domain A implementation pass.

## Residual Risks

- No browser visual QA was run for actual Canvas motion smoothness, real rAF cadence, or real pointer/slider feel.
- Viewer uses runtime-core effective parameter values but still renders through existing Editor Canvas projection rather than runtime-core drawable snapshots; this is intentional for Wave84 but remains a future unification risk.
- Runtime Controls output exclusion derives from Dynamics outputs broadly, including disabled groups; this follows the accepted "used as output" rule but may be revisited if future UX wants disabled groups to release controls.
- The Viewer rAF loop rebuilds/evaluates runtime parameter snapshots each frame. Focused tests and typecheck pass, but larger real projects may need performance profiling later.

## User-decision points

None for Domain A.
