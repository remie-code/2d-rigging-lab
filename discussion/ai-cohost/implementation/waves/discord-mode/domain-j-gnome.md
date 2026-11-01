# Domain J Gnome 報告 — 人が気づく出来事(設計 §13.5)

> Gnome(実装)→ Orch-Sylph(2026-11-01)。計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §8 Domain J。設計: [../../../architecture/discord-mode.md](../../../architecture/discord-mode.md) §13.5。
> コミットはしていない(ブランチ `ai-cohost/discord-mode`、HEAD `e983695c`)。鍵(`.env*.local`)は読んでいない。実データ(`cockpit-settings.local.json`・`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`)には触れていない。操縦席は起動していない。本物の Discord・LLM・外部 API は呼んでいない。依存・lockfile は変えていない。`_conventions.md`・種のファイル・`skills/`・②④の配信の文面は変えていない。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2246 / 2246 pass**(2229 から +17) |
| 根で `pnpm run check:soul-zone` | pass(1618 files) |
| `src/mind/stream-wording-pin.test.mjs` と `src/mind/fixtures/` | pass・**差分 0**(`git diff` が空) |
| `skills/`・`package.json`・`pnpm-lock.yaml` | 差分 0 |
| 新しいテストの安定 | 新しい 2 本と、期待値を変えた D・I の 2 本を合わせて 5 回続けて回し、毎回 43/43 pass。新しい 2 本だけでもさらに 3 回回して毎回 pass |
| 感度 | 守りを 1 つずつ外すと落ちることを確かめた: 場の購読の飛ばし(3 件落ちる)・予定の no-op(1 件)・世代の結び(1 件)・閉じかけの段の見分け(1 件)・「避けるか」の飛ばし(1 件)・コメント反応の飛ばし(1 件)。外した変更は全部元に戻した |

## 2. 変更ファイル(`apps/soul/agent/` 起点)

- 新規(実装): `src/mind/venue-events.mjs`(出来事 → 行の本文の純関数)
- 変更(実装):
  - `src/ears/transcript-buffer.mjs`(行の種類 `"event"`・`EVENT_SPEAKER`・`isEventEntry`)
  - `src/cockpit/cockpit-server.mjs`(`noteVenueVcEvent` から正本に足す `appendVenueEventLine`・開いた世代に結ぶ `venueVcEventMouth`・場の購読で出来事の行を飛ばす)
  - `src/discord/discord-experience.mjs`(`emitVc` が `x.closed` のあとは合図しない)
  - `src/mind/fire-injection.mjs`・`src/mind/memory.mjs`(`event: 本文` のラベル)
  - `src/mind/recall.mjs`・`src/mind/comment-react.mjs`(判定の入力で出来事の行を飛ばす)
  - `src/mind/fire-scheduler.mjs`(出来事の行は no-op。守りの二重化)
  - `src/mind/venue-wording.mjs`(`CALL_WORDING.speakers` に出来事の行の説明)
  - `src/cockpit/view-logic/glance-timeline.mjs`・`src/cockpit/ui/conversation.mjs`・`src/cockpit/ui/styles.mjs`(左の「会話」の欄の控えめな 1 行・ログのタブの色)
- 新規(テスト): `src/mind/venue-events-discord-j.test.mjs`(11)、`src/cockpit/cockpit-server-discord-j.test.mjs`(6)
- 変更(既存テストの期待値): `src/cockpit/cockpit-server-discord-d.test.mjs`、`src/cockpit/cockpit-server-discord-i.test.mjs`、`src/mind/wording-discord-f.test.mjs`(§6)

## 3. 作ったもの

### 3.1 正本の行の種類「出来事」

- 話者の 3 種類(you / soul / viewer)とは別の 4 つ目の値 `speaker: "event"` にした(`EVENT_SPEAKER`)。soul・viewer と同じく `startMs/endMs = 0`、窓は `appendedAtMs`。本文は短い日本語の 1 文。名前は本文の中にだけあり、`displayName`・`speakerId` は持たない。
- 検証は値を 1 つ足しただけ(知らない値は今まで通り `RangeError`。文面に `"event"` を足した)。既存の読み手で `speaker === "you"` を見る所(speak-now の `handleTranscript`・`latestYouSeq`・`buildSpeakNowInput` など)は、何もしなくても出来事の行を除く。
- 「you に寄せる」既定の分岐を持つ所は全部手当てした: ①②のラベル(`event` を足す)、判定の入力 2 か所(飛ばす)、発火の予定(no-op)、場の購読(飛ばす)、左の「会話」の欄(専用の行)。
- 出来事の行は放送する(SSE `transcript`、`speaker: "event"`、`displayName: null`、id なし)。snapshot の `transcripts` にも載る(開き直しても出る)。

