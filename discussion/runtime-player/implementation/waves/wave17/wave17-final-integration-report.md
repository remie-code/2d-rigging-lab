# Runtime Player Wave17 Final Integration Report: Compiled Render Frame Fast Path

- Verdict recommendation: pass
- Domain: Domain E / Final Integration / Docs Alignment
- Agent: Gnome
- Date: 2026-06-26

## Scope

Domain E integrated the Wave17 source/test facts from Domains A-D, updated Runtime Player documentation/maps to match those facts, and recorded the remaining real OBS Browser Source performance check.

実装事実に合わせて関連ドキュメントを更新する。

Domain E did not perform source implementation, source tests edits, Runtime Export format work, Editor work, package-format schema work, dependency work, package manifest edits, lockfile edits, or `pnpm install`.

Basis:

- [../../orchestration/player-wave17-plan.md](../../orchestration/player-wave17-plan.md)
- [domain-a-runtime-core-render-frame-api-report.md](domain-a-runtime-core-render-frame-api-report.md)
- [domain-b-runtime-core-fast-output-internals-report.md](domain-b-runtime-core-fast-output-internals-report.md)
- [domain-c-runtime-player-fast-render-path-report.md](domain-c-runtime-player-fast-render-path-report.md)
- [domain-d-fast-path-diagnostics-report.md](domain-d-fast-path-diagnostics-report.md)
- [../../reviews/wave17/_map.md](../../reviews/wave17/_map.md)
- [../../reviews/wave17/wave17-final-spec-completion-review.md](../../reviews/wave17/wave17-final-spec-completion-review.md)
- [../../reviews/wave17/wave17-final-design-development-review.md](../../reviews/wave17/wave17-final-design-development-review.md)
- [../../reviews/wave17/wave17-final-test-docs-review.md](../../reviews/wave17/wave17-final-test-docs-review.md)
- [../../orchestration/player-wave16-plan.md](../../orchestration/player-wave16-plan.md)
- [../wave16/wave16-final-integration-report.md](../wave16/wave16-final-integration-report.md)
- [../wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md](../wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md)
- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)
- [../../orchestration/runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)

## Domains A-D Pass Confirmation

| Domain | Report | Spec compliance | Design / development compliance | Test adequacy |
|---|---|---|---|---|
| A: Runtime-core render frame API | [domain-a-runtime-core-render-frame-api-report.md](domain-a-runtime-core-render-frame-api-report.md) | [pass](../../reviews/wave17/domain-a-spec-compliance-review.md) | [pass](../../reviews/wave17/domain-a-design-development-compliance-review.md) | [pass](../../reviews/wave17/domain-a-test-adequacy-review.md) |
| B: Runtime-core fast output internals | [domain-b-runtime-core-fast-output-internals-report.md](domain-b-runtime-core-fast-output-internals-report.md) | [pass](../../reviews/wave17/domain-b-spec-compliance-review.md) | [pass after loop-2 fix](../../reviews/wave17/domain-b-design-development-compliance-review.md) | [pass](../../reviews/wave17/domain-b-test-adequacy-review.md) |
| C: Runtime Player fast render path | [domain-c-runtime-player-fast-render-path-report.md](domain-c-runtime-player-fast-render-path-report.md) | [pass](../../reviews/wave17/domain-c-spec-compliance-review.md) | [pass](../../reviews/wave17/domain-c-design-development-compliance-review.md) | [pass](../../reviews/wave17/domain-c-test-adequacy-review.md) |
| D: Fast-path diagnostics | [domain-d-fast-path-diagnostics-report.md](domain-d-fast-path-diagnostics-report.md) | [pass](../../reviews/wave17/domain-d-spec-compliance-review.md) | [pass](../../reviews/wave17/domain-d-design-development-compliance-review.md) | [pass](../../reviews/wave17/domain-d-test-adequacy-review.md) |

All four implementation domains report `pass`, and each has the required three-lane Review-Sylph evidence. Domain B required one design/development fix loop to remove public drawable DTO-shaped fast-path intermediates; the final loop passed all review lanes.

## Final Review Results

