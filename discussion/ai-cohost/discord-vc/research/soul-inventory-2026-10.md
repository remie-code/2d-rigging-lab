# 今の魂の棚卸し: Discord VC に入れるときの差し替え点(Sylph 2026-10-30)

> 種別: リポジトリの事実の調査(読み取りのみ)。設計・決定ではない。
> 対象: `apps/soul/agent`(コミット c113f3d5 時点の作業ツリー)。`memories/` の中身と `.env*` は開いていない。
> 行番号は調査時点のもの。【推測】と書いたもの以外はコードで確かめた。

## 1. 要点

- **耳の入口は差し替えられる。** `createEarPipeline` は `captureFactory` を受け取る。中身は「16kHz・モノラル・s16le の PCM を `onPcm` に流し、`dispose` を持つ物」だけ。マイク以外の音を流す実例が `scripts/preflight-ears.mjs` にある。
- **ただし耳は 1 本前提。** 操縦席(cockpit-server)は `pipeline` を 1 つだけ持つ。転写バッファ(会話の正本)は耳の中で作られる。N 人分の耳を並べると、正本が N 個に割れる。バッファを耳の外に出す話は、S7 のときに「v0 ではやらない」と先送りされている。
- **話者の考え方はもうある。** 転写バッファの話者は `you` / `soul` / `viewer` の 3 つだけ。`viewer` は `displayName` を持てる。頭に渡す行は `you: …` / `soul: …` / `viewer(名前): …`。知らない話者値はバッファが throw する。整形の側は知らない値を `you` に寄せる。
- **話者付きの発言は、今の形のままでは「コメント」側に寄る。** 名前を出せるのは `viewer` だけ。でも `viewer` は speak-now の判定に入らない。操縦席でも会話ではなくコメント欄に出る。記憶では名前が落ちる。`you` に入れると、判定・割り込み・発火は動く。でも名前が消えて、全員が「配信者」になる。
- **口は「器(runtime-player)が繋がっていること」が必須。** 発話のたびに、まず器に `openSpeech` を送る。`accepted` が返らないと、声を鳴らさずに打ち切る。器が無いと、Discord に音を流す以前に一言も出ない。
- **音の出口は差し替えやすい。** 再生器は `open / write / end / stop / onEvent(STARTED/ENDED…)` の形。音は PCM16LE で、ElevenLabs の声なら 24kHz モノラル。同じ形の Discord 向けの出口を作れば、運び手(speech-streamer)は変えずに済む見込み【推測】。
- **判定は 3 つとも「ゲーム配信の配信者 1 人＋視聴者コメント」が前提。** 問いの文に「ゲーム配信」「配信者」「AI Tuber」「YouTube ライブ」が直に書いてある。speak-now は `you` の転写 1 件ごとに判定する。人数が増えると、判定を呼ぶ回数もそのまま増える。
- **配信向けの言い回しは、頭の固定の指示・記憶の書き出し役・思い出し役・操縦席の表示に散らばっている。** 一覧は §7。

## 2. 耳(問い 1)

### 2.1 音の入り方

- 流れ: `ffmpeg`(dshow マイク → 16kHz モノラル s16le)→ フレーマ → Silero VAD → 発話の区切り → リングバッファから切り出し → WAV → 文字起こし → 転写バッファ。`src/ears/ear-pipeline.mjs:2-8`(ヘッダ)。
- 入口の継ぎ目: `options.captureFactory`(既定は `createFfmpegCapture`)。`ear-pipeline.mjs:174`。呼ぶ場所は 3 方式とも同じ形で、`{ ...options.capture, sampleRate, channels: 1, onPcm, onError, onExit }` を渡す。`ear-pipeline.mjs:511-518`(ElevenLabs)、`:560-567`(ローカル)、`:596-603`(whisper)。
- 入口の約束(事実上): `onPcm(Uint8Array)` に s16le を流す。返り値は `dispose()` を持つ。`onExit` は ffmpeg が落ちたとき用で、VAD を仕切り直す(`ear-pipeline.mjs:443-448`)。
- マイク以外の音を流す実例: `scripts/preflight-ears.mjs:79-95`。合成した PCM を 100ms ごとに `onPcm` へ流す偽のマイク。
- サンプルレートは 16kHz で固定の前提。既定値 `EAR_DEFAULTS.sampleRate`(`ear-pipeline.mjs:96-104`)。ElevenLabs は `pcm_16000`(`src/ears/elevenlabs-stt.mjs:60`)。ローカルは `LOCAL_STT_SAMPLE_RATE`。Discord の 48kHz(ステレオの Opus)は、どこかで 16kHz モノラルに直す必要がある【推測。Discord 側の形は外部調査の領分】。

