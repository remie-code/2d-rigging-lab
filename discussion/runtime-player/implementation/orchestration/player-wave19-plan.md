# Runtime Player Wave 19 Plan: Browser Source RAF Cadence Diagnostics

> Objective: add lightweight diagnostics that explain why OBS Browser Source applies and renders about one frame for every two incoming live frames.

## 1. Status

- Status: Ready to launch.
- Planning gate result: plan directly.
- User decision:
  - The Browser Source path is visually acceptable at about 30fps, but the exact half-rate behavior is worth understanding.
  - This wave is diagnostic first, not a speculative scheduler rewrite.
  - Heavy deep profiling must not be restored.
  - Keep the product diagnostics lightweight enough that measurement does not become the bottleneck again.
- Investigation basis:
  - `tmp/native-stage.log` showed Native Stage receiving roughly 60fps live frames and rendering around 52fps.
  - `tmp/report.log` showed Browser Source receiving roughly 60fps live frames and applying/rendering around 30fps.
  - When input/live cadence is around 56fps, Browser Source output becomes around 28fps, which looks like one rendered frame for every two incoming frames rather than a fixed 30fps cap.
  - Sylph investigation found no explicit 30fps throttle, no `1000 / 30` frame pacing, and no modulo/even-odd frame drop in the Browser Source render path.
  - Browser Source and Native Stage share `createStaticStageCanvasRenderer`; the main difference is Electron native window + IPC versus OBS CEF Browser Source + WebSocket.
  - The direct code mechanism is latest-wins coalescing: while one `requestAnimationFrame` render is pending, newer live frames replace the pending frame and increment the coalesced count.
- Source of truth before implementation:
  - this plan.
  - [player-wave18-plan.md](player-wave18-plan.md)
  - [wave18-final-integration-report.md](../waves/wave18/wave18-final-integration-report.md)
  - [performance-diagnostics.md](../../screens/performance-diagnostics.md)
  - [runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md)

## 2. Product Goal

Runtime Player should let us distinguish two very different explanations for Browser Source half-rate rendering:

1. OBS / CEF `requestAnimationFrame` itself is running at about half the live input cadence.
2. Browser Source rAF is available near 60fps, but our render work or scheduling state causes every other live frame to be coalesced.

The user-facing goal is not to add a large profiler. It is to make the copied Performance Diagnostics report answer the next question:

```text
Is Browser Source half-rate because rAF is half-rate, or because rendering cannot keep up?
```

## 3. Accepted Boundary

### 3.1 Add Lightweight Browser Source Cadence Diagnostics

Add low-overhead metrics that can be collected during normal Performance Diagnostics capture:

- Browser Source independent rAF probe FPS.
- Browser Source rAF delta summary, at least p50 / p95 / max if the existing diagnostics summary helpers support it.
- scheduled render duration summary.
- render duration summary if already available or cheap to measure.
- live input to applied frame gap information:
  - use existing frame sequence/source sequence if available;
  - otherwise use Browser Source local receive/apply counters to report average/max skipped pending frames.
- coalesced live frame count, scheduled render count, applied live frame count, and render count remain visible.

### 3.2 Keep Measurement Cheap

The diagnostics must not reintroduce the Wave17/Wave18 problem where measuring the system makes Browser Source visibly worse.

Required constraints:

- Do not enable runtime-core deep profiling.
- Do not send raw iFacialMocap frames.
- Do not send raw head position, calibration internals, private file paths, Browser Source token, Runtime Export payload, textures, or mesh data.
- Do not add a continuously expensive product profiler.
- Prefer simple timestamp deltas and counters.
- Keep arrays/ring buffers bounded.

### 3.3 No Behavior Change By Default

Do not change the scheduler behavior as part of this wave unless a clear local bug is discovered and can be fixed without changing product semantics.

Expected scheduler behavior remains:

- latest-wins for high-frequency live frames;
- coalescing is allowed and desirable when render cadence is lower than input cadence;
- do not queue stale live frames just to inflate rendered frame count.

## 4. Diagnostic Interpretation Target

