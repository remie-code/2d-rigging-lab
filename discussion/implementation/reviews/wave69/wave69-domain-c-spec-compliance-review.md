# Wave69 Domain C Spec Compliance Review

- verdict: `pass`
- Wave: `mesh-generation-v6-contour-salvage-triangulation-candidates`
- Domain: `wave69-mesh-auto-outline-v6e-contour-poly2tri`
- Review lane: Spec Compliance Review
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Scope Reviewed

Basis reviewed directly:

- `discussion/implementation/orchestration/wave69-plan.md`
- `discussion/design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md`
- `discussion/implementation/waves/wave69/wave69-domain-a-v6-contour-salvage-shared-pipeline-method-surface-report.md`
- `discussion/implementation/waves/wave69/wave69-domain-c-mesh-auto-outline-v6e-contour-poly2tri-report.md`

Source and diffs reviewed directly:

- `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts`
- `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts`
- `packages/authoring-core/src/mesh-generation.ts`, scoped to v6E routing and fallback/metrics plumbing
- `packages/authoring-core/src/mesh-generation.test.ts`, scoped to v6E/deferred-candidate updates
- `packages/authoring-core/src/mesh-generation-contract.ts`, scoped to v6E candidate status/source IDs
- `packages/authoring-core/src/mesh-quality-metrics.ts`, scoped to v6E metric shape
- Relevant `git diff` for the Domain C files and shared v6 contract/metrics surfaces

## Findings

No needs-fix spec compliance findings were found for Domain C.

Non-blocking integration finding:

| ID | Severity | Status | Finding | Evidence |
|---|---|---|---|---|
| C-SPEC-INT-1 | integration | deferred by plan | `mesh-generation-contract.ts` still marks v6E `backendImplementationStatus` as `deferred`, and generated v6E metrics copy that value. This is internally stale after Domain C implements the backend, but it is not a Domain C blocking spec issue because the Wave69 plan tells B/C/D to avoid overlapping shared contour/contract edits after Domain A and to report shared contract needs for integration. Domain E or the shared contract owner should flip v6E to `implemented` after cross-domain integration. | Plan integration rule: `discussion/implementation/orchestration/wave69-plan.md:130`; v6E contract status: `packages/authoring-core/src/mesh-generation-contract.ts:97`; metric copy: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:284`; Domain C report integration item: `discussion/implementation/waves/wave69/wave69-domain-c-mesh-auto-outline-v6e-contour-poly2tri-report.md:84`, `discussion/implementation/waves/wave69/wave69-domain-c-mesh-auto-outline-v6e-contour-poly2tri-report.md:89` |

## Basis Coverage Table

| Basis Requirement | Classification | Evidence / Notes |
|---|---|---|
| Domain C implements `auto-outline-v6e-contour-poly2tri` using the shared contour pipeline and Poly2Tri backend. | implemented | v6E entrypoint calls `createV6ContourCandidateInput` before backend work and routes through `poly2tri.SweepContext`: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:144`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:148`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:560`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:642`. |
| Use Domain A shared v6 contour salvage pipeline. | implemented | v6E imports only the shared contour pipeline surface, not v6A implementation: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:9`. Domain A report records the shared pipeline as pass: `discussion/implementation/waves/wave69/wave69-domain-a-v6-contour-salvage-shared-pipeline-method-surface-report.md:19`. |
| Quantize/dedupe contour and interior points. | implemented | Boundary points are rounded/deduped and short/collinear edges cleaned; interior points are deduped against boundary and sorted deterministically: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:450`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:470`. Test coverage: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts:161`. |
| Validate simple polygon preconditions before triangulation. | implemented | Validation checks too few points, zero area, zero-length edges, duplicates, and self-intersection before triangulation: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:499`; invalid validation returns blocked output: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:200`. |
| Normalize winding. | implemented | Sanitized loop is reversed when signed area is negative, preserving a deterministic first point: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:462`. Provenance records normalized winding: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:750`. |
| Use interior samples as Steiner points. | implemented | Sanitized interior points are converted into indexed Poly2Tri points and passed to `addPoints`: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:548`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:561`. Test asserts Steiner count and stable IDs: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts:72`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts:87`. |
| Either support holes or report clear no-hole limitation through metadata. | implemented | v6E blocks hole-like inputs with `holeHandling: "unsupported-fallback"`, `holeValidationFailed: true`, and explicit limitation provenance: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:178`; test asserts no backend success for hole-like input: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts:90`. |
| Report main-island-only / multi-island limitation through metadata. | implemented | v6E carries `multiIslandHandling` from the shared pipeline, sets `mainIslandOnlyFallback`, and adds `limitation-main-island-only` provenance on backend output when applicable: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:175`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:308`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:755`. |
| Polygon validation failure must be visible and not masquerade as success. | implemented | Invalid polygon preconditions return `status: "blocked"` and `polygonValidationFailed: true`: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:200`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:210`; test asserts blocked self-intersection: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts:125`. |
| Poly2Tri throw and invalid backend output must not masquerade as success. | implemented | Poly2Tri exceptions return blocked diagnostics with `triangulationThrown`; missing boundary edges or empty output block the result: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:574`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:630`; test asserts throw is blocked: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts:139`. |
| Boundary and coverage verification. | implemented | Triangle cleanup rejects duplicate/degenerate/outside-or-crossing triangles; boundary edge preservation is counted and missing edges block success: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:592`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:603`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:622`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:665`. |
| Backend diagnostics and quality metrics are populated. | implemented | Success metrics include method/source/backend/output kind/counts/contour diagnostics/poly2tri diagnostics: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:284`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:310`; metric shape supports Poly2Tri fields: `packages/authoring-core/src/mesh-quality-metrics.ts:146`, `packages/authoring-core/src/mesh-quality-metrics.ts:198`. Contract status caveat is C-SPEC-INT-1. |
| Preserve deterministic output and Mesh DTO invariants. | implemented | Dedicated test generates twice and asserts equality plus DTO invariants: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts:21`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts:33`, `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts:42`. |
| Route headless v6E generation through the implemented backend. | implemented | `createGeneratedMeshForDrawable` dispatches `auto-outline-v6e-contour-poly2tri` to `createV6EContourPoly2TriMeshResult`, which returns backend output on generated status and visible fallback otherwise: `packages/authoring-core/src/mesh-generation.ts:177`, `packages/authoring-core/src/mesh-generation.ts:1173`, `packages/authoring-core/src/mesh-generation.ts:1202`, `packages/authoring-core/src/mesh-generation.ts:1211`. |
| v6A triangulation firebreak: no `earClipPolygon`, fan fallback, `splitTrianglesWithInteriorPoints`, or row-major interior placement as algorithm basis. | implemented | Production v6E imports are limited to Poly2Tri, shared contour pipeline, contract, and metrics: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:1`. `rg` over the v6E production file found no forbidden terms. Test provenance also asserts no earclip/fan/split/row-major terms: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts:86`. |
| Do not make v6E the default. | implemented | Editor defaults remain V2.6: `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:73`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:274`; no Editor diff was present for these files. |
| Browser/Vite import behavior remains stable or risk is reported. | implemented | v6E uses the same namespace import style as existing v6C Poly2Tri and `poly2tri` is already an authoring-core dependency: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:3`, `packages/authoring-core/package.json:16`. Focused Vitest loaded the Vite/Vitest config outside sandbox and passed. No browser manual run was performed in this lane; residual risk is listed below. |
| No new dependency without policy compliance. | implemented | `poly2tri` already exists in `packages/authoring-core/package.json:16` and the lockfile. Domain C report states no install was run: `discussion/implementation/waves/wave69/wave69-domain-c-mesh-auto-outline-v6e-contour-poly2tri-report.md:62`. |
| Editor selector replacement from v6A/B/C to v6D/E/F. | deferred by plan | Wave69 assigns selector replacement/final integration to Domain E: `discussion/implementation/orchestration/wave69-plan.md:131`, `discussion/implementation/orchestration/wave69-plan.md:132`. |
| Final backend selection/default promotion. | explicit non-goal | Wave69 plan explicitly keeps final backend selection outside this wave and default unchanged: `discussion/implementation/orchestration/wave69-plan.md:45`, `discussion/design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md:421`. |
| Full true hole support for v6E v0. | explicit non-goal | The plan allows either hole support or clear no-hole limitation metadata: `discussion/implementation/orchestration/wave69-plan.md:229`; implementation chooses visible unsupported fallback. |

