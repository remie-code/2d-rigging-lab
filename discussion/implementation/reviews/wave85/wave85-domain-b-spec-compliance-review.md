# Wave85 Domain B: Spec Compliance Review

## Verdict

pass

## Basis reviewed

- `discussion/implementation/orchestration/wave85-plan.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave85/wave85-domain-a-editor-local-diagnostics-projection-report.md`
- `discussion/implementation/waves/wave85/wave85-domain-b-validate-screen-badge-jump-actions-report.md`
- `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts`
- Domain B changed source/tests listed in the review request.

## Scope reviewed

- Validate route wiring:
  - `apps/editor/src/workspace/authoring-workspace.tsx:33`
  - `apps/editor/src/workspace/authoring-workspace.tsx:42`
  - `apps/editor/src/workspace/authoring-workspace.tsx:46`
  - `apps/editor/src/workspace/authoring-workspace.tsx:87`
- Diagnostics screen/list:
  - `apps/editor/src/workspace/diagnostics/diagnostics-screen.tsx:27`
  - `apps/editor/src/workspace/diagnostics/diagnostics-screen.tsx:72`
  - `apps/editor/src/workspace/diagnostics/diagnostics-screen.tsx:90`
  - `apps/editor/src/workspace/diagnostics/diagnostics-screen.tsx:112`
  - `apps/editor/src/workspace/diagnostics/diagnostics-screen.tsx:142`
- Badge wiring:
  - `apps/editor/src/workspace/app-bar.tsx:34`
  - `apps/editor/src/workspace/app-bar.tsx:38`
  - `apps/editor/src/workspace/app-bar.tsx:85`
  - `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx:22`
  - `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx:78`
  - `apps/editor/src/workspace/diagnostics/diagnostics-warning-badge.tsx:10`
- Jump actions:
  - `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.ts:37`
  - `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.ts:110`
  - `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.ts:122`
  - `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.ts:137`
  - `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.ts:148`
- Viewer exclusion:
  - `apps/editor/src/workspace/authoring-workspace.tsx:42`
  - `apps/editor/src/workspace/app-bar.tsx:38`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:204`
- Focused tests:
  - `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts`
  - `apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts`
  - `apps/editor/src/workspace/app-bar.test.ts`
  - `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`

## Findings

No spec-compliance findings.

## Spec coverage notes

- `validate` entry opens a dedicated Diagnostics screen instead of falling through to the normal Authoring Workspace: `authoring-workspace.tsx` sets `showDiagnostics` for `activeEntry === "validate"` and renders `DiagnosticsScreen`; the focused test asserts the Diagnostics screen appears and the canvas/viewer/Parameter Bar do not.
- The Diagnostics screen is read-only for Domain B scope. It computes a projection from the current session, groups rows by deterministic category order, renders category/title/target/message/details, and exposes only jump/no-safe-jump controls. The tests assert no auto-fix/repair text and no input controls.
- Empty state is explicit: `No deterministic warnings` with `0 warnings`.
- Badge count is sourced from Domain A `warningItemCount` in both App Bar and Toolbox. `DiagnosticsWarningBadge` returns `null` for `count <= 0` and renders the numeric count otherwise.
- Jump actions match the accepted v0 routes without project-data mutation:
  - mesh warning: `setActiveEntry("import")`, `setActiveTool("mesh")`, `selectDrawable(...)`;
  - deformer warning: `setActiveEntry("import")`, `setActiveTool("rig")`, `selectDeformerTreeTarget({ kind: "rigControl", ... })`;
  - parameter warning: `setActiveEntry("parameters")`, `setActiveParameterId(...)`;
  - dynamics warning: `setActiveEntry("import")`, `setActiveTool("dynamics")`, `setDynamicsToolPreviewGroupId(...)`.
- Domain B intentionally does not invent a jump for `references.keyformTargetDeformerMissing`; this is consistent with the "where possible" constraint because the target Deformer is absent.
- Viewer exclusion is covered by source and test: the Viewer route renders `ViewerRuntimeScreen`, not `DiagnosticsScreen` or Toolbox, and App Bar suppresses the badge while `activeEntry === "viewer"`.

## Must-not compliance notes

- No Product Preflight wholesale UI, raw preflight payload display, completion score, quality/naturalness judgment, repair, auto-fix, AI proposal generation, or automatic authoring operation appears in Domain B source.
- Domain B source does not edit Mesh Tool Inspector, Dynamics Tool Inspector, Parts Tree, Deformer Tree, mesh generation algorithms, Dynamics schema, or operation payloads.
- Viewer source was not changed for diagnostics behavior; only a negative Viewer test was added.
- Worktree contains Domain C-looking dirty files under `apps/editor/src/features/editor-session/**` and `apps/editor/src/workspace/panels/**`; they were not reviewed as Domain B findings except where existing selection/preview APIs directly affect jump safety.

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Sandbox run failed with esbuild `spawn EPERM`.
  - Escalated rerun passed: 5 files, 31 tests.
- `pnpm.cmd typecheck`: passed.

## Residual risks / user-decision points

- No blocking residual risk for Domain B spec compliance.
- Browser/manual visual QA was not performed; this leaves layout polish as a residual visual risk, not a spec-compliance blocker for this lane.
- `TaskViewEntryBar` was not changed. Domain B report says it is currently unused by the workspace route; if a later route renders Validate through that component, badge coverage should be rechecked.
- Domain C-owned inline Mesh/Dynamics/tree warning surfacing remains outside this review lane.
