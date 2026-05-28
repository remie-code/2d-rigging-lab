# Wave 1 Completion: contracts diff envelopes

> 対象 domain: `wave1-contracts-diff-envelopes`  
> 判定: pass  
> 完了日: 2026-05-29  
> 担当: Orch-Sylph

## 実装概要

`packages/contracts` に model / runtime / validation diff envelope の契約 slice を追加した。public export integration は予定どおり `packages/contracts/src/index.ts` を未編集のまま残している。

## 変更ファイル

- `packages/contracts/src/json-value.ts`
- `packages/contracts/src/field-change.ts`
- `packages/contracts/src/model-diff.ts`
- `packages/contracts/src/runtime-diff.ts`
- `packages/contracts/src/validation-diff.ts`
- `packages/contracts/src/diff-envelopes.test.ts`
- `discussion/implementation/reviews/wave1/wave1-contracts-diff-envelopes-review.md`
- `discussion/implementation/waves/wave1/wave1-contracts-diff-envelopes-completion.md`

## Repository Facts

- `JsonPointerSchema` と recursive `JsonValueSchema` を `json-value.ts` に実装した。
- `FieldChangeSchema` / `FieldChangeDto` を `field-change.ts` に実装し、DTO naming policy 用に `FieldChangeDtoSchema` alias を追加した。
- `ModelDiffSchema` / `ModelDiffDto` を `model-diff.ts` に実装した。
- `RuntimeDiffSchema` / `RuntimeDiffDto` を `runtime-diff.ts` に実装し、runtime ID schemas と `DiagnosticSchema` を再利用した。
- `ValidationDiffSchema` / `ValidationDiffDto` を `validation-diff.ts` に実装し、validation report ID、check ID、target ref、severity、diagnostic schemas を再利用した。
- `diff-envelopes.test.ts` は schemaVersion literal、default arrays、recursive JSON value parsing、runtime dynamics change shape、validation severity changes を検証している。

## Design Decisions

- `typescript-contracts.md` の sketch-required names を主 schema 名として保持した。
- `schema-and-id-conventions.md` の DTO/schema naming policy と両立するため、diff DTO schema には `*DtoSchema` alias を追加した。
- `JsonValueSchema` の object branch は Zod v4 API に合わせて `z.record(z.string(), JsonValueSchema)` とした。意味は設計スケッチの任意 string key JSON object と同じである。

## Verification

- `pnpm typecheck`: pass
- `pnpm exec vitest run packages/contracts/src/diff-envelopes.test.ts`: pass, 6 tests
- `pnpm test`: pass, 6 files / 74 tests
- `pnpm check:source`: pass
- `pnpm check`: pass

補足: 初回の Vitest / `pnpm check` 実行は sandbox 内の `node_modules` 読み取り EPERM で停止した。承認付き再実行では pass。

## Review Outcome

- Design / Development Compliance Review: pass
- Test Adequacy Review: pass
- Review report: `discussion/implementation/reviews/wave1/wave1-contracts-diff-envelopes-review.md`

## 残課題・User Decision Points

- 残課題なし。
- user decision point なし。
