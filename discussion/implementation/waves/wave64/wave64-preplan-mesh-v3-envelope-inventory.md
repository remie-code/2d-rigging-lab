# Wave64 Preplan Mesh V3 Envelope Inventory

## Verdict

`pass`

`auto-outline-v3-envelope` は、Parameter 作業と並列の Wave64 sidecar として入れられる。ただし推奨範囲は「headless algorithm foundation + 明示 method の operation routing + focused tests」まで。Editor の既定生成を V3 に切り替える、または robust polygon offset / constrained triangulation 依存を導入する場合は、Parameter 側と共有する editor / operation ファイルの競合と依存判断が増える。

## Short Summary

- V2 は `packages/authoring-core` の `mesh-outline-v2-generation.ts` が本体で、`mesh-generation.ts` が method routing / fallback を持つ。
- V2 の alpha mask、contour extraction、Delaunay、deterministic ordering、stable ID、quality metrics は V3 でも再利用価値が高い。ただし多くは private helper なので、直接 import ではなく shared helper 抽出または V3 file 内の限定複製が必要。
- V3 の新規性は「alpha contour を boundary にしない」点であり、outward envelope、self-intersection cleanup、envelope polygon filter、coarser sampling metric が主要な新規 geometry work になる。
- Parameter 作業との主な競合候補は `packages/operation-core/src/payloads/model-edit.ts`、`apps/editor/src/features/editor-session/model/editor-session-commands.ts`、`apps/editor/src/features/editor-session/editor-session-context.tsx`。headless-only なら競合は小さい。
- dependency は未導入。manifest / lockfile に geometry / triangulation / clipping 系 library は見当たらなかったため、robust offset を要求すると dependency decision になる。

## Basis And Scope Notes

Read basis:

- `discussion/design/mesh-generation/auto-outline-v3-envelope.md`
- `discussion/design/mesh-generation/auto-outline-v2.md`
- `discussion/design/mesh-generation/_map.md`
- `discussion/design/screen-design/components/mesh-tool.md`
- `discussion/implementation/waves/wave63/wave63-domain-b-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/_conventions.md` and `discussion/_map.md` as discussion entry points

Repository inspection was static only. No source code was changed and no test suite was run for this inventory.

Current worktree note: before this report, mesh-generation design docs and Parameter design docs already had unrelated modifications / untracked files. This report does not treat those as implementation decisions.

## Facts With File Paths

### Authoring-core V2 implementation

- `packages/authoring-core/src/mesh-outline-v2-generation.ts`
  - Exports `createAutoOutlineV2Mesh`.
  - Owns V2 pipeline:
    - RGBA dimension validation.
    - `createAlphaMask`.
    - `extractContourLoops`.
    - `resampleContourLoop` and `capContourVerticesByCurvature`.
    - `sampleInsetRingPoints` and `findInsetCandidate`.
    - `sampleJitteredInteriorPoints`.
    - `refineTriangulation`.
    - local ordinary Delaunay `triangulate`.
    - `trianglePassesAlphaFilter`.
    - `createMeshDto`.
    - deterministic stable IDs using `outline_v2`.
  - V2 quality mode is recorded as `interim-delaunay-alpha-filter`.
  - File size observed: about 1121 lines. Source organization policy argues against appending V3 here.

- `packages/authoring-core/src/mesh-generation.ts`
  - Exports `MeshGenerationMethod`, currently:
    - `manual-empty`
    - `auto-grid-v1`
    - `auto-outline-v1`
    - `auto-outline-v2`
  - Exports `DrawableGeneratedMeshSource`, currently including `outline-v2-rgba`.
  - `createGeneratedMeshForDrawable` routes `auto-outline-v2` to `createAutoOutlineV2Mesh`.
  - V2 fallback chain is:
    - `auto-outline-v2`
    - `auto-outline-v1`
    - `auto-grid-v1` / bounds grid fallback
  - Texture bytes unavailable for V2 records a V2 fallback step.

