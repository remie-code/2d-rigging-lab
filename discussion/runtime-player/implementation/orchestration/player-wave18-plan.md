# Runtime Player Wave 18 Plan: Lightweight Performance Diagnostics Cleanup

> Objective: reduce Runtime Player Performance Diagnostics to lightweight live health and fast-path proof, removing product deep-profiling paths that distort Browser Source behavior.

## 1. Status

- Status: Ready to launch.
- Planning gate result: inventory first, then plan.
- User decision:
  - Wave17 performance improvement is successful at user-experience level.
  - Heavy profiling now distorts Browser Source behavior and is no longer product UX.
  - Product Performance Diagnostics should keep only lightweight FPS / connection / fast-path health.
  - Runtime Player product paths should delete deep profiling activation, transport, and report output.
  - Runtime-core internal profiling can remain as a developer/test utility; it should simply no longer be reachable from the Runtime Player product UI or Browser Source product protocol.
- Inventory basis:
  - `PerformanceDiagnosticsPage.startCapture()` currently always requests `requestCaptureRuntimeCoreProfiling(target, "deep")`.
  - Report formatting still prints runtime-core phase timing fields.
  - Stage / Browser Source profiling transport exists through IPC / WS paths.
  - `publicSnapshotMaterializationCount` currently depends on runtime-core profile payload and must become a cheap counter independent of deep profiling, or be deliberately replaced.
- Source of truth before implementation:
  - this plan.
  - [player-wave17-plan.md](player-wave17-plan.md)
  - [wave17-final-integration-report.md](../waves/wave17/wave17-final-integration-report.md)
  - [performance-diagnostics.md](../../screens/performance-diagnostics.md)
  - [runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md)

## 2. Product Goal

Runtime Player should not make broadcast rendering worse when the user opens or runs Performance Diagnostics.

After Wave17, actual live rendering feels smooth. The remaining issue is diagnostic overhead, not runtime performance. Wave18 should therefore turn Performance Diagnostics into a lightweight health view:

- Is input arriving?
- Is Browser Source connected?
- Are live frames flowing?
- Is rendering happening at a reasonable FPS?
- Is the Wave17 fast path active?
- Is public snapshot materialization avoided on the live render path?

It should stop being a product-accessible runtime-core profiler.

## 3. Accepted Boundary

### 3.1 Delete Product Deep Profiling

Remove Runtime Player product paths that enable or propagate deep runtime-core profiling:

- Control Start Capture must not request `"deep"` profiling.
- Native Stage product IPC must not expose a product action to enable runtime-core deep profiling.
- Browser Source product protocol must not send `runtime-core-profiling-changed` or equivalent profiling mode changes.
- Browser Source client must not receive or react to product deep-profiling messages.
- Performance reports must not print runtime-core phase timing sections.

### 3.2 Keep Runtime-Core Internal Profiling

Do not delete runtime-core internal developer/test profiling utilities in this wave.

Allowed to remain:

- `packages/runtime-core` profiling helpers.
- runtime-core tests that explicitly enable profiling.
- developer-only runtime-core performance investigation APIs.

Reason:

- The product problem is the Runtime Player / Browser Source product path.
- Removing runtime-core internals would broaden the wave into a runtime-core API cleanup and add avoidable risk.
- Future temporary investigations can still use runtime-core profiling internally.

## 4. Metrics To Keep

Keep product-facing metrics that are lightweight and useful for live health.

Required keep list:

- `inputReceiveFpsLatest`
- `inputPacketCount`
- `liveFrameMessageFps`
- `liveFrameMessageCount`
- `appliedLiveFrameFps`
- `appliedLiveFrameCount`
- `renderFps`
- `renderCount`
- `browserSourceClientCount`
- target availability
- canvas size / devicePixelRatio if already cheap and useful
- `compiledRenderFrameCount`
- `publicSnapshotMaterializationCount`
- `transientCompileCount`
- `transientInstanceCount`
- `runtimeModelInstanceCacheHitCount`
- `runtimeModelInstanceCacheMissCount`
- `runtimeModelInstanceCacheInvalidationCount`

`publicSnapshotMaterializationCount` must become independent of deep profiling. It should be a cheap proof counter for whether the live path accidentally fell back to public snapshot materialization.

Optional keep list:

- `liveFrameSourceTimestampFpsLatest` if it remains clearly described as source timestamp cadence, not raw input receive FPS.
- `coalescedLiveFrameCount`, `scheduledRenderCount`, `immediateRenderCount`, and duplicate transform skip counts only if they are already cheap and help explain flow without making the report feel like a profiler.

## 5. Metrics / Product Features To Remove

Remove from product UI/report/transport:

