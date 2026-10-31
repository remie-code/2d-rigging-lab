# Discord モードを足すための棚卸し: 場の入口出口・複数ロール・耳と会話の記録・声の出口・判定・画面・依存と鍵(Sylph 2026-10-31)

> 種別: リポジトリの事実の調査(読み取りのみ)。設計・範囲の判断はしない。選択肢は並べるだけ。
> 対象: master `e1e77f75`(配信の組み直しのマージ後)。行番号は `apps/soul/agent/` からの相対パスで、**HEAD の版**のもの。
> 注意: 調査の途中で作業ツリーに未コミットの変更が入っていた(`src/cockpit/cockpit-server.mjs` に禁止ポートの開き直し +14 行・`src/mind/memory.mjs`・`recall.mjs`・`src/memory/conventions-seed.md` に scope §21 の「名前を残してよい」の直し)。作業ツリーでは `cockpit-server.mjs` の 345 行目より後が 14 行ずれる。
> 読んでいないもの: `.env*.local`、`cockpit-settings.local.json`、`memories/`、`roles/`。
> 前の棚卸し(組み直し前): [soul-inventory-2026-10.md](soul-inventory-2026-10.md)、[restructure-cockpit-map-2026-10.md](restructure-cockpit-map-2026-10.md)。

## 0. 要約

- **場の関数はもう 1 本にまとまっている**(`openStream` / `closeStream`、`src/cockpit/cockpit-server.mjs:1874`・`:1946`)。体験に依らない段(ロールを固める・場の記録・KILL・判定や予定の作り直し・頭のセッション・記憶の最後の保存)と、配信の段(耳 = マイク + 文字起こし・目・器・YouTube)が同じ関数の中で順に並ぶ。差し替えの口は `streamHooks`(cockpit.mjs 側の 6 つの口)だけで、**耳と YouTube はサーバの中に直に書かれている**。
- **「場の間のロールは 1 つ」はほぼ全層の前提**。サーバは名前の口 1 つ(`currentRoleIdentity`)・orchestrator 1 つ・判定 1 組・KILL 1 つ。cockpit.mjs は `roleHooks.current()`・`session`・`player`・`voiceEngines`・`memoryPlaces` を 1 つずつ握る。2 ロールに広げるときの塊は「ロールごとの頭・声・記憶・orchestrator の束」と「場が持つ共有物(会話の記録・耳・KILL)」に分かれる【推測】。
- **会話の正本は耳の中**(`src/ears/ear-pipeline.mjs:192` で作る)。正本を読む所はサーバに 15 か所、話者 3 値(you / soul / viewer)を読む所は src に約 13 ファイル・テストに 23 ファイル(264 か所)。you は「配信者」として判定・記憶・思い出しの文面に焼き込まれている。
- **声の出口は差し替えやすい**。運び手は `{open, write, end, stop, onEvent}` を確かめるだけ(`src/voice/speech-streamer.mjs:109`)で、器は任意(`:113`)。割り込みの「どこまで声に出たか」は時間割と再生器の `started` の時刻だけで決まる(`src/mind/fire-orchestrator.mjs:1364-1370`)。声の engine の音は AivisSpeech 44.1kHz モノラル・ElevenLabs 24kHz モノラル(PCM16LE)。Discord は 48kHz ステレオなので変換が要る。
- **判定の問いの中身は部品の中に直書き**(`src/mind/speak-now.mjs:81-131`、`comment-react.mjs:60-94`)。差し替えられるのは判定エンジン(`speakNowJudge` 等)だけで、問い・選択肢・入力の組み立てを外から替える口は無い。
- **画面の入口は 1 つのボタン**(`src/cockpit/ui/conversation.mjs:86-89`)で、`POST /api/stream/start` の body は `device` / `sttEngine` / `ttsEngine` だけ。体験の種類を渡す口も、snapshot に体験の種類を載せる欄も無い。
- **依存は入っている**(`package.json` に discord.js 14.27.0・@discordjs/voice 0.19.2・opusscript 0.0.8。node_modules に @snazzah/davey と prism-media)。鍵は試しの仕掛けが `.env.discord.local` の `DISCORD_BOT_TOKEN` をコード内で読む(`scripts/probe-discord-receive.mjs:121-141`)。

---

## 1. 場の入口と出口

### 1.1 事実: openStream の段と、どこに書かれているか

`src/cockpit/cockpit-server.mjs:1874-1940`(説明は `:1607-1616`)。

