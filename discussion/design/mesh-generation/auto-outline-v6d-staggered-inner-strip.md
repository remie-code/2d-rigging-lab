# auto-outline-v6D Staggered Inner Strip

> Draft algorithm spec / next Wave70 refinement candidate.
> This document records the post-Wave70 visual tuning direction: keep the improved v6D support-ring mesh as the mainline, but replace the alpha-to-inner-ring region from Delaunay-driven connectivity with an explicit staggered triangle strip.

## 1. Position

Wave70 implemented:

```text
auto-outline-v6d-contour-band-support-rings
```

That result is currently the strongest mesh-generation output.

The remaining visible issue is not the outer silhouette. The issue is the first interior layer:

- the alpha boundary is well preserved;
- the outer support ring is useful;
- the visible inner band is too narrow or does not visibly widen when `innerOffset` is increased;
- triangles one layer inside the boundary can still converge toward sparse interior points.

This document proposes the next refinement:

```text
alpha boundary -> staggered inner ring
```

should be generated as an explicit triangle strip, not left to Delaunay / Constrainautor edge choice.

## 2. User Mental Model

The user specifically does not want this aligned-quad mental model:

```text
A[i] -------- A[i+1]
 |  diagonal     |
I[i] -------- I[i+1]
```

where each `inner[i]` is directly inward from `alpha[i]`.

The intended shape is staggered:

```text
A[i] -------- A[i+1]
        I[i]
```

`inner[i]` should be placed around the midpoint of the alpha edge from `alpha[i]` to `alpha[i+1]`, shifted half a boundary segment along the tangent phase, then moved inward.

Interpretation used by this spec:

```text
edge midpoint along tangent:
  M[i] = midpoint(A[i], A[i+1])

inward displacement:
  I[i] = M[i] + inwardNormal(edge i) * innerOffset
```

In other words, the inner ring is phase-shifted by half an alpha-boundary segment. It is not index-aligned with alpha vertices.

## 3. Current Problem

The current Wave70 implementation creates:

```text
outer support points
alpha boundary points
inner support points
interior points
```

and then lets Delaunay / Constrainautor produce triangles, with constraints added for rings and bridges.

This has two limitations:

1. `innerOffset` is only a desired candidate distance.
   It may be reduced, skipped, merged, or made ineffective by safe-point logic.
2. Even when inner ring points exist, Delaunay may still connect alpha boundary vertices toward nearby or sparse interior points.

That means increasing `innerOffset` does not necessarily create a wider visible inner band.

## 4. Proposed Ring Construction

Input:

```text
A[0..n-1] = sampled alpha boundary ring
```

For each alpha edge:

```text
E[i] = A[i] -> A[(i + 1) mod n]
```

compute:

```text
tangent[i] = normalize(A[i+1] - A[i])
midpoint[i] = (A[i] + A[i+1]) / 2
normal candidates = rotate(tangent[i]) left/right
inwardNormal[i] = candidate that points into alpha mask
I[i] = midpoint[i] + inwardNormal[i] * innerOffset
```

If `I[i]` is outside the alpha mask:

1. try smaller offsets, for example `0.75`, `0.5`, `0.25`;
2. optionally project to the nearest valid alpha-mask point along the same normal ray;
3. if no valid point exists, mark that edge as skipped.

Unlike Wave70's first support-ring pass, `I[i]` is associated with alpha edge `E[i]`, not alpha vertex `A[i]`.

## 5. Explicit Alpha-To-Inner Strip

For a closed ring, define:

```text
prevInner(i) = I[(i - 1 + n) mod n]
nextAlpha(i) = A[(i + 1) mod n]
nextInner(i) = I[(i + 1) mod n]
```

For each alpha edge `A[i] -> A[i+1]`, create two triangles:

```text
edge triangle:
  A[i], A[i+1], I[i]

join triangle:
  A[i+1], I[i+1], I[i]
```

Equivalent per-vertex view:

```text
A[i], I[i], I[i-1]
```

fills the wedge around each alpha vertex.

The result is a complete triangle strip between the alpha boundary ring and the staggered inner ring:

```text
A[i] -------- A[i+1] -------- A[i+2]
       I[i]          I[i+1]
```

This strip should be emitted directly into the final mesh. Delaunay should not be responsible for deciding these triangles.

## 6. Why This Should Widen The Visible Band

The visible band width becomes approximately:

```text
distance from alpha edge midpoint to I[i]
```

rather than whichever edge Delaunay happens to choose.

This makes `innerOffset` much closer to a real visual control.

It also avoids the common failure shape:

```text
alpha boundary -> nearby/far interior Steiner point
```

because alpha-to-inner triangles are already fixed before interior triangulation.

## 7. Interior Fill After The Strip

After emitting the explicit strip, the remaining interior should be triangulated inside the staggered inner ring.

