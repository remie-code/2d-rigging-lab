# Wave 30 Domain F Review Note: Editor Tutorial Mini Model Workflow UX

## Verdict

pass

## Reviewer

Review-Sylph, clean read-only contexts. The reviewers were separate from the Gnome implementation context and did not edit files.

## Scope Reviewed

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/tutorial-mini-model-session.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-state/reload-summary.ts`
- `apps/editor/src/editor-state/tutorial-guided-workflow-state.ts`
- `apps/editor/src/editor-state/tutorial-guided-workflow-state.test.ts`
- `apps/editor/src/editor-state/tutorial-guided-workflow-view-model.ts`
- `apps/editor/src/editor-state/tutorial-readiness-preflight-state.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/tutorial-mini-model-workflow.ts`
- `apps/editor/src/editor-workflow/tutorial-mini-model-workflow.test.ts`
- `apps/editor/src/editor-workflow/tutorial-readiness-preflight-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/tutorial-workflow/index.ts`
- `apps/editor/src/ui/tutorial-workflow/tutorial-workflow-panel.ts`
- Upstream Domain A-E completion reports and review notes.

## Basis

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave30-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/design/mvp-authoring-runtime/04-validator-acceptance-runner-design.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`

## Initial Findings

Initial Review-Sylph verdict: `needs_changes`.

1. High: browser-local save/load readiness was credited before browser-local save/load happened.
   - The guided workflow treated `reload.status === "reloaded"` as enough for the browser-local save/load step, while operation commits also set that reload status.
   - The UI test codified `Ready: 8 of 8 tutorial steps ready` immediately after create-only workflow execution.

2. Medium: "Validator readiness" was not actually the Wave30 tutorial readiness validator.
   - The guided workflow checked generic runtime evidence and any validation report ID.
   - Editor-side code did not yet consume the Domain C tutorial readiness report/preflight, so the label implied a stronger guarantee than the implementation provided.

## Fix Review

Final Review-Sylph verdict after fix loop 1: `pass`.

- The browser-local save/load step now requires both `reload.status === "reloaded"` and `reload.source === "browserLocalLoad"`.
- Operation commits are marked as `operationCommit`, while browser-local load restoration is marked as `browserLocalLoad`.
- Tests assert create-only workflow is 7/8 ready and browser-local save/load restoration reaches 8/8 readiness.
- Editor workflow now builds tutorial readiness preflight evidence through the Domain C `buildTutorialMiniModelReadinessReport` path.
- The guided validator step now requires `tutorialReadinessPreflight.status === "pass"`.
- Regression coverage proves generic `validationReportIds` alone do not make the tutorial validator step ready.

## Design Compliance

- Domain F stays within the allowed Editor source scope.
- App-level changes are narrow callback wiring through `apps/editor/src/app/editor-app.ts`.
- `index.ts` files remain barrel-only exports.
- New files have clear responsibilities: tutorial session command composition, tutorial workflow orchestration, tutorial readiness preflight projection, guided state/view-model, and focused UI panel.
- No dependency manifest, lockfile, or external dependency changes were introduced.
- No file picker, asset I/O, parser, image decode, full renderer, pixel oracle, public tutorial distribution, or Cubism compatibility implementation was added.
- UI text truthfully frames the tutorial workflow as semantic evidence only and lists the non-goals.

## Test Adequacy

Adequate for Domain F risk.

Coverage includes:

- Initial and positive tutorial readiness projection.
- Generic validation artifact rejection for tutorial validator readiness.
- Tutorial preflight preservation.
- Tutorial mini model creation workflow.
- Small mesh edit workflow through an existing operation.
- Browser-local save/load readiness restoration.
- App shell action wiring and rendered guided workflow state.

Browser e2e / mobile smoke remains assigned to Domain G and is not a Domain F blocker.

## Verification Reviewed

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/tutorial-guided-workflow-state.test.ts apps/editor/src/editor-workflow/tutorial-mini-model-workflow.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts` -> pass, 3 files / 28 tests.
- `pnpm.cmd typecheck` -> pass.
- `pnpm.cmd run check:source` -> pass.
- `pnpm.cmd run check:deps` -> pass.
- `git diff --check -- <Domain F editor paths>` -> exit 0, CRLF warnings only.
- New Domain F files trailing-whitespace scan -> no matches.
- Package manifest and lockfile scoped status check -> no changes.

## Remaining Issues

No blocking issues remain.

Non-blocking note:

- Domain G still needs to provide the browser e2e / mobile smoke for create tutorial model -> inspect -> edit -> save/load -> reinspection.

## User-Decision Points

None.
