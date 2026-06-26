# Performance Diagnostics

> Wave13で追加され、Wave14でdiagnostics terminologyが整理されたRuntime Player Control Windowの低優先度diagnostics page。目的は、native StageとOBS Browser Source相当のBrowser Source rendererから、frame pacingとrender metricsの安全なreportを採取すること。

## 1. Status

- Status: Wave18 source/test facts, Domain C documentation alignment, and Domain A/B reviews are reflected; manual real-model OBS Browser Source diagnostics are still pending.
- Scope owner: Control Window page plus renderer metrics surfaces.
- Related docs:
  - [control-window-screen-structure.md](control-window-screen-structure.md)
  - [broadcast-stage-setup-v0.md](broadcast-stage-setup-v0.md)
  - [../implementation/orchestration/player-wave13-plan.md](../implementation/orchestration/player-wave13-plan.md)
  - [../implementation/waves/wave13/domain-b-completion-report.md](../implementation/waves/wave13/domain-b-completion-report.md)
  - [../implementation/orchestration/player-wave14-plan.md](../implementation/orchestration/player-wave14-plan.md)
  - [../implementation/waves/wave14/wave14-final-integration-report.md](../implementation/waves/wave14/wave14-final-integration-report.md)
  - [../implementation/orchestration/player-wave15-plan.md](../implementation/orchestration/player-wave15-plan.md)
  - [../implementation/waves/wave15/wave15-final-integration-report.md](../implementation/waves/wave15/wave15-final-integration-report.md)
  - [../implementation/orchestration/player-wave16-plan.md](../implementation/orchestration/player-wave16-plan.md)
  - [../implementation/waves/wave16/wave16-final-integration-report.md](../implementation/waves/wave16/wave16-final-integration-report.md)
  - [../implementation/orchestration/player-wave17-plan.md](../implementation/orchestration/player-wave17-plan.md)
  - [../implementation/waves/wave17/wave17-final-integration-report.md](../implementation/waves/wave17/wave17-final-integration-report.md)
  - [../implementation/orchestration/player-wave18-plan.md](../implementation/orchestration/player-wave18-plan.md)
  - [../implementation/waves/wave18/wave18-final-integration-report.md](../implementation/waves/wave18/wave18-final-integration-report.md)

This page is not the old raw/input diagnostics surface and is not a product deep profiler. It is for lightweight Live Health, FPS, connection, and fast-path proof evidence that can be shared back to agents without exposing private or high-volume data.

## 2. Responsibility

Performance Diagnostics is responsible for:

- selecting capture target: `Native Stage`, `Browser Source`, or `Both`;
- selecting capture duration: `10s` or `30s`;
- starting and stopping a timed capture;
- sampling lightweight input, connection, renderer pacing, and fast-path proof metrics during the capture window;
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
- product runtime-core deep profiling;
- product runtime-core phase timing report output;
- changing Browser Source behavior except lightweight metrics sampling;
- replacing Stage page Browser Source setup controls.

