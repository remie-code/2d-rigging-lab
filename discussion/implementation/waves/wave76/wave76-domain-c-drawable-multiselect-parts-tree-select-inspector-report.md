# Wave76 Domain C Report: Drawable Multi-Select Selection Model + Parts Tree + Select Inspector

- Verdict: pass
- Domain: `wave76-drawable-multiselect-parts-tree-select-inspector`
- Date: 2026-06-16
- Implementer: Gnome

## Basis Coverage Self-Report

Reviewed before editing:

- `discussion/implementation/orchestration/wave76-plan.md`, especially Domain C and sections 3.3, 7.3, 11, 15, 17, 18, 19.
- `discussion/implementation/orchestration/wave75-plan.md`
- `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
- `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`

Implemented Domain C requirements:

- `EditorSelection` now supports `drawableSet` with ordered Drawable ids.
- `selectionAnchorDrawableId` is held as editor-local context state and is not persisted.
- Normal Drawable click selects only the clicked Drawable and updates anchor.
- Ctrl/Meta-click toggles Drawable membership and updates anchor.
- Shift-click selects the visible Parts Tree Drawable row range from anchor to clicked, using only Drawable rows.
- Missing/nonvisible anchor falls back to clicked-only and updates anchor.
- Modifier-click from Part/Rig/non-Drawable selection falls back to clicked-only, so Part Container selection is cleared.
- Parts Container rows are never members of multi-select.
- Select Inspector shows only selected Drawable names/count for `Drawable Selection`.
- Canvas projection marks selected Drawables uniformly and does not expose a primary selected Drawable in multi-select.
- Existing single Part, Drawable, and RigControl selection behavior remains the same.

## Deferred Basis Items

- Wave76 Domains A, B, D, and E are not implemented here.
- Mesh batch preview/apply and Rig batch create are intentionally deferred to their dependent domains.
- No package-format, operation schema, persistent project data, or dependency changes were made.

## Files Changed

- `apps/editor/src/features/editor-session/model/editor-selection.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/session-tree.ts`
- `apps/editor/src/features/editor-session/model/session-tree.test.ts`
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `discussion/implementation/waves/wave76/wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md`

## Implementation Summary

- Added selection helpers for Drawable id extraction, single Drawable compatibility, selected checks, and deterministic Drawable selection transitions.
- Kept single Drawable selection represented as `kind: "drawable"` so existing Mesh/Rig/single Inspector flows continue to work.
- Added `kind: "drawableSet"` only when two or more Drawables are selected.
- Added editor-local anchor state in `EditorSessionProvider`; project load and explicit Part/Rig selection APIs clear it, and modifier transitions ignore any prior anchor when the current selection is not Drawable-based.
- Limited modifier interpretation to Parts Tree Drawable row clicks.
- Added a minimal `Drawable Selection` Inspector projection and UI list, with no name/opacity/clipping edit controls.
- Updated Canvas projection to use the selected Drawable id set for highlight and selection bounds without expanding Part subtrees.

## User-Facing UX Trace

1. User clicks a Drawable row: the row is the only selected row, Inspector is the normal Drawable editor.
2. User Ctrl/Meta-clicks another Drawable row: both Drawable rows are selected, Canvas selected Drawable count is 2, Select Inspector lists both names.
3. User Shift-clicks another Drawable row: visible Drawable rows between anchor and clicked row are selected; Parts Containers are skipped.
4. User selects a Part Container and then Ctrl/Shift-clicks a Drawable: selection becomes the clicked Drawable only.

## Validation Commands / Results

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/session-tree.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts` | sandbox failed with esbuild `spawn EPERM`; escalated rerun passed after Fix Loop 1, 2 files / 26 tests |
| `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/psd-import.e2e.spec.ts --grep "multi-selects Drawable rows"` | passed, 11 Playwright tests. The script argument boundary caused the whole spec to run, including the new modifier-click test. |
| `pnpm.cmd typecheck` | failed outside Domain C at `packages/authoring-core/src/rig-control-mutations.ts(479,3): Cannot find name 'assertPartExists'`. |
| `pnpm.cmd --dir apps/editor exec tsc --noEmit` | failed on existing/out-of-domain app typecheck debt plus the same authoring-core error; after local fixes, no remaining errors referenced Domain C touched files. |
| `git diff --check -- <Domain C touched files>` | passed; CRLF normalization warnings only. |
| `node scripts/check-source-organization.mjs` | passed. |
| `node scripts/check-dependencies.mjs` | passed. |

