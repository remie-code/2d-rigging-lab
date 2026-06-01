# Wave25 Domain C Completion Report

> Target: `wave25-validator-rig-control-semantic-checks`  
> Date: 2026-06-01  
> Owner role: Gnome implementation agent  
> Review-Sylph: clean re-review artifact recorded in `discussion/implementation/reviews/wave25/domain-c-review.md`  
> Status: `pass`

## Summary

Domain C is `pass`.

The validator implementation adds formal rig-control semantic diagnostics for cycles, missing parents/children, invalid child target kinds, parent/child mismatches, and runtime evidence gaps. Review-Sylph initially required a fix loop for parentId-only cycles, runtime evidence mismatch comparison, and reciprocal parent/child mismatch classification. Those findings were addressed and the clean re-review returned `pass` with no open findings.

This domain does not implement a runtime evaluator, operation handler, editor UI, warp lattice evaluator, file picker/parser/archive/image decode behavior, external dependencies, package manifest/lockfile changes, or Cubism SDK/Core, Cubism Viewer, or Cubism Physics compatibility claims.

## Changed files

- `packages/validator-core/src/check-catalog.ts`
  - Added rig control semantic/evaluation phases and formal check IDs:
    - `rigControl.cycle`
    - `rigControl.parentMissing`
    - `rigControl.childMissing`
    - `rigControl.invalidChildTargetKind`
    - `rigControl.parentChildMismatch`
    - `rigControl.runtimeEvidenceMissing`
- `packages/validator-core/src/validators/rig-control-semantic.ts`
  - Added deterministic rig control hierarchy validation for parent references, child targets, parent/child mismatch, cycles, and runtime evidence gaps.
  - Fix loop 1:
    - Cycle detection now includes `parentId`-derived parent-to-child edges, so parentId-only cycles fail deterministically.
    - Runtime evidence now compares runtime snapshot `kind`, `enabled`, and `parentId` against enabled package rig controls.
    - Reciprocal parent/child disagreement now emits `rigControl.parentChildMismatch` instead of `rigControl.invalidChildTargetKind`.
- `packages/validator-core/src/validators/package-runtime.ts`
  - Wired rig control semantic validation into package reference/runtime collection.
- `packages/validator-core/src/validators/package-schema.ts`
  - Mapped malformed child collection schema issues to `rigControl.invalidChildTargetKind` without broad report redesign.
- `packages/validator-core/src/index.ts`
  - Added barrel-only export for the new validator module.
- `packages/validator-core/src/rig-control-semantic.test.ts`
  - Added focused tests for valid parent/child packages, child-list cycles, parentId-only cycles, missing targets, parent/child mismatches, invalid child target kinds, runtime evidence mismatches/gaps, and catalog alignment.
- `discussion/design/module-contracts/validator-contract.md`
  - Added the new rig control validator check IDs and concise validation rules, including `rigControl.parentChildMismatch`.

## Verification

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/validator-core/src/rig-control-semantic.test.ts` | pass; 1 file / 9 tests |
| `pnpm.cmd exec vitest run packages/validator-core/src` | pass; 13 files / 70 tests |
| Compatibility-focused validator run covering validator-core, dynamics, viewer evidence, binary asset, PSD source profile, and source asset rights/provenance tests | pass; 7 files / 47 tests |
| `pnpm.cmd test:unit` | pass; 119 files / 606 tests |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `pnpm.cmd typecheck` | pass |
| `git diff --check -- packages/validator-core discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | pass; LF/CRLF working-copy warnings only |

## Review Result

Review artifact: `discussion/implementation/reviews/wave25/domain-c-review.md`.

Verdict: `pass`.

Findings:

- No open findings.
- Fix loop 1 closed the parentId-only cycle, runtime evidence mismatch, and parent/child mismatch classification findings.

Review-Sylph confirmed formal check ID alignment, validator contract drift bounded to rig-control diagnostics, source organization compliance, dependency policy compliance, forbidden-scope compliance, and focused test adequacy.

## Known residual risks

- Runtime evidence validation is intentionally limited to project-defined snapshot evidence presence plus `kind`, `enabled`, and `parentId` comparison for enabled package rig controls. It does not implement a runtime evaluator, warp lattice evaluator, or viewer/Cubism compatibility checks.
- Fixture-facing expected artifacts for wider parent-child rig control acceptance are handled by Domain D.
- `rigControl.invalidChildTargetKind` is now restricted to wrong child collection/type mapping. Parent/child reciprocal disagreement uses `rigControl.parentChildMismatch`.

## User Decision Points

None.

No source-document conflict, dependency approval need, forbidden-scope need, or unclear module boundary remains for Domain C.
