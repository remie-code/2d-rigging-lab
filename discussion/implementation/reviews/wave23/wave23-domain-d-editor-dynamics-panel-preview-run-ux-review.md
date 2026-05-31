# Wave 23 Domain D Review: Editor Dynamics Panel / Preview Run UX

Verdict: `pass`

Review-Sylph follow-up review checked the Gnome fix loop against the actual `apps/editor` files, untracked new files, focused tests, and guard commands. The previous `needs_fix` findings are resolved. No new blocking, high, medium, or low findings were found.

## Scope Reviewed

Target: `wave23-editor-dynamics-panel-preview-run-ux`

Follow-up focus:

- Source organization fix for `apps/editor/src/editor-workflow/workflow-controller.ts`
- New workflow helpers:
  - `apps/editor/src/editor-workflow/dynamics-group-workflow.ts`
  - `apps/editor/src/editor-workflow/dynamics-preview-workflow.ts`
- New focused UI test:
  - `apps/editor/src/ui/dynamics-panel/dynamics-panel.test.ts`
- Regression scan over the Domain D editor files and review artifact

`apps/editor/src/app/editor-app.ts` remains acceptable as focused editor app callback wiring.

## Basis Checked

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave23-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- Domain A/B/C completion and review artifacts listed in the assignment
- MVP runtime/editor/validator design documents listed in the assignment
- Previous Domain D review artifact and findings

## Findings

None.

## Resolved Findings

### Resolved: `workflow-controller.ts` source organization

The previous blocking finding is resolved.

Evidence:

- `workflow-controller.ts` is now about 726 lines and delegates dynamics group work to focused helpers instead of owning the implementation body.
- Dynamics group helper imports and type exports are explicit wiring (`apps/editor/src/editor-workflow/workflow-controller.ts:71`, `apps/editor/src/editor-workflow/workflow-controller.ts:83`).
- Controller methods now delegate create/update to helper functions and only update controller-local state/result references (`apps/editor/src/editor-workflow/workflow-controller.ts:542`, `apps/editor/src/editor-workflow/workflow-controller.ts:550`).
- Controller preview methods delegate reset/run to the preview runner (`apps/editor/src/editor-workflow/workflow-controller.ts:558`, `apps/editor/src/editor-workflow/workflow-controller.ts:564`).
- `dynamics-group-workflow.ts` owns create/update dynamics operation orchestration, computed output parameter creation, and dynamics operation ID helpers (`apps/editor/src/editor-workflow/dynamics-group-workflow.ts:37`, `apps/editor/src/editor-workflow/dynamics-group-workflow.ts:113`, `apps/editor/src/editor-workflow/dynamics-group-workflow.ts:147`).
- `dynamics-preview-workflow.ts` owns preview runtime state, reset/run, runtime sequence evaluation, validator projection, and preview projection for dynamics (`apps/editor/src/editor-workflow/dynamics-preview-workflow.ts:54`, `apps/editor/src/editor-workflow/dynamics-preview-workflow.ts:154`, `apps/editor/src/editor-workflow/dynamics-preview-workflow.ts:276`).
- `pnpm.cmd run check:source` passed.

This now satisfies the source organization policy expectation that substantial implementation logic be split into named responsibility files.

### Resolved: UI create/update submit coverage

The previous medium finding is resolved.

Evidence:

- The new dynamics panel test submits the create form and verifies the new computed output command path, including default output display name, driver, output range, reset policy, stiffness/damping, max velocity, and max amplitude (`apps/editor/src/ui/dynamics-panel/dynamics-panel.test.ts:34`).
- The same focused test file submits an existing group update form and verifies the update command payload for display name, enabled state, and reset policy (`apps/editor/src/ui/dynamics-panel/dynamics-panel.test.ts:69`).
- The focused editor test run now includes `apps/editor/src/ui/dynamics-panel/dynamics-panel.test.ts` and passed.

## Design / Development Compliance

Result: `pass`

- Domain D remains scoped to editor state/workflow/session/UI and focused editor tests.
- `workflow-controller.ts` is back to controller wiring for dynamics and no longer owns the runtime/validator preview implementation body.
- New workflow files have clear single responsibilities: group operation orchestration and preview runtime orchestration.
- `index.ts` files remain barrel-only.
- No package manifests, lockfiles, or external dependencies changed.
- Forbidden-scope scan over the changed Domain D source found no Cubism Physics compatibility claim, `.physics3`, file picker, parser/decode/archive, direct vertex physics, collision editor, timeline editor, or graph editor additions.

## Test Adequacy

Result: `pass`

Coverage is adequate for this Domain D follow-up:

- Session adapter test covers `createDynamicsGroup` commit and editor runtime/validation evidence.
- Workflow controller tests cover dynamics group creation, preview run/reset, update, save/load restoration, projected computed output, runtime evidence, and validator diagnostics.
- View-model tests cover dynamics group state and authoring controls.
- App-shell tests cover panel rendering and preview run/reset callback wiring.
- New dynamics panel tests cover actual create and update form submission.

Remaining e2e/mobile/browser smoke belongs to downstream Domain F per the Wave 23 plan.

## Verification

Commands run independently:

| Command / check | Result |
|---|---|
| `git status --short -uall apps/editor discussion/implementation/reviews/wave23/wave23-domain-d-editor-dynamics-panel-preview-run-ux-review.md` | Shows expected Domain D editor changes, new helper/test files, and this review artifact. |
| `pnpm.cmd typecheck` | pass. |
| `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/ui/dynamics-panel/dynamics-panel.test.ts` | pass; 5 files / 63 tests. |
| `git diff --check -- apps/editor discussion/implementation/waves/wave23 discussion/implementation/reviews/wave23` | pass; Git emitted LF-to-CRLF working-copy warnings only. |
| `pnpm.cmd run check:source` | pass. |
| `pnpm.cmd run check:deps` | pass. |
| `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/*/package.json` | pass; no manifest or lockfile changes. |
| Forbidden-scope scan over changed Domain D source | pass; no matches. |

## Residual Risks

- Browser/mobile visual smoke was not run in this follow-up review. Per the Wave 23 plan, Domain F owns desktop/mobile e2e and persistence smoke.
- Preview evidence is still editor-session state rather than persisted project state; authored dynamics groups and parameters are persisted and reloaded, while preview run/reset recomputes evidence.
- The two-step create path can still leave a newly created computed output parameter if later group creation is rejected. Current UI defaults and operation preconditions make this a low residual workflow risk, not a pass blocker.

## Escalation / User Decision Points

None.
