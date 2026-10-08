# cleanup/ (WS3: Web 退役 + WS4: E2E `_electron` 化)

> 移行の掃除フェーズ。WS3/WS4 は結合しているため一つの器で扱う。Web ターゲットを退役させ、E2E を `_electron` 駆動へ移した後の現行状態と残債を索引する。

状態: **完了**(2026-07-08)。移行ゲート（`electron:build`、check:deps/source）は pass。typecheck 赤と unit test 4件失敗は WS3/WS4 変更外の独立債務(`task_c8fc5155`)であり、「全ゲート緑」ではない。E2E: `_electron` ハーネスは**起動・描画・Playwright 駆動を実走で実証**。ただし PSD import 11本は**先在の stale workspace 前提**（`importFixturePsd` が `Import PSD` へ直行し、現アプリの「No workspace is open」に対する Create/Open Workspace と native picker 回避が欠落）で未クローズ。WS1/WS2 はゲート UI 未改変 = 移行が炙り出しただけで原因でない。→ **Web→Electron 移行は機能的に完了**、stale E2E 修正は別タスク化。

## 直下のファイル

| Path | 役割 | 状態 |
|---|---|---|
| [ws3-ws4-plan.md](ws3-ws4-plan.md) | WS3+WS4 統合 wave-plan（実装前の計画記録） | Draft / 実装完了後は履歴 |
| [ws3-ws4-domain-report.md](ws3-ws4-domain-report.md) | cleanup ドメイン実装報告(実装/ゲート/ユーザー E2E 手順/residual) | 完了(2026-07-08) |
| [ws3-ws4-review.md](ws3-ws4-review.md) | Review-Sylph 判定(approve-with-nits) | 完了(2026-07-08) |

## 要点

- **実装順（履歴）**: WS4(E2E `_electron`)→ WS3(web-script + vite.config 除去)。現在はいずれも完了。portable 除去は editor feature 層に限定した独立判断。
- **portable 廃止 = editor feature 層のみ**。下層(authoring-core / package-format の bundle)は**テスト土台として dormant 温存**(ユーザー了承)。
- **`build`(vite)除去 → 緑ゲートは `electron:build` 一本化**。
- E2E 実行ゲートはユーザー実機(agent 環境で Electron GUI を確実に回せないため)。

## portable 残留 / E2E 残債

- 下層の portable bundle は契約・テスト土台として dormant 温存する。一方、editor 側の `workspace-storage-state.ts` の「Portable JSON export remains available」と `editor-session-context.tsx` の `import-portable-json` reason/message は、現行 call site がないユーザー向け死枝として残っている。
- PSD import E2E をクローズするには Create/Open Workspace の前提操作と native picker 回避の temp-dir 注入が必要。現状は harness 成立の実証であり、全テスト pass ではない。

## E2E 顛末(2026-07-08)

`pnpm --filter @private-2d-rigging-lab/editor test:e2e:psd-import` を実走(agent 環境で `_electron` 起動できた)。失敗スナップショットの aria は `Create Workspace`/`Open Workspace`/"No workspace is open" を表示 = **アプリは正常起動・描画、Playwright 駆動も成立**。11本全 fail は `importFixturePsd` の stale アサーション(Create Workspace ステップ欠落)。修正には Create Workspace ステップ + **ネイティブダイアログ回避の temp-dir picker 注入フック**が必要 → **別タスクに切り出し済み**。

## 現在地

cleanup の完了により **editor Web→Electron 移行の全 work-stream(WS1〜WS4)が完了**。packaging(electron-builder + アプリアイコン)も完了済みで、残るのは上記 stale PSD E2E、独立 typecheck/unit 債務、portable 死枝の整理である。
