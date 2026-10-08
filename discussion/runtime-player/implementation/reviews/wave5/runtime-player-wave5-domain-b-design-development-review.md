# Runtime Player Wave5 Domain B Design / Development Compliance Re-review

## verdict

pass

Domain B now satisfies the Runtime Player Wave5 design/development boundary requirements after the preload/window split. The previous blocking issue is fixed: Stage no longer receives the broad Control bridge and uses a Stage-specific preload surface.

## scope reviewed

- Basis documents:
  - `discussion/runtime-player/implementation/orchestration/player-wave5-plan.md`
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/runtime-player/architecture/runtime-player-development-policy.md`
  - `discussion/runtime-player/architecture/technology-stack-decision.md`
  - `discussion/runtime-player/implementation/waves/wave5/runtime-player-wave5-domain-a-control-input-profile-calibration-report.md`
- Final source/tests under:
  - `apps/runtime-player/electron.vite.config.ts`
  - `apps/runtime-player/src/main/**`
  - `apps/runtime-player/src/preload/**`
  - `apps/runtime-player/src/control/**`
  - `apps/runtime-player/src/stage/**`
  - focused Runtime Player tests

## findings

### Blocking

None.

### Needs Changes

None.

### Non-blocking observations

- Stage bridge still type-imports `RuntimePlayerStageViewStatusReport` from `runtime-player-bridge-contract.ts`. This is type-only and does not expose the Control API at runtime; if Stage view reporting grows, splitting the shared Stage status type into a neutral contract file would further reduce coupling.
- Manual real-device verification was not performed in this review lane. This review confirms source boundaries, contract shape, and automated guards.

## previous blocking issue resolution

- Control and Stage preload build entries are split:
  - `apps/runtime-player/electron.vite.config.ts:32` to `apps/runtime-player/electron.vite.config.ts:35`
- Window management resolves separate preload outputs:
  - `apps/runtime-player/src/main/window-management/renderer-entry-url.ts:8` to `apps/runtime-player/src/main/window-management/renderer-entry-url.ts:13`
- Control receives `preload.mjs` and Stage receives `stage-preload.mjs`:
  - `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:21` to `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:28`
- `stage-preload.ts` installs only the Stage bridge:
  - `apps/runtime-player/src/preload/stage-preload.ts:1` to `apps/runtime-player/src/preload/stage-preload.ts:3`
- Stage renderer uses `window.runtimePlayerStage`, not `window.runtimePlayer`:
  - `apps/runtime-player/src/stage/stage-window-app.tsx:86`
  - `apps/runtime-player/src/stage/stage-window-app.tsx:98`
  - `apps/runtime-player/src/stage/stage-window-app.tsx:106`
  - `apps/runtime-player/src/stage/stage-window-app.tsx:124`
  - `apps/runtime-player/src/stage/stage-window-app.tsx:132`
  - `apps/runtime-player/src/stage/stage-window-app.tsx:217`
  - `apps/runtime-player/src/stage/stage-window-app.tsx:225`

## process boundary and preload surface

- `RuntimePlayerStageApi` exposes only:
  - Runtime Export read/subscribe: `getLoadedPayload`, `onStatusChanged`, `onLoadedPayload`
  - Live Parameters read/subscribe: `getLatestFrame`, `onFrame`, `onCleared`
  - Stage View report/reset: `reportStatus`, `onResetViewRequested`
  - Evidence: `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:10` to `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:31`
- Stage bridge implementation invokes only Runtime Export read channels, live parameter channels, and Stage View report/reset channels:
  - `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts:16` to `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts:50`
- Stage bridge contract/implementation do not expose:
  - `input`
  - `inputProfile`
  - `modelMapping`
  - diagnostics read/copy APIs
  - `runtimeExport.openDirectory`
  - raw `TrackingFrame`
  - raw frame samples / blendshapes
- Control bridge remains broad but is installed by `preload.ts` only:
  - `apps/runtime-player/src/preload/preload.ts:1` to `apps/runtime-player/src/preload/preload.ts:3`
  - `apps/runtime-player/src/preload/runtime-player-bridge.ts:46` to `apps/runtime-player/src/preload/runtime-player-bridge.ts:166`
- Renderer security settings keep `nodeIntegration: false` and `contextIsolation: true` for both windows:
  - `apps/runtime-player/src/main/window-management/browser-window-options.ts:25` to `apps/runtime-player/src/main/window-management/browser-window-options.ts:30`
  - `apps/runtime-player/src/main/window-management/browser-window-options.ts:45` to `apps/runtime-player/src/main/window-management/browser-window-options.ts:50`

## typed IPC and live parameter path

- Main owns the latest tracking frame, input profile lookup, mapping state, and sanitized parameter frame production:
  - `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts:45` to `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts:70`
- Live parameter IPC stores the latest sanitized frame and sends live frame/clear events only to the Stage window:
  - `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts:18` to `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts:29`
- Runtime Export load/change/clear resets mapping and stale live frames:
  - `apps/runtime-player/src/main/runtime-player-main.ts:48` to `apps/runtime-player/src/main/runtime-player-main.ts:66`
- Mapping slot update IPC validates request shape and bounds:
  - `apps/runtime-player/src/main/model-mapping-bridge-request-validation.ts:9` to `apps/runtime-player/src/main/model-mapping-bridge-request-validation.ts:67`
- Live parameter frame payload contains only runtime export identity, sequence/timestamps, and `parameterValues`:
  - `apps/runtime-player/src/preload/live-parameter-bridge-contract.ts:1` to `apps/runtime-player/src/preload/live-parameter-bridge-contract.ts:12`

## Stage model-only and runtime loop

- Stage UI remains model-only: `StageWindowApp` renders only the stage shell and canvas, with no setup controls or debug overlay:
  - `apps/runtime-player/src/stage/stage-window-app.tsx:151` to `apps/runtime-player/src/stage/stage-window-app.tsx:162`
- Stage consumes latest live frames imperatively and coalesces rendering through `requestAnimationFrame`, not React render cadence:
  - `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:109` to `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:119`
  - `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:169` to `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:194`
- Stage ignores stale or not-loaded frames by matching Runtime Export identity:
  - `apps/runtime-player/src/stage/stage-renderer/stage-live-parameter-frame-match.ts:4` to `apps/runtime-player/src/stage/stage-renderer/stage-live-parameter-frame-match.ts:13`
  - `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:109` to `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:115`
  - `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:198` to `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:204`
- Stage live render uses runtime-core evaluation with authored parameter values:
  - `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:33` to `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:89`
  - `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:209` to `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:225`

## forbidden dependencies and scope

- No `apps/editor/**` changes were present in the reviewed working tree.
- No new dependency was required; dependency guard passed.
- Runtime Player renderer production boundary tests cover raw Electron/Node imports.
- Source search found no Stage preload exposure of Control-only APIs or raw tracking payloads.
- Source search found no Stage production setup/debug controls; matches were limited to test names and normal Runtime Export test descriptions.
- Existing iFacialMocap parser still contains TCP delimiter parsing text from pre-Wave5 input adapter code; Domain B did not add TCP transport behavior.

## source organization evidence

- No substantial implementation logic was added to `index.ts`.
- No new broad catch-all `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` file was added.
- Domain B responsibility split is coherent:
  - `main/live-mapping/runtime-export-auto-mapping.ts`: Runtime Export target selection and Auto Mapping.
  - `main/live-mapping/runtime-parameter-frame.ts`: sanitized parameter frame production.
  - `main/live-mapping/live-mapping-state.ts`: in-memory mapping state.
  - `main/model-mapping-bridge-handlers.ts`: Control mapping IPC and live frame publish coordination.
  - `main/live-parameter-bridge-handlers.ts`: latest sanitized frame IPC event channel.
  - `preload/runtime-player-stage-bridge*.ts`: Stage-only preload API.
  - `stage/runtime-evaluation/runtime-export-pose-evaluator.ts`: runtime-core pose evaluation with authored values.
  - `stage/stage-renderer/static-stage-canvas-renderer.ts`: imperative Stage render loop.

## guards and tests

- Boundary tests now verify the Stage bridge and renderer do not use the Control API or expose Control/input/profile/mapping/raw tracking methods:
  - `apps/runtime-player/src/runtime-player-boundary.test.ts:49` to `apps/runtime-player/src/runtime-player-boundary.test.ts:87`
- Focused Vitest command:

```text
pnpm.cmd exec vitest run apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts apps/runtime-player/src/stage/stage-renderer/stage-live-parameter-frame-match.test.ts apps/runtime-player/src/runtime-player-boundary.test.ts
```

Result:

- pass, 6 files / 22 tests.

Other verification:

- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check -- apps/runtime-player/src apps/runtime-player/electron.vite.config.ts`: pass, with LF/CRLF working-copy warnings only.
- `pnpm install` was not run.

## remaining risks

- Real iFacialMocap + Runtime Export visual verification remains outside this review lane.
- Stage status details can include runtime evaluation diagnostics reported back to Control. They are not rendered on the Stage window and do not violate the model-only Stage rule.
