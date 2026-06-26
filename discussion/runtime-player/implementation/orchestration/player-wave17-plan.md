# Runtime Player Wave 17 Plan: Compiled Render Frame Fast Path

> Objective: make Runtime Player live rendering use a renderer-facing compiled frame output path so Browser Source / Native Stage no longer materialize full public runtime snapshots every frame.

## 1. Status

- Status: Ready to launch.
- Planning gate result: inventory first, then plan.
- User decision:
  - The next target is the real runtime performance bottleneck, not a local cosmetic optimization.
  - Preserve the ideal runtime-core architecture direction established by Wave16.
  - Do not replace the compiled evaluator architecture with a Runtime Player-only cache.
- Inventory basis:
  - Wave16 compiled evaluator / runtime instance connection is active.
  - Latest Browser Source deep capture shows:

```text
compiledEvaluatorFrameCount: 69
transientCompileCount: 0
transientInstanceCount: 0
runtimeModelInstanceCacheHitCount: 69
runtimeModelInstanceCacheMissCount: 0
renderFps: 6.9
runtimeCoreEvaluationDurationMs p50 ~= 68.7ms
runtimeCoreSnapshotCreationDurationMs p50 ~= 66.9ms
runtimeCoreDrawableSnapshotCreationDurationMs p50 ~= 39.4ms
runtimeCoreDeformerHierarchyEvaluationDurationMs p50 ~= 27.6ms
runtimeCoreWarpDeformerVertexTransformDurationMs p50 ~= 20.0ms
renderDurationMs p50 ~= 0.7ms
```

- Interpretation:
  - Wave16 is connected correctly.
  - Renderer/WebGL draw time is not the bottleneck.
  - The high-frequency Player render path still pays public snapshot DTO materialization and frame-local rig/deformer output costs.
- Source of truth before implementation:
  - this plan.
  - latest `tmp/report.log` discussed immediately before this plan.
  - [player-wave16-plan.md](player-wave16-plan.md)
  - [wave16-final-integration-report.md](../waves/wave16/wave16-final-integration-report.md)
  - [wave16-followup-compiled-evaluator-proof-diagnostics-report.md](../waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md)
  - [performance-diagnostics.md](../../screens/performance-diagnostics.md)
  - [runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md)

## 2. Product Goal

Runtime Player must feel smooth enough for live broadcast use through OBS Browser Source.

Wave16 proved that compilation and target-local runtime instances are wired, but live Browser Source remains around 7fps on the real model because the renderer path still asks runtime-core for a full public snapshot every applied frame.

Wave17 should make the live render path ask for only the data the renderer needs:

- dynamic per frame:
  - drawable vertices;
  - opacity;
  - draw order;
  - visibility.
- static or scaffold-owned:
  - texture source;
  - UVs;
  - triangles;
  - blend mode;
  - clipping mask IDs;
  - stable drawable index/order metadata;
  - model bounds.

The product-facing outcome is smoother Browser Source and Native Stage live rendering. The implementation-facing subject is `compiled render frame fast path`.

## 3. Accepted Architecture Direction

Wave17 should extend Wave16's architecture rather than replace it.

Current stable shape:

```ts
const compiled = compileRuntimeModel(graph);
const instance = compiled.createInstance();

const frame = instance.evaluateFrame(input);
```

Wave17 target shape:

```ts
const compiled = compileRuntimeModel(graph);
const instance = compiled.createInstance();

const renderFrame = instance.evaluateRenderFrame(input, options, reusableOutput);
```

Important boundary:

- `evaluateFrame(...)` remains the public snapshot-compatible API.
- `evaluateRenderFrame(...)` is an additive renderer-facing fast path.
- Runtime Player live rendering should use `evaluateRenderFrame(...)`.
- Public snapshots remain available for tests, debugging, lower-frequency API use, and compatibility.
- Runtime Export DTO format remains unchanged.
- Runtime Export DTO parsing/adaptation remains outside runtime-core.
- Runtime-core continues to compile/evaluate a `NormalizedRuntimeGraph`, not package-format DTOs.

