# auto-outline-v6D / v6E / v6F Contour-Salvage Triangulation

> Draft algorithm spec / next-wave candidate.
> This document records the user decision after Wave68 visual review: keep the useful `auto-outline-v6a-local` contour extractor, discard its triangulation stage, and compare three triangulation replacements as `auto-outline-v6d`, `auto-outline-v6e`, and `auto-outline-v6f`.

## 1. Position

Wave68 produced three temporary v6 candidates:

| Previous candidate | Outcome for next wave |
|---|---|
| `auto-outline-v6a-local` | Keep only the contour extraction / boundary sampling pipeline. Discard its triangulation stage, but preserve the lesson that custom geometry may produce the best visual quality. |
| `auto-outline-v6b-constrainautor` | Remove from the Editor algorithm choices in the next wave. Reuse the library idea only as part of new v6D. |
| `auto-outline-v6c-poly2tri` | Remove from the Editor algorithm choices in the next wave. Reuse the library idea only as part of new v6E. |

The next wave should create three new comparison candidates:

| New candidate | Contour source | Triangulation backend | Role |
|---|---|---|---|
| `auto-outline-v6d-contour-constrainautor` | v6A contour salvage pipeline | `delaunator + @kninnug/constrainautor` | Delaunay plus constraint recovery library candidate |
| `auto-outline-v6e-contour-poly2tri` | v6A contour salvage pipeline | `poly2tri` | constrained polygon / Steiner point library candidate |
| `auto-outline-v6f-contour-custom-cdt` | v6A contour salvage pipeline | repo-local custom constrained triangulation | custom quality-focused candidate |

The Editor's temporary algorithm selector should expose v6D, v6E, and v6F for comparison. It may remove v6A, v6B, and v6C from the visible choices. The default mesh method remains the pre-v6 default until a separate user decision promotes one candidate.

## 2. User Decision

The user judged that the Wave68 v6A result is not acceptable as-is, but is the closest candidate:

- The alpha-derived outer boundary is visually promising.
- Boundary sampling appears useful and should be preserved.
- Among v6A/v6B/v6C, v6A had the highest observed quality.
- The large spoke-like triangle fan is unacceptable.
- The failure is attributed primarily to the triangulation stage, not the contour extraction stage.

Design decision:

```text
Save v6A as a contour extractor.
Discard v6A as a triangulator.
Compare two library-backed triangulators and one new custom triangulator.
```

The new custom triangulator must not be the old v6A ear-clipping triangulator under a new name.

## 3. What To Preserve From v6A

The next wave may use the current v6A implementation as the basis for these stages only:

```text
RGBA alpha
-> soft alpha mask
-> opaque component selection
-> pixel boundary loop tracing
-> outer loop selection
-> boundary loop sampling
```

Preserve the behavior conceptually, not necessarily by copying every helper exactly.

### 3.1 Soft Alpha Mask

Preserve the idea of generating a stable binary mask from RGBA alpha:

- alpha thresholding;
- small deterministic blur;
- closing tiny transparent cracks;
- removing isolated alpha noise.

This stage is useful because it reduces single-pixel artifacts before contour extraction.

### 3.2 Main Opaque Component

Preserve main-island selection for the first implementation pass:

- find connected opaque components;
- select the largest component deterministically;
- record multi-island limitation through metrics or fallback metadata.

Full multi-island support is not required for v6D/v6E/v6F v0 unless it falls out naturally from the backend.

### 3.3 Boundary Loop Trace

Preserve the pixel-edge boundary trace:

- walk opaque pixels;
- emit edges where an opaque pixel touches transparent/out-of-bounds space;
- connect boundary edges into closed loops;
- normalize loop order and orientation;
- select the outer loop by absolute area.

This gives a faithful silhouette source before simplification.

### 3.4 Boundary Loop Sampling

Preserve the boundary sampling concept:

```text
targetCount = round(perimeter / boundarySpacing)
```

Then:

- sample points by arclength along the boundary loop;
- add extreme anchors for top, bottom, left, and right;
- sort by boundary distance;
- dedupe rounded points;
- keep deterministic point order.

This is the strongest part of v6A. It turns a dense pixel contour into a controlled set of boundary vertices while keeping the silhouette recognizable.

The next wave may improve this sampler by adding curvature or tip anchors, but it should not replace it with a bounding-box grid or rectangle-derived outline.

## 4. What To Discard From v6A

The next wave should not use these v6A stages as the algorithm basis:

- row-major grid interior point insertion;
- centroid-first interior point placement as the primary interior strategy;
- `earClipPolygon` as the main triangulation;
- fan fallback triangulation;
- `splitTrianglesWithInteriorPoints`;
- accepting long triangles merely because their centroid is inside the mask.

Observed failure:

```text
boundary points are reasonable,
but ear clipping creates long boundary-to-boundary triangles,
and later interior point insertion only splits existing triangles locally.
```

Because the algorithm never rebuilds a triangulation over all points, it can preserve long spoke-like triangle structures even when boundary sampling is good.

