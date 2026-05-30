# Wave 16 Domain B Completion: Drawable Layer Runtime Evidence Regression

> Wave: `drawable-layer-controls-and-visibility-authoring`
> Domain: `wave16-drawable-layer-runtime-evidence-regression`
> Date: 2026-05-30

## Verdict

`pass`

Domain B added a compact runtime / validation / operation evidence regression for drawable layer operations. The regression proves `setDrawOrder` and `setRuntimeVisibility` changes are observable through runtime snapshots, runtime diff dedicated fields, validation reports, operation result evidence, and operation log evidence.

## Files Changed

Operation core tests:

- `packages/operation-core/src/drawable-layer-runtime-evidence.test.ts`

Compact fixture:

- `fixtures/contracts/drawable-layer-runtime-evidence/fixture-manifest.json`
- `fixtures/contracts/drawable-layer-runtime-evidence/request/set-draw-order-commit.request.json`
- `fixtures/contracts/drawable-layer-runtime-evidence/request/hide-front-commit.request.json`
- `fixtures/contracts/drawable-layer-runtime-evidence/request/show-front-commit.request.json`
- `fixtures/contracts/drawable-layer-runtime-evidence/expected/drawable-layer-runtime-evidence-summary.json`

Reports:

- `discussion/implementation/waves/wave16/wave16-drawable-layer-runtime-evidence-regression-completion.md`
- `discussion/implementation/reviews/wave16/wave16-drawable-layer-runtime-evidence-regression-review.md`

## Implementation Summary

- Added a two-drawable layer fixture with deterministic `draw_back` / `draw_front` order and mesh bounds.
- Committed three real operation lifecycle requests:
  - `setDrawOrder` reorders `draw_back` behind `draw_front`.
  - `setRuntimeVisibility` hides `draw_front`.
  - `setRuntimeVisibility` shows `draw_front` again.
- Collected evidence through the existing operation evidence provider hook using:
  - `toRuntimeGraph`;
  - `buildRuntimeEvidence`;
  - `materializeRuntimeEvidenceArtifacts`;
  - `buildRuntimeEvidenceReport`;
  - `buildValidationDiff`;
  - `materializeValidationReportArtifact`.
- Added an expected compact oracle that fixes:
  - baseline/candidate runtime `drawList`;
  - drawable `visible`, `baseDrawOrder`, and `evaluatedDrawOrder`;
  - `drawableRuntimeStateChanges`;
  - `drawListChanges`;
  - validation report status and IDs;
  - operation result evidence IDs and operation log evidence IDs.
- No runtime-core or validator-core source changes were needed.

## Tests Run

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/operation-core/src/drawable-layer-runtime-evidence.test.ts` | pass after sandbox escalation | Initial sandbox run failed with `EPERM` opening Vitest from pnpm `node_modules`; final focused run passed 1 file / 1 test. |
| `pnpm.cmd exec vitest run packages/operation-core/src/drawable-layer-runtime-evidence.test.ts packages/operation-core/src/created-drawable-runtime-evidence.test.ts packages/operation-core/src/runtime-validation-evidence-fixture.test.ts packages/operation-core/src/persisted-operation-evidence-fixture.test.ts packages/runtime-core/src/runtime-evidence.test.ts packages/runtime-core/src/runtime-evidence-artifacts.test.ts packages/validator-core/src/runtime-evidence-report.test.ts` | pass after sandbox escalation | 7 files / 17 tests. |
| `pnpm.cmd run check:source` | pass after sandbox escalation | Source organization guard passed. |
| `pnpm.cmd typecheck` | partial / out-of-scope failure | Root `tsc --noEmit` passed. Editor package typecheck failed in `apps/editor/src/editor-workflow/workflow-controller.ts(347,9)`, outside Domain B write scope. Domain B did not edit editor files. |

## Review Findings And Fixes Applied

Independent Review-Sylph verdict: `pass`.

Findings:

- No blocking or required-change findings in Domain B scope.

Fixes applied after implementation verification:

- Corrected fixture requests to use contract-valid `actor: "test"`.
- Tightened mesh triangle literal typing so root TypeScript checking accepts the new test fixture helper.
- Kept the fixture oracle focused on dedicated runtime state / drawList diff fields and operation/validation evidence references.

## Remaining Issues

- None for Domain B.
- Root `pnpm.cmd typecheck` remains blocked by an out-of-scope editor package type error in `apps/editor/src/editor-workflow/workflow-controller.ts(347,9)`. This should be handled by the editor workflow domain or integration gate.

## User-Decision Points

- None.

## Provisional Assumptions

- Existing validator evidence fixture patterns treat `buildRuntimeEvidenceReport` as the validation evidence path for compact operation-runtime fixtures.
- Reused runtime snapshot ID stems across operation-level compact evidence are existing runtime-core behavior and acceptable for this Domain B oracle because each operation summary is scoped by operation ID and validation report IDs.
