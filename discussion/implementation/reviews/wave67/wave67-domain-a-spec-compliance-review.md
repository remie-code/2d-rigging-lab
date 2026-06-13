# Wave67 Domain A Spec Compliance Review

Verdict: `pass`

## Scope reviewed

- Review target: Wave67 Domain A `wave67-webgl2-shared-renderer-foundation`.
- Reviewed the requested Domain A source, tests, package manifests, and `pnpm-lock.yaml`.
- Checked Domain A integration only. Unrelated Wave67 Domain B/C canvas-evaluation, deformer, runtime, authoring, operation, and V4 sidecar changes were not reviewed except for direct Domain A boundary risk.
- No source files were edited by this review.

## Basis documents used

- `discussion/implementation/orchestration/wave67-plan.md`
- `discussion/implementation/waves/wave67/wave67-preplan-renderer-texture-package-inventory.md`
- `discussion/design/mesh-rendering/mesh-image-rendering-architecture.md`
- `discussion/design/mesh-rendering/_map.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/design/canvas-evaluation/canvas-evaluation-pipeline-v0.md`
- `.github/skills/implementation-orchestration/SKILL.md`

## Requirement classification

| Requirement | Status | Evidence |
|---|---|---|
| Add renderer-neutral `render-core` package/module. | `implemented` | `packages/render-core/package.json:2`; exports in `packages/render-core/src/index.ts:1`. |
| Add WebGL2 backend package/module. | `implemented` | `packages/render-webgl2/package.json:2`; dependency only on render-core at `packages/render-webgl2/package.json:9`. |
| `render-core` defines render scene / drawable / texture refs / mesh / UV / opacity / draw order / visibility / clipping relationship. | `implemented` | `packages/render-core/src/render-scene.ts:17`, `:25`, `:35`, `:48`, `:53`, `:65`. |
| `render-core` defines a renderer backend interface. | `implemented` | `packages/render-core/src/renderer-backend.ts:17`. |
| Render scene coordinate / UV spaces are explicit and layer-local UV is preserved. | `implemented` | `packages/render-core/src/render-scene.ts:2`, `:4`, `:18`; editor adapter maps evaluated UVs unchanged at `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:43`. |
| RenderScene is deterministic. | `implemented` | Deterministic order by draw order, stable index, id at `packages/render-core/src/render-order.ts:7`; test at `packages/render-core/src/render-scene.test.ts:16`. |
| WebGL2 backend renders textured mesh vertices / UVs / triangles. | `implemented` | Mesh upload at `packages/render-webgl2/src/webgl2-mesh.ts:1`; draw call path at `packages/render-webgl2/src/webgl2-renderer.ts:206`; shader samples texture at `packages/render-webgl2/src/webgl2-shaders.ts:45`; test at `packages/render-webgl2/src/webgl2-renderer.test.ts:28`. |
| WebGL2 uses premultiplied-alpha-friendly blending. | `implemented` | `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)` at `packages/render-webgl2/src/webgl2-renderer.ts:110`; straight-alpha upload is premultiplied at `packages/render-webgl2/src/webgl2-textures.ts:65`; test at `packages/render-webgl2/src/webgl2-renderer.test.ts:37`. |
| Texture upload/cache uses a safer key than id/dimensions/byte length when possible. | `implemented` | Content signature includes bytes at `packages/render-core/src/texture-signature.ts:13`; cache key includes alpha mode and signature at `packages/render-core/src/texture-signature.ts:30`; WebGL cache uses it at `packages/render-webgl2/src/webgl2-textures.ts:18`. |
| Initial texture source may use raw RGBA bytes plus metadata. | `implemented` | `RenderRgba8TextureSource` at `packages/render-core/src/render-scene.ts:35`; editor adapter passes bytes and source metadata at `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:79`. |
| Texture preparation should allow premultiplied-alpha handling; edge padding/color dilation may be minimal in v0. | `implemented` for premultiply, `deferred by plan` for edge padding/color dilation | Alpha mode and upload premultiply exist at `packages/render-core/src/render-scene.ts:6` and `packages/render-webgl2/src/webgl2-textures.ts:65`. No v0 color dilation/edge padding package was required by Domain A acceptance. |
| Editor adapts current evaluated/projection data into shared RenderScene, not raw `AuthoringSession`. | `implemented` | Adapter accepts `CanvasRenderProjection` at `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:24`; it maps evaluated mesh/opacity/order/clipping at `:43`, `:56`, `:57`, `:61`. |
| Editor Preview routes main drawable image rendering through WebGL2 when available. | `implemented` | `renderCanvasProjection` tries WebGL2 stack before Canvas2D stack at `apps/editor/src/workspace/canvas/canvas-renderer.ts:102`; WebGL context/renderer construction at `:212`; panel invokes renderer at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:241`. |
| Mesh-deformed drawables are drawn through WebGL2, not Canvas2D triangle clip, in the primary path. | `implemented` | WebGL render path uses `createRenderSceneFromCanvasProjection` at `apps/editor/src/workspace/canvas/canvas-renderer.ts:168`; Canvas2D `drawDrawableStack` is only fallback when WebGL draw returns false at `:114`; test asserts no `clip`/`transform` in WebGL primary at `apps/editor/src/workspace/canvas/canvas-renderer.test.ts:292`. |
| Opacity is reflected in WebGL output. | `implemented` | Adapter maps opacity at `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:56`; WebGL shader uniform at `packages/render-webgl2/src/webgl2-renderer.ts:233`; shader applies it at `packages/render-webgl2/src/webgl2-shaders.ts:51`. |
| Draw order is reflected in WebGL output. | `implemented` | Adapter maps `frontOrder` to `drawOrder` at `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:57`; render-core ordering at `packages/render-core/src/render-order.ts:7`; WebGL renderer orders drawables at `packages/render-webgl2/src/webgl2-renderer.ts:60`. Existing projection tests show smaller `frontOrder` is topmost and list is back-to-front at `apps/editor/src/workspace/canvas/canvas-projection.test.ts:68`. |
| Basic clipping is implemented as WebGL renderer composition/mask behavior or escalated. | `implemented` | RenderScene clipping DTO at `packages/render-core/src/render-scene.ts:48`; adapter maps mask source ids at `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:61`; WebGL framebuffer mask path at `packages/render-webgl2/src/webgl2-renderer.ts:70`, `:119`, `:144`; shader samples mask alpha at `packages/render-webgl2/src/webgl2-shaders.ts:46`; test at `packages/render-webgl2/src/webgl2-renderer.test.ts:57`. |
| Existing Stage test ids and semantic E2E hooks remain stable. | `implemented` | Canvas surface and semantic data hooks remain at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:546`, `:566`, `:643`. |
| Existing Canvas2D overlays may remain temporarily. | `implemented` | Grid/origin/bounds are still Canvas2D before drawable stack and overlays remain after it at `apps/editor/src/workspace/canvas/canvas-renderer.ts:88`, `:118`, `:122`, `:131`. |
| Canvas2D triangle renderer must not receive new feature work. | `implemented` | New primary path is WebGL2; existing Canvas2D `drawDrawableStack`, `drawClippedDrawable`, and triangle clip remain fallback at `apps/editor/src/workspace/canvas/canvas-renderer.ts:236`, `:559`, `:607`. |
| WebGL2 renderer must not depend on `apps/editor`, `authoring-core`, `operation-core`, or `package-format`. | `implemented` | `packages/render-webgl2/package.json:9` depends only on render-core; `rg "@private-2d-rigging-lab/(editor|authoring-core|operation-core|package-format)|apps/editor|AuthoringSession|canvas-projection" packages/render-webgl2 packages/render-core` returned no matches. |
| Renderer must not read `AuthoringSession` directly. | `implemented` | Renderer package has no `AuthoringSession` references by search; editor-side adapter receives `CanvasRenderProjection`, not `AuthoringSession`, at `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:24`. |
| Do not claim Photoshop pixel-perfect parity. | `explicit non-goal` | No Domain A source or tests introduce pixel-perfect Photoshop oracle; architecture lists it as non-goal. |
| Editor Preview and Viewer share the same renderer contract. | `implemented` at package boundary, `deferred by plan` for Viewer integration | Shared `render-core`/`render-webgl2` packages exist and editor consumes them; Viewer app creation is explicitly not mandatory in Wave67. |
| Full blend modes, layer effects, smart objects, vector masks, WebGPU, Three.js/PixiJS adoption, texture atlas UI, Viewer app creation. | `explicit non-goal` | Wave67 plan out-of-scope section and architecture non-goals exclude these; no Domain A implementation adds them. |
| Parent-child deformer semantics and Mesh V4 sidecar requirements. | `not relevant` | Domain B/C scope; WebGL2 renderer consumes evaluated vertices only and has no deformer or V4 logic. |