## 5. Shared v6D / v6E / v6F Pipeline

All new candidates should share this pipeline:

```text
RGBA alpha
-> v6A-style soft alpha mask
-> v6A-style main component selection
-> v6A-style boundary loop trace
-> v6A-style outer loop selection
-> v6A-style boundary sampling
-> improved interior / Steiner point generation
-> candidate triangulation backend
-> triangle validation and quality metrics
```

The shared pipeline should produce:

- ordered boundary points;
- boundary constraint edges between consecutive boundary points;
- deterministic interior / Steiner points;
- per-candidate triangulation diagnostics;
- visible fallback metadata.

## 6. Improved Interior / Steiner Point Generation

The next wave should replace v6A's row-major grid with a boundary-aware deterministic sampler.

Recommended v0 strategy:

1. Compute an approximate distance field inside the main mask.
2. Generate candidates inside the mask on a deterministic lattice.
3. Score candidates using distance from boundary, local spacing, and coverage value.
4. Select candidates using deterministic farthest-point or Poisson-disk-like sampling.
5. Optionally add one or more inward offset-ring bands from the boundary.

The goal is not to place many points. The goal is to place enough points to prevent long boundary-to-boundary triangles and to make deformation support feel intentional.

Interior point selection should avoid:

- row-major saturation where the first `maxInteriorVertices` points all come from the top-left area;
- points extremely close to boundary samples;
- duplicate or near-duplicate coordinates;
- point sets that overload the triangulation backend.

Preset behavior:

| Preset | Boundary points | Interior / Steiner points | Expected result |
|---|---:|---:|---|
| Large Motion | high | medium-high | More support near silhouette changes and broad deformation areas |
| Standard | medium | medium | Balanced editable mesh |
| Low Motion | low | low | Coarse but still boundary-preserving mesh |

## 7. Candidate v6D: Contour + Constrainautor

Method id:

```text
auto-outline-v6d-contour-constrainautor
```

Source id:

```text
outline-v6d-contour-constrainautor-rgba
```

Backend:

```text
delaunator
-> @kninnug/constrainautor
```

Input to backend:

- boundary points from the v6A-style sampler;
- interior / Steiner points from the improved sampler;
- boundary edges as constraints;
- deterministic point order.

Algorithm:

1. Quantize and dedupe all points.
2. Build boundary constraint edges.
3. Run Delaunator over boundary plus interior points.
4. Recover boundary constraints through Constrainautor.
5. Verify every boundary edge is present or intentionally split.
6. Filter triangles outside the main mask / outer polygon.
7. Return triangles only if constraint preservation and coverage checks pass.

Expected strength:

- Better triangle quality than ear clipping.
- Better browser/ESM fit than older geometry libraries.
- Natural fit for all-points triangulation.

Expected risk:

- Constraint recovery may fail or split edges in ways that need careful mapping.
- Hole support may remain custom.
- Boundary preservation must be explicitly verified.

## 8. Candidate v6E: Contour + Poly2Tri

Method id:

```text
auto-outline-v6e-contour-poly2tri
```

Source id:

```text
outline-v6e-contour-poly2tri-rgba
```

Backend:

```text
poly2tri
```

Input to backend:

- ordered outer contour from the v6A-style sampler;
- optional valid holes if implemented;
- interior / Steiner points from the improved sampler.

Algorithm:

1. Quantize and dedupe contour points.
2. Validate simple polygon constraints.
3. Normalize winding.
4. Create a `poly2tri` sweep context from the sampled outer loop.
5. Add valid holes when supported.
6. Add interior points as Steiner points.
7. Run triangulation.
8. Convert returned triangles back to deterministic mesh indices.
9. Verify boundary coverage, triangle validity, and mask coverage.

Expected strength:

- The backend directly models a constrained polygon plus Steiner points.
- Boundary edges are part of the input model.
- It may avoid the constraint-recovery ambiguity of v6D.

Expected risk:

- Input polygon validity is strict.
- The package may be less modern for browser/bundler integration.
- Near-collinear or near-duplicate contour points can cause failures.

## 9. Candidate v6F: Contour + Custom Constrained Triangulation

Method id:

```text
auto-outline-v6f-contour-custom-cdt
```

Source id:

```text
outline-v6f-contour-custom-cdt-rgba
```

Backend:

```text
repo-local custom constrained triangulation
```

Rationale:

The Wave68 comparison suggested that the custom v6A path produced the best overall visual direction despite its bad triangulation. A custom triangulator remains a serious candidate because it can optimize for this project's mesh-editing goals rather than for a generic geometry library's assumptions.

v6F should be a new custom triangulation attempt, not a continuation of v6A's ear clipping.

Input to backend:

- boundary points from the v6A-style sampler;
- improved interior / Steiner points;
- boundary edges as hard constraints;
- optional mask / polygon containment predicate;
- deterministic point order.

Recommended v0 algorithm:

