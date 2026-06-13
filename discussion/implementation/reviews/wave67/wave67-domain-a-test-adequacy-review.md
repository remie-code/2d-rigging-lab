# Wave67 Domain A Test Adequacy Review

## Verdict

pass

Domain A has adequate headless test coverage for the WebGL2 shared renderer foundation acceptance gate. The remaining gaps are real-browser/manual visual validation and a few defensive edge cases, but they are acceptable residual risks for this foundation wave and do not block Domain A acceptance.

## Scope reviewed

- `packages/render-core/src/render-scene.test.ts`
- `packages/render-core/src/*.ts`
- `packages/render-webgl2/src/webgl2-renderer.test.ts`
- `packages/render-webgl2/src/*.ts`
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts`
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/package.json`
- `pnpm-lock.yaml`

Workspace caveat honored: unrelated Wave67 Domain B/C changes in the same worktree were not counted as Domain A coverage, except where existing projection/evaluation behavior explains the Domain A adapter inputs.

## Basis documents used

- `discussion/implementation/orchestration/wave67-plan.md`
- `discussion/implementation/waves/wave67/wave67-preplan-renderer-texture-package-inventory.md`
- `discussion/design/mesh-rendering/mesh-image-rendering-architecture.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/design/canvas-evaluation/canvas-evaluation-pipeline-v0.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`

## Coverage matrix