### 2.2 転写までの道と、1 本前提のところ

- 1 つの耳が持つもの: 転写バッファ・リング・フレーマ・VAD 1 個・文字起こし 1 系統。`ear-pipeline.mjs:192-194`、`:199-208`。
- 転写は直列で 1 件ずつ。キューは 4 件まで。溢れたら古い方を捨てる。`ear-pipeline.mjs:296-306`、`:309-322`。
- 転写バッファは耳が作って公開する(`transcriptBuffer: buffer`、`ear-pipeline.mjs:192`、`:475`)。
- 操縦席は耳を 1 つだけ持つ: `let pipeline = null`(`src/cockpit/cockpit-server.mjs:809`)。作る場所は `pipelineFactory({...})` の 1 か所(`:1331`)。マイク名も `currentDevice` の 1 つだけ。
- 頭・コメント・判定・記憶は、みんな「その 1 つの耳のバッファ」を見ている。
  - 発火: `getBuffer: () => (pipeline ? pipeline.transcriptBuffer : null)`(`cockpit-server.mjs:2263`)。
  - コメントの合流: `pipeline.transcriptBuffer` に append(`:2834`)。耳が止まっていたらコメントは積まない(`:2727-2735`)。
  - バッファを耳の外に出す話は先送り済み(「バッファ所有権の巻き上げ(耳非依存化)は…v0 では実装せず」`cockpit-server.mjs:2696-2700`)。
- 「誰かが喋っている」は真偽値 1 つ: `userSpeaking`(`cockpit-server.mjs:863`、`:1355-1360`)。割り込み・発火の予定・圧縮の隙間はこれと VAD の出来事 1 本を見る。

### 2.3 N 本並べると何に触るか

| もの | 今 | N 本にしたとき |
|---|---|---|
| VAD(Silero) | 耳ごとに `createSileroVad` → `ort.InferenceSession.create`(`src/ears/silero-vad.mjs:81`、`:114`)。内部に状態を持つ | 話者ごとに 1 個要る(状態が混ざるため)。モデルは小さいので重さは問題になりにくい【推測】 |
| whisper | 耳ごとに whisper-server を 1 つ起動。既定ポート 8178(`src/ears/whisper-server.mjs:16-18`)。threads 6(`ear-pipeline.mjs:96-104`) | そのままではポートがぶつかる。モデル(約 512MB)も N 回読む。共有するなら、キューを耳の外に出す必要がある |
| ローカル(Zipformer / Parakeet) | 耳ごとに子プロセスを 1 つ fork(`src/ears/local-stt/local-stt-client.mjs:87`)。要求は id で突き合わせる(`:72-74`、`:241-246`)。子の中では 1 件ずつ decode する(`local-stt-worker-core.mjs:95-117`)。threads 既定 2(`local-stt-engines.mjs:67-68`) | 話者ごとに子を作ると、モデルも N 回読む。1 つの子を共有することは、受け口の形(id 付き)からはできそうに見える【推測】。ただし耳の側の直列キューは耳ごと |
| ElevenLabs STT | 耳ごとに WebSocket 1 本。音は無音も含めて全部流す(`ear-pipeline.mjs:418`)。確定方式は VAD(`elevenlabs-stt.mjs:58-60`) | 話者ごとに 1 本。同時接続の上限は Free 6 / Starter 9 / Creator 15 / Pro 30(`discussion/ai-cohost/elevenlabs/research/stt-plans-and-realtime-2026-10.md:37`)。同梱の時間を N 倍の速さで使う【推測。課金が音の長さか接続時間かは未確認(同 :72-74)】 |
| 転写バッファ・時計 | 耳ごとに 1 つ。`startMs/endMs` は耳ごとの音の時計 | 正本を 1 つにまとめる必要がある。並べ方は壁時計(`appendedAtMs`)なので、行の順番は合わせやすい(`src/mind/fire-injection.mjs:10-14`) |
| 操縦席の状態 | `pipeline`・`currentDevice`・`userSpeaking`・耳の健康が 1 つずつ | 全部 N 対応が要る |

