# Wave 27 Domain D Completion: Composition Contract Fixtures

> Target: `wave27-composition-contract-fixtures`
> Wave: Wave 27 `mask-clipping-opacity-authoring-v1`
> 呼び出し元: Orch-Sylph
> Verdict: `pass`

## Summary

Domain D の contract fixture を実装した。

`setMaskRelation` operation から、package `model/masks.json` materialization、runtime snapshot / diff、validator report、Viewer-facing evidence までを、`fixtures/contracts/wave27-composition-contract-fixtures/` の deterministic JSON fixture として固定した。

この fixture は semantic mask relation / opacity evidence の証跡であり、pixel clipping renderer、bitmap mask bytes、PSD/image decode、外部依存、Editor UI 実装は含まない。

## Files Changed

Fixture artifacts:

- `fixtures/contracts/wave27-composition-contract-fixtures/fixture-manifest.json`
- `fixtures/contracts/wave27-composition-contract-fixtures/baseline-package.json`
- `fixtures/contracts/wave27-composition-contract-fixtures/request/set-mask-relation-dry-run.request.json`
- `fixtures/contracts/wave27-composition-contract-fixtures/request/set-mask-relation-commit.request.json`
- `fixtures/contracts/wave27-composition-contract-fixtures/expected/operation-result-evidence-summary.json`
- `fixtures/contracts/wave27-composition-contract-fixtures/expected/package-materialization-summary.json`
- `fixtures/contracts/wave27-composition-contract-fixtures/expected/runtime-snapshot-summary.json`
- `fixtures/contracts/wave27-composition-contract-fixtures/expected/runtime-diff-summary.json`
- `fixtures/contracts/wave27-composition-contract-fixtures/expected/validation-report-summary.json`
- `fixtures/contracts/wave27-composition-contract-fixtures/expected/viewer-facing-evidence-summary.json`

Focused fixture test:

- `packages/operation-core/src/wave27-composition-contract-fixtures.test.ts`

Report:

- `discussion/implementation/waves/wave27/wave27-domain-d-composition-contract-fixtures.md`

## Evidence Implemented

- Operation request fixtures parse through `OperationRequestSchema` for dry-run and commit.
- `createOperationCore` executes `setMaskRelation` and pins operation result evidence:
  - precondition checked targets,
  - model diff,
  - generated runtime snapshot/state/state-sequence refs,
  - generated validation report IDs,
  - committed operation log snapshot/report refs.
- Package materialization is fixed through `toPackageDocument`, including deterministic `masks-file-v1` content.
- Runtime evidence is fixed through `buildRuntimeEvidence`:
  - candidate snapshot includes `maskrel_wave27_body_clip`,
  - diff contains stable `/masks/maskrel_wave27_body_clip` semantic path,
  - drawable opacity evidence records fixture opacities `0.6` and `0.82`.
- Validator evidence is fixed through `validatePackageRuntime` and `buildValidationDiff`.
- Viewer-facing evidence is fixed through `evaluateViewerRuntimeSnapshot`, including sorted `maskRelationEvidence` and `drawableOpacityEvidence`.
- Invalid mask relation coverage is fixed with `mask.targetMissing` for `maskrel_wave27_missing_target`.

## Verification

Gnome ran:

- `pnpm.cmd exec vitest run packages/operation-core/src/wave27-composition-contract-fixtures.test.ts`: pass, 1 file / 4 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd test:unit`: pass, 130 files / 680 tests.

## Scope Containment

No changes were made to:

- `apps/editor/**`
- package manifests or lockfiles
- broad runtime / validator / operation implementation
- public `index.ts` implementation logic
- real asset bytes, PSD parser, image decode, file picker, archive, or external dependencies
- review report paths under `discussion/implementation/reviews/wave27/**`

## Remaining Issues

No Domain D source fix is currently required.

Review-Sylph still needs to perform the independent design / development compliance review and test adequacy review.

No user-decision points are open for Domain D.