1. Quantize and dedupe all points.
2. Build a triangulation over all boundary and interior points, not boundary-only.
3. Preserve or recover boundary constraint edges.
4. Remove triangles outside the accepted alpha region / outer polygon.
5. Improve unconstrained edges with deterministic local edge flips.
6. Reject output if boundary constraints are missing or triangle quality is visibly worse than the safe fallback.

Acceptable implementation strategies:

- incremental Bowyer-Watson Delaunay over all points, followed by constraint recovery;
- advancing-front triangulation from the sampled boundary inward;
- monotone or ear-based decomposition only if interior points participate globally and long spokes are explicitly prevented;
- hybrid local edge-flip legalization, preserving constrained boundary edges.

Required difference from v6A:

- all selected points must participate in the triangulation from the start or through a global retriangulation step;
- interior points must not merely split whichever ear-clipped triangle happens to contain them;
- boundary edges must be tracked as constraints;
- unconstrained edges should be eligible for local improvement;
- long boundary-to-boundary spokes should be penalized or flipped when a better local edge exists.

Expected strength:

- Can encode project-specific visual quality rules directly.
- Can prefer editable, evenly distributed triangles over generic triangulation output.
- Avoids browser/bundler risk from geometry dependencies.
- Allows custom fallback and diagnostics tailored to alpha-mask meshes.

Expected risk:

- More implementation risk than library-backed candidates.
- Robust constraint recovery is hard.
- Degenerate geometry, near-collinear points, and narrow tips need careful handling.
- It can overfit the observed hair case if tests are too narrow.

## 10. Triangle Validation

All candidates must validate triangles after backend generation.

Required checks:

- no invalid indices;
- no duplicate vertices per triangle;
- no zero-area or near-zero-area triangles;
- triangle centroid inside accepted alpha region or outer polygon;
- boundary edge preservation / coverage;
- no large number of triangles outside the mask;
- no silent fallback reported as successful v6D/v6E/v6F output.

Quality metrics should include:

- vertex count;
- triangle count;
- boundary vertex count;
- interior / Steiner point count;
- minimum triangle area;
- minimum angle if available;
- maximum edge length;
- preserved boundary edge count;
- missing boundary edge count;
- removed triangle count;
- outside triangle count;
- backend failure reason when applicable.

v6F should additionally report:

- edge flip count;
- constraint recovery operation count;
- long-spoke candidate count;
- rejected local improvement count;
- custom triangulation fallback reason.

## 11. Editor Comparison Scope

The next wave's temporary comparison UI should prioritize the new candidates:

- `auto-outline-v6d-contour-constrainautor`
- `auto-outline-v6e-contour-poly2tri`
- `auto-outline-v6f-contour-custom-cdt`

It is acceptable to remove the previous v6A, v6B, and v6C choices from the visible algorithm selector.

The selector remains temporary. The final intended UX is still preset-driven mesh generation, not user-facing triangulation-library choice.

## 12. Acceptance Criteria For Next Wave

The next wave is acceptable when:

- v6D, v6E, and v6F are selectable as temporary sidecar candidates.
- v6A/B/C are no longer presented as current comparison choices.
- all three candidates reuse the v6A-style contour extraction / boundary sampling stages;
- none of v6D/v6E/v6F uses the v6A ear-clip / split-triangle triangulation stage;
- all three candidates generate deterministic DTO-valid meshes for representative alpha fixtures;
- spoke-like triangle fan failure is reduced on the hair/eye visual case used by the user;
- v6F is evaluated as a first-class candidate, not merely as fallback;
- fallback metadata clearly distinguishes backend success from fallback output;
- Editor default remains unchanged unless the user separately chooses a final backend.

## 13. Implementation Notes For Gnome

Allowed basis:

- this document;
- current v6A implementation only for soft alpha mask, component selection, boundary loop trace, outer loop selection, and boundary sampling;
- public documentation and installed API behavior of `delaunator`, `@kninnug/constrainautor`, and `poly2tri`;
- standard computational geometry algorithms for triangulation, constraint recovery, edge flips, and point-in-polygon checks;
- repository DTO, operation, quality metric, and Editor preview/apply contracts.

Disallowed basis:

- v6A triangulation implementation;
- v6A row-major interior point generation as the primary point placement strategy;
- v6B/v6C as final user-facing choices;
- V1-V5 mesh-generation algorithms as algorithmic source;
- tests that encode old geometry as the desired shape.

If a helper mixes salvageable contour logic with discarded triangulation logic, split or copy only the contour-facing behavior into a shared v6 contour module. Do not keep a broad dependency on the old v6A local triangulator.

## 14. Open Questions

- Should v6D/v6E/v6F share one new `v6-contour-pipeline` module, or should the first wave duplicate narrowly and refactor after visual proof?
- Should the improved interior sampler start with deterministic farthest-point sampling only, or include offset-ring bands in the first pass?
- Should holes be blocked/fallback in v0, or should v6E attempt `poly2tri` holes immediately?
- Should v6F start with custom Bowyer-Watson + constraint recovery or an advancing-front approach?
- What exact visual fixture should be used to compare the user's observed hair/eye failure case in automated or semi-automated review?
