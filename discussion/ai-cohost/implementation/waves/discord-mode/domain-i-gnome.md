# Domain I Gnome 完了報告 — 体験と VC 接続を分ける(Gnome 2026-11-01)

> 計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §8 Domain I。設計: [../../../architecture/discord-mode.md](../../../architecture/discord-mode.md) §13.2・§13.3(背景 §6・§7)。棚卸し: [session-split-inventory.md](session-split-inventory.md)(選んだ道: §6-1 a・§6-2 a・§6-3 a・§6-5・§6-4 a・§6-6 c + 追う)。前のドメイン: [domain-h-report.md](domain-h-report.md) §7。
> ブランチ `ai-cohost/discord-mode`。**コミットしていない**。鍵(`.env*.local`)は読んでいない。実データ(`cockpit-settings.local.json`・`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`)には触れていない。操縦席の起動・本物の Discord / LLM / 外部 API の呼び出しなし。依存・lockfile の変更なし。②④の配信の文面・`_conventions.md`・種のファイル・`src/mind/fixtures/` は触っていない。パスは `apps/soul/agent/` 起点。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2229 / 2229 pass**(土台 2199 から +30。新しいテストのファイル 3 本は 5 回続けて回して 30/30) |
| 根で `pnpm run check:soul-zone` | pass(1615 files) |
| 固定テスト `src/mind/stream-wording-pin.test.mjs` | pass(全件の中で) |
| `src/mind/fixtures/`・`package.json`・`pnpm-lock.yaml` | 差分 0(`git status` に出ない) |

## 2. 作ったもの(要点)

### 2.1 体験の分と接続の分の境目(`src/discord/discord-experience.mjs`)

- 塊 `s` を 2 つに割った。
  - **体験の分 `x`**(openEntrance が成り立ってから closeEntrance まで): client・guild・部品(voice・discord・OpusScript)・botId・**耳の束**(体験の間 1 つ)・耳の番号 `seq`・client の `VoiceStateUpdate` の購読(`x.offs`)・数え・今の接続の分 `x.link`・抜けたときに差し口に残した出口 `x.heldOutlet`・操作の途中の印 `x.op`。
  - **接続の分 `c`**(VC 1 つに 1 つ): VC の id と名前・voice connection・接続の `error` / `stateChange`・receiver・`speaking` の購読(`c.offs`)・人ごと(`c.people`: 購読・デコーダ・音の入口・耳)・出口 `c.outlet`・切れたあとの猶予のタイマ。`slot`(whisper の口の番号)は今の接続の分の人から空きを数える。
- `foldLink(x, c, { hold })` = 抜ける。順: 「今の VC」から外す → 猶予のタイマを止める → **接続の購読を先に外す**(自分で抜けたときに「切れた」と出ない) → hold なら鳴っている返事を止める(場の口 `hushVoice`) → 人の耳を束から drop(待つ) → 出口を畳む(hold なら `dispose({ hold: true })`) → connection を destroy。**耳の束は畳まない・client はログアウトしない**。
- 移る = 先に移る先を確かめる(使えない VC なら抜けない) → `foldLink`(hold) → 耳は聞いていない → `joinLink`。destroy して入り直す 1 本の道。
- `joinLink(x, channel)`: `joinVoiceChannel`(group = ロールの id)→ Ready を待つ →(最初だけ)耳の束・client の購読 → speaking の購読 → 出口 → `joined` → `earsListening`。体験を開くときは準備の VC(今と同じ)、API では渡した VC。
- `teardown(x)`(閉じる): client の購読 → 接続の分(あれば) → 差し口に残した出口(hold なしの dispose で外す) → 耳の束 → ログアウト。**接続の分が無くても(VC にいなくても)壊れない・冪等**。
- `handleVoiceState` は **今いる VC(`x.link.channelId`)** を見る。ほかの人: 今の VC から抜けたら耳を drop(今のまま)。Bot 自身は §2.5。

