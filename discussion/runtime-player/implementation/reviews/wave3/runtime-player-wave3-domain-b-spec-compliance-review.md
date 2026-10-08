# Runtime Player Wave3 Domain B Spec Compliance Review

## Verdict

pass

## Scope Reviewed

- Reviewed the Runtime Player Wave3 plan, Domain A report, initial Runtime Player screen, and Runtime Player development policy.
- Reviewed the requested tracked diff and the full contents of the Domain B source files, new untracked files, Domain B implementation report, and focused tests.
- Verified the previous Loop 2 blocking issue from source: Stage evaluation/render errors and non-empty runtime diagnostics now flow to the Control Window through a typed status path.
- Re-ran verification:
  - `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test`: pass, 10 files / 43 tests.
  - `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`: pass.
  - `node scripts/check-source-organization.mjs`: pass.
  - `node scripts/check-dependencies.mjs`: pass.
  - `git diff --check -- <reviewed Domain B paths>`: pass, with LF-to-CRLF working-copy warnings only.

## Basis Used

- `discussion/runtime-player/implementation/orchestration/player-wave3-plan.md`
- `discussion/runtime-player/implementation/waves/wave3/runtime-player-wave3-domain-a-default-pose-evaluation-adapter-report.md`
- `discussion/runtime-player/screens/initial-runtime-player-screen.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/runtime-player/implementation/waves/wave3/runtime-player-wave3-domain-b-stage-evaluated-render-and-view-transform-report.md`

## Findings

No blocking or non-blocking spec compliance findings.

The previous `needs_changes` finding is resolved. Stage render/evaluation errors and runtime diagnostics are now reported through `stageView` IPC to the Control Window, while the Stage Window stays visually capture-clean.

## Confirmations

- Evaluated render path is active in the production Stage renderer: `StaticStageCanvasRendererController.setPayload()` builds `createEvaluatedRuntimeExportStageRenderInput(payload)` at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:81`, and the evaluated adapter calls `evaluateRuntimeExportDefaultPose()` at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:37`.
- Runtime-core remains the default-pose evaluation authority: `evaluateRuntimeExportDefaultPose()` uses `createInitialRuntimeState()` and `evaluateRuntimeFrame()` from `runtime-core` at `apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts:3`, with `deltaTimeMs: 0` and empty authored parameters at `apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts:40`.
- Evaluated vertices, opacity, draw order, and visibility feed the render scene at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:67`, `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:107`, `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:108`, and `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:110`.
- Raw texture bytes, atlas UVs, triangles, and clipping are preserved at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:97`, `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:101`, `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:130`, and `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:155`.
- Initial fit uses exported bounds, then manifest/canvas fallback, not evaluated per-frame bounds: `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:183` and `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:186`.
- Session-local pan/zoom/reset is display-only renderer state: transform helpers live at `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts:26`, `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts:36`, `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts:49`, and `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts:101`; viewport composition happens at `apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts:18`.
- Stage wheel zoom and left-drag pan are wired on the canvas at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:72`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:149`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:163`, and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:182`.
- Reset View is routed through the existing Control command without mutating model data: main sends `resetRequested` at `apps/runtime-player/src/main/placeholder-bridge-handlers.ts:43`, preload exposes `onResetViewRequested()` at `apps/runtime-player/src/preload/runtime-player-bridge.ts:49`, and Stage calls `renderer.resetView()` at `apps/runtime-player/src/stage/stage-window-app.tsx:111`.
- Loop 2 status path is present: Stage reports loaded/error/empty status at `apps/runtime-player/src/stage/stage-window-app.tsx:52`, `apps/runtime-player/src/stage/stage-window-app.tsx:58`, and `apps/runtime-player/src/stage/stage-window-app.tsx:73`; reports go through `window.runtimePlayer.stageView.reportStatus()` at `apps/runtime-player/src/stage/stage-window-app.tsx:197`.
- Non-empty runtime diagnostics are not swallowed: `setPayload()` formats snapshot diagnostics at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:89`, warning status is created at `apps/runtime-player/src/stage/stage-window-app.tsx:156`, and diagnostic detail formatting is tested at `apps/runtime-player/src/stage/stage-renderer/stage-render-diagnostics.test.ts:8`.
- Control Window exposes the human-readable Stage status path: it loads and subscribes to `stageView` status at `apps/runtime-player/src/control/control-window-app.tsx:59` and `apps/runtime-player/src/control/control-window-app.tsx:72`, then displays Render, Message, and warning/error details at `apps/runtime-player/src/control/control-window-app.tsx:280`, `apps/runtime-player/src/control/control-window-app.tsx:281`, `apps/runtime-player/src/control/control-window-app.tsx:284`, and `apps/runtime-player/src/control/control-window-app.tsx:487`.
- Main process stores and relays the latest Stage status through a narrow IPC contract at `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:18`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:19`, and `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:23`; status normalization keeps warning/error reports typed at `apps/runtime-player/src/main/stage-view-status-state.ts:19` and `apps/runtime-player/src/main/stage-view-status-state.ts:42`.
- Fatal render/reset failures clear or keep a safe Stage state before reporting error: `apps/runtime-player/src/stage/stage-window-app.tsx:57`, `apps/runtime-player/src/stage/stage-window-app.tsx:114`, and `apps/runtime-player/src/stage/stage-window-app.tsx:203`.
- Stage remains capture-clean: production Stage renders only the shell/canvas at `apps/runtime-player/src/stage/stage-window-app.tsx:135` and `apps/runtime-player/src/stage/stage-window-app.tsx:141`; transparent Stage CSS is at `apps/runtime-player/src/styles/global.css:32`, `apps/runtime-player/src/styles/global.css:40`, and `apps/runtime-player/src/styles/global.css:47`; the boundary test guards against Stage setup/debug controls at `apps/runtime-player/src/runtime-player-boundary.test.ts:26`.
- Forbidden Wave3 scope was not added. `rg` found no `authoring-core` import under `apps/runtime-player/src`; existing `iFacialMocap` / `UDP` text remains placeholder Control/status text, for example `apps/runtime-player/src/control/control-window-app.tsx:242` and `apps/runtime-player/src/control/control-window-app.tsx:243`. No parameter sliders, live input/mapping, dynamics playback, persistence, body-follow, or head-position motion were found.

## Remaining Risks / Gaps

- GUI/screenshot verification with an actual transparent Electron Stage Window was not run in this review.
- Real Runtime Export visual verification is still needed for complex clipping/deformer stacks and user-facing wheel/pan feel.
- Current loaded payload/render path remains single texture-page oriented; multi-page texture rendering was not expanded by Domain B.
- Control Window currently displays only the first four Stage diagnostic detail strings. This is acceptable for the Loop 2 requirement because warning/error status and details are surfaced, but a future debug drawer should expose the full diagnostic list.
- The Control label remains `Reset Stage Position` while Domain B behavior is Stage view reset. This matches the plan's allowance to reuse the existing reset affordance, but copy may need a later product cleanup.

## User-Decision Points

None required for Domain B spec compliance.
