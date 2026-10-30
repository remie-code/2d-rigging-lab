# 操縦席の組み立ての地図: 配信の組み直しの前に(Sylph 2026-10-31)

> 種別: リポジトリの事実の調査(読み取りのみ)。設計・決定ではない。候補は並べるだけで、選ばない。
> 対象: `apps/soul/agent`(コミット 8e0c1d6a)。前の調査は c113f3d5 の時点。その後に `apps/soul/agent` に入ったのは probe のスクリプトだけ(154915e5)なので、前の調査の行番号もそのまま使える。
> 前提の調査: [layer-classification-2026-10.md](layer-classification-2026-10.md)(以下「仕分け」)、[soul-inventory-2026-10.md](soul-inventory-2026-10.md)(以下「棚卸し」)、[cockpit-today-2026-10.md](cockpit-today-2026-10.md)(以下「操縦席の今」)。そこに書いた事実は繰り返さず、§ を指すだけにした。
> この調査は、仕分け §6 の未確認のことのうち 3 つに答える。「`cockpit-server.mjs` の中で、芯の組み立てと画面の API がどこで分かれるか」「画面の部品の仕分け」「観測の記録が 1 人の発言をどこまで前提にしているか」。
> `.env*`、`cockpit-settings.local.json`(と .bak)、`memories/` は開いていない。
> 【推測】と書いたもの以外は、コードで確かめた。パスは断りがなければ `apps/soul/agent/` から見た相対パス。
> 語彙: 体験 / ロール / 場 / 芯(考える・思い出す・声の運び・2 段の判定)/ 入口・出口(耳・目・YouTube・声の出力先・器)。ほかに「設定」「観測」「資源」「画面」を使う。

## 1. 要点

- **`scripts/cockpit.mjs` は 2 つの部分に分かれる。** 上の 1〜1531 行は、副作用の無い export が並ぶだけ(設定の橋渡しの hook・遅延接続の器・声の engine の持ち主・記録の係・ログの 1 行の整形)。下の `main()`(1533〜2351 行)は 1 つの閉包で、そこが組み立ての本体になる。`main()` の中は「設定の hook → 頭・声・器の遅延生成 → 記憶 → 発火の工場 → `createCockpitServer(...)` に 50 個ほどの口を渡す → listen → shutdown」の順に並ぶ。
- **`cockpit-server.mjs` は、1 つの関数 `createCockpitServer`(638〜3198 行)の中で、すべての組み立てが済む。** 区切りのコメント(`// ── … ──`)で 10 個の塊に分かれる。状態・snapshot・SSE・耳の寿命・HTTP の経路・発火の結線・判定 3 つ・思い出しの係・YouTube の合流・寿命。芯の結線(2185〜2680 行)と画面の API(1554〜2184 行)は、行としてはもう分かれている。ただし同じ閉包の変数(`pipeline`・`killed`・`fireScheduler` など)を共有している。
- **「場」に当たる始まりと終わりは、3 つの時刻に散っている。** 起動のとき(記録の名前・観測のファイル・キルの初期値)、耳の Start / Stop のとき(会話の正本・目・声の用意・記憶の引き金)、別々の操作のとき(YouTube の Connect、最初の発火で頭と器)。耳の Stop で畳まれないものも多い。頭のセッション・器・YouTube・キル・判定の積み残しは残る(§3)。
- **器の無いときの止め口は 4 段ある。** (1) 頭のセッションの代理(`createSessionProxy`)が URL を確かめる。(2) 発火の資源をそろえる関数(`acquireAcceptedFireResources`)が URL を確かめる。(3) 遅延接続の器(`createLazyChannel.ensure`)が URL の無いことを断る。(4) 運び手の `activate` が `openSpeech` の `accepted` を待つ。一方で、割り込みの「どこまで声に出たか」は、運び手が自分で持つ時間割と、プレイヤーの STARTED だけで決まる。器には頼っていない(§4)。
- **画面の部品のうち、配信だけのものは少ない。** コメント欄、コメント反応・弾いた札、YouTube の接続、忙しい間のコメント、「配信者」「配信前」の語。会話タイムライン・遅延の棒・観測フィード・健康・KILL・設定ダイアログの骨組みは、言葉を替えれば他の体験でも使えそうに見える【推測】。ロールに当たる部品は、会話指示の編集・名前の表示・頭脳の選択(§5)。
- **観測の記録には、名前もロールも無い。あるのは頭の id(`brain`)だけ。** `session-usage-log.mjs` の 3 種類の行は、どれも `brain`(例 `claude`・codex 系の id)を持つ。名前・話者は持たない。`fire-latency.mjs` は頭を知らない(頭は `cockpit-server.mjs` が足す)。`fire-diagnostics.mjs` は頭を持たない。「文字起こし」の区間は、耳 1 本の `seq` で引いている(§6)。

## 2. 組み立ての地図(問い 1)

### 2.1 `scripts/cockpit.mjs`(2361 行)

#### 2.1.1 上の部分: export の部品(1〜1531)

「依存」は、その部品が他の塊の何を受け取るか。