| Lane | Report | Verdict |
|---|---|---|
| Final spec completion | [wave17-final-spec-completion-review.md](../../reviews/wave17/wave17-final-spec-completion-review.md) | pass |
| Final design / development | [wave17-final-design-development-review.md](../../reviews/wave17/wave17-final-design-development-review.md) | pass |
| Final test / docs | [wave17-final-test-docs-review.md](../../reviews/wave17/wave17-final-test-docs-review.md) | pass |

All three final Review-Sylph lanes passed.

## Final Integration Checks

| Check | Result | Evidence |
|---|---|---|
| Live rendering uses fast render frame path | Pass | Domain C makes evaluated Stage render input default to render-frame mode and builds render scenes from dynamic render-frame output plus cached scaffold/static templates. |
| Public snapshot API compatibility | Pass | Domains A/B preserve `RuntimeModelInstance#evaluateFrame(...)`, `evaluateRuntimeFrame(...)`, public snapshot DTO shape, and public snapshot freshness behavior. |
| Runtime Export format unchanged | Pass | Domains C/D confirm no Runtime Export format edits; Runtime Player still adapts Runtime Export to runtime-core graph/scaffold data outside runtime-core. |
| Editor export regeneration not required by implementation itself | Pass | Wave17 does not require Editor export regeneration; existing Runtime Export payload shape remains valid for the new Player/runtime-core path. |
| Browser Source / Native Stage semantic consistency and target-local ownership | Pass | Domain C preserves renderer-owned `RuntimeExportRuntimeModelInstanceCache`; Native Stage and Browser Source do not share mutable runtime instances or mutable render-frame outputs. |
| No new dependencies / lockfile changes / `pnpm install` | Pass | Domain reports confirm no dependencies, no lockfile edits, and no `pnpm install`; Domain E scope check found no package manifest or lockfile diff. |
| No Editor changes | Pass | Domain reports confirm no Editor edits; Domain E scope check found no `apps/editor` diff. |
| No package-format runtime schema changes | Pass | Domain reports confirm no package-format/Runtime Export schema edits; runtime-core remains package-format independent. |
| Performance Diagnostics works and explains new metrics | Pass | Domain D adds `compiledRenderFrameCount`, `publicSnapshotMaterializationCount`, and `runtimeCoreRenderFrameOutputDurationMs`, keeps deep profiling gated, and scopes render-frame/public-snapshot metrics separately in copied reports. |

## Implementation Facts Reflected

- Runtime-core exposes additive `RuntimeModelInstance#evaluateRenderFrame(...)` and renderer-facing render-frame result types.
- Runtime-core render-frame evaluation avoids public snapshot/public drawable DTO materialization and records `publicSnapshotMaterializationCount` plus `runtimeCoreRenderFrameOutputDurationMs` for proof.
- Runtime Player live evaluated Stage render input defaults to render-frame mode and combines dynamic render-frame output with cached scaffold/static templates.
- Snapshot mode remains explicit for initial/static diagnostic/default-pose paths that need public snapshot diagnostics.
- Browser Source and Native Stage continue target-local runtime instance ownership and should not share mutable instances/output.
- Runtime Export format is unchanged; Editor export regeneration is not required by Wave17 itself.
- No Editor, package-format schema, dependency, lockfile, or `pnpm install` changes are part of this wave.
- Performance Diagnostics copied reports print `renderInputDrawableMappingDurationMs` for the compatibility source field `snapshotToRenderDrawableDurationMs`.

## Performance Diagnostics Interpretation

Healthy stable Browser Source render-frame fast-path evidence should show:

- `compiledRenderFrameCount > 0`
- `publicSnapshotMaterializationCount: 0`
- `transientCompileCount: 0`
- `transientInstanceCount: 0`
- `runtimeModelInstanceCacheHitCount` increasing after warm-up
- `runtimeModelInstanceCacheMissCount: 0` during a stable capture unless the capture includes payload/Variant/reset lifecycle events

`runtimeCoreRenderFrameOutputDurationMs` is the render-frame output construction phase. `runtimeCoreSnapshotCreationDurationMs` and `runtimeCoreDrawableSnapshotCreationDurationMs` are public snapshot path/deep-profile metrics; for live render-frame frames they should be absent, zero, unknown, not sampled, or clearly scoped away from the render-frame path.

`renderDurationMs` remains renderer/WebGL draw cost and should be interpreted separately from runtime-core evaluation/output phases.

