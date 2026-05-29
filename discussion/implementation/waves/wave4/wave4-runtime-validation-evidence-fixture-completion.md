# Wave 4 Domain E Completion: runtime validation evidence fixture

> Domain: `wave4-runtime-validation-evidence-fixture`  
> 実施日: 2026-05-29  
> 担当: Orch-Sylph domain agent  
> Verdict: pass

## Changed Files

- `fixtures/contracts/minimal-operation-runtime-evidence/fixture-manifest.json`
  - runtime / validation evidence 付き createParameter fixture の manifest を追加。
- `fixtures/contracts/minimal-operation-runtime-evidence/baseline-authoring-input.json`
  - `minimal-valid-package` を baseline package / authoring input として参照。
- `fixtures/contracts/minimal-operation-runtime-evidence/request/create-parameter-dry-run.request.json`
  - runtime / validation evidence dry-run 用 request を追加。
- `fixtures/contracts/minimal-operation-runtime-evidence/request/create-parameter-commit.request.json`
  - runtime / validation evidence commit 用 request を追加。
- `fixtures/contracts/minimal-operation-runtime-evidence/expected/runtime-snapshot-summary.json`
  - baseline / candidate runtime snapshot IDs、candidate parameter summary、generated runtime state refs を記録。
- `fixtures/contracts/minimal-operation-runtime-evidence/expected/validation-report-summary.json`
  - dry-run / commit の validation report IDs、runtime snapshot evidence、operation log evidence summary を記録。
- `fixtures/contracts/minimal-operation-runtime-evidence/expected/runtime-diff-summary.json`
  - runtime diff の before / after snapshot ID と diff count summary を記録。
- `fixtures/contracts/minimal-operation-runtime-evidence/expected/validation-diff-summary.json`
  - dry-run / commit validation diff summary を記録。
- `fixtures/contracts/minimal-operation-runtime-evidence/expected/operation-result-evidence-summary.json`
  - operation result / commit log に載る runtime / validation evidence refs の期待値を記録。
- `packages/operation-core/src/runtime-validation-evidence-fixture.test.ts`
  - fixture request parse、provider wiring、dry-run non-mutation、commit mutation/log/evidence summary を検証。

## Basis Used

- `discussion/implementation/orchestration/wave4-plan.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave4/wave4-operation-evidence-hook-foundation-completion.md`
- `discussion/implementation/reviews/wave4/wave4-operation-evidence-hook-foundation-review.md`
- Existing fixtures:
  - `fixtures/contracts/minimal-valid-package/**`
  - `fixtures/contracts/minimal-operation-create-parameter/**`
- Public exports:
  - `packages/authoring-core/src/index.ts`
  - `packages/runtime-core/src/index.ts`
  - `packages/validator-core/src/index.ts`
  - `packages/operation-core/src/index.ts`

## Implementation Summary

- 新規 text JSON fixture `minimal-operation-runtime-evidence` を追加した。
- Fixture は `minimal-valid-package` を baseline package とし、`createParameter` の dry-run / commit request を持つ。
- Expected summaries は runtime snapshot、validation report、runtime diff、validation diff、operation result evidence refs を分離して保存した。
- `operation-core` の fixture test で、Domain D の `OperationEvidenceProvider` に test-local provider を渡して次を接続した。
  - `authoring-core`: `toRuntimeGraph`
  - `runtime-core`: `buildRuntimeEvidence`
  - `validator-core`: `buildRuntimeEvidenceReport` / `buildValidationDiff`
  - `operation-core`: `createOperationCore` evidence provider hook
- Dry-run は original session の `authoringRevision` / `dirty` / parameter absence / operation log length が変わらないことを確認した。
- Commit は session mutation、operation log append、result/log entry の runtime snapshot IDs / validation report IDs を fixture summary と照合した。
- Production source、barrel export、package manifest、lockfile、contracts、package-format、apps は変更していない。

## Verification Performed

- `pnpm.cmd exec vitest run packages/operation-core/src/runtime-validation-evidence-fixture.test.ts`
  - sandbox では EPERM で `vitest.mjs` open に失敗。
  - 権限付き再実行で pass。1 file / 3 tests pass。
- `pnpm.cmd typecheck`
  - pass。
- `pnpm.cmd exec vitest run packages/operation-core/src`
  - sandbox では EPERM で `vitest.mjs` open に失敗。
  - 権限付き再実行で pass。6 files / 18 tests pass。
- `pnpm.cmd check:source`
  - pass。`Source organization guard passed.`
- `pnpm.cmd check:deps`
  - pass。`Dependency guard passed.`
- `pnpm.cmd exec vitest run packages/authoring-core/src packages/runtime-core/src packages/validator-core/src packages/operation-core/src`
  - 権限付きで pass。17 files / 43 tests pass。
- `git diff --check -- fixtures/contracts/minimal-operation-runtime-evidence packages/operation-core/src/runtime-validation-evidence-fixture.test.ts`
  - pass。

## Remaining Issues

- Blocking: なし。
- Non-blocking: `operation-core` production package は runtime-core / validator-core に依存しない設計のため、integration test は test-only relative imports で runtime / validator helper を読む。Production dependency は増やしていない。
- Non-blocking: runtime helper の current diff builder は「baseline に存在しない新規 parameter」を parameterChanges として数えないため、runtime diff summary は before / after snapshot ID と empty diff counts を期待値にしている。Candidate snapshot summary では追加 parameter と authored value を確認している。
- Non-blocking: fixture manifest sketch には `operationResult` kind がないため、operation result evidence summary は commit log/result evidence として `operationLog` expected artifact に紐付けた。

## User-Decision Points

- 現時点で Domain E pass を止める user decision はなし。
- 将来 fixture manifest schema に `operationResult` artifact kind を追加するかは、fixture contract 更新時の判断事項。
- 将来 runtime diff が新規 parameter の追加を明示的に表すべきなら、runtime-core diff semantics の別 domain 判断が必要。

## Provisional Assumptions

- Runtime / validation evidence は JSON summary と generated refs で意味を持ち、filesystem artifact writing は Domain E の必須条件ではない。
- GUI evidence は Wave4 Domain E の対象外であり、operation log / runtime snapshot / validation report evidence の接続証明で足りる。
- Commit 時の `packageRevision` increment は Domain D review で non-blocking residual risk とされたため、Domain E fixture も現行実装どおり `packageRevision: 0` を期待値にしている。
- Provider failure atomicity は Domain D の残リスクであり、この fixture は success path の integration evidence を対象にする。

## Production-Source Integration Fix Need

- なし。Production source 変更なしで fixture / integration test を追加できた。
