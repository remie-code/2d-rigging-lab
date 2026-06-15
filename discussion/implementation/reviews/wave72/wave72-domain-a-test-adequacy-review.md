# Wave72 Domain A Test Adequacy Review

## Verdict

`pass`

Fix loop 2 resolves the only remaining blocker from the previous review. Selection preservation is now covered through a real `EditorSessionProvider` context test that selects a Rotation Deformer, edits pivot/rest and angle keyform state through provider APIs, and asserts live `context.selection` across commit, undo, and redo.

The absent full Playwright Rotation edit workflow remains a residual browser-integration risk, but the Domain A v0 replacement evidence is adequate: operation/authoring tests, model/history tests, projection/hit-test tests, hook-level pointer lifecycle tests, inspector tests, and a focused passing Vitest run.

## Scope Reviewed

This re-review was limited to the previous blocker and potential regressions from fix loop 2.

Files inspected:

- `discussion/implementation/waves/wave72/wave72-domain-a-rotation-deformer-edit-ux-report.md`
- `discussion/implementation/reviews/wave72/wave72-domain-a-test-adequacy-review.md`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`

Focused validation also covered:

- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`
- `packages/authoring-core/src/rig-control-mutations.test.ts`

## Re-Review Findings

### Selection Preservation

The previous blocker is fixed.

Evidence:

- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:159` adds `preserves selected Rotation Deformer through context edits, undo, and redo`.
- The test renders `EditorSessionProvider` with a Rotation Deformer fixture, selects the rig control through `context.selectRigControl`, commits pivot/rest through `context.updateRigControl`, commits angle keyform through `context.editKeyformKey`, and checks live `context.selection` after each commit, undo, and redo.
- The prior vacuous local-selection assertion was removed from `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`; the model test now only claims redo/history coverage.
- `apps/editor/src/features/editor-session/editor-session-context.tsx:317` adds narrow provider testability props (`initialSession`, `initialSelection`). The test uses `initialSession`; no production behavior regression is apparent from this change.

Classification: `covered`.

### Regression Check

No new Domain A test adequacy regression found.

- The provider test exercises the real stateful context path, not a local constant.
- Undo/redo continue to preserve selection because provider undo/redo update session/history without clearing `selection`.
- `updateRigControl` still re-selects the edited rig control after successful commits.
- Angle keyform edits preserve the existing selection through the provider path.
- The focused Vitest run passed.

## Playwright Decision

Full Playwright Rotation editing is still absent. This is acceptable for Domain A test adequacy after fix loops 1 and 2 because the replacement evidence now covers the behaviors the browser path was intended to prove at narrower, deterministic boundaries:

- structured operation/authoring behavior;
- editor command/history undo/redo;
- provider/context selection preservation;
- canvas projection/evaluation;
- rotation handle hit-testing and angle math;
- `useRotationDeformerInteraction` pointer preview, pointer-up commit, cancel/no-commit, and parented lock behavior;
- inspector pivot/rest controls and messaging.

Carry the missing full browser workflow as residual final-integration/e2e risk, not as a Domain A blocker.

## Commands Run

Sandboxed command:

```powershell
pnpm.cmd exec vitest run apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/authoring-core/src/rig-control-mutations.test.ts
```

Result: failed before test discovery with Vitest config load `spawn EPERM` from esbuild, matching prior sandbox behavior.

Escalated rerun of the same command:

```text
7 test files passed, 74 tests passed.
```

Passed files:

- `packages/authoring-core/src/rig-control-mutations.test.ts` - 11 tests
- `packages/operation-core/src/operations/rig-control.test.ts` - 17 tests
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts` - 13 tests
- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts` - 7 tests
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts` - 2 tests
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts` - 9 tests
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts` - 15 tests

## Remaining Domain A Test Gaps

None blocking.

Residual risk:

- No full Playwright/browser drag workflow for Rotation editing. Accepted as replaced for Domain A v0; should be reconsidered during final integration/e2e hardening.
- Editor package typecheck reportedly still has non-Domain-A/shared failures. I did not independently rerun that package typecheck in this review; focused Domain A Vitest passed.

## User-Decision Points

None.
