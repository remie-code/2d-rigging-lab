# Runtime Player Wave17 Domain D Report: Fast Path Diagnostics / Report Semantics

- Verdict recommendation: pass
- Domain: Diagnostics / performance report semantics
- Orchestrator: Orch-Sylph
- Implementation agent: Gnome
- Date: 2026-06-26
- Loop count: 1

## Scope

Domain D updated Runtime Player Performance Diagnostics so copied reports can prove render-frame fast path usage and do not imply that live render-frame frames are still materializing public snapshots.

This domain did not change runtime-core fast output internals, Runtime Export format, Editor source, package-format schema, dependencies, lockfile, or run `pnpm install`.

Basis:

- [../../orchestration/player-wave17-plan.md](../../orchestration/player-wave17-plan.md)
- [domain-a-runtime-core-render-frame-api-report.md](domain-a-runtime-core-render-frame-api-report.md)
- [domain-b-runtime-core-fast-output-internals-report.md](domain-b-runtime-core-fast-output-internals-report.md)
- [domain-c-runtime-player-fast-render-path-report.md](domain-c-runtime-player-fast-render-path-report.md)
- [../../reviews/wave17/domain-a-spec-compliance-review.md](../../reviews/wave17/domain-a-spec-compliance-review.md)
- [../../reviews/wave17/domain-b-spec-compliance-review.md](../../reviews/wave17/domain-b-spec-compliance-review.md)
- [../../reviews/wave17/domain-c-spec-compliance-review.md](../../reviews/wave17/domain-c-spec-compliance-review.md)
- [../../orchestration/player-wave16-plan.md](../../orchestration/player-wave16-plan.md)
- [../wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md](../wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md)
- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)
- [../../orchestration/runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)

## Files Changed

Source and tests:

- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`

Review artifacts:

- [../../reviews/wave17/domain-d-spec-compliance-review.md](../../reviews/wave17/domain-d-spec-compliance-review.md)
- [../../reviews/wave17/domain-d-design-development-compliance-review.md](../../reviews/wave17/domain-d-design-development-compliance-review.md)
- [../../reviews/wave17/domain-d-test-adequacy-review.md](../../reviews/wave17/domain-d-test-adequacy-review.md)

Domain docs/maps:

- [domain-d-fast-path-diagnostics-report.md](domain-d-fast-path-diagnostics-report.md)
- [_map.md](_map.md)
- [../../reviews/wave17/_map.md](../../reviews/wave17/_map.md)

## Implementation Summary

- Added Runtime Player diagnostics contract, validation, renderer metric, and report surfacing for:
  - `compiledRenderFrameCount`
  - `publicSnapshotMaterializationCount`
  - `runtimeCoreRenderFrameOutputDurationMs`
- Kept existing compiled evaluator proof counters visible:
  - `compiledEvaluatorFrameCount`
  - `transientCompileCount`
  - `transientInstanceCount`
  - `runtimeModelInstanceCache*`
- Snapshot evaluation reports `compiledRenderFrameCount: 0`; render-frame evaluation reports `compiledRenderFrameCount: 1` for each render-frame evaluation.
- `runtimeCoreRenderFrameOutputDurationMs` is exposed through the diagnostics path when deep runtime-core profiling is active.
- Copied report output now labels fast render-frame fields with render-frame scope and public snapshot fields with public-snapshot/deep-profile scope.
- The internal compatibility field `snapshotToRenderDrawableDurationMs` remains in source/DTO surfaces, but copied reports print it as `renderInputDrawableMappingDurationMs` with `sourceField=snapshotToRenderDrawableDurationMs` and an explicit non-public-snapshot-materialization scope.
- Normal live diagnostics remain light: deep runtime-core phase details are still populated only from intentional deep profiling.
- Existing report privacy exclusions remain in place for raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, textures, and mesh data.

## Verification

Gnome verification:

- `pnpm.cmd exec vitest run apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts`
  - Passed: 5 files / 92 tests.
- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
  - Passed: 3 files / 15 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- <Domain D touched files>`
  - No whitespace findings; CRLF working-copy warnings only.

Independent review verification:

- Spec compliance reviewer reran:
  - focused Runtime Player Vitest command - passed: 6 files / 90 tests.
  - `pnpm.cmd typecheck` - passed.
  - whitespace and scope checks - no blocking findings.
- Design / development compliance reviewer reran:
  - `node scripts/check-source-organization.mjs` - passed.
  - focused Runtime Player Vitest command - passed: 7 files / 96 tests.
  - `pnpm.cmd typecheck` - passed.
  - `git diff --check -- <Domain D reviewed files>` - no whitespace findings; CRLF warnings only.
- Test adequacy reviewer reran:
  - focused diagnostics Vitest command - passed after sandbox `spawn EPERM` required escalation: 5 files / 92 tests.
  - render-frame evaluation/cache Vitest command - passed: 3 files / 15 tests.
  - `pnpm.cmd typecheck` - passed.
  - `git diff --check -- <Domain D files>` - no whitespace findings; CRLF warnings only.

## Review Results

| Lane | Report | Verdict |
|---|---|---|
| Spec compliance | [domain-d-spec-compliance-review.md](../../reviews/wave17/domain-d-spec-compliance-review.md) | pass |
| Design / development compliance | [domain-d-design-development-compliance-review.md](../../reviews/wave17/domain-d-design-development-compliance-review.md) | pass |
| Test adequacy | [domain-d-test-adequacy-review.md](../../reviews/wave17/domain-d-test-adequacy-review.md) | pass |

All review lanes passed in the first loop. No Gnome fix loop was required.

## Constraints Confirmed

- `pnpm install` was not run.
- No dependencies were added.
- No lockfile edits were made.
- No Runtime Export format files were edited.
- No package-format schema files were edited.
- No Editor files were edited.
- Runtime-core fast output internals were not broadened by this domain.
- Domain D source changes are limited to Runtime Player diagnostics/report semantics and small metric plumbing needed to carry render-frame proof fields.

## Residual Risks / Next-Domain Notes

- Real OBS Browser Source performance improvement remains unproven until Domain E/final integration and a user-captured real-model Performance Diagnostics report.
- Expected stable Browser Source proof pattern after this domain is:
  - `compiledRenderFrameCount > 0`
  - `publicSnapshotMaterializationCount: 0`
  - `transientCompileCount: 0`
  - `transientInstanceCount: 0`
  - runtime model instance cache hits increase after warm-up and misses remain zero during a stable capture.
- `publicSnapshotMaterializationCount` and runtime-core phase fields are deep-profile facts. Normal live diagnostics can show zero/unknown phase samples when deep profiling is disabled or no profiled live render frame is observed.
- `discussion/runtime-player/screens/performance-diagnostics.md` still describes the Wave16 baseline and should be aligned in Domain E/final integration with the implemented Wave17 report terminology.
- The internal compatibility name `snapshotToRenderDrawableDurationMs` remains in source/DTO plumbing. Copied reports now use `renderInputDrawableMappingDurationMs`, so a future cleanup can rename internal fields if desired, but it is not required for Wave17 Domain D.
