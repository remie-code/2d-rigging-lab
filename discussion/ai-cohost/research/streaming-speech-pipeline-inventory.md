# Streaming speech pipeline inventory

> Status: repository inventory（2026-08-30）。設計判断・実装案の採否ではない。
> Scope: 現行 Codex Fire 経路を、完成応答一括から安全な文単位の逐次 TTS/playback queue へ変える前の bounded inventory。Claude は変更対象外。外部 LLM/AivisSpeech/Runtime 実器は実行していない。

## Executive summary

- 現行 Codex は `thread.runStreamed()` を使うが、SDK event から採るのは完成 `item.completed.agent_message.text` だけである。`session.ask()` が全文を返すまで parse/TTS は始まらない（`apps/soul/agent/src/mind/codex-session.mjs:283-318`, `:394-429`）。別の App Server probe は画像付き Sol/low で completion 前 delta と安全な第一文を観測済みだが、これは現行 SDK 経路の挙動ではない（`discussion/ai-cohost/experiments/codex-app-server-streaming-probe.md`）。
- 現行の縦列は、Fire 受理→必要なら vision capture→LLM 全文→全文 tag parse/NG gate→表情 request と全文 `speak()` を並行開始→AivisSpeech `/audio_query`→`/synthesis`→WAV 尺/timeline/temp WAV→単一 `intent.speech` accepted→`PLAY`→WAV 尺 timer→全文 transcript append→Fire completed である。
- 再生成功の確定は audio child の `ENDED` ではなく `wavDurationSec` の timer である。child `STARTED/ENDED/STOPPED/ERROR` は `playing` と diagnostics を更新するだけで、Fire の完了/失敗を動かさない（`apps/soul/agent/src/voice/audio-player.mjs:236-248`, `:265-296`; `apps/soul/agent/src/mind/fire-orchestrator.mjs:512-576`）。したがって `PLAY` 後の child `ERROR` でも現行は timer 後に全文 transcript と成功 terminal を作り得る。
- LLM turn が completed した時点で Codex thread には assistant 全文が入っている。一方、Soul transcript/memory は自然再生完了後に初めて全文を得る。TTS/channel 失敗では「LLM session には assistant 全文、表示 transcript/memory には無し」という分岐が既にある。
- 現行で明示的な「部分成功」は barge-in/kill のみで、`player.stop`→mouth close→timeline×経過から spoken prefix→`prefix + 注記` を transcript へ 1 回 append する。後続 chunk 失敗の意味論は未定であり、同じ observable を使って user decision が必要である。
- queue の自然な seam は `delta buffer → safe sentence/tag boundary → per-sentence parse/NG gate → TTS job → timeline → accepted → PLAY → actual/derived completion → next`。ただし方式決定ではない。queue 世代 ID、発話済み watermark、単一 playback ownership、late completion 無効化、terminal 一回性が必要になる。
- 4096 byte は WS frame payload の現行 application cap である（`apps/runtime-player/src/main/control-channel/channel-websocket-frame.ts:40`）。chunk 化で通常一 request が小さくなる可能性はあるが、タグ除去後の日本語長→mora/timeline→JSON UTF-8 bytes は一定比ではない。上限撤廃/変更の根拠にはならない。

## Accepted constraints

- 対象は当面 Codex 経路のみ。Claude は変更対象外。
- vision は必須。
- App Server の `gpt-5.6-sol`, effort `low` を許容する。
- 通常の複数 Fire は同じ LLM session/thread を継続する。
- conversation instruction 等の設定変更は進行中応答へ影響せず、次 Fire から反映する。
- 安全な第一文が確定したら、短さ判定を挟まず即座に話し始める。
- 後続 chunk 失敗を「部分成功」「失敗」のどちらに分類するかは未決。本稿は現行 observable/state effect と帰結のみを示す。

## Repository facts

### Fire/session ownership

