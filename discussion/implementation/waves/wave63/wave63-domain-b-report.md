# Wave63 Domain B Report: Mesh auto-outline-v2 Algorithm Foundation

## Status

- Verdict: `pass`
- Domain: `wave63-mesh-auto-outline-v2-algorithm-foundation`
- Implementation owner: Gnome
- Scope: headless mesh generation foundation, operation routing, and minimal Mesh Tool preview/summary integration.
- Triangulation note: `auto-outline-v2` uses an interim ordinary Delaunay + alpha-filter path with inset/ring/sampling/refinement. This is not full constrained triangulation.

## Basis Coverage Self-Report

| Basis item | Coverage |
|---|---|
| `auto-outline-v2` explicit method | Implemented in authoring-core method union and operation payload schema. |
| Preserve `auto-outline-v1` / `auto-grid-v1` | Implemented. v1 remains callable; v2 fallback chain can land on v1 then grid. |
| Quality metrics | Implemented and routed: max edge length, max triangle area, min angle degrees, max vertex valence, refinement iteration count, fallback reason/fallback steps, triangulation mode. |
| Curvature-aware boundary resampling | Implemented in v2 contour resampling; high-curvature points get lower target spacing than straight spans. |
| Deterministic jittered / Poisson-like interior sampling | Implemented as deterministic jittered hex sampling with minimum-distance rejection. |
| Inset ring for Standard/Large | Implemented where feasible. Standard generates 1 ring, Large generates 2 rings by config; tests assert Standard and Large ring behavior. |
| Constrained triangulation preferred | Deferred. Current path is explicitly labeled `interim-delaunay-alpha-filter`. |
| Fallback chain | Implemented as `auto-outline-v2 -> auto-outline-v1 -> auto-grid-v1`; fallback steps are surfaced in generated result and operation provenance. |
| Representative v1 vs v2 metrics | Implemented in authoring-core tests using a concave/tail alpha fixture. |
| Editor preview/new generation uses v2 | Implemented. Mesh preview and Apply now pass `auto-outline-v2`; preview/apply and regenerate/apply flow preserved. |

## Intentionally Deferred Basis Items

- Full constrained triangulation / constrained Delaunay is deferred pending dependency policy review or a larger robust geometry implementation.
- Robust hole classification, multiple-island policy, morphological cleanup, and island/hole summary are not completed in this slice.
- Human visual check remains recommended and was not encoded as a pixel oracle.
- No semantic preset inference, Cubism compatibility claim, manual mesh editor expansion, or multi-drawable batch generation was added.

## User Workflow Trace

```text
Authoring Workspace
  -> select Drawable
  -> Mesh Tool
  -> choose preset
  -> preview auto-outline-v2 mesh
  -> inspect source/fallback/quality summary
  -> Apply using preview mesh
  -> Regenerate creates replacement draft
  -> Cancel/Apply preserves existing draft workflow
```

## Must-not Compliance Evidence

- No dependency or lockfile changes were made.
- No package-format or validator-core changes were needed.
- No Deformer operation foundation, Deformer Tree / Inspector UX, Parameter, or Keyform authoring files were intentionally edited by this Domain B work.
- Existing worktree contains parallel Domain A/deformer changes; they were not reverted or modified for this task.
- `index.ts` changes are re-export only.

## Algorithm Changes

- Added `packages/authoring-core/src/mesh-outline-v2-generation.ts`.
- Added `packages/authoring-core/src/mesh-quality-metrics.ts`.
- v2 pipeline:
  - alpha thresholding and contour extraction
  - curvature-aware contour resampling
  - Standard/Large inset ring generation where mask-clipped candidates are feasible
  - deterministic jittered hex interior sampling with minimum-distance rejection
  - interim ordinary Delaunay triangulation plus alpha centroid/edge sample filtering
  - bounded triangle refinement loop with iteration cap and deterministic centroid additions
  - deterministic coordinate/UV mapping and stable IDs with `outline_v2` identity
- v2 density config keeps Large denser than Standard, Standard denser than Low.
- Operation provenance records mesh quality entries for direct generation.
- Mesh Tool summary displays v2 source, fallback chain, and quality metrics for preview drafts.

## Quality Metrics Before/After Summary

Representative fixture: 32 x 28 alpha mask with an oval body, side tail, and concave notch; density `medium`.

