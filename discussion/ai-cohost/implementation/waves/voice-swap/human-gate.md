# 声の差し替え 人間ゲート

> Status: PENDING(手順を用意 2026-10-18)。計画は [../../orchestration/voice-swap-wave-plan.md](../../orchestration/voice-swap-wave-plan.md) §6。

## 0. 準備

1. **器を作り直す**(必須)。器は新しい約束 `intent.speechStream` を知っていないと、接続で弾かれる。
   - いつもの起動方法に合わせて、どちらかで作り直す。
     - ビルド済みを使う場合: `pnpm --filter @private-2d-rigging-lab/runtime-player build`
     - 実行ファイル(pack)を使う場合: `pnpm --filter @private-2d-rigging-lab/runtime-player pack`
   - 開発起動(`dev`)の場合は不要。
2. AivisSpeech を起動しておく。ElevenLabs を選んだときも、読みを取るのに使う。
3. 操縦席を管理者で起動する(`start-cockpit.cmd`、今までどおり)。器を開き、Channel が緑になること。

## 1. 確かめる 6 点

| # | やること | 合格の目安 |
|---|---|---|
| 1 | 声 = AivisSpeech のまま Start → 何往復かしゃべる | 今と同じに聞こえて、口も動く(無退行) |
| 2 | 設定の入出力タブで声を ElevenLabs に変える → Stop → Start → しゃべる | 案3の声で鳴る。口が句読点やタグの所で閉じる。プチッという音が出ない |
| 3 | 何往復か続ける | 体感で前より早い。遅延バーの TTS と声の区間が短い(初回は遅くてよい) |
| 4 | チャッピーがしゃべっている最中に話しかけて割り込む | すぐ止まる。次の返事もちゃんと鳴る |
| 5 | 数分黙って放置し、その前後で ElevenLabs の残量を見る → また話しかける | 残量が減らない(生存確認は課金されない)。放置後も鳴る |
| 6 | ネットを切るなどで ElevenLabs を落とす → 戻す | 「つなぎ直し中」か「落ちた」の警告が出る。戻るとまた鳴る |

## 2. ついでに見てほしいこと

- 口と声のずれが気になるか。気になるなら、口を早める・遅らせる調整値 `alignmentLeadMs`(今は 0)を動かす。
- 読みのずれ(英字・数字で口が合わない等)が目立つか。

## 3. 記録

(ゲート後に追記)
