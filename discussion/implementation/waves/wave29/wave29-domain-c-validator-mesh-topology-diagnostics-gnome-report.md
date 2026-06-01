# Wave29 Domain C Gnome Report: Validator Mesh Topology Diagnostics

## Verdict

fixed

## Scope

- Target: `wave29-validator-mesh-topology-diagnostics`
- Owner context: Gnome implementation agent
- Allowed source scope used:
  - `packages/validator-core/src/**`
  - validator focused tests
  - `discussion/design/module-contracts/validator-contract.md`
  - `discussion/implementation/waves/wave29/**`

## Files Changed

- `packages/validator-core/src/validators/mesh-semantics.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/validators/part-layer-semantics.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `packages/validator-core/src/mesh-topology-diagnostics.test.ts`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave29/wave29-domain-c-validator-mesh-topology-diagnostics-gnome-report.md`

## Diagnostics Added Or Reinforced

- `mesh.triangleIndexOutOfRange`
  - Reinforced with deterministic per-corner target paths and evidence.
- `mesh.degenerateTriangle`
  - Added to catalog and implementation.
  - Reports repeated-index and exact zero-area triangles as warning diagnostics.
- `mesh.vertexStableIdsLengthMismatch`
  - Added to catalog, contract, and implementation.
  - Emits error diagnostics when `vertexStableIds.length !== vertices.length`.
- `mesh.uvCountMismatch`
  - Added to catalog, contract, and implementation.
  - Emits error diagnostics when `uvs.length !== vertices.length`.
- `mesh.runtimeEvidenceMissing`
  - Added to catalog, contract, and implementation.
  - Emits only when runtime/viewer mesh evidence is required, avoiding broad regressions in package-only validation.
- `editorState.staleReference`
  - Reinforced for vertex stable ID selection state by treating current `vertexStableIds` as valid editor targets.
  - Stale selected vertex refs remain warning-level editor-only diagnostics with `runtimeSemantics=unchanged`.

## Implementation Notes

- Added `validateMeshSemantics` as a focused validator file rather than adding implementation logic to `index.ts`.
- Integrated mesh checks into `validatePackageRuntime` and `validatePackageRuntimeWithBinaryAssets`.
- Kept runtime evidence requirements gated by `profile: "viewer"` or `requireViewerEvidence: true`, so editor-only or package-only validation does not accidentally become runtime rendering failure evidence.
- Updated `validator-contract.md` only for the newly formalized mesh check IDs and rules.

## Verification

Passed:

- `pnpm.cmd exec vitest run packages/validator-core/src/mesh-topology-diagnostics.test.ts`
  - 6 tests passed.
- `pnpm.cmd exec vitest run packages/validator-core/src/mesh-topology-diagnostics.test.ts packages/validator-core/src/mask-composition-diagnostics.test.ts`
  - 17 tests passed.
- `git diff --check -- packages/validator-core/src discussion/design/module-contracts/validator-contract.md`
  - Passed; only line-ending warnings were reported.

Fix iteration verification:

- `pnpm.cmd exec vitest run packages/validator-core/src/mesh-topology-diagnostics.test.ts packages/validator-core/src/mask-composition-diagnostics.test.ts packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
  - Passed, 28 tests.
- `pnpm.cmd exec vitest run packages/validator-core/src`
  - Passed, 18 files / 106 tests.
- `git diff --check -- packages/validator-core/src discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave29`
  - Passed; only line-ending warnings were reported.

Partially blocked by parallel/out-of-scope changes:

- `pnpm.cmd exec vitest run packages/validator-core/src`
  - Domain C mesh and existing mask/part/viewer focused tests passed.
  - 3 failures remain in fixture tests due to `packages/runtime-core/src/mesh-evidence.ts` parsing undefined `comparisonPolicy`; runtime-core is outside Domain C write scope.
- `pnpm.cmd typecheck`
  - Initial run failed on runtime-core mesh evidence type errors from parallel/out-of-scope changes.
  - Fix iteration rerun passed `typecheck:root`, then failed in `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts` on tuple/literal typing issues from parallel editor-state work outside Domain C.
  - No validator-core TypeScript errors were reported.

## Fix Iteration Summary

- Addressed Review-Sylph finding that `runtimeSnapshot.drawables[].mesh` was not inspected.
- `validateMeshSemantics` now validates nested per-drawable mesh evidence when the package is in mesh-edit editor state or when a supplied runtime snapshot actually carries `drawables[].mesh`.
- Added deterministic `mesh.runtimeEvidenceMissing` diagnostics for:
  - present runtime drawable with missing `drawables[].mesh`;
  - present runtime drawable with inconsistent nested mesh evidence.
- Added zero-area degenerate triangle coverage in addition to repeated-index degeneration.
- Preserved compatibility for non-mesh-edit viewer/runtime evidence such as Wave28 part/texture/layer and mask diagnostics.

## Remaining Issues

- Runtime-core mesh evidence/type errors are present in parallel edits outside this domain:
  - `createRuntimeMeshEditEvidence` parses an undefined `comparisonPolicy`.
  - Several runtime-core mesh evidence DTO assignments conflict with `exactOptionalPropertyTypes`.
- These should be routed to the runtime/preview evidence owner rather than fixed in Domain C.

## User Decision Points

None for Domain C.