- deep profiling capture activation.
- `RuntimePlayerRuntimeCoreProfilingMode` product bridge usage.
- Native Stage runtime-core profiling IPC path.
- Browser Source runtime-core profiling WS/protocol message.
- expanded runtime-core profile payload forwarding.
- runtime-core phase timing report fields, including:
  - `runtimeCoreEvaluationDurationMs`
  - `runtimeCoreInputValidationDurationMs`
  - `runtimeCoreStateCompatibilityDurationMs`
  - `runtimeCoreDynamicsEvaluationDurationMs`
  - `runtimeCoreSnapshotCreationDurationMs`
  - `runtimeCoreParameterResolutionDurationMs`
  - `runtimeCoreKeyformSamplingDurationMs`
  - `runtimeCoreKeyformApplicationDurationMs`
  - `runtimeCoreDeformerHierarchyEvaluationDurationMs`
  - `runtimeCoreWarpDeformerVertexTransformDurationMs`
  - `runtimeCoreRotationDeformerVertexTransformDurationMs`
  - `runtimeCoreDrawableSnapshotCreationDurationMs`
  - `runtimeCoreVisibilityDrawOrderEvaluationDurationMs`
  - `runtimeCoreMaskEvaluationDurationMs`
  - `runtimeCoreSnapshotValidationDurationMs`
  - `runtimeCoreRenderFrameOutputDurationMs`
  - `runtimeModelCompileDurationMs` as product-facing timing.

If some fields remain internally for runtime-core tests, they must not be shown in the Runtime Player product report or triggered by product diagnostics.

## 6. Wave Strategy

Run sequentially.

The UI, bridge contracts, Browser Source protocol, renderer diagnostics, and report tests are linked. Parallelizing implementation would likely cause overlap in contract files and test expectations.

### Dependency Summary

| Domain | Work | Parallel? | Reason |
|---|---|---|---|
| Domain A | Product diagnostics simplification and report shrink | No | Establishes the visible product surface and keep/remove report fields. |
| Domain B | Product profiling transport removal and cheap proof counters | No, after A | Removes IPC/WS deep profiling paths and makes snapshot proof counter independent of deep profiling. |
| Domain C | Final integration / docs / clean review | No, after A-B | Aligns docs/maps and confirms product behavior and review evidence. |

## 7. Domain A: Product Diagnostics Simplification

Suggested subagent name:

```text
runtime-player-wave18-product-diagnostics-simplification
```

### Scope

