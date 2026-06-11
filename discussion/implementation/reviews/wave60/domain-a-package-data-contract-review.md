# Wave60 Domain A Package / Operation / Data Contract Review

- Verdict: `pass`
- Target: `wave60-parts-tree-inspector-editing-dnd-boundary-probe-v0`
- Lane: Domain A package / operation / data contract review
- Review loop: fix loop 1 re-review

## Scope reviewed

- Updated Gnome report:
  - `discussion/implementation/waves/wave60/domain-a-gnome-report.md`
- Previous review report:
  - `discussion/implementation/reviews/wave60/domain-a-package-data-contract-review.md`
- Fix-loop source/tests directly reviewed:
  - `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - `apps/editor/src/features/editor-session/model/session-tree.ts`
  - `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `apps/editor/src/workspace/canvas/canvas-projection.ts`
  - `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
  - `packages/authoring-core/src/authoring-mutations.ts`
  - `packages/authoring-core/src/drawable-mutations.ts`
  - `packages/authoring-core/src/drawable-mutations.test.ts`
  - `packages/operation-core/src/payloads/model-edit.ts`
  - `packages/operation-core/src/operation-type.ts`
  - `packages/operation-core/src/operation-payload.ts`
  - `packages/operation-core/src/operation-registry.ts`
  - `packages/operation-core/src/operation-schemas.test.ts`
  - `packages/operation-core/src/operations/update-drawable.ts`
  - `packages/operation-core/src/operations/update-drawable.test.ts`
  - `packages/operation-core/src/index.ts`

## Basis documents used

- `discussion/implementation/orchestration/wave60-plan.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/design/screen-design/components/part-container-inspector.md`
- `discussion/design/screen-design/components/drawable-inspector.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `.github/skills/implementation-orchestration/SKILL.md`

## Findings

No remaining actionable package / operation / data-contract findings for this lane.

## Previous findings check

### 1. Cross-part DnD / reparent row order vs Canvas draw order

Resolved.

- `createDrawableReorderEntries` now uses projected Parts Tree drawable order rather than raw global drawable order: `apps/editor/src/features/editor-session/model/session-tree.ts:264`, `apps/editor/src/features/editor-session/model/session-tree.ts:274`, `apps/editor/src/features/editor-session/model/session-tree.ts:376`.
- `createDrawableTreeOrderEntries` explicitly compares projected tree order with global draw order and produces `setDrawOrder` entries when they differ: `apps/editor/src/features/editor-session/model/session-tree.ts:297`, `apps/editor/src/features/editor-session/model/session-tree.ts:300`.
- Cross-part drawable-on-drawable reorder reparents to the target drawable's part before computing draw order: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:178`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:207`.
- Drawable and part reparent paths call `commitTreeDrawOrderSync` after package reparent operations: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:240`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:262`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:284`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:293`.
- Structured tests cover drawable reparent, cross-part drawable reorder/reparent, and part reparent keeping projected tree order equal to global draw order: `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:34`, `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:45`, `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:55`.

### 2. `updateDrawable.defaultOpacity` runtimeDiff evidence

Resolved.

- `updateDrawable` now builds runtime diff evidence for opacity changes and attaches it to the operation result: `packages/operation-core/src/operations/update-drawable.ts:209`, `packages/operation-core/src/operations/update-drawable.ts:223`, `packages/operation-core/src/operations/update-drawable.ts:259`.
- Generated runtime snapshot IDs are populated from the runtime diff snapshot IDs: `packages/operation-core/src/operations/update-drawable.ts:226`.
- Focused tests assert `drawableRuntimeStateChanges`, empty `drawListChanges`, and generated snapshot IDs: `packages/operation-core/src/operations/update-drawable.test.ts:93`, `packages/operation-core/src/operations/update-drawable.test.ts:106`, `packages/operation-core/src/operations/update-drawable.test.ts:107`.

### 3. Whitespace-only `updateDrawable.displayName`

Resolved.

