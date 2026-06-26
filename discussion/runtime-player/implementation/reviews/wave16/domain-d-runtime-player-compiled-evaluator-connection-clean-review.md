# Runtime Player Wave16 Domain D Clean Review: Runtime Player Compiled Evaluator Connection

- Verdict: pass
- Domain: Runtime Player compiled evaluator connection
- Reviewer: Review-Sylph
- Date: 2026-06-26
- Domain E may proceed: yes

## Scope Reviewed

Reviewed whether Runtime Player now consumes runtime-core's compiled evaluator through the intended Wave16 architecture while preserving Runtime Export DTO/format boundaries, target-local mutable runtime state, Browser Source behavior, validation/profiling gating, privacy, and prior Wave10/Wave14/Wave15 invariants.

This review did not edit source implementation files.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-a-runtime-core-compiled-api-shell-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-a-runtime-core-compiled-api-shell-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-b-compiled-snapshot-static-templates-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-b-compiled-snapshot-static-templates-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-c-compiled-rig-deformer-topology-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-c-compiled-rig-deformer-topology-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave15/wave15-final-integration-report.md`
- `tmp/report.log`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-d-runtime-player-compiled-evaluator-connection-report.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Changed Files Reviewed

- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
- `discussion/runtime-player/implementation/waves/wave16/domain-d-runtime-player-compiled-evaluator-connection-report.md`

Context spot-checks:

- `packages/runtime-core/src/runtime-model.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- relevant Browser Source / renderer regression tests covered by verification

## Findings

No blocking or non-blocking implementation findings.

## Rubric Assessment

