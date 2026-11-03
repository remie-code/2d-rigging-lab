# 棚卸し: 「体験(Discord の場)」と「VC 接続」を分けるための、今のコードの事実

> 調査: Sylph(2026-11-01)。呼び出し元: Undine。読むだけ(ソース・テスト・設定・記憶・ほかの discussion は変えていない)。
> 行番号はブランチ `ai-cohost/discord-mode` の HEAD(6bf7cd65)の作業ツリー。パスは `apps/soul/agent/` からの相対。
> 決まった変更は [human-gate-2-result.md](human-gate-2-result.md) §2。会話の中身・人の名前・Discord の id は書かない。
> テスト: `node --test scripts/cockpit-stream.test.mjs src/discord/discord-experience-discord-e.test.mjs src/cockpit/cockpit-server-discord-d.test.mjs src/cockpit/cockpit-server-discord-g.test.mjs` は 65/65 合格(偽物だけ・実データに触れない)。

## 0. 要点(先に)

- 今の Discord の入口は、**ログイン(client)と VC 接続(connection)と人ごとの耳と出口を、1 つの「今の VC の 1 回分」(`s`)にまとめて持ち、まとめて畳む**(`src/discord/discord-experience.mjs:302`・`:628-664`)。分けるには、この `s` を「体験の分(client・guild・部品)」と「接続の分(connection・receiver・人・出口)」に割るのが中心の作業になる。
- 頭のセッション・会話の正本・判定・目・記憶は、もともと場(cockpit-server / cockpit.mjs)の側にあり、Discord の入口は持っていない。VC を抜けるだけなら、これらはそのまま持てる。
- 危ない所が 1 つある: **出口を畳むと、再生器の差し口が空になり、声が手元のスピーカーに戻る**(`scripts/cockpit.mjs:2504`・`:2772-2777`)。どの VC にもいない間に手動の Fire・思い出しの発火・遅れて返った判定が来ると、手元の再生器を作って手元で鳴らす。今は「場を閉じる = 出口を畳む」なので起きないが、分けると起きる。
- 「切れた」(`disconnected`)は今、Ready 以外をみな「切れた」と出すだけで、何もしない(`discord-experience.mjs:615-622`)。キック・移動(閉じのコード 4014)はライブラリがつなぎ直さないので、その場合は永久に「切れた」のまま。
- VC 一覧は、場の間は 409 で断り(`src/cockpit/cockpit-server.mjs:3062-3065`)、使うたびに**別にログインする**(`discord-experience.mjs:952-1004`)。場の中で使うなら、ログイン済みの client の guild から取る形が素直。人数は `guild.voiceStates.cache` から数えられる(特権 Intent 不要)。
- 自発・かぶりのつまみは**運転の設定**(ロールではない・`cockpit-settings.local.json`)で、**場の間も今すでに切り替えられる**(`cockpit-server.mjs:3363-3403`・段の確かめが無い)。見る窓は場の間は 409。手動の Fire は Discord の場でも使え、自発オフでも撃てる(§7)。
- 途中保存のタイマーは `createStreamVenueHooks` を直せば配信にも同じく効く(配信と Discord で同じ口を使っている)。
- 判定・発火の記録は `session-usage`(場ごと 1 ファイル・20 個残す)に `type` を足すのが一番手間が少ない。`fire-diagnostics` は発火の間しか書けず 5 件しか残らないので向かない。

---

## 1. 場に結びついているもの(作る段・捨てる段)

### 1.1 場の開く・閉じる(`cockpit-server.mjs` の `openStream` `:2739` / `closeStream` `:2851` / `foldStream` `:2557`)

