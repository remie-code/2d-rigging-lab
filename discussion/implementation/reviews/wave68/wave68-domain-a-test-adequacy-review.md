# Wave68 Domain A Test Adequacy Review

> Review-Sylph lane: Test Adequacy Review  
> Date: 2026-06-14  
> Verdict: `pass`

## Scope

Reviewed Domain A test adequacy for the v6 shared contract / dependency gate / method surface. This review used source, tests, basis documents, and focused verification commands; it did not depend on a Gnome summary. The expected Domain A implementation report was not present at `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md` when checked, so this lane is based on repository evidence.

## Findings

No blocking or needs-change findings.

The current focused tests adequately cover Domain A's contract-level responsibilities: v6 method/source IDs, operation payload acceptance, headless fallback routing for all v6 candidates, shared v6 metrics/fallback metadata, fixture helper availability, previewMesh commit acceptance for v6 methods, and preservation of the existing V2.6 default through existing Editor command tests.

## Test Adequacy Matrix

| Requirement | Test / evidence | Gap / N/A |
|---|---|---|
| v6 method IDs are available: `auto-outline-v6a-local`, `auto-outline-v6b-constrainautor`, `auto-outline-v6c-poly2tri`. | Contract IDs are defined in `packages/authoring-core/src/mesh-generation-contract.ts:7`; candidates are fixed at `packages/authoring-core/src/mesh-generation-contract.ts:51`. Authoring tests assert all candidate method IDs at `packages/authoring-core/src/mesh-generation.test.ts:1095`. | None for Domain A. |
| v6 source IDs are available and synchronized with candidates. | Source IDs are defined in `packages/authoring-core/src/mesh-generation-contract.ts:13` and included in generated source IDs at `packages/authoring-core/src/mesh-generation-contract.ts:93`. Tests assert per-candidate source IDs at `packages/authoring-core/src/mesh-generation.test.ts:1095`. | None. |
| Operation payload allowlist accepts v6 methods. | Operation payload imports `MESH_GENERATION_METHOD_IDS` from authoring-core at `packages/operation-core/src/payloads/model-edit.ts:19` and uses it for `GenerateMeshPayloadSchema.method` at `packages/operation-core/src/payloads/model-edit.ts:151`. Operation tests parse and commit each v6 candidate at `packages/operation-core/src/operations/generate-mesh.test.ts:396`. | None. |
| Headless generation path routes all v6 candidates. | `createGeneratedMeshForDrawable` branches on v6 methods at `packages/authoring-core/src/mesh-generation.ts:116` and calls the deferred fallback result builder. Authoring test loops over all `V6_MESH_GENERATION_CANDIDATES` at `packages/authoring-core/src/mesh-generation.test.ts:1135`. | Real backend geometry is intentionally deferred to Domains B/C/D. |
| Shared v6 quality/fallback metadata exists. | `MeshGenerationV6Metrics` defines shared metadata at `packages/authoring-core/src/mesh-quality-metrics.ts:140`. Deferred fallback populates v6 metrics at `packages/authoring-core/src/mesh-generation.ts:930`. Authoring tests assert `v6Metrics` shape at `packages/authoring-core/src/mesh-generation.test.ts:1159`. | None for contract/fallback metadata. |
| Dependency availability vs backend implementation deferral is test-covered. | Candidate metadata records dependency gate and backend implementation status at `packages/authoring-core/src/mesh-generation-contract.ts:51`. Tests assert dependency package IDs and `backendImplementationStatus: "deferred"` at `packages/authoring-core/src/mesh-generation.test.ts:1088` and `packages/authoring-core/src/mesh-generation.test.ts:1095`. Dependencies are present in `packages/authoring-core/package.json:13` and `pnpm-lock.yaml:123`. | Import/browser behavior smoke is deferred to Domains C/D where the libraries are actually used. |
| Fallback reason and fallback steps are visible. | Fallback steps are built at `packages/authoring-core/src/mesh-generation.ts:951`; reason selection is at `packages/authoring-core/src/mesh-generation.ts:1012`. Empty/missing alpha tests assert exact fallback steps at `packages/authoring-core/src/mesh-generation.test.ts:1197`. | None. |
| Operation provenance formatting includes v6 source, fallback, quality, and backend diagnostics. | v6 provenance formatting starts at `packages/operation-core/src/operations/generate-mesh.ts:479`, constrainautor formatting at `packages/operation-core/src/operations/generate-mesh.ts:516`, and poly2tri formatting at `packages/operation-core/src/operations/generate-mesh.ts:537`. Operation tests assert transform history for all v6 candidates at `packages/operation-core/src/operations/generate-mesh.test.ts:396`. | None. |
| Fixture helper contract covers simple rectangle, curved blob, thin tapered, hole-like, and empty alpha without exact triangle-layout overfit. | Fixture IDs and shape features are defined in `packages/authoring-core/src/mesh-generation-v6-fixtures.ts:3` and `packages/authoring-core/src/mesh-generation-v6-fixtures.ts:32`. Tests assert IDs, byte size, bounds, alpha state, and non-empty feature tags at `packages/authoring-core/src/mesh-generation.test.ts:1080` through `packages/authoring-core/src/mesh-generation.test.ts:1131`. | Missing-alpha is not a fixture because it is absence of bytes; it is covered separately at `packages/authoring-core/src/mesh-generation.test.ts:1197`. Exact triangle layout is intentionally not asserted. |
| Current default remains `auto-outline-v2.6-soft-apron` or v6 default switch is caught. | Editor command default is still `auto-outline-v2.6-soft-apron` at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:279`; existing default test starts at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:609` and asserts V2.6 provenance at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:676`. Preview/apply paths also pass V2.6 at `apps/editor/src/features/editor-session/editor-session-context.tsx:653` and `apps/editor/src/features/editor-session/editor-session-context.tsx:689`. | None; I ran this focused editor test in addition to the Domain A authoring/operation tests. |
| previewMesh commits are covered for v6 candidates. | v6 methods are included in `GENERATED_MESH_PREVIEW_COMMIT_METHOD_IDS` at `packages/authoring-core/src/mesh-generation-contract.ts:107`. Operation preconditions use `isGeneratedMeshPreviewCommitMethod` at `packages/operation-core/src/operations/generate-mesh.ts:210`. Operation test loops all v6 candidates at `packages/operation-core/src/operations/generate-mesh.test.ts:448`. | None. |
| Verification commands are appropriate. | Focused authoring/operation tests, typecheck, dependency guard, source organization guard, default-focused editor test, and Domain A diff check were run. Results are below. | None. |

## Commands Run

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | First sandbox run failed before tests with Windows `esbuild spawn EPERM`. Reran the same command with escalation: pass, 2 files / 53 tests. |
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-commands.test.ts --reporter=dot` | Pass, 1 file / 13 tests. Added to verify the V2.6 default guard. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-dependencies.mjs` | Pass: `Dependency guard passed.` |
| `node scripts/check-source-organization.mjs` | Pass: `Source organization guard passed.` |
| `git diff --check -- packages/authoring-core/src/mesh-generation-contract.ts packages/authoring-core/src/mesh-generation-v6-fixtures.ts packages/authoring-core/src/mesh-generation.ts packages/authoring-core/src/mesh-quality-metrics.ts packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/payloads/model-edit.ts packages/operation-core/src/operations/generate-mesh.ts packages/operation-core/src/operations/generate-mesh.test.ts packages/authoring-core/package.json pnpm-lock.yaml` | Pass. Git emitted LF-to-CRLF working-copy warnings only; no whitespace errors. |

## Deferred Test Risks

- Domains B/C/D must test real backend geometry, determinism, DTO invariants, boundary preservation, hole/multi-island behavior, and per-fixture quality for v6a/v6b/v6c. Domain A only proves the shared contract and visible deferred fallback.
- Domains C/D must verify actual library import behavior, ESM/CJS/Vite/browser compatibility, and backend-specific failure handling once `delaunator`, `@kninnug/constrainautor`, and `poly2tri` are imported.
- Domain E must test the temporary Editor backend selector and preview/apply provenance UI. Domain A only proves operation-level previewMesh commits for v6 methods and that the current default remains V2.6.
- Full manual visual comparison and final backend selection are out of scope for Domain A and remain later-wave evidence.

## Conclusion

Domain A has adequate focused tests and verification for its intended contract/dependency-gate surface. The remaining risks are correctly deferred to backend implementation and Editor selector domains, not Domain A.