## 3. 頭への入力(問い 2)

### 3.1 今の形

- 頭の固定の指示: 「あなたの名前は{名前}です。」＋会話指示＋教え(skills/)。`src/mind/fire-orchestrator.mjs:280-288`、`scripts/cockpit.mjs:1752-1753`。会話指示の既定は「あなたは配信の相方です。…」(`fire-orchestrator.mjs:205-207`)。ユーザーが頭ごとに書き換えられる。保存先 `cockpit-settings.local.json` の `conversationInstructions`。今の上書きにも「配信」の語が入っている(中身は引用しない)。
- 発火ごとに渡す本文: 会話の直近 5 分を話者ラベル付きで 1 本にしたもの。`fire-injection.mjs:86-132`。前回より後の行だけを渡す形もある(`:154-172`)。
  - ラベル: `you: 本文` / `soul: 本文` / `viewer(名前): 本文`(`fire-injection.mjs:46-61`)。
  - 知らない話者は `you` に寄せる(`fire-injection.mjs:40-44`)。
  - 頭の指示の中に「you・soul・viewer が誰か」の説明は無い。ラベルの説明があるのは思い出し役の頼みだけ(`src/mind/recall.mjs:110`)。
- コメントに反応するときは、その 1 回だけ先頭に内部の指示を付ける。「視聴者({名前}): 「本文」」を括って、指示ではないと明示する(`src/mind/comment-react.mjs:150-170` あたり)。
- 転写バッファの話者の値は 3 つだけ。それ以外は throw(`src/ears/transcript-buffer.mjs:77-78`、`:127-131`)。`displayName` は話者に関係なく保存はされる(`:150-167`)。でも頭への整形で名前を描くのは `viewer` のときだけ。

### 3.2 話者付きの発言はどちらに近いか

| 入れ方 | 頭に見える形 | 動くもの | 困るところ |
|---|---|---|---|
| `you` として積む(耳の道) | `you: 本文`(名前が消える) | speak-now の判定、区切り応答・呼びかけ、割り込み、沈黙の再武装 | 全員が「配信者」1 人に見える。誰が言ったか分からない |
| `viewer` + 名前として積む(コメントの道) | `viewer(名前): 本文` | コメントの判定(弾く・反応する) | speak-now の判定に入らない(`speak-now.mjs:148`、`:318`)。発火の予定は viewer を無視する(`fire-scheduler.mjs:745-750`)。操縦席ではコメント欄に出る。記憶では名前が落ちる |
| 新しい話者の値を足す | 整形を足せば `名前: 本文` などにできる | なし(今は全部の部品が 3 つの値で分岐している) | バッファ・整形 3 か所・判定 3 つ・発火の予定・操縦席・記憶の全部に手が入る |

- ユーザーが言う「YouTube コメントに近いイメージ」は、**名前付きで頭に渡す**という点では `viewer` の道に近い。**声として聞き、話し始めの判定に乗せる**という点では `you` の道に近い。今のコードには、両方を持つ道はない。

### 3.3 名前を落としている場所(場所だけ)

