# Wave25 Domain E Review: Editor Rig Control Panel And Viewer Workflow

> Target: `wave25-editor-rig-control-panel-viewer-workflow`  
> Date: 2026-06-01  
> Role: Review-Sylph independent review  
> Verdict: `pass`

## Findings

No blocking, high, medium, low, or needs-fix findings.

## Scope Reviewed

This review inspected the required basis documents, Gnome report, actual `git status`, changed/untracked Domain E source and tests, focused test coverage, and verification commands. Gnome's implementation report was used as a claim source only; the review did not rely on it as sole evidence.

This review did not edit implementation source or tests. The only write is this artifact.

Domain E basis from `discussion/implementation/orchestration/wave25-plan.md:278` requires a minimal editor Rig Control panel/workflow where users can create `rotation2d`, bind drawable or child rig control where available, inspect Preview / Viewer / Runtime evidence, and keep UI wording project-defined rather than Cubism-compatible. The write scope and forbidden scope are defined at `discussion/implementation/orchestration/wave25-plan.md:286` and `discussion/implementation/orchestration/wave25-plan.md:296`.

## Design / Development Compliance

Result: `pass`.

- Actual status showed Domain E changes under the allowed editor state/workflow/session/UI/test/report paths. I found no package manifest or lockfile status output for root, workspace, editor, authoring/operation/runtime/validator package manifests.
- The UI copy uses "Project-defined Rig Controls" and `rotation2d`; I found no Cubism compatibility claim in the Domain E changed files. The targeted forbidden-scope scan produced only benign existing/test/report references.
- The panel has create and bind forms with accessible labels and deterministic local self-bind blocking: `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:62`, `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:128`, `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:428`.
- The workflow delegates to operation/session commands instead of reimplementing rig semantics: `apps/editor/src/editor-session/rig-control-command.ts:31`, `apps/editor/src/editor-session/rig-control-command.ts:58`, `apps/editor/src/editor-workflow/rig-control-workflow.ts:26`, `apps/editor/src/editor-workflow/rig-control-workflow.ts:45`.
- Save/load and commit projection read rig controls from package documents and committed operation results: `apps/editor/src/editor-workflow/workflow-state-projection.ts:28`, `apps/editor/src/editor-workflow/workflow-state-projection.ts:72`, `apps/editor/src/editor-workflow/workflow-state-projection.ts:108`.
- Viewer / Runtime projection and UI expose rig-control count, evaluation status, hierarchy order, transform labels, and affected target labels: `apps/editor/src/editor-workflow/viewer-runtime-workflow.ts:168`, `apps/editor/src/editor-workflow/viewer-runtime-workflow.ts:180`, `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts:55`, `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts:185`.
- App shell integration is narrow panel/callback wiring, not a broad redesign: `apps/editor/src/ui/app-shell/app-shell.ts:170`, `apps/editor/src/ui/app-shell/app-shell.ts:237`.
- Public `index.ts` files remain barrel-only exports, including the new `apps/editor/src/ui/rig-control-panel/index.ts`.

## Test Adequacy

Result: `pass`.

- Workflow tests cover create, bind, operation log, save/load restore, Viewer projection evidence, and rejected bind diagnostics without state mutation: `apps/editor/src/editor-workflow/workflow-controller.test.ts:837`, `apps/editor/src/editor-workflow/workflow-controller.test.ts:908`.
- Panel tests cover create-form submission, child rig-control binding, and self-binding user-visible diagnostic: `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:34`, `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:69`, `apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts:108`.
- View-model tests cover project-defined rig control options and unbound drawable child option projection: `apps/editor/src/editor-state/editor-view-model.test.ts:507`.
- App shell tests cover rendering the rig-control panel with Preview and Viewer runtime evidence: `apps/editor/src/ui/app-shell/app-shell.test.ts:180`.
- Existing Viewer / Runtime workflow tests still cover recomputation after browser-local save/load: `apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts:41`.

The test set is adequate for Domain E's editor-slice risk. Full browser e2e does not submit the new rig-control forms; that remains a residual risk, but the unit/workflow tests exercise the actual commit and projection paths, while e2e confirms desktop/mobile shell smoke remains healthy.

## Verification Performed

Initial non-escalated PowerShell reads failed with `windows sandbox: spawn setup refresh`; required reads and commands were rerun with escalation per tool policy.

| Check | Result |
|---|---|
| `git status --short -uall apps/editor discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | reviewed; expected Domain E files plus shared Wave25 A-D artifacts present |
| Gnome report and required basis documents | reviewed |
| Focused test command from Gnome | pass; 7 files / 68 tests |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `pnpm.cmd test:e2e` | pass; desktop and mobile smoke passed |
| `git diff --check -- apps/editor discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | pass; LF/CRLF warnings only |
| Trailing-whitespace scan over new untracked Domain E files | pass; no matches |
| Manifest/lockfile dirty-status check | pass; no output |
| Targeted forbidden-scope scan over Domain E changed files | pass; only benign report/test references |
| Public `index.ts` barrel read | pass |

## Residual Risks

- Browser e2e currently proves the editor desktop/mobile smoke, but does not fill and submit the new Rig Control forms. Domain F should add the requested browser save/load rig-control workflow smoke.
- Preview-side evidence in the Rig Control panel is a semantic affected-target summary from authored state plus preview snapshot identity, not a new dedicated preview DTO field or pixel/render oracle.
- Mobile layout and accessible labels were checked through existing e2e smoke plus DOM/unit assertions, not a dedicated axe/a11y run for the new panel.
- Verification ran in a shared dirty Wave25 workspace, not a fresh checkout replay.
- At Domain E review time, Domain C completion-report wording remained stale relative to its pass review artifact. Domain G report integration has since updated `discussion/implementation/waves/wave25/domain-c-completion-report.md` to `pass`.

## User Decision Points

None.

## Required Gnome Fix

None.
