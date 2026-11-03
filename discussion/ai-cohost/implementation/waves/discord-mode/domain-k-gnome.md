# Domain K Gnome 報告 — Discord 操作パネルと画面（＋ J の持ち越し 2 件）

> 実装: Gnome（2026-11-01）。ブランチ `ai-cohost/discord-mode`（HEAD `07e3d296`）。コミットしていない。
> 根拠: 計画 `implementation/orchestration/discord-mode-wave-plan.md` §8 Domain K と冒頭の Domain J の行（Undine の判断 (1)・(4)）、設計 `architecture/discord-mode.md` §13.4（§13.2・§13.3・§9）、`human-gate-2-result.md` §2、`domain-i-report.md` §7、`domain-j-report.md` §5・§8・§9、棚卸し `session-split-inventory.md` §3・§7。
> 鍵（`.env*.local`）は読んでいない。実データ（`cockpit-settings.local.json`・`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`）に触れていない。操縦席・本物の Discord / LLM / 外部 API・実ブラウザは起動していない。依存・lockfile・`skills/`・`_conventions.md`・種のファイル・②④の配信の文面・固定テストの fixture は変えていない。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2277 / 2277 pass・fail 0**（土台 2246 から +31） |
| 根で `pnpm run check:soul-zone` | pass（1624 files scanned） |
| 固定テスト `src/mind/stream-wording-pin.test.mjs` と `src/mind/fixtures/` | pass・`git diff HEAD` の差分 0（`skills/`・`package.json`・`pnpm-lock.yaml` も差分 0） |
| 配信の画面が HEAD と同じ（§6） | 27222 件の比較で不一致 0 |

## 2. 変更ファイル（`apps/soul/agent/` 起点）

- 実装の変更: `scripts/cockpit.mjs`（J 持ち越し (a)）、`src/mind/venue-events.mjs`・`src/discord/discord-experience.mjs`（(b)・VC 一覧の `guildName`・通話を終えるの語）、`src/cockpit/cockpit-server.mjs`（見る窓の 409 を外す・目を合わせる・一覧の `guildName`・Connect 断りの語）、`src/cockpit/view-logic/discord.mjs`（パネルの導出・語）、`src/cockpit/view-logic/control.mjs`（手動 Fire の VC 外の断り）、`src/cockpit/ui/control-bar.mjs`（`useDriveControls` を切り出し・pill のラベル）、`src/cockpit/ui/app.mjs`（右の領域にパネル）、`src/cockpit/ui/styles.mjs`（パネル・狭い幅・`outside` の色）。
- 実装の新規: `src/cockpit/ui/discord-panel.mjs`。
- 偽物: `src/test-support/fake-discord.mjs`（guild の `bots`・`members.fetch` が `user.bot` を返す・`voiceState()` で voiceStates の項目に member を載せる）。
- テストの新規（31 件）: `scripts/cockpit-discord-k.test.mjs`（7）、`src/cockpit/cockpit-server-discord-k.test.mjs`（2）、`src/cockpit/cockpit-ui-discord-k.test.mjs`（8）、`src/cockpit/view-logic/discord-panel-k.test.mjs`（12）、`src/mind/venue-events-discord-k.test.mjs`（2）。
- 既存テストの変更: §5 の 7 ファイル。

## 3. 作ったもの

### 0(a) 出来事の行だけの通話では保存しない
- `countSpokenEntries(entries)`（`scripts/cockpit.mjs`・純関数）= 出来事の行（`isEventEntry`）を除いた件数。`createStreamVenueHooks` の `saveFinal` と `checkpoint` は要否をこの件数で見る（0 なら頼まない・前の保存から増えていなければ頼まない）。頼むときの中身は出来事の行を載せたままの転写。
- 保存の係 `createMemoryRecorder` の `onSaved` に `spokenLength` を足し、`noteSaved` は `lastRecordedSeq` をこれで数える（無ければ今まで通り `entriesLength`）。出来事の行が増えただけでは途中保存を頼み直さない。
- 配信は出来事の行が無いので件数 = 今までの件数（テストで固定・§6 の比較とも別に）。
- 手動の「今日を記録」は今までどおりこの判定を通らない（質問 2）。

