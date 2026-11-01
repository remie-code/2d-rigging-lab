# Domain I レビュー — 体験と VC 接続を分ける(Review-Sylph 2026-11-01)

> 対象: 作業ツリーの未コミットの差分(`apps/soul/agent/` 起点)。計画 [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §4・§8 Domain I、冒頭 Status の Domain H の行(I への申し送り)、設計 [../../../architecture/discord-mode.md](../../../architecture/discord-mode.md) §13.2・§13.3、事実 [../../waves/discord-mode/session-split-inventory.md](../../waves/discord-mode/session-split-inventory.md) §1・§2・§6、前のドメイン [../../waves/discord-mode/domain-h-report.md](../../waves/discord-mode/domain-h-report.md)、Gnome の報告 [../../waves/discord-mode/domain-i-gnome.md](../../waves/discord-mode/domain-i-gnome.md)。
> 読み取り専任。ソース・テストは変えていない。`.env*.local`・実データには触れていない。操縦席の起動なし・本物の Discord / LLM / 外部 API の呼び出しなし。会話の中身・名前・Discord の id はこのファイルに書かない。

## 1. 判定

**合格**(ループ 1・止めた指摘 0)。

- 機械ゲートは自分で走らせて Gnome の報告どおり(§4)。
- 設計 §13.2・§13.3 の要件をすべて実装が満たし、計画 §8 I の「確かめ」6 項目にそれぞれ中身のあるテストが付いている(§3)。
- 期待値を変えた既存テストは Gnome の言う 2 か所だけで、どちらも語彙の追加(§5)。
- 配信の道への漏れは見つからない(§6)。固定テストの fixture 差分 0。
- Gnome の質問 4 つは、どれも設計に反しない裁量(§10)。

## 2. 設計適合(要件ごと)

| 要件(設計 / 計画) | 結果 | 根拠(実物) |
|---|---|---|
| 入口の中で割る(§13.2・分け棚 §6-1 a) | 適合 | `discord-experience.mjs`: 体験の分 `x`(client・guild・部品・botId・耳の束・`seq`・client の `VoiceStateUpdate` 購読 `x.offs`・今の接続 `x.link`)と接続の分 `c`(VC の id と名前・connection・receiver・`speaking` 購読 `c.offs`・`c.people`・`c.outlet`・猶予のタイマ)。場の段(`openStream` / `closeStream` / `foldStream`)は差分に無い |
| 入る / 抜ける / 移る の口と API(§13.2) | 適合 | `vc = { join, leave, move, list }`、server の `POST /api/discord/vc`。移る = 先に移る先を確かめ → `foldLink(hold)` → `joinLink`(destroy して入り直す 1 本の道)。同じサーバーの VC だけ(`resolveVoiceChannel` が体験の client の guild を `channels.fetch` し、`isVoiceBased` と `type === GuildVoice` と `guildId` を見る。ステージ・文字・他サーバーは 404) |
| 耳の束は体験の間 1 つ・抜けるときは人の耳を drop(§13.2・分け棚 §6-3 a) | 適合 | `foldLink` が人を drop するだけで束は畳まない。束は `joinLink` の最初だけ `createEars`。`teardown` で初めて畳む。耳の番号 `x.seq` は体験の間の続き |
| 文字起こしの方式・稼働時間を消さず「聞いていない」だけ(§13.2・分け棚 §6-5) | 適合 | server の `pauseVenueEars`(`earsState = "stopped"`・whisper / stt を unknown に戻す・`venueSttEngine` と `startedAtMs` は残す)。`markVenueEarsListening` は paused のあいだ起点を替えない。`stopEars` と閉じる段で `venueEarsPaused` を戻す |
| 準備の `discordChannelId` は書き換えない(§13.2) | 適合 | `setDiscordPrep` を呼ぶ新しい道なし。API 側のテストが GET と設定ファイルの両方で確認 |
| 「通話を終える」= 場を閉じる道、VC にいてもいなくても(§13.2) | 適合 | 場の段は無変更。`teardown` は `x.link` が無くても壊れず冪等。`x.heldOutlet` も外す |
| VC にいない間: 発火は `requestSelfFire` と手動の Fire で `not-in-vc` として断る(§13.3・分け棚 §6-4 a) | 適合 | `venueOutsideVoice()`(Discord の場で接続が `outside` か `joining`)。`requestSelfFire` の他に発火を起こす道が無いことを grep で確認(自発・silence・speak-now・recall・遅れて返った判定はすべて `requestSelfFire`、手動は `/api/fire` と `/api/vision-fire` が `refuseManualFireOutsideStream`) |
| H の申し送り: `not-in-vc` は `reportFireRefused` で 1 回だけ / VC の操作で `renewRecords` を呼ばない | 適合 | 自発は `requestSelfFire` 内で 1 回、手動は `refuseManualFireOutsideStream` で 1 回だけ書き orchestrator に届かない(二重にならない)。VC の操作は場の段を通らない。テストが 1 回のままを確認 |
| 出口が手元のスピーカーに戻らない(§13.3・分け棚 §2.5 の危ない所) | 適合 | 抜けるとき出口を `dispose({ hold: true })` で畳み、`createVenuePlayerSlot` の `current` を `HELD_VENUE_PLAYER`(`open` / `write` / `end` は投げる)にして差し口を空にしない。`main()` の `activePlayer = venuePlayers.current() ?? player` と `ensureVoiceResources` の `venuePlayers.current() != null` がそのまま効く。結線は E の正規表現テスト(`cockpit-discord-e.test.mjs:332-346`)が固定しており、そのテストは無変更で通る。`open` は作れてから前を畳む順に変え、作れなければ held を残す |
| 抜けた瞬間に鳴っている途中の返事 | 適合 | 場の口 `hushVoice` → `fireOrchestrator.interrupt()`(割り込みと同じ切り方・冪等・待たない)。出口の dispose が進行中の発話に `stopped` を出す。受理済みの発火が持つ再生器は畳まれた Discord 向け(`disposed` で `open` が投げる)か held(投げる)なので、手元には落ちない |
| 外から: 4014 は「VC の外で待っている」へ(§13.3・分け棚 §6-6) | 適合 | 猶予 5 秒(`DISCORD_DISCONNECT_GRACE_MS`・`deps.disconnectGraceMs`)の終わりに状態を見て、`Disconnected` かつ `closeCode === 4014` なら `goOutside`(接続の分を hold で畳む・`pauseEars`・体験は閉じない) |
| 外から: 動かされたら動いた先を追う(§13.3) | 適合 | `handleBotVoiceState`: 今の VC から別の VC へなら `c.channelId` / `c.channelName` を替え、前の VC の人の耳を drop、同じ接続のまま。4014 が先に来ても後に来ても、猶予の終わりに Ready なら外へ落とさない(偽物で両方の順をテスト) |
| 自分で抜けたときに「切れた」と出ない(§13.3) | 適合 | `foldLink` が接続の購読(`c.offs`)を先に外してから destroy。SSE の state をすべて見るテストで `disconnected` が出ないことを確認 |
| snapshot: 「VC の外で待っている」・今いる VC の名前・id を載せない(§13.4) | 適合 | `VENUE_CONNECTION_STATES` に `outside`、`stream.vcName`(100 字まで・配信 / 閉じている間 / どこにもいない間は null)。画面の語は `outside` の 1 語(最小限・K に委ねる) |
| `control` に入る・抜ける・移る・切れたを残す(§13.7・H の口) | 適合 | `noteVenueVcEvent` が `vc-join` / `vc-leave` / `vc-move` / `vc-moved` / `vc-kicked` / `vc-disconnect` だけを `reportControl({ control })` に渡す(名前・id は渡さない)。`USAGE_CONTROL_KINDS` に `vc-moved`・`vc-kicked` を足した。実際に `controlUsageRecord` を通して `from: null, to: null` の行になることを自分で確認した |
| 正本への出来事の行は J なので足さない(計画 §8 I) | 適合 | 差分に正本の行を足す所なし。J への口は `vcEvent` の合図(person-join / person-leave / vc-reconnect も届く・記録はしない) |
| 判定・発火のふるまいは変えない(§13.1) | 適合 | 判定・発火の既存テストは期待値 0 変更で通る |

## 3. テスト適合(確かめごと)

名前だけのテストではなく、すべて本物の `createCockpitServer` と本物の `createDiscordExperience`(+ 偽の Discord)をつないで、状態と呼び出しの記録を検証している。

| 確かめ | テスト | 何を確かめているか |
|---|---|---|
| 抜けて入り直しても頭のセッション・正本・判定が同じ | `cockpit-server-discord-i.test.mjs` 「抜けて入り直す」 | 場の events が `["renewRecords","eyes.start","openSession"]` のまま(作り直しなし)。orchestrator の `created === 1`。ログインし直さない(`clients.length === 1`)。正本は `こんにちは` → `続きだけど` と続く。判定の要求は 2 回で、入り直し後に同じ判定の流れで発火。方式 `elevenlabs` が残る。稼働時間 0 → 120000(開いた時から) |
| 同じ client で新しい接続・耳の束と番号 | `discord-experience-discord-i.test.mjs` 「入り直す」 | `connections.length === 2`・`reusedJoins` 空・耳の束は同じ(`spec.ears === bundles[0]`)・番号は `discord-2`・`prepWrites` 空 |
| 移ったあと人の耳と出口が新しい connection に | 同 「移る」 | 前の接続が destroy・新しい接続の `joinConfig.channelId`・`outlets[1].connection === second`・新しい receiver で購読(`subscribes.at(-1)`)・前の VC の出来事は見ず、移った先で人が抜けると耳を drop |
| not-in-vc の `fire-refused` が 1 回だけ | server 「VC にいない間」 | 遅れて返った判定 → `[{cause:"speak-now",reason:"not-in-vc",vision:false}]` の 1 件・`fires.length === 0`。手動 / 視覚つきは 409 `reason:"not-in-vc"` で、断りはそれぞれ 1 件ずつ(`slice(1)` で完全一致)。入り直せば 202 で撃て、断りは増えない |
| VC の外で手元の再生器が作られない(鳴っている途中に抜けた場合を含む) | `scripts/cockpit-discord-i.test.mjs` 「抜けた瞬間」+ slot の 3 件 | 本物の Discord 向け再生器を鳴らし始めてから `/leave`: イベントが `started` → `stopped`・`isAlive() === false`・`slot.current() === HELD_VENUE_PLAYER`・held の `open` が投げる・新しい resource なし。入り直し / 移るで新しい接続の再生器、外から切られても held、通話を終えると空。slot の hold・置き換え・出口を作れないとき held を残す、の単体も付く。`main()` の結線そのものは E の正規表現テストが固定(下の持ち越し 1) |
| 抜けた瞬間に鳴っている返事を止める | server 「抜けた瞬間に鳴っている返事は止める」 | 状態が `speaking` のとき leave で `interrupts === 1`、外からの切断でも 2 になる |
| 4014 / 他の切れ / 自分で抜けた の区別 | experience 「外から 4014」・「4014 でない切れ」・「自分で移ったあとに遅れて届く…」+ server 「外から」 | 4014: 猶予の間は `disconnected`、その後 `outside`・destroy 1 回・耳 drop・束と client は残る・`vc-disconnect` 合図なし。4014 でない切れ: `disconnected` のまま・destroy 0・`vc-disconnect` 1 回・戻れば `vc-reconnect`・短い途切れは合図なし。自分で移る・抜けるの間は SSE の state に `disconnected` が出ない |
| 動かされたら追う | experience 「外から 動かされた」(`voice-state-first` / `4014-first` の 2 順)・「戻らない」 | 同じ接続のまま・`vcName` が動いた先・前の VC の人の耳 drop・猶予が過ぎても `joined`・Bot の出入りは除く。動かされた先で戻らなければ猶予後に `outside` |
| 通話を終えるが VC の外でも記憶を書く | server 「通話を終える(VC にいない / 移った先)」 | どちらも `stream/stop` で `saveFinal:今日はここまで`・`closeSession`・ログアウト 1 回・すべての接続 destroy・再度開けば準備の VC |
| `renewRecords` を呼ばない | 上の「抜けて入り直す」 | events に `renewRecords` が 1 回だけ |
| `discordChannelId` を書き換えない | server 「API」・experience 「入り直す」 | GET の prep と設定ファイル両方が `CHANNEL` のまま / `prepWrites` 空 |
| 別サーバー・VC でないチャンネルの拒否 | experience 「移る・入るの断り」+ server 「API」 | 文字・ステージ・他サーバー・無い id → `code:"channel"` / HTTP 404、形の違う id → 400(`../etc`)、使えない VC には移らず抜けない。join 後に再び join・同じ VC への move・VC 外での leave / move は 409 |
| `control` に入る・抜ける・移る・切れたが残る・名前 / id は載らない | server 「外から」「守り」 | 種類の並びが `vc-join, vc-move, vc-leave, vc-join, vc-disconnect, vc-moved, vc-kicked` など。`controlUsageRecord` を通した JSON と生の `controls` の両方に名前・id なし |
| 配信の場は変わらない | server 「配信の場は変わらない」+ API 「配信の場」 | 配信では `vcName` / `connection` が null・手動の Fire は 202・`refused` と `controls` が空・`/api/discord/vc` は 409 |
| 同時の操作・場が開いていない | experience 「同時の操作」 | 操作の途中の操作は `busy`、閉じていれば `not-open` |
| VC に入れない(移る先で Ready にならない) | experience 「移る先に入れない」 | 前の VC からは抜けたまま `outside`・理由は決まった文面・`vc-leave` の合図・閉じれば畳む |

計画の「確かめ」6 項目はすべて、上のテストで中身が検証されている。

## 4. テスト結果(自分で走らせた)

- `apps/soul/agent` で `node --test`: **tests 2229 / pass 2229 / fail 0 / cancelled 0 / skipped 0**(Gnome の主張と一致。土台 2199 + 30)。`Domain I` の 30 件がすべて ✔、`stream-wording-pin.test.mjs` も全件の中で通る。
- リポジトリの根で `pnpm run check:soul-zone`: pass(1615 files scanned)。
- `git diff --stat -- apps/soul/agent/src/mind/fixtures package.json pnpm-lock.yaml apps/soul/agent/package.json`: **空**(差分 0)。`git status` の変更は報告にある 8 ファイル + 新規 4 ファイル(テスト 3 + Gnome の報告)だけ。②④の文面・`_conventions.md`・種のファイルは変更なし。

## 5. 期待値を変えた既存テストの照合

`git status` が示す既存テストの変更は 2 ファイルだけ。diff の `-` 行を全部洗った(削った assert はこの 2 行だけ)。

| ファイル | 変更 | 妥当性 |
|---|---|---|
| `src/cockpit/cockpit-server-discord-d.test.mjs:329` | `VENUE_CONNECTION_STATES` の deepEqual に `"outside"` を足した | 設計 §13.3・§13.4(接続の状態に「VC の外で待っている」)による語彙の追加。妥当 |
| `src/mind/session-usage-log.test.mjs:324-334` | `USAGE_CONTROL_KINDS` の deepEqual に `"vc-moved"`・`"vc-kicked"` を足した(1 行 → 複数行に整形) | H の申し送り・§13.7(入る・抜ける・移る・切れた)。assert の中身は足しただけで、他の assert は不変。妥当 |

そのほかの既存テスト(`glance-discord-g.test.mjs` のサーバ語彙と画面の語の一致、`cockpit-discord-e.test.mjs` の結線の正規表現、判定と発火のテスト、E 以前の Discord のテスト群)は、無変更で全件通る。偽物 `fake-discord.mjs` の変更で既存テストが影響を受けていない(`entersState` が上限で reject する変更を含め、全件 pass)。

## 6. 守りの確認

| 項目 | 結果 |
|---|---|
| snapshot・SSE | Discord の id は載らない(テストが guild・channel・user・bot の偽 id と偽の鍵を全文走査)。載るのは今いる VC の名前 `stream.vcName` だけで、設計 §13.4 が許す |
| ログ(`say` の行) | 数と状態だけ(`joined`・`left voice channel`・`moved by someone (dropped speakers n)`・`outside (4014 \| voice-state)`・`could not join (<決まった理由>)` など)。VC の名前・人の名前・id なし。テストで全文走査。`console` / `process.stdout` の新しい出力は discord-experience に無い |
| `session-usage` の `control` | 種類だけ。`from` / `to` は null。VC の名前・人の名前・id を渡す経路が無い(`noteVenueVcEvent` は `kind` しか見ない)。`fire-refused` の `not-in-vc` も `cause` / `reason` / `vision` の token だけ |
| 出来事の合図 `vcEvent` | 名前は載るが場の口へ渡るだけで、ログ・記録・snapshot には出ない(J で正本へ。設計 §13.5 が記憶への名前を許す) |
| 鍵の読み方 | 変わっていない(`readToken` / `loadToken` / `loginClient` の差分に鍵の扱いの変更なし。`plan` に鍵を持ち回らない作りも同じ。`process.env` に入れない) |
| `GET /api/discord/vc` の id | 応答にだけ載せる(K のための口)。snapshot・ログには載らない。設計 §13.4 の「Discord の id は snapshot・ログに載せない」の範囲内で、既存の `/api/discord/catalog` も同じ扱い |
| テストの値 | id は `guild-fake-1`・`channel-fake-1`・`user-fake-a`・`bot-fake-1` など明らかな偽。鍵は `fake.discord-token_for-…`。名前・VC 名は架空。設定ファイルは OS の一時フォルダだけで終了時に消す。実データ・`.env*.local` に触れていない |
| 声の保存 | なし |

## 7. 配信の場への漏れ

- 新しい分岐はすべて Discord の場に限る: `venueOutsideVoice()` は `venueExperience.kind === "discord"` を見る。`hushVenueVoice` / `pauseVenueEars` / `vcEvent` は Discord の体験の口からしか呼ばれない。`handleDiscordVc` は Discord の場でなければ 409。`HELD_VENUE_PLAYER` は `dispose({ hold: true })` からしか差し口に入らず、その呼び出し元は Discord の出口だけ。
- 配信の場では `vcName` / `connection` が null、手動の Fire は断られない(テストあり)。`stream-wording-pin` は通り、fixture 差分 0。
- `createVenuePlayerSlot.open` の「作れてから前を畳む」順への変更は、配信では差し口を使わないので影響なし(スロット内の `dispose` の副作用の有無は、旧 `release(p)` と同じ: 常に `p.dispose()` を呼び、`current === p` のときだけ空にする)。

## 8. 止めた指摘

なし(0 件)。

## 9. 止めない指摘(持ち越し)

1. **「手元の再生器を作らない」の結線そのものは実行で見ていない**(§4 計画 の「約束のテスト」には足りている見立て)。`scripts/cockpit-discord-i.test.mjs` の `startVenue` は `ensureVoiceResources` と同じ見分け(`slot.current() ? "discord" : "local"`)を自分で書いて使い、`main()` の実物は呼ばない。実物の結線は E の正規表現テストが固定し、私も `ensureVoiceResources`・`playerProxy`・`acquireAcceptedFireResources` の実物を読んで、差し口が空でなければ手元の再生器を作らない・使わないことを確認した。`main()` は import して実行できない作りの既存の制約(E の先例どおり)なので、止めない。人間ゲート 3 の「手元のスピーカーで鳴らない」(設計 §13.8)で実機の確認に任せる。
2. **`hushVoice` の実物の orchestrator との結合は未テスト**。server のテストは偽の orchestrator の `interrupt` 回数、cockpit のテストは Discord 向け再生器を直接鳴らして `stopped` を確認する、の 2 本に分かれている。本物の `severSpeaking` は `interrupted` を同期に立ててから `spoken.stop` を呼ぶので、出口の dispose との競合で二重に鳴り止まない作りに見える(私が実物を読んで確認)。端の場合なので止めない。
3. **場を閉じる途中に終わる VC 操作の遅れた合図**: `runOp` の途中で `closeEntrance` が走ると、操作の終わりで `emitVc`(例: `vc-leave`)が閉じたあとに server へ届き、`control` が書かれうる。`x.closed` で `settleOutside` は止まるが `emitVc` は止まらない。記録 1 行のずれで、害はない。J で正本へ足すときに `x.closed` を見るとよい。
4. **whisper の口の番号の使い回し**(Gnome の持ち越し): 抜けてすぐ入り直す・移ると、前の whisper が港を放す前に同じ番号で起こしうる【推測】。人ごとの耳の drop は待つが、whisper の dispose は待たない。人間ゲート 3 で見る。
5. **本物の Discord での 4014 と状態の順**: ライブラリ(@discordjs/voice 0.19.2)の `dist/index.js` を読んだ上で、猶予の終わりに今の状態を見る作りにして、偽物で両方の順を試している。本物の挙動は人間ゲート 3。
6. **話している途中に抜けた人の VAD の `speechEnd`**(Gnome の持ち越し): 機械弁の側の状態は未確認。人間ゲート 3 で見る。
7. **上の帯の耳の表示**: 「聞いていない」の間は耳の状態語 `stopped`(「止まっている」)に見える。`outside` の色・パネルとあわせて K。
8. 偽物 `fake-discord.mjs` の `entersState` が本物と同じく上限で reject する変更は、既存テストに影響なし(全件 pass)。ただしテスト基盤の挙動変更なので、今後 `readyTimeoutMs` を短くしたテストを足すとき気づけるよう記録しておく。

## 10. 裁量の評価と、Gnome の質問 4 つへの見立て

裁量 16 件(報告 §5)のうち、設計に反するものは無い。どれも設計に書かれていない所を筋の通る形で決めた範囲で、「裁量」として認める。

1. **質問 1 — 抜けたときの「（遮られた）」の注記**: 設計 §13.3 は「黙って待つ」とあるだけで注記の文面を決めていないので、反しない。割り込みと同じ切り方(声に出た分の接頭辞 + `…（遮られた）`)にしたのは、`severSpeaking` を再利用して「どこまで声に出たか」を正しく残す点で筋が通る。頭が「遮られた」と読むのは、実際に途中で声が切れたので事実どおり。別の注記(「VC から抜けた」)にするかは、J で出来事の行(チャッピー自身の抜けた)が正本に入るので、そのとき重ねて読んだときの見え方を人間ゲート 3 で見て決めればよい。今は変えなくてよい。
2. **質問 2 — Bot 自身が VC の外へ出た知らせで 4014 を待たずに外へ**: 設計 §13.3 は「4014(キック・チャンネルの削除)は「どこにもいない」に落とす」。Bot 自身の `VoiceStateUpdate` が今の VC から channel = null になったのは、Discord 側で VC の外にいると確定した知らせで、4014 と同じ「どこにもいない」の事実を指すので、設計に反しない。誤作動の恐れがあるのは、別の VC への移動が一時的に null を挟む場合だが、Discord の移動は 1 回の更新で行き先が入る。「自分で抜けた・移ったあとの遅れた知らせ」は `joinLink` の `readyOnce` の前は見ず、`x.link` が替わったあとは `from` が一致しないので見ない(テストあり)。このままでよい。
3. **質問 3 — `joining` の間も発火を断る**: 設計 §13.3 は「どの VC にもいない間」「出口が無いと声が手元のスピーカーに戻るため」断る。入る・移るの途中は出口が未だ無いので、同じ理由が当てはまる。場を最初に開く間は `streamPhase` が `opening` で、`stream-not-open` で別に断られるため干渉しない。反しない。
4. **質問 4 — 稼働時間の数え方**: 設計 §13.2 は「文字起こしの方式・稼働時間は消さず、「聞いていない」だけにする」と書き、VC にいた時間だけを数えるとは決めていない。「消さない」を「体験を開いた時から数え続ける」と読んだのは自然で、反しない。VC の外にいる間の `uptimeMs` を 0 にし、入り直すと開いた時からに戻す形は一貫している。VC にいた時間だけにしたいなら、`startedAtMs` を持ち越す代わりに累積を持つ別の直しで、今は求められていない。

そのほかの裁量(4014 は 5 秒の猶予のあと / 4014 でない切れの合図は猶予のあいだ戻らなかったとき 1 回 / API の番号 400・404・409・502・503 / 自動で move・join に読み替えない / 移るは先に確かめ使えなければ抜けない / 差し口の open は作れてから前を畳む / 偽物の `entersState` 変更 など)は、いずれも設計の範囲内で筋が通る。

## 11. 質問(Undine へ)

なし。判断に迷う点はなかった。持ち越し 1・4・5・6 は人間ゲート 3 の手順(設計 §13.8)に入れておくとよい: 「どの VC にもいない間に手元のスピーカーで鳴らない」「抜けてすぐ入り直す・移る」「Discord の画面で Bot を動かす」。
