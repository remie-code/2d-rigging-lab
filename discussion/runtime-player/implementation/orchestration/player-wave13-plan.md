# Runtime Player Wave 13 Plan: Stage Frame Pacing Diagnostics

> Objective: improve perceived smoothness in Runtime Player Stage rendering by unifying live-frame and transform invalidation through a shared rAF render path, while adding Performance Diagnostics so the user can capture evidence from native Stage and OBS Browser Source.

## 1. Status

- Status: Ready to launch.
- Planning gate result: plan directly.
- Inventory result:
  - Two read-only Sylph investigations concluded `measure_first`.
  - Both investigations found a credible low-risk quick-fix candidate around Stage transform rendering.
  - Native Stage and Browser Source both use the shared `StaticStageCanvasRenderer`.
  - Live parameter frames already render through `requestAnimationFrame` coalescing.
  - Stage view/display transform updates currently call immediate render paths.
  - The user confirmed the less-smooth feeling is reproducible in native Stage when Browser Source is not connected.
- Source of truth before implementation:
  - this plan.
  - Sylph performance/smoothness investigation reports from the conversation immediately before Wave13 planning.
  - [player-wave10-plan.md](player-wave10-plan.md)
  - [player-wave11-plan.md](player-wave11-plan.md)
  - [player-wave12-plan.md](player-wave12-plan.md)
  - [broadcast-stage-setup-v0.md](../../screens/broadcast-stage-setup-v0.md)
  - [control-window-screen-structure.md](../../screens/control-window-screen-structure.md)
  - [runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md)

## 2. Product Goal

Runtime Player is functionally complete. The remaining quality gap is perceived smoothness: the model can feel less fluid than expected even when the system appears to be running.

Wave13 should not chase a broad renderer rewrite. It should make the current rendering path easier to reason about and easier to measure:

1. Native Stage and Browser Source should no longer mix two independent render rhythms for live pose and Stage transform updates.
2. Live parameter updates and Stage view/display transform updates should converge into the next shared rAF render where practical.
3. Duplicate unchanged Stage transforms should not cause extra render work.
4. The user should have a Performance Diagnostics page to capture a report and share it back for analysis.

This wave is about frame pacing and diagnosis. It is not about increasing model expressiveness, changing mapping physics, or rewriting WebGL.

## 3. Accepted Decisions

### 3.1 Primary Problem Framing

The target issue is not simply "low FPS".

Wave13 treats the problem as:

- frame pacing inconsistency;
- immediate transform render competing with rAF-coalesced live-frame render;
- duplicate transform update/render work;
- lack of measurements that distinguish source/input FPS from actual render FPS.

### 3.2 Scope

Wave13 includes:

- shared `StaticStageCanvasRenderer` frame pacing improvements;
- duplicate Stage transform suppression;
- rAF-unified render invalidation for live frames and Stage view/display transforms where safe;
- source FPS vs actual render FPS diagnostics;
- native Stage and Browser Source render counters;
- a `Performance Diagnostics` page in Control Window;
- `Start Capture`, timed capture, `Copy Report`, and clear/manual-reset behavior;
- docs alignment and final clean review.

Wave13 excludes:

- WebGL persistent buffer/cache redesign.
- runtime graph cache.
- physics / body follow smoothing semantics changes.
- server-side frame throttling/resampling.
- input interpolation.
- Spout2.
- OBS automation.
- Browser Source protocol redesign.
- binary websocket protocol.
- texture payload protocol changes.

### 3.3 Diagnostics UX

Add a diagnostic surface, not a normal live-operation surface.

Recommended shape:

```text
Performance Diagnostics

Capture
  Target: Native Stage / Browser Source / Both
  Duration: 10s / 30s
  [Start Capture] [Copy Report]

Summary
  Actual render FPS
  Source/input FPS
  rAF delta p50 / p95 / max
  Render duration p50 / p95 / max
  Stage transform messages
  Duplicate transform skips
  Immediate render count
  Coalesced live frames
  Browser Source clients

Notes
  Stage Motion: On/Off
  Browser Source connected: Yes/No
  Canvas size / devicePixelRatio
```

UX requirements:

- This page should not be visible as a high-priority live control.
- It may be a new Control Window page or a subpage under diagnostics/settings, whichever best fits existing navigation.
- The user must be able to copy a compact report into `tmp/player-performance.log` or chat.
- The report should be human-readable enough to inspect quickly, but structured enough for future agents.
- It must not include raw tracking frames, calibration internals, private file paths, or tokens.

### 3.4 Low-Risk Fixes Included

Wave13 may include low-risk fixes before full measurement, because the repository facts already point to avoidable render duplication:

- ignore unchanged `StageViewTransform` / display transform updates;
- avoid immediate `renderCurrent()` from transform setters where a scheduled rAF render can safely cover the update;
- merge live-frame and transform invalidation into a single render on the next animation frame;
- keep explicit immediate render only for operations that truly need synchronous visual update, if any are identified.

All behavior must preserve:

- manual Stage pan/zoom responsiveness;
- Center Model / Reset View correctness;
- Stage Motion visual effect;
- Browser Source parity;
- Wave10 native preview suspension behavior.

### 3.5 Measurement Interpretation

Diagnostics should distinguish:

- `sourceFps`: incoming live parameter frame cadence.
- `renderFps`: actual canvas render cadence.
- `rafDeltaMs`: browser repaint cadence/pacing.
- `renderDurationMs`: time spent building/evaluating/rendering one frame.
- `stageTransformMessageRate`: transform update cadence.
- `duplicateTransformSkipCount`: avoided work.
- `coalescedLiveFrameCount`: input frames superseded before render.

Existing Browser Source `fps` must not remain ambiguous if touched. Prefer reporting source FPS and render FPS separately.

## 4. Wave Strategy

Use a sequential chain. The renderer frame pacing change is the foundation; diagnostics should measure the final renderer behavior.

### Batch 1

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain A | Shared Stage renderer frame pacing foundation | No | Changes `StaticStageCanvasRenderer` behavior and focused tests. |

### Batch 2

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain B | Performance Diagnostics capture/report UX | No, after A | Depends on stable metrics emitted by the shared renderer and Browser Source/native Stage paths. |

### Batch 3

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain C | Final integration, docs alignment, clean review | No, after B | Confirms no broad renderer rewrite, docs alignment, and manual measurement instructions. |

## 5. Domain A: Shared Stage Renderer Frame Pacing Foundation

Suggested subagent name:

```text
runtime-player-wave13-stage-frame-pacing-foundation
```

### Scope

Improve the shared Stage renderer invalidation model so native Stage and Browser Source no longer render immediately from transform setters when a rAF-coalesced render is enough.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer*.test.ts`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts`
- focused tests under `apps/runtime-player/src/stage/**`

Conditional areas:

- `apps/runtime-player/src/main/broadcast-source/**` only if duplicate transform suppression is cleaner on the publisher side.
- `apps/runtime-player/src/preload/**` only if metrics contracts need small additions for Domain B.

### Required Behavior

- Add a single render scheduling path for live frame and transform invalidation.
- `setLiveParameterFrame()` still coalesces to rAF.
- `setViewTransform()` and `setDisplayViewTransform()` should avoid immediate extra render when a scheduled render can represent the final state.
- Unchanged view/display transforms should be ignored or deduped.
- Manual pan/zoom must remain responsive.
- Center Model / Reset View must still render correctly.
- Stage Motion updates must still render correctly.
- Native Stage and Browser Source should share the same renderer behavior.
- Existing Browser Source render/update path must remain model-only and token-safe.
- Wave10 local preview suspension must not regress.

### Metrics Hooks

Add low-level hooks or counters if needed for Domain B:

- render count.
- scheduled render count.
- immediate render count, ideally reduced or isolated.
- duplicate transform skip count.
- coalesced live frame count.
- rAF delta timing.
- render duration timing.

The metrics implementation should be lightweight and off the hot path as much as practical when diagnostics are not active.

### Tests

At minimum, add focused tests for:

- multiple live frames before rAF cause one render.
- live frame plus transform update before rAF cause one final render.
- duplicate transform update does not render.
- display transform update is represented in the next render.
- manual view transform change still reports/updates correctly.
- reset/center operations still render.
- live suspension behavior is preserved.
- Browser Source client still applies stage display state.
- no `pnpm install`.

Escalate if:

- avoiding immediate transform render would break Stage pan/zoom interaction in a way that cannot be fixed locally.
- Browser Source and native Stage require incompatible renderer semantics.
- a broad WebGL renderer refactor becomes necessary.

## 6. Domain B: Performance Diagnostics Capture / Report UX

Suggested subagent name:

```text
runtime-player-wave13-performance-diagnostics
```

### Dependency

Start after Domain A passes and exposes stable metric hooks.

### Scope

Add a user-facing diagnostics path so the user can capture smoothness/performance evidence and send it back.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/control/control-window-shell.tsx`
- new or existing `apps/runtime-player/src/control/performance-diagnostics-page.tsx`
- `apps/runtime-player/src/control/**.test.tsx`
- `apps/runtime-player/src/preload/**`
- `apps/runtime-player/src/main/**`
- `apps/runtime-player/src/main/broadcast-source/**`
- `apps/runtime-player/src/stage/**`

### Required Behavior

- Add a `Performance Diagnostics` page or equivalent low-priority diagnostics entry.
- Allow the user to capture a timed report.
- Support at least native Stage measurements.
- Include Browser Source metrics when a Browser Source client is connected and reports metrics.
- Provide `Copy Report`.
- Report should include:
  - capture timestamp and duration.
  - target availability.
  - source/input FPS.
  - render FPS.
  - rAF delta p50/p95/max.
  - render duration p50/p95/max.
  - live message count.
  - stage display/transform message count.
  - duplicate transform skip count.
  - coalesced live frame count.
  - Browser Source client count.
  - Stage Motion enabled state if available.
  - canvas size and devicePixelRatio where available.
  - diagnostic version.
- Report must exclude:
  - raw tracking frames.
  - calibration internals.
  - Browser Source token.
  - private file paths.
  - full Runtime Export payload.
- UI should make it easy to run comparative captures:
  - native Stage only.
  - Browser Source connected.
  - Stage Motion off/on.
  - OBS Browser Source custom FPS off/30/60 manually, documented as manual observation.

### Tests

At minimum, add focused tests for:

- diagnostics page appears in Control navigation.
- capture start/stop lifecycle.
- report aggregation from native Stage metrics.
- report aggregation from Browser Source metrics when present.
- Copy Report payload excludes tokens/raw tracking/private paths.
- empty/no-stage/no-browser-source states are understandable.
- source FPS and render FPS are distinct fields.
- no `pnpm install`.

Escalate if:

- metrics require sending raw tracking data to Control or Browser Source.
- diagnostics page would require a broad Control architecture refactor.
- Browser Source cannot report render metrics without breaking model-only output.

## 7. Domain C: Final Integration / Docs Alignment / Clean Review

Suggested subagent name:

```text
runtime-player-wave13-final-integration-frame-pacing
```

### Scope

Run after Domain A and B complete and reviews pass or fixes are resolved.

### Required Behavior

- Verify native Stage and Browser Source use the shared frame pacing model.
- Verify transform updates no longer create avoidable immediate duplicate renders.
- Verify diagnostics expose enough information for the user to send logs back.
- Verify diagnostics report separates source FPS from render FPS.
- Verify no raw tracking/debug/calibration/private data leaks in reports.
- Verify Wave10 native preview suspension is preserved.
- Verify Wave11 Stage Motion still works.
- Verify Wave12 Variant switching still works.
- Verify docs/maps match implementation facts.
- Write Wave13 reports and reviews under:
  - `discussion/runtime-player/implementation/waves/wave13/`
  - `discussion/runtime-player/implementation/reviews/wave13/`

Docs to update as implementation facts require:

- [broadcast-stage-setup-v0.md](../../screens/broadcast-stage-setup-v0.md)
- [control-window-screen-structure.md](../../screens/control-window-screen-structure.md)
- [runtime-player-backlog.md](../../backlog/runtime-player-backlog.md)
- a new performance diagnostics screen doc if useful.
- runtime-player maps.

The final integration scope must include:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

## 8. Acceptance Criteria

- Live frame and Stage transform invalidation use a shared rAF-coalesced render path where practical.
- Duplicate unchanged Stage view/display transforms do not cause extra renders.
- Native Stage remains responsive to pan/zoom, center, reset, Stage Motion, and live input.
- Browser Source remains visually in sync with native Stage behavior.
- Browser Source remains model-only and does not expose raw tracking/debug/calibration data.
- Existing Browser Source status/output remains functional.
- Wave10 local preview suspension remains functional.
- Wave11 Stage Motion still applies.
- Wave12 Variant switching still applies.
- Performance Diagnostics page or equivalent exists.
- User can run a timed capture and copy a report.
- Report distinguishes source FPS from render FPS.
- Report includes enough counters to identify low FPS, frame pacing jitter, input jitter, duplicate renders, and render time spikes.
- Report excludes tokens, raw tracking frames, calibration internals, private paths, and full Runtime Export payloads.
- Focused tests and typecheck pass, or failures are classified with concrete evidence.
- No `pnpm install` is run by agents.

## 9. Verification Matrix

| Area | Verification |
|---|---|
| Renderer invalidation | Tests for live+transform coalescing, duplicate transform skip, reset/center/manual pan behavior. |
| Native Stage | Tests/manual evidence that live rendering, Stage Motion, and Variant switching still work. |
| Browser Source | Tests/evidence that live frames, transform updates, and resync still work without raw data leakage. |
| Diagnostics metrics | Tests for source FPS vs render FPS, rAF delta, render duration, counts, and report aggregation. |
| Diagnostics privacy | Tests that copied report excludes token, raw tracking, calibration internals, private paths, and payload. |
| Regression | Runtime Player focused Vitest and typecheck. |
| Manual check | User captures native Stage and Browser Source performance reports and compares smoothness before/after. |

## 10. Manual Check Notes

The final report should ask the user to check:

- Open Runtime Player with a real Runtime Export.
- Confirm native Stage still displays and moves normally.
- Run Performance Diagnostics for native Stage.
- Connect OBS Browser Source.
- Run Performance Diagnostics for Browser Source connected state.
- Toggle Stage Motion off/on and capture both.
- In OBS, compare custom FPS off/30/60 if relevant.
- Copy report and save it to `tmp/player-performance.log` if follow-up analysis is needed.
- Subjectively check whether native Stage and Browser Source feel smoother than before.

## 11. Out of Scope

- WebGL persistent buffer/cache redesign.
- runtime graph cache.
- physics / body follow smoothing semantics changes.
- input interpolation.
- server-side frame throttle/resampling.
- Spout2.
- OBS automation.
- Browser Source protocol redesign.
- binary websocket protocol.
- texture/base64 protocol changes.
- Runtime Export format changes.
- Editor changes.
- new dependencies.

## 12. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep implementation scoped to Runtime Player unless explicitly escalated.
- Preserve Browser Source as the primary broadcast path.
- Preserve Wave10 native local preview suspension.
- Preserve Wave11 Stage Motion.
- Preserve Wave12 Live Controller Variant switching.
- Do not expose raw tracking/debug/calibration data in diagnostics or Browser Source messages.
- Do not change Runtime Export format.
- Do not add dependencies or edit lockfile.
- Do not implement Spout sender or OBS automation.
- Do not perform broad WebGL renderer rewrites.
- Do not revert unrelated or concurrent changes.
- Add focused tests where behavior is deterministic.
- If a shared file must be touched, keep the change minimal and record it in the domain report.

## 13. Review Policy

Each implementation domain needs the usual review lanes:

- spec compliance.
- design/development compliance.
- test adequacy.

Reviewers must specifically check:

- native Stage and Browser Source share the frame pacing improvement.
- no visual ownership boundaries are broken.
- source FPS and render FPS are not conflated.
- diagnostics copy report is safe to share.
- no raw tracking/calibration/token/private-path leakage.
- Wave10, Wave11, and Wave12 behavior did not regress.
- no broad renderer rewrite or dependency addition slipped in.

## 14. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave13 source changes.
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
