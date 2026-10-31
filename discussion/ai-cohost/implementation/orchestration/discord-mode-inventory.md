# Discord モード planning inventory(wave 計画の前の棚卸し)

> **要約(10 行以内)**
> 1. 今の HEAD(`84df62db`)で `node --test` は **1884 件 pass / 0 fail**(99 本・42,849 行・約 92 秒)。`pnpm run check:soul-zone` も pass。前の棚卸し(1713)から +171。
> 2. 行番号の直し方: `cockpit-server.mjs` は 345 行目以降 **+14**、3631 行目(旧)以降は **+23**。`memory.mjs`・`recall.mjs` は個別に直した。そのほかの `src/`・`scripts/` は e1e77f75 と同じ(`git diff --stat e1e77f75 HEAD -- apps` は 7 ファイルだけ)。
> 3. 重なりの山は `cockpit-server.mjs`(A・B・C・E)と `scripts/cockpit.mjs`(B・C・D・E)。`src/mind/` は A → B → E で同じ 3 ファイル(memory・recall・speak-now)を順に触る。**E と F はファイルがほぼ重ならず並べられる**(接点は snapshot の項目名だけ)。
> 4. 配信の文字列の固定テストは、前例が「同じ関数で組み直して比べる」か正規表現で、**文字列を書き写して一字ずつ比べる型は前例が無い**。新規 1 本に集めるのが前例(`cockpit-server-domain-e.test.mjs` のようにドメイン単位の新規ファイル)に合う。
> 5. Domain A の最大の山は `cockpit-server.test.mjs` の偽の耳(`makeFakePipeline` 60 か所・`record.buffer` 65 か所)と、耳が無いと正本が無い前提の `chatBufferAbsent`(1 件)。ここだけ「配信の期待値を変えた既存テスト 0」と衝突しうる。
> 6. discord.js を差し替える前例は**無い**。試しの仕掛けは動的 import + 純関数だけをテストしている。偽物の前例は `captureFactory`(耳)・`src/test-support/fake-stream-player.mjs`(再生器)。「Discord の口を束で注入する」形で偽物を作る。
> 7. 鍵の読み方は各鍵の使い手のモジュールに同じ形で置かれ、共通部品は無い(`parseEnv` を 3 か所で書いている)。置き場の候補は `src/discord/` 内。
> 8. 規模の見込みは前例の Domain D(場)級が B、A 級が C、残りは前例より小さい。B は 3 つの塊を含み最大(分割の判断は Undine)。
> 9. Undine が決める点は末尾 §9。特に: B の分割、判定の差し口(speak-now.mjs への注入)を人間ゲート 1 の前に出すか、A の積む口と `onAppend` の持ち主。

> Status: 棚卸し完了(2026-10-31、Sylph・読み取りのみ・コードは変えていない)。設計は [../../architecture/discord-mode.md](../../architecture/discord-mode.md)(Accepted、以下「設計」)。wave 計画はまだ無い。
> 根拠: [../../discord-vc/scope.md](../../discord-vc/scope.md) §15・§21〜§23、リポジトリの棚卸し [../../discord-vc/research/discord-mode-repo-2026-10.md](../../discord-vc/research/discord-mode-repo-2026-10.md)(以下「リポ棚卸し」。e1e77f75 時点)、前例 [stream-restructure-inventory.md](stream-restructure-inventory.md)・[stream-restructure-wave-plan.md](stream-restructure-wave-plan.md)。リポ棚卸しに書いた事実は繰り返さず、§ を指す。
> パスは断りがなければ `apps/soul/agent/` 起点。`.env*.local`・`cockpit-settings.local.json`・`memories/`・`roles/` は開いていない(`memories/chappy/_conventions.md` の「配信」の数は設計の「8 か所」をそのまま引き、種 `src/memory/conventions-seed.md` の 8 か所は数えた)。操縦席は起動していない。【推測】と書いたもの以外はコードで確かめた。

## 0. 行番号の直し方

| ファイル | e1e77f75 → HEAD |
|---|---|
| `src/cockpit/cockpit-server.mjs`(4027 行) | 344 行目まで同じ。345〜3630(旧)は **+14**(`createInMemorySettingsStore` の後ろに 14 行)。3631(旧)以降は **+23**(`:3645` 付近に 9 行)。検算: `openStream` 1874 → 1888、`startEars` 1296 → 1310、`getTranscript` 3790 → 3813 |
| `src/mind/memory.mjs` | `labelOf` :44、`formatDigestLine` :55、`formatTranscriptForDigest` :70、`createStreamRecordIdentity` :152、`WRITER_SYSTEM_PROMPT` :169-172(設計は 169-173)、`buildWriterRequest` :180-(材料の説明の行 :207) |
| `src/mind/recall.mjs` | `RECALL_SYSTEM_PROMPT` :62-65(設計は 62-66)、`formatRecentConversation` :74、`buildRecallRequest` :97-(説明の行 :112)、`recallAvoidQuestion` :200、`buildRecallAvoidInput` :217、結果の文面 :277-351 |
| ほかの `src/`・`scripts/` | 同じ(`scripts/cockpit.mjs` 3148 行、`ear-pipeline.mjs`、`speech-streamer.mjs`、`fire-orchestrator.mjs`、`ui/*` など) |

設計の行番号のうち動くもの: `cockpit-server.mjs:3067-3070`(自発が ON のときだけ speak-now)→ **:3071-3072**。`scripts/cockpit.mjs:2277`・`:2431`(`soulSkillNamesForBody` を呼ぶ所)は同じ。

## 1. 前例の wave 計画の形(今回に効く所だけ)

[stream-restructure-wave-plan.md](stream-restructure-wave-plan.md)(134 行)の型: 冒頭の Status と進め方 → §0 形(コードブロック + 実データに触れない約束)→ §1 ドメイン(見出し「Domain X — 名前(触るパス)」、本文は箇条書き)→ ドメインの間の申し送り → §2 依存と順 → §3 モデル配分(Orch-Sylph opus・Gnome opus・Review-Sylph sonnet 1 レーン・全体の突き合わせ opus)→ §4 見直しの粒度(止めてよい指摘 4 種・ループ上限 3 回・機械ゲート)→ §5 全体の突き合わせ → §6 人間ゲート(番号付き)→ §7 置き場(`waves/<題>/domain-<a〜>-report.md`・`reviews/<題>/domain-<a〜>.md`・`final.md`・`human-gate.md`)。

