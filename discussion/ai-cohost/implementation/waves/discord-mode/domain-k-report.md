# Domain K 完了報告 — Discord 操作パネルと画面(＋ J の持ち越し 2 件)

> 判定: **pass**(ループ 1 回・止めた指摘 0・Review-Sylph が合格)。製品判断で止める質問は無い。Gnome の質問 4 つは Orch とレビューの見立てを添えて §8 に上げる(どれも今の形で設計に反しない)。
> Orch-Sylph(2026-11-01)。ブランチ `ai-cohost/discord-mode`(HEAD `07e3d296`)。コミットしていない。
> 子: Gnome(opus)`aca5df524a50ab2bf`、Review-Sylph(sonnet)`a32f6a2a62789d487`。どちらも SubagentHandback で完了を返した(生き残りなし)。
> Gnome の報告 [domain-k-gnome.md](domain-k-gnome.md)(変更・文言・期待値の変更・裁量の全文はここが正)、レビュー [../../reviews/discord-mode/domain-k.md](../../reviews/discord-mode/domain-k.md)。
> 鍵(`.env*.local`)は誰も読んでいない。実データ(`cockpit-settings.local.json`・`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`)に触れていない。操縦席・本物の Discord / LLM / 外部 API・実ブラウザは起動していない。依存・lockfile・`skills/`・`_conventions.md`・種のファイル・②④の配信の文面・固定テストの fixture の差分 0。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2277 / 2277 pass**(土台 2246 から +31)。Gnome とレビューの両方で実行 |
| 根で `pnpm run check:soul-zone` | pass(1624 files) |
| `src/mind/stream-wording-pin.test.mjs` の fixture | `git diff HEAD` の差分 0 |
| 配信の画面が HEAD と同じ | Gnome: view-logic 16 関数 + ui 部品 8 つで 27222 件・不一致 0。レビューが独立に別のスクリプトで、配信に関わる変更ファイル 4 本の export 全部を phase・experience・connection・崩れた値の総当たりで 1,592,873 件・不一致 0(違いの出た定数は Discord 専用の語 7 つで、すべて `discordVenue` の条件の中)。Gnome のスクリプトの 27222 件も再現。比較スクリプトはどちらも scratchpad で、リポジトリには置いていない |

## 2. 変更ファイル(`apps/soul/agent/` 起点)

- 実装: `scripts/cockpit.mjs`、`src/mind/venue-events.mjs`、`src/discord/discord-experience.mjs`、`src/cockpit/cockpit-server.mjs`、`src/cockpit/view-logic/discord.mjs`、`src/cockpit/view-logic/control.mjs`、`src/cockpit/ui/control-bar.mjs`、`src/cockpit/ui/app.mjs`、`src/cockpit/ui/styles.mjs`。新規 `src/cockpit/ui/discord-panel.mjs`。
- 偽物: `src/test-support/fake-discord.mjs`(guild の `bots`・`members.fetch`・voiceStates の member)。
- テスト新規(31 件): `scripts/cockpit-discord-k.test.mjs`(7)、`src/cockpit/cockpit-server-discord-k.test.mjs`(2)、`src/cockpit/cockpit-ui-discord-k.test.mjs`(8)、`src/cockpit/view-logic/discord-panel-k.test.mjs`(12)、`src/mind/venue-events-discord-k.test.mjs`(2)。
- 既存テストの変更: 7 ファイル(§4)。

## 3. 作ったもの(要約)

