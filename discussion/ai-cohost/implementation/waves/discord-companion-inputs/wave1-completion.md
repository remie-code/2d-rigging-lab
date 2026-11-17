# Wave 1 — チャット資料を音声会話で読める土台

2026-11-16。内部検証合格。初回実装の後に修正ループ2回を実施した。対象テストはGnome・Review-Sylphともに505件合格、失敗・スキップ0件。Cockpit本体とDiscord Cockpit全件、通常・視覚Fire、両モデルセッション、Windowsでの資料処理を含む。`git diff --check` に問題なし。[独立レビュー](../../reviews/discord-companion-inputs/wave1-review.md)

## 変更箇所とWave 2への引継ぎ

- `apps/soul/agent/src/discord/discord-chat-materials.mjs` の `createDiscordChatMaterials()` をDiscordの場の寿命に結び付ける。`setChannel({ guildId, channelId, channelName })`、`acceptPost(...)`、`getChatMaterials()` と `clear()` が受け渡し口。添付の `load(signal)` は重複・世代の確認後に呼ぶ。ストリームが8 MiBを超えた場合は `DISCORD_ATTACHMENT_SIZE_ERROR` を使う。
- `discord-pdf-renderer.mjs`、`discord-image-decoder.mjs`、`winrt-materials.mjs` はWindows標準のPowerShellとWinRTで添付を準備する。PNG・JPEG・WebPは展開前後の上限を適用し、使用可能なら元のバイトと型を維持する。破損IDATのPNG、走査データのないJPEGの再現を修正した。PDFはWindowsでページ画像にする。
- `cockpit-server.mjs` と `fire-orchestrator.mjs` は今開いているDiscordの場と同じ会話バッファでだけ、通常・視覚Fireに資料を添える。資料の受け取りで発話は起動しない。資料付きのモデル失敗は `fire-orchestrator.mjs`・`llm-session.mjs` で公開用の固定理由にする。対応する回帰は `discord-chat-materials.test.mjs`、`cockpit-server-discord-c.test.mjs`、`fire-orchestrator.test.mjs`、`llm-session.test.mjs` に追加した。

## 保持と入力の上限

- 投稿の保持は30分、最大12件。本文は1件4,000文字、添付は1件の投稿につき4件まで。添付取得は各8 MiB、同時4ジョブ、保持画像16 MiB。
- 画像は各4 MiB、長辺8,000 px、全128フレームかつ24×1024²画素まで。準備期限は8秒。必要なWindows画像コーデックがなければ利用不可として示す。
- PDFは先頭3ページまで、長辺1,536 px、各ページ2 MiB、合計4 MiB、期限8秒。合計ページ数と渡せた範囲を示す。
- 1応答に追加するDiscord資料は本文8,000文字、画像4枚・6 MiBまで。既存の画面キャプチャは会話で別に扱う。

絶対パスを使った実験では、既存の隔離条件で文字PDFを検索できる場合があった。画像PDFの描画には読み取り専用の制約がかかった。採用したWinRT描画と既存の画像入力では、隔離Codexで文字・画像のみの両PDFに正答した。Claude実モデルは既存のOAuth期限切れで未確認。[実測と測定範囲](./pdf-path-experiment.md)

実Discordからの投稿・VCへの参加と退出、および本人が資料について会話するUser Gateは未実施。
