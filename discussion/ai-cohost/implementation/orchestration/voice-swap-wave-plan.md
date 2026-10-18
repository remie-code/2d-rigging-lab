# 声の差し替え(ElevenLabs TTS の流し込み)wave 計画

> Status: ACTIVE(2026-10-18 ユーザー承認)。Wave 1 完了・コミット 0ea68aea(軽い突き合わせ合格 [../reviews/voice-swap/wave-1.md](../reviews/voice-swap/wave-1.md))。Wave 2 完了・コミット 6ac2814e(軽い突き合わせ合格 [../reviews/voice-swap/wave-2.md](../reviews/voice-swap/wave-2.md)、仕上げ [../waves/voice-swap/wave-2-fixes-report.md](../waves/voice-swap/wave-2-fixes-report.md))。Wave 3 完了(軽い突き合わせ合格 [../reviews/voice-swap/wave-3.md](../reviews/voice-swap/wave-3.md)、仕上げ [../waves/voice-swap/wave-3-fixes-report.md](../waves/voice-swap/wave-3-fixes-report.md))。機械ゲート PASS(soul 1469/1469・soul-zone・runtime-player 981)。**人間ゲート PENDING** → [../waves/voice-swap/human-gate.md](../waves/voice-swap/human-gate.md)。根拠は [voice-swap-inventory.md](voice-swap-inventory.md)。
> レビューの粒度(ユーザー 2026-10-18): 「これまで Gnome 単独でやっていたくらい」。各ドメインは Gnome がテストまで含めて実装し、`node --test` と `check:soul-zone` で自分で確かめる。wave の終わりに Sylph が 1 回だけ、契約の食い違いを軽く突き合わせる(1 レーン、修正は Gnome)。

## 0. 形(全 wave 共通)

```
頭(Codex: 文ごと / Claude: 全文)
  └→ 声の差し替え口(VoiceEngine: aivis | elevenlabs) … 文 → 音のかたまり + 口の時間割のかたまり
       └→ 発話の運び手(SpeechStreamer)
            ├→ 流し込みプレイヤー(常駐 PowerShell + C#)… PCM を受けて鳴らす
            └→ 器(intent.speechStream)… 口の時間割を後から足す
```

- **VoiceEngine**(魂、`src/voice/engines/`):
  - `synthesize(text, { signal })` が、非同期の列 `{type:"format", sampleRate} | {type:"audio", pcm} | {type:"timeline", entries:[{timeMs,vowel,s}]} | {type:"end"}` を返す(audio と timeline の順は問わない。timeline を先に出せば器への append が音より先に届く。Wave 2 の Aivis はそうしている)。timeMs は発話の音声先頭からの通し値。
  - `status` / `onStatus`(`connecting|up|reconnecting|down`。STT と同じ語彙)を持ち、`dispose()` で畳む。
  - AivisSpeech は「1 回で全部届く流し込み」として、format → audio(WAV の PCM 部)→ timeline(今と同じ均等割り)→ end を一度に出す。
- **SpeechStreamer**(魂): 文の列を受け取り、再生は FIFO で 1 本ずつ流す。
  - 次の文は、前の文が鳴っている間に、裏で音と時間割を溜め始めてよい。
  - 鳴らす番が来たら、器へ `open` を送る → 受理されたら `player.open` → 溜めた分と続きを `write` / `append` で流す → 終わったら `end`。
- **約束の時刻**:
  - 口の t=0 は器が `open` を受理した時刻とする(今と同じ流儀)。
  - 声は受理のあとに鳴り始める。ずれは今と同程度でよい(合意 §1-9)。
  - ElevenLabs の alignment は 0 始まりだが、実際の声は 0.1〜0.2 秒後に出る。そこを詰める定数 `alignmentLeadMs` を設け、既定は 0 にする(人間ゲートで調整)。

## 1. Wave 1(基盤・並列 2 ドメイン)

### Domain A — 器の流し込みの約束(apps/runtime-player)

- 新しい kind **`intent.speechStream`** を足す。中身は次の 3 つ。
  - `{op:"open", utteranceId}`: 新しい発話を始める。前の発話を置き換える。t=0 = 受理時刻。
  - `{op:"append", utteranceId, timeline:[{timeMs,vowel,s}]}`: 続きを足す。timeMs は発話内で単調増加。1 回 512 要素まで、発話全体で 4096 要素まで。
  - `{op:"end", utteranceId}`: もう続きはない。
- **評価**:
  - `end` が来るまでは、終わりの自動クローズをしない。データが尽きたら最後の母音を保つ。
  - `end` 後は、今の「最後の間隔ぶん保持 → 400ms で閉じる」をそのまま使う。
  - 別の utteranceId の append / end は無視する(古い発話の残り)。
- **既存の `intent.speech`**: 器の中で「open + append + end」の糖衣として、同じ状態機械に流す。reference-driver と preflight は無改修で動き続けること。
- **停止**: 今の口の強制 release(`intent.set mouth-open=0`)で、流し込み中の発話も止まる。
- 契約 JSON・TS 型・検証・例・hello の supportedKinds・契約テストを揃える。凸恒等式・onset・決定論の golden は維持する。
- 魂側の `channel-client.mjs` に `openSpeech` / `appendSpeech` / `endSpeech` を足し、必須 kind の照合に `intent.speechStream` を加える。