### 2.2 API(`src/cockpit/cockpit-server.mjs`)

- `POST /api/discord/vc` `{ action: "join" | "leave" | "move", channelId? }` → 200 で snapshot。
  - 400: action が違う・channelId の形が違う(`DISCORD_VC_REFUSALS.channelId`)。
  - 404: 同じサーバーのボイスチャンネルでない(ほかのサーバー・文字 / ステージ・見つからない。`DISCORD_REASONS.channel`)。同じサーバーかは **体験の client の guild の `channels.fetch`**(本物は他サーバーのチャンネルで投げる)と、チャンネルの `guildId` の突き合わせ。
  - 409: Discord の場が open でない(閉じている・開きかけ・閉じかけ・配信の場。`DISCORD_VC_NOT_OPEN_MESSAGE`)・もう VC にいるのに join・どこにもいないのに leave / move・同じ VC へ move・ほかの操作の途中。
  - 502: VC に入れない(時間切れなど)・出口を作れない(このときはどの VC にもいない状態になる)。
  - 503: Discord の入口が無い操縦席。
  - エラーの応答は `{ error, state }`(state = snapshot)。
- `GET /api/discord/vc` → 200 `{ channels: [{ id, name, people, current }] }`(Domain K のための口・§7)。
- 場の段(`openStream` / `closeStream` / `foldStream`・Ctrl+C)は触っていない。VC の操作で **`renewRecords` を呼ばない**(場の段を通らないので呼ばれない。テストで 1 回のままを確かめた)。準備の `discordChannelId` は書き換えない(テストで GET と設定ファイルの両方を確かめた)。

### 2.3 snapshot の形

- `stream.connection` の語に **`"outside"`(VC の外で待っている)** を足した(`VENUE_CONNECTION_STATES` = joining / joined / disconnected / outside)。
- **`stream.vcName`**: 今いる VC の名前(入っている途中・つなぎ直しを待っている間はその VC の名前・どこにもいない / 配信 / 閉じている間は null・100 字まで)。Discord の id は載せない。
- 画面の語(`src/cockpit/view-logic/discord.mjs`)は `DISCORD_CONNECTION_LABELS.outside = "VC の外で待っている"` と `venueConnectionView` が outside を通すだけ(最小限。色・パネルは K)。

### 2.4 「聞いていない」の口と、VC にいない間の発火

- 場の口 `pauseEars()`(server の `pauseVenueEars`): 耳の状態を `"stopped"`(今の語)に、whisper / stt の死活を unknown に戻す。**`venueSttEngine` と `startedAtMs` は消さない**。入り直したときの `earsListening()` は、止めていた間なら `startedAtMs` を替えない(稼働時間は体験を開いた時から数える)。`stopEars` は今のまま(閉じるときだけ)。
- 発火の断り(H の口で 1 回だけ記録):
  - `requestSelfFire`: 場が open で、Discord の場の接続が `outside` か `joining`(API の入る・移るの途中で出口が無い)なら `reportFireRefused({ cause, reason: "not-in-vc", vision })` → `{ fired:false, reason:"not-in-vc" }`。画面・フィードには出さない(stream-not-open と同じ扱い)。
  - 手動(`/api/fire`・`/api/vision-fire`): `refuseManualFireOutsideStream` の中で同じ見分け → 409 `{ fired:false, reason:"not-in-vc", error: NOT_IN_VC_FIRE_MESSAGE, state }`(今の断りの形)。orchestrator へは届けないので `onFire` の自動の記録と 2 重にならない(テストで 1 回ずつを確かめた)。
  - `disconnected`(ライブラリのつなぎ直し待ち)は今のまま断らない。

### 2.5 外から

