# Wave 4 Domain C Review: Validator Evidence Report Foundation

> Review target: `wave4-validator-evidence-report-foundation`  
> Reviewer: Review-Sylph  
> Date: 2026-05-29  
> Verdict: `pass`

## Scope Reviewed

- `packages/validator-core/src/**`
- `packages/validator-core/package.json` は依存確認のため参照のみ
- Domain completion report:
  - `discussion/implementation/waves/wave4/wave4-validator-evidence-report-foundation-completion.md`

Production source は編集していない。このレビューで作成したファイルは本報告のみ。

## Basis Used

- `discussion/implementation/orchestration/wave4-plan.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave4/wave4-validator-evidence-report-foundation-completion.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Findings

### Blocking

- なし。

### Major

- なし。

### Minor

- なし。

## Design / Development Compliance

- Runtime snapshot IDs are included in validation report evidence: pass。`ValidationReportEvidenceSchema` は `runtimeSnapshotIds` を持ち、`buildRuntimeEvidenceReport` が `validateRuntimeSnapshotEvidence` 経由で evidence に渡している。参照: `packages/validator-core/src/validation-report.ts:57`, `packages/validator-core/src/validation-report.ts:59`, `packages/validator-core/src/runtime-evidence-report.ts:18`, `packages/validator-core/src/runtime-evidence-report.ts:29`。
- Baseline / candidate reports can generate `ValidationDiffDto`: pass。`buildValidationDiff` は baseline / candidate の checks から `newFailures`、`resolvedFailures`、`severityChanges` を構築し、`ValidationDiffSchema.parse` で DTO へ正規化している。参照: `packages/validator-core/src/validation-diff-builder.ts:11`, `packages/validator-core/src/validation-diff-builder.ts:17`, `packages/validator-core/src/validation-diff-builder.ts:20`, `packages/validator-core/src/validation-diff-builder.ts:23`, `packages/validator-core/src/validation-diff-builder.ts:39`。
- Operation log presence can be represented without importing operation-core DTOs: pass。`operation-evidence-report.ts` は validator report evidence の local type だけに依存し、`operation-core` DTO を import していない。参照: `packages/validator-core/src/operation-evidence-report.ts:1`, `packages/validator-core/src/operation-evidence-report.ts:3`, `packages/validator-core/src/operation-evidence-report.ts:9`。
- Full acceptance GUI evidence policy is not over-implemented: pass。Wave 4 の実装は `operationLogPresent` / `operationLogPath` と supplemental refs の表現に留まり、Playwright trace や GUI session evidence の full policy 判定は実装していない。参照: `packages/validator-core/src/runtime-evidence-report.ts:25`, `packages/validator-core/src/runtime-evidence-report.ts:30`。
- `validator-core` forbidden imports: pass。実ソースに `authoring-core` / `operation-core` / `editor-ui` / `ai-interface` の実 import は見つからない。`runtime-core` は Domain C で許可された runtime DTO/API 依存として既存 validator runtime test / runtime-load validator で使われている。
- `index.ts` remains barrel-only: pass。`packages/validator-core/src/index.ts:1` から `:13` は export のみ。
- Source files are split by responsibility: pass。追加された production files は `runtime-evidence-report.ts`、`operation-evidence-report.ts`、`validation-diff-builder.ts`、`validators/runtime-evidence.ts` に分かれており、catch-all file 化は見られない。

## Test Adequacy

- Runtime evidence report: covered。`runtime-evidence-report.test.ts` が runtime snapshot IDs の evidence 反映を確認している。参照: `packages/validator-core/src/runtime-evidence-report.test.ts:12`, `packages/validator-core/src/runtime-evidence-report.test.ts:17`, `packages/validator-core/src/runtime-evidence-report.test.ts:20`。
- Validation diff new / resolved / severity change: covered。単一テストで 3 種の diff を確認している。参照: `packages/validator-core/src/runtime-evidence-report.test.ts:116`, `packages/validator-core/src/runtime-evidence-report.test.ts:120`, `packages/validator-core/src/runtime-evidence-report.test.ts:121`, `packages/validator-core/src/runtime-evidence-report.test.ts:122`。
- Operation log presence / absence: covered。present / absent と path の有無を確認している。参照: `packages/validator-core/src/runtime-evidence-report.test.ts:25`, `packages/validator-core/src/runtime-evidence-report.test.ts:30`, `packages/validator-core/src/runtime-evidence-report.test.ts:32`, `packages/validator-core/src/runtime-evidence-report.test.ts:41`。
- Boundary guard / search: adequate for this wave。テストは source tree を再帰走査し、forbidden package / app surface の static import を検出する。手元の `rg` 検索では guard regex 文字列以外の match はなかった。参照: `packages/validator-core/src/runtime-evidence-report.test.ts:136`, `packages/validator-core/src/runtime-evidence-report.test.ts:140`, `packages/validator-core/src/runtime-evidence-report.test.ts:141`。

## Verification Performed

- `rg -n "@private-2d-rigging-lab/(authoring-core|operation-core)|editor-ui|ai-interface" packages\validator-core\src`
  - Outcome: only `packages\validator-core\src\runtime-evidence-report.test.ts:141` matched because the boundary test contains the forbidden-import regex literal. No actual forbidden import found.
- `rg -n "^\s*(import|export)\b|function|class|const|let|var|=>" packages\validator-core\src\index.ts`
  - Outcome: lines 1-13 are export statements only.
- `pnpm.cmd exec vitest run packages/validator-core/src`
  - First sandbox outcome: failed with EPERM opening `node_modules\.pnpm\vitest@3.1.4_@types+node@22.15.29\node_modules\vitest\vitest.mjs`.
  - Escalated rerun outcome: pass. 3 test files, 10 tests passed.
- `pnpm.cmd typecheck`
  - First sandbox outcome: failed with EPERM opening `node_modules\.pnpm\typescript@5.8.3\node_modules\typescript\bin\tsc`.
  - Escalated rerun outcome: pass.
- `pnpm.cmd check:source`
  - Outcome: pass. `Source organization guard passed.`
- `pnpm.cmd check:deps`
  - Outcome: pass. `Dependency guard passed.`
- `pnpm.cmd test`
  - First sandbox outcome: failed with EPERM opening Vitest.
  - Escalated rerun outcome: pass. 24 test files, 120 tests passed.
- `git diff --check -- packages\validator-core\src discussion\implementation\reviews\wave4\wave4-validator-evidence-report-foundation-review.md`
  - Outcome: exit 0; warning only that `packages/validator-core/src/index.ts` will be replaced by CRLF next time Git touches it.

## Remaining Risks

- `buildValidationDiff` indexes checks by `checkId + target` and keeps the first check for duplicate identities. This matches the domain completion assumption and is acceptable for Wave 4 minimal diff evidence, but future validators that emit multiple failures for the same check/target may need a richer identity.
- `createOperationLogEvidence` represents `operationLogPresent` and optional `operationLogPath`; it does not enforce policy consistency such as "path implies present". This is appropriate for Wave 4 because full acceptance GUI evidence policy is intentionally deferred.
- Boundary tests/search cover static import forms and the dependency guard passes. Dynamic import or generated-source cases are not present in the reviewed files; broader enforcement remains an integration-level concern.

## User-Decision Points

- なし。
