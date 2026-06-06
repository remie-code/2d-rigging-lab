# Wave48 Domain D Report: Editor Import Plan Preview / Explicit Approval UX

> Target: `wave48-editor-import-plan-preview-explicit-approval-ux`
> Role: Orch-Sylph domain completion report
> Verdict: `pass`

## Verdict

`pass`

Wave48 Domain D is complete within the approved Editor UI/workflow scope. Source implementation was delegated to Gnome, and independent Review-Sylph review was run in a separate context. The first review found one approval-boundary issue; Gnome fixed it with a bounded UI/test patch, and Review-Sylph re-review returned `pass`.

This domain adds Editor PSD Import panel support for root/group import-plan preview, explicit eligible leaf approval/unapproval, and approved-leaf-only batch intake using the Domain B candidate service and Domain C import-plan approval bridge. It does not implement all-layer one-click import, recursive group auto import, direct group import, drag-drop, archive/filesystem access, full compositing, renderer/pixel oracle, package contract changes, validator diagnostics, public demo asset claims, Cubism claims, or repo-side AI/LLM/auto-fix behavior.

## Basis Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave48-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-report.md`
- `discussion/implementation/reviews/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-review.md`
- `discussion/implementation/waves/wave48/wave48-domain-b-browser-psd-import-plan-candidate-service-report.md`
- `discussion/implementation/reviews/wave48/wave48-domain-b-browser-psd-import-plan-candidate-service-review.md`
- `discussion/implementation/waves/wave48/wave48-domain-c-package-operation-import-plan-approval-bridge-report.md`
- `discussion/implementation/reviews/wave48/wave48-domain-c-package-operation-import-plan-approval-bridge-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

## Files Changed

Domain D source/test files:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-session/psd-layer-materialization-command.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/explicit-psd-import-state.ts`
- `apps/editor/src/editor-state/explicit-psd-import-view-model.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/explicit-psd-import-plan-approval-bridge.ts`
- `apps/editor/src/editor-workflow/explicit-psd-import-plan-approval-bridge.test.ts`
- `apps/editor/src/editor-workflow/explicit-psd-import-plan-workflow.ts`
- `apps/editor/src/editor-workflow/explicit-psd-import-plan-workflow.test.ts`
- `apps/editor/src/editor-workflow/explicit-psd-source-identity.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`

Upstream Domain B files present in the same worktree and used by Domain D:

- `apps/editor/src/editor-state/explicit-psd-import-plan-state.ts`
- `apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-result.ts`
- `apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-service.ts`
- `apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-service.test.ts`

Domain D reports/reviews:

- `discussion/implementation/waves/wave48/wave48-domain-d-editor-import-plan-preview-explicit-approval-ux-report.md`
- `discussion/implementation/reviews/wave48/wave48-domain-d-editor-import-plan-preview-explicit-approval-ux-review.md`

## Implementation Summary

- Added explicit PSD import-plan preview workflow that requires a parsed current browser PSD session and current PSD file bytes, computes source SHA-256, calls the Domain B candidate service, and projects the resulting plan into Editor state.
- Added parser-free approval bridge construction for Domain C batch intake evidence, including candidate plan digest, source PSD identity, approval selection digest, approved leaf refs, not-approved/blocked summaries, generated scaffold preview/resolved ids, destination parent part, and private/local boundary flags.
- Extended the workflow controller with `generateExplicitPsdImportPlanPreview` and `commitExplicitPsdImportPlanApprovedBatchIntake`.
- Connected approved import-plan execution to the existing Wave47 batch intake workflow, passing only approved leaf refs and optional Domain C `importPlanBridge` evidence.
- Extended the PSD Import panel to show import-plan facts, digest, source identity/provenance, scope, counts, byte estimates, hidden/unsupported/collision/not-approved summaries, per-candidate approval state, generated scaffold preview ids, diagnostics, destination parent part, and batch result import-plan summary.
- Added eligible leaf approval/unapproval controls. Hidden, unsupported, blocked, and other non-eligible candidates are not silently approved.
- Fixed stale approval execution: after local checkbox/textarea approval changes, approved batch execution is disabled and submit refuses to call intake until the import-plan preview is regenerated.
- Kept existing Wave45-Wave47 explicit PSD import, selected layer intake, and selected leaf batch intake paths intact.
- Kept `index.ts` changes barrel-only.

## Review Summary

Review report: `discussion/implementation/reviews/wave48/wave48-domain-d-editor-import-plan-preview-explicit-approval-ux-review.md`

Initial Review-Sylph verdict: `needs_fix`.

- D-F1: UI checkbox unapproval updated only local controls, while approved batch execution used the last cached candidate plan. A user could uncheck an approved candidate and execute stale approved refs without regenerating preview.

Bounded Gnome fix:

- Recorded the last generated approved refs on the approval textarea.
- Disabled approved execution while current approval controls differ from the generated plan.
- Added submit-time stale-selection guard before calling intake.
- Added focused panel regression covering stale approval prevention and successful execution after regenerating preview with the changed approved list.

Final Review-Sylph re-review verdict: `pass`.

- D-F1 resolved.
- No new findings.
- Design/development compliance and test adequacy passed for Domain D.

## Verification Performed

Run by Orch-Sylph after implementation and after the D-F1 fix:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-service.test.ts apps/editor/src/editor-workflow/explicit-psd-import-plan-approval-bridge.test.ts apps/editor/src/editor-workflow/explicit-psd-import-plan-workflow.test.ts apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
  - Initial sandboxed runs failed at Vitest config load with esbuild `spawn EPERM`.
  - Approved rerun after the final fix passed: 5 files / 22 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `pnpm.cmd run check:source`
  - Passed.
- `pnpm.cmd run check:deps`
  - Passed.
- `node scripts/check-psd-parser-import-boundary.mjs`
  - Passed; 5 direct import/resolve sites remain limited to the approved adapter and Wave44 scripts.
- `git diff --check -- apps/editor/src apps/editor/e2e discussion/implementation/waves/wave48 discussion/implementation/reviews/wave48`
  - Passed with LF-to-CRLF working-copy warnings only.

Run by Review-Sylph:

- Direct inspection of Domain D source/tests and upstream Domain B/C contracts used by the UI/workflow.
- Direct inspection of D-F1 fix and regression.
- Focused `git diff --check` over touched source/test/review artifact.
- Focused parser/Cubism import and forbidden positive-claim scans over touched files.

## Remaining Issues

None blocking for Domain D.

Notes for later domains:

- Domain E owns validator/Product Preflight import-plan diagnostics.
- Domain F owns focused e2e/persistence regression for sample root preview to approved-leaf batch intake.
- Worktree also contains Wave48 Domain A/B/C/E artifacts and package changes outside Domain D; they were treated as upstream or parallel out-of-scope work.

## User-Decision Points

None required for Domain D pass.

Future decisions remain outside this domain:

- Raising candidate enumeration, approved count, or approved byte caps.
- Allowing explicit hidden layer materialization.
- Moving from import-plan preview plus explicit leaf approval into all-layer import or recursive group import.
- Public/demo use of sample-derived visual assets.

## Provisional Assumptions

- Wave47 final pass is the implementation-proven baseline.
- Wave48 Domain A/B/C pass reports and reviews are accepted upstream gates.
- Domain B candidate plan digest covers candidate-plan identity; mutable approval selection is separate.
- Domain C bridge evidence is the parser-free operation boundary for approved leaf refs.
- Dirty approval controls must require preview regeneration before approved execution.