### Domain B — 流し込みプレイヤー(apps/soul/agent/src/voice/)

- 常駐 PowerShell に C#(Add-Type、外部 DLL なし)の PCM 再生器を載せる。WASAPI か waveOut の選択は Gnome の裁量で、選んだ理由を報告に書く。
- **行プロトコル**(今の stdin 行方式を拡張):
  - 入力: `OPEN\t<id>\t<sampleRate>\t<channels>`、`DATA\t<id>\t<base64 PCM16LE>`、`END\t<id>`、`STOP`
  - 返り: `STARTED\t<id>`(最初のバッファが実際に再生を始めた時点)、`ENDED\t<id>`(END 後、全部鳴り終わった時点)、`STOPPED`、`ERROR`
- **出力デバイス**: 今と同じく名前で選ぶ(`SOUL_AUDIO_DEVICE_NAME` 相当)。一致しなければ既定デバイス。cockpit でデバイスを変えたら作り直す流れは維持する。
- **途中停止**: `STOP` で即座に止め、バッファを捨てる。
- **Node 側の API**: `createStreamPlayer({ deviceName })` → `{ open(id,{sampleRate,channels}), write(id, pcm), end(id), stop(), onEvent, dispose }`。
- 旧 `audio-player.mjs`(ファイル再生)は Wave 2 で使われなくなる。削除は Wave 2 の Domain C が行う。
- テストは常駐プロセスを偽物にして、行プロトコルと状態遷移を固定する。実音は人間ゲートで確かめる。

## 2. Wave 2(声の差し替え口 + AivisSpeech の載せ替え・1 ドメイン)

### Domain C — VoiceEngine / SpeechStreamer と全経路の載せ替え

- §0 の VoiceEngine と SpeechStreamer を作る。
- `AivisVoiceEngine` は今の `prepareSpeech` の 1〜4(audio_query → synthesis → 長さ → 均等割り)を包み、出力は今と同じ時間割(品質は同等)にする。
- Codex 経路(progressive-speech-delivery / tts-playback-coordinator)と Claude 経路(一括)の両方を SpeechStreamer に載せる。
  - Claude 経路の完了は WAV 長のタイマーではなく `ENDED` で判断する。
  - Claude 経路の `computeSpokenPrefix` は、累積の時間割と `STARTED` 時刻で今と同じ結果を出すこと。
- **割り込み**: player.stop → 口の release(今と同じ)。中断した発話の engine には `signal` で中止を伝える。
- **遅延の計測**: ttsMs = 最初の文で engine に頼んでから最初の音のかたまりまで。voiceMs = 最初の音のかたまりから `STARTED` まで。イベント名は engine に依存しない名前にし、操縦席の表示と fire-latency を合わせる。
- 一時 WAV と旧 `audio-player.mjs` を廃止する(%TEMP% 残留の解消)。
- 操縦席の既定は AivisSpeech のまま。この wave の終わりで、今と同じに聞こえて動くこと。

### Wave 1 からの申し送り(Wave 2 の完了条件に含める)

1. プレイヤーは Start のときに作る(起動に約 0.5 秒。最初の Fire に乗せない)。
2. 器への `open` は、その発話を鳴らす番が来てから送る。append は音声より先に送ってよい(データ切れによる口形の跳びを避ける)。
3. 器は別 id や古い id の append / end にも accepted を返す。魂は accepted を「効いた」と読まず、自分の発話順だけを根拠にする。
4. SpeechStreamer は、例外・中断・dispose のどの経路でも `endSpeech` か口の release(`mouth-open=0`)を送る(try/finally)。
5. 器の安全網(Undine 裁定 2026-10-18): end が来ないまま、データが尽きてから 2000ms、続きも end も来なければ、end と同じに扱って閉じる。Wave 2 で器側の小修正として並行に入れる(Domain A2)。
6. 実機確認の前に器を再ビルドする(`apps/runtime-player/out/` に旧 hello が焼かれていて、魂の必須 kind 4 種と食い違う)。

### Wave 2 からの申し送り(Wave 3 の完了条件に含める)

1. SpeechStreamer の `markTerminal` は、自然完了した文でも controller を abort する。barge-in では全 job を一斉に abort する。ElevenLabs engine はこう扱う。
   - end 後の abort は無視する。
   - 複数文の abort は、切断と再接続を 1 回にまとめる。
   - 1 本の WebSocket を共有するので、文ごとの `synthesize` は engine 内で直列にする(送信順 = 受信順)。
