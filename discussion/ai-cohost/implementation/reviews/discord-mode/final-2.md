# Discord モード 全体の突き合わせ 2 回目 — 体験と VC 接続を分ける(H〜K)(Sylph、2026-11-01)

> 対象: ブランチ `ai-cohost/discord-mode`(HEAD `84bb6afa`)。H〜K の差分 `git diff cc36a33a..HEAD -- apps/soul/agent`(コミット `ed1fff64` H・`e983695c` I・`07e3d296` J・`84bb6afa` K)。
> 根拠: 設計 `architecture/discord-mode.md` §13(Accepted)、wave 計画の Status の H〜K の行(追認・持ち越し)・§4・§8、`waves/discord-mode/human-gate-2-result.md`、各ドメインの報告とレビュー。
> コードは直していない。試しはセッションの scratchpad だけで行い、終わったあと消した。操縦席の起動・本物の Discord / LLM / 外部 API の呼び出し・実データ・鍵には触れていない。

## 1. 判定: **pass**

- 止める指摘(計画 §4 の 4 種)は **0 件**。
- 見る所 1〜7 のつなぎ目は、設計 §13 どおりに組まれていた。コードを追って確かめ、一部は scratch のテストでも確かめた。
- 気をつけてほしい点が 1 つある(§3-1)。場を閉じる操作と、VC から抜ける操作・外から切られる処理が同じ瞬間に重なると、「VC にいない」の口が差し口に残る。残ると、同じ起動の次の配信で声が出ない。偽の耳の畳みを 80ms 遅らせると再現した。ただし本番の耳の畳みは同期の処理とマイクロタスクで終わる見立てで、今は起きないと見ている【推測】。だから止めない側に置いた。直すなら数行で済む(§3-1 の案)。
- 機械ゲート(自分で走らせた): `apps/soul/agent` で `node --test` は **2277 / 2277 pass**(fail 0・cancelled 0・skipped 0・約 92 秒)。根で `pnpm run check:soul-zone` も pass(1624 files)。

## 2. 止める指摘

なし。

## 3. 止めない指摘(持ち越し)

### 3-1. 【直すことを勧める】場を閉じるのと、抜ける・外から切られるが重なると、「VC にいない」の口が差し口に残る

- **場所**: `src/discord/discord-experience.mjs` の `foldLink`(`x.link = null` を同期でしたあと、人の耳の drop を `await` する。そのあとに `outlet.dispose({hold:true})` と `x.heldOutlet = outlet`)と `teardown`(`x.link` が null なら `foldLink` を飛ばす。`x.heldOutlet` はその時点で見るだけ)。差し口は `scripts/cockpit.mjs` の `createVenuePlayerSlot`。
- **起きること**: 抜ける(`leaveVoice`)、または外から切られた(`goOutside`)の `foldLink` が人の耳の drop を待っている間に、`closeEntrance` → `teardown` が走ると、次の順になる。
  1. `teardown` は `x.link` が null で、`x.heldOutlet` もまだ null なので、出口に触らずに終わる。
  2. そのあとで `foldLink` が `dispose({hold:true})` を呼び、差し口が `HELD_VENUE_PLAYER` になる。
  3. その口は誰も外さない。差し口は場ごとには作り直さない(`venuePlayers` は main で 1 つ)。だから、同じ起動の次の配信の場で `activePlayer()` が「VC にいない」の口を返す。`ensureVoiceResources` も手元の再生器を起こさない。結果、配信で声が出ない(play-failed)。次に Discord の場を開けば `open` が置き換えるので戻る。
- **再現**(scratch のテスト。偽の Discord と本物の `createVenuePlayerSlot` の組み合わせ)
  - 偽の耳の `dispose` を 80ms 待たせ、`vc.leave()` の 10ms 後(または `kickBot()` の 50ms 後)に `closeEntrance` を呼んだ。閉じたあとの `slot.current()` は `HELD_VENUE_PLAYER` だった。
  - 耳の `dispose` が待たない場合と、重ならない場合は `null` だった(正しい)。