- コミット: ドメインが合格するごとに Undine が feat を 1 つ。前例のブランチは計画の docs 1 + feat 5(A〜E)+ 突き合わせ 1 + 人間ゲート前の直し 1 + 結果の docs 1。
- ドメインは全部順に作った(大きいファイルを共有するため)。1 つの作業ツリーを共有し、worktree の前例は無い(前例の棚卸し §1.6)。
- 今回は人間ゲートが 2 回(設計 §11)。前例は最後の 1 回だけなので、ゲート 1 の後に「結果を書く docs コミット」と Discord の群の計画の続きをどこに置くかは計画で決める(Undine)。
- 「期待値を変えた既存テスト」は前例で C 0・D 10・E 26。いずれも仕様変更で、一覧を報告した。今回の A・B は「0」を完了条件にしている(設計 §11)ので、前例より厳しい。

## 2. ドメインごとに触る見込みのファイル

### 2.1 Domain A — 会話の正本を場へ・話者の形(設計 §3.1〜§3.3)

| ファイル | 塊(行) | 何に当たるか |
|---|---|---|
| `src/ears/ear-pipeline.mjs` | `buffer` を自作 :192、`buffer.onAppend` で `onTranscript` を呼ぶ :241、返り値の `transcriptBuffer` :475、`captureFactory` :174 | 外から積む口を受け取る。**`onAppend` を誰が張るか**(耳 N 本が同じ正本に張ると二重)は設計に無い判断(§9-3) |
| `src/ears/transcript-buffer.mjs` | `VALID_SPEAKERS` :78、検証 :127-137(`displayName` の型検証 :134)、`append` :144-170、冒頭の説明 :30-38(displayName は viewer のときだけ意味) | you / soul にも名前を許す。`speakerId` を足す。形は `TranscriptEntry` :74 |
| `src/cockpit/cockpit-server.mjs` | 正本を `pipeline ? pipeline.transcriptBuffer : null` で読む所 **13 か所**(:1032・:1068・:1521・:1974・:1987・:2870・:2927・:3068・:3136・:3202・:3408・:3507・:3813)+ 耳の中の `p.transcriptBuffer` 2 か所(:1534-1535)。`toWireEntry` :1019(`displayName` は既に流れる)。耳の `onTranscript` :1492-(soul / viewer は放送しない :1505)。`chatBufferAbsent` :3412・:3511。`startEars` :1310 | 場が正本を作り、耳に渡す |
| `src/mind/fire-injection.mjs` | `labelOf` :40、行の整形 :50-58、`formatFireInjection` :86、`formatFireInjectionSince` :154 | ①への行。名前があれば `you(名前): 本文` |
| `src/mind/memory.mjs` | `labelOf` :44、`formatDigestLine` :55、`formatTranscriptForDigest` :70 | ②への材料 |
| `src/mind/recall.mjs` | `formatRecentConversation` :74-(行の組み立て)、`buildRecallAvoidInput` :217-(:229 `配信者: …`) | ④への会話と避けるかの入力 |
| `src/mind/speak-now.mjs` / `comment-react.mjs` | `speak-now.mjs:143` `buildSpeakNowInput`、ラベル :152(`SPEAK_NOW_HOST_LABEL` :54)。`comment-react.mjs:103`、:121 | 判定の入力(名前つきの扱い。語の差し替えは E) |
| `src/mind/fire-orchestrator.mjs` | `speaker: "soul"` を書く 6 か所 :752・:1075・:1141・:1265・:1296・:1375 | 設計 §3.2 a(ロールの id と名前を載せる)の書き込み先。これだけ |
| `src/mind/fire-scheduler.mjs` | :732-750(soul = 不応期、viewer = 呼びかけ、you = 活動) | 読むだけ。名前つき you でも分岐は変わらない見込み【推測】 |
| 画面(読むだけ・表示は F) | `view-logic/transcript.mjs` :23-49(`speakerLabel` は viewer だけ名前)、`view-logic/glance-timeline.mjs` :110-135・:366(you は `STREAMER_LABEL = "配信者"` :38)、`ui/app.mjs` :402-406 | A では型を通すだけ。名前を出すのは F |

`.startMs` / `.endMs` を耳をまたいで比べる所は**無い**(設計 §3.1【推測】を確認): `src/mind/`・`view-logic/`・`ui/` に `.startMs` の参照は 0。出現は `cockpit-server.mjs` の素通し(:1021・:1481・:1537)と `fire-injection.mjs`・`fire-orchestrator.mjs` の `startMs: 0` の書き込みと耳の中だけ。

テスト: `transcript-buffer.test.mjs`(243)、`ear-pipeline.test.mjs`(893)、`cockpit-server.test.mjs`(6154)、`fire-injection.test.mjs`(194)、`memory.test.mjs`(589)、`recall.test.mjs`(234)、`speak-now.test.mjs`(499)、`comment-react.test.mjs`(301)、`fire-orchestrator.test.mjs`(4411)、+ 新規の固定テスト(§3.3)。

### 2.2 Domain B — 場と体験の分離・ロールの一覧・声と目を共通の段へ・API/snapshot・言葉の差し口(設計 §3.4・§4・§5)

| ファイル | 塊(行) | 何に当たるか |
|---|---|---|
| `src/cockpit/cockpit-server.mjs` | `streamHooks` の口 :558・:795、`onPrepareVoiceEngine` :608・:784、`onEarsStarted` / `onEarsStopped` :616-619・:791-792。`startEars` :1310-1600(声の engine の用意 :1411、`callEarsHook(onEarsStarted)` :1583)、`stopEars` :1592(:1593)。`renewJudges` :1680・`renewFireScheduler` :1700・`renewRecallDesk` :1720・`foldStream` :1733・`startChatForStream` :1784。断りの文面 `refuseManualFireOutsideStream` :1862・`streamBusyMessage` :1874。`openStream` :1888-1958・`closeStream` :1960-2024・`endStreamForShutdown` :2026・`handleStreamStart` :2044(body は device / sttEngine / ttsEngine)。snapshot の `stream`(リポ棚卸し §1.1 の `:1039` → 約 :1053)。ロール 1 つ前提(`currentRoleIdentityImpl` :742、`killed` :905、`bargeInGate` :913、判定の工場 :921-936。リポ棚卸し §2.1 の表を +14) | 体験の口・ロールの束 |
| `scripts/cockpit.mjs` | `createStreamVenueHooks` :982-1086、`createRoleHooks` :1204-1320、`createRoleMemoryPlaces` :837、`session` :2220・`ensureSession` :2396・`openStreamSession` :2477、**`ensureVoiceResources` :2488-2512**(再生器を作る唯一の所)、`acquireAcceptedFireResources` :2597-2650、`streamVenue` :2778-、`createCockpitServer({…})` の口 :3021(`onPrepareVoiceEngine`)・:3027-3036(`onEarsStarted` = 撮る係と再生器)・:3037(`onEarsStopped`)・:3039(`streamHooks`)。教えの名前の選択 :2277・:2431 | 声と目を耳の Start から出す。束を作って渡す |
| `src/mind/soul-skills.mjs` | `SOUL_SKILL_NAMES` :29、`soulSkillNamesForBody` :38、`listSoulSkills` :63、`loadSoulSkills` :93 | 体験でも足す名前を選ぶ口(配信では何も足さない) |
| `skills/recall.md` | 本文 :5・:8、見出し欄 :3(①には入らない) | 印を置き、体験の語の組で差す |
| `src/mind/memory.mjs` / `recall.mjs` | §5 の表のとおり | 「共通部分 + 語の組」に組み替える |
| `src/mind/speak-now.mjs` | `speakNowQuestion` :81 ほか(§8 b の注入口) | **どのドメインに置くかは §9-2** |