- `packages/authoring-core/src/mesh-quality-metrics.ts`
  - Exports `computeMeshQualityMetrics`.
  - Metrics currently:
    - `maxEdgeLength`
    - `maxTriangleArea`
    - `minAngleDegrees`
    - `maxVertexValence`
    - `refinementIterationCount`
    - optional `fallbackReason`
    - optional `triangulationMode`
  - Existing `triangulationMode` union is `ordinary-delaunay-alpha-filter | interim-delaunay-alpha-filter`.

- `packages/authoring-core/src/mesh-outline-generation.ts`
  - V1 contour implementation remains available as fallback.
  - Includes older alpha / contour / Delaunay helpers, also private.

- `packages/authoring-core/src/index.ts`
  - Re-exports `mesh-generation`, `mesh-outline-generation`, `mesh-outline-v2-generation`, and `mesh-quality-metrics`.
  - Per source organization policy, any V3 export should remain barrel-only.

### Authoring-core V2 tests

- `packages/authoring-core/src/mesh-generation.test.ts`
  - Tests V1 outline boundary behavior.
  - Tests preset density ordering.
  - Tests deterministic V2 generation, inset rings, jittered samples, and quality metrics.
  - Tests V2 `Large Motion > Standard > Low Motion` vertex/triangle density and ring behavior.
  - Tests alpha-filtered triangles in a notched fixture.
  - Tests jittered interior samples do not regress to axis-aligned grid.
  - Tests representative V2 metrics improve versus V1 for max valence, max triangle area, and max edge length.
  - Tests V2 fallback chain on empty alpha.
  - Tests `createGeneratedMeshForDrawable` routes explicit `auto-outline-v2` with `outline-v2-rgba` source and quality summary.

### Operation-core integration

- `packages/operation-core/src/payloads/model-edit.ts`
  - `GenerateMeshPayloadSchema.method` enum currently includes `auto-outline-v2` but not V3.
  - Same file also owns Parameter / Keyform payload schemas, so it is a likely Parameter conflict point.

- `packages/operation-core/src/operations/generate-mesh.ts`
  - `generateMeshOperationHandler` calls `createGeneratedMeshForDrawable`.
  - Preview mesh path bypasses headless generation and records `meshSource:previewMesh`.
  - Direct generation records:
    - `generateMesh:<method>`
    - `meshSource:<source>`
    - fallback steps
    - `meshQuality:*` entries
  - Preview validation allows `auto-grid-v1`, `auto-outline-v1`, `auto-outline-v2`.

- `packages/operation-core/src/operations/generate-mesh.test.ts`
  - Tests operation registry.
  - Tests grid/manual paths.
  - Tests V1 operation provenance.
  - Tests V2 commit provenance includes `generateMesh:auto-outline-v2`, `meshSource:outline-v2-rgba`, quality metrics, and `meshQuality:triangulationMode=interim-delaunay-alpha-filter`.
  - Tests V2 fallback chain provenance.

### Editor integration

- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
  - Presets are UI-level IDs:
    - `largeMotion` -> density `high`
    - `standard` -> density `medium`
    - `lowMotion` -> density `low`
  - This layer is algorithm-agnostic except for preview provenance IDs.