- `fire()` は killed、busy、ears-not-running を共通入口で拒否し、vision true/preferred/normal を分岐する（`apps/soul/agent/src/mind/fire-orchestrator.mjs:969-1004`）。accepted Fire は `idle→thinking→speaking→idle` の single-flight で、busy 中の追加 Fire は queue されず捨てられる（同 `:29-39`, `:978-981`）。
- normal Fire は transcript 全件から注入窓を作り、空窓なら ask せず、accepted 後に `session.ask()` を一回行う（同 `:785-837`）。vision Fire は target 解決と capture 成功後、画像先行 content blocks と会話窓を ask する（同 `:740-768`, `:847-899`）。preferred は target/capture 不可時だけ画像なしへ劣化する（同 `:909-957`）。
- Codex session は起動時に一つの SDK thread を作り、複数 `ask()` で同じ `thread` を使う（`apps/soul/agent/src/mind/codex-session.mjs:374-387`, `:394-429`）。system prompt は first turn にだけ前置されることをテストが固定する（`apps/soul/agent/src/mind/codex-session.test.mjs:117`）。
- 現行 Codex `runTurn` は streamed events を最後まで drain し、agent `item.completed.text` を最終応答、`turn.completed.usage` を usage とする。delta を外へ出さず `ttftMs:null`（`apps/soul/agent/src/mind/codex-session.mjs:283-318`, `:423-428`）。
- Fire resources は lazy 生成され、session は current brain/identity/conversation instruction/memory を system prompt に固定する（`apps/soul/agent/scripts/cockpit.mjs:785-845`）。conversation instruction revision は進行中 session を直ちに壊さず、次 `sessionProxy.ask` 前に stale session を dispose/recreate する（同 `:850-867`; `apps/soul/agent/scripts/cockpit.test.mjs:1140`, `:1299`）。これは accepted constraint と一致する既存 seam である。
- brain/memory/audio-device/channel URL の変更は別物である。brain と memory は現在の session をその場で dispose/null 化（`apps/soul/agent/scripts/cockpit.mjs:911-936`, `:980-1013`）、audio device は player をその場 dispose（同 `:882-905`）、channel URL は cached connection を非同期 close して次 request から再接続（同 `:1075-1085`; `:219-231`）。進行中 Fire への意味論は conversation instruction と同じではない。

### Response parse and speech preparation

- `processAskedReply` が完成 `replyText` 全文を `parseExpressionTags` に一度渡し、`speechText/events/diagnostics` を同時確定する（`apps/soul/agent/src/mind/fire-orchestrator.mjs:431-450`）。
- parser は well-formed tag 全体を regex で除去し、既知6語を位置付き event、未知 tag を diagnostic、残った `<`/`>` を無条件除去する。`speechText` に angle bracket を残さない（`apps/soul/agent/src/mind/expression-parser.mjs:42-98`）。現行は全文があるため未閉じ tag の後続 delta 待ちという状態を持たない。
- kill-inflight は parse 後、speak/transcript/expression 前に全文を破棄する。NG gate もこの位置で、命中時は固定注記だけを append し本文は speech/diagnostics/戻り値へ出さない（`apps/soul/agent/src/mind/fire-orchestrator.mjs:452-470`）。
- 表情 event は speech と独立に `expressionPromise` で開始し、slot ごとの accepted/rejected/throw は speech を失敗させない（同 `:359-418`, `:481-497`）。tag position は保存されるが同期には使われない（`apps/soul/agent/src/mind/expression-parser.mjs:17-24`）。
- `speak(text)` は text 全文を一 TTS job として扱う。`/audio_query` query parse、`/synthesis` WAV、WAV duration、timeline、temp WAV、Control Channel、PLAY の順で、途中失敗は throw（`apps/soul/agent/src/voice/speak.mjs:90-211`）。
- AivisSpeech API は `POST /audio_query?text=&speaker=` と query JSON body の `POST /synthesis?speaker=`。失敗 body は最大500文字だけ error messageへ含める（`apps/soul/agent/src/voice/tts-client.mjs:120-165`, `:170-181`）。
- timeline は WAV 実尺から pre/post silence を除いた body を raw mora 数で均等割りし、a/i/u/e/o のみを残す。時刻は整数・厳密増加、出力512超は truncate せず throw（`apps/soul/agent/src/voice/mora-timeline.mjs:127-197`）。

### Control Channel and Runtime lifetime