テスト: `cockpit-server.test.mjs`(6154)、`cockpit-server-domain-e.test.mjs`(945)、`scripts/cockpit-stream.test.mjs`(1315)、`scripts/cockpit.test.mjs`(3154)、`memory.test.mjs`・`recall.test.mjs`・`soul-skills.test.mjs`(133)・`fire-orchestrator.test.mjs`(:147-165 が `FIRE_SYSTEM_PROMPT` と `DEFAULT_CONVERSATION_INSTRUCTION_BODY` を固定)。

### 2.3 Domain C — Discord の入口(設計 §5 の鍵・§6・§9 の保存)

| ファイル | 塊(行) | 何に当たるか |
|---|---|---|
| (新規)`src/discord/` | 鍵の読み・Bot の接続と VC 参加(`group` にロールの id)・人ごとの受信・Opus → 16kHz モノラル・耳の部品・体験の口 | 試しの `scripts/probe-discord-receive.mjs` から移す(:121-141 鍵、:661 Intent、:744 名前、:801-845 受信) |
| `scripts/probe-discord-receive.mjs` | `loadDiscordBotToken` :121-141 | 移したら import に直す。テストは `probe-discord-receive.test.mjs:76-122` |
| `src/roles/role-store.mjs`(528) | `normalizeRole` :139、`applyRolePatch` :255、`role.json` の形の説明 :11-32 | `discordBotKeyFile`(ファイル名だけ・`.env.discord*.local` に合うものだけ) |
| `src/cockpit/cockpit-settings-store.mjs`(433) | `getX` / `setX` を 1 つずつ足す流儀(:249-427)。`createInMemorySettingsStore` は `cockpit-server.mjs:329-` | Discord の準備(サーバー・チャンネル・見る窓・文字起こしの方式)の保存 |
| `src/ears/ear-pipeline.mjs` | `captureFactory` :174・:511・:560・:596(`onPcm` に 16kHz モノラル、`dispose`) | 人ごとの耳の音の入口(**変更不要の見込み**) |
| `src/cockpit/cockpit-server.mjs` | snapshot の接続状態、サーバー・チャンネルの一覧を読み込む口(どちらのドメインか §9-5) | |
| `scripts/cockpit.mjs` | Discord の体験の口を作って渡す結線(`main()` の中) | `main()` はテストで通せない(§3.1) |

テスト: `role-store.test.mjs`(305)、`cockpit-role-edit.test.mjs`(362)、`cockpit-settings-store.test.mjs`(1087)、`probe-discord-receive.test.mjs`(408)、`ear-pipeline.test.mjs`、+ 新規(偽の Discord、§4)。

### 2.4 Domain D — Discord の出口(設計 §7)

| ファイル | 塊(行) | 何に当たるか |
|---|---|---|
| (新規)`src/discord/` | Discord 向けの再生器(`open / write / end / stop / onEvent / isAlive / dispose`)、48kHz ステレオへの変換 | 運び手の約束 `speech-streamer.mjs:109-111` |
| `src/voice/speech-streamer.mjs` | `ENDED` の見張り :359-368(余裕 750ms)、`STARTED` の見張り 5 秒 :47・:352 | 途切れで引っかかるなら余裕を注入できるようにする(設計 §7.3【推測】) |
| `src/mind/fire-orchestrator.mjs` | 切断点の経過 :1364-1370 | 案 a(`started` に遅れを足す)なら再生器の側で済み、ここは**触らない**見込み |
| `src/cockpit/cockpit-server.mjs` | `userSpeaking` :954・VAD の配線 :1473-1490(`bargeInGate.handle` :1488・`fireScheduler.handleVadEvent` :1490)、`:3697` | 人ごとの耳の VAD を合わせた「話している」(圧縮の隙間も読む) |
| `scripts/cockpit.mjs` | `ensureVoiceResources` :2488-2512 | B で作り分けの口ができていれば、D はその中身を足すだけ |

テスト: `speech-streamer.test.mjs`(697)、`stream-player.test.mjs`(596。偽の子プロセスの型)、`barge-in.test.mjs`(543)、+ 新規。

### 2.5 Domain E — 判定と言葉(設計 §3.4・§8)

| ファイル | 塊(行) | 何に当たるか |
|---|---|---|
| `src/mind/speak-now.mjs` | `speakNowQuestion` :81、`buildSpeakNowInstructions` :106、`buildSpeakNowChoices` :115、`buildSpeakNowInput` :143、`createSpeakNowController` :214 | 問い・選択肢・入力を作る口を注入(§8 b)。Discord の文面 |
| `src/mind/recall.mjs` | `recallAvoidQuestion` :200(:205)、`buildRecallAvoidInput` :217 | 避けるかの判定の Discord 文面 |
| `src/mind/memory.mjs` / `recall.mjs` / `skills/recall.md` | §5 | Discord の語の組 |
| (新規)`skills/venue-discord.md`(仮) | — | ①に足す体験の教え |
| `src/mind/soul-skills.mjs` + `scripts/cockpit.mjs:2277`・`:2431` | 体験で足す名前を選ぶ | |
| `src/cockpit/cockpit-server.mjs` | `makeSpeakNow` :3066(`speakStartMode === "speak-now"` の条件 :3071)、`makeFireScheduler` :3018(Discord では予定を作らない)、`applyRoleResult` の `speakStartMode` :1844-1851、`onSetSpeakStartMode` 付近 :2436、snapshot の `speakStart` :1081 | Discord では方式を speak-now に固定し、予定を作らない |
| `src/discord/` の体験の口 | 「判定の組」「言葉」の項目 | C が作る口に E が中身を足す |

テスト: `speak-now.test.mjs`(499)、`recall.test.mjs`、`memory.test.mjs`、`soul-skills.test.mjs`、`fire-scheduler.test.mjs`(1458)、`cockpit-server.test.mjs`、`cockpit-ui-speak-now.test.mjs`(132)。

### 2.6 Domain F — 画面(設計 §9)

