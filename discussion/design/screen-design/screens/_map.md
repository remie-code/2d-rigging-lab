# Screen Specs Map

> `discussion/design/screen-design/screens/` の入口地図。各画面固有のレイアウト、Task-Local Flow、表示情報、非表示情報、関連機能IDを管理する。

## ファイル一覧

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | このディレクトリの入口地図 | Active |
| [authoring-workspace.md](authoring-workspace.md) | Empty / Authoring Workspaceのレイアウトと表示情報 | Draft screen spec / Wave66 Canvas evaluated-scene implementation exists |
| [psd-import-task.md](psd-import-task.md) | PSD Import Taskの内部遷移とレイアウト | Draft screen spec |
| [parameter-manager.md](parameter-manager.md) | Parameter Managerの内部遷移とレイアウト | Draft screen spec |
| [variant-expression-manager.md](variant-expression-manager.md) | Variant / Expression Manager。Variant Group、single/multi mode、Drawable membership matrix、Parts Tree風Add Drawables picker、既存visibilityとのAND合成を定義 | Revised draft screen spec / Wave99 implementation pass |
| [texture-atlas-task.md](texture-atlas-task.md) | Texture Atlas Task v0。runtime graph所属Drawableをatlas対象にし、Applyでruntime atlas artifactをcommitし、authoring texture/UVは保持する専用Task画面 | Accepted v0 direction / Draft screen spec / Wave101 Skyline + Blocking Issues pass |
| [runtime-export-task.md](runtime-export-task.md) | Runtime Export Task v0。current Texture Atlasを必須にし、外部OBS/camera-driven runtime app向けdirectory runtime artifactを書き出す専用Task画面 | Accepted direction / Draft screen spec / Wave92 implementation pass |
| [project-storage-task.md](project-storage-task.md) | Project Storage Taskの内部遷移とレイアウト | Draft screen spec |
| [workspace-save-and-navigation.md](workspace-save-and-navigation.md) | Workspace-first Save / Open UX、Header / Toolbox責務分離、directory workspace、Portable JSONとの境界、保存タイミング | Accepted direction / Draft screen spec |
| [validation-task.md](validation-task.md) | Product Preflight / Validation Taskの内部遷移とレイアウト | Draft screen spec |
| [viewer-runtime-view.md](viewer-runtime-view.md) | 完成品確認用Viewer / Runtime ViewのClean Stage、Runtime Controls、`Original` / `Atlas Runtime` render source mode、除外事項 | Accepted v0 direction / Draft screen spec / Wave84 playback + Wave99 Variant + Wave101 Atlas Runtime |
| [diagnostics-evidence-view.md](diagnostics-evidence-view.md) | Validation / Diagnostics v0の表示体系。決定論的な警告、Mesh生成失敗原因、Diagnostics一覧、jump導線 | Draft screen spec / Wave85 read-only Diagnostics v0 pass; full Evidence View remains open |
| [codex-automation-view.md](codex-automation-view.md) | Codex / Automation Viewのレイアウト | Draft screen spec |
| [tutorial-task.md](tutorial-task.md) | Tutorial Taskのレイアウト | Placeholder screen spec |