- Soul client は `server.hello` と required kinds を確認し、request ID で reply を相関する。hello/reply timeout は各4秒（`apps/soul/agent/src/channel/channel-client.mjs:39-70`, `:82-169`）。
- request は envelope 全体を一 WebSocket text frameで送る。送信時に実 JSON の UTF-8 byte length、requestId、kind、timeline countを診断する（同 `:171-216`）。reply 前 close は pending 全件を `channel_closed` reject、reply timeout は `reply_timeout`（同 `:112-155`, `:193-203`）。
- lazy channel は成功 connection promise を cache する。初回接続失敗だけ cache を捨てるが、接続後の remote close は cache を無効化しない（`apps/soul/agent/scripts/cockpit.mjs:167-188`）。実 run #8後の #9-#11 timeout 連鎖と整合する（`discussion/reports/ai-cohost-fire-diagnostics/live-run-analysis-2026-08-30-01.md`）。
- Runtime は request を検証し、accepted `intent.speech` を受理時刻 anchored の単一 live speech timelineへ書いてから reply する（`apps/runtime-player/src/main/control-channel/channel-server.ts:321-403`; `apps/runtime-player/src/main/control-channel/control-channel-overlay-store.ts:171-202`）。新しい speech は prior speech/per-slot mouth driveを置換する。
- timeline は Runtime tick の `snapshot()` で評価され、terminal release後に `#speech=null` へ prune。client disconnect は強制 release、model unload は hard clear（`apps/runtime-player/src/main/control-channel/control-channel-overlay-store.ts:204-237`, `:249-284`）。Runtime は Soul audioの `ENDED`を知らない。
- WS client message cap は4096 bytes。4096 accepted、4097 oversize closeを testが固定する（`apps/runtime-player/src/main/control-channel/channel-websocket-frame.ts:40`; `apps/runtime-player/src/main/control-channel/channel-websocket-connection.test.ts:13-35`）。oversize/incomplete-overflow/decode/non-final/peer-close等は transport diagnostic に分離される（`apps/runtime-player/src/main/control-channel/channel-websocket-connection.ts:101-165`）。

### Audio player and completion

- WAV は temp directory に同期 writeされる（`apps/soul/agent/src/voice/audio-player.mjs:174-183`）。削除 lifecycle は実装されておらず、temp OS cleanup任せである。
- player protocol は `PLAY path` / `STOP`; child は `STARTED/ENDED/STOPPED/ERROR` を返す。PowerShell MediaPlayer は PLAY受理直後に STARTED、natural duration到達で ENDED、STOPでSTOPPEDを出す（同 `:89-138`）。STARTED は physical speaker onset ではない。
- parent `play()`/`stop()` は stdin 送出だけで非blocking。marker は `isPlaying` と diagnosticsへ反映される（同 `:236-296`; `apps/soul/agent/scripts/cockpit.mjs:834-843`）。Fire orchestrator はmarkerを購読しない。
- Control Channel accepted後に `player.play()`し、その直後の `Date.now()`を `playbackStartedAtMs` とする（`apps/soul/agent/src/voice/speak.mjs:189-210`）。STARTED受信時刻ではない。
- orchestrator は `wavDurationSec*1000` timerで自然完了を推定し、timer後に全文 transcriptをappendしてFire successにする（`apps/soul/agent/src/mind/fire-orchestrator.mjs:499-576`）。actual ENDEDが早い/遅い/無い/ERRORでもこのtimerは変化しない。

## Current pipeline timeline

| # | 現行処理 | state / observable | Evidence |
|---:|---|---|---|
| 1 | manual/self-fire request | killed/busy/ears guard。self-fire call/turn-end は preferred vision、silence は strict vision | `apps/soul/agent/src/mind/fire-orchestrator.mjs:969-1004`; `apps/soul/agent/src/cockpit/cockpit-server.mjs:1498-1572` |
| 2 | transcript window / vision target | normal空窓は未受理。vision必須経路はtarget/capture失敗でaskしない | `fire-orchestrator.mjs:785-804`, `:847-899` |
| 3 | accepted / thinking | `onFire accepted`→diagnostic `fire.accepted`; state thinking | `fire-orchestrator.mjs:799-808`; `apps/soul/agent/scripts/cockpit.mjs:1026-1035` |
| 4 | vision capture | captured imageはaskだけへ入りtranscriptへ保存しない | `fire-orchestrator.mjs:730-750`, `:870-885` |
| 5 | LLM ask | 同一 Codex threadのturnを最後までdrain | `codex-session.mjs:283-318`, `:394-429` |
| 6 | full response parse | 全文 speechText/events/diagnostics、kill/NG gate | `fire-orchestrator.mjs:431-470` |
| 7 | speaking + expression | expressionsは各slot request、speechは全文TTS。互いの失敗分類は独立 | `fire-orchestrator.mjs:481-497` |
| 8 | audio_query → synthesis | query/moras/pre/post→WAV bytes | `speak.mjs:90-127` |
| 9 | WAV/timeline/file | duration→均等mora timeline→temp WAV | `speak.mjs:129-172`; `mora-timeline.mjs:127-197` |
| 10 | intent.speech | 単一 JSON request。Runtime acceptedでtimeline startAt=acceptance | `speak.mjs:174-199`; `channel-server.ts:373-403` |
| 11 | audio PLAY | accepted直後に非blocking PLAY。child STARTEDは後着 | `speak.mjs:200-210`; `audio-player.mjs:236-279` |
| 12 | playback lifetime | WAV尺timerとbarge/killだけをorchestratorが待つ。ENDED/ERROR不使用 | `fire-orchestrator.mjs:512-560`; `audio-player.mjs:240-247` |
| 13 | turn-end / transcript | natural timer後全文append、SSE transcript、schedulerはsoul transcriptを発火実績として不応期更新 | `fire-orchestrator.mjs:563-576`; `fire-scheduler.mjs:712-721` |
| 14 | diagnostic terminal | `fire.completed`または`fire.failed`でactive JSONLをfinish/fail | `fire-orchestrator.mjs:815-833`; `apps/soul/agent/scripts/cockpit.mjs:1043-1058` |

