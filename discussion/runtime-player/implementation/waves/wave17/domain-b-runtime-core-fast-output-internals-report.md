# Runtime Player Wave17 Domain B Report: Runtime-Core Fast Output Internals

- Verdict recommendation: pass
- Domain: Runtime-Core Fast Output Internals
- Orchestrator: Orch-Sylph
- Implementation agent: Gnome
- Date: 2026-06-26
- Loop count: 2

## Scope

Domain B changed runtime-core internals so `RuntimeModelInstance#evaluateRenderFrame(...)` produces renderer-facing dynamic frame output without routing through public snapshot DTO materialization.

This domain did not implement Runtime Player connection, diagnostics/report UI semantics, Runtime Export format changes, Editor changes, package-format schema changes, dependency changes, lockfile edits, or `pnpm install`.

Basis:

- [../../orchestration/player-wave17-plan.md](../../orchestration/player-wave17-plan.md)
- [domain-a-runtime-core-render-frame-api-report.md](domain-a-runtime-core-render-frame-api-report.md)
- [../../reviews/wave17/domain-a-spec-compliance-review.md](../../reviews/wave17/domain-a-spec-compliance-review.md)
- [../../reviews/wave17/domain-a-design-development-compliance-review.md](../../reviews/wave17/domain-a-design-development-compliance-review.md)
- [../../reviews/wave17/domain-a-test-adequacy-review.md](../../reviews/wave17/domain-a-test-adequacy-review.md)
- [../../orchestration/player-wave16-plan.md](../../orchestration/player-wave16-plan.md)
- [../wave16/wave16-final-integration-report.md](../wave16/wave16-final-integration-report.md)
- [../wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md](../wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md)
- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)
- [../../orchestration/runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)

## Files Changed

Source and tests:

- `packages/runtime-core/src/runtime-drawable-evaluation.ts`
- `packages/runtime-core/src/keyform-target-application.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-profiling.ts`
- `packages/runtime-core/src/snapshot-static-templates.ts`
- `packages/runtime-core/src/snapshot.ts`

Review artifacts:

- [../../reviews/wave17/domain-b-spec-compliance-review.md](../../reviews/wave17/domain-b-spec-compliance-review.md)
- [../../reviews/wave17/domain-b-design-development-compliance-review.md](../../reviews/wave17/domain-b-design-development-compliance-review.md)
- [../../reviews/wave17/domain-b-test-adequacy-review.md](../../reviews/wave17/domain-b-test-adequacy-review.md)

Domain docs/maps:

- [domain-b-runtime-core-fast-output-internals-report.md](domain-b-runtime-core-fast-output-internals-report.md)
- [_map.md](_map.md)
- [../../reviews/wave17/_map.md](../../reviews/wave17/_map.md)

## Implementation Summary

- Moved `evaluateRenderFrame(...)` off the public `evaluateFrame(...)` / `createRuntimeSnapshot(...)` path.
- Added a render-frame evaluator path that advances runtime state and builds `RuntimeRenderFrame` from runtime-core internal drawable evaluation.
- Added `RuntimeDrawableEvaluationBase` as a narrow internal drawable work item for render-frame evaluation.
- Kept public `EvaluatedDrawableDto` materialization in the explicit public snapshot path.
- Removed the loop-1 public drawable DTO-like render intermediate and avoided generating public per-drawable fields such as public bounds, vertex count, vertex hash, public texture DTOs, and per-drawable diagnostics arrays in the render-frame fast path.
- Preserved the renderer-facing output shape: `drawableId`, stable `index`, cloned `vertices`, `opacity`, `drawOrder`, and `visible`.
- Added runtime-core profiling fields for fast-path proof, including `publicSnapshotMaterializationCount` and `runtimeCoreRenderFrameOutputDurationMs`.
- Preserved public snapshot compatibility and freshness semantics.

## Review Loop

Loop 1:

- Spec compliance: pass.
- Test adequacy: pass.
- Design / development compliance: needs_changes.
- Blocking finding: the render-frame path avoided full `RuntimeSnapshotDto` construction but still materialized public drawable DTO-shaped data before projecting it to renderer fields.

Loop 2:

- Gnome replaced that intermediate with a narrow internal runtime drawable shape.
- All three independent Review-Sylph lanes were rerun in fresh contexts against the final diff, including the new untracked source file.
- Final review verdicts are all `pass`.

## Verification

Gnome verification after loop 2:

- `pnpm.cmd typecheck`
  - Passed.
- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/snapshot-static-templates.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts packages/runtime-core/src/keyform-target-application.test.ts packages/runtime-core/src/dynamics-evaluation.test.ts packages/runtime-core/src/rig-control-compiled-topology.test.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Passed: 9 files / 38 tests.
- `git diff --check -- <touched runtime-core tracked files>`
  - Passed with CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL packages/runtime-core/src/runtime-drawable-evaluation.ts`
  - No whitespace findings; normal no-index diff status with CRLF warning only.

Independent review verification:

- Spec compliance reviewer reran:
  - focused 9-file Vitest command - passed: 9 files / 38 tests.
  - `pnpm.cmd typecheck` - passed.
  - tracked-file `git diff --check` and new-file no-index whitespace check - no whitespace findings, CRLF warnings only.
- Design / development reviewer reran:
  - `pnpm.cmd typecheck` - passed.
  - focused 9-file Vitest command - passed: 9 files / 38 tests.
  - tracked-file `git diff --check` and new-file no-index whitespace check - no whitespace findings, CRLF warnings only.
- Test adequacy reviewer reran:
  - focused 9-file Vitest command - passed after sandbox `spawn EPERM` required escalation: 9 files / 38 tests.
  - `pnpm.cmd typecheck` - passed.
  - tracked-file `git diff --check` and new-file no-index whitespace check - no whitespace findings, CRLF warnings only.

## Review Results

| Lane | Report | Verdict |
|---|---|---|
| Spec compliance | [domain-b-spec-compliance-review.md](../../reviews/wave17/domain-b-spec-compliance-review.md) | pass |
| Design / development compliance | [domain-b-design-development-compliance-review.md](../../reviews/wave17/domain-b-design-development-compliance-review.md) | pass |
| Test adequacy | [domain-b-test-adequacy-review.md](../../reviews/wave17/domain-b-test-adequacy-review.md) | pass |

## Constraints Confirmed

- `pnpm install` was not run.
- No dependencies were added.
- No lockfile edits were made.
- No Runtime Export format or package-format schema files were edited.
- No Editor files were edited.
- No Runtime Player app source was edited.
- Runtime-core did not gain Runtime Export/package-format imports; dependency-boundary tests passed.
- Public snapshot DTO shape and freshness behavior remain preserved.

## Residual Risks / Next-Domain Notes

- Domain B is runtime-core only. Runtime Player live-path adoption remains Domain C.
- Performance Diagnostics report surfacing and naming remain Domain D. Reviewers noted that some internal phase names may still need clear report labeling once the fast path is wired into Runtime Player.
- Runtime-core has no active Variant concept in this domain; Runtime Player Variant switching remains a later-domain responsibility.
- Dedicated render-frame parity for a keyform-driven visibility toggle is inferred from shared keyform application and existing visibility tests, not a separate render-frame-only visibility fixture.
- Render-frame output still clones vertex arrays for frame-owned safety. Reusable typed render buffers can remain a later optimization if profiling shows clone cost after Browser Source integration.
- Real Browser Source performance improvement remains unproven until Domain C/D integration and a real-model Performance Diagnostics capture.