### 3.2 源と足す所

- 源は I の合図のまま(体験 → `x.venue.vcEvent` → server)。人の出入り(`person-join` / `person-leave`)は I の `handleVoiceState` に既にあった(今いる VC だけ・Bot 自身とほかの Bot は除く・ほかのサーバーは見ない)。偽物の拡張は要らなかった。
- server の `noteVenueVcEvent(event)`: `control` の記録は I のまま(種類だけ)。そのあとに `appendVenueEventLine(event)` で正本に足して放送する。
- 足すのは次をすべて満たすときだけ:
  - サーバーが閉じていない
  - `streamPhase` が `"opening"` か `"open"`(開いたときの「入った」は開きかけの間に届く)
  - 正本がある
  - 合図がこの場の世代のもの: 入口に渡す口 `venueEntranceContext().vcEvent` を、開いた世代に結んだ口 `venueVcEventMouth(streamGeneration)` にした。前の場の体験から次の場を開いたあとに遅れて届いた合図は、`control` にも正本にも書かない。
- 体験の側でも `emitVc` は `x.closed` のあとは合図しない(I の持ち越し「閉じたあとに control を 1 行書きうる」の手当て)。
- 失敗は try/catch で握り、入口の操作を止めない。

### 3.3 頭への会話の窓・②④

- ①(`formatFireInjection` / `Since`)と②④(`formatTranscriptForDigest` → `formatRecentConversation`)は `event: 本文` の 1 行で載る。ほかの行の形は変わらない(テストで固定)。
- Discord の語の組の材料の説明 `CALL_WORDING.speakers` に、出来事の行の説明を足した(71 字。1 行・80 字以内の見張りを通る)。配信の語の組・配信の文面は一字も変えていない。②の材料の見出しと④の直近の会話の見出しに出る:
  - `you = 通話で話す人（括弧の中はその人の名前）、soul = 相方の AI 自身、event = 通話の中の出来事（入った・抜けたなど）。`

### 3.4 判定に渡さない・きっかけにしない

- 場の購読(`openVenueTranscript` の `onAppend`)の先頭で `isEventEntry(entry)` なら return する。発火の予定の `handleTranscript` と speak-now の `handleTranscript` に回らない。
- 発火の予定(`fire-scheduler.mjs`)も `speaker === "event"` を no-op にした(守りの二重化。you・soul・viewer の分岐は不変)。名前を含む出来事の行(例「チャッピーが VC…」)が呼びかけ(call)にならないこと、区切りの構えのあとでも撃たないこと、沈黙のタイマを張り直さないことをテストで固定した。
- 判定の入力の組み立て:

| 組み立て | 手当て |
|---|---|
| `buildSpeakNowInput`(配信・Discord の問いで共有) | もともと you / soul / 欠落しか入れないので無変更。テストで確認 |
| `buildCommentReactInput` | 出来事の行を飛ばす 1 行 |
| `composeRecallAvoidInput`(`buildRecallAvoidInput`・`buildDiscordRecallAvoidInput` の共通部) | 出来事の行を飛ばす 1 行 |

  どれも「出来事の行を抜いた入力と一字も同じ」ことをテストで固定した。配信には出来事の行が無いので、配信の判定の文字列は変わらない(固定テストで確認)。
- 発火の流れ(予定・speak-now の分岐・barge-in〔VAD だけを見る〕・orchestrator)は変えていない。

### 3.5 左の「会話」の欄

- 左の「会話」の欄の正体は `view-logic/glance-timeline.mjs` + `ui/conversation.mjs`(`view-logic/transcript.mjs` はログのタブ〔`ui/rows.mjs`〕の側)。
- `glanceWithTranscript` が `speaker: "event"` を会話の列の `kind: "event"` の行として積む(seq つきなので推論の範囲に入る)。`conversationRowsView` は時刻と本文だけを出す(話者名・判定の札・遅延・きっかけの札は付けない)。
- `ConversationRow` は `convo-row event` の行(時刻・空の話者・本文)を描く。CSS は `.convo-row.event { min-height: 30px; color: var(--ghost); font-size: 12px; }`(相槌の間隔の薄い行と同じ控えめさ)。
- ログのタブは既存の `speakerLabel` の既定のまま `event` のラベル・`row speaker-event` の行になる。CSS で薄い灰色にした。
- ほかの行の表示は、出来事の行を抜いたときと同じ(key と範囲の印を除き deepEqual)。

