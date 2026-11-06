# 咳払いの落とし(段階 2)の在庫調べ

日付: 2026-11-06 / 調べた人: Sylph / 依頼: Undine(`implementation/orchestration/cough-experiment-plan.md` §6 の実装計画の前の在庫)。
パスはすべて `apps/soul/agent/` からの相対。【リポジトリ事実】は file:line、【推測】は §7 にだけ置く。読むだけで、コード・設定・実データは触っていない(`.env*`・`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`・`memory-backups/`・`cough-experiments/`・`cockpit-settings.local.json` は未読)。

## 1. 要点

1. **Discord の耳は、ローカルの耳と同じ `createEarPipeline` を人ごとに 1 本作る**(`src/discord/discord-experience.mjs:491` → `cockpit-server.mjs:2052` `createVenueEar` → `:2245` `buildEarPipeline`)。音の形も同じ 16kHz mono、区切りも同じ Silero VAD + セグメンタ(違うのは `minSpeechMs: 400`)。Discord の既定の文字起こしは whisper(`discord-experience.mjs:78`)で、Zipformer / Parakeet を選んだときだけ子が立つ。**子は 1 耳につき 1 プロセス**(`createEarPipeline` の中で `createLocalSttClient` を呼ぶ・`ear-pipeline.mjs:560`)なので、判定を子に足すと人数ぶん CED-tiny も読む(約 6MB の int8・モデルは小さい)。
2. 子と親のやり取りは `init` / `transcribe{id,pcm}` / `shutdown`(親→子)と `ready` / `fatal` / `result{id,text,ms}` / `error`(子→親)だけ(`local-stt-worker-core.mjs:9-23`)。親の client は **知らない type を読み捨てる**(`local-stt-client.mjs:122-154` の分岐に else が無い)。区間の音(`msg.pcm`・前後に余白を足した Int16Array)は子の `transcribe()` の中(`local-stt-worker-core.mjs:98-101`)にあり、確率を足すなら `result` の送信(`:115`)に載せるのが最短。
3. 落とす判断の自然な場所は **`ear-pipeline.mjs` の `transcribeAndAppend`(`:381-416`)の、`transcribe` が返ったあと・`buffer.append` の前**。今の discard は理由が `"blank"` の 1 種類だけで、`transcript-buffer.mjs:184-198` の `append` が決める。**咳の落としは `append` を通らないので、そのままでは `onDiscard`(`cockpit-server.mjs:2556`)も SSE `discard` も `stats().discarded` も動かない**。経路を足す必要がある(§4)。
4. **`discard` の中身が残る道**: 今の `broadcast("discard", …)` は文字を載せておらず、`onDiscard` の `info.text` は捨てられている。ファイル・ログ・snapshot への書き込みは、リポジトリを見た範囲では無い。ただし文字を足すと、**(a) `handleDiagnostic` を通る診断に文字を載せる設計にした場合は `ears-cli.mjs:95` が丸ごと stderr に出す**(ただしこの CLI は whisper 固定で、ローカルの耳は結線されていない)、**(b) 新しい `onDiscard` の購読者を足すと文字が渡る**、の 2 点に注意(§5)。
5. 設定の置き場は `cockpit-settings-store.mjs:430-439`(`getLocalStt`)と `normalizeLocalSttSettings`(`local-stt-engines.mjs:101-114`)。耳の Start ごとに `checkEarEngine`(`cockpit-server.mjs:2189-2214`)が読み、`earPlan.localStt.local` → `createEarPipeline` の `stt.local`(`:2274-2282`)で耳に渡る。**既定の取得(`--only` なし)は Parakeet と Zipformer だけ**(`fetch-local-stt-models.mjs:62,86-97`)。`--only ced-tiny` は `scripts/cough-experiment-lib.mjs` の `CED_TINY_MODEL_LAYOUT` / `resolveCedTinyModel` を import している(`:44`)ので、**本番の取得の道具が実験の lib に依存している**。

## 2. Discord の耳の文字起こし

