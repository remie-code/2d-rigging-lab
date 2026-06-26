# Performance Diagnostics

> Wave13で追加され、Wave14でdiagnostics terminologyが整理されたRuntime Player Control Windowの低優先度diagnostics page。目的は、native StageとOBS Browser Source相当のBrowser Source rendererから、frame pacingとrender metricsの安全なreportを採取すること。

## 1. Status

- Status: Wave17 source/test facts, Domain E final integration, and final Wave17 integration reviews are reflected; manual real-model OBS Browser Source diagnostics are still pending.
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

This page is not the old raw/input diagnostics surface. It is for render pacing evidence that can be shared back to agents without exposing private or high-volume data.

## 2. Responsibility

Performance Diagnostics is responsible for:

- selecting capture target: `Native Stage`, `Browser Source`, or `Both`;
- selecting capture duration: `10s` or `30s`;
- starting and stopping a timed capture;
- requesting deep runtime-core profiling for the selected capture target while capture is active, so runtime-core phase summaries can be measured intentionally;
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
- changing normal live renderer defaults outside the capture window;
- replacing Stage page Browser Source setup controls.

Wave15 intentionally makes the capture window observable: Performance Diagnostics can request deep runtime-core profiling for the selected target, and that may add measurement overhead while capture is active. This is the exception to normal live behavior, not a new default for Runtime Player rendering.

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
- `compiledEvaluatorFrameCount`, `transientCompileCount`, and `transientInstanceCount` so Browser Source live frames can prove whether they used the compiled evaluator without transient fallback;
- `compiledRenderFrameCount`, `publicSnapshotMaterializationCount`, and `runtimeCoreRenderFrameOutputDurationMs` so Browser Source live frames can prove whether they used the Wave17 render-frame fast path without public snapshot materialization;
- `scaffoldEvaluationCacheHitCount` / `scaffoldEvaluationCacheMissCount` / `scaffoldEvaluationCacheInvalidationCount` as explicit scaffold cache counters, alongside the legacy `evaluationCache*` names;
- `runtimeModelInstanceCacheHitCount` / `runtimeModelInstanceCacheMissCount` / `runtimeModelInstanceCacheInvalidationCount` so each renderer target can prove target-local `RuntimeModelInstance` reuse;
- `runtimeModelCompileDurationMs` as a scaffold-build/cold-path latest metric sampled only when Runtime Player builds a scaffold on cache miss;
- `runtimeCoreEvaluationDurationMs` p50 / p95 / max;
- runtime-core phase summaries when deep profiling is active, including `runtimeCoreSnapshotCreationDurationMs`, `runtimeCoreDrawableSnapshotCreationDurationMs`, `runtimeCoreDeformerHierarchyEvaluationDurationMs`, `runtimeCoreWarpDeformerVertexTransformDurationMs`, and `runtimeCoreSnapshotValidationDurationMs`;
- `renderInputDrawableMappingDurationMs` for the compatibility source field `snapshotToRenderDrawableDurationMs`, scoped as render input mapping rather than public snapshot materialization;
- `scheduledFrameDurationMs` p50 / p95 / max;
- canvas size;
- devicePixelRatio;
- Browser Source client count when available;
- Stage Motion enabled state when available;
- diagnostic version.

Input receive FPS, live-frame message FPS/count, applied/evaluated live-frame FPS/count, and render FPS/count must remain separate fields. Browser Source source timestamp interval diagnostics must use `liveFrameSourceTimestampFpsLatest`; it must not be labeled or interpreted as raw input receive FPS. Existing ambiguous transport values such as `fps` or `sourceFps` should not be used as the only performance signal.

Runtime Player normal live rendering keeps snapshot validation skipped for Stage / Browser Source pose evaluation and keeps deep runtime-core profiling disabled. Coarse render and evaluation metrics remain available in that default state. Deep runtime-core phase details are intentionally enabled only while Performance Diagnostics capture requests them for the selected target.

If no live render evaluation happens during a deep capture window, runtime-core phase summaries can legitimately show `sampleCount=0` and `p50=unknown`, `p95=unknown`, or `max=unknown`. That means no deep-profiled runtime-core samples were observed, not necessarily that the renderer failed.

Wave16 changed the runtime-core phase interpretation when Runtime Player uses the compiled evaluator:

- `runtimeCoreSnapshotCreationDurationMs` remains the outer per-frame snapshot creation phase.
- `runtimeCoreDrawableSnapshotCreationDurationMs` now measures per-frame public drawable DTO materialization/finalization from compiled templates on the compiled path; one-time graph-derived drawable, texture/UV, reference vertex, and mask template construction is outside the cached frame hot path.
- `runtimeCoreDeformerHierarchyEvaluationDurationMs` now measures per-frame rig-control samples, evaluated state, frame-dependent parent selection, opacity/effect-chain application, and drawable transforms on the compiled path; one-time hierarchy/topology lookup construction is outside the cached frame hot path.
- `runtimeCoreWarpDeformerVertexTransformDurationMs` remains a per-frame vertex transform measurement.

