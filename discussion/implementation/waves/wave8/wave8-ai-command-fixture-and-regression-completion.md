# Wave 8 Domain F Completion

> Domain: `wave8-ai-command-fixture-and-regression`
> Date: 2026-05-29
> Verdict: `pass`

## 実装結果

- `fixtures/contracts/ai-dry-run-command-foundation` を追加した。
- fixture sequence は `getEditorState`、`dryRunOperation`、未承認 `commitOperation`、approval event、承認済み `commitOperation`、`getOperationLog` を含む。
- expected transcript は command capabilities、basis、operation ID、evidence refs、approval event を固定する。
- expected summary は dry-run no mutation、未承認 commit no mutation、approved commit mutation、AI actor/surface/provenance boundary を固定する。
- regression test は fixture を読み込み、editor in-process AI command host に流し、actual transcript / summary を expected JSON と比較する。

## 変更ファイル

- `fixtures/contracts/ai-dry-run-command-foundation/fixture-manifest.json`
- `fixtures/contracts/ai-dry-run-command-foundation/request/ai-command-sequence.json`
- `fixtures/contracts/ai-dry-run-command-foundation/expected/ai-command-transcript.json`
- `fixtures/contracts/ai-dry-run-command-foundation/expected/ai-command-summary.json`
- `apps/editor/src/ai-command-host/ai-command-fixture-regression.test.ts`

## 検証

| Check | Result |
|---|---|
| `pnpm exec vitest run packages/ai-interface/src apps/editor/src/ai-command-host` | pass |
| `pnpm check:deps` | pass |
| `pnpm check:source` | pass |
| `pnpm typecheck` | pass |

## 残課題

なし。fixture は text JSON のみで、binary asset や proprietary asset は追加していない。
