# auto-outline-v6c Poly2Tri Backend

> Draft backend spec / temporary comparison sidecar.
> This document defines the v6c triangulation backend for `auto-outline-v6`. It is not a long-term user-facing algorithm choice; it exists so the user can compare generated meshes in the Editor before selecting one final implementation.

## 1. Position

`auto-outline-v6c` is the library-backed v6 variant that uses `poly2tri` for constrained polygon triangulation.

The shared v6 pipeline remains:

```text
soft alpha mask
-> contour extraction
-> adaptive contour simplification
-> adaptive interior sampling
-> v6c triangulation backend
-> deterministic cleanup and quality summary
```

Proposed method id:

```text
auto-outline-v6c-poly2tri
```

Proposed source id:

```text
outline-v6c-poly2tri-rgba
```

## 2. Temporary Editor Selector

During comparison only, the Editor may expose an experimental mesh algorithm selector with:

- `auto-outline-v6a-local`
- `auto-outline-v6b-constrainautor`
- `auto-outline-v6c-poly2tri`

This selector is temporary. It should be easy to remove after the final backend is chosen.

Normal mesh presets remain separate:

- `Large Motion`
- `Standard`
- `Low Motion`

The selector changes the algorithm backend, not the semantic preset. It must not imply that end users should choose triangulation libraries as a product feature.

## 3. Design Boundary

Gnome must not use existing local mesh-generation algorithms as v6c algorithm reference.

Allowed basis:

- `auto-outline-v6-alpha-constrained-delaunay.md`
- this v6c backend document
- `auto-outline-v6-library-candidate-inventory.md`
- public API docs for `poly2tri`
- repository DTO / operation / Editor preview contracts

Disallowed basis:

- old local mesh generation helpers, constants, sampling strategies, or triangulation code
- old algorithm-specific geometry tests as expected shape

## 4. Backend Goal

The goal of v6c is to test whether a direct constrained polygon triangulation library fits v6 better than a Delaunay-plus-constraint-recovery path.

Expected strengths:

- `poly2tri` directly models an outer contour, holes, and Steiner points.
- Adaptive interior samples can be passed as Steiner points.
- Boundary constraints are part of the library's intended input model.

Expected risks:

- The package is older and may be CommonJS-oriented.
- Input validation is mostly the caller's responsibility.
- The library expects simple polygons.
- Holes must not touch the outer contour or each other.
- Duplicate, collinear, or self-intersecting contour data can fail.

## 5. Inputs To The Backend

The shared v6 pipeline passes:

- outer contour loop as ordered points;
- optional hole loops as ordered points;
- interior sample points as Steiner points;
- deterministic point order;
- backend options derived from preset.

Backend-specific preconditions:

- one valid simple outer polygon per run;
- optional holes strictly inside the outer polygon;
- no touching or intersecting holes;
- no duplicate or near-duplicate points after quantization;
- no self-intersections;
- consistent winding;
- deterministic input ordering.

For multiple islands, v6c should run per island and merge results with deterministic index offsets. If that is not implemented in v0, it must report main-island-only limitation.

## 6. Algorithm Steps

1. Quantize contour and interior points to stable precision.
2. Deduplicate contour points.
3. Remove zero-length edges.
4. Normalize winding for outer loop and holes.
5. Validate simple polygon constraints.
6. Create a `poly2tri` sweep context from the outer contour.
7. Add holes when valid and supported by the current v0 scope.
8. Add adaptive interior samples as Steiner points.
9. Run triangulation.
10. Convert library triangles back to deterministic mesh vertex indices.
11. Verify triangle coverage and boundary edge preservation.
12. Return triangles to shared v6 cleanup.

If `poly2tri` throws or returns invalid geometry, do not hide it as success.

## 7. Quality And Diagnostics

V6c should add backend-specific metrics:

- `backendId: "v6c-poly2tri"`.
- `outerPointCount`.
- `holeCount`.
- `steinerPointCount`.
- `polygonValidationFailed`.
- `holeValidationFailed`.
- `triangulationThrown`.
- `boundaryEdgePreservedCount`.
- `boundaryEdgeMissingCount`.
- `mainIslandOnlyFallback`.

Shared metrics from v6 still apply:

- vertex count.
- triangle count.
- boundary vertex count.
- interior vertex count.
- minimum angle.
- minimum triangle area.
- maximum edge length.
- fallback steps.

## 8. Fallback Policy

V6c is allowed to fail as an experimental backend.

Failure cases:

- dependency import failure;
- invalid simple polygon;
- unsupported touching holes;
- thrown triangulation error;
- invalid triangle references after conversion;
- missing boundary edges;
- degenerate triangle set after filtering.

Fallback behavior:

1. Retry v6c with coarser boundary sampling.
2. Retry v6c without holes if hole validation caused failure, and mark the limitation.
3. Retry v6c with fewer Steiner points if interior samples caused failure.
4. Fallback to v6a local safe mesh or a simple alpha-bounds-safe fallback.
5. Mark the result as fallback, not as v6c success.

The Editor comparison UI must show when v6c fell back.

## 9. Acceptance Criteria

V6c is acceptable for comparison when:

- It is selectable as a temporary experimental backend.
- It does not change the default mesh backend by itself.
- It produces deterministic output for identical input.
- It handles simple outer polygon + Steiner points.
- It either handles holes or reports a clear limitation.
- It exposes backend diagnostics.
- It fails visibly when polygon validation or triangulation fails.
- It does not use old local mesh-generation implementations as algorithm reference.

## 10. Test Fixtures

Minimum fixture set:

- opaque rectangle;
- curved blob;
- thin tapered shape;
- shape with a small transparent hole;
- shape with a hole touching or nearly touching the outer contour;
- shape with near-duplicate contour points after thresholding;
- multiple-island input.

Each fixture should assert:

- deterministic output over repeated runs;
- valid mesh DTO cardinality;
- no invalid triangle indices;
- no duplicate triangle vertices;
- boundary edge preservation;
- visible fallback metadata when polygon constraints are not met.

## 11. Decision Use

V6c should be judged against v6a and v6b by:

- visual quality on the same drawable/preset;
- boundary preservation;
- editability of triangle size and distribution;
- hole behavior;
- deterministic behavior;
- dependency and CJS/ESM integration risk;
- failure clarity.

If v6c wins, promote one final method and remove the temporary algorithm selector.