The final report should let the user and future agents interpret the next `tmp/report.log`.

Expected readings:

| Observation | Interpretation |
|---|---|
| `browserRafProbeFps ~= 30` and render duration is short | OBS / CEF Browser Source rAF is likely half-rate. |
| `browserRafProbeFps ~= 60` but render/apply FPS is about 30 | Our render work, pending-render gating, or scheduling path is likely causing one-frame coalescing. |
| `renderDurationMs` p95 is above about 16ms | Browser Source cannot reliably keep 60fps on this path. |
| applied sequence/counter gap trends around 2 | The path is applying roughly every other live frame. |
| coalesced count is near live messages minus applied frames | Latest-wins coalescing explains the visible half-rate. |

If the result points to OBS / CEF rAF, that is an acceptable outcome. The wave does not need to force 60fps Browser Source rendering.

## 5. Wave Strategy

Run mostly sequentially.

The implementation is small, but metrics contracts, Browser Source client, shared renderer metrics, Control report formatting, and tests are coupled enough that one implementation domain is clearer than parallel domains. A separate final integration domain should align docs and run clean review.

### Dependency Summary

| Domain | Work | Parallel? | Reason |
|---|---|---|---|
| Domain A | Browser Source rAF cadence metrics and Performance Diagnostics report | No | Touches the coupled diagnostics contract, Browser Source client/renderer, and report expectations. |
| Domain B | Final integration / docs / clean review | No, after A | Confirms the diagnostic is lightweight, documented, privacy-safe, and useful for manual OBS follow-up. |

## 6. Domain A: Browser Source RAF Cadence Metrics

Suggested subagent name:

```text
runtime-player-wave19-browser-source-raf-cadence-diagnostics
```

### Scope

Add lightweight Browser Source cadence diagnostics and surface them in the copied Performance Diagnostics report.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- related Browser Source diagnostics / renderer metrics tests.

### Required Behavior

- Browser Source report includes an independent rAF probe metric that is not dependent on live frame arrival.
- Browser Source report includes enough render duration / rAF delta / coalescing data to distinguish:
  - OBS / CEF rAF half-rate;
  - our renderer/scheduler failing to keep up.
- Existing lightweight FPS metrics remain:
  - `inputReceiveFpsLatest`;
  - `liveFrameMessageFps`;
  - `appliedLiveFrameFps`;
  - `renderFps`;
  - `coalescedLiveFrameCount`;
  - fast-path proof counters.
- Native Stage diagnostics continue to work.
- Browser Source diagnostics remain token-safe and privacy-safe.
- Browser Source visual output and scheduler semantics are not changed by default.
- No runtime-core deep profiling is product-reachable.

### Tests

At minimum:

- metrics validation accepts the new lightweight Browser Source cadence fields.
- report formatting displays the new fields clearly and handles missing/unknown values.
- Browser Source diagnostics payload remains sanitized.
- renderer metrics tests cover rAF probe or delta sampling where deterministic enough.
- focused Runtime Player tests and `pnpm.cmd typecheck` pass, or failures are classified with concrete evidence.

Escalate if:

- determining rAF cadence requires heavy profiling or long-lived unbounded sampling;
- adding frame sequence data would require exposing raw tracking or broad protocol redesign;
- a scheduler behavior change appears necessary to avoid misleading diagnostics.

## 7. Domain B: Final Integration / Docs Alignment / Clean Review

Suggested subagent name:

```text
runtime-player-wave19-final-integration-raf-cadence-diagnostics
```

### Scope

Run after Domain A completes.

### Required Behavior

- Confirm Performance Diagnostics remains lightweight.
- Confirm Browser Source rAF cadence can be interpreted from copied reports.
- Confirm no deep profiling product transport is restored.
- Confirm Browser Source and Native Stage normal rendering still work.
- Confirm Browser Source latest-wins coalescing remains intentional.
- Confirm no Runtime Export format changes.
- Confirm no Editor changes.
- Confirm no package-format schema changes.
- Confirm no new dependencies or lockfile changes.
- Write final reports/reviews under:
  - `discussion/runtime-player/implementation/waves/wave19/`
  - `discussion/runtime-player/implementation/reviews/wave19/`

