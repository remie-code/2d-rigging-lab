# Wave69 Domain A Spec Compliance Review

- Verdict: `pass`
- Wave: `mesh-generation-v6-contour-salvage-triangulation-candidates`
- Domain: `wave69-v6-contour-salvage-shared-pipeline-method-surface`
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Scope Reviewed

Reviewed basis:

- `discussion/implementation/orchestration/wave69-plan.md`
- `discussion/design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md`
- `discussion/design/mesh-generation/_map.md`
- `discussion/implementation/waves/wave68/wave68-final-integration-report.md`
- `discussion/implementation/reviews/wave68/wave68-final-clean-integration-review.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

Reviewed implementation artifacts and source:

- `discussion/implementation/waves/wave69/wave69-domain-a-v6-contour-salvage-shared-pipeline-method-surface-report.md`
- `discussion/implementation/waves/wave69/_map.md`
- `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `packages/authoring-core/src/index.ts`

I also checked relevant `git status`, `git diff`, focused tests, source/dependency guards, and the default-method references in Editor source.

## Basis Requirement Classification

| Requirement | Classification | Evidence |
|---|---|---|
| Add method id `auto-outline-v6d-contour-constrainautor` | implemented | `V6_MESH_GENERATION_METHOD_IDS` includes it at `packages/authoring-core/src/mesh-generation-contract.ts:7`; candidate metadata at `packages/authoring-core/src/mesh-generation-contract.ts:88`. |
| Add method id `auto-outline-v6e-contour-poly2tri` | implemented | `packages/authoring-core/src/mesh-generation-contract.ts:7`; candidate metadata at `packages/authoring-core/src/mesh-generation-contract.ts:96`. |
| Add method id `auto-outline-v6f-contour-custom-cdt` | implemented | `packages/authoring-core/src/mesh-generation-contract.ts:7`; candidate metadata at `packages/authoring-core/src/mesh-generation-contract.ts:104`. |
| Add source ids `outline-v6d-contour-constrainautor-rgba`, `outline-v6e-contour-poly2tri-rgba`, `outline-v6f-contour-custom-cdt-rgba` | implemented | `V6_MESH_GENERATION_SOURCE_IDS` and generated mesh source IDs include them at `packages/authoring-core/src/mesh-generation-contract.ts:16` and `packages/authoring-core/src/mesh-generation-contract.ts:129`. |
| v6D/E/F accepted by headless generation path | implemented | `createGeneratedMeshForDrawable` routes v6A/B/C to existing implementations and v6D/E/F to deferred shared fallback at `packages/authoring-core/src/mesh-generation.ts:127` and `packages/authoring-core/src/mesh-generation.ts:158`. |
| v6D/E/F accepted by Operation Core payload allowlist | implemented | `GenerateMeshPayloadSchema` uses `MESH_GENERATION_METHOD_IDS` at `packages/operation-core/src/payloads/model-edit.ts:284`; v6 metrics schema uses shared v6 method/source/backend arrays at `packages/operation-core/src/payloads/model-edit.ts:227`. |
| Current default remains `auto-outline-v2.6-soft-apron` | implemented | `DEFAULT_MESH_GENERATION_METHOD` remains V2.6 at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:73`; command default remains V2.6 at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:274`. |
| Extract shared contour pipeline from salvageable v6A stages only | implemented | New responsibility file owns soft mask, component selection, boundary trace, outer loop, and sampling at `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:113`, `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:263`, `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:382`, `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:467`, and `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:576`. |
| Shared candidate input carries boundary points, constraint edges, interior/Steiner points, alpha bounds, main mask, and diagnostics | implemented | `V6ContourCandidateInput` has the required fields at `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:56`; generated result populates them at `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:228`. |
| Establish shared interior/Steiner point generation contract | implemented | Deterministic farthest/interior sampler is in `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:645`; diagnostics record `interiorPointCount` and provenance at `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:208`. |
| Establish shared constraint edge representation | implemented | `V6ContourConstraintEdge` is defined at `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:28`; consecutive closed-loop edges are built at `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:610`. |
| Shared contour pipeline yields deterministic boundary points and constraint edges for representative fixtures | implemented | Focused test compares two pipeline runs and checks edge topology for rectangle, curved, thin-tip, and hole-like fixtures at `packages/authoring-core/src/mesh-generation.test.ts:1168`. |
| Add or use fixtures exposing the v6A spoke/fan failure class without exact visual overfit | implemented | Existing v6 fixtures include `v6-thin-tapered` with `thin-tip` shape feature at `packages/authoring-core/src/mesh-generation-v6-fixtures.ts:56`; Domain A tests use it for shared contour determinism at `packages/authoring-core/src/mesh-generation.test.ts:1168`. Exact hair/eye visual fixture remains a downstream integration risk, not a Domain A blocker. |
| Tests avoid exact triangle-layout overfitting for the new shared path | implemented | New Domain A tests assert DTO/metadata/constraint invariants and deterministic equality, not a full expected triangle layout, at `packages/authoring-core/src/mesh-generation.test.ts:1089`, `packages/authoring-core/src/mesh-generation.test.ts:1168`, and `packages/authoring-core/src/mesh-generation.test.ts:2119`. |
| Shared metrics/fallback shape can represent v6D/E/F success/failure | implemented | `MeshGenerationV6Metrics` includes output kind, fallback reason/steps, contour diagnostics, backend diagnostics, and custom CDT diagnostics at `packages/authoring-core/src/mesh-quality-metrics.ts:146`; operation transform history exposes the same shape at `packages/operation-core/src/operations/generate-mesh.ts:487`. |
| v6D backend execution | deferred by plan | Domain B owns Delaunator + Constrainautor backend execution; Domain A records `backendImplementationStatus: "deferred"` at `packages/authoring-core/src/mesh-generation-contract.ts:88`. |
| v6E backend execution | deferred by plan | Domain C owns Poly2Tri backend execution; Domain A records `backendImplementationStatus: "deferred"` at `packages/authoring-core/src/mesh-generation-contract.ts:96`. |
| v6F custom constrained triangulation execution | deferred by plan | Domain D owns custom CDT execution; Domain A records `backendImplementationStatus: "deferred"` at `packages/authoring-core/src/mesh-generation-contract.ts:104`. |
| Editor selector replacement from v6A/B/C to v6D/E/F | deferred by plan | Domain E owns Editor selector work; Domain A did not edit `apps/editor/**`. |
| Final backend choice or default promotion | explicit non-goal | Wave69 plan keeps final backend selection out of scope; default remains V2.6. |
| Do not reuse v6A triangulation, ear clipping, fan fallback, split-triangle insertion, or row-major placement as shared pipeline basis | implemented | Shared pipeline imports no v6A implementation and contains no `earClipPolygon`, fan, split-triangle, or row-major markers. The only `createAutoOutlineV6ALocalMesh` import remains the existing v6A route in `packages/authoring-core/src/mesh-generation.ts:16`, separate from the new shared pipeline. |
| Do not switch default to any v6 candidate | implemented | Default evidence above. |
| Do not do render/WebGL/texture work in Domain A | implemented | Domain A source/diff scope does not touch render packages. The worktree still has separate `packages/render-webgl2/**` NEAREST changes matching the accepted Wave68 baseline; they were not part of the Domain A artifact under review. |
| Do not do Editor UI work in Domain A | implemented | No `apps/editor/**` Domain A diff; selector update is deferred to Domain E. |
| Do not add or install dependencies | implemented | No manifest or lockfile diff in Domain A scope; dependency guard passed. |
| Package-format changes only if method metadata/schema requires them | not relevant | Domain A satisfied method/source/schema needs through authoring-core and operation-core; no package-format change was needed. |
| UX-backed package logic authority | implemented | Package-level method/source/provenance schema changes follow accepted mesh-generation AC rather than a GUI workaround. |
| Source file organization policy | implemented | Shared pipeline is a named responsibility file; `packages/authoring-core/src/index.ts:27` is a re-export only; source organization guard passed. |
| Operation policy | implemented | Generate mesh continues through Operation Core; new methods are accepted by operation payload schema and provenance formatting. |
| Schema and ID conventions | implemented | New machine-readable method/source/backend IDs are stable lowercase/kebab tokens with no spaces. |