| 行 | 名前 | 責務 | 語彙 | 依存 |
|---|---|---|---|---|
| 1-45 | ヘッダ | 遅延生成・器の遅延接続・URL の記憶の方針の説明 | — | — |
| 47-87 | import | — | — | — |
| 89-103 | `MEMORY_CHECKPOINT_INTERVAL_MS`(20 分)・`SHUTDOWN_MEMORY_TIMEOUT_MS`(90 秒) | 記憶の定期保存と、終わりの待ちの上限 | 芯(思い出す)・場の終わり | — |
| 105-127 | `buildBrainSessionSystemPrompt` | 名前 + 会話指示 + 教えで、頭の固定の指示を組む(テスト用の純関数。本番は 1752-1755 で同じことをする) | ロール + 芯 | `brains.mjs`・`fire-orchestrator.mjs`・`soul-skills.mjs` |
| 129-160 | `parseCockpitArgs` | 起動引数(port / open / channel / tts-base-url / speaker / fire-window-min / fire-max-chars) | 起動 | — |
| 161-178 | `openCockpitBrowser` | `--open` でブラウザを開く | 起動 | — |
| 179-351 | `createLazyChannel` | 器への遅延接続。初回の送信で接続し、成功をキャッシュする。URL が無ければ `ensure()` が断る(210-216)。`openSpeech/appendSpeech/endSpeech/sendEnvelope/sendSet` を中継する | 出口(器) | `channel-client.mjs` の `connectChannel` |
| 353-380 | `createSessionProxy` | 頭の `ask` の代理。URL が無ければ投げる(373-375)。そのあと頭を遅延生成する | 芯(頭のセッション)+ 器のゲート | 器の URL・`ensureFireResources` |
| 382-412 | `createInstructionRevisionController` | 会話指示の版の番号(古いセッションを次の発火で作り直す合図) | ロール | — |
| 414-460 | `createConversationInstructionHooks` | 会話指示の読み書き(頭の id ごと) | ロール | 設定 |
| 461-491 | `createVisionTargetHooks` | 見る窓の設定 | 設定・目 | 設定 |
| 492-521 | `createAudioDeviceHooks` | 声の出力デバイスの設定 | 設定・声の出口 | 設定 |
| 522-554 | `createSelfFireHooks` | 自発の ON/OFF(既定 OFF) | 設定・1 段目 | 設定 |
| 555-581 | `createBargeInHooks` | かぶりの ON/OFF(既定 ON) | 設定・1 段目かロール | 設定 |
| 582-593 | `shouldSkipMemoryCheckpoint` | 転写が増えていなければ保存しない | 芯(思い出す) | — |
| 594-628 | `resolveWriterBrainDef` | 書き出し役・思い出し役の頭(頭が Claude なら Codex) | 芯(思い出す) | `brains.mjs` |
| 629-710 | `createMemoryRecorder` | 保存の係(直列・記録中の表示) | 芯(思い出す) | 転写の取り口・書き手 |
| 711-719 | `isMcpConfigReadFailureWarning` | 頭の警告の見分け | 芯(頭) | — |
| 720-742 | `formatRecallEventLine` | 思い出しの係のターミナル 1 行 | 観測 | — |
| 743-763 | `raceMemoryRecordWithTimeout` | 終わりの保存の打ち切り | 場の終わり | — |
| 764-807 | `createVerbosityHooks` | 口数モード | 設定・ロールか操作 | 設定 |
| 808-838 | `createBrainHooks` | 頭の選択 | 設定・芯(頭)= 今はロールも | 設定 |
| 839-868 | `createChatSourceHooks` | YouTube の配信 URL の記憶 | 設定・YouTube | 設定 |
| 869-903 | `createSttEngineHooks` | 文字起こしの方式 | 設定・耳 | 設定 |
| 904-935 | `createTtsEngineHooks` | 声の方式 | 設定・声 | 設定 |
| 936-955 | `voiceDiagnosticReason` | 声の engine の切断理由を短くする | 観測(声) | — |
| 957-1132 | `createVoiceEngineManager` | 声の engine の持ち主。`prepare(kind)` で、種類が変われば作り直す。ElevenLabs のキーを読む | 芯(文→声) | `voice-engine.mjs`・キーの読み口 |
| 1133-1184 | `formatSttLatencyLine`・`formatCaptureEventLine` | 文字起こしの遅延・画面キャプチャのターミナル 1 行 | 観測 | — |
| 1185-1225 | `createSpeakStartHooks` | 話し始めの方式(従来 / speak-now)・相槌の間隔 | 設定・判定 | 設定 |
| 1226-1263 | `createCommentBusyHooks` | 忙しい間のコメントの扱い・取り置きの鮮度と件数 | 設定・YouTube の判定 | 設定 |
| 1264-1315 | `formatCommentJudgmentLine`・`fmtProb`・`formatSpeakNowLine` | 判定のターミナル 1 行 | 観測 | — |
| 1316-1341 | `isCodexBrainId`・`createCodexQuotaReader` | Codex の頭か・Codex の残量 | 芯(頭)・資源 | 頭のセッション |
| 1342-1357 | `resolveLatencyThresholdsFromSettings` | 遅延の棒のしきい値 | 観測 | 設定 |
| 1358-1403 | `resolveContextCompactionOptions`・`createContextCompactionHooks` | 頭の会話の圧縮の目安 | 芯(頭) | 設定・compactor |
| 1404-1472 | `resolveCodexServiceTier`・`createCodexFastHooks` | Codex の fast | 芯(頭) | 設定 |
| 1473-1518 | `contextCompactionUsageRecord`・`formatContextCompactionLine`・`formatReplyLatencyLine` | 圧縮と遅延の記録の 1 行 | 観測 | `session-usage-log.mjs` |
| 1519-1531 | `HELP` | 使い方の文 | 起動 | — |

#### 2.1.2 下の部分: `main()`(1533〜2351)

