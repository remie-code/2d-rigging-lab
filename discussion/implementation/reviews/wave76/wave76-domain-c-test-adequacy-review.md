# Wave76 Domain C Test Adequacy Review

- Verdict: `pass`
- Lane: Test Adequacy
- Domain: `wave76-drawable-multiselect-parts-tree-select-inspector`
- Date: 2026-06-16
- Reviewer: Review-Sylph

## Basis Reviewed

- `discussion/implementation/orchestration/wave76-plan.md`, especially 3.3, 7.3, 11, 15, 17, 18, 19.
- `discussion/implementation/orchestration/wave75-plan.md`
- `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
- `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/implementation/waves/wave76/wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md`

## Scope Reviewed

Directly inspected:

- `apps/editor/src/features/editor-session/model/editor-selection.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/session-tree.ts`
- `apps/editor/src/features/editor-session/model/session-tree.test.ts`
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

Additional negative-scope source evidence checked:

- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`

## Fix Loop 1 Re-review

Final verdict after re-review: `pass`.

Resolved coverage items:

- `range` with `anchorDrawableId: null` fallback is now directly asserted at `apps/editor/src/features/editor-session/model/session-tree.test.ts:162`.
- Part Container selected plus Shift-click Drawable fallback is now directly asserted with `currentSelection: { kind: "part", id: PART_FACE }` and `mode: "range"` at `apps/editor/src/features/editor-session/model/session-tree.test.ts:188`.
- Normal click/reset from existing `drawableSet` to one Drawable is now directly asserted at `apps/editor/src/features/editor-session/model/session-tree.test.ts:215`.
- Ctrl/Meta toggle collapse to one remaining Drawable while keeping the clicked Drawable as the next Shift anchor is covered by `toggledOff` and the follow-up range assertion at `apps/editor/src/features/editor-session/model/session-tree.test.ts:103`.

Implementation/source sanity checked:

- The transition implementation still routes non-Drawable selections and normal replacement through clicked-only selection at `apps/editor/src/features/editor-session/model/editor-selection.ts:93`.
- The explicit null-anchor range fallback is still present at `apps/editor/src/features/editor-session/model/editor-selection.ts:109`.
- `EditorSessionProvider` no longer has the prior unconditional effect that re-synced `selectionAnchorDrawableId` from every single Drawable selection; anchor mutation is explicit in selection-changing branches such as `selectPart`, `selectDrawable`, and `selectRigControl` at `apps/editor/src/features/editor-session/editor-session-context.tsx:858`, `apps/editor/src/features/editor-session/editor-session-context.tsx:864`, and `apps/editor/src/features/editor-session/editor-session-context.tsx:891`.

No new Domain C test adequacy issue was found in Fix Loop 1.

## Findings

### Resolved in Fix Loop 1: Required edge-case test coverage is now complete

Wave76 requires tests/evidence for anchor-absent fallback, Parts Container selected plus Shift/Ctrl-click Drawable fallback, and normal click reset behavior. The first review found these edge cases were not all directly asserted. Fix Loop 1 added direct assertions for the missing items.

- Anchor not visible is covered by `apps/editor/src/features/editor-session/model/session-tree.test.ts:144`, with `anchorDrawableId: DRAW_HIDDEN` outside `visibleDrawableIds` at `apps/editor/src/features/editor-session/model/session-tree.test.ts:148`.
- Anchor absent/null with `mode: "range"` is now directly asserted at `apps/editor/src/features/editor-session/model/session-tree.test.ts:162`.
- Part Container selected plus Ctrl-click is covered in unit/E2E form at `apps/editor/src/features/editor-session/model/session-tree.test.ts:160` and `apps/editor/e2e/psd-import.e2e.spec.ts:202`.
- Part Container selected plus Shift-click is now directly asserted at `apps/editor/src/features/editor-session/model/session-tree.test.ts:188`.
- Normal click selection is covered from a Part selection at `apps/editor/src/features/editor-session/model/session-tree.test.ts:76`, and normal click after an existing `drawableSet` is now directly asserted at `apps/editor/src/features/editor-session/model/session-tree.test.ts:215`.

No unresolved needs-change findings remain for this lane.

## Test Coverage Matrix

