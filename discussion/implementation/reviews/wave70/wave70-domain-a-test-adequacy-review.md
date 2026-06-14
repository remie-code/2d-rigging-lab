# Wave70 Domain A Test Adequacy Review

- Verdict: `pass`
- Fix Loop 1 Verdict: `pass`
- Review lane: Test Adequacy Review
- Target: `wave70-v6d-support-rings-backend-method-contract`
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Scope Reviewed

Reviewed directly:

- `discussion/implementation/orchestration/wave70-plan.md` sections 1-10 and 13-16, especially Domain A and the verification matrix.
- `discussion/design/mesh-generation/auto-outline-v6g-contour-band-support-rings.md`.
- `discussion/design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md`.
- `discussion/implementation/reviews/wave69/wave69-final-clean-integration-review.md`.
- `discussion/development_convention/source-file-organization-policy.md`.
- `discussion/development_convention/operation-policy.md`.
- `discussion/implementation/waves/wave70/wave70-domain-a-v6d-support-rings-backend-method-contract-report.md`.
- Changed source and tests:
  - `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts`
  - `packages/authoring-core/src/mesh-generation-contract.ts`
  - `packages/authoring-core/src/mesh-quality-metrics.ts`
  - `packages/authoring-core/src/mesh-generation.ts`
  - `packages/authoring-core/src/mesh-generation.test.ts`
  - `packages/operation-core/src/payloads/model-edit.ts`
  - `packages/operation-core/src/operations/generate-mesh.ts`
  - `packages/operation-core/src/operations/generate-mesh.test.ts`

I did not edit production code. This artifact is the only file written by this review.

## Fix Loop 1 Re-Review

Re-reviewed the three original `needs_changes` findings against the Fix Loop 1 diff and updated Domain A report.

| Original finding | Re-review result | Evidence |
|---|---|---|
| Missing support-ring fallback-output coverage. | Resolved | Authoring-core now has `reports v6d support-ring invalid geometry as structured fallback output` at `packages/authoring-core/src/mesh-generation.test.ts:2269`; it asserts `fallback-output`, method/source/backend IDs, fallback reason, fallback steps, Constrainautor diagnostics, support-ring diagnostics, and absence of `backend-output`. |
| Old v6A baseline was weakened. | Resolved | The v6A representative fixture test is back on the strict `expectValidMeshDto` helper at `packages/authoring-core/src/mesh-generation.test.ts:1291`, preserving the inside-bounds assertion in `expectValidMeshDto` at `packages/authoring-core/src/mesh-generation.test.ts:3517`. |
| Operation-core tests underasserted support-ring provenance. | Resolved | Operation-core now has support-ring backend success assertions at `packages/operation-core/src/operations/generate-mesh.test.ts:493`, includes support-ring in empty/missing blocked candidate filters at `packages/operation-core/src/operations/generate-mesh.test.ts:626` and `packages/operation-core/src/operations/generate-mesh.test.ts:675`, and covers preview provenance diagnostics at `packages/operation-core/src/operations/generate-mesh.test.ts:874`. |

The diagnostics contract concern is also addressed: support-ring diagnostics are typed at `packages/authoring-core/src/mesh-quality-metrics.ts:199`, validated in operation-core preview provenance at `packages/operation-core/src/payloads/model-edit.ts:189`, and formatted into operation transform history at `packages/operation-core/src/operations/generate-mesh.ts:571`.

## Acceptance-To-Test Coverage

