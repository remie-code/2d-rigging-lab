# Fire → audio playback-start proxy レイテンシ調査

> Status: repository inventory（2026-08-30）
>
> Scope: Cockpit の Fire 操作で `fired` が表示された時点から、Soul の音声再生開始に最も近い観測点まで。実スピーカーから人間が聞くまでの物理遅延は対象外とし、`player.play(wavPath)`（および可能なら子プロセスの `STARTED`）を playback-start proxy とする。
>
> 注: 依頼文の「ibisSpeech」は、repository の実装名 `AivisSpeech`（`apps/soul/agent/src/voice/tts-client.mjs`）として追跡した。

## 1. 結論（先に要点）

- Cockpit で見える `fired` 行は「音声開始」ではない。通常 Fire では注入文字列を作った直後、`session.ask()` の前に `onFire({accepted:true})` が送られる。視覚 Fire でも、対象キャプチャの前に同じ受理マーカーが送られる（`apps/soul/agent/src/mind/fire-orchestrator.mjs:745-767,804-816`）。
- 現在の実装に Fire/turn 共通 ID はない。ブラウザの POST は `{}`、SSE の `fire`/`visionCaptured`/`usage`/`expression`/`transcript`/`diagnostic` に共通キーがなく、LLM・TTS・Player・Runtime Channel の各 ID も別々である。Control Channel の `req-N` は接続ごとにリセットされ、Runtime の Recent Events はそれを捨てて独自の表示キーを付ける。
- 既存の観測点は部分的には豊富である。`fire.atMs`、注入文字数/行数、視覚キャプチャの aggregate `elapsedMs`、LLM の `elapsedMs`/`ttftMs`、TTS の `rttMs`、`wavDurationSec`、timeline 配列、Channel の `req-N`/`replyTo`、Audio Player の `STARTED` はコード上に存在する。ただし本番 Fire の観測連鎖にはほとんど露出されず、同一 Fire と結べない。
- 最も大きい盲点は「LLM は全文 result を待ってから初めて TTS へ進む」ことと、TTS/Channel/Player の stage timing が本番 Fire から見えないことである。既存記録では、LLM warm ask は通常約 3.2–3.3 秒だが 9.2 秒外れ値、視覚 cold ask は約 6.8 秒、AivisSpeech synthesis は約 1 秒である。これらは参考値であり、依頼されたスクリーンショットの 14–15 秒やその後 5–11 秒の原因を直接証明する値ではない。
- 長発話の失敗を分けるには、少なくとも「読み上げ文字数、audio_query の生 mora 数、生成 timeline 数、`intent.speech` JSON バイト数、失敗 stage/code、Channel close/timeout、親の `play` と子の `STARTED`」が同一 ID で必要である。現状は timeline 512 超過が Soul 側でも Runtime 側でも明示的に拒否され得るが、失敗時にその数量が残らない。

## 2. 用語と測定対象

このレポートでの「Fire → fired UI」は、次の二つを区別する。

1. **backend acceptance**: orchestrator が `onFire({accepted:true,...,atMs})` を実行した時点。
2. **visible fired row**: Cockpit ブラウザが SSE `fire` を受け取り、Preact state を更新して `fire-marker` 行を描画した時点。

現行 UI の fired 行は `d.atMs`（Node 側の時刻）を表示するだけで、SSE 到着時刻・DOM/paint 時刻は持たない（`apps/soul/agent/src/cockpit/ui/rows.mjs:96-107`）。したがって、ユーザーが画面上で見た時点を厳密に測るにはブラウザ側の追加観測が要る。

Playback-start proxy は二段階ある。

- Soul Node 側: `speak()` が Channel accepted の直後に `player.play(wavPath)` を呼び、直後に `playbackStartedAtMs = nowImpl()` を返す（`apps/soul/agent/src/voice/speak.mjs:102-125`）。これは「再生コマンドを enqueue した時刻」であって、スピーカーの物理出音ではない。
- Resident PowerShell/WinRT 側: `PLAY` を受けて `MediaPlayer.Source` を設定し `Play()` を呼び、`STARTED` を stdout に返す（`apps/soul/agent/src/voice/audio-player.mjs:91-107`）。これは親プロセスより近い child acceptance だが、本番 `cockpit.mjs` は `createAudioPlayer()` に `onOutput` を渡していない（`apps/soul/agent/scripts/cockpit.mjs:826-829`）ため、現在 Cockpit/SSE には届かない。

