# Wave38 Domain A Review-Sylph Review

## Verdict

pass

Domain A is additive and bounded. I found no blocking issue requiring Gnome rework before Domains B/C. One non-blocking warning is recorded for follow-up hardening.

## Basis Reviewed

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave38-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- changed source/test files under `packages/contracts/src`, `packages/operation-core/src`, `packages/package-format/src`
- `discussion/implementation/waves/wave38/wave38-domain-a-gnome-implementation-report.md` as supplementary evidence only

## Files Reviewed

- `discussion/design/module-contracts/package-file-format-contract.md`
- `packages/contracts/src/ids.ts`
- `packages/contracts/src/ids-core.test.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/target-ref.ts`
- `packages/contracts/src/mesh-topology.ts`
- `packages/contracts/src/mesh-topology.test.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/lifecycle/evidence.ts`
- `packages/operation-core/src/operation-evidence-result.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-result.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operations/create-drawable.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/model-diff-json-value.ts`
- `packages/operation-core/src/payloads/mesh-topology.ts`
- `packages/operation-core/src/mesh-topology-evidence.ts`
- `packages/operation-core/src/mesh-topology-uv-contract.test.ts`
- `packages/package-format/src/model-files.ts`
- `packages/package-format/src/mesh-topology-contract.test.ts`

## Findings By Lane

### 1. Design / Development Compliance Review

- PASS: Mesh topology / UV contract is additive. `triangleStableIds` and `topologyRevision` are optional in package mesh schema, preserving legacy meshes without package version churn (`packages/package-format/src/model-files.ts:46`, `packages/package-format/src/model-files.ts:53`, `packages/package-format/src/model-files.ts:54`).
- PASS: Non-goal boundary is honest. The package contract explicitly disclaims automatic triangulation, retopology, atlas packing, real texture decode, renderer correctness, texture sampling correctness, pixel oracle support, and Cubism compatibility (`discussion/design/module-contracts/package-file-format-contract.md:199`). Operation evidence records renderer and texture sampling claims as `"none"` (`packages/operation-core/src/mesh-topology-evidence.ts:67`, `packages/operation-core/src/mesh-topology-evidence.ts:68`).
- PASS: DTO/schema naming follows the accepted convention for new external boundary DTOs such as `MeshTopologyRevisionDtoSchema`, `MeshTriangleVertexIdsDtoSchema`, payload DTO schemas, and `MeshTopologyOperationEvidenceDtoSchema` (`packages/contracts/src/mesh-topology.ts:7`, `packages/contracts/src/mesh-topology.ts:23`, `packages/operation-core/src/payloads/mesh-topology.ts:15`, `packages/operation-core/src/mesh-topology-evidence.ts:56`).
- PASS: New operation types are machine-readable camelCase tokens with no spaces (`packages/operation-core/src/operation-type.ts:14` through `packages/operation-core/src/operation-type.ts:18`).
- PASS: Public `index.ts` files remain barrel-only re-export surfaces (`packages/contracts/src/index.ts:1`, `packages/operation-core/src/index.ts:1`).
- PASS: New source files have clear single responsibilities: mesh topology contracts, mesh topology payloads, mesh topology evidence, and model diff JSON value normalization.
- PASS: No dependency manifest or lockfile changes were present in `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, or touched package manifests.
- WARNING: `packages/operation-core/src/payloads/mesh-topology.ts:11` defines `lockedTargetIds` as `z.string().min(1)`, so that array can still accept IDs with spaces. This mirrors the existing model-edit payload pattern and does not weaken the new topology-specific `MeshId` / `VertexId` / `TriangleId` fields, so I do not consider it blocking for Domain A. It should be hardened in a broader operation payload ID cleanup or before relying on `lockedTargetIds` as formal machine-readable evidence.

### 2. Test Adequacy Review

- PASS: Contract tests cover topology revision, triangle index triples, triangle stable IDs, vertex ID triples, invalid IDs, and target kind spacing rejection (`packages/contracts/src/mesh-topology.test.ts:13`, `packages/contracts/src/mesh-topology.test.ts:29`, `packages/contracts/src/mesh-topology.test.ts:40`).
- PASS: Package-format tests cover legacy mesh compatibility, optional topology revision and triangle stable IDs, invalid vertex stable IDs, invalid triangle IDs, and invalid revision values (`packages/package-format/src/mesh-topology-contract.test.ts:25`, `packages/package-format/src/mesh-topology-contract.test.ts:33`, `packages/package-format/src/mesh-topology-contract.test.ts:45`).
- PASS: Operation tests cover all five bounded payload variants, request boundary parsing, unsafe topology IDs, empty UV edit rejection, and operation/evidence result embedding (`packages/operation-core/src/mesh-topology-uv-contract.test.ts:72`, `packages/operation-core/src/mesh-topology-uv-contract.test.ts:84`, `packages/operation-core/src/mesh-topology-uv-contract.test.ts:102`, `packages/operation-core/src/mesh-topology-uv-contract.test.ts:119`).
- PASS: Existing operation handler tests for `createDrawable` and `generateMesh` cover the model diff JSON value normalization regression path.
- WARNING: No test currently asserts `lockedTargetIds` rejects spaces for the new topology payloads. This tracks the non-blocking design warning above.

### 3. Orchestration Compliance Review

- PASS: The assignment and wave plan require Orch-Sylph to delegate source implementation to Gnome and run Review-Sylph in a separate clean context. This review inspected basis documents, diff/files, and tests directly rather than relying only on Gnome's report.
- PASS: This Review-Sylph did not implement source fixes. The only write performed is this review artifact under `discussion/implementation/reviews/wave38/`.

## Verification Performed

- `pnpm.cmd exec vitest run packages/contracts/src/ids-core.test.ts packages/contracts/src/mesh-topology.test.ts packages/operation-core/src/mesh-topology-uv-contract.test.ts packages/package-format/src/mesh-topology-contract.test.ts`
  - Result: 4 files passed, 32 tests passed.
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/create-drawable.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - Result: 2 files passed, 12 tests passed.
- `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/operation-core/src/operation-schemas.test.ts`
  - Result: 2 files passed, 12 tests passed.
- `pnpm.cmd typecheck`
  - Result: passed.
- `git diff --check -- packages/contracts/src packages/operation-core/src packages/package-format/src discussion/design/module-contracts/package-file-format-contract.md discussion/implementation/waves/wave38`
  - Result: no whitespace errors; Git emitted CRLF normalization warnings only.
- Dependency manifest / lockfile status check for `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and touched package manifests.
  - Result: no changes.

## Remaining Issues

- Non-blocking: `lockedTargetIds` remains generic string evidence and can accept spaces. Recommend hardening with a shared no-space target ID schema when the operation payload family is next touched.
- Deferred to Domains B/C by plan: actual topology mutation semantics, invalid topology rejection, validator diagnostics, runtime/viewer evidence, and editor workflows are not implemented in Domain A and were not expected to be.

## User-Decision Points

None.