## Docs / Maps Updated

- [wave17-final-integration-report.md](wave17-final-integration-report.md)
- [_map.md](_map.md)
- [../../reviews/wave17/_map.md](../../reviews/wave17/_map.md)
- [../../_map.md](../../_map.md)
- [../../../_map.md](../../../_map.md)
- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)
- [../../../backlog/runtime-player-backlog.md](../../../backlog/runtime-player-backlog.md)

The maps now show Wave17 as completed at final integration review stage, while real OBS Browser Source performance verification remains pending.

## Verification

Inherited source verification from Domains A-D:

- Domain A focused runtime-core/dependency-boundary Vitest and `pnpm.cmd typecheck` passed.
- Domain B focused runtime-core parity/materialization/dependency tests and `pnpm.cmd typecheck` passed after the loop-2 fix.
- Domain C focused Runtime Player render-frame/cache/stage scene/Browser Source/Stage Motion/Variant tests and `pnpm.cmd typecheck` passed.
- Domain D focused diagnostics/report/renderer metric tests, render-frame evaluation/cache tests, `pnpm.cmd typecheck`, and `node scripts/check-source-organization.mjs` passed.
- All A-D review lanes passed with independent Review-Sylph verification.

Domain E verification:

- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format`
  - No output.
- `git diff --check -- discussion/runtime-player/implementation/_map.md discussion/runtime-player/_map.md discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/backlog/runtime-player-backlog.md`
  - No whitespace findings; CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md`
  - No whitespace findings; normal no-index diff status with CRLF working-copy warning only.
- `git diff --no-index --check -- NUL discussion/runtime-player/implementation/waves/wave17/_map.md`
  - No whitespace findings; normal no-index diff status with CRLF working-copy warning only.
- `git diff --no-index --check -- NUL discussion/runtime-player/implementation/reviews/wave17/_map.md`
  - No whitespace findings; normal no-index diff status with CRLF working-copy warning only.

`pnpm install` was not run by Domain E.

## Manual User Check Still Required

Real OBS Browser Source performance improvement remains manually unverified until the user captures a real-model Browser Source deep Performance Diagnostics report and saves it as `tmp/report.log`.

Ask the user to:

- Open Runtime Player with the real Runtime Export.
- Connect iFacialMocap.
- Connect OBS Browser Source using the Runtime Player Browser Source URL.
- Run Performance Diagnostics for Browser Source with deep capture.
- Copy the report and save it to `tmp/report.log`.
- Compare before/after `renderFps`.
- Compare before/after `appliedLiveFrameFps`.
- Compare before/after `compiledRenderFrameCount`.
- Compare before/after `publicSnapshotMaterializationCount`.
- Compare before/after `runtimeCoreRenderFrameOutputDurationMs`.
- Compare before/after `runtimeCoreEvaluationDurationMs`.
- Compare before/after `runtimeCoreSnapshotCreationDurationMs`.
- Compare before/after `runtimeCoreDrawableSnapshotCreationDurationMs`.
- Compare before/after `runtimeCoreDeformerHierarchyEvaluationDurationMs`.
- Compare before/after `runtimeCoreWarpDeformerVertexTransformDurationMs`.
- Compare before/after `renderDurationMs`.
- Confirm copied reports exclude raw tracking frames, calibration internals, Browser Source token, private file paths, full Runtime Export payload, Runtime Export textures, and Runtime Export mesh data.

## Residual Risks / Next-Wave Recommendations

- Real OBS Browser Source smoothness is not proven until the user supplies `tmp/report.log`.
- Deep Performance Diagnostics capture can add measurement overhead and can legitimately report `unknown` / `sampleCount=0` when no deep-profiled live render-frame sample is observed.
- Render-frame output still uses frame-owned/copy-safe vertex data. If Wave17 removes public snapshot cost but FPS remains low, profile vertex copy cost and renderer upload cost before broadening the design.
- If `runtimeCoreWarpDeformerVertexTransformDurationMs` remains dominant after snapshot bypass, the next performance wave should target deformer vertex transform cost rather than diagnostics/report formatting.
- The internal compatibility source field `snapshotToRenderDrawableDurationMs` remains; copied reports already expose it as `renderInputDrawableMappingDurationMs`, so a source-level rename can remain a later cleanup.