- **止めない理由**: 本番の耳の畳み(`ear-pipeline.mjs` の `dispose`)は次の処理からなり、どれも同期の処理かマイクロタスクで終わる見立て。そのため、別の HTTP 要求(「通話を終える」)が間に入れない【推測。onnxruntime の `release` の中身は確かめていない】。
  - 音の入口の dispose・whisper-server の dispose・STT の dispose は同期。
  - VAD の `session.release()` は待つが、中身は同期と見ている。
- それでも、耳の畳みに 1 つでも本物の待ち(I/O)が入れば、配信が無音になる。結果が重いので、人間ゲート 3 の前に直すことを勧める。
- **直し方の案**(どれか 1 つ。テストは上の再現をそのまま 1 本にできる)
  - a. `foldLink` で `dispose({hold:true})` を呼んだあと、`x.closed` なら hold なしの `dispose()` を呼んで、すぐ外す(`x.heldOutlet` に入れない)。一番小さい。
  - b. `teardown` の最後に、差し口がまだ `HELD_VENUE_PLAYER` なら空に戻す口(場の口)を呼ぶ。
  - c. 抜ける・移るの `runOp` の途中なら、`teardown` が `x.op` の終わりを待つ。ただし入る途中の待ち(`readyTimeoutMs`)まで待つことになるので勧めない。

### 3-2. 抜ける・移るの途中の短い間、発火を断らない

- `leaveVoice` / `moveVoice` の `foldLink` が終わるまで、`connection` は `"joined"` のまま。このため `venueOutsideVoice()` が偽で、その間に来た発火は受理される。
- 差し口は Discord の再生器(畳まれる途中)か「VC にいない」の口なので、**手元のスピーカーでは鳴らない**。ただしその発火は `fire-refused` ではなく失敗(play-failed など)として残る。
- 本番の間は 3-1 と同じく短い。記録の読み分けの小さなずれなので、止めない。

### 3-3. 開きかけの間に見る窓を選ぶと、目が追わないことがある

- パネルの見る窓は、開きかけ・閉じかけの間も選べる。server の `syncDiscordVenueEyes` は `streamPhase === "open"` のときだけ目を合わせる。
- 窓を選ばずに開き始め、開く段 7(目)を過ぎたあと、まだ開きかけのうちに窓を選ぶと、目が起きないまま開く。窓の保存はされるので、もう一度選び直せば起きる。
- 開きかけは数秒なので端の場合。人間ゲート 3 で気になれば、パネルの見る窓も開きかけ・閉じかけの間は固める(接続の区切りと同じ扱い)。

### 3-4. 前からの持ち越し(Status の行のとおり。変わりなし)

- 判定を呼ばない道の記録(自発オフ・忙しい間・`skipAfterBusy` など)。場の始まりの KILL の自動解除が `control` に残らない。
- whisper の口の番号の使い回し【推測】。本物の Discord で動かされたときの知らせの順。`main()` の結線の実機での確かめ。
- 開きかけ・閉じかけの間のパネルの Fire の注記が「配信を始めると押せる」のまま。`person-join` と `vc-people` の重なり。抜けた瞬間の「（遮られた）」。`skills/venue-discord.md` に `event:` の説明が無い(Undine の判断で変えない)。
- 場の外で書く `fire-refused` / `control` の行が、直前の場のファイル(または起動時刻のファイル)に入る。

## 4. 見る所 1〜7 の結果

### 4-1. 体験と接続の寿命

