# Runtime Player Wave17 Domain A Report: Runtime-Core Render Frame API

- Verdict recommendation: pass
- Domain: Runtime-Core Render Frame API
- Orchestrator: Orch-Sylph
- Implementation agent: Gnome
- Date: 2026-06-26
- Loop count: 1

## Scope

Domain A added an additive renderer-facing runtime-core render frame API shell while preserving the existing public snapshot APIs and snapshot freshness behavior.

This domain did not implement Runtime Player connection, diagnostics/report semantics, public snapshot bypass internals, Runtime Export format changes, Editor changes, dependency changes, lockfile edits, or `pnpm install`.

Basis:

- [../../orchestration/player-wave17-plan.md](../../orchestration/player-wave17-plan.md)
- [../../orchestration/player-wave16-plan.md](../../orchestration/player-wave16-plan.md)
- [../wave16/wave16-final-integration-report.md](../wave16/wave16-final-integration-report.md)
- [../wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md](../wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md)
- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)
- [../../orchestration/runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)

## Files Changed

Source and tests:

- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-core.test.ts`

Review artifacts:

- [../../reviews/wave17/domain-a-spec-compliance-review.md](../../reviews/wave17/domain-a-spec-compliance-review.md)
- [../../reviews/wave17/domain-a-design-development-compliance-review.md](../../reviews/wave17/domain-a-design-development-compliance-review.md)
- [../../reviews/wave17/domain-a-test-adequacy-review.md](../../reviews/wave17/domain-a-test-adequacy-review.md)

Domain docs/maps:

- [domain-a-runtime-core-render-frame-api-report.md](domain-a-runtime-core-render-frame-api-report.md)
- [_map.md](_map.md)
- [../../reviews/wave17/_map.md](../../reviews/wave17/_map.md)

## Implementation Summary

- Added `RuntimeModelInstance#evaluateRenderFrame(...)`.
- Added renderer-facing render frame types:
  - `RuntimeRenderFrameEvaluationResult`
  - `RuntimeRenderFrame`
  - `RuntimeRenderFrameDrawable`
  - `RuntimeModelRenderFrameEvaluationOptions`
- The render frame result shape is `{ frame, nextState, profile? }`.
- `frame.drawables[]` exposes renderer dynamic fields: `drawableId`, stable `index`, `vertices`, `opacity`, `drawOrder`, and `visible`.
- The shell currently evaluates through the existing compatible frame path, forces full snapshot detail for render-frame projection, and clones render vertices into plain `Vec2Dto[]`.
- Existing `evaluateFrame(...)` and `evaluateRuntimeFrame(...)` public behavior remain compatible.
- Public snapshot DTO shape was not changed.
- Previous public snapshots remain isolated from later render frame evaluation.

## Verification

Gnome verification:

- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Initial sandbox attempt failed with `spawn EPERM`.
  - Escalated rerun passed: 2 files / 12 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-core.test.ts`
  - Passed with CRLF working-copy warnings only.

Independent review verification:

- Spec compliance reviewer reran the focused runtime-core/dependency-boundary Vitest command.
  - Passed: 2 files / 12 tests.
- Test adequacy reviewer reran:
  - `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
    - Passed: 2 files / 12 tests.
  - `pnpm.cmd exec vitest run packages/runtime-core/src/snapshot-static-templates.test.ts`
    - Passed: 1 file / 2 tests.
  - `pnpm.cmd typecheck`
    - Passed.
  - `git diff --check -- packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-core.test.ts`
    - No whitespace findings; CRLF working-copy warnings only.

Orch-Sylph doc/map verification:

- `git status --short -uall`
  - Confirmed Domain A source changes, three review reports, this report, and wave17 maps are present.
  - Pre-existing `discussion/runtime-player/implementation/_map.md` modification and untracked `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md` remain outside this domain's edits.
- `git diff --check -- packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-core.test.ts`
  - No whitespace findings; CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL <new wave17 report/map/review files>`
  - No whitespace findings; commands returned normal no-index diff status with CRLF working-copy warnings only.

## Review Results

| Lane | Report | Verdict |
|---|---|---|
| Spec compliance | [domain-a-spec-compliance-review.md](../../reviews/wave17/domain-a-spec-compliance-review.md) | pass |
| Design / development compliance | [domain-a-design-development-compliance-review.md](../../reviews/wave17/domain-a-design-development-compliance-review.md) | pass |
| Test adequacy | [domain-a-test-adequacy-review.md](../../reviews/wave17/domain-a-test-adequacy-review.md) | pass |

All review lanes passed in the first loop. No Gnome fix loop was required.

## Constraints Confirmed

- `pnpm install` was not run.
- No dependencies were added.
- No lockfile edits were made.
- No Runtime Export format/package-format files were edited.
- No Editor files were edited.
- Runtime-core did not gain package-format imports; dependency-boundary tests passed.
- Runtime Player source was not changed by this domain.

## Residual Risks / Next-Domain Notes

- Domain A is an API shell and does not yet bypass public snapshot DTO materialization. `evaluateRenderFrame(...)` currently projects from a full public snapshot.
- Domain B must implement the runtime-core fast output internals and prove render frame evaluation can produce renderer-facing dynamic data without building full public snapshot DTOs.
- Domain B should add parity coverage for dynamics, keyforms, deformers, clipping, variants, opacity, draw order, visibility, and nested warp/rest-bind semantics.
- Domain B should add evidence for any public snapshot materialization counter once that counter exists.
- Domain C must keep Native Stage and Browser Source target-local runtime instances and output ownership separate when consuming the API.
