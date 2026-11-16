# Discordで秘匿ハンドアウトを受け取る議論の記録

2026-11-16、スマホでDiscord VCに入り、安全に立ち止まって撮った写真をVC付属テキストチャットへ送る案に関連して、過去の議論を確認した。直接の出典は2026-11-01のDiscordモード人間ゲート2の結果。 [人間ゲート2の結果 §2](../implementation/waves/discord-mode/human-gate-2-result.md#2-設計の変更-vc-から抜けると体験を閉じるを分けるユーザー判断-2026-11-01)

## 当時の合意

- TRPGの個別シーンや休憩後の再集合を想定し、Discordの体験とVC接続の寿命を分ける。同じサーバー内でVCを移動でき、抜けてもチャッピーのセッションと会話は体験に残る。 [人間ゲート2の結果 17–28行](../implementation/waves/discord-mode/human-gate-2-result.md#L17-L28)
- GMから追加資料が配られて目を通す場面を想定し、通話中の操作パネルに「見る窓」の切り替えと「使わない」を入れる。 [人間ゲート2の結果 38–49行](../implementation/waves/discord-mode/human-gate-2-result.md#L38-L49)

## 当時の将来候補と未決事項

当時の実装範囲外として、次の3件が並んでいる。 [人間ゲート2の結果 57–60行](../implementation/waves/discord-mode/human-gate-2-result.md#L57-L60)

1. 秘匿ハンドアウトなどを、ユーザーを経由せずにチャッピーが直接受け取る。
2. Discordでチャッピーと個別にテキストチャットする。声に出さず伝えるための欄より、Discordで個別にやりとりする方が望ましいという意向が記録されている。
3. VC付属の文字チャットをチャッピーが読む・書く。いつ読み書きするかは未決。

秘匿ハンドアウトの受け渡し先は未特定。個別チャットがBotへのDMか、閲覧者を制限したチャンネルかも記載がない。VC付属チャットの読み書きは明記されているが、そこを秘匿資料の受け渡し先とする決定は確認できなかった。 [人間ゲート2の結果 57–60行](../implementation/waves/discord-mode/human-gate-2-result.md#L57-L60)

## 現行実装の確認

DiscordのVC接続には入る・抜ける・移る操作があり、Discord用の「見る窓」は家のPC上のウィンドウを既存の撮影経路に渡す。Discordクライアントはサーバーと音声状態のIntentsで作られ、現行のDiscord入力にメッセージや写真添付の取り込みは確認できなかった。コード読解による確認。 [VC操作](../../../apps/soul/agent/src/discord/discord-experience.mjs#L1389-L1434) · [視覚経路の棚卸し](repository-inventory-2026-11-16.md#1-コードで確認したこと) · [Discordクライアントの生成](../../../apps/soul/agent/src/discord/discord-experience.mjs#L414-L417)

## 今回の案とのつながり

今回の写真案は、3のVC付属チャットを写真の入口として使い、同じ通話の中でチャッピーが内容を受け取る案と読める。1との共通点は、送り手が共有したものを、家のPCを操作して見せ直す人を介さずにチャッピーへ届けること。秘匿ハンドアウトでは資料を誰に届けるかが論点であり、外出時の案ではユーザーが見せたい場面を選んで共有することが出発点。写真添付の取り込み方と会話に反映するタイミングは今回の検討事項。 [当時の候補](../implementation/waves/discord-mode/human-gate-2-result.md#L57-L60) · [今回の体験と前提](scope-and-decisions.md)
