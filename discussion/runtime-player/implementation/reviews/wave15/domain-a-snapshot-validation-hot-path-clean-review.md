# Wave15 Domain A Clean Review: Snapshot Validation Hot-Path Removal

- Role: Review-Sylph
- Verdict: pass
- Date: 2026-06-26
- Scope: Domain A only. Reviewed changed runtime-core, Runtime Player pose evaluation, focused tests, and Domain A report. Domain B deep profiling gating is treated as residual unless it invalidates Domain A.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave15-plan.md`
- `discussion/runtime-player/implementation/orchestration/player-wave14-plan.md`
- `discussion/runtime-player/implementation/waves/wave14/wave14-final-integration-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Scope Reviewed

- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `discussion/runtime-player/implementation/waves/wave15/domain-a-snapshot-validation-hot-path-report.md`
- Diff inspected with the requested `git diff -- ...` command.

## Findings

- Blocking findings: none.
- Non-blocking residual, Domain B: Runtime Player still requests runtime-core profiling for every pose evaluation at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:100`, and `StaticStageCanvasRenderer` still records deep runtime-core profile fields at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:801` and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:852`. This matches the Wave15 plan's Domain B scope and does not block Domain A because snapshot validation itself is now skipped in the normal Runtime Player path.
- Non-blocking test gap: app-level default skip is covered at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:328`, and runtime-core schema/skip behavior is covered at `packages/runtime-core/src/runtime-core.test.ts:297`, `packages/runtime-core/src/runtime-core.test.ts:315`, `packages/runtime-core/src/runtime-core.test.ts:320`, `packages/runtime-core/src/runtime-core.test.ts:325`, and `packages/runtime-core/src/runtime-core.test.ts:358`. There is no focused app-level test that passes `snapshotValidation: "schema"` through `evaluateRuntimeExportPose`. Given the simple pass-through and runtime-core coverage, this is not blocking for Domain A, but Domain B/C should add one if diagnostics starts depending on app-level schema mode.

## Design / Development Compliance

- The validation control is explicit and local: `RuntimeFrameEvaluationControlOptions.snapshotValidation` is introduced at `packages/runtime-core/src/runtime-core.ts:42`, accepted by `evaluateRuntimeFrame` at `packages/runtime-core/src/runtime-core.ts:69`, and defaults to conservative `"schema"` at `packages/runtime-core/src/runtime-core.ts:105`.
- Using a separate frame control parameter instead of `runtime-options.ts` is acceptable for Domain A. It avoids Runtime Export/runtime-options schema churn, keeps the option explicit, and does not introduce hidden global state.
- Runtime Player normal pose evaluation defaults to validation skip through `RuntimeExportPoseEvaluationOptions.snapshotValidation` at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:44` and `options.snapshotValidation ?? "skip"` at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:103`.
- Stage render input preserves option plumbing by forwarding `...options` into `evaluateRuntimeExportPose` at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:68` through `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:73`.
- `createRuntimeSnapshot` now builds one snapshot object at `packages/runtime-core/src/snapshot.ts:260`, returns it directly only for `"skip"` at `packages/runtime-core/src/snapshot.ts:314`, and keeps full `RuntimeSnapshotSchema.parse` for schema mode at `packages/runtime-core/src/snapshot.ts:319`. The `as unknown as RuntimeSnapshotDto` cast at `packages/runtime-core/src/snapshot.ts:312` is acceptable for a validation-off hot path because the schema-on fallback remains available and focused tests compare valid schema/skip output.
- `evaluateRuntimeSequence` remains conservative and schema-validating by default at `packages/runtime-core/src/runtime-core.ts:116`. This is acceptable because the live Runtime Player hot path uses `evaluateRuntimeFrame`; revisit only if sequence evaluation becomes a live path needing validation skip.
- No `index.ts` implementation logic, dependency changes, lockfile changes, Runtime Export format changes, protocol changes, Editor/iFacialMocap/Stage Motion/Body Follow semantic changes, Drawable allocation optimization, or Warp transform optimization were introduced.

## Test Adequacy

- Runtime-core validation-on behavior is covered by the profiling test requesting `"schema"` and asserting `snapshotValidationDurationMs > 0`.
- Runtime-core validation-off behavior is covered by the schema-vs-skip equality test and `snapshotValidationDurationMs === 0`.
- Runtime-core schema-heavy validation remains available and is tested by an invalid snapshot construction that throws under `snapshotValidationMode: "schema"`.
- Runtime Player normal live pose evaluation is covered by the focused Stage render input test asserting `runtimeCoreProfile.snapshotValidationDurationMs === 0`.
- The focused verification set is adequate for Domain A. Broader manual Electron/OBS performance evidence remains outside this clean review and should be collected after Domain B/C.

## Verification Evidence Checked

- Inspected the requested source diff directly.
- Checked changed file list; only the expected source/test files and Domain A report were changed before this review record. No `package.json`, `pnpm-lock.yaml`, or workspace dependency file was in the Domain A diff.
- Considered Orch-Sylph verification evidence:
  - `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`: passed, 2 files / 11 tests.
  - `pnpm.cmd typecheck`: passed.
  - `node scripts/check-source-organization.mjs`: passed.
  - `git diff --check -- <changed files + report>`: passed with LF-to-CRLF working-copy warnings only.
  - `pnpm install` was not run.
- This clean review did not rerun the Vitest/typecheck commands.

## Residual Risks

- Real Browser Source / OBS smoothness still needs user-side manual verification with the real Runtime Export after Wave15 progresses beyond Domain A.
- Normal Runtime Player live evaluation still pays deep profiling overhead until Domain B gates it.
- Skip mode intentionally trusts the internally constructed snapshot DTO and bypasses only the full snapshot schema walk. Invalid normalized graph data could still produce an invalid snapshot in skip mode, but schema mode remains available for tests/debug/diagnostics and runtime-core defaults to schema.
- App-level schema-mode option plumbing is not directly asserted by a focused Runtime Player test.
