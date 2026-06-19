# Wave85 Domain B: Validate Screen, Badge, and Jump Actions Report

## Verdict

pass

## Fix loop 1 review summary

- Spec Compliance Review: pass.
- Design / Development Compliance Review: initial `needs_changes` finding fixed by rendering one jump command per valid action hint, including duplicate Dynamics output owner groups; re-review verdict `pass`.
- Test Adequacy Review: initial `needs_changes` finding fixed by adding duplicate Dynamics jump coverage and using two-warning same-target fixtures for App Bar and Toolbox badge counts; re-review verdict `pass`.
- Fix loop 1 touched only Diagnostics implementation/tests, App Bar badge test, Toolbox badge test, and this report.

## Files changed

- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/app-bar.tsx`
- `apps/editor/src/workspace/app-bar.test.ts`
- `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.ts`
- `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts`
- `apps/editor/src/workspace/diagnostics/diagnostics-screen.tsx`
- `apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts`
- `apps/editor/src/workspace/diagnostics/diagnostics-warning-badge.tsx`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `discussion/implementation/waves/wave85/_map.md`
- `discussion/implementation/waves/wave85/wave85-domain-b-validate-screen-badge-jump-actions-report.md`

## Basis Coverage Self-Report

Read before editing:

- `discussion/implementation/orchestration/wave85-plan.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave85/wave85-domain-a-editor-local-diagnostics-projection-report.md`
- `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

Also checked `discussion/_conventions.md`, `discussion/_map.md`, and Wave85 maps for artifact placement.

## Current-State Confirmation

- `WorkspaceEntryId` already contained `validate`; no state type change was needed.
- `taskEntries` and Toolbox task items already included Validate.
- `authoring-workspace.tsx` previously special-cased Parameters, Storage, and Viewer only; `validate` fell through to the normal Authoring Workspace.
- `AppBar` and `WorkspaceToolbox` were the active Validate entry rendering surfaces.
- Domain A projection exposes `createEditorDiagnosticsProjection()`, `warningItemCount`, items, and action hints.
- The worktree already contained unrelated dirty Wave85/Domain A and Domain C-looking files; Domain B did not revert or edit unrelated dirty files.

## UI / Badge / Jump Trace

- `validate` now opens `DiagnosticsScreen`, a dedicated read-only screen under `apps/editor/src/workspace/diagnostics/`.
- The screen groups warning items by Mesh, References, and Dynamics, and shows category, title, target, message, and details when present.
- Empty state says there are no deterministic warnings.
- Diagnostics screen suppresses the `ParameterBar` so no editing controls are present on the Validate route.
- App Bar Validate entry shows `DiagnosticsWarningBadge` when warning count is greater than zero and active entry is not Viewer.
- Toolbox Validate entry shows the same badge when warning count is greater than zero.
- Badge count uses Domain A `warningItemCount`.
- Jump logic is centralized in `diagnostics-jump-actions.ts`:
  - mesh warning -> `setActiveEntry("import")`, `setActiveTool("mesh")`, `selectDrawable(...)`.
  - deformer warning with safe deformer target -> `setActiveEntry("import")`, `setActiveTool("rig")`, `selectDeformerTreeTarget({ kind: "rigControl", ... })`.
  - parameter warning -> `setActiveEntry("parameters")`, `setActiveParameterId(...)`.
  - dynamics warning -> `setActiveEntry("import")`, `setActiveTool("dynamics")`, `setDynamicsToolPreviewGroupId(...)`.
- Diagnostics rows now resolve all valid Domain A action hints via `resolveEditorDiagnosticJumpCommands(...)`; duplicate Dynamics output ownership rows render one navigation-only button per conflicting Dynamics Group.
- Multiple jump buttons include the target label/id in the button label so duplicate Dynamics Group destinations remain distinguishable.
- Missing keyform target Deformer diagnostics intentionally do not invent a Rig selection target; the row shows `No safe jump target`.
- App Bar and Toolbox badge tests use two warnings in the same Dynamics category and same Dynamics Group target, proving the badge displays `warningItemCount` instead of category count, target count, or boolean presence.

## Viewer Exclusion Evidence

- Viewer implementation source was not changed.
- App Bar suppresses the Validate badge while `activeEntry === "viewer"`.
- Toolbox is not rendered in the Viewer route.
- `viewer-runtime-screen.test.ts` now covers a session with diagnostics warnings and asserts that Viewer route markup has no diagnostics badge, no Diagnostics screen, and no warning text.

## Must-not Compliance Evidence

- Mesh Tool Inspector implementation was not edited by Domain B.
- Dynamics Tool Inspector implementation was not edited by Domain B.
- Parts/Deformer Tree warning implementation was not added by Domain B.
- Product Preflight was not imported or migrated.
- No auto-fix, repair, AI proposal generation, completion score, or quality/naturalness judgement was added.
- No mesh generation algorithm, Dynamics schema, or operation payload was changed.
- No external dependency was added.
- Jump actions only call existing navigation, tool, selection, active parameter, or preview-group helpers.

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Sandbox attempt failed with esbuild `spawn EPERM`.
  - Escalated rerun passed: 5 files, 33 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- apps/editor/src/workspace apps/editor/src/state discussion/implementation/waves/wave85 discussion/implementation/reviews/wave85`: passed; Git emitted LF/CRLF working-copy warnings only.

## Residual risks / user-decision points

- `TaskViewEntryBar` also renders task/view entries but is currently unused by the workspace route. Domain B left it unchanged because App Bar and Toolbox are the active low-risk insertion points.
- Diagnostics rows with only missing keyform-set targets can lack a safe jump target. This is intentional to avoid selecting non-existent Deformers or inventing repair behavior.
- No browser visual QA was run for layout; coverage is focused React/static markup and helper unit tests.
- Domain C-owned inline Mesh/Dynamics/tree warning surfaces remain outside this Domain B implementation.
