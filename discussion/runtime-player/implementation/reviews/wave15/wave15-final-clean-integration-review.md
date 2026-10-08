# Runtime Player Wave15 Final Clean Integration Review

- Role: Clean Review-Sylph
- Verdict: pass
- Date: 2026-06-26
- Scope: Wave15 final integration / docs alignment after Domain A and Domain B passed. This review independently inspected the basis documents, current maps, relevant worktree diffs, and source facts. It did not edit implementation source.

## Scope Reviewed

- Wave15 plan and wave planning convention.
- Domain A/B implementation reports and clean reviews.
- Domain C final integration report.
- Runtime Player root, screens, implementation, Wave15 reports, and Wave15 reviews maps.
- `discussion/runtime-player/screens/performance-diagnostics.md`.
- Relevant worktree source/test diffs under `packages/runtime-core/src/**` and `apps/runtime-player/src/**`.
- Dependency/package guard by checking `package.json`, `pnpm-lock.yaml`, Runtime Player package metadata, runtime-core package metadata, and Editor source diff names.

## Basis Used

- `discussion/runtime-player/implementation/orchestration/player-wave15-plan.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/implementation/waves/wave15/domain-a-snapshot-validation-hot-path-report.md`
- `discussion/runtime-player/implementation/reviews/wave15/domain-a-snapshot-validation-hot-path-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave15/domain-b-deep-profiling-gating-report.md`
- `discussion/runtime-player/implementation/reviews/wave15/domain-b-deep-profiling-gating-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave15/wave15-final-integration-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/screens/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/waves/wave15/_map.md`
- `discussion/runtime-player/implementation/reviews/wave15/_map.md`
- Current source diffs in `packages/runtime-core/src` and `apps/runtime-player/src`.

## Findings

- Blocking findings: none.
- Required fix loop items: none.
- Original non-blocking closeout item: at the time of the first clean review, the current maps intentionally still said Wave15 final clean review was pending. That was acceptable for the pre-review state, and Gnome/Sylph closeout was asked to update the Wave15 report/review maps and Runtime Player navigation links/statuses to point to this review and mark final clean review complete/pass. This item is resolved by the closeout re-review below.

## Integration Assessment

- Snapshot validation is not paid unconditionally in the normal Runtime Player live path. Runtime-core added explicit `RuntimeFrameEvaluationControlOptions.snapshotValidation` and remains conservative by default (`packages/runtime-core/src/runtime-core.ts:42`, `packages/runtime-core/src/runtime-core.ts:105`). `createRuntimeSnapshot` returns the constructed snapshot directly only for `snapshotValidationMode === "skip"` and still runs `RuntimeSnapshotSchema.parse` in schema mode (`packages/runtime-core/src/snapshot.ts:171`, `packages/runtime-core/src/snapshot.ts:314`, `packages/runtime-core/src/snapshot.ts:318`). Runtime Player pose evaluation defaults to `snapshotValidation: "skip"` (`apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:105`).
- Deep runtime-core profiling is not always active in normal live rendering. Runtime Player pose evaluation passes runtime-core profiling options only when `runtimeCoreProfiling === "deep"` (`apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:103`). `StaticStageCanvasRenderer` stores `"disabled"` as the default mode and omits expanded runtime-core phase fields from render metrics outside `"deep"` (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:117`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:450`).
- Performance Diagnostics can intentionally request deep details. Start Capture requests `"deep"` for the selected target and completion/clear/unmount disables the same capture target (`apps/runtime-player/src/control/performance-diagnostics-page.tsx:151`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:194`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:207`). Native Stage and Browser Source receive only the sanitized `"disabled" | "deep"` mode.
- Normal Browser Source heartbeat/diagnostics do not stream expanded runtime-core phase payloads unless capture/deep profiling is active. Browser Source session state defaults to `"disabled"` and broadcasts only `runtime-core-profiling-changed` with the sanitized mode (`apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:76`, `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:312`, `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:320`). Browser Source message parsing accepts absent/null profiling mode as `"disabled"` and rejects unsupported values (`apps/runtime-player/src/stage/browser-source/browser-source-server-message.ts:283`).
- Runtime behavior preservation is coherent with A/B evidence. The changed runtime-core production files are limited to `runtime-core.ts` and `snapshot.ts`; app changes are profiling/diagnostics/control plumbing. No semantic rewrite was found for dynamics, keyforms, deformers, clipping, variants, Stage Motion, Body Follow, Browser Source output, Wave10 local preview suspension, Wave11 Stage Motion, Wave12 Variant switching, or Wave14 runtime evaluation cache.
- Docs alignment passes. `performance-diagnostics.md` no longer claims capture never changes renderer behavior. It now states the Wave15 exception that Performance Diagnostics may request deep runtime-core profiling and add measurement overhead during capture (`discussion/runtime-player/screens/performance-diagnostics.md:44`), while normal live rendering keeps snapshot validation skipped and deep profiling disabled (`discussion/runtime-player/screens/performance-diagnostics.md:107`). Manual checks remain explicit, including current Wave15 Start Capture behavior (`discussion/runtime-player/screens/performance-diagnostics.md:143`).
- Report copyability and privacy remain coherent. The final report and screen doc keep raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payloads, textures, and mesh data out of copied reports and Browser Source messages. New profiling controls carry only `"disabled" | "deep"`.
- Constraints are preserved in the inspected worktree: no `pnpm install` evidence from this review, no new dependencies, no lockfile changes, no package metadata changes, no Runtime Export format changes, and no Editor source changes.