## 4. Public Snapshot Compatibility

Do not change existing public snapshot shape or freshness guarantees in this wave.

Preserve:

- existing `evaluateRuntimeFrame` compatibility;
- existing `RuntimeModelInstance#evaluateFrame(...)` compatibility;
- fresh public snapshot/drawable object behavior;
- no mutation of previously returned public snapshots;
- existing tests that assert snapshot object freshness.

The fast path avoids public snapshot materialization by being a different API, not by weakening public snapshot semantics.

## 5. Fast Render Frame Semantics

The exact TypeScript names may adapt to existing local conventions, but the semantic boundary is fixed.

Likely runtime-core additions:

```ts
interface RuntimeModelInstance {
  evaluateRenderFrame(input, options?, output?): RuntimeRenderFrameEvaluationResult;
}

interface RuntimeRenderFrameEvaluationResult {
  frame: RuntimeRenderFrame;
  nextState: RuntimeStateDto;
  profile?: RuntimeRenderFrameProfile;
}

interface RuntimeRenderFrame {
  drawables: RuntimeRenderFrameDrawable[];
}

interface RuntimeRenderFrameDrawable {
  drawableId: string;
  index: number;
  vertices: Float32Array | number[];
  opacity: number;
  drawOrder: number;
  visible: boolean;
}
```

Allowed implementation choices:

- Use plain arrays first if typed arrays would make the wave too broad.
- Use reusable mutable output buffers internally if the renderer never treats them as public immutable DTOs.
- Keep renderer-facing output target-local and frame-owned; do not expose it as public snapshot DTO.

Required:

- previous public snapshots remain isolated from later frame evaluation;
- Native Stage and Browser Source must not share one mutable output object;
- Runtime Player must not share one mutable runtime instance across targets;
- fast path must preserve model behavior.

## 6. Runtime Player Integration Direction

Runtime Player should consume the new fast path without becoming the owner of runtime-core semantics.

Expected direction:

- Runtime Export -> `NormalizedRuntimeGraph` adaptation remains unchanged.
- `RuntimeExportEvaluationCache` continues to hold immutable scaffold/static data.
- target-local `RuntimeModelInstance` remains owned per renderer target.
- Runtime Player creates static render templates/scaffold once per Runtime Export identity and semantic active Variant selection.
- live frames use `evaluateRenderFrame(...)` to get dynamic values.
- Runtime Player combines static render templates with dynamic frame values to render without building a public snapshot first.

Preserve:

- Wave10 native local preview suspension;
- Wave11 Stage Motion;
- Wave12 Live Controller Variant switching;
- Wave14 invariant Runtime Export evaluation cache semantics;
- Wave15 validation/profiling gating;
- Wave16 compiled evaluator and target-local instance semantics.

## 7. Diagnostics Direction

Wave17 must prove the new fast path is active without adding meaningful steady-state overhead.

Add or adapt low-cost counters/metrics:

- `compiledRenderFrameCount`
- `publicSnapshotMaterializationCount`
- `runtimeCoreRenderFrameOutputDurationMs`
- existing compiled evaluator proof counters:
  - `compiledEvaluatorFrameCount`
  - `transientCompileCount`
  - `transientInstanceCount`
  - `runtimeModelInstanceCacheHitCount`
  - `runtimeModelInstanceCacheMissCount`

Expected report pattern after Wave17:

```text
compiledRenderFrameCount > 0
publicSnapshotMaterializationCount: 0
transientCompileCount: 0
transientInstanceCount: 0
runtimeModelInstanceCacheHitCount > 0
runtimeModelInstanceCacheMissCount: 0
```

`runtimeCoreSnapshotCreationDurationMs` and `runtimeCoreDrawableSnapshotCreationDurationMs` should be absent, zero, unknown, or not sampled for the fast live path. If retained for compatibility reporting, the report must clearly distinguish public snapshot path cost from fast render frame path cost.

## 8. Wave Strategy

Run mostly sequentially. This wave crosses runtime-core API, Runtime Player renderer input, and diagnostics. Parallel implementation across overlapping files would likely create conceptual drift.

