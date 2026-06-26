# Runtime Player Wave15 Domain B Clean Re-Review: Deep Profiling Gating

- Role: Review-Sylph
- Verdict: pass
- Date: 2026-06-26
- Scope: post-fix-loop-1 clean re-review for Wave15 Domain B. Source files were reviewed but not edited. This review report file was updated.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave15-plan.md`
- `discussion/runtime-player/implementation/waves/wave15/domain-a-snapshot-validation-hot-path-report.md`
- `discussion/runtime-player/implementation/reviews/wave15/domain-a-snapshot-validation-hot-path-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave15/domain-b-deep-profiling-gating-report.md`
- Previous `discussion/runtime-player/implementation/reviews/wave15/domain-b-deep-profiling-gating-clean-review.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

## Scope Reviewed

- Inspected actual worktree state with `git status --short -uall`, `git diff --name-only`, and `git diff --stat`.
- Inspected targeted diffs for Browser Source server/session/runtime-export payload, Browser Source server message/client/renderer, Runtime Player pose evaluation, static Stage renderer, Performance Diagnostics page/report, native Stage IPC, Browser Source control bridge, and changed preload bridge contracts.
- Checked the fix-loop changes in `apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts`.

## Findings

- Blocking findings: none.
- Previous blocker resolved: `apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts:153` and `apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts:179` now include `runtimeCoreProfiling: "disabled"` in the exact `/runtime-export/payload` expectations. The focused server test now passes.
- Non-blocking test gap: the HTTP `/runtime-export/payload` response is source-wired to `RuntimePlayerBrowserSourceSession.getRuntimeCoreProfiling()` at `apps/runtime-player/src/main/broadcast-source/browser-source-server.ts:383`, and session resync covers `"deep"` at `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts:251`, but there is no direct focused assertion that calling `server.setRuntimeCoreProfiling("deep")` changes the authorized HTTP payload response. This is not blocking because the failed strict expectations are fixed and the source path is narrow.

## Rubric Compliance

- Normal render path calls runtime-core with profiling disabled/shallow: pass. `evaluateRuntimeExportPose` only passes runtime-core profiling options when `runtimeCoreProfiling === "deep"` at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:103`; otherwise runtime-core profiling is omitted and `createRuntimeCoreEvaluationProfiler(...).finish()` returns `undefined`.
- Domain A validation skip remains intact: pass. Runtime Player pose evaluation still defaults `snapshotValidation` to `"skip"` at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:105`, while runtime-core itself remains conservative by default at `packages/runtime-core/src/runtime-core.ts:105`.
- Performance Diagnostics capture enables deep profiling intentionally: pass. Start capture requests `"deep"` at `apps/runtime-player/src/control/performance-diagnostics-page.tsx:155`; stop, clear, and unmount call the disable path at `apps/runtime-player/src/control/performance-diagnostics-page.tsx:142`, `:197`, `:210`, and `:254`.
- Browser Source capture path receives profiling state safely: pass. Main-side Browser Source control validates `"disabled" | "deep"`, session broadcasts only the sanitized mode, resync includes the current mode, and the client applies it to the renderer at `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:518`.
- Normal Browser Source diagnostics do not stream expanded deep profile fields unless profiling is active: pass. `StaticStageCanvasRenderer.getRenderMetricsSnapshot()` returns coarse metrics outside `"deep"` at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:450`; the client sends that renderer snapshot as diagnostics.
- Report generation handles disabled/unknown deep fields: pass. The disabled-profile report case is covered by `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:533`.
- Runtime behavior preservation: no semantic change found for iFacialMocap, dynamics, keyforms, deformers, clipping, variants, Stage Motion, Body Follow, native Stage transforms, or OBS Browser Source rendering beyond profiling control/metrics plumbing.
- Privacy constraints: pass. New protocol/control payloads carry only `"disabled" | "deep"`, existing Browser Source message parsing drops unrelated unsafe data, and the report privacy exclusions include Runtime Export textures and mesh data.
- No `pnpm install`, new dependencies, lockfile changes, broad runtime-core rewrite, or WebGL rewrite found.

## Verification Evidence

- Reran `pnpm.cmd exec vitest run apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts` with escalation because sandboxed Vitest/esbuild startup is known to fail with `spawn EPERM` in this workspace.
  - Result: passed, 1 file / 16 tests.
- Ran `git diff --check -- apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts`.
  - Result: passed with LF-to-CRLF working-copy warning only.
- Ran `git diff --check -- apps/runtime-player/src packages/runtime-core/src discussion/runtime-player/implementation/waves/wave15/domain-b-deep-profiling-gating-report.md`.
  - Result: passed with LF-to-CRLF working-copy warnings only.
- Checked Gnome's reported broader verification evidence but did not rerun the 13-file focused Domain B Vitest set, `pnpm.cmd typecheck`, or `node scripts/check-source-organization.mjs` in this re-review.
- `pnpm install` was not run by this review.

## Remaining Risks / Manual Verification Needs

- Real-model native Stage and OBS Browser Source manual checks remain needed after Domain C/final integration to confirm normal live rendering stays profiling-disabled after Stop/Clear/unmount.
- Deep Performance Diagnostics reports require live render evaluations during the capture window; otherwise phase summaries can legitimately remain unknown.
- Repeated deep captures should be watched manually for stale first-sample phase data if no new deep-profiled live frame arrives after profiling is re-enabled. This is not blocking for Domain B because normal disabled diagnostics omit deep fields and live captures should increment runtime-core phase counters.
- `discussion/runtime-player/screens/performance-diagnostics.md` still says Performance Diagnostics is not responsible for changing renderer behavior during capture. Wave15 intentionally changes that for deep profiling, so Domain C/final integration should align the screen doc.