## Findings

No blocking or non-blocking spec-compliance findings were found in the reviewed Domain A source.

## Verification considered

- Reviewed the reported verification from Orch-Sylph:
  - `pnpm.cmd exec vitest run packages/render-core/src packages/render-webgl2/src apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts apps/editor/src/workspace/canvas/canvas-renderer.test.ts`: passed outside sandbox after sandbox `spawn EPERM`; 4 files / 12 tests.
  - `pnpm.cmd typecheck`: passed.
  - `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`: passed.
  - `node scripts/check-source-organization.mjs`: passed.
  - `node scripts/check-dependencies.mjs`: passed.
  - `git diff --check` on Domain A files: passed with LF/CRLF warnings only.
  - Prohibited dependency/reference search for render packages: no matches.
- Static review independently confirmed the prohibited dependency/reference search over `packages/render-webgl2` and `packages/render-core` returned no matches.
- I did not rerun the full test/typecheck suite during this review turn.

## Residual risks

- The WebGL2 tests use a fake WebGL2 context and verify command flow, not browser GPU pixels. Visual artifacts such as sampling seams, antialiasing differences, and mask edge quality still need browser/manual or future visual verification.
- Texture edge padding/color dilation is not implemented in v0; only alpha-mode handling and premultiplied upload are present. This is acceptable for Domain A foundation but remains part of the architecture backlog.
- Canvas2D fallback still exists for unavailable/failed WebGL2 and for overlays. The primary route is WebGL2, but complete Canvas2D renderer sunset remains future cleanup.
- The expected Domain A implementation completion report file was not present at review time; this review validated source/spec compliance directly and considered the supplied verification summary.

## User-decision points

None.