Recommended sequence:

```text
1. Build outer support / alpha boundary as Wave70 already does.
2. Build staggered inner ring I[i] from alpha edge midpoints.
3. Emit explicit alpha-to-inner strip triangles.
4. Remove alpha-boundary vertices from the Delaunay interior-fill boundary.
5. Use the staggered inner ring as the outer boundary for interior fill.
6. Keep only interior points inside the staggered inner polygon.
7. Run Delaunay / Constrainautor for inner polygon + interior points.
8. Merge explicit strip triangles and interior-fill triangles.
```

Key rule:

```text
No final triangle should directly connect alpha boundary vertices to ordinary interior points.
```

Alpha boundary vertices may connect to:

- neighboring alpha boundary vertices;
- staggered inner strip vertices;
- outer support vertices if an outer-alpha strip is also explicit.

## 8. Interior Density

The current interior density is controlled by the shared v6 contour pipeline:

```text
high:
  interiorSpacing = 3
  maxInteriorVertices = 64

medium:
  interiorSpacing = 5
  maxInteriorVertices = 32

low:
  interiorSpacing = 7
  maxInteriorVertices = 16
```

Increasing density can help the broad interior, but it is not the first fix for the boundary convergence issue.

The recommended order is:

1. make the alpha-to-inner strip explicit;
2. restrict Delaunay interior fill to inside the staggered inner ring;
3. then tune `interiorSpacing` and `maxInteriorVertices`.

If the next layer inside the strip still collapses toward sparse points, add a second support ring:

```text
alpha boundary
-> staggered inner ring 1
-> support ring 2
-> Delaunay interior fill
```

The second support ring can be generated from the edges of inner ring 1, using the same staggered midpoint idea, or it can be a lower-density ring sampled from an inward offset of inner ring 1.

## 9. Density Tuning Candidates

If explicit strip is not enough, try:

```text
high:
  interiorSpacing: 2
  maxInteriorVertices: 96

medium:
  interiorSpacing: 3.5
  maxInteriorVertices: 48

low:
  interiorSpacing: 5
  maxInteriorVertices: 24
```

But this should happen after the explicit strip, because simply adding more Delaunay points can still produce visually awkward alpha-to-interior connections unless alpha-to-inner triangles are fixed first.

## 10. Triangle Validity And Fallback

The explicit strip must guard against bad geometry:

- skipped inner points;
- duplicate inner points;
- self-intersecting inner ring;
- degenerate strip triangles;
- triangles that cross the alpha ring or inner ring;
- invalid winding.

For v0 implementation, acceptable fallback policy:

```text
if too many staggered inner points are invalid:
  fall back to Wave70 support-ring behavior

if only a local segment is invalid:
  locally use a reduced offset or omit that segment's strip triangles
```

The implementation should prefer visible, diagnosed fallback over returning misleading success.

## 11. Diagnostics

Add diagnostics beyond Wave70:

- staggered inner point count;
- skipped staggered inner point count;
- average / min / max alpha-edge-midpoint-to-inner distance;
- explicit alpha-inner strip triangle count;
- degenerate explicit strip triangle count;
- direct alpha-to-interior edge count after final mesh merge;
- interior point count before / after inner-polygon filtering;
- whether interior fill uses inner ring as boundary;
- whether a second support ring was used.

The key success diagnostic:

```text
direct alpha-to-interior edge count == 0
```

for the region where explicit alpha-to-inner strip is active.

## 12. Acceptance Criteria

This refinement is acceptable when:

- inner ring vertices are staggered between alpha vertices;
- alpha-to-inner strip triangles are emitted explicitly;
- Delaunay does not choose the first boundary-to-interior layer;
- normal mesh generation still uses the v6D mainline method;
- old Wave70 v6D support-ring behavior can be compared or recovered if needed;
- the visible inner band is wider and more regular on the user's hair/eye-corner examples;
- fallback metadata clearly reports invalid staggered strip geometry;
- UVs remain valid and deterministic;
- no renderer / texture filtering / padding work is included.

## 13. Non-Goals

- Reopening backend algorithm selection UI.
- Pixel-perfect reproduction of another editor.
- Cubism compatibility.
- Texture padding or renderer changes.
- Manual mesh editing.
- Full robust offset-curve geometry for every pathological silhouette in the first implementation.

## 14. Open Questions

- Should this refinement keep the existing method id `auto-outline-v6d-contour-band-support-rings`, or should it use a new internal/source id for easier comparison during tuning?
- Should the outer-alpha band also become an explicit staggered strip, or only alpha-inner for the next wave?
- Should a second inner support ring be included immediately, or only after observing the explicit alpha-inner strip?
- Should interior density tuning happen in the same wave or remain a follow-up after the strip geometry is visually checked?
