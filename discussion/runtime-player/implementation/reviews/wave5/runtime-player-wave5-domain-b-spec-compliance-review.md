# Runtime Player Wave5 Domain B Spec Compliance Review

> Final re-review after post-review fixes, with specific attention to split Control/Stage preload and the Stage receiving only sanitized live parameter frames.

## Verdict

pass

Domain B satisfies the Wave5 spec at source/test level. No blocking or needs-change findings were found after the preload split and live-parameter boundary fixes.

## Scope Reviewed

- Split preload / window wiring:
  - `apps/runtime-player/electron.vite.config.ts`
  - `apps/runtime-player/src/main/window-management/renderer-entry-url.ts`
  - `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`
  - `apps/runtime-player/src/main/window-management/browser-window-options.ts`
  - `apps/runtime-player/src/preload/preload.ts`
  - `apps/runtime-player/src/preload/stage-preload.ts`
  - `apps/runtime-player/src/preload/runtime-player-bridge.ts`
  - `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
  - `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`
  - `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`
- Live mapping and frame production:
  - `apps/runtime-player/src/main/live-mapping/**`
  - `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts`
  - `apps/runtime-player/src/main/model-mapping-bridge-request-validation.ts`
  - `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts`
  - `apps/runtime-player/src/main/input-bridge-handlers.ts`
  - `apps/runtime-player/src/main/input-profile-bridge-handlers.ts`
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts`
  - `apps/runtime-player/src/main/runtime-player-main.ts`
- Control Mapping / readiness UI:
  - `apps/runtime-player/src/control/control-window-app.tsx`
  - `apps/runtime-player/src/control/control-window-shell.tsx`
  - `apps/runtime-player/src/control/overview-page.tsx`
  - `apps/runtime-player/src/control/input-page.tsx`
  - `apps/runtime-player/src/control/mapping-page.tsx`
- Stage runtime/render path:
  - `apps/runtime-player/src/stage/stage-window-app.tsx`
  - `apps/runtime-player/src/stage/runtime-evaluation/**`
  - `apps/runtime-player/src/stage/stage-renderer/**`
- Focused Runtime Player boundary/mapping/stage tests.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave5-plan.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/architecture/tracking-input-mapping-baseline.md`
- `discussion/runtime-player/implementation/waves/wave5/runtime-player-wave5-domain-a-control-input-profile-calibration-report.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Findings

### Blocking

None.

### Needs Changes

None.

### Non-blocking Observations

- The Domain B implementation report is still absent from `discussion/runtime-player/implementation/waves/wave5/`; `_map.md` still lists `runtime-player-wave5-domain-b-auto-mapping-stage-live-report.md` as `Pending`. This remains a final integration closeout item, not a blocking source-level Domain B spec issue.
- Manual real-device verification was not performed by this reviewer. Automated tests confirm the mapping and Stage evaluation path, but final Wave5 closeout should still verify real iFacialMocap input moving a loaded Runtime Export model on the clean Stage Window.

## Spec Compliance Notes

- Control and Stage now have distinct preload entries. Electron Vite builds both `preload` and `stage-preload` entries in `apps/runtime-player/electron.vite.config.ts:31`; window management resolves separate preload files in `apps/runtime-player/src/main/window-management/renderer-entry-url.ts:8` and passes the Stage preload only to the Stage BrowserWindow in `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:21`.
- `stage-preload.ts` only installs the Stage bridge, and the Stage bridge exposes `runtimeExport`, `liveParameters`, and `stageView` under `window.runtimePlayerStage`; it does not expose the full Control `runtimePlayer` API. See `apps/runtime-player/src/preload/stage-preload.ts:1`, `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:27`, and `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts:15`.
- Boundary tests now assert the split preload contract: Stage production code uses `window.runtimePlayerStage`, does not use `window.runtimePlayer`, and Stage bridge sources do not contain `RuntimePlayerInputApi`, `RuntimePlayerInputProfileApi`, `RuntimePlayerModelMappingApi`, `getDiagnostics`, `openDirectory`, `TrackingFrame`, `rawFrame`, or `blendshapes`. See `apps/runtime-player/src/runtime-player-boundary.test.ts:49`.
- The live frame contract sent to Stage is sanitized: `RuntimePlayerLiveParameterFrame` contains runtime export identity, sequence/timestamps, and `parameterValues` only. It does not contain raw tracking frames, blendshapes, diagnostics, or Control setup state. See `apps/runtime-player/src/preload/live-parameter-bridge-contract.ts:1`.
- Main owns raw tracking, profile, session neutral, mapping, and parameter-frame production. `input-bridge-handlers` records raw UDP frames in main state and invokes the live publish callback at input frame receipt, while throttled diagnostics are sent only to the Control Window. See `apps/runtime-player/src/main/input-bridge-handlers.ts:92` and `apps/runtime-player/src/main/input-bridge-handlers.ts:159`.
- `model-mapping-bridge-handlers` creates live parameter frames from Runtime Export payload, latest tracking frame, session neutral, active/temporary Input Profile, and current mapping slots, then publishes only the sanitized frame. Missing payload/frame/profile clears live state instead of sending partial data. See `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts:45`.
- `live-parameter-bridge-handlers` sends live parameter frames and clear events only to `windows.stageWindow`, while keeping the latest sanitized frame for Stage startup catch-up. See `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts:18`.
- Auto Mapping defines all required Wave5 semantic slots: head horizontal/vertical/tilt, left/right blink, gaze horizontal/vertical, mouth open, and mouth smile. See `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts:30`.
- Auto Mapping filters targets to authored external-input parameters and excludes read-only, computed, hidden, internal, or manifest-excluded parameters. See `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts:37` and the focused regression in `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts:67`.
- Mapping output finite-filters and clamps parameter values, and slot `enabled`, `invert`, and `strength` are applied before publication. See `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:31` and `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts:67`.
- Mapping UI exposes Auto Map plus slot `Enabled`, `Invert`, and `Strength` controls only. No persistent Model Mapping Profile save, raw source selector, smoothing, deadzone, response curve editor, Body Follow, Stage Motion, TCP, or runtime parameter sliders were found in the Domain B UI/source surfaces. See `apps/runtime-player/src/control/mapping-page.tsx:77` and `apps/runtime-player/src/control/mapping-page.tsx:157`.
- Control Window navigation exposes only real Wave5 pages: `Overview`, `Input`, and `Mapping`; no empty `Model`, `Stage`, or dedicated `Diagnostics` page is exposed. See `apps/runtime-player/src/control/control-window-shell.tsx:6`.
- Stage renderer receives live frames through `window.runtimePlayerStage.liveParameters`, applies them to the canvas renderer, and renders only a canvas in the Stage DOM. See `apps/runtime-player/src/stage/stage-window-app.tsx:123` and `apps/runtime-player/src/stage/stage-window-app.tsx:151`.
- Stage ignores stale or payload-not-loaded frames by matching package id, package revision, and `loadedAtIso`. See `apps/runtime-player/src/stage/stage-renderer/stage-live-parameter-frame-match.ts:4` and `apps/runtime-player/src/stage/stage-renderer/stage-live-parameter-frame-match.test.ts:8`.
- Stage live evaluation uses runtime-core through `evaluateRuntimeFrame`, passing live `parameterValues` as authored parameter overrides rather than reimplementing deformer/keyform logic. See `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:33` and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:194`.
- Runtime Export load/change clears stale live state in main and Stage. Main clears mapping/live frames on changing, loaded, and cleared transitions; Stage clears on non-loaded status and resets live frame state when a new payload is set. See `apps/runtime-player/src/main/runtime-player-main.ts:48` and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:91`.

## Verification Performed

- Read required basis documents and final source/tests directly.
- Inspected current git status and confirmed this review is against the current uncommitted Wave5 implementation state.
- Searched source for split preload wiring, Stage raw tracking access, live parameter channels, forbidden features, Control page exposure, and mapping target filters.
- Ran focused tests:

```text
pnpm.cmd exec vitest run apps/runtime-player/src/runtime-player-boundary.test.ts apps/runtime-player/src/main/window-management/browser-window-options.test.ts apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts apps/runtime-player/src/stage/stage-renderer/stage-live-parameter-frame-match.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts
```

Result: pass, 7 files / 25 tests.

- Ran Runtime Player typecheck:

```text
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck
```

Result: pass.

- Ran Runtime Player unit suite:

```text
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit
```

Result: pass, 23 files / 90 tests.

The first sandboxed focused-test attempt failed with `spawn EPERM` while Vitest/Vite tried to start `esbuild`; the same test command was rerun with escalation and passed. No `pnpm install` was run.

## Remaining Issues

- Real-device/manual verification remains: confirm actual iFacialMocap input moves a loaded Runtime Export model visually on the clean Stage Window.
- Final integration should create/update the missing Domain B implementation report before Wave5 closeout if the Wave5 expected-artifact list remains unchanged.

## User-decision Points

None for Domain B spec compliance.