- 記憶の書き出しの整形: `viewer` の名前を描かない(`src/mind/memory.mjs:44-58`、`formatTranscriptForDigest` `:65-68`)。
- 書き出し役への固定の指示: 「視聴者の名前…は書かないでください」(`memory.mjs:164-169`)。
- 記憶の決まりの種: `src/memory/conventions-seed.md:41`。
- 思い出し役: 渡す会話から名前を落とす(`recall.mjs:70-90`)。答えにも名前を書かせない(`recall.mjs:62-67`)。避けるかの判定も名前なし(`recall.mjs:215-227`)。
- 決定の正本: `discussion/ai-cohost/memory/recall-flow.md` §9(96 行目から)。
- 注意: 落とすのは `viewer` の名前だけ。`you` は元々名前を持たない。仲間を `viewer` で積むと、記憶では全員「視聴者」になる。新しい話者の値にすると、記憶の整形は `you` に寄せる(`memory.mjs:44-48`)。

## 4. 口(問い 3)

### 4.1 声ができるところと行き先

- 声の種類: AivisSpeech(`src/voice/engines/aivis-voice-engine.mjs`)と ElevenLabs(`src/voice/engines/elevenlabs-voice-engine.mjs`)。
  - ElevenLabs: Text to Dialogue の WebSocket(`elevenlabs-voice-engine.mjs:56`)。`pcm_24000` モノラル(`:62`、`:526`)。届いた分から流す。
  - AivisSpeech: WAV を受け取って PCM を取り出し、一度に出す(`aivis-voice-engine.mjs:118-172`)。レートは WAV の値に従う(具体の値は未確認)。
  - 共通の形: `format` → `timeline`(口の時間割)→ `audio`(PCM16LE)→ `end`(`src/voice/engines/voice-engine.mjs:12-17`、`:35-38`)。
- 運び手: `src/voice/speech-streamer.mjs`。1 文ずつ、器へ `openSpeech` → `accepted` なら `player.open` → 時間割を器へ → 音を player へ、の順(`speech-streamer.mjs:11-20`、`:447-495`)。
- 再生器: `src/voice/stream-player.mjs`。常駐の PowerShell＋C#(WASAPI 共有モード)。手元のスピーカー/選んだ出力デバイスで鳴らす。行プロトコルは `OPEN / DATA(base64 PCM16LE) / END / STOP`。返りは `READY / STARTED / ENDED / STOPPED / ERROR`(`stream-player.mjs:26-37`)。
- 器(runtime-player)へ送るのは音ではない。口の時間割(`intent.speechStream`)と表情(`sendEnvelope`)だけ。音は手元の再生器が鳴らす。

### 4.2 別の出口を付けられる場所

- 運び手は `player` を受け取る。形は `{ open, write, end, stop, onEvent }`(`speech-streamer.mjs:79`、`:103`)。同じ形の Discord 向けの出口を作れば、運び手は変えずに済む見込み【推測】。
- その出口が守る約束:
  - `STARTED` を「実際に鳴り始めた」ときに返す。`ENDED` を鳴り終わりに返す。運び手は待ち時間の上限を持つ(STARTED は 5 秒、`speech-streamer.mjs:43-46`)。
  - 割り込み時に「どこまで声に出たか」は、STARTED の時刻からの経過で計算する(`src/mind/barge-in.mjs:1-24`)。Discord 側で遅れて鳴ると、聞こえた分の記録がずれる【推測】。
- 手元と Discord の両方に出すなら、2 つの出口に同じ音を配る薄い層が要る【推測】。
- 出口の作り直しの場所: `scripts/cockpit.mjs:1783-1808`(`ensureVoiceResources`)。出力デバイス名は設定に 1 つ(`audioDevice`)。

### 4.3 器が繋がっていないとどうなるか

- 器の接続は遅れて作る(`createLazyChannel`、`scripts/cockpit.mjs:200-260`)。URL が無いと `ensure()` がエラーを返す(`:210-216`)。
- 運び手は `openSpeech` が失敗するか `accepted` でないと、その発話を打ち切る(`play-failed`)。声は鳴らない(`speech-streamer.mjs:456-475`)。
- よって **今の魂は器なしでは喋れない。** 表情の送信の失敗は診断だけで済む(`fire-orchestrator.mjs:929-946`)。止まるのは口の時間割の側。
- 器なしで動かすには、「何でも accepted を返す器の代わり」か、運び手の約束を変える必要がある【推測】。
- 耳が止まっていると発火そのものを断る(`fire-orchestrator.mjs:1783` あたり、`getBuffer` が null)。

