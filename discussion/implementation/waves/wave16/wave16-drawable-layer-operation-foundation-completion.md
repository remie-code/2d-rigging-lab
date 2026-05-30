# Wave 16 Domain A Completion: Drawable Layer Operation Foundation

> Wave: `drawable-layer-controls-and-visibility-authoring`
> Domain: `wave16-drawable-layer-operation-foundation`
> Date: 2026-05-30

## Verdict

`pass`

Domain A implemented authoring and operation support for `setDrawOrder` and `setRuntimeVisibility`, registered both handlers, and verified dry-run / commit / precondition behavior with focused tests.

## Files Changed

Authoring core:

- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/draw-order-mutations.ts`
- `packages/authoring-core/src/runtime-visibility-mutations.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/draw-order-mutations.test.ts`
- `packages/authoring-core/src/runtime-visibility-mutations.test.ts`

Operation core:

- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/operations/set-draw-order.ts`
- `packages/operation-core/src/operations/set-draw-order.test.ts`
- `packages/operation-core/src/operations/set-runtime-visibility.ts`
- `packages/operation-core/src/operations/set-runtime-visibility.test.ts`

Reports:

- `discussion/implementation/waves/wave16/wave16-drawable-layer-operation-foundation-completion.md`
- `discussion/implementation/reviews/wave16/wave16-drawable-layer-operation-foundation-review.md`

## Implementation Summary

- Added `setDrawableDrawOrders` to update drawable `baseDrawOrder`, draw-order entry `baseDrawOrder`, and normalized deterministic `stableOrder` together.
- Added `setDrawableRuntimeVisibility` for drawable runtime visibility mutation.
- Registered `setDrawOrder` and `setRuntimeVisibility` operation handlers.
- Added deterministic diagnostics for:
  - missing drawable;
  - missing draw-order entry;
  - duplicate draw-order entries / duplicate payload entries;
  - invalid visibility target kind;
  - no-op draw order and no-op visibility updates.
- Kept `index.ts` files barrel-only.
- Preserved dependency boundaries after verification caught and removed direct `operation-core -> package-format` and authoring test `runtime-core` import issues.
- Ensured runtime graph conversion projects updated draw order and visibility through `toRuntimeGraph`.
- Ensured `setDrawOrder` model diffs report actual changed fields, including mismatch-repair cases where drawable `baseDrawOrder` changes but draw-order entries do not.

## Tests Run

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/draw-order-mutations.test.ts packages/authoring-core/src/runtime-visibility-mutations.test.ts packages/operation-core/src/operations/set-draw-order.test.ts packages/operation-core/src/operations/set-runtime-visibility.test.ts` | pass after sandbox escalation | Initial sandbox run failed with `EPERM` opening Vitest from pnpm `node_modules`; escalated focused run passed 4 files / 15 tests before later review-fix expansion. |
| `pnpm.cmd typecheck` | pass after sandbox escalation and fixes | Initial sandbox run failed with `EPERM` opening TypeScript from pnpm `node_modules`; first escalated run caught a dependency-boundary type error, fixed before final pass. |
| `pnpm.cmd exec vitest run packages/authoring-core/src/dependency-boundary.test.ts packages/operation-core/src/dependency-boundary.test.ts` | pass after fixes | First run caught authoring tests importing `runtime-core`; tests were adjusted to assert the `toRuntimeGraph` boundary. |
| `pnpm.cmd exec vitest run packages/authoring-core/src/draw-order-mutations.test.ts packages/authoring-core/src/runtime-visibility-mutations.test.ts packages/operation-core/src/operations/set-draw-order.test.ts packages/operation-core/src/operations/set-runtime-visibility.test.ts packages/authoring-core/src/dependency-boundary.test.ts packages/operation-core/src/dependency-boundary.test.ts` | pass | Final run after review fix: 6 files / 20 tests. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- packages/authoring-core/src packages/operation-core/src` | pass with line-ending warnings only | No whitespace errors; Git reported LF-to-CRLF warnings. |

## Review Findings And Fixes Applied

Independent Review-Sylph returned `needs_changes` with one medium operation-integrity finding:

- `setDrawOrder` could report `/model/drawOrder/entries` as changed on the mismatch-repair path even when draw-order entries were identical before and after.

Fix applied:

- `createSetDrawOrderResult` now includes the package draw-order field only when entries actually differ.
- Added a repair-path assertion in `set-draw-order.test.ts` proving the model diff contains only the drawable `baseDrawOrder` field when only that field changed.
- Reran focused tests, dependency-boundary tests, typecheck, and source guard successfully.

## Remaining Issues

- Domain A does not produce runtime diff or operation evidence dedicated fields for these operations. That is expected to be covered by later Wave 16 runtime/evidence domains.
- Domain A does not include editor workflow, UI, persistence smoke, or e2e coverage. Those are explicitly out of this domain.

## User-Decision Points

- None.

## Provisional Assumptions

- Treating no-op updates as rejected operation preconditions is intentional for this foundation.
- `SetDrawOrderPayloadSchema` entries are sufficient for the foundation by treating requested `baseDrawOrder` values as the sortable layer-order intent and deriving deterministic `stableOrder` ranks from the ordered result.
- Visibility target mapping is constrained to `TargetRefDto.kind === "drawable"`; other target kinds are deterministic precondition failures.
