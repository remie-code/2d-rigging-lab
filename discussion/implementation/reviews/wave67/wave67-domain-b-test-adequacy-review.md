# Wave67 Domain B Test Adequacy Review

> Review-Sylph / Test Adequacy lane for `wave67-parent-child-deformer-local-space-semantics`.

## Verdict

pass

No blocking test adequacy findings. The focused tests cover the in-scope Domain B requirements with deterministic geometry or evidence assertions, not screenshot/pixel oracles.

## Basis Read

- `discussion/implementation/orchestration/wave67-plan.md`
  - Review Policy requires a Test Adequacy lane for in-scope requirements (lines 106-118).
  - Domain B acceptance requires local-space parent-child Deformer semantics, parent movement not skipping child warp, non-uniform child offsets, overlay/mesh agreement, runtime/editor alignment or documented divergence, and non-pixel focused tests (lines 195-220, 304-342).
  - Domain D expects focused editor/runtime deformer tests and confirms renderer consumes evaluated data (lines 382-409).
- `discussion/implementation/waves/wave67/wave67-preplan-parent-child-deformer-inventory.md`
  - Preplan identified the old editor bug as parent-first geometry sampling against child rest `domainBounds`, causing visible overlay and mesh behavior to diverge (lines 20-40).
  - Accepted direction is child local deformation followed by parent transform/warp of the child result (lines 42-59).
  - Focused test plan calls for editor parent-warp/child-warp, non-uniform offsets, projection overlay agreement, runtime warp/warp parity, and no screenshot/pixel oracle (lines 79-92).
- `discussion/design/canvas-evaluation/canvas-evaluation-pipeline-v0.md`
  - Canvas evaluation owns AuthoringSession plus transient state to `CanvasEvaluatedScene`; renderer owns evaluated scene to pixels/overlays (lines 241-259).
  - Overlay must follow evaluated coordinates and renderer should draw evaluated scene data (lines 193-203, 261-279).
- `discussion/design/mesh-rendering/mesh-image-rendering-architecture.md`
  - `RenderScene` carries evaluated mesh vertices and the renderer must not read `AuthoringSession` directly (lines 65-88).
  - Deformer evaluation is explicitly separate from renderer; wrong evaluated vertices would be drawn accurately by WebGL2 (lines 262-267).

## Coverage Findings

### Parent warp moving child warp outside rest bounds

Covered. `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts` creates a parent warp with a large `+200,+30` offset, a child warp with default child rest bounds, and asserts the child deformation still affects all drawable vertices after the parent movement (lines 158-204). This catches the originally reported skip path because a parent-first implementation that samples child warp against stored rest `domainBounds` would leave the child offsets unapplied.

### Non-uniform child warp offsets

Covered for the Domain B warp/warp case. The editor evaluation test uses non-uniform child offsets `{2,0}`, `{8,0}`, `{4,10}`, `{14,20}` and asserts exact final vertices and bounds (lines 160-165, 198-204). The projection test uses a second non-uniform set `{2,0}`, `{6,0}`, `{4,8}`, `{10,12}` and asserts exact projected vertices/bounds (lines 471-476, 520-527). Runtime evidence uses `{1,0}`, `{3,0}`, `{2,4}`, `{5,6}` and asserts exact runtime vertices/bounds (lines 267-316, 804-920).

Residual risk: the parent warp in these tests is a uniform translation. That is sufficient for the reported "parent moved child outside rest bounds" regression, but it does not prove all future non-uniform parent warp or mixed rotation/warp chain cases. I do not classify this as blocking because Wave67 Domain B specifically scoped parent warp + child warp with nonzero/non-uniform child offsets, and these focused tests pin that behavior.

### Overlay/control points agree with evaluated mesh

Covered. The editor evaluation test asserts the evaluated child warp overlay `domainBounds`, `controlPointOffsets`, and `evaluatedControlPoints`, then compares those evaluated control points to evaluated mesh vertices (lines 205-220). The projection test repeats this through `createCanvasRenderProjection`, asserting projection `selectionBounds`, child overlay bounds/control points, and equality between overlay points and projected mesh vertices (lines 520-543). These are coordinate assertions, not visual oracle checks.

### Runtime/editor semantic parity

Covered by focused, parallel semantic tests rather than a shared cross-package golden fixture. Editor evaluation pins local-space child warp before parent movement in `canvas-evaluation.test.ts` (lines 158-220). Runtime evidence pins the same child-local warp before parent warp result with deterministic snapshots, no rig-control diagnostics, exact vertices/bounds, and runtime diff evidence in `rig-control-hierarchy-evidence.test.ts` (lines 267-316). The relevant runtime implementation evaluates drawable effects from direct child upward (lines 414-466), matching the accepted local-space direction.

Residual risk: there is no single shared fixture that compares editor and runtime numerically from identical graph input. Current parity is semantic and focused, which is acceptable for this wave unless the parent session wants a stronger cross-package contract.

### Non-pixel oracle and renderer boundary

Covered. The reviewed Domain B tests assert vertices, bounds, chain ids, evaluated control points, runtime diagnostics, and runtime diff metadata. They do not assert screenshots or rendered pixels. A text search of the specified test files found no screenshot/image snapshot oracle; the only `pixel` hits are fixture media-type strings.

Renderer boundary is not burdened by Domain B. `canvas-projection.ts` obtains `createCanvasEvaluatedScene(...)` and projects evaluated rig controls/meshes (lines 141-170, 334-421). `packages/render-core` / `packages/render-webgl2` have no `rigControl`, `AuthoringSession`, `warpLattice`, or `applyWarp` references from `rg`, while renderer code consumes `RenderScene` vertices. This matches the architecture requirement that renderer remains a consumer of evaluated vertices.

## Verification

Ran:

```text
pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts
```

Result: pass, 3 test files / 34 tests.

Note: the first sandboxed run failed with `spawn EPERM` while loading Vitest/Vite config through esbuild. Re-running the same focused command with approved escalation passed.

## Blocking Findings

None.

## Residual Risks / Gaps

- No shared editor/runtime golden fixture. The current tests pin equivalent semantics in each package, but not byte-for-byte or coordinate-for-coordinate parity from one shared fixture.
- Parent warp fixtures use uniform parent movement. Future non-uniform parent warp, parent rotation + child warp, or deeper parent-child chains may need additional tests if those become explicit acceptance requirements.
- No browser/e2e visual flow is included. This is acceptable here because the Domain B acceptance explicitly calls for focused non-pixel tests and the renderer is a consumer of evaluated vertices only.