- `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `previewMeshDraft` calls `createGeneratedMeshForDrawable` with method `auto-outline-v2`.
  - `applyMeshDraft` calls `commitGenerateMesh` with method `auto-outline-v2`.
  - This is a likely Parameter conflict point because it is broad editor session context.

- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
  - `commitGenerateMesh` defaults `method` to `auto-outline-v2`.
  - Same file contains other editor command wiring. Treat as shared / conflict-prone.

- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
  - Formats `outline-v2-rgba` as `Auto outline v2`.
  - Shows fallback and quality rows for draft preview.

- `apps/editor/e2e/psd-import.e2e.spec.ts`
  - Mesh Tool e2e expects preview source text `Auto outline v2`.

## Existing V2 Capabilities

V2 already provides:

- Deterministic RGBA alpha mask thresholding with `alpha > threshold`.
- Alpha bounds extraction and stage coordinate mapping.
- Contour loop extraction from alpha boundary pixels.
- Curvature-aware contour resampling with preset-specific density.
- Inset ring generation for Standard / Large where feasible.
- Deterministic jittered hex interior sampling with minimum-distance rejection.
- Local ordinary Delaunay triangulation.
- Alpha-based triangle filtering by centroid and midpoint samples.
- Bounded refinement loop using max edge / area / min angle scores.
- Deterministic sort/order and stable vertex / triangle IDs.
- Quality metrics and operation provenance.
- Fallback chain and explicit fallback evidence.
- Mesh Tool preview / Apply flow using uncommitted draft mesh.

## V3 Reuse Assessment

Reusable directly as public API:

- `computeMeshQualityMetrics` from `mesh-quality-metrics.ts`.
- `createGeneratedMeshForDrawable` routing pattern in `mesh-generation.ts`.
- Operation provenance format in `generate-mesh.ts`.
- Editor draft display pattern for source/fallback/quality summary.

Reusable conceptually but not directly importable today:

- `createAlphaMask`.
- `extractContourLoops`.
- deterministic point sorting and stable ID conventions.
- local Delaunay triangulation.
- jittered hex sampling and deterministic seed helpers.
- coordinate / UV mapping.
- alpha bounds and pixel/stage mapping helpers.

Reason: these helpers are private to `mesh-outline-v2-generation.ts` or `mesh-outline-generation.ts`.

Practical reuse options:

1. Extract shared helpers into responsibility files such as:
   - `mesh-alpha-mask.ts`
   - `mesh-contours.ts`
   - `mesh-delaunay.ts`
   - `mesh-generation-coordinates.ts`
   This is cleaner but touches V2 and can increase Wave64 surface.

2. Create `mesh-outline-v3-envelope-generation.ts` with limited duplication of V2 private helpers.
   This minimizes V2 regression risk and Parameter conflict, but duplicates geometry code.

Recommendation: for a Wave64 sidecar, prefer a V3-owned file plus small shared extraction only if it is necessary to avoid large duplication. Do not append V3 into `mesh-outline-v2-generation.ts`.

## V3 Gaps And Implementation Size Estimate

### New geometry work

Contour simplification:

- V2 has curvature-aware resampling and cap logic.
- V3 needs stronger simplification before offset, likely Douglas-Peucker or deterministic distance/curvature simplification.
- Estimate: small to medium if implemented on one outer loop; medium if holes/multiple islands are summarized robustly.

Outward offset / envelope:

- No existing outward polygon offset helper found.
- V3 needs envelope padding based on alpha bounds / area / preset.
- Simple radial-from-centroid or averaged-normal offset is feasible but will fail on concave shapes.
- Robust polygon offset / union / cleanup is the largest unknown.
- Estimate: medium for conservative local offset with fallback; large if robust polygon Boolean / offset is required.

Self-intersection cleanup:

- No current self-intersection cleanup.
- Minimum useful path:
  - detect segment intersections after offset,
  - reduce padding or fallback to V2 for intersecting envelopes,
  - record fallback reason.
- Full cleanup / union is a dependency or larger geometry task.
- Estimate: medium for detect-and-fallback; large for robust cleanup.

Envelope resampling:

- V2 resampling can be adapted conceptually.
- V3 needs boundary spacing coarser than V2 and based on envelope length / preset.
- Estimate: small to medium.

Support ring:

- V2 inset ring can be adapted conceptually.
- V3 decision remains unresolved: support ring from alpha contour, envelope inward offset, or blended between them.
- Estimate: medium because it changes triangle band behavior and density metrics.

Coarser interior sampling:

- V2 deterministic jittered hex sampling can be adapted.
- V3 needs sampling inside envelope polygon, not strictly inside alpha mask.
- Requires point-in-polygon and envelope distance/bounds checks.
- Estimate: medium.

Triangulation / filter changes:

- Existing Delaunay can be reused conceptually.
- V2 filters triangles against alpha. V3 must filter against envelope and allow alpha-transparent pixels inside envelope.
- Full constrained triangulation remains deferred in current code and design.
- Estimate: medium for ordinary Delaunay + envelope filter; large if constrained triangulation is required.

Metrics:

- Existing mesh quality metrics cover generic triangle quality.
- V3 needs envelope-specific metrics:
  - envelope outside triangle/sample count.
  - boundary vertex count.
  - envelope area / alpha area ratio.
  - boundary average/min distance to alpha contour.
  - transparent-inside-envelope sample ratio or count.
  - support ring count.
  - boundary triangle aspect ratio.
- Estimate: small to medium.

Overall implementation estimate:

- Headless useful V3 sidecar: medium.
- Headless + operation explicit method: medium.
- Headless + operation + editor selectable/default V3: medium-plus and more conflict-prone.
- Robust offset cleanup + constrained triangulation dependency: large / needs design decision.

## Recommended Wave64 Mesh V3 Sidecar Scope

Recommended sidecar:

1. Add `auto-outline-v3-envelope` as a separate algorithm, not replacement.
2. Keep V2 as fallback and keep V2 as current editor default unless explicitly decided otherwise.
3. Implement a conservative envelope MVP:
   - alpha mask and main contour extraction.
   - deterministic contour simplification.
   - preset-scaled outward envelope padding.
   - envelope resampling with coarser spacing than V2.
   - optional one support ring for Standard / Large only if stable.
   - coarser deterministic interior sampling inside envelope.
   - ordinary Delaunay + envelope filtering.
   - fallback to V2 when envelope generation or filtering fails.
4. Add operation method support only if needed for provenance / direct invocation:
   - `GenerateMeshPayloadSchema.method` enum adds `auto-outline-v3-envelope`.
   - provenance records `generateMesh:auto-outline-v3-envelope`.
   - source records a new value such as `outline-v3-envelope-rgba`.
5. Defer Editor default switch. If editor exposure is needed, add only a small display mapping and keep V2 default until user decision.

Non-recommended for Wave64 sidecar:

- Replacing V2 as default without visual / metric review.
- Adding robust polygon dependency without explicit dependency decision.
- Implementing full constrained Delaunay.
- Building new Mesh Tool UI controls for algorithm choice.

## Conflict And Dependency Assessment Vs Parameter Work

Parallel viability:

- `packages/authoring-core` headless V3 is mostly independent from Parameter work.
- `packages/operation-core` operation method support has moderate conflict risk because `payloads/model-edit.ts` also contains Parameter / Keyform payload schemas.
- `apps/editor` V3 preview/default changes have moderate to high conflict risk because editor session context and command files are shared by multiple authoring domains.

Low-conflict write scopes for Mesh V3:

- `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- Possible shared mesh-only helper files under `packages/authoring-core/src/`
- Minimal `packages/authoring-core/src/mesh-generation.ts`
- Minimal `packages/authoring-core/src/index.ts` re-export

