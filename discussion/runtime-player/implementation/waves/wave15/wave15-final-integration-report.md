# Runtime Player Wave15 Final Integration Report: Runtime Snapshot Hot-Path Cleanup

- Verdict: pass
- Domain: Final Integration / Docs Alignment
- Agent: Gnome
- Date: 2026-06-26

## Scope

Domain C was docs/integration alignment only. No source implementation, package files, lockfiles, Runtime Export format files, or Editor files were edited.

Basis:

- [../../orchestration/player-wave15-plan.md](../../orchestration/player-wave15-plan.md)
- [domain-a-snapshot-validation-hot-path-report.md](domain-a-snapshot-validation-hot-path-report.md)
- [../../reviews/wave15/domain-a-snapshot-validation-hot-path-clean-review.md](../../reviews/wave15/domain-a-snapshot-validation-hot-path-clean-review.md)
- [domain-b-deep-profiling-gating-report.md](domain-b-deep-profiling-gating-report.md)
- [../../reviews/wave15/domain-b-deep-profiling-gating-clean-review.md](../../reviews/wave15/domain-b-deep-profiling-gating-clean-review.md)
- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)
- [../../orchestration/runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)
- [../../reviews/wave15/wave15-final-clean-integration-review.md](../../reviews/wave15/wave15-final-clean-integration-review.md)

## Files Changed By Domain C

- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/screens/_map.md`
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/waves/wave15/_map.md`
- `discussion/runtime-player/implementation/reviews/wave15/_map.md`
- `discussion/runtime-player/implementation/waves/wave15/wave15-final-integration-report.md`

`discussion/runtime-player/backlog/runtime-player-backlog.md` was not changed because no standalone profiling-removal backlog item needed closing or deferral. Wave15 manual verification remains represented in the Runtime Player maps and Performance Diagnostics screen doc.

## Integration Evidence

Final clean review:

- Review-Sylph final clean integration review passed with no blocking findings and no required fix loop items: [../../reviews/wave15/wave15-final-clean-integration-review.md](../../reviews/wave15/wave15-final-clean-integration-review.md).

Snapshot validation is not paid unconditionally in the normal live path:

- Domain A added explicit `RuntimeFrameEvaluationControlOptions.snapshotValidation`.
- Runtime-core remains conservative by default and uses schema validation unless the caller explicitly requests skip.
- Runtime Player normal Stage / Browser Source pose evaluation defaults to `snapshotValidation: "skip"`.
- Domain A clean review passed and cited focused runtime-core and Runtime Player tests proving schema/skip behavior and `snapshotValidationDurationMs === 0` for the normal Runtime Player pose evaluation path.

Deep runtime-core profiling is not always active in normal live rendering:

- Domain B added sanitized `RuntimePlayerRuntimeCoreProfilingMode = "disabled" | "deep"`.
- Runtime Player pose evaluation only passes runtime-core profiling options when `runtimeCoreProfiling === "deep"`.
- Native Stage and Browser Source renderers default to `"disabled"`.
- Coarse app-side `runtimeCoreEvaluationDurationMs` remains available without enabling expanded runtime-core phase profiling.

Performance Diagnostics can intentionally request deep details:

- Domain B Start Capture requests `"deep"` for the selected target.
- Stop, Clear, timer completion, and unmount request `"disabled"`.
- Native Stage receives the mode through Stage IPC.
- Browser Source receives the mode through sanitized control/session/server/WebSocket/client plumbing.
- Reports include runtime-core phase summaries when deep-profiled samples are present.

Normal Browser Source heartbeat/diagnostics do not stream large deep payloads unless capture/deep profiling is active:

- `StaticStageCanvasRenderer.getRenderMetricsSnapshot()` omits expanded runtime-core phase fields outside `"deep"` mode.
- Normal Browser Source diagnostics keep coarse renderer metrics.
- Browser Source profiling control messages carry only sanitized mode state such as `"disabled"` / `"deep"` plus protocol metadata and timestamp.

Runtime behavior preservation:

- Domain A/B reports and clean reviews found no intentional behavior changes for dynamics, keyforms, deformers, clipping, variants, Stage Motion, Body Follow, native Stage transform, or OBS Browser Source rendering beyond profiling/metrics control.
- Wave10 native local preview suspension remains preserved: Browser Source rendering, input processing, mapping, Body Follow, dynamics, Runtime Export state, Stage transform sync, and Stage Motion stay active while native local preview live rendering is suspended.
- Wave11 Stage Motion remains preserved: Browser Source receives sanitized composed Stage transform and no raw tracking/head-position/calibration data.
- Wave12 Variant switching remains preserved: native Stage and Browser Source use the same sanitized session active Variant selection.
- Wave14 runtime evaluation cache remains preserved: it caches invariant graph/scaffold/texture/template/clipping data by Runtime Export identity and active Variant selection, and does not cache snapshots, runtime state, dynamics state, authored/live values, evaluated vertices, opacity, draw order, visibility, or keyform samples.