| Rubric item | Result | Evidence |
|---|---|---|
| Runtime Player consumes runtime-core compiled evaluator, not hidden app-only cache semantics | Pass | Runtime Player imports `compileRuntimeModel` from runtime-core and stores the resulting runtime-core API object on the scaffold. Pose evaluation calls `RuntimeModelInstance#evaluateFrame`. See `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:13`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:185`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:80`. |
| Runtime Export DTO adaptation remains in Runtime Player and Runtime Export format is unchanged | Pass | `createRuntimeExportEvaluationScaffold` still adapts Runtime Export payloads through `createRuntimeExportRuntimeGraph(...)` before compilation. No package-format/runtime export files were changed by Domain D. See `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:175` and `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts:17`. |
| Runtime Player scaffold/cache stores immutable `CompiledRuntimeModel` | Pass | `RuntimeExportEvaluationScaffold` has `compiledRuntimeModel: CompiledRuntimeModel`, populated once after graph adaptation and keyed by the existing invariant cache key. See `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:50`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:185`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:241`. |
| Mutable `RuntimeModelInstance` is target-local and not stored in shared scaffold cache | Pass | The new `RuntimeExportRuntimeModelInstanceCache` is a separate renderer-owned single-entry cache; scaffold contains only the compiled model. See `apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts:14`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts:28`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:119`. |
| Native Stage and Browser Source do not share one mutable runtime instance | Pass | Each `StaticStageCanvasRendererController` owns its own instance cache. Native Stage creates a static renderer in `stage-window-app.tsx`, while Browser Source creates a separate static renderer through its adapter. See `apps/runtime-player/src/stage/stage-window-app.tsx:44`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts:55`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:119`. |
| Instance lifecycle invalidates/resets on Runtime Export identity, semantic active Variant selection, and other graph-shaping inputs | Pass | Runtime Export payload changes clear both scaffold and instance caches; semantic Variant cache-key changes clear the target-local instance and live state; clear/dispose paths also clear the instance cache. See `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:233`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:263`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:282`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:335`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:555`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:576`. |
| Non-semantic active Variant timestamp churn does not reset compiled model/instance unnecessarily | Pass | The scaffold key uses semantic Variant selection only. Focused tests assert timestamp-only active-selection changes hit the same compiled model. See `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:164` and `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:136`. |
| Browser Source reconnect/resync does not corrupt dynamics/runtime state | Pass | Browser Source resync applies display state, active Variant, profiling, then payload and latest frame; identical payloads are deduplicated, preserving the current renderer target state, while payload/Variant changes still go through renderer invalidation. See `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:256`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:450`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:487`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:507`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:526`. |
| Browser Source and Native Stage stay visually/semantically consistent for the same live frame sequence | Pass | Added focused test uses separate target caches and asserts equal render drawables, parameters, and dynamics tick for the same two-frame sequence. See `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:188`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:195`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:208`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:247`. |
| Stage Motion, Body Follow, dynamics, Variant switching, clipping, Browser Source output are preserved | Pass | Domain D changed only Runtime Player evaluation/cache plumbing. Focused tests cover dynamics/clipping/Variant behavior in evaluation cache, Browser Source client behavior, and renderer frame pacing. Stage Motion/Body Follow paths were not modified. |
| Wave10 native local preview suspension is preserved | Pass | `clearLiveParameterFrame()` still cancels pending live RAF and renders clear/payload/view updates, and the existing live-suspension suite passed. See `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:331` and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts:35`. |
| Wave14 invariant scaffold cache semantics are preserved except additive immutable `CompiledRuntimeModel` | Pass | Scaffold cache key remains based on Runtime Export identity, texture identity, atlas source signature, and semantic active Variant selection; compiled model is added to the scaffold, while snapshots/runtime state remain outside it. See `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:134`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:164`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts:14`. |
| Wave15 validation/profiling gating is preserved | Pass | Runtime Player pose evaluation still defaults `snapshotValidation` to `"skip"` and only passes runtime-core profiling options for `"deep"` mode. Renderer metrics still hide expanded runtime-core phase fields outside deep mode. See `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:102`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:106`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:482`. |
| Privacy boundary remains intact | Pass | Domain D did not add Browser Source messages containing raw tracking/debug/calibration data. Browser Source diagnostics still send renderer metrics only, and Performance Diagnostics privacy exclusions remain documented/tested. See `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:626` and `apps/runtime-player/src/control/performance-diagnostics-report.ts:275`. |
| No public snapshot DTO shape or Runtime Export format changes leaked in | Pass | Runtime Player converts the same runtime snapshot to render drawables, and runtime-core representative tests for compiled snapshot/topology compatibility passed. No Runtime Export/package-format source file is changed by Domain D. |
| No Editor/dependency/lockfile edits | Pass | `git status --short -uall` showed Domain D app/runtime-player files plus accepted Wave16 runtime-core/report files only; no Editor files, package manifests, or lockfiles appeared. |
| Source organization policy is respected | Pass | New production file has one clear responsibility: target-local Runtime Model instance cache. `node scripts/check-source-organization.mjs` passed. See `apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts:14`. |

## Test Adequacy Assessment

Adequate for Domain D risk.

The added Runtime Player test coverage directly exercises scaffold reuse, compiled model reuse under stable Runtime Export / semantically identical active Variant selection, semantic Variant and Runtime Export identity invalidation, separation of Native-style and Browser Source-style target instances, and visual/runtime-state parity for the same live frame sequence.

Existing focused suites cover default pose evaluation, snapshot validation/profiling gating, frame pacing, Wave10 live-suspension behavior, Browser Source resync/message behavior, and the runtime-core compiled API/static-template/topology compatibility baseline. This is sufficient for the implementation gate.

Remaining manual performance proof is intentionally Domain E/user territory: real OBS Browser Source capture against the real Runtime Export is still needed to quantify improvement.

## Verification Commands Run

- `git status --short -uall`
  - Reviewed working tree. Domain D app/runtime-player files are mixed with accepted Domain A-C runtime-core/report files; no Editor, package manifest, lockfile, or package-format source changes appeared.
- `git diff -- <Domain D changed files>`
  - Reviewed tracked Domain D diffs. LF-to-CRLF working-copy warnings only.
- `rg -n "compileRuntimeModel|CompiledRuntimeModel|RuntimeModelInstance|RuntimeExportRuntimeModelInstanceCache|previousState|snapshotValidation|runtimeCoreProfiling|activeVariantSelection|clearLiveParameterFrame|local preview|Browser Source" apps/runtime-player/src packages/runtime-core/src -g "*.ts"`
  - Reviewed compiled evaluator connection, instance lifecycle, profiling/validation, local preview, and Browser Source references.
- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
  - Passed: 2 files / 10 tests.
  - Run with escalation because Vitest/Vite uses child process spawning that is known to fail under the restricted sandbox.
- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
  - Passed: 3 files / 24 tests.
  - Run with escalation for the same Vitest/Vite process-spawn reason.
- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/snapshot-static-templates.test.ts packages/runtime-core/src/rig-control-compiled-topology.test.ts`
  - Passed: 3 files / 12 tests.
  - Run with escalation for the same Vitest/Vite process-spawn reason.
- `pnpm.cmd typecheck`
  - Passed.
  - Run with escalation because the TypeScript toolchain may spawn processes or use caches outside the restricted sandbox.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts discussion/runtime-player/implementation/waves/wave16/domain-d-runtime-player-compiled-evaluator-connection-report.md`
  - Passed with LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts`
  - No whitespace findings; command returned normal no-index diff status with LF-to-CRLF warning only.

`pnpm install` was not run.

## Remaining Risks / Follow-Up

- Real OBS Browser Source performance improvement remains manually unverified until Domain E/user diagnostics run against the real model and compare the metrics listed in the Wave16 plan.
- Browser Source reconnect/resync currently preserves the existing target instance when the payload is deduplicated and Variant semantics are unchanged. This matches the prior live-state continuity behavior; a hard reset on every reconnect would be a separate product decision.
- The compiled model still retains the upstream runtime-core graph reference inherited from Domains A-C. Domain D does not worsen that design caveat.
- `runtimeModelCompileDurationMs` is included in scaffold build profiling but not surfaced as a separate copied diagnostics line; Domain E may decide whether documentation or report interpretation should mention it.

## User-Decision Points

None for Domain D.

## Domain E Gate

Domain E may proceed.
