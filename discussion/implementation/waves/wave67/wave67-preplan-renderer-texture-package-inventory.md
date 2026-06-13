# Wave67 Preplan Inventory: Renderer / Texture / Package Boundary

> Read-only Sylph inventory。Wave67でWebGL2共有renderer foundationを計画するための実装事実棚卸。

## Verdict

done

## Basis

- [Mesh Image Rendering Architecture](../../../design/mesh-rendering/mesh-image-rendering-architecture.md)
- [Mesh Rendering Design Map](../../../design/mesh-rendering/_map.md)
- [Canvas / Preview Component](../../../design/screen-design/components/canvas-preview.md)
- [Canvas Evaluation Pipeline v0](../../../design/canvas-evaluation/canvas-evaluation-pipeline-v0.md)

## Findings

### Current Rendering Path

- Editor Stage rendering entry is `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`.
- It builds `CanvasRenderProjection` through `createCanvasRenderProjection(...)`, then calls `renderCanvasProjection(...)`.
- Current evaluated drawable data is produced in `apps/editor/src/workspace/canvas/canvas-evaluation.ts`.
- Current projection into renderable drawables with raw bytes is in `apps/editor/src/workspace/canvas/canvas-projection.ts`.
- Current pixel rendering is all Canvas2D in `apps/editor/src/workspace/canvas/canvas-renderer.ts`.
- Current mesh image rendering uses Canvas2D triangle clip / transform in `canvas-renderer.ts` plus `canvas-triangle-texture-warp.ts`.
- Current clipping uses Canvas2D scratch/mask compositing with `destination-in`.
- Grid, origin, bounds, selection, mesh, and deformer overlays are also drawn by the Canvas2D renderer.

### Texture / Source Path

- PSD layer pixels are materialized as raw RGBA bytes in `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`.
- Import commit registers those bytes through `apps/editor/src/features/psd-import/model/psd-import-commit.ts` into `AuthoringSession.binaryAssets`.
- Current image refs are metadata plus raw bytes, not URLs.
- `CanvasEvaluatedTextureRef` has `textureId`, optional `sourceLayerId`, `binaryAssetId`, and `binaryAssetPath`.
- `CanvasRenderableDrawable` carries `renderBytes`, `renderWidth`, and `renderHeight`.
- `packages/package-format/src/texture-atlas.ts` already has atlas-ish metadata for `textureId`, `filePath`, `sourceLayerId`, and `binaryAssetRef`.

### Package Boundary

Relevant current packages/apps:

- `apps/editor`
- `packages/contracts`
- `packages/package-format`
- `packages/runtime-core`
- `packages/authoring-core`
- `packages/operation-core`
- `packages/validator-core`
- `packages/ai-interface`

Safe dependency direction:

- `packages/render-core` should be DTO / math / scene-contract oriented and depend on `contracts` at most.
- `packages/render-webgl2` should depend on `render-core`, and possibly `contracts`.
- `packages/render-webgl2` should avoid `authoring-core`, `operation-core`, `package-format`, and `apps/editor`.
- `apps/editor` can adapt `CanvasEvaluatedScene` into shared render scene and call `render-webgl2`.
- `runtime-core` should remain DOM/WebGL-free.

### Editor / Viewer Sharing

- There is currently no separate `apps/viewer`.
- `packages/runtime-core` has viewer/runtime evaluation data, but not a browser rendering path.
- Minimum shared contract should include evaluated drawable id, visibility, opacity, draw order/stable order, mesh vertices/uvs/triangles, bounds, mask source ids, and external texture source refs resolved by the caller.

### Canvas2D Sunset Targets

Replace first in `canvas-renderer.ts`:

- `drawDrawableStack`
- `drawDrawableImage`
- `drawDrawableMeshImage`
- `drawClippedDrawable`
- `getLayerCanvas`
- `CanvasBitmapCache`

Can remain temporarily:

- Stage projection/evaluation builders.
- Canvas2D overlays for grid, origin, bounds, selection, mesh, deformer.
- Hit testing and pointer interaction.
- Canvas2D triangle warp tests only if explicitly kept as debug fallback.

## Planning Implications

- Use current evaluated/projection data as the initial adapter source, not raw `AuthoringSession`.
- Put renderer-neutral DTOs in `render-core`.
- Put WebGL resource upload/cache/lifecycle in `render-webgl2`.
- Keep editor overlays separate until drawable image rendering, mesh deformation, opacity, draw order, and basic clipping reach parity.
- Avoid adding new rendering features to Canvas2D.

## Decision Points

- Whether `render-core` owns new DTO schemas or extends `contracts`.
- Exact texture source contract: raw RGBA bytes, `ImageBitmap`, URL/blob, or caller-provided upload handle.
- Whether clipping parity means current Canvas2D mask semantics exactly or a narrower v0 WebGL mask.
- Whether Canvas2D remains as explicit debug fallback after WebGL2 becomes primary.
