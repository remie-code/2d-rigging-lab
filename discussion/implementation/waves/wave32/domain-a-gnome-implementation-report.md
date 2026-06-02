# Wave32 Domain A Gnome Implementation Report

Target: `wave32-warp-lattice-contract-package-footing`

Verdict: `done`

## Scope Changed

- `packages/contracts/src/warp-lattice2d.ts`
  - Added project-defined `warpLattice2d` v0 contract footing constants and schemas.
  - Fixed control point ordering as `rowMajorYThenXFromDomainMinV1`: row-major, y then x, starting at `domainBounds.x/y`.
  - Added positive `domainBounds`, lattice cardinality helpers, `controlPointOffsets` Vec2[] shape, bind-space/interpolation/outside-domain policy constants.
- `packages/contracts/src/runtime-diff.ts`
  - Added optional `rigControlChanges` runtime diff evidence shape for `warpLattice2d`.
  - Evidence shape records evaluation status, bind space, domain bounds, interpolation, control point order, offset count, outside-domain policy, affected drawables, bounds/hash/delta refs.
- `packages/contracts/src/index.ts`
  - Barrel-only export for `warp-lattice2d`.
- `packages/package-format/src/model-files.ts`
  - Enforced `warpLattice2d` package schema footing:
    - `domainBounds.width > 0` and `domainBounds.height > 0`.
    - `latticeColumns >= 2`, `latticeRows >= 2`.
    - `restControlPoints.length === latticeColumns * latticeRows`.
  - Refined `controlPointOffsets` keyform patch convention:
    - target is `rigControl.controlPointOffsets`.
    - `statePatch` must be control-point-ordered `Vec2[]`.
    - composition mode must be `replace` or `additiveDelta`.
- `packages/contracts/src/warp-lattice2d.test.ts`
  - Focused contract tests for ordering, domain bounds, offset shape, and runtime diff evidence shape.
- `packages/package-format/src/warp-lattice2d-contract.test.ts`
  - Focused package-format schema tests for valid/invalid lattice/cardinality/domain bounds and keyform patch shape.

## Verification

Passed:

- `pnpm.cmd exec vitest run packages/contracts/src/warp-lattice2d.test.ts packages/package-format/src/warp-lattice2d-contract.test.ts`
  - 2 files, 9 tests passed.
- `pnpm.cmd exec vitest run packages/contracts/src/runtime-diff.test.ts packages/contracts/src/diff-envelopes.test.ts packages/contracts/src/contracts-integration.test.ts packages/package-format/src/minimal-contract-fixture.test.ts`
  - 4 files, 13 tests passed.
- `pnpm.cmd exec vitest run packages/contracts/src packages/package-format/src`
  - 20 files, 129 tests passed.
- `pnpm.cmd exec tsc --noEmit --pretty false --moduleResolution bundler --module esnext --target es2022 --strict --skipLibCheck packages/contracts/src/warp-lattice2d.ts packages/contracts/src/runtime-diff.ts packages/package-format/src/model-files.ts`
  - Passed.

Attempted but blocked:

- `pnpm.cmd typecheck`
  - Failed in out-of-scope untracked file `packages/validator-core/src/validators/warp-lattice-diagnostics.ts`.
  - Errors:
    - `TS18048: 'key' is possibly 'undefined'` at line 604, column 13.
    - `TS18048: 'key' is possibly 'undefined'` at line 604, column 43.
  - Domain A did not edit validator-core because it is outside the allowed write scope.

## Residual Risks

- Runtime evaluation is not implemented here by design. `rigControlChanges` is only a schema/evidence footing for later runtime/evaluator work.
- Cross-file validation that a `controlPointOffsets` keyform length matches the targeted rig control lattice cardinality remains validator/runtime domain work. Package-format enforces the authored rig-control cardinality and the keyform patch shape independently.
- `controlPointOrder` is a contract constant rather than a new authored package field, preserving existing package object compatibility while fixing deterministic v0 ordering.

## Index / Dependency Notes

- `packages/contracts/src/index.ts` remains barrel-only.
- `packages/package-format/src/index.ts` was not changed.
- No package manifest, lockfile, external dependency, runtime algorithm, operation handler, or editor UI changes were made.
