# Wave77 Domain A Test Adequacy Review

- Target: `wave77-deformer-tree-selection-pool-tree-row-cleanup`
- Review lane: Test Adequacy Review
- Reviewer: Review-Sylph
- Date: 2026-06-16
- Verdict: `pass`

## Basis Checked

- `discussion/implementation/orchestration/wave77-plan.md`, especially sections 7.1, 7.2, 9, and 13.
- `discussion/implementation/orchestration/wave76-plan.md` for the prior Wave76 selection and E2E baseline.
- `discussion/implementation/waves/wave76/wave76-final-integration-report.md`.
- `discussion/implementation/reviews/wave76/wave76-final-clean-integration-review.md`.
- Domain A source and test files named in the assignment.

## Findings

No blocking findings.

No needs-change findings.

### Selection transition coverage is adequate

- `EditorSelection` now has a `deformerTreeSet` variant and typed Deformer Tree targets for RigControls, bound Drawable refs, and Pool Drawables: `apps/editor/src/features/editor-session/model/editor-selection.ts:3`, `:21`, `:27`.
- The selection transition helper covers replace, toggle, range, and anchor fallback paths: `apps/editor/src/features/editor-session/model/editor-selection.ts:221`, `:230`, `:246`, `:250`, `:259`.
- The focused unit test explicitly covers visible selectable order across Deformer row, bound Drawable ref, and Pool Drawable: `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:392`, `:407`, `:409`, `:424`, `:425`.
- The same unit test covers replace selection: `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:427`, `:434`; toggle selection: `:439`, `:446`; Shift range: `:454`, `:464`; and missing/nonvisible anchor fallback: `:472`, `:482`.
- Pool container skip is covered because Pool part rows are present in projection but excluded from selectable targets: `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:424`, `:425`, backed by target construction that only appends drawable Pool items: `apps/editor/src/features/editor-session/model/rig-tool-state.ts:666`, `:688`.
- UI event mapping passes Shift and Ctrl/Meta into the Deformer Tree selection API: `apps/editor/src/workspace/panels/deformer-tree-view.tsx:69`, `:73`, `:75`; the session context applies that transition and stores the Deformer Tree anchor: `apps/editor/src/features/editor-session/editor-session-context.tsx:927`, `:936`, `:947`.
- Focused E2E exercises real Deformer Tree Control-click and Shift-click behavior and asserts selected row state: `apps/editor/e2e/psd-import.e2e.spec.ts:502`, `:504`, `:506`, `:507`, `:509`, `:510`.

### Drawable Pool tree projection coverage is adequate

- Source projection filters out Drawables already bound to any RigControl: `apps/editor/src/features/editor-session/model/rig-tool-state.ts:563`, `:568`, `:569`.
- Source projection emits Pool Drawable rows as selectable/display-only false and Pool Part rows as display-only true: `apps/editor/src/features/editor-session/model/rig-tool-state.ts:582`, `:592`, `:631`, `:638`.
- Source projection prunes empty Part subtrees: `apps/editor/src/features/editor-session/model/rig-tool-state.ts:627`.
- Unit coverage verifies bound Drawable exclusion and display-only flags after a committed Deformer binding: `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:340`, `:347`, `:360`, `:367`, `:384`.
- Unit coverage verifies nested Parts order, bound Drawable exclusion, empty container pruning, and display-only flags with a nested Part fixture: `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:488`, `:490`, `:532`, `:541`, `:554`, `:560`, `:566`, `:574`, `:582`, `:591`.
- E2E confirms visible Pool container rows are display-only and non-draggable while Pool Drawable rows remain visible: `apps/editor/e2e/psd-import.e2e.spec.ts:487`, `:492`, `:494`, `:495`, `:496`.

### Deformer row cleanup proof is adequate

- The Deformer row renderer now renders the Deformer display name plus child/keyform badges, with no secondary control-point or pivot text line: `apps/editor/src/workspace/panels/deformer-tree-view.tsx:248`, `:249`, `:253`, `:266`.
- E2E confirms committed Deformer rows no longer visibly contain `control points` or `Pivot`: `apps/editor/e2e/psd-import.e2e.spec.ts:474`, `:477`, `:478`.
- Inspector editability is still covered in the same flow through control-point inputs and Apply Deformer Edits: `apps/editor/e2e/psd-import.e2e.spec.ts:466`, `:467`, `:471`, `:472`.
- The model still retains `transformLabel` / `bezierLabel` for non-row consumers and existing projection assertions: `apps/editor/src/features/editor-session/model/rig-tool-state.ts:918`, `:922`; this does not conflict with the row cleanup requirement because the visible Deformer Tree row does not render those fields.

### Existing Deformer Tree D&D smoke remains covered

- Deformer Tree drag/drop handlers still route Pool Drawable, bound Drawable ref, and RigControl payloads through the existing bind/move/reparent commands: `apps/editor/src/workspace/panels/deformer-tree-view.tsx:80`, `:96`, `:100`, `:105`.
- Pool Drawable rows remain draggable and Deformer rows remain drop targets: `apps/editor/src/workspace/panels/deformer-tree-view.tsx:216`, `:228`, `:235`, `:330`, `:342`, `:351`.
- The focused E2E proof that was recorded as passing includes Pool Drawable drag to an existing Deformer and verifies the additional bound Drawable ref appears: `apps/editor/e2e/psd-import.e2e.spec.ts:511`, `:512`.
- A bound Drawable ref drag smoke remains in the same E2E file: `apps/editor/e2e/psd-import.e2e.spec.ts:544`, `:560`, `:561`, `:562`.

## Validation Assessment

Known verification supplied by the caller is sufficient for Domain A:

- `pnpm.cmd typecheck` passed.
- Focused Vitest for `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts` passed after sandbox `spawn EPERM` was rerun with escalation: 12 tests.
- Focused Playwright from `apps/editor` passed after sandbox `test-results` write `EPERM` was rerun with escalation: `pnpm.cmd exec playwright test -c playwright.config.ts --grep "creates a Warp Deformer draft"`, 1 test.
- `git diff --check` for Domain A files passed with CRLF warnings only.

I did not rerun the focused tests during this review because the assignment already provided pass results and rerunning Playwright can write `test-results`.

## Residual Risks

- Meta-click is not separately browser-exercised; coverage relies on the shared `event.ctrlKey || event.metaKey` mapping plus the mode-level toggle unit test. This is non-blocking.
- The recorded focused Playwright run covers Pool Drawable D&D. The bound Drawable ref drag smoke exists in source, but the provided focused grep did not include that separate test. This is non-blocking for Domain A because the changed focused flow covers the Pool D&D path most directly affected by the Pool tree work.
- No component-level test exists for the row cleanup; the E2E assertion is adequate, but failures would be caught later than a pure component test.

## User Decision Points

None.

## Final Recommendation

Domain A test adequacy is `pass`. The required unit/projection/E2E evidence exists for selection transitions, Pool tree projection, row cleanup, and representative D&D continuity, with the residual risks above carried as non-blocking.
