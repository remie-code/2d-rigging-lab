# Wave29 Domain E Mesh Edit Contract Fixtures - Gnome Report

Date: 2026-06-02

## Verdict

pass

## Scope

- Target: `wave29-mesh-edit-contract-fixtures`
- Implemented deterministic contract fixtures for Canvas Mesh Editing v1.
- Kept changes inside the allowed fixture / focused-test / Wave29 report scope.
- Did not edit Editor UI, broad runtime or validator implementation, package manifests, lockfiles, public `index.ts` files, renderer code, file/image parsers, or dependency metadata.

## Files Changed

- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/fixture-manifest.json`
- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/baseline-package.json`
- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/request/create-drawable-commit.request.json`
- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/request/generate-mesh-commit.request.json`
- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/request/move-mesh-vertices-commit.request.json`
- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/runtime/baseline-runtime-graph.json`
- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/runtime/final-runtime-graph.json`
- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/expected/operation-chain-summary.json`
- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/expected/package-materialization-summary.json`
- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/expected/runtime-viewer-evidence-summary.json`
- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/expected/validation-report-summary.json`
- `fixtures/contracts/wave29-mesh-edit-contract-fixtures/expected/editor-selection-evidence-summary.json`
- `packages/operation-core/src/wave29-mesh-edit-contract-fixtures.test.ts`
- `packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts`
- `packages/validator-core/src/wave29-mesh-edit-contract-fixtures.test.ts`
- `discussion/implementation/waves/wave29/wave29-domain-e-mesh-edit-contract-fixtures-gnome-report.md`

## Implemented Evidence

- Operation fixture chain:
  - `createDrawable`
  - `generateMesh`
  - multi-vertex `moveMeshVertex`
- Package materialization fixture pins:
  - final package revision,
  - final drawable and mesh IDs,
  - stable vertex IDs,
  - moved vertex coordinates,
  - UVs and triangles,
  - bounds,
  - source-layer mapping,
  - operation log length and operation types.
- Runtime / viewer fixture pins:
  - full-detail mesh evidence,
  - moved vertex refs and deltas,
  - bounds/hash changes,
  - topology summary,
  - viewer evidence wrapper and context,
  - semantic no-renderer boundary.
- Validator fixture pins:
  - valid final package with runtime/viewer mesh evidence passing viewer validation,
  - invalid topology report covering `mesh.vertexStableIdsLengthMismatch`, `mesh.uvCountMismatch`, `mesh.triangleIndexOutOfRange`, and `mesh.degenerateTriangle`.
- Editor-only selection evidence pins:
  - selected stable vertex refs,
  - `activeTool=meshEdit`,
  - no lock/editor-hidden state,
  - `runtimeRenderingSemanticsClaim=none`,
  - explicit assertion that runtime evidence does not carry selection state.

## Verification Run

Passed:

- `pnpm.cmd exec vitest run packages/operation-core/src/wave29-mesh-edit-contract-fixtures.test.ts packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts packages/validator-core/src/wave29-mesh-edit-contract-fixtures.test.ts`
  - 3 files passed
  - 3 tests passed
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts packages/operation-core/src/operations/move-mesh-vertex.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts packages/runtime-core/src/mesh-evidence.test.ts packages/runtime-core/src/runtime-evidence.test.ts packages/runtime-core/src/viewer-evaluation.test.ts packages/validator-core/src/mesh-topology-diagnostics.test.ts packages/validator-core/src/minimal-contract-fixture.test.ts packages/operation-core/src/wave29-mesh-edit-contract-fixtures.test.ts packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts packages/validator-core/src/wave29-mesh-edit-contract-fixtures.test.ts`
  - 12 files passed
  - 52 tests passed
- `pnpm.cmd typecheck`
  - passed root and editor typecheck
- `git diff --check -- fixtures/contracts/wave29-mesh-edit-contract-fixtures packages/operation-core/src/wave29-mesh-edit-contract-fixtures.test.ts packages/runtime-core/src/wave29-mesh-edit-contract-fixtures.test.ts packages/validator-core/src/wave29-mesh-edit-contract-fixtures.test.ts`
  - passed

## Skipped Verification

- Full `pnpm test:unit`, e2e, accessibility, and browser workflow tests were not run. Domain E is fixture-facing and does not implement UI workflow or browser behavior.
- Fixture registration docs under `discussion/tests/**` were not edited because the Domain E allowed write scope did not include them.

## Remaining Issues

- `discussion/tests/fixtures/fixture-manifest.md` and `discussion/tests/traceability/test-traceability-matrix.md` may need narrow registration for `wave29-mesh-edit-contract-fixtures` in a later integration or Domain H pass. This was intentionally left as an integration item because those paths were outside Domain E write scope.

## User Decision Points

- None.

## Rights / Forbidden-Scope Notes

- Fixture data is text-only generated geometry and semantic JSON.
- No real asset bytes, PSD parser, image decode, file picker, archive I/O, external dependency, Cubism compatibility claim, Cubism SDK/Core, third-party model, renderer oracle, pixel oracle, topology editor, or UV editor was introduced.
- Public `index.ts` files were not edited.
