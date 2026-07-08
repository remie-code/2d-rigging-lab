# editor-electron-migration トピック地図

> apps/editor を Web(React/Vite) から Electron デスクトップへ移行する取り組みの入口地図。

## 役割

apps/editor の責務(ローカルワークスペース所有)に技術スタック(Electron デスクトップ)を追いつかせる。Web ターゲットを廃棄し、殻と永続化機構を差し替える。UI・保存形式・共通コアは温存。下敷きは apps/runtime-player の Electron 構成。

## 直下のファイル

| Path | 役割 | 状態 |
|---|---|---|
| [00-agreement.md](00-agreement.md) | why とスコープの確定記録 | Accepted(2026-07-08) |
| [01-decomposition.md](01-decomposition.md) | 継ぎ目(work-stream)、依存背骨、第一手。3系統コード調査から導出 | Accepted(2026-07-08) |

## 子ディレクトリ(work-stream)

| Path | WS | 役割 | 状態 |
|---|---|---|---|
| [shell/](shell/) | WS1 | Electron 殻 & build(第一手) | **完了 / pass**(2026-07-08、実機 smoke 緑) |
| [persistence/](persistence/) | WS2 | 永続化の node:fs/IPC 化(本丸) | **完了 / pass**(2026-07-08、実機 smoke 緑) |

WS3(Web 退役)/ WS4(E2E `_electron` 化)は現時点で小さく、独立ディレクトリ未設。深さを得たら器を切る(runtime-player 方式)。

## 次の作業候補

1. ✅ WS1(shell)完了・pass(2026-07-08)。electron-vite build 緑 + 実機 smoke 緑(単窓・drawable 変形・ワークスペース保存ロード)。
2. ✅ WS2(persistence)完了・pass(2026-07-08)。node:fs/IPC アダプタ、build 緑 + レビュー Lane A/B pass + 実機 smoke 緑(保存・読み込み)。
3. 次: WS3(Web 退役)/ WS4(E2E `_electron` 化)が並行可能。
4. 先在債務 `task_c8fc5155`(editor typecheck 赤 + unit test 4件)は移行と独立に処理。

## 未決事項

- ✅ implementation/ の背骨は「各 WS 自己完結・フラット(shell/ persistence/)」で確定(WS1・WS2 で実証)。中央 implementation/ spine は不要。
