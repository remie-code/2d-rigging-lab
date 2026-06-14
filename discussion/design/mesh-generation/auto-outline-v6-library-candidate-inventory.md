# auto-outline-v6 Library Candidate Inventory

> Status: research inventory / sidecar dependency candidates.
> Date: 2026-06-14.
> Basis: `auto-outline-v6-alpha-constrained-delaunay.md`.
> Method boundary: Existing local mesh-generation implementations are not algorithm basis for this inventory.

## 1. Summary

No single browser-ready library appears to implement the whole v6 pipeline:

```text
alpha mask -> adaptive contour -> adaptive sampling -> boundary-preserving triangulation -> quality/fallback metadata
```

The practical path is a composed pipeline with library help for individual stages and custom project code for v6 policy, determinism, cleanup, fallback, and metadata.

Recommended first spike:

```text
custom alpha/mask preprocessing
-> d3-contour for contour extraction
-> simplify-js plus custom adaptive resampling
-> custom distance/gradient fields
-> either:
   A. delaunator + @kninnug/constrainautor, or
   B. poly2tri
-> custom cleanup, metrics, stable IDs, fallback metadata
```

## 2. Candidate Matrix

| Candidate | Stage | Fit | Main Risk |
|---|---|---|---|
| `d3-contour` | Contour extraction | Good lightweight marching-squares option. Official repo says it computes contour polygons using marching squares. License: ISC. | Produces general contour polygons, not v6-specific topology policy. Ring selection and alpha cleanup remain custom. |
| `simplify-js` | Contour simplification | Good baseline polyline simplification. Official repo describes high-performance JS simplification. License: BSD-2-Clause. | Plain simplification can remove useful tips/curvature; v6 adaptive retention remains custom. |
| `poisson-disk-sampling` | Interior point candidates | Good sampling primitive. Supports custom RNG and density function. License: MIT. | CJS / older package; deterministic seed and mask rejection must be tested. |
| `poly2tri` | Constrained triangulation | Strong algorithm fit for simple polygon + holes + Steiner points. Package declares bundled types and BSD-3-Clause. | Older/CJS. Requires simple sanitized contours; touching holes, duplicate points, and self-intersections need preflight. |
| `delaunator` | Base Delaunay | Strong maintenance fit. Official repo describes fast robust JS Delaunay; ISC; latest release visible in 2026. | No boundary constraints by itself. Must not be called CDT unless paired with robust constraint recovery. |
| `@kninnug/constrainautor` | Constraint recovery over Delaunator | ESM/CJS, TypeScript source, ISC. Official README says it adds constraints to Delaunator output. | It is constrained but not necessarily conforming. README warns duplicate points, intersecting edges, holes, and invalid inputs may throw or produce bogus results. |
| `earcut` | Polygon triangulation fallback | Very small and browser-oriented. Official repo supports holes and is ISC. | Ear clipping, not CDT. It prioritizes speed/simplicity over triangulation quality. Use as fallback only. |
| OpenCV.js | Mask processing / contours | Powerful for blur, threshold, morphology, contours, approximation, distance transform. | Heavy WASM/heap/runtime loading. Still does not solve v6 triangulation or deterministic policy. |
| `cdt2d` | PSLG constrained Delaunay | Flexible raw PSLG CDT, MIT. | Old, CommonJS, no releases, README marks work in progress and requires strict input cleanup. |
| Triangle / Triangle-WASM | High-quality CDT/mesh | Strong geometry capability. Official Triangle page says it can generate Delaunay, constrained Delaunay, conforming Delaunay, Voronoi, and high-quality triangular meshes. | Official page also says Triangle may not be sold or included in commercial products without a license. Avoid as dependency. |
| `libtess.js` | Polygon tessellation fallback | Can triangulate polygons with holes in JS. | Old, non-CDT, uncommon SGI license. Not a v6 main path. |
| MarchingSquaresJS / Potrace JS ports | Contour/vectorization | Could help contours. | GPL/AGPL or dual-license risk appears common. Avoid unless explicitly reviewed. |

## 3. Recommended Spike Order

1. Try `d3-contour` for contour extraction and keep alpha cleanup custom.
2. Try `simplify-js` only as a baseline, then layer v6 tip/curvature/max-edge retention on top.
3. Compare two triangulation paths:
   - `delaunator` + `@kninnug/constrainautor` for ESM/type/maintenance fit.
   - `poly2tri` for direct constrained polygon + holes + Steiner support.
4. Keep `earcut` as fallback if both constrained approaches fail a fixture.
5. Avoid OpenCV.js and Triangle/WASM in v0 unless a separate dependency gate approves their cost/risk.

## 4. Required Due Diligence Before Adding Dependencies

- Confirm package and repository license files, not only registry metadata.
- Check transitive dependencies, WASM/native assets, and postinstall scripts through lockfile diff.
- Verify ESM/Vite/browser import behavior in this workspace.
- Run dependency guard checks after adding any package.
- Verify deterministic output for repeated identical RGBA/preset/seed inputs.
- Verify all boundary constraint edges survive triangulation before labeling output as constrained.
- Test duplicate/near-duplicate points, collinear spans, thin tips, touching holes, multiple islands, and tiny components.
- Surface fallback metadata when a constrained path fails, rather than silently returning an unconstrained mesh.

## 5. Current Recommendation

Use a small dependency spike, not a direct production dependency commitment.

Most promising first spike:

```text
d3-contour + simplify-js + delaunator + @kninnug/constrainautor
```

Parallel comparison candidate:

```text
d3-contour + simplify-js + poly2tri
```

The decision should be made by fixture evidence, especially whether boundary edges survive, whether triangle quality is acceptable for hair-like thin shapes, and whether repeated generation is deterministic.

Variant specs:

- `auto-outline-v6b-constrainautor.md` documents the `delaunator + @kninnug/constrainautor` comparison backend.
- `auto-outline-v6c-poly2tri.md` documents the `poly2tri` comparison backend.

## 6. Source Pointers

- `d3-contour`: https://github.com/d3/d3-contour
- `simplify-js`: https://github.com/mourner/simplify-js
- `poisson-disk-sampling`: https://github.com/kchapelier/poisson-disk-sampling
- `poly2tri`: https://github.com/r3mi/poly2tri.js
- `delaunator`: https://github.com/mapbox/delaunator
- `@kninnug/constrainautor`: https://github.com/kninnug/constrainautor
- `earcut`: https://github.com/mapbox/earcut
- `cdt2d`: https://github.com/mikolalysenko/cdt2d
- Triangle: https://www.cs.cmu.edu/~quake/triangle.html
- `libtess.js`: https://github.com/brendankenny/libtess.js