Docs/maps to update as implementation facts require:

- [performance-diagnostics.md](../../screens/performance-diagnostics.md)
- Runtime Player implementation maps.

The final integration scope must include:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

### Manual Check Notes

The final report should ask the user to check:

- Open Runtime Player with the real Runtime Export.
- Connect iFacialMocap.
- Connect OBS Browser Source.
- Set OBS video FPS and Browser Source custom FPS to 60, as already tested.
- Run Performance Diagnostics for Browser Source.
- Save copied report to `tmp/report.log`.
- Compare:
  - Browser Source rAF probe FPS;
  - rAF delta p50 / p95 / max;
  - render duration p50 / p95 / max;
  - `liveFrameMessageFps`;
  - `appliedLiveFrameFps`;
  - `renderFps`;
  - coalesced frame count;
  - sequence/counter gap if present.

## 8. Acceptance Criteria

- Performance Diagnostics can identify whether Browser Source half-rate behavior is caused by Browser Source rAF cadence or render/scheduler backlog.
- Browser Source copied report includes lightweight rAF cadence metrics.
- Browser Source copied report includes render/coalescing metrics needed to interpret one-frame-for-two-input behavior.
- Missing metrics are handled gracefully.
- Existing Native Stage / Browser Source render behavior is preserved.
- Runtime Player does not restore deep runtime-core profiling as a product path.
- Browser Source diagnostics remain sanitized and do not expose raw tracking, tokens, private paths, Runtime Export payloads, textures, or mesh data.
- Focused tests and typecheck pass, or failures are classified with concrete evidence.
- No `pnpm install` is run by agents.
- No Runtime Export format changes.
- No Editor changes.
- No package-format schema changes.
- No new dependencies or lockfile edits.

## 9. Out of Scope

- Forcing OBS Browser Source to 60fps.
- Spout2 sender.
- OBS plugin/native capture integration.
- OBS automation/source creation.
- Scheduler rewrite.
- queuing every live frame.
- Runtime-core performance optimization.
- WebGL renderer rewrite.
- worker/offscreen rendering.
- deep runtime-core profiling product UI/transport.
- Runtime Export format changes.
- Editor changes.
- package-format schema changes.
- new dependencies.
- lockfile edits.
- `pnpm install`.

## 10. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep Wave19 centered on Browser Source rAF cadence diagnosis.
- Do not change product broadcast strategy.
- Do not reintroduce deep product profiling.
- Preserve Browser Source as the primary broadcast path.
- Preserve Wave10 native local preview suspension.
- Preserve Wave11 Stage Motion.
- Preserve Wave12 Live Controller Variant switching.
- Preserve Wave17 render-frame fast path.
- Preserve Wave18 lightweight diagnostics posture.
- Do not expose raw tracking/debug/calibration data in diagnostics or Browser Source messages.
- Do not change Runtime Export format.
- Do not add dependencies or edit lockfile.
- Do not revert unrelated or concurrent changes.
- Add focused tests where behavior is deterministic.
- If a shared file must be touched outside the domain's expected scope, report it before broadening.

## 11. Review Policy

Each implementation domain needs review lanes:

- spec compliance;
- design/development compliance;
- test adequacy.

Review lanes must be separate Review-Sylph subagents. Do not collapse review lanes into one reviewer.

Reviewers must specifically check:

- rAF cadence metrics are lightweight and bounded;
- diagnostics can distinguish rAF half-rate from render/scheduler backlog;
- report copy is understandable and handles unknown values;
- no deep runtime-core profiling product path is restored;
- Browser Source privacy boundaries remain intact;
- Browser Source latest-wins coalescing semantics are preserved;
- Native Stage diagnostics are not broken;
- no Runtime Export / Editor / package-format schema changes are introduced.

## 12. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave19 source changes.
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
- Must launch separate Review-Sylph subagents for spec compliance, design/development compliance, and test adequacy.

Required assignment sentence:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

No parent may pass the wave gate while a child is incomplete, running, or unresolved.