- 接続の `stateChange`: Ready → `joined`。Ready 以外 → 今のまま `disconnected`(画面は「切れた」)。そのうえで**猶予**(`DISCORD_DISCONNECT_GRACE_MS` = 5 秒・公式の勧めと同じ・`deps.disconnectGraceMs`)を張り、終わりに今の状態を見る:
  - Ready に戻っていれば何もしない(動かされたときのつなぎ直し・短い途切れ)。
  - **閉じのコード 4014(`state.closeCode`)の Disconnected のまま → VC の外で待っている**(接続の分を hold で畳む・耳は聞いていない・体験は閉じない・合図 `vc-kicked`)。4014 が来るたびに猶予を数え直す。
  - それ以外 → 「切れた」の合図 `vc-disconnect` を 1 回(戻れば `vc-reconnect`)。接続は畳まない(今のまま)。
- **4014 と動かされたの順**: ライブラリ(@discordjs/voice 0.19.2 `dist/index.js`)を読んだ。`onNetworkingClose` は 4014 なら Disconnected(closeCode 4014)にしてつなぎ直さない。動かされたときは Bot の VOICE_STATE_UPDATE で `addStatePacket` が `joinConfig.channelId` を書き換え(discord.js の `VoiceStateUpdate` アクションは `client.voice.onVoiceStateUpdate` を client の `voiceStateUpdate` の emit **より先に**呼ぶ)、VOICE_SERVER_UPDATE で `configureNetworking` → Connecting に進む。古い声の WebSocket の 4014 は、新しい networking に差し替わる前に閉じれば届き、差し替わったあとなら購読が外されていて届かない。つまり**動かされたときに 4014 が先にも後にも来うる**。猶予の終わりに今の状態を見る形にしたので、どちらの順でも動かされた先で Ready に戻れば外へ落ちない(偽物で両方の順を確かめた)。
- **Bot 自身の `VoiceStateUpdate`**(今いる VC から動いたときだけ見る):
  - 別の VC へ → **動いた先を今の VC として追う**(id・名前を替える。名前は `newState.channel` か `guild.channels.fetch`)・前の VC の人の耳は drop・同じ接続のまま(出口・receiver はそのまま)・合図 `vc-moved`。
  - VC の外へ(channel が null = キック)→ 猶予を待たずに VC の外で待っている(`vc-kicked`)。
  - 自分で抜けた・移ったあとに遅れて届く Bot 自身の知らせは、もう今の VC からではないので見ない(テストあり)。
- 自分で抜けた・移ったときは接続の購読を先に外すので「切れた」が出ない(SSE の state を全部見て確かめた)。

### 2.6 出口を手元のスピーカーに戻さないやり方(選んだもの)

- **差し口に「VC にいない」の口を残す**(`scripts/cockpit.mjs`)。`createVenuePlayerSlot().open(info)` の返り値の `dispose({ hold: true })` で再生器を畳み、差し口に `HELD_VENUE_PLAYER` を置く。この口は鳴らさない(`open` / `write` / `end` は決まった文面 `HELD_VENUE_PLAYER_MESSAGE` で投げる → 運び手は play-failed で終わる。`stop` / `onEvent` / `dispose` は何もしない)。差し口が空にならないので、今の `activePlayer = () => venuePlayers.current() ?? player` と `ensureVoiceResources` の `venuePlayers.current() != null` の見分けがそのまま効き、**手元の再生器を作らない・使わない**(main() の結線の行は変えていない = E の正規表現のテストもそのまま通る)。次に入れば `open` が置き換え、場を閉じる(hold なしの dispose・`slot.dispose`)と空に戻る(次の配信の場は手元の再生器)。
- `open` は「新しい再生器を作れてから前のものを畳む」順にした(出口を作れないとき「VC にいない」の口を残す・手元に戻さない)。
- 加えて、**抜けた瞬間に鳴っている途中の返事は止める**: 場の口 `hushVoice()` が `fireOrchestrator.interrupt()`(割り込みと同じ切り方・話していなければ何もしない・待たない)。そのあと出口の dispose で Discord 向けの再生器は進行中の発話に `stopped` を出す。受理済みで考え中だった返事が抜けたあとに声になっても、受理の時点の再生器は畳まれている(投げる)か「VC にいない」の口(投げる)なので手元に落ちない。

