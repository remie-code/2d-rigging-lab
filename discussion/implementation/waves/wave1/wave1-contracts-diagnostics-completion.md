# Wave 1 contracts diagnostics completion

> 対象 domain: `wave1-contracts-diagnostics`  
> 日付: 2026-05-29  
> Verdict: pass

## 1. 実装概要

### Repository facts

- `packages/contracts/src/check-id.ts` に `CheckId` / `CheckIdSchema` を追加した。
- `packages/contracts/src/target-ref.ts` に `TargetKindSchema` / `TargetKind` / `TargetRefSchema` / `TargetRefDto` を追加した。
- `packages/contracts/src/diagnostics.ts` に `DiagnosticSchema` / `DiagnosticDto` を追加した。
- `packages/contracts/src/diagnostics.test.ts` に diagnostics contract の focused tests を追加した。

### Design decisions

- `TargetRefDto.id` は current contract どおり generic `string` とした。
- `DiagnosticSchema` は existing enum schemas と新規 diagnostic schemas を組み合わせ、default array fields を Zod の `.default([])` で実装した。
- `index.ts` の export 統合は後続の integration domain に委譲した。

## 2. 変更ファイル

- `packages/contracts/src/check-id.ts`
- `packages/contracts/src/target-ref.ts`
- `packages/contracts/src/diagnostics.ts`
- `packages/contracts/src/diagnostics.test.ts`
- `discussion/implementation/reviews/wave1/wave1-contracts-diagnostics-review.md`
- `discussion/implementation/waves/wave1/wave1-contracts-diagnostics-completion.md`

## 3. Verification

| Command | Outcome |
|---|---|
| `pnpm exec vitest run packages/contracts/src/diagnostics.test.ts` | pass。1 file / 30 tests pass。 |
| `pnpm typecheck` | pass |
| `pnpm test` | pass。4 files / 59 tests pass。 |
| `pnpm check:source` | pass |
| `pnpm check` | pass。typecheck / test / check:deps / check:source pass。 |

### Experiment results

- sandbox 内の `pnpm exec vitest run packages/contracts/src/diagnostics.test.ts` と `pnpm test` / `pnpm check` は `node_modules` 読み取りの `EPERM` で一度失敗した。
- 同じ commands は sandbox 外再実行で pass したため、最終結果は実装起因の失敗なし。

## 4. Review Summary

- Design / Development Compliance Review: pass。
- Test Adequacy Review: pass。
- `index.ts`、dependency manifest、lockfile、dependency registry、runtime evidence files、diff envelope files は未編集。

## 5. Remaining Issues And Handoff

- blocking issue はなし。
- user decision point はなし。
- public export と cross-domain integration test は `wave1-contracts-integration` の担当として残る。
