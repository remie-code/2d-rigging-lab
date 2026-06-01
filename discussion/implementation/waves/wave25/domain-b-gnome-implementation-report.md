# Wave25 Domain B Gnome Implementation Report

> Target: `wave25-runtime-rig-control-hierarchy-evidence`  
> Date: 2026-06-01  
> Agent: Gnome implementation agent  
> Status: `ready_for_re_review`

## Summary

Implemented focused Minimum Rig Control v1 runtime behavior in `packages/runtime-core`.

The runtime now evaluates `rotation2d` rig controls deterministically, records parent-before-child hierarchy order, exposes local/world transform state, summarizes affected child drawables and child rig controls, applies the resulting transform to child drawable vertices/bounds/hash, and carries rig-control transform changes through runtime snapshot / diff / runtime evidence / viewer evaluation paths.

This implementation does not add operation handlers, validator broad implementation, editor UI, external dependencies, Cubism compatibility, direct physics output, or a warp lattice deformation evaluator. `warpLattice2d` is preserved as schema-compatible unsupported/no-op runtime evidence.

The shared worktree also contains Domain A and parallel Domain C/D-looking changes. This report claims only the Domain B files listed below.

Fix loop 1 addressed Review-Sylph `019e804e-1540-7ea3-95ef-11405544873c` finding that blocking hierarchy diagnostics still allowed evaluated rig-control output and drawable transforms.

## Changed Files

- `packages/runtime-core/src/rig-control-transform.ts`
  - Owns deterministic 2D affine matrix helpers and `rotation2d` local/world transform DTOs.
- `packages/runtime-core/src/rig-control-hierarchy.ts`
  - Owns parent-before-child hierarchy ordering, descendant rig-control collection, affected drawable summaries, and blocked hierarchy propagation for cycle / missing parent / missing child rig-control relations.
- `packages/runtime-core/src/rig-control-keyform-state.ts`
  - Owns small keyform-sample application for `rotation2d` local state: angle, translation, and scale.
- `packages/runtime-core/src/rig-control-evaluation.ts`
  - Evaluates rig controls, preserves blocked snapshot entries for invalid hierarchy, skips blocked hierarchy drawable transforms, records unsupported warp evidence, and emits runtime diagnostics for missing/duplicate hierarchy edges.
- `packages/runtime-core/src/snapshot.ts`
  - Adds evaluated rig-control projection to runtime snapshots and inserts `rigControl_evaluation` into traced phases.
- `packages/runtime-core/src/snapshot-comparison.ts`
  - Adds rig-control transform/status/affected-target field changes to the existing runtime diff field-change list.
- `packages/runtime-core/src/index.ts`
  - Barrel-only exports for the new runtime-core modules.
- `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`
  - Focused Domain B coverage for determinism, parent-before-child order, snapshot/diff/evidence, viewer path, warp no-op evidence, and blocked cycle / missing parent / missing child rig-control hierarchy behavior.

## Behavior Implemented

- Same graph/input produces identical rig-control runtime snapshot and diff output.
- Rig controls are ordered deterministically with parents before children.
- `rotation2d` local transforms are derived from rest state plus rig-control keyform samples.
- Child rig controls inherit parent world matrices, and child drawables receive the owning rig control world transform.
- Snapshot `rigControls` entries include `hierarchyIndex`, `evaluationStatus`, direct children, affected drawables, affected rig controls, local/world transform state, and unsupported warp metadata where applicable.
- Runtime diff exposes rig-control changes as JSON pointer field changes under `/rigControls/...`, using the existing `RuntimeDiffDto.parameterChanges` field-change channel already used for `/drawList`.
- Viewer/runtime evaluation reuses the same snapshot/diff projection without a separate viewer-specific implementation.

## Fix Loop 1 Behavior

- `rigControl.cycle`, `rigControl.parentMissing`, and `rigControl.childMissing` now propagate blocked hierarchy state into runtime rig-control evaluation.
- Existing rig-control nodes affected by invalid hierarchy are retained in snapshots with `evaluationStatus: "blocked"` so Viewer / Runtime surfaces can show diagnostic evidence without presenting them as evaluated.
- Blocked rig-control world matrices are not applied to child drawables. The focused tests use non-zero rest rotations and assert the drawable bounds/vertices remain unchanged.
- Disabled and unsupported non-blocked behavior is preserved; the transform application skip is limited to `evaluationStatus: "blocked"`.

## Verification

All listed commands passed.

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts` | pass; 1 file / 6 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | pass; 24 files / 73 tests |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd test:unit` | pass; 122 files / 619 tests |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- packages/runtime-core discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | pass; LF/CRLF working-copy warnings only |

## Residual Risks

- Runtime diff contract was not broadened in `packages/contracts`; rig-control diff evidence uses the existing field-change list in `parameterChanges`. This preserves write scope and schema compatibility but the field name remains broader-in-practice than its historical label.
- `warpLattice2d` remains unsupported/no-op runtime evidence. No lattice deformation, bilinear lattice vertex evaluation, or warp domain behavior was implemented.
- Runtime hierarchy diagnostics are best-effort runtime evidence. Formal validator policy for cycles, missing child targets, invalid target kinds, and runtime evidence gaps remains Domain C scope.
- Runtime missing-parent hierarchy now emits `rigControl.parentMissing` from runtime-core. This is local runtime evidence; any central validator catalog alignment remains outside Domain B.
- The implemented `rotation2d` matrix convention is deterministic: translate, rotate/scale around pivot, then compose parent-before-child. Future product changes to transform order would require fixture updates.
- Verification ran in a shared dirty worktree with Domain A and parallel Wave25 changes present, not a clean checkout.

## Skipped Verification

- Browser/e2e verification was not run for Domain B because this domain only touched runtime-core source/tests and no editor UI workflow.
