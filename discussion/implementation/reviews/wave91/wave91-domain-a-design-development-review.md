# Wave91 Domain A Design / Development Compliance Review

Role: Review-Sylph, Design / Development Compliance Review
Target: Wave91 Domain A `wave91-core-rig-lifecycle-operations`
Date: 2026-06-20
Verdict: `pass`

## Findings

Blocking findings: none.

Needs-changes findings: none.

Warnings: none.

Post-fix delta re-review: pass. I inspected the Gnome cycle precondition fix directly in the working tree and found no new design/development compliance issue.

## Scope Reviewed

I reviewed the current working-tree implementation and tests directly, with these basis documents:

- `discussion/implementation/orchestration/wave91-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/implementation/waves/wave90/wave90-final-integration-report.md`
- `discussion/implementation/reviews/wave90/wave90-final-integration-review.md`

Implementation files inspected:

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
- `packages/operation-core/src/index.ts`

## Review Evidence

### Rig graph invariants and explicit failures

Pass. `authoring-core` owns the delete mutation and validates the relevant graph relationships before mutating the graph.

- Missing target fails before mutation: `packages/authoring-core/src/rig-control-mutations.ts:776`.
- Delete calls `assertCanDeleteRigControl()` before mutation: `packages/authoring-core/src/rig-control-mutations.ts:784`.
- Precondition checks cover target parent/root coherence, duplicate child IDs, reachable rig-control cycles, drawable parent coherence, child existence, child parent coherence, and child parent mismatch: `packages/authoring-core/src/rig-control-mutations.ts:886`.
- Reachable cycle detection is explicit and fails with `rig_control_cycle` before delete mutation begins: `packages/authoring-core/src/rig-control-mutations.ts:893`, `:918`.
- Existing parent/root coherence helper rejects duplicate listed parents, illegal root membership, missing parent, and parent/list disagreement: `packages/authoring-core/src/rig-control-mutations.ts:1584`.
- The actual promotion mutates root IDs or parent child lists through exact-one replacement, then reparents child rig controls, removes the target rig control, removes target keyform sets, and cleans stable order: `packages/authoring-core/src/rig-control-mutations.ts:818`.
- Tests cover parented delete promotion, root delete promotion, incoherent graph rejection without mutation, and reachable cycle rejection without mutation: `packages/authoring-core/src/rig-control-mutations.test.ts:705`, `:744`, `:896`, `:916`.

I did not find a path where delete silently repairs an incoherent parent/root state instead of failing.

### Keyform references after delete

Pass. Keyform sets targeting the deleted rig control are removed; child deformer keyforms are preserved.

- Removed keyform IDs are selected only when `target.kind === "rigControl"` and `target.id` equals the deleted rig control ID: `packages/authoring-core/src/rig-control-mutations.ts:797`.
- The mutation filters those keyform sets from `graph.keyformSets` and removes their IDs from `stableOrder`: `packages/authoring-core/src/rig-control-mutations.ts:845`.
- Operation modelDiff marks the deleted rig control and removed keyform sets as removed, and records full before objects for reversibility: `packages/operation-core/src/operations/delete-rig-control.ts:107`, `:196`.
- Tests assert target keyforms are removed while child keyforms remain: `packages/authoring-core/src/rig-control-mutations.test.ts:770`.
- Operation tests assert dry-run/commit removal of the target keyform set and final keyform cleanup: `packages/operation-core/src/operations/rig-control.test.ts:1645`.

### Layer ownership and Operation Core boundary

Pass. The layering matches the Wave91 plan.

- `authoring-core` owns invariant mutation semantics via `deleteRigControl()`: `packages/authoring-core/src/rig-control-mutations.ts:772`.
- `operation-core` owns dry-run/commit integration, operation result construction, diagnostics, modelDiff, and target IDs: `packages/operation-core/src/operations/delete-rig-control.ts:29`, `:42`, `:99`, `:150`, `:284`.
- Dry-run uses a cloned authoring session: `packages/operation-core/src/operations/delete-rig-control.ts:32`.
- Commit uses the shared lifecycle that appends operation log entries only after a committed handler result: `packages/operation-core/src/lifecycle/commit.ts:34`.
- The suffixed-ID helper is in `operation-core` and is applied to all three Domain A create paths: `packages/operation-core/src/operation-ids.ts:56`, `packages/operation-core/src/operations/create-rotation2d-rig-control.ts:100`, `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts:75`, `packages/operation-core/src/operations/create-warp-deformer.ts:109`.
- Operation-level cycle rejection is covered without graph, revision, dirty flag, or operation log mutation beyond the pre-existing log entries: `packages/operation-core/src/operations/rig-control.test.ts:1808`.

### Source organization impact

Pass. The post-fix cycle precondition adds a named helper inside the existing rig-control mutation responsibility file.