### 0(b) VC に入った時点でもういる人の 1 行
- 体験の側 `announcePresent`（`discord-experience.mjs`）: `vc-join`（開いたとき・パネル）・`vc-move`・`vc-moved` の合図の直後に、guild の voiceStates から今いる VC の人（Bot 自身を除く）を引き、member（`VoiceState.member`、無ければ `members.fetch`）で名前と Bot かを見る。ほかの Bot は除く。誰もいなければ合図しない。合図は `{ kind: "vc-people", channelName, names, others }`（id は載せない）。待たない・失敗しても入口を止めない・ログに何も書かない。
- 場の側は J と同じ道（`vcEvent` → `noteVenueVcEvent` → 正本に出来事の行）。`vc-people` は `control` の種類ではないので session-usage に書かない。判定・発火の予定には回らない（J の購読の除外のまま・テストで固定）。

### 1. Discord の操作パネル（右の領域）
- `app.mjs`: Discord の場の間（`stream.experience === "discord"`・開きかけ / 閉じかけを含む）は、配信のコメントの列と同じ置き場（`glance-main` の 60fr / 36fr のまま）に `DiscordPanel`。配信の場は今のまま `CommentsPanel`。会話だけの 1 列（`.solo`）はやめた。
- 接続: サーバー名（`GET /api/discord/vc` の応答に足した `guildName`）・今いる VC と「抜ける」・同じサーバーの VC の一覧（人数）と「入る」/「移る」（1 回押し・`POST /api/discord/vc { action, channelId }`）。一覧は開いたとき・場の phase / 接続の状態 / VC の名前が替わったとき・操作のあと・20 秒ごと・「一覧を更新」で読み直す。
- しゃべり方: 「自発的にしゃべる」「かぶり判定」のトグルと「🎤 Fire」「🖼 Fire+視覚」。運転のタブと同じ部品（`SelfFirePill`・`BargeInPill`・`FireButtons`）と、`DrivePanel` から切り出した `useDriveControls`（同じ 4 つの API・同じ流れ）。Fire は `manualFireStreamView` が Discord の場で `connection` が `outside` / `joining` のとき押せなくし注記「VC に入ると押せる」（運転のタブの Fire にも同じく効く）。
- 見る窓: 「使わない（目を起こさない）」と窓の一覧（`GET /api/windows`）・`POST /api/discord/vision-target`。サーバは Discord の場の間の 409 を外し、開いている Discord の場で選び直したら目を合わせる（窓を選べば `startVenueEyes`〔冪等〕、「使わない」なら `stopVenueEyes`。開きかけ・閉じかけ・閉じている間は触らない）。撮る窓は発火のたびに読む（`createVenueVisionTarget`）ので次の発火から新しい窓。常駐の撮る係は撮るたびに窓の題を受け取る（開いたときの窓を持たない）ので起こし直しは要らない。窓を選ばずに開いた場で選んだときに起きていない問題は、上の「目を合わせる」で解いた。
- 入れていない: VC にいる人の一覧・人ごとの「聞かない」・人ごとの呼び名・KILL。
- 判断は `view-logic/discord.mjs` の `discordPanelView`（状態ごとのボタン・注記）・`discordFireBlockedByVc`・`discordPeopleText`・`discordVcPostErrorText`・`discordVcListErrorText`、`control.mjs` の `manualFireStreamView`。UI は描くだけ（区切りの 3 部品は hooks なし）。
- 下の帯の 2 回押し: 「通話を終える」（`DISCORD_LEAVE_TEXT` 系。道は今の場を閉じる道のまま・VC の外でも押せる）。上の帯のチップ「VC の外で待っている」に色（琥珀・点線の枠）と title。準備の `discordChannelId` は書き換えない（サーバの I のまま・パネルは触らない）。
- 狭い幅: 操縦席はもとから `min-width: 1200px`。既存の `@media (max-width: 1500px)` でパネルの余白を詰め、トグルの pill を 1 行に 1 つ。各行は `flex-wrap`、VC の行は `名前 | 人数 | ボタン` の grid で名前を省略記号で切る、選択肢は `min-width: 0`、パネルの中だけ縦にスクロール。

## 4. 画面・合図の文字列の全文（足した・変えたもの）

