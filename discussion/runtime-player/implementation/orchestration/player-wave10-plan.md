# Runtime Player Wave 10 Plan: Broadcast Performance Foundation

> Objective: reduce OBS Browser Source broadcast load by suspending duplicate local Stage rendering, sampling diagnostics/status updates, and adding lightweight performance visibility without changing the accepted Browser Source broadcast path.

## 1. Status

- Status: Ready to launch.
- Planning gate result: plan directly.
- Inventory result:
  - Browser Source is now the accepted broadcast route after manual OBS success.
  - The native Stage Window and OBS Browser Source currently both render live motion, causing duplicate WebGL rendering.
  - Browser Source diagnostics/status updates can drive Control React state on every live frame.
  - Browser Source startup/resync can apply duplicate Runtime Export payloads.
- Source of truth before implementation:
  - Wave10 Sylph double-render investigation.
  - Wave10 Sylph broader performance investigation.
  - [player-wave9-plan.md](player-wave9-plan.md)
  - [browser-source-output-probe-v0.md](../../screens/browser-source-output-probe-v0.md)
  - [broadcast-capture-paths.md](../../research/broadcast-capture-paths.md)
  - [broadcast-stage-setup-v0.md](../../screens/broadcast-stage-setup-v0.md)
  - [runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md)

## 2. Product Goal

Wave9 proved the Browser Source path can display the Runtime Player model in OBS with transparency and synchronized Stage view state. Wave10 should make that accepted path lighter and more stream-friendly.

The desired experience is:

1. The user opens a Runtime Export and connects iFacialMocap as usual.
2. The user adds the fixed Browser Source URL to OBS.
3. When OBS Browser Source connects, Runtime Player automatically stops the local Stage Window's live rendering workload.
4. OBS Browser Source remains live, transparent, and synchronized with Stage size/pan/zoom.
5. Control remains responsive and reports useful Browser Source status without updating high-frequency diagnostic UI every frame.
6. If OBS disconnects or refreshes, local Stage preview resumes automatically after a short grace period.

This is a performance foundation wave, not a visual redesign wave.

## 3. Accepted Decisions

### 3.1 Broadcast Path

- Browser Source is the fixed primary broadcast path.
- Spout2 remains deferred.
- Native Stage Window remains useful for local preview, arrangement, fallback, and recovery.
- Native Stage Window should not duplicate live rendering while an OBS Browser Source client is connected.

### 3.2 Local Preview Suspension

- Suspend only the native local Stage live render path when Browser Source connected client count is greater than zero.
- Keep live parameter production, iFacialMocap input, mapping, body follow, dynamics, Browser Source server, WebSocket transport, Runtime Export state, and Stage transform synchronization active.
- Do not hide or destroy the native Stage Window.
- Do not stop Browser Source rendering.
- Resume native Stage live rendering automatically when Browser Source connected client count stays at zero for a short grace period.
- Recommended grace period: 2 seconds, unless implementation finds a better nearby value.

### 3.3 Diagnostics Sampling

- Do not throttle video/live parameter frames sent to Browser Source in this wave.
- It is acceptable to throttle Control-facing Browser Source status/diagnostics.
- Recommended Control diagnostic freshness: 500 ms.
- Renderer/client diagnostics should be sampled or sent on meaningful changes plus periodic refresh.

### 3.4 Startup / Resync

- Browser Source client should not apply the same Runtime Export payload multiple times during initial connection or reload.
- De-duplicate resync by Runtime Export identity/package revision/hash where practical.
- Preserve reliable reload/resync behavior over maximum minimalism.

### 3.5 Performance Visibility

- Add lightweight counters/timestamps only where they directly help validate this wave:
  - live frames produced/sec or latest frame cadence.
  - Browser Source status IPC/sec.
  - Browser Source diagnostic messages/sec.
  - Browser Source payload apply count.
  - Browser Source render/frame age or FPS where already available.
- Do not create a heavy profiler UI.

## 4. Wave Strategy

Use a single implementation domain followed by final integration. The implementation touches overlapping Runtime Player performance boundaries, so splitting into many parallel domains would likely increase conflict and review cost.

### Batch 1

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain A | Broadcast performance foundation | No | Single coherent implementation domain covering local preview suspension, diagnostics sampling, resync de-duplication, and focused tests. |

