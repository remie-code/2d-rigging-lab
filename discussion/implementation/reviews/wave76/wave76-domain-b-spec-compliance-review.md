# Wave76 Domain B Spec Compliance Review

- Review lane: Spec Compliance
- Domain: `wave76-rigcontrol-partid-legacy-optional-decoupling`
- Date: 2026-06-16
- Reviewer: Review-Sylph
- Verdict: `pass`

## Basis Reviewed

- `discussion/_conventions.md`
- `discussion/_map.md`
- `discussion/implementation/orchestration/wave76-plan.md`, especially sections 3.2, 7.2, 10, 15, 17, 18, 19
- `discussion/implementation/waves/wave76/wave76-domain-b-rigcontrol-partid-legacy-optional-decoupling-report.md`
- `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
- `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
- Domain B changed source and tests listed in the review assignment

## Summary

Domain B satisfies the Wave76 7.2 spec from source/test/diff inspection. `RigControl.partId` is now optional legacy metadata in package/operation payload contracts, new create flows omit it, create-operation evidence no longer targets a Part solely due to rig creation, legacy `partId` still loads/round-trips, and Part deletion no longer treats legacy `rigControl.partId` alone as a blocker. `RigControl.parentId` remains in schemas and hierarchy logic.

No blocking or needs-change findings.

## Wave76 7.2 Requirement Classification

| Requirement | Classification | Evidence |
|---|---|---|
| `rotation2d` and `warpLattice2d` RigControl schemas load both old documents with `partId` and new documents without `partId`. | implemented | `packages/package-format/src/model-files.ts:216` and `:232` make `partId` optional for both schemas. `packages/package-format/src/rig-control-contract.test.ts:6` and `:17` parse legacy/current forms. |
| New create Rotation/Warp Deformer operation payloads do not require `partId`. | implemented | `packages/operation-core/src/payloads/rig-control.ts:25`, `:40`, `:55` make all create rig payload `partId` fields optional. `packages/operation-core/src/operation-schemas.test.ts:263`, `:277`, `:294` sample create rig operations without `partId`. |
| New created RigControls omit `partId`. | implemented | Create handlers build package rig controls without `partId`: `create-rotation2d-rig-control.ts:219`, `create-warp-lattice2d-rig-control.ts:118`, `create-warp-deformer.ts:226`. Tests assert no stored `partId` at `packages/operation-core/src/operations/rig-control.test.ts:73`, `:123`, `:218`. |
| Authoring mutation preconditions no longer require a RigControl part to exist. | implemented | `packages/authoring-core/src/rig-control-mutations.ts` removes the prior `assertPartExists` calls and helper; create paths now validate ids, opacity, children, shape, and hierarchy without Part existence. Tests assert new authoring-created controls omit `partId` at `rig-control-mutations.test.ts:54` and `:107`. |
| Operation target refs / targetIds / diagnostics for create rig controls do not include a Part target solely because of rig creation. | implemented | Create operation target IDs now start with rig control id and child targets, not `payload.partId`: `create-rotation2d-rig-control.ts:551`, `create-warp-lattice2d-rig-control.ts:375`, `create-warp-deformer.ts:663`. Tests assert target refs/ids omit `part_root` and Part refs at `rig-control.test.ts:77`, `:127`, `:185`, `:286`. |
| Operation ID generation remains stable and display-name based. | implemented | `packages/operation-core/src/operation-ids.ts:211`, `:215`, `:219` still derive create rig operation IDs from `request.payload.displayName`; no Domain B diff changed this. |
| Runtime/deformation evaluation works for RigControls with no `partId`. | implemented | `packages/authoring-core/src/runtime-graph-adapter.test.ts:206` through `:210` projects a no-`partId` rotation rig control into the runtime graph. `packages/authoring-core/src/portable-project-bundle.test.ts:144` keeps a no-`partId` warp rig control and `:204` through `:226` evaluates a viewer runtime snapshot targeting the imported rig hierarchy. |
| Validator Part delete blockers do not block on legacy `rigControl.partId` alone. | implemented | `packages/validator-core/src/validators/part-delete-blockers.ts:85` through `:88` only consider child parts, drawables, and masks. `packages/validator-core/src/part-texture-layer-diagnostics.test.ts:730` adds a legacy `partId` rig control on the empty leaf, while blocker evidence at `:787` through `:792` omits `rigControl`. |
| Existing blockers from actual Part children, Drawables, masks, and other real ownership remain intact. | implemented | Authoring/operation delete checks still block child Parts and Drawables in `packages/authoring-core/src/part-mutations.ts:241` through `:253` and `packages/operation-core/src/operations/delete-part.ts:139` through `:156`. Validator evidence still reports `childPart,drawable,maskRelation` at `part-texture-layer-diagnostics.test.ts:787` through `:792`. |
| Editor create flows stop sending `partId`. | implemented | Editor draft/payload/read model types no longer carry rig-control `partId`: `apps/editor/src/features/editor-session/model/rig-tool-state.ts:30`, `:54`, `:84`, `:171`, `:204`, `:237`, `:271`, `:374`. Tests assert draft/payload omit `partId` at `rig-tool-state.test.ts:57` and `:60`. |
| Editor read models and Inspector do not present RigControl as belonging to a Parts Container. | implemented | Committed warp/rotation read models omit `partId` at `rig-tool-state.ts:684` through `:720`; inspector test fixtures remove read-model `partId` at `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:146` and `:177`. The remaining Part label in `rig-tool-inspector.tsx:141` describes the selected Drawable target, not committed RigControl ownership. |
| Portable save/load can round-trip both legacy and new no-`partId` RigControls. | implemented | Package bundle round-trip preserves a legacy rotation `partId` and current warp without `partId` at `packages/package-format/src/portable-package-bundle.test.ts:83` through `:139`. Authoring portable project round-trip preserves legacy rotation and no-`partId` warp at `packages/authoring-core/src/portable-project-bundle.test.ts:144` and `:161`. |
| AI operation catalog no longer lists `partId` as a required input for create rig operations. | implemented | `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts:303` through `:339` removes Part target kind and `partId` required inputs for all create rig operations. `packages/ai-interface/src/ai-codex-proposal-validation.test.ts:55` through `:61` asserts no `part` target kind and no `payload.partId` required input. |

