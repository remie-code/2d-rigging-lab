# cleanup/ (WS3: Web 退役 + WS4: E2E `_electron` 化)

> 移行の掃除フェーズ。WS3/WS4 は結合しているため一つの器で扱う(現 E2E が vite web サーバ依存 → E2E 移設が web 退役の前提)。

状態: **完了**(2026-07-08)。自動ゲート全緑(typecheck/test:unit 新規ゼロ、electron:build 緑、check:deps/source pass)。E2E: `_electron` ハーネスは**起動・描画・Playwright 駆動を実走で実証**。ただし全テストが**先在の stale アサーション**(`importFixturePsd` が `Import PSD` 直行するが、現アプリは「No workspace is open」→ ワークスペース開放が前提)で fail。WS1/WS2 はゲート UI 未改変 = 移行が炙り出しただけで原因でない。→ **移行は機能的に完了**、stale E2E 修正は別タスク化。

## 直下のファイル

| Path | 役割 | 状態 |
|---|---|---|
| [ws3-ws4-plan.md](ws3-ws4-plan.md) | WS3+WS4 統合 wave-plan | Draft(2026-07-08)。§5 行番号は inventory 時点の参考値 |
| [ws3-ws4-domain-report.md](ws3-ws4-domain-report.md) | cleanup ドメイン実装報告(実装/ゲート/ユーザー E2E 手順/residual) | 完了(2026-07-08) |
| [ws3-ws4-review.md](ws3-ws4-review.md) | Review-Sylph 判定(approve-with-nits) | 完了(2026-07-08) |

## 要点

- **sequencing**: WS4(E2E `_electron`)→ WS3(web-script + vite.config 除去)。portable 除去は独立。
- **portable 廃止 = editor feature 層のみ**。下層(authoring-core / package-format の bundle)は**テスト土台として dormant 温存**(ユーザー了承)。
- **`build`(vite)除去 → 緑ゲートは `electron:build` 一本化**。
- E2E 実行ゲートはユーザー実機(agent 環境で Electron GUI を確実に回せないため)。

## E2E 顛末(2026-07-08)

`pnpm --filter @private-2d-rigging-lab/editor test:e2e:psd-import` を実走(agent 環境で `_electron` 起動できた)。失敗スナップショットの aria は `Create Workspace`/`Open Workspace`/"No workspace is open" を表示 = **アプリは正常起動・描画、Playwright 駆動も成立**。11本全 fail は `importFixturePsd` の stale アサーション(Create Workspace ステップ欠落)。修正には Create Workspace ステップ + **ネイティブダイアログ回避の temp-dir picker 注入フック**が必要 → **別タスクに切り出し済み**。

## 次

移行の cleanup フェーズ完了 = **editor Web→Electron 移行の全 work-stream(WS1〜WS4)完了**。パッケージング(electron-builder + アプリアイコン、WS1 で先送り)は別フェーズ。