| 行 | 塊 | 責務 | 語彙 | 他の塊への依存 |
|---|---|---|---|---|
| 1534-1547 | 起動 | 引数を読む。前回の Codex の記録を掃除する(`sweepCodexRollouts`) | 起動・芯(頭の後片付け) | — |
| 1548-1577 | 設定の読み書き | ファイルの設定(`createFileSettingsStore`)と、上の hook 12 個を作る。初期値を設定から戻す | 設定 | 2.1.1 の hook |
| 1579-1605 | 頭・声の入れ物 | `session`・`player` の `let`、版の番号、`desiredTtsEngine`、`voiceEngines`(声の engine の持ち主) | 芯(頭・声) | 声の状態を `server` へ(前方参照) |
| 1606-1624 | 頭 = ロールの引き口 | `server` の前方参照。`currentBrain`。会話指示の hook。`getCurrentBrainIdentity`(名前の唯一の引き口・1624) | ロール + 芯(頭) | 設定 |
| 1626-1646 | 記憶の用意 | 記憶のフォルダの準備。**今回の記録の名前をここで 1 回だけ決める**(`createStreamRecordIdentity`・1635)。警告の口。最後に記録した時刻と `seq` | 芯(思い出す)・場の始まり(= 起動) | `server`(警告) |
| 1648-1653 | 器の URL・診断 | 初期 URL(`--channel` > 設定 > 無し)、版の番号、`createFireDiagnostics` | 出口(器)・観測 | 設定 |
| 1654-1687 | 頭の文脈の記録・圧縮 | `createSessionUsageLog`(起動ごとに 1 ファイル・1656)。`createContextCompactor`。隙間の材料は `server.getQuietGap()` | 観測・芯(頭) | `session`・`server` |
| 1688-1693 | 残量 | `createQuotaMonitor`(Codex・ElevenLabs) | 資源 | `currentBrain`・`session` |
| 1694-1699 | 目 | `createResidentCapture`(常駐の撮る係) | 入口(目) | — |
| 1700-1706 | 器 | `createLazyChannel(initialUrl)`。`--channel` があれば設定にも書く | 出口(器) | 診断 |
| 1708-1713 | 会話の窓 | `--fire-window-min` / `--fire-max-chars` | 芯 | 引数 |
| 1715-1775 | 頭のセッションの遅延生成 | `ensureFireResources`: `BRAINS[currentBrain].create({ systemPrompt: 名前 + 会話指示 + 教え, … })`。最後に `ensureVoiceResources()` | 芯(頭)+ ロール(指示) | 頭・会話指示・残量・fast・`server` |
| 1777-1808 | 声の出口 | `ensureVoiceResources`: プレイヤー(`createStreamPlayer({deviceName})`)を作る。落ちていたら作り直す。`voiceEngines.ensure` | 出口(声の出力先)+ 芯(文→声) | 出力デバイスの設定・診断 |
| 1810-1844 | 次の発火の境目での反映 | `applyDesiredFireSettings`: 器の URL を差し替える。デバイスが変わったらプレイヤーを捨てる。古い頭のセッションを畳む | 器・声・頭 | 上の 3 つ |
| 1846-1879 | 代理 | `sessionProxy`(URL のゲート)・`playerProxy` | 芯(頭・声) | 器の URL |
| 1880-1919 | 発火の資源をそろえる | `acquireAcceptedFireResources`: **URL が無ければ投げる**(1886-1888)。session / channel / player / engine と、設定・版の番号の凍結 snapshot を返す | 芯(発火)+ 器のゲート | 上のすべて |
| 1921-1937 | 声の出力先の変更 | `onSetAudioDevice`(版の番号を進める) | 出口(声) | 設定 |
| 1939-1954 | 頭の変更 | `onSetBrain`: 選択を保存し、`currentBrain` と版の番号を進める | 芯(頭)= 今はロールも | 残量 |
| 1956-1973 | fast・頭の状態 | `onSetCodexFastMode`・`brainStatus`(資格ファイルの有無だけ) | 芯(頭)・資源 | — |
| 1975-2042 | 記憶の保存と思い出し | `memoryRecorder`(書き手 = `writeStreamRecord`・記録の名前は 1635 のもの)。引き金 ① 20 分ごと(2007-2012)② 手動(2015)③ 耳の Stop(2021-2024)。思い出しの実行(`recallRunner`・2031-2039) | 芯(思い出す)・場の終わり | `server.getTranscript()`・`currentBrain` |
| 2044-2105 | 発火の工場 | `fireOrchestratorFactory`: `createFireOrchestrator` に、server からの hook と、本番の session / channel / player の代理、資源をそろえる関数、目、診断・記録を渡す | 芯(考える・声の運び) | 上のほぼ全部 |
| 2107-2129 | 器の URL の変更と状態 | `onSetChannelUrl`・`channelStatus` | 出口(器) | 設定 |
| 2131-2134 | 先に頭を作る | `--channel` のときだけ、起動時に頭を作る | 芯(頭) | — |
| 2136-2250 | 操縦席サーバの組み立て | `createCockpitServer({...})` に 50 個ほどの口を渡す(画面の状態・設定の書き口・耳の hook・判定の初期値・記憶・思い出し・観測) | 画面 + 全部の結線 | 上の全部 |
| 2252-2273 | 待ち受けの開始 | `listen` → `quotaMonitor.start` → `contextCompactor.start` → 案内の文 | 起動 | `server` |
| 2275-2349 | 終わり | `shutdown`(§3.3)。SIGINT と stdin の EOF | 場の終わり・終了 | 全部 |
| 2350 | `--open` | ブラウザを開く | 起動 | — |
| 2353-2361 | 直接起動 | `main()` を呼ぶ | 起動 | — |

### 2.2 `src/cockpit/cockpit-server.mjs`(3318 行)

#### 2.2.1 関数の外(1〜637・3200〜3318)

| 行 | 名前 | 責務 | 語彙 |
|---|---|---|---|
| 1-68 | ヘッダ | SSE の選択・正本はプロセス側・127.0.0.1 に限る・後片付け・思い出しの流れ | — |
| 69-113 | import | 耳・目(窓の一覧)・声(デバイスの一覧)・割り込み・発火の予定・speak-now・判定エンジン・コメントの 2 つの判定・思い出しの係・遅延・警告・名前 | — |
| 115-157 | 定数 | host / port(8181)/ 転写の履歴(200)/ `TTS_ENGINES` / 声の状態 / UI の静的配信の置き場 | 画面 |
| 159-168 | `assertLoopbackHost` | 外に開かない | 画面 |
| 170-186 | `PLACEHOLDER_HTML` | ページが無いときの代わり | 画面 |
| 188-328 | `parseDshowDeviceList`・`enumerateDevices` | マイクの一覧(ffmpeg の dshow) | 入口(耳) |
| 329-342 | `createInMemorySettingsStore` | メモリだけの設定(テストの既定) | 設定 |
| 343-637 | JSDoc | `createCockpitServer` の口の説明 | — |
| 3200-3318 | HTTP の小道具 | `sendJson` / `sendText` / `readJsonBody(Strict)` / `scrubCommentText` / `errMessage` | 画面 |

#### 2.2.2 `createCockpitServer` の中(638〜3198)

