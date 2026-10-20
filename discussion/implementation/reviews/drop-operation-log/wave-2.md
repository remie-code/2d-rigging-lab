# 操作の記録をやめる Wave 2 レビュー（記録という概念の撤去）

レビュー: Review-Sylph（sonnet）1 レーン、軽量方式。2026-10-20。対象はコミット a2267e91 に収録した差分。
判定: **PASS with warnings**。blocking なし。

| 観点 | 結果 |
|---|---|
| 判断との突き合わせ（撤去、名残なし、残すもの、既存ファイル無視） | 問題なし |
| commit の戻り値と応答 | 問題なし |
| material fixture の operationId の作り方 | 問題なし |
| 検査の弱まり | 問題なし（記録の中身だけを消し、result・runtime・validation・reload の検査は残っている） |
| fixtures 66 ファイル | 問題なし（記録由来の項目の削除と件数の減少に限られる。例外は wave39 の preflight で、証拠を付け替えた） |
| 新しいテスト `legacy-operation-log-file.test.ts` | 問題なし |
| 規約 | 問題なし |

| # | 指摘 | 対応 |
|---|---|---|
| W1 | preflight の authoring workflow が GUI 証拠だけで判定するようになった | ユーザー確認済み（当面このまま）。completion に記録 |
| W2 | material の API 応答にパスとハッシュが含まれることの検査が無い | 対応した。応答に含まれるのはハッシュだけで、パスは含まれなかったため、文書とコメントを事実（payload がパスとハッシュを持つ）に合わせた。「バイトを含まない」検査は dry-run の応答にも広げた |
| W3 | contracts の `TransactionId` / `TransactionIdSchema` が残っている | 対応した。撤去 |
| S | `operation-evidence.test.ts` の重複した expect | 対応した。削除 |
| S | `executeAiReadCommand` に読み取り以外を渡したときの検査が無い | 対応した。テストを追加（入力が unknown のため、型を絞る方法は採らなかった） |

対応後の確認（L0）: `pnpm typecheck`・`pnpm typecheck:authoring-host` 通過、`pnpm test:unit` 1552 件通過。
