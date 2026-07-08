# editor-electron-migration トピック地図

> apps/editor を Web(React/Vite) から Electron デスクトップへ移行する取り組みの入口地図。

## 役割

apps/editor の責務(ローカルワークスペース所有)に技術スタック(Electron デスクトップ)を追いつかせる。Web ターゲットを廃棄し、殻と永続化機構を差し替える。UI・保存形式・共通コアは温存。下敷きは apps/runtime-player の Electron 構成。

## 直下のファイル

| Path | 役割 | 状態 |
|---|---|---|
| [00-agreement.md](00-agreement.md) | why とスコープの確定記録 | Accepted(2026-07-08) |
| [01-decomposition.md](01-decomposition.md) | 継ぎ目(work-stream)、依存背骨、第一手。3系統コード調査から導出 | Accepted(2026-07-08、portable 廃止のみ要確認) |

## 子ディレクトリ(work-stream)

| Path | WS | 役割 | 状態 |
|---|---|---|---|
| [shell/](shell/) | WS1 | Electron 殻 & build(第一手) | 未着手 |
| [persistence/](persistence/) | WS2 | 永続化の node:fs/IPC 化(本丸) | 未着手(WS1 依存) |

WS3(Web 退役)/ WS4(E2E `_electron` 化)は現時点で小さく、独立ディレクトリ未設。深さを得たら器を切る(runtime-player 方式)。

## 次の作業候補

1. WS1(shell)を Gnome に実装委任 → 実機で「UI が Electron に載った」を観測。
2. WS1 通過後、WS2 着手前に save-plan の atomicity 契約(authoring-core)を確認。
3. WS2/WS3/WS4 は WS1 通過後に並行可能。

## 未決事項

- portable-JSON 廃止 + zip 可搬の最終確認([01-decomposition.md](01-decomposition.md)「portable-JSON について」)。
- implementation/ の背骨(単一 spine か自己完結サブトピックか)は WS1 通過後に判断。
