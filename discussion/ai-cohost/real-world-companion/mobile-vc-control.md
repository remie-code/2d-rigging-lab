# Discord側からチャッピーのVC参加・退出を操作する

> 2026-11-16、ユーザーとUndineの合意。体験の範囲を記録したもの。実装計画やコマンド仕様は未決。

## 1. 要求と境界

外出先のモバイルデバイスから、チャッピーのVC参加・退出を操作できる必要がある。

**PC側で「Discordに参加する場」を開く既存の流れは変えない。場を開いている間のVC参加・退出について、Discord側にも操作の入口を追加したい。**

ユーザー本人がスマホからVCへ入る操作だけの話ではなく、チャッピーの接続を操作する要求。専用の遠隔操作アプリを増やさず、Discord内で呼ぶ・退出させる体験をユーザーは肯定した。

## 2. 想定する体験

1. 家のPCで既存のDiscordの場を開く。
2. 外出先のスマホから、チャッピーを自分がいるVCへ呼ぶ。
3. 会話を終えたら、Discord側からチャッピーをVCから退出させる。
4. 場は開いたままなので、後でもう一度VCへ呼べる。

VCからの退出と、場の終了・アプリの終了は別。既存の場と接続の区別を維持する。

## 3. 説明用の案と現行実装

Undineは `/チャッピー 呼ぶ`、`/チャッピー 退出` を例示した。**コマンド名・書式・ボタンかコマンドかは未決**。Discordにはコマンドやボタンの操作をアプリへ届ける仕組みがある。[公式Application Commands](https://docs.discord.com/developers/docs/interactions/slash-commands)（2026-11-16確認）

現行コードにはVC参加・退出・移動の処理と、PC内の操縦席APIがある。

- [discord-experience.mjs](../../../apps/soul/agent/src/discord/discord-experience.mjs)：`joinVoice`、`leaveVoice`、`moveVoice`、公開口 `vc`。
- [cockpit-server.mjs](../../../apps/soul/agent/src/cockpit/cockpit-server.mjs)：`POST /api/discord/vc`。操縦席はloopback限定。

これらはコード読解の事実であり、Discordのコマンドから既に操作できるという意味ではない。

## 4. 議論中の解釈を修正した点

Undineは当初、起動・待機の整理も含めて説明した。ユーザーは、場の作成は現在のままでよく、VC参加・退出の操作をDiscord側からも行いたいのだと明確化した。

そのため、PC電源の遠隔操作、アプリ／プロセスの遠隔起動、場の遠隔作成・終了、場が閉じていても応答する常駐サービスを、今回の要求へ追加しない。既に開いた場の中でVCを退出しても再度呼べることを扱う。

## 5. 未決事項

- 操作UI、名称、対象VCの選び方。
- 誰が操作できるかは後続context-checkでDiscord標準のコマンド権限に準拠すると合意。具体的な設定手順は実装時に整える。
- 他のVCで会話中に呼ばれた場合などの扱い。
- 場が開いていない場合にユーザーからどう見えるか。

具体的なコマンド名や手順は[承認済みの2 Wave計画](../implementation/orchestration/discord-companion-inputs-wave-plan.md)で実装へ進む。既存VC操作の意味を変える製品判断が必要なら、実装担当が無断で決めずrootへ戻す。
