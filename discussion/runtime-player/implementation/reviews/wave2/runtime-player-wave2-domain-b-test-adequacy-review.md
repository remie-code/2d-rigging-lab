# Runtime Player Wave2 Domain B Test Adequacy Review

> Target: `runtime-player-wave2-static-stage-renderer` / Test Adequacy Review  
> Date: 2026-06-22  
> Reviewer: Review-Sylph

## Verdict

`pass`

No blocking test adequacy gaps were found for Domain B. The Runtime Export -> Stage `RenderScene` adapter has focused tests for the required high-risk mappings, Runtime Player typecheck and unit tests pass, relevant render-core/render-webgl2 tests pass, and the Domain B report provides a credible manual visual verification path for a real Runtime Export when GUI/screenshot verification is not run.

## Scope / Basis Inspected

Basis documents inspected:

- `discussion/runtime-player/implementation/orchestration/player-wave2-plan.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/implementation/waves/wave2/runtime-player-wave2-domain-a-runtime-export-loader-ipc-report.md`
- `discussion/runtime-player/implementation/waves/wave2/runtime-player-wave2-domain-b-static-stage-renderer-report.md`

Source and tests inspected directly:

- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
- Existing `apps/runtime-player/src/**/*.test.ts`
- Relevant render package tests:
  - `packages/render-core/src/render-scene.test.ts`
  - `packages/render-webgl2/src/webgl2-renderer.test.ts`

Diff/status inspected:

- `git diff -- apps/runtime-player discussion/runtime-player/implementation/waves/wave2`
- `git diff --check`
- `git status --short -uall`

Note: `git diff -- apps/runtime-player ...` only showed tracked-file changes. Domain A/B new source and test files are currently untracked in this workspace, so this review also inspected those files directly from the filesystem and recorded the untracked status as a remaining integration risk, not a test adequacy blocker.

## Findings

### Blocking

None.

### Warning: Stage canvas lifecycle is source-inspected and manually verified, not unit-tested

`StageWindowApp` subscribes to loaded payload/status events, clears on non-loaded status, and disposes the renderer on unmount (`apps/runtime-player/src/stage/stage-window-app.tsx:68`, `apps/runtime-player/src/stage/stage-window-app.tsx:80`, `apps/runtime-player/src/stage/stage-window-app.tsx:84`, `apps/runtime-player/src/stage/stage-window-app.tsx:92`). `StaticStageCanvasRendererController` owns resize observation, explicit `setPayload`, `clear`, and `dispose` paths (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:48`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:59`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:64`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:69`).

There is no React/DOM lifecycle unit test or screenshot smoke for this path. This is acceptable for Domain B because the core transformation and reused WebGL renderer are covered by deterministic tests, and the Domain B report gives concrete manual verification steps. A later Electron/Playwright smoke should cover load -> render -> invalid-load-clear -> resize when the GUI environment is available.

### Warning: Adapter tests do not explicitly assert vertices/triangles

The adapter implementation maps Runtime Export vertices and triangles into `RenderMesh` (`apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts:57`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts:65`). The Stage adapter test asserts raw texture, content signature shape, atlas UVs, draw order, opacity, visibility, clipping metadata, and viewport transform, but it does not directly assert `body.mesh.vertices` or `body.mesh.triangles` (`apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts:64`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts:88`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts:95`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts:102`).

This is not blocking because render-webgl2 has mesh draw coverage and Runtime Export schemas validate triangle indices, but adding two explicit adapter assertions would make the test match the Wave2 rubric more completely.

## Adequacy Matrix