| もの | 持ち主 | 作る段(開く) | 捨てる段(閉じる) |
|---|---|---|---|
| ロールの一覧を固める | server `venueRoles` | 1. `:2747-2748` | `markVenueClosed` `:2708-2715`(`:2899`) |
| 場の記録(記憶の本体の名前・session-usage のファイル・置き場) | cockpit.mjs `createStreamVenueHooks.renewRecords` `scripts/cockpit.mjs:1103-1110`(`renewUsageLog` `:3080-3084`・`memoryPlaces.beginStream`) | 2. `:2768` | 作り直すだけ(捨てない)。次の場の 2 で替わる |
| KILL を OFF・`revive` | server `killed` | 3. `:2771-2776` | 替えない |
| 判定(speak-now・コメント反応)のコントローラ | server `renewJudges` `:2502` | 3. `:2777` | `parkJudges` `:2570`(dispose・結果は無視) |
| 発火の予定(fire-scheduler) | server | 3. Discord は `parkFireScheduler`(畳んだまま・自発/口数の値の置き場だけ)`:2781`、配信は作り直す `:2782` | `parkFireScheduler` `:2571` |
| 思い出しの係 | server `renewRecallDesk` `:2542` | 3. `:2783` | `parkRecallDesk` `:2572` |
| 会話の正本 `venueTranscript`(+ 追記・破棄の購読) | server `openVenueTranscript` `:2365-2392` | 4. `:2785` | 写し `:2865` → `closeVenueEntrance` の頭で `releaseVenueTranscript` `:2449`(`:2395-2405`) |
| 入口の下見(Discord: 準備・鍵・文字起こしのキー) | 体験 `prepareEntrance` | 5 の前半 `:2788` | 開かないとき `abortEntrance` |
| 声の engine の用意(ロールごと) | cockpit.mjs `voiceEngines.prepare` | 6 の前半 `prepareVenueVoices` `:2793`(`:1211-1226`) | 捨てない(プロセスの間生きる) |
| 入口を開く(Discord: ログイン・VC・耳の束・出口) | 体験 `openEntrance` | 5 `:2807` | `closeVenueEntrance` → `closeEntrance` `:2451`(`:2586`) |
| 耳の束(`pipeline`) | server。Discord は入口が `venue.createEars()` で作り、`{ ears }` で返す | `:2809`(`opened.ears` を `pipeline` に) | `foldVenueEars` `:2430-2440`(`:2450`) |
| 手元の再生器 / 声の差し替え口 | cockpit.mjs `ensureVoiceResources` `:2772-2803`(束の `voice.startResources`) | 6 の後半 `startVenueVoiceResources` `:2811` | 畳まない(プロセスの間・デバイス替えで作り直す) |
| 目(常駐の撮る係) | cockpit.mjs `residentCapture`(`onEyesStart/Stop` `:3356-3357`) | 7 `startVenueEyes` `:2812`(`eyesWanted` が偽なら起こさない `:2414-2418`) | `stopVenueEyes` `:2585` |
| 頭のセッション(Codex など) | cockpit.mjs `openStreamSession` `:2761-2764` → `disposeSession` + `ensureSession` `:2673` | 8 `:2814` | `closeSession` `:2588` → `disposeSession` `:2742-2755` |
| 器(体があるとき) | cockpit.mjs `lazyChannel` | 9 `:2817` | `closeBody` `:2589`(いつも呼ぶ) |
| 開いたあと(配信: YouTube) | 体験 `afterOpen` | 10 `:2823` | `foldAfterOpen` `:2569` |
| 鳴っている返事 | orchestrator | — | `kill()` `:2574-2582`(KILL の表示は替えない) |
| 記憶の最後の保存 | cockpit.mjs `saveFinal` `:1144-1150` | — | `:2871`(待つ・上限 90 秒) |
| 20 分ごとの途中保存のタイマー | cockpit.mjs main | **起動時に 1 回** `setInterval` `scripts/cockpit.mjs:3107-3110`(§4) | 止めない |

- 開けなかったとき: `fail` `:2753-2765` が `foldStream({ chat:false, ears, session })` → 正本を手放す → 閉じた状態に戻す。`foldStream` は `closeBody` を `what` に関わらず呼ぶが、`closeSession` は `what.session` のときだけ(`:2588-2589`)。
- サーバを閉じる(`close()` `:4949-4962`): 正本 → 耳の束 → `closeEntrance({ shutdown:true })` → 目。記憶は頼まない(Ctrl+C は先に `endStreamForShutdown` `:2916` で `closeStream`)。

### 1.2 Discord の口(`src/discord/discord-experience.mjs`)が持つもの

`afterOpen` / `foldAfterOpen` は**持たない**(配信の口だけ。`cockpit-server.mjs:262-267` は無ければ何もしない)。

| 口 | 持つもの・すること |
|---|---|
| `prepareEntrance` `:679-739` | 先頭のロールの id(= VC の `group`)・保存した準備(サーバー・ボイスチャンネル・方式)・鍵(ここで読む・`plan.token`)・`control.prepareEars(engine)`(場の耳の状態を「起こしている途中」・`earPlan`)。ログインしない |
| `abortEntrance` `:745-752` | `control.stopEars()`・接続の状態を null |
| `openEntrance` `:759-910` | 前の `session` があれば畳む `:760` → `s` を作る `:770-790`(`plan` から鍵を外して写す)→ 部品を動的 import `:808` → **ログイン** `:817`(`loginClient` `:378-391`・Intent は Guilds と GuildVoiceStates)→ guild・channel を確かめる `:829-850` → **`joinVoiceChannel`** `:855-862`(`group` = ロールの id・`selfDeaf:false`)→ `error` / `stateChange` を聞く `:866-869` → Ready を待つ `:871` → `readyOnce = true` → **耳の束** `venue.createEars()` `:878` → `receiver.speaking` の start を聞く `:880` → client の `VoiceStateUpdate` を聞く `:881-883` → **出口** `outletFactory({ connection, voice, groupId })` `:887-898`(既定はロールの束の `voice.openOutlet` = `venuePlayers.open` → `createDiscordStreamPlayer`)→ `"joined"` `:899` → `venue.earsListening()` `:901` |
| 人ごと(話し始めで作る) | `ensurePerson` `:417-479`: デコーダ・音の入口・耳(`venue.createEar` → 束に `discord-<n>` で `add`)・名前の取得・whisper の口の番号(`slot`)。`handleSpeakingStart` `:543-581`: `receiver.subscribe(userId, AfterSilence 500ms)` |
| 人が抜けた | `handleVoiceState` `:587-609`: **`s.plan.channelId` から抜けた人だけ**を見て、購読・デコーダ・耳を外す |
| `closeEntrance` `:916-931` | `teardown(s)` → 接続の状態を null → `control.stopEars()` |
| `teardown` `:628-664` | 聞いていた口を全部外す(`s.offs`)→ 人を全部畳む → **耳の束を dispose** → **出口を dispose** → **接続を destroy** → **client を destroy(ログアウト)** → `session = null`。冪等(`s.closed`) |
| `connectionStatus` `:1046` | `"joining" | "joined" | "disconnected" | null`(snapshot の `stream.connection` `cockpit-server.mjs:1490`) |
| `voiceConnection` `:1053` | 今の接続(Ready を一度でも通った間だけ) |
| `catalog` `:952-1004` | **自分でログイン → 一覧 → ログアウト**(場の client とは別) |
| `eyesWanted` `:1051` | 見る窓が選ばれているか(場を開くときに 1 回読む) |

