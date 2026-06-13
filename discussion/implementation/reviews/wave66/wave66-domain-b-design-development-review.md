# Wave66 Domain B Design / Development Compliance Review

- Verdict: `pass`
- Domain: `wave66-evaluated-canvas-rendering-overlay-hit-test`
- Review lane: Design / Development Compliance Review
- Reviewer: Review-Sylph
- Date: 2026-06-13
- Mode: read-only source review; no implementation files edited

## Findings

No blocking or warning findings for this review lane.

## Evidence Reviewed

- `discussion/implementation/orchestration/wave66-plan.md` sections 3, 4, 5, 7.2, 7.3, 7.4, 8, 10, 13, 14, 15.
- `discussion/implementation/waves/wave66/wave66-domain-a-canvas-evaluation-foundation-report.md`.
- `discussion/implementation/waves/wave66/wave66-preplan-canvas-evaluation-inventory.md`.
- `discussion/design/canvas-evaluation/canvas-evaluation-pipeline-v0.md`.
- `discussion/design/screen-design/components/canvas-preview.md`.
- `discussion/design/screen-design/components/parameter-keyform.md`.
- `discussion/design/screen-design/components/rig-tool.md`.
- Development policies for UX-backed package logic authority, source organization, dependencies, operations, and schema/ID conventions.
- Domain B changed files listed in the task, plus the Domain B implementation report.
- Evidence commands: `git status --short -uall`, requested Domain B diff, untracked-file listing, direct source reads, and targeted `rg` checks for session/evaluation/dependency/forbidden-scope references.

## Compliance Checks

### Architecture / Module Boundary: pass

- Domain B consumes the Domain A evaluation boundary from projection, not renderer. `canvas-projection.ts` imports `createCanvasEvaluatedScene` and related evaluated-scene types (`apps/editor/src/workspace/canvas/canvas-projection.ts:9`) and calls the boundary once when building the render projection (`apps/editor/src/workspace/canvas/canvas-projection.ts:163`).
- Projection derives renderable drawables from `evaluatedScene.drawables`, carrying evaluated bounds, opacity, visibility, draw order, mask source ids, and cloned evaluated mesh into `CanvasRenderProjection` (`apps/editor/src/workspace/canvas/canvas-projection.ts:174`, `apps/editor/src/workspace/canvas/canvas-projection.ts:210`).
- Mesh overlay and deformer overlay are projected from evaluated data, not raw keyform/deformer maps (`apps/editor/src/workspace/canvas/canvas-projection.ts:358`, `apps/editor/src/workspace/canvas/canvas-projection.ts:385`).
- Drawable hit test remains projection-based and uses evaluated drawable bounds because Domain B moved bounds production upstream into evaluated projection data (`apps/editor/src/workspace/canvas/canvas-projection.ts:425`).

### Renderer Boundary: pass

- `canvas-renderer.ts` remains session-free. Its imports are projection types/helpers, the triangle texture-warp utility, and the warp control-point overlay helper; it does not import `AuthoringSession`, editor session state, or keyform/evaluation helpers (`apps/editor/src/workspace/canvas/canvas-renderer.ts:1`).
- Rendering consumes `CanvasRenderProjection` and `CanvasRenderableDrawable` only (`apps/editor/src/workspace/canvas/canvas-renderer.ts:37`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:103`).
- Triangle rendering reads `drawable.evaluatedMesh` and maps UVs to the layer bitmap; no parameter, keyform, deformer-chain, or session evaluation is duplicated in renderer code (`apps/editor/src/workspace/canvas/canvas-renderer.ts:474`).

### Domain A Boundary Consumption: pass

- Domain A's evaluation boundary owns parameter/keyform and deformer-chain evaluation through `createCanvasEvaluatedScene` (`apps/editor/src/workspace/canvas/canvas-evaluation.ts:182`), `createEvaluatedParameterKeyformState` (`apps/editor/src/workspace/canvas/canvas-evaluation.ts:197`), and parent-first rig-control chain application (`apps/editor/src/workspace/canvas/canvas-evaluation.ts:663`).
- Domain B's projection uses those evaluated outputs for drawables, overlay, mesh overlay, and hit testing. It removed the earlier direct parameter/deformer evaluation path from projection and does not reintroduce it in renderer or hit-test code.
- `canvas-evaluation.ts` exposes projection-friendly evaluated rig data, including evaluated control points and rotation pivot/angle (`apps/editor/src/workspace/canvas/canvas-evaluation.ts:489`, `apps/editor/src/workspace/canvas/canvas-evaluation.ts:517`). It does not contain renderer drawing code or hit-test code.

### Operation / Undo Boundary: pass

- Control point pointermove preview is routed into evaluation via a preview projection factory, leaving session mutation out of pointermove (`apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:138`, `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:297`).
- Pointerup continues to use the existing one-shot gesture commit controller path (`apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:346`, `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:356`).
- `CanvasPreviewPanel` supplies the preview projection factory (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:131`) and uses the current render projection for click selection hit test (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:451`).

### Source Organization: pass

- New or expanded responsibilities are placed in named canvas files:
  - `canvas-triangle-texture-warp.ts` owns the Canvas2D affine triangle transform utility.
  - `canvas-renderer.ts` owns drawing projection data.
  - `canvas-projection.ts` owns session-to-render-projection adaptation.
  - `canvas-evaluation.ts` remains the evaluation adapter boundary.
- No `index.ts` implementation logic or broad catch-all file was introduced in Domain B.
- `canvas-evaluation.ts` is large, but the Domain B additions keep it within the existing evaluation responsibility and do not add rendering or hit-test ownership.

### Dependency / Forbidden Scope: pass

- No dependency manifest or lockfile change was present in the reviewed Domain B diff; no new dependency was added.
- Domain B did not add Cubism SDK/Core, Cubism parser/runtime, WebGL rewrite, save/load format expansion, external runtime API, or Viewer/Runtime Preview integration.
- `git status --short -uall` shows unrelated Domain C package-side Mesh V2.6 files and `apps/editor/.dev-server.out.log`; these were ignored for Domain B except to confirm Domain B does not depend on them.
- The reviewed Domain B files do not touch `packages/**` Mesh V2.6 implementation files.

### Schema / ID Policy: pass

- The new evaluated canvas interfaces are editor-internal TypeScript shapes, not external DTO/Zod contract schemas.
- New machine-readable values observed in Domain B tests and implementation, such as fixture IDs and helper-generated stable IDs, do not contain spaces.

## Verification Evidence Considered

I used Orch-Sylph's reported verification evidence:

- `pnpm.cmd --dir apps/editor typecheck`: pass.
- Focused Vitest command for canvas triangle warp, projection, evaluation, and warp control-point editing tests: sandbox run failed before tests with Windows `spawn EPERM`; escalated rerun passed, 4 files / 25 tests.
- `git diff --check -- apps/editor/src/workspace/canvas apps/editor/src/workspace/panels/canvas-preview-panel.tsx discussion/implementation/waves/wave66`: pass with LF-to-CRLF warnings only.

## Residual Risks

- Canvas2D triangle texture warp may still show visual seams or interpolation artifacts; this is a v0 rendering risk, not a design/development boundary violation.
- Full deformed clipping/mask parity remains intentionally deferred by the plan.
- Exact inverse local-coordinate editing under non-linear parent deformation remains a known Domain A/B future alignment risk, already documented by the implementation reports.
- `canvas-evaluation.ts` should be split before future waves add substantially different responsibilities, but Domain B did not cross that boundary.

## Needs User Input / Design Decision

None.

## Final Verdict

`pass`
