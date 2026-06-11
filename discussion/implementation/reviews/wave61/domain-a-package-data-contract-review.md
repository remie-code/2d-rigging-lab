# Wave61 Domain A Package / Operation / Data Contract Review

verdict: `pass`

## Scope Reviewed

- Package mixed ordered children schema and authoring helpers:
  - `packages/package-format/src/model-graph.ts`
  - `packages/authoring-core/src/part-children-order.ts`
  - `packages/authoring-core/src/structure-order-mutations.ts`
  - `packages/authoring-core/src/draw-order-mutations.ts`
- Operation schema/registry/handlers/tests:
  - `moveStructureChild`
  - affected `setDrawOrder`, create/update/reparent/import/set-drawable-part flows
- Validator catalog and part/drawable membership diagnostics.
- AI operation catalog and affected contract fixtures under `fixtures/contracts/**`.

## Basis Documents Used

- `discussion/implementation/orchestration/wave61-plan.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- Updated Gnome report: `discussion/implementation/waves/wave61/domain-a-gnome-report.md`
- Prior lane 2 report: `discussion/implementation/reviews/wave61/domain-a-package-data-contract-review.md`

## Findings

なし。前回 lane 2 の3件は修正済みとして確認した。

## Prior Findings Closure

- `setDrawOrder` / mixed structure authority mismatch: closed.
  - `setDrawableDrawOrders()` now projects requested drawable order, syncs direct drawable slots, rejects Part Container block boundary conflicts with `draw_order_structure_conflict`, and then resyncs `drawOrder` from structure order (`packages/authoring-core/src/draw-order-mutations.ts:104`, `packages/authoring-core/src/draw-order-mutations.ts:105`, `packages/authoring-core/src/draw-order-mutations.ts:107`, `packages/authoring-core/src/draw-order-mutations.ts:112`).
  - Operation-core maps that authoring error to `operation.setDrawOrder.structureConflict` (`packages/operation-core/src/operations/set-draw-order.ts:208`), with regression coverage for block-crossing payload rejection (`packages/operation-core/src/operations/set-draw-order.test.ts:205`, `packages/operation-core/src/operations/set-draw-order.test.ts:220`).
- Root-direct Drawable legality inconsistency: closed.
  - Domain A now treats Drawable membership inside a root `ModelPart` as legal, while root Part moves and virtual-root before/after remain illegal.
  - Authoring and operation tests explicitly allow moving a Drawable into the root ModelPart (`packages/authoring-core/src/structure-order-mutations.test.ts:263`, `packages/operation-core/src/operations/move-structure-child.test.ts:201`).
  - Existing validator fixtures continue to accept root-part drawable membership (`packages/validator-core/src/part-texture-layer-diagnostics.test.ts:950`, `packages/validator-core/src/part-texture-layer-diagnostics.test.ts:953`).
- Drawable no-op structure moves incrementing revision / misleading evidence: closed.
  - `moveStructureChild()` now uses item-kind-neutral no-op detection before incrementing revision (`packages/authoring-core/src/structure-order-mutations.ts:111`, `packages/authoring-core/src/structure-order-mutations.ts:123`, `packages/authoring-core/src/structure-order-mutations.ts:422`).
  - Operation-core catches the mutation-level no-op and reports `operation.moveStructureChild.noOp` as warning (`packages/operation-core/src/operations/move-structure-child.ts:91`, `packages/operation-core/src/operations/move-structure-child.ts:341`, `packages/operation-core/src/operations/move-structure-child.ts:349`).
  - The result builder suppresses unchanged draw-order model-diff entries (`packages/operation-core/src/operations/move-structure-child.ts:224`), and tests cover no revision change (`packages/authoring-core/src/structure-order-mutations.test.ts:296`, `packages/operation-core/src/operations/move-structure-child.test.ts:195`).

## Additional Contract Checks

- Package format now has optional `ModelPartDto.children` with mixed `{ kind: "part" | "drawable" }` entries and remains old-data compatible (`packages/package-format/src/model-graph.ts:9`, `packages/package-format/src/model-graph.ts:27`).
- Legacy data fallback now derives mixed order from direct drawable order plus child Part block minimum descendant order, matching the updated Gnome compatibility note (`packages/authoring-core/src/part-children-order.ts:232`, `packages/authoring-core/src/part-children-order.ts:242`, `packages/authoring-core/src/part-children-order.ts:264`).
- Validator covers ordered children duplicate/missing/membership mismatch paths and does not invent a root-direct Drawable ban (`packages/validator-core/src/validators/part-layer-semantics.ts:83`, `packages/validator-core/src/validators/part-layer-semantics.ts:196`, `packages/validator-core/src/validators/part-layer-semantics.ts:505`, `packages/validator-core/src/validators/part-layer-semantics.ts:542`).
- Wave30 fixtures/recipe moved structure-crossing ordering from `setDrawOrder` to `moveStructureChild`, preserving operation policy consistency for cross-container structure changes.

## Verification Performed

- Inspected updated Gnome report and prior lane 2 report.
- Inspected updated package-format, authoring-core, operation-core, validator-core, AI catalog references, and affected fixture diffs.
- Ran focused tests:
  - First sandbox attempt:
    - `pnpm.cmd exec vitest run packages/authoring-core/src/structure-order-mutations.test.ts packages/authoring-core/src/draw-order-mutations.test.ts packages/operation-core/src/operations/move-structure-child.test.ts packages/operation-core/src/operations/set-draw-order.test.ts packages/operation-core/src/operation-schemas.test.ts packages/validator-core/src/part-texture-layer-diagnostics.test.ts packages/operation-core/src/wave30-tutorial-mini-model-recipe.test.ts packages/operation-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts packages/runtime-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts packages/validator-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts packages/operation-core/src/drawable-layer-runtime-evidence.test.ts`
    - Result: failed to load Vitest config due esbuild `spawn EPERM`.
  - Escalated rerun of the same command:
    - Result: pass, 11 test files / 60 tests.
- Did not rerun full root `pnpm run check`; updated Gnome report records it as pass with 188 files / 974 tests.

## Remaining Risks / Constraints

- `inside` drop still inserts at destination front/top by default. This is documented in the Gnome report and is not a lane 2 blocker.
- `children` is optional, and no schema-version migration file was added. Old packages rely on helper fallback; this is documented as compatibility behavior.
- `createDrawable` still reports broad diff paths such as `/model/graph/parts/children`; target refs carry the Part id, so this remains non-blocking.

## User-Decision Points

なし。
