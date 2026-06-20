# Wave91 Domain A Spec Compliance Review

Role: Review-Sylph, Spec Compliance Review
Target: Wave91 Domain A `wave91-core-rig-lifecycle-operations`
Date: 2026-06-20
Verdict: `pass`

## Findings

Blocking findings: none.

Needs-fix findings: none.

Post-fix delta: the previous `deleteRigControl` reachable-cycle finding is resolved.

- Delete now runs `assertNoReachableRigControlCycle()` before promotion/removal mutation: `packages/authoring-core/src/rig-control-mutations.ts:890`, `:893`.
- The helper DFS tracks `visiting` / `visited`, throws `rig_control_cycle` on a back edge, and starts from the delete target: `packages/authoring-core/src/rig-control-mutations.ts:918`, `:922`, `:925`, `:926`, `:928`, `:944`, `:945`, `:952`.
- Authoring-core test coverage creates a reachable cycle, clears roots to model the incoherent state, and asserts rejection without mutation via `expectDeleteError()`: `packages/authoring-core/src/rig-control-mutations.test.ts:916`, `:926`, `:928`, `:930`, `:932`; no-mutation assertion lives in the shared helper at `packages/authoring-core/src/rig-control-mutations.test.ts:1016`.
- Operation-core test coverage creates a delete-reachable cycle, snapshots graph/revision/dirty state, expects `operation.deleteRigControl.cycle`, and verifies no mutation/log append on rejection: `packages/operation-core/src/operations/rig-control.test.ts:1808`, `:1833`, `:1834`, `:1836`, `:1841`, `:1851`, `:1852`, `:1853`, `:1854`, `:1855`, `:1856`.
- Diagnostic mapping for `rig_control_cycle` to `operation.deleteRigControl.cycle` is present: `packages/operation-core/src/operations/delete-rig-control.ts:321`, `:322`, `:324`.

## Passing Coverage Observed

- Collision-aware rig-control IDs are implemented in `createAvailableRigControlIdFromDisplayName()`, using the base ID first and `_2`, `_3`, ... for the first available suffix: `packages/operation-core/src/operation-ids.ts:56`, `:61`, `:66`.
- Rotation, warp lattice, and warp deformer create paths all call the helper against current `session.graph.rigControls`: `packages/operation-core/src/operations/create-rotation2d-rig-control.ts:100`, `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts:75`, `packages/operation-core/src/operations/create-warp-deformer.ts:109`.
- Display names are preserved while IDs are suffixed, with tests for rotation, warp lattice, and generic wrap-selected warp deformer names: `packages/operation-core/src/operations/rig-control.test.ts:97`, `:134`, `:235`, `:272`, `:379`, `:434`.
- Dry-run creation uses the same suffixed ID as commit and does not mutate the original session in the covered rotation path: `packages/operation-core/src/operations/rig-control.test.ts:141`, `:161`, `:163`, `:166`, `:176`.
- Delete parented deformer promotion matches the plan for child deformers and drawables: implementation at `packages/authoring-core/src/rig-control-mutations.ts:824`, `:830`, `:833`, `:839`; test at `packages/authoring-core/src/rig-control-mutations.test.ts:705`, `:728`, `:729`, `:731`.
- Delete root deformer promotion returns child deformers to roots and leaves child drawables unbound/pool-visible by absence from any rig control: implementation at `packages/authoring-core/src/rig-control-mutations.ts:818`, `:833`, `:835`; test at `packages/authoring-core/src/rig-control-mutations.test.ts:744`, `:761`, `:764`, `:765`.
- Delete removes only keyform sets targeting the deleted rig control and preserves child rig-control keyforms: implementation at `packages/authoring-core/src/rig-control-mutations.ts:797`, `:812`, `:845`; test at `packages/authoring-core/src/rig-control-mutations.test.ts:770`, `:779`, `:795`, `:815`, `:818`.
- Delete preserves drawables, meshes, parts, textures, draw order, and dynamics: implementation only mutates rig controls, keyform sets, stable order, and root/parent refs at `packages/authoring-core/src/rig-control-mutations.ts:818`, `:842`, `:845`, `:848`; test at `packages/authoring-core/src/rig-control-mutations.test.ts:825`, `:888`, `:889`, `:890`, `:891`, `:892`, `:893`.
- Delete operation dry-run uses a cloned authoring session and tests verify original-session preservation: `packages/operation-core/src/operations/delete-rig-control.ts:32`, `:33`; `packages/operation-core/src/operations/rig-control.test.ts:1691`, `:1705`, `:1706`, `:1707`.
- Delete operation type, payload schema, registry entry, public export, and reversible model diff are present: `packages/operation-core/src/operation-type.ts:40`, `packages/operation-core/src/payloads/rig-control.ts:134`, `packages/operation-core/src/operation-payload.ts:120`, `packages/operation-core/src/operation-registry.ts:17`, `:130`, `packages/operation-core/src/index.ts:56`, `packages/operation-core/src/operations/delete-rig-control.ts:112`, `:146`.

## Verification Performed

- Read Wave91 plan, operation policy, and Wave90 final integration basis documents directly.
- Inspected the Domain A source files and focused tests listed in the request.
- Performed a post-fix delta re-review of the delete cycle precondition, authoring-core cycle rejection coverage, and operation-core cycle diagnostic/no-mutation coverage.
- Ran read-only repository searches and line-numbered source inspection commands.
- Did not rerun Vitest/typecheck/source/deps checks in this delta review. I treated the Orch-Sylph provided post-fix command results as known external verification and limited this pass to independent source/test spec review.

## Residual Risks

- The dry-run same-suffix behavior is directly tested for rotation only. The warp lattice and warp deformer implementations share the same helper, so this is low risk, but broader per-path dry-run tests would make the oracle stronger.
- The review did not inspect Domain B/C files by design.
