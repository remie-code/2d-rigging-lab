# Wave 27 Domain A Review: Mask Relation Authoring / Operation Foundation

## Verdict

pass

The `setMaskRelation` authoring mutation and operation foundation satisfy the Domain A scope. The implementation stays within `authoring-core` / `operation-core`, supports dry-run and commit behavior, records coherent operation targets and model diffs, materializes package mask relations, and emits deterministic precondition diagnostics for the expected invalid cases.

## Basis Used

- `discussion/implementation/orchestration/wave27-plan.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/waves/wave27/wave27-domain-a-mask-relation-authoring-operation-foundation.md`
- Target source files and tests listed in the Domain A review assignment

I also inspected existing lifecycle and operation patterns in `operation-core`, package mask schema/materialization, `toRuntimeGraph`, and target ref schemas where needed.

## Scope Reviewed

- Authoring mutation and diagnostics:
  - `packages/authoring-core/src/mask-relation-mutations.ts`
  - `packages/authoring-core/src/authoring-mutations.ts`
  - `packages/authoring-core/src/mask-relation-mutations.test.ts`
- Operation support:
  - `packages/operation-core/src/operations/set-mask-relation.ts`
  - `packages/operation-core/src/operations/set-mask-relation.test.ts`
  - `packages/operation-core/src/operation-ids.ts`
  - `packages/operation-core/src/operation-registry.ts`
  - `packages/operation-core/src/payloads/model-edit.ts`
  - `packages/operation-core/src/operation-schemas.test.ts`
- Public entrypoints:
  - `packages/authoring-core/src/index.ts`
  - `packages/operation-core/src/index.ts`
- Domain A implementation report:
  - `discussion/implementation/waves/wave27/wave27-domain-a-mask-relation-authoring-operation-foundation.md`

The unrelated untracked `discussion/implementation/waves/wave27/wave27-validator-composition-diagnostics-report.md` and other runtime/validator worktree edits were treated as out of scope.

## Findings

No blocking or warning findings.

### Operation Integrity

- `setMaskRelation` mutates `session.graph.masks`, increments authoring revision, marks the session dirty, preserves existing `maskGroupHint`, and rejects no-op updates before mutation.
- The operation handler dry-runs against `createDryRunAuthoringSession(session)` and commits against the provided session, matching existing operation handler patterns.
- The handler is registered in `operation-registry` and exported through barrel-only `index.ts` files.
- Valid operation results include relation target refs, relation/drawable target IDs for operation log evidence, model diff entries, and operation IDs.
- Empty arrays are accepted by the operation payload schema so precondition diagnostics can report `operation.setMaskRelation.emptyRelation`; this matches the existing empty-delta precondition pattern for `moveMeshVertex`.

### Composition Semantics

- The behavior is semantic mask relation authoring only: authored package relation plus runtime graph mapping through existing enabled-only `toRuntimeGraph` behavior.
- Disabled relations are truthfully retained in package model files and omitted from runtime graph evidence.
- I found no pixel renderer, clipping compositor, Cubism compatibility claim, or renderer oracle added by Domain A.

### Development Compliance

- Source changes are inside the allowed Domain A source scope plus the delegated report path.
- `index.ts` changes are re-export-only.
- New source files have narrow responsibilities.
- No package manifest, lockfile, external dependency, fixture/contract mutation, runtime broad implementation, validator broad implementation, or editor UI implementation was introduced by Domain A.

### Test Adequacy

Focused tests cover:

- Valid relation creation and package materialization.
- Existing relation update, `maskGroupHint` preservation, and disabled runtime omission.
- Dry-run clone behavior.
- Commit through operation core and operation log target refs.
- Registry support.
- Model diff paths for creation and update.
- Missing mask/target drawables, duplicate mask/target drawables, self-mask, empty relation, and no-op disabled relation diagnostics.
- Existing lifecycle/schema/package adapter/dependency boundary compatibility where practical.

## Verification Performed

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
- `git diff --check -- packages/authoring-core/src packages/operation-core/src discussion/implementation/waves/wave27`
  - pass; Git reported LF-to-CRLF working-copy warnings only
- `pnpm.cmd typecheck`
  - pass in this review run

## Orchestration Compliance

- This Review-Sylph context did not edit source files.
- The only delegated write from this review is this review artifact.
- The assignment and Domain A implementation report separate Gnome implementation from Review-Sylph review. I did not rely on the implementation report alone; I inspected source, tests, diffs, contracts, and verification output.

## Remaining Issues

None for Domain A.

Broader shared-worktree changes in runtime-core, validator-core, and Wave 27 planning/report files remain outside this Domain A review.

## User Decision Points

None.
