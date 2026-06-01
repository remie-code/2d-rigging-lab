# Wave28 Domain F Orch-Sylph Final Report: Editor Part / Texture / Layer Workflow UX

## Verdict

pass

## Target

- Domain: `wave28-editor-part-texture-layer-workflow-ux`
- Caller: Undine
- Orchestrator: Orch-Sylph
- Date: 2026-06-01

## Subagent Separation And Wait Evidence

- Orch-Sylph did not implement source changes.
- Source implementation was delegated to Gnome in a separate context without full-history fork.
  - Agent id: `019e82fb-d60a-7c92-b475-31858696c123`
  - Initial result: `done`
  - Fix-loop result: `done`
  - Report: `discussion/implementation/waves/wave28/domain-f-editor-part-texture-layer-workflow-ux-gnome-report.md`
- Independent review was delegated to Review-Sylph in a separate context without full-history fork.
  - Agent id: `019e8313-f55a-7621-8e10-8b1c5382b349`
  - Initial result: `needs_changes`
  - Re-review result: `pass`
  - Report: `discussion/implementation/reviews/wave28/domain-f-editor-part-texture-layer-workflow-ux-review.md`
- Orch-Sylph waited for Gnome completion, waited for Review-Sylph completion, delegated the review findings back to Gnome, then waited for Review-Sylph re-review before issuing this report.
- Review-Sylph received explicit basis documents, upstream A-E reports, changed files, verification expectations, and review lanes. Review-Sylph was not given full conversation history.

## Files Changed By Domain F

Editor session / workflow:

- `apps/editor/src/editor-session/part-texture-layer-command.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/part-texture-layer-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- `apps/editor/src/editor-workflow/dynamics-preview-workflow.ts`
- `apps/editor/src/editor-workflow/viewer-runtime-workflow.ts`
- `apps/editor/src/editor-workflow/preview-texture-application.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`

Editor state / UI:

- `apps/editor/src/editor-state/layer-tree-draft-state.ts`
- `apps/editor/src/editor-state/part-texture-workflow-view-model.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/ui/layer-tree/layer-tree-panel.ts`
- `apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/preview-panel/preview-summary.ts`
- `apps/editor/src/ui/preview-panel/preview-visual.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts`
- `apps/editor/src/app/editor-app.ts`

Reports:

- `discussion/implementation/waves/wave28/domain-f-editor-part-texture-layer-workflow-ux-gnome-report.md`
- `discussion/implementation/reviews/wave28/domain-f-editor-part-texture-layer-workflow-ux-review.md`
- `discussion/implementation/reviews/wave28/domain-f-orch-sylph-final-report.md`

## Implementation Summary

- Added Editor request builders and session adapter commit paths for `createPart`, `updatePart`, `setDrawablePart`, and `setDrawableTexture`, reusing Domain A operations.
- Added workflow integration for part creation/update, drawable part assignment, drawable texture assignment, layer selection, lock, and editor-only hide.
- Added save/load persistence for `model/editor-state.json` selection, `lockedIds`, and `editorHiddenIds` through the existing package file-set persistence path.
- Mounted and extended the focused layer-tree panel for minimum part/texture/layer controls.
- Projected part hierarchy, layer state, texture-backed/unresolved state, and editor-only evidence into Preview / Viewer UI surfaces using existing Domain B evidence.
- Kept editor-only hide separate from drawable runtime visibility.
- Extracted Domain F workflow logic into `apps/editor/src/editor-workflow/part-texture-layer-workflow.ts`, keeping `workflow-controller.ts` as wiring/orchestration.

## Review Findings And Fixes

Initial Review-Sylph verdict: `needs_changes`.

Blocking finding 1:

- Locked layers only guarded new part/texture operations, while existing runtime visibility and draw-order authoring edits bypassed the lock.
- Fix: Gnome added workflow-level locked layer guards for `setDrawableRuntimeVisibility`, `toggleDrawableRuntimeVisibility`, and `moveDrawableLayer`. Locked edits now return no-op `locked` results without committing authoring operations or mutating runtime visibility/draw order.
- Re-review: resolved.

Blocking finding 2:

- Domain F workflow logic had been added directly to already oversized `workflow-controller.ts`.
- Fix: Gnome extracted cohesive Domain F workflow logic into `part-texture-layer-workflow.ts`. `workflow-controller.ts` line count was reduced from 1110 to 963; the extracted file is 447 lines and owns the Domain F responsibility.
- Re-review: resolved.

Final Review-Sylph verdict: `pass`; no current blocking, medium, or low-severity findings.

## Verification

Gnome reported:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
  - Passed: 1 file / 2 tests.
- Adjacent regression set:
  - Passed: 7 files / 75 tests.
- `pnpm.cmd exec vitest run apps/editor/src`
  - Passed: 31 files / 174 tests.
- `pnpm.cmd typecheck`
  - Passed.
- Domain F `git diff --check`
  - Passed with LF/CRLF working-copy warnings only.

Review-Sylph reran:

- Focused Domain F test:
  - Passed: 1 file / 2 tests.
- Adjacent regression set:
  - Passed: 7 files / 75 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `pnpm.cmd exec vitest run apps/editor/src`
  - Passed: 31 files / 174 tests.
- Domain F `git diff --check`
  - Passed with LF/CRLF working-copy warnings only.
- Supplemental trailing whitespace scan for new untracked Domain F files:
  - Passed.

Orch-Sylph reran:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts`
  - Passed: 6 files / 35 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/editor-workflow apps/editor/src/editor-session apps/editor/src/app/editor-app.ts apps/editor/src/ui discussion/implementation/waves/wave28/domain-f-editor-part-texture-layer-workflow-ux-gnome-report.md discussion/implementation/reviews/wave28/domain-f-editor-part-texture-layer-workflow-ux-review.md`
  - Passed with LF/CRLF working-copy warnings only.
- Line counts:
  - `apps/editor/src/editor-workflow/workflow-controller.ts`: 963 lines.
  - `apps/editor/src/editor-workflow/part-texture-layer-workflow.ts`: 447 lines.

## Remaining Issues

- Domain F remains a minimum form-based workflow, not a full drag-and-drop tree editor. This matches Wave28 non-goals.
- Texture preview remains semantic/package-local evidence. No image decode, file picker, asset I/O, pixel oracle, or renderer rewrite was added.
- Browser/e2e persistence smoke was not run in Domain F. Domain G owns desktop/mobile browser persistence smoke after this pass.
- The worktree also contains Wave28 A-E upstream files; Domain F did not revert or review those as new Domain F implementation except where the editor integration depends on them.

## User Decision Points

None.

## Report Paths

- Gnome report: `discussion/implementation/waves/wave28/domain-f-editor-part-texture-layer-workflow-ux-gnome-report.md`
- Review-Sylph report: `discussion/implementation/reviews/wave28/domain-f-editor-part-texture-layer-workflow-ux-review.md`
- Orch-Sylph final report: `discussion/implementation/reviews/wave28/domain-f-orch-sylph-final-report.md`
