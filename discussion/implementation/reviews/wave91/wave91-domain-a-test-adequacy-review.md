# Wave91 Domain A Test Adequacy Review

Verdict: `pass`

Review lane: Test Adequacy Review
Target: `wave91-core-rig-lifecycle-operations`
Reviewer: Review-Sylph
Date: 2026-06-20

## Scope

Reviewed the current working-tree Domain A source and tests directly against:

- `discussion/implementation/orchestration/wave91-plan.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`

Source/test files inspected:

- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.test.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operations/create-rotation2d-rig-control.ts`
- `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts`
- `packages/operation-core/src/operations/create-warp-deformer.ts`
- `packages/operation-core/src/operations/delete-rig-control.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`

I did not modify source files.

## Findings

No blocking or required-change findings.

## Post-Fix Delta Re-Review

Gnome's post-fix cycle coverage is present and adequate:

- Authoring-core rejects an existing rig-control cycle reachable from the delete target without mutating the graph: `packages/authoring-core/src/rig-control-mutations.test.ts:916`.
- Operation-core maps the same condition to `operation.deleteRigControl.cycle` and asserts graph, package revision, authoring revision, dirty flag, and operation log length remain unchanged: `packages/operation-core/src/operations/rig-control.test.ts:1808`.
- The production mutation guard calls reachable-cycle validation before delete promotion: `packages/authoring-core/src/rig-control-mutations.ts:893`.
- The operation diagnostic maps `rig_control_cycle` to `operation.deleteRigControl.cycle`: `packages/operation-core/src/operations/delete-rig-control.ts:321`.

## Required Coverage Check

| Required coverage | Adequacy | Evidence |
|---|---|---|
| Duplicate display-name rotation base / `_2` / `_3` | Covered | `packages/operation-core/src/operations/rig-control.test.ts:97` asserts three duplicate rotation IDs and preserved display names. |
| Duplicate display-name warp lattice suffix | Covered | `packages/operation-core/src/operations/rig-control.test.ts:235` asserts base / `_2` / `_3` IDs and preserved display names. |
| Duplicate display-name warp deformer / wrap-selected generic suffix | Covered for the generic wrap-selected Domain A path | `packages/operation-core/src/operations/rig-control.test.ts:379` asserts `2 Selected Warp Deformer` base / `_2` / `_3`; `packages/operation-core/src/operations/create-warp-deformer.ts:109` resolves the available ID before create/insert/wrap branching. |
| Dry-run chooses same suffixed ID as commit and original session is unmutated | Covered | `packages/operation-core/src/operations/rig-control.test.ts:141` asserts dry-run and commit both use `rig_repeat_rotation_2`, original session lacks the dry-run rig, and package revision remains unchanged before commit. All three create handlers call `createAvailableRigControlIdFromDisplayName`: rotation at `create-rotation2d-rig-control.ts:100`, warp lattice at `create-warp-lattice2d-rig-control.ts:75`, warp deformer at `create-warp-deformer.ts:109`. |
| Delete parented Deformer promotion to parent for child Deformers/Drawables | Covered | `packages/authoring-core/src/rig-control-mutations.test.ts:705` asserts parent child lists, child `parentId`, target removal, root IDs, and stable order removal. Operation-level coverage also exists at `packages/operation-core/src/operations/rig-control.test.ts:1645`. |
| Delete root Deformer promotion of child Deformers to roots and child Drawables unbound/pool-visible | Covered for Domain A state | `packages/authoring-core/src/rig-control-mutations.test.ts:744` asserts child Deformer becomes root/unparented and no rig control still lists the child drawable. Pool visibility is an Editor-derived concern, so this is the correct Domain A assertion. |
| Delete removes target keyform sets | Covered | `packages/authoring-core/src/rig-control-mutations.test.ts:770` and `packages/operation-core/src/operations/rig-control.test.ts:1645` assert target keyform removal and modelDiff `removed` entries. |
| Delete preserves child Deformer keyform sets | Covered | `packages/authoring-core/src/rig-control-mutations.test.ts:770` keeps `keyset_child_offsets` while removing only `keyset_target_offsets`. |
| Delete leaves drawables, meshes, parts, textures, draw order unchanged, and dynamics if covered | Covered | `packages/authoring-core/src/rig-control-mutations.test.ts:825` snapshots and compares drawables, meshes, parts, texture atlas, draw order, and dynamics groups. |
| Delete rejects missing target | Covered | `packages/authoring-core/src/rig-control-mutations.test.ts:896` and `packages/operation-core/src/operations/rig-control.test.ts:1752` assert missing target rejection. |
| Delete rejects or clearly fails on incoherent existing graph state | Covered | `packages/authoring-core/src/rig-control-mutations.test.ts:900` and `packages/operation-core/src/operations/rig-control.test.ts:1767` remove a child `parentId` and assert deterministic parent/child mismatch rejection. Post-fix cycle coverage at `packages/authoring-core/src/rig-control-mutations.test.ts:916` and `packages/operation-core/src/operations/rig-control.test.ts:1808` asserts reachable-cycle rejection and no mutation. `expectDeleteError` at `rig-control-mutations.test.ts:999` also checks graph immutability on authoring failures. |
| Delete operation dry-run mutation boundary and model diff/log/result behavior | Covered | `packages/operation-core/src/operations/rig-control.test.ts:1645` checks dry-run status, removed diff entries, target still present, keyform still present, package revision unchanged, then commit status, log operation type, target IDs, modelDiff removed entries, changed field paths, final graph state, and revision increment. |
| Schema/type/registry coverage for new operation | Covered | Registry test at `packages/operation-core/src/operations/rig-control.test.ts:25`; schema representative payload and request checks at `packages/operation-core/src/operation-schemas.test.ts:390`, `:453`, and `:536`; production type/payload/registry entries at `operation-type.ts:40`, `operation-payload.ts:121`, `payloads/rig-control.ts:134`, and `operation-registry.ts:130`. |

## Repository Facts

- The collision-aware helper returns the base rig control ID when available and the first `_N` suffix starting at `_2` when occupied: `packages/operation-core/src/operation-ids.ts:56`.
- The three Domain A create handlers all use that helper before mutation: `create-rotation2d-rig-control.ts:100`, `create-warp-lattice2d-rig-control.ts:75`, and `create-warp-deformer.ts:109`.
- `deleteRigControl` removes the target, promotes children, removes only keyform sets targeting the deleted rig control, removes target/keyform stable-order entries, and increments authoring revision: `packages/authoring-core/src/rig-control-mutations.ts:772`.
- Delete preconditions include reachable-cycle rejection before promotion/mutation: `packages/authoring-core/src/rig-control-mutations.ts:893` and `packages/authoring-core/src/rig-control-mutations.ts:918`.
- The delete operation handler dry-runs against `createDryRunAuthoringSession`, commits against the real session, marks the result reversible, and emits model diff/precondition evidence: `packages/operation-core/src/operations/delete-rig-control.ts:29`.
- Delete operation diagnostics explicitly map `rig_control_cycle` to `operation.deleteRigControl.cycle`: `packages/operation-core/src/operations/delete-rig-control.ts:321`.

## Residual Risks

- Direct non-wrap `createWarpDeformer` duplicate display-name suffix is not separately asserted; the test covers the generic wrap-selected path, and the implementation resolves IDs before branching, so the residual risk is low.
- Same-suffixed-ID dry-run/commit is asserted directly for rotation, while warp lattice and warp deformer rely on the shared helper and per-handler source structure. This is acceptable for Domain A, but a future refactor of per-operation ID resolution would benefit from per-family dry-run suffix assertions.
- Incoherent graph rejection now covers both parent/child mismatch and reachable cycle cases. Other malformed states are guarded in source, but not exhaustively fixture-tested in this wave.

## Verification Performed

- Read the Wave91 plan and required development policies.
- Inspected the listed source and test files directly in the working tree.
- Compared every requested coverage item, including post-fix cycle rejection, to concrete assertions and source line evidence.
- Checked working-tree diff scope with `git diff --stat -- packages/authoring-core/src packages/operation-core/src discussion/implementation/reviews/wave91`.

Provided final post-fix verification from Orch-Sylph is consistent with the reviewed tests:

- Focused Vitest passed: 4 files / 75 tests.
- `pnpm.cmd typecheck` passed.
- `pnpm.cmd run check:source` passed.
- `pnpm.cmd run check:deps` passed.
- `git diff --check -- packages/authoring-core/src packages/operation-core/src discussion/implementation/reviews/wave91` passed with LF/CRLF warnings only.
