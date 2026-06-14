# auto-outline-v6D Adaptive Contour Constrainautor

> Accepted current mainline / default mesh generation algorithm.
> This document records the current accepted implementation after visual confirmation and focused tests. It supersedes the visible-inner-strip / staggered-band direction for the default path, without deleting the older lineage documents.

## 1. Position And Status

`auto-outline-v6d-adaptive-contour-constrainautor` is the current accepted/default Mesh Tool generation method.

Current acceptance basis:

- User visual confirmation: fallback is no longer observed in current use, and no currently failing mesh-generation parts are known.
- Repository implementation: the method is registered, routed, and set as `DEFAULT_MESH_GENERATION_METHOD`.
- Focused automated tests cover contract registration, backend output, adaptive density diagnostics, outside-bounds vertices with valid UVs, default command routing, and debug diagnostics.

This is not an automated visual-proof claim. Visual mesh quality is accepted by the current user check; tests prove deterministic routing and structural properties, not pixel-perfect visual quality.

## 2. Names And IDs

| Item | Value |
|---|---|
| Method id | `auto-outline-v6d-adaptive-contour-constrainautor` |
| Source id | `outline-v6d-adaptive-contour-constrainautor-rgba` |
| Backend id | `v6d-adaptive-contour-constrainautor` |
| Implementation file | `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts` |
| Shared density file | `packages/authoring-core/src/mesh-generation-v6d-adaptive-density.ts` |
| Shared contour pipeline | `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts` |
| Shared Constrainautor backend helpers | `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts` |
| Editor default | `apps/editor/src/features/editor-session/model/mesh-tool-state.ts` |

The method is registered in `V6_MESH_GENERATION_CANDIDATES` with dependency packages `delaunator` and `@kninnug/constrainautor`, and `backendImplementationStatus: "implemented"`.

## 3. Lineage

This method keeps the successful v6D constrained-contour lineage:

```text
soft alpha contour pipeline
-> boundary constraint loop
-> ordinary interior Steiner points
-> Delaunator over all points
-> Constrainautor boundary recovery
-> outside/crossing triangle filtering
```

It incorporates the Wave71 adaptive density helper and later direct tuning that added virtual padding around the source RGBA before contour extraction.

Current lineage summary:

- Old v6D contour constrainautor supplies the core Delaunator + Constrainautor topology and triangle filtering.
- Wave71 supplies the shared adaptive density resolver concept and diagnostics.
- Later direct tuning adds method-local virtual padding and mask expansion, which is the accepted fix for the observed layer-edge clipping symptom.
- The Wave70 support-ring and Wave71 staggered-band docs remain useful history, but they are not the accepted default direction now.

Explicitly not part of this accepted method:

- support rings;
- inner rings;
- staggered inner strips;
- explicit alpha-to-inner strip triangles;
- algorithm selector UX.

## 4. Pipeline

### 4.1 Virtual Padded Contour Input

The method first builds a virtual texture around the original layer RGBA.

Current parameter:

```text
virtual padding: 4 px
```

Implementation behavior:

- If the original texture size and byte length are valid, create a padded RGBA buffer with width and height expanded by `padding * 2`.
- Copy original RGBA bytes into the center of the virtual buffer at `(padding, padding)`.
- Leave the virtual border transparent.
- Expand `meshBounds` by the same pixel ratio, so virtual contour coordinates can map to stage vertices outside the original layer rectangle.
- If texture dimensions or byte length are invalid, skip padding and use the original input with `paddingPixels: 0`.

### 4.2 Soft Alpha Mask And Main Component

The shared v6 contour pipeline builds a deterministic soft mask from RGBA alpha.

Current contour-pipeline constants:

```text
default alpha threshold: 8
soft alpha threshold: 0.18
```

Pipeline behavior:

- Count input pixels whose alpha is above the alpha threshold.
- Apply a 3x3 weighted blur to alpha.
- Include a pixel if blurred alpha reaches the soft threshold or original alpha exceeds the threshold.
- Close single-pixel cracks.
- Remove isolated weak alpha noise.
- Find connected opaque components.
- Select the largest component deterministically.

Current multi-island behavior is main-island-only when multiple components are detected. Hole-like regions are reported in diagnostics; full hole support is not the goal of this method.

### 4.3 Method-Local Mask Expansion

The accepted method passes method-local expansion to the shared contour pipeline.

Current parameter:

```text
mask expansion: 2 px
```

This expands the selected component mask before boundary tracing. It is local to this method call, not a global contour-pipeline default.

### 4.4 Adaptive Density Resolution

The method runs a preliminary contour pass to get selected component area and alpha bounds, then resolves adaptive density and reruns the contour pass with the resolved parameters.

Primary size signal:

```text
effectiveArea = selectedComponentPixelCount
referenceArea = 73936
```

Fallback size signal:

```text
effectiveArea = alphaBounds.width * alphaBounds.height
referenceArea = 400 * 288
```