| ファイル | 塊(行) | 何に当たるか |
|---|---|---|
| `src/cockpit/ui/conversation.mjs`(104) | 配信前のボタン :73-101 | 「Discord の VC に入る」を並べる |
| `src/cockpit/ui/app.mjs`(479) | `startStream` :351、`endStream` :371、`isPreStream` / `streamStartView` :430-431、名前の引き口 :402-406 | 体験を渡して始める。終えるは「VC から抜ける」 |
| `src/cockpit/view-logic/glance-meters.mjs`(277) | `isPreStream` :208、`streamStartView` :221、`endStreamButtonView` :240 | 文言(始めています / 終えています)が配信の語で直書き |
| `src/cockpit/ui/settings-drawer.mjs`(1286) | `SETTINGS_CATEGORIES` :131-137(配信の準備 / ロール / 運転 / 記憶 / ログ)、`activeCategory` :320、`prepare` のパネル :931- | 「Discord の準備」タブを足す |
| `src/cockpit/view-logic/glance-timeline.mjs` / `transcript.mjs` | `STREAMER_LABEL = "配信者"` :38・:366、`speakerLabel` :36 | 名前つきの行(あなたの行も Discord の名前) |
| `src/cockpit/ui/control-bar.mjs` | 運転の口数・話し始め(`SpeakStartSelect`) | Discord で方式を固定と見せる(出し方は実装で起こす) |

テスト: `cockpit-ui.test.mjs`(1078。**:609-615 がタブの id の並びと `role="tabpanel"` の数 5 を固定**)、`cockpit-ui-settings.test.mjs`(474)、`cockpit-ui-glance.test.mjs`(271)、`cockpit-ui-speak-now.test.mjs`、`view-logic/glance-meters.test.mjs`(217)、`glance-timeline.test.mjs`(238)、`transcript.test.mjs`(52)、`settings.test.mjs`(327)。

### 2.7 重なりの表

◎ = 大きく触る / ○ = 触る / △ = 小さく触る / 空 = 触らない。

| ファイル | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| `src/cockpit/cockpit-server.mjs`(4027) | ◎ 正本 15 か所・`toWireEntry`・`chatBufferAbsent` | ◎ `startEars`・`openStream`・`closeStream`・`streamHooks`・snapshot・`handleStreamStart` | △ 接続状態・一覧の口 | △ `userSpeaking` の合算 | ○ `makeSpeakNow`・方式の固定・予定を作らない | (snapshot を読むだけ) |
| `scripts/cockpit.mjs`(3148) | | ◎ 声と目の段・束・口の結線 | ○ Discord の口を渡す | △ `ensureVoiceResources` の中身 | ○ 教えの名前 :2277・:2431 | |
| `src/mind/memory.mjs` | ○ 整形 | ◎ 語の組 | | | ○ Discord の組 | |
| `src/mind/recall.mjs` | ○ 整形 | ◎ 語の組・結果の文面 | | | ○ 避けるか・Discord の組 | |
| `src/mind/speak-now.mjs` | ○ 入力の名前 | (△ 注入口を前倒しするなら §9-2) | | | ◎ 注入口・Discord の文面 | |
| `src/mind/fire-injection.mjs` | ○ | | | | | |
| `src/mind/fire-orchestrator.mjs` | ○ soul の 6 行 | | | (△ §7.4 の b を採るなら) | | |
| `src/mind/soul-skills.mjs` | | ○ | | | ○ | |
| `src/ears/transcript-buffer.mjs`・`ear-pipeline.mjs` | ◎ | | (○ 耳の部品を差す・変更不要の見込み) | | | |
| `src/roles/role-store.mjs` | | | ○ | | | (○ 鍵の指し先を画面で編集するなら) |
| `src/cockpit/cockpit-settings-store.mjs` | | | ○ | | | |
| `src/discord/`(新規) | | | ◎ | ◎ | ○ 口の項目 | |
| `src/cockpit/ui/*`・`view-logic/*` | (読むだけ) | | | | | ◎ |
| `skills/*.md` | | ○ `recall.md` の印 | | | ○ `venue-discord.md` | |
| テスト: `cockpit-server.test.mjs` | ◎ 偽の耳 | ○ | △ | | ○ | |
| テスト: `scripts/cockpit.test.mjs`・`cockpit-stream.test.mjs` | | ◎ | ○ | | ○ | |

### 2.8 E と F を並べて作れるか

- **並べられる**。E の触る所は `src/mind/`・`skills/`・`soul-skills.mjs`・`cockpit-server.mjs` の判定まわり(:1844-1851・:2436・:3018・:3066)・`scripts/cockpit.mjs` の 2 行・`src/discord/` の口の項目。F の触る所は `src/cockpit/ui/*`・`view-logic/*` とそのテストだけ。ファイルは重ならない。
- 接点は snapshot の項目名だけ: E が「Discord では方式が固定」を返す形(例 `speakStart` を固定と読める値で返す)と、B が足す `stream.experience`、C が足す Discord の接続状態を、F が読む。**E の開始前に項目名と値を計画に書く**(前例 `voice-swap-wave-plan.md:110-115`「D と E の接点」)。
- 注意: 同じ作業ツリーを共有する前例のため、`cockpit-server.test.mjs`(6154 行)に E も追記すると衝突しうる。前例は新規ファイルに分けた(`cockpit-server-domain-e.test.mjs`)ので、ドメインごとの新規テストファイルを勧める。
- 設計の「推奨は順」を変える理由が弱ければ、順のままでよい(F は E の speak-now の固定の見せ方を使う、と設計 §11 が書いている。接点が先に決まっていれば並べられる、というだけ)。

### 2.9 設計に書かれていない発見(Undine へ)

