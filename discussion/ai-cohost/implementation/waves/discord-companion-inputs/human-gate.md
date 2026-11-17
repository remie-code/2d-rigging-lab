# スマホのDiscordからチャッピーを呼び、投稿について話す

実Discord・VCでの本人確認は未実施。家のPCの既存Cockpitと、同じDiscordサーバーに入っているスマホで確認する。

## Discordの準備

- Discord Developer Portalで使うBotのアプリを開き、Botの **Privileged Gateway Intents** で **Message Content Intent** を有効にする。使っているBotで許可されていることが必要。設定を変えた場合は、CockpitでDiscordの場を開き直して新しいGateway接続に反映する。[Discord Gateway](https://docs.discord.com/developers/events/gateway#message-content-intent)
- Botに読むチャットの **View Channel**、参加するボイスチャンネルの **Connect** と **Speak** を許可する。通常テキストチャンネルとボイスチャンネル付属のチャットを選べる。投稿するスマホ側の権限はDiscordで確認する。[Discordの権限](https://docs.discord.com/developers/topics/permissions)
- `/soul-vc` は、家のPCでDiscordの場を開いたとき、そのサーバーに登録される。Botが既存の `bot` スコープで導入されている場合は `applications.commands` が含まれる。コマンドを使えるメンバー・ロール・チャンネルは、Discordの **サーバー設定 → 連携サービス（Integrations）→ Botの管理** で設定する。[Discordのコマンド登録と権限](https://docs.discord.com/developers/interactions/application-commands)
- コマンドが見えるのに応答しない場合は、Discordの場が開いていることと、Developer PortalでBotの **Interactions Endpoint URL** が空であることを確認する。Cockpitは接続中のGatewayからコマンドを受け取る。[DiscordのInteraction受信経路](https://docs.discord.com/developers/interactions/receiving-and-responding#receiving-an-interaction)

## 操作

1. 家のPCで従来どおり `npm run cockpit --prefix apps/soul/agent` を起動して、Cockpitで既存のDiscordの場を開く。場を開くと準備で指定済みのVCに入る。
2. Discordパネルの **読むチャット** で、試す投稿先を選ぶ。通常のチャットは `#`、VC付属チャットは `VC 付属` と表示される。VC接続先と読むチャットはそれぞれ選べる。可能なコマンドは同じ区画に表示されるので、確認中なら **読み直す** を押す。
3. 初回の呼び出しも試すため、PCのVC操作かDiscordの `/soul-vc leave` でチャッピーだけ退出させておく。場が開いたままなのを確認する。
4. スマホで使うVCに入り、Discordの入力欄で `/soul-vc join` を実行する。チャッピーがそのVCへ入ることを確認する。
5. 読むように選んだチャットへ、本文のあるメッセージ、写真、内容を知っているPDFを順に投稿する。VCでそれぞれ「今チャットに貼った、見れる？」などと尋ね、実際の内容に沿って話せるか確かめる。準備中だと答えた場合は少し待って尋ね直す。
6. PCのCockpitで読むチャットを別のチャットに変え、切替後に共有した新しい投稿について質問する。既に会話した内容は会話文脈に残る。
7. スマホで `/soul-vc leave` を実行する。チャッピーがVCを退出しても場が開いていることを確認し、スマホから `/soul-vc join` でもう一度呼ぶ。

資料の例はJPEG・PNG・WebPとPDF。画像の元ファイルは4 MiBまで。PDFは8 MiBまで、先頭3ページを描画できた範囲で扱う。大きな資料と準備途中の添付は、読み取れた範囲を示す。資料を投稿した時点で自動の返答は発生しない。[資料の上限と実測](./wave1-completion.md)

チャッピーがすでに別のVCにいる場合は、退出してから呼ぶ。読む先や権限・接続状態で結果が違ったときは、どの操作、どの投稿、どの発話で違ったかを控える。

## 元の設定に戻す

- Cockpitの **読むチャット** で前のチャットか **選ばない** を選ぶ。
- Discordからの操作は、必要に応じてDiscordの連携サービスで `/soul-vc` を使えるロール・メンバー・チャンネルを元に戻す。
- この確認でBotのMessage Content Intentを変更した場合は、使い終えた状態に合わせてDeveloper Portalで元の値へ戻せる。変更を反映するには、次にDiscordの場を開き直す。

内部試験には、合成の投稿・Discordのfixture・Codexの隔離応答を使った。実Discordの登録・権限・スマホからの操作・VC音声はこの手順で確認する。Claudeの実モデルは既存のOAuth期限切れで未確認。[PDF実験](./pdf-path-experiment.md)
