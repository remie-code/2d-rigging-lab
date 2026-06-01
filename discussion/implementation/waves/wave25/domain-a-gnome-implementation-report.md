# Wave25 Domain A Gnome Implementation Report

> Target: `wave25-rig-control-authoring-operation-foundation`  
> Role: Gnome source implementation  
> Date: 2026-06-01  
> Verdict: `implemented`

## Summary

Implemented Minimum Rig Control v1 authoring and operation foundation for `rotation2d` creation and child binding.

- Added authoring selectors and mutations for `rotation2d` rig control creation and `bindRigControlChild`.
- Added operation handlers for `createRotation2dRigControl` and `bindRigControlChild`.
- Registered both operations in the operation lifecycle registry.
- Preserved `createWarpLattice2dRigControl` as schema-only / unsupported handler scope for this domain.
- Added focused authoring and operation tests for dry-run, commit, operation log targets, model diff target refs, invalid child target diagnostics, and package materialization roots/relations.

## Changed Files

- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/rig-control-selectors.ts`
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.test.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operation-lifecycle.test.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/operation-core/src/operations/create-rotation2d-rig-control.ts`
- `packages/operation-core/src/operations/bind-rig-control-child.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`
- `discussion/implementation/waves/wave25/domain-a-gnome-implementation-report.md`

## Verification

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/rig-control-mutations.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/operation-core/src/operation-schemas.test.ts` | pass; 4 files / 31 tests |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- packages/authoring-core packages/operation-core discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | pass; LF/CRLF working-copy warnings only |
| `pnpm.cmd test:unit` | pass; 117 files / 597 tests |

## Implementation Notes

- `createRotation2dRigControl` creates deterministic `rig_*` IDs from display name, writes `restTranslation: { x: 0, y: 0 }`, `restScale: { x: 1, y: 1 }`, and `enabled: true`, then adds the rig control to `stableOrder` and `rigControlRootIds`.
- Child drawable and child rig control relationships are preserved in `AuthoringGraph` and materialize through existing package model file builders.
- `bindRigControlChild` supports only `drawable` and `rigControl` target refs. Other target kinds, malformed child IDs, missing targets, duplicate/no-op binding, already-parented children, self-child, and cycle cases return deterministic operation diagnostics.
- Child rig control binding updates both the parent `childRigControlIds` and the child `parentId`, and removes the child from `rigControlRootIds`.
- Operation results include `modelDiff` entries and checked target refs for rig control, part, child drawable, child rig control, and graph root changes where applicable.

## Residual Risks

- Runtime evaluator behavior for rig control transforms is intentionally not implemented in Domain A.
- Validator formal rig control diagnostics are intentionally left for later Wave25 domains.
- `createWarpLattice2dRigControl` remains payload/schema-supported but lifecycle-handler-unsupported in this domain.
- The binding policy is conservative: a child drawable or child rig control may not be bound to multiple rig controls. This avoids ambiguous hierarchy materialization until runtime/validator domains harden graph semantics.

## Questions

None for Orch-Sylph from Domain A implementation.
