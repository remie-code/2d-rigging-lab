# 操作の記録（operations/log.jsonl）をやめる

状態: Accepted（2026-10-20、ユーザー合意）。実装は未着手。計画は [../implementation/orchestration/drop-operation-log-plan.md](../implementation/orchestration/drop-operation-log-plan.md)。

## 背景

### 実験結果

実モデル（`second-rigging-6-sol/workspace`、r2152）の複製で計測した（2026-10-20、Sylph）。CLI の 1 操作は、dry-run で約 17 秒、API の commit で約 33 秒かかった。

- 時間の大半は `operations/log.jsonl`（249MB、2146 行）に費やされている。
  - 読み込みのたびに、全行を JSON パースと zod 検証にかける（7.3 秒）。
  - `createOperationCore` で、同じ全行をもう一度 zod 検証する（6.3 秒）。
  - API の commit では、全行を zod に通してから丸ごと書き直す（7.8 秒）。
- 記録の使われ方:
  - dry-run は記録を使わない。
  - API の commit は 1 行（約 17KB）を追加するだけ。
  - 記録を読むアプリはない。エディタは書かず、undo/redo は独立した仕組み。
- git 側にもコストがある。1 操作ごとに `git add` に 3.3 秒かかり、`.git` が 62MB 増える。追記に変えても同じ。
- 記録の 77% は、`editKeyformKey` が持つ keyformSet 全体の変更前後。
- 試作（記録を読まない、1 行追記、テクスチャ判定の複製をなくす）では、dry-run 3.0 秒、API の commit 4.6 秒になった。

### リポジトリ事実

- 記録ファイルの有無は、今でもどの経路でも許容されている。エディタで作ったパッケージは、manifest に欄があっても実ファイルを持たない。
- 形式上の必須は manifest の `operationLog: z.literal("operations/log.jsonl")` の 1 か所だけ。
- 一方で、多くの決まりが記録を「証拠として必須」と定めている:
  - 受け入れ基準 AC-ROOT-002
  - `operation-policy.md` の DEC-OP-001 / 002 / 004 / 006 と、必須・禁止の項目
  - `module-boundary-policy.md`
  - GUI・テスト・E2E・AI assistant の各実装ポリシー
  - 設計契約群

### 経緯（ユーザー見解）

この「証拠として必須」は、過去に別モデルを使っていた時期に、合意の後で拡張されて広がった。ユーザーが認知しない形で過剰な要件になっていた。

## 判断（設計判断）

1. **操作の記録をやめる。** 全入口（AI 向けホスト、エディタ、その他）で一律に、読み込み・検査・書き込みをしない。履歴は git に任せる。どの入口もパッケージを同じに扱い、特定の入口を特別扱いしない。
2. **記録という概念を残さない。** 次を撤去する:
   - operation-core の記録の型・生成・追記・シリアライズ・パースと、記録のためだけの処理（transactionId、記録用の precondition 集計など）
   - API の commit の戻り値にある記録の項目（`logEntry`、`operationLogLength`、`OperationCore.operationLog`）
   - `getOperationLog` コマンド
   - 証拠参照 `operations/log.jsonl#<id>` と、`operationLog` という証拠・成果物の種別
   - 検証レポートの `operationLogPresent` / `operationLogPath`
   - `evidence.guiOperationLogMissing` と `requiresGuiOperationLog`
   - 「常に false」のような名残は置かない。
3. **manifest の `operationLog` 欄を形式から消す。** 新規パッケージには書かない。既存パッケージは読める（未知の欄は読み飛ばされる）。次に保存したとき、manifest からその行が消える。
4. **既存の記録ファイルは無視する。** 読まない、書かない、消さない。消すかどうかはユーザーが手で決め、git でコミットする。
5. **残すもの:** dry-run（当てる前の安全確認）と、API 応答としての変更差分（modelDiff）。
6. **あわせて直す性能の不具合:** 保存時のテクスチャ判定で、判定ごとにテクスチャ集合全体を複製している（`packages/package-format/src/package-binary-file-set.ts`）。パスの安全性と重複の検査は維持する。
7. **文書の扱い:**
   - 直接改める: 受け入れ基準 AC-ROOT-002、`operation-policy.md` の該当決定、`model-authoring/premises/operating-policies.md`
   - Superseded 注記を入れる: その他の開発規約と設計契約の該当箇所
   - 触らない: 過去の実装記録（`discussion/implementation/` の wave 記録など）。歴史として残す。

## 対象外（未決事項）

- 内容の変わらない JSON を書かない最適化（効果は小さい）。
- 呼び出し側の起動を `npx tsx` から node の type stripping へ変えること（実験スクリプト側の話）。
- 既存の記録ファイルを各パッケージから削除すること（ユーザーの手作業）。
