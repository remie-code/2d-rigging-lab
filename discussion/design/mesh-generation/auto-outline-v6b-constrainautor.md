# auto-outline-v6b Delaunator + Constrainautor Backend

> Draft backend spec / temporary comparison sidecar.
> This document defines the v6b triangulation backend for `auto-outline-v6`. It is not a long-term user-facing algorithm choice; it exists so the user can compare generated meshes in the Editor before selecting one final implementation.

## 1. Position

`auto-outline-v6b` is the library-backed v6 variant that uses:

```text
delaunator
-> @kninnug/constrainautor
```

The shared v6 pipeline remains:

```text
soft alpha mask
-> contour extraction
-> adaptive contour simplification
-> adaptive interior sampling
-> v6b triangulation backend
-> deterministic cleanup and quality summary
```

Proposed method id:

```text
auto-outline-v6b-constrainautor
```

Proposed source id:

```text
outline-v6b-constrainautor-rgba
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

Gnome must not use existing local mesh-generation algorithms as v6b algorithm reference.

Allowed basis:

- `auto-outline-v6-alpha-constrained-delaunay.md`
- this v6b backend document
- `auto-outline-v6-library-candidate-inventory.md`
- public API docs for `delaunator` and `@kninnug/constrainautor`
- repository DTO / operation / Editor preview contracts

Disallowed basis:

- old local mesh generation helpers, constants, sampling strategies, or triangulation code
- old algorithm-specific geometry tests as expected shape

## 4. Backend Goal

The goal of v6b is to test whether a modern JavaScript/TypeScript-friendly Delaunay + constraint-recovery path can produce acceptable v6 meshes with lower integration risk than older CDT libraries.

Expected strengths:

- ESM/browser compatibility is more plausible than older CJS geometry packages.
- `delaunator` is fast and actively maintained.
- `@kninnug/constrainautor` can recover constraint edges over a Delaunator triangulation.

Expected risks:

- This path is constrained, but not necessarily conforming.
- Invalid inputs can throw or produce unusable output.
- Boundary edges may fail to survive if contours are duplicated, intersecting, or poorly sanitized.
- Hole and multi-island handling may require custom orchestration or fallback.

## 5. Inputs To The Backend

The shared v6 pipeline passes:

- normalized point list;
- boundary point indices;
- boundary constraint edges;
- optional hole loops if supported by the chosen orchestration;
- interior sample point indices;
- deterministic point order;
- backend options derived from preset.

Backend-specific preconditions:

- no duplicate or near-duplicate points after quantization;
- no zero-length constraint edges;
- no crossing constraint edges;
- no self-intersecting contour loops;
- no holes touching outer boundary;
- deterministic input ordering.

If these preconditions are not met, v6b should return a structured backend failure and let the v6 fallback policy decide the next step.

## 6. Algorithm Steps

1. Quantize points to a stable precision.
2. Deduplicate points and remap all constraint edges.
3. Validate every boundary edge.
4. Sort points deterministically.
5. Run `delaunator` over all boundary and interior points.
6. Apply `@kninnug/constrainautor` to insert or recover boundary constraints.
7. Verify every required boundary edge exists in the final triangulation.
8. Remove triangles outside accepted contours or holes.
9. Compute backend diagnostics.
10. Return triangles to shared v6 cleanup.

If step 7 fails, do not label the output as boundary-preserving success.

## 7. Quality And Diagnostics

V6b should add backend-specific metrics:

- `backendId: "v6b-constrainautor"`.
- `constraintEdgeCount`.
- `preservedConstraintEdgeCount`.
- `missingConstraintEdgeCount`.
- `constraintRecoveryFailed`.
- `outsideTriangleCount`.
- `holeTriangleCount` if holes are checked.
- `thrownErrorKind` when applicable.

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

V6b is allowed to fail as an experimental backend.

Failure cases:

- dependency import failure;
- invalid or unsanitizable constraints;
- thrown backend error;
- missing constraint edges after recovery;
- too many outside or crossing triangles;
- degenerate triangle set after filtering.

Fallback behavior:

1. Retry v6b with coarser boundary sampling.
2. Retry v6b with fewer interior points.
3. Fallback to v6a local safe mesh or a simple alpha-bounds-safe fallback.
4. Mark the result as fallback, not as v6b success.

The Editor comparison UI must show when v6b fell back.

## 9. Acceptance Criteria

V6b is acceptable for comparison when:

- It is selectable as a temporary experimental backend.
- It does not change the default mesh backend by itself.
- It produces deterministic output for identical input.
- It preserves all required boundary constraint edges on simple and curved fixtures.
- It exposes backend diagnostics.
- It fails visibly when constraints are not preserved.
- It does not use old local mesh-generation implementations as algorithm reference.

## 10. Test Fixtures

Minimum fixture set:

- opaque rectangle;
- curved blob;
- thin tapered shape;
- shape with a small transparent hole;
- shape with near-collinear contour spans;
- shape with near-duplicate contour points after thresholding;
- main-island-only fallback case.

Each fixture should assert:

- deterministic output over repeated runs;
- valid mesh DTO cardinality;
- no invalid triangle indices;
- no duplicate triangle vertices;
- boundary constraint preservation count;
- fallback metadata if preservation fails.

## 11. Decision Use

V6b should be judged against v6a and v6c by:

- visual quality on the same drawable/preset;
- boundary preservation;
- editability of triangle size and distribution;
- deterministic behavior;
- dependency and bundle risk;
- failure clarity.

If v6b wins, promote one final method and remove the temporary algorithm selector.
