# 声の差し替え(ElevenLabs TTS の流し込み)planning inventory

> Status: 棚卸し完了・方針合意済み(2026-10-18)。wave 計画は [voice-swap-wave-plan.md](voice-swap-wave-plan.md)。
> 棚卸しは Sylph 6 本(口パク 3 本 + 組み込み 3 本)。声とモデルの選定は [../../elevenlabs/experiments/02-tts-voice.md](../../elevenlabs/experiments/02-tts-voice.md)、口パクの方針は [../../elevenlabs/research/lipsync-inputs-2026-10.md](../../elevenlabs/research/lipsync-inputs-2026-10.md)。

## 1. 合意(ユーザー 2026-10-18)

1. ElevenLabs TTS を組み込む。声は「案3」(`Ona22sJYfzcps6cE1jVk`)、モデルは `eleven_v4_turbo`、日本語。
2. **受け取りながら鳴らす**。
   - 目標は「LLM の文字を文に切らずに流し込む」だった。ところが日本語では flush まで音が作られず、句読点ごとに flush すると間が伸びた(§3)。そのため「文ごとに頼み、届いた音から鳴らす」にする。ユーザーは「できないなら (i) でいい」。
3. **最初からあるべき姿で作る。** 「1 文できたら送る」を経由して二度に分けない。経由すると負の遺産が残るため。
4. **「声を発する」を 1 つの機能として差し替えられる形にする。**
   - AivisSpeech と ElevenLabs を操縦席で切り替える。
   - AivisSpeech も新しい流し込みの約束に乗せる。仕組みを 2 本立てにしない。
5. **音は魂で鳴らす。** 器で鳴らすのは責務違反と判断した(ユーザー)。器の憲章「知性・知覚・人格・音声はすべて器の外」([../../architecture/runtime-player-model-host-roles.md](../../architecture/runtime-player-model-host-roles.md) §1)を維持する。
6. **ElevenLabs との通り道は TTD WebSocket(つなぎっぱなし)。**
7. **落ちたとき**: STT の前例と同じ。つなぎ直しを続け、警告を出す。自動で AivisSpeech には戻さない。つなぎ直しても失敗するなら、そういうものと割り切る。
8. **口パク**:
   - 読みは AivisSpeech の `/accent_phrases`(合成なし)から取る。時刻は ElevenLabs の文字時刻を区間に束ね、句読点・タグで区切る。開き量は母音ごとの固定値のまま。
   - 読みが取れないときは、文字の区間ごとに口を開け閉めする簡易版にする。
9. **時刻合わせ**は今と同じくらいの精度でよい(新しく凝らない)。明示の合意記録はなかったが、ユーザーの認識として前提に書く。
10. **対象外**: 音声タグ(Decisions API での判定は別の話)、最初の 1 回を温める工夫(配信前に何往復かする運用でカバー)。
11. **進め方**: wave に分ける。レビューは軽め(これまで Gnome 単独でやっていたくらいの粒度)。

## 2. 今の仕組み(壊す・直す対象)

- **流れ**: Codex の文分割(`mind/fire-orchestrator.mjs:680-733`)→ `voice/progressive-speech-delivery.mjs`(準備は並列、再生は FIFO で 1 本)→ `voice/speak.mjs`(`prepareSpeech` / `activatePreparedSpeech`)→ `voice/tts-playback-coordinator.mjs` → `voice/audio-player.mjs`。
  - Claude 頭は文の経路に乗らない。返事全文を 1 回で読み(`fire-orchestrator.mjs:1004-1015`)、完了は WAV 長のタイマーで判断する(`:1032-1050`)。
- **準備**: `prepareSpeech` は `/audio_query` → `/synthesis` → WAV 長 → `buildSpeechTimeline`(`voice/mora-timeline.mjs:127`。WAV 全体の長さをモーラ数で均等割り)→ 一時 WAV、の順。`deps.tts` は AivisSpeech の形が露出している。
- **再生**:
  - 常駐 PowerShell の WinRT MediaPlayer にファイルパスを渡し、`STARTED` / `ENDED` / `STOPPED` を受け取る。PCM を流し込む口はない。
  - `STARTED` は Play() 直後に出るだけ。`ENDED` は 50ms のポーリングで判断する。
  - 出力デバイスは `SOUL_AUDIO_DEVICE_NAME` と名前が一致したもの(`audio-player.mjs:73-83`)。デバイスを変えるとプレイヤーを作り直す(`scripts/cockpit.mjs:1289-1322`)。
  - 一時 WAV が `%TEMP%\soul-agent-*` に 72 個残っていた(一括経路の掃除漏れ)。新方式では WAV ファイル自体が要らなくなる。
