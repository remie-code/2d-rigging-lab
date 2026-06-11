# Wave61 Domain A UX / Source Structure Review

verdict: `pass`

## Scope Reviewed

- Domain: `wave61-mixed-ordered-children-structure-order-foundation`
- Lane: UX / screen-design / source-structure
- Re-review focus:
  - prior lane 1 findings from the first review
  - updated Gnome report
  - `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - `apps/editor/src/features/editor-session/model/session-tree.ts`
  - `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
  - `apps/editor/src/workspace/canvas/canvas-projection.ts`
  - `packages/authoring-core/src/part-children-order.ts`
  - `packages/authoring-core/src/structure-order-mutations.ts`

## Basis Documents Used

- `discussion/implementation/orchestration/wave61-plan.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/waves/wave61/domain-a-gnome-report.md`
- prior review: `discussion/implementation/reviews/wave61/domain-a-ux-source-structure-review.md`

## Findings

No remaining blocking / high / medium findings for this lane.

### Closed: legacy reparent command draw-order sync

- `apps/editor/src/features/editor-session/model/editor-session-commands.ts:241` adds `commitStructureMove()`.
- `editor-session-commands.ts:256` and `editor-session-commands.ts:275` route legacy drawable / part reparent commands through `moveStructureChild`, so the same structure-order authority performs draw-order sync.
- `apps/editor/src/features/editor-session/model/session-tree.ts:476` now compares against actual stored `graph.drawOrder` via `createGlobalDrawOrderIndex()` at `session-tree.ts:550`, so the old false no-op comparison is closed.
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:31` covers the previously failing command paths and now passes.

### Closed: missing-`children` fallback file-tree grouping

- `packages/authoring-core/src/part-children-order.ts:232` derives legacy ordered children by sorting direct drawables and child Part Container blocks together.
- `part-children-order.ts:264` computes a child Part Container block representative order from descendant drawable draw order.
- `apps/editor/src/features/editor-session/model/session-tree.test.ts:83` covers the no-`children` mixed-order fallback.

### Closed: stale invalid-drop feedback

- `apps/editor/src/workspace/panels/structure-tree-panel.tsx:61` clears the tree-level drop intent on leaving the tree.
- `structure-tree-panel.tsx:97` clears row-level stale intent on invalid drag-over / row leave.
- `structure-tree-panel.tsx:88` keeps `data-drop-placement` scoped to the current valid drop target.

## Verification Performed

- Inspected updated Gnome report and prior review.
- Inspected updated lane files listed above.
- Ran `pnpm.cmd exec vitest run packages/authoring-core/src/structure-order-mutations.test.ts apps/editor/src/features/editor-session/model/session-tree.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts`.
  - Sandbox attempt failed with Vite/esbuild `spawn EPERM`.
  - Escalated rerun passed: 4 files / 30 tests.
- Ran `git diff --check -- apps/editor/src/features/editor-session/model/editor-session-commands.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/features/editor-session/model/session-tree.ts apps/editor/src/workspace/panels/structure-tree-panel.tsx apps/editor/src/workspace/canvas/canvas-projection.ts packages/authoring-core/src/part-children-order.ts packages/authoring-core/src/structure-order-mutations.ts`.
  - exit 0; CRLF replacement warnings only.
- Searched E2E / Playwright for screenshot/pixel oracle additions.
  - No screenshot assertion found; `apps/editor/playwright.config.ts` keeps screenshot off.

## Remaining Risks / Constraints

- Legacy package data without `children` can only recover Part Container block order from descendant draw-order representatives; fully interleaved child drawables across a container block cannot be reconstructed without the new durable `children` field.
- `inside` drop still inserts at destination-front by design for Domain A.
- Mixed before/after/inside combinations are covered by unit/operation tests rather than a dedicated Playwright test for every combination, consistent with the E2E oracle constraints.

## User-Decision Points

- None.
