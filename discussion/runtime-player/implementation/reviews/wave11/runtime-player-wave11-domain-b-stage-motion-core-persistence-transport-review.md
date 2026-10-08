# Runtime Player Wave11 Domain B Review: Stage Motion Core / Persistence / Transport

- verdict: pass
- reviewer: Review-Sylph
- target/domain: runtime-player-wave11-stage-motion-core-persistence-transport

## Findings

- Blocking/Major: none.
- Low, non-blocking test gap: `startRuntimePlayerMain` orchestration is not directly unit-tested. The reviewed code wires live-frame publication into `publishLatestStageMotionDisplayState` at `apps/runtime-player/src/main/runtime-player-main.ts:125` and calls it from the live frame path at `apps/runtime-player/src/main/runtime-player-main.ts:216`, while lower-level tests cover Stage Motion math, runtime input composition, transport, Browser Source sampling, Window State persistence, and native display overrides. This is not a Domain C blocker, but a future Electron-main integration test would reduce regression risk around async frame ordering and startup wiring.

## Spec Compliance

- Stage Motion settings and defaults are present in `apps/runtime-player/src/main/window-state/window-state-stage-motion-settings.ts:5`.
- Settings persist in Window State under `stageMotion.settings`; missing older documents are defaulted in `apps/runtime-player/src/main/window-state/window-state-document.ts:84` and `apps/runtime-player/src/main/window-state/window-state-document.ts:233`, while updates write settings only in `apps/runtime-player/src/main/window-state/window-state-controller.ts:136`.
- Main-owned computation uses saved base Stage view transform, current tracking frame, active Input Profile, session neutral, settings, and elapsed frame time through `RuntimePlayerStageMotionRuntime.update` in `apps/runtime-player/src/main/stage-motion/stage-motion-runtime.ts:31` and main wiring at `apps/runtime-player/src/main/runtime-player-main.ts:125`.
- Calibrated horizontal and depth inputs are consumed via `normalizeInputProfileHeadPositionHorizontal` and `normalizeInputProfileHeadPositionDepth` at `apps/runtime-player/src/main/stage-motion/stage-motion-runtime.ts:57` and `:62`.
- Dead zone, invert, strength, limit, and reaction/smoothing are applied in `apps/runtime-player/src/main/stage-motion/stage-motion-transform.ts:49`, `:57`, `:64`, `:71`, and `:78`.
- Browser Source receives the composed Stage transform through the sanitized `stageDisplayState.stageView.transform` path in `apps/runtime-player/src/main/stage-motion/stage-motion-transport.ts:11` and `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:246`.
- Native Stage preview receives the same composed transform only when native live rendering is active; suspension is gated in `apps/runtime-player/src/main/runtime-player-main.ts:96` and `:106`, with resume delivery at `:116`.
- Browser Source remains active during Wave10 native preview suspension because Browser Source publication happens before the native delivery gate in `apps/runtime-player/src/main/stage-motion/stage-motion-transport.ts:24`.
- Live transform delivery avoids high-frequency Control churn by using sampled Browser Source status notifications while broadcasting every transform, implemented in `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:257`, `:264`, and `:501`.
- Manual Stage pan/zoom remains the base transform. The native display override is separate from saved view reporting in `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:161`, `:174`, and `:305`.
- Current live offset / smoothed runtime state is in memory only, represented by `RuntimePlayerStageMotionRuntimeState` in `apps/runtime-player/src/main/stage-motion/stage-motion-transform.ts:6`; Window State stores only settings.
- Model Mapping Profile was not altered by Domain B. `git diff --name-only -- apps/runtime-player/src/main/model-mapping-profiles apps/runtime-player/src/main/model-mapping-bridge-handlers.ts apps/runtime-player/src/main/live-mapping` returned no files.
- Raw tracking/debug data is not added to Browser Source payloads. The Browser Source Stage display contract contains bounds plus transform only in `apps/runtime-player/src/preload/browser-source-status-contract.ts:36`, and focused tests assert no `headPosition` or `debug` in Stage display messages at `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts:177`.

## Design / Development Compliance

