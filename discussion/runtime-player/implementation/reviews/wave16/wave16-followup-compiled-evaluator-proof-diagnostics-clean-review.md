# Runtime Player Wave16 Follow-up Clean Review: Compiled Evaluator Proof Diagnostics

- Verdict: pass
- Reviewer: Review-Sylph
- Date: 2026-06-26
- Review objective: verify the Wave16 follow-up diagnostics/proof metrics for correctness, scope compliance, backward compatibility, and test adequacy.

## Basis Checked

- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-d-runtime-player-compiled-evaluator-connection-report.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md`
- `tmp/report.log`
- `discussion/development_convention/source-file-organization-policy.md`
- Current source and tests in the follow-up file list.

`tmp/report.log` is a pre-follow-up Browser Source capture and does not yet contain the new proof counters. I used it as baseline context only, not as proof that the new copied-report fields have appeared in a real OBS capture.

## Findings

No blocking, major, or minor findings.

## Evidence

Compiled evaluator proof counters are wired from evaluation to copied report:

- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:69`-`87` records whether evaluation had to transiently compile and/or create a transient instance.
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:125`-`143` returns `compiledEvaluatorFrameCount`, `transientCompileCount`, and `transientInstanceCount` in the evaluation profile.
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:80`-`99` passes a target-local cached `RuntimeModelInstance` when available, and passes the scaffold compiled model otherwise.
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:127`-`151` propagates evaluator proof counters plus scaffold-build profiling into the render-input evaluation profile.
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:655`-`680` records live render-input evaluation profiles, and `static-stage-canvas-renderer.ts:880`-`950` monotonically adds the evaluator/profiling counters.

Target-local runtime model instance reuse is exposed separately from scaffold cache reuse:

- `apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts:29`-`67` tracks hit, miss, and invalidation counts for the target-local instance cache.
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:93`-`122` separately tracks scaffold cache hit/miss and scaffold build profile; `runtime-export-evaluation-cache.ts:132`-`140` exposes scaffold cache metrics and cold-path compile samples.
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:429`-`469` includes both scaffold cache counters and runtime model instance cache counters in render metrics snapshots.
- Lifecycle clearing is present for payload load/reload, semantic Variant changes, live-frame clear, clear, and dispose at `static-stage-canvas-renderer.ts:235`-`241`, `284`-`306`, `334`-`353`, and `566`-`596`.

Copied report behavior is compatible and clear:

- New Browser Source metrics fields are optional in `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:19`-`31`.
- Missing optional fields normalize to `0` or `null` in `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:126`-`158` and `432`-`442`; malformed metrics remain rejected or dropped through the existing validator boundary.
- Unknown unsafe fields are stripped by reconstructing validated DTOs, covered by `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:12`-`22`.
- Report delta logic uses monotonic end-start deltas with a non-negative clamp in `apps/runtime-player/src/control/performance-diagnostics-report.ts:863`-`879`.
- The copied report keeps legacy `evaluationCache*` lines and adds explicit `scaffoldEvaluationCache*` lines at `apps/runtime-player/src/control/performance-diagnostics-report.ts:501`-`506` and `1140`-`1157`.
- The copied report adds evaluator and runtime instance cache lines at `apps/runtime-player/src/control/performance-diagnostics-report.ts:507`-`537` and `1158`-`1179`.
- `runtimeModelCompileDurationMs` is formatted as `scaffoldBuildSampleCount=... latest=... scope=scaffold-build-cold-path` at `apps/runtime-player/src/control/performance-diagnostics-report.ts:1288`-`1295`, which avoids presenting it as a per-frame runtime-core phase.

Scope and safety constraints are respected:

- Current `git status --short -uall package.json pnpm-lock.yaml apps/editor packages/package-format apps/runtime-player/package.json packages/runtime-core/package.json` returned no changed forbidden files.
- No Browser Source build marker was added, which is acceptable optional scope.
- No raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, textures, or mesh data were added to the metrics DTOs; Browser Source metrics validation continues to rebuild a compact aggregate object.
- The follow-up did not add a deeper drawable/deformer split. The follow-up report and screen doc record that deeper splits would require more invasive runtime-core instrumentation, while existing deep profiling already separates the main hot phases.

## Test Adequacy

Tests are adequate for this diagnostic follow-up.

Covered:

- Copied report formatting and delta behavior for compiled evaluator counters, scaffold aliases, runtime instance counters, and cold-path compile metric: `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:343`-`455`.
- Backward compatibility for missing optional metrics, rejection of invalid counters/durations, and unknown-field stripping: `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:24`-`180`.
- Browser Source malformed render metrics are dropped rather than leaking unsafe payloads: `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.ts:58`-`60` and existing `browser-source-client-message.test.ts:21`-`46`, `85`-`97`.
- Stage IPC propagation of the expanded metrics snapshot: `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:135`-`160` and fixture fields at `stage-view-bridge-handlers.test.ts:676`-`702`.
- Runtime model instance cache hit/miss/invalidation semantics: `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:380`-`448`.
- Separate Native-style and Browser Source-style target-local instances remain visually/state consistent for the same live frame sequence: `runtime-export-evaluation-cache.test.ts:185`-`257`.
- Scaffold cache lifecycle, reload, texture key separation, and compile sample counter: `runtime-export-evaluation-cache.test.ts:301`-`363`.

Verification rerun by this review:

- `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
  - Passed: 3 files / 48 tests.
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
  - Passed: 3 files / 46 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- <follow-up tracked source/test/docs>`
  - Passed with LF-to-CRLF working-copy warnings only.

## Residual Risks

- A real OBS Browser Source deep capture after this follow-up is still required to prove the copied report contains the new values in the user's live setup.
- Stable captures should interpret instance cache miss/invalidation counts in context: a payload reload, semantic Variant change, clear, dispose, or renderer recreation can legitimately increment them.
- `runtimeModelCompileDurationMs` remains a latest cold-path scaffold-build metric, not a distribution and not a per-frame runtime-core cost.

## Verdict

pass