1. **`onAppend` の持ち主**(Domain A): `ear-pipeline.mjs:241` は耳が正本に張った `onAppend` から `onTranscript`(放送・speak-now・遅延ログ・VAD 以外の結線)を呼ぶ。サーバの `onTranscript` :1492- は soul / viewer の行を放送しない除外もここにある。正本を場に出して耳が複数になると、`onAppend` を耳が張る(= 同じ正本に N 重)か場が 1 回張るかで、`currentMeta`(遅延・`audioCtx`)の引き方が変わる。
2. **`chatBufferAbsent`**(`cockpit-server.mjs:3412`・`:3511`)は「耳が無いと正本が無い」前提の分岐で、既存テスト 1 件(`cockpit-server.test.mjs:1901`)が固定している。設計 §3.1 は「耳が止まっていても積める」と書くので、この 1 件の期待値は変わる。場が開いている間は耳は止まらない(Stop は下の帯だけ)ので配信のふるまいは変わらないが、「配信の期待値を変えた既存テスト 0」を厳密に読むなら扱いを決める必要がある。
3. **画面にも「配信者」がある**: `glance-timeline.mjs:38` の `STREAMER_LABEL = "配信者"`(you の行のラベル)。設計 §9 は「あなたの行も Discord の名前で出す」とだけ書く。F の作業。
4. **`speak-now.mjs:54` の `SPEAK_NOW_HOST_LABEL = "配信者"` は export**。使うのは :152 の 1 か所だけ(テスト以外)で、語の組に差し替える自然な点。
5. **置換の罠**: `fire-orchestrator.mjs:194` の「**未配信**部分」(配信 = 届ける、の意味)は語の組の対象外。`fire-orchestrator.mjs:213` の「あなたは配信の相方です」は**ロールの持ち物**で、`fire-orchestrator.test.mjs:152` が一字で固定している(体験では替えない、と設計 §3.4 も書く)。
6. **コメント系は Discord では作らない**ので、`comment-react.mjs` と `comment-guard.mjs`(「YouTube ライブ配信のコメント欄に届いた…」)の「配信者」は語の組の対象外。`scripts/probe-decisions-*.mjs`(観測用の台本。`probe-decisions-speak-now.mjs` だけで「配信者」19 か所)も対象外。
7. 設計 §5 の「`main()` の中の結び合った変数を束にする」は、`main()` が export されず通すテストが無い(§3.1)ため、束を作る関数を export して個別にテストする前例の型(`createRoleHooks` :1204、`createStreamVenueHooks` :982)に倣うことになる。

## 3. テストの土台

### 3.1 件数と走らせ方(2026-10-31、HEAD `84df62db`)

- `apps/soul/agent` で `node --test`: **1884 件 pass / 0 fail / 0 skipped、約 92 秒**(`ℹ duration_ms 91753`)。リポジトリの根で `pnpm run check:soul-zone`: pass(1565 ファイルを走査)。
- 推移: 前の棚卸し 1713 → 配信の組み直しの各 Domain 後 A 1732・B 1758・C 1782・D 1817・E 1867・突き合わせ後 1879 → 今 1884(名前を残す直しで +5)。
- テストのファイル: 99 本・42,849 行。大きい順に `cockpit-server.test.mjs` 6154、`fire-orchestrator.test.mjs` 4411、`scripts/cockpit.test.mjs` 3154、`fire-scheduler.test.mjs` 1458、`codex-session.test.mjs` 1407、`scripts/cockpit-stream.test.mjs` 1315、`cockpit-settings-store.test.mjs` 1087、`cockpit-ui.test.mjs` 1078、`cockpit-server-domain-e.test.mjs` 945、`ear-pipeline.test.mjs` 893。
- `main()` を通すテストは無い(前の棚卸し §3 のまま)。結線は export した部品(`createStreamVenueHooks`・`createRoleHooks`・`createLazyChannel` など)を個別にテストし、`scripts/cockpit-stream.test.mjs` が本物のサーバと cockpit.mjs の部品を偽の耳・orchestrator でつなぐ。画面は DOM を描画せず、view-logic の純関数と `ui/*` のソースの正規表現で固定する。

### 3.2 ドメインごとに関わるテストの行数

| Domain | 関わる既存テスト(行) |
|---|---|
| A | `cockpit-server.test.mjs` 6154(`makeFakePipeline` :161 を **60 か所**で使用、`record.buffer` **65 か所**、`buffer.append` 53 か所、`createCockpitServer(` 177 か所)、`ear-pipeline.test.mjs` 893、`transcript-buffer.test.mjs` 243、`fire-injection.test.mjs` 194、`memory.test.mjs` 589、`recall.test.mjs` 234、`speak-now.test.mjs` 499、`comment-react.test.mjs` 301、`fire-orchestrator.test.mjs` 4411 |
| B | `cockpit-server.test.mjs`、`cockpit-server-domain-e.test.mjs` 945、`scripts/cockpit-stream.test.mjs` 1315、`scripts/cockpit.test.mjs` 3154、`soul-skills.test.mjs` 133、`memory.test.mjs`、`recall.test.mjs`、`fire-orchestrator.test.mjs`(:147-165) |
| C | `role-store.test.mjs` 305、`cockpit-role-edit.test.mjs` 362、`cockpit-settings-store.test.mjs` 1087、`probe-discord-receive.test.mjs` 408、`ear-pipeline.test.mjs` |
| D | `speech-streamer.test.mjs` 697、`stream-player.test.mjs` 596、`barge-in.test.mjs` 543、`fire-orchestrator.test.mjs` |
| E | `speak-now.test.mjs`、`recall.test.mjs`、`memory.test.mjs`、`soul-skills.test.mjs`、`fire-scheduler.test.mjs` 1458、`cockpit-ui-speak-now.test.mjs` 132 |
| F | `cockpit-ui.test.mjs` 1078(:609-615 でタブの並び・数 5 を固定)、`cockpit-ui-settings.test.mjs` 474、`cockpit-ui-glance.test.mjs` 271、`view-logic/glance-meters.test.mjs` 217、`glance-timeline.test.mjs` 238、`transcript.test.mjs` 52、`settings.test.mjs` 327 |

配信の語を期待値に持つ既存テスト(語の組の組み替えで**変えてはいけない**もの): `memory.test.mjs` 7 か所、`recall.test.mjs` 2、`speak-now.test.mjs` 9、`comment-react.test.mjs` 5、`soul-skills.test.mjs` 2(:23 `配信者に「思い出して」`)、`fire-injection.test.mjs` 2。

### 3.3 配信の期待値を固定するテストの置き場

- **前例の型**: ①の `FIRE_SYSTEM_PROMPT` は `appendSoulSkills(buildFireSystemPrompt(), loadSoulSkills())` と**同じ関数で組み直して比べる**(`fire-orchestrator.test.mjs:147`)。②④は正規表現(`memory.test.mjs:157-162`、`recall.test.mjs:94-95`)。判定の入力は `includes` / `deepEqual`(`speak-now.test.mjs:75-85`)。文字列リテラルで一字固定した前例は `DEFAULT_CONVERSATION_INSTRUCTION_BODY`(`fire-orchestrator.test.mjs:152`)ぐらい。**設計 §3.4 の「土台の前の文字列を書き写して一字ずつ比べる」型は前例が無い**。
- **置き場の候補**:
  - a(推奨). 新規 1 本 `src/mind/` の下(例 `stream-wording-pin.test.mjs`、名前は仮)に、①への行・②④の固定の指示と頼み・`skills/recall.md` を配信の語で差した本文・思い出しの結果の文面・判定の入力をまとめる。書き写しが散らばらず、完了条件の「固定テストが通る」を 1 ファイルで言える。既存テストを触らないので「期待値を変えた既存テスト 0」も言いやすい。前例の分け方(ドメイン単位の新規ファイル `cockpit-server-domain-e.test.mjs`)に合う。長い本文(`recall.md`)はテスト内の文字列として持つか fixture ファイルにする(前例: `src/voice/fixtures.mjs`)。
  - b. 既存の `memory.test.mjs`・`recall.test.mjs`・`fire-injection.test.mjs`・`speak-now.test.mjs`・`comment-react.test.mjs` にそれぞれ足す。関数の隣にあるが、書き写しが 5 か所に散る。