【リポジトリ事実】
- **STT の選択**: Discord の準備の `sttEngine`(`settings.getDiscordPrep()`)。未選択の既定は `"whisper"`(`discord-experience.mjs:78,1180`)。選べる値は `STT_ENGINES`(whisper / elevenlabs / parakeet / zipformer)(`discord-experience.mjs:213`)。**ローカルの Zipformer / Parakeet も選べて、そのときは本番の子(`src/ears/local-stt/`)と同じものが立つ**。別の STT 実装は無い。
- **場の下見**: `prepareVenueEars(engine)`(`cockpit-server.mjs:1909-1916`)が `checkEarEngine`(`:2161`)を呼び、`earPlan = { engine, elevenLabs, localStt }` を作る。ローカルのときのモデル確認と設定の読みはここで 1 回(Start ごと)。
- **人ごとの耳**: `ensurePerson`(`discord-experience.mjs:462-524`)が、人ごとに Opus デコーダ(直に 16kHz mono・`discord-audio.mjs:41-44`)と音の入口(`createSpeakerAudioSource`・`:73`)と、`x.venue.createEar({ earPlan, ears, key, captureFactory, transcriptBuffer: speakerTranscriptMouth(...), segmenter: { minSpeechMs }, whisperPortOffset })`(`:491-499`)で耳 1 本を作る。耳は耳の束(`createEarBundle`)に `discord-<n>` で束ねる。
- **子は人ごとに別**: `createEarPipeline` の `start()`(`ear-pipeline.mjs:557-604`)が `localSttFactory(…)` を呼んで `createLocalSttClient`(= `fork`)を 1 つ作り、`dispose` で畳む(`:667`)。共有する層は無い。whisper の場合は人ごとに whisper-server(口の番号をずらす・`cockpit-server.mjs:2256-2258`)を立てる作りで、同じ思想。
- **音の形・区切り**: ローカルの耳と同じ。16kHz mono s16le(`discord-audio.mjs:17`・`ear-pipeline.mjs` の `sampleRate`)→ フレーマ → Silero VAD → `createSpeechSegmenter` → リング切り出し(`ear-pipeline.mjs:288-338`)。違いは (1) `minSpeechMs: 400`(`discord-experience.mjs:111,497`)で短い発話はセグメンタが `speechCancel` にして ASR に行かない、(2) 音の入口が ffmpeg でなく Opus デコーダの出力(`captureFactory`)、(3) 黙ったとき購読の終わりに短い無音を足して区切りを閉じる(`discord-audio.mjs:10`)。ローカルの子に渡る PCM(`preRollMs` 200ms 前に広げ、`silencePadMs` 300ms を前後に足す・`ear-pipeline.mjs:297-316`)はどちらの場でも同じ。
- **人数ぶんモデルを読む**: 子ごとに `OfflineRecognizer` を作る(Zipformer の int8 は数百 MB 規模。`local-stt-worker-core.mjs:77-78`)。CED-tiny を子の init で足すと、子の数だけ `AudioTagging` も作る(model.int8.onnx は約 6.1MB・`fetch-local-stt-models.mjs:20-23`)ので、追加のメモリは小さい。誰か 1 人でも耳が起きなければ `failPerson`(`:533-549`)でその人は聞かない扱い。
- **正本への積み方**: 各耳は `speakerTranscriptMouth(buffer, person)`(`discord-experience.mjs:275-288`)で包んだ口を受け取る。`{...buffer}` を展開して `append` だけを上書きしており、**`onDiscard` / `stats` は場の正本そのもの**。誰の咳かは出さない決定(§6 計画)と合うよう、新しく足す口が `person` を知る必要は無い。

## 3. 本番の子の作り