## 3. 実際のイベント経路と境界

```text
Browser ControlBar click
  └─ POST /api/fire または /api/vision-fire (body={})
       └─ Node cockpit-server → orchestrator.fire()
            ├─ normal: injection format → soul=thinking → onFire accepted/atMs
            │              └─ SSE fire → Browser feed fire-marker (visible fired)
            │              └─ session.ask(text)
            └─ vision: resolve target → soul=thinking → onFire accepted/atMs
                           └─ SSE fire → Browser feed fire-marker
                           └─ captureWindow (PowerShell child)
                                └─ onVisionCaptured/SSE → session.ask([image,text])

LLM session.ask (Claude persistent query / Codex per-turn branch)
  └─ wait full result → parseExpressionTags
       ├─ expressionPromise: translate → intent.envelope (per word, slot sends concurrent)
       │                       → Runtime Channel reply → onExpression/SSE
       └─ speak(speechText)
            ├─ AivisSpeech /audio_query → moras/pre/post
            ├─ AivisSpeech /synthesis → WAV bytes → wavDurationSec
            ├─ buildSpeechTimeline → writeTempWav
            ├─ intent.speech via Control Channel → accepted/rejected reply
            └─ player.play(WAV) → playbackStartedAtMs (parent proxy)
                 └─ resident PowerShell/WinRT STARTED (closest child proxy)

Runtime Player main process
  └─ WS request id=req-N → parse/validate → overlayStore.setSpeech(nowMs)
       └─ reply {replyTo:req-N,result:accepted|rejected}
```

### 3.1 Cockpit UI → backend acceptance → visible marker

- `ControlBar.fireWith()` は `localBusy` を同期的に立て、`POST` を送り、HTTP 応答が返るまで local busy を維持する。POST body は常に `{}` で、ブラウザ側の request/turn ID や開始時刻はない（`apps/soul/agent/src/cockpit/ui/control-bar.mjs:173-207`）。ボタンの配線は `/api/fire` と `/api/vision-fire`（同:315-323）。
- App は `/api/state` で履歴を復元してから SSE を購読し、SSE 各イベントで `feedAfterSseEvent()` と非フィード状態更新を行う（`apps/soul/agent/src/cockpit/ui/app.mjs:139-198`）。`fire` は `accepted === true` の時だけ marker row になり、非受理は feed 行を作らず note のみ更新する（`apps/soul/agent/src/cockpit/ui/rows.mjs:194-245`）。
- Server の `/api/fire`/`/api/vision-fire` は orchestrator の Promise 全体を await してから HTTP JSON を返す。成功は 202、busy/empty/error 等は 200（`apps/soul/agent/src/cockpit/cockpit-server.mjs:1010-1021,1050-1061`）。よって HTTP 応答の時刻は「fired 行」より後で、自然完了なら音声尺待ちの後になる。
- SSE `broadcast()` は event 名と JSON をそのまま各 client に `res.write()` するが、送信時刻や event ID は付けない（`apps/soul/agent/src/cockpit/cockpit-server.mjs:628-644`）。

### 3.2 Normal / vision の分岐

- Normal: 直近窓を同期的に `formatFireInjection()` し、空窓なら ask せず終了。非空なら `setState("thinking")` と `onFire({accepted:true,injectedChars,includedCount,atMs})` の後で `session.ask(injectedText)` を呼ぶ（`apps/soul/agent/src/mind/fire-orchestrator.mjs:745-767`）。
- Manual vision: target が無い時は受理せず終了。target があれば `thinking` と `onFire({accepted:true,vision:true,atMs})` を先に送り、その後 `captureImpl(title)` を呼ぶ（同:786-816）。capture 成功後に `onVisionCaptured({title,width,height,jpegBase64,elapsedMs})`、画像先行 `[image,text]` content を組み、`session.ask()` へ進む（同:695-730）。
- Preferred vision（自発 call/turn-end）も target がある時は同じく capture 前に accepted を送る。target 無し/失敗時は normal Fire へ劣化する（同:827-869）。

