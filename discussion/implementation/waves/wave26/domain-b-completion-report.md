# Wave 26 Domain B Completion Report

> Target: `wave26-runtime-rig-control-keyform-evidence-hardening`  
> Date: 2026-06-01  
> Orch-Sylph: current context  
> Gnome implementation: `019e80fa-07e7-7a91-b5ba-0f7e78c51fba` / `Gnome the 69th`  
> Review-Sylph: `019e8106-5893-7ad1-96cb-10920572acc0` / `Sylph the 69th`  
> Status: `pass`

## Summary

Domain B is `pass`.

Gnome implemented focused runtime-core hardening for `rotation2d` rig-control keyform evidence. Runtime diff now exposes traceable world transform field changes for rig controls, and a new focused runtime evidence test fixes the expected behavior for deterministic `angleDegrees` keyform output, local/world transform effects, affected drawable evidence, invalid patch diagnostics, and truthful `warpLattice2d` unsupported/no-op evidence.

Review-Sylph performed an independent clean review using the basis documents, changed files, diff, and verification summary rather than relying only on the implementation summary. Both review lanes returned `pass`: Design / Development Compliance and Test Adequacy.

This domain did not implement operation handlers, validator broad behavior, editor UI, full renderer or pixel oracle behavior, direct physics, warp lattice deformation, file picker/parser/archive/image decode, actual binary upload, external dependency changes, package manifest/lockfile changes, or Cubism compatibility claims.

## Changed Files

Runtime source and tests:

- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`

Reports:

- `discussion/implementation/reviews/wave26/domain-b-review.md`
- `discussion/implementation/waves/wave26/domain-b-completion-report.md`

Shared worktree note: parallel Wave26 changes outside Domain B were present in authoring-core, operation-core, validator-core, and implementation planning files. They were not reverted and are not claimed as Domain B implementation.

## Implemented Evidence

- Same viewer/runtime input produces deterministic rig-control keyform snapshot and runtime diff output.
- `rotation2d:angleDegrees` keyform output changes rig-control local/world transform evidence.
- Child rig-control world transform propagation and affected drawable evidence are visible in runtime snapshots.
- Affected drawable bounds and vertices change in response to the keyform-driven rotation.
- Runtime diff contains traceable `/rigControls/.../worldTransform/angleDegrees` paths, in addition to existing local transform and matrix paths.
- Invalid rig-control keyform patches emit deterministic runtime diagnostics for invalid patch shape, unsupported composition mode, and unsupported target property.
- `warpLattice2d` keyform samples remain visible as unsupported/no-op evidence and do not deform drawables.
- Existing runtime-core keyform, dynamics, viewer, fixture, and rig-control tests remain compatible.

## Verification

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/viewer-evaluation.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts` | pass; 4 files / 16 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | pass; 25 files / 76 tests |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- packages/runtime-core/src discussion/implementation/waves/wave26 discussion/implementation/reviews/wave26` | pass; LF/CRLF working-copy warning only |
| `pnpm.cmd typecheck` | fail in shared worktree due validator-core errors outside Domain B scope |

The typecheck failure is currently in `packages/validator-core/src/validators/rig-control-runtime-evidence.ts`, where TypeScript reports `keyform` may be undefined. Validator-core is outside Domain B write scope and is expected to be handled by Domain C or final Wave26 integration before the full wave can pass.

## Review Result

Review artifact: `discussion/implementation/reviews/wave26/domain-b-review.md`.

Final Review-Sylph verdict: `pass`.

Review findings:

- Design / Development Compliance: `pass`; the diff stays inside runtime-core Domain B scope and introduces no forbidden implementation or dependency changes.
- Test Adequacy: `pass`; the new focused test directly covers deterministic runtime output, local/world transform evidence, affected drawable evidence, runtime diff traceability, invalid diagnostics, and `warpLattice2d` unsupported/no-op behavior.
- No source fixes required.

## Residual Risks

- Runtime diff continues to carry rig-control field changes through the existing `RuntimeDiffDto.parameterChanges` channel. This is schema-compatible and accepted for Domain B, but the field name remains historically parameter-oriented.
- The new runtime diff additions include world transform `translation` and `scale` paths. The Domain B fixture centers on `angleDegrees`; direct translation/scale keyform cases remain future coverage if those properties become pass criteria.
- `warpLattice2d` remains unsupported/no-op evidence. No lattice deformation or bilinear warp evaluator was implemented.
- Final Wave26 integration remains blocked until the validator-core typecheck failure from outside Domain B is resolved.
- Verification ran in a shared dirty worktree, not a clean checkout replay.

## User Decision Points

None for Domain B.

No source-document conflict, dependency approval need, forbidden scope need, or unclear runtime module boundary remains for this domain.
