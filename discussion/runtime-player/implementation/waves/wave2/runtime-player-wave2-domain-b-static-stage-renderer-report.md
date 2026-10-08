# Runtime Player Wave2 Domain B Report: Static Stage Renderer

> Target: `runtime-player-wave2-static-stage-renderer`  
> Date: 2026-06-22  
> Domain owner: Gnome implementation agent

## Verdict

`pass`

Domain B implementation and independent Review-Sylph gates pass. The Stage Window now consumes the Domain A loaded payload, converts the static Runtime Export model into the existing render-core `RenderScene`, and draws it through render-webgl2 on a transparent full-window canvas.

## Files Changed

Runtime Player Stage source:

- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/styles/global.css`

Runtime Player tests:

- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`

Discussion:

- `discussion/runtime-player/implementation/waves/wave2/runtime-player-wave2-domain-b-static-stage-renderer-report.md`

## Render Path Summary

- `StageWindowApp` now renders only a full-window transparent `<canvas>`.
- The Wave1 placeholder aura/body/label CSS and DOM have been removed from the Stage Window.
- Stage subscribes to:
  - `runtimeExport.getLoadedPayload()`
  - `runtimeExport.onLoadedPayload()`
  - `runtimeExport.onStatusChanged()`
- A loaded payload is converted by `createRuntimeExportStageRenderInput()` into:
  - one raw RGBA8 `RenderRgba8TextureSource`
  - one `RenderDrawable` per Runtime Export drawable
  - render-core clipping metadata for Runtime Export masks
  - model bounds used for viewport fitting
- `createStaticStageCanvasRenderer()` owns the imperative WebGL renderer lifecycle.
  - It creates the existing render-webgl2 renderer from the canvas.
  - It performs one render on payload load.
  - It repaints on resize through `ResizeObserver` and window resize.
  - It clears with an empty transparent `RenderScene` when Stage status becomes loading/error/empty.

## Export Fields Consumed

- `texturePage.metadata`
  - page id / texture id fallback
  - width / height
  - raw RGBA path
  - binary asset id
- `texturePage.bytes`
  - passed as the `RenderRgba8TextureSource.bytes` for WebGL upload
- `artifacts.model.renderAssumptions.alphaMode`
  - `premultiplied-alpha-v1` maps to render-core `premultiplied`
  - other current values map to `straight`
- `artifacts.model.drawables`
  - drawable id
  - mesh id
  - visible
  - opacity
  - base draw order fallback
- `artifacts.model.meshes`
  - vertices
  - materialized `atlasUvs`
  - triangles
- `artifacts.model.drawOrder`
  - authoritative draw order per drawable
- `artifacts.model.masks`
  - `sourceDrawableIds` map to `RenderDrawable.clipping.maskDrawableIds`
  - `targetDrawableIds` select the drawables receiving clipping
- `artifacts.model.modelBounds`
  - fit/center bounds, with manifest/canvas fallback
- `artifacts.atlas.pages[0].textureId`
  - texture id fallback if the texture page metadata does not carry one

## Clipping Support Status

Runtime Export `alpha-mask-v1` relations are mapped to render-core `drawable-alpha-mask-v0` clipping metadata. render-webgl2 already renders clipped drawables by drawing the referenced mask drawables into an alpha mask target and sampling that target in the drawable shader.

No fail-fast path was added for clipping because the existing renderer has the needed clipping field and mask render path. This implementation does not add a new mask-only render semantic; it follows the current render-core/render-webgl2 contract where mask source drawables are normal scene drawables referenced by clipped targets.

## Tests / Verification

Passed:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit`
  - Sandboxed run first failed with Vitest/esbuild `spawn EPERM`.
  - Elevated rerun passed: 6 test files / 30 tests.
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`
  - Passed with existing Git CRLF normalization warnings only.

Added deterministic Stage adapter coverage for:

- raw RGBA texture source creation
- preserving `model.meshes[].atlasUvs`
- draw order mapping
- opacity mapping
- visibility mapping
- clipping relation mapping
- fit/center viewport transform

## Manual Visual Verification Steps

1. Run the Runtime Player dev app:
   - `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player dev`
2. In Control Window, click `Open Runtime Export`.
3. Select a real Runtime Export directory containing `runtime-export.json`.
4. Confirm Stage Window shows only the model on a transparent background.
5. Confirm Stage Window has no placeholder aura/body, labels, controls, parameter sliders, or debug text.
6. Resize Stage Window and confirm the model remains centered and fitted.
7. After a successful load, try opening an invalid directory and confirm the Stage clears rather than keeping the previous model.

GUI/screenshot verification was not run in this agent session. The implementation was verified through typecheck, unit tests, source guards, and boundary tests.

Orch-Sylph parent-session final verification:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`: pass.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit`: sandbox run hit Vitest/esbuild `spawn EPERM`; elevated rerun passed 6 files / 30 tests.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check`: pass with existing CRLF normalization warnings only.

## Independent Review Summary

Review agents started and completed:

| Review | Verdict | Report |
|---|---|---|
| Spec Compliance Review | `pass` | [runtime-player-wave2-domain-b-spec-compliance-review.md](../../reviews/wave2/runtime-player-wave2-domain-b-spec-compliance-review.md) |
| Design / Development Compliance Review | `pass` | [runtime-player-wave2-domain-b-design-development-review.md](../../reviews/wave2/runtime-player-wave2-domain-b-design-development-review.md) |
| Test Adequacy Review | `pass` | [runtime-player-wave2-domain-b-test-adequacy-review.md](../../reviews/wave2/runtime-player-wave2-domain-b-test-adequacy-review.md) |

Review findings:

- No blocking or needs-change findings.
- Test Adequacy recorded non-blocking follow-up opportunities for direct adapter assertions on vertices/triangles and a future Stage lifecycle GUI/screenshot smoke.
- Spec/Design reviews recorded remaining final-integration risks around manual real-export visual verification, practical IPC payload size, and the existing Runtime Export UV-space label mismatch.

## Known Limitations / Remaining Risks

- Static default/rest pose only. No input connection, parameter keyform evaluation, dynamics, or time progression was implemented.
- Runtime Export UVs are `atlas-normalized-v1`; render-core currently exposes the UV space label `layer-local-top-left-0-1-v1`. The adapter preserves the numeric `atlasUvs` in `RenderMesh.uvs` and records this naming mismatch here.
- `unknown-alpha-v1` currently maps to render-core `straight`, matching the safest existing upload path but not proving the source alpha convention.
- If WebGL2 context creation fails, Stage stays capture-clean and records an internal `data-stage-render-state="error"`; no visible Stage error overlay or Control error IPC was added.
- Practical IPC payload size with the user's largest real Runtime Export still needs manual observation in final integration.