| 行 | 塊 | 責務 | 語彙 | 他の塊への依存 |
|---|---|---|---|---|
| 638-805 | 口の取り込み | 注入を受ける。耳の工場(`pipelineFactory`・644)、設定、器・目・声の出力先・自発・かぶり・口数・頭・会話指示(681)、名前の取り口(679-680)、YouTube の工場、文字起こし(697-)、声(713-)、耳の hook 3 つ(723-728)、**判定エンジン 3 つ**(speak-now 742・コメントを弾く 758・コメントに反応 764・思い出しの「避けるか」786)、思い出しの実行(785)、残量(797)、遅延 | 画面 + 結線 | cockpit.mjs |
| 806-903 | 閉包の状態 | `sseClients`。**耳 1 本 `pipeline`(809)**・`earsState`・`currentDevice`。**キル `killed`(822)**。割り込み・発火の予定・speak-now・コメント反応・思い出しの係の入れ物(830-845)。弾く判定の待ち行列。`fireInFlight`(855)。**`userSpeaking`(863)**。YouTube の器官(871)。`sttLatencyBySeq`(881)。警告の板(884)。健康(893) | 場(1 回分の状態)+ 芯 | — |
| 904-1098 | 状態の snapshot・警告 | `toWireEntry`・`snapshot()`(名前は 919-942 で `identity` として足す)・圧縮中・残量・警告の決め直し・判定のエラーの警告 | 画面 | ほぼ全部の状態 |
| 1099-1122 | SSE | `broadcast`・`broadcastState` | 画面 | `sseClients` |
| 1123-1186 | 健康 | `setHealth`・`handleDiagnostic` | 観測 | 警告 |
| 1187-1506 | 耳の寿命 | `startEars`(1195-1468)・`stopEars`(1471-1506)。§3 | 入口(耳)+ 場 | 判定・発火の予定・割り込み・声の用意・記憶の hook |
| 1508-1553 | 会話指示・教えの応答 | `conversationInstructionResponse`・`readSoulSkills` | ロール | 会話指示の hook |
| 1554-1565 | HTTP サーバ | `createServer` | 画面 | — |
| 1566-2097 | 経路 | `handleRequest`。会話指示 `/api/conversation-instructions/:id`(1575-1635)。`/`(1636)・`/api/devices`(1640)・`/api/state`(1650)・`/api/events`(1654)・`/api/ears/start`(1658)・`/api/ears/stop`(1684)・`/api/fire`(1698)・`/api/windows`(1712)・`/api/vision-target`(1723)・`/api/vision-fire`(1739)・`/api/audio-devices`(1754)・`/api/audio-device`(1765)・`/api/self-fire`(1781)・`/api/barge-in`(1802)・`/api/verbosity`(1823)・`/api/speak-start`(1850)・`/api/comment-busy`(1875)・`/api/kill`(1902)・`/api/brain`(1933)・`/api/channel`(1968)・`/api/chat/connect`(1984)・`/api/chat/disconnect`(2011)・`/api/compact-threshold`(2018)・`/api/codex-fast`(2040)・`/api/memory-record`(2062) | 画面の API | 下の各塊を直接呼ぶ |
| 2098-2184 | 静的配信 | `tryServeUiAsset`・`serveIndex`・`openSse`・`resolveLastDevice` | 画面 | — |
| 2185-2305 | 発火の結線 | `broadcastSoulTranscript`・`broadcastReplyLatency`(遅延に「文字起こし」と「判定」を足す)。`fireOrchestratorFactory` に `getBuffer: () => pipeline?.transcriptBuffer`(2263)と、状態 → 判定・係への「手が空いた」(2264-2276)・思い出しの目印(2297-2299)・`initialKilled`(2303)を渡す | 芯(考える) | 耳(正本)・判定・思い出しの係 |
| 2307-2324 | 割り込み | `createBargeInGate`(発火の工場が `interrupt` を持つときだけ) | 芯(1 段目寄りの機械の信号) | 発火 |
| 2326-2381 | 従来の発火の予定 | `createFireScheduler`。名前の揺れは名前の取り口から(2359-2370)。きっかけを `requestSelfFire` へ | 判定(従来) | 発火・名前 |
| 2383-2451 | speak-now | `createSpeakNowController`。`isActive` = speak-now モード && 自発 ON && キルでない(2398-2399) | 2 段の判定(2 段目) | 耳(正本)・発火・予定・キル・名前 |
| 2453-2509 | コメント反応 | `createCommentReactController`(`isActive` も同じ式・2464-2465) | 2 段目の判定(YouTube) | 同上 |
| 2512-2563 | 思い出しの係 | `createRecallDesk`(キル・自発で振る舞いを変える) | 芯(思い出す) | 耳(正本)・発火・キル・予定 |
| 2565-2627 | 自発の発火 | `requestSelfFire`・`trackFire`(`fireInFlight` を数え、係に「手が空いた」を知らせる) | 芯(発火) | 発火・判定・係 |
| 2629-2640 | 残量の購読 | 変わったら SSE と警告 | 資源・画面 | 残量 |
| 2642-2680 | 判定の小道具 | `applySpeakStartMode`・`currentSoulName`(判定の名前・2655-2660)・`reportSpeakNow`・`reportComment` | 判定・ロール(名前) | 名前の取り口 |
| 2682-2952 | YouTube の合流 | `ingestChatMessage`(**耳が止まっていれば積まない**・2725)・弾く判定(`settleGuard`/`rejectComment`/`commitComment`・2824)・状態と診断の SSE・`foldChatClient`(2894)・`connectChat`(2925) | 入口(YouTube)・体験(配信) | 耳(正本)・発火の予定・コメント反応 |
| 2953-3198 | 寿命と内部 API | `listen`・`url`・`earsStatus`・`fireState`・`getQuietGap`(圧縮の隙間)・`setVoiceEngineStatus`・警告の口 3 つ・圧縮の放送・`setSelfFireEnabled`・`getTranscript`(3107)・YouTube の取り付け口・`close`(3119-3197・§3.3) | 起動・終わり・観測 | 全部 |

### 2.3 依存の形(要約)

- cockpit.mjs の `main()` が、頭・声・器・記憶・観測・残量・目を持つ。そして `createCockpitServer` に「取り口(関数)」として渡す。server が持つのは、耳・キル・判定 3 つ・思い出しの係・発火の予定・割り込み・YouTube の器官・画面の状態。
- 両方向の前方参照がある。cockpit.mjs は `server?.…`(1603-1604、1640、1671、1675、1764、1837、1980、2002、2008)を呼ぶ。server は cockpit.mjs の hook を呼ぶ。`let server`(1610)の前方参照で成り立っている。
- 会話の正本(`pipeline.transcriptBuffer`)を見る場所: server の中の 7 か所(snapshot 960 付近・2208・2263・2396・2462・2526・2725/2824・3107)。cockpit.mjs は `server.getTranscript()` を通して見る(1980、2008、2293)。

## 3. 場の始まりと終わりの実体(問い 2)

### 3.1 耳の Start(呼ぶ順)