| 段 | 中身 | 書かれている所 | 体験に依るか |
|---|---|---|---|
| 1 | `streamPhase = "opening"`・世代を進める(ロールを固める = 以後 `POST /api/role` を 409 で断る `:2505-2511`) | サーバ `:1878-1882` | 依らない |
| 2 | 場の記録を作り直す(記憶の本体のファイル名・頭の文脈の記録・置き場の準備) | 口 `renewRecords` → `scripts/cockpit.mjs:1008-1015` | 依らない |
| 3 | KILL を OFF・orchestrator の revive・判定・発火の予定・思い出しの係を作り直す | サーバ `:1900-1909`(`renewJudges :1666`・`renewFireScheduler :1686`・`renewRecallDesk :1706`) | 依らない(ただし作り直す部品の中身は配信の判定。§5) |
| 4 | 耳(マイク + 文字起こし + 会話の正本)・声の engine の用意・目(撮る係)・再生器 | サーバ `startEars :1296-1570`。中で `onPrepareVoiceEngine`(`:1394-1416`)、成功で `onEarsStarted`(`:1569` → `scripts/cockpit.mjs:3027-3036` が撮る係と再生器を起こす) | **混ざっている**: マイク・文字起こし・目は配信。声の engine の用意と再生器は共通。会話の正本の誕生もここ |
| 5 | 頭のセッションをロールのモデルと指示で作る | 口 `openSession` → `scripts/cockpit.mjs:2477-2480` | 依らない |
| 6 | 体があれば器につなぐ(つながらなければ開かない) | 口 `connectBody` → `scripts/cockpit.mjs:1024-1033` | 依らない(ロールの体による) |
| 7 | YouTube(待たずに後ろでつなぐ) | サーバ `startChatForStream :1770-1830` | 配信 |

`closeStream`(`:1946-2010`): 1 写し(`pipeline.transcriptBuffer.all()` `:1960`)→ 2 畳む(`foldStream :1719-1758` = YouTube → 判定・予定・思い出しの係 → 鳴っている声を止める → 耳・目 → 頭のセッション → 器)→ 3 `saveFinal`(`scripts/cockpit.mjs:1050-1056`、記憶の最後の保存を待つ)→ 4 閉じる。Ctrl+C は `endStreamForShutdown :2012-2022` が同じ道を通る。

周りの事実:
- 場の口は `options.streamHooks`(JSDoc `:537-552`)。renewRecords / openSession / connectBody / closeSession / closeBody / saveFinal の 6 つ。実体は `createStreamVenueHooks`(`scripts/cockpit.mjs:982-1086`)。この中身(記憶の保存・頭・器)に配信の語や YouTube は無い。
- 断りの文面は配信の語で直書き(`streamBusyMessage :1860-1866`「配信を始めている途中」、`refuseManualFireOutsideStream :1848-1858`、`BODY_URL_NOT_SET_MESSAGE` `scripts/cockpit.mjs:943-946`「もう一度『配信を始める』を押す」)。
- API は `/api/stream/start`・`/api/stream/stop`(と後方互換の `/api/ears/*`)。`handleStreamStart :2030-2060` はマイク・文字起こし・声の方式だけを読む。
- snapshot の場は `stream: { phase, error, openedAtMs }`(`:1039`)。体験の種類は無い。
- 20 分ごとの保存(`scripts/cockpit.mjs:2810-2813`)と「今日を記録」は `isStreamOpen` で場を見るだけ(体験に依らない)。
- 耳の Stop と目の停止は `stopEars :1578-1605` の中で `onEarsStopped` を呼ぶ形(撮る係の寿命が耳に結ばれている)。

### 1.2 共通にくくれる所・差し替える所の候補

- **くくれる(今のままで体験に依らない)**: 段 1・2・3・5・6、終える の 1(写し)・3・4、`foldStream` の判定〜頭〜器の部分、Ctrl+C の道、20 分ごとの保存。
- **体験ごとに差し替える**: 段 4 の「音の入口と会話の記録」(配信 = マイク 1 本の耳、Discord = VC の受信)、目の起動、段 7(YouTube)、終える の 2 の YouTube・耳の畳み、断りの文面、`handleStreamStart` の body。
- **混ざっていてほどく要る所**: `startEars` の中の声の engine の用意(`onPrepareVoiceEngine`)と再生器の起動(`onEarsStarted` の `ensureVoiceResources`)は、体験に依らないのに耳の Start に乗っている。Discord では再生器が別物になる(§4)。

### 1.3 規模感と選択肢