## Negative-Scope Proof

- Deformer Tree multi-select was not added:
  - `apps/editor/src/workspace/panels/deformer-tree-view.tsx` still calls `selectDrawable(row.drawableId)` / `selectDrawable(item.drawableId)` without modifier options.
- Canvas Shift/Ctrl multi-select was not added:
  - `apps/editor/src/workspace/panels/canvas-preview-panel.tsx` still calls `selectDrawable(hitDrawableId)` with no event modifier options.
- Modifier handling exists only in Parts Tree:
  - `apps/editor/src/workspace/panels/structure-tree-panel.tsx` reads `event.shiftKey`, `event.ctrlKey`, and `event.metaKey`.
- Selection remains editor-local React state; no portable project serialization or package schema file was touched.
- No dependency manifest or lockfile changes were made; dependency guard passed.

## Residual Risks

- Broad root/editor typecheck remains red due out-of-domain existing or parallel-domain errors. Focused tests and E2E passed for Domain C behavior.
- The `psd-import` E2E command ran the full spec instead of only the grep target because of the existing script argument shape; this is stronger coverage but slower.
- Future Mesh/Rig batch domains must decide how to consume `drawableSet`; Domain C deliberately leaves current Mesh/Rig single-selection behavior unchanged.

## User Decision Points

None.

## Provisional Decisions

- Shift-click with a valid visible anchor keeps the existing anchor, matching range-selection behavior; normal and Ctrl/Meta clicks update anchor to the clicked Drawable.
- Ctrl/Meta-clicking the only selected Drawable can produce no selected Drawable (`selection: null`) while retaining the clicked Drawable as the range anchor.

## Fix Loop 1

Review findings addressed:

- Design / Development: removed the React effect that unconditionally re-synced `selectionAnchorDrawableId` from any single Drawable selection. Direct single-selection paths now set the anchor explicitly when they select a Drawable, and clear it when they select a Part or RigControl.
- Test Adequacy: added direct model assertions for:
  - `mode: "range"` with `anchorDrawableId: null` falling back to clicked-only;
  - Part Container current selection with `mode: "range"` falling back to clicked-only;
  - `drawableSet` current selection with `mode: "replace"` clearing multi-select and selecting only the clicked Drawable.
- Anchor regression: extended the model transition test so Ctrl/Meta toggle can collapse a Drawable set to one remaining Drawable while keeping the clicked Drawable as the next Shift anchor.

Files changed in Fix Loop 1:

- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/session-tree.test.ts`
- `discussion/implementation/waves/wave76/wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md`

Validation after Fix Loop 1:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/session-tree.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts` | passed after escalation, 2 files / 26 tests |
| `git diff --check -- apps/editor/src/features/editor-session/model/editor-selection.ts apps/editor/src/features/editor-session/editor-session-context.tsx apps/editor/src/features/editor-session/model/session-tree.test.ts discussion/implementation/waves/wave76/wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md` | passed after report update; CRLF normalization warnings only |
| `pnpm.cmd --dir apps/editor exec tsc --noEmit` | failed in existing/out-of-domain files: `editor-session-context-history.test.ts`, `editor-project-storage.test.ts`, `canvas-render-scene-adapter.ts`, and `project-storage-screen.test.ts`; no failure referenced Fix Loop touched files |

React component test note:

- A direct React context regression test would require editing the existing context harness tests outside this fix-loop's focused test scope. The implementation instead removes the problematic effect entirely and keeps anchor mutation explicit in the same callback branches that change selection; the model test captures the transition contract that the effect violated.

Residual risks after Fix Loop 1:

- Broad editor typecheck remains red due unrelated/out-of-domain files.
- E2E was not rerun in Fix Loop 1 because the UI modifier path was not changed; the previous Domain C E2E pass remains recorded above.