| 操作 | 頭のセッション・正本・判定・目・途中保存の起点 | 耳の束・人の耳 | 接続・出口 |
|---|---|---|---|
| 入る(開く) | 場の段で作る(`renewRecords` = 途中保存の起点) | 束は最初に Ready になったとき 1 つ | `joinLink`。出口は `slot.open` |
| 抜ける | 続く(場の段を通らない・`renewRecords` を呼ばない。I のテストで固定) | 人の耳を drop。束は残す。`pauseEars`(方式・稼働時間は残す) | 購読を先に外す → `hushVoice` → 出口を hold で畳む → destroy。「切れた」は出ない |
| 入り直す | 続く | 同じ束。聞いているに戻る(稼働時間の起点は替えない) | 新しい接続の分。`open` が「VC にいない」の口を置き換える |
| 移る | 続く | 前の人の耳を drop。新しい VC で作り直す | 先に移る先を確かめる → 抜ける + 入る。入れなければ外で待つ + `vc-leave` |
| 動かされる | 続く | 前の VC の人の耳を drop | 同じ接続のまま、動いた先を `c.channelId` に追う |
| キック(4014)・Bot が外へ | 続く | 人の耳を drop・`pauseEars` | 5 秒の猶予のあと `goOutside`(Bot 自身が外へ出た知らせは猶予なし)。出口は hold |
| 外で待つ | 続く(自動で閉じない) | 聞いていない | 差し口は「VC にいない」の口 |
| 通話を終える(中 / 外) | 場の段で閉じる(`foldStream` → 記憶の最後の保存) | `teardown` が束を dispose | `teardown`: client の購読 → 接続の分(hold なし)→ 残した口 → 束 → ログアウト |
| Ctrl+C | `endStreamForShutdown` → `closeStream`。入口の `closeEntrance` は冪等 | 同上 | 同上 |

- **二重に畳む**: `teardown`(`x.closed`)・`foldLink`(`c.closed`)・差し口の `dispose`・耳の束の `drop` / `dispose`・耳の `dispose`(`disposed`)は、どれも冪等。
- **古い接続の合図**: 次の 4 つが閉じた接続の分と、閉じた体験を捨てる。
  - `linkLive(x, c)`。接続の状態・猶予のタイマ・耳の起動の結果・動かされた先の名前の取り寄せ・もういる人の行で使う。
  - `emitVc` の `x.closed`。
  - server の世代に結んだ `venueVcEventMouth(streamGeneration)`。
  - `appendVenueEventLine` の `open` / `opening` の条件。
- 前の場の遅れた合図が次の場の `control`・正本に入らないことは、J のテストが固定している。
- **畳み忘れ**: 1 か所ある(§3-1。閉じるのと抜けるが重なったときの「VC にいない」の口)。ほかは無い。
- **途中保存のタイマー**: main で 1 回張り、1 分ごとに確かめる。起点は場の始まり・前の保存・前に頼んだ時刻で、VC の操作では戻らない(I のテストで `renewRecords` を呼ばないことを固定)。
- **開きかけ・閉じかけの最中**: `/api/discord/vc` は `streamPhase !== "open"` で 409。VC の操作の途中の 2 つ目は `runOp` が `busy` で断る。閉じる段と、途中の入る・移るが重なった場合は次のとおり。
  - `joinLink` が `entersState` のあとに `linkLive` を見る。`moveVoice` は畳んだあとに `x.closed` を見る。どちらも作りかけを残さない。
  - 残る隙間は §3-1 の 1 つだけ。

### 4-2. VC にいない間の声

- 自発の道は、どれも `requestSelfFire` を通る。断るのは、場が `open` で `venueOutsideVoice()`(`outside` / `joining`)が真のとき。この道は orchestrator に届かないので、`onFire` の `accepted:false` と二重にならない(`fire-refused` は 1 回)。
  - 発火の予定・speak-now の判定・遅れて返った判定・相槌・思い出しの係(`fire: requestSelfFire("recall", …)`)が含まれる。
- 手動の道: `/api/fire`・`/api/vision-fire`(AHK のホットキーも同じ口)は `refuseManualFireOutsideStream` を通る。VC の外では 409 `not-in-vc` で、`fire-refused` は 1 回。
- orchestrator を直に撃つ口は、上の 3 か所(`:3559`・`:3602`・`:4641`)だけ(grep で確かめた)。割り込みは `interrupt` だけで、言い直しのような自分で撃つ道は無い。
- 抜けた瞬間に鳴っている返事は `hushVoice`(割り込みと同じ切り方)で止まる。考えている途中に抜けた返事があとで声になっても、差し口が「VC にいない」の口なので play-failed で終わり、手元には落ちない(I の `cockpit-discord-i.test.mjs` が固定)。
- 画面: パネルと運転のタブの Fire は、`outside` / `joining` で押せず、「VC に入ると押せる」と出る。server と同じ見分け(`disconnected` は押せる)。