- 規模: openStream / closeStream / foldStream / startEars / stopEars で約 400 行(`:1296-2070`)。サーバのテストは `cockpit-server.test.mjs`(6154 行)と `cockpit-server-domain-e.test.mjs`、場は `scripts/cockpit-stream.test.mjs`。
- 選択肢(並べるだけ):
  - A. **体験の口を足す**: `streamHooks` と同じ形で「体験の口」(入口を開く / 閉じる・会話の記録を渡す・目を使うか)を足し、openStream の段 4・7 を口に回す。配信の口はサーバの今の耳と YouTube を包む。
  - B. **場の関数を 2 本に分ける**: openStream を共通の前半・後半と体験の真ん中に切り、`openDiscord` を別に書く。共通部分は関数で共有する。
  - C. **サーバの外に場を出す**: 場の段取りを cockpit.mjs(か新しい「場」のモジュール)へ移し、サーバは耳・YouTube・判定の部品の持ち主に戻る。手数は一番多い【推測】。

## 2. 複数ロールへの備え

### 2.1 事実: 「場の間のロールは 1 つ」を前提にしている所

cockpit.mjs(`main()` の中・すべて 1 つずつ):

| 何 | 場所 | 1 つを前提にしている形 |
|---|---|---|
| 今のロール | `createRoleHooks :1204-1320`(`let current :1240`)、`roleHooks :2187` | `current()` / `currentId()` / `identity()` が 1 つを返す。`roleSettings`(口数・話し始め・声の方式)も今のロールだけ |
| 頭の種類・体の有無 | `currentBrain :2267`、`currentBody :2270` | 1 つの値 / 今のロールから読む関数 |
| 名前 | `getCurrentRoleIdentity :2282` | 1 つ |
| 性格の指示 | `conversationInstructionHooks :2272-2277`(`roleHooks.currentId()`) | 今のロールの instructions.md |
| 頭のセッション | `let session :2220`、`ensureSession :2396`、`disposeSession :2458`、`openStreamSession :2477` | 1 本 |
| 声 | `roleVoice :2241`、`voiceEngines :2242`(engine 1 つ)、`let player :2233`、`playerProxy :2567`、`acquireAcceptedFireResources :2597-2650` | engine 1 つ・再生器 1 つ。受理のたびに今のロールの声・体を読む |
| 記憶の置き場 | `createRoleMemoryPlaces :837`・`memoryPlaces :2292`(`currentRole: () => roleHooks.current()`)、`memoryRecorder :2746`、`recallRunner :2824` | 今のロールのフォルダ 1 つ |
| 場の記録 | `createStreamVenueHooks :982`(`lastRecordedSeq` / `lastRecordAtMs` が 1 組)、`sessionUsageLog :2320` | 1 組 |
| 圧縮 | `contextCompactor :2326`(`getSession` が今の session) | 1 本 |
| orchestrator | `fireOrchestratorFactory :2853-2913`(session・player・channel の proxy を 1 組) | 1 つ |
| snapshot のロール | `roleStatus :2704-2719` | 今のロール 1 つ + 一覧 |

cockpit-server:

| 何 | 場所 | 形 |
|---|---|---|
| 名前の口 | `currentRoleIdentityImpl :728`、`currentSoulName :3326` | 1 つ。snapshot の identity(`:1025`)・whisper の手がかり(`:1427`)・発火の予定の呼びかけ(`:3011-3020`)・判定 3 つの `getName` |
| orchestrator | `fireOrchestrator = options.fireOrchestratorFactory(...) :2912` | 1 つ。状態(idle / thinking / speaking)も 1 つ |
| 判定・予定 | `fireScheduler :905`・`speakNow :910`・`commentReact :915`・`recallDesk :920`・`bargeInGate :899` | 1 組。`isBusy` は orchestrator 1 つの状態と `fireInFlight :932` |
| KILL | `killed :891` | 1 つ(場全体を止める意味なら共有のままでよい【推測】) |
| 口数・話し始め・声の方式 | `applyRoleResult :1832-1844`、`speakStartMode`、`ttsEngine` | サーバの現況 1 つ |
| ロールの API | `POST /api/role :2492`・`/api/role/edit`・`/api/role/new` | 今のロール 1 つを替える・直す |
| snapshot | `role :1076`、`brain.identity :1025-1033` | 1 つ |

画面: 上の帯の名前は `roleIdentityOf`(`src/cockpit/ui/app.mjs:141-145`)で 1 つ。会話の行の名前は `soulName` 1 つ(`app.mjs:402-406`)、`glanceWithTranscript` は `kind: "you" | "soul"` の 2 種(`src/cockpit/view-logic/glance-timeline.mjs:110-135`)。

### 2.2 場が「ロールの一覧」を持つときに 1 → 複数で変わる所

