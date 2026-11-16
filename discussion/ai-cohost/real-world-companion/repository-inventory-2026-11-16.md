# 外出・家での会話に向けた既存機能の限定棚卸し

> 2026-11-16、Undine が議論中に現行コードを読解。実プロセスの起動、Discord接続、実機・移動中の検証はしていない。網羅的な実装監査ではない。

## 1. コードで確認したこと

| 機能 | 確認内容 | 根拠 |
|---|---|---|
| VC参加・音声入力 | Botのログイン、VC参加、参加者ごとの音声購読と文字起こし。発話に名前と話者IDを付ける | [discord-experience.mjs](../../../apps/soul/agent/src/discord/discord-experience.mjs) の openEntrance / speakerTranscriptMouth |
| 音声出力 | 合成音声をVCへ流す再生器がある | [discord-stream-player.mjs](../../../apps/soul/agent/src/discord/discord-stream-player.mjs) |
| 会話への参加判断 | Discord向けの発話判断と、通話の場であることを伝える指示がある | [discord-experience.mjs](../../../apps/soul/agent/src/discord/discord-experience.mjs)、[venue-discord.md](../../../apps/soul/agent/skills/venue-discord.md) |
| 人の出入り・VC移動 | 入退室を会話に伝える。VC接続と通話体験の寿命が分かれ、VC離脱だけでは会話の文脈を閉じない | [discord-experience.mjs](../../../apps/soul/agent/src/discord/discord-experience.mjs) の vc / emitVc |
| 視覚なしの通話 | Discord用の見る窓を未設定にできる | 同ファイルの visionTarget / eyesWanted |
| 現行の視覚入力 | 家のPC上の対象ウィンドウを指定し、撮影して画像を渡す。Discord用と配信用の設定を分けている | [cockpit.mjs](../../../apps/soul/agent/scripts/cockpit.mjs) の venueVisionTarget / residentCapture、[fire-orchestrator.mjs](../../../apps/soul/agent/src/mind/fire-orchestrator.mjs) の getVisionTarget / captureImpl |
| 操縦席 | HTTPはloopback限定。外出先の端末から直接操作する入口としては提供していない | [cockpit-server.mjs](../../../apps/soul/agent/src/cockpit/cockpit-server.mjs) の DEFAULT_COCKPIT_HOST / LOOPBACK_HOSTS |

## 2. この棚卸しからの見立て

以下は既存コードからの見込みであり、実機での成立を確認した結果ではない。

- 家側でチャッピーを起動してVCに参加させ、手元の端末が同じVCの音声を送受信できれば、まず音声だけで会話する試しは既存機能で行える見込みが高い。
- 今のDiscord実装は参加者の映像を直接受け取る仕組みではない。現在の視覚経路にも、参加者ごとの視界の受信・共有の選択・所有者との対応付けはない。そこは拡張として検討する必要がある。
- 既存のPCウィンドウ撮影に、遠隔映像を表示した窓を渡す案は考え得るが、今回は実現性・操作性を検証しておらず採用していない。
- 外出先から起動や参加を操作する体験は、現行のPC内限定の操縦席とは別に考える必要がある。既存APIの存在は外部公開や遠隔操作方式の採用を意味しない。

## 3. 今回確認していないこと

- スマートグラス等の具体的な製品仕様、Discordとの互換性、映像の取り出し方。
- Discordで人同士が共有する映像を、Botが直接受信できるか。
- 外出時の端末、音声品質、回線変動、遅延、電池、装着時の安全性。
- 複数参加者がそれぞれ映像を共有する実際の操作体験。

外部仕様の公式確認や実測はまだない。既存のDiscord子トピックの地図には開発途中の状態表記も残るため、現在できることを旧地図の要約だけから判断しない。

要求の正は [scope-and-decisions.md](scope-and-decisions.md)。この棚卸しを機器選定や共通設計の決定として扱わない。
