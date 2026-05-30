# Wave 16 Domain A Review: Drawable Layer Operation Foundation

> Wave: `drawable-layer-controls-and-visibility-authoring`
> Domain: `wave16-drawable-layer-operation-foundation`
> Date: 2026-05-30

## Verdict

`pass`

Initial independent review returned `needs_changes`; the single operation-integrity finding was fixed and the focused verification set passed afterward.

## Review Basis

- `discussion/implementation/orchestration/wave16-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- Changed authoring and operation source/tests listed in the completion report.
- Final verification results from the Domain A loop.

## Findings

### Fixed

1. Medium: `setDrawOrder` model diff could include unchanged draw-order entries on the drawable/order mismatch-repair path.
   - Original risk: `setDrawableDrawOrders` can repair drawable `baseDrawOrder` when `graph.drawOrder` already matches the requested value, but the operation result still reported `/model/drawOrder/entries` as changed.
   - Fix: `createSetDrawOrderResult` now adds the package draw-order field only when `drawOrderBefore` and `drawOrderAfter` differ.
   - Regression: `packages/operation-core/src/operations/set-draw-order.test.ts` now asserts the repair path reports only the drawable `baseDrawOrder` field.

### Open

None.

## Lane Review

| Lane | Result | Notes |
|---|---|---|
| Product Workflow | pass | Registered operation handlers provide the operation foundation later GUI layer controls can call. |
| Runtime Truthfulness | pass | Authoring mutations update source graph state consumed by `toRuntimeGraph`; no UI-only or fake preview semantics were added. |
| Operation Integrity | pass after fix | Dry-run clones, commit mutates sessions, precondition diagnostics are deterministic, and model diffs now omit unchanged draw-order fields. |
| Development Compliance | pass | New files are responsibility-scoped; `index.ts` changes are barrel exports only; dependency-boundary tests pass. |
| Test Adequacy | pass | Focused tests cover success, dry-run, commit, no-op, missing/duplicate/invalid-target rejection, mismatch repair, registry wiring, and runtime graph projection. |
| Determinism | pass | Stable draw-order ranks are derived deterministically from requested base order with previous stable order as tie-breaker and drawable id as final tie-breaker. |

## Verification Reviewed

- `pnpm.cmd exec vitest run packages/authoring-core/src/draw-order-mutations.test.ts packages/authoring-core/src/runtime-visibility-mutations.test.ts packages/operation-core/src/operations/set-draw-order.test.ts packages/operation-core/src/operations/set-runtime-visibility.test.ts packages/authoring-core/src/dependency-boundary.test.ts packages/operation-core/src/dependency-boundary.test.ts` passed 6 files / 20 tests after fix.
- `pnpm.cmd typecheck` passed.
- `pnpm.cmd run check:source` passed.
- `git diff --check -- packages/authoring-core/src packages/operation-core/src` passed with line-ending warnings only.

## User-Decision Points

None.

## Residual Risk

- Runtime diff/evidence assertions are intentionally deferred to the later Wave 16 runtime/evidence domain.
- Editor workflow/UI/e2e assertions are intentionally outside Domain A.