### 2.7 記録(`control`)

- 体験の口から場の口 `vcEvent(event)` へ合図し、server の `noteVenueVcEvent` が `reportControl({ control })` を書く(名前・id は渡さない)。記録する種類: `vc-join`(体験を開いたとき・API)・`vc-leave`(自分で抜けた・移る先に入れなかった)・`vc-move`(自分で移った)・`vc-disconnect`(猶予のあいだ戻らなかった切れ)・**`vc-moved`(Discord の画面で動かされた)**・**`vc-kicked`(4014 / Bot 自身が外へ)**。後の 2 つは `src/mind/session-usage-log.mjs` の `USAGE_CONTROL_KINDS` に足した。

## 3. 変更ファイル(`apps/soul/agent/` 起点)

- 実装: `src/discord/discord-experience.mjs`(体験の分と接続の分・入る / 抜ける / 移る・外から・合図・VC 一覧・`DISCORD_CONNECTION_STATES` に outside・`DISCORD_CLOSE_CODE_DO_NOT_RECONNECT`・`DISCORD_DISCONNECT_GRACE_MS`・`DISCORD_CHANNEL_NAME_MAX_CHARS`・`DISCORD_VC_REFUSALS`・口 `voiceChannelName()`・`vc = { join, leave, move, list }`)、`src/cockpit/cockpit-server.mjs`(`VENUE_CONNECTION_STATES` に outside・`VENUE_VC_ACTIONS`・`DISCORD_VC_NOT_OPEN_MESSAGE`・`NOT_IN_VC_FIRE_MESSAGE`・体験の口の正規化に `voiceChannelName` / `vc`・場の口 `pauseEars` / `hushVoice` / `vcEvent`・snapshot の `stream.vcName`・not-in-vc の断り 2 か所・`/api/discord/vc` の POST / GET)、`scripts/cockpit.mjs`(`HELD_VENUE_PLAYER`・`HELD_VENUE_PLAYER_MESSAGE`・差し口の hold・open の順)、`src/mind/session-usage-log.mjs`(`vc-moved`・`vc-kicked`)、`src/cockpit/view-logic/discord.mjs`(outside の語)。
- 偽物: `src/test-support/fake-discord.mjs`(`setConnectionStatus(status, { closeCode, reason })`・`moveBot(to, { closeCode4014, closeFirst, recover, channelName })`・`kickBot({ voiceState })`・サーバーの `voiceStates.cache`・入退室の `member`(名前・Bot か)・チャンネルの `guildId`・使い回しになる `joinVoiceChannel` の数え `record.reusedJoins`・**`entersState` が上限の時間で reject する**(本物と同じ。今までの偽物は待ち続けた。既存テストは影響なし))。
- テストの新規(30 件): `src/discord/discord-experience-discord-i.test.mjs`(17)・`src/cockpit/cockpit-server-discord-i.test.mjs`(9)・`scripts/cockpit-discord-i.test.mjs`(4)。
- 既存テストの変更: §4 の 2 か所だけ。

確かめの対応(依頼の「確かめ」の各項目): 抜けて入り直しても頭のセッション(openSession 1 回)・正本(行が続く)・判定(同じ判定で次も発火)・目・orchestrator・renewRecords が 1 回のまま／移ったあとの人の耳・出口が新しい connection・前の VC の耳は drop／VC にいない間の自発(遅れて返った判定)・手動・視覚つきが not-in-vc で 1 回ずつ・出口が手元に戻らない(鳴っている途中の発話を含む)・耳は聞いていない・方式と稼働時間は残る／4014 で outside・それ以外で disconnected・自分で抜けた / 移ったときに disconnected が出ない・動かされたら今の VC が動いた先／通話を終えるが VC にいても(移った先)いなくても場を閉じて記憶を書く／control の種類と JSON に VC の名前・id が載らない・snapshot / 放送 / ログに id が載らず vcName が載る／別のサーバー・VC でないチャンネル・場が閉じている・配信の場で断る・準備が書き換わらない／配信の場は vcName・connection が null で手動の Fire も断らない。