## State commit points

| State/data | 現行の確定・保存点 | 失敗時 |
|---|---|---|
| LLM assistant全文 | Codex agent item completed/turn stream drain。SDK thread内部にはturn履歴として残る | 以降のTTS/channel失敗でも残る。session dispose時は自session rollout cleanup（`codex-session.mjs:444-459`） |
| usage / elapsed | ask completion後に返り、parse前にSSE usage | 後段失敗でも通知済み (`fire-orchestrator.mjs:431-445`) |
| expression/speech parse | 完成reply全体への一回のpure parse | chunk途中状態なし。未知/壊れtagは全文時点diagnostic |
| expression application | speaking遷移直後、speech TTSと並行。一event内payloadは並列、eventsは順次 | rejected/throwはdiagnosticのみ。Fire speech成功を妨げない |
| speech text | parse時にmemory上で確定。公開/永続 transcriptは未確定 | kill-inflight/NG/TTS/channel失敗では本文appendなし |
| audio/timeline | synthesis/WAV inspect/timeline build/temp writeで順次確定 | throw時はPLAYなし。temp WAV write後のchannel失敗ではfileだけ残る |
| Runtime mouth timeline | Runtime accepted requestをstoreへ書いた瞬間 | reply喪失でもRuntime側は適用済みの可能性。disconnectでrelease |
| user-heard speech | repository上の確定点なし。STARTEDもphysical onsetではない | timer/diagnosticだけでは聞こえた量を証明不能 |
| Soul transcript/SSE | natural timer後の全文、barge/kill時のprefix+注記、NG時の固定注記 | TTS/channel失敗とdispose中断では無し |
| memory/digest対象 | record時のtranscriptBuffer全量。常駐LLM thread履歴は直接読まない | transcript未appendならdigest対象外 (`apps/soul/agent/src/mind/memory.mjs:76-139`; `apps/soul/agent/scripts/cockpit.mjs:947-976`) |
| Fire diagnostic terminal | orchestrator return直前のtraceをJSONL finish/fail | writerはbest-effort async、保持5、queue128。欠落はstage未実行の証明にならない (`fire-diagnostics.mjs:34-89`, `:117-158`) |

## Streaming seams

以下は設計採択ではなく、現行部品に対応する seam 候補である。

| Candidate stage | 現行対応 | queue化で保持すべき局所契約 |
|---|---|---|
| delta buffer | 現行なし。App Server probeのみ成立観測 | delta順序、item/turn identity、final concat照合、late delta拒否 |
| sentence boundary | 現行は完成全文のみ | `。！？`等のsafe boundaryと、boundary到達時点で即enqueue。短さ判定を追加しない |
| tag safety | 全文 `parseExpressionTags` | 未閉じ `<...` を次deltaへ保留し、確定した文にangle bracketを残さない。tagが文境界を跨ぐ場合のownershipを明示 |
| safety/NG gate | 全文 `containsNgWord(speechText)` | chunk単独検査ではchunk境界を跨ぐNG語を見逃さない。既発話後の後続NG命中の扱いはuser decision |
| TTS job | 全文 `speak(text)` | chunk ID、speech text、TTS query/WAV/timelineを一jobへ閉じる。並列合成してもplayback順序を固定 |
| timeline | per-job `buildSpeechTimeline` | chunk-local t=0、Runtime accepted anchor、prior timeline置換との競合を避ける |
| playback | accepted→PLAY | 同時にactive playbackは一つ。STARTED/ERROR/STOPPED/ENDEDとjob ID/pathを相関 |
| completion | 現行WAV尺timer | ENDEDを採用するかtimerを残すか未決。いずれもterminal一回、late marker無効化 |
| next | 現行Fire単位のみ | 前chunk completion後のみ次PLAY。prefetch/TTS完了順とplayback順を分離 |
| final commit | 現行全文 transcript/fire.completed | 発話済みprefix watermark、全LLM完成本文、未発話suffix、terminal classificationを分離 |

