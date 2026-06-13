# Wave67 Preplan Inventory: Mesh auto-outline-v4 Contour Band Sidecar

> Read-only Sylph inventory。Wave67でMesh `auto-outline-v4-contour-band` を非default sidecarとして計画するための実装事実棚卸。

## Verdict

done

## Basis

- [auto-outline-v4 Contour Band Algorithm](../../../design/mesh-generation/auto-outline-v4-contour-band.md)
- [auto-outline-v2.6 Soft Apron Algorithm](../../../design/mesh-generation/auto-outline-v2-6-soft-apron.md)
- [Mesh Generation Design Map](../../../design/mesh-generation/_map.md)
- [Mesh Image Rendering Architecture](../../../design/mesh-rendering/mesh-image-rendering-architecture.md)
- [Mesh Tool Component](../../../design/screen-design/components/mesh-tool.md)

## Findings

### Current Mesh Generation Structure

- V1, V2, V2.5, V2.6, and V3 are implemented as separate `packages/authoring-core/src/mesh-outline-*-generation.ts` modules.
- `packages/authoring-core/src/mesh-generation.ts` owns method ids, generated source ids, fallback routing, texture-byte lookup, and top-level quality metrics.
- V2.6 is an explicit sidecar method today:
  - method id: `auto-outline-v2.6-soft-apron`
  - source id: `outline-v2-6-soft-apron-rgba`
  - fallback: `V2.6 -> V2.5 -> V2 -> V1 -> bounds-grid`
- V2.6 builds on V2.5 output, extracts ordered V2.5 boundary vertices by stable id, then adds apron rings and strip triangles.

### Metrics / Provenance

- Metrics are centralized in `packages/authoring-core/src/mesh-quality-metrics.ts`.
- Existing specialized metrics include `envelopeMetrics`, `softBoundaryMetrics`, and `softApronMetrics`.
- V4 should likely add `contourBandMetrics` plus a new triangulation mode literal rather than overloading V2.6 metrics.
- Operation integration validates methods in `packages/operation-core/src/payloads/model-edit.ts`.
- `packages/operation-core/src/operations/generate-mesh.ts` records provenance transform history such as `generateMesh:*`, `meshSource:*`, `fallback:*`, and metric summaries.

### Editor Integration

- Editor Mesh Tool preview/apply is currently hard-coded to V2.6 in `apps/editor/src/features/editor-session/editor-session-context.tsx`.
- `commitGenerateMesh` also defaults to V2.6.
- UI exposes density presets only, not algorithm selection.
- Current Mesh Tool supports one draft mesh at a time.
- V4 comparison would need method-aware draft/provenance identity if both V2.6 and V4 are previewed.

### Utilities / Dependencies

- There is no reusable exported contour/triangulation/sampling utility.
- Existing algorithms contain private helpers for contour extraction, simplification, sampling, Bowyer-Watson triangulation, and filtering.
- V4 can copy/extract internal helpers or request a new dependency.
- New dependencies must follow dependency policy, license/risk review, and approval.

## Planning Implications

- Add V4 as explicit non-default sidecar method.
- Do not change editor default, command default, or automatic Mesh Tool behavior from V2.6 unless later user decision says so.
- Smallest safe headless scope:
  - new authoring-core V4 generator
  - new method/source ids
  - fallback routing
  - metrics type/formatter
  - operation payload/precondition updates
  - focused tests comparing V4 behavior against V2.6
- If visual comparison is included, use a simple algorithm selector with V2.6 selected by default. True side-by-side preview is larger UI work.

## Risks

- contour offset self-intersection
- concave shape blowout
- holes or multi-island ambiguity
- transparent-only triangles
- long boundary-to-interior spokes
- high vertex valence
- skinny triangles
- unstable stable ids
- excessive vertex counts
- misleading provenance when V4 silently falls back

## User / Product Decisions Deferred

- Whether V4 ever becomes default.
- Whether comparison UI should eventually become side-by-side.
- Whether V4 v0 handles holes/multiple islands or explicitly documents largest-island behavior.
- Whether external triangulation/contour dependencies are worth the dependency-policy cost.