### 3.6 ログ・記録の守り

- server は出来事の行で何も標準出力に書かない。`control` は I のまま種類だけ。人の出入りと vc-reconnect は書かない。
- テスト: 本物の `controlUsageRecord` と本物の `createSessionUsageLog` で一時フォルダに書き、ファイルに人の名前・VC の名前・Discord の id・出来事の文が無いことを確かめた。体験のログの行(`log`)も同じく確かめた。
- **fire-diagnostics**: 頭への文をそのまま書き出す所は無かった。`fireDiagnostics.begin` に渡るのは `injectedChars`・`includedCount`・`vision`・`fireNo`・`causeType` だけで、trace の各イベントも数と種類だけ(`fire-orchestrator.mjs` の `trace(...)` を全部見た)。出来事の行は既存の you / viewer の名前と同じく、文字数・行数に数えられるだけで本文・名前は書かれない。既存のふるまいを変える必要は無いと判断した。
- snapshot・放送には出来事の文(VC の名前・人の名前を含む)が載る。既存の you・viewer の名前、I の `vcName` と同じ扱い。id は載らない(テストで確認)。

## 4. 出来事の行の文の全文(kind ごと)

チャッピー自身の名前はロールの `canonicalName`(`currentSoulName()`。テストでは「チャッピー」)。〈〉は差し込み。

| kind | 文(名前があるとき) | 名前が無いとき |
|---|---|---|
| `vc-join`(`via: "open"` / `"panel"` とも) | `チャッピーが VC「〈VC〉」に入った` | `チャッピーが VC に入った` |
| `vc-leave` | `チャッピーが VC「〈VC〉」から抜けた` | `チャッピーが VC から抜けた` |
| `vc-move`(パネルから移った) | `チャッピーが VC「〈前の VC〉」から「〈VC〉」に移った` | 前が無ければ `チャッピーが VC「〈VC〉」に移った` |
| `vc-moved`(Discord の画面で動かされた) | `チャッピーが VC「〈前の VC〉」から「〈VC〉」に動かされた` | 前が無ければ `チャッピーが VC「〈VC〉」に動かされた` |
| `vc-kicked`(4014・Bot 自身が外へ) | `チャッピーが VC「〈VC〉」から外された` | `チャッピーが VC から外された` |
| `vc-disconnect`(猶予のあいだ戻らなかった) | `チャッピーの VC「〈VC〉」への接続が切れた` | `チャッピーの VC への接続が切れた` |
| `vc-reconnect`(切れたのが戻った) | `チャッピーの VC「〈VC〉」への接続が戻った` | `チャッピーの VC への接続が戻った` |
| `person-join` | `〈名前〉が入ってきた` | `誰かが入ってきた` |
| `person-leave` | `〈名前〉が出ていった` | `誰かが出ていった` |

- ①②④の中では `event: ` を前に付けた 1 行になる(例 `event: たろうが入ってきた`)。
- 名前は空白・改行を 1 つの空白に詰め、100 字で切る。ロールの名前が無ければ「相方の AI」。知らない種類・形の崩れた合図は行にしない。

## 5. 確かめたこと(テスト)

`src/mind/venue-events-discord-j.test.mjs`(純関数・11 件):

- 種類ごとの全文。名前が無い・空白・改行・長すぎる・知らない種類。
- 正本の形(event・名前と id の欄なし・凍っている・空は捨てる・知らない値は断る)。
- ①の窓・増えた分だけの窓。②の材料と頼み(通話の語の組の見出し)。④の直近の会話と頼み。
- 判定の入力 5 本(speak-now の配信 / Discord・コメント反応・避けるかの配信 / Discord)に出来事の行が入らず、抜いた入力と同じ。
- 発火の予定(名前入りでも呼びかけにならない・区切りの構えでも撃たない・タイマ不変・you は今まで通り)。
- 左の「会話」の欄(行・範囲・ほかの行が同じ・履歴から作っても同じ)・描画と CSS・ログのタブ。