### 1.3 出口(`scripts/cockpit.mjs`・`src/discord/discord-stream-player.mjs`)

- `createVenuePlayerSlot` `scripts/cockpit.mjs:1318-1361`: 差し口 1 つ。`open(info)` で前の再生器を畳んで新しい再生器を置く、返り値の `dispose` で畳んで空にする。main の `venuePlayers` `:2500-2502`。
- `createDiscordStreamPlayer` `src/discord/discord-stream-player.mjs`: 作るときに `createAudioPlayer({ noSubscriber: Pause, maxMissedFrames: 75 })` `:135`、**その接続に `connection.subscribe(player)`** `:182`。dispose `:333-351` で止めて購読を外す。接続を引数で受け取るので、**接続 1 つにつき再生器 1 つ**の作り。
- 声を出す先 `activePlayer = () => venuePlayers.current() ?? player` `scripts/cockpit.mjs:2504`。`ensureVoiceResources` `:2772-2803` は、差し口が空なら**手元の再生器を作る**。

---

## 2. 分けるときの切れ目

### 2.1 「VC 接続だけ」を抜く / 張り直すときに作り直しが要るもの

| もの | 今の持ち方 | 抜く・入るとき |
|---|---|---|
| voice connection | `s.connection`(`joinVoiceChannel`) | 作り直す(または同じ接続のまま移す・§2.4) |
| 接続のイベント(`error` / `stateChange`) | `listen(s, …)` → `s.offs` | 接続を替えるなら付け直す |
| `receiver`・`speaking` の start の購読 | `s.receiver` `:879-880` | 接続を替えるなら付け直す(同じ接続で移るなら同じ `receiver`・ライブラリ `index.js:2227`) |
| 人ごとの購読・デコーダ・音の入口・耳 | `s.people` | 抜けるときに全部畳む(`releasePerson` + 束から `drop`) |
| 耳の束 | `s.ears` = server の `pipeline` | 下の 2.3 |
| 出口(Discord 向けの再生器) | `s.outlet` = 差し口 | 接続ごとに作り直す(`connection.subscribe` が作るときだけ・§1.3) |
| 接続の状態(`readyOnce`・`connection`) | 入口の変数 | 「どの VC にもいない」を表す値が今は無い(§2.2) |
| 場の耳の状態(`earsState`・`startedAtMs`・health・`venueSttEngine`) | server `markVenueEarsListening` `:1876-1882` / `stopVenueEars` `:1856-1874` | `stopEars` は**場の間だけの文字起こしの方式(`venueSttEngine`)も null に戻し**、稼働時間(`startedAtMs`)も消す。抜けるたびに呼ぶと snapshot の文字起こしの方式が配信のものに見える |

### 2.2 そのまま持てるもの

- client(ログイン)・guild・部品(`libs`・`OpusScript`)・`botId`: どれも接続に依らない。ただし今は `s` に同居していて `teardown` が client まで destroy する(`:662`)ので、持ち場を割る必要がある。鍵は `plan.token` でログインに 1 回使うだけで、`s.plan` には写さない(`:771-772`)。入り直しに鍵は要らない(同じ client を使うなら)。
- client の `VoiceStateUpdate` の購読: client に付くので持てる。ただし中で `s.plan.channelId`(開いた時の VC)と比べている(`:593-594`)ので、今いる VC を見る形に替える必要がある。
- 頭のセッション・会話の正本・判定・発火の予定(畳んだもの)・思い出しの係・目・記憶: 場の側で、Discord の入口は触れない。VC を抜けても残せる(場の段を通さなければ)。

### 2.3 耳の束の扱い(server との結び目)

- server が耳の束を受け取るのは `openStream` の `:2809` の 1 回だけ。束は `add` に dispose 済みなら投げ、同じ key も投げる(`src/ears/ear-bundle.mjs:46-49`)。`drop(key)` で 1 本外して畳める(`:60-63`)・`dispose` は冪等(`:105-112`)。
- 道は 2 つ: (a) 束は体験の間 1 つのまま、抜けるときは人の耳を `drop` するだけ(server は何も知らなくてよい)。この場合 `discord-<n>` の番号(`s.seq`)と `slot` は体験の側で持つ。(b) 接続ごとに束を作り直す。その場合 server の `pipeline` を差し替える口(今は無い)が要る。`pipeline.userSpeaking()` は圧縮の隙間(`:4764`)が読む。

### 2.4 「切れた」(disconnected)の今の扱いと、「自分で抜けた」との区別