Wave17 adds a separate render-frame fast path for live Stage / Browser Source rendering:

- Live render-frame evaluation should show `compiledRenderFrameCount > 0`.
- Stable live render-frame evaluation should show `publicSnapshotMaterializationCount: 0`.
- `runtimeCoreRenderFrameOutputDurationMs` measures render-frame output construction.
- `runtimeCoreSnapshotCreationDurationMs` and `runtimeCoreDrawableSnapshotCreationDurationMs` are public snapshot path/deep-profile metrics. For live render-frame frames they should be absent, zero, unknown, not sampled, or clearly marked as public-snapshot-path-only.
- Copied reports scope render-frame fast-path metrics separately from public snapshot path metrics.
- Copied reports print `renderInputDrawableMappingDurationMs` for the compatibility source field `snapshotToRenderDrawableDurationMs`.

`runtimeModelCompileDurationMs` is a Runtime Player scaffold build profile field exposed in copied reports as `scaffoldBuildSampleCount`, `latest`, and `scope=scaffold-build-cold-path`. This is a cache-miss/scaffold-build fact, not a per-frame runtime-core phase. A stable live Browser Source capture can therefore show `runtimeModelCompileDurationMs` from the latest scaffold build while still showing per-frame `renderInputScaffoldBuildDurationMs` near zero on scaffold cache hits.

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

Native Stage metrics travel through the Stage view IPC boundary. Browser Source metrics travel through the Browser Source diagnostics path as sanitized renderer diagnostics/metrics. The report boundary should keep compact aggregate DTOs rather than retaining broad status objects or renderer payloads. Wave15 runtime-core profiling control messages carry only sanitized detail state such as `disabled` / `deep`, not raw model, tracking, calibration, token, path, texture, or mesh data.

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
- connect OBS Browser Source and run target `Both`;
- run a normal/default Performance Diagnostics capture if that mode is exposed by the build, and run a deep Performance Diagnostics capture; in the current Wave17 implementation, Start Capture intentionally requests deep runtime-core profiling for the selected target;
- compare `inputReceiveFpsLatest`, `liveFrameMessageFps`, `appliedLiveFrameFps`, `renderFps`, `compiledEvaluatorFrameCount`, `compiledRenderFrameCount`, `publicSnapshotMaterializationCount`, `transientCompileCount`, `transientInstanceCount`, `runtimeModelInstanceCacheHitCount`, `runtimeModelInstanceCacheMissCount`, `runtimeModelInstanceCacheInvalidationCount`, `runtimeModelCompileDurationMs`, `liveRenderInputEvaluationDurationMs`, `runtimeCoreRenderFrameOutputDurationMs`, `runtimeCoreEvaluationDurationMs`, `runtimeCoreSnapshotCreationDurationMs`, `runtimeCoreDrawableSnapshotCreationDurationMs`, `runtimeCoreDeformerHierarchyEvaluationDurationMs`, `runtimeCoreWarpDeformerVertexTransformDurationMs`, `renderInputDrawableMappingDurationMs`, `renderDurationMs`, `scheduledFrameDurationMs`, and other runtime-core phase fields;
- for the Wave17 fast-path comparison, specifically compare before/after `renderFps`, `appliedLiveFrameFps`, `compiledRenderFrameCount`, `publicSnapshotMaterializationCount`, `runtimeCoreRenderFrameOutputDurationMs`, `runtimeCoreEvaluationDurationMs`, `runtimeCoreSnapshotCreationDurationMs`, `runtimeCoreDrawableSnapshotCreationDurationMs`, `runtimeCoreDeformerHierarchyEvaluationDurationMs`, `runtimeCoreWarpDeformerVertexTransformDurationMs`, and `renderDurationMs`;
- compare normal live/default behavior before and after capture to confirm deep profiling is disabled when capture stops;
- confirm `runtimeCoreSnapshotValidationDurationMs` is zero, unknown, or near-zero outside intentional deep/schema diagnostics;
- confirm deep captures include runtime-core phase summaries when live render evaluation happens, and treat `unknown` / `sampleCount=0` as valid when no deep-profiled live frame is observed;
- confirm `liveFrameSourceTimestampFpsLatest` is treated only as Browser Source source timestamp interval diagnostics, not raw input receive FPS;
- confirm report includes rAF delta, render duration, render counts, transform counts, duplicate transform skips, coalesced live frames, canvas size, and devicePixelRatio;
- toggle Stage Motion off/on and compare reports;
- compare OBS Browser Source custom FPS off/30/60 as a manual observation;
- confirm native Stage and Browser Source still render normally after capture;
- confirm copied report does not include raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, Runtime Export textures, or Runtime Export mesh data;
- save the copied report to `tmp/report.log` for follow-up comparison.

These checks should not be recorded as passed until manually executed.
