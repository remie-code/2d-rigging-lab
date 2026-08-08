# editor-electron-migration トピック地図

> apps/editor を Web(React/Vite) から Electron デスクトップへ移行する取り組みの入口地図。

## 役割

apps/editor の責務(ローカルワークスペース所有)に技術スタック(Electron デスクトップ)を追いつかせる。Web ターゲットを廃棄し、殻と永続化機構を差し替える。UI・保存形式・共通コアは温存。下敷きは apps/runtime-player の Electron 構成。

## 直下のファイル

| Path | 役割 | 状態 |
|---|---|---|
| [00-agreement.md](00-agreement.md) | why とスコープの確定記録 | Accepted(2026-07-08) |
| [01-decomposition.md](01-decomposition.md) | 継ぎ目(work-stream)、依存背骨、実装分解記録。3系統コード調査から導出 | Accepted(2026-07-08) |

## 子ディレクトリ(work-stream)

| Path | WS | 役割 | 状態 |
|---|---|---|---|
| [shell/](shell/) | WS1 | Electron 殻 & build | **完了 / pass**(2026-07-08、実機 smoke 緑) |
| [persistence/](persistence/) | WS2 | 永続化の node:fs/IPC 化(本丸) | **完了 / pass**(2026-07-08、実機 smoke 緑) |
| [cleanup/](cleanup/) | WS3+WS4 | Web 退役 + E2E `_electron` 化(結合・掃除フェーズ) | **完了**(2026-07-08、E2E ハーネス実証・PSD workspace 前提 stale は別タスク) |
| [packaging/](packaging/) | — | electron-builder + アプリアイコン | **完了**(2026-07-08、dist:win 完走・portable exe 生成、metadata warning は残存) |

WS3/WS4 は結合しているため `cleanup/` 一つの器で扱う。portable 廃止は editor feature 層に限定し、下層 authoring-core / package-format の bundle はテスト土台として dormant 温存する。Web target は退役済みで、現行 E2E は `_electron` harness を使う。

## 現在の状態と残債

1. ✅ WS1(shell)完了・pass(2026-07-08)。electron-vite build 緑 + 実機 smoke 緑(単窓・drawable 変形・ワークスペース保存ロード)。
2. ✅ WS2(persistence)完了・pass(2026-07-08)。node:fs/IPC アダプタ、build 緑 + レビュー Lane A/B pass + 実機 smoke 緑(保存・読み込み)。
3. ✅ WS3+WS4(cleanup)完了(2026-07-08)。**editor Web→Electron 移行の全 work-stream(WS1〜WS4)完了。** PSD import E2E は workspace 作成/開放と native picker 回避が欠落した stale 前提で未クローズ（`task_2d91b388`）。
4. ✅ packaging(electron-builder + アイコン)完了(2026-07-08)。dist:win 完走・`Private 2D Rigging Lab 0.0.0.exe`(portable)生成。`description`/`author` 欠落 warning は非ブロッキング残債。詳細 [packaging/](packaging/)。
5. 先在債務 `task_c8fc5155`(editor typecheck 赤 + unit test 4件)は移行と独立に処理。`dist:win` は typecheck を含まないため、配布完走と品質ゲートは別扱い。
6. portable 廃止後も editor 側に `workspace-storage-state.ts` の export 文言と `import-portable-json` reason/message の死枝が残る。下層 bundle の dormant 温存判断とは区別して扱う。

## 未決事項

- ✅ implementation/ の背骨は「各 WS 自己完結・フラット(shell/ persistence/)」で確定(WS1・WS2 で実証)。中央 implementation/ spine は不要。
- PSD import E2E の stale workspace 前提（Create/Open Workspace + native picker 回避 hook）をいつ修正するか。
- `task_c8fc5155` の typecheck 赤・unit test 4件を移行完了条件に含めるか（現状は独立債務）。
- portable 廃止後の editor 側 dead branch（export 文言 / `import-portable-json` reason/message）を削除するか。
- packaging の `description` / `author` warning を補完するか（portable build のブロッカーではない）。
