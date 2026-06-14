# auto-outline-v6 Alpha-Constrained Delaunay Mesh Generation Algorithm

> Draft algorithm spec / current sidecar target.
> This document defines a new `auto-outline-v6` sidecar algorithm from the alpha-mask contour / adaptive sampling / constrained triangulation idea discussed with the user. It intentionally does not derive its algorithm from existing repository mesh-generation attempts.

## 1. Position

`auto-outline-v6` is a new sidecar mesh-generation method for creating an initial editable mesh from a drawable RGBA image.

It is not a default replacement until implementation evidence and human visual checks support that decision.

During comparison, v6 may be split into temporary backend variants:

| Variant | Backend | Role |
|---|---|---|
| `auto-outline-v6a-local` | local / dependency-free backend | custom reference candidate |
| `auto-outline-v6b-constrainautor` | `delaunator + @kninnug/constrainautor` | modern JS constraint-recovery candidate |
| `auto-outline-v6c-poly2tri` | `poly2tri` | direct constrained polygon triangulation candidate |

These variants are temporary comparison controls. The final product direction is to choose one backend and remove or hide the selector.

Proposed method id:

```text
auto-outline-v6-alpha-constrained-delaunay
```

Proposed source id:

```text
outline-v6-alpha-constrained-delaunay-rgba
```

## 2. Design Basis

The design basis is:

```text
soft alpha mask
-> alpha contour extraction
-> adaptive contour simplification
-> adaptive interior point sampling
-> boundary-preserving triangulation
-> deterministic cleanup and quality summary
```

The goal is not to reproduce Cubism, pixel-perfect behavior, or any prior local implementation. The goal is to obtain a comparable class of editable deformation mesh: boundary-aware, coarse enough to edit, denser near useful shape changes, and stable under regeneration.

## 3. Implementation Firebreak For Gnome

Gnome must treat this document as the algorithm source of truth.

Do not use existing mesh-generation algorithms as design reference.

Forbidden as algorithm basis:

- Existing `auto-grid`, `auto-outline-v1`, `auto-outline-v2`, `auto-outline-v2.5`, `auto-outline-v2.6`, `auto-outline-v3`, `auto-outline-v4`, or `auto-outline-v5` source logic.
- Existing recursive ring, contour-band, envelope, apron, soft-boundary, or grid heuristics.
- Existing algorithm-specific tests as shape or quality oracle.

Allowed only for integration:

- Public DTO shapes.
- Operation payload method/source enum seams.
- Mesh Tool preview/apply contract.
- Validator-facing invariants such as vertex/UV/triangle cardinality and stable IDs.
- Existing tests only to identify contract-level expectations, not to copy geometry expectations.

If a source file mixes public routing contracts with old algorithm internals, read only the routing/type boundary needed to connect v6. Do not mine old helpers, constants, sampling strategies, or triangulation code.

## 4. Input

Inputs:

- Drawable RGBA pixels.
- Drawable texture bounds.
- Mesh density preset: `Large Motion`, `Standard`, or `Low Motion`.
- Alpha threshold configuration.
- Deterministic seed derived from drawable id, texture bounds, density preset, and algorithm id.

Non-inputs:

- Part name.
- Drawable name semantics.
- Image-content classification such as "hair", "eye", or "cloth".
- Cubism format data.
- Existing mesh topology.

## 5. Output

Output:

- Mesh vertices in drawable local coordinates.
- UV coordinates aligned with vertices.
- Triangle indices.
- Stable vertex ids.
- Stable triangle ids if the surrounding contract expects them.
- Alpha bounds.
- Quality metrics.
- Fallback reason and fallback steps when v6 cannot produce a valid mesh.

The output must be deterministic for identical input.

## 6. Preset Behavior

V6 uses one algorithm with preset-dependent parameters.

| Preset | Boundary density | Interior density | Intended shape |
|---|---:|---:|---|
| Large Motion | high | medium-high | More contour vertices and deformation support near tips/curves |
| Standard | medium | medium | General editable mesh |
| Low Motion | low-medium | low | Coarser mesh for rigid or low-motion parts |

Preset must not be selected automatically. The caller chooses it explicitly.

## 7. Pipeline

### 7.1 Build A Soft Alpha Mask

1. Read alpha from RGBA pixels.
2. Normalize alpha to `[0, 1]`.
3. Apply a small deterministic blur to reduce single-pixel spikes.
4. Threshold into a binary mask.
5. Apply small morphological close/open operations:
   - close tiny transparent cracks that should not control mesh topology;
   - remove tiny isolated opaque noise.
6. Optionally dilate by a small preset-dependent padding so boundary triangles can slightly cover antialiased edges.

The soft mask is used for sampling and contour decisions. The original alpha remains available for quality checks.

### 7.2 Extract Alpha Contours

Use marching squares or an equivalent contour extractor on the cleaned mask.

Contour requirements:

- Keep closed loops.
- Preserve the main island.
- Support additional islands as separate loops when practical.
- Treat holes as exclusion loops when practical.
- Do not treat the layer rectangle as a shape contour.

V0 may handle only the main island if multi-loop support would make implementation unstable, but it must report that limitation through fallback or quality summary.

### 7.3 Adaptive Boundary Simplification

Convert each contour loop into boundary vertices with adaptive spacing.