自然な最小部品境界は、`Codex/App Server event adapter`、pure incremental sentence/tag buffer、pure NG boundary scanner、per-chunk TTS job（現行 `speak` の前半）、playback coordinator（現行 `sendSpeech→PLAY→completion`）、Fire-level commit reducerである。これはファイル分割や方式の決定ではない。

## Interrupt & failure matrix

| Event | 現行single responseへの作用 | queue化で守る invariant |
|---|---|---|
| kill while thinking | killed flag。LLMをcancelせず、completion後parseして`killDiscarded`; speak/transcript/expressionなし | active turn cancel可否に関係なく、kill generation以後のdelta/job/late completionはaudible/visible commit不可 |
| kill while speaking | sync STOP→best-effort mouth close→prefix+KILL note append→resolve→idle | queued/synthesizing/ready jobsを全clear。activeのみ一回sever。reviveでold queue復活禁止 |
| barge-in | speaking時だけ同じsever。thinking中はno-op | active playback停止とqueued clear範囲を明示。old ENDEDがnext jobを進めない |
| self-fire | scheduler busy gate + orchestrator busy gate。要求はqueueされずfired:false | Fire single-flightを維持するかは別判断。少なくとも一Fire内chunk queueとFire queueを混同しない |
| Control reply timeout | `speak` throw→Fire failed→idle。Runtime適用済みだがreply紛失の可能性あり | timeout retryで同じspeechを二重再生しない。request/job idempotencyが無い現状を前提にする |
| remote channel close | pending reject。lazy cached dead connectionは残り後続requestがtimeoutし得る | queue停止/clear、dead generation無効化、再接続後に未確定jobを自動再送するかは明示決定 |
| 4096 oversize | Runtime close、Soul `channel_closed`。PLAY前なのでSoul音声なし | oversize jobはterminal一回。別サイズchunkへの自動分割retryは重複適用可能性を考慮 |
| Aivis/TTS/WAV/timeline失敗 | PLAY前Fire failed。LLM assistant全文はsessionに残る | failed job以降を止める/skipする、既発話prefixをどうcommitするかをFire reducerが一元化 |
| audio child ERROR | Fireには伝播せずtimer後success/transcript | ERRORをjob failureに使うならtimerとのraceを一terminalに畳む。ERROR後next開始条件を固定 |
| audio STOPPED | barge/killの確認markerだがorchestrator不使用。外部STOPでもtimer継続 | STOP reason/ownerを相関。old STOPPEDでnew playbackを止めない |
| audio ENDED | isPlaying false/diagnosticのみ | job path/idで相関し、late/duplicate ENDEDを無視。next開始は一回 |
| session dispose | Codex ask中disposeのcancel保証なし。orchestrator disposeはplayback awaitだけ解放しplayer.stopしない | disposeはturn、pending TTS、queue、active audio、timelineを明示順で畳み、late callbackがcommitしない |
| conversation instruction change | revision更新のみ。次accepted Fireのask直前にsession置換 | Fire開始時にsettings snapshotを固定。in-flight delta/chunkは旧snapshot完走または一括cancel |
| brain/memory change | 現行はsession即dispose/null。in-flight意味論はsession実装任せ | accepted constraintへ合わせるならconversation revisionと同じnext-Fire boundaryが必要かuser/design判断 |
| audio device change | player即dispose、orchestrator timer/`currentPlayback`は残り得る | active jobへの作用を明示し、dispose済playerへのnext job送信・偽successを防ぐ |
| channel URL change | cached connectionを非同期close、次requestはnew URL | current jobがold/newどちらに属すかsnapshot。close由来late rejectionでnew generationをfailさせない |

共通 invariant 候補: `(fireGeneration, turnId, chunkIndex, ttsJobId, playbackId, channelGeneration)` の相関、generation単位clear、発話済みwatermark単調増加、active playback高々1、Runtime speech timeline高々1、terminal高々1、transcript append高々1、late completionは状態を進めない、retryはユーザーが既に聞いた範囲を再発話しない。

## Partial-success semantics

### 現行 observable から見た状態表