【リポジトリ事実】
- **入口**: `local-stt-worker.mjs`(sherpa-onnx-node を `require` する唯一のファイル・`:25`)。`createLocalSttWorkerCore({ loadSherpa, send, readTextFile, exit })`(`:24-38`)を作り、親の `message` を `core.handle` へ流す(`:40-42`)。親との IPC が切れれば exit(0)(`:43`)。
- **親 → 子**(`local-stt-worker-core.mjs:9-14`): `{type:"init", engine, files, threads, hotwords, hotwordsScore}`(最初の 1 回・`local-stt-client.mjs:189` が送る)、`{type:"transcribe", id, pcm}`(pcm は Int16Array・advanced serialization)、`{type:"shutdown"}`。`files` は client が `resolveLocalSttModel` で解決した絶対パス(`local-stt-client.mjs:67`)。
- **子 → 親**(`:15-19`): `ready{loadMs, decodingMethod, hotwordsUsed, hotwordsDropped}`、`fatal{message}`(init 失敗後 exit(1))、`result{id, text, ms}`、`error{id, message}`。本文は親に返すだけで、ログ・stderr に出さない(`:22-23`)。
- **区間の音の在処**: 子の `transcribe(msg)`(`:94-119`)で `msg.pcm`(Int16Array・余白込み・16kHz mono)を Float32 に直して `stream.acceptWaveform`(`:99-103`)。推論は `decodeAsync`(`:107-108`・子のイベントループを塞がない)。**直列チェーン**(`:45,127-129`)。
- **確率を足すならどこか**: `result` の送信(`:115` `deps.send({type:"result", id, text, ms})`)に項目を足すのが最短で、この時点で `pcm` / `samples` が手元にある。親側は `local-stt-client.mjs:143-153` の `result` 分岐が `{text, rawText, ms}` に詰め直すので、ここで新しい項目(例: speech 確率・判定にかけたか)も通す必要がある。親の `transcribe` 型(`ear-pipeline.mjs:147,220`)も `{text, rawText}` なので、型が変わる。
- **実験の子がやっていること(段階 1)**: `scripts/cough-experiment-worker-core.mjs` は本番の中身を内側に包み、`result` の前に別 type の `tags` を送る(`:84-96`)。`tagger.compute(stream, topK)` は**同期呼び出し**(`:120`)なので、判定の間は子のイベントループが塞がる(shutdown や次の要求の受け取りが遅れる)。入力は `padToDuration`(0 で 5 秒にのばす・`cough-experiment-lib.mjs:121-130`)。
- **モデルの置き場の解決**: `resolveLocalSttModel(engine, {modelsDir})`(`local-stt-engines.mjs:143-151`)。既定は `vendor/models`(`:36`)。`stt.local.modelsDir` で上書きでき(`ear-pipeline.mjs:563`)、cockpit は渡さない(= 既定)。CED-tiny の置き場は `cough-experiment-lib.mjs:30-49` の `CED_TINY_MODEL_LAYOUT` / `resolveCedTinyModel` が持ち、本番側(`src/`)にはまだ無い。
- **モデルが無いときの今の扱い(文字起こしのモデル)**: Start の前に `checkLocalSttModel`(`local-stt-engines.mjs:159-173`・ファイルの存在と 0 byte でないこと)が `{ok:false, reason}` を返し、`checkEarEngine`(`cockpit-server.mjs:2193-2205`)が耳を stopped・`stt: down`(理由つき)にして Start を失敗させる。つまり**今は「ファイルが無ければ止める」流儀**。段階 2 の決定(無ければ全部通して警告 1 回)は、この流儀とは逆向き。Discord の場も同じ `checkEarEngine` を通る(`prepareVenueEars`・`:1909-1916`)。
- **子で init が失敗した場合**: `fatal` → client の `ready` が reject(`local-stt-client.mjs:140-142`)→ `createEarPipeline.start()` が耳を畳んで throw(`ear-pipeline.mjs:580-589`)。実験の子は AudioTagging の作成失敗を `fatal` にしている(`cough-experiment-worker-core.mjs:155-160`)ので、本番に持ってくるなら**判定の作成失敗だけは fatal にしない**分岐が要る(「モデルが無ければ全部通す」)。
- **親で sherpa を読まない縛り**: `no-sherpa-in-parent.test.mjs:108-122` が、`src/` と `scripts/` で sherpa を import / require してよいファイルを「子の入口 2 つ」に固定している。AudioTagging は `loadSherpa()` が返す `sherpa` から使えるので、本番の子の中身に足しても新しい import は要らない(実験の子の `initTagger` も同じ・`:155-157`)。

## 4. 落とす判断をどこでするのが自然か

