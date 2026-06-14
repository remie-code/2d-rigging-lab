# Wave69 Domain D Spec Compliance Review

- verdict: `pass`
- Wave: `mesh-generation-v6-contour-salvage-triangulation-candidates`
- Domain: `wave69-mesh-auto-outline-v6f-custom-constrained-triangulation`
- Review lane: Spec Compliance Review
- Reviewer: Review-Sylph
- Date: 2026-06-14

## Scope Reviewed

Basis reviewed directly:

- `discussion/implementation/orchestration/wave69-plan.md`
- `discussion/design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md`
- `discussion/implementation/waves/wave69/wave69-domain-a-v6-contour-salvage-shared-pipeline-method-surface-report.md`
- `discussion/implementation/waves/wave69/wave69-domain-d-mesh-auto-outline-v6f-custom-constrained-triangulation-report.md`

Source and diffs reviewed directly:

- `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts`
- `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts`
- `packages/authoring-core/src/mesh-generation.ts`, scoped to v6F routing and fallback/metrics plumbing
- `packages/authoring-core/src/mesh-generation.test.ts`, scoped to v6F and deferred-candidate expectations
- `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`, scoped to method/source IDs and canonical candidate status
- Relevant `git diff` for the listed files

## Findings

No needs-fix spec compliance findings were found for Domain D.

Fix Loop 1 refresh finding:

| ID | Severity | Status | Finding | Evidence |
|---|---|---|---|---|
| D-SPEC-FIX-1 | review-refresh | implemented | The prior non-blocking v6F registry/status item is resolved. v6F is now `implemented` in the canonical candidate registry, and the v6F generation route no longer needs a route-local `backendImplementationStatus` override. | Canonical registry: `packages/authoring-core/src/mesh-generation-contract.ts:105-110`; v6F route dispatch: `packages/authoring-core/src/mesh-generation.ts:187-188`; route candidate lookup without local status override: `packages/authoring-core/src/mesh-generation.ts:1375-1382`; contract test expects v6F `implemented`: `packages/authoring-core/src/mesh-generation.test.ts:1154-1159`; focused v6F tests still assert generated and blocked metrics as `implemented`: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:66-70`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:148-150`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:179-180`. |

## Basis Coverage Table

| Basis Requirement | Classification | Evidence / Notes |
|---|---|---|
| Implement `auto-outline-v6f-contour-custom-cdt` as the Domain D custom constrained triangulation candidate. | implemented | v6F has method/source IDs in the contract: `packages/authoring-core/src/mesh-generation-contract.ts:7-22`; headless generation routes v6F before deferred fallback: `packages/authoring-core/src/mesh-generation.ts:187-197`; successful output uses `outline-v6f-contour-custom-cdt-rgba`: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:49-52`. |
| Use the shared v6 contour salvage pipeline as input. | implemented | v6F calls `createV6ContourCandidateInput`: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:126-130`; Domain A shared input carries boundary points, constraint edges, interior points, alpha bounds, mask, and diagnostics: `discussion/implementation/waves/wave69/wave69-domain-a-v6-contour-salvage-shared-pipeline-method-surface-report.md:83`. |
| Consume shared contour boundary points, interior / Steiner points, mask, and diagnostics. | implemented | Shared pipeline emits boundary points, constraint edges, interior points, main mask, and diagnostics: `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:56-68`, `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:200-239`; v6F builds triangulation from `candidateInput`: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:159-160`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:249-255`. |
| Implement a new custom triangulation path, not v6A ear clipping under a new name. | implemented | v6F builds a constrained planar edge graph and local edge-flip improvement path: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:272-300`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:352-435`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:498-607`. Firebreak `rg` over v6F/shared routing found no `earClipPolygon`, fan fallback, `splitTrianglesWithInteriorPoints`, row-major, or v6A local triangulation terms. |
| Ensure all selected boundary and interior points participate from the start or through a global retriangulation step. | implemented | v6F seeds boundary plus interior points before edge graph construction: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:252-255`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:650-679`; it rejects output when any seeded point is unused: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:308-340`; focused tests assert every mesh vertex is used: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:104-105`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:234-242`. |
| Track boundary edges as hard constraints. | implemented | Shared pipeline creates consecutive boundary constraints: `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:180-238`, `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:610-615`; v6F seeds boundary constraints before candidate edges, excludes them from flips, verifies preservation, and fails on missing constraints: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:255-259`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:515-517`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:541-542`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:308-329`. |
| Use a defensible custom strategy such as all-points triangulation plus constraint preservation and deterministic local improvement. | implemented | The implementation seeds all points, constructs deterministic non-crossing candidate edges, extracts accepted triangles, and performs constrained-edge-preserving flips: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:249-350`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:428-435`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:498-607`. This matches the plan's "small defensible v0" acceptance, not a full industrial CDT. |
| Penalize or improve long boundary-to-boundary spokes when a better local edge exists. | implemented | Long boundary spokes are counted and penalized in edge scoring: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:395-424`; local flips can improve long spokes and count rejected attempts: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:532-593`; test asserts long spoke candidates are counted and final long boundary chords are absent on the rectangle fixture: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:109-127`. |
| Validate triangles and filter invalid / outside output. | implemented | Triangle extraction and final filtering reject degenerate, duplicate, outside, or crossing triangles through `isTriangleAccepted` and `filterAcceptedTriangles`: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:475-486`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:610-640`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:689-724`. DTO invariant tests check index validity and non-duplicate triangle vertices: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:191-231`. |
| Surface v6F-specific metrics: edge flips, constraint recovery operations, long-spoke candidates, rejected improvements, and custom fallback reason. | implemented | Metric shape includes all required v6F fields: `packages/authoring-core/src/mesh-quality-metrics.ts:211-220`; success metrics populate them: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:227-237`; failure metrics preserve the fallback reason: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:759-767`; tests assert success and blocked diagnostics: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:79-105`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:147-184`. |
| Return structured failure or visible fallback when custom triangulation cannot truthfully succeed. | implemented | Missing constraints, invalid contour input, empty triangle output, or unused selected points return failed/blocked results with provenance: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:260-268`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:322-340`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:852-859`; mesh-generation fallback keeps visible `fallbackReason` and v6F diagnostics: `packages/authoring-core/src/mesh-generation.ts:1416-1427`, `packages/authoring-core/src/mesh-generation.ts:1430-1527`. |
| Treat v6F as a first-class comparison output, not fallback-only. | implemented | `createGeneratedMeshForDrawable` has a v6F route before deferred fallback: `packages/authoring-core/src/mesh-generation.ts:187-197`; the canonical registry marks v6F implemented: `packages/authoring-core/src/mesh-generation-contract.ts:105-110`; generated v6F uses `outputKind: "backend-output"` and v6F source ID: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:200-214`; tests assert no fallback for representative generated fixtures: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:24-52`. |
| Generate deterministic DTO-valid meshes on representative fixtures. | implemented | Focused tests generate twice and compare equality for rectangle, curved blob, thin tapered, and hole-like fixtures: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:24-49`; DTO validity is checked at `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:191-231`. |
| Do not use v6A ear clipping, fan fallback, `splitTrianglesWithInteriorPoints`, or row-major interior placement as algorithm basis. | implemented | v6F production source imports shared contour pipeline and metrics/contract surfaces, not v6A code: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:1-21`; review firebreak `rg` over v6F, shared contour pipeline, and routing found no forbidden terms. |
| Do not accept long spokes only because triangle centroids are inside the mask. | implemented | Segment and triangle acceptance checks use polygon/mask sampling and edge crossing checks, while long spokes are separately penalized/flipped: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:404-424`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:532-579`, `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:689-724`. |
| Do not overfit only the observed eye/hair screenshot case. | implemented | Automated fixtures cover simple rectangle, curved blob, thin tapered, and hole-like masks rather than a single screenshot: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:24-31`; plan does not require pixel-perfect visual oracle in Domain D. |
| Do not make v6F the default. | implemented | Editor default remains `auto-outline-v2.6-soft-apron`: `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:73-83`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:275-279`; Wave69 explicitly forbids making v6F default: `discussion/implementation/orchestration/wave69-plan.md:280`. |
| Editor selector replacement from v6A/B/C to v6D/v6E/v6F. | deferred by plan | Domain E owns selector replacement and final integration: `discussion/implementation/orchestration/wave69-plan.md:100`, `discussion/implementation/orchestration/wave69-plan.md:132`; Domain D report defers selector work to Domain E: `discussion/implementation/waves/wave69/wave69-domain-d-mesh-auto-outline-v6f-custom-constrained-triangulation-report.md:91-93`. |
| Final backend selection or default promotion. | explicit non-goal | Wave69 keeps final backend adoption outside this wave and default unchanged: `discussion/implementation/orchestration/wave69-plan.md:14-15`, `discussion/implementation/orchestration/wave69-plan.md:580`; design doc says default remains unchanged unless separately decided: `discussion/design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md:421`. |
| Full robust CDT / every pathological alpha mask in v0. | explicit non-goal | Wave69 out of scope includes full support for every pathological alpha mask in v0: `discussion/implementation/orchestration/wave69-plan.md:594`; Domain D report records medium residual geometry risk rather than claiming a complete industrial CDT: `discussion/implementation/waves/wave69/wave69-domain-d-mesh-auto-outline-v6f-custom-constrained-triangulation-report.md:84-88`. |