## Verification Run

- `git diff --check -- discussion/runtime-player`
  - Passed with LF-to-CRLF working-copy warnings only.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git status --short -- package.json pnpm-lock.yaml apps/runtime-player/package.json packages/runtime-core/package.json`
  - No output; package metadata and lockfile are not modified.
- `git diff --name-only -- package.json pnpm-lock.yaml apps/runtime-player/package.json packages/runtime-core/package.json apps/editor/src packages/editor src`
  - No output; no package/lockfile/Editor source diff found.

This review did not rerun full typecheck or the focused Vitest sets. It relied on the already-passed Domain A/B and Domain C reports for those checks, plus the targeted verification above.

## Manual Checks Still Required

- Open Runtime Player with a real Runtime Export.
- Connect real iFacialMocap input.
- Add/connect OBS Browser Source using the Runtime Player Browser Source URL.
- Run Performance Diagnostics normal/default capture if that mode is exposed, and run deep capture; the current Wave15 Start Capture intentionally requests deep runtime-core profiling for the selected target.
- Compare `inputReceiveFpsLatest`, `liveFrameMessageFps`, `appliedLiveFrameFps`, `renderFps`, `liveRenderInputEvaluationDurationMs`, `runtimeCoreEvaluationDurationMs`, `runtimeCoreSnapshotValidationDurationMs`, runtime-core phase fields, and `scheduledFrameDurationMs`.
- Confirm normal live/default behavior after capture keeps deep profiling disabled and keeps `runtimeCoreSnapshotValidationDurationMs` zero, unknown, or near-zero outside intentional deep/schema diagnostics.
- Confirm native Stage and Browser Source still render normally after capture stops.
- Confirm Stage Motion, Body Follow, dynamics, Variant switching parity, Browser Source output, and Wave10 native local preview suspension/resume still work.
- Save the copied report to `tmp/report.log`.
- Confirm copied reports and Browser Source messages do not include raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, Runtime Export textures, or Runtime Export mesh data.

## Residual Risks

- Real-model native Stage and OBS Browser Source smoothness remains manually unverified after Wave15.
- Deep capture intentionally adds measurement overhead, so performance comparisons must separate normal/default behavior from deep capture behavior.
- A deep capture can legitimately show `unknown` / `sampleCount=0` runtime-core phase summaries if no live render evaluation occurs during the capture window.
- Browser Source diagnostics are sampled, so first/final capture samples can lag the latest deep-profiled live frame.

## Closeout Re-Review

- Date: 2026-06-26
- Verdict: pass
- Scope: Re-reviewed Gnome closeout changes for Wave15 Domain C status/map/link alignment. No source, maps, screen docs, final integration report, package files, lockfiles, backlog, Runtime Export format files, or Editor files were edited by this re-review.
- Closeout item resolution: pass. `wave15-final-integration-report.md`, Wave15 reports map, Wave15 reviews map, Runtime Player implementation map, Runtime Player root map, screens map, and `performance-diagnostics.md` now represent Wave15 final clean review as pass/complete and link `discussion/runtime-player/implementation/reviews/wave15/wave15-final-clean-integration-review.md` where appropriate.
- Stale wording check: targeted Wave15 report/map grep for `pending`, `needs_review`, `needs review`, `ready for final clean review`, and `final clean review has not been written` returned no matches. A broader root/screens grep only matched acceptable manual real-model native/OBS diagnostics pending wording, not final-clean-review pending wording.
- Verification: `git diff --check -- discussion/runtime-player` passed with LF-to-CRLF working-copy warnings only. A follow-up check of this review artifact also passed.
- Review report update: this section and the resolved wording above were added to record closeout re-review evidence.

## Clean Review Statement

This was an independent clean review and closeout re-review. It did not rely on Gnome's summary as the only basis, and it did not edit Runtime Player or runtime-core implementation source, maps, final integration report, package files, lockfiles, backlog, Runtime Export format files, or Editor files. The only file written by this review is this review artifact.