- Operation payload schema rejects blank-after-trim display names: `packages/operation-core/src/payloads/model-edit.ts:38`, `packages/operation-core/src/payloads/model-edit.ts:42`.
- Authoring mutation also rejects blank-after-trim names, so non-GUI callers cannot bypass the package boundary: `packages/authoring-core/src/drawable-mutations.ts:149`.
- Tests cover both operation-schema rejection and authoring-core rejection: `packages/operation-core/src/operations/update-drawable.test.ts:154`, `packages/authoring-core/src/drawable-mutations.test.ts:136`.

### 4. Product semantics / part visibility leakage

No new leak found.

- Part container editor visibility remains editor/session state through `editorHiddenPartIds`, not package/runtime/export state: `apps/editor/src/features/editor-session/editor-session-context.tsx:82`.
- Parts Tree and Inspector consume editor-hidden state for effective visibility projection only: `apps/editor/src/features/editor-session/model/session-tree.ts:117`, `apps/editor/src/features/editor-session/model/session-tree.ts:204`.
- Canvas projection uses editor-hidden part IDs to hide render/hit-test output while leaving drawable `runtimeVisibility` intact: `apps/editor/src/workspace/canvas/canvas-projection.ts:115`, `apps/editor/src/workspace/canvas/canvas-projection.ts:138`.
- Package/operation additions remain scoped to drawable name/default opacity, drawable/part reparent, draw order, mask, and drawable runtime visibility paths. No runtime/export part visibility operation or schema was introduced in the reviewed fix.

## Contract / operation assessment

- Package changes remain justified by accepted Wave60 UX and do not invent Variant, Expression, parameter-driven opacity, subtree opacity, or runtime/export part visibility semantics.
- GUI package mutations reviewed in this lane route through Operation Core command helpers rather than direct model mutation.
- Drawable rename/default opacity operation is durable, schema-validated, dry-run/commit coherent, registered/exported, and now emits runtime diff evidence for opacity changes.
- Drawable visibility, mask relation, draw order, drawable reparent, and part reparent command paths are coherent enough for this boundary probe. Reparent operations now reconcile global draw order to projected Parts Tree order.
- Tree order vs Canvas draw order authority is now explicit in code: projected Parts Tree drawable order is the command-side authority used to resync global `setDrawOrder`, and Canvas continues to render from global draw order.
- Reparent/cycle behavior remains guarded by editor checks and operation preconditions.
- Dependency policy is respected: no `package.json`, `pnpm-lock.yaml`, or workspace dependency diff was present.

## DnD data-contract finding

Pass for this lane. DnD reorder/reparent is still a boundary-probe implementation, but the previous data-contract split is addressed: cross-part reorder reparents before ordering, and reparent paths resync global draw order from projected Parts Tree order.

## Verification performed

- Read updated Gnome report and previous review report.
- Re-read basis lines for draw order, part visibility, operation/runtime diff policy, dependency policy, and review separation.
- Read fix-loop source and tests directly; did not rely only on Gnome summary.
- Ran `git status --short -uall`.
- Ran `git diff --stat`.
- Ran `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml pnpm-workspace.yml`: no dependency manifest/lockfile diff.
- Ran focused `rg` checks for operation registration/schema/export, editor-hidden part visibility, runtimeDiff evidence, and draw-order sync paths.
- Ran `git diff --check --` on the fix-loop lane files and this report. Result: no whitespace errors; Git emitted expected LF-to-CRLF working-copy warnings only for source files.
- Did not rerun full test suites in this review lane; Gnome report records passing focused vitest, typecheck, build, e2e, unit, and check commands after fix loop 1.

## Residual risks / open questions

- Native browser DnD reparent remains covered by structured editor-command tests rather than direct Playwright DnD choreography. This is acceptable for this package/data-contract lane; test adequacy lane may judge browser-path coverage separately.
- The new `updateDrawable` runtime diff is operation-result evidence, not a full persisted runtime snapshot artifact generation pipeline. That matches the scoped finding being reviewed here; broader runtime evidence artifact policy remains outside this lane.