### Dependency Summary

| Domain | Work | Parallel? | Reason |
|---|---|---|---|
| Domain A | runtime-core compiled render frame API | No | Establishes the additive fast output boundary while preserving snapshot API. |
| Domain B | runtime-core fast output internals / public snapshot bypass | No, after A | Implements dynamic renderer-facing frame output and avoids public DTO materialization. |
| Domain C | Runtime Player fast path connection | No, after A-B | Switches Native Stage / Browser Source live render path to the new API. |
| Domain D | Diagnostics / performance report semantics | No, after C | Proves the fast path is active and keeps reports readable/privacy-safe. |
| Domain E | final integration / docs / clean review | No, after A-D | Confirms behavior, docs, manual check instructions, and residual risk. |

If Orch-Sylph can prove Domain D is limited to report formatting after Domain A defines metric names, it may prepare investigation in parallel, but implementation must not touch overlapping files before Domain C settles the data path.

## 9. Domain A: Runtime-Core Render Frame API

Suggested subagent name:

```text
runtime-player-wave17-runtime-core-render-frame-api
```

### Scope

Add the renderer-facing fast output API to runtime-core without changing existing public snapshot behavior.

### Primary Files / Areas

Likely areas:

- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/index.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- focused type/API tests.

### Required Behavior

- `RuntimeModelInstance#evaluateRenderFrame(...)` or equivalent exists as an additive API.
- Existing `RuntimeModelInstance#evaluateFrame(...)` remains compatible.
- Existing `evaluateRuntimeFrame(...)` remains compatible.
- The new API does not require Runtime Export package-format DTOs.
- The new API has an explicit result shape for renderer-facing dynamic data.
- No existing public snapshot DTO shape changes.
- No public snapshot freshness behavior changes.

### Tests

At minimum:

- API exists and can evaluate a deterministic graph.
- existing runtime-core public snapshot tests still pass.
- render frame output contains drawable dynamic fields needed by a renderer.
- render frame API does not mutate a previously returned public snapshot.
- runtime-core package boundary remains free of package-format imports.

Escalate if:

- a clean additive fast API cannot be added without changing public snapshot shape;
- the renderer-facing output needs a broader type decision than this plan covers;
- current runtime-core internals make a safe public/private output split impossible without user discussion.

## 10. Domain B: Runtime-Core Fast Output Internals

Suggested subagent name:

```text
runtime-player-wave17-runtime-core-fast-output-internals
```

### Dependency

Start after Domain A passes.

### Scope

Make the new render frame API avoid public snapshot DTO materialization for the live renderer path.

### Primary Files / Areas

Likely areas:

- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-static-templates.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- relevant runtime-core tests.

### Required Behavior

- render frame path produces dynamic vertices/opacity/drawOrder/visibility without building full public snapshot DTOs.
- `publicSnapshotMaterializationCount` or equivalent remains zero for render frame evaluation.
- per-frame public/debug-only fields are not produced in the fast path.
- per-frame keyforms, dynamics, deformers, clipping-affecting visibility, variants, opacity, and draw order remain semantically correct.
- previous public snapshot compatibility remains intact.
- target-local mutable buffers are not exposed as public snapshot DTOs.

### Tests

At minimum:

- render frame output equals public snapshot-derived render values for deterministic fixtures.
- keyform-driven vertices/opacity/drawOrder/visibility match the public snapshot path.
- dynamics-driven parameter changes still affect output.
- nested warp/rest-bind semantics remain correct.
- variants and visibility rules remain correct.
- public snapshot path still returns fresh snapshots/drawables.
- render frame path does not increment public snapshot materialization counter.

Escalate if:

- public snapshot construction is currently inseparable from core evaluation semantics;
- render frame parity requires copying most public snapshot DTOs anyway;
- deformer evaluation cannot produce renderer-facing dynamic output without a larger internal rewrite.

## 11. Domain C: Runtime Player Fast Path Connection

Suggested subagent name:

```text
runtime-player-wave17-runtime-player-fast-render-path
```

### Dependency

