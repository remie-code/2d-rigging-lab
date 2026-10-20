# 操作の記録をやめる completion

状態: Wave 1〜3 完了（2026-10-20）。ブランチ `package-format/drop-operation-log`、master 未マージ。
Basis: [判断](../../../design/drop-operation-log.md)、[計画](../../orchestration/drop-operation-log-plan.md)。レビュー: [Wave 1](../../reviews/drop-operation-log/wave-1.md)、[Wave 2](../../reviews/drop-operation-log/wave-2.md)。

## コミット

| コミット | 内容 |
|---|---|
| a774b4b7 | 判断と計画 |
| 277f041d | Wave 1: 保存時のテクスチャ判定で、判定ごとにテクスチャ集合全体を複製していた不具合を修正 |
| a2267e91 | Wave 2: 記録という概念を全入口から撤去（コードとテスト用データ） |
| （本コミット） | Wave 3: 文書の改定と Superseded 注記、本 completion とレビュー記録 |

## 結果（実験結果）

計測条件: 実モデル `second-rigging-6-sol/workspace` r2152 の複製（`.git` なし）で、CLI から `addDrawableFromImage` を実行。

| 指標 | 着手前 | Wave 1 後 | Wave 2 後 |
|---|---|---|---|
| dry-run | 17.0 秒 | — | 3.0 秒 |
| API の commit | 32.9 秒 | — | 5.1 秒 |
| 保存計画の作成 | 4.8 秒 | 1.0 秒 | — |
| 最大メモリ（commit） | 約 5.1GB | — | 約 1.4GB |

- API の commit 後も、既存の `operations/log.jsonl`（248,813,475 バイト）はハッシュ・サイズ・更新時刻とも不変。manifest の `operationLog` 欄は消える。
- git 側の計測（Wave 2 前の Sylph 計測）では、1 操作ごとの `git add` が 3.3 秒、`.git` の増加が 62MB だった。記録を書かなくなったため、どちらも解消する見込み。ただし Wave 2 後は計測していない。

## 振る舞いの変化（設計判断の帰結）

- commit の戻り値は `{ result }` だけになった。result と modelDiff は不変。
- AI 応答の evidenceRefs から `operations/log.jsonl#<id>` が消えた。
- **出荷前チェック（product preflight）の authoring workflow**: GUI 証拠（guiEvidence）だけで判定する。無ければ not_evaluated になる（ユーザー確認済み、当面このまま）。
- `executeAiReadCommand` に読み取り以外のコマンドを渡すと、例外を投げる（以前は `getOperationLog` の not_implemented を返していた）。
- contracts の `TransactionId` / `TransactionIdSchema` を撤去した。

## 検証

| 確認 | 結果 |
|---|---|
| `pnpm typecheck` / `pnpm typecheck:authoring-host` | 通過 |
| `pnpm test:unit` | 250 ファイル / 1552 件通過 |
| `pnpm test:authoring-host` | 164 件中 163 件通過 |
| `pnpm check:deps` / `pnpm check:soul-zone` | 通過 |
| `pnpm check:source` | 違反 1 件 |

- `test:authoring-host` の失敗 1 件は、既存の `state-directory-guard.test.ts`（ENOENT）。
- `check:source` の違反 1 件は、既存の担当外違反（`apps/runtime-player/src/main/physiology/index.ts`）。
- 新しいテスト `apps/authoring-host/src/legacy-operation-log-file.test.ts` で、記録ファイルと manifest 欄を持つ既存パッケージを開いて保存できることを確かめた。記録ファイルは読まれず、バイトも不変。
- エディタの vitest で `diagnostics-jump-actions.test.ts` が 4 件失敗している。今回触っていないファイルで、記録とも無関係（Gnome 報告）。

## 文書

- **直接改めたもの:**
  - 受け入れ基準 AC-ROOT-002（「operation log」を外した。変更履歴を付記）
  - `development_convention/operation-policy.md`
  - `model-authoring/premises/operating-policies.md`
- **Superseded 注記を入れたもの:** 開発規約・設計契約・テスト設計・コンセプトの該当文書（一覧は Wave 3 のコミット差分を参照）。
- **触らなかったもの:** 過去の実装記録（`discussion/implementation/` の wave 記録）、過去の調査（`discussion/reports/`）。

## 残課題（未決事項）

- 既存パッケージにある記録ファイルの削除（ユーザーの手作業。実モデルでは 249MB）。
- 出荷前チェックの「証拠」の要件そのものが過剰ではないかの見直し（ユーザーが後でまとめて見直す意向）。
- `state-directory-guard.test.ts` の既存失敗、エディタの `diagnostics-jump-actions.test.ts` の失敗。
- 内容の変わらない JSON を書かない最適化、`npx tsx` 起動の見直し（判断の対象外事項）。