| Case | user heard | transcript/UI | LLM session | memory/digest | diagnostic terminal | self-fire turn-end | expression/timeline release | next Fire / retry |
|---|---|---|---|---|---|---|---|---|
| LLM ask failure | no | none | failed turnのみ。assistant全文なし | none | failed `llm.ask` | soul transcript無し。不応期はFire request側更新の場合あり | expression/timelineなし | idle後可 |
| TTS/timeline/channel failure before PLAY | no Soul audio | none | assistant全文あり | none | failed stage | soul発話実績なし | expressionは既に一部/全部適用し得る。speech timelineはchannel accepted前ならなし | idle後可。same threadは失敗assistantを既に知る |
| Runtime accepted, reply lost/timeout | audio PLAYなし（Soulはaccepted replyを待つ） | none | assistant全文あり | none | failed timeout/close | soul実績なし | Runtime timelineは既に動いた可能性。disconnectならrelease | retryでmouth timeline二重/置換、音声は初回鳴っていない |
| PLAY後 child ERROR | 不明/一部/無し | **現行はtimer後全文表示** | assistant全文あり |全文対象 | **現行completed** | soul実績として不応期更新 | timelineは自然寿命。audio errorで即releaseしない | 次Fire可。observableは成功に見える |
| natural timer completion | likelyだが物理観測なし |全文1件 | assistant全文あり |全文対象 | completed | soul実績、pending turn-end解除 | timeline terminal release | 次Fire可 |
| barge-in | prefixまで聞いたと推定 | prefix + 中断注記1件 | assistant全文あり |注記込みprefix対象 | Fire自体は`fired:true, interrupted:true`→completed | soul実績として不応期更新 | STOP + mouth set forced release | 次Fire可。全文再試行は重複発話 |
| kill during playback | prefixまで聞いたと推定 | prefix + kill注記1件 | assistant全文あり |注記込みprefix対象 | Fire completed扱いになり得る（sever後normal return） | soul実績あり | STOP + forced release | killed中不可、revive後可 |
| orchestrator dispose during playback |既に聞いた可能性 | none | assistant全文あり | none | fire result disposed。ただしdiagnostic active terminalはshutdown順依存 | soul実績なし | playerは後でdispose、mouth close requestなし |同orchestrator不可 |

### 後続 chunk 失敗の選択肢と帰結（推奨ではない）

| Classification option | transcript | memory | Fire/self-fire/diagnostics | retry consequence |
|---|---|---|---|---|
| A. Fire全体を failure | 発話済みprefixを表示するなら「failureだが音声済み」という新しい二重状態。表示しないならユーザー体験と正本が乖離 | prefixを含めるか別途決定 | terminal failed。self-fireが「喋った実績」を失うと不応期/turn-endが実音と不整合 | blind retryはprefix重複。suffix-only retryにはwatermark必要 |
| B. partial-success terminal | 発話済み文だけ + 中断/後続失敗注記が現行barge型に近い | 表示されたprefixがdigest対象 | `partial`という新terminal/stateが必要。self-fireは喋った実績として扱える | suffix retry/whole retry/無しを区別可能 |
| C. 発話済み分をsuccess、suffixをdrop | heard transcriptと一致しやすいが、LLM assistant全文との二重正本が残る | prefixのみ | completedだがdiagnosticにdropped suffixをcontent-free記録 | 後続内容が失われたことをUIが見せないと silent loss |
| D. failed chunkをskipし後続継続 | transcriptは非連続。文脈/表情tag対応が崩れる可能性 | 非連続speechのみ | Fireは最終的にsuccess/partialのどちらか要決定 | 順序保証とsemantic gapが大きい |

どの選択肢でも、LLM threadにはassistant完成全文が残る点は同じである。Soul transcript/memoryを「実際に声に出たもの」の正本に保つなら、完成assistant全文とspoken prefix/suffixを別フィールドとして扱う必要がある。本文をdiagnosticsへ保存しない既存方針も維持対象である。

## Diagnostics implications

- 現行 trace は Fire accepted、vision、LLM ask/full result、parse count、TTS query/synthesis、WAV/timeline、channel request bytes/reply、PLAY enqueue、child marker、terminalをcontent-freeで持つ（`apps/soul/agent/src/mind/fire-diagnostics.mjs:92-145`; `apps/soul/agent/scripts/cockpit.mjs:1022-1058`）。
- streamingでは Fire-levelに加え chunk/job/playback identity、queue depth、sentence boundary確定時刻、TTS enqueue/start/end、ready wait、playback marker、spoken watermark、clear reason、late completion ignored が無いと順序を復元できない。
- `first delta`、`first safe sentence`、`first TTS start`、`first PLAY enqueue/STARTED`を同一process monotonicで記録すれば、completion待ち削減を測れる。App Server notification自体にtimestampが無いので受信側時刻が必要（probeの既知制約）。
- terminal vocabulary は少なくとも completed/failed/partial/cancelled の採否をuser decisionに従って一意化する必要がある。chunk failureとFire terminalを混同しない。
- child markerはpathを持つが現行 diagnosticsはmarkerだけに落としている（`apps/soul/agent/scripts/cockpit.mjs:838-842`）。複数WAVを扱うqueueではpath/hashではなくprivacy-safe playback ID相関が必要。
- diagnostics writerはdropし得るため、log欠落を未実行証拠にしない。physical speaker onset/実際に聞いた量は引き続きhuman gate領域。