### 3.3 Capture / LLM / response handling

- `captureWindow()` は別 PowerShell を spawn し、`runPowerShellScript()` が spawn から終了までを既定 `Date.now()` で一つの `elapsedMs` として返す。PrintWindow、JPEG化、転送などの内訳はない（`apps/soul/agent/src/eyes/powershell-exec.mjs:73-132`; `apps/soul/agent/src/eyes/window-capture.mjs:208-245`）。
- Claude `createLlmSession()` は生成時に persistent `query()` を開始し、`ask()` 起点を `performance.now()` で測る。`stream_event` の最初の text delta までを `ttftMs`、result までを `elapsedMs` として返す（`apps/soul/agent/src/mind/llm-session.mjs:162-198,204-287`）。初回 query spawn/init は `ask()` 起点より前に発生し得る。
- Codex brain も registry に存在する。Codex は `runTurn()` を呼ぶ都度の経路で、`askStart` から result までの `elapsedMs` は返すが `ttftMs` は常に null（`apps/soul/agent/src/mind/brains.mjs:49-88`; `apps/soul/agent/src/mind/codex-session.mjs:406-429`）。したがって計測には brain/model の同時記録が必要である。
- LLM の返事は全文 result を待ってから `parseExpressionTags()` に渡される。parser はタグを剥がした `speechText`、表情/演出 `events`、診断を作り、その後初めて speaking へ遷移する（`apps/soul/agent/src/mind/fire-orchestrator.mjs:416-430,452-463`）。ストリーミング delta 到達は TTFT 計測には使われるが、TTS/音声開始には使われない。

### 3.4 Expression/directive と音声の並行性

- `setState("speaking")` 後、`applyExpressions(events)` を開始し、同時に `speak(speechText)` を開始する（`apps/soul/agent/src/mind/fire-orchestrator.mjs:461-472`）。表情語ごとには payload を各 slot へ `Promise.all` で送るが、語の順番は逐次である（同:361-403）。
- `onExpression` は各語の send 完了後に発火するため、UI の expression 行は TTS 完了前に見えることも、send/接続の都合で後になることもある。expression reject/throw は diagnostics に握られ、発話そのものは止めない（同:353-357,379-401）。ただし orchestrator は発話完了後にも `await expressionPromise` するため、HTTP の最終完了時刻とはずれる。

### 3.5 AivisSpeech → timeline → Control Channel → Player

- `speak()` は `/audio_query` → `parseAudioQuery()`（mora 列、pre/post）→ `/synthesis`（WAV）→ WAV 実長→ `buildSpeechTimeline()`→同期 `writeWav()` の順である（`apps/soul/agent/src/voice/speak.mjs:80-100`）。
- `/audio_query` と `/synthesis` は `fetch()` の request/response 完了までを待つが、client は個別 elapsed を返さない（`apps/soul/agent/src/voice/tts-client.mjs:115-165`）。
- `buildSpeechTimeline()` は voiced vowel のみを残し、WAV 実長と pre/post から時刻を割り当てる。生成数が 0 または 512 超なら throw する（`apps/soul/agent/src/voice/mora-timeline.mjs:127-197`）。raw mora 数と timeline 数は、この関数の戻り値以外には保持されない。
- WAV を temp に書いた後、`channel.sendSpeech(timeline)` を await する。accepted でなければ throw、accepted なら直ちに `player.play(wavPath)` と `playbackStartedAtMs` を実行する（`apps/soul/agent/src/voice/speak.mjs:99-125`）。この順序は fake 依存を用いたテストで固定されている（`apps/soul/agent/src/voice/speak.test.mjs:66-109,112-147`）。
- `connectChannel()` は初回 send 時に lazy 接続され、hello を待つ。各 request は `req-${idCounter}`、`performance.now()` 起点の `rttMs`、reply の `replyTo` で相関する（`apps/soul/agent/src/channel/channel-client.mjs:60-139,141-200`）。`idCounter` は `connectChannel()` ごとに 0 へ戻る（同:69-80）。
- Runtime server は受信時に自身の `nowMs()` を `receivedAtMs` として dispatch に渡し、`intent.speech` accepted なら `overlayStore.setSpeech(moras, nowMs())`、その後 `onEvent({kind:"accepted",slotId:"mouth-open",value:firstMora.s})` と WS reply を送る（`apps/runtime-player/src/main/control-channel/channel-server.ts:276-337`）。`onEvent` 型には request id、replyTo、時刻、kind（speech/envelope/set の別）がない（同:69-89）。
- `intent.speech` は timeline 1..512 を要求し、超過/空/不正時は `invalidPayload`、有限範囲外 `s` は `slotValueOutOfRange`、口グループ非 writable は `slotNotWritable` となる（`apps/runtime-player/src/main/control-channel/channel-intent-validation.ts:312-386,395-440`; 契約: `apps/runtime-player/src/main/control-channel/contract/channel-protocol-contract.ts:168-203`）。