【リポジトリ事実】経路(whisper / ローカル共通・ElevenLabs は別):
1. `handleSpeechEnd`(`ear-pipeline.mjs:288-338`): リング切り出し → 余白(ローカルのみ) → `encodeWav` → `asrQueue.push({wav, startMs, endMs, durationMs, reason, endWallMs})`。ここに PCM があるが、WAV に固めて渡すので、判定にかけるのは子の中。
2. `pump` → `runJob`(`:341-379`、見張り付き)→ `transcribeAndAppend`(`:381-416`)。
3. `transcribe(job.wav)`(`:386`)→ `{text}` → `currentMeta` を作り(`:388`)→ `buffer.append({startMs, endMs, text})`(`:392`)。
4. `buffer.append` が空白のみなら `discarded += 1` して **`onDiscard` の購読者に `{startMs, endMs, text, reason:"blank"}` を渡す**(`transcript-buffer.mjs:191-197`)。`ear-pipeline` は結果の `appended:false` を見て診断 `transcriptDiscarded{reason, startMs, endMs, latencyMs}` も出す(`:405-413`)。
5. 購読者: `cockpit-server.mjs:2538-2568` `openVenueTranscript` の `buffer.onDiscard` が **`broadcast("discard", {startMs, endMs, reason, appended, discarded})`**(`:2556-2565`)。購読は場が 1 回だけ張る(耳 N 本でも 1 重)。

**今の discard の reason の一覧**(リポジトリ全体を grep した範囲):
| reason | 出る場所 | 経路 |
|---|---|---|
| `"blank"`(空白のみの文字起こし) | `transcript-buffer.mjs:193`(型は `:123` で `"blank"` 固定) | SSE `discard` と診断 `transcriptDiscarded`(`ear-pipeline.mjs:407,432`) |
| (診断のみ・SSE discard ではない) `queueOverflow` / `whisperDown` / `localSttDown` | `ear-pipeline.mjs:332,493,505` の診断 `asrDropped` | SSE `diagnostic`(`cockpit-server.mjs:1794-1806`) |
| (診断のみ) `whisperDown` / `localSttDown`(`asrSkipped`) | `ear-pipeline.mjs:309` | 同上 |

**咳の落としが既存経路に乗らない点**【リポジトリ事実】: 落とす判断を `transcribeAndAppend` の `append` の前でやると、`buffer.append` は呼ばれないので、`onDiscard`(`cockpit-server.mjs:2556`)も `discarded` カウンタ(`transcript-buffer.mjs:192,261`・snapshot の `discarded` `:1568`・SSE transcript の `discarded`)も動かない。乗せる方法は 2 通りに分かれる【事実の列挙・選択は Undine】: (a) 正本に `discard`(理由つき)を足し、`append` の空白判定と同じ口(`discardListeners`)から出す(`speakerTranscriptMouth` が `{...buffer}` を展開するので、足した関数は各耳の口にもそのまま渡る・`discord-experience.mjs:277`)、(b) 耳が診断(`onDiagnostic`)に出し、`cockpit-server.mjs:1762` の `handleDiagnostic` が `broadcast("discard", …)` へ変換する(ただし `handleDiagnostic` の `diagnostic` 放送は項目の許可リスト(`:1794-1806`)で `text` を落とす)。どちらも `blank` 以外の理由を `reason` に持てる(`broadcast("discard")` 側は `info.reason` をそのまま流す・`:2561`)。画面は `discard` を受けて `(discarded)` のゴースト行を出す(`ui/rows.mjs:279-280`・`view-logic/ghost.mjs:30`・調査 `cough-drop-indicator-ui-2026-11.md`)。
**判定を子でやるか親でやるか**【リポジトリ事実】: 子は「文字起こしの結果」と「確率」を同時に持つ唯一の場所だが、子は text を持つだけで discard は出せない(子 → 親の type に discard が無い)。親(`ear-pipeline.mjs`)は `job.startMs/endMs` と text を持つので、**線との比較(落とす / 通す)は親の `transcribeAndAppend` でするのが、既存の変数・見張り・診断・カウンタに近い**【推測】(§7 の 2)。

## 5. `discard` の中身がどこかに残るか