### Batch 2

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain B | Final integration, docs alignment, clean review | No, after A | Updates implementation facts and verifies accepted Browser Source path remains intact. |

## 5. Domain A: Broadcast Performance Foundation

Suggested subagent name:

```text
runtime-player-wave10-broadcast-performance-foundation
```

### Scope

Implement the low-risk performance improvements that directly support OBS Browser Source usage.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts`
- `apps/runtime-player/src/main/broadcast-source/**`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/browser-source/**`
- `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/control/browser-source-output-panel.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- focused tests under `apps/runtime-player/src/**`

### Required Behavior

#### Local Stage Live Render Suspension

- Detect Browser Source connected client count.
- When connected client count becomes greater than zero:
  - stop sending live frames to the native Stage live drawing path, or cause the native Stage renderer to ignore live frame drawing.
  - ensure the native Stage does not schedule live-frame RAF/render work.
  - keep Stage Window visible and recoverable.
  - keep Stage bounds/view transform changes available to Browser Source.
- When connected client count returns to zero:
  - resume native Stage live rendering after a short grace period.
  - avoid flicker during OBS refresh/reconnect.
  - reset or refresh local live state enough to avoid stale dynamics timing when preview resumes.
- Expose a clear Control status such as:

```text
Local preview live rendering is suspended while Browser Source is connected.
```

The exact wording may be adjusted to match existing UI style.

#### Browser Source Diagnostics / Status Sampling

- Keep live parameter WebSocket frames flowing at current cadence.
- Sample Control-facing Browser Source status/diagnostics to approximately 500 ms.
- Avoid full Control React state updates on every live frame.
- Preserve important immediate status changes:
  - server started/stopped/error.
  - Browser Source client connected/disconnected.
  - Runtime Export loaded/cleared.
  - WebGL/render error state.
- Client renderer diagnostics should not be sent to main/control every rendered frame unless performance mode explicitly requires it.

#### Browser Source Resync De-Duplication

- Prevent repeated application of identical Runtime Export payload during Browser Source startup/reload.
- Preserve:
  - initial load.
  - manual refresh.
  - runtime export replacement.
  - runtime export clear.
  - reconnect after OBS scene/source refresh.
- Add status/counter evidence that duplicate payload apply was avoided or minimized.

#### Lightweight Performance Visibility

- Add small diagnostics that help verify the wave:
  - status IPC/sample cadence.
  - diagnostic message cadence.
  - payload apply count.
  - latest live frame age/FPS where already available.
- Do not expose raw iFacialMocap debug data to Browser Source.
- Do not add editor-style parameter controls.

### Tests

At minimum, add focused tests for:

- local preview suspension policy:
  - zero Browser Source clients keeps local Stage live frames active.
  - one or more Browser Source clients suspends native live rendering.
  - disconnect to zero clients resumes after grace.
  - reconnect during grace does not bounce preview repeatedly.
- native Stage renderer behavior:
  - suspended state does not schedule unnecessary live-frame RAF/render work.
  - payload/view updates still work while live rendering is suspended.
- Browser Source status sampling:
  - live frames still broadcast unthrottled or at current cadence.
  - Control-facing status/diagnostics are sampled.
  - connect/disconnect and error status are not hidden by sampling.
- Browser Source resync de-duplication:
  - startup/reload does not apply the same Runtime Export payload multiple times.
  - new Runtime Export identity still applies.
- no `pnpm install`.

## 6. Domain B: Final Integration + Docs Alignment

Suggested subagent name:

```text
runtime-player-wave10-final-integration-broadcast-performance
```

### Scope

Run after Domain A completes and passes review.

### Required Behavior

- Verify Browser Source remains the primary broadcast path.
- Verify native Stage Window remains usable as local preview/fallback when no Browser Source client is connected.
- Verify OBS Browser Source rendering, transparency, Stage transform sync, mapping, body follow, and dynamics are not regressed.
- Verify local Stage live render suspension does not stop Browser Source rendering or input processing.
- Verify Control remains responsive and status is understandable.
- Verify implementation facts are reflected in docs/maps.
- Write Wave10 reports and reviews under:
  - `discussion/runtime-player/implementation/waves/wave10/`
  - `discussion/runtime-player/implementation/reviews/wave10/`

Docs to update as implementation facts require:

- [browser-source-output-probe-v0.md](../../screens/browser-source-output-probe-v0.md)
- [broadcast-capture-paths.md](../../research/broadcast-capture-paths.md)
- [broadcast-stage-setup-v0.md](../../screens/broadcast-stage-setup-v0.md)
- [runtime-player-backlog.md](../../backlog/runtime-player-backlog.md)
- runtime-player maps.

The final integration scope must include:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

## 7. Acceptance Criteria

- Browser Source remains the fixed primary broadcast path.
- Browser Source URL remains stable and usable in OBS.
- OBS Browser Source still renders transparent model output.
- OBS Browser Source still reflects live iFacialMocap mapping, body follow, and dynamics.
- OBS Browser Source still reflects Stage size/pan/zoom state.
- When at least one Browser Source client is connected, native Stage Window live rendering is suspended.
- While native Stage live rendering is suspended, Control and Stage arrangement/recovery remain usable.
- When Browser Source client count returns to zero, native Stage live rendering resumes automatically after a grace period.
- Control clearly indicates local preview suspension when active.
- Browser Source status/diagnostics no longer update Control on every live frame.
- Important state changes still appear promptly in Control.
- Browser Source startup/reload avoids duplicate identical Runtime Export payload application where practical.
- Focused tests cover suspension policy, status sampling, resync de-duplication, and regressions.
- No `pnpm install` is run by agents.

## 8. Verification Matrix

| Area | Verification |
|---|---|
| Local Stage suspension | Unit/focused tests for policy, connect/disconnect, grace, and renderer scheduling. |
| Browser Source continuity | Focused tests that live frames still reach Browser Source while local preview is suspended. |
| Control diagnostics | Tests for sampled status plus immediate important state transitions. |
| Resync | Tests for duplicate payload avoidance and replacement payload application. |
| Regression | Runtime Player typecheck and focused Vitest. |
| Manual OBS | Confirm alpha, live motion, dynamics, Stage transform sync, and improved perceived performance/CPU load. |

## 9. Manual Check Notes

The final report should ask the user to check:

- OBS Browser Source still shows the model with transparent background.
- Face/head motion remains smooth.
- Dynamics still run.
- Stage size and pan/zoom match the Player Stage settings.
- Control reports Browser Source connected.
- Control reports local preview suspension while OBS is connected.
- CPU/GPU usage or perceived smoothness improves compared with Wave9.
- Disconnect/close OBS Browser Source and confirm local Stage preview resumes.
- Refresh OBS Browser Source and confirm no flicker or broken resync.

## 10. Out of Scope

- Spout2 sender implementation.
- obs-websocket integration.
- automatic OBS source creation.
- automatic OBS capture verification.
- Browser Source video/live-frame FPS throttling.
- binary WebSocket transport.
- runtime graph/cache redesign.
- WebGL buffer/resource cache redesign.
- input-source auto-connect.
- head-position Stage Motion changes.
- packaging/distribution.
- heavy profiler UI.
- exposing raw tracking/debug data to Browser Source.

## 11. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep implementation scoped to Runtime Player.
- Do not implement Spout sender.
- Do not implement OBS automation.
- Do not throttle Browser Source live motion frames unless explicitly justified and reviewed.
- Do not stop iFacialMocap input, mapping, body follow, dynamics, or Browser Source rendering as part of local preview suspension.
- Do not hide/destroy the native Stage Window.
- Do not expose raw tracking/debug data to Browser Source.
- Do not revert unrelated or concurrent changes.
- Add focused tests where behavior is deterministic.
- If a shared file must be touched, keep the change minimal and record it in the domain report.

## 12. Review Policy

Each implementation domain needs the usual review lanes:

- spec compliance.
- design/development compliance.
- test adequacy.

Reviewers must specifically check:

- local Stage suspension only affects native local preview live rendering.
- Browser Source rendering remains live.
- Browser Source Stage transform sync remains intact.
- Control status sampling cannot hide important state transitions.
- resync de-duplication does not break reload/reconnect.
- no raw tracking/debug data crosses into Browser Source.
- Browser Source remains the primary broadcast path in docs/UI.

## 13. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave10 source changes.
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
