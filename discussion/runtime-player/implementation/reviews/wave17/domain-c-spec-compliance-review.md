# Wave17 Domain C Spec Compliance Review

Verdict: pass

- Review lane: spec compliance
- Domain: Runtime Player fast render path connection
- Date: 2026-06-26
- Reviewer: Review-Sylph

## Basis Used

- `discussion/_conventions.md`
- `discussion/_map.md`
- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-a-runtime-core-render-frame-api-report.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-b-runtime-core-fast-output-internals-report.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-b-spec-compliance-review.md`
- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

## Changed Files Reviewed

Reviewed the actual changed-file diff with:

- `git diff -- apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`

Changed files reviewed:

- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`

Additional call-site/context checks:

- `rg -n "createEvaluatedRuntimeExportStageRenderInput|poseEvaluationMode|evaluateRuntimeExportPose|evaluateRuntimeExportRenderFrame|poseEvaluation\\.snapshot|poseEvaluation\\.renderFrame|runtimeModelInstanceCache|activeVariantSelection|RuntimeExportStagePoseEvaluation" apps/runtime-player/src/stage`
- `rg -n "evaluateRenderFrame|publicSnapshotMaterializationCount|compiledRenderFrameCount|runtimeCoreRenderFrameOutputDurationMs|RuntimeRenderFrame" packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-profiling.ts`
- `rg -n "createStaticStageCanvasRenderer\\(|new BrowserSourceStageRendererAdapter|alpha: true|setPayload\\(|setLiveParameterFrame\\(" apps/runtime-player/src/stage/stage-window-app.tsx apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`

`git status --short -uall` also showed in-progress Wave17 runtime-core/domain documents and `discussion/runtime-player/implementation/_map.md`. No package manifest, lockfile, Editor file, Runtime Export schema file, or package-format production file was part of the reviewed Domain C changed-file set.

## Findings

No spec-compliance findings.

## Spec Compliance Checklist

- Pass - Browser Source and Native Stage live render path now use render frame fast output. `createEvaluatedRuntimeExportStageRenderInput(...)` defaults to `poseEvaluationMode ?? "render-frame"` and calls `evaluateRuntimeExportRenderFrame(...)` at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:109`. The shared live renderer calls this builder from Variant re-evaluation, clear-live-frame re-evaluation, and live frame application without overriding the mode at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:302`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:348`, and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:657`. Browser Source wraps the same static renderer through its own adapter at `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts:55`.
- Pass - default/static pose evaluation remains available where needed. `evaluateRuntimeExportPose(...)` still returns full public snapshots at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:67`, and initial payload/default rendering explicitly requests `poseEvaluationMode: "snapshot"` at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:238`. Snapshot diagnostics are preserved for snapshot-mode results and safely empty for render-frame results at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:964`.
- Pass - target-local `RuntimeModelInstance` semantics are preserved. The render input builder still resolves instances through the optional target-owned `runtimeModelInstanceCache` at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:92`. The renderer controller owns and clears its own instance cache on payload reload, semantic Variant key changes, clear, and dispose at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:236`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:286`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:340`, and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:596`.
- Pass - Native Stage and Browser Source do not share mutable render-frame output buffers in the reviewed path. Domain B's runtime-core render-frame output clones vertices before exposure, and Domain C additionally maps render-frame drawables into fresh render drawable inputs and mesh vertices at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:258` and `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:221`. The target-separation test asserts native/browser scene equality while also asserting distinct render-frame objects and vertex arrays at `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:244`.
- Pass - Runtime Export identity and semantic active Variant selection invalidation remain correct. Scaffold access continues to key by payload identity plus semantic active Variant selection at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:81`. Tests preserve same-semantic Variant scaffold reuse, distinct target instances, semantic Variant invalidation, and payload reload invalidation at `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:93`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:135`, and `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:176`.
- Pass - Stage Motion, Body Follow, dynamics, Variant switching, clipping, and render behavior are preserved to the extent Domain C can prove in code/tests. Live frame application still passes authored parameters, frame index, delta time, reset reasons, profiling mode, scaffold cache, and target instance cache into the evaluation path at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:657`. Render composition continues to take UVs, triangles, blend mode, and clipping from static scaffold templates while dynamic vertices/opacity/draw order/visibility come from render-frame output at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:221`. Focused tests cover dynamic vertices, opacity, draw order, clipping, Variant invalidation, dynamics next-state consistency, and native/browser visual parity.
- Pass - transparent Browser Source output is not changed by Domain C. Browser Source still constructs a separate static renderer adapter, and the WebGL availability probe still requests `alpha: true` at `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts:123`; the changed-file diff does not alter Browser Source canvas or renderer setup.
- Pass - Runtime Export format and Editor export remain unchanged. The reviewed Domain C source diff is limited to Runtime Player stage evaluation/rendering files and focused tests. The only package-format references in the changed files are existing test fixture imports.
- Pass - Domain C did not take Domain D diagnostics/report semantics beyond minimal compile-safe plumbing. The change carries runtime-core profiles through the existing evaluation profile, preserves snapshot diagnostics for snapshot-mode `setPayload(...)`, and makes render-frame diagnostic details empty instead of attempting to redesign Performance Diagnostics report wording. Report display/metrics naming remains Domain D scope.

## Verification Run

- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
  - Passed with escalation for process/cache access: 3 files / 15 tests.
- `pnpm.cmd typecheck`
  - Passed with escalation for process/cache access.
- `git diff --check -- apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
  - No whitespace findings; CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL discussion/runtime-player/implementation/reviews/wave17/domain-c-spec-compliance-review.md`
  - No whitespace findings; command returned normal no-index diff status with a CRLF working-copy warning.

`pnpm install` was not run.

## Residual Risks

- Real OBS Browser Source performance improvement and proof-counter report output remain unverified until Domain D/final integration and a user-captured real-model Performance Diagnostics report.
- Stage Motion and Body Follow were not manually exercised in this review. The live path still passes the same live frame timing/state inputs, and the focused tests cover deterministic render-frame/cache behavior, but full product behavior remains an integration/manual check item.
- Performance Diagnostics copied-report wording for the new fast-path counters and snapshot-vs-render-frame phase interpretation remains Domain D scope. Domain C leaves existing snapshot phase metric plumbing in place.
