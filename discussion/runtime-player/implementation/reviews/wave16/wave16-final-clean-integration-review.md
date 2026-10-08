# Runtime Player Wave16 Final Clean Integration Review: Runtime Core Compiled Evaluator v0

- Verdict: pass
- Domain: Final Integration / Docs Alignment
- Reviewer: Review-Sylph
- Date: 2026-06-26

## Findings

No blocking or non-blocking findings.

Wave16 final integration docs/maps/source alignment can pass. The remaining work is manual real-model OBS Browser Source diagnostics, not a source or documentation blocker for the Wave16 integration gate.

## Scope Reviewed

Reviewed Domain E final integration after Domains A-D, using source files, tests, A-D reports/reviews, Wave16 plan, Wave15 baseline, Performance Diagnostics docs, Runtime Player maps, and current working-tree status.

This review did not edit implementation source or docs outside the allowed review artifacts.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave15/wave15-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-a-runtime-core-compiled-api-shell-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-a-runtime-core-compiled-api-shell-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-b-compiled-snapshot-static-templates-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-b-compiled-snapshot-static-templates-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-c-compiled-rig-deformer-topology-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-c-compiled-rig-deformer-topology-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-d-runtime-player-compiled-evaluator-connection-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-d-runtime-player-compiled-evaluator-connection-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- Runtime Player maps under `discussion/runtime-player/`

Source and test spot-check basis:

- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-static-templates.ts`
- `packages/runtime-core/src/rig-control-hierarchy.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `packages/runtime-core/src/snapshot-static-templates.test.ts`
- `packages/runtime-core/src/rig-control-compiled-topology.test.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-page.tsx`

## Rubric Assessment

| Domain E scope item | Result | Evidence |
|---|---|---|
| Compiled evaluator API exists and old APIs remain compatible | Pass | `compileRuntimeModel(graph)` and `runtimeCore.compileRuntimeModel` exist in runtime-core, while `evaluateRuntimeFrame(...)` remains the compatible public frame API. Domain A tests deep-equal compiled and legacy results. |
| `compileRuntimeModel(graph)` is runtime-core graph-based and not Runtime Export DTO based | Pass | `runtime-model.ts` takes `NormalizedRuntimeGraph`; runtime-core forbidden-import scan only found the dependency-boundary test regex. Runtime Export adaptation remains in Runtime Player `createRuntimeExportRuntimeGraph(...)`. |
| `CompiledRuntimeModel` creates target-local mutable `RuntimeModelInstance`s | Pass | `CompiledRuntimeModel#createInstance()` returns a new instance with private mutable state. The instance updates its state from `evaluateFrame(...)`, exposes parsed `getState()`, and supports `reset(...)`. |
| Runtime Player uses compiled model plus target-local runtime instances for live Stage / Browser Source | Pass | `RuntimeExportEvaluationScaffold` stores immutable `compiledRuntimeModel`; `RuntimeExportRuntimeModelInstanceCache` is renderer-target-local; each `StaticStageCanvasRendererController` owns its own instance cache. Domain D tests cover separate native-style and Browser Source-style target instances. |
| Snapshot output shape compatibility is preserved | Pass | Runtime snapshot schema remains `runtime-snapshot-v1`; compiled-vs-legacy equality tests cover API shell, static templates, and rig topology. |
| Previous frame snapshot objects/nested public arrays are not mutated | Pass | Static template tests assert distinct snapshots/drawables/draw lists/mask arrays/UV arrays and mutate previous public arrays before later evaluation. Rig topology tests cover transformed-vertex previous snapshot isolation. |
| Behavior preservation is evidence-backed | Pass | A-D reports/reviews cite focused tests for dynamics/runtime state, keyforms, deformers, clipping, variants, Browser Source output, default pose/load/render, Wave10 local preview suspension, Wave11 Stage Motion, Wave12 Variant switching, Wave14 cache semantics, and Wave15 validation/profiling gating. Broad focused Vitest suites were inherited from A-D and not rerun in this final clean review. |
| Performance Diagnostics remains copyable and privacy-safe | Pass | Copied report formatting includes aggregate metrics and privacy exclusions, and does not format `runtimeModelCompileDurationMs`. Performance Diagnostics capture intentionally toggles `"deep"` profiling only for the selected capture target and disables it on finish/clear/unmount. |
| Docs/maps align with implementation facts | Pass | Final report and maps correctly record Domain E `pass` recommendation pending this review, compiled-path phase interpretation, internal/non-copied `runtimeModelCompileDurationMs`, identical-payload Browser Source continuity, manual `tmp/report.log` request, and Wave17 candidate for final public snapshot DTO allocation cost. |
| No forbidden changes | Pass | Current status/diff checks showed no package manifest, lockfile, Editor, or Runtime Export format/package-format changes. `pnpm install` was not run in this review and A-D/E reports state it was not run by their domains. |