- **入力の文字列**: 「配信の場面の転写」を 1 つ決める(you / soul / viewer(名前)・名前の無い viewer・窓の外の行・空白の名前を含む)。使う関数: ① `formatFireInjection`(`fire-injection.mjs:86`)・`formatFireInjectionSince`(:154)、② `formatTranscriptForDigest`(`memory.mjs:70`)・`buildWriterRequest`(:180)・`WRITER_SYSTEM_PROMPT`(:169)、④ `formatRecentConversation`(`recall.mjs:74`)・`buildRecallRequest`(:97)・`RECALL_SYSTEM_PROMPT`(:62)・結果の 7 関数(:277-351)、判定 `buildSpeakNowInput`(`speak-now.mjs:143`)・`buildSpeakNowInstructions`(:106)・`buildSpeakNowChoices`(:115)・`buildCommentReactInput`(`comment-react.mjs:103`)・`buildRecallAvoidInput`(`recall.mjs:217`)。
- **書き写しを取るタイミング**: 土台の群の**最初**(Domain A の着手前、HEAD `84df62db` の出力)。A の途中で取ると、A の変更後の文字列を固定してしまう。

## 4. discord.js / @discordjs/voice を差し替える前例と、Domain C・D の偽物の形

### 4.1 事実: 差し替えの前例は無い

- `scripts/probe-discord-receive.test.mjs`(408 行・23 件)は**純関数だけ**をテストする(引数・鍵の読み・ビープの PCM・集計・要約。冒頭に「Discord に繋がない・依存を読まない」と明記)。`discord.js`・`@discordjs/voice`・`opusscript` は `main()` の中で動的 import(`probe-discord-receive.mjs:628-640`)。受信の結線(`speaking` の start → `subscribe` → デコード)は `main()` の中にあり、テストされていない。discord を名前に含むテストファイルはこの 1 本だけ。
- 偽物の前例(形の参考):
  - 耳の音の入口: `ear-pipeline.test.mjs:39-48` が `captureFactory` に `{ restartCount, isDisposed, currentChild, dispose }` を返し、`record.captureOptions.onPcm(…)` に PCM を流す(`vadFactory`・server も偽物)。Discord の受信が耳の `onPcm` に 16kHz モノラルを流すことは、この形でそのまま確かめられる。
  - 再生器: `src/test-support/fake-stream-player.mjs`(`open/write/end/stop/onEvent` を記録し、`started / ended` を手か `autoStart` / `autoEnd` で流す。`speech-streamer.test.mjs`・`fire-orchestrator.test.mjs` などが使用)。Discord 向けの再生器が運び手の約束を守るかは、この偽物と同じ契約のテスト(`speech-streamer.test.mjs` に本物の Discord 向け再生器を差す形)で見られる。
  - ほか `src/test-support/`: `fake-ffmpeg.mjs`・`fake-websocket.mjs`・`fake-voice-engine.mjs`・`fake-clock.mjs`・`ws-double.mjs`。
  - 子プロセスの偽物: `stream-player.test.mjs:20` `makeFakeChild`。

### 4.2 Domain C・D の偽物の候補

試しの `main()` は `joinVoiceChannel / entersState / VoiceConnectionStatus / EndBehaviorType / createAudioPlayer / createAudioResource / StreamType / AudioPlayerStatus` を分割代入している(:640-647)。**この束を引数で受ける形**にするのが、本物に触れずに回す最短の道【推測】。

| 側 | 偽物の形の候補 | 確かめられること | 確かめられないこと |
|---|---|---|---|
| 接続と受信 | `voiceApi`(上の束)と `Client` を注入。偽の `Client`(`login` / `guilds.fetch` / `members.fetch` / `destroy`)と偽の接続(`receiver.speaking` と `connection` は `EventEmitter`、`receiver.subscribe(userId)` は `PassThrough` を返し、テストが Opus のパケットを書く) | 人ごとの購読、`speaking` の start、`AfterSilence` の終わり、名前の取得、鍵の読み・伏せ、入れない・切れたときの状態、`group` にロールの id | 本物の DAVE 復号、頭欠け、入った直後の最初の発言 |
| Opus | 本物の `opusscript`(依存は入っている)で合成音を encode → 部品で decode。または decoder も注入 | 16kHz モノラルに直に落とせるか(設計 §6.2)の**機械側の確かめ**、無音フレーム `F8 FF FE` を捨てる | 実際の声の音質 |
| 耳へ | 偽の `captureFactory` 互換(`onPcm` / `dispose`)に流し、`ear-pipeline.test.mjs` の偽の VAD / server と組む | 行に `you` + 名前 + id で正本に積まれる | 本物の Silero のほぼ無音の扱い(実装で実測) |
| 送信 | 偽の `AudioPlayer`(`EventEmitter` + `play(resource)` / `stop()` / `state.status`)と `createAudioResource` の偽物。resource の `Readable` から PCM を回収して「48kHz ステレオになっているか」「24kHz は 2 回ずつ左右同値」「44.1kHz → 48kHz の変換」「`end()` で閉じる」を見る | 運び手の約束(`open/write/end/stop/onEvent`)、`started / ended / stopped / error` の合図 | **100ms の途切れで Idle になる本物の挙動**、AutoPaused、網の遅れ。偽物は再現が弱いので、設計 §7.3・§7.4 は人間ゲート 2 の実機に回す |

置き場: 偽の Discord は `src/test-support/fake-discord.mjs`(仮)が前例(`fake-*.mjs` の並び)に合う。

### 4.3 本体のテストで依存を読むか

- `node --test` は依存が入っている前提(`package.json` に 3 つとも固定の版)。ただし**配信だけのときは読み込まない**(設計 §4.4)ので、`src/discord/` の純関数・注入の口は discord.js を静的 import せず、動的 import は体験の口の 1 か所に閉じる。`pnpm run check:soul-zone` は import の向きだけを見る(影響なし、確認済み)。
- `no-sherpa-in-parent.test.mjs:21`・`:78` が `scripts/cockpit.mjs` の import の木を読む前例。discord.js が配信の起動の import の木に入らないことを同じ型で固定できる【推測】。

