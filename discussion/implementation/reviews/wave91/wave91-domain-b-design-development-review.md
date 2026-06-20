# Wave91 Domain B Design / Development Compliance Review

Role: Review-Sylph, Design / Development Compliance Review
Date: 2026-06-20
Target wave: Wave91 `deformer-lifecycle-cleanup`
Domain: `wave91-editor-deformer-lifecycle-integration`
Verdict: `pass`

## Findings

Blocking findings: none.

Needs-fix findings: none.

Escalations: none.

## Passing Evidence

### Operation Policy / Mutation Boundary

Pass. Domain B routes deformer deletion and auto-refit mutations through operation-core command wrappers rather than direct package mutation.

- `apps/editor/src/features/editor-session/model/editor-session-commands.ts:384` defines `commitDeleteRigControl()`, and `:388`-`:390` wraps the Domain A `deleteRigControl` operation type.
- `apps/editor/src/features/editor-session/editor-session-context.tsx:2084`-`:2096` wires the editor-facing delete callback through `commitDeleteRigControl()` and clears selection/transient rig state on commit.
- `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:42`-`:45` applies auto-refit through `commitUpdateRigControl()`, preserving the existing rig update operation path.
- I found no direct editor-side import of Domain A's package mutation function for deletion. Editor source imports operation-core DTOs/wrappers and authoring-core types only in the inspected files.

### Domain A Delete Operation Use

Pass. Domain B uses the Domain A operation result as the deletion gateway and does not add package-level delete logic.

- `apps/editor/src/features/editor-session/model/editor-session-commands.ts:384`-`:391` is a narrow command wrapper.
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:1031`-`:1067` verifies editor delete clears selection and remains undoable/redoable.
- Current working tree package changes exist under `packages/authoring-core/src/**` and `packages/operation-core/src/**`, but those match the completed Domain A scope in `discussion/implementation/waves/wave91/wave91-domain-a-core-rig-lifecycle-operations-report.md`. I found no additional Domain B package-source edits beyond importing the exposed operation types/commands.

### Mesh Apply Auto-Refit Placement / Behavior Boundary

Pass. Auto-refit is isolated in the editor session model layer and calls the existing rig update command. I found no runtime evaluator or mesh generation algorithm changes.

- New cohesive file: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts`, with the main entry point at `:13`-`:58`.
- Mesh Apply invokes auto-refit only after successful draft commits: `apps/editor/src/features/editor-session/editor-session-context.tsx:1711`-`:1741` commits mesh drafts, then `:1743`-`:1753` runs `commitMeshApplyAutoRefit()`.
- Auto-refit collects affected Warp ancestors and orders inner-to-outer: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:60`-`:98`.
- It skips missing/keyformed Warp rig controls: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:22`-`:25`.
- It computes required bounds from all current children and unions with current bounds before updating: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:28`-`:45`.
- Focused tests cover expand/no-shrink/keyed-skip/nested/shared-parent cases at `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts:35`, `:65`, `:89`, `:113`, and `:143`.
- Targeted diff checks showed no changes under `packages/runtime-core`, `packages/render-core`, `packages/render-webgl2`, or existing mesh generation/model files.

### Actual ID Propagation

Pass with low residual risk. Domain B no longer predicts created rig control IDs; it extracts the actual committed rig control ID from the operation result's model diff.

- `commitCreateWarpDeformer()` extracts from `result.operationResult`: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:300`-`:313`.
- `commitCreateRotationDeformer()` uses the same path: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:316`-`:326`.
- The helper reads a rig control from `modelDiff.added`: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:571`-`:578`.
- Domain A create operations currently emit exactly one added rig-control target for the created control: `packages/operation-core/src/operations/create-rotation2d-rig-control.ts:300`-`:328`, `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts:145`-`:170`, and `packages/operation-core/src/operations/create-warp-deformer.ts:399`-`:427`.
- Editor-level tests verify suffixed selection for duplicate display-name creation at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:1072`-`:1101` and Deformer Tree wrapper selection at `:1142`-`:1197`.

### UI Scope / Inspector Pattern

Pass. The visible delete action is limited to committed Warp and Rotation Deformer inspectors. I found no out-of-scope confirmation dialog, context menu, row action, or Delete-key path added for Wave91 Domain B.

- Inspector passes the delete callback to committed Warp and Rotation inspector components at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:95`-`:115`.
- Warp inspector renders `DeleteDeformerAction` at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:743`-`:747`.
- Rotation inspector renders `DeleteDeformerAction` at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:1035`-`:1039`.
- The shared action uses the existing section/button visual style with a `Trash2` icon at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:1303`-`:1314`.
- Inspector tests assert callback invocation for Warp and Rotation delete buttons at `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:90`-`:107` and `:160`-`:177`.

### Source Organization

Pass. The Domain B source additions are cohesive and do not create broad catch-all files or grow an `index.ts` entrypoint.

- `mesh-apply-auto-refit.ts` is a focused editor-session model helper for Mesh Apply auto-refit and is 136 lines.
- `mesh-apply-auto-refit.test.ts` is a focused test file for that helper and is 350 lines.
- No Domain B `index.ts`, `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` changes were found in the app diff.

## Scope Checks

- `git status --short -uall` shows Domain B changes in the specified app files plus Domain A package changes and Wave91 discussion artifacts.
- Dependency scope passed: `git diff --name-only -- package.json pnpm-lock.yaml apps/editor/package.json packages/authoring-core/package.json packages/operation-core/package.json ...` returned no files.
- Runtime/render/Atlas/Dynamics/Workspace Save scope passed: targeted `git diff --name-only` checks for `packages/runtime-core`, `packages/render-core`, `packages/render-webgl2`, workspace storage, atlas, viewer, and dynamics paths returned no files.
- Source organization scope passed: targeted app diff scan found no changed broad catch-all or `index.ts` files.
- Whitespace check for tracked Domain B files via `git diff --check` reported only LF/CRLF working-copy warnings. The new untracked auto-refit files had no trailing-whitespace matches.

## Verification Notes

I inspected the required basis documents and the specified Domain B source/test files directly. I did not run Vitest, typecheck, source guard, or dependency guard in this design/development review lane; test execution and test adequacy are covered by separate review/final integration gates.

## Residual Risks

1. Low: actual created-ID propagation relies on the current operation-core convention that create operations put exactly one created rig-control target in `modelDiff.added`. Current Domain A source and Domain B tests support that contract, but a future operation result shape with multiple added rig controls should add an explicit operation result field or an exact-one guard in `extractAddedRigControlId()`.
2. Low: the working tree includes Domain A package changes because Domain A and Domain B are present together. Final integration should re-check that no package-source changes were introduced after the Domain A pass and that Domain B remains confined to the editor/app layer.

## Final Verdict

`pass`

Domain B satisfies the design/development checklist: mutations route through operation-core wrappers, delete uses the Domain A operation, auto-refit stays in the editor session model and calls the existing rig update command, source organization is cohesive, dependency/runtime/mesh/Atlas/Dynamics/Workspace Save scope is clean, UI scope stays within the inspector, and actual suffixed ID propagation is implemented against the committed operation result.