1. 画面 → `POST /api/ears/start`(`cockpit-server.mjs:1658`)。`transitioning` で同時の操作を断る。sttEngine / ttsEngine を確かめる。
2. `startEars(device, stt, tts)`(`:1195`)。
   1. もう動いていれば何もしない(`:1196-1198`)。
   2. マイク名を保存する(`settings.setLastDevice`・`:1203`)。文字起こしの方式を保存する(`onSetSttEngine` → `cockpit.mjs:2193`)。声の方式を保存する(`onSetTtsEngine` → `cockpit.mjs:2201`)。
   3. 健康を「Starting」にして放送する(`:1229-1238`)。
   4. ElevenLabs のキーを確かめる(`:1242-1261`)。ローカルの文字起こしのモデルを確かめる(`:1267-1292`)。
   5. **声の engine の用意**: `onPrepareVoiceEngine(kind)` → `cockpit.mjs:2202-2205` → `voiceEngines.prepare(kind)`。失敗すれば Start も失敗する(`:1296-1316`)。
   6. **耳(と会話の正本)を作る**: `pipelineFactory({...})`(`:1331`)。whisper の名前の手がかりは名前の取り口から(`:1325-1329`)。VAD → `userSpeaking`・割り込み・発火の予定(`:1355-1374`)。転写 → 発火の予定・speak-now・画面(`:1375-1412`)。
   7. 破棄の購読(`:1417`)→ `pipeline = p`(`:1428`)→ `await p.start()`(`:1430`)。
   8. `earsState = "listening"`、健康を up にして放送する(`:1453-1465`)。
   9. `onEarsStarted` → `cockpit.mjs:2208-2217`: **目の常駐を起こす**(`residentCapture.start`)→ **声のプレイヤーと engine を用意する**(`ensureVoiceResources`・`:1783`)。
- Start で**起きないこと**: 頭のセッションは作らない(最初の発火か `--channel` のときだけ・`cockpit.mjs:1723`、`:2131-2134`)。器にはつながない(最初の発火の `openSpeech` で・`:210-235`)。YouTube はつながない(別の Connect・`cockpit-server.mjs:2925`)。自発は ON にしない(別のつまみ)。キルは戻さない。記録の名前は作り直さない(起動時に決まる・`cockpit.mjs:1635`)。観測のファイルも同じ(`:1656`)。

### 3.2 耳の Stop(呼ぶ順)

1. 画面 → `POST /api/ears/stop`(`cockpit-server.mjs:1684`)→ `stopEars()`(`:1471`)。
2. `onEarsStopped` → `cockpit.mjs:2218` → **目の常駐を止める**(`residentCapture.stop`)。この呼び出しは、耳を畳むより前に来る(`:1472`)。
3. 耳が無ければ、ここで終わる(`:1473-1476`)。
4. `onEarsStopping(p.transcriptBuffer.all())` → `cockpit.mjs:2021-2024`。前の保存から増えていれば `memoryRecorder.record(transcript)`。**待たない**。
5. `pipeline = null` → 破棄の購読を外す → `await p.dispose()`(`:1486-1495`)。**会話の正本はここで消える。**
6. `earsState = "stopped"`、健康を unknown にして放送する(`:1496-1505`)。
- Stop で**畳まれないもの**: 頭のセッション、声のプレイヤーと engine、器の接続、YouTube の器官(つながったまま。でもコメントは積まれない・`:2725`、`:2824`)、キルの状態、自発の ON/OFF、発火の予定・speak-now・コメント反応・思い出しの係の中身(積み残しを捨てる呼び出しは無い)、記録の名前、観測のファイル。
- 耳が無いと、発火は `ears-not-running` で断られる(`fire-orchestrator.mjs:1784-1788`)。

### 3.3 Ctrl+C(または stdin の EOF)

`cockpit.mjs:2278` `shutdown`:

1. 2 回目なら、記録の待ちを打ち切るだけ(`:2279-2285`)。
2. `contextCompactor.dispose()`(`:2288`)。
3. **転写の写しを先に取る**: `server.getTranscript()`(`:2293`)。増えていなければ空にする(`:2294`)。close のあとでは、もう取れないため(コメント `:2289-2291`)。
4. `await server.close()`(`:2296` → `cockpit-server.mjs:3119-3197`)。順に、YouTube の器官を畳む(`foldChatClient`)→ 割り込みの dispose → 発火の予定の dispose → speak-now・コメント反応・思い出しの係の dispose → 弾く判定の待ち行列を捨てる → 警告の板 → 残量の購読を外す → **`fireOrchestrator.dispose()`** → SSE を全部閉じる → 破棄の購読を外す → **耳を dispose する** → `onEarsStopped`(目を止める)→ HTTP を閉じる。**`onEarsStopping` は呼ばれない**(記憶は手順 3 の写しを使う)。
5. 記憶の最後の保存: `memoryRecorder.record(finalMemoryEntries)` と `whenIdle()`。最大 90 秒(`:2301-2313`)。
6. 頭のセッションの dispose(`:2315-2321`)→ プレイヤーの dispose(`:2322-2328`)→ `voiceEngines.dispose()`(`:2329`)→ `lazyChannel.close()`(`:2330-2336`)。
7. `finally`: 目を止める(冪等)→ `quotaMonitor.stop()` → `sessionUsageLog.flush()`(最大 1 秒)→ `process.exit(0)`(`:2337-2344`)。
- 20 分ごとの保存のタイマー(`:2007`)は `unref()` しているだけで、`clearInterval` は無い。`process.exit` で終わる。`fireDiagnostics` に畳む呼び出しは無い(発火ごとに 1 ファイル・`fire-diagnostics.mjs:121-126`)。

### 3.4 「配信を始める / 終える」に束ねるときの候補(決めない)

今の「始まり」は 3 つの時刻に散っている。

| もの | 今の始まり | 今の終わり | 場所 |
|---|---|---|---|
| 記録の名前(記憶の本体のファイル) | 起動 | 終了 | `cockpit.mjs:1629-1635` |
| 頭の文脈の記録のファイル | 起動 | 終了 | `cockpit.mjs:1656`、`session-usage-log.mjs:139-144` |
| キル | 起動(false) | — | `cockpit-server.mjs:822` |
| 会話の正本・耳 | 耳の Start | 耳の Stop / 終了 | `cockpit-server.mjs:1331`、`:1486-1495` |
| 目の常駐 | 耳の Start | 耳の Stop / 終了 | `cockpit.mjs:2208-2218` |
| 声のプレイヤー・engine | 耳の Start(または最初の発火) | 終了だけ | `cockpit.mjs:1783-1808`、`:2322-2329` |
| 頭のセッション | 最初の発火(または `--channel` で起動) | 終了だけ(頭の変更でも作り直す) | `cockpit.mjs:1723-1775`、`:2315-2321` |
| 器の接続 | 最初の発火 | 終了だけ | `cockpit.mjs:210-235`、`:2330-2336` |
| YouTube | Connect | Disconnect / 終了 | `cockpit-server.mjs:2925`、`:2894` |
| 自発の ON/OFF | つまみ(設定に保存・次の起動にも残る) | — | `cockpit.mjs:1555` |
| 記憶の保存 | — | 20 分ごと・手動・耳の Stop・終了 | `cockpit.mjs:2007-2024`、`:2289-2313` |

