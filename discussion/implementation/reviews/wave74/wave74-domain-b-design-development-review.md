# Wave74 Domain B Design / Development Compliance Review

- Verdict: `pass`
- Date: 2026-06-15
- Reviewer: Review-Sylph
- Review lane: Design / Development Compliance Review
- Target: Wave74 Domain B, `wave74-save-load-keyform-visibility-hardening`

## Scope Reviewed

Reviewed the Domain B implementation report, Wave74/Wave73/Wave72 basis documents, current source/test diffs, and the combined worktree. Domain B findings are scoped to:

- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
- `apps/editor/src/workspace/panels/parameter-binding-section.test.ts`
- `discussion/implementation/waves/wave74/wave74-domain-b-save-load-keyform-visibility-hardening-report.md`

The current worktree also contains parallel Domain A changes in editor model tests, canvas/runtime/package tests, and implementation maps. I reviewed those only for obvious conflicts with Domain B boundaries; no Domain B-blocking conflict was found.

## Basis Used

- `discussion/implementation/orchestration/wave74-plan.md`
- `discussion/implementation/orchestration/wave73-plan.md`
- `discussion/implementation/waves/wave73/wave73-final-integration-report.md`
- `discussion/implementation/reviews/wave73/wave73-final-clean-integration-review.md`
- `discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md`
- `discussion/implementation/waves/wave73/wave73-domain-b-rotation2d-translation-exposure-report.md`
- `discussion/implementation/waves/wave72/wave72-final-integration-report.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/screen-design/components/parameter-keyform.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/design/screen-design/screens/project-storage-task.md`

## Verification Run By This Review

- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- apps/editor/e2e/portable-project-save-load.e2e.spec.ts apps/editor/src/features/editor-session/model/rig-tool-state.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/deformer-tree-view.tsx apps/editor/src/workspace/panels/parameter-binding-section.tsx apps/editor/src/workspace/panels/parameter-binding-section.test.ts discussion/implementation/waves/wave74/wave74-domain-b-save-load-keyform-visibility-hardening-report.md`: passed with CRLF normalization warnings only.

I did not rerun the broad Playwright path or focused Vitest/typecheck suites in this review lane; the implementation report records those validation results, and test adequacy is covered by the separate review lane.

## Findings

### Blocking

None.

### Needs Changes

None.

### Compliance Evidence

- Source organization and module boundaries are acceptable. Keyform count derivation lives in the existing rig-tool view-model/read-model layer at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:610`, is projected onto deformer rows at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:625`, and is consumed by the Deformer Tree UI at `apps/editor/src/workspace/panels/deformer-tree-view.tsx:178`.
- The keyform discovery affordance is user-visible, not hidden test-only text. The Deformer Tree row renders a visible `Keyed {count}` badge with deterministic count attributes at `apps/editor/src/workspace/panels/deformer-tree-view.tsx:221` and `apps/editor/src/workspace/panels/deformer-tree-view.tsx:230`.
- The test-facing selectors are stable enough for this scope. Domain B uses row kind/id attributes and explicit keyform count attributes at `apps/editor/src/workspace/panels/deformer-tree-view.tsx:180`, plus visible badge assertions in `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:325`.
- Keyform creation remains behind the existing editor command / operation path. The Parameter Binding UI calls `createEditKeyformPayload` and `editKeyformKey` at `apps/editor/src/workspace/panels/parameter-binding-section.tsx:70`, the context commits through `commitEditKeyformKey` at `apps/editor/src/features/editor-session/editor-session-context.tsx:685`, and the command emits the existing `editKeyformKey` operation at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:379`.
- The Parameter Binding `Add` affordance is a narrow extension of the existing Add/Update/Delete keyform model from the Parameter Keyform design. It appears only when the current value does not already have a keyform and uses the same binding card action pattern at `apps/editor/src/workspace/panels/parameter-binding-section.tsx:121`.
- Forbidden persistence boundaries are preserved. The e2e explicitly sets a non-default parameter value before save, then after load asserts no selected tree row, Project inspector state, active parameter reset behavior, parameter numeric value `0`, and no target keyform state at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:147`.
- Domain B does not introduce package format, dependency, browser slot, archive/filesystem, or storage transport changes. `git diff -- package.json apps/editor/package.json pnpm-lock.yaml packages/package-format` was empty, and the dependency guard passed.
- The Project Storage design boundary is preserved. The implementation hardens the existing portable save/load flow and e2e proof; it does not add raw package file-set UI, browser-local slots, filesystem APIs, or a new save format.
- The Canvas Preview boundary is preserved. The e2e asserts existing Canvas evaluated data attributes for proof after reselection at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:238`, while production UI changes do not expose raw runtime payloads in the Canvas.
- The Domain B report accurately lists the Domain B-owned changed files and explicitly notes parallel Domain A changes. Current additional diffs in runtime/package/canvas tests match the Domain A report rather than Domain B ownership.

## Residual Risks / Non-Blockers

- The visible badge is intentionally compact and reports total key count, with set count in title/data attributes. This is acceptable for the Wave74 discovery affordance, but richer keyform browsing remains future Parameter Manager/timeline work.
- The broad portable save/load e2e remains sensitive to unrelated PSD import, tree, Canvas, and storage regressions. That is not a design/development blocker for Domain B because the UI affordance and operation boundaries are narrow and source-level guards pass.
- Domain A and Domain B both touch `rig-tool-state.ts` and its tests. The combined source is coherent in this review, but final integration should still review the merged editor model file as one unit.

## User-Decision Points

None.