## Test inventory

### Existing mock/pure/integration seams

- Codex session fake SDK: same thread multi-turn、vision block→temp local image、turn failure/error、dispose/rollout cleanup（`apps/soul/agent/src/mind/codex-session.test.mjs:117-505`）。
- Fire orchestrator injected `session/speak/channel/player/clock/timer/capture`: parse/expression、busy、vision、TTS failure、natural completion、barge、kill、dispose、NG、transcript latency（`apps/soul/agent/src/mind/fire-orchestrator.test.mjs:127-2069`）。
- pure expression parser/property tests and pure mora timeline tests including 512 boundary（`apps/soul/agent/src/mind/expression-parser.mjs`; `apps/soul/agent/src/voice/mora-timeline.test.mjs:32-248`）。
- `speak` fake TTS/channel/player plus real local WS double: exact ordering、rejection、timeline overflow、content-free traces（`apps/soul/agent/src/voice/speak.test.mjs:66-248`）。
- audio player fake child protocol: STARTED/ENDED/STOPPED/isPlaying/device/dispose（`apps/soul/agent/src/voice/audio-player.test.mjs:60-196`）。
- channel client local WS double: request bytes/id、accepted/rejected、multi-mora、close-before-reply、timeout（`apps/soul/agent/src/channel/channel-client.test.mjs:22-357`）。
- Runtime pure dispatch/validation/overlay/speech evaluator and socket transport 4096/close reason tests（`apps/runtime-player/src/main/control-channel/channel-request-dispatch.test.ts:244-305`; `channel-intent-validation.test.ts:361-555`; `control-channel-overlay-store.test.ts`; `speech-timeline-state.test.ts`; `channel-websocket-connection.test.ts:13-97`）。
- Cockpit integration seams for conversation revision next-Fire replacement, brain in-flight switch, self-fire preferred vision, kill, memory, channel/audio settings（`apps/soul/agent/scripts/cockpit.test.mjs:992-1325`; `apps/soul/agent/src/cockpit/cockpit-server.test.mjs:917-3310`）。
- Passive diagnostics fixture success/failure and Runtime diagnostics bounded persistence（`apps/soul/agent/src/mind/fire-diagnostics.test.mjs`; `apps/runtime-player/src/main/control-channel/fire-diagnostics.test.ts:13-56`）。

### Additional likely tests (inventory, not implementation plan)

- pure incremental buffer: arbitrary delta segmentationで完成concat一致、第一safe sentence一回、`<tag>`/broken/unknown tagがdelta跨ぎでも発声しない、surrogate/UTF-8 boundary、終端flush。
- pure safety scanner: NG語がchunk境界を跨ぐ、NFKC前後、既発話後に命中した場合のchosen policy。
- queue reducer/model tests: out-of-order TTS completionでもplay順固定、active playback高々1、ENDED/ERROR/timer raceのterminal一回、kill/barge/dispose/setting change generation clear、late callback no-op。
- per-job adapter tests: audio_query/synthesis/timeline/temp write failure、channel accepted/rejected/timeout/close、PLAY throw、child ERROR/STOPPED/ENDEDをprivacy-safe IDで相関。
- Codex App Server adapter fake JSONL: initialize/thread/turn lifecycle、vision localImage、delta accumulation、agent item completed一致、turn failed、process exit、cancel/steer/dispose、same thread multi-Fire。
- Fire commit tests: chosen partial/failure semanticsについてtranscript一回、memory inclusion、self-fire refractory、expression release、next Fire/retry duplicate防止。
- Runtime integration: sequential small `intent.speech`がprior timelineを連続に置換するか、ENDED以前にnext acceptedしない、disconnect/reconnect generation、各requestが4096以下/4097 closeを独立に扱う。
- human gate: real vision mandatory Fireで第一文がcompletion前に聞こえる、文順/タグ非発声/口同期、長文、barge/kill、Aivis failure、Control Channel close、設定変更中Fire、physical audioとtranscript/terminal整合。実器実行は本inventoryではしていない。

## Risks