### パネル（`view-logic/discord.mjs`）
| 定数 | 文 |
|---|---|
| `DISCORD_PANEL_TITLE` | `Discord の操作` |
| `DISCORD_PANEL_SECTION_LABELS` | `接続` / `しゃべり方` / `見る窓` |
| `DISCORD_PANEL_SERVER_LABEL` | `サーバー` |
| `DISCORD_PANEL_SERVER_UNKNOWN` | `（読み込み中）` |
| `DISCORD_PANEL_CURRENT_LABEL`（joined） | `今いる VC: 〈VC〉` |
| `DISCORD_PANEL_DISCONNECTED_SUFFIX`（disconnected） | `今いる VC: 〈VC〉（切れた・つなぎ直しを待っている）` |
| joining | `VC に入っています…`（既存の `DISCORD_JOINING_TEXT`） |
| `DISCORD_PANEL_OUTSIDE_TEXT` | `どの VC にもいない（VC の外で待っている）` |
| `DISCORD_PANEL_UNKNOWN_CONNECTION` | `VC の状態が分からない` |
| `DISCORD_PANEL_UNNAMED_VC` | `（名前の無い VC）` |
| `DISCORD_PANEL_LEAVE_TEXT` | `抜ける` |
| `DISCORD_PANEL_JOIN_TEXT` / `DISCORD_PANEL_MOVE_TEXT` | `入る` / `移る` |
| `DISCORD_PANEL_HERE_TEXT` | `いまここ` |
| `DISCORD_PANEL_LIST_LABEL` | `同じサーバーの VC` |
| `DISCORD_PANEL_REFRESH_TEXT` | `一覧を更新` |
| `DISCORD_PANEL_LIST_LOADING` | `VC の一覧を読み込み中…` |
| `DISCORD_PANEL_LIST_EMPTY` | `このサーバーにはボイスチャンネルが無い` |
| `DISCORD_PANEL_OP_BUSY_NOTE` | `VC を操作している途中…` |
| `DISCORD_PANEL_NOT_OPEN_NOTE` | `通話を始めている・終えている途中は操作できない` |
| `discordPeopleText` | `〈N〉 人` |
| `DISCORD_PANEL_SELF_FIRE_LABEL` / `DISCORD_PANEL_BARGE_IN_LABEL` | `自発的にしゃべる` / `かぶり判定` |
| `DISCORD_PANEL_FIRE_LABEL` | `手動の Fire`（ボタンは既存の `🎤 Fire`・`🖼 Fire+視覚`） |
| `DISCORD_FIRE_NOT_IN_VC_NOTE` | `VC に入ると押せる` |
| `DISCORD_PANEL_VISION_HINT` | `選び直すと次の発火から新しい窓を見る` |
| `DISCORD_PANEL_WINDOWS_REFRESH_TEXT` | `窓の一覧を更新` |
| 見る窓の選択肢・状態 | 既存の `使わない（目を起こさない）`・`見る窓: 〈窓〉` / `見る窓: 使わない（Discord の場では目を起こさない）` |
| `discordVcPostErrorText` の既定 | `VC の操作ができない`（503 は既存の `DISCORD_UNAVAILABLE_NOTE`・それ以外はサーバの文面） |
| `discordVcListErrorText` の既定 | `ボイスチャンネルの一覧を読めない` |
| `ui/discord-panel.mjs` の通信の失敗 | `ボイスチャンネルの一覧を読めない（〈e〉）`・`窓の一覧を読めない（〈e〉）`・`VC の操作ができない（〈e〉）`・`見る窓を保存できない（〈e〉）` |