- 今: `handleConnectionStatus` `:615-622`。Ready を一度通った後は、**Ready なら joined、それ以外(Signalling・Connecting・Disconnected・Destroyed)はみな disconnected**。何もしない(場は閉じない・ライブラリのつなぎ直しに任せる、設計 §6.1)。画面は「VC から切れた(つなぎ直しを待っている)」(`src/cockpit/view-logic/discord.mjs:55-59`)。テストは `cockpit-server-discord-d.test.mjs:484`。
- ライブラリ(@discordjs/voice 0.19.2)の実際: 音声の WebSocket が閉じたとき、**閉じのコードが 4014 以外ならつなぎ直す**(Signalling に戻して join を送る)。**4014(キック・チャンネルの削除・移された)なら Disconnected のまま、つなぎ直さない**(`node_modules/@discordjs/voice/dist/index.js:2395-2418`)。公式の勧めは「Disconnected になったら 5 秒 Signalling / Connecting を待ち、来なければ destroy」だが、今の入口はそれをしていない。つまりキックされると、場は開いたまま接続は永久に Disconnected で残る。
- 誰かが Discord の画面で Bot を別の VC へ動かしたとき: ライブラリは新しい VC の状態を受けて `joinConfig.channelId` を書き換え、つなぎ直す(`index.js:2316-2321`・`:2298-2309`)。ただし入口の `handleVoiceState` は開いた時の VC を見続けるので、動かされた先の人が抜けても耳を外さない。Bot 自身の入退室は見ていない(`userId === s.botId` で返す `:592`)。
- 「自分で抜けた」との区別に要るもの: 今の `teardown` は**接続を destroy する前に `stateChange` の購読を外す**(`:631-637` → `:655-661`)ので、自分で抜けたときは「切れた」にならない。分けたあとも、(1) 抜ける前に接続の購読を外す、または (2) 「自分で抜けている途中」の印を接続の分に持つ、のどちらかが要る。外から抜けた理由はライブラリの状態に載る: `state.reason`(0 = WebSocketClose・1 = AdapterUnavailable・2 = EndpointRemoved・3 = Manual)と `state.closeCode`(4014 など)。区別するなら `stateChange` の新しい状態を見る。

### 2.5 同じ client で別の channel へ入り直すときに障害になりそうな所

1. **一度きりの前提**: `openEntrance` は最初に前の `session` を畳む(`:760`)= ログアウトも含む。`readyOnce` は `s` ごと(最初の Ready まで状態を見ない)。`setConnection(null)` は失敗の道で必ず呼ぶ。
2. **ライブラリの接続の使い回し**: `joinVoiceChannel` は、同じ guild + group の接続が destroy されずに残っていれば**新しく作らずにそれを返す**(Disconnected なら `rejoin`、それ以外は join を送り直して移す・`index.js:2659-2677`)。destroy してから入り直すなら新しい接続になる。**同じ接続のまま移る**こともでき(`connection.rejoin({ channelId })` か `joinVoiceChannel` を呼び直す)、そのときは `receiver` と出口の購読(`subscription`)は同じ物のまま。どちらを取るかで付け直す物が変わる。
3. **テストの偽物**: `src/test-support/fake-discord.mjs:228-240` の `joinVoiceChannel` は**毎回新しい接続を作る**(使い回しの振る舞いが無い)。同じ接続で移る道を取るなら、偽物に足す必要がある。
4. **dispose**: 耳の束(§2.3)・出口の再生器(dispose 後の `open/write/end` は投げる `discord-stream-player.mjs:186`)・デコーダは作り直し。差し口 `open` は前の再生器を畳んでから置き換えるので、作り直しはそのまま使える(`scripts/cockpit.mjs:1347-1352`)。
5. **イベントの付け直し**: `listen` は `s.offs` に外す口を積むだけ。接続の分と client の分で `offs` を分けないと、抜けるときに client の `VoiceStateUpdate` まで外れる。
6. **ポートの再利用**: whisper の耳は人ごとに `whisperPortOffset = slot`(空いている一番小さい番号・`:405-411`・server `:2106-2107`)。whisper の dispose は kill して待たない(`src/ears/whisper-server.mjs:33`・`:298`)。抜けてすぐ入り直すと、前の whisper が港を放す前に同じ番号で起こす恐れがある【推測。今も「閉じてすぐ開く」で同じ。抜ける・入るが速くなる分起きやすい】。ElevenLabs は人ごとに 1 接続なので、入り直すたびに接続を作り直す。
7. **プロセスに 1 つの接続表**: ライブラリは接続を guild + group の表で持つ(`trackVoiceConnection`)。destroy すれば表から外れる(`index.js:2502-2515`)。同じ group で destroy しないまま新しい接続を作ろうとすると 2 の使い回しになる。
8. **画面・snapshot の語彙**: `VENUE_CONNECTION_STATES` は 3 つだけ(`cockpit-server.mjs:186`)で、知らない値は null に揃える(`:227-230`)。「どの VC にもいない」を出すには語を足す(画面 `discord.mjs:55-59`・`:104-113`、テスト `cockpit-server-discord-g.test.mjs:446`)。snapshot には準備の id を載せない作り(同テスト)なので、今いる VC の名前を出すなら名前だけを別に載せる。

---

## 3. 操作パネルの材料

### (a) VC 一覧

- 今の道: `POST /api/discord/catalog`(`cockpit-server.mjs:3267-3270` → `handleDiscordCatalog` `:3056-3078`)→ 入口の `catalog` `discord-experience.mjs:952-1004`。**今のロールの鍵で毎回ログイン → 全サーバーとボイスチャンネル → ログアウト**。**Discord の場の間は 409**(`:3062-3065`・テスト `cockpit-server-discord-d.test.mjs:841`)。返すのは `{ id, name, channels: [{ id, name }] }`(並び順つき・ステージは除く)。
- 場の間に使うなら、場の client を使い回すのが素直: `s.guild.channels.fetch()` で同じサーバーの VC だけ取れる(サーバーの一覧は要らない)。別にもう 1 本ログインする道もあるが、同じ Bot で 2 本目のゲートウェイの接続になる【Discord 側が許すかは未確認】。
- 人数: 出せる。discord.js 14.27 の `VoiceChannel#members` は `guild.voiceStates.cache` から作るが、メンバーの cache が無い人は抜ける(`node_modules/discord.js/src/structures/BaseGuildVoiceChannel.js:99-107`・`VoiceState.js:138-140`)。**数だけなら `guild.voiceStates.cache` で `channelId` が一致する数**が確実(GuildVoiceStates の Intent はもう付けている)。名前の一覧は出さない(ゲート 2 の決定)。

