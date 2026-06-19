# Wave85 Domain B Design / Development Compliance Review

## Verdict

pass

## Basis reviewed

- `discussion/implementation/orchestration/wave85-plan.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/implementation/waves/wave85/wave85-domain-a-editor-local-diagnostics-projection-report.md`
- `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts`
- `discussion/implementation/waves/wave85/wave85-domain-b-validate-screen-badge-jump-actions-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- Domain B changed source and tests listed in the review request.

## Scope reviewed

Reviewed Domain B files under `apps/editor/src/workspace/**` and the focused Viewer negative test. I did not review Domain C-looking dirty changes under `apps/editor/src/features/editor-session/**` or `apps/editor/src/workspace/panels/**` as Domain B findings except for checking the pre-existing UI-state helper boundary used by jump actions.

Verification run during review:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - sandbox run failed with esbuild `spawn EPERM`.
  - escalated rerun passed: 5 files, 33 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- <Domain B workspace files> discussion/implementation/waves/wave85 discussion/implementation/reviews/wave85`: passed with LF/CRLF working-copy warnings only.

## Fix loop 1 re-review

The original `needs_changes` finding is resolved.

- `resolveEditorDiagnosticJumpCommands()` now maps all valid Domain A action hints to commands and only falls back to target-derived navigation when no hint command exists (`apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.ts:38`-`48`). First-command compatibility remains via `resolveEditorDiagnosticJumpCommand()` and `runEditorDiagnosticJump()` (`apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.ts:53`-`68`).
- Multiple commands get disambiguated labels with the target label/id (`apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.ts:173`-`187`).
- `DiagnosticsScreen` now resolves command arrays and renders one `diagnostics-jump-action` button per command (`apps/editor/src/workspace/diagnostics/diagnostics-screen.tsx:110`, `148`-`174`).
- Jump commands remain navigation/selection only: they call `setActiveEntry`, `setActiveTool`, `selectDrawable`, `selectDeformerTreeTarget`, `setActiveParameterId`, or `setDynamicsToolPreviewGroupId` (`apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.ts:125`-`168`).
- Focused tests now assert one Dynamics command per duplicate-output owner and verify each command selects its own group id (`apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts:143`-`190`). Screen tests assert the duplicate-output row renders two jump buttons with both group labels (`apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts:119`-`130`).
- The updated Domain B report records the fix and the 5-file / 33-test focused pass (`discussion/implementation/waves/wave85/wave85-domain-b-validate-screen-badge-jump-actions-report.md:7`-`12`, `69`-`72`, `92`-`96`).

## Findings

No open design/development compliance findings.

## Policy / design coverage notes

- Source organization: new Domain B production files are cohesive (`diagnostics-screen`, `diagnostics-jump-actions`, `diagnostics-warning-badge`) and no new `index.ts` or catch-all file was introduced. Tests mirror the changed responsibilities. The source organization guard passed.
- Dependency policy: no new external dependency or lockfile change was found in Domain B. Imports are existing React, lucide, and internal modules. The dependency guard passed.
- Operation policy: jump actions call UI/navigation/selection helpers only: `setActiveEntry`, `setActiveTool`, `selectDrawable`, `selectDeformerTreeTarget`, `setActiveParameterId`, and `setDynamicsToolPreviewGroupId` (`apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.ts:23`-`28`, `125`-`168`). Source review of the invoked helpers showed UI selection or preview-state updates rather than package graph mutation (`apps/editor/src/features/editor-session/editor-session-context.tsx:917`-`923`, `985`-`987`, `1120`-`1144`, `1153`-`1174`).
- Schema / ID policy: Domain B does not define external DTOs or schemas. Machine-readable local IDs such as `data-testid="diagnostics-warning-badge"` and diagnostic target kinds follow local no-space conventions.
- UI design: `validate` routes to a dedicated `DiagnosticsScreen` and suppresses `ParameterBar` (`apps/editor/src/workspace/authoring-workspace.tsx:35`-`47`, `87`). The screen is read-only in source review and tests assert no inputs, auto-fix, or repair text (`apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts:83`-`113`). Badge count uses Domain A `warningItemCount` in App Bar and Toolbox (`apps/editor/src/workspace/app-bar.tsx:34`-`38`, `85`-`88`; `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx:22`-`24`, `78`-`81`).
- Viewer exclusion: App Bar suppresses the Validate badge while Viewer is active (`apps/editor/src/workspace/app-bar.tsx:38`), Viewer route does not render Toolbox through the workspace route, and the focused Viewer negative test covers diagnostics warnings in the session without Viewer diagnostics UI (`apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:204`-`216`).

## Must-not compliance notes

- No Product Preflight wholesale UI migration was found in Domain B source.
- No auto-fix, repair, AI proposal generation, completion score, or quality/naturalness judgement was found in Domain B source.
- No Mesh Tool Inspector, Dynamics Tool Inspector, Parts Tree warning, Deformer Tree warning, mesh generation algorithm, Dynamics schema/payload, or viewer diagnostics implementation was added by Domain B. The touched Viewer file is a negative test only.
- No Cubism SDK/Core, proprietary asset, or Cubism format dependency/claim was found in Domain B source.

## Residual risks / user-decision points

- No browser visual QA was run by this review. Static markup/source review did not reveal an obvious layout blocker, but badge overlap and dense-row wrapping remain visual residual risks for later integration or browser review.
- No user-decision point remains for this design/development lane.