束ねる場所の候補:

- **候補 A: `startEars` / `stopEars` を広げる。** この 2 つは、もう「耳 + 声の用意 + 目 + 記憶の引き金」を束ねている(`cockpit-server.mjs:1195`、`:1471`)。足りないのは YouTube・頭のセッション・キルと積み残しの片付け・記録の名前。ただし耳は入口の 1 つで、Discord では入口が人ごとに増える(棚卸し §2.3)。耳の寿命を場の寿命にすると、N 本の耳と食い違う【推測】。
- **候補 B: cockpit.mjs の耳の hook 3 つ(`onEarsStarted` / `onEarsStopping` / `onEarsStopped`・`:2208-2220`)を「場の hook」として名前ごと取り出す。** 記憶・目・声の用意は、もうここに入っている。
- **候補 C: 記録の単位を起動から外す。** `createStreamRecordIdentity`(`:1635`)と `createSessionUsageLog`(`:1656`)を場の始まりで作り直すかどうか。今は「起動 1 回 = 配信 1 本」(仕分け §3 の 7)。
- **候補 D: 終わりの保存を 1 本にする。** 耳の Stop の保存(`:2021-2024`・待たない)と、Ctrl+C の保存(`:2289-2313`・写しを先に取る・90 秒待つ)は、同じ係を別の形で呼んでいる。場の終わりを 1 つの関数にすれば、ここが 1 本になる【推測】。
- **候補 E: 1 段目の「許し」を場に置く。** キル(`:822`・`/api/kill` `:1902`)、自発(`fireScheduler.isEnabled`)、話し始めの方式は、今 `isActive` に足し算で入っている(`:2398-2399`、`:2464-2465`)。場の始まりと終わりで、これらを戻すのかどうかが、束ねるときに決めること。
- **候補 F: 会話の正本を耳の外に出す(先送り済み・`cockpit-server.mjs:2696-2700`)。** 場の始まりで正本を作り、終わりで畳む形にすれば、耳の Stop で正本が消えることも、耳が止まるとコメントが積まれないことも、場の側の決まりになる【推測】。

## 4. 器なしで声を出すときの差し替え点(問い 3)

### 4.1 今、器に頼っているところ(呼ばれる順)

| # | 場所 | 今の約束 | 器が無いとき |
|---|---|---|---|
| 1 | `cockpit.mjs:373-375` `createSessionProxy.ask` | URL が無ければ、頭に聞く前に投げる | 頭も起こさない(S2.5 で「何も spawn しない」ための約束・`cockpit.mjs:32-33`) |
| 2 | `cockpit.mjs:1886-1888` `acquireAcceptedFireResources` | URL が無ければ投げる | 発火の受理で落ちる |
| 3 | `cockpit.mjs:1900-1917` 同上 | 設定と metadata に `channelUrl`・`channelRevision`・`channelConnectionGeneration` を載せる | 値は null。害は無さそう【推測】 |
| 4 | `cockpit.mjs:210-216` `createLazyChannel.ensure` | URL が無ければ断る | すべての送信が失敗する |
| 5 | `speech-streamer.mjs:105-107` `createSpeechStreamer` | `channel.openSpeech/appendSpeech/endSpeech` が関数でなければ投げる | 運び手が作れない |
| 6 | `speech-streamer.mjs:447-483` `activate` | 文を鳴らす番に `await channel.openSpeech(id)`。`accepted` でなければ `play-failed` で世代を閉じる。受理のあとで `player.open`。「口の t=0 = 器の受理」(`:477`) | 声は鳴らない(棚卸し §4.3) |
| 7 | `speech-streamer.mjs:399-406` `flush` | 時間割を音より先に `appendSpeech`。拒否と失敗は `play-failed`(`:396`) | 鳴っている途中で止まる |
| 8 | `speech-streamer.mjs:437` | 終わりに `endSpeech`。失敗しても「end を送れなかった」と覚えるだけ(`:391-394`) | 止まらない |
| 9 | `speech-streamer.mjs:125-130` 既定の `releaseMouth` | `channel.sendSet` が無ければ何もしない | 止まらない |
| 10 | `fire-orchestrator.mjs:633-667` `releaseMouth`(割り込み・キル) | `sendSet` が無ければ診断 `…MouthCloseError`("channel has no sendSet") | 割り込みのたびに診断が出る |
| 11 | `fire-orchestrator.mjs:686-693` `streamReleaseMouth` | 割り込み・キル以外は、`sendSet` が無ければ黙る | 止まらない |
| 12 | `fire-orchestrator.mjs:928-960` `applyExpressions` | `sendEnvelope` が無ければ「拒否」と数え、診断 `expressionSendError` | 表情タグのたびに診断が出る。声は止めない |
| 13 | `fire-orchestrator.mjs:601-616` `acquireResources` | 確かめるのは `session.ask` だけ。channel は無くても通る | 止まらない |
| 14 | `fire-orchestrator.mjs:840-852`、`:1128-1140` | 運び手(文ごと)・`speakOnce`(一括)に `resources.channel` を渡す | 5〜9 に届く |

器に頼っていないもの(事実):

- **割り込みの「どこまで声に出たか」**: 材料は、運び手が engine から受け取って貯めた時間割(`speech-streamer.mjs:543-546`)と、プレイヤーの STARTED の時刻(`:615-618`)。発火の胴体は、それを `snapshot()` で読む(`fire-orchestrator.mjs:1289-1300`、`:1323-1330`、`:1931-1952`)。器に送ったかどうかは関係しない。
- **STARTED / ENDED は手元のプレイヤーから来る**(`stream-player.mjs`)。器からは来ない。
- **時間割は engine が作る。** AivisSpeech は `audio_query` のモーラから作る(`aivis-voice-engine.mjs:90-121`)。ElevenLabs は、読みを AivisSpeech の `/accent_phrases` から取って作る。読めなければ簡易版になる(`elevenlabs-voice-engine.mjs:487-534`)。器が無くても、割り込みの計算のために時間割は要る。
- 遅延の「声」の区間には、器の open の往復が入っている(`fire-latency.mjs:21-22`)。器が無いと、この区間の意味が変わる。