## 5. 判定(問い 4)

どれも OpenAI の Decisions API(`POST /v1/decisions`、`src/mind/speak-now-decisions.mjs:38`)。キーは `.env.decisions.local`(中身は開いていない)。

| 判定 | 入力 | 出力 | 1 人前提のところ |
|---|---|---|---|
| speak-now(話し始め) `src/mind/speak-now.mjs` | 直近 3 分の「配信者: …」「{名前}: …」。視聴者は入れない(`:143-160`)。問い: 「ゲーム配信で配信者の隣にいるサポート役の AI Tuber…」(`:81-83`)。性格の 1 文は口数で変わる | 5 択: 待つ / 相槌 / 応答 / 自発 / 画面を見る(`:115-135`)。待つ以外は発火 | ラベルは「配信者」固定(`:54`)。`you` の転写 1 件ごとに判定し、並行でも呼ぶ(`:318-327`、ヘッダ `:35-37`)。相槌の内部指示も「配信者の話に」(`:72`)。待つの説明に「視聴者への説明」がある(`:120`) |
| comment-react(コメントに反応するか) `src/mind/comment-react.mjs` | 直近 3 分の配信者・{名前}・それまでのコメント＋届いたコメント(`:103-130`)。問い: 「ゲーム配信で…視聴者からこのコメントが届いた…」(`:60-62`) | 2 択: 反応する / しない(`:77-83`)。忙しい間は取っておいてまとめて答える(既定、20 秒・3 件、`:42-52`) | 相手は「視聴者」。人間の話者は「配信者」1 人 |
| comment-guard(コメントを弾くか) `src/mind/comment-guard.mjs` | コメント本文だけ。問い: 「YouTube ライブ配信のコメント欄に届いた…」(`:52-54`) | 4 択(問題なし / 乗っ取り / 誹謗中傷 / 荒らし)＋乗っ取りの確率。弾いたら積まない。失敗・5 秒超えも弾く(`:1-20`、`:26`) | 文字のコメント専用。声の発言は通らない。仲間内の声を弾く必要があるかは別の話 |

- 判定の外側(機械の信号)にも 1 人前提がある。
  - 割り込み: VAD の `speechStart` から 200ms ＋猶予 2 秒で声を止める(`barge-in.mjs:30`、`:38`)。耳は 1 本。誰か 1 人の相槌や物音で止まる【推測。N 本をどうまとめるか次第】。
  - 従来の発火の予定: 区切り応答・呼びかけ・合いの手は `you` の転写と VAD 1 本で動く(`src/mind/fire-scheduler.mjs:23-36`、`:54-63`、`:734-760`)。呼びかけの名前は「コーディ」系の揺れ(`:207`、`:232`)。
  - 圧縮の隙間: 「配信者の喋り終わりから 3 秒」(`src/mind/context-compactor.mjs:29`、`:40-41`)。

## 6. 既にある支え(問い 6)

