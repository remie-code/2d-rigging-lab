# Performance Diagnostics

> Wave13で追加され、Wave14でdiagnostics terminologyが整理されたRuntime Player Control Windowの低優先度diagnostics page。目的は、native StageとOBS Browser Source相当のBrowser Source rendererから、frame pacingとrender metricsの安全なreportを採取すること。

## 1. Status

- Status: Wave14 source/test facts and final clean review pass reflected; manual real-model native/OBS diagnostics are still pending.
- Scope owner: Control Window page plus renderer metrics surfaces.
- Related docs:
  - [control-window-screen-structure.md](control-window-screen-structure.md)
  - [broadcast-stage-setup-v0.md](broadcast-stage-setup-v0.md)
  - [../implementation/orchestration/player-wave13-plan.md](../implementation/orchestration/player-wave13-plan.md)
  - [../implementation/waves/wave13/domain-b-completion-report.md](../implementation/waves/wave13/domain-b-completion-report.md)
  - [../implementation/orchestration/player-wave14-plan.md](../implementation/orchestration/player-wave14-plan.md)
  - [../implementation/waves/wave14/wave14-final-integration-report.md](../implementation/waves/wave14/wave14-final-integration-report.md)

This page is not the old raw/input diagnostics surface. It is for render pacing evidence that can be shared back to agents without exposing private or high-volume data.

## 2. Responsibility

Performance Diagnostics is responsible for:

- selecting capture target: `Native Stage`, `Browser Source`, or `Both`;
- selecting capture duration: `10s` or `30s`;
- starting and stopping a timed capture;
- copying a compact report;
- clearing the current report;
- previewing the report inside Control Window;
- showing target availability before and during capture;
- guiding comparison runs, such as native Stage only, Browser Source connected, Stage Motion off/on, and OBS custom FPS off/30/60 as a manual observation.

It is not responsible for:

- raw iFacialMocap frame inspection;
- calibration internals;
- Runtime Export artifact inspection;
- OBS automation or OBS source creation;
- changing renderer behavior while capture is running;
- replacing Stage page Browser Source setup controls.

## 3. Screen Shape

```text
+--------------------------------------------------------------------------------+
| PERFORMANCE DIAGNOSTICS                                                       |
+--------------------------------------------------------------------------------+
| Capture                                                                        |
|   Target:     [ Native Stage | Browser Source | Both ]                         |
|   Duration:   [ 10s | 30s ]                                                     |
|   Availability: Native Stage ready / Browser Source connected                  |
|   [Start Capture] [Stop Capture] [Copy Report] [Clear Report]                  |
|--------------------------------------------------------------------------------|
| Report Preview                                                                 |
|   Captured at: 2026-06-26T...                                                  |
|   Input: inputReceiveFpsLatest, inputPacketCount                               |
|   Native Stage: liveFrameMessageFps, appliedLiveFrameFps, renderFps             |
|   Browser Source: liveFrameSourceTimestampFpsLatest, live/apply/render FPS      |
|   Counters: liveFrameMessageCount, appliedLiveFrameCount, renderCount           |
|   Pacing: rAF delta, render duration, live input evaluation, scheduled frame    |
|--------------------------------------------------------------------------------|
| Comparison Guidance                                                            |
|   Native Stage only -> Browser Source connected -> Stage Motion off/on          |
+--------------------------------------------------------------------------------+
```

The page is intentionally lower priority than Overview / Live Controller / Input / Mapping / Stage. It should be easy to find when debugging smoothness, but should not look like a normal live-operation surface.

## 4. Metrics

Reports should include enough aggregate counters for future agents to reason about low FPS, frame pacing jitter, input jitter, duplicate renders, and render time spikes:

- capture timestamp and requested/actual duration;
- target availability;
- `[Input]` `inputReceiveFpsLatest`;
- `[Input]` `inputPacketCount`;
- per-target `liveFrameMessageFps`;
- per-target `liveFrameMessageCount`;
- per-target `appliedLiveFrameFps`;
- per-target `appliedLiveFrameCount`;
- per-target `renderFps`;
- per-target `renderCount`;
- Browser Source `liveFrameSourceTimestampFpsLatest` when available;
- scheduled render count;
- immediate render count;
- Stage view/display transform counts;
- duplicate transform skip count;
- coalesced live frame count;
- rAF delta p50 / p95 / max;
- render duration p50 / p95 / max;
- `liveRenderInputEvaluationDurationMs` p50 / p95 / max;
- `scheduledFrameDurationMs` p50 / p95 / max;
- canvas size;
- devicePixelRatio;
- Browser Source client count when available;
- Stage Motion enabled state when available;
- diagnostic version.

Input receive FPS, live-frame message FPS/count, applied/evaluated live-frame FPS/count, and render FPS/count must remain separate fields. Browser Source source timestamp interval diagnostics must use `liveFrameSourceTimestampFpsLatest`; it must not be labeled or interpreted as raw input receive FPS. Existing ambiguous transport values such as `fps` or `sourceFps` should not be used as the only performance signal.

## 5. Data Boundaries

Reports must exclude:

- raw tracking frames;
- raw head position values;
- calibration internals;
- Browser Source token;
- private file paths;
- full Runtime Export payload;
- Runtime Export texture or mesh contents.

Native Stage metrics travel through the Stage view IPC boundary. Browser Source metrics travel through the Browser Source diagnostics path as sanitized renderer diagnostics/metrics. The report boundary should keep compact aggregate DTOs rather than retaining broad status objects or renderer payloads.

## 6. Relationship To Stage Page

The Stage page remains responsible for:

- Browser Source URL and setup guidance;
- Browser Source server/client/render status;
- Stage Window focus, arrange, bounds, view transform, and local preview/fallback controls;
- Stage Motion controls;
- local preview live rendering suspension status.

Performance Diagnostics reads renderer diagnostics from those systems but does not own their setup or configuration. The Stage page may show current render status, while Performance Diagnostics captures a time-bounded report.

## 7. Manual Verification Still Pending

Manual checks still need a real Runtime Export, real input, and OBS Browser Source where applicable:

- run a 10s native Stage capture and copy the report;
- connect OBS Browser Source and run target `Both`;
- compare `inputReceiveFpsLatest`, `liveFrameMessageFps`, `appliedLiveFrameFps`, `renderFps`, `liveRenderInputEvaluationDurationMs`, and `scheduledFrameDurationMs`;
- confirm `liveFrameSourceTimestampFpsLatest` is treated only as Browser Source source timestamp interval diagnostics, not raw input receive FPS;
- confirm report includes rAF delta, render duration, render counts, transform counts, duplicate transform skips, coalesced live frames, canvas size, and devicePixelRatio;
- toggle Stage Motion off/on and compare reports;
- compare OBS Browser Source custom FPS off/30/60 as a manual observation;
- confirm native Stage and Browser Source still render normally after capture;
- confirm copied report does not include raw tracking frames, calibration internals, Browser Source token, private paths, or full Runtime Export payload.

These checks should not be recorded as passed until manually executed.
