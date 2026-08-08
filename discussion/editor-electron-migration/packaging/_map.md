# packaging(electron-builder + アプリアイコン)地図

> editor の配布パッケージング。下敷きは apps/runtime-player の electron-builder 構成。

## 役割

editor(Electron アプリ)を Windows portable として配布可能にする。runtime-player の `build` ブロックを鏡写しし、ユーザー提供アイコンを Windows `.ico` 化して食わせる。renderer / 既存 main ロジック / 永続化 IPC / テスト(WS1〜WS4 成果物)は非侵襲。

## 直下のファイル

| Path | 役割 | 状態 |
|---|---|---|
| [packaging-report.md](packaging-report.md) | 設定内容 / icon 生成手順 / dist 検証 / residual / レビュー判定 | 完了(2026-07-08) |

## 成果(2026-07-08)

- `apps/editor/package.json`: `build` ブロック(appId `com.private2drigginglab.editor` / productName `Private 2D Rigging Lab` / portable x64 / win.icon `build/icon.ico`)、`dist`・`dist:win`・`generate-icon` script、devDeps `electron-builder ^26.0.12`・`png-to-ico ^3.0.0`。
- `apps/editor/scripts/generate-icon.mjs`: PNG → multi-size `.ico` 生成。
- `apps/editor/build/icon.ico`: 16/32/48/256(32bpp)内包。`icon-source.png`: ソース PNG。
- **dist:win 完走**: `apps/editor/dist/Private 2D Rigging Lab 0.0.0.exe`(portable, ~94.5MB)生成。実機ゲート不要。

## 状態

- ✅ 設定・icon 生成・dist:win 実走まで agent 環境で完走。electron:build 緑。
- レビュー: Review-Sylph 判定は packaging-report.md 末尾に記載。
- `dist:win` は `electron:build` 前段であり typecheck を含まない。既知の editor typecheck 赤と unit test 4件失敗(`task_c8fc5155`)は packaging と独立した残債で、配布ビルド完走とは別ゲートである。

## 未決事項

- electron-builder の `description` / `author` 欠落警告（portable ビルドは完走、非ブロッキング）。補完要否は任意の後続判断。
