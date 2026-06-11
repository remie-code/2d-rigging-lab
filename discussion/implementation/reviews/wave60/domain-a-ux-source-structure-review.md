# Wave60 Domain A UX / Screen Design / Source Structure Review

- Verdict: `pass`
- Target: `wave60-parts-tree-inspector-editing-dnd-boundary-probe-v0`
- Reviewer: Review-Sylph
- Date: 2026-06-11

## Scope Reviewed

Reviewed the requested UX / screen-design / source-structure lane directly against basis docs, Gnome report, changed UI/session/canvas source, focused tests, diff, and read-only guard output.

Target files reviewed:

- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/session-tree.ts`
- `apps/editor/src/features/editor-session/model/session-tree.test.ts`
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

Narrow DnD operation entrypoints were also checked to understand exposed reparent behavior:

- `packages/authoring-core/src/drawable-part-mutations.ts`
- `packages/authoring-core/src/part-mutations.ts`
- `packages/operation-core/src/operations/set-drawable-part.ts`
- `packages/operation-core/src/operations/update-part.ts`

## Basis Documents Used

- `discussion/implementation/orchestration/wave60-plan.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/design/screen-design/components/part-container-inspector.md`
- `discussion/design/screen-design/components/drawable-inspector.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `discussion/design/screen-design/react-editor-foundation-oracle.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/waves/wave60/domain-a-gnome-report.md`

## Findings

No blocking or needs-change findings for this lane.

### Pass: Parts Tree Matches Wave60 UX Intent

- Compact rows, part/drawable selection, collapse/expand, visibility icons, selected row state, and effective-hidden row dimming are implemented in `apps/editor/src/workspace/panels/structure-tree-panel.tsx:53`.
- Tree rows are projected with part/drawable type, collapse state, runtime/editor hidden state, effective-hidden state, and front-to-back order in `apps/editor/src/features/editor-session/model/session-tree.ts:94`.
- Normal visible UI does not surface raw evidence paths, operation IDs, generated refs, validator payloads, or debug text. A targeted search for debug/evidence strings in reviewed UI/session files found no matches.

### Pass: Part Container Inspector Follows Sparse Design

- Name edit and editor-only visibility gate are present in `apps/editor/src/workspace/panels/inspector-panel.tsx:50`.
- The part inspector shows only kind, parent, and effective visibility summary in `apps/editor/src/workspace/panels/inspector-panel.tsx:105`.
- It does not expose child counts, child status clutter, subtree bulk show/hide, or container opacity.
- The editor-only gate is session UI state in `apps/editor/src/features/editor-session/editor-session-context.tsx:149` and is not written as runtime/export part visibility.

### Pass: Drawable Inspector Follows Wave60 Scope

- Name edit, runtime visibility edit, opacity slider/numeric input, clipping source set/clear, and compact source/texture/mesh summary are implemented in `apps/editor/src/workspace/panels/inspector-panel.tsx:119`.
- Source display is human-facing and compact; it does not show raw source refs/evidence. The projection derives concise labels in `apps/editor/src/features/editor-session/model/session-tree.ts:221`.

### Pass: Canvas Effective Visibility And Selection Integration

- Part editor-hidden gates are passed into canvas projection in `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:97`.
- Canvas projection makes drawables invisible when their part or ancestor part is editor-hidden in `apps/editor/src/workspace/canvas/canvas-projection.ts:114`.
- Hit testing skips non-visible/effective-hidden drawables in `apps/editor/src/workspace/canvas/canvas-projection.ts:178`.
- Rendering skips non-visible drawables in `apps/editor/src/workspace/canvas/canvas-renderer.ts:86`, and selection outlines also skip hidden drawables in `apps/editor/src/workspace/canvas/canvas-renderer.ts:298`.
- Isolate Selected remains overlay state in `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:91` and only dims rendering alpha in `apps/editor/src/workspace/canvas/canvas-renderer.ts:221`; it does not mutate model visibility.

## DnD UX Finding

DnD UX finding: `implemented OK`.

- Drawable reorder, drawable reparent to part, and part reparent to part are exposed through native HTML drag/drop in `apps/editor/src/workspace/panels/structure-tree-panel.tsx:74`.
- Invalid drops are not highlighted/accepted by `canDropOnRow`, including same drawable, same current drawable parent, root/self part movement, and part cycles via `canReparentPart`, in `apps/editor/src/workspace/panels/structure-tree-panel.tsx:219` and `apps/editor/src/features/editor-session/model/session-tree.ts:297`.
- Drop handlers commit through session commands rather than GUI-only state in `apps/editor/src/workspace/panels/structure-tree-panel.tsx:98` and `apps/editor/src/features/editor-session/editor-session-context.tsx:195`.
- Reparent commands use package operation paths (`setDrawablePart`, `updatePart`) and preserve current selection because selection state is not replaced by the drop handler.
- Focused E2E directly covers drawable reorder only in `apps/editor/e2e/psd-import.e2e.spec.ts:159`; direct E2E for drawable reparent and part reparent remains a residual risk for the test-adequacy lane, not a UX/source-structure blocker.

## Source-Structure Finding

Source-structure finding: `pass`.

- Reviewed files stay under the existing `apps/editor/src/workspace`, `apps/editor/src/features`, and `apps/editor/e2e` organization from the React editor foundation oracle.
- No new catch-all `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` files were introduced in this lane.
- `node scripts/check-source-organization.mjs` passed.
- `session-tree.ts` and `inspector-panel.tsx` are growing but remain cohesive around tree/inspector projection and panel rendering. They are not blocking under the current source organization policy, though future waves should split them if responsibilities expand further.

## Verification Performed

Read-only checks and commands:

- Read all listed basis documents and Gnome report directly.
- Read all requested changed files directly.
- Reviewed tracked diff for requested changed files with `git diff -- ...`.
- Ran `git diff --check --` on requested lane files and report path; only expected LF-to-CRLF working-copy warnings were emitted.
- Ran `node scripts/check-source-organization.mjs`: passed.
- Ran targeted `rg` search for visible debug/evidence/operation clutter in reviewed UI/session files: no matches.
- Checked reviewed source file line counts:
  - `structure-tree-panel.tsx`: 260 lines
  - `inspector-panel.tsx`: 342 lines
  - `session-tree.ts`: 460 lines
  - `editor-session-commands.ts`: 311 lines
  - `canvas-projection.ts`: 490 lines
  - `canvas-renderer.ts`: 386 lines

Gnome-recorded verification reviewed from `discussion/implementation/waves/wave60/domain-a-gnome-report.md`:

- editor typecheck/build pass
- root typecheck pass
- focused unit tests pass
- PSD import E2E pass
- root unit/check pass
- diff check pass with LF-to-CRLF warnings only

I did not rerun Playwright E2E in this review lane.

## Residual Risks / Open Questions

- Drawable reparent and part reparent DnD are implemented and source-reviewed, but not directly covered by E2E in the inspected test file.
- Native HTML DnD mouse behavior is acceptable for this boundary probe, but keyboard-accessible reordering/reparenting remains outside the reviewed Wave60 AC.
- If future waves add more inspector sections or tree operations, `inspector-panel.tsx` and `session-tree.ts` should be split before they become mixed-responsibility files.