- `assertNoReachableRigControlCycle()` is local to rig-control deletion preconditions and does not add `index.ts` logic, a broad catch-all file, or unrelated module responsibility: `packages/authoring-core/src/rig-control-mutations.ts:918`.
- Current file sizes observed in this review were 2042 lines for `rig-control-mutations.ts`, 1142 lines for `rig-control-mutations.test.ts`, and 2318 lines for `operations/rig-control.test.ts`. These files remain large, but the post-fix addition is cohesive with their existing rig-control family responsibility.
- Orch-Sylph reported `pnpm.cmd run check:source` passed after the post-fix cycle change.

### Mutation gateway and forbidden scope

Pass. I found no Domain A source changes in `apps/editor`, runtime/render packages, dependency manifests, lockfile, mesh algorithm files, Texture Atlas, Dynamics, or Workspace Save source.

- `git diff --name-only` showed source changes confined to `packages/authoring-core/src/**` and `packages/operation-core/src/**`, plus an existing orchestration map document.
- `git diff --name-only -- package.json pnpm-lock.yaml apps/editor packages/runtime-core packages/render-core packages/render-webgl2` returned no paths.
- `rg -n deleteRigControl packages/authoring-core/src packages/operation-core/src apps/editor/src` returned no `apps/editor/src` matches.
- Forbidden Cubism/format dependency scans over the touched package source and root manifests returned no matches for `live2dcubismcore`, `.moc3`, `.cmo3`, `.model3.json`, `.motion3.json`, `.physics3.json`, or `.pose3.json`.

### Public operation wiring

Pass. Public operation wiring is narrow and follows existing operation-core patterns.

- Operation type adds one `deleteRigControl` entry: `packages/operation-core/src/operation-type.ts:40`.
- Payload union adds one discriminant branch: `packages/operation-core/src/operation-payload.ts:120`.
- Payload schema is a single `rigControlId` object: `packages/operation-core/src/payloads/rig-control.ts:134`.
- Registry imports and registers one handler: `packages/operation-core/src/operation-registry.ts:17`, `:130`.
- `index.ts` remains barrel-only and adds only the operation re-export: `packages/operation-core/src/index.ts:56`.

### Model diff reversibility

Pass. Delete modelDiff contains enough before/after evidence for the operation-policy expectation at this layer.

- Removed targets list includes the rig control and removed keyform sets: `packages/operation-core/src/operations/delete-rig-control.ts:112`.
- Full deleted rig control object is recorded before removal: `packages/operation-core/src/operations/delete-rig-control.ts:184`.
- Full removed keyform set objects are recorded before removal: `packages/operation-core/src/operations/delete-rig-control.ts:210`.
- Root ID, stable order, parent child lists, and child parent IDs are recorded with before/after fields: `packages/operation-core/src/operations/delete-rig-control.ts:170`, `:227`, `:247`, `:268`.
- Operation test asserts modelDiff removed targets, parent changed paths, child parent changed path, log target IDs, and final package revision: `packages/operation-core/src/operations/rig-control.test.ts:1700`.

## Residual Risks

- I did not rerun Vitest, typecheck, `check:source`, or `check:deps` in this review lane. I relied on Orch-Sylph's reported post-fix passing verification and performed independent source/test inspection plus read-only static scope scans.
- `packages/authoring-core/src/rig-control-mutations.ts` and `packages/operation-core/src/operations/rig-control.test.ts` remain large rig-control family files. The Wave91 additions are cohesive with their existing responsibility boundaries, so I do not consider this a source-organization violation for Domain A; future unrelated rig lifecycle growth should consider narrower file splits.
- Domain B still owns editor UI, selection cleanup, actual committed suffixed-ID propagation in editor commands, and Mesh Apply auto-refit. Those behaviors were not reviewed here.

## Verification Performed

Read-only commands and inspections performed:

- `git status --short -uall`
- `git diff --stat -- packages/authoring-core/src packages/operation-core/src`
- `git diff -- packages/authoring-core/src/rig-control-mutations.ts`
- `git diff -- packages/operation-core/src/operation-ids.ts`
- Direct reads of all listed implementation and test files.
- Line-numbered inspections of delete mutation, delete operation, ID suffix creation paths, operation wiring, and relevant tests.
- `git diff --name-only`
- `git diff --name-only -- package.json pnpm-lock.yaml apps/editor packages/runtime-core packages/render-core packages/render-webgl2`
- `rg -n deleteRigControl packages/authoring-core/src packages/operation-core/src apps/editor/src`
- `rg -n createAvailableRigControlIdFromDisplayName packages/operation-core/src apps/editor/src`
- targeted forbidden dependency/format term scans over touched package source and root manifests.
- Post-fix delta read of `packages/authoring-core/src/rig-control-mutations.ts`.
- Post-fix delta read of `packages/authoring-core/src/rig-control-mutations.test.ts`.
- Post-fix delta read of `packages/operation-core/src/operations/rig-control.test.ts`.

Final conclusion: `pass`.
