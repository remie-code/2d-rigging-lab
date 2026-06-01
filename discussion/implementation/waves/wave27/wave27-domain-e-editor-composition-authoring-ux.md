# Wave 27 Domain E: Editor Composition Authoring UX

## Verdict

pass

## Summary

Domain E added a minimum Editor Composition / Mask / Opacity workflow without broad app redesign.

- The Editor now exposes a focused Composition / Mask / Opacity panel for selecting mask drawable(s), target drawable(s), enabled state, and committing `setMaskRelation`.
- The same panel supports minimal drawable opacity authoring through the existing opacity keyform path, without adding a general timeline editor.
- Invalid mask relation input is rejected in the panel with deterministic user-visible messages before commit.
- Preview-side evidence is exposed through Editor semantic state and existing opacity projection; Viewer / Runtime shows semantic mask relation and opacity evidence from runtime snapshot evaluation.
- Focused workflow tests cover mask relation and opacity authoring through save/load and Viewer reinspection. Browser desktop/mobile e2e remains intentionally left for Domain F.

## Subagents And Separation Evidence

- Implementation was delegated to Gnome (`019e81d9-eea1-7623-bca2-f3a0d330a058`, Gnome the 94th).
- Review was delegated to a separate clean-context Review-Sylph (`019e81f8-db0c-79f0-9b7b-197c2651eb4b`, Sylph the 95th).
- Orch-Sylph did not implement source directly. Orch-Sylph coordinated scope, verification, review, and this report only.
- During implementation, Orch-Sylph detected temporary out-of-scope edits in `apps/editor/src/editor-preview/**` and `apps/editor/src/styles/editor.css`. Gnome removed only its own out-of-scope hunks without `git reset` / `git checkout`; final Domain E source changes stayed within approved scope.

## Files Changed

Domain E source changes:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-session/composition-command.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-state/composition-authoring-state.ts`
- `apps/editor/src/editor-state/composition-authoring-view-model.ts`
- `apps/editor/src/editor-state/drawable-list-state.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-workflow/composition-workflow.ts`
- `apps/editor/src/editor-workflow/composition-workflow.test.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/viewer-runtime-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/composition-panel/composition-panel.ts`
- `apps/editor/src/ui/composition-panel/composition-panel.test.ts`
- `apps/editor/src/ui/composition-panel/index.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts`

Reports:

- `discussion/implementation/waves/wave27/wave27-domain-e-editor-composition-authoring-ux.md`
- `discussion/implementation/reviews/wave27/wave27-domain-e-editor-composition-authoring-ux-review.md`

## Callback Bridge

`apps/editor/src/app/editor-app.ts` was changed only to add narrow app-level callbacks:

- `onCommitSetMaskRelation(command) { workflow.commitSetMaskRelation(command); render(); }`
- `onCommitAddDrawableOpacityKeyform(command) { workflow.commitAddDrawableOpacityKeyform(command); render(); }`

No broad `apps/editor/src/app/**` rewiring or app shell redesign was introduced.

## Verification

Gnome verification:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/composition-workflow.test.ts apps/editor/src/ui/composition-panel/composition-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts`
  - pass: 5 files / 41 tests
- `pnpm.cmd typecheck`
  - pass

Review-Sylph re-run verification:

- same focused `vitest run ...`
  - pass: 5 files / 41 tests
- `pnpm.cmd typecheck`
  - pass
- `pnpm.cmd run check:source`
  - pass
- `pnpm.cmd run check:deps`
  - pass
- `git diff --check -- <Domain E target files>`
  - pass; Git printed LF-to-CRLF working-copy warnings only

Review-Sylph noted that `pnpm.cmd test:repo` is not a valid script in this checkout, so `check:source` was used for source organization compliance.

## Review Result

Clean Review-Sylph verdict: pass.

Review lanes all passed:

- Composition Semantics
- Operation Integrity
- Runtime Evidence / Viewer / Preview Evidence
- UI / Accessibility
- Persistence readiness
- Development Compliance
- Test Adequacy
- Non-goals containment
- Orchestration Compliance

No blocking or non-blocking source fixes were requested.

## Remaining Issues

- Browser desktop/mobile e2e persistence is not closed by Domain E and remains Domain F scope.
- Shared worktree still contains upstream Wave 27 package/runtime/validator/fixture changes from Domains A-D; Domain E treated those as upstream inputs and did not modify them.

## User-Decision Points

None.

## Review Report

- `discussion/implementation/reviews/wave27/wave27-domain-e-editor-composition-authoring-ux-review.md`