## 5. 言葉の差し口の今の文字列の在りか

### 5.1 ②④・語の組の対象(行は HEAD)

| 文面 | ファイル:行 | 「配信」の行(コメント行を除く) |
|---|---|---|
| ②の固定の指示 `WRITER_SYSTEM_PROMPT` | `src/mind/memory.mjs:169-172`(「配信の相方 AI の記憶の置き場」:170) | 1 |
| ②の頼み `buildWriterRequest` | `memory.mjs:180-`(今回の配信の本体 :184・:187・:192・:201、「配信の記録」:189、「配信の日付」:191、「今回の配信に当たる行」:202、材料の説明 **:207**「配信の文字起こし。you = 配信者、soul = 相方の AI 自身、viewer = 視聴者のコメント。…」) | 9(`memory.mjs` の非コメント行は計 10、配信者 1) |
| ④の固定の指示 `RECALL_SYSTEM_PROMPT` | `src/mind/recall.mjs:62-65`(:63) | 1 |
| ④の頼み `buildRecallRequest` | `recall.mjs:97-`(「過去の配信の記録」:99、説明の行 **:112** `you = 配信者 …`) | 2 |
| 思い出しの「避けるか」の判定 | `recall.mjs:205`(「配信者の隣にいる AI Tuber」)・`:229`(`配信者: ${text}`) | 2(判定。設計 §3.4 末尾 = Discord の文面は E) |
| 思い出しの結果を①に渡す文面 | `recall.mjs:277-351`(「過去の配信の記録」:280・:292・:304・:316・:329) | 5 |
| `skills/recall.md` | :5 「過去の配信の記録を思い出したい…」、:8 「配信者に『思い出して』…」(:3 は見出し欄で①に入らない) | 2(+ 見出し欄 1) |
| `_conventions.md` の種 | `src/memory/conventions-seed.md`(8 か所)。チャッピーの `memories/chappy/_conventions.md` は設計が「8 か所」と書く(開いていない) | 8 |
| 判定(speak-now) | `speak-now.mjs:54`(`SPEAK_NOW_HOST_LABEL = "配信者"`)・:72(相槌の指示)・:82(問い「ゲーム配信で配信者の隣に…」)・:119・:124・入力 :135-170 | 8(配信者 7) |

### 5.2 語の組の対象外(同じ語があっても替えない所)

- `comment-react.mjs`(非コメント行の配信 4・配信者 3)、`comment-guard.mjs`(4・3)= コメントは Discord では作らない。
- `fire-orchestrator.mjs:213`(ロールの既定の会話指示)・`:194`(「未配信部分」)、`context-compactor.mjs`・`fire-scheduler.mjs`・`soul-skills.mjs` はコメントのみ。`scripts/probe-decisions-*.mjs` は観測用。
- 画面の「配信」(`ui/*`・`view-logic/*`)は F の範囲(語の組ではない)。

### 5.3 出現数

- `src/`・`scripts/`・`skills/` の非テスト全体: **「配信」666 か所・「配信者」83 か所**(コメント・画面・観測用を含む)。
- LLM に渡る文字列で語の組の対象になるもの(`memory.mjs`・`recall.mjs`・`speak-now.mjs`・`skills/recall.md`、コメント行を除く): 「配信」**約 32 か所**(memory 10・recall 11・speak-now 8・recall.md 3)、うち「配信者」**12 か所**(1 + 3 + 7 + 1)。
- 既存テストが配信の語を期待値に持つ数は §3.2 のとおり(合計 27 か所)。

## 6. 鍵の読み方の前例と置き場の候補(鍵のファイルの中身は読んでいない)

- 前例(コードのみ読んだ): `loadElevenLabsApiKey`(`src/ears/elevenlabs-stt.mjs:103`、`options.path` と `readFileImpl` を注入、`parseEnv`、`{ ok, apiKey } | { ok:false, reason }`、理由に値を入れない)、`loadDecisionsApiKey`(`src/mind/speak-now-decisions.mjs:72`)、`loadDiscordBotToken`(`scripts/probe-discord-receive.mjs:121-141`)。**3 つとも使い手のモジュールの中に同じ形で書かれ、`parseEnv` を 3 回呼んでいる。共通の鍵読み部品は無い。** サーバは `elevenLabsApiKeyProvider`・`decisionsApiKeyProvider` のように読み口をオプションで注入し(`cockpit-server.mjs:775`・:815)、テストは読み込みを差し替える。
- `.gitignore`: `apps/soul/agent/.gitignore:50` の `.env*.local` に `.env.discord*.local` も入る。
- 置き場の候補:
  - a(推奨). `src/discord/discord-token.mjs`(仮)。使い手(Discord の部品)の隣、`loadDiscordBotToken` の移し先(設計 §5 のとおり)。引数にファイル名を取り、`apps/soul/agent/` 直下の `.env.discord*.local` に合う名前だけ受け付ける検証(パスの区切りを含む値は断る)はここに置く。前例の「使い手の隣に置く」流儀に合う。
  - b. 共通の `src/env/load-env-secret.mjs`(仮)に 3 つ目まで束ねる。前例の 3 つに触るのは今回の範囲外(Discord の群が配信の鍵読みに触れる)。
  - c. `src/roles/` に置く。鍵の**指し先**(ファイル名)の正規化は `role-store.mjs:139` の `normalizeRole` に入れるのが自然だが、読む部分までは置かない。
- 読み口の注入: `cockpit-server` の他の鍵と同じく、体験の口か `scripts/cockpit.mjs` が `loadDiscordBotToken` を呼び、`tokenProvider` を `src/discord/` に渡す形が前例に合う。**ロールの `discordBotKeyFile` を `role.json` に入れるときは、鍵の中身がロールにも設定にも入らない**ことを `role-store.test.mjs` で固定する(設計 §5・§10)。
- 試しのテスト(`probe-discord-receive.test.mjs:76-122`)は「一時ディレクトリの偽ファイル」で読み、`process.env` を変えないことを確かめる。同じ型を移し先に引き継げる。

## 7. 前例の規模と今回の見込み

### 7.1 前例(配信の組み直し、`git diff --shortstat <c>^ <c> -- apps`)

| コミット | ファイル | src(+/-) | test(+/-) | テストの増加 |
|---|---|---|---|---|
| `38084596` Domain A ロール | 26(src 16・test 10) | +1368 / -465 | +1025 / -355 | +19(1713 → 1732) |
| `15bf9570` Domain B 記憶 | 11(6・5) | +557 / -54 | +641 / -1 | +26 |
| `7e9a04b0` Domain C 体なし | 15(8・7) | +199 / -45 | +627 / -0 | +24 |
| `8eff48cf` Domain D 場 | 16(9・7) | +1022 / -211 | +1371 / -48 | +35 |
| `1a585775` Domain E 画面 | 26(15・11) | +1378 / -536 | +1402 / -79 | +50 |
| `19e53770` 全体の突き合わせの仕上げ | 11(7・4) | +328 / -80 | +439 / -10 | +12 |
| `aedd2553` 人間ゲート前の直し | 4(1・3) | +80 / -18 | +343 / -5 | — |

