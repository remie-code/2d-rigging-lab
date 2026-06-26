# Runtime Player Wave 16 Plan: Runtime Core Compiled Evaluator v0

> Objective: introduce runtime-core's first-class compiled evaluator architecture, preserving current snapshot output compatibility while moving static model structure out of the per-frame hot path.

## 1. Status

- Status: Ready to launch.
- Planning gate result: inventory first, then plan.
- User decision:
  - The desired direction is `compiled evaluator architecture`.
  - Avoid short-term Runtime Player-only caches that move the implementation away from the ideal runtime-core design.
  - Pay the architectural cost that should be paid now.
- Inventory basis:
  - Wave15 removed the targeted validation/profiling overhead.
  - Browser Source rendering is still insufficient because runtime-core evaluation dominates the frame.
  - The next wave is the main runtime performance architecture wave, not a local cache patch.
- Source of truth before implementation:
  - this plan.
  - latest `tmp/report.log` discussed immediately before this plan.
  - [player-wave15-plan.md](player-wave15-plan.md)
  - [wave15-final-integration-report.md](../waves/wave15/wave15-final-integration-report.md)
  - [performance-diagnostics.md](../../screens/performance-diagnostics.md)
  - [runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md)

## 2. Product Goal

Runtime Player must render a real model smoothly enough for live use through OBS Browser Source.

After Wave15, the renderer itself is not the bottleneck:

```text
inputReceiveFpsLatest ~= 59.9
liveFrameMessageFps ~= 59.4
renderFps ~= 12.3
renderDurationMs p50 ~= 0.9ms
runtimeCoreEvaluationDurationMs p50 ~= 67.4ms
runtimeCoreSnapshotCreationDurationMs p50 ~= 67.2ms
runtimeCoreDrawableSnapshotCreationDurationMs p50 ~= 40.3ms
runtimeCoreDeformerHierarchyEvaluationDurationMs p50 ~= 26ms
runtimeCoreWarpDeformerVertexTransformDurationMs p50 ~= 18.5ms
runtimeCoreSnapshotValidationDurationMs p50 = 0
```

Wave16 should therefore introduce the architecture needed to stop rebuilding static runtime model structure every frame.

The product-facing outcome is better live smoothness. The implementation-facing subject is `runtime-core compiled evaluator v0`.

## 3. Accepted Architecture Direction

Wave16 should move runtime-core toward this shape:

```ts
const compiled = compileRuntimeModel(graph);
const instance = compiled.createInstance();

const frame = instance.evaluateFrame(input);
```

Important boundary:

- `runtime-core` should compile a `NormalizedRuntimeGraph`, not a literal Runtime Export DTO.
- Runtime Export DTO parsing/adaptation remains outside runtime-core.
- Runtime Player continues to adapt Runtime Export payloads into runtime-core graph data before compilation.

This respects the existing dependency boundary where `runtime-core` must not import `package-format`.

### 3.1 Compiled Model

`CompiledRuntimeModel` is the immutable model-level evaluation artifact.

It may be shared between Native Stage and Browser Source targets.

It owns static or topology-derived data such as:

- static drawable snapshot templates;
- reference/base vertex streams;
- texture / UV projection templates;
- mask and clipping topology;
- deformer hierarchy topology;
- affected drawable / effect-chain lookup;
- parameter order/default/min/max lookup;
- sorted keyform binding and target lookup.

### 3.2 Runtime Instance

`RuntimeModelInstance` is mutable and target-local.

It must not be shared between Native Stage and Browser Source.

It owns frame/runtime state such as:

- mutable runtime state / dynamics state;
- frame-local scratch;
- evaluated parameter values;
- keyform samples;
- evaluated rig-control results;
- drawable work arrays;
- reusable internal buffers, if they are copied/freshened before exposed as snapshot DTOs.

### 3.3 Snapshot Compatibility

Existing snapshot output shape remains compatible in Wave16.

Do not:

- change Runtime Export format;
- change public snapshot DTO shape;
- expose reused internal buffers as mutable output DTO arrays;
- reuse/mutate the same snapshot object across frames;
- mutate a previously returned snapshot.

Fresh outer snapshot/drawable objects remain required even if their static inputs are compiled and reused.

## 4. Accepted Non-Goals

Wave16 does not include:

- typed-array full rewrite;
- direct render-buffer output;
- worker/offscreen rendering;
- dirty graph / partial invalidation system;
- Runtime Export format changes;
- Browser Source protocol redesign;
- Renderer/WebGL architecture rewrite;
- Editor changes;
- new dependencies;
- `pnpm install`.

If Wave16 still leaves runtime-core too slow, Wave17 should consider typed/render buffers or direct render scene output on top of the compiled evaluator foundation.

## 5. API Direction

The exact TypeScript signatures may adapt to existing DTO names, but the semantic boundary is fixed.

Likely new file:

```text
packages/runtime-core/src/runtime-model.ts
```

Likely exports:

```ts
compileRuntimeModel(graph, options?): CompiledRuntimeModel

interface CompiledRuntimeModel {
  createInstance(options?): RuntimeModelInstance;
}

interface RuntimeModelInstance {
  evaluateFrame(input, options?): RuntimeFrameEvaluationResult;
  getState?(): RuntimeStateDto;
  reset?(state?): void;
}
```

Export surfaces:

- `packages/runtime-core/src/index.ts`
- the existing `runtimeCore` object, as additive API only.

Compatibility requirement:

- existing `evaluateRuntimeFrame` signature and result shape remain unchanged.
- existing conservative validation default remains unchanged.
- Runtime Player normal Stage / Browser Source live evaluation continues to request `snapshotValidation: "skip"` where appropriate.
- legacy `evaluateRuntimeFrame` may internally compile transiently and delegate, but callers must not be forced to adopt the compiled API in the same wave.

## 6. Compiled Content Classification

### 6.1 v0

Implement these as part of Wave16 if feasible within the domain boundary:

- static drawable snapshot templates from the current `createEvaluatedDrawables` path.
- reference/base vertex streams from the current `createReferenceVerticesByDrawableId` path.
- texture / UV snapshot templates from texture projection helpers and drawable texture DTO generation.
- mask snapshot topology from mask relation generation.
- deformer hierarchy topology from rig-control hierarchy evaluation.
- affected drawable / effect-chain lookup used by rig-control transform application.
- parameter default/min/max/order lookup.
- sorted keyform binding / target lookup.

### 6.2 Later

Defer until after v0 proves the architecture:

- typed vertex buffers;
- double buffers;
- direct render-scene output;
- worker/offscreen runtime evaluation;
- incremental dirty evaluation;
- Runtime Export format-aware compile API.

### 6.3 Unsafe In Wave16

Do not implement:

- changing Runtime Export or snapshot DTO shapes;
- exposing reused internal buffers as public snapshot arrays;
- global hidden `WeakMap` evaluator cache;
- importing `package-format` into runtime-core;
- sharing one mutable runtime instance between Native Stage and Browser Source.

## 7. Runtime Player Integration Direction

Runtime Player should connect to the compiled evaluator without making Runtime Player the owner of runtime-core semantics.

Expected direction:

- Runtime Export -> `NormalizedRuntimeGraph` adaptation remains in Runtime Player adapter code.
- `RuntimeExportEvaluationCache` may hold the immutable `CompiledRuntimeModel` as part of its scaffold.
- `RuntimeExportEvaluationCache` must not hold mutable `RuntimeModelInstance` as shared scaffold state.
- Native Stage and Browser Source each own target-local `RuntimeModelInstance`.
- Existing texture/render templates and WebGL scaffold cache remain Runtime Player responsibilities.
- `runtime-export-pose-evaluator.ts` should accept or resolve the compiled model / instance path and avoid recompiling/adapting when scaffold is valid.

Preserve:

- Wave10 local preview suspension;
- Wave11 Stage Motion;
- Wave12 Variant switching;
- Wave14 invariant Runtime Export evaluation cache;
- Wave15 validation/profiling gating.

## 8. Wave Strategy

Wave16 should run mostly sequentially. This is intentional.

The work is architectural and touches shared runtime-core seams. Parallelizing implementation domains across overlapping files would likely create conflict and conceptual drift.

### Dependency Summary

| Domain | Work | Parallel? | Reason |
|---|---|---|---|
| Domain A | runtime-core compiled evaluator API shell | No | Establishes public API, compatibility shape, and state boundary. |
| Domain B | compiled snapshot/static templates | No, after A | Depends on compiled model shell and touches snapshot materialization. |
| Domain C | compiled rig/deformer topology | No, after B or after A if implementation proves independent | Uses compiled model topology and must preserve nested warp/rest-bind semantics. |
| Domain D | Runtime Player connection | No, after A-C | Runtime Player should consume the compiled evaluator, not invent a side cache. |
| Domain E | final integration / docs / performance interpretation | No, after A-D | Confirms behavior, docs, and manual diagnostics instructions. |

If an Orch-Sylph determines Domain B and C can be safely separated after Domain A, it may propose that to Undine, but must not run overlapping implementation without explicit approval.

## 9. Domain A: Runtime-Core API Shell

Suggested subagent name:

```text
runtime-player-wave16-runtime-core-compiled-api-shell
```

### Scope

Introduce the first-class compiled evaluator API without changing runtime behavior.

### Primary Files / Areas

Likely areas:

- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/index.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- runtime-core type exports and dependency-boundary tests.

### Required Behavior

- `compileRuntimeModel(graph)` exists as a runtime-core API.
- `CompiledRuntimeModel#createInstance()` exists.
- `RuntimeModelInstance#evaluateFrame(...)` exists and returns the same result shape as the compatible frame evaluation path.
- Existing `evaluateRuntimeFrame` remains compatible for all current callers.
- `runtime-core` does not import Runtime Export package-format DTOs.
- No behavior changes for dynamics, keyforms, deformers, clipping, variants, or snapshot validation defaults.

### Tests

At minimum:

- compiled evaluator returns a frame result deep-equal to legacy `evaluateRuntimeFrame` for deterministic fixtures.
- legacy `evaluateRuntimeFrame` tests still pass unchanged or with only additive expectations.
- compiled instance returns a fresh snapshot object for consecutive frames.
- previous snapshot is not mutated by later evaluations.
- dependency boundary remains intact.

Escalate if:

- adding the API requires changing snapshot DTO shape;
- runtime-core cannot accept `NormalizedRuntimeGraph` without a larger type-boundary decision;
- existing tests depend on internals that make first-class API impossible without user decision.

## 10. Domain B: Compiled Snapshot / Static Templates

Suggested subagent name:

```text
runtime-player-wave16-compiled-snapshot-static-templates
```

### Dependency

Start after Domain A passes.

### Scope

Move safe static snapshot inputs into the compiled model while preserving fresh frame output.

### Primary Files / Areas

Likely areas:

- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/snapshot.ts`
- texture projection helpers;
- mask relation helpers;
- parameter and keyform sampling helpers if lookup extraction is needed;
- focused runtime-core tests.

### Required Behavior

- reference/base vertex streams are compiled once per compiled model where safe.
- static drawable metadata/templates are compiled once per compiled model where safe.
- texture / UV projection templates are compiled where safe.
- mask topology is compiled where safe.
- output snapshots and exposed nested arrays remain fresh enough that previous frame snapshots cannot be mutated by later frames.
- full snapshot detail remains available and compatible.
- profiling phase names remain meaningful; if phase meanings change, update docs/report interpretation in Domain E.

### Tests

At minimum:

- compiled and legacy/transient outputs are deep-equal for full snapshots.
- two consecutive compiled instance evaluations return distinct snapshot/drawable objects.
- previous snapshot nested arrays are not mutated by later frames.
- keyform-driven opacity/visibility/drawOrder/vertices still affect output correctly.
- `runtimeCoreDrawableSnapshotCreationDurationMs` remains reported or is explicitly reinterpreted.

Escalate if:

- static sharing would expose mutable arrays to snapshot consumers;
- a static template cannot be safely separated from keyform-driven values;
- preserving snapshot compatibility removes all useful performance value from the domain.

## 11. Domain C: Compiled Rig / Deformer Topology

Suggested subagent name:

```text
runtime-player-wave16-compiled-rig-deformer-topology
```

### Dependency

Start after Domain A. Prefer after Domain B unless Orch-Sylph escalates a safe separation plan.

### Scope

Move graph-topology-only rig/deformer hierarchy work into the compiled model.

### Primary Files / Areas

Likely areas:

- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/rig-control-hierarchy.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/rig-control-*.test.ts`

### Required Behavior

- ordered rig IDs, descendants, declared child drawable IDs, blocked IDs, and topology diagnostics are reusable from the compiled model where safe.
- affected drawable / direct parent / effect-chain lookup is reusable where safe.
- per-frame rig-control samples, parameter/keyform values, dynamics state, opacity, and vertex transforms remain per-frame.
- nested warp rest/bind semantics remain unchanged.
- disabled/invalid rig-control diagnostics remain unchanged.
- profiling phase names remain meaningful.

### Tests

At minimum:

- existing nested warp rest/bind tests pass.
- rig-control hierarchy evidence tests pass.
- keyform-driven rig-control tests pass.
- compiled output deep-equals legacy/transient output.
- compiled topology reuse does not skip per-frame parameter/keyform changes.

Escalate if:

- hierarchy diagnostics depend on mutable frame values more than expected;
- effect-chain lookup cannot be compiled without changing invalid/blocked behavior;
- topology reuse creates ambiguity for nested deformers.

## 12. Domain D: Runtime Player Connection

Suggested subagent name:

```text
runtime-player-wave16-runtime-player-compiled-evaluator-connection
```

### Dependency

Start after Domains A-C pass.

### Scope

Use the compiled evaluator from Runtime Player without changing user-facing behavior.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- relevant Runtime Player tests.

### Required Behavior

- Runtime Player adapts Runtime Export payload to runtime-core graph as before.
- Runtime Player scaffold/cache stores immutable `CompiledRuntimeModel`.
- Native Stage and Browser Source create/own separate mutable `RuntimeModelInstance`s.
- instance reset/invalidation happens when Runtime Export identity, semantic active Variant selection, or other graph-shaping inputs change.
- Browser Source and Native Stage remain visually/semantically consistent for the same live frame sequence.
- Stage Motion, Body Follow, dynamics, Variant switching, clipping, and Browser Source output remain preserved.
- Wave14 invariant scaffold cache semantics remain preserved.

### Tests

At minimum:

- Runtime Player evaluation cache reuses `CompiledRuntimeModel` for stable Runtime Export / Variant selection.
- Runtime Player does not share mutable runtime instance across targets.
- Runtime Export / Variant change invalidates compiled model and target instances.
- default pose evaluation tests still pass.
- Browser Source / Native-style evaluated scene parity remains covered where feasible.

Escalate if:

- Runtime Player cannot own target-local instances without broad renderer/controller redesign;
- existing Browser Source reconnection or Wave10 local preview suspension conflicts with instance lifecycle;
- integration would require Runtime Export format changes.

## 13. Domain E: Final Integration / Performance Interpretation / Docs

Suggested subagent name:

```text
runtime-player-wave16-final-integration-compiled-evaluator
```

### Scope

Run after Domains A-D complete.

### Required Behavior