### (b) 「自発的にしゃべる」と「かぶり判定」

- API: `POST /api/self-fire` `cockpit-server.mjs:3363-3382`(`fireScheduler.setEnabled`)・`POST /api/barge-in` `:3384-3403`(`bargeInGate.setEnabled`)。**どちらも段(場の開閉)を見ない = 場の間も今すでに替えられる**。口数(`:3405-3436`)と話し始め(`:3438-3471`)は場の間 409(ロールの持ち物)。
- 保存先: `cockpit-settings.local.json` の自発・かぶり(`scripts/cockpit.mjs:663-721` の `createSelfFireHooks` / `createBargeInHooks`・`src/cockpit/cockpit-settings-store.mjs:17-24`)。**運転の設定**で、ロールの設定ではない。配信と Discord で同じ値を共有する。
- Discord での効き方: 発火の予定は畳んだままで値の置き場だけ(`:2781`)。自発は speak-now の `isActive` が読む(`:4116-4117`)= オフの間は判定しない。思い出しの係も `isSelfFireOn` で見る(結果を黙って次の ask に前置き)。かぶりは機械弁が読む。
- 画面: 準備・設定の「運転」タブの `DrivePanel`(`src/cockpit/ui/control-bar.mjs:213-325`、自発・かぶりのトグルと Fire のボタン)。メイン画面には操作部品が無い(下の帯は表示だけ)。トグルは段で disable しない(`src/cockpit/view-logic/control.mjs:120-131`・`:270-281`)。パネルに置くなら同じ POST を呼ぶ部品を再利用できる。

### (c) 見る窓

- 置き場: `discordVisionTarget`(`cockpit-settings.local.json`)。API `GET/POST /api/discord/vision-target` `cockpit-server.mjs:3014-3049`。**Discord の場の間の POST は 409**(`:3032-3035`・テスト `cockpit-server-discord-g.test.mjs:277`)。
- 発火が撮る窓は**発火のたびに読む**: `createVenueVisionTarget` `scripts/cockpit.mjs:609-627` → orchestrator の `getVisionTarget`(`:3208`)。Discord の場では `settings.getDiscordVisionTarget()` を直に読むので、409 を外せば**次の発火から反映される**。
- 目(常駐の撮る係)は場を開いたときに `eyesWanted` を 1 回見て起こすかを決める(`cockpit-server.mjs:2414-2418`)。窓を選ばずに開いてから選んだ場合、常駐は起きていないので、撮影は毎回起動の `captureWindow` に戻る(遅いが撮れる・`scripts/cockpit.mjs:2634-2637` の注記)。逆に途中で「使わない」にしても常駐は動いたまま(害は無い)。途中で起こし直すなら `startVenueEyes` を呼ぶ口が要る。
- 「使わない」の表現: `null`(POST の `title` が null か空)。画面の語は「使わない(目を起こさない)」`src/cockpit/view-logic/discord.mjs:52`。窓が null のとき、判定の発火(`vision: "preferred"`)は**画像なしで発火する**(`src/mind/fire-orchestrator.mjs:86-87`・`:1748`)、手動の「Fire+視覚」(`vision: true`)は `vision-no-target` で断る(`:1689-1698`)。窓の一覧は `GET /api/windows`(`cockpit-server.mjs:3292`・段を見ない)。

### (d) 右の領域

- 描いているのは `src/cockpit/ui/app.mjs:474-486`: `<main class="glance-main">` の中に会話(`ConversationPanel`)とコメント(`CommentsPanel` `src/cockpit/ui/comments.mjs`)。**Discord の場の間はコメントの列そのものを描かず、`solo` で会話だけの 1 列にする**(`app.mjs:485`・`src/cockpit/ui/styles.mjs:195`)。つまり今、Discord の場の間の右の領域には何も無い。
- `chatBufferAbsent` は右の領域の表示ではない。場が閉じていて正本が無いときに YouTube のコメントが来たときの診断(ゴースト行・ログ)で、Discord の場の間はコメント自体を黙って捨てる(`cockpit-server.mjs:4462-4475`)。
- パネルを置くなら、`app.mjs:485` の分岐に Discord の操作パネルを描く部品を足し、`solo` をやめる形になる。

### (e) 下の帯の「VC から抜ける」と「配信を終える」

- 置き場: `src/cockpit/ui/bottom-bar.mjs:24-40`(歯車の左)。文言は `endStreamButtonView` `src/cockpit/view-logic/glance-meters.mjs:250-261`(Discord の場は `DISCORD_LEAVE_TEXT` / `DISCORD_LEAVE_ARMED_TEXT` `discord.mjs:25-27`)。
- 押したとき: `app.mjs:415-431` の `endStream`(1 回目で armed・4 秒で戻す・2 回目で `POST /api/stream/stop`)→ `handleStreamStop` `cockpit-server.mjs:3085` → `closeStream`。配信と同じ道。「通話を終える」にするなら、文言(`discord.mjs:25-27` と、それを使う注記 `:35`・`:37`・`:41`)を替えれば道はそのまま。

---

## 4. 途中保存のタイマー

