# Runtime Player Wave13 Domain B Design / Development Re-review

Role: Review-Sylph  
Lane: Design / Development Compliance re-review  
Target: Runtime Player Wave13 Domain B - Performance Diagnostics Capture / Report UX

## Verdict

pass

The two prior Design / Development findings are fixed. Capture storage now uses a typed minimal sample boundary instead of retaining full status objects, and the Performance Diagnostics page now has a deterministic low-priority `Clear Report` control.

## Prior Findings Re-check

### 1. Capture storage safe/minimal boundary

Status: fixed.

Evidence:

- `apps/runtime-player/src/control/performance-diagnostics-report.ts:20` defines `PerformanceDiagnosticsInputSample` as only `packetCount` and `estimatedFps`.
- `apps/runtime-player/src/control/performance-diagnostics-report.ts:25` defines the Stage sample as only Stage window state and Stage Motion enabled state.
- `apps/runtime-player/src/control/performance-diagnostics-report.ts:31` defines the Browser Source sample as only client count, source FPS, and render metrics.
- `apps/runtime-player/src/control/performance-diagnostics-report.ts:37` defines `PerformanceDiagnosticsCaptureSample` from those minimal samples plus native render metrics.
- `apps/runtime-player/src/control/performance-diagnostics-report.ts:110` accepts full statuses only as input to `createPerformanceDiagnosticsCaptureSample`; it copies only safe fields into the returned sample at `apps/runtime-player/src/control/performance-diagnostics-report.ts:119`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:125`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:131`, and `apps/runtime-player/src/control/performance-diagnostics-report.ts:134`.
- `apps/runtime-player/src/control/performance-diagnostics-report.ts:608` copies render metrics by enumerating known aggregate fields, so extra/private object properties are not preserved.
- `apps/runtime-player/src/control/performance-diagnostics-page.tsx:59` stores capture drafts as `PerformanceDiagnosticsCaptureSample[]`, and `apps/runtime-player/src/control/performance-diagnostics-page.tsx:353` creates the current sample through the safe sample builder.
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:273` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:280` asserts the stored sample and copied report omit token, raw-frame, calibration-like, and private-path strings.

Assessment: the report aggregation boundary still receives full status objects at the function input, but it does not retain them. The retained capture draft/report sample type is minimal and aggregate-only, satisfying the re-review requirement.

### 2. Manual clear/reset control

Status: fixed.

Evidence:

- `apps/runtime-player/src/control/performance-diagnostics-page.tsx:194` implements `clearCapture()`, clearing the timer, dropping the draft, and returning UI state to idle.
- `apps/runtime-player/src/control/performance-diagnostics-page.tsx:287` renders the `Clear Report` control with `RefreshCcw`.
- `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts:42` covers Start Capture, Stop Capture, Copy Report, and Clear Report.
- `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts:84` clicks `Clear Report` and verifies Copy Report is disabled and Start Capture is enabled afterward.

Assessment: this is deterministic manual reset behavior. It is low-priority in the capture action row and does not turn diagnostics into a primary live-control surface.

## Additional Compliance Re-check

### Dependencies / manifests

Pass.

- `git diff --name-only -- package.json pnpm-lock.yaml "**/package.json"` returned no changed manifest or lockfile paths.
- `node scripts/check-dependencies.mjs` passed.

### Source file organization

Pass.

- `git diff --name-only -- "*index.ts"` returned no changed `index.ts` paths.
- New implementation files are responsibility-scoped: diagnostics page, diagnostics report aggregation, metrics validation, and focused tests.
- `node scripts/check-source-organization.mjs` passed.

### IPC / preload / main boundaries

Pass.

- Native Stage render metrics use the aggregate `RuntimePlayerStageRenderMetricsSnapshot` contract at `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:4`.
- Main validates Stage metrics before storing/forwarding them at `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:119` through `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:126`.
- Browser Source client messages parse optional render metrics through validation at `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.ts:56` through `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.ts:59`.
- Control receives native metrics via `getRenderMetrics` / `onRenderMetricsChanged` only, not raw live frames, at `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:196` and `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:205`.

### Diagnostics placement / raw diagnostics separation

Pass.

- `Performance Diagnostics` is appended after Stage in navigation, preserving low priority (`apps/runtime-player/src/control/control-window-shell.tsx:23`).
- The raw input diagnostics panel is suppressed on Performance Diagnostics (`apps/runtime-player/src/control/control-window-app.tsx:595` through `apps/runtime-player/src/control/control-window-app.tsx:600`).

### Forbidden scope

Pass.

No evidence of Runtime Export format changes, Editor app changes, WebGL cache redesign, graph cache, interpolation/throttling work, Spout, or OBS automation in the reviewed Domain B files. The changed implementation remains in Runtime Player diagnostics, Stage metrics transport, Browser Source aggregate diagnostics, and tests.

## Verification Performed

- Read basis/policy docs:
  - `discussion/runtime-player/implementation/orchestration/player-wave13-plan.md`
  - `discussion/runtime-player/screens/control-window-screen-structure.md`
  - `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/dependency-policy.md`
  - `discussion/development_convention/operation-policy.md`
- Inspected changed Runtime Player diagnostics, preload, main, Browser Source, Stage renderer, and tests directly.
- Ran `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts`: 9 files / 68 tests passed.
- Ran `pnpm.cmd typecheck`: passed.
- Ran `node scripts/check-source-organization.mjs`: passed.
- Ran `node scripts/check-dependencies.mjs`: passed.
- Confirmed no changed `index.ts`, `package.json`, or `pnpm-lock.yaml` paths by git diff.

## Residual Risks

- Browser Source timing summaries are based on sampled renderer diagnostics snapshots. This is adequate for comparative user evidence, but it is not a full per-frame telemetry stream.
- Native Stage reports metrics on every renderer metrics change. Tests and typecheck pass, but final integration should still perform a manual capture to confirm this diagnostic reporting does not visibly undermine the frame-pacing goal.
- `tmp/report.log` is present as an untracked workspace file during this review; it is outside the implementation source/manifests reviewed here.

## User-decision Points

- None for this fix loop.

## Review Artifact

- `discussion/runtime-player/implementation/waves/wave13/domain-b-design-development-rereview.md`