## Must-Not Checks

| Must-not | Result | Evidence |
|---|---|---|
| Do not remove `RigControl.parentId`. | pass | Package schema still has `parentId: RigControlIdSchema.optional()` at `packages/package-format/src/model-files.ts:217` and `:233`; authoring/operation/editor hierarchy code still reads/writes `parentId`, e.g. `rig-control-mutations.ts:431`, `:434`, `apps/editor/src/features/editor-session/model/rig-tool-state.ts:687`, `:720`. |
| Do not break old project loading. | pass | Legacy `partId` is accepted and preserved by schema/round-trip tests: `rig-control-contract.test.ts:13`, `:24`; `portable-package-bundle.test.ts:136`; `rig-control-mutations.test.ts:126` through `:143`. |
| Do not perform broad destructive migration or strip all old `partId` from loaded documents. | pass | Tests preserve explicitly authored/imported legacy `partId` (`rig-control-mutations.test.ts:142`, `portable-package-bundle.test.ts:136`, `portable-project-bundle.test.ts:161`). New create operation payloads may accept legacy `partId`, but operation-created records intentionally omit it. |
| Do not reinterpret `partId` as common ancestor ownership for new batch Deformers. | pass | New create payloads and Editor create drafts omit `partId`; target refs no longer include Part. No fake/common Part ownership field is introduced in inspected Domain B files. |
| Do not implement out-of-scope feature work. | pass | Domain B changes are limited to schema/payload/evidence/editor state/catalog/validator decoupling. I found no Deformer Tree multi-select, Canvas multi-select, wrap operation, batch rig UI, mesh overwrite, renderer, Cubism, transport, or LLM/provider feature implementation in the inspected Domain B diffs. |

