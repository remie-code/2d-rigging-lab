# Runtime Player Wave2 Domain B Spec Compliance Review

Verdict: pass

## Scope / Basis Inspected

Reviewed directly:

- `discussion/runtime-player/implementation/orchestration/player-wave2-plan.md`
- `discussion/runtime-player/screens/initial-runtime-player-screen.md`
- `discussion/runtime-player/architecture/technology-stack-decision.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- Domain A and Domain B implementation reports under `discussion/runtime-player/implementation/waves/wave2/`
- Target Stage source/tests/CSS:
  - `apps/runtime-player/src/stage/stage-window-app.tsx`
  - `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts`
  - `apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts`
  - `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
  - `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
  - `apps/runtime-player/src/styles/global.css`
- Relevant Domain A payload and renderer contracts:
  - `apps/runtime-player/src/preload/runtime-export-bridge-contract.ts`
  - `packages/package-format/src/runtime-export.ts`
  - `packages/render-core/src/render-scene.ts`
  - `packages/render-core/src/render-order.ts`
  - `packages/render-webgl2/src/webgl2-renderer.ts`
  - `packages/render-webgl2/src/webgl2-textures.ts`
  - `packages/render-webgl2/src/webgl2-shaders.ts`

Also inspected `git diff -- apps/runtime-player discussion/runtime-player/implementation/waves/wave2`,
`git status --short -uall`, and targeted `rg` searches. Several Domain A/B files are currently untracked, so source was read directly rather than relying only on tracked diff output.

## Findings

No blocking or needs-change spec findings found.

Severity: info

- GUI/screenshot verification was not performed in this review context. The static Stage render path is covered by source inspection, typecheck, and unit tests, but a real Runtime Export should still be opened manually to verify visual centering, transparency, and nonblank output in Electron.
- `unknown-alpha-v1` is mapped to render-core `straight` alpha in `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts:128`. This is not a Wave2 blocker, but final integration should verify real exports do not show alpha fringes or document the alpha convention decision.
- Existing render-webgl2 behavior skips clipped targets when every referenced mask drawable is missing or unrenderable (`packages/render-webgl2/src/webgl2-renderer.ts:77`). Domain B maps Runtime Export masks into that existing renderer contract; it does not add a new fail-fast diagnostic for unrenderable mask sources in the Stage renderer.

## Spec Compliance Notes

- Static Stage render is implemented through the Domain A payload bridge. `StageWindowApp` requests the current loaded payload, subscribes to loaded payload events, and passes payloads into the imperative canvas renderer (`apps/runtime-player/src/stage/stage-window-app.tsx:68`, `:80`, `:84`).
- Stage is UI-free after successful load. The Stage DOM is only a `<main>` and transparent `<canvas>` with a non-visible `data-stage-render-state` attribute (`apps/runtime-player/src/stage/stage-window-app.tsx:99`, `:102`). The Wave1 placeholder aura/body/label CSS was removed from `apps/runtime-player/src/styles/global.css`.
- Transparent/capture-friendly background is preserved through transparent Stage body/shell/canvas CSS (`apps/runtime-player/src/styles/global.css:26`, `:35`, `:43`) and the existing transparent Stage `BrowserWindow` options (`apps/runtime-player/src/main/window-management/browser-window-options.ts:42`, `:44`).
- Runtime Export model plus raw RGBA page are converted to renderer input in `createRuntimeExportStageRenderInput()` (`apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts:28`). Raw RGBA bytes are carried into `RenderRgba8TextureSource.bytes` (`:106`), then uploaded through the existing WebGL `texImage2D` path (`packages/render-webgl2/src/webgl2-textures.ts:45`).
- Materialized `model.meshes[].atlasUvs` are used directly as render mesh UVs (`apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts:61`). Atlas placements are not used to recompute UVs; atlas data is only used as a texture id fallback (`:98`).
- Wave2 remains rest/default-pose only. The Stage adapter consumes materialized mesh vertices and drawables but does not evaluate parameters, keyforms, input frames, dynamics, previous export restore, or runtime mutation.
- Fit/center is implemented in `createStageViewport()` using model bounds, viewport size, and padding (`apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts:12`).
- Draw order, opacity, and visibility are carried into `RenderDrawable` (`apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts:71`, `:72`, `:75`). render-core sorts drawables through the existing back-to-front contract (`packages/render-core/src/render-order.ts:24`), and render-webgl2 skips invisible or zero-opacity drawables (`packages/render-webgl2/src/webgl2-renderer.ts:315`).
- Clipping/masks are mapped from Runtime Export mask relations to `RenderDrawable.clipping` (`apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts:131`, `:145`). render-webgl2 has an existing framebuffer mask pass and shader mask sampling path (`packages/render-webgl2/src/webgl2-renderer.ts:72`, `:119`, `:134`; `packages/render-webgl2/src/webgl2-shaders.ts:47`).
- Stale successful renders are cleared on later loading/error/empty status changes (`apps/runtime-player/src/stage/stage-window-app.tsx:57`, `:111`). Domain A session state also clears the stored loaded payload on loading and error (`apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.ts:31`, `:70`).
- Renderer boundary is respected. Stage code uses the typed preload API and has no direct `node:*`, raw Electron, filesystem, dialog, or `apps/editor/**` imports.
- Control error/UI behavior is not regressed by Domain B. Control still subscribes to Runtime Export status and displays load errors through its existing status/error path (`apps/runtime-player/src/control/control-window-app.tsx:58`, `:212`).

## Verification Commands / Results

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Pass.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit`
  - Sandboxed run failed while loading Vitest config with esbuild `spawn EPERM`.
  - Elevated rerun passed: 6 test files, 30 tests.
- `git diff --check -- apps/runtime-player discussion/runtime-player/implementation/waves/wave2`
  - Pass, with existing CRLF normalization warnings only.
- `node scripts/check-source-organization.mjs`
  - Pass.
- `node scripts/check-dependencies.mjs`
  - Pass.
- Targeted forbidden UI/import search over Stage source, Stage CSS, and Runtime Export contract:
  - No forbidden Stage setup/debug/placeholder UI or renderer Node/Electron/editor imports found.
  - Only expected non-visible/error-log hit was `console.error` in `stage-window-app.tsx`.

## Remaining Risks / User-Decision Points

- Manual visual verification with the user's real Runtime Export remains required for final integration: open an export, confirm the Stage shows only the model on transparent background, resize the window, and then try a failed load to confirm the Stage clears.
- Practical IPC payload size with large real exports remains a final integration risk from Domain A/B combined behavior.
- No user decision is needed for Domain B spec compliance unless real-export visual testing exposes alpha or clipping differences.