- 入口の継ぎ目 `captureFactory` と、その実例(`scripts/preflight-ears.mjs:79-95`、`scripts/probe-long-utterance.mjs:77`)。
- 文字起こしの継ぎ目 `transcribeImpl` / `sttFactory` / `localSttFactory`(`ear-pipeline.mjs:142-144`、`:177`、`:185`)。
- 声の差し替え口(VoiceEngine)と、再生器の形(`speech-streamer.mjs:77-79`)。テストは偽の再生器を入れている(`stream-player.mjs:44-47`)。
- 器への接続は注入できる(`createLazyChannel` の `connectImpl`、`scripts/cockpit.mjs:183`、`:201`)。
- 転写バッファの話者ラベル(`transcript-buffer.mjs:30-38`)と、名前の欄(`displayName`)。話者付きの会話を頭に渡す形は、コメントの合流で一度作られている。
- 操縦席は判定・耳・コメントの器官をそれぞれ注入できる(`cockpit-server.mjs:644`、`:656-658`、`:744-770`)。
- 文書で複数話者に触れているもの:
  - speak-now の再生実験で、ElevenLabs バッチの話者分離を使った(`discussion/ai-cohost/decisions/speak-now/experiments/01-archive-replay.md:9`)。実装ではない。
  - 先例の調査: Neuro-sama のコラボは相手の声を音声認識で聞く(`discussion/ai-cohost/research/human-ai-cohost-precedents.md:13`)。仮想ケーブルでの音の分け方(同 :39)。
- 複数の人の声を別々に受け取る作りや、音を別の場所へ出す作りを前提にした文書は、見つからなかった。

## 7. 配信向けの前提(問い 5): 仲間内の VC で違ってくるもの

| 場所 | 今の前提 | VC での問題 |
|---|---|---|
| 頭の固定の指示 `fire-orchestrator.mjs:205-207`、会話指示の上書き(設定ファイル) | 「あなたは配信の相方です」 | 配信だと思って話す |
| 教え `skills/recall.md:3-8` | 「過去の配信の記録」「配信者に…頼まれたら」 | 思い出す先も頼む人も配信前提 |
| 教え `skills/screen.md` | 画面が渡されることがある | VC では見る画面が無いかもしれない。発火の一部(沈黙・画面を見る)は画面付きで呼ぶ。対象が無いと画面なしに落ちる(`fire-orchestrator.mjs:75-88`、`:1508-1513`) |
| 判定 3 つ(§5) | ゲーム配信・配信者・AI Tuber・YouTube ライブ | 問いの前提が場に合わない |
| 記憶の書き出し役 `memory.mjs:164-200`、`conventions-seed.md` | 配信の記録。本体は配信の日付。トピックはゲーム単位 | VC の会話が「配信」の記録として、同じ置き場に混ざる。名前は落ちる(§3.3) |
| 記憶の保存の引き金 `scripts/cockpit.mjs:2007-2012`(20 分ごと)、`:2014-2015`(手動)、`:2294-2312`(終了時) | 起動 1 回 = 配信 1 本の記録(`createStreamRecordIdentity`、`:1635`) | VC の会話も同じ扱いで書かれる |
| 思い出し役 `recall.mjs:62-67`、`:97`、`:110`、`:203` | 「you = 配信者」「過去の配信の記録」 | 同上 |
| 古い Claude 用の既定 `src/mind/llm-session.mjs:44-46` | 「配信の共演者です。視聴者やホストの一言に…」 | 操縦席は会話指示で上書きするので、本番の経路では使われない【推測。cockpit.mjs:1752 で systemPrompt を渡している】 |
| 操縦席の表示 `src/cockpit/view-logic/glance-timeline.mjs:38`、`:109-136`、`ui/styles.mjs:72`、`ui/settings-drawer.mjs:853` | 話者は「配信者」と「チャッピー」。コメントは別欄。接続先は YouTube。マイクは 1 つ | 仲間の名前が出ない。全員が「配信者」になるか、コメント欄に出る |
| 操縦席のつまみ・状態 | 「配信前」の表示(`view-logic/glance-meters.mjs:183`)、口数の説明に YouTube(`ui/control-bar.mjs:148`) | 言葉が合わないだけで、動きには関係ない |
| NG の最終検査・キル | 配信の安全弁(`fire-orchestrator.mjs:105`) | そのまま使える。配信向けの語の選び方かは未確認 |
| 頭の文脈の記録 `src/mind/session-usage-log.mjs` | 起動ごとに 1 ファイル。数字だけで本文なし | 問題は見当たらない。言い回しが「配信」なだけ |
| 起動の流れ `scripts/cockpit.mjs`(待ち受け 127.0.0.1:8181、`cockpit-server.mjs:117`) | 起動 → 操縦席でマイクを選んで Start → 器の URL を入れる → YouTube の URL で Connect | Discord への参加・退出の操作が無い。器の URL が無いと喋れない(§4.3) |