Moderate-conflict write scopes:

- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`

Higher-conflict write scopes:

- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

Dependency status:

- No existing geometry / clipping / triangulation library was found in `package.json` files or `pnpm-lock.yaml` by keyword search.
- V2 intentionally uses local ordinary Delaunay and marks constrained triangulation as deferred.
- Any robust polygon offset / Boolean cleanup library would be a new dependency decision.

## Tests Found

Existing tests likely to extend:

- `packages/authoring-core/src/mesh-generation.test.ts`
  - best location for V3 algorithm and V2 comparison tests.

- `packages/operation-core/src/operations/generate-mesh.test.ts`
  - best location for V3 operation method, provenance, quality, fallback chain tests.

- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - only needed if editor command default or explicit editor method changes.

- `apps/editor/e2e/psd-import.e2e.spec.ts`
  - only needed if Mesh Tool visible source text/default changes.

## Likely Tests Needed

Headless V3 tests:

- Deterministic output for identical RGBA / preset / threshold.
- `auto-outline-v3-envelope` returns source/provenance distinct from V2.
- V3 vertex and triangle counts are less than or equal to V2 on representative fixtures, with preset order preserved.
- V3 boundary vertex count is lower than V2 boundary vertex count on a noisy / notched fixture.
- Envelope area is greater than alpha area but bounded by a configured maximum ratio.
- Boundary vertices are outside or near-outside alpha more often than V2 boundary vertices, proving it is not alpha-contour hugging.
- Some triangle samples may be outside alpha but must remain inside envelope.
- No triangle centroid / edge sample lies outside the envelope.
- Coarser interior spacing produces larger mean nearest-neighbor distance than V2.
- Support ring count is recorded and does not recreate dense alpha contour points.
- Fallback to V2 is recorded when envelope generation self-intersects or fails.

Operation tests:

- Payload schema accepts `auto-outline-v3-envelope`.
- Operation provenance records:
  - `generateMesh:auto-outline-v3-envelope`
  - `meshSource:outline-v3-envelope-rgba`
  - V3 quality / envelope metrics
  - fallback chain `auto-outline-v3-envelope -> auto-outline-v2 -> auto-outline-v1` when applicable.

Editor tests, only if exposed:

- Mesh Tool source label maps new source to a human label.
- Existing preview -> Apply flow still works.
- Existing V2 default assertions are updated only if user decides V3 becomes default.

Avoid:

- Screenshot pixel oracle as the main proof.
- Assertions that hardcode exact vertex coordinates for complex geometry.
- Tests that force Cubism-like output or pixel-perfect outline following.

## What Can Be Deferred While Still Useful

Deferrable:

- Full constrained Delaunay / constrained triangulation.
- Robust polygon Boolean union / full offset cleanup.
- Hole handling.
- Multi-island envelope policy beyond largest/main island.
- Morphological cleanup beyond current threshold/bounds behavior.
- Editor algorithm selector.
- Making V3 the Mesh Tool default.
- Manual mesh editor expansion.
- Semantic preset choice.
- Screenshot-based visual acceptance.

Still useful MVP:

- V3 as explicit headless / operation method.
- Conservative envelope generation with detect-and-fallback.
- Coarser density and envelope-specific metrics.
- V2 fallback preserving current workflow.

## User-decision Points

These should not be treated as settled:

- Algorithm name:
  - keep `auto-outline-v3-envelope`, or rename to `auto-envelope-v1`.

- Default behavior:
  - leave Mesh Tool default as V2, or switch preview/apply default to V3 after metrics review.

- Geometry dependency:
  - no new dependency and accept conservative fallback, or approve a robust polygon offset / cleanup library.

- Shared helper strategy:
  - extract reusable V2 geometry helpers now, or keep V3 isolated with limited duplication for lower conflict.

- Fallback chain:
  - recommended `V3 -> V2 -> V1 -> grid`, but should be explicitly accepted.

## Unresolved Technical Risks

- Outward offset on concave, thin, or noisy alpha shapes may self-intersect.
- A simple offset may over-expand thin protrusions or erase important silhouette intent.
- Ordinary Delaunay + envelope filtering can fail to preserve envelope boundary edges in complex concave envelopes.
- Coarser density can create large triangles unless quality refinement is carefully bounded.
- Support ring placement can accidentally reintroduce V2-like alpha-hugging density.
- Envelope metrics need careful fixture design to prove behavior without overfitting coordinates.
- Touching editor default/source text will conflict with any simultaneous Parameter editor work.
- Adding a new dependency would require policy review and lockfile changes, making the sidecar less independent.

## Planning Answer

V3 is feasible as a Wave64 Mesh sidecar if it is treated as a separate algorithm with explicit method support and V2 fallback. The highest-value first slice is headless V3 plus tests that prove:

- boundary is envelope-based, not alpha-contour-based;
- density is coarser than V2;
- transparent pixels inside the envelope are allowed;
- no triangles escape the envelope;
- output and fallback evidence remain deterministic.

Parameter work can proceed in parallel if Mesh V3 avoids editor default changes and keeps operation edits small. If V3 must become the Mesh Tool default in the same wave, coordinate edits to shared editor session and payload files.
