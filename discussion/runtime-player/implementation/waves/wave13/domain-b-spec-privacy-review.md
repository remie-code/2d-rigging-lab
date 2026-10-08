# Wave13 Domain B Spec / Behavior / Privacy Review

Date: 2026-06-25
Reviewer: Review-Sylph
Target: Runtime Player Wave13 Domain B - Performance Diagnostics Capture / Report UX

## Verdict

pass

No blocking or needs-fix findings were found for the Domain B spec/privacy rubric.

## Findings

None.

## Evidence

- Domain B scope requires a low-priority Performance Diagnostics entry, timed capture, Copy Report, native Stage and Browser Source metrics, separated source/render FPS, comparative capture guidance, and exclusion of raw/private payloads (`discussion/runtime-player/implementation/orchestration/player-wave13-plan.md:245`, `discussion/runtime-player/implementation/orchestration/player-wave13-plan.md:275`, `discussion/runtime-player/implementation/orchestration/player-wave13-plan.md:281`, `discussion/runtime-player/implementation/orchestration/player-wave13-plan.md:298`, `discussion/runtime-player/implementation/orchestration/player-wave13-plan.md:301`).
- The Control navigation includes `performance-diagnostics` as the last page entry, making it a low-priority Control entry (`apps/runtime-player/src/control/control-window-shell.tsx:8`, `apps/runtime-player/src/control/control-window-shell.tsx:22`).
- The page supports target selection for Native Stage / Both / Browser Source and 10s / 30s timed captures, plus Start, Stop, and Copy Report actions (`apps/runtime-player/src/control/performance-diagnostics-page.tsx:61`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:66`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:250`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:257`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:264`).
- Empty and availability states are user-readable through Target Availability and helper formatters for native Stage, Browser Source, and Stage Motion (`apps/runtime-player/src/control/performance-diagnostics-page.tsx:276`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:365`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:380`).
- Comparative capture guidance is present for native-only, Browser Source connected, Stage Motion off/on, and OBS custom FPS manual observation (`apps/runtime-player/src/control/performance-diagnostics-page.tsx:304`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:208`).
- The report model and formatter include diagnostic version, timestamps/duration, source input FPS, render FPS, rAF/render-duration summaries, live/transform/skip/coalescing counters, Browser Source client count, Stage Motion enabled state, and canvas/DPR (`apps/runtime-player/src/control/performance-diagnostics-report.ts:65`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:151`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:191`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:199`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:337`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:338`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:564`).
- Native Stage metrics are exposed through the stage bridge, validated in main, and reported from the Stage window renderer (`apps/runtime-player/src/preload/performance-diagnostics-contract.ts:4`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:92`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:20`, `apps/runtime-player/src/stage/stage-window-app.tsx:339`).
- Browser Source metrics are included in renderer diagnostics and carried through client message validation/session status into the report (`apps/runtime-player/src/preload/browser-source-transport-contract.ts:123`, `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.ts:41`, `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:440`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:257`).
- Source/input FPS and render FPS are distinct in report aggregation: source comes from input or Browser Source `sourceFps`, while render FPS is computed from render count over capture duration (`apps/runtime-player/src/control/performance-diagnostics-report.ts:161`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:283`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:337`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:338`).
- Copied report text is explicitly formatted rather than raw-stringifying status objects, and the privacy section declares exclusions for raw tracking frames, calibration internals, Browser Source token, private paths, and full Runtime Export payload (`apps/runtime-player/src/control/performance-diagnostics-report.ts:178`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:187`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:213`).
- Privacy tests inject a token URL, raw-frame/calibration-like fields, and a private-looking path, then assert the copied report omits them (`apps/runtime-player/src/control/performance-diagnostics-report.test.ts:229`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:269`).

## Verification Performed

- Inspected the Wave13 basis plan and prior Wave10-Wave12 privacy/Browser Source constraints.
- Inspected the changed Control, preload, main, Stage, and Browser Source files listed in the review request.
- Ran targeted tests:
  - `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
  - Result: 5 files passed, 35 tests passed.
- Ran typecheck:
  - `pnpm.cmd typecheck`
  - Result: passed.

## Residual Risks

- Browser Source rAF/render-duration p50/p95/max are derived from reported renderer diagnostics snapshots. Because Browser Source diagnostics are sampled, these percentiles are useful for comparative evidence but may not represent every rendered frame in a capture.
- The quick Target Availability summary's Render FPS displays the native Stage report value; Browser Source render FPS is still present in the full report preview, but the summary is less informative after a Browser Source-only capture.
- OBS custom FPS remains a manual observation, as allowed by the Wave13 plan.

## User-Decision Points

None for Domain B acceptance. Future UX polish could choose whether to add a per-target summary row for Browser Source render FPS, but this is not required for the current spec/privacy gate.