### 7.2 今回の見込み(**すべて【推測】**。新規モジュールか既存の組み替えか、既存テストの差し替えの量で決めた幅)

| Domain | src の増減の見込み | test の増の見込み | 件数の見込み | 近い前例と理由 |
|---|---|---|---|---|
| A 正本・話者 | +250〜450 / -100〜200 | +500〜900(既存の差し替え 100〜200 を含む) | +15〜25 | 前例 B(記憶)と C(体なし)の間。置き換えは機械的だが、偽の耳 60 か所と固定テストが重い |
| B 場と体験・言葉の差し口 | +700〜1100 / -300〜500 | +900〜1500 | +30〜45 | 前例 D(場)級かそれ以上。**体験の口・ロールの束・声と目の段の移動・API・語の組・教えの口の 3 塊を含む**。語の組だけ切り出せば src +200〜300 / test +300〜500 |
| C Discord の入口 | +800〜1200(ほぼ新規) | +800〜1300 | +30〜50 | 前例 A(新規モジュール型)より小さい。偽の Discord が新規 |
| D Discord の出口 | +400〜700 | +500〜900 | +20〜35 | 前例 C より大きい(変換と再生器が新規) |
| E 判定と言葉 | +300〜500 | +400〜700 | +20〜30 | 前例 B 級の下。注入口と文面が中心 |
| F 画面 | +400〜700 / -50〜150 | +400〜700 | +20〜35 | 前例 E(組み直し)の 1/3〜1/2。足すだけだがタブの数の固定テストが変わる |
| 全体の突き合わせ・仕上げ(ゲート 1 の後・ゲート 2 の前に各 1) | 計 +300〜600 | 計 +400〜800 | +10〜25 | 前例の突き合わせ + 直し |

- テスト合計の見込み: **+150〜250 件**(1884 → 約 2030〜2130)。1 回の `node --test` は 92 秒 → 100〜130 秒の見込み。
- 期待値を変えた既存テストの見込み: A で 1(`chatBufferAbsent`)〜数件(偽の耳を直す分は準備の変更で、期待値は変わらない)、B で 0 を目指す(`cockpit-ui.test.mjs` のタブの数は F で変わる)。F で 5〜15 件(タブの id の並び・パネルの数ほか)。

## 8. 未確認のこと(実装で確かめる。設計 §12.3 に重ならないもの)

- 偽の Discord が `@discordjs/voice` の本物の挙動(AutoPaused・100ms の Idle・`maxMissedFrames`)をどこまで再現するか。再現が弱い所は人間ゲート 2 に回る【推測】。
- Silero VAD がほぼ無音の発言を弾くか、`opusscript` の直の 16kHz モノラルの音質(設計 §12.3 と同じ・実機)。
- `memories/chappy/_conventions.md` の「配信」が設計どおり 8 か所か(開いていない)。
- `scripts/cockpit.mjs` の `main()` の中で、Discord の体験の口を渡す結線のテストの型(模写ハーネスか、束を作る関数の export か)。前例は両方ある。

## 9. 質問(Undine が wave 計画で決める点)

1. **B を分けるか**: B は「体験の口・ロールの束・声と目の段」「API と snapshot」「語の組と教えの口」を含み、前例の最大級になる見込み(§7.2)。語の組(②④・recall.md・結果の文面・①の教えの口)を B2 として分ければ、B1 は cockpit-server / cockpit.mjs、B2 は src/mind/ + skills/ で**ファイルがほぼ分かれる**(B2 は A と同じ memory・recall を触るので A の後)。ゲート 1 の前に 3 つの Domain になる。
2. **判定の差し口(`speak-now.mjs` への問い注入、設計 §8 b)を E に置くか B に前倒すか**: 設計では E に置く(§11)。しかし注入口を足すと配信の `speak-now.mjs` が組み替わるのに、**人間ゲート 1 の後**になる。設計 §11 の B の理由(「配信の文面に触る組み替えは配信の固定テストと人間ゲート 1 に守られる所で済ませる」)を判定にも当てるなら B(または B2)に前倒す。E は Discord の文面を差すだけになり、E と F はさらに独立する。
3. **A の「積む口」と `onAppend` の持ち主**(§2.9-1)と、**偽の耳 60 か所の直し方**(§3.2): 偽の耳が `options` から正本を受け取る形にすれば `record.buffer` 65 か所は同じ参照で動く見込み【推測】。`chatBufferAbsent`(1 件)の期待値を変えるか、場が閉じている間だけ「正本が無い」を残すか。
4. **人ごとの耳の集合を、サーバから 1 つの耳に見せるか**: サーバの `pipeline` は正本以外では寿命(`dispose`)と `userSpeaking`(:954・:3697)にしか使われない(§2.1)。人ごとの耳を束ねた 1 つのオブジェクトにすればサーバの変更は小さい。設計 §4.3「入口を開く」の戻りの形。
5. **「サーバー・チャンネルの一覧を読み込む」(Bot にログインして一覧を取る)の API と部品は C か F か**: 設計は §9(画面)に書くが、Bot のログインと API は C の部品の延長。F を画面だけにしたい(E と並べたい)なら C。
6. **鍵のファイル名(`discordBotKeyFile`)を画面で編集できるようにするか**、`role.json` を手で書くだけにするか(最初の的は 1 ロール・既定 `.env.discord.local` なので後者でも動く)。
7. **固定テストの置き場と最初に書き写すタイミング**: §3.3 の a(新規 1 本)と、A の着手前に HEAD の出力を取ること。
8. **E と F を並べるか**: 並べられる(§2.8)。並べるなら、E の開始前に snapshot の項目名(方式の固定・`experience`・Discord の接続状態)を計画に書く。テストはドメインごとの新規ファイルにする。
9. **体制**: 前例どおり Orch-Sylph(opus)+ Gnome(opus)+ Review-Sylph(sonnet 1 レーン)をドメインごとに、全体の突き合わせは opus 1 回、順に作る、で足りるか。ゲート 1 とゲート 2 のあいだの「結果を書く docs コミット」と、Discord の群の計画を同じ計画書の中に置くか分けるか。
10. **ドメインの数え方**: 設計の A〜F を踏襲するか(B を分けるなら記号の振り直し)。前例は計画を通して A, B, C… と続ける。
