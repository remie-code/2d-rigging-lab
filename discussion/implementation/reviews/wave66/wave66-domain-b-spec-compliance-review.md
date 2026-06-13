# Wave66 Domain B Spec Compliance Review

- Review lane: Spec Compliance Review
- Domain: `wave66-evaluated-canvas-rendering-overlay-hit-test`
- Reviewer: Review-Sylph
- Date: 2026-06-13
- Verdict: `pass`

## Findings

No pass-blocking spec compliance findings.

No `unclear` requirement classification is used in this review. Residual risks noted by Gnome are accepted as planned v0 limits, not pass blockers: full deformed clipping/pixel parity, triangle-level hit-test, WebGL rewrite, Mesh V2.6, and exact inverse local coordinate handling for nested non-linear Warp editing.

## Evidence Reviewed

- Wave plan and basis docs:
  - `discussion/implementation/orchestration/wave66-plan.md`
  - `discussion/implementation/waves/wave66/wave66-domain-a-canvas-evaluation-foundation-report.md`
  - `discussion/implementation/waves/wave66/wave66-preplan-canvas-evaluation-inventory.md`
  - `discussion/design/canvas-evaluation/canvas-evaluation-pipeline-v0.md`
  - `discussion/design/screen-design/components/canvas-preview.md`
  - `discussion/design/screen-design/components/parameter-keyform.md`
  - `discussion/design/screen-design/components/rig-tool.md`
  - listed development convention policies
- Implementation report:
  - `discussion/implementation/waves/wave66/wave66-domain-b-evaluated-canvas-rendering-overlay-hit-test-report.md`
- Source and tests listed in the task.
- Orch-Sylph verification evidence:
  - `pnpm.cmd --dir apps/editor typecheck`: pass.
  - Focused Vitest rerun after sandbox `spawn EPERM`: pass, 4 files / 25 tests.
  - `git diff --check` for Domain B paths: pass with LF-to-CRLF warnings only.

## Basis Compliance Matrix

