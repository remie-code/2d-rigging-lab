# Wave63 Pre-plan: Mesh auto-outline-v2 Inventory

## Status

- Verdict: `pass`
- Scope: factual inventory only. No source, test, map, or wave plan edits were made.
- Report owner context: Wave63 pre-plan inventory for Undine.
- Main finding: Wave62 `auto-outline-v1` satisfies the first-order outline-following baseline, but it does not yet implement the main `auto-outline-v2` quality mechanisms: mask cleanup, curvature-aware resampling, inset rings, blue-noise / Poisson-like interior sampling, constrained triangulation, quality refinement, or quality metrics summary.

## Basis Read

Primary basis:

- `discussion/design/mesh-generation/auto-outline-v2.md`
- `discussion/design/mesh-generation/_map.md`
- `discussion/design/screen-design/components/mesh-tool.md`
- `discussion/design/screen-design/_map.md`
- `discussion/implementation/orchestration/wave62-plan.md`
- `discussion/implementation/waves/wave62/wave62-domain-a-mesh-auto-outline-v1-report.md`
- `discussion/implementation/reviews/wave62/wave62-domain-a-mesh-auto-outline-v1-review.md`
- `discussion/implementation/reviews/wave62/wave62-final-clean-integration-review.md`

Source / test basis:

