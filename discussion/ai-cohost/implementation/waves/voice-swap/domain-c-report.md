# 声の差し替え Wave 2 / Domain C — 声の差し替え口と全経路の載せ替え 完了報告

> Gnome → Undine（2026-10-18）。計画: [../../orchestration/voice-swap-wave-plan.md](../../orchestration/voice-swap-wave-plan.md) §0・§2 Domain C・「Wave 1 からの申し送り」。コミットはしていない。`apps/runtime-player` には触れていない（作業ツリーの runtime-player の差分は Domain A2 のもの）。

## 1. 変更・追加・削除したファイル（すべて `apps/soul/agent/` 配下）

新規:

- `src/voice/engines/voice-engine.mjs` — VoiceEngine の形（typedef）、`createVoiceEngine`、`VOICE_ENGINE_FACTORIES` / `VOICE_ENGINE_KINDS` / `DEFAULT_VOICE_ENGINE_KIND`、`isVoiceEngine`
- `src/voice/engines/engine-status.mjs` — 状態の語彙と、`status` / `onStatus` を作る小さな入れ物（Wave 3 の ElevenLabs でも使える）
- `src/voice/engines/aivis-voice-engine.mjs` — `createAivisVoiceEngine`（旧 prepareSpeech の 1〜4 と PCM の取り出し）
- `src/voice/speech-streamer.mjs` — `createSpeechStreamer`（文の列）と `speakOnce`（1 文だけ）
- `src/voice/wav-pcm.mjs` — `readWavPcm`（WAV ヘッダからサンプルレートとチャンネル数を読み、data の中身を返す）
- `src/voice/audio-devices.mjs` — 旧 audio-player から `listAudioDevices` / `parseListDevicesStdout` をそのまま移した
- `src/test-support/fake-stream-player.mjs`、`src/test-support/fake-voice-engine.mjs`（engine と speechStream 用 channel の代役）
- テスト: `engines/voice-engine.test.mjs`、`engines/aivis-voice-engine.test.mjs`、`speech-streamer.test.mjs`、`wav-pcm.test.mjs`、`audio-devices.test.mjs`

変更:

- `src/mind/fire-orchestrator.mjs`（両経路の載せ替え・割り込み・キル・dispose・遅延）
- `src/mind/fire-latency.mjs`（区間の定義）
- `src/mind/fire-diagnostics.mjs`（開始の目印のイベント名）
- `src/voice/tts-client.mjs`（audioQuery / synthesis に省略可能な `{ signal }` を足した）
- `src/cockpit/cockpit-server.mjs`（列挙の import 先だけ）
- `src/cli/cli.mjs`
- `scripts/cockpit.mjs`、`scripts/preflight-e2e.mjs`、`scripts/preflight-voice.mjs`、`scripts/observe-conversation.mjs`
- `src/mind/fixtures/fire-diagnostics.success.jsonl`
- 上のテスト群: `fire-orchestrator.test.mjs`、`fire-latency.test.mjs`、`fire-diagnostics.test.mjs`、`cli.test.mjs`、`cockpit.test.mjs`、`cockpit-server.test.mjs`、`tts-client.test.mjs`

削除:

- `src/voice/audio-player.mjs` とそのテスト
- `src/voice/speak.mjs` とそのテスト
- `src/voice/progressive-speech-delivery.mjs` とそのテスト
- `src/voice/tts-playback-coordinator.mjs` とそのテスト
- `src/test-support/echo-player.mjs`、`src/test-support/fake-media-player.mjs`

一時 WAV を書く処理はなくなった（`writeTempWav` / `writeOwnedTempWav` も削除）。

## 2. 最終形

### VoiceEngine

```
{ kind, status, onStatus(listener) → off, synthesize(text, { signal, onTrace }) → AsyncIterable<chunk>, dispose() }
```

- chunk は次の 4 種類:
  - `{type:"format", sampleRate, channels}`
  - `{type:"audio", pcm}`
  - `{type:"timeline", entries}`
  - `{type:"end"}`
- timeMs はその文の音声先頭からの通し値。
- 失敗は列の途中で throw する（code / diagnosticStage 付き）。

### AivisVoiceEngine