| Requirement | Classification | Evidence | Notes |
|---|---|---|---|
| Domain B consumes Domain A evaluation boundary instead of duplicating renderer evaluation | implemented | `apps/editor/src/workspace/canvas/canvas-projection.ts:163`, `apps/editor/src/workspace/canvas/canvas-projection.ts:174`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:37` | Projection calls `createCanvasEvaluatedScene`; renderer stays projection-data-only. |
| Renderer must not gain raw `AuthoringSession` / keyform knowledge | implemented | `apps/editor/src/workspace/canvas/canvas-renderer.ts:1`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:37` | Renderer imports projection types/helpers and triangle utility only; search found no `AuthoringSession` or keyform/session evaluation terms in renderer/triangle utility. |
| Evaluated image rendering uses mesh triangles, not only rectangular `drawImage` | implemented | `apps/editor/src/workspace/canvas/canvas-renderer.ts:403`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:413`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:474` | `drawDrawableImage` attempts evaluated mesh drawing before rectangular fallback. |
| Canvas2D triangle texture warp utility is allowed v0 path | implemented | `apps/editor/src/workspace/canvas/canvas-triangle-texture-warp.ts:15`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:509` | Affine transform utility maps source UV triangle to evaluated destination triangle. |
| Meshless / fallback drawable display remains supported | implemented | `apps/editor/src/workspace/canvas/canvas-evaluation.ts:775`, `apps/editor/src/workspace/canvas/canvas-evaluation.ts:804`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:480`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:417` | `rectFallback` and invalid/empty triangle cases fall back to rectangular drawing. |
| Degenerate triangle handling does not produce invalid transforms | implemented | `apps/editor/src/workspace/canvas/canvas-triangle-texture-warp.ts:26`, `apps/editor/src/workspace/canvas/canvas-triangle-texture-warp.test.ts:30` | Degenerate source/destination triangles return `undefined`. |
| Parameter scrub can move/deform artwork on Canvas | implemented | `apps/editor/src/workspace/canvas/canvas-projection.ts:163`, `apps/editor/src/workspace/canvas/canvas-projection.ts:210`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:413`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:377` | Projection receives `parameterValues`, exposes evaluated mesh/bounds, and renderer draws the evaluated mesh. |
| Keyform interpolation affects visible Canvas result | implemented | `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:133`, `apps/editor/src/workspace/canvas/canvas-projection.ts:163` | Domain A interpolation feeds the Domain B projection path. |
| Rotation/fade rendering path uses evaluated geometry/opacity | implemented | `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:175`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:345`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:587` | Rotation geometry and opacity are evaluated before renderer alpha/draw. |
| Source bitmap cache is not unnecessarily regenerated during parameter scrub | implemented | `apps/editor/src/workspace/canvas/canvas-projection.ts:680`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:552`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:214` | Projection content key excludes changing evaluated bounds/opacity; renderer cache key uses source bytes/dimensions. |
| Selected drawable bounds / outline follow evaluated coordinates | implemented | `apps/editor/src/workspace/canvas/canvas-projection.ts:231`, `apps/editor/src/workspace/canvas/canvas-projection.ts:232`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:674`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:400` | Selection bounds are derived from evaluated drawable bounds. |
| Mesh overlay follows evaluated mesh coordinates | implemented | `apps/editor/src/workspace/canvas/canvas-projection.ts:358`, `apps/editor/src/workspace/canvas/canvas-projection.ts:366`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:360`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:423` | Overlay uses `CanvasEvaluatedMesh`. |
| Warp lattice overlay follows evaluated coordinates | implemented | `apps/editor/src/workspace/canvas/canvas-evaluation.ts:489`, `apps/editor/src/workspace/canvas/canvas-evaluation.ts:505`, `apps/editor/src/workspace/canvas/canvas-projection.ts:409`, `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts:68` | Evaluated control points are exposed and used for overlay/hit positions. |
| Rotation pivot / guide follows evaluated coordinates | implemented | `apps/editor/src/workspace/canvas/canvas-evaluation.ts:517`, `apps/editor/src/workspace/canvas/canvas-evaluation.ts:522`, `apps/editor/src/workspace/canvas/canvas-projection.ts:394`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:345` | Evaluated pivot/angle and selected evaluated bounds are projected. |
| Grid / origin / canvas bounds remain stage-level overlays | implemented | `apps/editor/src/workspace/canvas/canvas-renderer.ts:599`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:654` | These overlays still draw from `projection.canvasBounds`, not selected/evaluated artwork bounds. |
| Drawable hit test uses evaluated bounds | implemented | `apps/editor/src/workspace/canvas/canvas-projection.ts:425`, `apps/editor/src/workspace/canvas/canvas-projection.ts:435`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:410` | Hit test runs over projection drawables whose bounds are evaluated. |
| Hidden drawable is normally excluded from hit test | implemented | `apps/editor/src/workspace/canvas/canvas-projection.ts:431`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:181`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:193` | Hidden drawables are skipped unless intentionally surfaced as Mesh Tool preview. |
| Topmost drawable selection is preserved | implemented | `apps/editor/src/workspace/canvas/canvas-projection.ts:425`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:75`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:132` | Existing topmost behavior remains covered. |
| Deformer control point hit test has priority over drawable hit test | implemented | `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:333`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:355`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:365`, `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts:99` | Panel delegates to Warp control point interaction before starting drawable selection. |
| Warp control point drag preview deforms actual artwork, not only overlay | implemented | `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:138`, `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:143`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:131`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:438` | Preview is passed into projection/evaluation; projection test asserts drawable geometry changes. |
| Pointermove preview does not mutate `AuthoringSession` | implemented | `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:297`, `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:308`, `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:220` | Pointermove updates preview state from gesture preview; evaluation non-mutation is tested. |
| Pointerup commits at most one gesture / undo entry | implemented | `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:337`, `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:356`, `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:124` | Existing gesture commit controller path is preserved and focused test covers one commit plus undo restore. |
| Keyform-position gate for direct drag remains intact | implemented | `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:172`, `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:224`, `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:181` | Drag commit is gated by `canCommitWarpControlPointOffsetUpdate`; interpolated positions remain non-editable. |
| Add / Update / Delete keyform commit boundaries are not broken | implemented | `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:224`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:146` | Domain B routes only Warp control point gesture commit; Parameter Bar keyform actions are not altered. |
| Apply / commit does not force viewport fit | implemented | `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:419`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:424`, `apps/editor/src/workspace/canvas/canvas-auto-fit-policy.ts:31`, `apps/editor/src/workspace/canvas/canvas-auto-fit-policy.test.ts:69` | Pointerup path does not call fit; existing auto-fit policy only fits initial renderable artwork once. |
| Parent-child deformer chain reaches Canvas display | implemented | `apps/editor/src/workspace/canvas/canvas-evaluation.ts:663`, `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:104`, `apps/editor/src/workspace/canvas/canvas-projection.ts:163` | Domain B consumes Domain A evaluated geometry after parent-first chain evaluation. |
| Existing PSD import / mesh / deformer workflow remains usable | implemented | `apps/editor/src/workspace/canvas/canvas-projection.test.ts:62`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:199`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:468` | Existing projection ordering, hidden mesh preview, and overlay cases remain covered by focused tests. |
| Clipping remains usable without requiring full deformed mask parity | implemented | `apps/editor/src/workspace/canvas/canvas-renderer.ts:426`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:450`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:455` | Scratch/mask pass now uses the same evaluated drawable draw helper where possible; full parity remains explicit non-goal. |
| Domain B persistent report includes required self-report sections | implemented | `discussion/implementation/waves/wave66/wave66-domain-b-evaluated-canvas-rendering-overlay-hit-test-report.md:34`, `discussion/implementation/waves/wave66/wave66-domain-b-evaluated-canvas-rendering-overlay-hit-test-report.md:72`, `discussion/implementation/waves/wave66/wave66-domain-b-evaluated-canvas-rendering-overlay-hit-test-report.md:83` | Basis coverage, deferred items, workflow trace, must-not, and residual risk are present. |
| Root / Undine do not implement; review is independent and artifact is persistent | implemented | This file; `discussion/implementation/orchestration/wave66-plan.md` Section 13 | Review was source-based and wrote only the delegated artifact. |
| Domain C Mesh V2.6 sidecar requirements | not relevant | `discussion/implementation/orchestration/wave66-plan.md` Sections 7.5 and 11 | Domain B must not implement Mesh V2.6; current package changes are outside this lane. |

