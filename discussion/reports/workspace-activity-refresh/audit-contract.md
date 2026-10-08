# Workspace Activity Refresh — Audit Contract

## 1. 目的

2026-08-08 時点で、このワークスペースで何が行われていたかを、更新済みの `discussion/**/_map.md` を入口として、現行コード、テスト、Git、実験・レビュー記録に照らして再構成する。

## 2. 共通ルール

1. `discussion/_conventions.md` と `discussion/_map.md` を先に読む。
2. 担当トピックの `_map.md` から下層へ進み、無制限な全repo探索はしない。
3. mapの記述だけを根拠にせず、重要な現行主張は可能な範囲でsource/test/package/Git/review artifactへ照合する。
4. 次を明示的に分離する。
   - accepted user/design decision
   - current repository fact
   - historical evidence
   - experiment or manual observation
   - inference
   - unresolved user/human/legal/device gate
5. implementation/test passをhuman acceptanceと同一視しない。
6. historicalなWave記録をcurrent truthとして再利用しない。
7. 製品・scope・UX判断を新規に行わず、ユーザーへ質問もしない。判断点として報告する。
8. 調査のみ。source、test、既存map、既存reportを編集しない。
9. 各シルフは割り当てられた単一reportだけを `apply_patch` で作成する。stage/commitしない。
10. 他エージェントも同じworktreeで動く。既存・並行変更を戻さない。

## 3. 一次報告の必須構成

1. Scope / inspected entry points
2. Executive summary（5–10項目）
3. What was built or investigated
4. Current repository state
5. Accepted decisions and boundaries
6. Verification and experiment evidence
7. Historical progression / turning points
8. Open gates, debts, and uncertainties
9. Candidate next work（事実から導ける候補。推奨決定はしない）
10. Evidence index（path、commit、command、結果）
11. Limitations

重要な主張には可能な限り `path:line`、commit hash、実行commandのいずれかを付ける。

## 4. 統合ルール

- 統合シルフは一次reportを主入力とし、必要な矛盾だけ原典へ戻る。
- 一次reportの内容を単純連結せず、重複を除去する。
- 現在地、時系列、未決gateを別reportに保つ。
- 異なる報告が矛盾した場合、現行source/test、最新accepted decision、Git時系列の順序と証拠種別を明記して裁定する。

## 5. 最終レビュー

- current truth と historical evidence の混同
- implementation pass と human/device/legal gate の混同
- accepted decision と推論の混同
- 日付・Wave・commit順序の矛盾
- 重要トピックの欠落
- 根拠のない「完了」「未着手」「次にすべき」の断定

を検査し、`PASS` または `NEEDS FIX` と修正先を報告する。