Wave18 intentionally removes product deep runtime-core profiling from this page. Product Start Capture no longer enables runtime-core deep profiling, product reports omit deep runtime-core phase timing fields and `runtimeModelCompileDurationMs` as product-facing timing, and product Stage / Browser Source profiling transport is removed. Runtime-core internal developer/test profiling may remain, but it is not product-reachable through Control, Stage IPC, Browser Source HTTP/WS, or Browser Source client handling.

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
|   Proof: Browser Source clients, fast-path counters, cache counters             |
|--------------------------------------------------------------------------------|
| Comparison Guidance                                                            |
|   Native Stage only -> Browser Source connected -> Stage Motion off/on          |
+--------------------------------------------------------------------------------+
```

The page is intentionally lower priority than Overview / Live Controller / Input / Mapping / Stage. It should be easy to find when debugging smoothness, but should not look like a normal live-operation surface.

## 4. Metrics

Reports should include enough aggregate counters for future agents to reason about live health, connection state, FPS flow, frame pacing, and Wave17 fast-path proof without turning capture into a product deep profiler:

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
- `compiledEvaluatorFrameCount`, `transientCompileCount`, and `transientInstanceCount` so Browser Source live frames can prove whether they used the compiled evaluator without transient fallback;
- `compiledRenderFrameCount` and `publicSnapshotMaterializationCount` so Browser Source live frames can prove whether they used the Wave17 render-frame fast path without public snapshot materialization;
- `scaffoldEvaluationCacheHitCount` / `scaffoldEvaluationCacheMissCount` / `scaffoldEvaluationCacheInvalidationCount` as explicit scaffold cache counters, alongside the legacy `evaluationCache*` names;
- `runtimeModelInstanceCacheHitCount` / `runtimeModelInstanceCacheMissCount` / `runtimeModelInstanceCacheInvalidationCount` so each renderer target can prove target-local `RuntimeModelInstance` reuse;
- canvas size;
- devicePixelRatio;
- Browser Source client count when available;
- Stage Motion enabled state when available;
- diagnostic version.

Input receive FPS, live-frame message FPS/count, applied/evaluated live-frame FPS/count, and render FPS/count must remain separate fields. Browser Source source timestamp interval diagnostics must use `liveFrameSourceTimestampFpsLatest`; it must not be labeled or interpreted as raw input receive FPS. Existing ambiguous transport values such as `fps` or `sourceFps` should not be used as the only performance signal.

Runtime Player normal live rendering keeps snapshot validation skipped for Stage / Browser Source pose evaluation and keeps runtime-core deep profiling disabled. Coarse renderer metrics and lightweight evaluation proof counters remain available in that default state. Product Performance Diagnostics no longer enables deep runtime-core phase sampling.

Wave17 adds a separate render-frame fast path for live Stage / Browser Source rendering:

- Live render-frame evaluation should show `compiledRenderFrameCount > 0`.
- Stable live render-frame evaluation should show `publicSnapshotMaterializationCount: 0`.
- Wave18 makes `publicSnapshotMaterializationCount` a cheap Runtime Player evaluation-profile counter independent of runtime-core deep profiling.
- Copied reports scope render-frame fast-path evidence as lightweight counters, not runtime-core phase timings.

`runtimeModelCompileDurationMs` can remain an internal sanitized renderer metric/sample count where the implementation needs it, but it is not a product-facing timing in copied Performance Diagnostics reports after Wave18.

Healthy Browser Source render-frame fast-path proof after Wave17 should show:

- `compiledEvaluatorFrameCount` increasing with applied live frames;
- `compiledRenderFrameCount` increasing with applied live frames;
- `publicSnapshotMaterializationCount: 0` for stable live render-frame frames;
- `transientCompileCount: 0`;
- `transientInstanceCount: 0`;
- `runtimeModelInstanceCacheHitCount` increasing after the target-local instance is created;
- `runtimeModelInstanceCacheMissCount` and `runtimeModelInstanceCacheInvalidationCount` staying at zero during a stable capture unless the capture window includes payload/Variant changes or renderer reset;
- `scaffoldEvaluationCacheHitCount` increasing on stable scaffold reuse.

## 5. Data Boundaries

Reports and Browser Source messages must exclude:

- raw tracking frames;
- raw head position values;
- calibration internals;
- Browser Source token;
- private file paths;
- full Runtime Export payload;
- Runtime Export texture or mesh contents.

Native Stage metrics travel through the Stage view IPC boundary. Browser Source metrics travel through the Browser Source diagnostics path as sanitized renderer diagnostics/metrics. The report boundary should keep compact aggregate DTOs rather than retaining broad status objects or renderer payloads.

Wave18 removes the Runtime Player product runtime-core profiling control / transport surface. Control Start Capture does not request deep profiling, Stage IPC no longer exposes product profiling mode APIs, Browser Source HTTP/WS no longer sends product profiling mode state, and Browser Source client handling ignores stale product profiling messages. Runtime-core internal developer/test profiling may remain outside this product boundary.

## 6. Relationship To Stage Page

The Stage page remains responsible for:

- Browser Source URL and setup guidance;
- Browser Source server/client/render status;
- Stage Window focus, arrange, bounds, view transform, and local preview/fallback controls;
- Stage Motion controls;
- local preview live rendering suspension status.

Performance Diagnostics reads renderer diagnostics from those systems but does not own their setup or configuration. The Stage page may show current render status, while Performance Diagnostics captures a time-bounded report.

## 7. Manual Verification Still Pending

Manual checks still need a real Runtime Export, real iFacialMocap input, and OBS Browser Source where applicable:

- run a 10s native Stage capture and copy the report;
- connect OBS Browser Source and run Browser Source Performance Diagnostics or target `Both`;
- confirm the act of Performance Diagnostics capture no longer visibly degrades Browser Source smoothness;
- compare `inputReceiveFpsLatest`, `liveFrameMessageFps`, `appliedLiveFrameFps`, `renderFps`, `browserSourceClientCount`, `compiledEvaluatorFrameCount`, `compiledRenderFrameCount`, `publicSnapshotMaterializationCount`, `transientCompileCount`, `transientInstanceCount`, `runtimeModelInstanceCacheHitCount`, `runtimeModelInstanceCacheMissCount`, and `runtimeModelInstanceCacheInvalidationCount`;
- confirm copied product reports omit deep runtime-core phase timings and `runtimeModelCompileDurationMs` as product-facing timing;
- confirm `liveFrameSourceTimestampFpsLatest` is treated only as Browser Source source timestamp interval diagnostics, not raw input receive FPS;
- confirm report includes render counts, transform counts, duplicate transform skips, coalesced live frames, canvas size, and devicePixelRatio when those fields are present in the copied product report;
- toggle Stage Motion off/on and compare reports;
- compare OBS Browser Source custom FPS off/30/60 as a manual observation;
- confirm native Stage and Browser Source still render normally after capture;
- confirm copied report does not include raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, Runtime Export textures, or Runtime Export mesh data;
- save the copied report to `tmp/report.log` if follow-up discussion is needed.

These checks should not be recorded as passed until manually executed.