## Must-Not Checks

- Default not switched: verified from Editor state and command defaults at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:73` and `apps/editor/src/features/editor-session/model/editor-session-commands.ts:274`.
- Invalid polygon / hole limitations do not masquerade as success: invalid polygon and hole-like paths return blocked results, with diagnostics and provenance at `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:178` and `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:200`.
- v6A triangulation firebreak: v6E source imports shared contour pipeline and Poly2Tri only; `rg` over the v6E production file found no forbidden v6A triangulation terms.

## Validation Reviewed

Executed in this review:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts --reporter=dot` | Initial sandbox run failed with esbuild `spawn EPERM`; approved outside-sandbox rerun passed: 1 file / 4 tests. |
| `git diff --check -- packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts packages/authoring-core/src/mesh-generation.ts packages/authoring-core/src/mesh-generation.test.ts packages/authoring-core/src/mesh-generation-contract.ts packages/authoring-core/src/mesh-quality-metrics.ts discussion/implementation/waves/wave69/wave69-domain-c-mesh-auto-outline-v6e-contour-poly2tri-report.md` | pass; Git emitted CRLF working-copy warnings for existing package files. |

Reviewed but not re-executed in this lane:

- Domain C report states `pnpm.cmd typecheck`, source organization guard, dependency guard, and scoped diff check passed: `discussion/implementation/waves/wave69/wave69-domain-c-mesh-auto-outline-v6e-contour-poly2tri-report.md:71`.

## Residual Risks And Integration Items

| ID | Type | Status | Item |
|---|---|---|---|
| C-INT-1 | integration | open | Flip v6E `V6_MESH_GENERATION_CANDIDATES` `backendImplementationStatus` from `deferred` to `implemented` in Domain E or shared contract integration. This is not blocking Domain C because the Wave69 plan directs B/C/D to avoid overlapping shared contract edits after Domain A. |
| C-INT-2 | integration | open | If the final UX needs a sharper user-facing reason for unsupported holes, add a dedicated contract fallback reason such as `v6e-poly2tri-hole-unsupported`. Current implementation is spec-compliant because diagnostics and provenance clearly expose `unsupported-fallback` and hole validation failure. |
| C-RISK-1 | residual risk | accepted for this lane | Browser/Vite stability was checked by import shape, existing dependency surface, and focused Vitest config load. No browser app run was performed by this spec lane; Domain E/final integration should include broader app validation if required. |
| C-RISK-2 | residual risk | accepted by plan | v6E blocks hole-like masks rather than implementing true holes. This is allowed by the plan as long as metadata is visible, which it is. |
| C-RISK-3 | test-lane consideration | non-blocking | `mesh-generation.ts` v6E routing was source-reviewed, but the dedicated v6E test exercises the backend function directly. Test Adequacy Review can decide whether a headless `createGeneratedMeshForDrawable` v6E success test is needed. |

## User-Decision Points

None for Domain C spec compliance. Future product decisions remain outside this lane:

- Whether v6E should ever support true holes instead of visible blocked fallback.
- Which v6D/v6E/v6F backend, if any, should become the final default after visual comparison.