### 3.6 Runtime Player の可視イベントと音声 Player の境界

- Runtime の mouth timeline は Channel accepted 時刻を `startAtMs` とし、`snapshot(nowMs)` の tick で評価する。これは「口の制御開始」であり、Soul Node の音声 `player.play` や人間が聞く時刻とは別プロセス/別時計である（`apps/runtime-player/src/main/control-channel/control-channel-overlay-store.ts:171-202,239-284`）。
- Runtime の `onEvent` は connected/accepted/rejected/disconnected の session-only Recent Events のソースだが、main bridge は独自の monotonic `id` を付け、最大 20 件の ring buffer にするだけである。時刻・request id・Fire id は持たない（`apps/runtime-player/src/main/channel-bridge-handlers.ts:36-105`）。
- renderer 契約も Recent Event を `{id,kind,slotId?,value?,code?}` に限定している（`apps/runtime-player/src/preload/channel-bridge-contract.ts:36-48`）。Channel page の accepted 表示は実際の kind に関係なく `intent.set` と表示するため、speech acceptance を表示だけから区別できない（`apps/runtime-player/src/control/channel-page.tsx:185-200`）。
- Audio Player は `PLAY`/`STOP` を stdin へ送り、stdout の `STARTED`/`ENDED`/`STOPPED`/`ERROR` で内部 `isPlaying` を更新する。`play()` 自体は非ブロッキングで、child marker は任意の `onOutput` にしか渡らない（`apps/soul/agent/src/voice/audio-player.mjs:20-35,233-279,291-297`）。

## 4. 既存の ID・時刻・ログ・計測の棚卸し

