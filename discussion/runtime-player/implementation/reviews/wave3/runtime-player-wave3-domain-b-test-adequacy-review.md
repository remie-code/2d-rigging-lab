# Runtime Player Wave3 Domain B Test Adequacy Review

## Verdict

pass

No blocking or required-change test adequacy findings remain after Loop 2. The remaining gaps are low-risk automation gaps around Electron/DOM integration and are covered by source review plus manual visual verification steps for this wave.

## Scope reviewed

- Requested tracked diff for:
  - `apps/runtime-player/src/control/control-window-app.tsx`
  - `apps/runtime-player/src/main/placeholder-action-state.ts`
  - `apps/runtime-player/src/main/placeholder-bridge-handlers.ts`
  - `apps/runtime-player/src/main/runtime-player-main.ts`
  - `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
  - `apps/runtime-player/src/preload/runtime-player-bridge.ts`
  - `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
  - `apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts`
  - `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
  - `apps/runtime-player/src/stage/stage-window-app.tsx`
- Requested untracked/new Domain B files:
  - `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts`
  - `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.test.ts`
  - `apps/runtime-player/src/stage/stage-renderer/stage-render-diagnostics.ts`
  - `apps/runtime-player/src/stage/stage-renderer/stage-render-diagnostics.test.ts`
  - `apps/runtime-player/src/main/stage-view-status-state.ts`
  - `apps/runtime-player/src/main/stage-view-status-state.test.ts`
  - `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
  - `apps/runtime-player/src/preload/stage-view-bridge-channels.ts`
- Relevant Domain A / integrated test files:
  - `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
  - `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
  - `apps/runtime-player/src/runtime-player-boundary.test.ts`
- Domain B implementation report:
  - `discussion/runtime-player/implementation/waves/wave3/runtime-player-wave3-domain-b-stage-evaluated-render-and-view-transform-report.md`

## Basis used

- `discussion/runtime-player/implementation/orchestration/player-wave3-plan.md`
- `discussion/runtime-player/implementation/waves/wave3/runtime-player-wave3-domain-a-default-pose-evaluation-adapter-report.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Findings

### Low: Reset/status IPC and DOM event handlers are not directly executed by automated tests

The pure logic and renderer adapter regression tests are adequate, but no test currently executes the full Control -> main -> preload -> Stage reset/status route or dispatches real `wheel` / `pointer*` DOM events against the Stage canvas.

Relevant source-reviewed route:

- Control fetches/subscribes to Stage status and invokes reset: `apps/runtime-player/src/control/control-window-app.tsx:59`, `apps/runtime-player/src/control/control-window-app.tsx:72`, `apps/runtime-player/src/control/control-window-app.tsx:92`
- Main sends reset to Stage and stores/broadcasts status: `apps/runtime-player/src/main/placeholder-bridge-handlers.ts:43`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:18`
- Preload exposes typed Stage status/reset APIs: `apps/runtime-player/src/preload/runtime-player-bridge.ts:49`, `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:71`
- Stage consumes reset and calls the renderer: `apps/runtime-player/src/stage/stage-window-app.tsx:104`
- Canvas handlers are registered and implemented: `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:72`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:149`

Severity is low because the risky behavior is factored into pure tested helpers, the IPC/preload source is narrow and typechecked, and the Domain B report includes manual Electron visual checks for wheel zoom, drag pan, reset, and status visibility.

## Test adequacy confirmations

- Evaluated render regression is covered. `runtime-export-stage-scene.test.ts` compares raw rest rendering with evaluated rendering and asserts changed vertices, opacity, draw order, texture bytes, UVs, triangles, bounds, and empty diagnostics: `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts:203`.
- Runtime-core default pose evaluation remains covered by Domain A tests. The suite proves default parameters/keyforms change vertices, opacity, draw order, rig controls, deformer opacity multipliers, and diagnostics through runtime-core rather than Stage-side reimplementation: `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:216`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:289`.
- Evaluated render mapping covers masks/clipping. The render input test asserts evaluated vertices/opacity/draw order plus clipping and atlas UVs: `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:430`. The implementation maps resolved snapshot masks into render clipping: `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:155`.
- Stage now consumes evaluated output. `setPayload()` calls `createEvaluatedRuntimeExportStageRenderInput(payload)`, stores the evaluated scene, resets view transform, renders, and returns formatted diagnostics: `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:81`.
- Initial fit remains exported-bounds based. The evaluated scene keeps model/manifest/canvas bounds separate from evaluated vertices: `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:183`. `createStageViewport()` composes that initial fit with session-local view transform: `apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts:18`.
- Transform math coverage is adequate:
  - Reset equals initial exported-bounds fit: `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.test.ts:11`
  - Pointer-anchored wheel zoom plus drag pan: `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.test.ts:38`
  - Zoom clamping with stable pointer anchor: `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.test.ts:77`