【リポジトリ事実】
- **SSE `discard`**: `cockpit-server.mjs:2556-2565`。`broadcast`(`:1727-1737`)は `sseClients` に `res.write` するだけで、履歴・ring buffer・再送は無い(`sseClients` は `:1319` の Set のみ。`grep` で `replay|history|eventLog` に該当なし。`history` は `transcriptHistory` の `last(n)` だけ)。**`onDiscard` の `info.text` は今も SSE に載っておらず、どこにも渡されていない**(`:2556-2565` は `startMs/endMs/reason` と件数だけ)。
- **snapshot**(`GET /api/state` 相当・`:1496-1575`): `appended` / `discarded` の件数と、`transcripts`(正本 `last(transcriptHistory)` = 積まれた行だけ)。落とした行は載らない。
- **正本 `all()` の使い道**(`cockpit-server.mjs:3057,3070,4407,4486,4559,5233`)と記憶の記録(`scripts/cockpit.mjs:746` の保存要否): すべて積まれた行。discard は積まれないので、記憶・記録に落ちた文字は混ざらない。
- **ログ**: 耳の診断 `handleDiagnostic`(`:1762-1807`)は `type/message/reason/startMs/endMs/tag/kind/elapsedMs/charsSpoken/totalChars/prefix` の許可リストだけを SSE `diagnostic` に流す(本文を載せる欄が無い)。標準出力に出る耳の行は `formatSttLatencyLine`(`scripts/cockpit.mjs:2098-2101`・engine と ms だけ)。`fire-diagnostics`(`src/mind/fire-diagnostics.mjs:3` 冒頭: 発火の内容を記録しない・`appendFile` は発火の診断だけ)と `session-usage-log`(`:100-135` 周辺: 数字・種類・エンジン名だけ)に、耳の discard / `transcriptDiscarded` を書く経路は見つからなかった(`grep "discard|transcriptDiscarded"` の非テスト行はこの SSE と耳の診断の発行だけ)。
- **文字が漏れうる新しい道(文字を載せたときの注意)**:
  1. **`ear-pipeline` の `onDiagnostic` の購読者は 2 つ**: `cockpit-server.mjs:2063` の `handleDiagnostic`(許可リストで安全)と、`src/cli/ears-cli.mjs:90-96`。後者は `jsonl({event:"diagnostic", ...d})` で **`d` を丸ごと stderr に出す**(`:60,95`)。診断に text を載せるとここから出る(ただし ears-cli は whisper 固定で、段階 2 の対象のローカルの耳は結線されていない。判定を `createEarPipeline` の中に入れると、設定次第で CLI にも効いてしまう点は注意)。
  2. **`transcriptBuffer.onDiscard` の `info` には既に `text` がある**(`transcript-buffer.mjs:193`・型 `:123`)。購読者は `cockpit-server.mjs:2556` だけ。今後別の購読者を足すと text が届く。
  3. 画面側(ブラウザ)で SSE を受けたあとどこへ書くか(localStorage・コンソール等)は**未確認**(依頼で画面側は読まなくてよいとされたため)。サーバのログ・ファイルへの経路だけ上記の通り確認。

## 6. 設定と取得