- 今: `scripts/cockpit.mjs:3107-3110`(main で `setInterval(() => streamVenue.checkpoint(), 20 分)`・`unref`・止める所が無い)。`checkpoint()` `:1156-1162` は「場が open で、転写の件数が前の保存と違う」なら頼む。場ごとに戻すのは `lastRecordedSeq` / `lastRecordAtMs` だけ(`renewRecords` `:1103-1110`)。最後に保存が成り立った時刻は `noteSaved` `:1168-1174`(保存の係の `onSaved` から `:3058-3059`)。詳しくは [gate-2-midwrite-investigation.md](gate-2-midwrite-investigation.md)。
- 触る所: `createStreamVenueHooks`(`scripts/cockpit.mjs:1074-1189`)と main のタイマーの行。体験の始まりは `renewRecords` の `startedAtMs`(`:1104`)が既にある。前の保存の時刻は `lastRecordAtMs`(成り立った保存)が既にある。
- **配信にも効く**: 配信と Discord はどちらも同じ `streamVenue.hooks` を束(`createVenueRoleBundle` `:3251-3254`)で渡している。`checkpoint` も体験の種類を見ない。直せば配信も「場の始まりから 20 分」になる。
- 張る・止める所を作るなら注意: 開けなかったとき、`foldStream` は `closeSession` を呼ばないことがある(`cockpit-server.mjs:2588`・`fail` の `{}`)が、`closeBody` は必ず呼ぶ(`:2589`)。`saveFinal` は閉じる道でしか呼ばない。サーバを閉じる `close()` はどれも呼ばない(`:4949-4962`)。タイマーを場の口で張るなら、止める口をこのどれに置くかで漏れが出る。経過時間で判定する案(タイマーは起動時のまま短く回し、`now − max(始まり, 前の保存)` を見る)なら、張る・止めるが要らない。
- 「前の保存」に何を数えるか: `noteSaved` は途中保存・手動「今日を記録」・(閉じたときの)最後の保存のどれでも呼ばれる。手動の保存も数え直しの起点にするかは決めること(§6)。
- テスト: `scripts/cockpit-stream.test.mjs:859-881`(開いている間は動く・増えていなければ頼まない)、`:1146-1166`(2 つ目の場でも飛ばさない)、`:1258-1271`(main の結線を正規表現で固定。`:1266` が `streamVenue.checkpoint();` の行を、`:1270` 付近が `renewUsageLog` の形を見る)、`scripts/cockpit.test.mjs:1085-1100`(閉じた後は動かない)・`:1141-1143`(20 分の定数)。経過時間の案だと `:873` と `:1159` の「開いてすぐ true」は時計を進める形に直す。タイマーを場の口に移す案だと `:1266` の結線のテストを直す。

---

## 5. 判定と発火の記録

### 5.1 今どこで決まり、どこに出るか

| 出来事 | 決まる所 | 今出る所 |
|---|---|---|
| 判定の結果(choice・p・全確率・action・trigger・triggerSeq・遅延) | `src/mind/speak-now.mjs:419-440`(action は `:426-437`) | server `onJudgment` `cockpit-server.mjs:4139-4155`: 待つ以外は SSE `selfFire`、毎回 `reportSpeakNow` `:4401-4408` → `options.onSpeakNowJudgment` → `scripts/cockpit.mjs:3363` で標準出力 1 行 `formatSpeakNowLine` `:2120-2132`(**時刻なし**) |
| 判定のエラー | `speak-now.mjs:442-448` | `onError` `cockpit-server.mjs:4156-4167`: SSE・同じ標準出力・上の帯の警告。文面は `src/mind/speak-now-decisions.mjs` の決まった語だが、**通信失敗と HTTP エラーには相手の文が入りうる**(`:194`・`:214`、鍵は伏せる) |
| 判定を呼ばない(自発オフ・KILL・忙しい・相槌の後の捨て・窓が空) | `speak-now.mjs:401`・`:455-484` | どこにも出ない |
| 発火の要求が場の外で捨てられる(stream-not-open) | `requestSelfFire` `cockpit-server.mjs:4315` | **どこにも出ない**(SSE も無し) |
| 発火の断り(killed・busy・ears-not-running) | orchestrator `fire-orchestrator.mjs:1840-1854` | `emit(onFire, { accepted:false, reason, cause })` → cockpit.mjs の `onFire` `scripts/cockpit.mjs:3155-3167` → server の SSE `fire` `cockpit-server.mjs:3980`。自発の道は `requestSelfFire` の SSE `selfFire` `:4317-4326` にも |
| 窓が空・視覚の窓が無い | `fire-orchestrator.mjs:1591`・`:1689-1698` | 同上(SSE) |
| 受理した発火 | orchestrator | `fire-diagnostics` の始まり(`scripts/cockpit.mjs:3156-3164`)・session-usage の `fire`(Codex の頭のときだけ `:3176-3178`)・`latency` `:3381-3385` |
| つまみの切り替え(自発・かぶり・KILL) | API `:3363`・`:3384`・`:3500` | 記録なし(snapshot の放送だけ) |

### 5.2 足す場所の候補と手間

