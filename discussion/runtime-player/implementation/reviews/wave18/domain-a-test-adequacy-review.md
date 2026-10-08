# Wave18 Domain A Test Adequacy Review

- verdict: `pass`
- reviewer: Review-Sylph Lane 3 / test adequacy
- date: 2026-06-26
- scope: Wave18 Domain A only, Control Performance Diagnostics simplification and copied report shrink
- loop: 2 re-review

## Basis Reviewed

- `discussion/runtime-player/implementation/orchestration/player-wave18-plan.md`
- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- Actual loop 2 diff:
  - `git diff -- apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

## Changed Files Reviewed

- `apps/runtime-player/src/control/performance-diagnostics-page.tsx`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

Loop 2 changed file:

- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

## Loop 2 Finding Resolution

Original finding: copied report formatting tests did not assert retained counter lines for `transientInstanceCount`, `runtimeModelInstanceCacheMissCount`, and `runtimeModelInstanceCacheInvalidationCount`; `scaffoldEvaluationCacheInvalidationCount` was recommended.

Resolution: fixed.

The loop 2 diff adds copied report assertions for:

- `transientInstanceCount: 0` at `performance-diagnostics-report.test.ts:460`
- `scaffoldEvaluationCacheInvalidationCount: 0` at `performance-diagnostics-report.test.ts:464`
- `runtimeModelInstanceCacheMissCount: 0` at `performance-diagnostics-report.test.ts:466`
- `runtimeModelInstanceCacheInvalidationCount: 0` at `performance-diagnostics-report.test.ts:468`

These sit alongside existing copied report assertions for `compiledEvaluatorFrameCount`, `compiledRenderFrameCount`, `transientCompileCount`, `publicSnapshotMaterializationCount`, `runtimeModelInstanceCacheHitCount`, and `browserSourceClientCount` (`performance-diagnostics-report.test.ts:455` through `performance-diagnostics-report.test.ts:470`). This now covers the retained lightweight fast-path, transient, Browser Source client, and runtime instance cache report lines required by Wave18 Domain A.

No new test adequacy gaps were introduced in the inspected diff.

## Adequacy Confirmed

- Deep runtime-core timing omissions remain covered by the explicit omitted field list and copied report negative assertions (`performance-diagnostics-report.test.ts:30`, `performance-diagnostics-report.test.ts:339`, `performance-diagnostics-report.test.ts:471`, `performance-diagnostics-report.test.ts:581`).
- Capture lifecycle still covers that `onSetRuntimeCoreProfiling` is never called on start, stop, or timed completion paths (`performance-diagnostics-page.lifecycle.test.ts:60`, `performance-diagnostics-page.lifecycle.test.ts:80`, `performance-diagnostics-page.lifecycle.test.ts:114`).
- Missing lightweight metrics still render safely as `unknown` in the dedicated missing-metrics test (`performance-diagnostics-report.test.ts:588` through `performance-diagnostics-report.test.ts:631`).
- Privacy exclusions remain covered for token, raw frame, calibration internals, and private path leakage; the report still declares exclusions for full Runtime Export payload, textures, and mesh data.

## Verification

Considered Gnome loop 2 evidence:

- Focused diagnostics Vitest reportedly passed: 3 files / 49 tests.
- `git diff --check -- apps/runtime-player/src/control/performance-diagnostics-report.test.ts` reportedly had no whitespace findings; CRLF warning only.

Independently inspected:

- `git diff -- apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

Independently run:

```text
pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts
```

Result: pass, 3 files / 49 tests.

I did not rerun `pnpm.cmd typecheck`; it is not necessary for this loop 2 test adequacy re-review because the scoped assertion fix was verified by focused diagnostics tests.

## Residual Risks / Next-Domain Notes

- This review is limited to Domain A test adequacy. Domain B transport cleanup and cheap proof-counter independence are intentionally deferred and are not counted as Domain A failures.
- Manual OBS Browser Source behavior remains outside this scoped automated test adequacy review.
- `performance-diagnostics.md` still reflects Wave17 deep-capture behavior; Wave18 final/docs alignment should update it after Domains A-B settle implementation facts.