## Verification Run

Run in this final clean review:

- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- packages\runtime-core\src apps\runtime-player\src\stage discussion\runtime-player`
  - Passed with LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL <new/untracked Wave16 final docs>`
  - Checked `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`, `discussion/runtime-player/implementation/waves/wave16/_map.md`, `discussion/runtime-player/implementation/reviews/wave16/_map.md`, and this review report.
  - No whitespace findings; commands returned normal no-index diff status with LF-to-CRLF warnings only.
- `git status --short -uall package.json pnpm-lock.yaml pnpm-workspace.yaml apps\editor packages\package-format packages\runtime-export`
  - No output, confirming no changes in those forbidden areas.
- `rg -n "package-format|@private-2d-rigging-lab/package|RuntimeExport|Runtime Export" packages\runtime-core\src`
  - Only `dependency-boundary.test.ts` regex matched; no runtime-core package-format import was found.

Inherited focused test evidence, not rerun here:

- Domain A: runtime-core compiled API/dependency-boundary focused tests passed.
- Domain B: runtime-core static template, texture/keyform/snapshot, and dependency-boundary focused tests passed.
- Domain C: rig-control compiled topology plus nested warp/rest-bind/keyform/hierarchy focused tests passed.
- Domain D: Runtime Player evaluation cache/default pose, frame pacing, live suspension, Browser Source client, and runtime-core compiled focused tests passed.

`pnpm install` was not run.

## Manual Checks Still Required

Real OBS Browser Source performance improvement is still unverified. The user should run the real setup and save the copied report to `tmp/report.log`:

- Open Runtime Player with the real Runtime Export.
- Connect iFacialMocap.
- Connect OBS Browser Source using the Runtime Player Browser Source URL.
- Run Performance Diagnostics for Browser Source with deep capture.
- Compare `renderFps`.
- Compare `appliedLiveFrameFps`.
- Compare `runtimeCoreEvaluationDurationMs`.
- Compare `runtimeCoreSnapshotCreationDurationMs`.
- Compare `runtimeCoreDrawableSnapshotCreationDurationMs`.
- Compare `runtimeCoreDeformerHierarchyEvaluationDurationMs`.
- Compare `runtimeCoreWarpDeformerVertexTransformDurationMs`.
- Compare `renderDurationMs`.
- Confirm Stage Motion, Body Follow, dynamics, Variant switching parity, Browser Source output, Runtime Export load/render behavior, and Wave10 local preview suspension/resume still work.
- Confirm copied reports do not include raw tracking frames, calibration internals, Browser Source token, private file paths, full Runtime Export payload, Runtime Export textures, or Runtime Export mesh data.
- Save the updated copied report to `tmp/report.log`.

Do not treat `runtimeModelCompileDurationMs` as a copied report comparison metric unless a later implementation exposes it as a copied Performance Diagnostics line.

## Remaining Risks

- Real-model OBS Browser Source smoothness is still a manual product-confidence risk after Wave16.
- Deep Performance Diagnostics capture intentionally enables profiling and may add measurement overhead while capture is active.
- A deep capture can still produce `unknown` / `sampleCount=0` runtime-core phase summaries if no live render evaluation happens during the capture window.
- Browser Source diagnostics are sampled; first/final capture samples can lag the latest deep-profiled frame.
- Public snapshot DTO compatibility still allocates/clones final snapshot objects and arrays by design. If this remains hot after real diagnostics, Wave17 should consider typed/render buffers or direct render-scene output on top of the compiled evaluator foundation.
- Browser Source identical-payload reconnect currently preserves the renderer target instance when Variant semantics are unchanged. A reconnect hard reset would be a separate product decision.
- The compiled model still retains the supplied `NormalizedRuntimeGraph` reference inherited from Domains A-C rather than deep-freezing the entire graph.