### 4-3. 出来事と判定の分離

- 出来事の行(`speaker:"event"`。`vc-people` も同じ道)は、判定の入力・きっかけ・積み残しのどれにも入らない。
  - 正本の購読(`openVenueTranscript` の `onAppend`)が先頭で return する。そのため、発火の予定・speak-now・積み残し・after-busy に回らない。
  - `fire-scheduler` の `handleTranscript` も no-op にしている(二重の守り)。
  - 判定の入力 `buildSpeakNowInput` は、もとから you / soul / undefined 以外を飛ばす。`buildCommentReactInput` と `composeRecallAvoidInput` は `event` を飛ばすようにした。
- 載る所は、①の窓(`fire-injection` の `event: 本文`)・②の材料(`memory.mjs`)・④の直近の会話(`recall.mjs`)。通話の語の組の材料の説明に `event` を足した。配信の語の組は不変。
- **保存の数え**(K): `countSpokenEntries`(出来事の行を除く)で、`saveFinal` と `checkpoint` の要否を決め、`noteSaved` の `lastRecordedSeq` も数える。中身(②に渡す転写)は出来事の行を載せたまま。H の起点の式(`isMemoryCheckpointDue`)とは独立に、「増えたか」と「20 分たったか」の 2 つの関所として並ぶので、噛み合っている。手動の「今日を記録」は出来事の行だけでも走り、起点を戻す(Undine の追認 (2) のとおり)。
- 配信: 出来事の行が無いので、件数は今と同じ(K のテストで固定)。

### 4-4. 記録の守り

- session-usage の `judgment` / `fire-refused` / `control` は、拾う欄を決めた純関数で作る。
  - 語の欄は `/^[a-z][a-z0-9-]{0,39}$/`、control は一覧(`USAGE_CONTROL_KINDS`)にあるものだけ。エラーは種類だけ。
  - 本文・名前・VC 名・Discord の id・エラー文が JSON に出ないことを、H・I・J・K のテストが本物の記録関数で確かめている。
  - `vc-people`・人の出入り・`vc-reconnect` は `control` に書かない(`VC_EVENT_CONTROLS`)。
- ターミナルのログ: 体験の `say(...)` の行は、種類と数だけ(`speakers N`・`outside (4014)`・`could not join (決まった文面)` など)。cockpit-server の VC の API はログを書かない。
- snapshot に足したのは、`stream.connection`(`outside`)と `stream.vcName`(名前だけ)。出来事の行は、本文(名前を含む)つきで放送と snapshot に載る。
  - 設計 §13.5 の「ログ・snapshot の外の記録には載せない」の読みに合う。
- `GET /api/discord/vc` の応答には VC の id が載る。API の応答だけで、snapshot・ログには載らない(I・K の判断のとおり。準備の API も id を返す前例がある)。
- fire-diagnostics は発火の中身を書かない(ファイルの頭の決まり)。
- 差分に 17 桁以上の数字は、テストの偽物(漏れないことを見る値)だけ。`process.env` への代入も、鍵を読む所も無い。

### 4-5. 配信の不変

- `git diff cc36a33a..HEAD --stat` で、次がすべて空だった(差分 0): `src/mind/fixtures`・`stream-wording-pin.test.mjs`・`skills/`・`package.json`・`pnpm-lock.yaml`。`stream-wording-pin` は全件の中で pass。
- 配信に効く変更は、次の 2 つだけ。
  - 途中保存の起点(H。経過時間で頼む)。
  - 記録の追加(H。`judgment`・`fire-refused`・`control` が配信の場の session-usage にも残る)。