| Requirement / edge | Evidence | Status |
|---|---|---|
| `EditorSelection` supports ordered Drawable set | `editor-selection.ts:12`; `session-tree.test.ts:95` | Covered |
| Normal click Drawable selects one Drawable | `session-tree.test.ts:76`; `session-tree.test.ts:215`; `psd-import.e2e.spec.ts:175` | Covered |
| Ctrl-click adds/toggles Drawable membership | `session-tree.test.ts:88`, `session-tree.test.ts:103`, `session-tree.test.ts:115`; `psd-import.e2e.spec.ts:181` | Covered |
| Ctrl-click can remove the only selected Drawable | `session-tree.test.ts:115` | Covered |
| Shift-click range selects visible Drawable order | `session-tree.test.ts:128`; `psd-import.e2e.spec.ts:195` | Covered |
| Shift range skips Parts Containers | Fixture has Part row between Drawable rows at `session-tree.test.ts:363`; range assertion returns only Drawable ids at `session-tree.test.ts:135` | Covered by model shape |
| Anchor not visible fallback | `session-tree.test.ts:144` | Covered |
| Anchor absent/null fallback | `session-tree.test.ts:162` | Covered |
| Parts Container selected plus Ctrl-click Drawable | `session-tree.test.ts:160`; `psd-import.e2e.spec.ts:202` | Covered |
| Parts Container selected plus Shift-click Drawable | `session-tree.test.ts:188` | Covered |
| Parts Container rows cannot be multi-select members | Row selected projection at `session-tree.ts:156` and `session-tree.test.ts:174` | Covered |
| Structure rows expose selected flags for Drawable set | `session-tree.ts:207`; `session-tree.test.ts:174` | Covered |
| Parts Tree uses Playwright `modifiers` | `psd-import.e2e.spec.ts:181`, `psd-import.e2e.spec.ts:195`, `psd-import.e2e.spec.ts:211` | Covered |
| Inspector selected Drawable name list | Projection at `session-tree.ts:271`; UI at `inspector-panel.tsx:132`; E2E at `psd-import.e2e.spec.ts:188` | Covered |
| Select Inspector omits unrelated edit controls | `psd-import.e2e.spec.ts:192` | Covered |
| Canvas selected Drawable ids without subtree expansion | `canvas-projection.ts:607`; `canvas-projection.test.ts:120` | Covered |
| No Deformer Tree multi-select | `deformer-tree-view.tsx:140`, `deformer-tree-view.tsx:289` call `selectDrawable` without options | Source evidence covered |
| No Canvas modifier multi-select | `canvas-preview-panel.tsx:499` calls `selectDrawable(hitDrawableId)` without event modifiers | Source evidence covered |
| Existing single-selection behavior retained | Existing `psd-import` single-selection assertions at `psd-import.e2e.spec.ts:80`, `psd-import.e2e.spec.ts:99`, `psd-import.e2e.spec.ts:232` | Covered by regression E2E |

## Verification Reviewed Or Performed

Reviewed reported validation:

- Focused Vitest command reported passed after sandbox `spawn EPERM` escalation: `session-tree.test.ts` and `canvas-projection.test.ts`, 25 tests.
- Fix Loop 1 focused Vitest command reported passed after escalation: `session-tree.test.ts` and `canvas-projection.test.ts`, 26 tests.
- Focused Playwright command reported passed but ran the full `psd-import` spec due script argument shape: 11 tests, including the modifier-click test.
- `pnpm.cmd typecheck` reported failing outside Domain C at `packages/authoring-core/src/rig-control-mutations.ts(479,3): Cannot find name 'assertPartExists'`.
- `pnpm.cmd --dir apps/editor exec tsc --noEmit` reported failing outside Domain C after local/parallel fixes; no remaining errors were reported against Domain C touched files.
- Source organization and dependency guard pass results are reported.
- Fix Loop 1 editor typecheck was reported failing only in out-of-domain files; no failure referenced Fix Loop touched files.

Performed in this review:

- `git status --short -uall`: confirmed dirty worktree includes Domain C touched files plus parallel-domain dirt; no revert attempted.
- `rg` over touched source/tests for selection, modifier, Inspector, Canvas, and negative-scope evidence.
- `rg` over `deformer-tree-view.tsx` and `canvas-preview-panel.tsx` to confirm no modifier-aware multi-select path was added outside Parts Tree.
- `git diff --check -- <Domain C touched files>`: exit 0; CRLF normalization warnings only.
- Fix Loop 1 re-review: directly inspected `session-tree.test.ts`, `editor-selection.ts`, and `editor-session-context.tsx` for the three missing assertions and the explicit anchor update behavior.
- `git diff --check -- discussion/implementation/reviews/wave76/wave76-domain-c-test-adequacy-review.md`: passed.

I did not rerun Vitest, Playwright, or broad typecheck. The adequacy decision is based on direct source/test inspection and the reported focused validation results.

## Residual Risks

- No unresolved Domain C test adequacy blocker remains after Fix Loop 1.
- Negative no-Deformer/no-Canvas multi-select coverage is source-evidence based rather than an explicit automated negative test. This is acceptable as evidence for this lane, but it is weaker than a UI test.
- Broad typecheck remains red due reported out-of-domain or parallel-domain changes. This review found no evidence tying those failures to Domain C, but did not rerun typecheck.

## User-Decision Points

None.