| 案 | 置く所 | 手間 | 気になる所 |
|---|---|---|---|
| **A. session-usage に `type` を足す** | `src/mind/session-usage-log.mjs` に純関数(例: 判定の行・発火の要求の行・つまみの行)を足し、cockpit.mjs の `onSpeakNowJudgment` `:3363`・`onFire` `:3155`・(足すなら)つまみの口から `sessionUsageLog.append` | 小さい。ファイルは**場ごとに 1 つ**(`renewUsageLog` で作り直す)、20 個残す、直列の非同期で発火を止めない、`wallTimeMs` が自動で付く(`:186`)。既に `fire` / `latency` / 圧縮が同じファイルにあり、`fireId` で結べる | ファイルの名前と目的が「頭の文脈の記録」。判定は数が多い(話すたびに 1 行)ので、上限 256 の待ち行列(`SESSION_USAGE_MAX_QUEUE`)にたまりにくいか【推測: 1 行ずつ書けば平気】。stream-not-open は server の中で捨てるので、server に口(例: `onFireRequestRefused`)を足さないと拾えない |
| B. fire-diagnostics に足す | `src/mind/fire-diagnostics.mjs` | 合わない。`write` は**発火の間(`active`)しか書かない**(`:89-91`)・発火ごとのファイルで **5 個しか残らない**(`:10`)。判定は発火の外で起きる | 構造を変えないと使えない |
| C. 新しいファイル(例: `judge-log/`) | session-usage と同じ作りを写す | 中くらい(置き場・`.gitignore`・残す数・テスト一式) | 場ごとの区切り・fireId との結びは自分で持つ |

- 守り(会話の中身・名前・id を書かない)を今どう固めているか: session-usage は**拾う欄を決めた純関数**で作り、テストで本文の欄を落とすことを確かめる(`src/mind/session-usage-log.test.mjs:32-49`「本文は拾わない」・`:134-148`「本文・ID は落とす」)。遅延の行はコメント反応の `commentIds`(YouTube のコメント id)を落とす(`replyLatencyUsageRecord` `:106-135`)。Discord の部分は、ログ・診断・放送に本文・名前・id・鍵が出ないことを `assertNoSecrets` などで固める(`src/cockpit/cockpit-server-discord-d.test.mjs:12`・`:425-442`)。判定の記録を足すなら、(1) 判定の `j` は数と語だけ(`speak-now.mjs:439`)なのでそのまま拾える、(2) エラーは文をそのまま書かずに種類(キー無し・通信・認証・HTTP・時間切れ・形)に落とす、(3) コメント反応の `commentIds` は書かない、(4) 同じ形のテストを足す、が今の流儀に沿う。

---

## 6. Undine が決める技術上の分かれ道

| # | 分かれ道 | 選択肢 | 手間・効き目の比べ |
|---|---|---|---|
| 1 | 分ける場所 | **a. Discord の入口の中で割る**(`s` を体験の分と接続の分に。server には「入る / 抜ける / 移る」の口と API を足すだけ)/ b. server に「場の中の入口の開け閉め」を一般の段として足す(配信のマイクにも効く) | a が小さい。場の段(開く・閉じる・Ctrl+C)は今のまま。b は server のテストを大きく動かす |
| 2 | 抜ける・移るのやり方 | **a. 接続を destroy して入り直す**(今の作りの写し・偽物もそのまま)/ b. 同じ接続のまま移る(`rejoin`。`receiver`・出口の購読が残る) | a は付け直しが多いが道が 1 つ。b は付け直しが少ないが、人の片付け・`handleVoiceState` の今の VC・偽物の使い回しの振る舞いを足す。抜ける(どこにもいない)は a の destroy が要る |
| 3 | 耳の束 | **a. 体験の間 1 つのまま、抜けるときは人の耳を drop**/ b. 接続ごとに作り直して server の `pipeline` を差し替える口を足す | a は server を触らない。番号(`seq`・`slot`)を体験の分に置く |
| 4 | どの VC にもいない間の声と発火 | a. 発火を断る(`requestSelfFire` と手動の Fire の入口に「VC にいない」を足す・新しい理由)/ b. 出口を残して黙らせる(接続が無いと鳴らずに 5 秒で時間切れ → 頭のエラー)/ c. 何もしない(**今のままだと手元のスピーカーで鳴る**・§0) | a が「黙って待つ」に沿う。思い出しの結果・遅れて返った判定・手動の Fire がどこを通るかで、断る場所は `requestSelfFire` `:4315` と `refuseManualFireOutsideStream` `:2691` の 2 か所で足りる【推測】。頭への ask を通さないので頭の記録にも残らない |
| 5 | 耳の状態の戻し方 | `stopEars` をそのまま呼ぶ(方式・稼働時間・health が消える)/ 「聞いていない」だけにする新しい口 | 前者は snapshot の文字起こしの方式が配信のものに見える。後者は server の口を 1 つ足す |
| 6 | 外から切れたときの扱い | a. 今のまま(任せる・キックだと永久に「切れた」)/ b. 公式の型(Disconnected から 5 秒で戻らなければ destroy して「どこにもいない」へ)/ c. 4014 だけ「どこにもいない」へ、それ以外は待つ | b・c は `stateChange` の新しい状態(`reason`・`closeCode`)を見る。動かされた(移された)ときに今の VC を追うかも決める |
| 7 | 場の中の VC 一覧 | **a. 場の client の guild から取る**(人数は `voiceStates`)/ b. 今の `catalog` を場の間も許す(2 本目のログイン) | a はログインが要らず速い。b は Discord 側の扱いが未確認 |
| 8 | 移った先を準備に書くか | 保存した `channelId` も替える / 体験の間だけ覚える | 今は準備の書き換えは場の間 409(`:2989-2991`)。次に「VC に入る」を押したときにどこへ入るかが変わる |
| 9 | 見る窓の場の途中の切り替え | 409 を外すだけ(次の発火から効く・常駐は開いた時のまま)/ 目を起こし直す口も足す | 前者は 1 か所。後者は `startVenueEyes` を場の途中で呼べるようにする |
| 10 | 途中保存のタイマー | a. 場の口で張る・止める / b. 起動時のまま短く回して経過時間で判定 | §4。b は張る・止めるの漏れが無い。どちらも配信に効く。「前の保存」に手動を含めるか |
| 11 | 判定・発火の記録 | session-usage に `type` を足す / 新しいファイル | §5.2。stream-not-open を拾うなら server に口が要る |
| 12 | snapshot の接続の状態 | 語を足す(例: どこにもいない)+ 今いる VC の名前 / 名前は出さない | `VENUE_CONNECTION_STATES` の確かめ・画面の語・テスト(`cockpit-server-discord-g.test.mjs:446` は id を載せないことを固める)に触る |
| 13 | パネルの部品 | 運転タブの部品(トグル・Fire)を再利用 / パネル用に別に描く | POST は同じ。運転タブとパネルの 2 か所に同じつまみが出る |