Current baseline parameters:

| Density hint | boundarySpacing | interiorSpacing | maxBoundaryVertices | maxInteriorVertices | interiorBoundaryClearance |
|---|---:|---:|---:|---:|---:|
| `high` | 8 | 7.5 | 128 | 64 | 1.1 |
| `medium` | 12 | 10 | 128 | 32 | 1.1 |
| `low` | 30 | 15 | 64 | 16 | 1.5 |

Current scaling:

```text
clampedAreaRatio = clamp(areaRatio, 0.2, 4.0)
spacingScale = clamp((1 / sqrt(clampedAreaRatio)) ^ 0.35, 0.82, 1.25)
vertexScale = clamp(clampedAreaRatio ^ 0.75, 0.45, 2.5)
boundaryCapScale = clamp(sqrt(clampedAreaRatio), 0.7, 2.0)
```

Resolved values:

- `boundarySpacing = base.boundarySpacing * spacingScale`
- `interiorSpacing = base.interiorSpacing * spacingScale`
- `maxBoundaryVertices` is capped between `base * 0.7` and `base * 2.0`
- `maxInteriorVertices` is capped between `base * 0.45` and `base * 2.5`
- `interiorBoundaryClearance` stays at the preset baseline

The current focused test asserts the boundary cap max scale reaches `2.0`.

### 4.5 Boundary Loop Tracing And Sampling

After density resolution, the shared contour pipeline:

1. Traces pixel boundary edges around the expanded main mask.
2. Connects boundary edges into loops.
3. Normalizes loop order and orientation.
4. Selects the largest outer loop.
5. Samples boundary points by arclength using resolved `boundarySpacing`.
6. Adds deterministic top, bottom, left, and right extreme anchors.
7. Deduplicates rounded points.
8. Creates boundary constraint edges between consecutive sampled boundary points.

### 4.6 Interior Steiner Point Sampling

Interior points are ordinary Steiner points inside the expanded main mask.

The shared pipeline:

- creates candidate points on a deterministic lattice using resolved `interiorSpacing`;
- rejects candidates too close to the boundary based on `interiorBoundaryClearance`;
- scores candidates by boundary distance and distance from already selected points;
- selects up to `maxInteriorVertices`;
- adds a single best interior fallback point if no interior point was selected.

No support ring, inner ring, staggered strip, or explicit alpha-inner strip is generated.

### 4.7 Delaunator + Constrainautor Recovery

The method passes ordinary boundary and interior points to the old v6D recovery helper:

```text
boundary points + ordinary interior points
-> Delaunator.from(...)
-> new Constrainautor(delaunay)
-> constrainAll(boundary constraint edges)
```

Boundary points and interior points receive separate stable id families:

- `vtx_<drawable>_v6d_adaptive_contour_boundary_<stableOrder>`
- `vtx_<drawable>_v6d_adaptive_contour_interior_<stableOrder>_<index>`

### 4.8 Triangle Filtering

After recovery, triangles are filtered by the shared v6D filter:

- remove duplicate-index triangles;
- remove near-zero-area triangles;
- remove triangles whose centroid is outside the boundary polygon;
- remove triangles that cross a boundary edge.

The method then verifies that all boundary constraint edges remain present in the filtered triangle set. Missing constraints or an empty filtered triangle set cause a structured fallback.

### 4.9 Stage Vertex Mapping

Generated vertices are mapped from virtual pixel coordinates through the expanded virtual bounds:

```text
stage.x = virtualBounds.x + virtualBounds.width * (point.x / virtualTextureWidth)
stage.y = virtualBounds.y + virtualBounds.height * (point.y / virtualTextureHeight)
```

Because `virtualBounds` is larger than the original layer bounds, stage vertices may be outside the original layer rectangle.

### 4.10 UV Mapping Back To Original Texture

UVs are mapped back to the original texture, not the padded virtual texture:

```text
originalPixel.x = virtualPoint.x - padding
originalPixel.y = virtualPoint.y - padding
uv.x = clamp(originalPixel.x / originalTextureWidth, 0, 1)
uv.y = clamp(originalPixel.y / originalTextureHeight, 0, 1)
```

This keeps UVs valid for the available texture while allowing stage vertices to extend into the virtual exterior.

Alpha bounds returned by the method are also unpadded and clamped back to original texture bounds before mapping to original stage bounds.

## 5. Diagnostics And Provenance

Generated output records:

- `triangulationMode: "v6d-adaptive-contour-constrainautor"`
- `methodId: "auto-outline-v6d-adaptive-contour-constrainautor"`
- `backendId: "v6d-adaptive-contour-constrainautor"`
- `requestedSourceId: "outline-v6d-adaptive-contour-constrainautor-rgba"`
- `actualSourceId: "outline-v6d-adaptive-contour-constrainautor-rgba"`
- `outputKind: "backend-output"`

Contour pipeline diagnostics include:

- `inputOpaquePixelCount`
- `softMaskOpaquePixelCount`
- `selectedComponentPixelCount`
- `boundaryPointCount`
- `constraintEdgeCount`
- `steinerPointCount`
- `alphaBoundsAvailable`
- blocked reason when blocked

Constrainautor diagnostics include:

- dependency gate status;
- constraint edge count;
- preserved and missing constraint edge counts;
- `constraintRecoveryFailed`;
- outside triangle count;
- thrown error kind when the backend throws.

Adaptive density diagnostics include:

- reference area;
- effective area;
- area ratio and clamped area ratio;
- spacing scale;
- vertex scale;
- boundary cap scale;
- resolved boundary spacing;
- resolved interior spacing;
- resolved max boundary vertices;
- resolved max interior vertices;
- resolved interior boundary clearance.

Fallback metadata includes:

- `fallbackReason`;
- `fallbackSteps`;
- `actualSourceId`;
- `outputKind`.

For method-local recovery or final constraint failures, the implementation returns an alpha-aware fallback mesh with:

```text
actualSourceId: alpha-aware-rgba
outputKind: fallback-output
```

For no texture bytes or blocked contour extraction at the wrapper level, the wrapper records blocked fallback metadata and may return a bounds-grid mesh.

Success provenance includes:

```text
v6-contour-soft-alpha-mask
v6-contour-main-component-selection
v6-contour-boundary-loop-trace
v6-contour-outer-loop-selection
v6-contour-boundary-sampling
v6-contour-constraint-edge-contract
v6-contour-farthest-interior-steiner-sampling
dependency-available
v6d-adaptive-density-resolved
v6d-adaptive-contour-constrainautor-delaunator-all-points
v6d-adaptive-contour-constrainautor-constraint-recovery
v6d-adaptive-contour-constrainautor-boundary-constraints-verified
v6d-adaptive-contour-constrainautor-outside-triangle-filter
```

## 6. Why This Solves Layer-Edge Clipping

The observed clipping symptom came from contour generation being constrained by the original layer rectangle. When opaque pixels touched the source edge, there was no transparent exterior in the input image for the contour to occupy.

The accepted method fixes that by adding transparent virtual padding before contour extraction:

- the contour pipeline sees transparent pixels around the original layer;
- mask expansion and boundary tracing can place the contour in that virtual exterior;
- stage vertices map through expanded virtual bounds, so they can land outside the original layer rectangle;
- UVs subtract the padding and clamp to the original texture, so texture sampling remains valid.

This gives the mesh deformation support outside the original layer bounds without requiring source pixels that do not exist.

## 7. Known Limits And Non-Goals

Known limits:

- No true source pixels outside the original layer are recovered.
- Exterior virtual vertices use UVs clamped/projected to the original texture.
- Multi-island inputs select the main island only.
- Hole-like regions are reported but not fully modeled as holes.
- Future pathologies may still use structured fallback if Constrainautor recovery or final boundary verification fails.

Non-goals:

- support rings;
- inner rings;
- staggered strips;
- explicit alpha-inner strip triangles;
- algorithm selector UI;
- renderer changes;
- texture padding or dilation;
- Cubism compatibility;
- pixel-perfect reproduction of another editor.

## 8. Acceptance And Verification State

Current verification evidence from repository facts:

- `mesh-generation-contract.ts` registers the method/source/backend ids as implemented.
- `mesh-generation.ts` dispatches to `createAutoOutlineV6DAdaptiveContourConstrainautorMesh`.
- `mesh-tool-state.ts` sets `DEFAULT_MESH_GENERATION_METHOD` to this method.
- `mesh-generation.test.ts` covers backend output, adaptive density diagnostics, absence of support/staggered diagnostics, outside-bounds vertices, and valid UVs.
- `mesh-generation.test.ts` covers shared adaptive density baselines and part-size scaling, including boundary cap scale `2.0`.
- `mesh-tool-state.test.ts` covers default method and absence of backend selector options.
- `editor-session-commands.test.ts` covers default generate-mesh command provenance for this method/source/backend.
- `editor-session-context-history.test.ts` covers debug logging of constrainautor and adaptive density diagnostics.

Current user acceptance evidence:

- The method is accepted as complete enough after visual confirmation.
- Fallback is no longer observed by the user.
- No currently failing mesh-generation parts are known.

Remaining verification boundary:

- There is no automated visual proof or pixel oracle for mesh aesthetics.
- Broader artwork coverage can still reveal future tuning needs.

## 9. Optional Future Tuning Points

Do not tune preemptively unless future logs, fixtures, or visual checks show a problem.

Possible future knobs:

- virtual padding size, currently `4 px`;
- mask expansion size, currently `2 px`;
- boundary spacing and boundary cap scaling;
- adaptive density reference areas or clamp ranges;
- fallback retry/reduced-parameter strategy, only if future logs show Constrainautor or final boundary verification failures.
