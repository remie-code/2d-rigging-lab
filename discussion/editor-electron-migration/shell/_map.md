# shell/ (WS1: Electron 殻 & build)

> WS1 で実装した editor Electron 殻。runtime-player を最小複製し、renderer を無改造で Electron に載せた。

状態: **完了 / pass**(2026-07-08)。実機観測ゲート緑(ユーザー確認)。install は Undine が実行済み。

## 直下のファイル

| Path | 役割 | 状態 |
|---|---|---|
| [ws1-shell-plan.md](ws1-shell-plan.md) | WS1 wave-plan（実装前の計画記録） | Draft / 実装完了後は履歴 |
| [ws1-shell-domain-report.md](ws1-shell-domain-report.md) | Domain A 完了報告 | 完了 / pass |
| [ws1-shell-review.md](ws1-shell-review.md) | closeout 検証 | pass |

## 結果

既存 renderer 無改造で Electron 殻に配線。`electron-vite build` 緑、shell テスト緑、実機 smoke 緑(単窓・drawable 変形・ワークスペース保存ロード)。**de-risk 実証済み。**

先在の型/テスト債務(editor の typecheck 赤 + unit test 4件失敗)は WS1 スコープ外 → `task_c8fc5155`。

後続の WS2(永続化)、WS3/WS4(Web 退役・E2E `_electron` 化)、packaging は完了済み。本 map は WS1 の de-risk 実証を索引する履歴入口として保持する。editor の typecheck 赤と unit test 4件失敗は移行外の独立債務(`task_c8fc5155`)である。
