# Wave52 Domain C Review: PSD Import Task Human UI Component

Target: `wave52-psd-import-task-human-ui-component`

## verdict

`pass`

Blocking findings: none.

The Domain C implementation is acceptable for the component boundary. It exports PSD Import task content that Domain D can place inside the Task Shell, preserves the existing panel wrapper for compatibility, keeps App Shell integration out of this domain, preserves focused PSD workflow behavior, and keeps machine-only identifiers out of the new primary human summary.

## Basis Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave52-plan.md`
- `discussion/implementation/waves/wave52/wave52-domain-a-boundary-component-contract-inventory-report.md`
- `discussion/implementation/reviews/wave52/wave52-domain-a-boundary-component-contract-inventory-review.md`
- `discussion/implementation/waves/wave51/wave51-final-integration-report.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/inventories/codex-test-evidence-dependency.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Scope Reviewed

- Reviewed the actual diff with `git diff -- apps/editor/src/ui/explicit-psd-import`.
- Reviewed target files:
  - `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
  - `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
- Read related projection source:
  - `apps/editor/src/editor-state/explicit-psd-import-view-model.ts`
  - `apps/editor/src/editor-state/explicit-psd-import-task-observation.ts`
- Checked `apps/editor/src/ui/explicit-psd-import/index.ts`; it remains barrel-only.

Note: the working tree contains unrelated Wave52/other-domain changes under `apps/editor/src/ui/app-shell/**` and `discussion/implementation/**`. This review judged only the Domain C target diff under `apps/editor/src/ui/explicit-psd-import/**` plus this review artifact.

## Findings

Blocking findings: none.

No `needs_fix`, `escalate`, or `blocked` finding was identified.

## Review Checks

### Domain C scope

Pass.

- The target diff changes only `explicit-psd-import-panel.ts` and its focused unit test.
- No Domain C target diff touches App Shell final integration, routing/open-close state, editor-state source, e2e files, package metadata, scripts, or guard integration.
- `index.ts` remains a single barrel export.

### API suitability for Domain D

Pass.

- `createExplicitPsdImportTaskContent(options)` is exported and returns task content without the legacy panel wrapper.
- `createExplicitPsdImportPanel(options)` remains backward-compatible and appends the task content under the existing `explicitPsdImportPanel` wrapper.
- The new task content accepts the same view model, destination parts, and existing PSD workflow callbacks, so Domain D can host it without editor-state mutation or App Shell integration inside C.

### Behavior preservation

Pass.

- Existing parse, selected layer intake, batch intake, import-plan preview, approved batch execution, structural scaffold preview, structural commit, and stale approval blocking paths remain covered by focused unit tests.
- Import-plan and structural scaffold approval synchronization still uses local `ApprovalBinding` state and `syncApprovedRefsFromChoices` / `updateApprovalSubmitState`; production code did not reintroduce `data-testid` selector reads.
- Stable `data-testid` assignments remain available as test-facing hooks.

### Human UI boundary

Pass.

- The new primary summary is limited to source, parse/tree state, import-plan scope, structural preview, warning summary, and approval/commit state.
- The implementation summarizes scope and destination labels rather than showing full PSD node refs or destination IDs in the primary summary.
- The added test explicitly rejects primary-summary exposure of digests, plan IDs, approval IDs, PSD node refs, generated refs, evidence paths, test selector strings, raw parser payload wording, approval digest wording, and operation ID wording.

### Evidence and test detail boundary

Pass.

- Legacy verbose controls, diagnostics, generated refs, digests, evidence, and parser/persistence facts still exist only under `Technical Workflow Details`.
- This keeps regression-compatible details available while separating them from the primary human summary.
- Full Diagnostics / Evidence View separation remains future work, consistent with the screen-design documents and Domain A residual risks.

### Production `data-testid` boundary

Pass.

- Static scan of the production file found only `dataset.testid` assignments, not production behavior reads or selector queries.
- `node scripts/check-production-testid-boundary.mjs` passed.

### Source organization

Pass with deferred debt.

- `index.ts` is barrel-only, and `node scripts/check-source-organization.mjs` passed.
- The implementation keeps the extraction in the existing `explicit-psd-import-panel.ts`, which Domain A explicitly allowed for extraction/componentization while preserving behavior.
- This is acceptable for Domain C because the task content factory still depends tightly on existing private form/list helpers and approval bindings, and splitting it now would increase the risk of behavior churn.
- Residual debt: `explicit-psd-import-panel.ts` grew from 1111 to 1299 lines. Before additional PSD Import UI work, a named split such as task summary/content helpers should be considered so this file does not keep absorbing distinct responsibilities.

### Non-goals

Pass.

The target diff does not introduce Mesh / Atlas / Parameter / Variant capability, semantic recognition, proposal generation, auto-rigging, auto-fix, automatic commit, external transport, Cubism compatibility, renderer/pixel oracle, PSD/raw parser persistence, or structural-specific Codex execute/stale parity.

## Verification Reviewed Or Run

- Reviewed: `git diff -- apps/editor/src/ui/explicit-psd-import`
- Run: `pnpm.cmd exec vitest run apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
  - Sandbox attempt failed with esbuild `spawn EPERM`.
  - Approved rerun passed: 1 file, 16 tests.
- Run: `pnpm.cmd typecheck` passed.
- Run: `node scripts/check-production-testid-boundary.mjs` passed.
- Run: `node scripts/check-source-organization.mjs` passed.
- Run: `git diff --check -- apps/editor/src/ui/explicit-psd-import` passed with LF/CRLF warnings only.

## Residual Risks / Deferred Debt

- The legacy technical detail area still visibly contains machine/evidence-oriented text. It is separated from the primary summary, but final Diagnostics / Evidence View placement remains a later Domain D/E or future-wave responsibility.
- Focused PSD e2e was not run for this Domain C review. Domain D/E still own task reachability, focused e2e preservation, and final guard integration decisions.
- The Wave51 PSD Import Task structured observation projector remains unconsumed by this Domain C component. Domain D must either consume it narrowly or record a reviewed deferral.
- `explicit-psd-import-panel.ts` is now large enough that further PSD Import UI changes should prefer a named file split.

## User-Decision Points

No immediate user decision is required for Domain C.

Future decisions remain the same as Domain A: final toolbox placement, final modal/task-window/dedicated-view policy, final Diagnostics / Evidence View and Codex / Automation View placement, and whether production `data-testid` guard integration becomes part of a broader standard quality gate if Domain E defers narrow script integration.
