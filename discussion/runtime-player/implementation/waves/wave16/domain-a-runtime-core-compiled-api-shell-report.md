# Runtime Player Wave16 Domain A: Runtime-Core Compiled Evaluator API Shell

- Verdict recommendation: pass
- Domain: Runtime-Core API Shell
- Agent: Gnome
- Date: 2026-06-26

## Scope

Introduced the first-class runtime-core compiled evaluator API shell without changing runtime evaluation behavior.

This domain intentionally did not implement static-template compilation, rig/deformer topology compilation, Runtime Player integration, performance optimization, Runtime Export format changes, Editor changes, dependencies, or lockfile changes.

## Files Changed

- `packages/runtime-core/src/runtime-model.ts`
  - New compiled model / mutable runtime instance boundary.
- `packages/runtime-core/src/runtime-core.ts`
  - Public `compileRuntimeModel(graph)` wiring and `runtimeCore.compileRuntimeModel` exposure.
- `packages/runtime-core/src/runtime-core.test.ts`
  - Focused compiled API compatibility and snapshot freshness tests.
- `discussion/runtime-player/implementation/waves/wave16/domain-a-runtime-core-compiled-api-shell-report.md`
  - This report.

Pre-existing unrelated/unowned working tree changes were not reverted:

- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`

## API Shape Added

Runtime-core now exposes:

```ts
const compiled = compileRuntimeModel(graph);
const instance = compiled.createInstance();
const result = instance.evaluateFrame(input, {
  evaluationOptions,
  context,
  profilingOptions,
  controlOptions
});
```

Added public types:

- `CompiledRuntimeModel`
- `RuntimeModelInstance`
- `RuntimeModelInstanceOptions`
- `RuntimeModelInitialStateRequestInput`
- `RuntimeModelFrameEvaluationOptions`

`CompiledRuntimeModel` is an immutable/shareable API object. `RuntimeModelInstance` is mutable and owns the current runtime state. `createInstance()` can be called without arguments; it creates an initial state from `NormalizedRuntimeGraph` package identity using the existing runtime initial-state path.

## Behavior Compatibility Notes

- The v0 compiled API delegates to the existing compatible `evaluateRuntimeFrame` path.
- Existing `evaluateRuntimeFrame(...)` signature and result shape are unchanged.
- Existing snapshot validation default remains conservative: schema validation is still used unless `controlOptions.snapshotValidation` requests otherwise.
- `RuntimeModelInstance#evaluateFrame(...)` advances internal state so callers do not need to pass `previousState` every frame.
- The instance frame options preserve existing runtime evaluation options, evaluation context, profiling options, and frame control options.
- Snapshot DTO shape is unchanged.
- The compiled API does not import Runtime Export package-format DTOs.
- No intended behavior changes were made for dynamics, keyforms, deformers, clipping, variants, or snapshot validation defaults.

## Verification

- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Initial sandbox run failed with `spawn EPERM` while Vitest/Vite loaded config through esbuild.
  - Elevated rerun passed: 2 files, 10 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- packages/runtime-core/src discussion/runtime-player/implementation/waves/wave16`
  - Passed for tracked changes with LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL packages/runtime-core/src/runtime-model.ts`
  - No whitespace findings for the new untracked source file; command returned normal diff status with LF-to-CRLF warning only.
- `git diff --no-index --check -- NUL discussion/runtime-player/implementation/waves/wave16/domain-a-runtime-core-compiled-api-shell-report.md`
  - No whitespace findings for the new untracked report file; command returned normal diff status with LF-to-CRLF warning only.

Focused test evidence added:

- Compiled evaluator result deep-equals legacy `evaluateRuntimeFrame` for a deterministic drawable fixture.
- `runtimeCore.compileRuntimeModel` exposes the same function as the named export.
- Consecutive compiled instance evaluations return distinct snapshot objects and distinct drawable snapshot objects.
- A previously returned snapshot remains deep-equal after a later instance evaluation.
- Instance state advances internally across frames.
- Dependency-boundary test still passes.

## Residual Risks / Follow-Up

- This is intentionally an API shell. It does not reduce the runtime-core hot-path cost by itself because frame evaluation still delegates to the legacy path.
- The compiled model currently retains the `NormalizedRuntimeGraph` reference rather than compiling or deep-freezing topology. Later Domains B/C should decide which graph-derived structures can be safely materialized and shared.
- Runtime Player is not connected to the compiled API in Domain A. Domain D should create target-local `RuntimeModelInstance`s and must not share one mutable instance across Native Stage and Browser Source.
- Later domains should preserve the fresh snapshot / previous snapshot non-mutation guarantees while introducing reusable static templates or topology.
