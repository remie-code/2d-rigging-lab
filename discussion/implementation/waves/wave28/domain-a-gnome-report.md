# Wave28 Domain A Gnome Report

## Verdict

done

## Scope

- Target: `wave28-part-texture-authoring-operation-foundation`
- Implemented in `packages/authoring-core/src/**` and `packages/operation-core/src/**`.
- No runtime evaluator, validator, editor UI, dependency manifest, lockfile, or non-barrel `index.ts` implementation changes.

## Files Changed

Authoring mutations/selectors:

- `packages/authoring-core/src/part-mutations.ts`
- `packages/authoring-core/src/drawable-part-mutations.ts`
- `packages/authoring-core/src/drawable-texture-mutations.ts`
- `packages/authoring-core/src/texture-asset-selectors.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/index.ts` (barrel exports only)

Operation payload/lifecycle integration:

- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operations/create-part.ts`
- `packages/operation-core/src/operations/update-part.ts`
- `packages/operation-core/src/operations/set-drawable-part.ts`
- `packages/operation-core/src/operations/set-drawable-texture.ts`
- `packages/operation-core/src/operations/locked-targets.ts`
- `packages/operation-core/src/index.ts` (barrel exports only)

Focused tests:

- `packages/authoring-core/src/part-mutations.test.ts`
- `packages/authoring-core/src/drawable-part-mutations.test.ts`
- `packages/authoring-core/src/drawable-texture-mutations.test.ts`
- `packages/operation-core/src/operations/part-operations.test.ts`
- `packages/operation-core/src/operations/drawable-part-texture-operations.test.ts`
- `packages/operation-core/src/operation-schemas.test.ts`

## Implementation Notes

- Added `createPart`, `updatePart`, `setDrawablePart`, and `setDrawableTexture` operation payloads and handlers.
- Dry-run uses cloned authoring sessions; commit mutates the supplied session and appends operation log entries through existing lifecycle code.
- Part creation updates `model.graph.parts`, parent `childPartIds`, and `stableOrder`.
- Part update supports display name updates and minimal parent reassignment with cycle and duplicate-child preconditions.
- Drawable part reassignment updates `drawable.partId` plus old/new part `drawableIds`.
- Drawable texture assignment requires an existing texture atlas entry and updates `drawable.textureId`.
- Package materialization evidence is covered by operation tests using `toPackageDocument`; model graph, drawables, and texture atlas state reflect committed changes.

## Diagnostics Added

- `operation.createPart.duplicatePart`
- `operation.createPart.missingParentPart`
- `operation.createPart.partCycle`
- `operation.createPart.duplicateChildPart`
- `operation.createPart.lockedTarget`
- `operation.updatePart.missingPart`
- `operation.updatePart.missingParentPart`
- `operation.updatePart.partCycle`
- `operation.updatePart.duplicateChildPart`
- `operation.updatePart.noOp`
- `operation.updatePart.lockedTarget`
- `operation.setDrawablePart.missingDrawable`
- `operation.setDrawablePart.missingPart`
- `operation.setDrawablePart.noOp`
- `operation.setDrawablePart.lockedTarget`
- `operation.setDrawableTexture.missingDrawable`
- `operation.setDrawableTexture.missingTexture`
- `operation.setDrawableTexture.noOp`
- `operation.setDrawableTexture.lockedTarget`

`lockedTarget` is driven by the new part/texture operation payload `lockedTargetIds`, so editor-layer state can remain outside Domain A while operation-core still has deterministic locked-target preconditions when supplied by callers.

## Verification

Passed:

- `pnpm.cmd exec vitest run packages/authoring-core/src/part-mutations.test.ts packages/authoring-core/src/drawable-part-mutations.test.ts packages/authoring-core/src/drawable-texture-mutations.test.ts packages/operation-core/src/operations/part-operations.test.ts packages/operation-core/src/operations/drawable-part-texture-operations.test.ts packages/operation-core/src/operation-schemas.test.ts`
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/create-drawable.test.ts packages/operation-core/src/operations/set-draw-order.test.ts packages/operation-core/src/operations/set-runtime-visibility.test.ts packages/operation-core/src/operations/set-mask-relation.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operations/create-dynamics-group.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/authoring-core/src/drawable-mutations.test.ts packages/authoring-core/src/draw-order-mutations.test.ts packages/authoring-core/src/runtime-visibility-mutations.test.ts packages/authoring-core/src/mask-relation-mutations.test.ts packages/authoring-core/src/rig-control-mutations.test.ts packages/authoring-core/src/dynamics-mutations.test.ts`
- `pnpm.cmd exec vitest run packages/authoring-core/src/package-document-adapter.test.ts packages/authoring-core/src/dependency-boundary.test.ts packages/operation-core/src/dependency-boundary.test.ts`
- `git diff --check -- packages/authoring-core/src packages/operation-core/src discussion/implementation/waves/wave28/domain-a-gnome-report.md` (no whitespace errors; PowerShell reported existing LF/CRLF normalization warnings)

Typecheck:

- `pnpm.cmd typecheck` fails outside Domain A because untracked `packages/validator-core/src/part-texture-layer-diagnostics.test.ts` has readonly mutation errors:
  - `TS2704` at line 119
  - `TS2540` at line 143
- Domain A type errors found during typecheck were fixed before this report.

## Compatibility Notes

- Existing `createDrawable`, `setDrawOrder`, `setRuntimeVisibility`, `setMaskRelation`, rig-control, and dynamics focused tests passed after the changes.
- `operation-core` dependency boundary test passed; no new package manifest or lockfile changes were made.
- Public `index.ts` files remain barrel-only.

## Remaining Issues

- Full `pnpm typecheck` remains blocked by the parallel/untracked validator-core test file noted above.
- No user-decision points for Domain A.
