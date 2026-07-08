# shell/ (WS1: Electron 殻 & build)

> editor Electron 移行の第一手。runtime-player を最小複製し、renderer を無改造で Electron に載せる。

状態: **計画 Draft**(実装未着手)。

## 直下のファイル

| Path | 役割 | 状態 |
|---|---|---|
| [ws1-shell-plan.md](ws1-shell-plan.md) | WS1 wave-plan(1波・1ドメイン・緩和側・dev 起動のみ) | Draft(2026-07-08) |

## 進め方

1波・1実装ドメイン。Undine → Orch-Sylph → Gnome(実装)+ Review-Sylph 1本。実装は Gnome に委任し、**ユーザーによる実機起動観測**(単窓で既存 UI が従来通り載る)を wave 完了判定の外の手動ゲートとする。通過して初めて WS2 設計に降りる。

想定成果物: `ws1-shell-domain-report.md`(完了報告)、`ws1-shell-review.md`(レビュー判定)。
