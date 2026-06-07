# Wave51 Domain C Task / View Shell Foundation Review

- verdict: `pass`
- role: clean Review-Sylph
- scope: source review only, except this review artifact

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave51-plan.md`
- `discussion/implementation/waves/wave51/wave51-domain-a-boundary-coupling-target-inventory-report.md`
- `discussion/implementation/reviews/wave51/wave51-domain-a-boundary-coupling-target-inventory-review.md`
- `discussion/implementation/waves/wave51/wave51-domain-b-psd-import-production-coupling-removal-report.md`
- `discussion/implementation/reviews/wave51/wave51-domain-b-psd-import-production-coupling-removal-review.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Files Reviewed

- `apps/editor/src/ui/app-shell/shell-surfaces.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`

Reviewed the requested authoritative diff:

- `git diff -- apps/editor/src/ui/app-shell/shell-surfaces.ts apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/ui/app-shell/app-shell.test.ts`

Note: `shell-surfaces.ts` is currently untracked, so it did not appear in plain `git diff`; it was reviewed by direct file read and `git status --short -uall`.

## Findings Ordered By Severity

none

## Review Checks / Evidence

1. Domain C objective is met.
   - `shell-surfaces.ts:1` defines `ShellSurfaceKind` as `authoring-workspace`, `task`, and `view`.
   - `shell-surfaces.ts:13` registers explicit surface definitions, including `authoringWorkspace`, `psdImportTask`, `diagnosticsEvidenceView`, and `codexAutomationView`.
   - `app-shell.ts:228`, `:359`, `:508`, and `:485` apply those concepts to the legacy authoring workspace, PSD Import Task, Diagnostics / Evidence View, and Codex / Automation View.

2. The implementation remains enabling infrastructure, not a visual redesign.
   - The app shell keeps the same panel creation and `workspace.append(...)` structure at `app-shell.ts:522`.
   - The diff adds metadata classification only; it does not add CSS, layout rules, modal/window framework code, a toolbox implementation, or a new UI dependency.

3. Current workflows remain reachable.
   - Existing panels are still created and appended: preview, layer tree, drawable authoring, source intake, PSD import, project persistence, product preflight, Codex proposal review, AI approval, AI transcript, and operation persistence evidence remain mounted in `app-shell.ts:522-540`.
   - Viewer / Runtime remains conditionally mounted when open and is now classified as `viewerRuntimeView` at `app-shell.ts:422-436`.
   - The new test at `app-shell.test.ts:657` checks the expected shell-surface classification without moving workflows; existing tests in the same file continue to cover preview, layer tree, drawable authoring, PSD import-adjacent controls, project storage, product preflight, tutorial, viewer/runtime, and Codex/AI panel reachability.

4. Future migrations can target named shell surfaces.
   - Surface IDs and groups make current legacy placements explicit, such as `legacy-host`, `canvas-preview`, `parts-tree`, `psd-import`, `project-persistence`, `product-preflight`, `viewer-runtime`, `proposal-review`, `ai-approval`, `ai-transcript`, and `operation-persistence-evidence`.
   - This matches the Domain A minimum target: classify the current one-page host without deciding modal vs task window vs side panel vs dedicated view.

5. Forbidden feature work was not introduced.
   - The changed shell foundation does not implement Mesh / Atlas / Parameter / Variant features, semantic recognition, proposal generation, auto-classification, auto-fix, external transport, Cubism, renderer/pixel oracle, or public demo assets.
   - A forbidden-scope text scan over the review target found only pre-existing references in existing app-shell imports/tests or labels, not new capability code in `shell-surfaces.ts`.

6. `data-testid` remains test-facing only, and shell metadata is not used for production behavior.
   - Static scan over `shell-surfaces.ts` and `app-shell.ts` found no `querySelector` or `[data-testid=...]` behavior dependency.
   - Production target matches for `dataset.testid` are existing observation assignments at `app-shell.ts:205` and `app-shell.ts:554`.
   - `dataset.shellSurface*` is written by `applyShellSurfaceMetadata` at `shell-surfaces.ts:68-73`, but no production branch or lookup depends on it in the reviewed source.

7. Source organization is acceptable.
   - `shell-surfaces.ts` has a single responsibility: shell surface definitions and metadata application.
   - No `index.ts` was changed, and no catch-all file was introduced.

8. Tests are focused and meaningful.
   - `app-shell.test.ts:630` checks the registry contains the screen-design shell surfaces.
   - `app-shell.test.ts:657` checks classification and reachability for representative existing panels and the Diagnostics / Evidence summary group.
   - The tests avoid broad layout assertions and verify the new shell metadata contract directly.

9. Orchestration compliance is satisfied for this review.
   - The assignment states implementation was delegated to Gnome.
   - This review was performed in a separate clean Review-Sylph context.
   - I did not edit production source.

## Verification Checked / Performed

Checked Orch-Sylph evidence:

- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts`
  - sandbox run failed with `spawn EPERM`
  - approved rerun passed: 1 file, 26 tests
- `pnpm.cmd typecheck`: passed
- `node scripts/check-source-organization.mjs`: passed
- `git diff --check -- apps/editor/src/ui/app-shell apps/editor/src/app apps/editor/src/editor-state`: passed with only LF/CRLF warnings

Performed in this clean review:

- Reviewed `git diff -- apps/editor/src/ui/app-shell/shell-surfaces.ts apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/ui/app-shell/app-shell.test.ts`.
- Read `shell-surfaces.ts` directly because it is untracked and not shown by plain `git diff`.
- Ran `git diff --check -- apps/editor/src/ui/app-shell/shell-surfaces.ts apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/ui/app-shell/app-shell.test.ts`; passed with only LF/CRLF warnings.
- Ran static scans for shell metadata, `data-testid` behavior dependency patterns, and forbidden-scope keywords over the review target.

## Residual Risks / Deferred Debt

- `apps/editor/src/ui/app-shell/shell-surfaces.ts` is untracked as of this review. Final integration should ensure it is included; otherwise `app-shell.ts` imports a file that would be missing from version control.
- This foundation intentionally leaves final UI decisions deferred: toolbox placement, modal vs task window vs dedicated view, final Diagnostics / Evidence presentation, and final Codex / Automation placement.
- This review did not rerun Vitest or typecheck; it checked the passing Orch-Sylph evidence and performed focused static checks.
- Broad DOM/test oracle migration is still deferred to later Wave51 domains.

## User-Decision Points

None for Domain C.
