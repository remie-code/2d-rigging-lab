# Runtime Player Wave 15 Plan: Runtime Snapshot Hot-Path Cleanup

> Objective: improve Browser Source / Stage live render smoothness by removing avoidable validation and profiling overhead from the runtime-core hot path, without changing runtime behavior.

## 1. Status

- Status: Ready to launch.
- Planning gate result: plan directly.
- Inventory basis:
  - Wave14 runtime evaluation cache is working: latest diagnostics showed `evaluationCacheHitCount` > 0, `evaluationCacheMissCount = 0`, and `evaluationCacheInvalidationCount = 0`.
  - Renderer/scaffold/scene-build costs are near zero.
  - Dominant cost is inside runtime-core snapshot creation.
  - Deep runtime-core profiling added as temporary diagnostics visibly worsens Browser Source smoothness and must not become normal-runtime overhead.
- Source of truth before implementation:
  - this plan.
  - latest `tmp/report.log` discussed immediately before this plan.
  - [player-wave14-plan.md](player-wave14-plan.md)
  - [wave14-final-integration-report.md](../waves/wave14/wave14-final-integration-report.md)
  - [performance-diagnostics.md](../../screens/performance-diagnostics.md)
  - [runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md)

## 2. Product Goal

Runtime Player must feel smooth enough for live use through OBS Browser Source. Wave14 proved the first cache layer works, but live rendering still spends most of its time in runtime-core snapshot creation.

Wave15 should take the lowest-risk next step:

1. Remove or gate runtime snapshot validation from the normal live hot path.
2. Ensure deep runtime-core profiling is not always active during normal Browser Source rendering.
3. Preserve measurement ability when the user intentionally runs Performance Diagnostics.
4. Preserve runtime behavior for dynamics, keyforms, deformers, clipping, variants, Stage Motion, and Browser Source output.

This wave is deliberately not a broad runtime-core rewrite. It should remove avoidable overhead before deeper allocation or vertex-transform optimization.

## 3. Accepted Measurements

Latest Browser Source diagnostic pattern:

```text
runtimeCoreSnapshotCreationDurationMs p50 ~= 83ms
runtimeCoreDrawableSnapshotCreationDurationMs p50 ~= 40ms
runtimeCoreDeformerHierarchyEvaluationDurationMs p50 ~= 25ms
runtimeCoreSnapshotValidationDurationMs p50 ~= 17ms
runtimeCoreWarpDeformerVertexTransformDurationMs p50 ~= 17ms
renderDurationMs p50 ~= 1ms
evaluationCacheHitCount > 0
evaluationCacheMissCount = 0
```

Interpretation:

- Runtime evaluation cache is effective.
- Render-input scaffold and WebGL render are not dominant.
- Snapshot validation is a large avoidable cost.
- Deep profiling likely adds Browser Source overhead and should be gated.
- Drawable snapshot allocation and Warp vertex transform remain future optimization candidates after this wave.

## 4. Accepted Decisions

### 4.1 Snapshot Validation

Snapshot validation must not run unconditionally in the live Browser Source / Stage hot path.

Allowed approaches:

- make snapshot validation optional through runtime-core evaluation options;
- default live runtime evaluation to skip schema/deep validation;
- keep validation enabled in tests/dev-specific calls where it is useful;
- preserve a way to enable validation for diagnostics/debug if needed.

Required:

- skipping validation must not change runtime result semantics;
- tests must prove evaluated output still satisfies expected shape through deterministic cases;
- validation-off path must be explicit, not hidden global mutation.

### 4.2 Deep Profiling

Deep runtime-core profiling must not be treated as free.

Allowed approaches:

- enable deep profiling only during Performance Diagnostics capture;
- expose a profiling detail level;
- keep coarse counters always available but avoid expensive per-phase timing unless requested.

Required:

- normal live rendering should avoid deep profiling overhead;
- Performance Diagnostics should still be able to capture deep profiles when requested;
- Browser Source should not send large profiling payloads every heartbeat outside diagnostics capture if avoidable.

### 4.3 Future Work Not Included

Do not optimize these in Wave15 unless a tiny local cleanup is required:

- Drawable snapshot allocation redesign.
- Warp deformer vertex transform redesign.
- typed-array vertex buffer redesign.
- runtime-core API rewrite.
- worker/offscreen rendering.

These are candidates for later waves after Wave15 confirms the effect of validation/profiling cleanup.

## 5. Wave Strategy

Run Domain A and Domain B sequentially. Domain A establishes runtime-core validation options; Domain B relies on that boundary to gate profiling/diagnostics behavior.

### Dependency Summary

| Domain | Work | Parallel? | Reason |
|---|---|---|---|
| Domain A | Snapshot validation hot-path removal / options | No | Establishes runtime-core evaluation options and semantics. |
| Domain B | Deep profiling gating and diagnostics capture behavior | No, after A | Uses runtime-core options and diagnostics plumbing. |
| Domain C | Final integration / docs / clean review | No, after A+B | Confirms behavior, docs, and manual check instructions. |

## 6. Domain A: Snapshot Validation Hot-Path Removal

Suggested subagent name:

```text
runtime-player-wave15-snapshot-validation-hot-path
```

### Scope

Make runtime snapshot validation optional and ensure Runtime Player live Browser Source / Stage evaluation does not pay the validation cost every applied frame.

### Primary Files / Areas

Likely areas:

- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/runtime-profiling.ts`
- `packages/runtime-core/src/**/*.test.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- focused Runtime Player Stage evaluation tests if option plumbing reaches app code.

### Required Behavior

- Runtime-core evaluation supports an explicit validation mode or option.
- Runtime Player live evaluation uses validation-off or validation-light mode for normal live frames.
- Validation-heavy path remains available for tests/debug/diagnostics when intentionally requested.
- Snapshot validation timing metric should become near zero or absent in normal live path.
- Existing runtime output behavior remains unchanged.
- Existing tests remain meaningful; if tests depended on unconditional validation, update them to request validation explicitly.

### Tests

At minimum:

- runtime-core evaluation still returns expected snapshot without validation.
- validation-on path still catches invalid snapshot cases where existing tests expect it.
- Runtime Player live evaluation requests validation-off or validation-light mode.
- diagnostics still record validation duration when validation is requested, or report zero/unknown clearly when disabled.

Escalate if:

- runtime-core validation is currently the only guard preventing invalid runtime output in normal operation.
- disabling validation changes observed output.
- validation option requires a broad public API redesign.

## 7. Domain B: Deep Profiling Gating

Suggested subagent name:

```text
runtime-player-wave15-deep-profiling-gating
```

### Dependency

Start after Domain A passes.

### Scope

Ensure deep runtime-core profiling only runs when Performance Diagnostics capture requests it, or otherwise make profiling cost negligible during normal Browser Source rendering.

### Primary Files / Areas

Likely areas:

- `packages/runtime-core/src/runtime-profiling.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts`
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- relevant focused tests.

### Required Behavior

- Normal live rendering should avoid deep profiling timers and large profile payloads.
- Performance Diagnostics capture can enable deep profiling long enough to produce actionable reports.
- Browser Source diagnostics should not send expanded deep profile fields at high frequency unless capture/profiling is active.
- Existing coarse metrics remain available enough to know render/application health.
- Privacy constraints remain unchanged.

### Tests

At minimum:

- normal render path calls runtime-core with profiling disabled or shallow.
- Performance Diagnostics capture enables deep profiling.
- report includes deep profiling fields when available.
- report handles unknown/null deep profiling fields when profiling is disabled.
- Browser Source diagnostics validation remains backward-compatible.

Escalate if:

- capture state cannot reach Browser Source safely without broad protocol redesign.
- gating profiling would remove all useful performance diagnostics.
- Browser Source cannot distinguish normal heartbeat diagnostics from capture diagnostics.

## 8. Domain C: Final Integration / Docs Alignment / Clean Review

Suggested subagent name:

```text
runtime-player-wave15-final-integration-hot-path-cleanup
```

### Scope

Run after Domain A and B complete.

### Required Behavior

