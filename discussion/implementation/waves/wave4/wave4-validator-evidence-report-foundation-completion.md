# Wave 4 Domain C Completion: Validator Evidence Report Foundation

> Domain: `wave4-validator-evidence-report-foundation`  
> Date: 2026-05-29  
> Agent: Orch-Sylph domain agent  
> Verdict: pass

## Basis Used

- `discussion/implementation/orchestration/wave4-plan.md`
- `discussion/implementation/waves/wave3/wave3-final-report.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave2/wave2-final-report.md`
- `discussion/implementation/waves/wave2/integration-review.md`
- Public exports:
  - `packages/validator-core/src/index.ts`
  - `packages/runtime-core/src/index.ts`
  - `packages/package-format/src/index.ts`
  - `packages/contracts/src/index.ts`

## Changed Files

- `packages/validator-core/src/validation-diff-builder.ts`
  - Baseline / candidate validation reportsから `ValidationDiffDto` を生成する builder を追加。
- `packages/validator-core/src/runtime-evidence-report.ts`
  - runtime snapshot ID evidence を持つ validation report builder を追加。
- `packages/validator-core/src/operation-evidence-report.ts`
  - operation log present / absent evidence の最小 helper を追加。
- `packages/validator-core/src/validators/runtime-evidence.ts`
  - runtime snapshot evidence ID の正規化 / validation helper を追加。
- `packages/validator-core/src/runtime-evidence-report.test.ts`
  - runtime snapshot evidence、operation log evidence、validation diff、dependency boundary のテストを追加。
- `packages/validator-core/src/index.ts`
  - barrel export のみ更新。

## Implementation Summary

- `ValidationReportEvidenceSchema` の既存 shape を使い、contracts schema 変更なしで `evidence.runtimeSnapshotIds` と `operationLogPresent` / `operationLogPath` を report に渡せるようにした。
- `buildValidationDiff` は report 内 check を `checkId + target` で照合し、最小の `newFailures`、`resolvedFailures`、`severityChanges` を返す。
- `validator-core` は `runtime-core` public API / DTO を既存通り利用するだけで、`authoring-core` / `operation-core` は import していない。
- Acceptance GUI evidence policy の full implementation は実装していない。operation log evidence flag の表現だけを扱った。

## Verification Performed

- `pnpm exec vitest run packages/validator-core/src`
  - 1回目: sandbox EPERM 後、外部権限で pass。
  - Result: 3 files / 10 tests pass。
- `pnpm exec tsc --noEmit ... packages/validator-core/src/...`
  - validator-core 対象ファイル指定で pass。
- `pnpm typecheck`
  - validator-core 側の `exactOptionalPropertyTypes` エラーは修正済み。
  - 現在は並列 domain の `packages/authoring-core/src/runtime-graph-adapter.test.ts` と `packages/authoring-core/src/runtime-graph-dynamics.ts` の branded ID / optional property errors で fail。
- Forbidden import search:
  - Command: `rg "^import\\s+.*(@private-2d-rigging-lab/(authoring-core|operation-core)|editor-ui|ai-interface)" packages/validator-core/src -g "*.ts"`
  - Result: no matches。
- `git diff --check -- packages/validator-core/src discussion/implementation/waves/wave4/wave4-validator-evidence-report-foundation-completion.md`
  - pass。CRLF warning only。

## Verification Caveats

- `pnpm exec vitest run packages/validator-core/src` の再実行は、後続で `node_modules/.pnpm/node_modules/vite/index.js` が見つからない startup error になった。
- `pnpm install --frozen-lockfile --force` による復元は、並列 domain の `packages/authoring-core/package.json` が lockfile と未同期になっているため `ERR_PNPM_OUTDATED_LOCKFILE` で停止した。
- `pnpm-lock.yaml` はこの domain の禁止範囲なので、内容差分が残っていないことを確認した。

## Remaining Issues

- Blocking issue in this domain: なし。
- Non-blocking / external:
  - 並列 authoring-core domain の package manifest / lockfile 同期と type errors が解消されるまで、root `pnpm typecheck` と Vitest 再実行は安定しない可能性がある。

## User-Decision Points

- なし。

## Provisional Assumptions

- `ValidationDiffDto` の失敗判定は `check.status === "fail"` を source of truth とする。
- 同一 check の照合キーは `checkId + target` とし、message / evidence の変化だけでは `severityChanges` に含めない。
- operation log evidence は operation-core DTO を import せず、validation report evidence の boolean / optional path として表現する。
