# Wave60 Domain A Gnome Report

- Verdict: `needs_review`
- Wave: `wave60-parts-tree-inspector-editing-dnd-boundary-probe-v0`
- DnD outcome: `implemented`

## Changed Files Summary

- Editor session / projection / UI:
  - `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
  - `apps/editor/src/features/editor-session/model/session-tree.ts`
  - `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
  - `apps/editor/src/workspace/panels/inspector-panel.tsx`
  - `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
  - `apps/editor/src/workspace/canvas/canvas-projection.ts`
  - `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- Tests:
  - `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - `apps/editor/src/features/editor-session/model/session-tree.test.ts`
  - `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - `apps/editor/e2e/psd-import.e2e.spec.ts`
  - `packages/authoring-core/src/drawable-mutations.test.ts`
  - `packages/operation-core/src/operations/update-drawable.test.ts`
- Package operation support:
  - `packages/authoring-core/src/authoring-mutations.ts`
  - `packages/authoring-core/src/drawable-mutations.ts`
  - `packages/operation-core/src/payloads/model-edit.ts`
  - `packages/operation-core/src/operation-type.ts`
  - `packages/operation-core/src/operation-payload.ts`
  - `packages/operation-core/src/operation-registry.ts`
  - `packages/operation-core/src/operation-ids.ts`
  - `packages/operation-core/src/operation-schemas.test.ts`
  - `packages/operation-core/src/operations/update-drawable.ts`
  - `packages/operation-core/src/index.ts`

Pre-existing at handoff and preserved: `discussion/implementation/_map.md`, `discussion/implementation/orchestration/_map.md`, `discussion/implementation/orchestration/wave60-plan.md`.

## Implementation Notes

1. Editing command/session bridge
   - Added Editor-side command bridge in `editor-session-commands.ts`.
   - GUI package mutations now go through Operation Core for part rename, drawable rename/opacity, runtime visibility, mask relation, draw order, drawable reparent, and part reparent.
   - Added focused `updateDrawable` support in authoring-core and operation-core for drawable name/default opacity.

2. Parts Tree projection and compact row UI
   - Parts Tree now projects part/drawable rows with compact icons, selected state, hidden/effective-hidden state, collapse state, and front-to-back drawable order.
   - Normal UI does not show raw refs/evidence paths.

3. Part Container editor-only visibility gate
   - Part visibility gate is editor-only state in `EditorSessionProvider`.
   - It affects Parts Tree effective-hidden state and Canvas projection visibility/hit testing.
   - It does not mutate child drawable runtime visibility and does not write runtime/export part visibility semantics.

4. Part Container Inspector
   - Added name edit and editor-only visibility gate.
   - Kept sparse: no child counts, no subtree bulk show/hide, no container opacity.

5. Drawable Inspector
   - Added name edit, runtime visibility edit, static opacity edit, and clipping source select/clear.
   - Source summary is compact and human-facing.

6. Draw order and reorder foundation
   - Tree order is front-to-back: drawable rows higher in the tree receive lower `baseDrawOrder`.
   - Canvas continues to draw back-to-front from the same stable order authority.
   - Fix loop 1: cross-part drawable reorder now reparents to the target drawable's part before setting draw order, and drawable/part reparent commands resync global draw order to the projected Parts Tree row order on a cloned session before committing the UI state.

7. DnD boundary probe
   - Implemented native HTML drag/drop:
     - drawable row reorder onto drawable rows;
     - drawable reparent onto part rows;
     - part container reparent onto valid part rows.
   - Invalid/self/cycle part drops are rejected before exposing a drop.
   - DnD E2E covers drawable reorder.
   - Fix loop 1 adds structured editor-command tests for drawable reparent, cross-part drawable reorder/reparent, and part reparent draw-order reconciliation.

8. Canvas effective visibility / hit-test integration
   - Effective-hidden drawables are not rendered or hit-tested.
   - Selection state is retained after visibility edits and DnD.
   - Isolate Selected remains overlay-only and does not mutate model visibility.

## Focused Tests Added

- `apps/editor/src/features/editor-session/model/session-tree.test.ts`
  - front-to-back projection order;
  - effective-hidden projection;
  - collapse projection;
  - drawable reorder entry generation;
  - part reparent cycle guard.
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - drawable reparent command keeps Tree order and Canvas draw order aligned;
  - cross-part drawable reorder command reparents and keeps top-row-is-front draw order;
  - part reparent command resyncs Canvas draw order to the new subtree row order.
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - editor-only part hidden gate hides render/hit-test without changing runtime visibility.
- `packages/authoring-core/src/drawable-mutations.test.ts`
  - drawable display name/default opacity mutation and nonblank display-name rejection.
