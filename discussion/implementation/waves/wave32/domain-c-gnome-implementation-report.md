# Wave32 Domain C Gnome Implementation Report

Target: `wave32-validator-warp-lattice-diagnostics`
Date: 2026-06-02
Verdict: `done`

## Scope Implemented

- Added deterministic validator diagnostics for `warpLattice2d` package/runtime evidence.
- Kept implementation inside `packages/validator-core/src/**` plus focused validator tests.
- Updated `discussion/design/module-contracts/validator-contract.md` only to register the new formal check IDs and rules.
- Did not edit operation handlers, Editor UI, runtime algorithm implementation, dependencies, manifests, lockfiles, or public `index.ts` implementation logic.

## Files Changed

- `packages/validator-core/src/validators/warp-lattice-diagnostics.ts`
- `packages/validator-core/src/validators/warp-lattice-schema-issues.ts`
- `packages/validator-core/src/validators/rig-control-semantic.ts`
- `packages/validator-core/src/validators/rig-control-keyform-evidence.ts`
- `packages/validator-core/src/validators/package-schema.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/warp-lattice-diagnostics.test.ts`
- `packages/validator-core/src/rig-control-runtime-evidence.test.ts`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave32/domain-c-gnome-implementation-report.md`

## Diagnostics Added / Changed

Added:

- `rigControl.warpLatticeCardinalityMismatch`
- `rigControl.warpLatticeDomainBoundsInvalid`
- `rigControl.warpLatticeRestControlPointMismatch`
- `rigControl.warpLatticeUnsupportedProperty`
- `rigControl.warpLatticeMalformedPatch`
- `rigControl.warpLatticeRuntimeEvidenceMismatch`

Changed behavior:

- Wave26-era `warpLattice2d` unsupported/no-op runtime evidence is no longer accepted as non-blocking when validating Wave32 warp lattice semantics.
- `pkg.schema.requiredFileMissing` fallback remains for general package schema failures, but package-format `warpLattice2d` cardinality/domain/patch Zod issues are now mapped to the formal warp lattice check IDs above.
- `rigControl.runtimeEvidenceMissing` remains the stable missing/stale snapshot identity diagnostic for enabled rig controls.

## Verification

Passed:

```text
pnpm.cmd exec vitest run packages/validator-core/src/warp-lattice-diagnostics.test.ts packages/validator-core/src/rig-control-runtime-evidence.test.ts
```

Result: 2 test files passed, 16 tests passed.

Typecheck:

```text
pnpm.cmd typecheck
```

Result: passed.

## Assumptions / Residual Risks

- Validator-core does not recompute warp deformation geometry. It validates package shape and supplied runtime/viewer-aligned semantic evidence only.
- Current Viewer evidence coverage relies on existing `viewer.runtimeEvidenceMissing` / `viewer.runtimeEvidenceStale` plus runtime snapshot rig-control evidence; no Viewer UI or runtime evidence producer was changed in this domain.
- Package-format Wave32 schema hardening already maps some malformed package cases before semantic validation. Domain C now converts those Zod issues to stable warp lattice diagnostics.