- **ロールごとに 1 束ずつ要る【推測】**: 頭のセッション・指示の版(`instructionRevision`)・声の engine と再生器(Discord では Bot の接続ごと)・記憶の置き場と保存の係・思い出しの係・圧縮・orchestrator(と `isBusy`)・名前の口・口数と話し始め・判定の部品(名前と性格の 1 文がロールのもの)・頭の文脈の記録。cockpit.mjs の `main()` の中で、これらは互いに閉じた変数で結ばれている(`ensureSession` が `currentBrain`・`getCurrentRoleIdentity`・`currentBody` を直に読む、など)ので、束ごとに作る工場関数へ切り出す手間が要る。
- **場で 1 つのまま共有できる【推測】**: 会話の記録(§3)・耳(受信)・KILL・自発の ON/OFF・かぶり・場の phase と世代・YouTube(配信だけ)。
- **共有物と束の間に新しく要る決めごと【推測】**: 2 ロールが同時に話し出さないための順番(今は orchestrator 1 つの busy が順番を作っている)、判定を誰の目線で何回呼ぶか、soul の行に「どのロールが言ったか」を載せること(今の soul は 1 値)。
- 最初の的(1 ロール)で備えるだけなら: 場の側に「ロールの一覧(長さ 1)」を持たせ、ロールに依る値は一覧の要素から引く形にしておく、が最小の変化【推測】。ロールに「どの Bot の鍵で入るか」を足すなら `src/roles/role-store.mjs` の `normalizeRole` / `applyRolePatch` と画面のロールの編集に手が入る。

## 3. 耳と会話の記録

### 3.1 事実: 今の耳の構造

- 耳 = `createEarPipeline`(`src/ears/ear-pipeline.mjs:154`)。ffmpeg(マイク→16kHz モノラル s16le)→ フレーマ → Silero VAD → セグメンタ → 文字起こし(whisper / ElevenLabs / parakeet / zipformer)→ **転写バッファ**(`:192` で耳の中に作る)。
- 音の入口は差し替えられる: `captureFactory`(`:139`・`:174`)。中身は「`onPcm` に 16kHz モノラルの PCM を流し、`dispose` を持つ」物(`:596-603`)。
- 耳 1 本ごとに VAD・文字起こしのサーバ / 接続・バッファが 1 つずつできる(`:192-210`・`:620-632`)。N 人分の耳を並べると、正本も文字起こしのサーバも N 個になる。
- サーバは耳を 1 本だけ持つ(`let pipeline :863`)。正本を読む所はサーバに 15 か所(HEAD の行: `:1018`・`:1054`・`:1493`・`:1506-1507`・`:1960`・`:1973`・`:2842`・`:2913`・`:3054`・`:3122`・`:3188`・`:3394`・`:3493`・`:3790`)。どれも `pipeline ? pipeline.transcriptBuffer : null` の形で、耳が無ければ正本も無い(コメントは耳が止まっていると積めない `:3394-3402`)。
- 耳の VAD は割り込みの機械弁と発火の予定にも回る(`:1458-1477`、`bargeInGate.handle :1474`、`fireScheduler.handleVadEvent :1476`)。圧縮の隙間も耳の VAD の `userSpeaking`(`:940`)を読む。
- 転写バッファ(`src/ears/transcript-buffer.mjs`)は依存ゼロの純部品。話者は `"you" | "soul" | "viewer"`(`:73`・`:80`)で、ほかの値は throw(`:131-135`)。`displayName` は viewer のときだけ意味を持つ(`:47-52`)。

### 3.2 事実: 話者 3 値の使われ方

| 所 | 使い方 |
|---|---|
| `src/mind/fire-injection.mjs:40-60` | ①への会話: `you: …` / `soul: …` / `viewer(名前): …`。未知は you |
| `src/mind/memory.mjs:44-67`・`:203`(HEAD) | ②への材料。文面に「you = 配信者、soul = 相方の AI 自身、viewer = 視聴者のコメント」 |
| `src/mind/recall.mjs:110`・`:203`・`:225-227`(HEAD) | ④への会話(同じ説明文)と、思い出しの判定の入力(「配信者: …」「視聴者: 「…」」) |
| `src/mind/speak-now.mjs:143-160`・`:181`・`:318` | you の転写 1 件ごとに判定。入力は「配信者: …」「{名前}: …」で viewer は入れない |
| `src/mind/comment-react.mjs:103-125` | 「配信者」「{名前}」「視聴者」 |
| `src/mind/fire-scheduler.mjs:732-750` | soul = 不応期の基点、viewer = コメントの呼びかけ、you = 呼びかけと活動 |
| `src/mind/fire-orchestrator.mjs:752`・`:1075`・`:1141`・`:1265`・`:1296`・`:1375` | soul を書き込む(`speaker: "soul"`) |
| サーバ `:1005-1015`(`toWireEntry`)・`:1491`(soul / viewer は耳の道で放送しない)・`:3503`(viewer を積む) | 放送と積む道 |
| 画面 `view-logic/transcript.mjs:23-49`、`glance-timeline.mjs:110-135` | you / soul は会話、viewer はコメント欄 |

