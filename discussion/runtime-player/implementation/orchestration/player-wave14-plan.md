# Runtime Player Wave 14 Plan: Runtime Evaluation Cache / Diagnostics Semantics

> Objective: remove the current 10-12fps live-render bottleneck by caching invariant Runtime Export evaluation structures, while making Performance Diagnostics terminology accurately distinguish input receive rate, delivered live frames, applied/evaluated frames, and actual render FPS.

## 1. Status

- Status: Ready to launch.
- Planning gate result: inventory first, then plan.
- Inventory result:
  - `tmp/report.log` showed WebGL render time is small, but `liveRenderInputEvaluationDurationMs` / `scheduledFrameDurationMs` are roughly 75-116ms per applied frame.
  - Browser Source and Native Stage show the same pattern, so the bottleneck is shared runtime evaluation / render input rebuild, not OBS-only or Electron-window-only behavior.
  - Sylph cache-boundary investigation concluded the renderer currently rebuilds normalized runtime graph, render resources, texture source, clipping map, and render scene on every applied live frame.
  - Sylph diagnostics investigation concluded `sourceInputFps` is misleading because Browser Source `sourceFps` currently means latest source-timestamp interval, while `liveMessageCount` reflects delivered live-frame messages.
- Source of truth before implementation:
  - this plan.
  - Sylph cache-boundary and diagnostics-semantics investigation reports from the conversation immediately before Wave14 planning.
  - [player-wave13-plan.md](player-wave13-plan.md)
  - [wave13-final-integration-report.md](../waves/wave13/wave13-final-integration-report.md)
  - [performance-diagnostics.md](../../screens/performance-diagnostics.md)
  - [broadcast-stage-setup-v0.md](../../screens/broadcast-stage-setup-v0.md)
  - [live-controller-page.md](../../screens/live-controller-page.md)
  - [runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md)

## 2. Product Goal

Runtime Player now works end-to-end: real iFacialMocap input, model motion, Body Follow, Stage Motion, Variant switching, OBS Browser Source output, and Performance Diagnostics are all present.

The remaining quality gap is that live rendering is not smooth enough under real model load. Wave14 should address the measured bottleneck directly:

1. Do not reduce live input fidelity by throttling iFacialMocap or Stage Motion first.
2. Do not hide the problem by dropping Browser Source frames deliberately.
3. Stop rebuilding invariant Runtime Export evaluation structures every applied frame.
4. Preserve Browser Source / Native Stage visual parity.
5. Preserve dynamics state, keyform sampling, Variant visibility, clipping, Stage Motion, and sanitized Browser Source boundaries.
6. Make diagnostics names honest so future reports clearly show where frames are received, coalesced, evaluated, and rendered.

This wave is about performance architecture in the Runtime Player Stage evaluation path. It is not a new UX feature wave.

## 3. Accepted Decisions

### 3.1 Primary Problem Framing

The low `renderFps` is caused by expensive live evaluation / render-input build work, not by WebGL draw time.

Observed pattern:

```text
renderDurationMs: small, roughly sub-ms to low-ms
liveRenderInputEvaluationDurationMs: high, roughly 75-116ms
scheduledFrameDurationMs: high, roughly same as evaluation
```

Therefore, the first optimization target is invariant runtime graph / resource rebuild, not GPU draw calls or input throttling.

### 3.2 Cache Boundary

Use a renderer-owned cache keyed by loaded Runtime Export identity plus semantic active Variant selection.

Cacheable data:

- `RuntimeExportRuntimeGraphAdapterResult` or equivalent normalized runtime graph adapter result.
- Texture source / texture page decode result already suitable for Stage rendering.
- model bounds.
- drawable render resource map or template data.
- clipping map.
- stable drawable index map.
- other immutable render-input scaffolding that depends only on Runtime Export + semantic Variant selection.

Do not cache:

- `RuntimeSnapshotDto`.
- `RuntimeStateDto`.
- dynamics state / next state.
- authored parameter values.
- evaluated vertices.
- evaluated opacity.
- evaluated draw order.
- evaluated visibility from keyforms/runtime state.
- keyform samples.

### 3.3 Cache Key

Cache key should include:

- package identity:
  - `packageId`.
  - `packageRevision`.
  - `packageHash` when present.
  - loaded payload identity such as `loadedAtIso` if needed to avoid stale same-revision dev reloads.