| Area | Evidence | Assessment |
|---|---|---|
| Raw RGBA texture source | Adapter test preserves `bytes`, dimensions, source metadata, alpha mode, and content signature (`runtime-export-stage-scene.test.ts:64`, `:88`). Adapter builds `RenderRgba8TextureSource` from Domain A payload (`runtime-export-stage-scene.ts:93`, `:110`). | Adequate |
| Texture content signature/cache behavior | render-core tests signature changes, identity memoization, and cache-key dimensions/alpha (`packages/render-core/src/render-scene.test.ts:44`, `:75`, `:123`). render-webgl2 tests cached texture reuse (`packages/render-webgl2/src/webgl2-renderer.test.ts:49`, `:60`). | Adequate |
| Atlas UV preservation | Adapter maps `model.meshes[].atlasUvs` into `RenderMesh.uvs` (`runtime-export-stage-scene.ts:61`), and the test asserts distinct atlas UV values are preserved (`runtime-export-stage-scene.test.ts:95`). | Adequate |
| Vertices / triangles | Adapter maps vertices and triangles (`runtime-export-stage-scene.ts:57`, `:65`). render-webgl2 tests draw a mesh and issue `drawElements` (`packages/render-webgl2/src/webgl2-renderer.test.ts:34`, `:45`). | Acceptable; strengthen with direct adapter assertions |
| Draw order | Adapter reads model draw order and falls back to base draw order (`runtime-export-stage-scene.ts:35`, `:72`). Test verifies ordered drawable ids and draw orders (`runtime-export-stage-scene.test.ts:102`, `:147`). | Adequate |
| Opacity / visibility | Adapter passes `drawable.opacity` and `drawable.visible` (`runtime-export-stage-scene.ts:71`, `:75`). Test checks visible target and invisible mask source values (`runtime-export-stage-scene.test.ts:156`, `:168`). | Adequate |
| Clipping mapping | Adapter maps mask relations to `drawable-alpha-mask-v0` metadata (`runtime-export-stage-scene.ts:131`). Test checks target clipping metadata (`runtime-export-stage-scene.test.ts:158`). render-webgl2 tests framebuffer mask rendering and unrenderable mask skip behavior (`packages/render-webgl2/src/webgl2-renderer.test.ts:63`, `:153`). | Adequate |
| Viewport fit/center | `createStageViewport` clamps size/padding and computes scale/translate (`stage-viewport.ts:12`, `:20`, `:30`). Test asserts expected fit/center transform (`runtime-export-stage-scene.test.ts:174`). | Adequate |
| Stage component/canvas lifecycle | Source has event subscription, clear, resize, and dispose paths (`stage-window-app.tsx:68`, `:80`, `:84`, `:92`; `static-stage-canvas-renderer.ts:48`, `:69`). Boundary test keeps Stage free of setup/debug controls (`apps/runtime-player/src/runtime-player-boundary.test.ts:26`). | Acceptable with manual verification; no automated lifecycle/screenshot test |
| WebGL raw upload | WebGL texture cache uploads RGBA via `texImage2D` with `UNPACK_ALIGNMENT=1` and source bytes/premultiplication path (`packages/render-webgl2/src/webgl2-textures.ts:40`, `:45`, `:54`, `:69`). Test verifies textured render invokes `texImage2D` and mesh draw (`packages/render-webgl2/src/webgl2-renderer.test.ts:34`, `:44`). | Adequate basic package coverage |
| Source/dependency guards | `node scripts/check-source-organization.mjs`, `node scripts/check-dependencies.mjs`, and `git diff --check` passed. | Adequate |
| No user/proprietary artifact dependency | Runtime Player tests build synthetic Runtime Export DTOs/fixtures in test code and do not require the user's real Runtime Export or third-party assets. | Adequate |

## Verification Commands / Results

Passed:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit`
  - Result: 6 test files / 30 tests passed.
- `pnpm.cmd exec vitest run packages/render-webgl2/src/webgl2-renderer.test.ts packages/render-core/src/render-scene.test.ts`
  - Result: 2 test files / 11 tests passed.
- `node scripts/check-source-organization.mjs`
  - Result: Source organization guard passed.
- `node scripts/check-dependencies.mjs`
  - Result: Dependency guard passed.
- `git diff --check`
  - Result: exit 0. Git emitted existing CRLF normalization warnings only.

Inspected:

- `git diff -- apps/runtime-player discussion/runtime-player/implementation/waves/wave2`
- `git status --short -uall`

## Remaining Risks / User-Decision Points

- GUI/screenshot verification was not run in this review session. Final integration should either run an Electron/Playwright visual smoke or execute the Domain B manual steps with a real Runtime Export.
- Add direct adapter assertions for `RenderMesh.vertices` and `RenderMesh.triangles` when touching the Stage adapter tests again.
- Add a thin Stage lifecycle smoke for loaded payload render, resize repaint, invalid-load clear, and disposal when a reliable DOM/WebGL/Electron test harness is available.
- Domain A/B new source, tests, and reports are currently untracked in this workspace. Integration/commit work must include them intentionally.