- Confirm compiled evaluator API exists and old APIs remain compatible.
- Confirm Runtime Player uses compiled model + target-local instance.
- Confirm snapshot output compatibility.
- Confirm no behavior changes for dynamics, keyforms, deformers, clipping, variants, Stage Motion, Body Follow, Browser Source output.
- Confirm no Runtime Export format changes.
- Confirm no Editor changes.
- Confirm no new dependencies or lockfile changes.
- Confirm Performance Diagnostics still works.
- Write final reports/reviews under:
  - `discussion/runtime-player/implementation/waves/wave16/`
  - `discussion/runtime-player/implementation/reviews/wave16/`

Docs/maps to update as implementation facts require:

- [performance-diagnostics.md](../../screens/performance-diagnostics.md)
- Runtime Player implementation maps.
- Runtime Player backlog if a compiled evaluator or performance item needs status update.

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
- Compare before/after values:
  - `renderFps`
  - `appliedLiveFrameFps`
  - `runtimeCoreEvaluationDurationMs`
  - `runtimeCoreSnapshotCreationDurationMs`
  - `runtimeCoreDrawableSnapshotCreationDurationMs`
  - `runtimeCoreDeformerHierarchyEvaluationDurationMs`
  - `runtimeCoreWarpDeformerVertexTransformDurationMs`
  - `renderDurationMs`
- Save updated report to `tmp/report.log`.

## 14. Acceptance Criteria

- Runtime-core exposes first-class compiled evaluator v0.
- `compileRuntimeModel(graph)` does not depend on Runtime Export package-format DTOs.
- `CompiledRuntimeModel` can create target-local `RuntimeModelInstance`s.
- Existing `evaluateRuntimeFrame` remains compatible.
- Runtime Player uses compiled model and target-local instances for live Stage / Browser Source evaluation.
- Existing snapshot output shape is preserved.
- Snapshot objects and exposed nested output arrays are not reused in a way that mutates previous frames.
- Dynamics, keyforms, deformers, clipping, variants, Stage Motion, Body Follow, Browser Source output, and Runtime Export load/render behavior remain preserved.
- Performance Diagnostics remains copyable and privacy-safe.
- Focused tests and typecheck pass, or failures are classified with concrete evidence.
- No `pnpm install` is run by agents.
- No Runtime Export format changes.
- No Editor changes.
- No new dependencies or lockfile edits.

Performance expectation:

- `runtimeCoreSnapshotCreationDurationMs` and/or `runtimeCoreDrawableSnapshotCreationDurationMs` should improve meaningfully for real Browser Source capture.
- If final snapshot DTO compatibility prevents enough improvement, the final report must clearly identify the remaining cost and recommend Wave17's next target.

## 15. Out of Scope

- typed-array full rewrite.
- direct render-buffer output.
- worker/offscreen rendering.
- dirty evaluation system.
- Browser Source protocol redesign.
- Renderer/WebGL architecture rewrite.
- Runtime Export format changes.
- Editor changes.
- new dependencies.
- lockfile edits.
- `pnpm install`.

## 16. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep Wave16 centered on runtime-core compiled evaluator architecture.
- Do not replace the ideal architecture with a Runtime Player-only cache.
- Preserve Browser Source as the primary broadcast path.
- Preserve Wave10 native local preview suspension.
- Preserve Wave11 Stage Motion.
- Preserve Wave12 Live Controller Variant switching.
- Preserve Wave14 runtime evaluation cache semantics unless the change is explicitly part of Domain D and reviewed.
- Preserve Wave15 validation/profiling gating.
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

- compiled evaluator is first-class runtime-core API, not hidden app cache;
- runtime-core does not import Runtime Export package-format DTOs;
- old APIs remain compatible;
- compiled model is immutable/shareable;
- runtime instance is mutable and target-local;
- fresh snapshot compatibility is preserved;
- previous snapshots are not mutated;
- nested warp/rest-bind semantics remain unchanged;
- Runtime Player does not share mutable instances across Native Stage / Browser Source;
- performance diagnostics still report enough detail to evaluate the wave.

## 18. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave16 source changes.
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
