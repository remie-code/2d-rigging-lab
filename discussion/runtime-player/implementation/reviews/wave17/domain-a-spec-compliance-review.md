# Wave17 Domain A Spec Compliance Review

Verdict: pass

## Reviewed Basis And Files

Basis documents:

- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

Reviewed implementation files and exact diff:

- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `git diff -- packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-core.test.ts`
- `git status --short -uall`

Current status also showed a pre-existing modified `discussion/runtime-player/implementation/_map.md` and untracked `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`. Those are outside the reviewed Domain A source diff.

## Findings

No spec compliance findings.

## Spec Checklist

- Pass - additive renderer-facing runtime-core API exists. `RuntimeModelInstance#evaluateRenderFrame(...)` is added at `packages/runtime-core/src/runtime-model.ts:43` and implemented at `packages/runtime-core/src/runtime-model.ts:173`.
- Pass - the API is exported through runtime-core. New render frame types are re-exported from `packages/runtime-core/src/runtime-core.ts:48`, and the package root already re-exports runtime-core via `packages/runtime-core/src/index.ts:16`.
- Pass - existing `RuntimeModelInstance#evaluateFrame(...)` remains compatible. The existing method still returns `RuntimeFrameEvaluationResult`, and targeted runtime-core tests passed.
- Pass - existing `evaluateRuntimeFrame(...)` remains compatible. The top-level function remains at `packages/runtime-core/src/runtime-core.ts:90`, and `runtimeCore.evaluateRuntimeFrame` remains part of the runtimeCore object at `packages/runtime-core/src/runtime-core.ts:237`.
- Pass - the new API does not require Runtime Export package-format DTOs. It continues to operate from a compiled `NormalizedRuntimeGraph` and runtime input/state types. `rg` found no package-format imports in runtime-core production source, and `dependency-boundary.test.ts` passed.
- Pass - explicit renderer-facing dynamic result shape exists. `RuntimeRenderFrameEvaluationResult` exposes `frame`, `nextState`, and optional `profile` at `packages/runtime-core/src/runtime-model.ts:69`; `RuntimeRenderFrameDrawable` exposes `drawableId`, `index`, `vertices`, `opacity`, `drawOrder`, and `visible` at `packages/runtime-core/src/runtime-model.ts:79`.
- Pass - no public snapshot DTO shape changes were found. The diff does not edit snapshot DTO definitions, and the new render result intentionally omits `snapshot`; the focused test asserts this at `packages/runtime-core/src/runtime-core.test.ts:543`.
- Pass - no public snapshot freshness behavior changes were found. The render frame freshness test starts at `packages/runtime-core/src/runtime-core.test.ts:575`, and the implementation clones render vertices at `packages/runtime-core/src/runtime-model.ts:247`.
- Pass - Domain A stays in scope. The source diff is limited to runtime-core API/types/tests. It does not implement Runtime Player connection, diagnostics/report semantics, Runtime Export/package-format schema changes, Editor changes, dependencies, lockfile edits, or `pnpm install`.
- Pass with Domain B note - the API shell currently projects from a full public snapshot by forcing `snapshotDetail: "full"` at `packages/runtime-core/src/runtime-model.ts:182` and mapping via `createRuntimeRenderFrame(...)` at `packages/runtime-core/src/runtime-model.ts:239`. This is acceptable for Domain A because Wave17 Domain B owns the public snapshot bypass/optimization.

## Verification Considered / Run

Considered Gnome evidence:

- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/dependency-boundary.test.ts` passed after escalation: 2 files / 12 tests.
- `pnpm.cmd typecheck` passed.
- `git diff --check -- packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-core.test.ts` passed with CRLF warnings only.

Independently run during this review:

- `git status --short -uall`
- `git diff -- packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-core.test.ts`
- `rg` checks for render-frame exports and forbidden package-format imports.
- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Passed: 2 files / 12 tests.
- `git diff --check -- packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-core.test.ts`
  - No whitespace findings; CRLF working-copy warnings only.

I did not rerun full `pnpm.cmd typecheck`; this review relies on the provided Gnome typecheck evidence for that item.

## Residual Risks / Domain B Notes

- `evaluateRenderFrame(...)` still materializes a full public snapshot internally. This does not satisfy Wave17's performance goal by itself, but it is explicitly the Domain B responsibility to bypass public snapshot DTO materialization.
- Render vertices are plain cloned `Vec2Dto[]` values rather than typed arrays or reusable output buffers. The Wave17 plan allows plain arrays first if typed arrays broaden the wave.
- Domain C must ensure Native Stage and Browser Source consume fast output without sharing mutable target state or output buffers.
- Domain D must add the proof counters/report semantics for the fast path; Domain A intentionally does not add diagnostics.
