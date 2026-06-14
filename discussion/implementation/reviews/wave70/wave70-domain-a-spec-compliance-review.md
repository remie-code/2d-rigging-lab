# Wave70 Domain A Spec Compliance Review

- Verdict: `pass`
- Fix Loop 1 re-review verdict: `pass`
- Review lane: Spec Compliance Review
- Domain: `wave70-v6d-support-rings-backend-method-contract`
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Scope Reviewed

Reviewed directly:

- `discussion/implementation/orchestration/wave70-plan.md`, especially sections 1-10 and 13-16.
- `discussion/design/mesh-generation/auto-outline-v6g-contour-band-support-rings.md`.
- `discussion/design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md`.
- `discussion/implementation/reviews/wave69/wave69-final-clean-integration-review.md`.
- `discussion/development_convention/schema-and-id-conventions.md`.
- `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts`, read directly as the new untracked file.
- Diff for `packages/authoring-core/src/mesh-generation-contract.ts`, `packages/authoring-core/src/mesh-generation.ts`, and `packages/authoring-core/src/mesh-generation.test.ts`.
- `discussion/implementation/waves/wave70/wave70-domain-a-v6d-support-rings-backend-method-contract-report.md`.
- `discussion/implementation/waves/wave70/_map.md`.

I did not edit production source. This review artifact is the only file written by this review.

## Basis Requirements Classification

