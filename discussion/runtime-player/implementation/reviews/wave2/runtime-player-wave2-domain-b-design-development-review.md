# Runtime Player Wave2 Domain B Design / Development Compliance Review

Verdict: pass

Date: 2026-06-22

Target: `runtime-player-wave2-static-stage-renderer`

## Scope / Basis Inspected

Basis documents inspected:

- `discussion/runtime-player/implementation/orchestration/player-wave2-plan.md`
- `discussion/runtime-player/architecture/technology-stack-decision.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/implementation/waves/wave2/runtime-player-wave2-domain-a-runtime-export-loader-ipc-report.md`
- `discussion/runtime-player/implementation/waves/wave2/runtime-player-wave2-domain-b-static-stage-renderer-report.md`

Source/test targets inspected directly:

- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
- `apps/runtime-player/src/styles/global.css`
- `apps/runtime-player/src/preload/runtime-export-bridge-contract.ts`
- `apps/runtime-player/src/runtime-player-boundary.test.ts`
- Relevant render interfaces in `packages/render-core/src/render-scene.ts`, `packages/render-core/src/render-order.ts`, and `packages/render-webgl2/src/webgl2-renderer.ts`

Diff/state inspected:

- `git diff -- apps/runtime-player discussion/runtime-player/implementation/waves/wave2`
- `git status --short -uall`
- `git diff --name-only -- packages/render-core packages/render-webgl2`
- Untracked Domain B files were inspected directly because plain `git diff` does not include untracked files.

## Findings

No blocking or warning findings.

Informational notes:

- `apps/runtime-player/src/preload/runtime-export-bridge-contract.ts:49` and `apps/runtime-player/src/preload/runtime-export-bridge-contract.ts:114` expose a typed app-specific Runtime Export API and loaded payload, including raw texture bytes as `Uint8Array`. This is not a raw Electron/Node/fs object exposure, but practical IPC payload size remains a final-integration risk.
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.ts:61` preserves numeric `model.meshes[].atlasUvs` while `packages/render-core/src/render-scene.ts:76` currently names the UV space as `layer-local-top-left-0-1-v1`. This matches the Domain B report's documented naming mismatch and is not a design-boundary violation, but it remains a render-semantics follow-up risk.
- Worktree dirtiness includes unrelated changes outside Domain B, including `apps/editor/**`, `discussion/implementation/**`, and `packages/render-core/src/performance-instrumentation.ts`. These were not attributed to Domain B.

## Design / Development Compliance Notes

Process boundaries remain intact.

- Stage production files do not import Electron, Node, raw IPC, dialog, BrowserWindow, filesystem, or Editor sources. Targeted search over Stage production files and `runtime-export-bridge-contract.ts` returned no matches.
- Runtime Player as a whole has expected Electron/Node usage only in main/preload/test areas. For example, main owns the native picker in `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts`, while Stage has no picker/file traversal ownership.
- The boundary test also covers renderer production files, Stage setup/debug UI terms, and main-process React imports in `apps/runtime-player/src/runtime-player-boundary.test.ts:10`, `apps/runtime-player/src/runtime-player-boundary.test.ts:26`, and `apps/runtime-player/src/runtime-player-boundary.test.ts:38`.

Stage remains capture-clean and UI-free.

- `StageWindowApp` renders a single transparent stage shell and canvas: `apps/runtime-player/src/stage/stage-window-app.tsx:98` through `apps/runtime-player/src/stage/stage-window-app.tsx:105`.
- Placeholder DOM/CSS was removed; Stage CSS is transparent in `apps/runtime-player/src/styles/global.css:35` through `apps/runtime-player/src/styles/global.css:47`.
- Stage error handling logs to console and records non-visible state via `data-stage-render-state`, with no visible debug overlay or controls by default.

React is limited to bootstrap/state around imperative rendering.

- React creates the canvas and subscribes to typed Runtime Export events in `apps/runtime-player/src/stage/stage-window-app.tsx:68`, `apps/runtime-player/src/stage/stage-window-app.tsx:80`, and `apps/runtime-player/src/stage/stage-window-app.tsx:84`.
- The WebGL renderer lifecycle and draw calls live in `createStaticStageCanvasRenderer`, not React render cadence: `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:28`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:59`, and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:95`.
- The implementation is static render plus resize repaint only; it does not introduce input networking, parameter sliders, dynamics progression, or per-frame React state updates.

Render package boundary compatibility is acceptable.

- Domain B consumes existing `render-core` scene interfaces for RGBA8 textures, drawables, and clipping metadata in `packages/render-core/src/render-scene.ts:35`, `packages/render-core/src/render-scene.ts:48`, and `packages/render-core/src/render-scene.ts:53`.
- Existing `render-core` scene creation sorts drawables through `createRenderScene` in `packages/render-core/src/render-order.ts:28`.
- Existing `render-webgl2` supports clipping through `RenderDrawable.clipping` / mask texture rendering in `packages/render-webgl2/src/webgl2-renderer.ts:71`, `packages/render-webgl2/src/webgl2-renderer.ts:77`, and `packages/render-webgl2/src/webgl2-renderer.ts:88`.
- Existing WebGL clear/window transparency behavior is compatible with a capture-clean stage: `packages/render-webgl2/src/webgl2-renderer.ts:114` and `packages/render-webgl2/src/webgl2-renderer.ts:284`.

Source organization is compliant.

- Domain B production files are split by responsibility:
  - `runtime-export-stage-scene.ts`: Runtime Export payload to render scene.
  - `stage-viewport.ts`: fit/center viewport transform.
  - `static-stage-canvas-renderer.ts`: imperative canvas/WebGL lifecycle.
  - `stage-window-app.tsx`: React bootstrap/subscriptions/canvas ownership.
- No `index.ts`, `types.ts`, `utils.ts`, `helpers.ts`, `schemas.ts`, `common.ts`, `shared.ts`, or `misc.ts` files were found under `apps/runtime-player`.
- `node scripts/check-source-organization.mjs` passed.

Dependency scope is acceptable.

- Runtime Player dependencies remain scoped to existing workspace packages and the Domain A package-format dependency, with render imports from `@private-2d-rigging-lab/render-core` and `@private-2d-rigging-lab/render-webgl2` only. Relevant package entries are in `apps/runtime-player/package.json:17` through `apps/runtime-player/package.json:20`.
- `node scripts/check-dependencies.mjs` passed.
- No `apps/editor/**` imports were found in `apps/runtime-player`.

## Verification Commands / Results

Passed:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`
  - Exit code 0. Git emitted existing LF-to-CRLF working-copy warnings only.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit`
  - Sandboxed run failed while loading Vitest config with `Error: spawn EPERM` from esbuild.
  - Elevated rerun passed: 6 test files, 30 tests.

Targeted searches:

- Stage/preload-contract forbidden import search for Electron, Node, raw IPC, dialog, BrowserWindow, fs/path, and Editor imports: no matches.
- Stage production UI leak search for placeholder/debug/slider/button/setup/control terms: no matches.
- Runtime Player Editor import search: no matches.
- Runtime Player catch-all/source-organization filename search: no matches.

## Remaining Risks / User-Decision Points

- No user decision is required for this review lane.
- GUI/screenshot verification was not run by this reviewer. Manual visual verification remains for final integration: load a real Runtime Export, confirm Stage shows only the model on transparent background, resize the Stage, and confirm invalid-load-after-success clears the Stage.
- Practical IPC payload size with large real Runtime Exports remains a final-integration observation item.
- The UV-space label mismatch noted above should be resolved or explicitly accepted before broader runtime/render package reuse depends on the label semantically.