## 8. 差し替え点の一覧

| 部位 | 今 | Discord で要ること | 手の大きさ【推測】 |
|---|---|---|---|
| 音の入口 | ffmpeg のマイク 1 本(`captureFactory`) | 話者ごとの PCM を 16kHz モノラル s16le にして `onPcm` に流す入口 | 小(入口そのもの)。Opus の復号・変換は外部調査次第 |
| 耳の数 | 1 本。操縦席が `pipeline` を 1 つ持つ | 話者ごとの耳を作る・消す(人の出入り)。状態の集約 | 中 |
| 転写バッファ(正本) | 耳の中にある | 耳の外に出して 1 つにまとめる。S7 で先送りした件 | 中〜大(発火・コメント・判定・記憶・操縦席がみな今の場所を見ている) |
| 文字起こしの資源 | 耳ごとに whisper-server / 子プロセス / WebSocket | 共有するか、N 個持つか。whisper はポートとメモリ、ElevenLabs は同時接続と時間 | 中 |
| 話者ラベル | `you` / `soul` / `viewer(名前)` の 3 値 | 名前付きの「声で話す人」。整形 3 か所(頭・記憶・思い出し)と判定 3 つ、発火の予定、操縦席 | 中 |
| 頭の指示 | 「配信の相方」。ラベルの説明なし | VC 用の会話指示(今も頭ごとに書き換えられる)。ラベルの意味を伝えるかどうか | 小 |
| speak-now | 配信者 1 人の発言ごとに判定 | 問いの文・ラベル・何人分を見るか・呼ぶ回数 | 小〜中 |
| comment-react / comment-guard | YouTube コメント用 | VC では使わない、または文字チャット用に流用 | 小(外すだけなら) |
| 割り込み・従来の発火の予定 | VAD 1 本・`userSpeaking` 1 つ | N 本の VAD をどうまとめるか(誰でも止めるか) | 中 |
| 音の出口 | 手元の WASAPI 再生器 | 同じ形(open/write/end/stop/onEvent)の Discord 向けの出口。24kHz→48kHz の変換と Opus | 中(Discord の送り方は外部調査次第) |
| 器(runtime-player) | 必須。`openSpeech` が通らないと喋らない | 器を繋いだままにするか、器なしで運ぶ道を作るか | 小〜中 |
| 記憶 | 配信の記録。名前を落とす | VC の記録を分けるか。名前の扱い(§9 の決定との関係) | 小〜中(置き場と指示の切り替え)。決めるのはユーザー |
| 操縦席 | マイク 1 つ・配信者・YouTube | Discord の参加状態、話者ごとの耳の状態、名前付きの行 | 中 |
| 起動 | cockpit.mjs 1 本 | Discord の Bot の接続(トークンの置き場を含む)を足す | 中 |

## 9. 未確認のこと

- AivisSpeech の WAV のサンプルレート。
- whisper / ローカルの文字起こしを N 本同時に回したときの CPU とメモリ。測っていない。
- ElevenLabs のリアルタイム STT の課金が、送った音の長さか、接続の時間か(既存の調査でも未確認)。
- 運び手が `STARTED` を 5 秒待つ約束が、Discord に流すときの遅れで足りるか。
- 器なしで運ぶ道を作ったとき、口の時間割と barge-in の「聞こえた分」の計算がどこまで影響を受けるか。コードは読んだが、試していない。
- 会話指示の上書きの中身(`cockpit-settings.local.json`)は、「配信」の語があることだけ確かめた。中身は読んでいない。
- `memories/` の中身は開いていない。VC の会話をそこへ書いたら何が起きるかは、書き出し役の振る舞い次第。
- Discord 側の事実(1 人ずつ音を受け取れるか、形式、暗号化、ライブラリ)は、この調査の範囲外。
