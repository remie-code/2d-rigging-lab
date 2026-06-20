# Wave91 Final Integration Report

Date: 2026-06-20
Domain: `wave91-final-integration-clean-review`
Verdict: `pass`

## Scope

This final integration pass reviewed the combined Domain A+B Wave91 work against `discussion/implementation/orchestration/wave91-plan.md`.

No implementation source or test files were modified in this final pass. Only final report/review/map artifacts were written.

## Basis Reviewed

- `discussion/implementation/orchestration/wave91-plan.md`
- `discussion/implementation/waves/wave91/wave91-domain-a-core-rig-lifecycle-operations-report.md`
- `discussion/implementation/waves/wave91/wave91-domain-b-editor-deformer-lifecycle-integration-report.md`
- all six Domain A/B review artifacts under `discussion/implementation/reviews/wave91/`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`

## Integrated Review Result

Wave91 is final complete / pass.

The combined implementation satisfies the accepted Wave91 decisions:

- Deformer delete removes only the target rig control and target keyform sets, promotes child deformers/drawables according to root vs parented semantics, preserves child deformer keyforms and child drawable/mesh/package data, and is reachable from the Editor through undoable history.
- Rig control ID suffixing is applied to rotation, warp lattice, and warp deformer creation paths. Display names remain unchanged, and the Editor selection uses the actual committed suffixed ID from the operation result.
- Mesh Apply auto-refit runs after successful mesh draft commits, targets only unkeyed Warp Deformers, processes inner ancestors before outer ancestors, computes required bounds from all current children, unions with existing bounds, and never shrinks.
- Forbidden scope remained untouched: no dependency or lockfile changes, no runtime evaluator changes, no mesh generation algorithm changes, and no unrelated Texture Atlas / Dynamics / Workspace Save changes.

## Evidence

### Deformer Delete

- Authoring mutation: `packages/authoring-core/src/rig-control-mutations.ts:772` removes the target rig control, handles parent/root promotion, removes only target keyform sets, and records reversible before/after data.
- Root promotion replaces the deleted root with child rig controls: `packages/authoring-core/src/rig-control-mutations.ts:818`.
- Parented promotion replaces the deleted child rig control in the parent list and promotes child drawables to the parent: `packages/authoring-core/src/rig-control-mutations.ts:825`, `:830`.
- Child deformer parent IDs are updated or cleared for root promotion: `packages/authoring-core/src/rig-control-mutations.ts:833`.
- Target-only keyform cleanup is keyed by `target.kind === "rigControl"` and target ID equality: `packages/authoring-core/src/rig-control-mutations.ts:797`.
- Delete operation dry-run uses a cloned authoring session and commit uses the real operation path: `packages/operation-core/src/operations/delete-rig-control.ts:29`.
- Editor delete is routed through `commitDeleteRigControl()` and clears selection/transient rig state on successful commit: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:384`, `apps/editor/src/features/editor-session/editor-session-context.tsx:2084`.
- Inspector delete buttons are present for committed Warp and Rotation deformers: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:747`, `:1039`.

### ID Suffix

- `createAvailableRigControlIdFromDisplayName()` returns the base ID when free and the first free `_2`, `_3`, ... suffix when occupied: `packages/operation-core/src/operation-ids.ts:56`.
- Rotation, warp lattice, and warp deformer create operations call that helper before mutation: `packages/operation-core/src/operations/create-rotation2d-rig-control.ts:100`, `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts:75`, `packages/operation-core/src/operations/create-warp-deformer.ts:109`.
- Operation results expose the actual created rig control in `modelDiff.added`: `packages/operation-core/src/operations/create-rotation2d-rig-control.ts:324`, `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts:165`, `packages/operation-core/src/operations/create-warp-deformer.ts:422`.
- Editor create commands extract the actual committed added rig control ID from the operation result: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:300`, `:316`, `:571`.

### Mesh Apply Auto-Refit

- Mesh Apply records successfully committed drawable IDs and invokes auto-refit after the draft commit loop: `apps/editor/src/features/editor-session/editor-session-context.tsx:1699`, `:1743`.
- Auto-refit collects affected warp ancestors from committed drawables, dedupes them, and sorts deeper ancestors first: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:60`, `:95`.
- It targets Warp Deformers only and skips keyed/keyformed Warps: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:23`, `apps/editor/src/features/editor-session/model/rig-tool-state.ts:870`.
- It computes required bounds from all current child drawables and child rig controls, unions them with current domain bounds, and commits only changed expansion bounds through `commitUpdateRigControl()`: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:28`, `:37`, `:42`.

## Verification

| Command | Outcome |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/rig-control-mutations.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operation-schemas.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts` | Initial sandbox run failed with Vite/esbuild `spawn EPERM`; approved/escalated rerun passed: 7 files / 112 tests. |
| `pnpm.cmd typecheck` | Passed. |
| `pnpm.cmd run check:source` | Passed. |
| `pnpm.cmd run check:deps` | Passed. |
| `git diff --name-only -- package.json pnpm-lock.yaml packages/runtime-core packages/render-core packages/render-webgl2 apps/editor/src/workspace/storage apps/editor/src/features/workspace apps/editor/src/features/texture-atlas apps/editor/src/features/dynamics packages/mesh-core packages/runtime-web` | Passed with no paths reported. |
| `git diff --check` | Passed; Git reported LF/CRLF working-copy warnings only. |
| `Select-String -Path discussion/implementation/waves/wave91/wave91-final-integration-report.md,discussion/implementation/reviews/wave91/wave91-final-clean-integration-review.md,discussion/implementation/waves/wave91/_map.md,discussion/implementation/reviews/wave91/_map.md,apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts,apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts,packages/operation-core/src/operations/delete-rig-control.ts -Pattern '\\s+$'` | Passed with no matches for new untracked final artifacts and new untracked source files. |

## Residual Risks

- Actual created-ID propagation relies on the current operation-core convention that create operations emit one added rig-control target in `modelDiff.added`. Current source and tests support that convention; future multi-rig create operations should add an explicit created ID field or exact-one guard.
- Provider-level duplicate suffix selection is directly tested for Rotation and source-covered for Warp through the same command result extraction path.
- Provider-level Mesh Apply integration covers hook placement and unkeyed expansion; no-shrink, keyed skip, nested, and shared-parent cases are covered at the focused helper level.
- `git diff --check` reports LF/CRLF working-copy warnings on touched tracked files. These are not whitespace errors and did not block the check; new untracked final/source files were checked separately for trailing whitespace.

## Changed Artifacts

- `discussion/implementation/waves/wave91/wave91-final-integration-report.md`
- `discussion/implementation/reviews/wave91/wave91-final-clean-integration-review.md`
- `discussion/implementation/waves/wave91/_map.md`
- `discussion/implementation/reviews/wave91/_map.md`
- `discussion/implementation/orchestration/_map.md`