### 帯・案内（前 → 後）
| 定数 | 前 | 後 |
|---|---|---|
| `DISCORD_LEAVE_TEXT` | `VC から抜ける` | `通話を終える` |
| `DISCORD_LEAVE_ARMED_TEXT` | `もう一度押すと VC から抜ける` | `もう一度押すと通話を終える` |
| `DISCORD_LEAVING_TEXT` | `VC から抜けています…` | `通話を終えています…` |
| `DISCORD_CHAT_HIDDEN_NOTE` と server の `DISCORD_CHAT_CONNECT_REFUSED_MESSAGE`（同じ文面・既存テストが一致を固定） | `Discord の通話の間は YouTube のコメントにつながない（VC から抜けてから）` | `Discord の通話の間は YouTube のコメントにつながない（通話を終えてから）` |
| `DISCORD_OPEN_NOTE_IN_STREAM_PREP` | `Discord の VC に入っている（配信を始めるのは下の帯の「VC から抜ける」のあと）` | `Discord の通話の途中（配信を始めるのは下の帯の「通話を終える」のあと）` |
| `DISCORD_OPEN_NOTE` | `Discord の VC に入っている（抜けるときは下の帯の「VC から抜ける」）` | `Discord の通話の途中（終えるときは下の帯の「通話を終える」・VC の出入りは右のパネル）` |
| `DISCORD_PREP_LOCKED_NOTE` | `VC に入っている間は Discord の準備を替えられない（VC から抜けてから）` | `通話の間は Discord の準備を替えられない（通話を終えてから・見る窓は右のパネルで替えられる）` |
| 上の帯のチップ `outside` の title（`venueConnectionView`） | `VC の外で待っている` | `どの VC にもいない。通話は続いている（右のパネルの「入る」で VC に入る）`（表示の語 `VC の外で待っている` は I のまま） |
| 体験の `busyMessage("open")`（場が開いているのに始めようとしたとき） | `VC に入っている（抜けてから始め直す）` | `Discord の通話の途中（下の帯の「通話を終える」のあとで始め直す）` |
| 体験の `busyMessage("closing")` | `VC から抜けている途中（記録中・少し待ってからもう一度）` | `通話を終えている途中（記録中・少し待ってからもう一度）` |

### 出来事の行（`vc-people`・`venue-events.mjs`。①②④では頭に `event: `）
- 名前あり: `VC「〈VC〉」には〈名前〉・〈名前〉がいる`
- 名前の分からない人・並べる上限（20 人）を超えた人がいる: `VC「〈VC〉」には〈名前〉とほか 〈N〉 人がいる`
- 名前が 1 人も分からない: `VC「〈VC〉」には 〈N〉 人がいる`
- VC の名前が無い: `VC には…`（J の `vcOf` と同じ）。誰もいなければ行にしない。

## 5. 期待値を変えた既存テスト（全件）

| ファイル:行（今のファイル） | 前 → 後 | 理由 |
|---|---|---|
| `scripts/cockpit.test.mjs:933-934` | `onSaved` の deepEqual `{ atMs, entriesLength: 2, commit }` → `spokenLength: 2` を足す | 保存の係が要否の数え（出来事の行を除いた件数）も渡す（0(a)） |
| `src/cockpit/cockpit-server-discord-g.test.mjs:277`（題）・`:293-300` | Discord の場の間の `POST /api/discord/vision-target` が 409・書かない → 200・保存する（null と窓を 1 回ずつ） | **仕様変更**: 設計 §13.4 の 3「場の間の 409 を外す」。`:6` は頭のコメントの同じ記述だけ直した |
| `src/cockpit/cockpit-server-discord-j.test.mjs:374-375・381` | 出来事の行の並びに `VC「雑談」にはじろうがいる` を 2 か所（移ったあと・動かされたあと）足す | 0(b) のもういる人の行 |
| `src/cockpit/cockpit-ui-discord-g.test.mjs:82・93` | 閉じかけ `VC から抜けています…` → `通話を終えています…`（題も） | 「通話を終える」の語（計画 §8 K） |
| 同 `:104・116・124` | 下の帯 `VC から抜ける` / `もう一度押すと VC から抜ける` → `通話を終える` / `もう一度押すと通話を終える`（題も） | 同上 |
| 同 `:253-255` | App のソース照合 `discordVenue ? null : CommentsPanel`・`" solo"` → `discordVenue ? DiscordPanel : CommentsPanel`・`" discord"` | 右の領域にパネル（設計 §13.4） |
| 同 `:259` | CSS `.glance-main.solo { grid-template-columns: minmax(0, 1fr); }` がある → 無い（`doesNotMatch`） | 会話だけの 1 列をやめた（配信の割り付けの assert `:260` は不変） |
| `src/cockpit/view-logic/glance-discord-g.test.mjs:92-93・96` | `endStreamButtonView` の `VC から抜ける` / armed → `通話を終える` / `もう一度押すと通話を終える`（題も） | 「通話を終える」の語 |
| `src/discord/discord-experience-discord-i.test.mjs:70-73` | 偽の guild の下準備: `members` に BOT_OTHER の名前、`bots: [BOT_OTHER]` を足す | もういる人の行でほかの Bot を除けるように（期待値ではなく下準備） |
| 同 `:287-292` | 移ったあと `events.at(-1)` が `vc-move` → `vc-people` を待ってから `slice(-2)` が `[vc-move, vc-people{names:[はなこ], others:0}]` | 0(b) |
| 同 `:525-527` | VC 一覧の deepEqual に `guildName: "試しのサーバー"` を足す | パネルのサーバー名（裁量 4） |
| 同 `:544-545`（足しただけ）・`:562` | 合図の種類の並びに `vc-people` を足す（移ったあとに待つ 1 行を挿入） | 0(b) |
| `src/mind/venue-events-discord-j.test.mjs:54-56・82-83` | `LINE_CASES` に vc-people の全文 1 件、`VENUE_EVENT_LINE_KINDS` に `vc-people` を足す | 0(b)（「どの種類にも全文の例がある」の assert を満たすため） |