## 4. 期待値を変えた既存テスト

| ファイル:行 | 変更 | 理由 |
|---|---|---|
| `src/cockpit/cockpit-server-discord-d.test.mjs:329` | `VENUE_CONNECTION_STATES` の deepEqual に `"outside"` を足した | 設計 §13.3・§13.4(接続の状態に「VC の外で待っている」)。語彙の追加 |
| `src/mind/session-usage-log.test.mjs:324-334` | `USAGE_CONTROL_KINDS` の deepEqual に `"vc-moved"`・`"vc-kicked"` を足した(1 行を複数行に整形) | 依頼の 7(動かされた・4014 を別の種類にする)。H の申し送りどおりの直し |

- これ以外の既存テストの期待値・アサーションの変更は 0。`src/cockpit/view-logic/glance-discord-g.test.mjs:111`(サーバの語彙と画面の語の一致)は両方に足したので変えずに通る。`scripts/cockpit-discord-e.test.mjs` の main() の結線の正規表現・差し口のテストも変えずに通る。

## 5. 裁量(決めた所は全部)

1. 4014 は**猶予 5 秒のあと**外へ(すぐではない)。動かされたときに 4014 が来うるため(§2.5)。猶予の間の表示は今の「切れた」。
2. Bot 自身の VoiceStateUpdate で今の VC → なし(キック)は、4014 を待たずにすぐ外へ(本物のキックは両方が来る。先に来た方で落ち、後の方は購読を外したあとなので見ない)。
3. 4014 でない切れの `vc-disconnect`(合図と control)は、猶予のあいだ戻らなかったときに 1 回(短い途切れ・動かされたときの一時の Connecting を記録しない)。画面の「切れた」は今のまますぐ出る。戻れば `vc-reconnect`(合図だけ・記録しない)。外から Destroyed にされたときも今と同じく「切れた」のまま。
4. control の種類 `vc-moved`・`vc-kicked` を足した。`vc-join` は体験を開いたとき(`via: "open"`)にも書く。移る先に入れなかったときは `vc-leave`。
5. not-in-vc は接続が `outside` と `joining`(API の入る・移るの途中)のとき。`disconnected` は今のまま断らない。接続の状態を持たない体験の口では断らない。
6. 手元に戻さない形は「差し口に鳴らない口を残す」(§2.6)+ 抜けるときに `interrupt()`。`interrupt` は soul の行に割り込みの注記「…（遮られた）」を付ける(質問 1)。
7. API の番号: 400 / 404 / 409 / 502 / 503(§2.2)。成功は snapshot、失敗は `{ error, state }`。
8. VC にいる間の join・いない間の move・同じ VC への move・操作の途中の操作は 409(自動で move / join に読み替えない)。
9. 移るは移る先を先に確かめ、使えなければ抜けない。抜けたあと入れなければ VC の外(502)。
10. 「聞いていない」は耳の状態の語 `"stopped"`(新しい語を足さない)。稼働時間 `uptimeMs` は外の間 0、入り直すと体験を開いた時から(外の時間を含む)。移る間も聞いていない。
11. snapshot の名前は `stream.vcName`(100 字まで)。
12. 耳が起きなかった人の「この間は聞かない」は接続ごと(入り直すと試し直す)。
13. 合図 `vcEvent` の形は §7。人の出入りは `member.user.bot` が真なら出さない。名前は `member.displayName`(無ければ聞いていた人の名前・null)。
14. VC 一覧の `people` は Bot 自身を除く `voiceStates` の数(ほかの Bot は数える)。並びは位置順。id は API の応答にだけ。
15. 差し口の `open` は作れてから前を畳む順にした(出口を作れないとき「VC にいない」の口を残す)。
16. 偽物の `entersState` を本物と同じく上限で reject する形にした。

## 6. 持ち越し(止めない)