`src/cockpit/cockpit-server-discord-j.test.mjs`(本物の server と体験と偽の Discord・6 件):

- 全種類の合図が正本に並び、放送と snapshot に載る(Bot・ほかのサーバー・ほかの VC の出入りは行にならない)。判定は人の 1 行でだけ走り、入力は `参加者(たろう): こんばんは` だけ。fire 0・予定の発火 0・予定に出来事の行が届かない。放送・snapshot に id が無い。
- ①(`getBuffer`)・④(`getTranscript`)・②(`saveFinal` の材料 + 場の語の組で組んだ頼み)に載る。
- 体験のログ・`control`・session-usage のファイルに名前・VC の名前・id・出来事の文が無い。
- 遅れて届いた合図:
  - 閉じかけでは足さない(正本がまだある目を止める所と、最後の保存の待ちの両方)
  - 閉じたあとも足さない
  - 次の場(配信)を開いたあとに届いた前の場の合図は、正本・放送・`control` のどこにも書かない
- 出来事が続いても判定は走らない(人の行でだけ走る)。
- 配信の場には出来事の行が無い。配信の正本に出来事の行を直に積んでも、予定に回らず呼びかけにならない(人の呼びかけは今まで通り call)。

## 6. 期待値を変えた既存テスト(全部 Discord 側。配信の期待値は 0)

| ファイル:行(変更後) | 変更 | 理由 |
|---|---|---|
| `src/cockpit/cockpit-server-discord-d.test.mjs:415-416` | 正本の行の並びの先頭に `["event", undefined, undefined, "チャッピーが VC「一般」に入った"]` | 開いたときの「入った」の出来事の行(§13.5) |
| `src/cockpit/cockpit-server-discord-d.test.mjs:421`・`:424-425` | 放送の transcript を待つ数 2 → 3、放送の並びの先頭に `[null, "チャッピーが VC「一般」に入った", undefined]` | 出来事の行も放送する(名前の欄は null・id なし) |
| `src/cockpit/cockpit-server-discord-d.test.mjs:470-475` | 正本 `["またね"]` → `["チャッピーが VC「一般」に入った", "またね", "はなこが出ていった"]` | 入った・人が出ていったの出来事の行 |
| `src/cockpit/cockpit-server-discord-d.test.mjs:549-550` | `"chappy.saveFinal:0"` → `"chappy.saveFinal:1"` | 最後の保存の材料に「入った」の 1 行が載る(②に載る) |
| `src/cockpit/cockpit-server-discord-d.test.mjs:879-886`(足しただけ)・`:953-954`・`:962`・`:989` | 本物の耳の 2 本のテストで `h.server.getTranscript()` を `heardLines(h)`(出来事の行を除く)に替えた。期待値の数・中身は不変 | 耳の区切りを確かめるテストで、正本の行数に「入った」の 1 行が混ざるため |
| `src/cockpit/cockpit-server-discord-i.test.mjs:322-327` | 抜けたあとの `transcripts` `["こんにちは"]` → 入った・こんにちは・抜けた | 出来事の行 |
| `src/cockpit/cockpit-server-discord-i.test.mjs:343-350` | 入り直したあとの正本 `["こんにちは", "続きだけど"]` → 入った・こんにちは・抜けた・入った・続きだけど | 出来事の行(同じテストの「判定は 2 回」は不変で、出来事でも判定が走らないことも同時に示す) |
| `src/cockpit/cockpit-server-discord-i.test.mjs:550-552` | `saveFinal:今日はここまで` → `saveFinal:チャッピーが VC「一般」に入った\|今日はここまで\|〈抜けた / 移った〉` | 最後の保存の材料に出来事の行が載る |
| `src/mind/wording-discord-f.test.mjs:90`・`:122`・`:140` | 通話の語の組 `speakers` の全文に `、event = 通話の中の出来事（入った・抜けたなど）。` | 材料の説明の 1 行に出来事の行の説明を足した(委任の「可」の範囲) |

削った assert・skip にしたテストは 0。

## 7. 裁量