Report copyability and privacy:

- Performance Diagnostics reports and Browser Source messages must not include raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, Runtime Export textures, or Runtime Export mesh data.
- Domain B clean review passed the privacy boundary: new control/protocol payloads carry only `"disabled" | "deep"`, and report privacy exclusions include Runtime Export textures and mesh data.
- `performance-diagnostics.md` now explicitly documents that Browser Source messages share the same privacy boundary.

Constraints preserved:

- No `pnpm install` was run by Domain C.
- No new dependencies were added.
- No lockfile was edited.
- No Runtime Export format change was made.
- No Editor files were edited.
- No source implementation was performed by Domain C.

## Docs Alignment

- `performance-diagnostics.md` no longer says capture never changes renderer behavior. It now documents the Wave15 exception: Performance Diagnostics capture can request deep runtime-core profiling for the selected target, and that can add measurement overhead while capture is active.
- The screen doc now states that normal live Runtime Player rendering keeps snapshot validation skipped and deep runtime-core profiling disabled, while deep phase details are intentionally enabled only during Performance Diagnostics capture.
- The screen doc now states that no live render evaluation during deep capture can legitimately produce `unknown` / `sampleCount=0` runtime-core phase summaries.
- Runtime Player root, screens, implementation, Wave15 reports, and Wave15 reviews maps now link the Wave15 artifacts and final clean integration review.

## Verification

Inherited from Domain A:

- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`: passed, 2 files / 11 tests after elevated rerun.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `git diff --check -- <Domain A changed files>`: passed with LF-to-CRLF working-copy warnings only.

Inherited from Domain B:

- 13-file focused Vitest set covering Runtime Player profiling gating/report/IPC/Browser Source behavior: passed, 13 files / 83 tests after elevated rerun.
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts`: passed, 1 file / 16 tests after elevated rerun in the fix loop.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- Domain B `git diff --check` commands passed with LF-to-CRLF working-copy warnings only.

Domain C verification:

- `node scripts/check-source-organization.mjs`: passed.
- `pnpm.cmd typecheck`: passed.
- `git diff --check -- discussion/runtime-player`: passed with LF-to-CRLF working-copy warnings only.
- Additional trailing-whitespace check for newly added untracked Wave15 docs: passed.

`pnpm install` was not run.

## Manual Verification Still Required

Use a real Runtime Export, real iFacialMocap input, and OBS Browser Source:

- Open Runtime Player with the real Runtime Export.
- Connect iFacialMocap.
- Add/connect OBS Browser Source using the Runtime Player Browser Source URL.
- Run Performance Diagnostics normal/default capture if that mode is present.
- Run Performance Diagnostics deep capture; current Wave15 Start Capture intentionally requests deep runtime-core profiling for the selected target.
- Compare `inputReceiveFpsLatest`, `liveFrameMessageFps`, `appliedLiveFrameFps`, `renderFps`, `liveRenderInputEvaluationDurationMs`, `runtimeCoreEvaluationDurationMs`, `scheduledFrameDurationMs`, and runtime-core phase fields.
- Confirm `runtimeCoreSnapshotValidationDurationMs` is zero, unknown, or near-zero outside intentional deep/schema diagnostics.
- Confirm deep capture phase fields are present when live render evaluation happens, and treat `unknown` / `sampleCount=0` as valid when no deep-profiled live frame is observed.
- Confirm native Stage and Browser Source still render normally after capture stops and deep profiling is disabled.
- Confirm Stage Motion, Body Follow, dynamics, Variant switching parity, Browser Source output, and Wave10 local preview suspension/resume behavior still work.
- Save the copied report to `tmp/report.log`.
- Confirm copied reports and Browser Source messages do not include raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, Runtime Export textures, or Runtime Export mesh data.

## Residual Risks

- Real-model native Stage and OBS Browser Source smoothness is still manually unverified after Wave15.
- Deep capture adds intentional measurement overhead, so compare normal/default behavior separately from deep capture behavior.
- A deep capture can have `unknown` runtime-core phase summaries if no live render evaluation occurs during the capture window.
- Browser Source diagnostics are sampled, so the first or final capture sample can lag the latest deep-profiled live frame.