- 規模: src の本体で約 13 ファイル、テストで 23 ファイル・264 か所に `speaker` が出る。

### 3.3 会話の記録を耳の外に出し、話者を名前付きにするときに触る所

- **正本を耳の外に出す**: `createEarPipeline` が外から渡されたバッファ(か「積む口」)を受け取れるようにする(今は `:192` で自作)。サーバは場の始まりで正本を作り、15 か所の `pipeline.transcriptBuffer` を場の正本に向ける。耳が無い場でも正本はある形になる。手は中くらい(置き換えは機械的、テストの差し替えが多い)【推測】。
- **話者を名前付きにする**: 選択肢(並べるだけ):
  - a. **3 値は残し、`displayName`(と人の id)を you にも許す**: 配信は今のまま。Discord の人間は全員 you + 名前、Bot は soul。バッファの検証と整形(fire-injection・memory・recall・speak-now・comment-react)で「you に名前があれば `名前: …`」を足す。判定の「配信者」の語はそのまま残るので、Discord の判定は別に要る(§5)。
  - b. **話者を「人 / 自分 / 視聴者」のような種類と、名前・id の組にする**: you を「操作する人」に限らない形。下流の 10 ファイル余りの分岐と文面の説明文、テストに広く手が入る。
  - c. **体験ごとに整形を差し替える**: 正本は `{種類, 名前, id}` を持ち、①②④・判定に渡す行の組み立てを体験の口に任せる。
- 2 ロールに備えるなら、soul にも「どのロールか」が要る(§2.2)。今の soul は名前を持たず、①への行は `soul: …` 固定。
- 名前を残す件(scope §21)は作業ツリーで進んでいる(memory.mjs・recall.mjs の未コミットの変更)。話者の形を変えるなら、そこと同じ所を触る。

### 3.4 Discord の受信を耳に流す道(事実と推測)

- 試しの仕掛けは、人ごとに `receiver.subscribe(userId, { end: AfterSilence 1000ms })` で Opus を受け、opusscript で 48kHz ステレオにデコードしている(`scripts/probe-discord-receive.mjs:61`・`:79`・`:801-845`)。
- 耳の `captureFactory` は 16kHz モノラルを要るので、48kHz ステレオ → 16kHz モノラルの変換を挟めば、人ごとに耳を 1 本作る形にできる【推測】。ただし耳 1 本ごとに文字起こしのサーバ / 接続ができる(whisper-server は 512MB のモデルを読む `ear-pipeline.mjs:24-26`)ので、人数ぶん並べるなら文字起こしの共有が要る【推測】。
- 試しの持ち越し(`discussion/ai-cohost/experiments/discord-receive-probe.md` §本体を作るときへの持ち越し): 入った直後の発言は頭が欠ける・無音の「発言」を弾く(Silero VAD が弾けるかは未確認【推測】)。

## 4. 声の出口

### 4.1 事実: 運び手が受け取る形

- `createSpeechStreamer`(`src/voice/speech-streamer.mjs:100-`)が確かめるのは、再生器の `open / write / end / stop / onEvent` の 5 つだけ(`:109-111`)。器(channel)は任意で、null なら器への送信と口の release を飛ばす(`:113-116`、説明 `:17-20`)。
- 呼び方: `player.open(playbackId, { sampleRate, channels })`(`:505`)→ `write(id, pcm)`(`:424`、PCM16LE の Uint8Array)→ `end(id)`(`:439`)。中断は `stop()`(同期 `:320`)。`write` / `end` が false を返すと「発話を失った」として打ち切る(`:428-446`)。
- 再生器から返す合図(`onEvent`): `{type:"started", id, atMs}`・`{type:"ended", id}`・`{type:"stopped", id}`・`{type:"error", id, message}`・`{type:"exit", code}`(扱い `:630-679`、作り `src/voice/stream-player.mjs:517-536`)。違う id の started / ended は捨てる(`:635-640`)。
- 見張り: `started` は最初の音を書いてから 5 秒以内(`:47`・`:352`)、`ended` は `started` + 音の長さ(`sampleRate × channels × 2` から計算 `:359`)+ 余裕 750ms(上限 5 秒)以内(`:49`・`:362-368`)。
- 今の再生器(`createStreamPlayer :573`)は常駐 PowerShell + C# の WASAPI で、「今の発話」1 本だけを持つ(open で前を置き換え)。ほかに `whenReady :777`・`current`・`isAlive`・`dispose :794` を持ち、cockpit.mjs は `isAlive()` と `dispose()` も使う(`scripts/cockpit.mjs:2488-2511`・`:2518-2526`)。
- 差し込み口: cockpit.mjs の `player`(`:2233`)と `ensureVoiceResources`(`:2488-2512`)が再生器を作る唯一の所。受理ごとに `acquireAcceptedFireResources`(`:2597-2650`)がその時点の `player` を orchestrator に渡し、orchestrator は `resources.player` を運び手へ渡す(`src/mind/fire-orchestrator.mjs:628`・`:878`・`:1172`)。`playerProxy`(`:2567-2593`)は受理の口が無い経路のためのもの。**Discord 向けの再生器を同じ形で作り、`ensureVoiceResources` が体験に応じて作り分ければ、運び手と orchestrator は変えずに済む見込み**【推測】。