Start after Domains A-B pass.

### Scope

Switch Runtime Player live Stage / Browser Source evaluation to the new runtime-core render frame fast path.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- relevant Runtime Player tests.

### Required Behavior

- Browser Source and Native Stage live render path use render frame fast output.
- Runtime Player still supports default/static pose evaluation where needed.
- target-local `RuntimeModelInstance` semantics are preserved.
- Native Stage and Browser Source do not share mutable output buffers.
- Runtime Export identity / semantic active Variant selection invalidation remains correct.
- Stage Motion, Body Follow, dynamics, Variant switching, clipping, and transparent Browser Source output remain preserved.
- Runtime Export format and Editor export remain unchanged.

### Tests

At minimum:

- evaluated render input can be built from fast render frame output.
- default pose/evaluated runtime export tests still pass.
- Runtime Player cache tests prove instance/scaffold reuse and invalidation.
- Browser Source/Native target separation remains covered where practical.
- Stage Motion and Variant switching tests remain passing.

Escalate if:

- Runtime Player renderer still requires `poseEvaluation.snapshot` in the high-frequency path;
- Browser Source resync/reconnect lifecycle conflicts with reusable render frame outputs;
- switching live path would require Runtime Export schema changes.

## 12. Domain D: Diagnostics / Report Semantics

Suggested subagent name:

```text
runtime-player-wave17-fast-path-diagnostics
```

### Dependency

Start after Domain C or after Domain C exposes stable metric names.

### Scope

Make Performance Diagnostics prove fast path usage and avoid misleading snapshot metrics.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- diagnostics tests.

### Required Behavior

- Performance report includes fast path proof counters.
- Performance report distinguishes public snapshot path metrics from render frame fast path metrics.
- Normal live diagnostics remain light.
- Deep capture can show enough phase detail to compare before/after.
- Report remains copyable and privacy-safe.
- Reports do not include raw tracking frames, calibration internals, Browser Source token, private file paths, full Runtime Export payload, textures, or mesh data.

### Tests

At minimum:

- metrics validation accepts new counters and durations.
- report rendering displays new counters clearly.
- missing/unknown metrics remain handled gracefully.
- privacy exclusions remain true.

Escalate if:

- fast path proof requires high-overhead profiling;
- old report fields cannot be kept understandable without a user-facing terminology decision.

## 13. Domain E: Final Integration / Docs Alignment / Clean Review

Suggested subagent name:

```text
runtime-player-wave17-final-integration-fast-render-frame
```

### Scope

Run after Domains A-D complete.

### Required Behavior

- Confirm Runtime Player live rendering uses fast render frame path.
- Confirm public snapshot API remains compatible.
- Confirm Runtime Export format is unchanged.
- Confirm Editor export regeneration is not required by the implementation itself.
- Confirm Browser Source and Native Stage remain semantically consistent.
- Confirm no new dependencies or lockfile changes.
- Confirm no Editor changes.
- Confirm no package-format runtime schema changes.
- Confirm Performance Diagnostics still works and explains the new metrics.
- Write final reports/reviews under:
  - `discussion/runtime-player/implementation/waves/wave17/`
  - `discussion/runtime-player/implementation/reviews/wave17/`

Docs/maps to update as implementation facts require:

- [performance-diagnostics.md](../../screens/performance-diagnostics.md)
- Runtime Player implementation maps.
- Runtime Player backlog if performance items change status.

The final integration scope must include:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

### Manual Check Notes

The final report should ask the user to check:

- Open Runtime Player with the real Runtime Export.
- Connect iFacialMocap.
- Connect OBS Browser Source.
- Run Performance Diagnostics for Browser Source with deep capture.
- Save updated report to `tmp/report.log`.
- Compare before/after:
  - `renderFps`
  - `appliedLiveFrameFps`
  - `compiledRenderFrameCount`
  - `publicSnapshotMaterializationCount`
  - `runtimeCoreRenderFrameOutputDurationMs`
  - `runtimeCoreEvaluationDurationMs`
  - `runtimeCoreSnapshotCreationDurationMs`
  - `runtimeCoreDrawableSnapshotCreationDurationMs`
  - `runtimeCoreDeformerHierarchyEvaluationDurationMs`
  - `runtimeCoreWarpDeformerVertexTransformDurationMs`
  - `renderDurationMs`