- 今の均等割り（`buildSpeechTimeline`）をそのまま使う。
- 出す順は format → timeline → audio → end（理由は §6-1）。
- status は常に `up`。`dispose()` で `down` になる。
- 実機の AivisSpeech（127.0.0.1:10101）で 1 文を合成した結果:
  - format は 44100Hz / 1ch。
  - timeline は 9 要素（先頭 timeMs 100）。
  - PCM は 197,752 byte。
  - 所要 1.27 秒。再生はしていない。

### createVoiceEngine(kind, deps)

- 今は `"aivis"` だけを作れる。知らない kind は RangeError。
- Wave 3 は `VOICE_ENGINE_FACTORIES` に `elevenlabs` を 1 行足せばよい。

### createSpeechStreamer({ engine, player, channel, generationId?, releaseMouth?, onTrace?, onPlaybackStarted?, onPlaybackActivated?, … })

返すメソッド:

- `enqueue({text,index,final})`
- `finish()`（旧 finishLlm）
- `whenSettled()`
- `abort(cause)` / `bargeIn()` / `kill()` / `dispose()`
- `failure()`
- `snapshot()`

`snapshot()` の形は旧 progressive delivery と同じで、`active{timeline, startedAtMs}` を足した。

1 文の流れ:

1. 文を受け取ったらすぐ synthesize を始める（次の文は裏で溜める）。
2. 鳴らすのは FIFO の先頭の文だけ。
3. 形式と最初の音（または end）が揃ったら `openSpeech` を送る。
4. accepted を受けたら `player.open`。
5. 時間割を 512 要素ずつ `appendSpeech`（音より先）→ 音を `player.write`。
6. engine の end で `player.end` + `endSpeech`。
7. STARTED で「声が出た」とし、ENDED で次の文へ進む。

失敗と見張り:

- STOPPED / ERROR / exit / 見張りの時間切れは世代を閉じる（STARTED 待ち 5 秒、ENDED 待ち = 音の長さ + 750ms）。
- 中断・失敗・dispose では、open を送った文について player.stop → 口の release。
- endSpeech が失敗した文は、鳴り終わりで release する。
- 自然に終わった文は endSpeech だけ送る。
- 別 id の事象は無視する。accepted は効いた根拠にしない。
- playbackId は運び手ごとの通し番号を含み、世代をまたいで重ならない。

### speakOnce(text, deps)

- 器が open を受理して鳴らし始めたら返る。
- それより前の失敗は code 付きで投げる。
- 返り値:
  - `ended`: ENDED / 中断 / 失敗で解決する。
  - `snapshot()`: 累積の時間割と STARTED 時刻。
  - `stop(cause)`

## 3. 各経路の載せ替え

- **Codex（文ごと）**
  - 既定の `speechStreamerFactory` は createSpeechStreamer（旧 `progressiveDeliveryFactory` から改名）。
  - FIFO、STARTED 前の割り込みは効かないこと、文の間の割り込み、playedText（ENDED まで鳴った文）、C3 の部分の正本化は、どれも今と同じ。
- **Claude（一括）**
  - `speakImpl`（既定 speakOnce）の `ended` で完了する。WAV 長のタイマーは廃止した。
  - `ended` を持たない返り（テストや計測の偽物）は、返った時点で完了とみなす。
  - `computeSpokenPrefix` には、止める前の `snapshot()` の時間割と STARTED 時刻を渡す。STARTED 前は経過 0。
    - 実際の streamer で 350ms の切断が「こんに」になり、今と同じ結果を確かめた。
- **鳴らし始めた後の失敗（Claude 経路）**: fireError にし、soul には積まない。
- **割り込み・キル**
  - stop が player.stop を同期に呼び、口を release し、全文の synthesize へ signal で中止を伝える。
  - barge-in と kill の release は今と同じ診断名（`bargeIn…` / `kill…`）で握る。
  - 失敗や dispose のときの release は、診断を増やさず静かに送る。
  - dispose では一括の読み上げも止めるようにした（今は止めずに鳴り切っていた）。
- **engine の受け取り**: `acquireFireResources` の `engine` を使う。無ければ `speakDeps` から AivisSpeech の engine を作る（テスト・計測用）。
- **操縦席（cockpit.mjs）**
  - Start（`onEarsStarted`）で `ensureVoiceResources()` を呼び、流し込みプレイヤーと engine を作る。Start より前の Fire はその場で作る。
  - 常駐が落ちていたら作り直す。
  - 出力デバイスの変更は今の revision 方式のまま（次の Fire の境目で作り直す）。
  - lazyChannel に openSpeech / appendSpeech / endSpeech を足した。
  - accepted snapshot には player と engine の実体を載せる。
  - 診断の player.child は行の種類だけを残す。