- `packages/operation-core/src/operations/update-drawable.test.ts`
  - dry-run/commit/reject behavior for `updateDrawable`, including opacity runtime diff evidence and nonblank payload schema rejection.
- `apps/editor/e2e/psd-import.e2e.spec.ts`
  - import -> select -> Inspector edits -> Canvas/Tree reflection;
  - DnD drawable reorder.

## Verification

- `pnpm.cmd --dir apps/editor typecheck`: pass.
- `pnpm.cmd --dir apps/editor build`: pass after sandbox EPERM rerun with escalation; Vite emitted only the existing large chunk warning.
- `pnpm.cmd run typecheck`: pass.
- `pnpm.cmd exec vitest run packages/authoring-core/src/drawable-mutations.test.ts packages/operation-core/src/operations/update-drawable.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/features/editor-session/model/session-tree.test.ts`: pass after sandbox EPERM rerun with escalation; 4 files / 18 tests passed.
- `pnpm.cmd --dir apps/editor test:e2e:psd-import`: pass after sandbox EPERM rerun with escalation; 3 tests passed.
- `pnpm.cmd run test:unit`: pass after sandbox EPERM rerun with escalation; 186 files / 948 tests passed.
- `pnpm.cmd run check`: pass after sandbox EPERM rerun with escalation; typecheck, unit, dependency guard, source organization guard passed.
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`: pass; Git reported expected LF-to-CRLF working-copy warnings only.

## Fix Loop 1

Addressed review findings from:

- `discussion/implementation/reviews/wave60/domain-a-package-data-contract-review.md`
- `discussion/implementation/reviews/wave60/domain-a-test-e2e-review.md`

Resolved findings:

- Cross-part DnD row/canvas order split: resolved. `createDrawableReorderEntries` now uses projected Parts Tree drawable order, and reparent paths call `setDrawOrder` after package reparent operations so global Canvas draw order matches Tree row order. Cross-part drawable-on-drawable drops reparent to the target drawable's part before ordering.
- `updateDrawable.defaultOpacity` runtime evidence: resolved. Opacity updates now emit `runtimeDiff.drawableRuntimeStateChanges` plus generated snapshot ids in the operation result.
- Whitespace-only `updateDrawable.displayName`: resolved. Operation payload schema and authoring-core mutation reject blank-after-trim names.
- DnD reparent test coverage: resolved with structured editor-path tests in `editor-session-commands.test.ts`; existing Playwright E2E still covers browser DnD reorder.
- Dev server cleanup: no controlled verification server remains on Playwright port `127.0.0.1:4173`. `127.0.0.1:5173` remains active as PID `1084`, but it was already active in the review before this fix loop; `Get-Process` reports `node.exe` at `C:\Program Files\nodejs\node.exe`, start time `2026/06/11 19:27:53`, and `Get-CimInstance Win32_Process` command-line lookup is denied locally. I did not stop it because it is pre-existing/unattributed and not the Playwright-managed verification server.

Fix-loop verification:

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/features/editor-session/model/session-tree.test.ts packages/authoring-core/src/drawable-mutations.test.ts packages/operation-core/src/operations/update-drawable.test.ts`: pass after sandbox EPERM rerun with escalation; 4 files / 17 tests passed.
- `pnpm.cmd --dir apps/editor typecheck`: pass.
- `pnpm.cmd run typecheck`: pass.
- `pnpm.cmd --dir apps/editor test:e2e:psd-import`: pass after sandbox EPERM rerun with escalation; 3 tests passed.
- `pnpm.cmd --dir apps/editor build`: pass after sandbox EPERM rerun with escalation; Vite emitted only the existing large chunk warning.
- `pnpm.cmd run test:unit`: pass after sandbox EPERM rerun with escalation; 186 files / 948 tests passed.
- `pnpm.cmd run check`: pass after sandbox EPERM rerun with escalation; typecheck, unit, dependency guard, source organization guard passed.
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`: pass; Git reported expected LF-to-CRLF working-copy warnings only.

## User-Decision Escalations

- None.

## Known Residual Risks

- Native browser DnD E2E still covers drawable reorder only. Reparent paths are covered by structured editor-command tests rather than Playwright native DnD because the review accepted E2E or equivalent editor-path structured coverage.
- Part container editor-hidden state is intentionally session/UI-only in this wave and is not persisted.
- Clipping UI is a compact single-source selector; multi-source/multi-target relation authoring remains a later richer composition UX concern.
