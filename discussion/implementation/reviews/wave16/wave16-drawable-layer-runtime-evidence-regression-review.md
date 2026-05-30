# Wave 16 Domain B Review: Drawable Layer Runtime Evidence Regression

> Wave: `drawable-layer-controls-and-visibility-authoring`
> Domain: `wave16-drawable-layer-runtime-evidence-regression`
> Date: 2026-05-30

## Verdict

`pass`

Independent Review-Sylph found no blocking or required-change findings in Domain B scope.

## Review Basis

- `discussion/implementation/orchestration/wave16-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/implementation/waves/wave16/wave16-drawable-layer-operation-foundation-completion.md`
- `discussion/implementation/reviews/wave16/wave16-drawable-layer-operation-foundation-review.md`
- `packages/operation-core/src/drawable-layer-runtime-evidence.test.ts`
- `fixtures/contracts/drawable-layer-runtime-evidence/**`
- Focused verification results from the Domain B loop.

## Findings

### Open

None.

### Noted For Integration

1. Root `pnpm.cmd typecheck` still fails in out-of-scope editor workflow code.
   - Location: `apps/editor/src/editor-workflow/workflow-controller.ts(347,9)`.
   - Classification: not a Domain B blocker because Domain B did not edit editor files and editor workflow is outside allowed write scope.
   - Integration impact: the whole wave cannot pass final typecheck until the editor domain or integration gate resolves it.

## Lane Review

| Lane | Result | Notes |
|---|---|---|
| Runtime Truthfulness | pass | Evidence is built from committed operation baseline/candidate sessions via `toRuntimeGraph` and `buildRuntimeEvidence`, not hand-authored runtime snapshots. |
| Operation Integrity | pass | The regression commits three real operations, checks committed status, target IDs, model diff paths, operation result evidence IDs, and operation log evidence IDs. |
| Test Adequacy | pass | Coverage includes runtime snapshot before/after state, `drawableRuntimeStateChanges`, `drawListChanges`, validation report status/IDs, and operation evidence references for reorder, hide, and show. |
| Development Compliance | pass | Changes are limited to `packages/operation-core/src/*evidence*.test.ts`, `fixtures/contracts/**`, and required Domain B reports. No editor, runtime-core, validator-core, contract, or Domain A foundation source was modified. |
| Determinism | pass | The oracle fixes deterministic draw order, drawList membership/order changes, visibility state, package revisions, report IDs, and operation evidence references. |

## Verification Reviewed

- `pnpm.cmd exec vitest run packages/operation-core/src/drawable-layer-runtime-evidence.test.ts packages/operation-core/src/created-drawable-runtime-evidence.test.ts packages/operation-core/src/runtime-validation-evidence-fixture.test.ts packages/operation-core/src/persisted-operation-evidence-fixture.test.ts packages/runtime-core/src/runtime-evidence.test.ts packages/runtime-core/src/runtime-evidence-artifacts.test.ts packages/validator-core/src/runtime-evidence-report.test.ts` passed 7 files / 17 tests.
- `pnpm.cmd run check:source` passed.
- `pnpm.cmd typecheck` root `tsc --noEmit` passed, then editor package typecheck failed in out-of-scope `apps/editor/src/editor-workflow/workflow-controller.ts(347,9)`.

## Remaining Issues

- None for Domain B.
- Out-of-scope editor typecheck failure remains for the wave integration gate.

## User-Decision Points

- None.

## Provisional Assumptions

- The existing project pattern accepts validator-core `buildRuntimeEvidenceReport` as the validation evidence path for compact operation fixtures.
- Reused runtime snapshot ID stems across operation-level compact evidence are existing runtime-core behavior, not a Domain B blocker.
