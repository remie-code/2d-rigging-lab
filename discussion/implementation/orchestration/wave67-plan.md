# Wave 67 Plan: Mesh Rendering Foundation + Parent-Child Deformer Semantics + Mesh V4 Sidecar

> 基礎固めのwave。Mesh内画像描画をCanvas2D実装からWebGL2共有renderer contractへ移行し始め、親子Deformerのlocal-space意味論を固定し、Mesh V4 contour-band生成を非default sidecarとして追加する。

## 1. 状態

- Status: Planned
- Target wave: Wave67
- Wave name: `mesh-rendering-foundation-parent-child-deformer-v4-sidecar`
- Primary objective:
  - Mesh image renderingをCanvas2D triangle clip実装ではなく、Editor Preview / Viewerで共有できるWebGL2 renderer foundationへ移す。
  - `RenderScene` 系の不変条件を満たす `render-core` / `render-webgl2` 境界を作る。
  - Editor Previewで、評価済みdrawable mesh / texture / opacity / draw order / basic clippingをWebGL2で描けるようにする。
  - 親子Deformerの意味論をlocal-space chain semanticsへ固定し、Editor / Runtimeの評価を揃える。
  - Mesh `auto-outline-v4-contour-band` を、V2.6 defaultを壊さない非default sidecarとして進める。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first` -> `Plan directly`.

Inventory basis:

- [Renderer / Texture / Package Boundary Inventory](../waves/wave67/wave67-preplan-renderer-texture-package-inventory.md)
- [Mesh V4 Sidecar Inventory](../waves/wave67/wave67-preplan-mesh-v4-sidecar-inventory.md)
- [Parent-Child Deformer Inventory](../waves/wave67/wave67-preplan-parent-child-deformer-inventory.md)

Why planning is now safe:

- Mesh image rendering architecture is now documented as a shared renderer contract, not a Canvas2D implementation detail.
- WebGL2 has been accepted as the primary renderer stack.
- Texture source path is known: PSD layers are currently materialized as raw RGBA bytes in editor import flow and carried into renderable projection.
- The first Canvas2D sunset targets are identified: drawable image stack, mesh image draw, clipped drawable draw, layer canvas cache.
- Mesh V4 can be introduced as a non-default method without changing current V2.6 default.
- Parent-child Deformer failure mode is understood: visible child lattice follows parent, while child warp sampling checks rest-domain bounds after parent movement.
- Parent-child semantic decision is settled for this plan: local-space chain semantics is the intended behavior.

Uncertainty:

- factual: medium. WebGL2 integration details, clipping implementation choice, and browser-backed tests need implementation-time confirmation.
- decision: low. The remaining choices are implementation strategy, not product direction.
- cost of wrong plan: high. Renderer foundation and deformer semantics are core architecture; wrong boundaries would distort later Viewer, Runtime Preview, Texture Atlas, and rigging work.

## 3. Accepted Decisions / Oracles

- UX and rendering contract are true. Accepted UX may require `packages/**` changes.
- Root / Undine must not implement the wave. Implementation must be delegated through Orch-Sylph -> Gnome / Review-Sylph.
- Root / Undine and Orch-Sylph must wait for started subagents. Poll timeout is not failure.
- Running child agents must not be killed, interrupted, or closed. Completed child sessions must be closed by their parent.
- Mesh image rendering is not Canvas2D-specific.
- Primary renderer is WebGL2.
- Editor Preview and Viewer must share the same renderer contract.
- `RenderScene` detailed types are implementation-owned, but the invariants in [Mesh Image Rendering Architecture](../../design/mesh-rendering/mesh-image-rendering-architecture.md) are fixed.
- `render-core` should be renderer-neutral and not depend on editor/authoring/operation packages.
- `render-webgl2` owns WebGL2 resource upload/cache/lifetime and should depend on `render-core`.
- Mesh UV is layer-local `0..1`; atlas physical UV is a texture allocation concern.
- Initial texture source may use raw RGBA bytes + metadata from current editor pipeline.
- Texture preparation should allow alpha edge padding / color dilation / premultiplied alpha, even if v0 implements only the minimum.
- Canvas2D is a short-term migration aid. Do not add new feature work to Canvas2D renderer.
- Canvas2D is removed from Stage main drawable rendering once WebGL2 draws PSD drawable + mesh deformation + opacity + draw order + basic clipping.
- Parent-child Deformer semantics are local-space chain semantics:

```text
child deformer local deformation
  -> parent deformer transforms / warps the whole child result
  -> final rendered mesh
```

- Runtime/editor deformer semantics should be aligned where practical in this wave.
- Mesh V4 is a non-default sidecar. It must not become default without later human visual confirmation and user decision.
- Mesh rendering quality and mesh generation quality are separate concerns. V4 must not be used to claim renderer seam fixes.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.github/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Design / UX:

- [Mesh Image Rendering Architecture](../../design/mesh-rendering/mesh-image-rendering-architecture.md)
- [Mesh Rendering Map](../../design/mesh-rendering/_map.md)
- [Canvas / Preview Component](../../design/screen-design/components/canvas-preview.md)
- [Canvas Evaluation Pipeline v0](../../design/canvas-evaluation/canvas-evaluation-pipeline-v0.md)
- [Rig Tool Component](../../design/screen-design/components/rig-tool.md)
- [Mesh Tool Component](../../design/screen-design/components/mesh-tool.md)
- [auto-outline-v4 Contour Band Algorithm](../../design/mesh-generation/auto-outline-v4-contour-band.md)
- [auto-outline-v2.6 Soft Apron Algorithm](../../design/mesh-generation/auto-outline-v2-6-soft-apron.md)

Wave66 Baseline:

- [Wave66 Plan](wave66-plan.md)
- [Wave66 Final Integration Report](../waves/wave66/wave66-final-integration-report.md)
- [Wave66 Final Clean Integration Review](../reviews/wave66/wave66-final-clean-integration-review.md)

Wave67 Inventories:

- [Renderer / Texture / Package Boundary Inventory](../waves/wave67/wave67-preplan-renderer-texture-package-inventory.md)
- [Mesh V4 Sidecar Inventory](../waves/wave67/wave67-preplan-mesh-v4-sidecar-inventory.md)
- [Parent-Child Deformer Inventory](../waves/wave67/wave67-preplan-parent-child-deformer-inventory.md)

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly N/A:

1. `Spec Compliance Review`
   - Checks wave plan and primary basis docs.
   - Each relevant basis requirement must be classified as `implemented` / `explicit non-goal` / `deferred by plan` / `unclear` / `not relevant`.
   - `unclear` is not pass.
2. `Design / Development Compliance Review`
   - Checks architecture, module boundary, source organization, operation boundary, dependency policy, and forbidden scope.
3. `Test Adequacy Review`
   - Checks unit / integration / browser / e2e / manual visual check coverage or N/A rationale for each in-scope requirement.

Each Gnome report must include:

- Basis Coverage Self-Report
- Intentionally Deferred Basis Items
- User Workflow Trace or Rendering Contract Trace
- Must-not Compliance Evidence
- Residual Risk Classification

Each Orch-Sylph must close completed child sessions at domain completion. Running child sessions must not be closed, interrupted, or killed.

## 6. Wave Strategy

Wave67 uses a `3 + 1` structure.

```text
Batch 1:
  Domain A: WebGL2 Shared Renderer Foundation
  Domain B: Parent-Child Deformer Local-Space Semantics
  Domain C: Mesh auto-outline-v4 Contour Band Headless Sidecar

Batch 2:
  Domain D: Final Integration / Clean Review / Map Closeout
```

Dependency graph:

```text
A independent of B for renderer package foundation
B independent of A's WebGL2 implementation, but must be done before final rendered-rig correctness can be claimed
C independent sidecar
D depends on A/B/C pass or explicit escalation
```

Rationale:

- WebGL2 renderer foundation is the main architecture move and should not be blocked by mesh generation V4.
- Parent-child Deformer semantics are upstream of rendering correctness but can be implemented as an independent evaluation/runtime domain.
- Mesh V4 is package-level algorithm work and should stay sidecar/non-default.
- Each implementation domain owns its own Orch-Sylph -> Gnome -> Review-Sylph loop, so A/B/C can run in parallel without increasing root context load.
- Final integration must explicitly check that renderer does not duplicate deformer evaluation, B's evaluated mesh semantics are consumed upstream of rendering, and V4 does not become default.

## 7. Acceptance Criteria

### 7.1 WebGL2 Shared Renderer Foundation

```text
Evaluated scene / projection data
  -> RenderScene adapter
  -> WebGL2 renderer
  -> Editor Preview drawable pixels
```

Required:

- Add `packages/render-core` or equivalent renderer-neutral package/module.
- Add `packages/render-webgl2` or equivalent WebGL2 backend package/module.
- `render-core` defines the minimal renderer-neutral contract for render scene / drawable / texture refs / mesh / UV / opacity / draw order / clipping relationship.
- `render-webgl2` can render at least one textured mesh from vertices / UVs / triangles.
- WebGL2 renderer uses premultiplied-alpha-friendly blending policy consistent with the architecture doc.
- Texture upload/cache uses a safer key than only texture id / dimensions / byte length when possible.
- Editor adapts current evaluated/projection data into the shared render scene.
- Editor Preview uses WebGL2 for main drawable image rendering when available.
- Mesh-deformed drawables are drawn through WebGL2, not Canvas2D triangle clip, in the primary path.
- Opacity and draw order are reflected in WebGL2 output.
- Basic clipping is implemented as WebGL2 renderer composition/mask behavior or explicitly escalated if blocked.
- Existing Stage test ids and semantic E2E hooks remain stable.
- Existing Canvas2D overlays may remain temporarily for grid / origin / selection / mesh / deformer overlay.

Must not:

- Make WebGL2 renderer depend on `apps/editor`, `authoring-core`, or `operation-core`.
- Let renderer read `AuthoringSession` directly.
- Add new feature work to Canvas2D triangle renderer.
- Claim Photoshop pixel-perfect parity.
- Treat WebGL2 as editor-only if shared package boundary is feasible.

### 7.2 Parent-Child Deformer Local-Space Semantics

```text
Drawable bound under child deformer
  -> child deformer evaluates in child local/rest space
  -> parent deformer moves/warps the child result
  -> overlay and evaluated mesh agree
```

Required:

- Editor evaluation uses local-space chain semantics for parent-child Deformer chains.
- Child warp inclusion/normalization no longer fails because a parent moved the child result outside the child's rest domain.
- Overlay/control display and evaluated mesh deformation agree under parent movement.
- Runtime-core semantics are aligned with editor semantics where practical.
- Tests cover parent warp + child warp with nonzero child offsets.
- Tests cover non-uniform child offsets to catch wrong normalization.
- Tests cover evaluated overlay/control points agreeing with evaluated mesh positions.
- Renderer remains a consumer of evaluated vertices only.

Must not:

- Enlarge child domain merely to hide the symptom.
- Put deformer evaluation logic into WebGL2 renderer.
- Redesign Rig Tool UI.
- Change package schema unless required and reviewed.

### 7.3 Mesh V4 Contour Band Sidecar

```text
Mesh generation method explicitly requests auto-outline-v4-contour-band
  -> contour band generated
  -> interior filled
  -> V2.6 remains default
```

Required:

- Add explicit method `auto-outline-v4-contour-band` or an equivalent safe id.
- Add explicit generated source id such as `outline-v4-contour-band-rgba`.
- Add fallback chain: `V4 -> V2.6 -> V2.5 -> V2 -> V1 -> bounds-grid`.
- Add contour-band-specific metrics/provenance.
- V4 output is deterministic.
- V4 has nonzero contour band metrics on representative alpha fixtures.
- V4 avoids V3-like huge envelope behavior.
- V4 bounds transparent-only triangle ratio, high valence, long boundary-to-interior spokes, and excessive vertex count through tests or metrics.
- Operation payload / generation allowlist accepts explicit V4.
- Editor default remains V2.6.
- If UI exposure is included, it is explicit method selection with V2.6 selected by default. Side-by-side comparison is not required.

Must not:

- Claim Cubism reproduction.
- Claim rendering seam fixes.
- Switch default to V4.
- Add a broad geometry dependency without dependency-policy compliance and explicit escalation.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. WebGL2 Shared Renderer Foundation | Wave66 renderer baseline | render-core / render-webgl2 / editor adapter / WebGL2 main drawable rendering |
| 1 | B. Parent-Child Deformer Local-Space Semantics | Wave66 evaluation baseline | local-space chain evaluation, editor/runtime parity, tests |
| 1 | C. Mesh auto-outline-v4 Contour Band Sidecar | Wave66 V2.6 baseline | V4 method, metrics, fallback, non-default exposure |
| 2 | D. Final Integration / Clean Review / Map Closeout | A/B/C pass or explicit escalation | validation, cross-domain review, maps |

## 9. Domain A: `wave67-webgl2-shared-renderer-foundation`

Purpose:

- Move main drawable image rendering toward a shared WebGL2 renderer foundation, without making Canvas2D the continuing architecture.

Expected implementation areas:

- `packages/render-core/**`
- `packages/render-webgl2/**`
- `apps/editor/src/workspace/canvas/**`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- editor/package workspace manifests as needed
- focused render-core/render-webgl2/editor tests

Implementation guidance:

- Start from current evaluated/projection data, not raw `AuthoringSession`.
- Define minimal `RenderScene` / `RenderDrawable` contract in `render-core`.
- Keep detailed type shapes pragmatic. Do not over-design a full runtime package format in this wave.
- WebGL2 backend should own shaders, texture upload/cache, draw calls, and resource lifecycle.
- Initial texture input can be raw RGBA bytes plus width/height/source metadata.
- Keep overlays separate if that reduces risk.
- Prefer native WebGL2. If a rendering dependency is proposed, escalate under dependency policy before using it.

Acceptance:

- A textured mesh can be rendered by WebGL2 from render-core scene data.
- Editor Preview can route main drawable image rendering through WebGL2 for imported PSD drawables.
- Mesh-deformed image rendering does not use Canvas2D triangle clip in the primary path.
- Opacity and draw order are preserved.
- Basic clipping is supported or escalated with a precise blocker and fallback boundary.
- Existing core PSD import/rendering E2E semantics remain stable.
- Typecheck and focused tests pass.

Forbidden:

- Renderer reads `AuthoringSession`.
- WebGL2 package imports editor/authoring/operation packages.
- Canvas2D renderer receives new feature logic.
- Pixel-perfect screenshot oracle as required pass condition.
- Viewer app creation as mandatory deliverable.

## 10. Domain B: `wave67-parent-child-deformer-local-space-semantics`

Purpose:

- Fix parent-child Deformer behavior so child deformations keep local meaning while parent deformers move/warp the child result.

Expected implementation areas:

- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/rig-control-warp-lattice.ts`
- focused runtime tests

Implementation guidance:

- Treat local-space chain semantics as the accepted target.
- Child-local warp sampling should happen in child local/rest basis.
- Parent deformer should transform/warp the child result.
- Overlay may be evaluated for display, but stored/edit values should remain interpretable as child-local offsets.
- Keep renderer out of this logic.

Acceptance:

- Parent warp moving a child warp outside rest bounds no longer causes child deformation to stop incorrectly.
- Non-uniform child warp offsets evaluate correctly under parent movement.
- Evaluated child warp overlay and evaluated mesh deformation agree.
- Runtime/editor semantics are aligned or any residual divergence is explicitly documented and escalated.
- Focused tests do not rely on screenshot/pixel oracle.

Forbidden:

- Child domain enlargement as a fix.
- WebGL2 renderer changes.
- Rig Inspector layout work.
- Deformer Tree UI work.
- Broad schema redesign without escalation.

## 11. Domain C: `wave67-mesh-auto-outline-v4-contour-band-sidecar`

Purpose:

- Add V4 contour-band mesh generation as explicit, non-default sidecar for human comparison and future refinement.

Expected implementation areas:

- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/package-format/**` if method metadata/schema is needed
- focused package tests
- `apps/editor/**` only for explicit non-default method selection/label if included

Implementation guidance:

- Use V4 algorithm doc as basis.
- Prefer reusing/extracting existing helpers if practical.
- If helper extraction creates too much churn, local helper duplication inside V4 module is acceptable with review.
- New geometry dependency requires dependency policy compliance and escalation.
- Keep V2.6 default.

Acceptance:

- V4 method is explicit and non-default.
- V4 fallback and provenance are recorded.
- V4 metrics include contour-band-specific evidence.
- Headless tests cover determinism, fallback, source ids, density/preset behavior, contour band metrics, bounds, transparent triangle limits, and stable ids.
- Existing V2.6 tests continue passing.
- Optional Editor exposure does not make V4 default.

Forbidden:

- Renderer work.
- Default switch to V4.
- Cubism compatibility/reproduction claim.
- Side-by-side comparison UI as mandatory deliverable.

## 12. Domain D: `wave67-final-integration-clean-review-map-closeout`

Purpose:

- Integrate A/B/C and decide whether Wave67 passes as the foundation wave.

Expected work:

- Confirm domain reports and review lanes exist for A/B/C.
- Confirm renderer packages obey dependency boundaries.
- Confirm WebGL2 renderer consumes render scene/evaluated data, not `AuthoringSession`.
- Confirm Canvas2D did not receive new feature work.
- Confirm parent-child Deformer semantics are local-space and covered by tests.
- Confirm V4 stayed sidecar and non-default.
- Run final validation.
- Update maps and closeout reports.
- Run final clean integration Review-Sylph with cross-domain Spec Compliance summary.

Required checks:

- `pnpm typecheck`
- Focused render-core/render-webgl2/editor tests from Domain A
- Focused editor/runtime deformer tests from Domain B
- Focused authoring-core/operation-core mesh tests from Domain C
- Focused Playwright only for durable semantic flow if stable and not visual-pixel based
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

Expected artifacts:

- `discussion/implementation/waves/wave67/wave67-domain-a-webgl2-shared-renderer-foundation-report.md`
- `discussion/implementation/waves/wave67/wave67-domain-b-parent-child-deformer-local-space-semantics-report.md`
- `discussion/implementation/waves/wave67/wave67-domain-c-mesh-auto-outline-v4-contour-band-sidecar-report.md`
- `discussion/implementation/waves/wave67/wave67-final-integration-report.md`
- `discussion/implementation/waves/wave67/_map.md`
- `discussion/implementation/reviews/wave67/_map.md`
- `discussion/implementation/reviews/wave67/wave67-final-clean-integration-review.md`

## 13. Orchestration Policy

This wave must follow `.github/skills/implementation-orchestration/SKILL.md`.

Root / Undine:

- Owns wave plan, dependency graph, user questions, and final decision.
- Must not implement the wave.
- Must preserve root context.
- Must wait for started subagents.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation for its domain.
- Must delegate implementation to Gnome.
- Must delegate review to independent Review-Sylphs.
- Must include separate Spec Compliance Review lane.
- Must wait for Gnome and Review-Sylph completion.
- Must not cancel, close, or interrupt child agents because they are slow or waiting.
- Must close completed child agent sessions at the end of the domain to avoid zombie sessions.
- Must not close running child sessions.

Gnome:

- Receives domain-specific basis sections only.
- Implements within allowed scope.
- May modify `packages/**` when the domain explicitly allows it and accepted UX/architecture requires it.
- May add dependencies only through dependency policy compliance and escalation.
- Must include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 14. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave67/wave67-domain-a-webgl2-shared-renderer-foundation-report.md`
- `discussion/implementation/waves/wave67/wave67-domain-b-parent-child-deformer-local-space-semantics-report.md`
- `discussion/implementation/waves/wave67/wave67-domain-c-mesh-auto-outline-v4-contour-band-sidecar-report.md`
- `discussion/implementation/waves/wave67/wave67-final-integration-report.md`
- `discussion/implementation/waves/wave67/_map.md`

Reviews:

- `discussion/implementation/reviews/wave67/wave67-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave67/wave67-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave67/_map.md`

## 15. Out of Scope

- WebGPU.
- Three.js / PixiJS adoption without explicit dependency-policy escalation.
- Full Viewer application creation.
- Texture Atlas UI / atlas packing implementation.
- Photoshop pixel-perfect compositing.
- Full blend mode support.
- Layer effects, vector masks, smart object support.
- Canvas2D triangle renderer feature expansion.
- V4 default switch.
- Side-by-side mesh comparison UI as mandatory work.
- Manual mesh vertex / edge / topology editing.
- Rotation Deformer direct Canvas editing.
- Physics / dynamics expansion.
- Variant / Expression Manager implementation.
- Save / load project UX expansion.
- Camera Capture / Face Tracking Facade.
- External runtime API / export facade.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-rig / auto-fix.
