# Wave 23 Domain D Completion: Editor Dynamics Panel / Preview Run UX

> Target: `wave23-editor-dynamics-panel-preview-run-ux`  
> Date: 2026-05-31  
> Orch-Sylph: current context  
> Gnome implementation: `019e7e37-70cf-7b82-9578-e1ff086a955e` / `Gnome the 25th`  
> Review-Sylph: `019e7e5d-f15b-7043-ba4b-126b26ebb565` / `Sylph the 26th`  
> Status: `pass`

## Orchestration Compliance

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

This domain followed that separation:

- Source implementation was delegated to Gnome `019e7e37-70cf-7b82-9578-e1ff086a955e`.
- Independent review was delegated to Review-Sylph `019e7e5d-f15b-7043-ba4b-126b26ebb565`.
- Orch-Sylph did not edit source implementation files.
- Orch-Sylph only wrote this completion report after implementation and review completed.
- Review-Sylph reviewed basis documents, actual changed files/diff, focused tests, and guard commands.

## Basis Notes

The requested path `discussion/development_convention/dependency-management-policy.md` was not present in the repository. Domain D used the repository's actual dependency policy path, `discussion/development_convention/dependency-policy.md`, which is also the path referenced by the Wave 23 plan.

Domain A, Domain B, and Domain C completion/review artifacts were all `pass`, so the Domain D upstream gate was satisfied before implementation started.

## Result

Domain D is `pass`.

The editor now exposes a minimal Dynamics panel for Minimum Open Dynamics v1. From the editor UI, a user can create and update a dynamics group, create a computed dynamics output parameter through the group creation flow, reset/run preview, and inspect computed output, runtime evidence/diff, and validator diagnostics projected from the existing runtime and validator foundations.

The first review returned `needs_fix` for source organization and UI submit coverage. Gnome completed a fix loop:

- Dynamics group creation/update workflow logic was split into `apps/editor/src/editor-workflow/dynamics-group-workflow.ts`.
- Dynamics preview reset/run and runtime/validator projection logic was split into `apps/editor/src/editor-workflow/dynamics-preview-workflow.ts`.
- `workflow-controller.ts` was reduced back to controller wiring.
- Focused dynamics panel tests now submit create and update forms.

Review-Sylph follow-up review found no remaining findings.

## Changed Files

Domain D source and focused tests changed by Gnome:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-session/create-parameter-command.ts`
- `apps/editor/src/editor-session/dynamics-group-command.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-state/dynamics-authoring-state.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/editor-view-model.test.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-workflow/dynamics-group-workflow.ts`
- `apps/editor/src/editor-workflow/dynamics-preview-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/dynamics-panel/dynamics-panel.test.ts`
- `apps/editor/src/ui/dynamics-panel/dynamics-panel.ts`
- `apps/editor/src/ui/dynamics-panel/index.ts`

Review/report artifacts:

- `discussion/implementation/reviews/wave23/wave23-domain-d-editor-dynamics-panel-preview-run-ux-review.md`
- `discussion/implementation/waves/wave23/wave23-domain-d-editor-dynamics-panel-preview-run-ux-completion.md`

Other Wave 23 domain artifacts and source changes already present in the workspace were not reverted.

## Verification

Gnome and Review-Sylph reported the required checks passed:

| Command / check | Result |
|---|---|
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/ui/dynamics-panel/dynamics-panel.test.ts` | pass; 5 files / 63 tests |
| `git diff --check -- apps/editor discussion/implementation/waves/wave23 discussion/implementation/reviews/wave23` | pass; CRLF working-copy warnings only |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| Manifest / lockfile diff check for package manifests and lockfiles | pass; no dependency manifest or lockfile changes |
| Forbidden-scope scan over changed Domain D source | pass; no Cubism Physics compatibility, file picker, parser/decode/archive, direct vertex physics, collision editor, timeline editor, graph editor, or external dependency matches |

Orch-Sylph also ran the final `git diff --check -- apps/editor discussion/implementation/waves/wave23 discussion/implementation/reviews/wave23`; it passed with CRLF working-copy warnings only.

## Independent Review

Review report:

- `discussion/implementation/reviews/wave23/wave23-domain-d-editor-dynamics-panel-preview-run-ux-review.md`

Final review verdict: `pass`.

Findings: none.

Review lanes passed:

- Design / Development Compliance Review
- Test Adequacy Review

## Residual Risks

- Browser/mobile visual smoke was not run in this domain. Per the Wave 23 plan, Domain F owns desktop/mobile e2e and persistence smoke.
- Preview evidence is editor-session state and is recomputed by preview run/reset rather than persisted. Authored dynamics groups and parameters are persisted/reloaded.
- The create flow can leave a newly created computed output parameter if later dynamics group creation is rejected. Review-Sylph classified this as low residual workflow risk, not a pass blocker.

## Escalation

None.