## 14. Acceptance Criteria

- Runtime-core exposes additive renderer-facing fast render frame API.
- Existing public snapshot APIs remain compatible.
- Public snapshot DTO shape and freshness semantics remain preserved.
- Runtime Player Browser Source / Native Stage live path uses fast render frame output.
- Stable Browser Source capture shows:
  - `compiledRenderFrameCount > 0`;
  - `publicSnapshotMaterializationCount = 0` for stable live render frames;
  - `transientCompileCount = 0`;
  - `transientInstanceCount = 0`;
  - runtime instance cache hits increase and misses remain zero after warm path.
- `runtimeCoreSnapshotCreationDurationMs` and `runtimeCoreDrawableSnapshotCreationDurationMs` are removed from the hot live path, zero, unknown, or clearly marked as public-snapshot-path-only.
- Dynamics, keyforms, deformers, clipping, variants, Stage Motion, Body Follow, Browser Source output, and Runtime Export load/render behavior remain preserved.
- Performance Diagnostics remains copyable and privacy-safe.
- Focused tests and typecheck pass, or failures are classified with concrete evidence.
- No `pnpm install` is run by agents.
- No Runtime Export format changes.
- No Editor changes.
- No package-format schema changes.
- No new dependencies or lockfile edits.

Performance expectation:

- `renderFps` and `appliedLiveFrameFps` should improve materially on real Browser Source capture.
- `runtimeCoreEvaluationDurationMs` should drop materially because public snapshot creation is bypassed.
- If deformer vertex transform remains the next bottleneck after snapshot bypass, the final report must identify it as the next target rather than hiding the residual cost.

## 15. Out of Scope

- Runtime Export format changes.
- Editor changes.
- package-format schema changes.
- new dependencies.
- lockfile edits.
- `pnpm install`.
- WebGL renderer rewrite.
- render-webgl2 typed-array upload optimization unless a small compatibility patch is strictly required.
- worker/offscreen rendering.
- dirty graph / partial invalidation system.
- Browser Source protocol redesign beyond necessary sanitized metric additions.
- Spout2 sender.
- OBS automation/source creation.

## 16. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep Wave17 centered on runtime-core compiled render frame fast path.
- Do not replace the ideal architecture with a Runtime Player-only cache.
- Preserve public snapshot API compatibility.
- Preserve Browser Source as the primary broadcast path.
- Preserve Wave10 native local preview suspension.
- Preserve Wave11 Stage Motion.
- Preserve Wave12 Live Controller Variant switching.
- Preserve Wave14 runtime evaluation cache semantics.
- Preserve Wave15 validation/profiling gating.
- Preserve Wave16 compiled evaluator and target-local instance semantics.
- Do not expose raw tracking/debug/calibration data in diagnostics or Browser Source messages.
- Do not change Runtime Export format.
- Do not add dependencies or edit lockfile.
- Do not revert unrelated or concurrent changes.
- Add focused tests where behavior is deterministic.
- If a shared file must be touched outside the domain's expected scope, report it before broadening.

## 17. Review Policy

Each implementation domain needs review lanes:

- spec compliance;
- design/development compliance;
- test adequacy.

Reviewers must specifically check:

- fast path is an additive runtime-core API, not a hidden app-only cache;
- public snapshot APIs remain compatible;
- public snapshot freshness/mutation guarantees remain intact;
- Runtime Player live path no longer requires public snapshot materialization;
- Native Stage and Browser Source do not share mutable runtime instances or mutable output buffers;
- runtime-core does not import Runtime Export package-format DTOs;
- Runtime Export format is unchanged;
- dynamics/keyforms/deformers/clipping/variants/Stage Motion/Body Follow remain preserved;
- diagnostics prove fast path usage without high steady-state overhead.

## 18. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave17 source changes.
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