- 削った assert は 0（`.solo` の 1 つは否定に替えた）。配信の期待値の変更は 0。
- **J で `saveFinal:0→1` に変えた `src/cockpit/cockpit-server-discord-d.test.mjs:549-550` は戻っていない（`saveFinal:1` のまま pass）**。このテストは server が偽の口に渡す材料の件数を見ている。server は今も出来事の行つきの転写を `saveFinal` に渡し（「②に渡す中身には出来事の行を載せたまま」）、保存するかは `scripts/cockpit.mjs` の本物の `saveFinal` が `countSpokenEntries` で決める。戻すには server が出来事の行を材料から抜く必要があり、指示（中身に載せたまま）とぶつかるので、決める所を 1 か所にした。本物の口で走らないことは `scripts/cockpit-discord-k.test.mjs` で固定した（質問 1）。

## 6. 配信の画面が HEAD と同じことの確かめ

- `git archive 07e3d296 apps/soul/agent/src` を scratchpad に展開し、HEAD 版と今の版を同じ入力で比べた（スクリプトは scratchpad の `compare-stream.mjs`。リポジトリには置いていない）。入力は配信の場と閉じている間の stream（phase 6 × experience 3〔stream / null / 無し〕× connection 5〔崩れた値の outside / joined / joining も〕× error 2、と null / undefined）、ears・soul・つまみの組、疑似乱数で作った配信の SSE の並び 400 本（you / soul / viewer の行・fire・latency・selfFire・fireAsk・chatDiagnostic・diagnostic）。
- 比べた関数と件数: `streamStartView` 364・`endStreamButtonView` 364・`isPreStream` 910・`statusPillView` 9100・`manualFireStreamView` 182・`venueConnectionView` 182・`discordJoinView` 364・`driveSummaryView` 1092・`selfFireToggleView` 3・`bargeInToggleView` 3・`soulStatusView` 5・`fireNoteFromFireResponse` 5・`glanceAfterSseEvent`（状態）5686・`conversationRowsView` 800・`commentRowsView` 400・`diagnosticGhostLabel` 4。描くだけの ui 部品（vnode を展開して比べる）: `BottomBar` 2184・`TopBar` 1820・`FireButtons` 1820・`SelfFirePill` 3・`BargeInPill` 3・`ConversationPanel` 800・`ConversationPanel`（配信前の中央）728・`CommentsPanel` 400。**合計 27222 件・不一致 0**。
- 対照（比べ方が違いを拾えること）: Discord の入力では `manualFireStreamView({phase:"open",experience:"discord",connection:"outside"})` が `{blocked:false}` → `{blocked:true, note:"VC に入ると押せる"}`、`endStreamButtonView` が `VC から抜ける` → `通話を終える` と違いが出る。
- 配信の側のソース: `app.mjs` の配信の分岐は `CommentsPanel` のまま、`glance-main` の割り付けは同じ。`DrivePanel` は `useDriveControls` に切り出しただけで POST・状態の流れは同じ（既存の運転のタブのテストは期待値を変えずに pass）。

## 7. 裁量

