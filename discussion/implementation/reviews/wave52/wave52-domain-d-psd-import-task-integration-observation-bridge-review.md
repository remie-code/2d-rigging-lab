# Wave52 Domain D Review: PSD Import Task Integration / Observation Bridge

- Verdict: `pass`
- Target: `wave52-psd-import-task-integration-observation-bridge`
- Reviewer role: independent clean Review-Sylph

## Scope Reviewed

- Domain D changed files:
  - `apps/editor/src/ui/app-shell/app-shell.ts`
  - `apps/editor/src/ui/app-shell/app-shell.test.ts`
  - `apps/editor/src/app/editor-app.ts`
  - `apps/editor/src/editor-state/editor-test-ids.ts`
  - `apps/editor/e2e/test-ids.mjs`
  - `apps/editor/e2e/psd-import-focused-smoke.mjs`
  - `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs`
  - `apps/editor/e2e/psd-import-plan-focused-smoke.mjs`
  - `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs`
  - `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs`
- Consumed B/C outputs:
  - `apps/editor/src/ui/app-shell/task-shell.ts`
  - `apps/editor/src/ui/app-shell/task-shell.test.ts`
  - `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
  - `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
  - `apps/editor/src/editor-state/explicit-psd-import-task-observation.ts`

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave52-plan.md`
- `discussion/implementation/waves/wave52/wave52-domain-a-boundary-component-contract-inventory-report.md`
- `discussion/implementation/reviews/wave52/wave52-domain-a-boundary-component-contract-inventory-review.md`
- `discussion/implementation/waves/wave52/wave52-domain-b-generic-task-shell-task-chrome-component-report.md`
- `discussion/implementation/reviews/wave52/wave52-domain-b-generic-task-shell-task-chrome-component-review.md`
- `discussion/implementation/waves/wave52/wave52-domain-c-psd-import-task-human-ui-component-report.md`
- `discussion/implementation/reviews/wave52/wave52-domain-c-psd-import-task-human-ui-component-review.md`
- `discussion/implementation/waves/wave51/wave51-final-integration-report.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Findings

No blocking findings.

- Domain D objective is met. The app shell no longer appends the legacy PSD Import panel by default; it creates a minimal `Import PSD` launcher and only mounts the task shell when `activeTask === "psdImport"` (`apps/editor/src/ui/app-shell/app-shell.ts:346`, `apps/editor/src/ui/app-shell/app-shell.ts:521`, `apps/editor/src/ui/app-shell/app-shell.ts:559`). This matches the Wave52 D requirement to move PSD Import out of the always-visible workspace panel while preserving a clear Authoring Workspace entry (`discussion/implementation/orchestration/wave52-plan.md:260`).
- Task Shell integration is appropriately narrow. Domain D calls Domain B `createTaskShell(...)` with the PSD task surface, concise status, back/close affordances, diagnostics summary, and content slot (`apps/editor/src/ui/app-shell/app-shell.ts:585`). It does not introduce a broader modal/window framework or unrelated workspace redesign. The consumed shell remains generic and slot-based (`apps/editor/src/ui/app-shell/task-shell.ts:34`, `apps/editor/src/ui/app-shell/task-shell.ts:75`).
- PSD Import content integration preserves the Domain C component boundary. Domain D hosts `createExplicitPsdImportTaskContent(...)` inside a small wrapper that keeps the existing stable `explicitPsdImport.panel` hook inside the opened task (`apps/editor/src/ui/app-shell/app-shell.ts:611`, `apps/editor/src/ui/app-shell/app-shell.ts:618`). Domain C's task-content factory still carries the same form and callback surface (`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:83`, `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:95`).
- Observation bridge consumption is narrow. Domain D reads `projectExplicitPsdImportTaskObservation(...)` only to provide Task Shell status, a small diagnostics summary, and structured `data-*` attributes (`apps/editor/src/ui/app-shell/app-shell.ts:586`, `apps/editor/src/ui/app-shell/app-shell.ts:592`, `apps/editor/src/ui/app-shell/app-shell.ts:622`). It does not change editor state schemas or workflow data contracts. Adding `editorTestIds.psdImportTaskOpen` is acceptable as a narrow test-facing task entry hook, because it extends the existing test-id registry only and does not add editor semantic state (`apps/editor/src/editor-state/editor-test-ids.ts:45`, `apps/editor/e2e/test-ids.mjs:45`).
- Existing workflow callbacks remain intact. `mountEditorApp` stores only local UI routing state for `activeTask` and routes open/close through re-rendering (`apps/editor/src/app/editor-app.ts:19`, `apps/editor/src/app/editor-app.ts:37`). PSD parse, import-plan, batch intake, and structural scaffold callbacks still forward to the same workflow controller methods (`apps/editor/src/app/editor-app.ts:207`, `apps/editor/src/app/editor-app.ts:231`). Closing/back only hides the task shell and does not clear parsed/import state.
- Focused e2e changes preserve existing assertions. The changed PSD e2e files open the task before waiting for the existing PSD hooks, and reopen after page reload/load where needed (`apps/editor/e2e/psd-import-focused-smoke.mjs:56`, `apps/editor/e2e/psd-import-focused-smoke.mjs:102`, `apps/editor/e2e/psd-import-focused-smoke.mjs:868`). Static search confirmed the same pattern across the five edited PSD focused smoke files.
- Test-id boundary is preserved. Production code assigns `data-testid` hooks but does not query or branch on them. `document.querySelector([data-testid=...])` usage is confined to tests/e2e helpers. `node scripts/check-production-testid-boundary.mjs` also passed.
- Source organization is acceptable. No broad catch-all file or implementation-heavy `index.ts` was introduced. The relevant barrels remain re-export-only where present, and `node scripts/check-source-organization.mjs` passed.
- Non-goals remain respected. The reviewed Domain D diff does not add new Mesh, Atlas, Parameter, Variant, semantic recognition, auto-rigging, external transport, renderer/pixel oracle, Cubism, public demo asset, or raw PSD/parser persistence capability. Existing mentions in focused e2e are prior regression assertions and non-goal guards, not new capability.

