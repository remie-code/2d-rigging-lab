# Wave61 Domain C Package / Mesh Operation / Data Contract Review

- verdict: `pass`
- review mode: fix loop 1 re-review
- lane: package / mesh operation / data contract review
- target domain: `wave61-mesh-tool-initial-generation-v0`

## Scope Reviewed

- `discussion/implementation/orchestration/wave61-plan.md`
- `discussion/implementation/waves/wave61/domain-c-gnome-report.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- Supporting topology/mutation references:
  - `packages/contracts/src/mesh-topology.ts`
  - `packages/authoring-core/src/mesh-mutations.ts`
  - `packages/validator-core/src/validators/mesh-semantics.ts`

Implementation files were not modified by this review.

## Prior Finding Closure

### Closed: `previewMesh` commit path can accept topologically invalid mesh shape

Status: closed by fix loop 1.

Direct source review confirms that `generateMesh` now evaluates `previewMesh` topology before `replaceDrawableMesh()`:

- `packages/operation-core/src/operations/generate-mesh.ts:73` calls `evaluatePreviewMeshPreconditions()` after resolving the target Drawable and existing mesh.
- `packages/operation-core/src/operations/generate-mesh.ts:84` rejects the operation before mutation when any precondition diagnostic exists.
- `packages/operation-core/src/operations/generate-mesh.ts:95` only clones and commits `request.payload.previewMesh` after those diagnostics have passed.
- `packages/operation-core/src/operations/generate-mesh.ts:135` remains the mutation point via `replaceDrawableMesh()`.
- `packages/operation-core/src/operations/generate-mesh.ts:260` iterates preview triangles and now rejects:
  - out-of-range vertex references with `operation.generateMesh.previewMeshTriangleIndexOutOfRange`;
  - repeated-index degenerate triangles with `operation.generateMesh.previewMeshDegenerateTriangle`.

Focused negative tests were added:

- `packages/operation-core/src/operations/generate-mesh.test.ts:144` verifies an out-of-range triangle vertex reference is rejected and the mesh/revision remain unchanged.
- `packages/operation-core/src/operations/generate-mesh.test.ts:165` verifies a repeated-index degenerate triangle is rejected and the mesh/revision remain unchanged.

The fix satisfies the required minimum for this loop: reject triangle indices outside `vertices.length` and reject same-index repeated degenerate triangles before the operation mutation boundary.

## New Findings

None.

## Data-Contract Notes

- `PreviewMeshPayloadSchema` still owns primitive DTO shape only: mesh/drawable IDs, bounds, vertices, UVs, triangle tuples, stable IDs, optional topology revision, and provenance (`packages/operation-core/src/payloads/model-edit.ts:137`).
- `MeshTriangleIndicesDtoSchema` enforces tuple shape with nonnegative integer indices (`packages/contracts/src/mesh-topology.ts:15`), while cross-field topology checks now live in operation preconditions.
- `replaceDrawableMesh()` still only checks target Drawable/mesh linkage before replacing stored mesh (`packages/authoring-core/src/mesh-mutations.ts:37`), so the operation-level precondition remains the effective mutation-boundary guard for `generateMesh.previewMesh`.
- The validator has broader mesh semantics checks, including out-of-range indices and both repeated-index and zero-area degenerate triangles (`packages/validator-core/src/validators/mesh-semantics.ts:136`, `packages/validator-core/src/validators/mesh-semantics.ts:214`). Fix loop 1 intentionally did not promote zero-area collinearity rejection into `generateMesh` preconditions.
- Authoring mesh generation still emits deterministic grid triangles and stable IDs from row/column order (`packages/authoring-core/src/mesh-generation.ts:144`, `packages/authoring-core/src/mesh-generation.ts:233`).

## Verification

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts`
  - sandbox result: failed to load Vitest config due Vite/esbuild `spawn EPERM`.
  - escalated rerun: passed, 1 file / 9 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - escalated run: passed, 2 files / 12 tests.

## Residual Risks

- Geometry-level zero-area triangles with three distinct collinear vertices are still not rejected by `generateMesh.previewMesh`; they remain covered by validator semantics rather than this operation precondition. This matches the stated fix-loop boundary.
- This lane did not rerun root `typecheck`, root `test:unit`, root `check`, app build, or E2E. The re-review was focused on the previous package / mesh operation / data-contract finding.
- The workspace contains broader Domain A / B / C dirty changes. This review did not revert or adjudicate unrelated changes.

## User-Decision Points

None.