- Confirm snapshot validation is not always paid in normal live path.
- Confirm deep runtime-core profiling is not always active.
- Confirm Performance Diagnostics can still intentionally capture deep details.
- Confirm no runtime behavior changes were introduced.
- Confirm Browser Source remains primary broadcast path and privacy-safe.
- Confirm Wave10 local preview suspension, Wave11 Stage Motion, Wave12 Variant switching, Wave14 cache behavior remain preserved.
- Write final reports/reviews under:
  - `discussion/runtime-player/implementation/waves/wave15/`
  - `discussion/runtime-player/implementation/reviews/wave15/`

Docs/maps to update as implementation facts require:

- [performance-diagnostics.md](../../screens/performance-diagnostics.md)
- runtime-player maps.
- runtime-player backlog if the profiling-removal concern is closed or deferred.

The final integration scope must include:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

## 9. Acceptance Criteria

- Runtime Player live Browser Source / Stage evaluation no longer runs heavy snapshot validation unconditionally.
- Deep runtime-core profiling is not always active in normal live rendering.
- Performance Diagnostics can still capture deep runtime-core profiling intentionally.
- Browser Source normal rendering feels no worse due to profiling infrastructure.
- `runtimeCoreSnapshotValidationDurationMs` is zero/unknown/near-zero during normal non-deep-profile captures, or final report explains the remaining cost.
- Deep diagnostics capture still exposes phase data when enabled.
- Runtime behavior for dynamics, keyforms, deformers, clipping, variants, Stage Motion, Body Follow, and Browser Source output is preserved.
- Reports remain copyable and privacy-safe.
- Focused tests and typecheck pass, or failures are classified with concrete evidence.
- No `pnpm install` is run by agents.

## 10. Manual Check Notes

The final report should ask the user to check:

- Open Runtime Player with the real Runtime Export.
- Connect iFacialMocap and OBS Browser Source.
- Confirm normal Browser Source viewing feels less degraded after profiling gating.
- Run Performance Diagnostics with default/shallow mode if present.
- Run Performance Diagnostics with deep profile mode if present.
- Compare:
  - `renderFps`.
  - `appliedLiveFrameFps`.
  - `runtimeCoreSnapshotValidationDurationMs`.
  - `runtimeCoreSnapshotCreationDurationMs`.
  - `runtimeCoreDrawableSnapshotCreationDurationMs`.
  - `runtimeCoreDeformerHierarchyEvaluationDurationMs`.
  - `runtimeCoreWarpDeformerVertexTransformDurationMs`.
- Save updated report to `tmp/report.log`.

## 11. Out of Scope

- Drawable snapshot allocation redesign.
- Warp deformer vertex transform redesign.
- typed-array buffer redesign.
- worker/offscreen rendering.
- iFacialMocap input throttling.
- Stage Motion semantics changes.
- Body Follow semantics changes.
- dynamics algorithm changes.
- Browser Source protocol redesign beyond minimal diagnostics capture gating.
- Runtime Export format changes.
- Editor changes.
- new dependencies.
- `pnpm install`.

## 12. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep implementation scoped to Runtime Player and runtime-core validation/profiling.
- Preserve Browser Source as the primary broadcast path.
- Preserve Wave10 native local preview suspension.
- Preserve Wave11 Stage Motion.
- Preserve Wave12 Live Controller Variant switching.
- Preserve Wave14 runtime evaluation cache.
- Do not expose raw tracking/debug/calibration data in diagnostics or Browser Source messages.
- Do not change Runtime Export format.
- Do not add dependencies or edit lockfile.
- Do not perform broad runtime-core or WebGL renderer rewrites.
- Do not revert unrelated or concurrent changes.
- Add focused tests where behavior is deterministic.
- If a shared file must be touched outside the domain's expected scope, report it before broadening.

## 13. Review Policy

Each implementation domain needs the usual review lanes:

- spec compliance.
- design/development compliance.
- test adequacy.

Reviewers must specifically check:

- validation-off path is explicit and not hidden global state.
- disabling validation does not change runtime semantics.
- deep profiling is gated and not always active.
- Performance Diagnostics remains useful and intentional.
- Browser Source diagnostics remain privacy-safe.
- no broad runtime-core optimization slipped into Wave15.

## 14. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave15 source changes.
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