Rules:

- Use arclength spacing as the baseline.
- Keep sharp corners and high-curvature points.
- Keep narrow tips by detecting local width or nearby opposite boundary.
- Use coarser spacing on long smooth spans.
- Enforce a minimum vertex distance to avoid dense pixel-tracing.
- Enforce a maximum segment length so large smooth regions still deform predictably.

The boundary vertices are mesh vertices. They form constrained boundary edges for triangulation.

### 7.4 Adaptive Interior Sampling

Generate interior points using deterministic Poisson-disk sampling or a deterministic blue-noise approximation.

The target radius varies by location:

```text
radius(p) =
  presetBaseRadius
  * boundaryDistanceFactor(p)
  * localWidthFactor(p)
  * alphaGradientFactor(p)
```

Density rules:

- Denser near the contour, but not so dense that every alpha pixel becomes a vertex.
- Denser in thin regions and tips.
- Slightly denser around strong alpha gradients.
- Coarser in broad, smooth, opaque interiors.

Sampling must be deterministic. If randomized candidate ordering is used, it must use the deterministic seed.

### 7.5 Boundary-Preserving Triangulation

Triangulate boundary and interior points while preserving boundary edges.

Preferred algorithm:

- Constrained Delaunay triangulation.

Acceptable v0 fallback if a robust constrained triangulation dependency is not approved:

- Delaunay triangulation over all points;
- remove triangles outside the mask or crossing constrained boundary edges;
- recover missing boundary edges by local edge splits or fallback to a simpler safe mesh.

Do not claim full constrained Delaunay unless the implementation actually preserves constrained edges robustly.

### 7.6 Triangle Filtering And Cleanup

Cleanup must protect validity without hiding algorithm failure.

Required cleanup:

- Remove triangles outside the accepted alpha region.
- Remove degenerate triangles.
- Remove triangles with duplicate vertices.
- Remove triangles with invalid indices.
- Remove tiny sliver triangles only when neighboring coverage remains valid.

Do not create holes by aggressively deleting bad triangles. If cleanup would remove visible coverage, fallback or mark the result as low quality.

### 7.7 Relaxation

Optionally apply a small number of deterministic constrained relaxation passes:

- Move interior vertices toward local centroid or Lloyd relaxation target.
- Keep boundary vertices fixed or slide only along the contour.
- Keep tips and high-curvature boundary anchors fixed.
- Abort relaxation if triangle quality gets worse.

Relaxation is quality polish, not the core algorithm.

## 8. Quality Metrics

V6 should return a compact quality summary:

- vertex count.
- triangle count.
- boundary vertex count.
- interior vertex count.
- minimum triangle area.
- minimum angle.
- maximum edge length.
- number of removed triangles.
- number of outside/crossing triangles detected.
- fallback steps used.
- multi-island or hole handling status.

Metrics are for deterministic diagnostics and UI summaries. They are not a pixel-perfect visual oracle.

## 9. Fallback Policy

V6 should not silently return no mesh.

Fallback order:

1. Retry with coarser boundary and interior sampling.
2. Retry without optional relaxation.
3. Retry using main island only if multiple islands caused failure.
4. Return a simple alpha-bounds-safe fallback mesh with explicit `fallbackReason`.
5. Return blocked only when no valid alpha bounds or byte input exists.

Fallback must be visible through source/fallback metadata, so visual comparison does not mistake a fallback mesh for successful V6 geometry.

## 10. Determinism Requirements

The same drawable bytes, bounds, preset, and method id must produce the same mesh.

Determinism applies to:

- contour simplification order;
- point sampling order;
- triangulation input ordering;
- stable ids;
- fallback decisions;
- quality metrics.

Stable IDs should be generated from algorithm id, preset, deterministic point order, and triangle order rather than from floating point string noise.

## 11. v0 Acceptance Criteria

V6 v0 is acceptable when:

- It is available as an explicit sidecar method.
- It does not change the default mesh method unless a separate decision does so.
- It generates boundary-following editable meshes from RGBA alpha.
- Large Motion produces more deformation support than Standard and Low Motion.
- It returns deterministic results in unit tests.
- It preserves mesh DTO invariants.
- It exposes source/fallback/quality metadata.
- It does not read or reconstruct Cubism formats.
- It does not use old repository mesh algorithms as algorithm basis.

## 12. Suggested Tests

Contract tests:

- deterministic generation for identical RGBA and preset.
- valid vertex/UV/triangle/stable-id cardinality.
- no invalid, duplicate, or degenerate triangle indices.
- fallback metadata when alpha bytes are missing or empty.
- method/source ids are preserved through operation provenance.

Algorithm-shape tests:

- simple opaque rectangle produces a valid coarse mesh.
- curved blob produces boundary vertices on the contour and interior triangles.
- thin tapered shape keeps enough vertices near the tip.
- Large Motion has more vertices/triangles than Low Motion for the same input.

Avoid tests that encode exact triangle layouts unless they describe a strict contract. Exact geometry can overfit implementation details.

## 13. Non-Goals

- Cubism compatibility.
- Cubism mesh reproduction.
- Pixel-perfect comparison against any editor.
- Semantic recognition.
- Automatic rigging.
- Automatic preset selection.
- Reusing prior local mesh algorithms.
- Full support for every pathological mask in v0.