- whisper の口の番号の使い回し(棚卸し §2.5 の 6): 抜けてすぐ入り直す・移ると、前の whisper が港を放す前に同じ番号で起こしうる【推測】。人の耳の drop は待つようにしたが、whisper の dispose 自体は kill して待たない。人間ゲート 3 で見る。
- 話している途中に抜けた人の VAD の `speechEnd`(既知の止めない指摘)。束から外すので `userSpeaking` は偽になるが、機械弁の側の状態は見ていない。
- 本物の Discord で「画面で動かす」の 4014 と状態の順(偽物は両方の順を試した)。人間ゲート 3 で見る。
- 「聞いていない」の間、上の帯の耳の表示が「止まっている」に見える件の見せ方、outside の色(K)。
- 自分で抜けた直後の Bot 自身の知らせ(前の VC → 外)は見ない作りなので、ライブラリの外で Bot が別の VC に入れられた等の奇妙な順は追わない。

## 7. Domain J・K への申し送り

- **出来事の合図(J)**: 体験 → 場の口 `vcEvent(event)` → server の `noteVenueVcEvent(event)`(`cockpit-server.mjs`。今は control を書くだけ。**ここで正本に出来事の行を足す**)。形 `{ kind, channelName?, fromChannelName?, name?, via? }`(id は来ない):
  - `vc-join`(`via: "open" | "panel"`・`channelName`)・`vc-leave`(`channelName`)・`vc-move`(`fromChannelName`・`channelName`)・`vc-moved`(同)・`vc-kicked`(`channelName`)・`vc-disconnect` / `vc-reconnect`(`channelName`)・`person-join` / `person-leave`(`channelName`・`name`。Bot 自身とほかの Bot は除く)。
  - `vc-join`(open)は場が `opening` の間(正本は開く段の 4 で作られている)に届く。`vc-moved` は名前を取りに行くと少し遅れて届く。
  - ログには種類と数だけ(`joined`・`left voice channel`・`moved by someone (dropped speakers n)`・`outside (4014 | voice-state)` など)。名前は出していない。
- **VC 一覧(K)**: `GET /api/discord/vc` → `{ channels: [{ id, name, people, current }] }`(体験の client の guild から・2 本目のログインはしない・場が open の Discord の場でなければ 409)。
- **入る / 抜ける / 移る(K)**: `POST /api/discord/vc` `{ action, channelId? }`(§2.2)。成功は snapshot。
- **snapshot(K)**: `stream.connection` に `"outside"`・`stream.vcName`。手動の Fire は VC の外で 409 `reason: "not-in-vc"`(`NOT_IN_VC_FIRE_MESSAGE`)。画面の「押せない」の表示は K(`stream.connection` が `outside` / `joining` で押せない、が server と同じ見分け)。

## 8. 質問

1. **抜けた瞬間の返事の切り方の注記**: 鳴っている途中に抜けると `interrupt()` で止めるので、soul の行に割り込みと同じ「…（遮られた）」が付く(どこまで声に出たかは正しく残る)。設計は「黙って待つ」とだけあり、注記の文面は書いていない。仮に割り込みと同じ注記にした。VC から抜けた用の別の注記にするか(②④や①で頭が「遮られた」と読む)。
2. **Bot 自身が VC の外へ出た知らせで、4014 を待たずに外へ落とす**(裁量 2)。設計 §13.3 は「4014 は外へ」とだけ書く。本物のキックは両方が来るので結果は同じ見込みだが、知らせだけ来て 4014 が来ない場合も外へ落ちる。これでよいか。
3. **入る・移るの途中(`joining`)も発火を断る**(裁量 5)。設計は「どの VC にもいない間」。入る途中は出口がまだ無いので断る側に倒した。
4. **稼働時間**: 入り直したあとの `uptimeMs` は体験を開いた時から(VC の外にいた時間を含む)。「稼働時間を消さない」をこう読んだ。VC にいた時間だけを数える形が要るか。