2. `scripts/cockpit.mjs` の engine は一度作ったら使い回しで、種類は既定値に固定されている。Domain E は Start で `ttsEngine` を読み、種類が変わっていたら作り直す(古い engine は dispose)。
3. 器の安全網があるので、alignment の到着が 2 秒以上空くと口が途中で閉じる。ElevenLabs は実時間の約 9 倍で届くため、通常は起きない。
4. Wave 2 の裁定(Undine): 一括読み上げの上限は 4096(器へは 512 ずつ)。Claude 経路で鳴り始めた後に失敗したときは「鳴った分 + 中断注記」で正本化する。次の ask への継続注記は足さない(今の割り込みの流儀のまま)。preflight-tts の上限は据え置く(診断用)。

## 3. Wave 3(ElevenLabs と操縦席・並列 2 ドメイン)

### Domain D — ElevenLabsVoiceEngine(apps/soul/agent/src/voice/engines/)

- **TTD WebSocket**: `eleven_v4_turbo`、voice `Ona22sJYfzcps6cE1jVk`、`pcm_24000`、language ja。
  - Start で接続し、つなぎっぱなしにする。10 秒おきに `{"keep_alive": true}` を送る。
  - 切れたら 1s→15s で再接続を続ける(STT と同じ)。キーは `loadElevenLabsApiKey()` で読む。
  - voice_settings は接続時のみ(今回は既定値)。
- **文の送り方**: 文を受け取ったら本文 + flush を送る。届く音と alignment を、`is_final_audio_for_turn` までをその文の分として順に流す。
- **中止**: 止めるメッセージがないので、割り込みや中止のときは接続を切り、すぐ裏でつなぎ直す。
- **口の時間割**([lipsync-inputs-2026-10.md](../../elevenlabs/research/lipsync-inputs-2026-10.md) §4・§5):
  1. alignment を通し値に直し、文字を区間に束ねる。区切りは句読点、タグ(`[...]` とその後ろの空白)、かなと漢字・英数字の切れ目。
  2. AivisSpeech `/accent_phrases`(合成なし)で文全体の読みのモーラを取り、`pause_mora`(句読点)を手がかりに区間へ割り付ける。区間の中は均等に置く。
  3. タグの区間は口を閉じる(要素を出さない)。
  4. 開き量は母音ごとの固定値(今と同じ)。
  5. 読みが取れないときは簡易版にする。かなは表で母音を引き、それ以外の文字は区間ごとに開け閉めする。
  6. `alignmentLeadMs` を足す。
- **料金の計器**: 既存の ElevenLabs 残量表示(quota)がそのまま効く。追加の計器は作らない。
- テストは WebSocket を偽物にし、alignment の通し値化・区間化・割り付け・再接続・中止を固定する。本物の API は叩かない。

- **D と E の接点(Undine 確定 2026-10-18)**: `createVoiceEngine("elevenlabs", deps)`。
  - deps: `{ apiKey, voiceId?, modelId?, readingClient?, alignmentLeadMs?, onReadingsFallback?, WebSocketImpl?, ... }`。
  - readingClient は AivisSpeech の `/accent_phrases` を呼ぶ口。既存の tts-client に足すのは D の担当。
  - 登録は D が `VOICE_ENGINE_FACTORIES` に足す。キーの読み込み(`loadElevenLabsApiKey`)は E が Start で行い、`apiKey` として渡す。

### Domain E — 操縦席の切り替えと警告(apps/soul/agent/src/cockpit/、scripts/cockpit.mjs)

- **設定**: キー `ttsEngine`(`"aivis"` | `"elevenlabs"`、不明な値は aivis)。入出力タブの STT 選択の下に置く。効くのは次の Start から(STT と同じ)。
- **警告**: `tts-reconnecting`(warn)と `tts-down`(alert)。読みが取れず簡易版の口になったときは出来事の warn(`tts-readings-fallback`、60 秒)。
- 遅延バーの区間名と表示を Domain C の定義に合わせる。
- Domain D とは engine の `status` / `onStatus` と、engine を作る工場関数(`createVoiceEngine(kind, deps)`)の形で接する。ファイルは重ねない。

## 4. 依存と並列

- Wave 1: A と B は独立(器 / 魂のプレイヤー)。並列にする。
- Wave 2: C は A(新しい約束)と B(プレイヤー)の両方に依存する。経路の載せ替えが 1 か所に集まるので、1 ドメインにまとめる。
- Wave 3: D と E は C の差し替え口に依存し、互いには工場関数と status の形でだけ接する。並列にする。

## 5. モデル配分

- Gnome(実装): `opus`。
- wave 末の軽い突き合わせ Sylph: `sonnet`。

## 6. 人間ゲート(Wave 3 の後、ユーザーの実機確認)

1. AivisSpeech のまま、今と同じに聞こえて口も動く(無退行)。
2. ElevenLabs に切り替えて Start すると、案3の声で鳴り、口が文の区切りやタグの所で閉じる。
3. 体感で応答が今より早い(操縦席の遅延バーで TTS / 声の区間を見る)。
4. しゃべっている最中の割り込みで、すぐ止まる。止まったあとの次の返事も鳴る。
5. 無言の時間を数分置いても、残量が減らない(keep_alive の課金確認)。また、そのあとも鳴る。
6. ネットを切るなどで ElevenLabs が落ちると警告が出る。戻るとまた鳴る。
