# 素材インターフェース git 前提化 Wave 2 レビュー

レビュー: Review-Sylph（sonnet）1 レーン、軽量方式。2026-10-20。対象は Wave 2 の作業ツリー差分（コミット 9df53322 に収録）。
判定: **PASS with warnings**。blocking なし。

## 観点ごとの結果

| 観点 | 結果 |
|---|---|
| 判断との突き合わせ（撤去すべきものの消滅、残すべきものの存続、git を扱わない） | 問題なし |
| 取り込みの正しさ（照合、拒否時に何も残らない、上書き防止、JSON だけ書かれる壊れ方の防止、dry-run と commit で同じ種） | 問題なし |
| ロックとエラー型の移設 | 問題なし |
| 読み取り専用 2 コマンドと `MATERIAL_COMMANDS.md` の一致 | 問題なし |
| テストの妥当性 | W2・W3 を除いて妥当 |
| 規約 | 問題なし |

## 指摘と対応

| # | 指摘 | 対応 |
|---|---|---|
| W1 | `state-directory-guard.test.ts` が 1 件失敗する | 対応しない。変更前からの失敗で、直すには全コマンドの処理順を変える必要がある。completion の残課題に記録 |
| W2 | `AuthoringHostCommandHost` の、セッションが差し替わる条件を直接検査していない | 対応。`authoring-host-command-host.test.ts` を追加。dry-run・取り込み拒否・operation 拒否ではセッションと log が不変、commit 成功時だけ `.rgba` が増えることを確認 |
| W3 | `package-path-guard.ts` に直接のテストがない | 対応。`package-path-guard.test.ts` を追加（symlink は省略） |
| W4 | AI 提案カタログへの扱いが明示されていない | 対応。載せない理由を `ai-material-command.ts` の冒頭と `MATERIAL_COMMANDS.md` に明記 |
| S1 | ディスク上にある、どこからも参照されていない同名ファイルの扱い | 対応。内容が違えば `idCollision`、同じなら通す。テストを追加し、文書も一致させた |
| S2 | 実パッケージでの所要時間は未確認 | Gnome の計測を採用（dry-run 16.96 秒、commit 32.90 秒）。L0 による独立した再計測はしていない |

対応後の確認（L0 が再実行）:
- `pnpm typecheck` / `pnpm typecheck:authoring-host`: 通過
- `pnpm test:unit`: 1554 件通過
- `pnpm test:authoring-host`: 161/162 件通過。失敗 1 件は W1
