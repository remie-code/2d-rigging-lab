# Wave67 Preplan Inventory: Parent-Child Deformer Evaluation

> Read-only Sylph inventory。Wave67で親子Deformer相互作用を修正するための実装事実棚卸。

## Verdict

done for inventory. Implementation needs the semantic decision recorded in Wave67 plan.

## Basis

- [Canvas Evaluation Pipeline v0](../../../design/canvas-evaluation/canvas-evaluation-pipeline-v0.md)
- [Mesh Image Rendering Architecture](../../../design/mesh-rendering/mesh-image-rendering-architecture.md)
- [Rig Tool Component](../../../design/screen-design/components/rig-tool.md)
- [Wave66 Final Integration Report](../wave66/wave66-final-integration-report.md)
- [Wave66 Domain A Report](../wave66/wave66-domain-a-canvas-evaluation-foundation-report.md)
- [Wave66 Domain B Report](../wave66/wave66-domain-b-evaluated-canvas-rendering-overlay-hit-test-report.md)

## Findings

### Current Editor Evaluation Path

- `createCanvasEvaluatedScene` builds evaluated keyforms, rig controls, drawable direct bindings, then applies rig chains to mesh vertices.
- `createDrawableRigControlChain` currently builds parent -> child order in `apps/editor/src/workspace/canvas/canvas-evaluation.ts`.
- `applyRigControlChainToVertices` applies that order directly.
- Warp sampling uses `applyWarpLatticeToPoint`, with inclusion and normalization against the warp's stored/rest `domainBounds`.

### Current Warp Domain Behavior

- Shared contract says `domainBounds` is the authored warp domain and outside vertices pass through.
- Editor geometry evaluation checks `pointInRect(point, rigControl.domainBounds)` after previously-applied parent deformers have already moved the vertex.
- Overlay/control display differs: the editor generates rest grid points from `domainBounds`, applies the evaluated chain to them, and returns evaluated control points plus evaluated overlay bounds.
- This explains the reported bug: the visible child lattice follows the parent, but child warp sampling still tests/normalizes against the child rest rectangle.

### Runtime / Editor Parity

- Runtime and editor are not currently equivalent.
- Editor drawable geometry applies parent -> child.
- Runtime drawable effect chains start at the direct child and walk upward, then reduce in that order.
- Runtime warp evaluation also samples stored/rest `domainBounds`.
- Existing tests do not cover parent warp + child warp sampling conflict.

## Accepted Semantic Direction For Planning

Wave67 should use local-space chain semantics:

```text
child deformer local deformation
  -> parent deformer transforms / warps the whole child result
  -> final rendered mesh
```

Rationale:

- Child deformer keyforms should not depend on the parent's current value.
- Child deformer domain / control points should keep stable local meaning.
- Moving the parent should move the child result as a whole, not change the child's sampling meaning.
- Editor can let users grab evaluated child controls on screen, while storing values back as child-local offsets.
- Runtime appears closer to this semantics already, but this is a secondary benefit. The primary reason is stable parent-child rig meaning.

## Minimal Safe Fix Scope

Primary files:

- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- If parity is included:
  - `packages/runtime-core/src/rig-control-evaluation.ts`
  - `packages/runtime-core/src/rig-control-warp-lattice.ts`
  - runtime hierarchy/keyform tests

Likely functions:

- `applyRigControlChainToVertices`
- `applyRigControlChainToPoint`
- `applyRigControlToPoint`
- `applyWarpLatticeToPoint`
- possibly `createCanvasEvaluatedWarpRigControl` if overlay basis and sampling basis are made explicit.

## Focused Test Plan

- Editor unit: parent warp moves a child warp outside its rest `domainBounds`; child warp offsets must still affect drawable vertices under local-space semantics.
- Editor unit: non-uniform child warp offsets catch wrong normalization, not just skipped deformation.
- Editor projection: child warp overlay evaluated control points and evaluated mesh deformation agree under parent displacement.
- Control-point preview: child control-point preview under a moved parent deforms artwork, not only overlay.
- Runtime unit: parent `warpLattice2d` + child `warpLattice2d` uses the same local-space semantics.
- No screenshot/pixel oracle; assert evaluated vertices, bounds, chain ids, and overlay control-point coordinates.

## Renderer Dependency

- WebGL2 renderer should consume evaluated mesh vertices only.
- Renderer must not duplicate deformer evaluation.
- This fix belongs upstream of rendering. If evaluated vertices are wrong, WebGL2 will draw wrong shapes accurately.
