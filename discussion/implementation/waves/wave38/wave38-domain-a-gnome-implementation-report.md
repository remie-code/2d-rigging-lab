# Wave38 Domain A Gnome Implementation Report

## Verdict

needs_review

## Scope

Domain: `wave38-mesh-topology-uv-contract-foundation`

Implemented the contract/schema foundation only. Lifecycle mutation, validator diagnostics, runtime/viewer projection, and Editor UI wiring remain for later Wave38 domains.

## Subset Chosen

Implemented the full safe bounded subset from the Wave38 plan at DTO/schema level:

- `addMeshVertex`
- `removeMeshVertex` with `removalPolicy: "unreferenced-only"`
- `addMeshTriangle` by existing stable vertex IDs
- `removeMeshTriangle`
- `moveMeshUvPoint`

No automatic triangulation, retopology, atlas packing, renderer, image decode, texture sampling correctness, pixel oracle, Cubism compatibility, external dependency, or UI implementation was added.

## Files Changed

Contracts:

- `packages/contracts/src/ids.ts`
- `packages/contracts/src/target-ref.ts`
- `packages/contracts/src/mesh-topology.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/ids-core.test.ts`
- `packages/contracts/src/mesh-topology.test.ts`

Package format:

- `packages/package-format/src/model-files.ts`
- `packages/package-format/src/mesh-topology-contract.test.ts`

Operation core:

- `packages/operation-core/src/payloads/mesh-topology.ts`
- `packages/operation-core/src/mesh-topology-evidence.ts`
- `packages/operation-core/src/mesh-topology-uv-contract.test.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-result.ts`
- `packages/operation-core/src/operation-evidence-result.ts`
- `packages/operation-core/src/lifecycle/evidence.ts`
- `packages/operation-core/src/operations/model-diff-json-value.ts`
- `packages/operation-core/src/operations/create-drawable.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/index.ts`

Design documentation:

- `discussion/design/module-contracts/package-file-format-contract.md`

Implementation report:

- `discussion/implementation/waves/wave38/wave38-domain-a-gnome-implementation-report.md`

## Implementation Notes

- Added `TriangleId` / `TriangleIdSchema` with `tri_...` prefix and added `triangle` as a target kind.
- Added mesh topology DTO schemas for topology revision, triangle index triples, triangle vertex ID triples, triangle stable ID sets, and legacy-compatible machine-readable vertex stable ID tokens.
- Kept package mesh compatibility additive:
  - `topologyRevision` is optional.
  - `triangleStableIds` is optional.
  - `vertexStableIds` remains compatible with historical `v0` / `mesh_body_v0` fixture forms but now rejects spaces.
- Added operation payload schemas for the bounded topology/UV subset.
- Added optional `meshTopologyEvidence` on `OperationEvidenceResult` and `OperationResult`; existing operation results are unchanged when no evidence is supplied.
- Added explicit evidence fields `rendererCorrectnessClaim: "none"` and `textureSamplingCorrectnessClaim: "none"`.
- Added an internal `operations/model-diff-json-value.ts` helper so existing full-mesh model diff values remain valid `JsonValue` after optional mesh fields were introduced.

## Verification

Passed focused Vitest:

```text
pnpm.cmd exec vitest run packages/contracts/src/mesh-topology.test.ts packages/contracts/src/ids-core.test.ts packages/package-format/src/mesh-topology-contract.test.ts packages/package-format/src/package-document.test.ts packages/operation-core/src/mesh-topology-uv-contract.test.ts packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/operations/create-drawable.test.ts packages/operation-core/src/operations/generate-mesh.test.ts
```

Result: 8 test files passed, 56 tests passed.

Passed typecheck:

```text
pnpm.cmd typecheck
```

Result: root and editor TypeScript checks passed.

Source organization guard:

- Changed `packages/contracts/src/index.ts` and `packages/operation-core/src/index.ts` remain barrel-only exports.
- New source files are responsibility-specific:
  - `mesh-topology.ts` for contract topology DTOs.
  - `payloads/mesh-topology.ts` for bounded operation payload schemas.
  - `mesh-topology-evidence.ts` for operation evidence shape.
  - `operations/model-diff-json-value.ts` for model diff JSON value normalization.
- No broad catch-all source file was added.

Diff whitespace guard:

```text
git diff --check -- packages/contracts/src packages/operation-core/src packages/package-format/src discussion/design/module-contracts/package-file-format-contract.md
```

Result: exit code 0. Git reported CRLF conversion warnings only.

Dependency/manifest guard:

- No dependency manifest or lockfile files were changed.
- No external dependency was added.

## Remaining Issues

- New topology/UV operations are schema-contract only in Domain A. `createOperationCore().commitOperation` still returns the existing unsupported-operation lifecycle diagnostic until Domain B implements handlers and mutations.
- Package mesh `triangleStableIds` is optional to preserve legacy file compatibility. Later domains should define validator diagnostics for mismatched `triangleStableIds.length` and stale topology revision evidence.
- Existing historical `vertexStableIds` are not forced to `vtx_...` prefix because repository fixtures and editor tests use legacy stable tokens such as `v0`; new bounded operation payloads use `VertexIdSchema`.

## User Decision Points

None for Domain A.