- texture/atlas/source metadata or content identity sufficient to distinguish Runtime Export reloads.
- semantic active Variant selection:
  - group ids.
  - selected active variant ids.
  - selection mode/state that affects output.
  - exclude non-semantic timestamps such as `updatedAtIso`.

### 3.4 Invalidation

Invalidate cache on:

- Runtime Export reload.
- active Variant selection semantic change.
- atlas/texture/source change.
- clear/dispose.

Do not invalidate cache on:

- live parameter value changes.
- frame index changes.
- delta time changes.
- previous runtime state / dynamics state changes.
- Stage Motion transform changes.
- manual Stage pan/zoom, Center Model, Reset View.

### 3.5 Diagnostics Semantics

Diagnostics must stop implying that Browser Source input dropped to 27fps when raw live frames are still arriving at about 60fps.

Use these terms:

- `inputReceiveFpsLatest`: raw input packet receive estimate from the input source.
- `inputPacketCount`: input packets counted during the capture.
- `liveFrameMessageFps`: live parameter frame messages delivered to a target renderer.
- `liveFrameMessageCount`: target renderer live-frame message count.
- `appliedLiveFrameFps`: frames actually evaluated/applied after rAF coalescing.
- `appliedLiveFrameCount`: applied/evaluated live-frame count.
- `renderFps`: actual canvas render FPS.
- `renderCount`: actual canvas render count.
- `liveFrameSourceTimestampFpsLatest`: optional Browser Source source-timestamp interval diagnostic; this must not be labeled as input receive FPS.

## 4. Wave Strategy

Domain A and Domain B are mostly independent and can run in parallel if their write scopes stay separated.

### Parallelization Summary

| Domain | Work | Parallel? | Shared-risk files | Notes |
|---|---|---|---|---|
| Domain A | Runtime evaluation cache | Yes with B | `static-stage-canvas-renderer.ts`, runtime-evaluation/stage-renderer files | Main performance fix. Avoid diagnostics label/report churn unless needed for cache metrics. |
| Domain B | Diagnostics semantics cleanup | Yes with A | diagnostics report/page, Browser Source output labels | Should not modify evaluation/cache architecture. |
| Domain C | Final integration, docs alignment, clean review | No, after A+B | maps/reports/docs | Confirms A/B did not diverge and docs match implementation facts. |

### Batch 1

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain A | Runtime evaluation cache | Yes | Owns performance hot path and tests. |
| Domain B | Diagnostics semantics cleanup | Yes | Owns terminology/report/page cleanup. |

### Batch 2

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain C | Final integration / docs alignment / clean review | No | Starts only after A and B pass review or report clear escalation. |

## 5. Domain A: Runtime Evaluation Cache

Suggested subagent name:

```text
runtime-player-wave14-runtime-evaluation-cache
```

### Scope

