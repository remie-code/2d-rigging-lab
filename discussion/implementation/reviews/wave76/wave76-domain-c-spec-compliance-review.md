# Wave76 Domain C Spec Compliance Review

## Verdict

pass

No blocking or needs-change findings were found for `wave76-drawable-multiselect-parts-tree-select-inspector`.

## Basis Reviewed

- `discussion/implementation/orchestration/wave76-plan.md`
  - Parts Tree multi-select oracle: lines 66-77.
  - Drawable multi-select acceptance: lines 238-260.
  - Domain C implementation/test scope: lines 401-425.
  - Verification matrix: lines 536-549.
  - Review/Subagent contract: lines 614-662.
  - Wave out-of-scope list: lines 669-690.
- `discussion/implementation/orchestration/wave75-plan.md`
- `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
- `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- Domain C implementation report: `discussion/implementation/waves/wave76/wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md`

## Scope Reviewed

Directly inspected required source/test files:

- `apps/editor/src/features/editor-session/model/editor-selection.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/session-tree.ts`
- `apps/editor/src/features/editor-session/model/session-tree.test.ts`
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

Additional negative-scope reads:

- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`

Current worktree note: `git status --short -uall` shows dirty `packages/**` and WebGL files from parallel Wave76 domains. This review did not attribute those changes to Domain C. Domain C's reported and inspected diff scope is the 9 Editor/E2E files above.

## Acceptance Coverage

| Wave76 3.3 / 7.3 requirement | Review result |
|---|---|
| `EditorSelection` supports Drawable set or ordered Drawable list | Implemented via `kind: "drawableSet"` with `ids` in `editor-selection.ts:3-19`; single Drawable remains `kind: "drawable"`. |
| Separate internal Shift anchor | Implemented as React-local `selectionAnchorDrawableId` in `editor-session-context.tsx:361-362`; reset on project load at `:476-488`. |
| Selected Drawable ids ordered in visible Parts Tree order where relevant | Modifier transitions receive visible Drawable rows from `structureRows` at `editor-session-context.tsx:877-881`; toggle ordering uses `orderDrawableIdsByVisibleTree` at `editor-selection.ts:97-106` and `:149-162`; range selection slices visible rows at `:120-126`. |
| Normal click selects clicked only and updates anchor | `structure-tree-panel.tsx:57-60` passes no modifier for normal click; `resolveDrawableSelectionTransition` returns clicked-only for replace at `editor-selection.ts:93-95` and `:129-138`. |
| Ctrl/Meta-click toggles membership and updates anchor | `structure-tree-panel.tsx:57-60` maps Ctrl/Meta to `toggle`; transition toggles membership and sets anchor to clicked at `editor-selection.ts:97-106`. |
| Shift-click selects visible Drawable range and skips Parts Containers | `structure-tree-panel.tsx:57-60` maps Shift to `range`; visible ids are filtered to Drawable rows only at `editor-session-context.tsx:877-881`; range slices that Drawable-only list at `editor-selection.ts:114-126`. |
| Missing/nonvisible anchor falls back to clicked only | Implemented at `editor-selection.ts:109-118`; covered by `session-tree.test.ts:144-158`. |
| Parts Container selected + Shift/Ctrl-click Drawable clears container selection and selects clicked only | Non-Drawable current selection falls back to clicked-only at `editor-selection.ts:93-95`; covered by `session-tree.test.ts:160-171` and E2E `psd-import.e2e.spec.ts:202-218`. |
| Parts Container rows cannot become multi-select members | Part rows use `selectPart` at `structure-tree-panel.tsx:51-55`; Drawable rows alone call multi-select options at `:57-60`; row projection selects Parts only for `selection.kind === "part"` at `session-tree.ts:156` and Drawables through `isDrawableSelected` at `:207`. |
| Select Tool multi-select Inspector shows Drawable names only, no unrelated edit controls | `inspector-panel.tsx:20-40` routes Select Tool multi-selection to `DrawableSetInspector`; that component lists count and names only at `:132-163`. Single Drawable edit controls remain in the separate `DrawableInspector` branch at `:166-330`. E2E asserts no opacity/clipping controls at `psd-import.e2e.spec.ts:188-193`. |
| Canvas reflects selected Drawables uniformly, no visible primary distinction | `canvas-projection.ts:597-609` resolves `drawableSet` to a selected id set without Part expansion; `:198-200` marks selected Drawables directly and only uses `selectedBySubtree` for Part selection; `:236-240` computes combined selection bounds. `canvas-renderer.ts:899-936` draws each selected Drawable with the same stroke and then the aggregate bounds. |
| Existing Part, Drawable, RigControl single-selection behavior remains intact | Part, Drawable, and RigControl selection branches remain explicit in `editor-session-context.tsx:861-898`; focused projection tests still pass. |

## Findings

No blocking findings.

No needs-change findings.

## Forbidden-Scope / Negative Proof

- Deformer Tree multi-select was not added. `deformer-tree-view.tsx:140` and `:289` call `selectDrawable(...)` without passing range/toggle options.
- Canvas Ctrl/Shift multi-select was not added. Canvas hit selection still calls `selectDrawable(hitDrawableId)` with no event modifier options at `canvas-preview-panel.tsx:499-503`.
- Parts Container and Drawable selection are not mixed in one selection variant. The only multi-select variant is `drawableSet` in `editor-selection.ts:12-15`; Part selection is a separate `kind: "part"` branch.
- Portable project persistence was not added for selection. The new anchor is component state in `editor-session-context.tsx:361-362` and is cleared on project load at `:476-488`. `git diff --name-only HEAD -- package.json pnpm-lock.yaml apps/editor/package.json packages/*/package.json` produced no output.
- Domain C did not implement Mesh batch, Rig batch, RigControl `partId` migration, or WebGL work. The exact Domain C diff scope reviewed by `git diff --name-only HEAD -- <Domain C files>` is limited to the 9 Editor/E2E files listed in Scope Reviewed.
- The current worktree does contain dirty `packages/**` and `packages/render-webgl2/**` files, but those are parallel-domain dirt and are not used as Domain C implementation evidence.
- No new dependency manifest or lockfile changes were found in the reviewed Domain C scope.

## Verification Reviewed Or Performed

Performed in this review:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/session-tree.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts` | Sandbox run failed with esbuild `spawn EPERM`; escalated rerun passed, 2 files / 25 tests. |
| `git diff --check -- <Domain C touched files>` | Passed; only CRLF normalization warnings were printed. |
| `git diff --stat HEAD -- <Domain C touched files>` | Reviewed; 9 files changed, 519 insertions / 14 deletions. |

Reviewed from Gnome report and source:

- Domain C report records Playwright `psd-import` coverage as passed: 11 tests, including the new modifier-click test.
- Source E2E assertions at `psd-import.e2e.spec.ts:162-219` cover normal click, Ctrl-click multi-select, Shift range, Select Inspector name list, absence of opacity/clipping controls, Canvas selected count, and Part Container + Ctrl-click fallback.
- Domain C report records source organization and dependency guards as passed.
- Domain C report records broad/root typecheck failures as outside Domain C, with no remaining errors attributed to touched Domain C files after local fixes.

## Residual Risks

- I did not rerun the Playwright E2E in this review. The E2E source assertions were inspected, and the Domain C report records the full `psd-import` spec run as passed.
- Current worktree contains parallel-domain package/WebGL changes. Final integration should re-evaluate combined Wave76 scope so Domain C pass is not mistaken for a pass on Domains A/B/D/E.
- `canvas-preview-panel.tsx` still exposes `data-selected-drawable-opacity` from the first selected Drawable for test/debug attributes. This is not user-visible and does not create a visible primary selection, but future batch-tool domains should avoid treating that attribute as a batch-primary contract.

## User Decision Points

None.