- **器の約束** `intent.speech`:
  - 中身は `{timeline:[{timeMs,vowel,s}]}`(1〜512 要素、`additionalProperties:false`)。受理時刻が t=0。単一スロットを丸ごと置き換え、終わりはデータから自動で決める(最後の間隔ぶん保持 → 400ms で閉じる)。
  - 契約: `apps/runtime-player/src/main/control-channel/contract/channel-intent-speech-payload-schema.json`。検証: `channel-intent-validation.ts:351-440`。受理: `channel-server.ts:373-383`。保持: `control-channel-overlay-store.ts:197-207`。評価: `speech-timeline-state.ts:239-385`。
  - 拡張は kind を足し、`server.hello` の supportedKinds で伝える(`contract/channel-protocol-contract.ts`、ProtocolVersion=1 固定)。魂は接続時に必須 kind を照合する(`channel/channel-client.mjs:73`)。フレーム上限は 64KiB で、テキストのみ。
  - 停止: 魂が `intent.set mouth-open=0 ttl400` を送る(`fire-orchestrator.mjs:588-617`)。
  - 送り手は魂の `channel-client.mjs:244` のほか、`soul/reference-driver`、`scripts/preflight-tts.mjs` / `preflight-e2e.mjs`、`test-support/ws-double.mjs`。
- **割り込み**:
  - Codex 経路は、ENDED まで鳴った文の `playedText` を返す(`fire-orchestrator.mjs:1175-1194`)。
  - Claude 経路は `computeSpokenPrefix`(`mind/barge-in.mjs:106-150`)を使う。timeline の要素数と「中断時刻 − 再生開始時刻」から計算する。
- **遅延の計測**(`mind/fire-latency.mjs:118-148`):
  - ttsMs = 最初の文の `tts.audio_query.started` → `tts.synthesis.completed`
  - voiceMs = `tts.synthesis.completed` → `progressive.player.started`
  - イベント名が AivisSpeech の 2 段階に結びついている。
- **STT 切り替えの前例**([../screens/cockpit-stt-selection.md](../screens/cockpit-stt-selection.md)):
  - 保存は `sttEngine` キー(`cockpit/cockpit-settings-store.mjs:297-302`)。不明な値は既定に戻す(`scripts/cockpit.mjs:758-771`)。
  - 効くのは次の Start から。UI は設定の入出力タブ(`ui/settings-drawer.mjs:534`)。
  - 落ちたら 1s→15s で再接続を続ける。警告 `stt-reconnecting` / `stt-down` は `cockpit-server.mjs:883-891` で組み立てる。
  - キーは Start のたびに読み、process.env に入れない。

## 3. ElevenLabs の流し込み(実測 2026-10-18)

- **TTD WebSocket(v4_turbo)**:
  - 最初の音は送信から 128〜138ms(接続は 132〜179ms)。1 接続で文を続けて送れて、文ごとに `is_final_audio_for_turn` が届く。
  - 前後の文脈は同じ接続の続きとして扱われる(指定欄はない)。
  - 文の途中まで送っても、flush までは生成されない。80 字でも自動で始まらなかった(公式の「約 40 字かつ 8 語」は日本語では語数が届かない【推測】)。
  - 句読点ごとに flush すると、同じ文が 6.88 秒から 8.88 秒に伸びた。
- **出力**:
  - `pcm_24000`(Starter で可。44.1k は 403)。audio_base64 はヘッダなしの 16bit モノラル。
  - チャンクは 0.03 → 0.1 → 0.16 → 0.6〜1.0 秒分と大きくなり、実時間の約 9 倍の速さで届く。
- **alignment**:
  - `{chars, char_start_times_ms, char_durations_ms}` で、チャンクごとに 0 から数え直す。これまでの区間の長さを足せば通し値になる。
  - 入力 1 文字に 1 組。80ms 刻みで、タグの文字も 1 文字ずつ入る。
  - 先頭は 0 から始まるが、実際の声は 0.1〜0.2 秒後に出る。
- **接続の制約**:
  - 20 秒何も送らないと 1008 `input_timeout_exceeded` で切れる。`{"keep_alive": true}` で延びる(公式は「performs no synthesis」)。実測では 10 秒おきで 35 秒以上保った。
  - 止めるメッセージはない。未知のメッセージを送ると 1006 で切れる。`close_context` は残りを生成し切る。
  - voice_settings は最初のメッセージだけ。後から送ると 1008 `protocol_violation`。
  - 接続の最大時間は書かれていない。
  - TTD の接続は「ダイアログセッション」枠(Starter 21)で数える。HTTP の同時数(3)とは別。
- **料金**:
  - 0.2 クレジット/字(公式の割り算と実測が一致)。
  - 配信 1 時間で 30% しゃべるなら約 1,230 クレジット。
  - keep_alive は「合成しない」ので課金されない見込み。実測での切り分けはしていない → 人間ゲートで無言の時間の残量を見る。
- **口パクの読み**: AivisSpeech `/accent_phrases` は 1 文 5〜16ms。モーラと元の文字の対応は返らない。

## 4. 未確認(実装中・人間ゲートで確かめる)

- PowerShell の C#(Add-Type)で作る流し込み再生(WASAPI か waveOut)の実際の遅れ、再生位置の精度、デバイス名の一致(waveOut は 31 字で切れる)。
- TTD の接続の最大時間、長時間つなぎっぱなしの振る舞い。
- keep_alive の課金(人間ゲート)。
- ElevenLabs の読みと AivisSpeech の読みのずれ(英字・数字)。