Implement app-local caching for invariant Runtime Export evaluation structures so Native Stage and Browser Source no longer rebuild the runtime graph/resources on every applied live frame.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts`
- new helper under `apps/runtime-player/src/stage/stage-renderer/`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- focused tests under `apps/runtime-player/src/stage/stage-renderer/**`
- focused tests under `apps/runtime-player/src/stage/runtime-evaluation/**`

Conditional areas:

- `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts` only if adapter construction requires a small pass-through change.
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts` only if cache-hit counters are added. Do not broaden diagnostics semantics in Domain A unless necessary.

### Required Behavior

- Reuse invariant evaluation scaffolding for repeated live frames of the same Runtime Export + semantic Variant selection.
- Preserve per-frame parameter evaluation.
- Preserve dynamics previous/next state behavior.
- Preserve keyform sampling behavior.
- Preserve evaluated drawable vertices, opacity, visibility, draw order, and clipping behavior.
- Preserve Browser Source / Native Stage parity.
- Preserve Wave10 local preview suspension.
- Preserve Wave11 Stage Motion.
- Preserve Wave12 Variant switching.
- Stage Motion/view transform changes must not rebuild runtime graph cache.
- Variant selection semantic changes must produce a new cache entry or invalidate the old one.
- Runtime Export reload must drop stale cache entries.
- Clear/dispose must release cache references.

### Optional Metrics

Add lightweight cache counters only if they help verify behavior and stay local:

- cache hit count.
- cache miss count.
- cache invalidation count.

Do not make metrics noisy or required for normal operation.

### Tests

At minimum, add focused tests for:

- repeated live frames reuse graph/runtime adapter while still updating `nextState`.
- live frame parameter values still change evaluated output.
- dynamics state continues across frames and is not cached as a static value.
- active Variant selection semantic change does not reuse the wrong graph.
- non-semantic Variant timestamp change does not force rebuild if the selection is otherwise identical.
- clear/reload/dispose invalidates cache.
- Stage Motion/view transform does not rebuild graph cache.
- clipping and mask-source visibility remain consistent.
- Browser Source and Native Stage render paths share the same cache-capable behavior.

Escalate if:

- cache requires changing Runtime Export format.
- cache requires moving large parts of `runtime-core`.
- preserving dynamics state conflicts with the cache boundary.
- Variant/clipping behavior cannot be kept deterministic.

## 6. Domain B: Diagnostics Semantics Cleanup

Suggested subagent name:

```text
runtime-player-wave14-diagnostics-semantics
```

### Scope

Rename and restructure Performance Diagnostics terminology so reports and UI no longer conflate raw input receive rate, delivered live frames, applied/evaluated frames, and actual render FPS.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-page.tsx`
- `apps/runtime-player/src/control/**performance-diagnostics*.test.tsx`
- `apps/runtime-player/src/control/browser-source-output-panel.tsx`
- related Browser Source output tests, if present.

Conditional areas:

- `apps/runtime-player/src/stage/browser-source/browser-source-render-metrics.ts` only if field names need small clarification.
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts` only if report fields require contract changes.
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts` only if new/renamed metrics are added.

### Required Behavior

- Report `[Input]` should use `inputReceiveFpsLatest` and `inputPacketCount`.
- Target sections should show:
  - `liveFrameMessageFps`.
  - `liveFrameMessageCount`.
  - `appliedLiveFrameFps`.
  - `appliedLiveFrameCount`.
  - `renderFps`.
  - `renderCount`.
- Browser Source latest source timestamp FPS may remain, but must be labeled as `liveFrameSourceTimestampFpsLatest` or equivalent.
- Do not label Browser Source latest source timestamp FPS as raw input receive FPS.
- Control page labels should not imply Browser Source raw input dropped when only applied/rendered frames are low.
- Browser Source Output panel label should say `Source Timestamp FPS` or `Live Source Timestamp FPS` if it exposes the current `sourceFps`.
- Reports must remain token-safe and privacy-safe.
- Reports must remain copyable and readable.

### Tests

At minimum, add focused tests for:

- a 10s Browser Source capture with:
  - raw input receive around 60fps.
  - delivered live messages around 600.
  - source timestamp latest value around 27fps.
  - rendered/applied frames around 96.
  - coalesced frames around 500.
- report shows delivery around 60fps and render/apply around 10fps.
- report does not call the Browser Source source timestamp value raw input FPS.
- UI label changes in Performance Diagnostics page.
- UI label changes in Browser Source Output panel.
- privacy exclusions still hold.

Escalate if:

- existing contract consumers require backward-compatible field names that would make report text unclear.
- deriving applied/evaluated FPS from available counters is ambiguous.

## 7. Domain C: Final Integration / Docs Alignment / Clean Review

Suggested subagent name:

```text
runtime-player-wave14-final-integration-performance-cache
```

### Scope

Run after Domain A and B complete and their reviews pass or escalate.

### Required Behavior

- Confirm runtime evaluation cache is implemented at the accepted boundary.
- Confirm no dynamics/keyform/Variant/clipping behavior was accidentally cached as static output.
- Confirm Browser Source and Native Stage share the improvement.
- Confirm Diagnostics terminology now distinguishes input receive, live message delivery, applied/evaluated frames, and rendered frames.
- Confirm no raw tracking/calibration/private/token data is exposed.
- Confirm Wave10 native local preview suspension is preserved.
- Confirm Wave11 Stage Motion is preserved.
- Confirm Wave12 Variant switching is preserved.
- Write Wave14 reports and reviews under:
  - `discussion/runtime-player/implementation/waves/wave14/`
  - `discussion/runtime-player/implementation/reviews/wave14/`

Docs/maps to update as implementation facts require:

- [performance-diagnostics.md](../../screens/performance-diagnostics.md)
- [broadcast-stage-setup-v0.md](../../screens/broadcast-stage-setup-v0.md), only if Browser Source behavior wording changes.
- [runtime-player-backlog.md](../../backlog/runtime-player-backlog.md), if performance follow-up items are closed or deferred.
- runtime-player maps.

The final integration scope must include:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

## 8. Acceptance Criteria

- Native Stage live rendering no longer spends tens of milliseconds rebuilding invariant runtime graph/resource structures per applied frame.
- Browser Source live rendering receives the same cache benefit.
- `liveRenderInputEvaluationDurationMs` and `scheduledFrameDurationMs` are materially reduced for the user's real model, or the final report explains exactly which remaining sub-step is still dominant.
- WebGL render duration remains low and does not regress materially.
- Dynamics continue to update over time.
- Keyforms continue to evaluate correctly.
- Variant switching continues to work in Native Stage and Browser Source.
- Clipping/mask behavior remains correct.
- Stage Motion and manual Stage pan/zoom do not invalidate runtime evaluation cache.
- Browser Source remains sanitized and model-only.
- Performance Diagnostics report clearly separates:
  - raw input receive FPS.
  - live frame message FPS/count.
  - applied/evaluated frame FPS/count.
  - render FPS/count.
  - Browser Source latest source timestamp FPS, if shown.
- Reports remain safe to copy into chat.
- Focused tests and typecheck pass, or failures are classified with concrete evidence.
- No `pnpm install` is run by agents.

## 9. Verification Matrix

| Area | Verification |
|---|---|
| Cache behavior | Tests prove repeated live frames reuse invariant graph/cache while per-frame output and dynamics still change. |
| Variant behavior | Tests prove semantic Variant changes invalidate or switch cache correctly. |
| Stage Motion | Tests/evidence prove Stage Motion/view transform does not rebuild graph cache and still affects display transform. |
| Native Stage | Focused tests plus manual diagnostics capture after implementation. |
| Browser Source | Focused tests plus user OBS Browser Source diagnostics capture. |
| Diagnostics semantics | Report/page tests for input receive vs live message vs applied/evaluated vs render FPS labels. |
| Privacy | Existing report safety tests remain valid; no token/raw tracking/calibration/private path leakage. |
| Regression | Runtime Player focused Vitest and typecheck. |

## 10. Manual Check Notes

The final report should ask the user to check:

- Open Runtime Player with the real Runtime Export.
- Connect iFacialMocap.
- Connect OBS Browser Source.
- Run Performance Diagnostics with target `Both`.
- Confirm Native Stage is suspended while Browser Source is connected.
- Confirm Browser Source remains visible in OBS.
- Confirm model motion feels smoother.
- Copy the report to `tmp/report.log`.
- Compare:
  - `inputReceiveFpsLatest`.
  - `liveFrameMessageFps`.
  - `appliedLiveFrameFps`.
  - `renderFps`.
  - `liveRenderInputEvaluationDurationMs`.
  - `scheduledFrameDurationMs`.
- Toggle Variant selection and confirm Browser Source / Stage output updates.
- Confirm Stage Motion still applies left/right/depth offset when enabled.

## 11. Out of Scope

- Runtime Export format changes.
- Editor changes.
- iFacialMocap input throttling.
- Stage Motion semantics changes.
- Body Follow semantics changes.
- Dynamics algorithm changes.
- WebGL renderer rewrite.
- binary websocket protocol.
- texture/base64 protocol redesign.
- Spout2.
- OBS automation.
- new dependencies.
- `pnpm install`.

## 12. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep implementation scoped to Runtime Player.
- Preserve Browser Source as the primary broadcast path.
- Preserve Wave10 native local preview suspension.
- Preserve Wave11 Stage Motion.
- Preserve Wave12 Live Controller Variant switching.
- Do not expose raw tracking/debug/calibration data in diagnostics or Browser Source messages.
- Do not change Runtime Export format.
- Do not add dependencies or edit lockfile.
- Do not perform broad WebGL renderer rewrites.
- Do not revert unrelated or concurrent changes.
- Add focused tests where behavior is deterministic.
- If a shared file must be touched outside the domain's expected scope, report it before broadening.

## 13. Review Policy

Each implementation domain needs the usual review lanes:

- spec compliance.
- design/development compliance.
- test adequacy.

Reviewers must specifically check:

- cache does not freeze dynamics, keyforms, visibility, draw order, clipping, or evaluated vertices.
- cache invalidation covers Runtime Export reload and semantic Variant selection change.
- Stage Motion/view transform does not trigger unnecessary graph rebuild.
- Browser Source and Native Stage remain behaviorally aligned.
- diagnostics labels no longer conflate input receive FPS with Browser Source source timestamp FPS.
- diagnostics report remains safe to share.
- no Runtime Export format or Browser Source privacy boundary was widened.

## 14. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave14 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.

Required assignment sentence:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

No parent may pass the wave gate while a child is incomplete, running, or unresolved.
