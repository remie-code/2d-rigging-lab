# Runtime Player Wave13 Domain B Test Adequacy Review

## Verdict

needs_fix

## Scope

- Target: Runtime Player Wave13 Domain B, Performance Diagnostics Capture / Report UX.
- Review lane: Test adequacy / verification.
- Basis:
  - `discussion/runtime-player/implementation/orchestration/player-wave13-plan.md`
  - `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/dependency-policy.md`

## Findings

### 1. UI capture lifecycle is not tested at the component that implements it

Severity: needs_fix

`PerformanceDiagnosticsPage` owns the actual user-facing lifecycle: `startCapture`, timer setup, `finishCapture`, report formatting, Stop Capture, and Copy Report are implemented in `apps/runtime-player/src/control/performance-diagnostics-page.tsx:134` through `apps/runtime-player/src/control/performance-diagnostics-page.tsx:190`, with the Copy Report button at `apps/runtime-player/src/control/performance-diagnostics-page.tsx:262`.

The current lifecycle test in `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:192` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:227` exercises pure helper functions from `performance-diagnostics-report.ts`, but `PerformanceDiagnosticsPage` does not use those helpers for its UI lifecycle. The only page-level test is static markup for empty states in `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:279` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:301`.

Impact: regressions in Start Capture, Stop Capture, automatic timeout completion, disabled button states, selected target/duration propagation, sample collection on prop updates, or Copy Report callback wiring would not be caught.

Recommendation: add a jsdom/react interaction test with fake timers for `PerformanceDiagnosticsPage` that starts a capture, updates metrics props, stops manually and/or lets the timeout fire, then asserts the report preview and `onCopyReport` payload. This should also assert target and duration selections are reflected in the report.

### 2. Malformed/unsafe metric payload validation is not covered by tests

Severity: needs_fix

Validation exists in `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:20` through `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:90`, and the native Stage IPC handler uses it in `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:115` through `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:128`. Browser Source diagnostics parse `renderMetrics` through optional validation in `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.ts:41` through `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.ts:60`.

The tests cover only valid native metrics storage/publish in `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:135` through `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:160`, and valid preload channel routing in `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts:40` through `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts:83` plus `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts:158` through `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts:182`.

Impact: the Domain B rubric asks for IPC/preload/main validation coverage enough to catch malformed/unsafe metric payloads. Current tests would not catch accidental removal of non-negative integer checks, `NaN`/`Infinity` filtering, invalid `devicePixelRatio`, or Browser Source invalid `renderMetrics` fallback behavior.

Recommendation: add focused tests for native `reportRenderMetrics` with non-object payloads, negative counters, non-integer counters, non-finite timing values, and invalid DPR. Add Browser Source parser/session coverage that invalid nested `renderMetrics` becomes `null` and does not overwrite a valid metrics snapshot or leak extra fields.

## Coverage Confirmed

- Control navigation includes Performance Diagnostics:
  - `apps/runtime-player/src/control/live-controller-page.test.ts:125` through `apps/runtime-player/src/control/live-controller-page.test.ts:158`.
- Report aggregation covers native Stage metrics and distinct source/render FPS:
  - `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:30` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:137`.
- Report aggregation covers Browser Source metrics when a client reports them:
  - `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:139` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:190`.
- Empty/no-stage/no-browser-source UI states are at least statically covered:
  - `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:279` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:301`.
- Copy report privacy exclusions cover token fixture, raw frame sample, calibration-internal fixture, and private path fixture:
  - `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:229` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:276`.

## Verification Performed

- `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/control/live-controller-page.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
  - First sandboxed attempt failed with `spawn EPERM` while loading Vitest/esbuild.
  - Re-run with approval passed: 8 files, 50 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- apps/runtime-player/src/control apps/runtime-player/src/preload apps/runtime-player/src/main apps/runtime-player/src/stage`
  - Passed with CRLF normalization warnings only.
- `pnpm install`
  - Not run.

## Verification Notes

Gnome-reported focused Runtime Player Vitest was 9 files / 69 tests. I verified the listed Domain B and directly related renderer tests as 8 files / 50 tests. I did not reproduce the exact 9-file / 69-test command, so treat that count as unconfirmed by this review.

## Residual Risks

- The privacy test does not directly inject a full Runtime Export payload into the diagnostics report path. Current report input types make that leak unlikely, but a future broader status object could make this worth a regression test.
- The report's p50/p95 values are derived from captured `last*` metrics snapshots, not raw timing distributions. This may be acceptable for a lightweight diagnostics surface, but it is a measurement-accuracy risk if the UI is expected to report true renderer-side percentiles.

## User Decision Points

- None for the user. The recommended fixes are focused test additions and do not require a product/design decision.