| 対象/段階 | 既存フィールド・ログ | 現状の判定 | Fire と結べるか / 限界 |
|---|---|---|---|
| Browser click → POST | `localBusy` の状態のみ。body `{}`。 | 要追加 | click/POST start、SSE receive、DOM/paint の時刻なし。 |
| backend Fire admission | SSE `fire`: `accepted`, `vision`, `injectedChars`, `includedCount`, `atMs`（normal/vision）。 | 既存測定点 | `atMs` は backend `Date.now()`。Fire ID なし。UI が見た時刻ではない。 |
| normal injection | `formatFireInjection()` の `charCount`, `includedCount`, dropped counts。accept payload は前二者のみ。 | 一部既存 / 他は導出可能 | 文字数/行数は marker に出る。format 所要時間はない。 |
| vision target/capture | `onVisionCaptured`: title, width, height, jpegBase64, aggregate `elapsedMs`; `fireVisionError` の kind/message。 | aggregate のみ既存 | capture 子 process/PrintWindow/JPEG 内訳、target resolve 時間、Fire ID なし。base64 長は受信側で導出可能。 |
| LLM session init | production stderr `session_init` は model/apiKeySource/tools のみ（`apps/soul/agent/scripts/cockpit.mjs:808-823`）。 | 形状は既存、時刻は要追加 | lazy session の init start/end、brain/turn ID なし。 |
| LLM ask | `MindSessionAskResult.elapsedMs`, `ttftMs`, `usage`。`onUsage` SSE は usage/vision/brain のみ（`apps/soul/agent/src/mind/fire-orchestrator.mjs:416-420`; `apps/soul/agent/src/cockpit/cockpit-server.mjs:1468-1471`）。 | 内部は既存、外部相関は要追加 | natural completion の soul transcript に `latencyMs=asked.elapsedMs` は載るが Fire→音声ではなく、TTFT/ID はない（同サーバ:1425-1448）。 |
| response/parser | HTTP successful result / soul transcript の `replyText` はタグ除去後 `speechText`。`expression` は word,args,applied,rejected。 | 文字数は成功時導出可能、時間は要追加 | 失敗前の speechText/char count がなく、parser/translation duration もない。内容そのものをログせず長さだけでよい。 |
| AivisSpeech audio_query | endpoint と query response の moras/pre/post。client は JSON を返すだけ。 | mora count は関数内で導出可能、stage 時刻は要追加 | production `speak()` は count/response size を外へ返さない。 |
| AivisSpeech synthesis | Uint8Array WAV と `wavDurationSec`。 | bytes/尺は内部導出可能、stage 時刻は要追加 | synthesis duration は current Fire に露出なし。 |
| timeline/WAV prep | `timeline`、`wavDurationSec`、`wavPath`、同期 `writeWav()`。preflight は counts を印字。 | count/bytes は導出可能、stage 時刻/serialized bytes は要追加 | raw mora count は speak return に含まれない。 `intent.speech` JSON bytes は未計測。 |
| Channel connect/hello | lazy connection state（unset/idle/connecting/connected/error）。hello timeout 4s。 | status/timeout は既存、Fire stage time は要追加 | handshake は Fire ID なし。初回接続時間は `sendSpeech.rttMs` に含まれない。 |
| Channel speech request | `req-N`、WS `replyTo`、client-side `rttMs`、result/error code。 | 内部は既存 | orchestrator は `rttMs` を speak return まで持つが Fire HTTP/SSE へ出さず、`req-N` も捨てる。 |
| Runtime acceptance/rejection | server `receivedAtMs`/`nowMs` 内部、accepted/rejected onEvent、reply `{replyTo,result,error}`。 | accepted/rejected は既存 | onEvent が id/time/kind を破棄。Recent Events の local id は request id ではない。 |
| Runtime mouth start | `setSpeech(..., startAtMs=server nowMs)`、heart tick の `snapshot`。 | runtime 内部は既存 | audio start と別 process/clock。Runtime 側の accepted と音声側 `play` の差がない。 |
| parent playback proxy | `playbackStartedAtMs` は `player.play` 直後の `Date.now()`。 | 内部既存 | orchestrator/HTTP/SSE へ伝播せず、physical start ではない。 |
| child playback proxy | `STARTED` stdout、内部 `isPlaying=true`。preflight-voice は Date.now で PLAY→STARTED を計測。 | テスト/preflight では既存 | production `onOutput` 未接続。Fire ID なし。 |
| completion/error | `soul` state (`thinking/speaking/idle`)、`diagnostic`、HTTP final response。diagnostic は type/message/reason/kind/elapsedMs/charsSpoken 等を正規化。 | イベントは既存 | `fireError` は message 中心で、stage/ID/数量がない。 |
| transcript correlation | `seq,startMs,endMs,appendedAtMs,speaker,displayName`（`apps/soul/agent/src/cockpit/cockpit-server.mjs:550-561`）。 | transcript 自体は既存 | `seq` は会話エントリ ID で Fire ID ではない。soul の `latencyMs` は ask elapsed のみ。 |

### 4.1 現在のテスト/スクリプトが証明する範囲

