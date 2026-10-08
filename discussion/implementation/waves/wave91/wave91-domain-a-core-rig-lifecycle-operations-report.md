# Wave91 Domain A Core Rig Lifecycle Operations Report

Date: 2026-06-20
Domain: `wave91-core-rig-lifecycle-operations`
Verdict: `pass`

## Scope

Domain A implemented the package-level rig lifecycle foundation for Wave91:

- Collision-aware rig control IDs in operation-core.
- Actual committed rig IDs returned through rotation, warp lattice, and warp deformer create operation results/model diffs.
- Authoring-core rig control deletion semantics.
- Operation-core `deleteRigControl` payload/type/registry/handler.
- Focused authoring-core and operation-core tests.

Out-of-scope items stayed untouched: Editor UI, Mesh Apply auto-refit, delete confirmation UX, Deformer Tree context menu, runtime/render packages, mesh algorithms, Texture Atlas, Dynamics, Workspace Save, package dependencies, and lockfile.

## Changed Files

Implementation:

- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operations/create-rotation2d-rig-control.ts`
- `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts`
- `packages/operation-core/src/operations/create-warp-deformer.ts`
- `packages/operation-core/src/operations/delete-rig-control.ts`
- `packages/operation-core/src/index.ts`

Tests:

- `packages/authoring-core/src/rig-control-mutations.test.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`

Artifacts:

- `discussion/implementation/waves/wave91/wave91-domain-a-core-rig-lifecycle-operations-report.md`
- `discussion/implementation/waves/wave91/_map.md`
- `discussion/implementation/reviews/wave91/wave91-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave91/wave91-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave91/wave91-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave91/_map.md`

Pre-existing upstream discussion changes were left untouched:

- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/orchestration/wave91-plan.md`

## Implementation Summary

`operation-core` now resolves rig control IDs with `createAvailableRigControlIdFromDisplayName()`: the display-name-derived base ID is used when free, otherwise the first free `_2`, `_3`, ... suffix is used. Display names are not changed.

The three Domain A create paths use that helper before constructing the package rig control:

- `createRotation2dRigControl`
- `createWarpLattice2dRigControl`
- `createWarpDeformer`

`authoring-core` now exposes `deleteRigControl(session, { rigControlId })`. The mutation removes only the target rig control, removes target/root/parent/stable-order references, promotes child rig controls/drawables according to root vs parented semantics, removes keyform sets targeting only the deleted rig control, preserves child rig controls and their keyforms, and preserves drawables, meshes, parts, textures, draw order, and dynamics. It rejects missing targets, incoherent parent/root state, duplicate bindings, missing children, and reachable rig-control cycles before mutating.

`operation-core` now exposes `deleteRigControl` as an operation type, payload schema, registry entry, barrel export, and handler. Dry-run uses a cloned authoring session. Commit emits a reversible model diff containing the removed rig control, removed target keyform sets, stable-order/root changes, parent child-list changes, and child parent changes.

## Review Results

All required review lanes completed and passed after the fix loop.

| Review lane | Final verdict | Artifact |
|---|---|---|
| Spec Compliance Review | `pass` | `discussion/implementation/reviews/wave91/wave91-domain-a-spec-compliance-review.md` |
| Design / Development Compliance Review | `pass` | `discussion/implementation/reviews/wave91/wave91-domain-a-design-development-review.md` |
| Test Adequacy Review | `pass` | `discussion/implementation/reviews/wave91/wave91-domain-a-test-adequacy-review.md` |

Fix loop:

1. Initial spec review found that `deleteRigControl` did not explicitly reject reachable rig-control cycles.
2. Gnome added a pre-mutation reachable-cycle check and authoring/operation tests.
3. Focused tests and repository checks passed.
4. All three review lanes performed post-fix delta re-review and passed.

## Verification

Commands run by Orch-Sylph:

| Command | Outcome |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/rig-control-mutations.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/operation-lifecycle.test.ts` | Sandbox attempt failed with Vite/esbuild `spawn EPERM`; approved rerun passed: 4 files / 75 tests. |
| `pnpm.cmd typecheck` | Passed. |
| `pnpm.cmd run check:source` | Passed. |
| `pnpm.cmd run check:deps` | Passed. |
| `git diff --check -- packages/authoring-core/src packages/operation-core/src discussion/implementation/reviews/wave91` | Passed; Git reported LF/CRLF working-copy warnings only. |

Gnome also ran focused post-fix tests for the changed authoring/operation files and reported pass.

## Residual Risks

- Direct non-wrap `createWarpDeformer` duplicate suffix is not separately asserted. The generic wrap-selected path is tested, and ID resolution happens before the create/insert/wrap branch, so residual risk is low.
- Same-suffixed-ID dry-run/commit is directly asserted for rotation. Warp lattice and warp deformer use the same helper and source structure, so residual risk is low.
- Incoherent graph coverage includes parent/child mismatch and reachable cycle cases, but does not exhaustively fixture every malformed graph shape.
- Domain B remains responsible for Editor UI, delete selection cleanup, actual suffixed-ID editor selection propagation, and Mesh Apply auto-refit.

## User-Decision Points

None for Domain A.