### 4.2 割り込みの「どこまで声に出たか」の依存

- 切断点 = `computeSpokenPrefix({ speechText, timeline, elapsedMs })`(`src/mind/barge-in.mjs:106`)。`elapsedMs = 割り込みの時刻 − startedAtMs`(`src/mind/fire-orchestrator.mjs:1364-1370`)。失敗のときも同じ(`:1981-1994`)。
- `startedAtMs` は再生器の `started` の `atMs`(無ければ受けた時刻)(`speech-streamer.mjs:643-646`)。今の再生器は IAudioClock の位置が 0 を超えた時点で `STARTED` を出し、Node が行を読んだ時刻を `atMs` にする(`stream-player.mjs` の説明 `:16-19`)。
- 時間割は声の engine から来る(器が無くても貯める `speech-streamer.mjs:19-20`)。
- つまり依存は「時間割」と「`started` の時刻が、聞き手の耳に音が届き始めた時刻にどれだけ近いか」だけ。Discord では、`@discordjs/voice` の AudioPlayer が Playing になった時刻は「送り始めた」時刻で、相手の耳までの網の遅れ(とジッタバッファ)を含まない。そのぶん切断点が多めに出る向きにずれる【推測】(今の作りは「多めに言わない」側に倒している `barge-in.mjs:85-96`)。
- 割り込みのきっかけは耳の VAD(`cockpit-server.mjs:1474`)。Discord では受信側の VAD(か `receiver.speaking` の start)から機械弁に回す道が要る。

### 4.3 声の engine が出す音の形式

| engine | 形式 | 根拠 |
|---|---|---|
| AivisSpeech | WAV ヘッダの値をそのまま(実際は 44.1kHz・モノラル・16bit) | `src/voice/engines/aivis-voice-engine.mjs:169-183`、`src/voice/fixtures.mjs:56-57`、`wav-duration.mjs:5` |
| ElevenLabs | `pcm_24000`(24kHz・モノラル)。`pcm_<rate>` なら替えられる | `src/voice/engines/elevenlabs-voice-engine.mjs:58-62`・`:130-132`・`:526` |

- Discord の Raw は 48kHz・ステレオ・s16le(試しのピー `probe-discord-receive.mjs:79`・`:151-163`・`:863`)。運び手は形式を `open` で渡すだけで変換しない。今の再生器は WASAPI の AUTOCONVERTPCM に変換を任せている(`stream-player.mjs:20`)。Discord 向けの再生器は自分で 44.1k / 24k モノラル → 48k ステレオに変換する(prism-media か自前)【推測】。

## 5. 判定

### 5.1 事実: 構造

- 判定の部品は 3 つ + 思い出しの判定。どれも cockpit-server が組み立て、場の始まりで作り直す(`renewJudges :1666`)。
  - speak-now: `makeSpeakNow :3052-3117`(`createSpeakNowController`、`src/mind/speak-now.mjs:214`)。you の転写ごと(`:1484`)。
  - コメント反応: `makeCommentReact :3120-3180`(`createCommentReactController`)。コメントの弾く判定は `commentGuard :812-817`。
  - 従来の発火の予定: `makeFireScheduler :3004-`(`createFireScheduler`、呼びかけの名前は `currentRoleIdentityImpl` から)。
  - 思い出しの係: `makeRecallDesk :3185-`。
