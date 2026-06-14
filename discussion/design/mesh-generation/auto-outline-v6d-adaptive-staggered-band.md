# auto-outline-v6D Adaptive Staggered Band

> Draft algorithm spec / next v6D-lineage mainline candidate.
> This document records the post-Wave70 tuning decision: keep the Wave70 v6D support-ring result as the strongest baseline, add size-adaptive density, and replace the alpha-to-inner boundary layer with an explicit staggered triangle band.

## 1. Position

Wave70 implemented:

```text
method id: auto-outline-v6d-contour-band-support-rings
source id: outline-v6d-contour-band-support-rings-rgba
implementation file: packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts
```

That result is currently the strongest mesh generation output.

This document defines the next v6D-lineage candidate:

```text
method id: auto-outline-v6d-adaptive-staggered-band
source id: outline-v6d-adaptive-staggered-band-rgba
implementation file: packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts
```

The new version should be added as a new file and new method/source id. The Wave70 method remains available as a recovery/comparison baseline.

## 2. Accepted User Decisions

Accepted direction:

- Keep the v6D soft alpha contour extraction and constrained triangulation lineage.
- Do not reopen 6A/6B/6C exploration.
- Do not restore the Editor algorithm selector UI.
- Product-facing presets remain the visible control dimension.
- Use the currently tuned `high` / `medium` / `low` values as the baseline values for each preset.
- Make density adapt to part size rather than using one fixed value for every drawable.
- Improve the boundary band by explicitly generating the alpha-to-inner strip.
- Add this as a new algorithm file and then switch the default route to the new method.

## 3. Baseline Density Values

The current tuned density table is the baseline for the reference-sized part used during visual tuning.

Reference observation from `tmp/console.log` on 2026-06-15:

```text
drawableName: headwear
densityHint: medium
alphaBounds: 400 x 288
softMaskOpaquePixelCount: 73936
selectedComponentPixelCount: 73936
boundaryPointCount: 99
steinerPointCount: 32
```

The user also tuned `high` and `low` to values that feel intuitive for the same practical baseline. Treat the current code values as the preset baselines:

```text
high / Large Motion:
  boundarySpacing: 10
  interiorSpacing: 7.5
  maxBoundaryVertices: 96
  maxInteriorVertices: 64
  interiorBoundaryClearance: 1.1

medium / Normal:
  boundarySpacing: 15
  interiorSpacing: 10
  maxBoundaryVertices: 96
  maxInteriorVertices: 32
  interiorBoundaryClearance: 1.1

low / Small Motion:
  boundarySpacing: 30
  interiorSpacing: 15
  maxBoundaryVertices: 64
  maxInteriorVertices: 16
  interiorBoundaryClearance: 1.5
```

These values are not universal constants. They are the baseline values at the reference part size.

## 4. Size-Adaptive Density

Current issue:

- Small parts can still look too dense when the same preset constants are used.
- Large parts can need more interior support points than the same fixed cap allows.
- The preset should keep its meaning, but the resolved parameters should respond to actual drawable size.

Primary size signal:

```text
effectiveArea = selectedComponentPixelCount
referenceArea = 73936
areaRatio = effectiveArea / referenceArea
linearRatio = sqrt(areaRatio)
```

Fallback if component area is unavailable:

```text
effectiveArea = alphaBounds.width * alphaBounds.height
referenceArea = 400 * 288
```

Recommended first implementation:

```text
clampedAreaRatio = clamp(areaRatio, 0.2, 4.0)

spacingScale = clamp((1 / sqrt(clampedAreaRatio)) ^ 0.35, 0.82, 1.25)
vertexScale = clamp(clampedAreaRatio ^ 0.75, 0.45, 2.5)
boundaryCapScale = clamp(sqrt(clampedAreaRatio), 0.7, 1.6)

resolved.boundarySpacing = base.boundarySpacing * spacingScale
resolved.interiorSpacing = base.interiorSpacing * spacingScale
resolved.maxBoundaryVertices = round(base.maxBoundaryVertices * boundaryCapScale)
resolved.maxInteriorVertices = round(base.maxInteriorVertices * vertexScale)
resolved.interiorBoundaryClearance = base.interiorBoundaryClearance
```

Rationale:

- `maxInteriorVertices` should move the most because it directly controls broad interior support.
- `interiorSpacing` and `boundarySpacing` should move mildly because aggressive spacing changes can make the mesh visually jump between nearby part sizes.
- Smaller parts get slightly larger spacing and lower vertex caps.
- Larger parts get slightly smaller spacing and higher vertex caps.
- No semantic part name, drawable name, or image recognition should be used.

The implementation should clamp resolved values to defensible preset-specific ranges. Exact range choices may be tuned by tests and visual checks, but monotonic behavior is required:

```text
same preset + larger effectiveArea
  -> maxInteriorVertices must not decrease
  -> maxBoundaryVertices must not decrease

same preset + smaller effectiveArea
  -> maxInteriorVertices should decrease unless already at minimum
```

## 5. Contour Extraction To Keep

Keep the Wave70 v6D contour foundation:

```text
RGBA alpha
-> soft alpha mask
-> main component selection
-> boundary loop trace
-> outer loop selection
-> arclength alpha boundary sampling
-> constrained triangulation support
```

The soft mask and boundary sampling are considered good. The next version should not replace them with the older v6A ear-clipping / spoke-fan behavior.

## 6. Staggered Inner Ring

The Wave70 support-ring implementation places an inner support ring near the alpha boundary. However, increasing `innerOffset` did not visibly widen the band enough, because Delaunay can still choose boundary-to-interior connectivity.

The next version should construct a staggered inner ring from alpha boundary edges, not alpha boundary vertices.

Given:

```text
A[0..n-1] = sampled alpha boundary points
```

For each alpha edge:

```text
E[i] = A[i] -> A[(i + 1) mod n]
M[i] = midpoint(A[i], A[i+1])
tangent[i] = normalize(A[i+1] - A[i])
inwardNormal[i] = the normal candidate that points into the alpha mask
I[i] = M[i] + inwardNormal[i] * innerOffset
```

Important user mental model:

```text
A[i] -------- A[i+1]
        I[i]
```

`I[i]` is centered under the alpha edge. It is not directly inward from `A[i]`.

## 7. Explicit Alpha-To-Inner Strip

The alpha-to-inner band should be emitted as explicit triangles.

For each edge `A[i] -> A[i+1]`:

```text
edge triangle:
  A[i], A[i+1], I[i]

join triangle:
  A[i+1], I[i+1], I[i]
```

This creates:

```text
A[i] -------- A[i+1] -------- A[i+2]
       I[i]          I[i+1]
```

The visible boundary band width becomes controlled by the alpha-edge midpoint to `I[i]` distance, rather than whichever first interior edge Delaunay chooses.

Required rule:

```text
No final triangle should directly connect alpha boundary vertices to ordinary interior Steiner points where the explicit strip is active.
```

Alpha boundary vertices may connect to:

- neighboring alpha boundary vertices;
- staggered inner strip vertices;
- outer support vertices when the outer-alpha band is active.

## 8. Interior Fill

After the explicit strip:

```text
1. Build outer support ring and alpha boundary ring as Wave70 does.
2. Build staggered inner ring from alpha edge midpoints.
3. Emit the explicit alpha-to-inner strip triangles.
4. Use the staggered inner ring as the boundary for interior fill.
5. Filter ordinary interior points to the inside of the staggered inner polygon.
6. Run Delaunay / Constrainautor for inner ring + ordinary interior points.
7. Merge explicit strip triangles and interior-fill triangles.
8. Verify there are no direct alpha-to-ordinary-interior edges in active strip regions.
```

If the first interior fill layer still converges too much toward sparse points after this change, a later version may add a second inner support ring. Do not add that second ring until the explicit staggered strip has been visually checked.

## 9. Fallback Policy

Wave70 visual debugging found a failure class where all inner support-ring points were skipped, causing coarse fallback output.

The next version must not treat "inner ring skipped" as an immediate reason to use the coarse fallback if a better v6D-lineage fallback is available.

Preferred fallback order:

```text
1. Try adaptive staggered band.
2. If local staggered inner points fail, use reduced offset or locally omit strip triangles.
3. If the staggered strip is globally invalid, fall back to Wave70 support-ring v6D.
4. If Wave70 support-ring v6D is also invalid, fall back to the existing structured fallback path.
5. Return blocked only for true no-alpha / extraction failure cases.
```

Diagnostics should distinguish:

- successful adaptive staggered output;
- adaptive output with local strip omissions;
- fallback to Wave70 support-ring v6D;
- coarse fallback output;
- blocked output.

## 10. Diagnostics

Add diagnostics beyond Wave70:

- `adaptiveDensityReferenceArea`
- `adaptiveDensityEffectiveArea`
- `adaptiveDensityAreaRatio`
- `adaptiveDensitySpacingScale`
- `adaptiveDensityVertexScale`
- resolved `boundarySpacing`
- resolved `interiorSpacing`
- resolved `maxBoundaryVertices`
- resolved `maxInteriorVertices`
- `staggeredInnerPointCount`
- `skippedStaggeredInnerPointCount`
- `explicitAlphaInnerStripTriangleCount`
- `degenerateExplicitStripTriangleCount`
- `interiorPointCountBeforeInnerFilter`
- `interiorPointCountAfterInnerFilter`
- `directAlphaToInteriorEdgeCount`
- `fallbackFromAdaptiveStaggeredReason`

Key success diagnostic:

```text
directAlphaToInteriorEdgeCount == 0
```

for active explicit strip regions.

## 11. Acceptance Criteria

The algorithm is acceptable when:

- current `high` / `medium` / `low` tuned values are captured as the reference baseline;
- resolved density changes monotonically with part size;
- medium reference-sized headwear-like input resolves close to the tuned baseline values;
- small parts receive fewer interior points than the same preset baseline;
- larger parts can receive more interior points than the same preset baseline;
- the staggered inner ring is edge-midpoint based, not alpha-vertex aligned;
- alpha-to-inner band triangles are emitted explicitly;
- ordinary Delaunay interior fill uses the staggered inner ring as its boundary;
- active strip regions have no direct alpha-to-ordinary-interior edges;
- inner strip failure falls back to Wave70 support-ring v6D before coarse fallback;
- UVs remain deterministic and valid;
- old Wave70 v6D support-ring method remains available;
- Editor default generation can switch to this method without exposing algorithm choices to users.

## 12. Non-Goals

- Reopening 6A/6B/6C or library backend exploration.
- Restoring the temporary algorithm selector UI.
- Pixel-perfect reproduction of another editor.
- Cubism compatibility.
- Texture padding, dilation, or renderer filtering changes.
- Manual mesh editing.
- Semantic auto-selection from part names, drawable names, or image content.
- Per-part hard-coded density tables.
- Full robust offset-curve geometry for every pathological silhouette in the first implementation.

## 13. Open Questions

- Exact clamp ranges for adaptive density should be confirmed by focused tests and visual checks.
- Whether `boundarySpacing` should adapt as strongly as `maxInteriorVertices` may need tuning after the first implementation.
- A second inner support ring may be useful, but should wait until the explicit staggered strip has been evaluated.
- If all staggered inner points are skipped on thin hair, the implementation should report whether it used local omission or Wave70 fallback.