| Metric | auto-outline-v1 | auto-outline-v2 |
|---|---:|---:|
| max edge length | 8 | 7 |
| max triangle area | 15.000034 | 13.06585 |
| min angle degrees | 9.18878 | 10.302528 |
| max vertex valence | 12 | 9 |
| refinement iteration count | 0 | 0 |
| triangulation mode | `ordinary-delaunay-alpha-filter` | `interim-delaunay-alpha-filter` |

Evidence:

- `packages/authoring-core/src/mesh-generation.test.ts`
  - `improves representative fan and oversized triangle metrics compared with auto-outline-v1`
  - asserts v2 max valence is <= v1, max triangle area is < v1, and max edge length is < v1.
- `generates deterministic auto-outline-v2 meshes with inset rings, jittered samples, and quality metrics`
  - asserts determinism, inset ring presence, interior point presence, non-integer jittered vertices, quality metrics, and interim triangulation mode.
- Fix Loop 1 additional tests:
  - `uses denser auto-outline-v2 points and inset rings for Large Motion than Standard or Low Motion`
    - asserts high > medium > low vertex/triangle counts, Standard has at least one inset ring, and Large has ring 1 stable IDs.
  - `filters auto-outline-v2 triangles whose centroids or edge samples would land outside alpha`
    - asserts zero sampled triangles land outside alpha for a notched fixture.
  - `keeps deterministic jittered auto-outline-v2 interior samples from regressing to an axis-aligned grid`
    - asserts interior sample fractional diversity and a pairwise minimum-distance invariant.

## Fallback Behavior and Evidence

- Direct v2 success returns source `outline-v2-rgba` and quality metrics.
- v2 failure tries `auto-outline-v1`.
- v1 failure then returns `bounds-grid`.
- Empty alpha fixture evidence:
  - source: `bounds-grid`
  - fallback reason: `alpha-empty`
  - fallback steps:
    - `auto-outline-v2: alpha-empty`
    - `auto-outline-v1: alpha-empty`
- Operation provenance evidence:
  - `generateMesh:auto-outline-v2`
  - `meshSource:outline-v2-rgba`
  - `meshQuality:maxEdgeLength=...`
  - `meshQuality:maxTriangleArea=...`
  - `meshQuality:minAngleDegrees=...`
  - `meshQuality:maxVertexValence=...`
  - `meshQuality:refinementIterations=...`
  - `meshQuality:triangulationMode=interim-delaunay-alpha-filter`
- Fix Loop 1 operation evidence:
  - direct v2 operation test asserts every quality metric provenance prefix.
  - empty-alpha v2 operation test asserts `fallback:auto-outline-v2:alpha-empty` and `fallback:auto-outline-v1:alpha-empty`.
  - editor command test asserts method-omitted Mesh generation defaults to `generateMesh:auto-outline-v2`.
  - Mesh Tool e2e asserts preview source text is `Auto outline v2` and quality rows are visible.

## Changed File List

- `packages/authoring-core/src/mesh-outline-v2-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/index.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `discussion/implementation/waves/wave63/wave63-domain-b-report.md`

## Verification Commands and Results

- `pnpm exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - Initial sandbox run failed with `spawn EPERM`; rerun with escalation passed.
  - Final result: 2 files passed, 19 tests passed.
- Fix Loop 1 required focused command:
  - `pnpm exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - Initial sandbox run failed with `spawn EPERM`; rerun with escalation passed.
  - Result: 3 files passed, 28 tests passed.
- `pnpm --filter @private-2d-rigging-lab/editor test:e2e:psd-import`
  - Initial sandbox run failed with `spawn EPERM`; escalated full e2e timed out at PSD import button stability before reaching Mesh Tool assertions.
- `pnpm --filter @private-2d-rigging-lab/editor exec playwright test -c playwright.config.ts e2e/psd-import.e2e.spec.ts -g "generates an initial mesh" --workers=1 --reporter=line`
  - Result after Fix Loop 1 e2e source/quality assertions: 1 test passed.
- `pnpm typecheck`
  - Result after Fix Loop 1: passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check`
  - Passed with line-ending warnings only.
- `Select-String` trailing whitespace check on new v2/metrics files
  - No matches.

## Residual Risk Classification

- Residual risk: `medium`.
- Reason:
  - Full constrained triangulation is deferred; boundary constraints can still be imperfect in complex concave/hole cases.
  - v2 has deterministic quality refinement, but the representative fixture did not require refinement iterations beyond initial sampling/rings.
  - Hole/multiple-island cleanup and summary remain future work.
  - Full repository typecheck is currently blocked by parallel Deformer/runtime changes outside Domain B.