1. **行の種類は `speaker` の 4 つ目の値 `"event"`**。別の欄(例 `kind`)にしなかった。別の欄にすると、それを見ない既存の読み手が you の行として扱うため。
2. **チャッピー自身の行の主語はロールの名前**(`currentSoulName()`)。①でも②でも「誰が」が分かる。無ければ「相方の AI」。
3. **`vc-moved` は「動かされた」**。設計の例は「〈VC 名〉に移った」(パネルからでも、画面で動かされたのでも)。人が普通に気づく「誰かに動かされた」を残すため、文だけ分けた(質問 2)。`vc-move` と `vc-moved` は前の VC があれば「「A」から「B」に」と書く。
4. **`vc-disconnect` / `vc-reconnect` も行にする**(「接続が切れた」「接続が戻った」)。通話の人には Bot が落ちたことが見えるので、チャッピーも知ってよい出来事として扱った。I の合図は猶予のあいだ戻らなかったときに 1 回だけなので、短い途切れでは行が増えない。
5. **人の名前が取れないときは「誰か」**(行は作る)。
6. **①のラベルは `event:`**(you / soul / viewer と同じ英字のラベル)。②④は語の組の説明で意味を伝える。①の説明は足していない(質問 1)。
7. **足すのは開きかけ・開いている間だけ + 開いた世代の合図だけ**。世代の結びは `control` にも効く。I では、次の場を開いたあとに前の場の体験から遅れて届いた合図も `control` に書かれえた。今は書かない(I の持ち越しの手当てで、同じ場の中のふるまいは不変)。体験の側も `x.closed` のあとは合図しない。
8. **場の購読で飛ばす + 発火の予定でも no-op**(守りの二重化)。予定の側の 1 か所は、出来事の行が来たときだけ通る。既存の 3 つの値のふるまいは不変。
9. **出来事の行は SSE `transcript` で放送し、snapshot の履歴にも載せる**(左の欄と開き直しのため)。
10. **左の欄の行は時刻つき**(相槌の間隔の薄い行は時刻なし)。いつ入った・出たかが会話の流れの中で読めるように。

## 8. 持ち越し(止めない)

- **途中保存**: 途中保存の「転写が増えている」は行の数で見ている(`scripts/cockpit.mjs` の `shouldSkipMemoryCheckpoint(entries.length, …)`)ので、出来事の行だけが増えても途中保存の頼みに数える(20 分の決まりは変わらない)。害は小さい見立てだが、出来事だけの 20 分で②が 1 回走りうる。
- **手動の Fire**: 出来事の行だけでも①の窓が空でなくなるので、手動の Fire は「（前回から新しい発言はなし）」ではなく出来事の行を渡して ask する。設計 §13.5「出来事に反応させたいときは手動の Fire で足りる」に合う。
- **VC に入った時点でもういる人**は行にしていない(入ってきた・出ていったの出来事だけ)。質問 3。
- **I の質問 1**(抜けた瞬間の割り込みの注記「…（遮られた）」)は、出来事の行「抜けた」と並んで見える。見え方は人間ゲート 3。
- 本物の Discord での合図の順(動かされたときの 4014 と状態の知らせ、人の出入りの名前の取れ方)と、左の欄の見え方(薄さ・幅の狭い画面)は人間ゲート 3 / K。
- 2 つ目のロールが入ったら、主語の名前と `soul` のラベルの関係を見直す。

## 9. 質問(Undine へ。どれも仮に決めて進めた)

1. **①の教え `skills/venue-discord.md` に、`event:` の行の説明を 1 行足すか**。例: 「会話の `event:` の行は、通話の中の出来事(誰かが入った・出た、自分が VC に入った・抜けた など)です」。今は②④の材料の説明にだけ書いてある。①は行の文そのもので分かる見込みで足していない(委任の決まりどおり変えずに質問)。
2. **`vc-moved` を「動かされた」にしてよいか**(裁量 3)。設計どおり「移った」に揃えるなら、`venue-events.mjs` の 1 か所と J のテストの全文 2 か所を直すだけ。
3. **VC に入ったとき(開いたとき・パネルから・移った先)にもういる人を、出来事の行にするか**(例「たろう・はなこがいる」)。設計 §13.5 は出入りだけを挙げているので、今は足していない。
4. **出来事の行だけが増えたときも途中保存を頼んでよいか**(持ち越し 1)。頼まない形にするなら、`checkpoint()` の数え方(人と soul の行だけを数える)の変更になる。H の範囲に触るので、J では変えていない。