## Explicit Non-Goals / Deferred Items

| Basis item | Classification | Rationale |
|---|---|---|
| Screenshot / pixel oracle as pass condition | explicit non-goal | Wave plan forbids making screenshot/pixel oracle a Domain B pass condition. The reviewed evidence uses semantic unit tests/typecheck, not pixel oracle. |
| Photoshop pixel-perfect compositing | explicit non-goal | Wave plan and Canvas Preview spec explicitly exclude pixel-perfect parity. |
| Full deformed clipping / mask parity | deferred by plan | v0 allows composition slot / existing behavior preservation; Domain B improves scratch/mask drawing with evaluated helper but does not claim full parity. |
| Triangle-level drawable hit test | deferred by plan | Wave66 requires evaluated bounds minimum; triangle hit-test is optional and not implemented. |
| WebGL renderer rewrite | explicit non-goal | Wave66 allows Canvas2D triangle warp and explicitly does not require WebGL. |
| General canvas transform tool, multiselect, rotate view, rulers | explicit non-goal | Out of Domain B and listed as forbidden/out of scope. |
| Mesh V2.6 implementation | explicit non-goal | Owned by Domain C sidecar; no Domain B source implements it. |
| Viewer / Runtime Preview full integration, save/load expansion, external API/transport | explicit non-goal | Listed in Wave66 out of scope and not touched in Domain B files. |

## Policy Compliance Context

| Policy | Classification | Evidence / note |
|---|---|---|
| UX-backed package logic authority | not relevant | Domain B did not need package-level contract changes to satisfy accepted Canvas UX. |
| Source file organization | implemented | New production files are focused (`canvas-evaluation.ts`, `canvas-triangle-texture-warp.ts`); no `index.ts` or broad catch-all file was introduced in Domain B. |
| Dependency policy | implemented | No `package.json` / lockfile change is part of Domain B; no new dependency or forbidden Cubism dependency is present in the reviewed Domain B paths. |
| Operation policy | implemented | Domain B preview remains non-mutating; existing one-shot gesture commit path is preserved for pointerup. |
| Schema and ID conventions | implemented | New file names and machine-readable method/surface identifiers used by Domain B contain no spaces; no external DTO/schema boundary was introduced. |

## Verification Notes

I did not rerun the focused Vitest/typecheck commands; I used Orch-Sylph's recorded pass evidence and performed static source/diff review. I did run read-only status/diff/file discovery and source searches. The working tree also contains unrelated Domain C package changes and `apps/editor/.dev-server.out.log`; those were ignored except to confirm they are outside the Domain B review scope.

## Verdict

`pass`