- Stage Motion is implemented as Stage-level display transform logic under focused files in `apps/runtime-player/src/main/stage-motion/`, not as Model Mapping or Runtime Export mutation.
- Persistence ownership stays in `apps/runtime-player/src/main/window-state/`, matching the Window State recommendation.
- Bridge surface for Domain C is limited to `stageMotion.settings` and `stageView.updateStageMotionSettings`, exposed in `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:134` and `:187`.
- Native Stage display override is delivered through a dedicated channel, `applyDisplayViewTransformRequested`, declared in `apps/runtime-player/src/preload/stage-view-bridge-channels.ts:22` and exposed to the Stage window in `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:31`.
- Source organization policy is respected. No `index.ts` implementation logic or catch-all source file was introduced; `node scripts/check-source-organization.mjs` passed.

## Test Adequacy

- Pure math coverage includes disabled/base behavior, dead zone, invert/limits, and time-based smoothing in `apps/runtime-player/src/main/stage-motion/stage-motion-transform.test.ts:14`, `:40`, `:63`, and `:95`.
- Runtime composition coverage verifies base transform plus calibrated horizontal/depth input and fallback to base transform when input is unavailable in `apps/runtime-player/src/main/stage-motion/stage-motion-runtime.test.ts:12` and `:44`.
- Transport coverage verifies Browser Source updates continue while native preview is suspended and that native preview receives the same composed transform when active in `apps/runtime-player/src/main/stage-motion/stage-motion-transport.test.ts:9` and `:38`.
- Persistence/default/backward compatibility coverage is present in `apps/runtime-player/src/main/window-state/window-state-store.test.ts:48` and `:208`, and live offset non-persistence is asserted in `apps/runtime-player/src/main/window-state/window-state-controller.test.ts:198` and `:245`.
- Browser Source sanitized payload and Control sampling are covered by `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts:137`, `:177`, and `:178`; Browser Source client-side message sanitization also drops unrelated debug/raw fields in `apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts:81`.
- Native display override not being reported as saved base view is covered by `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts:99`.
- Remaining risk is the non-blocking main orchestration test gap noted in Findings.

## Commands Run

- `pnpm.cmd exec vitest run src/control/stage-page.browser-source.test.ts src/main/broadcast-source/browser-source-session.test.ts src/main/stage-motion/stage-motion-runtime.test.ts src/main/stage-motion/stage-motion-transform.test.ts src/main/stage-motion/stage-motion-transport.test.ts src/main/stage-view-bridge-handlers.test.ts src/main/window-state/window-state-controller.test.ts src/main/window-state/window-state-store.test.ts src/preload/runtime-player-bridge.stage-view.test.ts src/preload/runtime-player-stage-bridge.test.ts src/preload/stage-view-bridge-channels.test.ts src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts` from `apps/runtime-player`: sandbox run failed with `spawn EPERM`; rerun with elevated permissions passed, 12 files / 49 tests.
- `pnpm.cmd run typecheck` from `apps/runtime-player`: passed.
- `node scripts/check-source-organization.mjs` from repo root: passed.
- `git diff --check -- apps/runtime-player/src discussion/runtime-player/implementation/waves/wave11` from repo root: passed; Git printed CRLF normalization warnings only.
- `pnpm.cmd run test:unit` from `apps/runtime-player`: passed, 68 files / 285 tests.
- `git diff --name-only -- apps/runtime-player/src/main/model-mapping-profiles apps/runtime-player/src/main/model-mapping-bridge-handlers.ts apps/runtime-player/src/main/live-mapping` from repo root: returned no files.
- `pnpm install`: not run.

## Open Risks / User Decision Points

- Real-device tuning for horizontal strength, scale strength, dead zone, limit, invert feel, and reaction still needs manual validation in later Wave11 integration.
- Main orchestration is reviewed by code inspection plus lower-level tests rather than a direct Electron-main integration test.
- No product/user decision is required before Domain C.

## Domain C Gate

Domain C can start.

Rationale: Domain B provides a stable bridge surface for UI work (`stageView.getState().stageMotion.settings` and `stageView.updateStageMotionSettings(update)`), persists settings in Window State, keeps live offsets transient, publishes sanitized composed transforms to Browser Source, preserves Wave10 native preview suspension behavior, and passes focused tests, typecheck, source organization guard, diff check, and the Runtime Player unit suite.