- Loop 2 diagnostics coverage is adequate. Runtime diagnostics are formatted into Control-visible detail strings: `apps/runtime-player/src/stage/stage-renderer/stage-render-diagnostics.test.ts:8`.
- Loop 2 status normalization/storage coverage is adequate. Tests cover deterministic empty status, warning detail filtering, latest-status storage, and invalid-report fallback to error: `apps/runtime-player/src/main/stage-view-status-state.test.ts:10`, `apps/runtime-player/src/main/stage-view-status-state.test.ts:21`, `apps/runtime-player/src/main/stage-view-status-state.test.ts:48`, `apps/runtime-player/src/main/stage-view-status-state.test.ts:69`.
- Boundary guard evidence is credible. The guard checks renderer Node/Electron isolation, Stage production source absence of setup/debug/control UI text, and main-process separation from React/control/stage imports: `apps/runtime-player/src/runtime-player-boundary.test.ts:10`, `apps/runtime-player/src/runtime-player-boundary.test.ts:26`, `apps/runtime-player/src/runtime-player-boundary.test.ts:38`. Gnome's first full-suite failure on the forbidden Stage phrase and passing rerun after correction are credible evidence that this guard is effective.
- Manual visual coverage is present. The Domain B report requires real Runtime Export, evaluated default pose, clipping, wheel zoom, drag pan, Control reset, and resize checks: `discussion/runtime-player/implementation/waves/wave3/runtime-player-wave3-domain-b-stage-evaluated-render-and-view-transform-report.md:123`.

## Commands rerun

No package build, typecheck, or Vitest commands were rerun in this review. I performed read-only source inspection with `git status --short -uall`, the requested `git diff -- ...`, and targeted `rg -n` searches over the reviewed source/test files.

Gnome's verification evidence is sufficient for this lane despite the sandboxed Vitest `spawn EPERM` failure because:

- the failure is consistent with sandbox process-spawn restrictions around esbuild/Vitest config loading, not with a test assertion failure;
- elevated focused Vitest passed 5 files / 16 tests covering status state, diagnostics, evaluated scene, transform math, and default-pose evaluation;
- elevated full Runtime Player unit suite rerun passed 10 files / 43 tests after the boundary guard drove the Stage text correction;
- Runtime Player typecheck, source organization check, dependency check, and `git diff --check` were reported pass.

## Remaining risks/gaps

- A future thin integration/smoke test should exercise `resetStagePosition()` through main/preload to `StageWindowApp` reset handling.
- A future renderer/DOM smoke test should dispatch actual `wheel` and `pointer*` events against the Stage canvas. The current coverage proves the math, not browser event delivery.
- Agent-side GUI/screenshot verification was not run. Manual Electron verification remains required, especially for a real transparent Stage Window and complex clipping/deformer stacks.
- Multi-page texture rendering remains outside Domain B; the current loaded payload contract still carries one raw texture page.

## User-decision points

None for this review lane.