- **外から替えられるのは判定エンジンだけ**: `options.speakNowJudge`・`commentGuard`・`commentReactJudge`(`:796-824`)、`fireSchedulerFactory`(テスト用 `:2996-3003`)。エンジンは `{input, instructions, choices}` を受けて `{choice, probs}` を返す形(JSDoc `:615-617`)。
- **問い・選択肢・入力の組み立ては部品の中に直書き**: `speakNowQuestion :81-83`(「ゲーム配信で配信者の隣にいるサポート役の AI Tuber」)、`buildSpeakNowInstructions :106`、`buildSpeakNowChoices :115-131`、`buildSpeakNowInput :143-170`(「配信者: …」)。コメント反応も同じ(`comment-react.mjs:60-125`)。部品の工場(`createSpeakNowController` 等)はサーバが直に import して呼ぶので、工場ごと差し替える口も無い。
- ロールから判定に渡るのは名前(`getName` = `currentSoulName`)と口数(`getVerbosity`)だけ(設計 §5 のとおり)。
- 発火の結線(`onFire` → `requestSelfFire(..., { vision: "preferred", ... })` `:3064-3082`)は判定の中身に依らない。

### 5.2 差し替える口の候補

- a. **部品の工場ごと体験の口にする**: `makeSpeakNow` / `makeCommentReact` を options から受け取れるようにし、Discord は別の部品(問い・選択肢・入力・きっかけ)を渡す。発火・busy・KILL の結線はサーバに残る。
- b. **今の部品に「問いの組み立て」を注入する**: `createSpeakNowController` に `buildRequest(entries, ctx)` のような口を足す。部品の動き(busy の間の数え・after-busy・並行の判定・相槌の歯止め)は共有できる。きっかけ(you の転写 1 件ごと)を人ごとにどう数えるかは別に決める要る【推測】。
- c. **Discord の判定を別の部品で書き、`onTranscript` から呼ぶ**: 今の部品に触らない。サーバの結線(`:1478-1517`)に体験の分岐が入る。
- 補足: 判定のキー(`.env.decisions.local`)の読み方は共通で使える(`src/mind/speak-now-decisions.mjs:48`・`:72`)。

## 6. 画面

### 6.1 事実

- メイン画面の中央: `ConversationPanel`(`src/cockpit/ui/conversation.mjs:78-101`)。場が開いていない間(`isPreStream`、`view-logic/glance-meters.mjs:208-211`)に「配信を始める」(`prestream-start`)と「準備・設定」の 2 つのボタン。文言と押せるかは `streamStartView`(`glance-meters.mjs:221-231`、文言に「配信を始める / 始めています / 終えています」が直書き)。
- 押したときは `startStream`(`src/cockpit/ui/app.mjs:351-370`)が `POST /api/stream/start` に `{}` を送る。終えるは下の帯の 2 回押し(`app.mjs:373-388`、`endStreamButtonView glance-meters.mjs:240-247`)。
- 準備・設定のタブ: `SETTINGS_CATEGORIES`(`src/cockpit/ui/settings-drawer.mjs:131-137`)= 配信の準備(`prepare`)/ ロール / 運転 / 記憶 / ログ。配信の準備のパネルは `:931-`(YouTube・ゲームの窓・体があるときだけ器・たたんだマイク・文字起こし・声の出力先・忙しい間のコメント・いちばん下に「配信を始める」`:600-640`)。タブの切り替えは `settingsModalNextCategory`(`:140-`)。
- ロール・記憶のタブは体験に依らない中身(scope §21 の「共通の場所」に合う)。運転タブ(自発・かぶり・手動の発火)も体験に依らない【推測】。
- 画面がサーバの場の状態を読むのは `settingsFromSnapshot` の `stream`(`app.mjs:126-128`)だけで、体験の種類は無い。

### 6.2 差し込み口の候補

- メイン画面: `ConversationPanel` の `prestream-actions` に体験ごとのボタンを並べる(`start` の view を体験の一覧にする)。`streamStartView` を体験の一覧から作る形に広げる。開きかけ・閉じかけ・終えるの文言も体験ごとに要る。
- 準備・設定: `SETTINGS_CATEGORIES` の `prepare` を「配信の準備」と「Discord の準備」(サーバー・チャンネル・入れるロール)に分けるか、`prepare` の中を体験で切り替える。タブの id は `data-settings-category` とテスト(`cockpit-ui-settings.test.mjs`)に出る。
- サーバ: `POST /api/stream/start` に体験の種類を足すか、`/api/discord/join`・`/leave` のような別の口を足す。snapshot の `stream` に体験の種類(と Discord の接続の状態)を足す。
- 会話の行: Discord では「A: …」「B: …」「あなた: …」の名前付きの行が要る(体験の素描 場面 4)。今の `glanceWithTranscript` は you / soul の 2 種で、you に名前を出す道が無い(§3)。

## 7. 依存と鍵

### 7.1 事実