- **J の持ち越し (a)**: `countSpokenEntries`(出来事の行を除いた件数)で最後の保存・途中保存の要否を決める。②に渡す中身には出来事の行を載せたまま。保存の係の `onSaved` に `spokenLength`、`lastRecordedSeq` はこれで数える(配信は件数が同じ)。判定は本物の場の口(`createStreamVenueHooks`)の 1 か所。本物の口と本物の保存の係で「出来事の行だけ → 書き出し 0 回」をテストで固定。
- **J の持ち越し (b)**: `vc-join`(開いたとき・パネル)・`vc-move`・`vc-moved` の直後に、体験の側 `announcePresent` が今いる人の合図 `vc-people { channelName, names, others }`(id なし)を出し、J と同じ道で正本の出来事の行に。Bot 自身とほかの Bot を除く・誰もいなければ出さない・control / session-usage / ログに書かない・判定と発火の予定に回らない(テストで固定)。
- **パネル**(`DiscordPanel`): Discord の場の間(開きかけ・閉じかけを含む)だけ右の領域(配信のコメントと同じ割り付け)。配信は今のまま `CommentsPanel`。`.solo` の 1 列はやめた。
  - 接続: サーバー名(`GET /api/discord/vc` の応答に足した `guildName`)・今いる VC と「抜ける」・VC の一覧と人数・「入る」/「移る」(1 回押し)。
  - しゃべり方: `DrivePanel` から切り出した `useDriveControls` と既存の部品(`SelfFirePill`・`BargeInPill`・`FireButtons`)で、同じ 4 つの API。Fire は `outside` / `joining` で押せず「VC に入ると押せる」(運転タブの Fire にも同じく効く)。
  - 見る窓: server の Discord の場の間の 409 を外した。開いている Discord の場で窓を選べば `startVenueEyes`(冪等)、「使わない」なら `stopVenueEyes`。撮る窓は発火のたびに読み、常駐の撮る係も撮るたびに題を受け取るので、次の発火から新しい窓(偽物でテスト)。
  - 判断は view-logic(`discordPanelView` ほか)、UI は描くだけ。
- 下の帯「通話を終える」(道は場を閉じるまま)、上の帯の「VC の外で待っている」に色と title。準備の `discordChannelId` は書き換えない。左の「会話」の形は不変(J の行と K の `vc-people` の行を除く)。
- 狭い幅: 操縦席はもとから `min-width: 1200px`。既存の 1500px の段で余白を詰め、行は `flex-wrap`、VC の行は grid で名前を省略記号、パネルの中だけ縦スクロール(CSS の照合だけ。実ブラウザは人間ゲート 3)。

## 4. 期待値を変えた既存テスト(全件の行・前後は Gnome 報告 §5)

レビューが 13 項目を 1 件ずつ確かめ、すべて仕様変更として説明がつく・削られた assert 0・配信の期待値の変更 0。

| ファイル | 中身 | 理由 |
|---|---|---|
| `scripts/cockpit.test.mjs:933-934` | `onSaved` に `spokenLength: 2` を足す | (a) の数え |
| `src/cockpit/cockpit-server-discord-g.test.mjs:277・293-300`(と頭のコメント `:6`) | Discord の場の間の見る窓の POST 409 → 200・保存 | **仕様変更**(設計 §13.4 の 3「場の間の 409 を外す」) |
| `src/cockpit/cockpit-server-discord-j.test.mjs:374-375・381` | 移った・動かされたあとに `VC「雑談」にはじろうがいる` | (b) |
| `src/cockpit/cockpit-ui-discord-g.test.mjs:82・93・104・116・124` | 「VC から抜ける」系 → 「通話を終える」系 | 計画 §8 K の語 |
| 同 `:253-255・259` | `discordVenue ? null : CommentsPanel`・`solo` → `DiscordPanel`・`discord`、`.solo` の CSS がある → 無い(否定に替えた) | 右の領域にパネル(§13.4) |
| `src/cockpit/view-logic/glance-discord-g.test.mjs:92-93・96` | `endStreamButtonView` の語 → 「通話を終える」 | 同上 |
| `src/discord/discord-experience-discord-i.test.mjs:70-73・287-292・525-527・544-545・562` | 偽の guild の下準備(ほかの Bot)、移ったあとの合図に `vc-people`、VC 一覧に `guildName` | (b)・サーバー名 |
| `src/mind/venue-events-discord-j.test.mjs:54-56・82-83` | `vc-people` の全文の例と種類の一覧 | (b) |