| Requirement | Classification | Evidence |
|---|---|---|
| Render-core contract for scene/drawable/texture/mesh/UV/opacity/draw order/clipping | covered | Contract fields are defined in `packages/render-core/src/render-scene.ts:17`, `packages/render-core/src/render-scene.ts:35`, `packages/render-core/src/render-scene.ts:48`, `packages/render-core/src/render-scene.ts:53`, and `packages/render-core/src/render-scene.ts:65`. |
| Deterministic draw order | covered | Sorting implementation is in `packages/render-core/src/render-order.ts:7`; tests assert deterministic order and `createRenderScene` ordering in `packages/render-core/src/render-scene.test.ts:16`. |
| Texture cache key/signature safety | partially_covered | Signature changes for bytes/dimensions are tested in `packages/render-core/src/render-scene.test.ts:35`; key components are tested in `packages/render-core/src/render-scene.test.ts:66`. WebGL cache invalidation on changed signature is implemented at `packages/render-webgl2/src/webgl2-textures.ts:19`, but not directly asserted. |
| WebGL2 textured mesh draw path | covered | Fake WebGL2 test asserts `texImage2D`, vertex `bufferData`, and `drawElements` in `packages/render-webgl2/src/webgl2-renderer.test.ts:28`. Mesh upload/draw is implemented at `packages/render-webgl2/src/webgl2-mesh.ts:9` and `packages/render-webgl2/src/webgl2-renderer.ts:206`. |
| Premultiplied-alpha-friendly blending | covered | Test asserts `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)` in `packages/render-webgl2/src/webgl2-renderer.test.ts:37`; renderer sets that blend mode in `packages/render-webgl2/src/webgl2-renderer.ts:116` and mask pass at `packages/render-webgl2/src/webgl2-renderer.ts:130`. |
| Texture upload/cache reuse | covered | Test asserts reuse avoids a second `texImage2D` in `packages/render-webgl2/src/webgl2-renderer.test.ts:43`; cache reuse path is `packages/render-webgl2/src/webgl2-textures.ts:20`. |
| v0 clipping/mask path | covered | Test asserts framebuffer path, non-null framebuffer bind, mask uniform, and draw count in `packages/render-webgl2/src/webgl2-renderer.test.ts:57`; implementation renders mask texture at `packages/render-webgl2/src/webgl2-renderer.ts:119` and uses it at `packages/render-webgl2/src/webgl2-renderer.ts:87`. |
| Editor adapter mapping from projection to RenderScene | covered | Adapter maps texture bytes, mesh, opacity, order, and clipping in `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:24`; test verifies those fields in `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts:12`. |
| Primary WebGL path avoids Canvas2D triangle clip when available | covered | Renderer tries WebGL path at `apps/editor/src/workspace/canvas/canvas-renderer.ts:143` and composites the WebGL canvas at `apps/editor/src/workspace/canvas/canvas-renderer.ts:184`; test asserts no Canvas2D `clip`/`transform` in `apps/editor/src/workspace/canvas/canvas-renderer.test.ts:292`. |
| Canvas2D fallback behavior | partially_covered | No-WebGL fallback is exercised by the existing Canvas2D mesh/rect/degenerate tests in `apps/editor/src/workspace/canvas/canvas-renderer.test.ts:171`, `apps/editor/src/workspace/canvas/canvas-renderer.test.ts:216`, and `apps/editor/src/workspace/canvas/canvas-renderer.test.ts:256`. Renderer-throw fallback at `apps/editor/src/workspace/canvas/canvas-renderer.ts:187` is not directly tested. |
| Opacity and draw order | partially_covered | Adapter opacity/order are asserted in `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts:12`; renderer sends opacity uniform in `packages/render-webgl2/src/webgl2-renderer.ts:233` and orders drawables in `packages/render-webgl2/src/webgl2-renderer.ts:60`. There is no pixel or per-draw visual output assertion for multi-layer ordering. |
| Stage semantic hooks stability | partially_covered | Existing hooks remain present in `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:546`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:567`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:570`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:571`, and `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:643`. Focused E2E/browser hook checks were not included in the provided verification. |
| Dependency/source organization guard expectations | covered | Package dependency direction is reflected in `packages/render-webgl2/package.json:10`, `apps/editor/package.json:17`, `apps/editor/package.json:18`, and `pnpm-lock.yaml:160`. Guard verification was provided as passed. |

## Findings

### Advisory A-TAR-001: No real browser/manual visual check validates actual WebGL2 pixels

Severity: advisory, non-blocking for Domain A foundation.

The architecture basis explicitly calls for human visual checks for hidden mesh borders and high-contrast fine parts before claiming renderer visual quality (`discussion/design/mesh-rendering/mesh-image-rendering-architecture.md:291`). Domain A tests currently validate contracts and WebGL call sequences with fake contexts, for example `packages/render-webgl2/src/webgl2-renderer.test.ts:28` and `apps/editor/src/workspace/canvas/canvas-renderer.test.ts:292`.

This is acceptable for the foundation acceptance gate because Wave67 excludes Photoshop pixel-perfect parity and requires a shared WebGL2 foundation, not final visual parity. It remains a residual risk before declaring Canvas2D fully retired or claiming seam-free/watertight output.

### Advisory A-TAR-002: Defensive cache invalidation and renderer-error fallback edges are not directly asserted

Severity: advisory, non-blocking.

Tests cover content signature creation, cache-key composition, and unchanged-texture reuse (`packages/render-core/src/render-scene.test.ts:35`, `packages/render-core/src/render-scene.test.ts:66`, `packages/render-webgl2/src/webgl2-renderer.test.ts:43`). The implementation also deletes/reuploads when a cached texture id has a changed key (`packages/render-webgl2/src/webgl2-textures.ts:19`) and disables WebGL after a render failure (`apps/editor/src/workspace/canvas/canvas-renderer.ts:187`), but those two branches are not directly tested.

No focused fix is required for Domain A acceptance. If the next wave touches texture lifetime or WebGL fallback, add tests for changed-signature reupload/delete and render-throw fallback/dispose.

## Verification considered

- First local focused vitest attempt failed with sandbox `spawn EPERM` while starting esbuild.
- Outside-sandbox focused vitest passed: `pnpm.cmd exec vitest run packages/render-core/src packages/render-webgl2/src apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts apps/editor/src/workspace/canvas/canvas-renderer.test.ts` passed 4 files / 12 tests.
- `pnpm.cmd typecheck` passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck` passed.
- `node scripts/check-source-organization.mjs` passed.
- `node scripts/check-dependencies.mjs` passed.
- `git diff --check` on Domain A files passed with LF/CRLF warnings only.

## Residual test risks

- No real browser WebGL2 screenshot/pixel/manual check was provided. This is acceptable for the foundation gate but does not prove seam-free rendering, exact clipping appearance, alpha edge quality, or high-contrast visual stability.
- Mask/clipping coverage is call-sequence based, not pixel-output based.
- Draw order and opacity are covered by contract/mapping/uniform assertions, not by end-to-end visual output.
- Stage semantic hooks are statically preserved, but focused E2E was not run as part of the provided Domain A verification.

## User-decision points

None for Domain A test adequacy. No blocking test gap requires a user decision.
