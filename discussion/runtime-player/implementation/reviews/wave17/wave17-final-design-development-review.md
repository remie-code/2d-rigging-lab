# Runtime Player Wave17 Final Design / Development Review

- Date: 2026-06-26
- Lane: Final design/development and architecture compliance
- Verdict: pass

## Scope

Reviewed Wave17 Domain E final integration documents/maps plus the A-D source/test diff under:

- `packages/runtime-core/src/**`
- `apps/runtime-player/src/**`
- `discussion/runtime-player/**`

This review did not edit source, tests, maps, or the Wave17 final integration report.

## Findings

No blocking design/development findings.

## Compliance Checks

| Check | Verdict | Evidence |
|---|---|---|
| Runtime-core render-frame API is additive and public snapshot APIs remain compatible | Pass | `RuntimeModelInstance` keeps `evaluateFrame(...)` and adds `evaluateRenderFrame(...)` at `packages/runtime-core/src/runtime-model.ts:38`. `evaluateRuntimeFrame(...)` remains exported at `packages/runtime-core/src/runtime-core.ts:92`. Public snapshot schema/type remain `RuntimeSnapshotSchema` / `RuntimeSnapshotDto` at `packages/runtime-core/src/snapshot.ts:150` and `packages/runtime-core/src/snapshot.ts:182`. Compatibility/parity tests cover legacy compiled evaluation and public summary behavior at `packages/runtime-core/src/runtime-core.test.ts:373`, `packages/runtime-core/src/runtime-core.test.ts:548`, and public snapshot freshness at `packages/runtime-core/src/runtime-core.test.ts:843`. |
| Render-frame path avoids public snapshot/public drawable DTO materialization | Pass | The render-frame evaluator path calls `createRuntimeRenderFrame(...)` from `evaluateRuntimeRenderDrawables(...)` under `runtimeCoreRenderFrameOutputDurationMs`, not `createRuntimeSnapshot(...)`, at `packages/runtime-core/src/runtime-core.ts:260`. `createRuntimeSnapshot(...)` remains the explicit public path and records public snapshot materialization at `packages/runtime-core/src/snapshot.ts:193` and `packages/runtime-core/src/snapshot.ts:212`. Render-frame base drawable materialization uses `materializeRuntimeRenderFrameDrawables(...)` returning `RuntimeDrawableEvaluationBase[]` at `packages/runtime-core/src/snapshot-static-templates.ts:149`, with the narrow shape defined at `packages/runtime-core/src/runtime-drawable-evaluation.ts:7`. Tests assert no `snapshot` property, `publicSnapshotMaterializationCount === 0`, zero snapshot creation/validation durations, and a positive render-frame output duration at `packages/runtime-core/src/runtime-core.test.ts:834` through `packages/runtime-core/src/runtime-core.test.ts:839`. |
| Runtime-core stays independent of Runtime Export/package-format production DTOs | Pass | `rg -n "package-format|RuntimeExport|runtime-export|Runtime Export|@private-2d-rigging-lab/package-format|packages/package-format" packages/runtime-core/src` found only `packages/runtime-core/src/dependency-boundary.test.ts:12`, not production imports. Direct import scan of changed runtime-core files shows imports from `@private-2d-rigging-lab/contracts` and local runtime-core modules, not package-format. |
| No package-format runtime schema, Editor, dependency, lockfile, or workspace manifest changes | Pass | `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format` produced no output. Wave17 final report also records these as out of scope/unchanged at `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:47` through `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:52`. |
| Runtime Player live render path defaults to render-frame; snapshot paths remain explicit | Pass | `createEvaluatedRuntimeExportStageRenderInput(...)` defaults `(options.poseEvaluationMode ?? "render-frame")` to `evaluateRuntimeExportRenderFrame(...)` and selects `evaluateRuntimeExportPose(...)` only for `"snapshot"` at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:110`. The static/diagnostic payload setup passes `poseEvaluationMode: "snapshot"` at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:242`. Live renderer calls at `static-stage-canvas-renderer.ts:306`, `static-stage-canvas-renderer.ts:352`, and `static-stage-canvas-renderer.ts:668` do not pass snapshot mode. Default-pose evaluation remains on the snapshot API via `evaluateRuntimeExportDefaultPose(...)` -> `evaluateRuntimeExportPose(...)` at `apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts:9`. |
| Browser Source and Native Stage target-local runtime instance/output ownership is preserved | Pass | Each `StaticStageCanvasRendererController` owns its own `RuntimeExportRuntimeModelInstanceCache` at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:117` through `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:121`. Browser Source wraps its own static renderer instance at `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts:49`, while Native Stage creates its renderer in `apps/runtime-player/src/stage/stage-window-app.tsx:44`. Target-local separation is tested with distinct native/browser-source instance caches at `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:113` through `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:138`. |
| Docs/maps accurately describe scope and boundaries | Pass | Wave17 maps and final report consistently state Domain E did not implement source work and that Runtime Export format, package-format schema, Editor export behavior, dependencies, lockfile, and `pnpm install` are unchanged/out of scope: `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:10`, `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:14`, `discussion/runtime-player/implementation/waves/wave17/_map.md:30`, and `discussion/runtime-player/implementation/_map.md:274`. |
| Performance Diagnostics wording separates render-frame metrics from public snapshot path metrics and preserves privacy boundaries | Pass | The screen doc states Wave17 fast-path proof should show `compiledRenderFrameCount > 0`, `publicSnapshotMaterializationCount: 0`, and separates `runtimeCoreRenderFrameOutputDurationMs` from public snapshot metrics at `discussion/runtime-player/screens/performance-diagnostics.md:128` through `discussion/runtime-player/screens/performance-diagnostics.md:135`. The copied report labels `compiledRenderFrameCount` as `scope=render-frame-fast-path`, `publicSnapshotMaterializationCount` as public snapshot path/deep profile, `runtimeCoreRenderFrameOutputDurationMs` as render-frame fast path, and `renderInputDrawableMappingDurationMs` as renderer input mapping rather than public snapshot materialization at `apps/runtime-player/src/control/performance-diagnostics-report.ts:1193`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:1202`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:1234`, and `apps/runtime-player/src/control/performance-diagnostics-report.ts:1274`. Privacy exclusions are preserved in code at `apps/runtime-player/src/control/performance-diagnostics-report.ts:293` through `apps/runtime-player/src/control/performance-diagnostics-report.ts:301` and in docs at `discussion/runtime-player/screens/performance-diagnostics.md:150` through `discussion/runtime-player/screens/performance-diagnostics.md:162`. |
| Required final review path names are present in maps | Pass | `discussion/runtime-player/implementation/reviews/wave17/_map.md:21` through `discussion/runtime-player/implementation/reviews/wave17/_map.md:23` and `discussion/runtime-player/implementation/_map.md:192` through `discussion/runtime-player/implementation/_map.md:194` use the required final review names, including `wave17-final-design-development-review.md`. |

## Verification Performed

- `git status --short -uall`
- `git diff --stat -- packages/runtime-core/src apps/runtime-player/src discussion/runtime-player`
- `Get-Content -Encoding UTF8 packages/runtime-core/src/runtime-drawable-evaluation.ts`
- `rg -n "evaluateRenderFrame|publicSnapshotMaterializationCount|runtimeCoreRenderFrameOutputDurationMs|createRuntimeSnapshot|evaluateRuntimeExportRenderFrame|poseEvaluationMode|snapshotToRenderDrawableDurationMs|renderInputDrawableMappingDurationMs" packages/runtime-core/src apps/runtime-player/src discussion/runtime-player`
- `rg` checks for package-format / Runtime Export imports in `packages/runtime-core/src`
- Targeted source/doc `rg` inspections for render-frame routing, snapshot-only routing, target-local runtime instance caches, diagnostics labels, privacy exclusions, and final review map names
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format`

Known but not rerun in this lane:

- `pnpm.cmd typecheck` passed.
- `node scripts/check-source-organization.mjs` passed.
- Focused Vitest passed after sandbox `spawn EPERM` escalation: 9 files / 113 tests.

## Residual Risks / User Decision Points

- Real OBS Browser Source performance and smoothness remain manually unverified until the user captures a real-model Browser Source deep Performance Diagnostics report and saves it as `tmp/report.log`, as recorded in `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:120`.
- Deep Performance Diagnostics may legitimately report `unknown` / `sampleCount=0` when no deep-profiled live render-frame sample is observed; this is documented at `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:146`.
- The internal compatibility source field `snapshotToRenderDrawableDurationMs` still exists in source DTO/plumbing, but copied reports expose it as `renderInputDrawableMappingDurationMs` with explicit non-public-snapshot scope. A source-level rename can remain a later cleanup.
- Render-frame output still uses frame-owned/copy-safe vertex arrays; if FPS remains low after public snapshot materialization removal, the next performance wave should profile vertex copy and renderer upload costs before broadening architecture.
