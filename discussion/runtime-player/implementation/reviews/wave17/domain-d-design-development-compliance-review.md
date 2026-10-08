# Wave17 Domain D Design / Development Compliance Review

- Verdict: pass
- Review lane: design / development compliance
- Domain: Diagnostics / performance report semantics
- Date: 2026-06-26
- Reviewer: Review-Sylph

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-a-runtime-core-render-frame-api-report.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-b-runtime-core-fast-output-internals-report.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-c-runtime-player-fast-render-path-report.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-b-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-c-spec-compliance-review.md`
- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Changed Files / Diff Reviewed

Reviewed current workspace state with:

- `git status --short -uall`
- `git diff -- apps/runtime-player/src/preload/performance-diagnostics-contract.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/control/performance-diagnostics-report.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- targeted `rg` searches for `compiledRenderFrameCount`, `publicSnapshotMaterializationCount`, `runtimeCoreRenderFrameOutputDurationMs`, `snapshotToRenderDrawableDurationMs`, `renderInputDrawableMappingDurationMs`, report scope strings, privacy strings, and package/schema/dependency terms.

Reviewed changed files:

- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`

`git status --short -uall` also shows Wave17 A/B/C runtime-core and Runtime Player dirty changes plus Wave17 discussion artifacts. Those prior-domain changes are treated through the existing A/B/C reports and pass reviews unless directly touched by the Domain D metric path.

## Findings

No design/development compliance findings.

## Compliance Notes

- Pass - diagnostics remain low-overhead in normal live mode. Render-frame deep phase details are attached only when `runtimeCoreProfiling === "deep"` is passed to runtime-core (`apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:96`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:149`). Runtime-core returns no profile when profiling is disabled (`packages/runtime-core/src/runtime-profiling.ts:89`), and the render-frame unit coverage asserts the normal render path has no runtime-core profile (`apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:324`).
- Pass - fast-path proof counters are low-cost aggregate counters, not raw model or frame data. The metrics contract adds only numeric counters/durations (`apps/runtime-player/src/preload/performance-diagnostics-contract.ts:24`, `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:44`), validation defaults missing legacy fields to `0` / `null` (`apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:392`), and validation rejects malformed counters/durations (`apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:176`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:210`).
- Pass - runtime-core deep phase details are sampled/reported only when intentionally active. `StaticStageCanvasRenderer` records public snapshot materialization and render-frame-output duration only from `profile.runtimeCoreProfile` (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:907`), and render-frame output duration is counted only for render-frame evaluations (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:922`).
- Pass - report wording distinguishes fast render-frame counters from public snapshot path metrics. Copied reports print `compiledRenderFrameCount` with `scope=render-frame-fast-path`, `publicSnapshotMaterializationCount` with `scope=public-snapshot-path/deep-runtime-core-profile`, `runtimeCoreRenderFrameOutputDurationMs` with `scope=render-frame-fast-path/deep-runtime-core-profile`, and public snapshot/drawable duration scopes separately (`apps/runtime-player/src/control/performance-diagnostics-report.ts:1193`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:1202`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:1231`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:1234`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:1257`).
- Pass - copied report wording avoids implying public snapshot materialization on the renderer input mapping step. The old copied label is replaced with `renderInputDrawableMappingDurationMs` while preserving the source field as metadata (`apps/runtime-player/src/control/performance-diagnostics-report.ts:1274`), and tests assert the copied report does not contain a top-level `snapshotToRenderDrawableDurationMs` line (`apps/runtime-player/src/control/performance-diagnostics-report.test.ts:372`).
- Pass - snapshot/public path and render-frame fast path counters are not conflated. Snapshot evaluation sets `compiledRenderFrameCount: 0` (`apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:114`), render-frame evaluation sets `compiledRenderFrameCount: 1` (`apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:167`), and report deltas read `compiledRenderFrameCount` and `publicSnapshotMaterializationCount` as separate fields (`apps/runtime-player/src/control/performance-diagnostics-report.ts:516`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:531`).
- Pass - privacy boundaries remain intact. The copied report privacy section still explicitly excludes raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, textures, and mesh data (`apps/runtime-player/src/control/performance-diagnostics-report.ts:293`). Targeted searches found no new copied-report payload/texture/mesh/token/path emission in the reviewed diagnostics plumbing.
- Pass - Domain D source scope stays within diagnostics and metric plumbing plus focused tests. Targeted scope checks found no `apps/editor`, package-format schema, manifest/lockfile, or dependency edits in the Domain D reviewed file set. Runtime-core dirty files are prior Wave17 A/B facts covered by their existing reports/reviews, not Domain D edits.
- Pass - source organization policy is respected. No `index.ts`, catch-all `types.ts`/`schemas.ts`/`utils.ts`/`helpers.ts`, or broad new file pattern was introduced by Domain D, and `node scripts/check-source-organization.mjs` passed.
- Pass - A/B/C behavior is not undermined. Runtime Player live evaluation still defaults to render-frame mode (`apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:110`), initial payload/default diagnostics explicitly request snapshot mode (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:242`), and target-local instance cache use remains threaded through the evaluated render input builder (`apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:93`).

## Verification Commands / Results

- `node scripts/check-source-organization.mjs`
  - Passed: `Source organization guard passed.`
- `git diff --check -- <Domain D reviewed files>`
  - No whitespace findings; Git emitted LF-to-CRLF working-copy warnings only.
- `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
  - Passed with escalation for Vite/esbuild process/cache access: 7 files / 96 tests.
- `pnpm.cmd typecheck`
  - Passed with escalation for workspace tooling/cache access.

`pnpm install` was not run.

## Residual Risks / Final Integration Notes

- Real OBS Browser Source performance improvement remains unproven until final integration/user manual capture with a real Runtime Export and deep Performance Diagnostics report.
- In render-frame deep captures, public snapshot phase summaries can appear as zero/unknown public-snapshot-path scoped lines. The wording now separates scopes, but final integration should compare an actual copied report and confirm the interpretation is clear to future agents.
- `discussion/runtime-player/screens/performance-diagnostics.md` still reflects the Wave16 baseline. Final integration should update related docs/maps after Wave17 D/E facts are settled, per `runtime-player-wave-planning-conventions.md`.
- This review did not re-review all A/B/C source changes from scratch. It relied on their pass reports and inspected only the metric/report interfaces needed to verify Domain D did not undermine target-local instances, render-frame default live path, or snapshot compatibility.