## Must-Not Checks

- v6A triangulation firebreak passed: `rg -n "earClipPolygon|triangulateBoundaryFan|splitTrianglesWithInteriorPoints|row-major|v6a-local-earclip|v6a-local-deterministic-interior|fan fallback"` over v6F/shared routing returned no matches.
- Default was not switched to v6F: Editor defaults still use `auto-outline-v2.6-soft-apron` at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:73-83` and `apps/editor/src/features/editor-session/model/editor-session-commands.ts:275-279`.
- Fallback is not hidden as backend success: generated output has `outputKind: "backend-output"` only on v6F success, while blocked/fallback paths carry fallback reason and custom diagnostics: `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts:200-237`, `packages/authoring-core/src/mesh-generation.ts:1430-1527`.

## Validation Reviewed

Reviewed from Domain D report and Orchestrator verification:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts --reporter=dot` | Initial sandbox `spawn EPERM`; outside-sandbox rerun passed: 1 file / 3 tests. |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts --reporter=dot` | Passed: 1 file / 54 tests. |
| `pnpm.cmd typecheck` | Passed. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| v6F firebreak `rg` | No forbidden v6A triangulation matches. |
| Scoped `git diff --check` | Passed; CRLF working-copy warnings only. |

Executed in this review lane:

| Command | Result |
|---|---|
| Source `rg` inspections over v6F, shared contour pipeline, metrics, routing, tests, and contract status | Completed; evidence cited above. |
| Scoped `git diff --check` over the reviewed Domain D/shared files | Exit 0; CRLF warnings only. |
| Non-required `packages/operation-core/src/operations/generate-mesh.test.ts` status | Reported failure is limited to a v6E registry/route mismatch, not v6F Domain D. No Domain D blocker. |

## Residual Risks And Integration Items

| ID | Type | Status | Item |
|---|---|---|---|
| D-RISK-1 | residual risk | accepted by plan | v6F is a small deterministic v0 custom triangulator, not a complete robust CDT engine. It truthfully falls back on missing constraints or unused selected points. |
| D-RISK-2 | residual risk | accepted by plan | Hole-like regions are handled through shared main-mask filtering and limitation metadata, not explicit hole constraints. This matches current v0 scope and Domain D report risk. |
| D-RISK-3 | final visual comparison | deferred by plan | Automated tests prove determinism, DTO validity, point participation, boundary preservation, and a long-spoke proxy. Human visual selection of the final backend remains outside Domain D. |

## User-Decision Points

None for Domain D spec compliance. Final backend promotion remains a later user decision after v6D/v6E/v6F comparison.
