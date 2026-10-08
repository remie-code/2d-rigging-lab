# Wave18 Domain A Spec Compliance Review

- verdict: `pass`
- lane: spec compliance
- reviewer: Review-Sylph
- date: 2026-06-26

## Basis Reviewed

- `discussion/runtime-player/implementation/orchestration/player-wave18-plan.md`
- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- Actual diff for the four files under review.

## Changed Files Reviewed

- `apps/runtime-player/src/control/performance-diagnostics-page.tsx`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

## Findings

No blocking findings.

Spec confirmations:

- Start Capture no longer enables runtime-core deep profiling. `startCapture()` now only initializes the capture draft and timer; it does not call the profiling bridge. `finishCapture()` and `clearCapture()` also no longer issue profiling disable calls. See `apps/runtime-player/src/control/performance-diagnostics-page.tsx:140`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:171`, and `apps/runtime-player/src/control/performance-diagnostics-page.tsx:199`.
- Lifecycle tests cover the new inert behavior: Start Capture, Stop Capture, and timeout completion all assert that `onSetRuntimeCoreProfiling` is not called. See `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts:57`, `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts:77`, and `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts:110`.
- Copied report output now declares `diagnosticScope: live-health-fps-connection-fast-path` and prints input FPS/count plus target live/apply/render FPS, Browser Source client count, canvas, Stage Motion, scheduled/immediate render counts, scaffold counters, fast-path counters, transient counters, and runtime instance cache counters. See `apps/runtime-player/src/control/performance-diagnostics-report.ts:271`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:282`, and `apps/runtime-player/src/control/performance-diagnostics-report.ts:929`.
- Deep runtime-core product-facing report fields and `runtimeModelCompileDurationMs` are omitted from the target report shape/output. The tests define the omitted field set and assert copied report text does not contain those field names or `deep-runtime-core-profile`. See `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:30`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:339`, and `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:575`.
- Missing lightweight metrics remain graceful. Browser Source with a connected client but no renderer metrics becomes `metrics-unavailable`, preserves client count, and formats null metrics as `unknown`. See `apps/runtime-player/src/control/performance-diagnostics-report.ts:364`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:372`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:582`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:1029`, and `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:582`.
- Privacy exclusions remain present and tested. The report retains exclusion labels for raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, textures, and mesh data; tests assert unsafe sample payload details do not leak into stored samples or report text. See `apps/runtime-player/src/control/performance-diagnostics-report.ts:254`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:298`, and `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:712`.
- UI copy avoids presenting the page as a deep profiler. The visible control copy remains capture/report/availability/comparison wording, without deep profiling terminology. See `apps/runtime-player/src/control/performance-diagnostics-page.tsx:216`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:259`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:300`, and `apps/runtime-player/src/control/performance-diagnostics-page.tsx:351`.
- No out-of-scope dependency, lockfile, Editor, or package-format diff was found in the scoped `git diff --name-only` check. The changed set under the review/sensitive paths was limited to the four files listed above.

## Verification Considered Or Run

- Inspected `git diff --` for all four changed files under review.
- Ran targeted `rg` checks for lingering product-facing deep profiling/report field strings in the four files. Only negative test assertions still mention `deep-runtime-core-profile`.
- Ran `git diff --check --` for the four reviewed files: no whitespace findings; CRLF working-copy warnings only.
- Ran focused Vitest with elevation:
  - `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
  - Result: 2 files passed, 10 tests passed.
- Ran `pnpm.cmd typecheck` with elevation.
  - Result: passed.
- Considered Gnome's reported verification, but did not rely on it alone.

## Residual Risks / Next-Domain Notes

- `PerformanceDiagnosticsPage` still accepts the optional `onSetRuntimeCoreProfiling` prop type and imports `RuntimePlayerRuntimeCoreProfilingMode` for that prop surface at `apps/runtime-player/src/control/performance-diagnostics-page.tsx:89`. This is inert in Domain A and does not affect Start Capture behavior, but Domain B should remove the remaining product profiling bridge/transport surface as planned.
- `copyRenderMetricsSnapshot()` still copies runtime-core profiling metric fields from renderer snapshots internally, but Domain A's report object and copied report output no longer expose them as product-facing report lines. Domain B should decide whether upstream transport still sends those fields.
- `discussion/runtime-player/screens/performance-diagnostics.md` still describes the Wave17 deep capture behavior. Per Wave18 plan, final integration/docs alignment should update that document after Domain B establishes the final product transport state.