- `apps/soul/agent/package.json` の dependencies に `discord.js` 14.27.0・`@discordjs/voice` 0.19.2・`opusscript` 0.0.8 が版の固定で入っている。node_modules には `@snazzah/davey`(と win32-x64 の native)・`prism-media`・`discord-api-types` もある(依存の依存)。
- 試しの仕掛けの鍵の読み方(鍵のファイルは開いていない。コードだけ):
  - 置き場: `DEFAULT_DISCORD_ENV_PATH = apps/soul/agent/.env.discord.local`(`scripts/probe-discord-receive.mjs:54-55`)、変数名 `DISCORD_BOT_TOKEN`(`:51-52`)。
  - `loadDiscordBotToken(options)`(`:121-141`): `readFileSync` で読み、`node:util` の `parseEnv` で解き、値を trim して `{ok:true, token}` を返す。`process.env` に入れない。読めない・形が違う・無いときは理由だけを返す(理由に値を入れない)。`filePath` と `readFileImpl` はテスト注入できる。
  - 使い方: `main()` で 1 回読み(`:620-624`)、`activeSecrets` に入れてエラーの文面から伏せる(`:625-626`)、`client.login(token)` に渡す(`:710`)。
  - discord.js / @discordjs/voice / opusscript は `main()` の中で動的 import(`:628-640`)。純関数はそれらなしでテストできる(`scripts/probe-discord-receive.test.mjs`)。
  - Intent は `Guilds` と `GuildVoiceStates` だけ(`:661`)。名前は `guild.members.fetch(userId).displayName`(`:744`)で、特権 Intent なしで取れた(試しの結果)。
- ほかの鍵の読み方も同じ流儀: ElevenLabs(`loadElevenLabsApiKey`、`.env.elevenlabs.local`、cockpit-server の JSDoc `:578-581`)、判定(`loadDecisionsApiKey`、`src/mind/speak-now-decisions.mjs:48`・`:72`)。

### 7.2 2 ロールへの備えに関わる事実

- 今の読み方は鍵 1 つ・変数名 1 つ。ロールごとに Bot を替えるなら、ロールが「どの鍵か」を指す形(鍵のファイル名か変数名)と、`loadDiscordBotToken` の `filePath` / 変数名を引数にする手が要る【推測】。鍵の中身はロールの `role.json` に入れない(ロールのフォルダは git に入らないが、鍵の置き場の決まりは `.env*.local`)。

---

## 8. Undine が決める分岐の候補

1. **場の差し替えの単位**: 体験の口を足す(§1.3 A)/ 場の関数を分ける(B)/ 場をサーバの外に出す(C)。
2. **会話の正本を耳の外に出すのを、Discord の最初の的に入れるか**(入れないなら、受信を 1 本の耳に混ぜるか、人ごとの耳の正本をどう 1 つにするか)。
3. **話者の形**: 3 値 + 名前(§3.3 a)/ 種類 + 名前 + id(b)/ 体験ごとの整形(c)。soul に「どのロールか」を今入れるか。
4. **人ごとの音を文字起こしにどう回すか**: 人ごとに耳 1 本(文字起こしのサーバも人数ぶん)/ 文字起こしを共有して VAD だけ人ごと / 全員を混ぜて 1 本(話者が分からなくなる)。
5. **判定の差し替え方**: 工場ごと(§5.2 a)/ 問いの組み立てだけ注入(b)/ 別部品(c)。Discord の判定のきっかけ(誰の発言ごとに呼ぶか)。
6. **複数ロールへの備えの深さ**: 最初の的で「ロールの一覧(長さ 1)」の形だけ入れる / ロールごとの束(頭・声・記憶・orchestrator)の工場まで切り出す / 今は何もしない。ロールに Bot の鍵の指し先を持たせるか。
7. **再生器の作り分けの場所と、`started` の時刻の意味**: Discord の Playing の時刻をそのまま使うか(切断点が多めに出る向き)、遅れの補正を入れるか。音の変換(48kHz ステレオ)をどこで持つか。
8. **画面と API**: `POST /api/stream/start` に体験の種類を足す / Discord 用の別の口。snapshot の `stream` に体験の種類を足すか。準備のタブを分けるか、中で切り替えるか。
9. **目(撮る係)を Discord で使うか**: 今は耳の Start に寿命が結ばれている(`onEarsStarted`)。

## 9. 質問(調べ切れなかったこと)

- Silero VAD(耳の既定)が、試しで見えた「ほぼ音の無い発言」(RMS 0.0002〜0.002)を弾けるかは、コードからは決められない(実測が要る)。
- 2 人以上での話者の分かれ方は試しで未確認(試しの結果の持ち越し)。
- 作業ツリーの未コミットの変更(memory.mjs・recall.mjs・conventions-seed.md の名前の直し、cockpit-server.mjs の禁止ポートの開き直し)が誰の作業かは確かめていない。話者の形を変える作業と同じ所を触る。
