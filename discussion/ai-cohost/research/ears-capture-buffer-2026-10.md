# 耳のマイク取り込み遅延(dshow 既定バッファ)— 2026-10-16

> ElevenLabs STT の計測([../elevenlabs/experiments/01-stt-behavior.md](../elevenlabs/experiments/01-stt-behavior.md))中に見つかった、魂の耳の取り込み遅延。サブエージェント(Sylph)の実測と読解。【実測】【リポジトリ事実】【公式】【推測】を分ける。

## 1. 実測(2026-10-16、MV7+、静かな状態、各条件 4〜5 秒、音声は保存せず)

| `-audio_buffer_size` | チャンク間隔 中央値 / 最大 | チャンクサイズ | 備考 |
|---|---|---|---|
| 指定なし(現行) | 497.8 / 505.9ms | 16000B(500ms 分) | 遅れが約 500ms のまま続く。spawn→最初のチャンク 1373ms |
| 100 | 95.1 / 116.2ms | 3200B | |
| **50** | **51.5 / 64.3ms** | **1600B** | 欠落・警告・目立つ CPU 増なし |
| 20 | 20.8 / 33.2ms | 640B | 到着が不規則 |
| 10 | 11.5 / 22.4ms | 320/640B 交互 | 到着が不規則 |

- ElevenLabs 計測スクリプトでも、50 指定でチャンク間隔の中央値 52ms / 最大 65ms(60 秒、1184 チャンク)。

## 2. リポジトリ事実

- `apps/soul/agent/src/ears/ffmpeg-capture.mjs` の `buildFfmpegArgs` は `-audio_buffer_size` を渡していない。
- `ear-pipeline.mjs` の時計はリングバッファのサンプル数なので、区間の切り出しはずれない。ただし speechStart / speechEnd の**壁時計での発火**はチャンク到着に引きずられ、0〜500ms 遅れる。
- 影響を受けるもの: barge-in(`src/mind/barge-in.mjs`。声を止めるのが最大約 0.5 秒遅れる。相槌と本格的な発話の境目が ±0.5 秒ぶれる)、区切り応答(`src/mind/fire-scheduler.mjs`。speechEnd 後 2000ms 待ちの起点が遅れる)。
- [../experiments/s2-ears.md](../experiments/s2-ears.md) の「発話終了→転写 ≈1.5s(体感 ≈1.9s)」は speechEnd 発火時刻を起点とし、模擬マイク(100ms 注入)で測った値。この取り込み遅れを含まない。
- fire-diagnostics は `fire.accepted` 以降しか記録しないため、この遅れは診断に現れない。

## 3. 公式

- ffmpeg の dshow `audio_buffer_size`: 単位 ms。既定はデバイスの既定バッファで "typically some multiple of 500ms"。小さすぎると性能が落ちることがある。https://ffmpeg.org/ffmpeg-devices.html

## 4. 推測

- 実マイクでの遅れは 0〜500ms のほぼ一様分布(平均 ≈250ms)。現行 whisper 経路の実際の「言い終わり→転写」は平均 ≈2.15 秒、最悪 ≈2.4 秒。
- 配信の負荷(OBS + 器の二体 + whisper 推論)の下で 50ms が取りこぼさないかは未確認。

## 5. 決定と次の一手(ユーザー 2026-10-16)

- 既定値を 50ms にする。
- 配信負荷下の確認は「たぶん大丈夫」との見立てで、今は求めない。
- 修正は**ElevenLabs 調査が一段落してから別セッションで行う**。ElevenLabs の計測スクリプトが同じ部品を読み込んでいるため、並行作業を避ける。
- (2026-10-16 追記)この修正は、操縦席の文字起こし選択の作業に含めて行う → [../implementation/screens/cockpit-stt-selection.md](../implementation/screens/cockpit-stt-selection.md)。
- 修正の範囲(案): `buildFfmpegArgs` に `audioBufferMs`(既定 50、dshow のときだけ `-f dshow` の後・`-i` の前に挿入、0/null で付けない)。`ffmpeg-capture.test.mjs` に引数の並び順のテスト。s2-ears.md に注記。
