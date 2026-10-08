# Runtime Player Wave5 Domain B Report: Auto Mapping + Stage Live Parameter Application

> Target: `runtime-player-wave5-auto-mapping-stage-live`  
> Verdict: pass  
> Scope: Auto Mapping v0, semantic mapping slot controls, sanitized runtime parameter frame production, main-to-Stage live parameter channel, Stage runtime-core live evaluation, and focused tests/reviews.

## Files Changed

Main mapping and live frame ownership:

- `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts`
- `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts`
- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`
- `apps/runtime-player/src/main/live-mapping/live-mapping-state.ts`
- `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts`
- `apps/runtime-player/src/main/model-mapping-bridge-request-validation.ts`
- `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-profile-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`

Preload and window boundary:

- `apps/runtime-player/electron.vite.config.ts`
- `apps/runtime-player/src/main/window-management/renderer-entry-url.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`
- `apps/runtime-player/src/preload/model-mapping-bridge-channels.ts`
- `apps/runtime-player/src/preload/model-mapping-bridge-contract.ts`
- `apps/runtime-player/src/preload/live-parameter-bridge-channels.ts`
- `apps/runtime-player/src/preload/live-parameter-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`
- `apps/runtime-player/src/preload/stage-preload.ts`

Control and Stage:

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/mapping-page.tsx`
- `apps/runtime-player/src/control/overview-page.tsx`
- `apps/runtime-player/src/control/control-window-formatters.ts`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-live-parameter-frame-match.ts`

Focused tests:

- `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts`
- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-live-parameter-frame-match.test.ts`
- `apps/runtime-player/src/runtime-player-boundary.test.ts`

Review artifacts:

- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-domain-b-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-domain-b-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-domain-b-test-adequacy-review.md`

## Mapping Slot Behavior

Auto Mapping v0 creates the required nine semantic slots:

- Head horizontal -> `Face Angle X`
- Head vertical -> `Face Angle Y`
- Head tilt -> `Face Angle Z`
- Eye blink left -> `Eye Left Open`
- Eye blink right -> `Eye Right Open`
- Gaze horizontal -> `Eyeball X`
- Gaze vertical -> `Eyeball Y`
- Mouth open -> `Mouth Open`
- Mouth smile -> `Mouth Smile`

Target selection uses Runtime Export parameter metadata and `inputManifest`. It maps only authored direct external-input parameters and excludes computed dynamics outputs, hidden direct-control parameters, read-only parameters, runtime-internal parameters, non-external authored parameters, and manifest-excluded parameters.

The Mapping page now displays Auto Mapping status and per-slot controls for:

- `enabled`
- `invert`
- `strength`

No persistent Model Mapping Profile save, raw source selector, smoothing, curve, deadzone, Body Follow, Stage Motion, TCP, or runtime parameter sliders were added.

## Sanitized Parameter Frame Contract

Main produces `runtime-player-live-parameter-frame-v1` frames from:

```text
latest TrackingFrame
-> session neutral
-> active saved Input Profile or temporary defaults
-> mapping slots
-> finite clamped parameterValues
```

The frame sent to Stage contains only:

- Runtime Export identity: `packageId`, `packageRevision`, `loadedAtIso`
- `sequence`
- `producedAtIso`
- `sourceFrameTimestampMs`
- `parameterValues`

It does not contain raw tracking frames, raw blendshapes, diagnostics, profile documents, mapping edit commands, filesystem paths, or socket details.

## Stage Live Path

Stage live motion path:

```text
main input frame receipt
-> main mapping state creates sanitized parameter frame
-> main live-parameter bridge publishes to Stage
-> Stage-specific preload exposes only minimal Stage API
-> Stage coalesces latest frame with requestAnimationFrame
-> runtime-core evaluateRuntimeFrame receives authored parameter values
-> WebGL render updates from evaluated snapshot
```

The Stage Window remains model-only. It renders only the canvas and no debug overlay, raw tracking text, setup controls, or parameter sliders.

After review, Control and Stage preload surfaces were split:

- Control uses `preload.mjs` and the full Control API.
- Stage uses `stage-preload.mjs` and `window.runtimePlayerStage`.
- The Stage preload exposes only Runtime Export read/subscribe, live parameter read/subscribe, and Stage status/report/reset operations.

Runtime Export reload/change clears main live state and mapping state, and Stage ignores stale live frames unless the frame Runtime Export identity matches the currently loaded payload.

## Review Results

Final Domain B review lanes all pass:

- Spec Compliance: pass.
- Design / Development Compliance: pass.
- Test Adequacy: pass.

Applied fixes after first review:

- Split Control and Stage preload entries and window wiring.
- Added Stage-only bridge contract and implementation.
- Updated Stage renderer to use `window.runtimePlayerStage` instead of the broad Control bridge.
- Added boundary regression coverage for the Stage preload contract.
- Added Auto Mapping tests for `runtime-internal` and non-external authored target exclusions.
- Added parameter-frame tests for custom learned signs/ranges and missing/non-finite/invalid-range inputs.
- Added Stage stale/not-loaded live frame identity tests.

## Verification Performed

No `pnpm install` was run.

- Focused Domain B Vitest:
  - `pnpm.cmd exec vitest run -c vitest.config.ts src/main/live-mapping/runtime-export-auto-mapping.test.ts src/main/live-mapping/runtime-parameter-frame.test.ts src/stage/stage-renderer/stage-live-parameter-frame-match.test.ts src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts src/stage/stage-renderer/runtime-export-stage-scene.test.ts src/runtime-player-boundary.test.ts`
  - Result: pass, 6 files / 22 tests.
- Runtime Player typecheck:
  - `pnpm.cmd typecheck`
  - Result: pass.
- Runtime Player build:
  - `pnpm.cmd build`
  - Result: pass; emitted both `preload.mjs` and `stage-preload.mjs`.
- Runtime Player unit suite:
  - `pnpm.cmd test:unit`
  - Result: pass, 23 files / 90 tests.
- Source organization guard:
  - `node scripts/check-source-organization.mjs`
  - Result: pass.
- Dependency guard:
  - `node scripts/check-dependencies.mjs`
  - Result: pass.
- Scoped whitespace check:
  - `git diff --check -- apps/runtime-player/src apps/runtime-player/electron.vite.config.ts`
  - Result: pass, with LF/CRLF working-copy warnings only.

## Source Organization

- No implementation logic was added to `index.ts`.
- No broad catch-all `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` file was added.
- New files are split by responsibility: semantic slot definitions, target selection, parameter-frame production, mapping state, bridge handlers, Stage-only bridge, runtime pose evaluation, and stale-frame identity matching.
- No source organization exception is requested.

## Remaining Issues

- Manual real-device verification remains for Domain C/final integration:
  - real iFacialMocap input moves a loaded Runtime Export model on Stage,
  - Stage remains model-only during live motion,
  - Runtime Export reload/clear does not leave stale live pose state.
- `apps/runtime-player/out/` was produced by `pnpm.cmd build` and is ignored.

## User Decision Points

None for Domain B.

## Domain C Readiness

Domain C final integration can start.