## Domain E Readiness

Spec perspective: ready for Domain E.

Domain E can create root Rotation/Warp Deformers for selected unbound Drawables without relying on Parts Container ownership because:

- create operation payload schemas no longer require `partId`;
- create handlers write rig controls with `childDrawableIds` / `childRigControlIds` and no `partId`;
- create operation evidence no longer emits Part targets solely for rig creation;
- `parentId` / `childRigControlIds` hierarchy support remains intact;
- Editor payload helpers no longer need a Drawable's Part as ownership input.

Domain E still owns the batch-specific UX and negative behavior: selected Drawable eligibility, already-bound exclusion, zero-eligible disabled buttons, union bounds, and no wrap of already-bound children.

## Commands And Evidence Used

Read basis:

- `Get-Content -Encoding UTF8 discussion/_conventions.md`
- `Get-Content -Encoding UTF8 discussion/_map.md`
- `Get-Content -Encoding UTF8 discussion/implementation/orchestration/wave76-plan.md`
- `Get-Content -Encoding UTF8 discussion/implementation/waves/wave76/wave76-domain-b-rigcontrol-partid-legacy-optional-decoupling-report.md`
- `Get-Content -Encoding UTF8 discussion/implementation/waves/wave75/wave75-final-integration-report.md`
- `Get-Content -Encoding UTF8 discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`

Inspected source/tests/diff:

- `git status --short -uall`
- `git diff -- packages/package-format/src/model-files.ts packages/package-format/src/warp-deformer-projection.ts packages/package-format/src/portable-package-bundle.test.ts`
- `Get-Content -Encoding UTF8 packages/package-format/src/rig-control-contract.test.ts`
- `git diff -- packages/authoring-core/src/rig-control-mutations.ts packages/authoring-core/src/rig-control-mutations.test.ts packages/authoring-core/src/part-mutations.ts packages/authoring-core/src/part-mutations.test.ts packages/authoring-core/src/runtime-graph-adapter.test.ts packages/authoring-core/src/portable-project-bundle.test.ts`
- `git diff -- packages/operation-core/src/payloads/rig-control.ts packages/operation-core/src/operations/create-rotation2d-rig-control.ts packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts packages/operation-core/src/operations/create-warp-deformer.ts packages/operation-core/src/operations/delete-part.ts packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operations/part-operations.test.ts packages/operation-core/src/operation-schemas.test.ts`
- `git diff -- packages/validator-core/src/validators/part-delete-blockers.ts packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
- `git diff -- packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts packages/ai-interface/src/ai-codex-proposal-validation.test.ts`
- `git diff -- apps/editor/src/features/editor-session/model/rig-tool-state.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
- Targeted `rg -n` searches for `partId`, `parentId`, `targetIds`, `checkedTargetRefs`, `payload.partId`, `part_has_rig_controls`, `partHasRigControls`, and create rig operation IDs across the changed files.

I did not rerun Vitest, typecheck, or guard scripts in this review lane. The Domain B implementation report records focused Vitest, `pnpm typecheck`, source-organization, dependency, and diff-whitespace checks as passed; this review independently checked source/test/diff consistency against the spec.

## Residual Risks

- The worktree contains parallel Wave76 Domain A/C changes. This review only assessed the Domain B files and interactions named in the assignment.
- Legacy create-operation payloads can still include `payload.partId`, but Domain B intentionally accepts and ignores it for newly created rig controls. This is consistent with the Wave76 compatibility stance, but external callers should not expect create operations to echo/store that legacy field.
- Full test adequacy is left to the separate Test Adequacy lane; this Spec Compliance review did not rerun the full suite.

## User-Decision Points

None.

## Final Verdict

`pass`
