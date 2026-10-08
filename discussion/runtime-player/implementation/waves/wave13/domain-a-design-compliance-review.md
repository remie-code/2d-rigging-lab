# Runtime Player Wave13 Domain A Design Compliance Review

- Review target: Shared Stage Renderer Frame Pacing Foundation
- Verdict: pass
- Reviewer: Review-Sylph

## Findings

No blocking design or development compliance findings.

Non-blocking metric caveat: `lastRenderDurationMs` is measured inside `renderCurrent()` around canvas resize, viewport creation, and `renderer.render()` only (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:440`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:445`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:456`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:465`). Scheduled live-frame evaluation happens before that in `applyLatestLiveParameterFrameToRenderInput()` (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:390`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:413`). Domain B should label this as render/canvas duration, or extend the hook if the report promises full build/evaluation/render duration.

## Design / Development Compliance

Pass. The implementation adds one shared scheduled rAF path for live frames, view/display transforms, resize, wheel zoom, and pointer pan through `requestScheduledRender()` and `renderScheduledFrame()` (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:359`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:385`). Immediate rendering is retained for initial empty render, payload load, active Variant rebuild, live clear, and renderer clear (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:155`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:177`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:217`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:257`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:338`).

`setLiveParameterFrame()` remains rAF-coalesced and keeps newest-frame semantics by replacing `latestLiveParameterFrame`, tracking pending state, and applying only the latest pending frame on the scheduled render (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:221`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:234`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:390`). The added frame-pacing tests verify multiple live frames render once and use frame 2, and live+transform before rAF render once with final transform (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts:55`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts:80`).

View and display transform setters now dedupe unchanged transforms and schedule rather than render immediately (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:264`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:286`). Manual wheel zoom and pointer pan use the same scheduled path while still reporting changed base transforms synchronously (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:477`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:531`). Center Model and Reset View still flow through `setViewTransform()` (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:308`) and are covered by the new test (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts:179`).

Wave10 local preview suspension behavior is preserved: `clearLiveParameterFrame()` cancels pending rAF and still leaves payload/view updates renderable (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:239`), with focused regression coverage (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts:55`). This matches the Wave10 requirement that suspension affects native live rendering only while payload/view updates continue.

Wave11 Stage Motion boundaries are preserved. Stage display transforms still enter native Stage via `setDisplayViewTransform()` from `stage-window-app.tsx` (`apps/runtime-player/src/stage/stage-window-app.tsx:158`) and Browser Source receives only stage display transform state (`apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:395`), not raw tracking or calibration data. Wave12 Variant behavior is preserved through unchanged active Variant application and tests verifying Browser Source active Variant updates do not reapply Runtime Export payload (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:187`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts:259`).

Development policy compliance is acceptable. The changes stay scoped to Runtime Player Stage renderer and Browser Source adapter/test files; no dependency manifest, lockfile, Editor app, Runtime Export format, server throttling, Spout/OBS automation, protocol redesign, physics/body-follow smoothing, or input interpolation changes were found.

## Browser Source / Privacy

Pass. Browser Source continues to use the shared `StaticStageCanvasRenderer` via the adapter (`apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts:49`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts:66`). The only new Browser Source surface is `getRenderMetricsSnapshot()` returning numeric render counters/timings (`apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts:38`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts:93`). No token, raw tracking frame, calibration internals, private path, full Runtime Export payload, or protocol message redesign is introduced in Domain A.

## Metrics Hook Assessment

Pass for Domain B foundation with the caveat above. The snapshot exposes render count, scheduled/immediate render counts, duplicate transform skip count, coalesced live frame count, rAF delta timing, and render duration timing (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:80`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:316`). The optional `onRenderMetricsChanged` hook is inert unless a caller opts in (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:60`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:614`), which keeps the default hot path lightweight.

Domain B can aggregate p50/p95/max by subscribing to metric changes or polling snapshots and comparing sample counts. It should not assume canceled scheduled rAFs are counted as scheduled renders; current counts represent completed renders by mode.

## Verification

- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.interaction.test.ts apps/runtime-player/src/stage/stage-renderer/stage-view-transform.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`: 5 files passed, 25 tests passed.
- `pnpm.cmd typecheck`: passed.
- `git diff --check -- apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`: passed with CRLF warnings only.

## Out-of-Scope / Policy Violations

None found. `pnpm install` was not run.
