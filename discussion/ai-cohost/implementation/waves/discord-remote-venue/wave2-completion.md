# Wave 2 — CodexからDiscordの場を起動・退出・閉場する

独立レビューは合格。広域402件中401件が通過し、残った記憶の配線検査は最終修正後の独立再実行で通過した。最終の再実行は、通常Discordの開場中断2件と記憶の配線検査2件が合格した。[独立レビュー](../../reviews/discord-remote-venue/wave2-review.md)

最終差分のWindows全体回帰は `npm test --prefix apps/soul/agent -- --test-reporter=tap` で2591件合格、失敗・取消・スキップ0件、94.9秒。 `node scripts/check-soul-zone-boundary.mjs` と `git diff --check` も通過した。

## 操作と変更

- `scripts/discord-venue.mjs` の `roles`、`catalog`、`open` で、スクショや依頼文の名前を指定ロールのBotが見られる候補と照合する。候補が複数なら確定を待つ。開場時に実接続先、有効ロール・モデル、読むチャットと利用状態を返す。[操作手順](wave2-operation.md)
- `scripts/cockpit.mjs`、`src/cockpit/cockpit-server.mjs`、`src/cockpit/remote-discord-venue.mjs` で、今回のCockpitを独立プロセスとして起動し、同じ場の識別子に対する `status`、`leave`、`close` を扱う。通常のCockpitは通常の起動とEOF終了を使う。閉場の記録は子の終了を確認して完了として返す。
- `src/discord/discord-experience.mjs` と `src/discord/discord-guild-lease.mjs` は、同一PCの同じBotとDiscordサーバーの利用を別ポートも含めて排他する。WindowsではOSの名前付きパイプを使い、VCだけの退出や閉場待ち・失敗の間も予約を保持する。終了後は同じBotで再参加できる。別PC上のプロセスや、異なるサーバーから同一ロールの記憶を同時編集する場合の排他は今回の検証範囲外。
- 閉場は既存の退出、小タスクの完了、書き出しと必要な整理、資料の解放を順に処理する。保存や整理の一過性の失敗は状態を保って途中から再試行できる。部分コミットや整理の取り消し結果が確認できない場合は、既存データを確認するまで処理を止める。記憶の結果は `src/mind/memory.mjs` から閉場へ伝える。

## Windowsの実測

実装担当と独立レビューの双方が、合成のDiscordと隔離データを使った。起動コマンドを終えた後、別の呼び出しから同じ場と接続先を確認し、VCだけ退出した。閉場は小タスクを待ち、書き出し失敗を通知し、同じ場からの再試行後に記憶のGitコミット、資料の削除、プロセス終了を確認した。自動試験では整理の失敗後に書き出しを重ねず整理から続けるケース、起動競合、誤った場の識別子、同じBotで別ポートから参加するケース、通常起動に戻った際の設定の一致も照合した。

この縦断試験は製品と同じCLI、独立起動方式、HTTPサーバー、Discord体験、閉場と記憶の保存経路、Gitを使用した。Discord SDK、音声・文字起こし、LLM、小タスク応答、整理本体はテストで代替した。

別のWindows実測では、実データを含まないコピーで本番の通常起動を実行した。ページと状態APIはHTTP 200、管理APIは404、EOFで終了コード0。管理モードも、空きポートと閉じた標準入力で本番の起動入口を実行し、同じ場の識別子で状態を取得し、未開場からの終了記録と終了コード0を照合した。

## 2026-11-18 実Discordでの確認

チャッピーを GPT-6.2 Sol・Fast 有効・`--no-body` で指定VCに呼び、本人と音声会話できた。閉場時は `recording: saved`、`organising: not-due`、`closing: complete` を確認した。VC付属チャットの本文受信は Message Content Intent が無効のため未確認。