- **戻っていないもの**: J で `saveFinal:0→1` にした `src/cockpit/cockpit-server-discord-d.test.mjs:549-550` は `1` のまま。このテストは server が偽の口に渡す材料を見ており、保存しない判定は本物の口に 1 か所だけある(server の 2 か所の `saveFinal` はどちらもこの口を通る)。Undine の判断 (1) は実際の保存の口で満たされている(レビューが確認・`scripts/cockpit-discord-k.test.mjs` で固定)。§8 の質問 1。

## 5. 画面の文言の全文

### パネル
`Discord の操作`／区切り `接続`・`しゃべり方`・`見る窓`／`サーバー`・`（読み込み中）`／`今いる VC: 〈VC〉`・`今いる VC: 〈VC〉（切れた・つなぎ直しを待っている）`・`VC に入っています…`(既存)・`どの VC にもいない（VC の外で待っている）`・`VC の状態が分からない`・`（名前の無い VC）`／`抜ける`・`入る`・`移る`・`いまここ`／`同じサーバーの VC`・`一覧を更新`・`VC の一覧を読み込み中…`・`このサーバーにはボイスチャンネルが無い`／`VC を操作している途中…`・`通話を始めている・終えている途中は操作できない`／`〈N〉 人`／`自発的にしゃべる`・`かぶり判定`・`手動の Fire`(ボタンは既存の `🎤 Fire`・`🖼 Fire+視覚`)・`VC に入ると押せる`／`選び直すと次の発火から新しい窓を見る`・`窓の一覧を更新`(選択肢・状態は既存の `使わない（目を起こさない）`・`見る窓: 〈窓〉`・`見る窓: 使わない（Discord の場では目を起こさない）`)／失敗 `VC の操作ができない`・`ボイスチャンネルの一覧を読めない`・`ボイスチャンネルの一覧を読めない（〈e〉）`・`窓の一覧を読めない（〈e〉）`・`VC の操作ができない（〈e〉）`・`見る窓を保存できない（〈e〉）`(503 は既存の `DISCORD_UNAVAILABLE_NOTE`、それ以外はサーバの文面)。

### 帯・案内(前 → 後)
| 定数 | 後 |
|---|---|
| `DISCORD_LEAVE_TEXT` / `_ARMED_TEXT` / `DISCORD_LEAVING_TEXT` | `通話を終える` / `もう一度押すと通話を終える` / `通話を終えています…`(前は「VC から抜ける」系) |
| `DISCORD_CHAT_HIDDEN_NOTE` = server の `DISCORD_CHAT_CONNECT_REFUSED_MESSAGE` | `Discord の通話の間は YouTube のコメントにつながない（通話を終えてから）` |
| `DISCORD_OPEN_NOTE_IN_STREAM_PREP` | `Discord の通話の途中（配信を始めるのは下の帯の「通話を終える」のあと）` |
| `DISCORD_OPEN_NOTE` | `Discord の通話の途中（終えるときは下の帯の「通話を終える」・VC の出入りは右のパネル）` |
| `DISCORD_PREP_LOCKED_NOTE` | `通話の間は Discord の準備を替えられない（通話を終えてから・見る窓は右のパネルで替えられる）` |
| 上の帯 `outside` の title | `どの VC にもいない。通話は続いている（右のパネルの「入る」で VC に入る）`(表示の語 `VC の外で待っている` は I のまま) |
| 体験の `busyMessage("open")` / `("closing")` | `Discord の通話の途中（下の帯の「通話を終える」のあとで始め直す）` / `通話を終えている途中（記録中・少し待ってからもう一度）` |

### 出来事の行 `vc-people`(①②④では頭に `event: `)
`VC「〈VC〉」には〈名前〉・〈名前〉がいる`／`VC「〈VC〉」には〈名前〉とほか 〈N〉 人がいる`(名前の分からない人・20 人を超えた人)／`VC「〈VC〉」には 〈N〉 人がいる`(名前が 1 人も分からない)／VC の名前が無ければ `VC には…`。誰もいなければ行にしない。

