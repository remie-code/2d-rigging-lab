# Runtime Player Wave3 Domain B: Stage Evaluated Render And View Transform Report

## Verdict Candidate

pass

## Files Changed

- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-render-diagnostics.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-render-diagnostics.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/main/stage-view-status-state.ts`
- `apps/runtime-player/src/main/stage-view-status-state.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/placeholder-bridge-handlers.ts`
- `apps/runtime-player/src/main/placeholder-action-state.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`

## Render Path Summary

- `StaticStageCanvasRendererController.setPayload()` now calls `createEvaluatedRuntimeExportStageRenderInput(payload)`.
- Stage rendering therefore consumes Domain A default-pose evaluation output:
  - evaluated drawable vertices
  - evaluated opacity
  - evaluated draw order
  - evaluated visibility
  - resolved mask relations from the evaluated snapshot
- Existing `render-core` / `render-webgl2` scene and viewport contracts remain unchanged.
- Raw RGBA texture bytes, texture metadata, alpha mode, and materialized atlas UVs are preserved by the evaluated scene adapter.
- Initial fit still uses exported `modelBounds`, manifest bounds fallback, or canvas bounds fallback. It does not use evaluated per-frame geometry bounds.
- Evaluation/adapter/render errors in `StageWindowApp` are caught, logged, and clear the Stage instead of crashing the renderer path.

## Stage Interaction Behavior

- Stage Window remains visually UI-free: no controls, overlays, handles, debug text, or parameter lists were added.
- Session-local view transform is held inside the imperative Stage renderer controller.
- Mouse wheel zoom applies to the Stage view only.
- Wheel zoom is anchored around the pointer in canvas viewport pixels.
- Left pointer drag pans the Stage view in canvas viewport pixels.
- Pan/zoom do not mutate Runtime Export data, runtime graph data, model parameters, keyforms, or render scene geometry.
- Loading a new Runtime Export resets the view transform to initial fit.
- Clearing the Stage also resets the view transform.

## Reset View Trigger

- Control Window continues to call `window.runtimePlayer.resetStagePosition()` from the existing `Reset Stage Position` button.
- Main process handles that narrow command and sends `runtime-player:stage-view:reset-requested` to the Stage Window.
- Preload exposes `window.runtimePlayer.stageView.onResetViewRequested(callback)`.
- Stage renderer handles the event by resetting pan/zoom to the exported-bounds initial fit.
- This resets the Stage view transform only; it does not change OS-level BrowserWindow placement.

## Tests And Commands

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`: pass
- Focused Vitest, sandboxed: failed with `spawn EPERM` while loading Vite/Vitest config through esbuild.
- Focused Vitest, elevated: `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/stage/stage-renderer/runtime-export-stage-scene.test.ts src/stage/stage-renderer/stage-view-transform.test.ts src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`: pass, 3 files / 11 tests.
- Runtime Player unit suite, elevated: `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test`: pass, 8 files / 38 tests.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check -- apps/runtime-player/src/stage apps/runtime-player/src/preload apps/runtime-player/src/main discussion/runtime-player/implementation/waves/wave3`: pass. Git reported existing LF-to-CRLF working-copy warnings only.
- `rg -n "[ \t]+$" <new Domain B files>`: pass, no matches.

## Loop 2 / Spec Review Fix

Blocking review finding addressed:

- Control Window did not expose Stage evaluation/render failures or runtime diagnostics.

Status path added:

- Added typed Stage view status contract:
  - `RuntimePlayerStageViewStatus`
  - `RuntimePlayerStageViewStatusReport`
  - statuses: `empty`, `ready`, `warning`, `error`
  - fields: `statusLabel`, `message`, `details`, `tone`, `updatedAtIso`
- Added narrow preload APIs:
  - `window.runtimePlayer.stageView.getStatus()`
  - `window.runtimePlayer.stageView.reportStatus(status)`
  - `window.runtimePlayer.stageView.onStatusChanged(callback)`
  - existing `onResetViewRequested(callback)` remains unchanged.
- Added main-process Stage status storage and relay:
  - Stage Window reports status to main.
  - Main stores the latest status.
  - Main broadcasts status changes to Control Window.
  - Control Window reads the latest status on startup and subscribes for changes.
- Control Window Stage panel now shows:
  - Stage render status label.
  - Human-readable status message.
  - Warning/error detail strings when present.
- Stage Window remains capture-clean; no visible Stage text, controls, overlays, handles, or debug UI were added.

Runtime diagnostics surfacing:

- `StaticStageCanvasRendererController.setPayload()` now returns formatted runtime diagnostic detail strings from `defaultPoseEvaluation.snapshot.diagnostics`.
- If diagnostics are non-empty, Stage reports `warning` with `Stage rendered with diagnostics` and the diagnostic details.
- Fatal setup/render/clear/reset failures report `error` with human-readable details.
- Successful evaluated rendering with no diagnostics reports `ready`.
- Empty/cleared Stage reports `empty`.

Loop 2 tests and commands:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`: pass.
- Focused Vitest, sandboxed: failed with `spawn EPERM` while loading Vite/Vitest config through esbuild.
- Focused Vitest, elevated: `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/stage-view-status-state.test.ts src/stage/stage-renderer/stage-render-diagnostics.test.ts src/stage/stage-renderer/runtime-export-stage-scene.test.ts src/stage/stage-renderer/stage-view-transform.test.ts src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`: pass, 5 files / 16 tests.
- Runtime Player unit suite, elevated first run: failed because the Stage boundary guard detected the visible-control phrase `Runtime Export` in a Stage production status string.
- Fixed the Stage-side empty status message to avoid setup/control phrasing in Stage production source.
- Runtime Player unit suite, elevated rerun: `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test`: pass, 10 files / 43 tests.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check -- apps/runtime-player/src/stage apps/runtime-player/src/control apps/runtime-player/src/preload apps/runtime-player/src/main discussion/runtime-player/implementation/waves/wave3`: pass. Git reported LF-to-CRLF working-copy warnings only.
- `rg -n "[ \t]+$" <new/updated Loop 2 files>`: pass, no matches.
- `rg -n "Runtime Export|Debug|Connect|<button" apps/runtime-player/src/stage -g "*.ts" -g "*.tsx"`: production source clean; matches are test-only Domain A text.

## Manual Visual Verification Steps

1. Start Runtime Player and open a valid Runtime Export directory.
2. Confirm Stage Window shows the evaluated default pose, not raw rest mesh.
3. Confirm authored default parameter keyforms affect at least one visible vertex deformation, opacity, or draw order case.
4. Confirm masks/clipping still render correctly.
5. Confirm the first placement fits by exported model/canvas bounds.
6. Use mouse wheel over Stage Window and verify zoom occurs around the pointer.
7. Left-drag on Stage Window and verify the model pans with no visible Stage UI.
8. Click Control Window `Reset Stage Position` and verify Stage returns to initial fit.
9. Resize Stage Window and verify the model remains fitted from exported bounds plus current session-local pan/zoom.

## Known Rendering / Interaction Limitations

- No live input, parameter mapping, dynamics time progression, body-follow, or head-position motion was added.
- Pan/zoom are session-local and are not persisted.
- Reset command currently reuses the existing Control label `Reset Stage Position`, but its implemented behavior is view reset, not OS window placement reset.
- Zoom scale is clamped to `0.1` through `12`.
- Wheel delta normalization covers pixel, line, and page delta modes, but device-specific feel still needs manual tuning.
- Agent-side GUI/screenshot verification was not run.

## Remaining Risks / Gaps

- Manual Electron verification with a real transparent Stage Window is still required.
- Real Runtime Export visual confirmation is required for complex clipping and deformer stacks.
- Current loaded payload contract still carries one raw texture page; multi-page texture rendering was not expanded in Domain B.
- Control Window status path is source/test verified but not GUI-smoke verified in Electron.

## User Decision Points

None for Domain B.