| Acceptance / required area | Coverage status | Evidence / gap |
|---|---|---|
| New method/source/backend IDs exist and are routed. | Covered | Contract arrays and candidate registry include `auto-outline-v6d-contour-band-support-rings`, `outline-v6d-contour-band-support-rings-rgba`, and `v6d-contour-band-support-rings` at `packages/authoring-core/src/mesh-generation-contract.ts:7`, `packages/authoring-core/src/mesh-generation-contract.ts:17`, `packages/authoring-core/src/mesh-generation-contract.ts:27`, and `packages/authoring-core/src/mesh-generation-contract.ts:99`. Public dispatch routes the method at `packages/authoring-core/src/mesh-generation.ts:178`. |
| New file implements support-ring path. | Covered enough for test lane | The new backend creates support-ring geometry, Delaunator/Constrainautor recovery, support-envelope filtering, DTOs, fallback output, and diagnostics in `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:564`, `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:648`, `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:721`, and `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:778`. |
| Deterministic valid DTOs for representative fixtures. | Covered | Support-ring test runs three fixtures twice, asserts equality, no fallback, source ID, DTO validity with outside-bounds allowance, and backend-output metrics at `packages/authoring-core/src/mesh-generation.test.ts:2046`. |
| Old v6D remains callable and deterministic. | Covered | Old `auto-outline-v6d-contour-constrainautor` fixtures still use the strict DTO helper and assert deterministic backend output at `packages/authoring-core/src/mesh-generation.test.ts:1845`. |
| Avoid weakening older baselines. | Covered after Fix Loop 1 | The v6A representative fixture test again calls strict `expectValidMeshDto` at `packages/authoring-core/src/mesh-generation.test.ts:1291`, so older inside-bounds assumptions remain covered. |
| Outer/alpha/inner ring diagnostics present. | Covered | Runtime diagnostics are asserted through typed `v6Metrics.supportRingDiagnostics` at `packages/authoring-core/src/mesh-generation.test.ts:2087`, `packages/authoring-core/src/mesh-generation.test.ts:2105`, and `packages/authoring-core/src/mesh-generation.test.ts:2121`; at least one fixture must have an inner ring at `packages/authoring-core/src/mesh-generation.test.ts:2149`. Operation serialization is asserted at `packages/operation-core/src/operations/generate-mesh.test.ts:493` and preview-provenance validation/formatting is covered at `packages/operation-core/src/operations/generate-mesh.test.ts:874`. |
| Outside-layer vertices with valid UVs. | Covered | Dedicated test asserts at least one vertex outside `meshBounds`, all UVs in `[0, 1]`, outside-distance diagnostics, and explicit UV policy at `packages/authoring-core/src/mesh-generation.test.ts:2187`. |
| Support-band triangles outside alpha are not filtered. | Covered | Filter probe keeps an outer-support triangle with centroid outside the alpha ring and counts it as support-band at `packages/authoring-core/src/mesh-generation.test.ts:2235`. |
| Backend/fallback/blocked metadata distinction. | Covered after Fix Loop 1 | Authoring-core covers backend-output at `packages/authoring-core/src/mesh-generation.test.ts:2046`, structured fallback-output at `packages/authoring-core/src/mesh-generation.test.ts:2269`, and blocked output at `packages/authoring-core/src/mesh-generation.test.ts:2332`. Operation-core includes support-ring blocked provenance in empty/missing texture loops at `packages/operation-core/src/operations/generate-mesh.test.ts:626` and `packages/operation-core/src/operations/generate-mesh.test.ts:675`. |
| Operation-core coverage after method/provenance expansion. | Covered after Fix Loop 1 | The support-ring branch asserts source, actual source, backend output, fallback-step count, triangulation mode, Constrainautor diagnostics, support-ring offsets/UV policy, counts, and outside-layer metadata at `packages/operation-core/src/operations/generate-mesh.test.ts:493`; preview provenance keeps the same diagnostics at `packages/operation-core/src/operations/generate-mesh.test.ts:874`. |
| No new dependencies. | Covered | New candidate reuses existing `delaunator` and `@kninnug/constrainautor` IDs at `packages/authoring-core/src/mesh-generation-contract.ts:104`. Reviewer-rerun manifest diff over `package.json`, `pnpm-lock.yaml`, and package manifests was empty. |

## Findings

### W70-A-TA-001 - Missing support-ring fallback-output coverage

Severity: major

Fix Loop 1 status: resolved

Original issue: Domain A requires invalid or self-intersecting ring geometry to return structured fallback/diagnostics, and the review scope explicitly asks for backend/fallback/blocked metadata distinction. The original review found support-ring fallback paths for `v6d-support-ring-geometry-invalid` and `v6d-support-ring-constraint-recovery-failed`, but no test proving the new method's fallback-output contract.

Original evidence:

- Backend-output support-ring coverage existed.
- Blocked empty/missing texture coverage existed.
- Searching focused tests found no assertion for `v6d-support-ring-geometry-invalid` or `v6d-support-ring-constraint-recovery-failed`.

Original required change:

- Add a focused authoring-core test that forces the support-ring visible fallback path and asserts `outputKind: "fallback-output"`, method/source/backend IDs, fallback reason, fallback steps, diagnostics, and no misleading `backend-output`.
- If forcing this through public fixtures is unstable, add a narrow test probe around the geometry/recovery failure seam rather than broadening production API.

Re-review:

- Resolved by `probeV6DSupportRingGeometryFallbackForTest` at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:300` and the focused fallback-output test at `packages/authoring-core/src/mesh-generation.test.ts:2269`.
- The test asserts `source: "alpha-aware-rgba"`, reason `v6d-support-ring-geometry-invalid`, `outputKind: "fallback-output"`, no `backend-output`, matching fallback steps, Constrainautor failure metadata, and support-ring diagnostic fields at `packages/authoring-core/src/mesh-generation.test.ts:2277` through `packages/authoring-core/src/mesh-generation.test.ts:2324`.

### W70-A-TA-002 - Old v6A baseline was weakened by using the outside-bounds helper

Severity: major

Fix Loop 1 status: resolved

Original issue: the support-ring method is the scoped place where vertices may extend outside layer bounds, but the old v6A representative fixture test had been changed to use the outside-bounds DTO helper. That helper intentionally omits the vertex-in-bounds checks still present in the strict DTO helper.

This weakened an unrelated old baseline and would have allowed an accidental v6A regression to outside-layer vertices without failing the test. The original review also saw duplicated alpha-bounds assertions from editing drift.

Original required change:

- Restore `expectValidMeshDto` for the v6A test, or add an explicit v6A inside-bounds assertion that is equivalent to the old baseline.
- Keep the outside-bounds helper scoped to the support-ring tests that intentionally allow outside-layer vertices.

Re-review:

- Resolved. The old v6A representative fixture test now calls `expectValidMeshDto` at `packages/authoring-core/src/mesh-generation.test.ts:1291`.
- The duplicate alpha-bounds assertion drift is gone in the reviewed lines at `packages/authoring-core/src/mesh-generation.test.ts:1297` through `packages/authoring-core/src/mesh-generation.test.ts:1300`.

### W70-A-TA-003 - Operation-core tests underassert the new support-ring provenance contract

Severity: major

Fix Loop 1 status: resolved

Original issue: the operation-core candidate loop ran the new method because it iterated `V6_MESH_GENERATION_CANDIDATES`, but it only asserted generic v6 fields for backends without a specific branch. There was no `v6d-contour-band-support-rings` branch analogous to the existing old v6D branch.

The empty-alpha and missing-texture blocked tests explicitly filtered only old v6D, v6E, and v6F, so they did not prove operation provenance for support-ring blocked output. This mattered because Operation Core serializes v6 method/source/output/fallback fields into transform history, and Domain A expands the method/provenance contract.

Original required change:

- Add operation-core assertions for `v6d-contour-band-support-rings` backend output, including at least `meshSource:outline-v6d-contour-band-support-rings-rgba`, `meshQuality:v6ActualSource=outline-v6d-contour-band-support-rings-rgba`, `meshQuality:v6Output=backend-output`, `meshQuality:v6FallbackSteps=0`, `meshQuality:triangulationMode=v6d-contour-delaunator-constrainautor`, Constrainautor diagnostics, and support-ring provenance markers.
- Include `v6d-contour-band-support-rings` in the empty-alpha and missing-texture blocked operation-core coverage, with the same blocked-vs-backend distinction already asserted for old v6D/v6E/v6F.
- If support-ring-specific diagnostics are intended to be an operation-visible contract, also add typed/serialized assertions for outer/inner/support-band/outside-layer fields. If they are authoring-core-only diagnostics, record that boundary explicitly.

Re-review:

- Resolved. Operation-core now has a dedicated `v6d-contour-band-support-rings` success branch at `packages/operation-core/src/operations/generate-mesh.test.ts:493`, including source, actual source, backend-output, fallback-step count, triangulation mode, Constrainautor diagnostics, support-ring offsets, support-band/interior counts, outside-layer state, and UV policy.
- Empty-alpha and missing-texture blocked coverage now include `v6d-contour-band-support-rings` at `packages/operation-core/src/operations/generate-mesh.test.ts:630` and `packages/operation-core/src/operations/generate-mesh.test.ts:679`; blocked support-ring zero diagnostics are asserted by `expectBlockedBackendProvenance` at `packages/operation-core/src/operations/generate-mesh.test.ts:1177`.
- Preview provenance diagnostics are covered at `packages/operation-core/src/operations/generate-mesh.test.ts:874`.
- The operation-visible support-ring diagnostics contract is typed at `packages/authoring-core/src/mesh-quality-metrics.ts:199`, accepted by operation-core payload validation at `packages/operation-core/src/payloads/model-edit.ts:189`, and formatted into transform history at `packages/operation-core/src/operations/generate-mesh.ts:571`.

## Validation Reviewed Or Rerun

Reviewed Orch-Sylph validation summary:

| Command | Reviewed result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts --reporter=dot` | Sandbox failed with esbuild `spawn EPERM`; outside-sandbox rerun passed 59 tests. |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Outside-sandbox passed 29 tests. |
| `pnpm.cmd typecheck` | Passed. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `git diff --check -- ...` over Domain A files and Wave70 report | Passed with CRLF working-copy warnings only. |
| Manifest/lockfile diff | Empty. |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Fix Loop 1 outside-sandbox rerun passed: 2 files / 90 tests. |

Reviewer reran:

| Command | Result |
|---|---|
| `git diff -- package.json pnpm-lock.yaml packages/authoring-core/package.json packages/operation-core/package.json` | Empty diff. |
| `Select-String -Path discussion/implementation/reviews/wave70/wave70-domain-a-test-adequacy-review.md -Pattern '[ \t]$'` | No trailing-whitespace matches. |

I did not rerun Vitest because the requested Fix Loop 1 validation had already been rerun outside the sandbox and passed; this re-review is about adequacy of assertions, not test flakiness.

## Test Gaps And Residual Risks

- No remaining blocking or required-change test gaps from the original review.
- The fallback-output test uses a narrow test probe rather than a public fixture path. That is acceptable for this lane because it exercises the structured fallback contract without making fragile geometry failure fixtures part of public behavior.
- Automated tests do not replace later visual review of actual support-ring mesh quality; that remains a Domain C / human visual-review residual risk, not a Domain A test-adequacy blocker.

## User-Decision Points

- None required for this review lane.

## Final Recommendation

Pass Domain A Test Adequacy after Fix Loop 1. The original findings are resolved, the support-ring method/source/provenance contract is covered in authoring-core and operation-core, and the old v6A baseline is no longer weakened.
