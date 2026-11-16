# Wave 2 — Discordの受信・Cockpit設定とVC操作

2026-11-16。独立レビューの内部判定は合格。初回実装の後に2回の修正ループを実施した。最終の独立対象回帰は190件合格、失敗・スキップ0件。既存コマンドの保護、旧イベントの再配送、ソース切替と添付処理、場の開閉・VC操作の競合を確認した。[独立レビュー](../../reviews/discord-companion-inputs/wave2-review.md)

最終ソースの `npm test --prefix apps/soul/agent -- --test-reporter=spec` は2,567件合格、失敗・取消・スキップ0件、91.9秒。ローカルHTTPを使う試験の外側の実行承認を利用した。`git diff --check` に問題なし。

## 変更と動作

- Cockpit右側のDiscordパネルに **読むチャット** を追加。選択は `cockpit-settings.local.json` の `discordChatChannel` へ保存する。通常チャットとVC付属チャットのうち、Botから閲覧できるものを一覧に出し、選択・切替・解除を行う。Discordの不可視チャンネル情報は一覧・受信候補から除外する。実装は `cockpit-server.mjs`、`cockpit-settings-store.mjs`、`ui/discord-panel.mjs` と `scripts/cockpit.mjs`。[Discordのチャンネル非表示仕様](https://docs.discord.com/developers/change-log#channel-obfuscation-for-users-and-bots)
- `discord-experience.mjs` と `discord-companion-gateway.mjs` が、開いている場の選んだチャットの新規投稿をWave 1の資料へ渡す。受信済みIDを場ごとに30分・最大4,096件保持する。新着判定にはPCとDiscordの時刻同期を前提とし、選択・復元・権限復帰で再び有効になった時刻以前の投稿を除外する。切替・閉場で処理中の添付を中断する。
- BotのMessage Content Intentが未設定でも、既存の準備・音声・VCコマンドは使用できる。開いている対象サーバーに `/soul-vc` を登録し、同じ定義なら既存コマンドを再利用する。確認済みのコマンドIDの操作を、PCと共通の場状態・VC操作の排他へ渡す。`join` は呼び出した人のVCへ入り、`leave` から同じ場に再参加できる。コマンドの利用権限はDiscordの設定に従う。[Discordコマンド](https://docs.discord.com/developers/interactions/application-commands)
- 回帰は `discord-companion-gateway.test.mjs`、`cockpit-server-discord-i.test.mjs`、`cockpit-ui-discord-k.test.mjs` を含む。全体の会話資料の仕様は [Wave 1完了記録](./wave1-completion.md) を参照。

## 通常起動と確認の範囲

実データを含めない一時コピーで `npm run cockpit --prefix apps/soul/agent -- --port 0` を実行した。ページ、UIモジュール、Discordパネル、状態APIはHTTP 200。場が閉じているときの受信先APIはHTTP 409。標準入力を閉じると正常終了した。依存パッケージやPlayerビルドの追加はなく、既存の通常起動からソースを読める。

実Discordでの登録、権限、自分のスマホからの操作とVC会話は[本人確認](./human-gate.md)に残る。内部試験はfixtureと隔離モデルを用いた。本人のアプリと既存設定は操作していない。Claude実モデルのPDF読取はOAuth期限切れで未確認。Gitへのコミット、マージ、プッシュは行っていない。
