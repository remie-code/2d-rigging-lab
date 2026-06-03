# Wave38 Domain B Gnome Implementation Report

## Verdict

pass

## Domain

`wave38-operation-package-runtime-topology-application`

## Scope Implemented

Implemented the full bounded topology / UV subset established by Domain A:

- `addMeshVertex`
- `removeMeshVertex` with `removalPolicy: "unreferenced-only"`
- `addMeshTriangle` with `windingPolicy: "preserveVertexOrder"`
- `removeMeshTriangle` with `removalPolicy: "remove-triangle-only"`
- `moveMeshUvPoint`

No automatic triangulation, retopology, atlas packing, renderer, image decode, texture sampling oracle, Cubism compatibility, external dependency, manifest change, lockfile change, validator-core implementation, or Editor UI implementation was added.

## Implementation Notes

- Added authoring-core topology / UV mutations that validate mesh cardinality, expected topology revision, triangle references, duplicate topology IDs, referenced vertex deletion, and UV no-op edits before mutating session state.
- Added deterministic topology revision increments for supported topology / UV edits.
- Added deterministic materialization of legacy missing triangle stable IDs when triangle operations need stable identity.
- Registered operation-core handlers for all five topology / UV operation types.
- Operation results now emit model diffs plus `meshTopologyEvidence` with topology revision before/after, counts, stable IDs, changed vertex/triangle/UV evidence, and explicit renderer / texture sampling correctness claims of `"none"`.
- Package save/load uses existing package document clone path and preserves `topologyRevision`, `vertexStableIds`, `triangleStableIds`, triangles, and UVs.
- Runtime graph projection now carries vertices, UVs, triangles, vertex stable IDs, triangle stable IDs, and topology revision.
- Runtime / Viewer mesh evidence now exposes topology revision, stable triangle ID count, UV refs, and triangle refs in full-detail evidence.

## Files Changed

Authoring:

- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-topology-mutations.ts`
- `packages/authoring-core/src/mesh-topology-mutations.test.ts`
- `packages/authoring-core/src/runtime-graph-drawables.ts`

Operation:

- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operations/mesh-topology.ts`
- `packages/operation-core/src/operations/mesh-topology.test.ts`

Runtime:

- `packages/runtime-core/src/mesh-evidence.ts`
- `packages/runtime-core/src/mesh-evidence.test.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/tutorial-evidence-summary.test.ts`

Report:

- `discussion/implementation/waves/wave38/wave38-domain-b-gnome-implementation-report.md`

## Verification

Fix loop 1 verification:

- Added direct authoring API no-corruption coverage for invalid `insertIndex` values on `addMeshVertex` and `addMeshTriangle`.
- Covered `< 0`, non-integer, `NaN`, and non-finite insert indexes.
- Verified rejected edits leave mesh state, authoring revision, and dirty flag unchanged.

```text
pnpm.cmd exec vitest run packages/authoring-core/src/mesh-topology-mutations.test.ts
```

Result: 1 file passed, 5 tests passed.

```text
pnpm.cmd exec vitest run packages/authoring-core/src/mesh-topology-mutations.test.ts packages/operation-core/src/operations/mesh-topology.test.ts packages/runtime-core/src/mesh-evidence.test.ts packages/runtime-core/src/tutorial-evidence-summary.test.ts packages/operation-core/src/operation-schemas.test.ts packages/package-format/src/mesh-topology-contract.test.ts packages/operation-core/src/operations/generate-mesh.test.ts
```

Result: 7 files passed, 26 tests passed.

```text
pnpm.cmd typecheck
```

Result: root and editor TypeScript checks passed.

Passed focused and adjacent Vitest:

```text
pnpm.cmd exec vitest run packages/authoring-core/src/mesh-topology-mutations.test.ts packages/operation-core/src/operations/mesh-topology.test.ts packages/runtime-core/src/mesh-evidence.test.ts packages/runtime-core/src/tutorial-evidence-summary.test.ts packages/operation-core/src/operation-schemas.test.ts packages/package-format/src/mesh-topology-contract.test.ts packages/operation-core/src/operations/generate-mesh.test.ts
```

Result: 7 files passed, 24 tests passed.

Passed adjacent authoring regression:

```text
pnpm.cmd exec vitest run packages/authoring-core/src/package-document-adapter.test.ts packages/authoring-core/src/runtime-graph-adapter.test.ts packages/authoring-core/src/mesh-mutations.test.ts
```

Result: 3 files passed, 10 tests passed.

Passed typecheck:

```text
pnpm.cmd typecheck
```

Result: root and editor TypeScript checks passed.

Development guard checks:

- Public `index.ts` changes are re-export only.
- No dependency manifest or lockfile files changed.
- New source files are responsibility-specific: authoring topology mutations and operation topology handlers.

## Remaining Risks

- `packages/operation-core/src/operations/mesh-topology.ts` intentionally owns the bounded topology operation family in one named file. It is not a catch-all, but future topology operation expansion should split result, target, or diagnostic helpers before adding more behavior.
- Validator diagnostics and Editor UI workflows remain owned by other Wave38 domains.
- Full renderer correctness, texture sampling correctness, real texture bytes, image decode, atlas packing, automatic triangulation, and Cubism compatibility remain unsupported and unclaimed.

## Forbidden Scope Note

This Gnome did not edit Editor UI implementation, validator-core implementation, dependency manifests, lockfiles, renderer/image decode paths, or external dependency configuration. Validator-core changes visible in the worktree were pre-existing or parallel Domain C work and were not authored here.
