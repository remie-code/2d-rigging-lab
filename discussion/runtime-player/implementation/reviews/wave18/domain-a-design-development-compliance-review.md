# Runtime Player Wave18 Domain A Design / Development Compliance Review

- verdict: pass
- lane: design / development compliance
- scope: Wave18 Domain A only, Control Performance Diagnostics simplification and copied report output
- reviewer: Review-Sylph
- date: 2026-06-26

## Basis Reviewed

- `discussion/runtime-player/implementation/orchestration/player-wave18-plan.md`
- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- Actual diff:
  - `git diff -- apps/runtime-player/src/control/performance-diagnostics-page.tsx apps/runtime-player/src/control/performance-diagnostics-report.ts apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

## Changed Files Reviewed

- `apps/runtime-player/src/control/performance-diagnostics-page.tsx`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

## Findings

No blocking design/development compliance findings.

The implementation matches Domain A's product simplification boundary:

- Start Capture no longer requests product runtime-core deep profiling. `startCapture`, `finishCapture`, and `clearCapture` now only manage local capture state/timers and report creation (`performance-diagnostics-page.tsx:140`, `performance-diagnostics-page.tsx:171`, `performance-diagnostics-page.tsx:199`). Lifecycle tests assert the remaining `onSetRuntimeCoreProfiling` prop is not called on start, manual stop, or timed completion (`performance-diagnostics-page.lifecycle.test.ts:57`, `performance-diagnostics-page.lifecycle.test.ts:77`, `performance-diagnostics-page.lifecycle.test.ts:110`).
- Copied report output is re-scoped to lightweight health/FPS/connection/fast-path proof with `diagnosticScope: live-health-fps-connection-fast-path` (`performance-diagnostics-report.ts:271`) and target output focused on availability, FPS/counts, Browser Source client count, canvas, fast-path counters, transient counters, and runtime instance cache counters (`performance-diagnostics-report.ts:933`).
- Deep runtime-core phase timing fields and `runtimeModelCompileDurationMs` were removed from the public target report shape (`performance-diagnostics-report.ts:52`) and are not formatted in copied report text (`performance-diagnostics-report.ts:929`). Tests explicitly deny those fields in copied reports (`performance-diagnostics-report.test.ts:30`, `performance-diagnostics-report.test.ts:339`, `performance-diagnostics-report.test.ts:547`).
- Privacy exclusions remain present in report construction and copied text (`performance-diagnostics-report.ts:254`, `performance-diagnostics-report.test.ts:667`).
- Missing lightweight metrics are still rendered as `unknown` instead of breaking the report (`performance-diagnostics-report.test.ts:582`).
- The diff stayed inside the four Domain A Control/report files. I found no Domain B transport cleanup, runtime-core deletion, Runtime Export format change, Editor change, package-format schema change, dependency change, lockfile change, or `pnpm install` scope creep.

Non-blocking residual debt for Domain B:

- `PerformanceDiagnosticsPage` still accepts an `onSetRuntimeCoreProfiling` prop and `control-window-app.tsx` still passes a profiling callback (`performance-diagnostics-page.tsx:77`, `control-window-app.tsx:864`). The page no longer invokes it, so this is acceptable Domain B transport/API cleanup debt rather than a Domain A blocker.
- `copyRenderMetricsSnapshot` still copies runtime-core metric fields from upstream render metrics snapshots (`performance-diagnostics-report.ts:786`). They are no longer part of the product-facing target report or copied text. Domain B should remove or narrow upstream profiling transport/payload fields when it owns that cleanup.
- `PerformanceDiagnosticsTargetReport` still carries some unformatted timing summaries such as render/pose/render-input summaries (`performance-diagnostics-report.ts:65`). They are not copied to the product report after this change. This can remain as source-level cleanup debt unless a later domain chooses to shrink the internal helper DTO further.

## Verification Considered Or Run

- Considered Gnome evidence:
  - Focused diagnostics Vitest initially failed in sandbox with esbuild `spawn EPERM`, then passed with elevation.
  - `pnpm.cmd typecheck` passed.
  - `git diff --check` had no whitespace findings, CRLF warnings only.
- Independently run:
  - `git diff --check -- apps/runtime-player/src/control/performance-diagnostics-page.tsx apps/runtime-player/src/control/performance-diagnostics-report.ts apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
    - No whitespace findings; CRLF warnings only.
  - `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
    - Sandbox run failed with `spawn EPERM` while loading Vite/esbuild config.
    - Elevated rerun passed: 2 files, 10 tests.
  - `pnpm.cmd typecheck`
    - Passed.
  - `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core apps/runtime-player/src/preload apps/runtime-player/src/main apps/runtime-player/src/stage`
    - No output.

## Residual Risks / Next-Domain Notes

- Domain B still needs to remove product Stage / Browser Source profiling IPC/WS/protocol paths and make `publicSnapshotMaterializationCount` cheap and independent of deep profiling at the transport/source level.
- The Wave17 `performance-diagnostics.md` basis document still describes deep capture behavior; Wave18 final integration should update docs/maps after Domains A-B complete, per the wave planning conventions.
- This review did not verify real OBS Browser Source smoothness. That remains a manual final integration check after Domain B removes the remaining product profiling transport path.
