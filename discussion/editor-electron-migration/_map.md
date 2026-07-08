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
| [cleanup/](cleanup/) | WS3+WS4 | Web 退役 + E2E `_electron` 化(結合・掃除フェーズ) | **完了**(2026-07-08、E2E ハーネス実証・stale テストは別タスク) |
| [packaging/](packaging/) | — | electron-builder + アプリアイコン(WS1 先送り分) | **完了**(2026-07-08、dist:win 完走・portable exe 生成) |

WS3/WS4 は結合しているため `cleanup/` 一つの器で扱う。packaging は WS1 で先送りした配布設定を後追いで足したもの。

## 次の作業候補

1. ✅ WS1(shell)完了・pass(2026-07-08)。electron-vite build 緑 + 実機 smoke 緑(単窓・drawable 変形・ワークスペース保存ロード)。
2. ✅ WS2(persistence)完了・pass(2026-07-08)。node:fs/IPC アダプタ、build 緑 + レビュー Lane A/B pass + 実機 smoke 緑(保存・読み込み)。
3. ✅ WS3+WS4(cleanup)完了(2026-07-08)。**editor Web→Electron 移行の全 work-stream(WS1〜WS4)完了。** stale E2E 修正は別タスク `task_2d91b388`。
4. ✅ packaging(electron-builder + アイコン、WS1 先送り分)完了(2026-07-08)。dist:win 完走・`Private 2D Rigging Lab 0.0.0.exe`(portable)生成。詳細 [packaging/](packaging/)。
5. 先在債務 `task_c8fc5155`(editor typecheck 赤 + unit test 4件)は移行と独立に処理。

## 未決事項

- ✅ implementation/ の背骨は「各 WS 自己完結・フラット(shell/ persistence/)」で確定(WS1・WS2 で実証)。中央 implementation/ spine は不要。
