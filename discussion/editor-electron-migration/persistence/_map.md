# persistence/ (WS2: 永続化の node:fs/IPC 化)

> 「Web 殻×FS Access でローカル所有」の谷を埋める本丸。

状態: **完了 / pass**(2026-07-08)。自動ゲート緑 + レビュー Lane A/B pass + 実機 smoke 緑(ユーザー確認: 保存・読み込み)。

## 直下のファイル

| Path | 役割 | 状態 |
|---|---|---|
| [ws2-design.md](ws2-design.md) | node:fs アダプタ契約 / IPC / write-read プロトコル / 設計判断 | Accepted |
| [ws2-plan.md](ws2-plan.md) | WS2 wave-plan | Accepted |
| [ws2-domain-report.md](ws2-domain-report.md) | Domain A 完了報告 | pass(smoke 待ち) |
| [ws2-review.md](ws2-review.md) | Lane A/B 判定 | pass / pass |

## 結果

既存ポート `WorkspaceDirectoryHandleLike` の裏に node:fs-backed アダプタ + IPC 5層 + Electron picker 注入。消費側・save-plan・digest・UI は無改造(git diff で確認)。per-file temp+rename 採用、main 側パス境界二重化、runtime-export 同居。

- 自動ゲート: electron:build 緑 / WS2 テスト全緑(先在4件は `task_c8fc5155`)/ WS2 ファイル typecheck エラーゼロ。
- レビュー: Lane A(契約・正しさ)・Lane B(IPC・セキュリティ)とも独立 clean-context で pass。
- 非ブロッキング残差: symlink(realpath 非使用)/ 種別衝突丸め(accepted)、テスト強化候補4件(任意)。詳細 [ws2-review.md](ws2-review.md)。

## 次

実機 smoke 通過で正式クローズ → WS3(Web 退役)/ WS4(E2E `_electron` 化)が並行可能。
