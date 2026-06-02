# Wave32 Domain G Gnome Unit Test Fix Report

Target: `wave32-domain-g-unit-test-stale-unsupported-operation-fix`
Date: 2026-06-02
Verdict: `done`

## Scope Implemented

- Updated the stale unsupported-operation lifecycle fixture in `packages/operation-core/src/operation-lifecycle.test.ts`.
- Replaced `createWarpLattice2dRigControl` with schema-valid `deleteDynamicsGroup`, which remains without a registered operation handler.
- Did not edit production source, manifests, lockfiles, dependencies, fixtures, UI, runtime, validator, or broad docs.

## Files Changed

- `packages/operation-core/src/operation-lifecycle.test.ts`
- `discussion/implementation/waves/wave32/domain-g-gnome-unit-test-fix-report.md`

## Rationale

`createWarpLattice2dRigControl` is now implemented and registered by Wave32 Domain E, so it no longer exercises the lifecycle unsupported-operation branch. `deleteDynamicsGroup` is still present in the operation request schema but absent from `operationHandlers`, so the test continues to prove that a schema-valid unsupported operation is rejected without mutating package revision, authoring revision, dirty state, or operation log.

## Verification

- `pnpm.cmd exec vitest run packages/operation-core/src/operation-lifecycle.test.ts`
  - Result: passed, 1 file / 17 tests.
- `pnpm.cmd test:unit`
  - Result: passed, 169 files / 846 tests.
- `pnpm.cmd typecheck`
  - Result: passed.

## Residual Risks

- None identified.
