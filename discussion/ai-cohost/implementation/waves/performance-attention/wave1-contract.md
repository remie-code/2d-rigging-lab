# 演技と対象からクリップを選ぶ契約

Wave 2の接続先は共有の [`speech-motion-registry.json`](../../../../../apps/runtime-player/src/main/control-channel/contract/speech-motion-registry.json)。`performances` と `attentionTargets` はそれぞれIDと説明の対応表。判定の各質問へ別々に渡し、演技の「どれでもない」と対象の「不明」は各質問に明示する。`pairs` が制作済みの組合せの正本。Soulは既存のアプリ境界に従ってRuntime Playerの契約JSONを読み、Runtimeの実行モジュールを直接importしない。

Runtime側の [`resolveSpeechMotion(performanceId, attentionTargetId)`](../../../../../apps/runtime-player/src/main/control-channel/contract/speech-motion-registry.mjs) は `{ presetId }` または `{ reason }` を返す。Wave 2は同じJSONを使って同じ順で理由を解決する。`unsupported-performance` は未登録演技、`unknown-attention-target` は対象不明、`unproduced-pair` は両方が登録済みでクリップが未制作。両方が不明ならlookupの理由は演技が先になる。記録には元の二回答をともに残す。

| `performanceId` | `attentionTargetId` | `presetId` |
|---|---|---|
| `receive` | `partner` | `receive` |
| `interest` | `partner` | `interest` |
| `ask` | `partner` | `ask` |
| `brief-relief` | `partner` | `brief-relief-partner-v1` |
| `brief-relief` | `game` | `brief-relief-game-v1` |
| `brief-relief` | `viewers` | `brief-relief-viewers-v1` |

既存の `sendMotion` を使う。`begin` で開始した接続と区間に、同じ `generation` と `sectionIndex` を使って `play` を送る。

```js
await channel.sendMotion({ op: "begin", generation, sectionIndex });
await channel.sendMotion({ op: "play", generation, sectionIndex,
  performanceId: "brief-relief", attentionTargetId: "partner" });
await channel.sendMotion({ op: "end", generation, sectionIndex });
```

従来の `play` で `presetId` を送る形式も使える。直接指定と `presetId`/`stageY` の併記は拒否される。未対応の分類には共有lookupを使う。WS `accepted` は有効なリクエストの受付であり、世代・接続・区間による適用判定を通ったことやモデル上で表示されたことの証明には使えない。短い安堵3組の `motionModelMismatch` はr804のpackage ID・revision・atlas SHA-256・対象slot bindingが揃わない再生時の拒否。意味上の未対応3理由とは別の診断にする。

`end` は区間の追加再生を閉じ、進行中の登録クリップはその場で完走する。中断には `cancel` を使い、`end` 後の継続中にも送れる。より新しい区間の `begin`、kill、接続切断は旧クリップを解除する。遅い判定がすでに閉じた区間や古い接続を再起動しないよう、Wave 2でも再生送信前に音声と区間の有効性を確認する。音声開始は判定結果や記録を待たない。