- 現行 parserは全文前提。単純な句点splitは未閉じangle tag、NG語跨ぎ、tag position/expression timingを壊す。
- Runtime speech storeは一つで後着置換。next timelineを前audio終了前にacceptedさせると口だけ次文へ進み得る。
- STARTEDはchild受理、ENDEDはMediaPlayer session観測で、physical audioとのずれは残る。timerからENDEDへ切替えても実音保証にはならない。
- reply loss after Runtime applyはat-least-once retryの重複問題を持つ。現protocolにidempotency/replay queryはない。
- persistent Codex threadのassistant全文とspoken transcriptが乖離する。次FireはSDK thread historyと注入transcriptを両方受ける現行構造なので、partial後の会話文脈を明文化しないと二重/矛盾し得る。
- expressionは現行speechと独立。後続speech chunk失敗時も全文由来expressionが先に適用済みになり得る。
- temp WAV cleanupが無く、chunk数増加はファイル数増加を直接拡大する。
- diagnostics active contextはsingle-flight Fire前提。chunk並列化でactive globalだけでは相関不能。

### 4096 byte inference（repository factと分離）

Repository factは「一 text frameのpayloadが4096 bytesまで」「現行 speech envelope全体を一frame送信」「timeline最大512」の三点だけである。

推論として、文単位chunkは通常 timeline countとserialized bytesを小さくし、現行長文一括よりcapへ当たりにくくする可能性が高い。一方、短い文でも読み/句読点/Aivis mora列/JSON数値桁によりbytesは変わり、4096以下は保証されない。またrequest数増加により、close/reply timeout/reconnect raceの試行回数は増える。従ってchunk化はcap変更の代替保証でも、cap撤廃の根拠でもない。各実envelopeのUTF-8 bytes計測とpreflight/失敗意味論は別論点である。

## Unknowns

- App Server delta replacement/retry、tool item、turn steer/cancel、process restart、長文/複数画像時の完全concat規則はprobe未確認。
- App Server化後のthread deletion/metadata cleanupはprobeでDB errorがあり未解決。
- AivisSpeechが複数 `/audio_query`/`synthesis`を並列処理した際の順序、負荷、音声連結の知覚gapは未測定。
- MediaPlayer `ENDED`の精度、device buffer、physical onset/endとの差は未測定。
- Runtime accepted reply喪失時に、Soulが適用済みか安全に照会するprotocolは無い。
- current brain/memory/audio/channel setting changeをaccepted constraint「次Fire適用」へ統一するかは未決。conversation instructionだけは既にnext-Fire seamを持つ。
- partial後にCodex threadへ全文assistantを残す/turn cancelでprefixだけにする/次Fireで補正注入する、のどれを採るか未決。

## Questions only user can decide

1. 一文以上を実際に聞いた後で後続chunkが失敗したFireを、UI/diagnostics上 `partial-success` とするか、Fire全体 `failure` とするか。聞いたprefixをtranscript/memoryへ残すか。
2. partial時のretryは「自動なし」「未発話suffixだけ」「全文を明示操作で再発話」のどれか。既発話重複を許すか。
3. LLM assistant完成全文と実発話prefixが異なるとき、次Fireの会話上の正本をどちらに置くか。
4. 後続chunkのNG/安全失敗が、既に話した安全文をどう分類するか。既発話を取り消せないことをUIでどう示すか。
5. chunk間の自然な間を、audio `ENDED`基準、WAV尺timer、または別の許容gapのどれで判断するか。physical音声のhuman gate許容は何か。
6. expression tagを「そのtagより前/後の文」「Fire全体」のどこへ所属させ、後続chunk失敗時に残す/解除するか。
7. brain/memory/audio device/channel URL変更もconversation instruction同様に進行中Fireを固定し次Fire適用へ統一するか。
8. 4096 byte上限は本streaming waveで触らず観測だけ続けるか、別設計課題として同時に扱うか。上限値自体の変更は本inventoryからは決められない。

## Read-only investigation record

- `Get-Content -Raw -Encoding UTF8` で `discussion/_conventions.md`, `discussion/_map.md` と指定basis 3件を確認。
- `rg --files` と `rg -n` で Fire/Codex/TTS/audio/channel/Runtime/memory/settings/self-fire/diagnostics の実装・test seamを特定。
- `Get-Content ... | Select-Object -Skip/-First` で上記 path:line 範囲を行番号付き読取。
- `Test-Path` と `git status --short -- <owned file>` で出力先が新規かつ所有範囲外を変更しないことを確認。
- 外部サービス turn、AivisSpeech実合成、Runtime実器、実speakerは実行していない。製品コード・設定・map・他レポートは変更していない。
