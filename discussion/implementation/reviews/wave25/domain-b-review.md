# Wave25 Domain B Independent Review

> Target: `wave25-runtime-rig-control-hierarchy-evidence`  
> Date: 2026-06-01  
> Reviewer: Review-Sylph  
> Implementation agent reviewed: Gnome `019e802e-bb0b-7f81-8ffd-b9e685a8a713` / `Gnome the 50th`  
> Verdict: `pass` after fix loop 1 re-review; initial review verdict was `needs_fix`

## Findings

### High: Blocking hierarchy diagnostics do not block evaluated runtime output

- `packages/runtime-core/src/rig-control-hierarchy.ts:91` emits `rigControl.cycle`, and `packages/runtime-core/src/rig-control-hierarchy.ts:155` emits `rigControl.childMissing`, but the traversal still unwinds into `visited` and appends the node to `ordered` at `packages/runtime-core/src/rig-control-hierarchy.ts:107`.
- `packages/runtime-core/src/rig-control-evaluation.ts:91` falls back to identity when a parent world matrix is unavailable, `packages/runtime-core/src/rig-control-evaluation.ts:216` still marks enabled `rotation2d` nodes as `evaluationStatus: "evaluated"`, and `packages/runtime-core/src/rig-control-evaluation.ts:278` still applies drawable transforms for ordered rig controls.
- This conflicts with the runtime contract basis that says rig controls must topologically sort parent-before-child and cycle or missing child/parent is blocking (`discussion/design/module-contracts/runtime-core-contract.md:570`) and with the fixture manifest expectation that `invalid-rigControl-cycle` has no snapshot or a blocking snapshot (`discussion/tests/fixtures/fixture-manifest.md:85`).

Impact: a cyclic or missing-parent rig graph can produce a normal-looking runtime snapshot with transformed drawables and `evaluated` rig control status, even though a blocking diagnostic exists. That makes Viewer / Runtime evidence ambiguous: consumers can see both "blocking" and "evaluated/applied" for the same invalid hierarchy.

Required fix for Gnome: keep this in runtime scope, not validator broad scope. Propagate blocked rig-control IDs/reasons from hierarchy evaluation into `evaluateRigControlHierarchy`, set affected nodes to `evaluationStatus: "blocked"` or omit/stop snapshot output according to the accepted runtime policy, and prevent blocked hierarchy transforms from being applied to drawables. Add focused runtime tests for cycle, missing parent, and missing child rig-control references.

## Design / Development Compliance

Result: `needs_fix`.

The implementation stays within Domain B write scope and does not touch operation handlers, validator broad implementation, editor UI, package manifests, lockfiles, external dependencies, Cubism SDK/Core, direct physics output, file picker/parser/archive/image decode, or warp lattice deformation evaluation.

Source organization is acceptable: new files have clear runtime responsibilities, and `packages/runtime-core/src/index.ts` remains barrel-only (`packages/runtime-core/src/index.ts:1`). `pnpm.cmd run check:source` passed.

The compliance blocker is the runtime hierarchy blocking semantics above.

## Test Adequacy

Result: `needs_fix`.

Covered:

- Focused Domain B test proves deterministic happy-path rotation2d hierarchy, parent-before-child order, snapshot/diff/evidence, Viewer path, and unsupported warp no-op evidence (`packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts:20`).
- Runtime-core suite includes the parallel Domain D fixture test for parent/child axis composition and fixture expected summaries (`packages/runtime-core/src/rig-control-contract-evidence-fixture.test.ts:28`), although that file is not claimed as Domain B.
- Existing runtime, keyform, dynamics, viewer, and dependency-boundary tests still pass.

Missing:

- No focused runtime test asserts that cycle, missing parent, or missing child rig-control relations produce blocked runtime evidence and do not apply transforms. The current search found only production diagnostics for those paths, not Domain B assertions (`packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts` has no cycle/missing coverage).

## Verification Performed

