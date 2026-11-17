# Wave 2 独立レビュー

2026-11-16。修正ループ2後の内部判定は合格。基点 `8369493e`、ブランチ `codex/discord-companion-inputs`。Wave 1完了時に確定した資料保持・描画・Fireへの受け渡しと、Wave 2で加わったDiscordからの受信・操作を照合した。

## 初回指摘

1. **再選択したチャットに旧投稿を再配送すると、資料に戻る。** `createDiscordChatReceiver` は現在のguild/channelと権限を確認するが、投稿の時刻を受信先の世代開始時点と照合していない。受信先を切り替えるとWave 1の資料保持が重複判定も初期化する。合成イベントで「Aで投稿を受信 → Bに切替 → Aを再選択 → 同じAのMessageCreateを再配送」と進めると、資料に旧本文が戻った。再選択時に受信対象時刻を切り、別の場や選択世代の遅延イベントでも同じ挙動を検証する。進行中の添付取得が古い世代から戻る経路は既存試験で中断を確認できている。[受け渡し仕様](../../waves/discord-companion-inputs/basis.md)
2. **同名・同構造の別用途コマンドを受け付ける。** 合成REST一覧に説明が別用途で `join` と `leave` を持つ既存コマンドを返すと、そのIDを `ready` として採用した。また、別guild・openingの応答はID確認に先行する。既存コマンドのIDを取り込む基準を強め、既知のIDへの応答に限定する。Discordのコマンド登録自体は開場後の対象guildに限定され、相違する構造に対してPOSTしていない。[Discord Application Commands](https://docs.discord.com/developers/interactions/application-commands)

## 修正ループ1

- 同名でも説明や型・引数が異なる既存コマンドは `name-conflict` になる。コマンドIDは別guildや場の状態を調べて応答する前に照合する。コマンドのguild IDが省略された場合も、登録済みIDと実行元guildを検証した上で扱う。
- 場内の受信済みIDを切替を跨いで保持するため、Aへ戻した後の同一イベント再配送は空になった。初回配信が遅れたイベントは残る。A→B→Aの直後に、1秒前の投稿時刻を持つ初出IDを配信すると旧本文が資料に入った。Discord GatewayのResumeは未受信のイベントを通常と同じ形で配信するため、受信先の有効化時刻を使った検証が残る。[Discord Gateway Resume](https://docs.discord.com/developers/events/gateway#resuming)
- Cockpit手順にInteractions Endpoint URLの確認が追加された。独立試験は対象189件合格。うち154件は資料保持、Windows描画、通常・視覚Fire、モデルセッション入力の回帰。

## 修正ループ2

- 開場後の保存設定の復元、受信先変更、閲覧権限の復帰で、受信先の有効化時刻を記録する。対象guildが再び利用可能になったときにも閲覧権限を再確認する。同時刻以前の投稿を拒否する。同じ受信先の再確認と再保存では時刻を更新しない。投稿時刻と有効化時刻の照合はPCとDiscordの時計が通常どおり同期していることを前提とする。
- 前回の独立再現を再実行した。A→B→Aの後に、既受信のイベントと1秒前の初出イベントを届けても資料は空で、選択後の新しい投稿が資料に入った。独立試験は対象190件合格、失敗・スキップ0件。`git diff --check` は成功した。

## 検証

- 独立対象は35件合格。偽DiscordによるBot権限、通常チャット・VC付属チャットの選択と切替、資料の公開経路への非流出、Intent無効・Gateway 4014、添付URL・サイズ・中断、VC排他・終了・再参加、Cockpit UIの項目を確認した。サンドボックス内ではループバック通信が `EACCES` となり、承認済みのローカルループバック実行で確認した。
- 2026-11-16からHTTPのguildチャンネル一覧はBotに閲覧権限のないチャンネルを省く。Gatewayは難読化したチャンネルを送れるため、Botの権限と難読化フラグの両方で判定する現行方針に沿う。インストール済みdiscord.js 14.27.0の `ChannelObfuscated` は131072だった。[Discord変更履歴](https://docs.discord.com/developers/change-log#channel-obfuscation-for-users-and-bots)
- DiscordのGatewayとHTTP Interaction配送は排他的。既存BotでInteractions Endpoint URLを設定済みの場合は、手順でその設定を診断できるとよい。[DiscordのInteraction受信](https://docs.discord.com/developers/interactions/receiving-and-responding#receiving-an-interaction)

最終ソースの通常npm起動はオーケストレーション担当が隔離コピーで確認し、Cockpit画面・UI・状態・Discordパネルが200、閉場中のチャットAPIが409、正常終了を観測した。実Discordの既存Bot、スマホとVCを使った操作、投稿した資料についての音声会話は本人確認待ち。[本人確認手順](../../waves/discord-companion-inputs/human-gate.md)