## 6. 裁量(Gnome が決め、レビューが設計に反しないと評価。全文は Gnome 報告 §7)

主なもの: 合図の新しい種類 `vc-people`(control / session-usage に書かない)／名前は `VoiceState.member`、無ければ `members.fetch`(最大 20 人)、取る間に VC が替わったら出さない／`vc-reconnect` では出さない・入口の応答を待たせない／サーバー名は VC 一覧の応答の `guildName`(snapshot には足さない)／VC 一覧の読み直しは開いたとき・状態が替わったとき・操作のあと・20 秒ごと・「一覧を更新」／見る窓で目を合わせるのは open の Discord の場だけ／Fire の VC 外の断りは運転タブにも効く(`disconnected` は I に合わせて押せる)／`useDriveControls` の切り出し／「通話を終える」の語を案内の文にも揃えた／準備のタブの見る窓は通話の間は固めたまま(案内に「右のパネルで替えられる」)／`.glance-main.solo` の CSS を消した。

## 7. 持ち越し(止めない)

1. 開きかけ・閉じかけの間、パネルの Fire の注記が「配信を始めると押せる」のまま(押せないふるまいは正しく、語だけ。レビューの指摘)。気になれば人間ゲート 3 のあとに語を足す。
2. 実ブラウザでの見た目(1200〜1500px の幅・長い VC の名前)。人間ゲート 3。
3. 本物の Discord での `members.fetch`・`channels.fetch`(20 秒ごとの REST)の回数と遅れ、名前の出方。人間ゲート 3。
4. 入った直後に同じ人の `person-join` と `vc-people` が両方載る重複が起こりうる(順の偶然による)。人間ゲート 3 で見える程度なら放置可。
5. `lastRecordedSeq` の意味が「出来事を除いた件数」に変わった(配信は同値)。
6. 前からの持ち越し: I の質問 1(抜けた瞬間の「（遮られた）」)、`skills/venue-discord.md` に `event:` の説明が無い(Undine の判断で変えない)。

## 8. 質問(Undine へ。どれも止めない。今の形で設計に反しない)

1. `cockpit-server-discord-d.test.mjs:549-550` の `saveFinal:1` を戻さない形(判定を本物の口の 1 か所に置く)でよいか。Orch・レビューとも「よい」の見立て。
2. 手動の「今日を記録」は出来事の行だけの通話でも②を走らせる(明示の操作なので今のまま)。Orch・レビューとも「今のままでよい」。
3. Discord の準備のタブの見る窓は通話の間は固めたまま(替えるのはパネルだけ。server はどちらからも受ける)でよいか。Orch・レビューとも「よい」。
4. 名前の分からない人を「ほか N 人」と出す形でよいか。Orch・レビューとも「よい」(人数を取り違えない)。

## 9. 全体の突き合わせ(2 回目)と人間ゲート 3 で見てほしい所

- 突き合わせ: (a) の保存の判定が本物の口の 1 か所にあり、手動の「今日を記録」・配信の途中保存(H の 20 分)とどう並ぶか。`vc-people` が判定・発火の予定・session-usage に回らないこと(J の除外の上に乗っている)。見る窓の 409 を外したことで、開きかけ・閉じかけの段と目の起こし・止めがぶつからないか(Gnome は open の間だけ触る形にした)。手動 Fire の VC 外の断りが view-logic と server(I の `not-in-vc`)で揃っていること。配信の画面の不変(今回 2 回の総当たりで不一致 0)。
- 人間ゲート 3: パネルの見た目と狭い幅、VC の一覧の人数とサーバー名、入る・抜ける・移るの 1 回押しと左の「会話」に並ぶ出来事の行(`vc-people` と `person-join` の重複を含む)、VC の外で Fire が押せず注記が出る、通話の途中で見る窓を替えて次の発火から新しい窓を見る(窓を選ばずに開いてから選ぶ場合も)、「通話を終える」の 2 回押し、入って誰も話さず通話を終えたときに記憶が書かれない。
