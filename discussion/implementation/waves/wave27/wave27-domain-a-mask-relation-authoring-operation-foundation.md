# Wave 27 Domain A: Mask Relation Authoring / Operation Foundation

## Verdict

pass

Domain A implementation is complete within the bounded `authoring-core` / `operation-core` scope. Focused and nearby compatibility tests pass. Repository-wide `pnpm typecheck` is currently blocked by out-of-scope `runtime-core` / `validator-core` mask composition edits already present in the shared worktree; no Domain A files are reported after the operation-core dependency-boundary fix.

## Scope

- Implemented `setMaskRelation` as a supported operation handler.
- Added authoring session mutation for `session.graph.masks`.
- Covered dry-run, commit, operation log target IDs, model diff paths, package materialization, runtime graph mapping through existing adapter behavior, and deterministic operation diagnostics.
- Did not implement runtime-core, validator-core, editor UI, renderer, pixel oracle, Cubism compatibility, fixtures/contracts, package manifests, or lockfiles.

## Files Changed By Responsibility

- Authoring mutation:
  - `packages/authoring-core/src/mask-relation-mutations.ts`
  - `packages/authoring-core/src/authoring-mutations.ts`
  - `packages/authoring-core/src/index.ts` (barrel re-export only)
- Authoring tests / package materialization evidence:
  - `packages/authoring-core/src/mask-relation-mutations.test.ts`
- Operation handler / registry / IDs / payload:
  - `packages/operation-core/src/operations/set-mask-relation.ts`
  - `packages/operation-core/src/operation-registry.ts`
  - `packages/operation-core/src/operation-ids.ts`
  - `packages/operation-core/src/payloads/model-edit.ts`
  - `packages/operation-core/src/index.ts` (barrel re-export only)
- Operation tests / schema evidence:
  - `packages/operation-core/src/operations/set-mask-relation.test.ts`
  - `packages/operation-core/src/operation-schemas.test.ts`
- Persistent report:
  - `discussion/implementation/waves/wave27/wave27-domain-a-mask-relation-authoring-operation-foundation.md`

## Verification

- `pnpm.cmd exec vitest run packages/authoring-core/src/mask-relation-mutations.test.ts packages/operation-core/src/operations/set-mask-relation.test.ts`
  - pass: 2 files, 9 tests
- `pnpm.cmd exec vitest run packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/operations/set-mask-relation.test.ts`
  - pass: 2 files, 11 tests
- `pnpm.cmd exec vitest run packages/authoring-core/src/dependency-boundary.test.ts packages/operation-core/src/dependency-boundary.test.ts packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/authoring-core/src/package-document-adapter.test.ts`
  - pass: 5 files, 30 tests
- `pnpm.cmd run check:source`
  - pass
- `pnpm.cmd run check:deps`
  - pass
- `pnpm.cmd typecheck`
  - blocked by out-of-scope errors in `packages/runtime-core/src/snapshot-comparison.ts`, `packages/runtime-core/src/viewer-evaluation.ts`, and `packages/validator-core/src/validators/mask-composition.ts`.

## Evidence

- Dry-run:
  - `setMaskRelationOperationHandler.dryRun` applies to `createDryRunAuthoringSession(session)`.
  - Focused test verifies baseline session remains unchanged while candidate session receives `session.graph.masks`.
- Commit / operation log:
  - `setMaskRelationOperationHandler` is registered in `operation-registry`.
  - `createOperationCore().commitOperation(...)` appends a log entry with `operationType: "setMaskRelation"` and target IDs including relation ID plus mask/target drawable IDs.
- Model diff:
  - Creation emits `added: [{ kind: "maskRelation", id, path: "/model/masks/<id>" }]`.
  - Creation and update fields use `/model/masks/<maskRelationId>/...` paths and include `operationIds`.
- Package materialization:
  - Authoring test verifies `buildPackageDocumentModelFiles(session, baseModelFiles).masks.masks` materializes the authored relation.
  - Existing `package-document-adapter.test.ts` still passes.
- Diagnostics:
  - Operation diagnostics cover missing mask drawable, missing target drawable, duplicate mask drawable, duplicate target drawable, self-mask, empty relation, and unchanged disabled no-op.
  - Empty arrays are allowed by `SetMaskRelationPayloadSchema` so operation preconditions can emit `operation.setMaskRelation.emptyRelation`, matching the existing `moveMeshVertex` empty-delta pattern.

## Assumptions

- When `maskRelationId` is omitted, Domain A derives `maskrel_mask_<sorted-mask-tokens>_target_<sorted-target-tokens>` from drawable IDs. Stored mask/target arrays preserve payload order; the derived ID canonicalizes only the ID token.
- `enabled=false` creation is materialized because the package schema supports disabled mask relations. Disabled relations remain omitted from runtime graph through existing `toRuntimeGraph` behavior.
- An unchanged existing relation, including an unchanged disabled relation, is rejected with warning severity as a no-op.
- `maskGroupHint` is preserved on update when already present, but not authored by this operation because the payload schema does not expose it.

## Remaining Issues

- Full repo typecheck cannot currently pass until the out-of-scope runtime/validator mask composition edits are fixed by their owning domains.
- The shared worktree contains unrelated dirty files outside Domain A, including runtime-core, validator-core, and implementation planning docs. Domain A did not edit those files.

## User Decision Points

None for Domain A.