Simplify Control Performance Diagnostics and report output to lightweight Live Health / FPS / connection / fast-path proof.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/control/performance-diagnostics-page.tsx`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- related diagnostics report/page tests.

### Required Behavior

- Start Capture no longer enables runtime-core deep profiling.
- Report omits deep runtime-core phase timing fields.
- Report keeps lightweight input, connection, FPS, Browser Source client count, fast-path counters, transient counters, and runtime instance cache counters.
- Missing/unknown lightweight metrics are still handled gracefully.
- Report privacy exclusions remain true.
- UI copy should avoid implying this is a deep profiler.

### Tests

At minimum:

- report formatting omits deep runtime-core phase timing fields.
- report formatting includes the kept lightweight metrics.
- capture lifecycle does not request deep profiling.
- missing/unknown metrics still render safely.
- privacy exclusions remain covered.

Escalate if:

- removing deep fields makes the existing report contract ambiguous enough to require a user-facing terminology decision;
- Start Capture cannot be separated from deep profiling without broad bridge changes, in which case Domain B may need to absorb the change.

## 8. Domain B: Product Profiling Transport Removal / Cheap Proof Counters

Suggested subagent name:

```text
runtime-player-wave18-product-profiling-transport-removal
```

### Dependency

Start after Domain A passes.

### Scope

Remove product deep-profiling IPC/WS transport paths and make fast-path proof counters cheap and product-safe.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- Stage bridge files:
  - `stage-view-bridge-channels.ts`
  - `stage-view-bridge-handlers.ts`
  - runtime player stage bridge contracts.
- Browser Source files:
  - `browser-source-bridge-channels.ts`
  - `browser-source-status-contract.ts`
  - `browser-source-transport-contract.ts`
  - `browser-source-session.ts`
  - `browser-source-server.ts`
  - `browser-source-stage-client.ts`
  - `browser-source-stage-renderer.ts`
  - `browser-source-server-message.ts`
- related Stage / Browser Source tests.

### Required Behavior

- Product Stage / Browser Source paths no longer expose runtime-core profiling mode changes.
- Browser Source protocol no longer sends product `runtime-core-profiling-changed` messages.
- Browser Source client no longer receives or applies product runtime-core profiling changes.
- Normal Browser Source behavior is unaffected by Performance Diagnostics except lightweight metrics sampling.
- Wave17 render-frame fast path remains active.
- `publicSnapshotMaterializationCount` is a cheap counter independent of deep profiling.
- `compiledRenderFrameCount`, transient compile/instance counters, and runtime instance cache counters remain available.

### Tests

At minimum:

- Browser Source protocol tests no longer expect profiling messages.
- Stage bridge tests no longer expose product profiling mode API.
- renderer metrics tests confirm fast-path counters remain available without deep profiling.
- Performance Diagnostics capture does not change runtime-core profiling mode.
- focused Runtime Player tests and `pnpm.cmd typecheck` pass.

Escalate if:

- product profiling transport removal would require deleting runtime-core internal profiling APIs;
- `publicSnapshotMaterializationCount` cannot be made cheap without significant runtime-core redesign;
- Browser Source protocol cleanup breaks compatibility in a way that needs user decision.

## 9. Domain C: Final Integration / Docs Alignment / Clean Review

Suggested subagent name:

```text
runtime-player-wave18-final-integration-lightweight-diagnostics
```

### Scope

Run after Domains A-B complete.

### Required Behavior

- Confirm Performance Diagnostics is lightweight Live Health, not a product deep profiler.
- Confirm product Start Capture does not enable runtime-core deep profiling.
- Confirm product Stage / Browser Source profiling transport is removed.
- Confirm runtime-core internal developer/test profiling may remain.
- Confirm Browser Source behavior is not changed by running Performance Diagnostics except lightweight metrics sampling.
- Confirm Wave17 fast render frame path remains active.
- Confirm no Runtime Export format changes.
- Confirm no Editor changes.
- Confirm no package-format runtime schema changes.
- Confirm no new dependencies or lockfile changes.
- Write final reports/reviews under:
  - `discussion/runtime-player/implementation/waves/wave18/`
  - `discussion/runtime-player/implementation/reviews/wave18/`

Docs/maps to update as implementation facts require:

- [performance-diagnostics.md](../../screens/performance-diagnostics.md)
- Runtime Player maps.
- Runtime Player backlog if diagnostic/profiling items change status.

The final integration scope must include:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

### Manual Check Notes

The final report should ask the user to check:

- Open Runtime Player with the real Runtime Export.
- Connect iFacialMocap.
- Connect OBS Browser Source.
- Run Performance Diagnostics for Browser Source.
- Confirm the act of diagnostics capture no longer visibly degrades Browser Source smoothness.
- Save copied report to `tmp/report.log` if further discussion is needed.
- Check the report focuses on:
  - input FPS;
  - live frame FPS;
  - applied frame FPS;
  - render FPS;
  - Browser Source client count;
  - fast-path counters;
  - snapshot materialization proof counter;
  - runtime instance cache counters.

## 10. Acceptance Criteria

- Performance Diagnostics Start Capture no longer enables runtime-core deep profiling.
- Runtime Player product UI/report no longer exposes deep runtime-core phase timings.
- Product Stage / Browser Source deep-profiling transport is removed.
- Runtime-core internal developer/test profiling can remain.
- Report remains copyable and privacy-safe.
- Report keeps lightweight Live Health / FPS / connection / fast-path proof metrics.
- `publicSnapshotMaterializationCount` is cheap and independent of deep profiling.
- Browser Source behavior is not degraded by running Performance Diagnostics.
- Native Stage and Browser Source still use Wave17 render-frame fast path.
- Focused tests and typecheck pass, or failures are classified with concrete evidence.
- No `pnpm install` is run by agents.
- No Runtime Export format changes.
- No Editor changes.
- No package-format schema changes.
- No new dependencies or lockfile edits.

## 11. Out of Scope

- Deleting runtime-core internal profiling utilities.
- Adding new profiling systems.
- Temporary bottleneck investigation instrumentation.
- Runtime-core performance optimization.
- Renderer/WebGL optimization.
- Runtime Export format changes.
- Editor changes.
- package-format schema changes.
- new dependencies.
- lockfile edits.
- `pnpm install`.

## 12. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep Wave18 centered on product diagnostics cleanup.
- Delete Runtime Player product deep-profiling activation/transport/report output.
- Do not delete runtime-core internal profiling utilities unless explicitly escalated and approved.
- Preserve Browser Source as the primary broadcast path.
- Preserve Wave10 native local preview suspension.
- Preserve Wave11 Stage Motion.
- Preserve Wave12 Live Controller Variant switching.
- Preserve Wave17 render-frame fast path.
- Do not expose raw tracking/debug/calibration data in diagnostics or Browser Source messages.
- Do not change Runtime Export format.
- Do not add dependencies or edit lockfile.
- Do not revert unrelated or concurrent changes.
- Add focused tests where behavior is deterministic.
- If a shared file must be touched outside the domain's expected scope, report it before broadening.

## 13. Review Policy

Each implementation domain needs review lanes:

- spec compliance;
- design/development compliance;
- test adequacy.

Review lanes must be separate Review-Sylph subagents. Do not collapse review lanes into one reviewer.

Reviewers must specifically check:

- product Start Capture no longer enables runtime-core deep profiling;
- product Stage / Browser Source profiling transport is removed;
- runtime-core internal profiling is not accidentally deleted or broken beyond scope;
- report no longer prints deep runtime-core phase timings;
- report keeps lightweight Live Health / FPS / connection / fast-path proof metrics;
- `publicSnapshotMaterializationCount` is cheap and not dependent on deep profiling;
- Browser Source privacy boundaries remain intact;
- Wave17 fast path remains active.

## 14. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave18 source changes.
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