- `apps/soul/agent/scripts/measure-fire.mjs:3-16,78-145` は実 Claude session と orchestrator を使うが、speak/channel/player は fake。注入文字数、reply 文字数、TTFT、ask_ms、fire_elapsed、usage を記録できる。ただし実 TTS/Channel/Player までの E2E ではない。
- `apps/soul/agent/scripts/observe-vision.mjs:12-22,168-176,282-331` は実 captureWindow + 画像付き実 ask を使い、capture elapsed、base64 長、TTFT、ask_ms を記録するが、orchestrator/TTS/Channel/Player は使わない。
- `apps/soul/agent/scripts/first-light.mjs` の記録は LLM→TTS→timeline（送出/再生なし）。再現記録では init 約 1.9 秒、warm ask 約 3.2–3.3 秒、synthesis 約 0.97–1.24 秒、timeline <0.4ms（`discussion/ai-cohost/experiments/s1-first-light.md:10-18,44-80`）。
- `apps/soul/agent/scripts/preflight-tts.mjs` は実機 TTS→WAV→timeline→契約 assert まで、`preflight-e2e.mjs:47-101` は実 TTS→Channel accepted→`player.play` までを通す。ただし後者の印字は Channel RTT、timeline 件数、WAV 尺であり、Fire UI からの stage timestamps ではない。
- `apps/soul/agent/scripts/preflight-voice.mjs:57-105` は synthetic WAV で child `STARTED`/`ENDED` を待ち、PLAY→STARTED を `Date.now()` で印字する。これは実 Player の closest proxy を示すが、Fire と同じ run ID を持たず、本番 production wiring の onOutput も使っていない。
- `apps/soul/agent/scripts/preflight-fire.mjs:3-18,126-150,175-210` は実 HTTP/SSE/orchestrator の順序を検証するが、session/speak/channel/player は fake。Fire→ask→speak→soul/expression の配線証拠であり、速度の証拠ではない。
- `apps/soul/agent/src/voice/speak.test.mjs:66-109,112-147,150-220,223-246` は `audioQuery→synthesis→sendSpeech→accepted→play`、timeline 契約、reject、512 超過、WS double の順序を固定する。
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs:127-241,345-400,405-565,637-683` はタグ分離、expression 部分適用、thinking→speaking→idle、ask/speak error、vision content の構造を fake で固定するが、実時刻は測らない。
- Runtime 側 `channel-server.test.ts:101-218,220-297` は request reply correlation、speech accepted の mouth evaluator、reject/disconnect を固定する。`channel-bridge-handlers.test.ts:149-190` は Recent Events の ring buffer（最大 20・most-recent-first）を固定するが、時刻/Fire ID はない。

## 5. 観測済みの証拠（スクリーンショットとは分離）

### 5.1 既存 repository 記録

- S1 first-light は「入力→Agent SDK→AivisSpeech audio_query+synthesis→timeline」までで、実器送出・音声再生は含まないと明記している（`discussion/ai-cohost/experiments/s1-first-light.md:10-18`）。同記録の sample は、cold ask 4.9607 秒、warm ask 3.1943/3.3452 秒、外れ値 9.2406 秒、audio_query 17.9–55.7ms、synthesis 974.5–1241.6ms、timeline は実質ゼロである（同:56-80）。
- S5 vision 記録は capture 630ms、画像込み cold ask 6.7981 秒（TTFT 4.8242 秒）、後続 text ask 3.0673–5.6412 秒である（`discussion/ai-cohost/experiments/s5-vision.md:56-81,88-103`）。この測定は実 capture/LLM までで、TTS/Channel/Player は含まない。
- S1 の記録は「音声が鳴り始める実 E2E は accepted 受領時刻依存で、人間ゲートで測る」と明記している（`discussion/ai-cohost/experiments/s1-first-light.md:69-80,95-103`）。現在の調査対象では、そこを自動的に Fire ID 付きで結ぶ計器がまだない。

### 5.2 依頼されたスクリーンショット観測

「Fire→expression が概ね 14–15 秒、その後さらに 5–11 秒で error」という間隔は、ユーザー提供の観測としてのみ扱う。上記コードから、expression が response parse 後かつ `applyExpressions` の Channel send 後に出ること、Fire marker が先行することは確認できるが、この間隔のどの部分が capture、LLM、TTS、Channel、UI 配送、または別要因かは現状のログでは特定できない。

## 6. 根拠付き仮説と、将来の識別方法

| 仮説（断定ではない） | 根拠 | これを識別する将来観測 |
|---|---|---|
| LLM の全文応答待ちが支配項または外れ値 | TTS は LLM result の後でしか始まらない（`fire-orchestrator.mjs:421-472`）。既存 warm ask は 3.2–3.3s、9.2s 外れ値、vision cold は 6.8s（S1/S5 記録）。 | Fire ID ごとの `askStart`, first text delta/TTFT, result end, brain/model。14–15s 区間が result 前なら LLM 起因と判別できる。 |
| 初回 lazy session/resource 初期化が加算 | production は初回 `session.ask` の前に `ensureFireResources()` で session/player を生成する（`apps/soul/agent/scripts/cockpit.mjs:260-273,785-829`）。session creation の query init は askStart より前になり得る。S1 init は約 1.9s。 | session/player init start/end と Fire ID、first Fire vs warm Fire 比較。init end が marker→ask gap に収まるかを見る。 |
| 視覚 capture と画像付き LLM が加算 | vision accepted は capture 前、capture は PowerShell aggregate 630ms 実測、画像付き cold ask 6.8s 実測。 | `targetResolve`, capture child start/end, base64 length, ask start/TTFT/result を分離。normal/vision の対照で判別する。 |
| AivisSpeech synthesis が加算 | 既存 TTS 記録では synthesis が audio_query より大きく約 1s。ただしこれ単独で 10 秒超を説明する証拠はない。 | audio_query/synthesis request start/end、WAV bytes、WAV duration。14–15s 区間の result 後部分と一致するかを見る。 |
| 初回 Channel connect/hello または reply timeout | Channel は初回 send 時 lazy 接続、hello timeout/reply timeout は各 4s（`channel-client.mjs:39-50,129-155`）。connect 時間は speech RTT に含まれない。 | connect start/open/hello end、speech send/reply、result/code、socket close を Fire ID + req id で記録。4s 境界に張り付くなら timeout 仮説を検証できる。 |
| 長文の timeline 上限/Channel validation が失敗 | Soul 側 `buildSpeechTimeline` は 512 超で throw、Runtime 側も >512 を `invalidPayload` で拒否（`mora-timeline.mjs:185-195`; `channel-intent-validation.ts:406-413`）。現状は長さを error に添えない。 | `replyChars`, `speechChars`, raw `moraCount`, `timelineCount`, serialized `intent.speech` bytes、Soul throw または Runtime rejection code。失敗が synth 後/Channel 送信後のどちらかも分かる。 |
| expression send の大量化/Channel close が HTTP 完了を遅らせた | expression は response parse 後、語ごとに slot send を行い、speech と並行。ただし完了処理で `await expressionPromise` する（`fire-orchestrator.mjs:361-403,461-550`）。expression send error は発話を止めない設計。 | expression ごとの send start/end、slot 数、req id、accepted/rejected/close と `player.play` を同時記録。expression が遅いだけなら playback proxy は先に出るはずである。 |
| resident Player/WinRT の child start が遅い | `player.play()` は非ブロッキングで、WinRT child は `STARTED` を別プロセスから返す（`audio-player.mjs:91-107,265-279`）。production では marker が見えない。 | parent `play` enqueue、child `STARTED`/`ERROR`、必要なら child `ENDED` を Fire ID + wavPath で観測。parent と child の差を直接分離する。 |
| UI の見えた時点を backend `atMs` と取り違えている | marker は SSE arrival 時に state update されるが表示時刻は d.atMs（`rows.mjs:100-107`; `app.mjs:171-180`）。SSE frame に送信/受信時刻はない。 | backend `fire.atMs`、SSE send/receive、DOM commit/paint の四点を別時計/同一 ID で取る。実 UI 遅延の寄与を他の stage と混同しない。 |
| 入力 ASR の長発話問題が Fire audio failure と混同されている | `long-utterance-diagnosis.md` は >3.2 秒入力転写の消失仮説を扱い、その後 7 回では再現しなかった（`discussion/ai-cohost/implementation/waves/s2.5/long-utterance-diagnosis.md:8-22,33-79`）。これは Fire 後の出力 TTS failure の証拠ではない。 | Fire ID の前段で入力 transcript/ASR diagnostic を同時刻に記録し、出力 TTS/Channel failure と別系列として比較する。 |

## 7. 最小限必要な将来観測（実装設計ではなく観測チェックリスト）

### 7.1 共通相関キー

将来の一回の観測では、少なくとも admission された一 Fire/turn に一つの `fireId`（名前は仮）を持たせ、次の全イベントに同じ値を載せられることが必要である。採番地点は「orchestrator が busy/killed/ears guard を通過して受理を確定する境界」が自然な候補だが、ここでは実装方式を決定しない。

相関対象は `fire` marker、vision capture、LLM usage/result、expression 各語、speech/TTS、Channel `req-N`、Runtime accepted/rejected/close、parent play、child STARTED、final error である。UI 起点を別に測る場合は browser request id と fireId の対応も必要となる。

### 7.2 1 Fire で残すべき最小値

- `fireId`, trigger kind（manual / vision / call / turn-end / silence）、brain/model、success/error stage/code。
- UI click/POST start、backend admission/`onFire`、SSE send、browser receive、DOM/render の時刻または各 duration。
- normal injection の `includedCount`, `injectedChars`、vision の target resolve と capture start/end/duration、画像 base64 長。
- session resource init start/end、LLM `askStart`、first token/TTFT、result end/duration、usage（少なくとも input/output token 数）。
- model output character count（タグ込み）と read-aloud `speechText` character count（タグ除去後）。本文そのものを記録する必要はない。
- parser/directive start/end/duration、expression word 数、slot 数、各 envelope request の accepted/rejected/error/close と duration。
- TTS `audio_query` start/end/duration、raw mora count、`synthesis` start/end/duration、WAV byte length、WAV duration。
- timeline build start/end/duration、mora count、timeline count、`intent.speech` の serialized JSON byte length。長文失敗時も、throw 前に得られる数値を残す。
- Channel connect/open/hello、speech `req-N`、send/reply timestamps/duration、accepted/rejected/error code、socket close。Runtime 側の `receivedAtMs`/acceptance anchor も可能なら同一観測に残す。
- parent `player.play` enqueue 時刻、child `STARTED`/`ERROR` 時刻、（終了や中断を調べる場合）`ENDED`/`STOPPED`。playback-start proxy は parent と child を別フィールドにする。

### 7.3 時計の扱い

duration は各 Node process 内では `performance.now()` 等の monotonic clock を使い、wall-clock `Date.now()`/ISO は UI や別 process の照合用に別フィールドで残すのが安全である。Browser、Cockpit Node、AivisSpeech、Runtime Electron、capture/Audio PowerShell child は clock origin が異なるため、process-local `performance.now()` を別 process 間で直接引き算しない。別 process 間は共通 `fireId`/request id と wall timestamp、または送受信差の duration を用いる。

## 8. 未解決点

- スクリーンショットの `expression` 行が最初の expression send 完了を指すのか、全 response/音声処理後に見えた行なのかは、現行 UI に到着時刻がないため未確定。
- `fire.atMs` と UI の実際の render/paint の差、SSE write の詰まり、ブラウザの更新遅延は未計測。
- `captureWindow.elapsedMs` は PowerShell の一括時間で、title resolve、PrintWindow、JPEG encode、Node→LLM content 受け渡しを分離できない。
- `asked.elapsedMs` は LLM ask のみであり、Fire marker→LLM ask 開始（lazy session initを含む）や result→play を表さない。
- `speak()` の `playbackStartedAtMs` は parent の `PLAY` 書き込み直後で、child `STARTED`/WinRT `PlaybackSession` の実状態や物理出音を表さない。
- orchestrator の自然完了 timer は `wavDurationSec` と parent proxy を使うが、child `ENDED` を購読していない（`apps/soul/agent/src/mind/fire-orchestrator.mjs:474-507`）。長尺時の「実際の再生区間」と state/完了のずれは別途未観測。
- 長発話 failure が Soul 側 timeline 512 超過、Runtime Channel `invalidPayload`、Channel timeout/close、TTS synthesis error、LLM error のどれかは、現行の `fireError` message 単独では数量・境界が足りず判定できない。
- 既存の ASR 長発話診断は入力経路の問題であり、Fire 後の出力音声失敗へ直接帰属する証拠はない。