### 4.2 変える場所の候補(決めない)

- **候補 1: 何でも受理する器の代わりを、cockpit.mjs で差し込む。** `openSpeech/appendSpeech/endSpeech/sendEnvelope/sendSet` が、外に出ずに `{result:"accepted"}` を返す物。差し込む場所は `lazyChannel` の位置(`cockpit.mjs:1700`、`:1896`、`:2094`)。あわせて、URL のゲート 1・2(`:373-375`、`:1886-1888`)を「器が無い設定なら通す」に変える。運び手と発火の胴体は変えずに済む。代わりに、表情は「適用した」と数えられ(12)、遅延の「声」は往復の無い値になる。
- **候補 2: 運び手の約束を「器は任意」に変える。** `createSpeechStreamer` の確かめ(`:105-107`)を緩める。channel が無ければ、`activate` は `openSpeech` を飛ばして、すぐ `player.open` にする(`:456-476`)。`flush` は `appendSpeech` を飛ばす(`:402-406`)。終わりの `endSpeech` も飛ばす(`:437`)。口の t=0 の約束(`:27`、`:477`)を書き直す。`speakOnce`(`:781-847`)はそのまま通る。
- **候補 3: 発火の胴体で、器が無いときの診断を黙らせる。** `releaseMouth`(`:633-667`)と `applyExpressions`(`:928-960`)。器の無いことを「失敗」ではなく「体が無い」として扱う。表情タグを解析するかどうか(体が無いなら捨てる)もここで決まる。
- **候補 4: cockpit.mjs の器まわりの状態を「体なし」で表す。** `channelStatus`(`:2122-2129`)、起動の案内(`:2257-2272`)、`createLazyChannel` の `connState` "unset"(`:207`)。画面の器の欄(`view-logic/status.mjs:80-92`)。
- **候補 5: 時間割を作らない道を作るか。** ElevenLabs の読み(AivisSpeech への問い合わせ)は、口のためにある。でも割り込みの計算でも使う。時間割を作らないと、割り込みの「聞こえた分」は 0 文字の側に倒れる(`fire-orchestrator.mjs:1300` のコメント「保守側の 0 文字に倒れる」)【推測。試していない】。
- **候補 6: 頭への教え。** `skills/expression.md` は、体の有無と関係なく頭に渡る(`cockpit.mjs:1752-1755`、仕分け §2.2)。体が無いときに外すなら、ここも手が要る。

## 5. 画面の部品の仕分け(問い 4)

「配信」= 配信だけで意味があるもの。「共通」= 体験に関わらず使えそうなもの(言葉を替える必要はありうる)。「ロール」= ロールの持ち物を見せる・編集するもの。どれも候補。

### 5.1 `src/cockpit/ui/*`

| 部品 | 仕分け | 1 行 |
|---|---|---|
| `app.mjs` | 共通(骨組み) | 全体の結線と SSE の購読。中に配信の語(「配信前」・`:157`、`:302`)と、名前の引き口(`:271`、`:315-317`)がある |
| `header.mjs` | 共通 + ロール | 上の帯(状態・警告・残量・KILL)は共通。名前・タブ名(`identityDisplayName`・`cockpitDocumentTitle`・`:43-59`)はロール。`HealthLine` は共通(耳・声の出力先) |
| `conversation.mjs` | 共通(言葉は配信) | 会話タイムライン・遅延の棒・判定の札。「配信者」の行・「配信前」の大ボタン(`:74`)の言葉が配信寄り |
| `comments.mjs` | 配信 | YouTube のコメント欄(反応した印・弾いた札) |
| `bottom-bar.mjs` | 共通 | 運転設定の表示・遅延の凡例・歯車 |
| `control-bar.mjs` | 共通 + 配信 | 自発・かぶり・口数・話し始め・手動の発火は共通。忙しい間のコメント(`CommentBusySelect`・`:188`)と口数の説明の YouTube(`:148`)は配信 |
| `conversation-instruction-editor.mjs` | ロール | 会話指示(性格の指示)の編集。今は頭脳の id ごと |
| `settings-drawer.mjs` | 共通(骨組み)+ 各タブは混在 | タブの骨組み・キーボード・フォーカスは共通。接続タブの YouTube(`:853`)は配信。器の欄は体(ロールのオプション)。頭脳・会話タブはロール。記憶タブ(「今日を記録」)はロールか場 |
| `feed.mjs` | 共通 | 観測フィード(ログのタブ) |
| `rows.mjs` | 共通 | フィードの行の組み立て。コメント系の行(弾いた・判定)は配信の行を含む |
| `styles.mjs` | 共通 | CSS。`--who-streamer`(`:72`)など、配信の語の名前がある |

### 5.2 `src/cockpit/view-logic/*`

| 部品 | 仕分け | 1 行 |
|---|---|---|
| `control.mjs` | 共通 | 発火・自発・口数・話し始め・忙しい間のコメントの文言(最後の 1 つは配信) |
| `conversation-instruction.mjs` | ロール | 会話指示の API と、編集の状態。頭脳の id の一覧(`:14-35`)を持つ |
| `format-time.mjs` | 共通 | 時刻の整形 |
| `ghost.mjs` | 共通 + 配信 | ゴースト行の文言。`chatDiagnosticGhostLabel`・`COMMENT_GUARD_KIND_LABELS`・`commentRejectedGhostLabel`・`commentJudgmentErrorGhostLabel` は配信 |
| `glance-meters.mjs` | 共通(言葉は配信) | 遅延の棒・残量・警告・状態のピル・運転設定の表示。`isPreStream`(「配信前」・`:183-186`) |
| `glance-timeline.mjs` | 共通 + 配信 + ロール | 会話の状態は共通。`STREAMER_LABEL = "配信者"`(`:38`)は体験の言葉。コメントの状態(`commentRowsView`・「視聴者」`:425`)は配信。`soulName`(`:330`、`:366`)はロール |
| `health.mjs` | 共通 + ロール | 耳・文字起こし・声の健康は共通。`BRAIN_LABELS`・`brainLabel`(`:183-198`)は頭(今はロールの選択口) |
| `markers.mjs` | 共通 + 配信 | マーカーの文言。`commentJudgmentText`・`COMMENT_REACT_CHOICE_LABELS` は配信 |
| `settings.mjs` | 共通 + 配信 + ロール | デバイス・窓の一覧と失敗の文言は共通。`brainPostErrorText` はロール。記憶の表示はロールか場 |
| `status.mjs` | 配信 + 体 | `chatStatusView` など YouTube の状態は配信。`channelStatusView`(`:80`)は器(体) |
| `transcript.mjs` | 共通 | 話者のラベル(`you`/`soul`/`viewer(名前)` の 3 値・`:26-48`)。頭の札(`latencyLabel(…, brain)`・`:64-67`) |
| `usage.mjs` | 共通 | usage の 1 行(頭の札付き) |

