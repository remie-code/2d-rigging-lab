# Wave51 Domain A Boundary / Coupling Target Inventory Review

- verdict: `pass`

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave51-plan.md`
- `discussion/implementation/orchestration/wave50-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/inventories/feature-inventory-and-classification.md`
- `discussion/design/screen-design/inventories/codex-test-evidence-dependency.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/screens/codex-automation-view.md`

## Files Inspected

- `discussion/implementation/waves/wave51/wave51-domain-a-boundary-coupling-target-inventory-report.md`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ai-command-host/editor-ai-command-host.ts`

Bounded source inspection only. No production source, tests, e2e files, or Domain A report were modified.

## Findings, Ordered By Severity

none

## Verification Performed

- Confirmed the report includes the required Domain A deliverable sections: verdict/scope, basis documents, exact Wave51 debt boundary, Domain B coupling targets, Domain C shell target, Domain D/E test/evidence targets, non-goals, bounded source inspection list, risks/escalation points, user-decision points, and Domain B start recommendation.
- Compared the Wave51 debt boundary against `wave51-plan.md` and the screen-design basis. The report correctly keeps Wave51 as UI surface protection / Task/View Shell foundation work and excludes new authoring capability, Mesh / Atlas / Parameter / Variant implementation, full visual redesign, final modal/window behavior, and broad panel migration.
- Verified the Domain B production coupling targets against `explicit-psd-import-panel.ts`: import-plan and structural scaffold sync use `data-testid` selectors at the reported functions, submit-state and freshness checks use the approved refs/test-id paths, and `findInRootOrParent` creates the local parent/root DOM placement dependency.
- Verified `editor-test-ids.ts` and `apps/editor/e2e/test-ids.mjs` still mirror the PSD import-plan and structural scaffold test IDs cited by the report, supporting the report's recommendation to preserve test-facing hooks while removing production behavior dependence.
- Verified the Domain C shell basis against `app-shell.ts` and `editor-app.ts`: the current shell creates a single `editor-workspace` and appends PSD Import, Product Preflight, Codex proposal review, AI approval/transcript, and operation persistence evidence into that workspace. The report's shell target is narrow and avoids choosing modal vs task window vs side panel vs dedicated view.
- Checked Domain D/E targets against the screen-design inventory and screen specs. The report aligns with structured PSD Import Task status, Diagnostics / Evidence separation, Codex-facing structured responses, focused PSD regression IDs, and a future guard for production `data-testid` behavior dependency.
- Ran `git diff --check -- discussion/implementation/waves/wave51/wave51-domain-a-boundary-coupling-target-inventory-report.md`; no whitespace errors were reported.

No unit, integration, or e2e tests were run because this was a clean inventory review, not source implementation or regression execution.

## Residual Risks / Deferred Items

- This review did not perform a full source or e2e inventory. It only checked the requested basis documents and bounded source files.
- The report intentionally leaves final PSD Import Task form, toolbox/navigation, Product Preflight placement, Codex / Automation placement, and complete oracle migration as future decisions.
- Domain B/C/D/E still need their own implementation reviews and focused verification. This Domain A review only validates that their starting targets are bounded and aligned with the plan.
- Structural-specific Codex execute/stale parity and Product Preflight DOM-independent read/comparison surfaces remain deferred or escalation-triggering topics, as the report states.

## User-Decision Points

No new user decision is required before starting Domain B.

Known future decisions remain correctly deferred:

- PSD Import Task final form: modal, task window, side panel, or dedicated view.
- Toolbox placement and final navigation pattern.
- Product Preflight and Codex / Automation final position in normal UI.
- Final structured replacement strategy for visible-text and DOM oracles.