## Verification Assessed / Run

- Run: `git diff --check -- apps/editor/src/app apps/editor/src/ui/app-shell apps/editor/src/ui/explicit-psd-import apps/editor/e2e apps/editor/src/editor-state/editor-test-ids.ts`
  - Passed with LF/CRLF warnings only.
- Run: `node scripts/check-production-testid-boundary.mjs`
  - Passed.
- Run: `node scripts/check-source-organization.mjs`
  - Passed.
- Run: `pnpm.cmd typecheck`
  - Passed.
- Run: `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/ui/app-shell/task-shell.test.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
  - Sandbox attempt failed with esbuild `spawn EPERM`.
  - Escalated rerun passed: 3 files, 49 tests.
- Run: `node scripts/run-focused-e2e.mjs --id psdImportFocused`
  - Sandbox attempt failed with Vite/esbuild `spawn EPERM`.
  - Escalated rerun passed: desktop focused smoke, `materializedBytes=460800`, `drawable=draw_headwear`, `texture=tex_headwear`.

The reported verification is adequate for Domain D. Full focused PSD suite coverage across `psdImportPlanFocused`, `psdImportPlanCodexFocused`, `psdStructuralInitialStateFocused`, and `psdMultiLayerBatchFocused` should remain Domain E's broader regression gate.

## Residual Risks / Deferred Debt

- The task launcher is a minimal `Tasks` section, not the final toolbox placement. This is acceptable under Wave52 D because final toolbox placement and modal/task-window/dedicated-view policy are explicitly future user-decision points.
- The Task Shell status and diagnostics summary still expose the existing structured surface name `diagnosticsEvidenceView`. This comes from the Wave51 projector contract and is consumed narrowly, but later UX polish should replace internal surface identifiers with final human-facing navigation once Diagnostics / Evidence View placement is decided.
- Full visual styling, final task presentation, and complete PSD focused regression suite execution are deferred to Domain E or later UI work.

## User-Decision Points

- No immediate user decision is required for Domain D.
- Future decisions remain: final toolbox placement, final modal/task-window/dedicated-view policy, and final Diagnostics / Evidence View / Codex Automation View placement.