| Requirement / basis item | Classification | Evidence |
|---|---|---|
| Add improved method id `auto-outline-v6d-contour-band-support-rings`. | implemented | Registered at `packages/authoring-core/src/mesh-generation-contract.ts:7`-`15` and candidate entry at `packages/authoring-core/src/mesh-generation-contract.ts:99`-`106`. |
| Add source id `outline-v6d-contour-band-support-rings-rgba`. | implemented | Registered at `packages/authoring-core/src/mesh-generation-contract.ts:17`-`25`; success metrics use it as requested/actual source at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:552`-`560`. |
| Use v6D lineage naming, not public `v6g` ids. | implemented | Method/source/backend ids are `v6d` lineage at `packages/authoring-core/src/mesh-generation-contract.ts:100`-`104`; `rg` found no public `v6g` ids in changed authoring-core source, only negative test assertions. |
| Implement in new file. | implemented | New file `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts` defines `createAutoOutlineV6DContourBandSupportRingsMesh` at line `164`. |
| Keep current old v6D `auto-outline-v6d-contour-constrainautor` available and test-covered. | implemented | Old v6D remains in the registry at `packages/authoring-core/src/mesh-generation-contract.ts:91`-`98`, route remains at `packages/authoring-core/src/mesh-generation.ts:168`, and tests remain at `packages/authoring-core/src/mesh-generation.test.ts:1845`-`1991`. Git diff for the old v6D file is empty. |
| Reuse shared v6 contour pipeline where appropriate. | implemented | New backend calls `createV6ContourCandidateInput` at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:167`-`173`. |
| Preserve v6D strengths: soft alpha mask, main component selection, boundary tracing/sampling, constrained triangulation. | implemented | Shared contour pipeline provides the contour input; new backend sends support-ring points and constraints to Constrainautor recovery at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:210`-`213`. |
| Add outer support ring, alpha boundary ring, and inner ring when safe. | implemented | Ring construction and safe inner-ring skip/merge behavior are at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:337`-`446`; generated counts are returned at lines `486`-`501`. |
| Preset tuning affects support offsets and/or density. | implemented | Offset selection is exposed through diagnostics and tested at `packages/authoring-core/src/mesh-generation.test.ts:2153`-`2187`. |
| Mesh vertices may extend outside layer bounds while UVs remain deterministic and valid. | implemented | Outer-ring UVs project to alpha-boundary points at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:409`-`416` and UV generation uses `uvPoint` at lines `527`-`529`; outside-bounds/valid-UV test is at `packages/authoring-core/src/mesh-generation.test.ts:2189`-`2235`. |
| Outer-ring UV policy is explicit. | implemented | Diagnostic type and value are `projected-to-alpha-boundary` at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:112` and `756`; test asserts it at `packages/authoring-core/src/mesh-generation.test.ts:2109` and `2228`. |
| Triangle filtering must not delete triangles merely because their centroid is outside alpha. | implemented | Filter classifies outside-alpha but inside-envelope triangles as support-band triangles at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:684`-`704`; probe test covers it at `packages/authoring-core/src/mesh-generation.test.ts:2237`-`2273`. |
| Diagnostics include ring counts, skipped/merged counts, constraints, support/interior counts, outside-layer state, and max distance. | implemented | Fix Loop 1 moved support-ring fields into typed `MeshGenerationV6SupportRingDiagnostics` at `packages/authoring-core/src/mesh-quality-metrics.ts:199`-`216`, emitted via `v6Metrics.supportRingDiagnostics` at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:611`-`637` and `676`-`706`, and populated at lines `792`-`820`. |
| Invalid/self-intersecting ring geometry returns structured fallback/diagnostics instead of misleading success. | implemented | Geometry failure returns `v6d-support-ring-geometry-invalid`; Fix Loop 1 adds a fallback-output probe at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:300`-`370` and test coverage at `packages/authoring-core/src/mesh-generation.test.ts:2269`-`2327`. |
| Quality/fallback metadata distinguishes backend output from fallback and blocked output. | implemented | Backend output is `outputKind: "backend-output"` at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:611`-`619`; fallback output is `outputKind: "fallback-output"` at lines `676`-`688`; blocked output remains covered at `packages/authoring-core/src/mesh-generation.test.ts:2331`-`2428`. |
| Operation-core provenance/preview contract preserves support-ring diagnostics. | implemented | Fix Loop 1 adds preview payload validation at `packages/operation-core/src/payloads/model-edit.ts:189`-`205` and `260`-`274`, transform-history serialization at `packages/operation-core/src/operations/generate-mesh.ts:519`-`523` and `571`-`597`, and success/preview/blocked assertions at `packages/operation-core/src/operations/generate-mesh.test.ts:493`-`520`, `874`-`921`, and `1177`-`1199`. This is Domain A provenance/contract scope, not Editor UI work. |
| New method is routed through public drawable mesh generation. | implemented | Dispatch route is at `packages/authoring-core/src/mesh-generation.ts:178`-`185`; result adapter starts at `packages/authoring-core/src/mesh-generation.ts:1383`. |
| No new dependencies. | implemented | Manifest/lockfile diff reviewed as empty; candidate uses existing `delaunator` and `@kninnug/constrainautor` at `packages/authoring-core/src/mesh-generation-contract.ts:103`-`104`. |
| Do not mutate the old v6D file as the improved implementation path. | implemented | Old v6D source diff is empty. The new file imports `recoverV6DConstrainautorTriangles` at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:20`-`23`, but support-ring geometry, UV policy, filtering, diagnostics, and fallback handling are implemented in the new file. |
| Do not delete old v6D, v6E, or v6F. | implemented | Old v6D registry and route remain; diff for old v6D/v6E/v6F backend files is empty. |
| Do not reuse v6A ear clipping, fan fallback, or row-major interior placement for the new backend. | implemented | `rg` over the new backend found no `earClip`, `fan`, `row-major`, or `splitTrianglesWithInteriorPoints` matches; tests also assert support-ring provenance does not contain `earclip`, `fan`, or `split` at `packages/authoring-core/src/mesh-generation.test.ts:2147`. |
| Do not expand into renderer texture padding/dilation or renderer feature work. | implemented | Diff for `packages/render-webgl2/**` is empty. |
| Do not perform Editor UI/default selector work in Domain A. | implemented / explicit non-goal | Diff for `apps/editor/**` is empty. Domain B owns selector/default work. |
| Editor default becomes support-ring v6D and selector removed. | deferred by plan | Wave70 sections 11 and 13 assign this to Domain B, not Domain A. |
| Side-by-side visual diff, v6E/v6F development, renderer work, Cubism compatibility, external transports, LLM provider integration. | explicit non-goal | Wave70 section 16 marks these out of scope; no related source diffs were present. |
| Schema/ID policy: machine-readable ids have no spaces and avoid Cubism schema/oracle expansion. | implemented | Added IDs are kebab-case, space-free, project-local method/source/backend ids; no Cubism schema or SDK/Core usage was added. |

## Findings

No blocking or required-change findings.

| ID | Severity | Finding | Evidence / disposition |
|---|---|---|---|
| W70-A-SPEC-I-001 | informational | The new backend imports the old v6D Constrainautor recovery helper. This is acceptable for this spec lane because old v6D source was not modified and the improved support-ring path is implemented in the new file. | Import at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:20`-`23`; call at lines `210`-`213`; support-ring geometry/filtering/diagnostics live in the new file at lines `313`-`504` and `660`-`756`. This is a future refactor coupling risk, not an old-v6D preservation violation. |
| W70-A-SPEC-I-002 | resolved in Fix Loop 1 | One legacy v6A test had used the outside-bounds-permissive helper. | Fix Loop 1 restored strict `expectValidMeshDto` for the v6A representative fixtures at `packages/authoring-core/src/mesh-generation.test.ts:1291`-`1296` and removed the duplicated alpha-bounds check. No remaining spec concern. |

## Fix Loop 1 Re-review

Verdict remains `pass`.

Additional scope reviewed:

- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- Updated `discussion/implementation/waves/wave70/wave70-domain-a-v6d-support-rings-backend-method-contract-report.md`

Fix Loop 1 did not regress spec compliance:

| Check | Result | Evidence |
|---|---|---|
| Support-ring diagnostics are typed/contracted. | Pass | `MeshGenerationV6Metrics.supportRingDiagnostics` is typed at `packages/authoring-core/src/mesh-quality-metrics.ts:172`; `MeshGenerationV6SupportRingDiagnostics` is defined at lines `199`-`216`; operation preview payload validates the same shape at `packages/operation-core/src/payloads/model-edit.ts:189`-`205` and attaches it at line `272`. |
| Support-ring diagnostics no longer overload base Constrainautor diagnostics. | Pass | New backend returns paired `constrainautorDiagnostics` and `supportRingDiagnostics` at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:97`-`100`, emits both on backend/fallback output at lines `635`-`636` and `705`-`706`, and builds the two objects separately at lines `792`-`820`. |
| v6D lineage naming is preserved and public `v6g` ids are absent. | Pass | `rg` over changed authoring-core and operation-core files found no `auto-outline-v6g` or `outline-v6g`; the only `v6g` hits are negative assertions in `packages/authoring-core/src/mesh-generation.test.ts:2115`-`2149`. |
| Old v6D remains preserved. | Pass | Diff for `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts` is empty; old v6D registry/route/tests remain at `packages/authoring-core/src/mesh-generation-contract.ts:91`-`98`, `packages/authoring-core/src/mesh-generation.ts:168`, and `packages/authoring-core/src/mesh-generation.test.ts:1844`-`1990`. |
| Operation-core changes remain Domain A provenance/contract scope. | Pass | Payload validation and transform-history serialization only carry preview/provenance diagnostics: `packages/operation-core/src/payloads/model-edit.ts:189`-`205`, `packages/operation-core/src/operations/generate-mesh.ts:519`-`523` and `571`-`597`; no `apps/editor/**` diff exists. |
| Fallback-output coverage exists for invalid support-ring geometry. | Pass | Probe source is at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:300`-`370`; test asserts `fallback-output`, fallback reason, typed diagnostics, and non-backend output at `packages/authoring-core/src/mesh-generation.test.ts:2269`-`2327`. |
| Old v6A strict baseline test was restored. | Pass | v6A representative fixture test uses strict `expectValidMeshDto` again at `packages/authoring-core/src/mesh-generation.test.ts:1291`-`1296`. |

## Validation Reviewed Or Rerun

Reviewed Orch-Sylph validation summary:

| Command | Reviewed result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts --reporter=dot` | Sandbox failed with esbuild `spawn EPERM`; outside-sandbox rerun passed 59 tests. |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Outside-sandbox passed 29 tests. |
| `pnpm.cmd typecheck` | Passed. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `git diff --check -- packages/authoring-core/src/mesh-generation-contract.ts packages/authoring-core/src/mesh-generation.ts packages/authoring-core/src/mesh-generation.test.ts packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts discussion/implementation/waves/wave70` | Passed with CRLF working-copy warnings only. |
| Manifest/lockfile diff | Empty. |

Fix Loop 1 validation reviewed:

| Command | Reviewed result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Outside-sandbox pass, 2 files / 90 tests, after known sandbox esbuild `spawn EPERM`. |
| `pnpm.cmd typecheck` | Passed. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `git diff --check -- <Domain A files + reviews>` | Passed with CRLF working-copy warnings only. |
| Manifest/lockfile diff | Empty. |

Reviewer reran:

| Command | Result |
|---|---|
| `node scripts/check-source-organization.mjs` | Pass. |
| `git diff --check -- packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts packages/authoring-core/src/mesh-quality-metrics.ts packages/authoring-core/src/mesh-generation-contract.ts packages/authoring-core/src/mesh-generation.ts packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/payloads/model-edit.ts packages/operation-core/src/operations/generate-mesh.ts packages/operation-core/src/operations/generate-mesh.test.ts discussion/implementation/waves/wave70 discussion/implementation/reviews/wave70` | Pass; CRLF working-copy warnings only. |
| `git diff -- package.json pnpm-lock.yaml packages/authoring-core/package.json packages/operation-core/package.json` | Empty diff. |
| `git diff -- packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts packages/render-webgl2 apps/editor` | Empty diff. |
| `rg -n "v6g\|auto-outline-v6g\|outline-v6g" ...changed authoring-core and operation-core files...` | Only negative test assertions matched. |

I did not rerun the heavy Vitest or typecheck commands because the orchestrator had already rerun them outside sandbox after the known esbuild `spawn EPERM` sandbox failure.

## Residual Risks

- Visual quality remains a later Domain C / human review risk. Domain A proves method contract and deterministic support-ring behavior, not final artwork quality.
- The support-ring backend is coupled to the old v6D recovery helper. That does not violate this spec, but a later design/development refactor may want a shared Constrainautor recovery module.
- Operation-core transform history now has support-ring-specific metadata keys. This remains provenance/contract scope and is covered by tests, but downstream consumers that parse transform history should treat these as additive v6 metrics.

## User-Decision Points

- None required for Domain A acceptance.
- Later visual review may decide whether support-ring offsets need tuning before default promotion.
- Domain B still owns whether and how the Editor default/selector UX moves to the improved v6D method.

## Recommendation

Accept Domain A as `pass` for Spec Compliance Review after Fix Loop 1. The improved v6D support-ring backend/method contract satisfies the Wave70 Domain A requirements, the Fix Loop 1 diagnostics/provenance additions remain in Domain A scope, old v6D remains preserved, and forbidden Editor/renderer/dependency scope was not entered.