- そのほかの共通の所の変更は、どれも配信では今と同じに通る。
  - `onAppend` の出来事の行の return は、配信に出来事の行が無い。
  - `venueOutsideVoice` は、`kind !== "discord"` なら偽。
  - `markVenueEarsListening` の起点を替えない条件は、`venueEarsPaused` が配信では偽。
  - `countSpokenEntries` は、配信では件数と同じ。
  - 差し口の `open` の順の入れ替え・`dispose({hold})` は、Discord の出口だけ。
  - 画面の語の変更は、`discordVenue` の条件の中だけ。
- 比較の結果は記録どおりで、自分でも差分を読んで分岐を確かめた。
  - J のレビュー: 配信の入力 900 本・11111 件で不一致 0。
  - K の Gnome: 27222 件で不一致 0。
  - K のレビュー: 1,592,873 件で不一致 0。違いは Discord 専用の語 7 つだけ。
- `checkpoint` の空の場合(`spoken === 0`)は、前の `shouldSkipMemoryCheckpoint(0, 0)` と同じく頼まない。

### 4-6. 確かめごととテスト

| 項目(計画 §8 / 設計 §13.8) | テスト |
|---|---|
| H: 記録の各 type・中身なし | `session-usage-log.test.mjs`(+5)・`cockpit-server-discord-h.test.mjs` |
| H: 入り直して 1 分半で途中保存しない・20 分で走る・手動で起点が戻る | `scripts/cockpit-stream.test.mjs`(+7)・`scripts/cockpit.test.mjs`(+3) |
| H: 判定・発火の期待値の変更 0 | 既存テストが無変更で pass |
| I: 抜けて入り直しても頭・正本・判定・目が同じ・`renewRecords` を呼ばない | `cockpit-server-discord-i.test.mjs` |
| I: 移ったあとの人の耳と出口が新しい VC につく・4014・動かされた | `discord-experience-discord-i.test.mjs` |
| I: VC にいない間の発火を断る・手元に戻らない | `cockpit-server-discord-i.test.mjs`・`scripts/cockpit-discord-i.test.mjs` |
| I: 通話を終えるは VC の中でも外でも場を閉じて記憶を書く・`control` が残る | `cockpit-server-discord-i.test.mjs` |
| J: 出来事の行が ①②④ に載る・判定に載らず走らない・名前がログに出ない・遅れた合図 | `cockpit-server-discord-j.test.mjs`・`venue-events-discord-j.test.mjs` |
| K: パネルの状態ごと・Fire の注記 | `discord-panel-k.test.mjs`・`cockpit-ui-discord-k.test.mjs` |
| K: 見る窓を途中で替えたら次の発火から新しい窓・窓なしで開いてから選ぶ | `scripts/cockpit-discord-k.test.mjs` |
| K: 出来事の行だけでは保存しない・`vc-people` | `scripts/cockpit-discord-k.test.mjs`・`cockpit-server-discord-k.test.mjs` |
| 配信の画面が HEAD と同じ | scratch の総当たり(リポジトリには置いていない) |

**テストの無い所**(人間ゲート 3 で見る、または直しのときに足す):

- 閉じるのと、抜ける・外から切られるが重なったときの差し口(§3-1)。
- 本物の Discord・本物の耳・本物の再生器での次のこと。
  - 手元で鳴らないこと。
  - 動かされたときの知らせの順。
  - 4014 の 5 秒の猶予。
  - whisper の口の番号の使い回し。
  - `members.fetch` / 20 秒ごとの `channels.fetch` の回数。
- 実ブラウザでの見た目と狭い幅(CSS の照合だけ)。
- `main()` の結線を実行して見るテスト(正規表現の照合とレビューの読みだけ)。
- 「応答やのに黙った」を session-usage の記録で切り分けられるか(行は書かれるが、使えるかは実データで見る)。
- 開きかけの間に窓を選んだときの目(§3-3)。

## 5. 人間ゲート 3 で見る所(試す順の案)

前提: 試しのサーバー。自分のほかに入退室できる人(別のアカウント)が 1 人いるとよい。操縦席の起動は 1 回だけで、最後に同じ起動のまま配信まで試す。