- **cli.mjs**: 新しい経路に直した。次の一文は ENDED を待ってから処理する。
- **preflight-e2e**: 新しい経路に直した。
- **preflight-voice**: 流し込みプレイヤーとメモリ上のサイン波に直した（WAV ファイルは作らない）。
- **据え置き**（旧経路に依存していないため）:
  - `preflight-tts.mjs`: tts-client / mora-timeline / wav-duration だけを使い、再生も送信もしない。
  - `soul/reference-driver`: 器の intent.speech の糖衣で動く。

## 4. 遅延イベントの新しい名前

| 区間 | 始まり | 終わり |
|---|---|---|
| ttsMs | `voice.synthesis.requested` | `voice.audio.first_chunk` |
| voiceMs | `voice.audio.first_chunk` | `voice.player.started` |

- どれも SpeechStreamer が出し、jobId（`…:sentence-1`）が付く。両経路で共通。
- `markVoiceStarted` と、player の出力行を直接見る経路は廃止した。
- 操縦席の表示（glance-meters）のキー（ttsMs / voiceMs）とラベル（「TTS」「声」）は engine に依存しないので、そのままにした。
- fire-diagnostics の開始の目印は `player.play.enqueued` から `speech.playback.activated` に変えた（記録の項目名 `sincePlaybackEnqueueMs` はそのまま）。

## 5. 期待値を変えた既存テスト（すべて仕様変更に伴うもの）

1. **fire-orchestrator.test**
   - 文ごとの読み上げの偽物を、旧 prepareSpeechImpl / 行プロトコルから、本物の SpeechStreamer + 代役の engine / player / channel に替えた。
   - 再生 id の値（`19968.wav` → 発話 id）を変えた。
   - トレース名を `progressive.playback.activated` から `speech.playback.activated` に変えた。
   - barge の偽物は、自然完了をタイマーの前進から `ended` の解決に替えた（3 か所）。
   - 遅延の 2 テストを新しいイベント名にした。文ごとの方は inFireMs 1700 → 1600、TTS 区間の始まりは文の確定時になる。
2. **fire-latency.test**: イベント名を変え、`markVoiceStarted` の検査を削除した。
3. **fire-diagnostics.test と success fixture**
   - 一時 WAV の書き出し失敗（`speech.wav.write`）の場合を削除した。
   - 器側の偽物を `onSpeechStream` / speechStream channel にした。
   - fixture を新しいイベント列で作り直した。
   - 送信バイト数の検査を append 要求に変えた。
   - failure fixture は旧形のまま（stage / code だけを検査している）。
4. **cli.test**: intent.speech 2 本と再生パスの検査を、speechStream の open / append / end × 2 と open 2 回の検査に替えた。
5. **cockpit-server.test（遅延の SSE）**: イベント名を変えた。

テスト件数は 1399 から 1396 に減った。旧モジュールのテストを消し、新しいテストを足した結果。

## 6. 裁量判断

1. **AivisSpeech は timeline を audio より先に出す。** 計画 §0 の記述は「format → audio → timeline → end」だが、時間割を先にすると、器への append が必ず音より先に届く（申し送り 2）。
2. **open は「番が来た」かつ「形式と最初の音（または end）が揃った」ときに送る。** 揃う前に open すると、口の t=0 が音よりずっと先になってしまうため。
3. **append の失敗・拒否は声も止めて失敗にする。** 今の「拒否なら鳴らさない」に合わせた。end の失敗では声は止めず、鳴り終わりに release する。
4. **dispose では一括の読み上げも止める**（§3 参照）。
5. **時間割の 512 要素の上限（buildSpeechTimeline）はそのままにした。** 一括の読み上げで 512 モーラを超える文は、今と同じく失敗する。

## 7. テスト結果

- `apps/soul/agent` の `node --test`: 1396 件すべて成功。
- `check:soul-zone`: 成功（1504 ファイル）。

## 8. 質問

1. **長い返事を通すか。** 発話全体の上限が 4096 要素になったので、一括の読み上げも 512 を超えて通せる。`buildSpeechTimeline` の上限を緩めてよいか。
2. **鳴らし始めた後に失敗したときの扱い。** 今は fireError にし、鳴った分を soul に積まない。文ごとの読み上げのように「鳴った分 + 中断注記」で正本化すべきか。