- `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`: pass, 1 file / 3 tests.
- `pnpm.cmd exec vitest run packages/runtime-core/src`: pass, 24 files / 70 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd test:unit`: pass, 122 files / 616 tests. The total differs from Gnome's 613 because parallel Wave25 tests are present in the shared worktree.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- `git diff --check -- packages/runtime-core discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25`: pass, with LF/CRLF warnings only.

## Residual Risks

- Runtime diff exposes rig-control field changes through existing `RuntimeDiffDto.parameterChanges`. This is acceptable for the current Domain B write scope because `/rigControls/...` paths are visible and schema-compatible, but the field name remains historically parameter-oriented.
- `warpLattice2d` remains unsupported/no-op evidence by Wave25 plan, despite older runtime contract language describing full warp evaluation. This is not a Domain B blocker because Wave25 explicitly forbids the warp lattice deformation evaluator.
- Review was performed in a shared dirty worktree containing Domain A and parallel Domain C/D-looking changes; unrelated files were not treated as Domain B ownership.

## User Decision Points

None. The required fix is bounded inside runtime hierarchy/evidence behavior and tests.

## Fix Loop 1 Re-Review

> Date: 2026-06-01  
> Re-review verdict: `pass`

### Findings

No open findings.

The prior high finding is fixed. `createRigControlHierarchyEvaluation` now exposes `blockedRigControlIds` (`packages/runtime-core/src/rig-control-hierarchy.ts:17`), marks cycle / missing parent / missing child subtrees as blocked (`packages/runtime-core/src/rig-control-hierarchy.ts:109`, `packages/runtime-core/src/rig-control-hierarchy.ts:131`, `packages/runtime-core/src/rig-control-hierarchy.ts:138`), and propagates blocked ancestor state (`packages/runtime-core/src/rig-control-hierarchy.ts:258`).

Runtime evaluation now branches blocked rig controls before normal node evaluation (`packages/runtime-core/src/rig-control-evaluation.ts:101`), emits existing nodes as `evaluationStatus: "blocked"` (`packages/runtime-core/src/rig-control-evaluation.ts:187`), and skips drawable transform application for blocked nodes (`packages/runtime-core/src/rig-control-evaluation.ts:317`). This closes the previous ambiguity where blocking hierarchy diagnostics could still produce evaluated/applied transforms.

### Design / Development Compliance

Result: `pass`.

The fix remains within Domain B runtime-core scope. I found no operation handler, validator broad implementation, editor UI, package manifest/lockfile, external dependency, Cubism SDK/Core, file picker/parser/archive/image decode, direct physics, or warp lattice deformation implementation introduced by the fix loop. `packages/runtime-core/src/index.ts` remains barrel-only.

### Test Adequacy

Result: `pass`.

The focused runtime test now covers the missing invalid-hierarchy cases: cycle (`packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts:142`), missing parent (`packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts:158`), and missing child rig-control reference (`packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts:173`). Each asserts blocking diagnostics, `evaluationStatus: "blocked"` where applicable, and untransformed drawable output.

### Verification Performed

- `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`: pass, 1 file / 6 tests.
- `pnpm.cmd exec vitest run packages/runtime-core/src`: pass, 24 files / 73 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd test:unit`: pass, 122 files / 619 tests.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- `git diff --check -- packages/runtime-core discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25`: pass, with LF/CRLF warnings only.
- Dependency manifest status check for `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `packages/runtime-core/package.json`: no listed changes.
- Forbidden-scope text scan of Domain B fix-loop files found only the Gnome report's explicit non-goal statement.

### Residual Risks

- Runtime diff still carries rig-control field changes through `RuntimeDiffDto.parameterChanges`; this remains a naming/contract-shape limitation, not a blocking Domain B issue.
- `warpLattice2d` remains unsupported/no-op evidence per Wave25 Domain B scope.
- The worktree remains shared and dirty with Domain A and parallel Domain C/D changes; this re-review only passes the claimed Domain B runtime fix loop.

### Further Gnome Fixes

None required for Domain B fix loop 1.
