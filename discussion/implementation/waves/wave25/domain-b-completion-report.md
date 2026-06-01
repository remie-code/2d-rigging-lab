# Wave25 Domain B Completion Report

> Target: `wave25-runtime-rig-control-hierarchy-evidence`  
> Date: 2026-06-01  
> Orch-Sylph: current context  
> Gnome implementation: `019e802e-bb0b-7f81-8ffd-b9e685a8a713` / `Gnome the 50th`  
> Review-Sylph: `019e804e-1540-7ea3-95ef-11405544873c` / `Sylph the 52nd`  
> Status: `pass`

## Summary

Domain B is `pass`.

Gnome implemented focused Minimum Rig Control v1 runtime hierarchy/evidence behavior in `packages/runtime-core`. The runtime now evaluates `rotation2d` rig controls deterministically, records parent-before-child hierarchy order, exposes local/world transform state, summarizes affected drawable and child rig control targets, carries rig-control changes through runtime snapshot / diff / evidence / viewer evaluation paths, and keeps `warpLattice2d` as unsupported/no-op evidence.

Review-Sylph initially returned `needs_fix` for invalid hierarchy behavior: blocking cycle/missing hierarchy diagnostics could still produce evaluated rig-control output and transformed drawables. Gnome completed fix loop 1 by propagating blocked hierarchy state, preserving blocked snapshot entries, and preventing blocked transforms from applying to drawables. Review-Sylph re-reviewed the actual changed files and verification and returned `pass` with no open findings.

This domain does not implement operation handlers, validator broad implementation, editor UI, warp lattice deformation, direct vertex physics, direct rig-control physics output, file picker/parser/archive/image decode, actual binary upload, external dependencies, or Cubism compatibility claims.

## Changed Files

Runtime source and tests:

- `packages/runtime-core/src/rig-control-transform.ts`
- `packages/runtime-core/src/rig-control-hierarchy.ts`
- `packages/runtime-core/src/rig-control-keyform-state.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/index.ts`
- `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`

Reports:

- `discussion/implementation/waves/wave25/domain-b-gnome-implementation-report.md`
- `discussion/implementation/reviews/wave25/domain-b-review.md`
- `discussion/implementation/waves/wave25/domain-b-completion-report.md`

Shared worktree note: Domain A and parallel Wave25 Domain C/D-looking changes were present while Domain B ran. They were not reverted and are not claimed as Domain B implementation.

## Implemented Evidence

- Same graph/input produces identical rig-control runtime snapshot and diff output.
- Rig controls are ordered deterministically with parents before children.
- `rotation2d` local transform state is derived from rest state plus rig-control keyform samples.
- Child rig controls inherit parent world matrices, and non-blocked child drawables receive the owning rig control world transform.
- Snapshot `rigControls` entries include hierarchy index, evaluation status, direct children, affected drawables, affected rig controls, local/world transform state, and unsupported warp metadata where applicable.
- Runtime diff exposes rig-control field changes as JSON pointer paths under `/rigControls/...` through the existing runtime diff field-change channel.
- Cycle, missing parent, and missing child rig-control hierarchy states now produce blocked runtime evidence and do not apply transforms to drawables.
- Viewer/runtime evaluation uses the same runtime-core snapshot/diff projection.

## Verification

Gnome and Review-Sylph both reported the final fix-loop verification as passing:

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts` | pass; 1 file / 6 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | pass; 24 files / 73 tests |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd test:unit` | pass; 122 files / 619 tests |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- packages/runtime-core discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | pass; LF/CRLF working-copy warnings only |

Review-Sylph also reported:

- dependency manifest status check for root/workspace/runtime-core manifests: no listed changes;
- forbidden-scope text scan of Domain B fix-loop files: no blocker, only the Gnome report's explicit non-goal statement.

Browser/e2e verification was not run for Domain B because this domain touched runtime-core source/tests only and no editor UI workflow.

## Review Result

Review artifact: `discussion/implementation/reviews/wave25/domain-b-review.md`.

Final verdict: `pass`.

Review findings:

- Initial high finding: blocking hierarchy diagnostics did not block evaluated runtime output.
- Fix loop 1 result: finding fixed.
- No open findings.
- No further Gnome fixes required.

Review-Sylph confirmed design/development compliance, source organization compliance, test adequacy, dependency policy compliance, forbidden-scope compliance, and `index.ts` barrel-only status after fix loop 1.

## Residual Risks

- Runtime diff carries rig-control field changes through existing `RuntimeDiffDto.parameterChanges`; `/rigControls/...` paths are visible and schema-compatible, but the field name remains historically parameter-oriented.
- `warpLattice2d` remains unsupported/no-op runtime evidence. No lattice deformation, bilinear lattice vertex evaluation, or warp domain behavior was implemented.
- Runtime hierarchy diagnostics are runtime evidence. Formal validator policy/catalog alignment for rig-control hierarchy diagnostics remains Domain C scope.
- Runtime missing-parent hierarchy emits `rigControl.parentMissing` from runtime-core; central validator catalog alignment remains outside Domain B.
- The implemented `rotation2d` matrix convention is deterministic: translate, rotate/scale around pivot, then compose parent-before-child. Future product changes to transform order would require fixture updates.
- Verification ran in a shared dirty worktree with Domain A and parallel Wave25 changes present, not a clean checkout replay.

## User Decision Points

None.

No source-document conflict, dependency approval need, forbidden scope need, or unclear module boundary remains for Domain B.