【リポジトリ事実】
- **定義**: `cockpit-settings-store.mjs:90-95` のヘッダ(操縦席にツマミは置かず、ファイルのキーを手で書き換える・範囲外と型違いは既定・Start ごとに読む)。キーは `localSttThreads` / `localSttPreRollMs` / `localSttSilencePadMs` / `localSttHotwords` / `localSttHotwordsScore`(`:430-439` の `getLocalStt`)。ファイルの読みは `readAll`(`:195-199` 周辺・壊れた JSON は `{}`)で、`writeMerged` が既存の未知キーを保持する(`:202-209`)ので、新しいキーを手で足しても他の設定の書き込みで消えない。
- **検証**: `normalizeLocalSttSettings`(`local-stt-engines.mjs:101-114`)。整数 / 数のみ、範囲は `LOCAL_STT_LIMITS`(`:76-83`)、範囲外・型違いは `LOCAL_STT_DEFAULTS`(`:67-73`)。hotwords は `normalizeHotwords`(`:122-135`・配列でなければ既定、空配列は「なし」、文字列で 32 文字以下、重複なし、最大 50)。**同じ検証が 2 回かかる**: `getLocalStt` の中(store)と、`createEarPipeline`(`ear-pipeline.mjs:188`)。新しいキー(文字数の上限・線)を足すなら、この `normalize…` と `LOCAL_STT_LIMITS` / `LOCAL_STT_DEFAULTS` に並べるのが既存の流儀。
- **耳に渡る経路(Start ごと)**: `scripts/cockpit.mjs:3508` `localSttSettings: () => applyRoleHotwords(settings.getLocalStt(), roleHooks.current())`(`:1776-1780`・hotwords だけロールが上書き)→ `cockpit-server.mjs:1061-1066` の `localSttSettingsProvider` → `checkEarEngine`(`:2206-2213`・Start ごとに呼ぶ・読めなければ null)→ `earPlan.localStt = {engine, local}`(`:2213`)→ `buildEarPipeline`(`:2274-2282`・`stt: {engine, local: {...baseOptions.stt.local, ...localStt.local}}`)→ `createEarPipeline`(`ear-pipeline.mjs:188` で正規化、`:560-566` で client に渡す)。Discord の場は `prepareVenueEars` が同じ `checkEarEngine` を通し、`earPlan` を保持して人ごとに `createEar` へ渡す(`:1909-1916`・`discord-experience.mjs:491-492`)。**次の Start から効く**(耳が起きている間は変わらない)。
- **既定の取得(`--only` なし)**: `planLocalSttModelFetch`(`fetch-local-stt-models.mjs:84-106`)は `LOCAL_STT_ENGINES`(Parakeet・Zipformer)のうち足りないものだけ。取得物は Parakeet が HF から `model.int8.onnx`(約 650MB)と `tokens.txt`、Zipformer が GitHub Releases の tar.bz2 から int8 の encoder / decoder / joiner と `tokens.txt`(+ README)(`:13-19`)。CED-tiny は含まれない(`:23-24`)。
- **`--only ced-tiny` の今の作り**: `FETCH_TARGETS = [...LOCAL_STT_ENGINES, "ced-tiny"]`(`:62`)。`only` に `ced-tiny` があるときだけ plan に載る(`:98-104`)。配布元は k2-fsa/sherpa-onnx Releases `audio-tagging-models` の `sherpa-onnx-ced-tiny-audio-tagging-2024-04-19.tar.bz2`(約 28.5MB)で、`model.int8.onnx`(約 6.1MB)と `class_labels_indices.csv`(+ README)だけを取り出す(`:20-23,56-59,64-68`)。置き場の名前と中身の並び(`CED_TINY_MODEL_LAYOUT`・`resolveCedTinyModel`)は **`./cough-experiment-lib.mjs` から import**(`:44`)しており、`scripts/cough-experiment-lib.mjs` はさらに `src/ears/local-stt/local-stt-engines.mjs` を import する(`:25`)。`--only` に `parakeet,zipformer` を明示しなければ、`--only ced-tiny` は CED だけを取る(`:87`)。
- **本番に持ってくるときの境目**: `no-sherpa-in-parent.test.mjs:24-36` の静的チェックは `scripts/fetch-local-stt-models.mjs` と `scripts/cough-experiment-lib.mjs` を共に追っている(どちらも sherpa を import しない前提)。`resolveCedTinyModel` を `src/ears/local-stt/` に移すと、`scripts/fetch-local-stt-models.mjs` と実験の lib の両方の import 先を直す必要がある(実験側の `cough-experiment-lib.test.mjs` / `fetch-local-stt-models.test.mjs` も影響を受けうる)。

## 7. 段階 2 の計画で気をつけること【推測】