---

## 7. 追加の問い: 手動の Fire

### 7.1 今どこにあるか

- 画面: 準備・設定の「運転」タブの `DrivePanel` の `FireButtons`(「🎤 Fire」「🖼 Fire+視覚」)`src/cockpit/ui/control-bar.mjs:75-80`・`:310-320`。メイン画面には無い。場が open でない間は押せない(`manualFireStreamView` `src/cockpit/view-logic/control.mjs:95-99`・注記「配信を始めると押せる」)。AHK のホットキーも同じ API を叩く。
- API: `POST /api/fire` `cockpit-server.mjs:3276-3290`(`cause: { type: "manual", vision: false }`)・`POST /api/vision-fire` `:3319-3334`(`vision: true`・`cause: { type: "manual", vision: true }`)。どちらも orchestrator の `fire()` を直に呼ぶ(`trackFire` で「忙しい」に数える)。

### 7.2 Discord の場で使えるか

- **使える**。断るのは `refuseManualFireOutsideStream` `:2691-2701` だけで、見るのは `streamPhase === "open"` だけ(体験の種類を見ない)。
- 発火の予定(`parkFireScheduler`)とは**関係しない**。手動の Fire は予定を通らず orchestrator に直に行く。
- 指示文: 手動の Fire は内部指示を付けない(`instruction` 無し)。頭への入力は会話の窓(`fire-injection.mjs` の `formatFireInjection`)で、きっかけの種類で文を替えない(orchestrator は `cause` を解釈しない `fire-orchestrator.mjs:125-126`)。頭のセッションの①は場を開いたときに作り、Discord の教えが入っている(`scripts/cockpit.mjs:2686` の `venueSoulWords`)。つまり手動の Fire に配信向けの文が混ざる所は見当たらない。①の会話指示の既定「あなたは配信の相方です」(`fire-orchestrator.mjs:212-214`)はロールの会話指示の既定で、手動に限らずどの発火にも同じ。
- 「Fire+視覚」は Discord の見る窓を撮る(`createVenueVisionTarget`)。窓が「使わない」なら `vision-no-target` で断る(画面に理由が出る)。
- 配信向けのまま残る文面: 場の外で押したときの 409 の文「配信を始めてから押す(配信の外では発火しない)」(`cockpit-server.mjs:2696`)と、画面の「配信を始めると押せる」(`control.mjs:98`)。どちらも場が開いていない間だけ出るので、Discord の場の中では見えない。
- 断られる場合: KILL 中は `killed`、返事の途中は `busy`、正本が無ければ `ears-not-running`、窓が空なら `empty-window`(`fire-orchestrator.mjs:1840-1854`・`:1591`)。結果は画面の fire-note に出る(`fireNoteFromFireResponse`)。

### 7.3 自発オフの間に押したら

- **撃てる**。自発のつまみが止めるのは speak-now の判定(`isActive` `cockpit-server.mjs:4116-4117`)と思い出しの結果を声にするか(`isSelfFireOn`)だけで、手動の Fire は見ない。
- 自発オフの間に思い出しの結果が「黙って前置き」されていれば(`deferInstruction`)、次の ask = その手動の Fire の頭に付いて渡る(`cockpit-server.mjs:4265-4268` の `defer`)。
- 分けたあと(どの VC にもいない間)に押すと、今のままでは**手元の再生器で鳴る**(§0・§6 の 4)。パネルに置くなら、VC にいない間は押せない・断る形が要る。

---

## 8. 質問(Undine へ)

1. どの VC にもいない間の発火(手動の Fire・思い出しの結果・遅れて返った判定)は「断る」でよいか。断るなら、画面に理由を出すか、黙るか。
2. 外から切られた(キック・チャンネルの削除)ときは「どこにもいない」に落としてよいか。Discord の画面で Bot を動かされたときは、動いた先を今の VC として追うか。
3. 場の中で入った・移った VC を、保存した準備(次の「VC に入る」で入る先)にも書くか。
4. 途中保存の「前の保存から 20 分」に、手動の「今日を記録」も起点として数えるか。配信にも同じく効いてよいか(midwrite の調査の質問 1・2 と同じ)。
5. 判定・発火の記録に、つまみの切り替え(自発・かぶり・KILL)の時刻も入れるか(silence の調査 §4 の 5)。ファイルは session-usage に相乗りでよいか。
