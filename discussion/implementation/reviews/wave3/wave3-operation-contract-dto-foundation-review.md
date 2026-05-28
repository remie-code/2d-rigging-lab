# Wave 3 Domain B Review: operation contract DTO foundation

> Review role: Review-Sylph  
> Date: 2026-05-29  
> Verdict: pass

## 1. Scope Reviewed

- Review target:
  - `packages/operation-core/package.json`
  - `packages/operation-core/src/**`
- Allowed report output:
  - `discussion/implementation/reviews/wave3/wave3-operation-contract-dto-foundation-review.md`
- Production source は編集していない。

## 2. Basis Used

- `discussion/implementation/orchestration/wave3-plan.md`
- `discussion/implementation/waves/wave2/wave2-final-report.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/design/module-contracts/typescript-contracts.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave3/wave3-operation-contract-dto-foundation-completion.md`
- 実ファイル:
  - `packages/operation-core/package.json`
  - `packages/operation-core/src/index.ts`
  - `packages/operation-core/src/operation-type.ts`
  - `packages/operation-core/src/operation-payload.ts`
  - `packages/operation-core/src/operation-precondition.ts`
  - `packages/operation-core/src/operation-request.ts`
  - `packages/operation-core/src/operation-result.ts`
  - `packages/operation-core/src/operation-log-entry.ts`
  - `packages/operation-core/src/payloads/*.ts`
  - `packages/operation-core/src/*.test.ts`

## 3. Findings

### Blocking

- なし。

### Warning

- なし。

### Notes / Evidence

- Operation catalog は `packages/operation-core/src/operation-type.ts:3` の `operationTypes` と `packages/operation-core/src/operation-type.ts:29` の `OperationTypeSchema` として定義されている。
- Large operation payload union は `index.ts` ではなく、`packages/operation-core/src/operation-payload.ts:35` の cohesive composition file に置かれている。
- Payload schema は import source、model edit、dynamics、rig control に分割されている。
  - `packages/operation-core/src/payloads/import-source.ts:18`
  - `packages/operation-core/src/payloads/model-edit.ts:64`
  - `packages/operation-core/src/payloads/dynamics.ts:27`
  - `packages/operation-core/src/payloads/rig-control.ts:11`
- Operation request / result / log / precondition DTO は分離された責務ファイルにある。
  - `packages/operation-core/src/operation-request.ts:14`
  - `packages/operation-core/src/operation-result.ts:21`
  - `packages/operation-core/src/operation-log-entry.ts:17`
  - `packages/operation-core/src/operation-precondition.ts:3`
- `packages/operation-core/src/index.ts` は export のみで、barrel-only 要件を満たす。
- Execution lifecycle は見つからなかった。`dryRunOperation` / `commitOperation` / `undoOperation` / `redoOperation` の実装はなく、この domain の DTO foundation 範囲に収まっている。
- Forbidden package import は見つからなかった。production source の direct external import は `@private-2d-rigging-lab/contracts` と `zod` に閉じている。
- Catch-all の `types.ts` / `schemas.ts` / `utils.ts` / `helpers.ts` は `packages/operation-core/src/**` に見つからなかった。

## 4. Test Adequacy

Required coverage に対する確認:

- Representative payload parse: `packages/operation-core/src/operation-schemas.test.ts:107` で import source、model edit、dynamics、rig control の代表 payload を parse。
- `dryRun=true` preservation: `packages/operation-core/src/operation-schemas.test.ts:118` で確認。
- Operation result / log required fields parse: `packages/operation-core/src/operation-schemas.test.ts:125` で確認。
- Invalid operation type / invalid ID prefix fail: `packages/operation-core/src/operation-schemas.test.ts:160` で確認。
- Barrel-only / boundary guard: `packages/operation-core/src/dependency-boundary.test.ts:8` と `packages/operation-core/src/dependency-boundary.test.ts:23` で確認。

判定: Domain B の要求テストとして十分。全 operation payload の個別 exhaustive parse ではないが、rubric は representative payload parse を要求しており、現時点では blocking ではない。

## 5. Verification Performed

| Command | Outcome |
|---|---|
| `pnpm.cmd exec vitest run packages/operation-core/src` | sandbox 内では `EPERM` で `vitest.mjs` の open に失敗。sandbox 外再実行で pass: 2 files / 6 tests passed. |
| `pnpm.cmd typecheck` | sandbox 内では `EPERM` で TypeScript compiler の open に失敗。sandbox 外再実行で pass. |
| `pnpm.cmd run check:source` | pass. `Source organization guard passed.` |
| `pnpm.cmd run check:deps` | pass. `Dependency guard passed.` |
| `git diff --check -- packages/operation-core discussion/implementation/waves/wave3` | pass。LF/CRLF warning のみ。 |
| `rg '@private-2d-rigging-lab/(authoring-core|editor-ui|ai-interface|renderer-adapter|runtime-core|validator-core)' packages/operation-core/src -n` | no matches. |
| `rg 'dryRunOperation|commitOperation|undoOperation|redoOperation|runDynamicsPreviewSequence\(' packages/operation-core/src -n` | no matches. |
| `rg --files packages/operation-core/src \| rg '(^\|/\|\\)(types\|schemas\|utils\|helpers)\.ts$'` | no matches. |
| `rg "from \"@private-2d-rigging-lab/(authoring-core|editor-ui|ai-interface|renderer-adapter|runtime-core|validator-core)\"|from '@private-2d-rigging-lab/(authoring-core|editor-ui|ai-interface|renderer-adapter|runtime-core|validator-core)'" packages/operation-core/src -n` | PowerShell quoting issue で失敗。上記の single-quoted `rg` command で再確認済み。 |

## 6. Remaining Risks

- `operation-payload.ts` は現時点では cohesive な union composition file と判断できるが、catalog が拡張される場合は operation family ごとの composition split を再評価する必要がある。
- `OperationLogEntrySchema` は top-level `operationType` と nested `payload.operationType` の一致を Zod refine で強制していない。現行 contract sketch と completion report の扱いでは blocking ではないが、operation log integrity を強める段階で検討余地がある。
- `CreateParameterPayloadSchema` は optional `parameterId` を持つ。completion report では ID prefix / uniqueness precondition を DTO 境界で扱うための provisional assumption と説明されている。現行 Domain B では許容できるが、lifecycle 実装時に ID ownership と generation policy を確定する必要がある。

## 7. User-Decision Points

- この domain の pass / needs_changes 判定に必要な user decision はなし。
- 後続 lifecycle domain では、operation log の nested/top-level operation type 一致強制と `parameterId` の caller-supplied policy を必要に応じて設計判断に戻す。