1. **開く**: Discord の準備のタブで、見る窓は「使わない」にして、「Discord の VC に入る」。次を見る。
   - 上の帯が「VC に入っている」。
   - 右にパネル(サーバー名・今いる VC・VC の一覧と人数)。
   - 左の「会話」に「入った」と「〈VC〉には…がいる」の薄い行。同じ人の `person-join` と重なって出ないか。
2. **話す**: 自発オンで少し話す。パネルの「🎤 Fire」も 1 回押す。パネルの「自発的にしゃべる」「かぶり判定」のトグルが効く。
3. **見る窓**: パネルで窓を選び、「🖼 Fire+視覚」で新しい窓を見る。もう一度別の窓に替えて、次の発火で替わる。「使わない」に戻す。
4. **抜ける**(1 回押し): チャッピーが話している途中に押す。次を見る。
   - 声が止まり、手元のスピーカーで鳴らない。
   - 上の帯が「VC の外で待っている」。
   - Fire が押せず「VC に入ると押せる」。
   - 左に「抜けた」(直前の soul の行の「（遮られた）」の見え方も)。
5. **外で待つ**: 1〜2 分待つ。遅れて返った判定や思い出しの結果があっても、手元で鳴らない。
6. **入り直す**(パネルの「入る」): 抜ける前の話の続きを、思い出しを使わずに話せる。入り直して 1〜2 分で途中保存が走らない(ターミナル・記憶のフォルダ)。
7. **移る**(パネル): 別の VC へ移る。左に「移った」「〈VC〉には…がいる」。移った先で話せる。声が新しい VC から聞こえる。
8. **動かされる**: Discord の画面で Bot を別の VC へドラッグする。パネルと上の帯が動いた先を追う。左に「動かされた」。その先で話せる。
9. **人の出入り**: 別のアカウントが今の VC に入る・出る。左に「入ってきた」「出ていった」。チャッピーが会話の中で分かっている。
10. **外から切る**: Discord の画面で Bot を切断する。約 5 秒で「VC の外で待っている」。左に「外された」。手元で鳴らない。パネルから入り直せる。
11. **途中保存**: 開いてから 20 分以上続ける。途中保存が始まりから約 20 分で走り、入り直しの直後には走らない。手動の「今日を記録」のあとは、そこから 20 分。
12. **通話を終える**(VC の外から、と中から、の両方を試せるとよい・2 回押し): 記憶が 1 つの体験として書かれる。入った・抜けた・移ったの行も、記憶の中で読める。
13. **誰も話さず終える**: 開いて、誰も話さずに通話を終える。記憶が書かれない。
14. **記録を見る**: その起動の `session-usage/` に `judgment`・`fire-refused`(`not-in-vc` を含む)・`control`(`vc-join` / `vc-leave` / `vc-move` / `vc-moved` / `vc-kicked`)が並ぶ。本文・人の名前・VC の名前・Discord の id が無い。ターミナルのログにも無い。
15. **同じ起動のまま配信**: 「配信を始める」。声が手元のスピーカーから出る(Discord の口が残っていない。§3-1 の確かめを兼ねる)。途中保存が始まりから 20 分。gate 1 で飛ばした YouTube のコメントへの反応も、ここで見られれば見る。
16. **幅**: 操縦席の窓を 1200〜1500px に狭め、パネル(長い VC の名前・人数・ボタン)が崩れない。

## 6. 質問(Undine へ)

1. §3-1 を人間ゲート 3 の前に直すか。案 a なら数行と再現のテスト 1 本で、配信には触れない。今は起きない見立てだが、起きたときの結果(同じ起動の次の配信が無音)が重いので、直すことを勧める。
2. §3-3(開きかけの間の見る窓)は、人間ゲート 3 で気になったときだけ直す形でよいか。

## 7. 一時フォルダ

- scratch のテスト 1 本(偽の Discord と本物の差し口で §3-1 を再現)をセッションの scratchpad に置き、確かめたあと消した。リポジトリには何も置いていない。