- `packages/authoring-core/src/mesh-outline-generation.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- package manifests: root `package.json`, `packages/authoring-core/package.json`, `packages/operation-core/package.json`, `apps/editor/package.json`, `packages/contracts/package.json`, `packages/package-format/package.json`, `packages/runtime-core/package.json`

## Current v1 Facts

- Design status: `auto-outline-v2.md` is a draft algorithm spec, not a screen design, and defines v2 as a candidate to reduce fan concentration, oversized triangles, rectangular grid feel, and abrupt boundary/interior density changes (`discussion/design/mesh-generation/auto-outline-v2.md:1`, `:9`, `:17`).
- Wave62 target: Domain A was scoped to move from `auto-grid-v1` to an alpha-outline `auto-outline-v1`; advanced mesh quality tuning and pixel-perfect visual oracle were out of scope (`discussion/implementation/orchestration/wave62-plan.md:222`, `:258`, `:284`).
- v1 method support: authoring-core currently exposes `manual-empty`, `auto-grid-v1`, and `auto-outline-v1`; there is no `auto-outline-v2` method yet (`packages/authoring-core/src/mesh-generation.ts:11`).
- Alpha mask: `createAutoOutlineMesh` validates dimensions and RGBA length, then builds a binary mask with default threshold `8`; empty alpha returns `alpha-empty` (`packages/authoring-core/src/mesh-outline-generation.ts:98`, `:105`, `:199`).
- Mask cleanup: v1 does thresholding only. There is no morphological close/open, island area filtering, hole fill, or noise cleanup step in the current source (`packages/authoring-core/src/mesh-outline-generation.ts:199`).
- Contour extraction: v1 builds directed boundary edges around filled alpha pixels and walks them into loops, then sorts loops deterministically (`packages/authoring-core/src/mesh-outline-generation.ts:237`, `:248`, `:269`, `:287`, `:315`, `:744`).
- Contour simplification: v1 uses density-specific `simplifyEpsilon`, `interiorDivisions`, `minInteriorSpacing`, and `contourVertexCap`; simplification is RDP-like over two chains, preserves concavity-adjacent points, removes collinear points, and caps vertices by uniform step (`packages/authoring-core/src/mesh-outline-generation.ts:70`, `:77`, `:348`, `:372`, `:671`).
- Interior sampling: v1 places axis-aligned regular sample points inside alpha bounds using spacing derived from max alpha dimension and density config; points outside alpha and points too close to contour are rejected (`packages/authoring-core/src/mesh-outline-generation.ts:445`, `:453`, `:463`, `:465`, `:469`).
- Triangulation: v1 runs a deterministic in-repo Bowyer-Watson-style ordinary Delaunay over all contour and interior points. It does not preserve boundary edges as constraints (`packages/authoring-core/src/mesh-outline-generation.ts:480`, `:496`, `:513`).
- Filtering: v1 orients triangles, rejects degenerate area, rejects centroid outside alpha, and requires edge/centroid mid-samples to be near alpha (`packages/authoring-core/src/mesh-outline-generation.ts:146`, `:571`, `:581`, `:590`, `:594`).
- Mapping and stable IDs: v1 maps pixel points linearly to UV and stage coordinates, rounds coordinates, sorts triangles, and emits deterministic stable IDs based on drawable token, point kind/index, and triangle index (`packages/authoring-core/src/mesh-outline-generation.ts:160`, `:165`, `:175`, `:187`, `:767`).
- Fallback: `createGeneratedMeshForDrawable` falls back to bounds-grid if texture bytes are unavailable or v1 returns `invalid-rgba`, `alpha-empty`, `contour-extraction-failed`, or `triangulation-failed` (`packages/authoring-core/src/mesh-generation.ts:87`, `:100`, `:108`, `:137`, `:220`).
- Operation integration: operation-core accepts `auto-outline-v1`, commits generated geometry, validates preview mesh cardinality/range/degenerate triangles, and records `generateMesh:*`, `meshSource:*`, and fallback when not applying a preview payload (`packages/operation-core/src/operations/generate-mesh.ts:97`, `:104`, `:128`, `:201`, `:257`, `:289`).
- Editor integration: preview and apply are hardcoded to `auto-outline-v1`; Inspector shows counts, source, fallback reason, and alpha bounds but no quality metrics summary (`apps/editor/src/features/editor-session/editor-session-context.tsx:290`, `:297`, `:318`, `:330`; `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:161`, `:163`, `:164`, `:167`).
- Test coverage currently checks outline vertices, transparent centroid avoidance, preset count ordering, deterministic output, alpha-empty fallback, operation commit/provenance, preview apply, and invalid preview rejection (`packages/authoring-core/src/mesh-generation.test.ts:23`, `:57`, `:60`, `:92`; `packages/operation-core/src/operations/generate-mesh.test.ts:120`, `:144`, `:165`, `:221`).

## v2 Gap Table

| ID | Desired algorithm element | Current implementation | Gap | Source refs | Likely tests |
|---|---|---|---|---|---|
| V2-01 | Alpha threshold + mask cleanup | Threshold mask with default `8`; no cleanup | Add deterministic small-island removal and optional close/open or hole/noise cleanup. Need summary of ignored holes/islands if design keeps that requirement. | `auto-outline-v2.md:72`; `mesh-outline-generation.ts:199` | tiny noise island removed; 1px hole close/open behavior; deterministic mask cleanup; fallback for empty-after-cleanup |
| V2-02 | Contour extraction with island/hole policy | Directed boundary edge loop extraction over all filled-pixel boundaries, sorted by area | v1 does not classify outer loops vs holes vs multiple islands and does not return warning/summary for ignored or simplified loops. | `auto-outline-v2.md:80`; `mesh-outline-generation.ts:237`; Wave62 residual risk at `wave62-domain-a...report.md:56` | largest island vs multiple island policy; hole ignored/retained summary; thin shape contour extraction |
| V2-03 | Curvature-aware boundary resampling | RDP-like simplification by density and concavity point protection; uniform vertex cap | Not curvature-aware. No min/max boundary spacing, curvature weighting, or density-transition control. | `auto-outline-v2.md:88`; `mesh-outline-generation.ts:348`; `mesh-outline-generation.ts:671` | high-curvature corners retain more points than straight spans; preset min/max boundary spacing; deterministic point order |
| V2-04 | Inset ring generation | None | Direct contour-to-interior triangulation remains possible. Add 1-2 deterministic internal rings or explicitly choose a smaller slice that does not claim this AC. | `auto-outline-v2.md:105`; `mesh-outline-generation.ts:125`; `mesh-outline-generation.ts:445` | ring count by preset; ring points inside alpha; self-intersection/mask-out rejection; fan/valence reduction metric |
| V2-05 | Blue-noise / Poisson-like interior sampling | Axis-aligned regular grid sampling inside alpha bounds, with contour-near rejection | Grid-derived rectangular feel remains likely. No seed, jittered hex, Poisson disk, adaptive distance field, or min-distance rejection against inset ring. | `auto-outline-v2.md:123`; `mesh-outline-generation.ts:453`; `mesh-outline-generation.ts:463` | min distance between interior samples; no axis-aligned row/column dominance for simple shapes; deterministic seeded sampler; preset spacing order |
| V2-06 | Constrained triangulation | Ordinary in-repo Delaunay, then alpha sample filtering | Boundary edges are not constraints. This is close to the v2 document's "realistic fallback", not the recommended constrained approach. | `auto-outline-v2.md:147`; `mesh-outline-generation.ts:480`; `mesh-outline-generation.ts:571` | all boundary edges preserved or boundary strip present; alpha/polygon outside triangles rejected; triangulation failure fallback |
| V2-07 | Triangle quality refinement | Only degenerate area and alpha sample filtering | No max edge split, max area split, min angle repair, valence repair, edge flip, smoothing, or iteration summary. | `auto-outline-v2.md:163`; `mesh-outline-generation.ts:581`; `mesh-outline-generation.ts:603` | max edge / max area thresholds; min angle lower bound or summary; max valence cap or warning; iteration cap behavior |
| V2-08 | Quality metrics summary | Mesh result exposes only mesh, source, alphaBounds, fallbackReason at higher layers | v2 wants max edge / max area / max valence and possibly min angle in summary. No schema or UI/operation path carries this today. | `auto-outline-v2.md:49`; `auto-outline-v2.md:229`; `mesh-generation.ts:26`; `mesh-tool-inspector.tsx:161` | summary computed deterministically; thresholds recorded; operation/editor can surface warning if required |
| V2-09 | Deterministic seed / stable ordering | Deterministic by sorted loops/points/triangles and no randomness; test asserts equal output | Partially satisfied. There is no explicit deterministic seed from drawable id / texture digest / preset / threshold, and stable IDs do not include explicit `auto-outline-v2` algorithm id. | `auto-outline-v2.md:37`; `auto-outline-v2.md:186`; `mesh-outline-generation.ts:160`; `mesh-generation.test.ts:92` | same input same output; seed changes only when intended inputs change; stable IDs include v2 identity if decided |
| V2-10 | Preview -> Apply / Regenerate -> Apply preservation | Existing UX path is hardcoded to v1 and passes Wave62 review | v2 as a user-visible method requires operation schema/type updates and editor preview/apply method changes. Algorithm-only v2 can remain in authoring-core until this decision is made. | `auto-outline-v2.md:243`; `editor-session-context.tsx:297`; `editor-session-context.tsx:330`; `payloads/model-edit.ts:152` | editor command default or explicit method test; preview/apply E2E remains green; fallback/warning display if summary added |

## Dependency / Triangulation Notes

Facts from manifests:

- No existing package manifest lists a triangulation, constrained Delaunay, polygon clipping, Poisson sampling, or robust geometry dependency.
- `packages/authoring-core/package.json` depends only on workspace packages.
- `packages/operation-core/package.json` depends on workspace packages and `zod`.
- `apps/editor/package.json` has React/Radix/Lucide/Vite-style UI dependencies, but no geometry library.
- Wave62 review explicitly noted no dependency manifest or lockfile changes and in-repo deterministic geometry logic (`discussion/implementation/reviews/wave62/wave62-domain-a-mesh-auto-outline-v1-review.md:49`).

Inference, not verified by network:

- The v2 recommended constrained triangulation is the area most likely to benefit from a dependency, because robust constrained Delaunay and polygon-with-holes handling are easy to under-specify in hand-written code.
- Possible future research categories: constrained Delaunay triangulation, polygon triangulation with holes, polygon clipping / point-in-polygon validation, robust orientation predicates, deterministic Poisson / blue-noise sampling.
- Named package candidates should be treated as unverified until a separate dependency review checks current maintenance, license, ESM/TypeScript compatibility, determinism, and bundle impact. No network/package registry check was performed for this inventory.

## Test Oracle Boundary

Good automated oracles:

- Deterministic output for identical RGBA/preset/threshold/seed.
- Preset ordering: Large Motion has more boundary/interior points and triangles than Standard, Standard more than Low Motion.
- Alpha correctness: triangle centroid inside alpha, no triangle edges grossly crossing transparent regions according to deterministic samples.
- Metric thresholds or recorded summaries: max edge length, max triangle area, min angle, max vertex valence, quality-refinement iteration count.
- Sampler invariants: minimum sample distance, ring points remain inside alpha, boundary spacing min/max range.
- Fallbacks: bytes unavailable, invalid RGBA, empty alpha, contour failure, triangulation failure, cleanup-empty, quality-refinement non-convergence.
- Operation/editor contracts: preview mesh validation, method acceptance, provenance/source/fallback/summary routing.

Keep as human visual check:

- Whether the mesh looks like a natural image-shape triangular mesh rather than Cubism-perfect output.
- Whether fan concentration is visually reduced on real hair/hat/thin samples.
- Whether rectangular grid feel or fixed diagonal impression remains.
- Whether boundary-to-interior density transition looks abrupt.
- Whether thin protrusions and concave cuts look plausible enough for manual editing.

Do not use as automated oracle without a stronger spec:

- Pixel-perfect match to Photoshop/Cubism.
- Exact triangle layout equality across different valid triangulators.
- General aesthetic judgment.

## Risks

- Constrained triangulation risk: keeping ordinary Delaunay plus filters may not reduce boundary-edge loss or fan concentration enough, but adding a dependency requires policy/license/current-maintenance review.
- Geometry robustness risk: holes, multiple islands, and very thin alpha shapes are known residual risks from Wave62 reviews (`discussion/implementation/reviews/wave62/wave62-final-clean-integration-review.md:120`).
- Metric threshold risk: max edge, area, min angle, and valence thresholds need concrete preset values; too strict can force fallback, too loose will not improve visual quality.
- Performance risk: refinement loops, resampling, distance-field/inset-ring generation, or repeated triangulation need deterministic iteration caps.
- Compatibility risk: adding `auto-outline-v2` as a new method touches operation schema, authoring-core types, editor preview/apply hardcoded method strings, and tests.
- Evidence risk: current preview apply path records `meshSource:previewMesh`; fallback details from the generated draft are not preserved after Apply according to Wave62 review (`discussion/implementation/reviews/wave62/wave62-domain-a-mesh-auto-outline-v1-review.md:75`).

## Undine Decision Needed

- Decide whether Wave63 exposes a new `auto-outline-v2` method or upgrades the current `auto-outline-v1` internals behind the existing method.
- Decide whether constrained triangulation requires a dependency investigation before implementation, or whether Wave63 should begin with boundary-strip + ordinary Delaunay fallback.
- Decide initial holes / multiple-island policy: largest island only, all major islands, holes ignored with summary, or holes as constrained boundaries.
- Decide concrete quality thresholds per preset: max edge length, max area, min angle, max valence, and whether violations are hard fallback, warning, or summary-only.
- Decide fallback chain: `auto-outline-v2 -> auto-outline-v1 -> bounds-grid`, direct `auto-outline-v2 -> bounds-grid`, or blocked result for some failures.
- Decide whether Wave63 includes Editor preview/warning/summary integration, or limits scope to headless authoring-core algorithm and tests.

## Recommended Wave63 Slice

Recommended implementation slice, assuming Undine wants a bounded first v2 step:

1. Keep the first implementation centered in `packages/authoring-core` with focused tests, and only update operation/editor if v2 must be selectable or default in the Mesh Tool during Wave63.
2. Add a v2 generation result shape that can carry deterministic quality summary internally, even if the UI does not yet show every metric.
3. Implement metric computation early: max edge length, max triangle area, min angle, max valence, alpha centroid/outside count. This gives objective before/after data for later algorithm changes.
4. Add one boundary-density improvement and one interior-density improvement before attempting full constrained triangulation: curvature-aware boundary resampling plus deterministic jittered/Poisson-like interior sampling are the most direct sources of visible improvement over v1 grid-derived output.
5. Add a simple inset ring for Standard/Large Motion if fan/valence metrics remain poor after sampling changes; keep ring generation deterministic and mask-clipped.
6. Treat constrained triangulation as a decision gate. If no dependency is approved, implement a clearly labeled interim fallback path and do not claim full v2 constrained triangulation AC.
7. Preserve existing `preview -> Apply` and `Regenerate -> Apply` behavior if editor integration is included; current hardcoded `auto-outline-v1` call sites are `editor-session-context.tsx:297` and `:330`, and operation schema currently accepts only v1 at `packages/operation-core/src/payloads/model-edit.ts:152`.

