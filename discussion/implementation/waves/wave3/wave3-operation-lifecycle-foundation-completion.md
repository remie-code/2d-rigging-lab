# Wave 3 Domain C Completion: operation lifecycle foundation

> Domain: `wave3-operation-lifecycle-foundation`  
> Date: 2026-05-29  
> Verdict: pass

## Changed Files

- `packages/operation-core/package.json`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/dependency-boundary.test.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/preconditions.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operation-log.ts`
- `packages/operation-core/src/operation-core.ts`
- `packages/operation-core/src/lifecycle/dry-run.ts`
- `packages/operation-core/src/lifecycle/commit.ts`
- `packages/operation-core/src/operations/create-parameter.ts`
- `packages/operation-core/src/operation-lifecycle.test.ts`
- `discussion/implementation/waves/wave3/wave3-operation-lifecycle-foundation-completion.md`

## Basis Used

- `discussion/implementation/orchestration/wave3-plan.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave3/wave3-authoring-core-session-foundation-completion.md`
- `discussion/implementation/reviews/wave3/wave3-authoring-core-session-foundation-review.md`
- `discussion/implementation/waves/wave3/wave3-operation-contract-dto-foundation-completion.md`
- `discussion/implementation/reviews/wave3/wave3-operation-contract-dto-foundation-review.md`
- `packages/authoring-core/src/index.ts`
- `packages/operation-core/src/index.ts`
- `packages/contracts/src/index.ts`

## Implementation Summary

- `operation-core` に最小 lifecycle API を追加した。
  - `dryRunOperation(session, requestInput)` は request を Zod DTO で parse し、authoring session clone に `createParameter` mutation を適用して `status: "dry_run"` の result を返す。
  - `commitOperation(session, requestInput, options)` は渡された authoring session に authoring-core 公開 API の `createParameter` を適用し、`status: "committed"` result と `OperationLogEntryDto` を返す。
  - `createOperationCore()` は in-memory operation log を持つ小さな facade を返す。
- 最初の supported operation として `createParameter` handler を追加した。
- Duplicate parameter、request lifecycle mode mismatch、base package revision mismatch、unsupported operation は mutation 前に rejected result を返す。
- `modelDiff` は `parameter` target ID、base/candidate authoring revision、operation ID を含む。
- Operation log entry は operation ID、transaction ID、actor、surface、payload、result、target IDs、provenance ID を保持する。
- Runtime / validation artifacts は Wave 3 方針どおり生成せず、result defaults の空配列に留めた。
- `index.ts` は barrel export のみに維持した。

## Verification Performed

- `pnpm install --no-lockfile --offline --config.confirmModulesPurge=false`: pass。`@private-2d-rigging-lab/authoring-core` workspace link 更新のため実行。`pnpm-lock.yaml` は変更なし。
- `pnpm typecheck`: pass。
- `pnpm exec vitest run packages/operation-core/src`: pass。3 files / 9 tests passed。sandbox では `EPERM` で `vitest.mjs` open に失敗したため、外部権限で再実行。
- `pnpm exec vitest run packages/authoring-core/src packages/operation-core/src`: pass。5 files / 13 tests passed。authoring-core 公開 API との統合確認として外部権限で実行。
- `pnpm run check:source`: pass。
- `pnpm run check:deps`: pass。
- Boundary search: `rg '@private-2d-rigging-lab/(editor-ui|ai-interface|renderer-adapter|runtime-core|validator-core)' packages/operation-core/src` は match なし。
- `git diff --check -- packages/operation-core discussion/implementation/waves/wave3`: pass。LF/CRLF warning のみ。

## Test Coverage Added

- `createParameter` dry-run が `status: "dry_run"` を返し、original session の parameter / authoring revision / dirty flag / operation log を変更しないことを確認。
- `createParameter` commit が `status: "committed"` を返し、authoring revision と operation log length を increment することを確認。
- Duplicate parameter commit が `status: "rejected"` を返し、authoring revision と operation log を変更しないことを確認。
- Operation log entry の operation ID、transaction ID、actor、surface、payload、result、target IDs、provenance ID を確認。
- `operation-core` が GUI / AI / renderer / runtime / validator packages を import していないことを boundary test で確認。

## Remaining Issues

- Blocking: なし。
- Non-blocking: Wave 3 の最小 lifecycle は package revision を increment しない。現 domain の required verification は authoring revision / operation log increment であり、package revision persistence は save/write integration の domain で再確認が必要。
- Non-blocking: `createParameter` の caller-supplied `parameterId` がない場合は display name から deterministic ID を生成する暫定実装。将来の ID policy が固まったら operation ID / target ID generation を見直す。
- Non-blocking: operation log は in-memory foundation。`operations/log.jsonl` への永続化は package write / fixture integration の後続 domain に委ねる。

## User-Decision Points

- 現時点でユーザー判断が必要な点はなし。

## Provisional Assumptions

- `operationId` 未指定時は operation type と target hint から `op_*` ID を生成してよい。
- `provenanceId` / `transactionId` は Wave 3 foundation では operation ID 由来の deterministic ID で十分。
- Runtime snapshot / validation report generation は Wave 3 Domain C の範囲外であり、空配列 default が契約上許容される。
- Duplicate detection は `parameterId` の一意性で判断し、display name の重複はこの domain では許容する。

## Coordinated Authoring-Core Edits

- なし。`authoring-core` の public API gap は blocking ではなく、Domain C では `createDryRunAuthoringSession`、`createParameter`、`getParameterById` の公開 API だけを使用した。