1. もういる人の合図は新しい種類 `vc-people` `{ channelName, names, others }`。名前の分からない人（member が取れない）と 20 人を超えた人は「ほか N 人」に数える（チャッピーが人数を取り違えないため）。`control` / session-usage には書かず、ログにも出さない。
2. 名前と Bot かは `VoiceState.member`（手元のキャッシュ）、無ければ `guild.members.fetch`（1 人ずつ・最大 20 人）。名前を引く間に VC が替わったら合図しない。
3. 合図は `vc-join`・`vc-move`・`vc-moved` の直後に待たずに出す（入口の操作の応答を名前の取得で遅らせない）。`vc-reconnect` では出さない。
4. サーバー名は `GET /api/discord/vc` の応答に `guildName` を足して取る（体験の client の guild の名前・名前は id ではないので応答に載せる。snapshot には足していない）。
5. VC の一覧は、パネルを開いたとき・phase / 接続 / VC の名前が替わったとき・操作のあと・20 秒ごと・「一覧を更新」で読み直す（人数は voiceStates から数えるが、`channels.fetch()` は REST を 1 回呼ぶ）。
6. 見る窓の選び直しで目を合わせるのは「開いている（open）Discord の場」だけ。開きかけは開く段 7 が保存した窓を読む、閉じかけは閉じる段が目を止めるので触らない。
7. 手動 Fire の VC 外の断りは `manualFireStreamView` に入れたので、運転のタブの Fire にも同じく効く（サーバが not-in-vc で断るのと揃う）。`disconnected` は I に合わせて押せる。
8. `useDriveControls` を `control-bar.mjs` に切り出し、運転のタブとパネルで同じ POST の流れを使う。pill はラベルだけ props で替えられる（既定は「自発」「かぶり」のまま）。
9. 「通話を終える」の語を、それを指している案内（配信の準備・Discord の準備・Connect の断り・始めるの断り）にも揃えた。
10. パネルのボタン: 入っている途中はどれも押せない。切れた間は「抜ける」「移る」を押せる（サーバが受ける）。今いる行の印は VC にいる間だけ一覧の `current` を信じる。開きかけ・閉じかけ・応答待ちは押せず注記。
11. 準備・設定の「Discord の準備」の見る窓の select は、通話の間は今のまま固めた（案内に「見る窓は右のパネルで替えられる」を足した）。
12. 狭い幅は既存の 1500px の段で詰める（操縦席はもとから 1200px より狭くならない）。パネルの中だけ縦にスクロール。
13. 不要になった `.glance-main.solo` の CSS を消した。
14. 保存の数えは `countSpokenEntries` を `scripts/cockpit.mjs` に置き、保存の係の `onSaved` に `spokenLength` を足して `noteSaved` が使う。

## 8. 質問

1. **D のテストの `saveFinal:1`（J で 0→1 にしたもの）が戻らない件**（§5 の最後）: 「保存しない」の判定は本物の場の口（`scripts/cockpit.mjs`）に置き、server は材料に出来事の行を載せたまま渡す形にした。これでよいか。戻すなら server 側でも出来事の行だけの材料を `[]` にする（判定が 2 か所になる）。
2. 手動の「今日を記録」は出来事の行だけでも②を走らせる（明示の操作なので今の「判定を通らない」のまま）。これも止めるか。
3. Discord の準備のタブの見る窓の select を、通話の間も替えられるようにするか（今はパネルだけで替える・サーバはどちらからでも受ける）。
4. 名前の分からない人を「ほか N 人」と出す形でよいか（出さない案もある）。

## 9. 持ち越し（止めない）

- 実ブラウザでの見た目（パネルの並び・1200〜1500px の幅・長い VC の名前）は見ていない（起動しない決まり）。vnode とソースの照合・CSS の照合だけ。人間ゲート 3 で見る。
- 本物の Discord で `VoiceState.member` がキャッシュに無い人（特権 Intent なし）は `members.fetch` を人数ぶん呼ぶ。名前の出方と遅れは人間ゲート 3 で見る。
- 本物の `channels.fetch()` を 20 秒ごとに呼ぶ（REST）。回数が気になれば間隔を延ばすか、一覧の名前を体験の側でキャッシュする。
- パネルからの入る / 移ると、J の出来事の行・もういる人の行が左の「会話」に並ぶ見え方は人間ゲート 3。
- I の質問 1（抜けた瞬間の「（遮られた）」）、J の持ち越し（`skills/venue-discord.md` に `event:` の説明が無い）はそのまま。