### 5.3 同じフォルダの、画面以外のもの(参考)

- `cockpit-page.mjs`(21 行・ページのパス): 共通。
- `cockpit-settings-store.mjs`: 設定。層ごとの割り方の候補は仕分け §2.7。
- `quota.mjs`(Codex・ElevenLabs の残量): 資源。
- `warnings.mjs`(警告の板): 観測。警告の種類には YouTube の切断などが入る(仕分け §2.7)。

## 6. 観測の記録が持つ頭の id と名前(問い 5)

### 6.1 `src/mind/session-usage-log.mjs`(216 行)

- ファイル: 起動ごとに 1 つ。`session-usage/<起動の時刻>.jsonl`(`:25`、`:34-36`、`:143-144`)。20 個まで残す(`:27`)。作るのは `cockpit.mjs:1656`(起動時・1 回)。
- 各行の共通の欄: `schema: "soul-session-usage-v1"`・`wallTimeMs`(`:192`)。名前・ロール・場の欄は無い。
- 行の種類と、頭の id の出どころ:

| 行 | 作る関数 | `brain` の出どころ | 書く場所 |
|---|---|---|---|
| `fire` | `fireUsageRecord`(`:46-67`) | 受理した発火の設定 `resources.configuration.brain`(`fire-orchestrator.mjs:586` ← `cockpit.mjs:1901`)。受理の時点の頭なので、ずれない | `cockpit.mjs:2069-2071`(Codex の頭のときだけ) |
| `compactStarted` / `compactFinished` | `compactionUsageRecord(event, brain)`(`:75-96`) | 呼ぶ側が渡す `currentBrain`(`cockpit.mjs:1674`) | `cockpit.mjs:1674` |
| `latency` | `replyLatencyUsageRecord`(`:104-131`) | 放送の時点の `brainStatusImpl().brain`(`cockpit-server.mjs:2237`)。切り替えた直後の返事はずれうる、と書いてある(`:2202-2205`) | `cockpit.mjs:2245-2249` |

- 話者・人数に関わる欄: `latency` 行の `causeType` / `causeChoice`(`:111-112`)、`transcribeMs` / `judgeMs`(`:119-120`)。誰の発言がきっかけかの欄は無い。

### 6.2 `src/mind/fire-latency.mjs`(233 行)

- 純ロジック。頭・名前・話者を知らない。`composeReplyLatency`(`:209-233`)は `fireId`・`cause`・区間・合計・区分だけを返す。
- 頭の札は、結線の側で足す: `cockpit-server.mjs:2241-2248`(`brain`・`voice`・`stt`・`serviceTier`)。
- 「文字起こし」の区間は、きっかけの `triggerSeq` で `sttLatencyBySeq` を引く(`cockpit-server.mjs:2231-2233`)。この表は、耳 1 本の転写の `seq` で埋まる(`:1399-1403`、500 件まで・`:881-882`)。耳が N 本で `seq` の空間が別々になると、取り違えうる【推測】。

### 6.3 `src/mind/fire-diagnostics.mjs`(参考)

- 発火ごとに 1 ファイル(`fire-<時刻>-<番号>.jsonl`・`:121-126`)。5 個まで残す(`:10`)。頭の id も名前も持たない。

### 6.4 ロールの id を足すときに触る場所(場所だけ)

- 記録の行を作る関数: `fireUsageRecord`(`session-usage-log.mjs:46`)、`compactionUsageRecord`(`:75`・引数の形)、`replyLatencyUsageRecord`(`:104`)。schema の名前(`:29`)。
- 値の出どころ: 受理の設定 `configuration`(`cockpit.mjs:1900-1910`)。ここに足せば、`onAskRecord`(`fire-orchestrator.mjs:584-587`)と同じ道で、受理の時点の値になる。`currentBrain` を渡している場所(`cockpit.mjs:1674`)。`brainStatusImpl()` を読む放送(`cockpit-server.mjs:2212`、`:2237`、`:2295`)。
- 画面の頭の札: `view-logic/transcript.mjs:64-67`、`view-logic/usage.mjs:22-27`、`view-logic/health.mjs:183-198`。名前は `snapshot()` の `identity`(`cockpit-server.mjs:919-942`)と `currentSoulName`(`:2655-2660`)。
- ファイルの単位: `createSessionUsageLog` の `startedAtMs` とファイル名(`session-usage-log.mjs:136-144`)。場ごとに分けるなら、ここも関わる。

## 7. 未確認のこと

- 耳の Stop のあと、発火の予定のタイマー(沈黙・合いの手)が、発火を頼み続けるかどうか。発火の胴体が `ears-not-running` で断ることは確かめた。予定の中のタイマーは読んでいない。
- 耳の Stop → Start のあと、speak-now・コメント反応の積み残し(古い `seq`)が新しい正本と混ざるかどうか。`reset` を呼ぶのは話し始めの方式の切り替えのときだけ(`cockpit-server.mjs:2647-2652`)。
- 候補 1(何でも受理する器の代わり)にしたとき、運び手の STARTED の待ち(5 秒)と遅延の区間が、実際にどう変わるか。動かしていない。
- 割り込みで時間割が空のとき、本当に 0 文字に倒れるか。コメント(`fire-orchestrator.mjs:1300`)と `computeSpokenPrefix` の入口だけ読み、中身は読んでいない。
- `createVoiceEngineManager` の `prepare` と `ensure`(`cockpit.mjs:957-1132`)の細かい違い。ヘッダだけ読んだ。
- `settings-drawer.mjs`(1071 行)は、ヘッダとタブの定義と YouTube の欄だけ読んだ。タブの中の部品は 1 つずつは読んでいない。