## Findings

No blocking or non-blocking spec compliance findings.

## Validation Evidence

Direct commands run:

| Command | Result |
|---|---|
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | sandbox failed with esbuild `spawn EPERM`; approved outside-sandbox rerun passed, 2 files / 72 tests |
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `git diff --check -- packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts packages/authoring-core/src/mesh-generation-contract.ts packages/authoring-core/src/mesh-quality-metrics.ts packages/authoring-core/src/mesh-generation.ts packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/payloads/model-edit.ts packages/operation-core/src/operations/generate-mesh.ts packages/operation-core/src/operations/generate-mesh.test.ts packages/authoring-core/src/index.ts discussion/implementation/waves/wave69` | pass, with CRLF working-copy warnings only |
| `rg -n "earClipPolygon|triangulateBoundaryFan|splitTrianglesWithInteriorPoints|row-major|v6a-local-earclip|v6a-local-deterministic-interior" packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts` | no matches |

Evidence considered:

- `git status --short -uall` and Domain A source diffs.
- Wave69 Domain A implementation report and Wave69 implementation map.
- Wave68 final integration/report evidence for the existing v6A/B/C baseline and accepted NEAREST rendering change.
- Direct source inspection of the shared contour pipeline, v6 method/source contracts, metrics shape, operation payload schema, operation transform history, and focused tests.

No network access or package install was used.

## Residual Risks And Downstream Notes

- Domains B/C/D must replace `v6-backend-not-implemented` fallback with real backend output and keep `outputKind`, fallback steps, preserved/missing constraints, and thrown/error diagnostics truthful.
- Domain C may need additional v6E-specific fallback reason codes if it wants distinct hole, multi-island, or boundary-missing reasons instead of using the current generic v6E failure categories plus diagnostics.
- Domain D must prove v6F is not v6A ear clipping under a new name and must populate the currently zero-valued custom CDT diagnostics with real recovery/improvement evidence.
- Domain E still owns visible selector replacement, v6A/B/C removal from current comparison choices, preview/apply provenance, and final integration review.
- The exact user-observed hair/eye visual case is not automated in Domain A. Domain A uses representative shape fixtures, including the thin-tip fixture, and leaves visual/backend quality proof to downstream domains.
- The worktree contains render-webgl2 NEAREST changes from the accepted Wave68 baseline. Final Wave69 integration should continue to avoid rendering scope creep and should not revert that accepted change.

## Final Verdict

`pass`

Domain A satisfies the spec for the shared v6 contour salvage pipeline and method/contract surface. The v6D/E/F IDs are accepted through authoring-core and Operation Core, default behavior remains V2.6, the shared candidate input and diagnostics are deterministic on representative fixtures, v6A triangulation is not used by the shared pipeline, and backend/editor work is correctly deferred to later domains.
