# shell/ (WS1: Electron 殻 & build)

> editor Electron 移行の第一手。runtime-player を最小複製し、renderer を無改造で Electron に載せた。

状態: **完了 / pass**(2026-07-08)。実機観測ゲート緑(ユーザー確認)。install は Undine が実行済み。

## 直下のファイル

| Path | 役割 | 状態 |
|---|---|---|
| [ws1-shell-plan.md](ws1-shell-plan.md) | WS1 wave-plan | Accepted |
| [ws1-shell-domain-report.md](ws1-shell-domain-report.md) | Domain A 完了報告 | 完了 / pass |
| [ws1-shell-review.md](ws1-shell-review.md) | closeout 検証 | pass |

## 結果

既存 renderer 無改造で Electron 殻に配線。`electron-vite build` 緑、shell テスト緑、実機 smoke 緑(単窓・drawable 変形・ワークスペース保存ロード)。**de-risk 実証済み。**

先在の型/テスト債務(editor の typecheck 赤 + unit test 4件失敗)は WS1 スコープ外 → `task_c8fc5155`。

次: WS2(永続化 node:fs/IPC 化)。着手前に save-plan の atomicity 契約を確認。