1. **「落とす」が `append` を通らない**(§4)。`blank` と同じ口で出すか、診断を `discard` に変換するかを先に決めないと、カウンタ(`discarded`・footer の件数)と `(discarded)` のゴースト行の挙動が割れる。`discarded` の件数に咳を数えるかも決める必要がある(`stats()` は `transcript-buffer.mjs:261`・snapshot `:1568`・SSE transcript が出す)。
2. **判定の置き場**: 確率は子でしか取れないが、落とす / 通すの比較は親でする方が `job` の範囲・診断・カウンタに近い【推測】。子で比較して「落とす」を返す形にすると、親の `transcribe` の戻りに「落とした」の意味が入って、whisper / ElevenLabs の戻り(`{text, rawText}`)と型が割れる。子では確率と「判定にかけたか」だけを返す形が薄い。
3. **「4 文字以下」の数え方**: `text.trim()` の文字数か、`rawText` か、サロゲートの扱いは未定(`normalizeHotwords` は `[...w].length` でコードポイント数を数えている・`:130`)。client の `text` は `trim()` 済み(`local-stt-client.mjs:149`)。実験の `countChars`(`cough-experiment-lib.mjs:252`)の定義と揃えると、実験で決めた線の意味と本番が合う。
4. **判定の中身の音**: 子の `msg.pcm` は**余白込み**(前 200ms 本物 + 前後 300ms 無音・`ear-pipeline.mjs:297-316`)。実験の子も同じ pcm を判定にかけているので、実験の結果(線 0.1)は余白込みの音での値【推測: 線を本番に持ってくるときは同じ入力にする】。
5. **子の init の失敗の扱い**: 実験の子は AudioTagging の失敗を `fatal` にして Start を失敗にする(§3)。「無ければ全部通す」を実現するには、本番の子では (a) 親が先に CED のファイルの有無を確かめて「判定なし」として `init` に渡す(`checkLocalSttModel` と同じ流儀の事前確認)、(b) 子が作成失敗を握って `ready` に「判定なし」を載せる、のどちらか。どちらも「警告を 1 回」は耳ごと(Discord は人ごと)に出る危険がある【推測】: 警告の重複(人数ぶん)を避けるなら、場の側(`cockpit-server.mjs` の `warningBoard` / `[cockpit] WARN`)で 1 回にまとめる。
6. **Discord の子の数**: 人数ぶん子が立ち、各子が `AudioTagging` を読む。ただし判定は 4 文字以下の短い区間だけなので、計算量は小さい。一方で `compute` は同期で子のループを塞ぐ(§3)。実測は見積もり(1 発話あたり +15ms 前後・`cough-filter-audio-tagging-2026-11.md:71`)で、`tagMs` の実測は未確認。
7. **`ears-cli.mjs` との関係**: `createEarPipeline` を直接使うので、判定を耳の中に入れると設定次第で CLI にも効く。CLI は whisper 固定のはずなので実害は小さいが、診断に text を載せない方が安全(§5 の 1)。
8. **`fetch-local-stt-models.mjs` の import の向き**: 本番の取得の道具が実験の lib に依存している(§6)。本番の置き場を `src/` に作るなら、先に向きを直す(`cough-experiment-lib.mjs` を `src/` から import する形)のが依存の筋として自然【推測】。
9. **画面の文字・確率**: `discard` に文字と確率を載せると、SSE を受けるブラウザの全員に渡る(loopback のみ・`scripts/cockpit.mjs:3560`)。ログのタブに「落とした行」を残す決定(計画 §6)と、製品のログに文字を出さない決まりの境界は、画面の保存先(localStorage 等)を確かめてから決めるのが安全。

## 8. 質問(Undine へ)

1. 咳の落としを、既存の `discarded` カウンタと `onDiscard` に数えるか(正本に口を足す)、数えない別の口にするか。
2. 判定の入力に、余白込みの音を使うことでよいか(実験と同じ)。
3. モデルが無いときの警告 1 回の置き場: 耳ごと(Discord は人ごと)に出ないよう、場のレベルで 1 回にまとめる前提でよいか。
4. `ced-tiny` の取得を既定に含めるか(§6 のとおり既定は Parakeet と Zipformer だけ。計画 §6 の「まだ決めていないこと」に残っている)。含めない場合、モデルが無いときの文言に取得コマンドを入れてよいか(実験の `CED_TINY_FETCH_COMMAND` 流儀)。
5. 画面に文字と確率を出すためにブラウザへ送る点は、画面側のどこに書かれるか(localStorage・コンソール等)を調べてから進めたいか。今回は読んでいない。
