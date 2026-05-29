# Wave 5 Domain A Review: operation revision log JSONL foundation

> Review target: `wave5-operation-revision-log-jsonl-foundation`
> Reviewer: Review-Sylph / clean context
> Date: 2026-05-29
> Verdict: `pass`

## Findings

- Blocking / High / Medium: 該当なし。
- Low / Note: `discussion/implementation/waves/wave5/wave5-operation-revision-log-jsonl-foundation-completion.md` は `pnpm typecheck` を parallel domain 由来の失敗として記録しているが、独立再実行時点では `pnpm typecheck` は pass。レビュー結果としては現在の検証結果を優先する。

## Design / Development Compliance Review

- commit 成功 path は handler mutation 後、evidence provider と operation log entry 作成前に package revision を進めている。根拠: `packages/operation-core/src/lifecycle/commit.ts:67`, `packages/operation-core/src/lifecycle/commit.ts:75`, `packages/operation-core/src/lifecycle/commit.ts:76`, `packages/operation-core/src/lifecycle/commit.ts:88`。
- revision increment は `incrementCommittedPackageRevision` に集約され、`basePackageRevision + 1` を 1 回代入する形。根拠: `packages/operation-core/src/package-revision.ts:8`, `packages/operation-core/src/package-revision.ts:19`, `packages/operation-core/src/package-revision.ts:20`。
- dry-run は candidate session のみ temporary revision を適用し、original session と同一 object なら例外にする guard がある。根拠: `packages/operation-core/src/lifecycle/dry-run.ts:47`, `packages/operation-core/src/package-revision.ts:24`, `packages/operation-core/src/package-revision.ts:30`, `packages/operation-core/src/package-revision.ts:35`。
- stale base revision は handler mutation 前に rejected result へ戻る。根拠: `packages/operation-core/src/preconditions.ts:52`, `packages/operation-core/src/preconditions.ts:62`。
- unsupported operation は revision increment / log append 前に return する。根拠: `packages/operation-core/src/lifecycle/commit.ts:48`, `packages/operation-core/src/lifecycle/commit.ts:50`, `packages/operation-core/src/lifecycle/commit.ts:61`。
- duplicate parameter precondition failure は `createParameter` mutation 前に rejected result へ戻る。根拠: `packages/operation-core/src/operations/create-parameter.ts:58`, `packages/operation-core/src/operations/create-parameter.ts:60`, `packages/operation-core/src/operations/create-parameter.ts:83`。
- JSONL codec は schema parse 済みの `OperationLogEntryDto` を 1 entry = 1 line として serialize し、invalid JSON / schema invalid / blank line を reject する。根拠: `packages/operation-core/src/operation-log-jsonl.ts:4`, `packages/operation-core/src/operation-log-jsonl.ts:15`, `packages/operation-core/src/operation-log-jsonl.ts:37`, `packages/operation-core/src/operation-log-jsonl.ts:50`。
- production `operation-core` の forbidden import search は no matches。test-only では既存 integration fixture が `runtime-core` / `validator-core` を relative import しているが、production boundary には該当しない。

## Coverage / Test Notes

- `pnpm exec vitest run packages/operation-core/src`: pass。7 files / 25 tests。
- `pnpm typecheck`: pass。
- `git diff --check -- packages/operation-core/src discussion/implementation/waves/wave5/wave5-operation-revision-log-jsonl-foundation-completion.md`: pass。CRLF warning のみ。
- trailing whitespace search: `rg -n '[ \t]+$' packages/operation-core/src discussion/implementation/waves/wave5/wave5-operation-revision-log-jsonl-foundation-completion.md` は no matches。
- lifecycle tests は dry-run original unchanged、commit revision/log append、stale base rejection、duplicate rejection、unsupported rejection をカバーしている。根拠: `packages/operation-core/src/operation-lifecycle.test.ts:9`, `packages/operation-core/src/operation-lifecycle.test.ts:26`, `packages/operation-core/src/operation-lifecycle.test.ts:54`, `packages/operation-core/src/operation-lifecycle.test.ts:73`, `packages/operation-core/src/operation-lifecycle.test.ts:97`。
- evidence tests は dry-run / commit の evidence provider が candidate revision `base + 1` を見ることをカバーしている。根拠: `packages/operation-core/src/operation-evidence.test.ts:24`, `packages/operation-core/src/operation-evidence.test.ts:25`, `packages/operation-core/src/operation-evidence.test.ts:66`, `packages/operation-core/src/operation-evidence.test.ts:67`。
- JSONL tests は roundtrip、empty log、invalid JSON、schema invalid、blank line rejection をカバーしている。根拠: `packages/operation-core/src/operation-log-jsonl.test.ts:14`, `packages/operation-core/src/operation-log-jsonl.test.ts:27`, `packages/operation-core/src/operation-log-jsonl.test.ts:32`, `packages/operation-core/src/operation-log-jsonl.test.ts:38`, `packages/operation-core/src/operation-log-jsonl.test.ts:44`。

## Source Organization Notes

- `packages/operation-core/src/index.ts` は re-export のみで、barrel-only 方針に合致している。根拠: `packages/operation-core/src/index.ts:1`。
- `package-revision.ts` は revision policy、`operation-log-jsonl.ts` は JSONL codec に責務が分かれている。
- `runtime-validation-evidence-fixture.test.ts` は大きい integration fixture のまま。今回の production source split には反しないが、今後 fixture がさらに増える場合は helper 分割を検討する余地がある。

## Residual Risks

- evidence provider または operation log entry schema parse が例外を投げた場合の rollback は未実装。今回の要求対象である rejected / unsupported / precondition failure とは別系統の例外リスクとして残る。
- JSONL codec は in-memory string codec まで。`operations/log.jsonl` への package file set 接続は後続 Domain C/F の責務。
- invalid request rejection や dry-run 側の unsupported / precondition failure はコード上は mutation 前 return だが、今回の追加テストは主に commit 側 rejection を直接検証している。
