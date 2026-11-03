# Domain K レビュー — Discord 操作パネルと画面(設計 §13.4)＋ J の持ち越し 2 件

> Review-Sylph(読み取り専任)→ Orch-Sylph(2026-11-01)。対象: 未コミットの差分(ブランチ `ai-cohost/discord-mode`、HEAD `07e3d296`)と Gnome 報告 `waves/discord-mode/domain-k-gnome.md`。
> 判定の根拠: 設計 §13.2〜§13.5・§9、計画 §8 K・§4・冒頭 Status の Domain J の行(Undine の判断 (1)(4))、`human-gate-2-result.md` §2。鍵(`.env*.local`)・実データは開いていない。操縦席・実ブラウザ・本物の Discord/LLM は起動していない。ソースもテストも変えていない(作業ツリーも動かしていない。HEAD は `git archive` で scratchpad に展開)。

## 判定: **合格**(止める指摘 0)

## 1. 止めた指摘

なし。

## 2. 止めない指摘(持ち越し)

1. 【見た目の小さなずれ】`manualFireStreamView` は `phase !== "open"` を先に見るので、Discord の開きかけ・閉じかけの間もパネルの Fire の注記は「配信を始めると押せる」のまま(Discord の場でも配信の語)。押せない挙動は正しい。パネルは開きかけ・閉じかけでも出るので、語だけ「通話を始めると押せる」などにする余地。配信の語を変えない決まりのため今は止めない。
2. 【実機でしか分からない】実ブラウザでの並び・幅 1200〜1500px・長い VC 名。CSS は読んだ(下の §5)。人間ゲート 3 で見る。Gnome の持ち越しに同意。
3. `VoiceState.member` が無い人(特権 Intent なし)は `members.fetch` を人数ぶん(最大 20)呼ぶ。`channels.fetch()` の REST を 20 秒ごと。実機で遅れ・回数を見る。Gnome の持ち越しに同意。
4. 入った直後に同じ人の `person-join` が先に届き、続けて `vc-people` にも同じ人が載る重複はありうる(行は両方残る。害は小さい)。人間ゲート 3 で見え方を確かめる程度。
5. 配信でない場の `lastRecordedSeq`(保存の数え)の意味が「転写件数」から「出来事を除いた件数」に変わった。配信は出来事の行が無く同値(テストで固定)。`lastRecordedSeq()` を参照する他の読み手は `scripts/cockpit.mjs` 内の 1263 行のアクセサだけ(`cockpit.test.mjs` 以外に使う所なし)。

## 3. 設計適合(節ごと)

- **§13.4 / 計画 K — 右の領域**: `app.mjs` で `discordVenue ? DiscordPanel : CommentsPanel`、`glance-main` の割り付け(60fr/36fr)は同じ。会話だけの 1 列(`.solo`)をやめた(仕様変更として説明がつく。§13.4 は「コメントを出している右の領域に出す」)。左の `ConversationPanel` の props・形は不変(差分に左の変更なし)。適合。
- **接続**: サーバー名(`GET /api/discord/vc` の `guildName`)・今いる VC と「抜ける」・同じサーバーの VC 一覧と人数・「入る」/「移る」の 1 回押し(`POST /api/discord/vc {action, channelId}`)。状態ごと(joined / joining / disconnected / outside)のボタンと注記は `discordPanelView` に寄せ、UI は描くだけ。一覧は体験の client の guild から(2 本目のログインなし。`listVoiceChannels` は既存、`guildName` を足しただけ)。適合。準備の `discordChannelId` は書き換えない(パネルは `/api/discord/vc` だけを叩く。`settings` に書く経路なし)。
- **しゃべり方**: 「自発的にしゃべる」「かぶり判定」は `SelfFirePill` / `BargeInPill`(ラベルだけ props、既定は運転のタブのまま)、「🎤 Fire」「🖼 Fire+視覚」は `FireButtons`、POST の流れは `DrivePanel` から切り出した `useDriveControls`(本体は移しただけ。差分で hooks の順・POST・状態の流れが元のまま)。Fire は `manualFireStreamView` が Discord の場で `outside`/`joining` のとき押せず「VC に入ると押せる」(`disconnected` は押せる = サーバーが断らない側に合わせた)。設計 §13.3 に適合。
- **見る窓**: 選択と「使わない」(`discordVisionOptions` など G の既存部品を再利用)。サーバーは場の間の 409 を外し、開いている Discord の場(`phase==="open"`)で選び直したら `syncDiscordVenueEyes`(窓あり=`startVenueEyes`、「使わない」=`stopVenueEyes`)。`residentCapture.start()` は冪等(`wanted && state!=="gaveUp"` で return)、`capture(title)` は呼ぶたびに題を受ける、発火は `createVenueVisionTarget` が毎回 `settings.getDiscordVisionTarget()` を読む。よって「選び直したら次の発火から新しい窓」「常駐の撮る係が開いたときの窓のまま」にならない。開きかけ・閉じかけは触らない判断も妥当(開く段 7 が保存した窓を読む/閉じる段が止める)。適合。
- **入れないもの**: パネルのソースに VC にいる人の一覧・人ごとの「聞かない」・呼び名・KILL の部品なし(`discord-panel.mjs` 全文を読んだ)。human-gate-2-result §2 の表に一致。
- **帯**: 下の帯 `DISCORD_LEAVE_TEXT`=「通話を終える」(中身は `endStreamButtonView` → 場を閉じる道のまま。VC の外でも押せる)。上の帯は「VC の外で待っている」(I の語)に色(`.venue-connection.outside`)と title を足した。適合。「通話を終える」の語は案内(`DISCORD_OPEN_NOTE` など)にも揃えたが、変えた定数・断りはすべて `discordVenue` ガード内の使用(`settings-drawer.mjs` 1107/1212/1286/1291・`glance-meters.mjs` 254)で、配信には出ない(§4 参照)。
- **J の持ち越し (1)(Undine の判断 (1))**: `countSpokenEntries` が `isEventEntry` を除いて数え、`saveFinal`(`spoken>0 && !skip(spoken, lastRecordedSeq)` でなければ `record([])`)と `checkpoint`(`spoken===0 || skip` で false)で使う。`noteSaved` は `spokenLength` を `lastRecordedSeq` に使う。中身(`record(entries)` の材料)は出来事の行を載せたまま。適合(§6 の質問 1 も参照)。
- **J の持ち越し (2)(Undine の判断 (4))・設計 §13.5**: 体験側 `announcePresent` が入った(開く・パネル)・移った・動かされた(`vc-moved`)直後に guild の `voiceStates` から今の VC の人(Bot 自身除く)を引き、`member.user.bot` でほかの Bot を除き、`vc-people {channelName, names, others}` を `emitVc`。誰もいなければ合図しない。待たない・失敗は握りつぶし・`say()` を呼ばない(ログなし)。場の側は J と同じ道(`venueVcEventMouth` → `noteVenueVcEvent` → `appendVenueEventLine`)で、`VC_EVENT_CONTROLS` に `vc-people` が無いので session-usage の control にも書かれない。判定・発火には回らない(J の `openVenueTranscript` の購読が `isEventEntry` を飛ばす構造は無変更。テストで判定の呼び出し 0・発火 0・予定への届き 0 を固定)。行の語は J の `vcOf`・「・」並べ・`VC「…」には…がいる` で語調が揃う。適合。
- **§13.1 の「変えないもの」**: 配信のふるまい(§13.6 の途中保存の直しは H で済み)、判定と発火の流れ、左の「会話」の表示は不変。
- **§9 / 守り(§10)**: Discord の id はパネルでは key と押す口の引数にだけ(`discordPanelView` が label に id を入れないことをテストで固定)。snapshot に id を足していない(`guildName` は名前)。

## 4. 配信の画面が HEAD と同じことの確認(自分で独立に)

1. 変更ファイルの切り分け: 配信の見え方に関わる変更ファイルは `view-logic/control.mjs`・`view-logic/discord.mjs`・`ui/control-bar.mjs`・`ui/app.mjs`・`ui/styles.mjs`。それ以外の view-logic・ui は差分 0(`git diff HEAD --stat`)。
2. 独立の総当たり(scratchpad の `rv/generic-compare.mjs`・Gnome のスクリプトは使っていない): HEAD(`git archive 07e3d296` を `scratchpad/rv-head` に展開)と今で、`control.mjs`・`discord.mjs`・`control-bar.mjs`・`glance-meters.mjs` の **export されたすべての関数**(定数も)を、配信・閉じている間・崩れた値(phase 6 値 × experience 4 値〔stream/null/undefined/other〕× connection 6 値〔outside/joined/joining/disconnected を含む〕× error × vcName ＋ null/文字列/数/オブジェクトなどの雑多な引数)の 1-2 引数・4 引数の組み合わせで呼んで deepEqual: **1,592,873 件・不一致 0**。定数で違ったのは Discord 専用の語 7 つだけ(`DISCORD_CHAT_HIDDEN_NOTE`・`DISCORD_LEAVE_ARMED_TEXT`・`DISCORD_LEAVE_TEXT`・`DISCORD_LEAVING_TEXT`・`DISCORD_OPEN_NOTE`・`DISCORD_OPEN_NOTE_IN_STREAM_PREP`・`DISCORD_PREP_LOCKED_NOTE`。Gnome 報告 §4 と一致し、使われる場所はすべて `discordVenue` ガード内)。描くだけの部品は vnode を展開して比べた(`BottomBar`・`TopBar`・`FireButtons`・`SelfFirePill`・`BargeInPill`・`ConversationPanel`・`CommentsPanel` など)。比べ方に穴: フック付きの `DrivePanel` は関数単体では走らないので 1 のスクリプトでは比べていない(両側で同じ投げ方になるだけ)。これは切り出した差分を読んで補った(上の「しゃべり方」)。
3. Gnome のスクリプトも同じ HEAD 展開で再実行: 27,222 件・不一致 0(Gnome の数字を再現)。入力は配信の phase/experience/connection の総当たり＋疑似乱数の SSE 並び 400 本で、配信の状態を十分に覆う。
4. `app.mjs` の配信の分岐: `glance-main` のクラスは配信で `"glance-main"`(HEAD と同じ)、`CommentsPanel` の props 同じ。`styles.mjs` の追加はすべて `.discord-*` / `.venue-connection.outside`(配信に `outside` は出ない)で、`@media (max-width:1500px)` の追加も `.discord-*` だけ。削除は `.glance-main.solo`(配信では使われない)。
5. 配信の固定テスト: `git diff HEAD --stat -- src/mind/fixtures src/mind/stream-wording-pin.test.mjs skills discussion/_conventions.md package.json pnpm-lock.yaml` は空(差分 0)。

## 5. テスト適合(約束の確かめごと)

- (a)(b) のテスト: `scripts/cockpit-discord-k.test.mjs`(出来事だけでは途中保存・最後の保存とも走らない・人の行があれば走り中身に出来事の行が載る・出来事の行が増えただけでは頼み直さない・配信の数えは件数のまま・`onSaved` の `spokenLength`)、`cockpit-server-discord-k.test.mjs`(開いたとき・移る・抜けて入る・動かされたの各場合に 1 行、Bot 自身とほかの Bot は除く、誰もいなければ行なし。判定 0 回・発火 0・予定に届かない・ログ/session-usage/control に名前と id が出ない・`vc-people` が control に無い)、`venue-events-discord-k.test.mjs`(行の全文・「ほか N 人」・上限)、`discord-experience-discord-i.test.mjs`(`vc-move` 直後の `vc-people`、Bot 除外)。約束どおり揃っている。
- view-logic のテスト(状態ごと): `discord-panel-k.test.mjs` が joined / joining / outside(古い一覧の current を信じない)/ disconnected / busy・開きかけ・閉じかけ・読み込み前・空 / 配信で null / id が文字列に出ない / Fire(VC 外・入っている途中は押せない、入っている・切れたは押せる、配信は不変)/ 下の帯 / 上の帯のチップ。揃っている。
- 見る窓を場の途中で替えたら次の発火で新しい窓: `cockpit-discord-k.test.mjs` の 2 件(本物の server・本物の体験の口・偽の Discord・本物の `fire-orchestrator`・偽の撮る係。選び直し→次の Fire+視覚で新しい窓、「使わない」で撮らない、窓を選ばずに開いた場で窓を選べば目を起こす)。揃っている。
- UI: `cockpit-ui-discord-k.test.mjs`(接続・しゃべり方・見る窓の vnode、ソース照合、CSS)。
- 期待値を変えた既存テスト(Gnome 報告 §5 の 13 項目)を `git diff HEAD -U1` で 1 件ずつ確認: すべて仕様変更として説明がつく — 語の変更(「VC から抜ける」→「通話を終える」)、`.solo` の廃止(`doesNotMatch` に反転・配信の割り付けの assert は不変)、G の 409 → 200(設計 §13.4 の 3)、J/I のテストへ「もういる人」行の追加、偽 guild の下準備(`bots`)、`onSaved` に `spokenLength`、一覧に `guildName`。**削られた assert は 0**(`.solo` は `match` → `doesNotMatch` に替えただけ)。
- `cockpit-server-discord-d.test.mjs:549-550` の `saveFinal:1`(§6 の質問 1): 偽の口に渡す材料の件数を見るテストで、server が出来事の行つきの転写を `saveFinal` に渡す仕様(②に渡す中身には出来事の行を載せたまま)と矛盾しない。「保存しない」の判定は本物の口(`scripts/cockpit.mjs` の `createStreamVenueHooks.hooks.saveFinal`)で、`cockpit-discord-k.test.mjs` が本物の `createStreamVenueHooks` と本物の `createMemoryRecorder` で「出来事の行だけ → `written` が空」を固定している。`saveFinal` を呼ぶ口は server の `runRoleHooksAll("saveFinal", transcript)`(3063・3083 行)の 2 か所で、どちらも hooks 経由なので判定は 1 か所で効く。Undine の判断 (1) は実際の保存の口で満たされている。
- 幅の狭い画面(CSS を読んだ範囲): 操縦席はもとから `min-width:1200px`。右の領域は `minmax(0, 36fr)` ≒ 1200px で約 430px。`.discord-panel{min-width:0}`、`.discord-panel-body` は `overflow-y:auto`＋`min-height:0`、各行は `flex-wrap`、`.discord-current`/`.discord-server-name` は `overflow-wrap:anywhere`、VC の行は `grid(minmax(0,1fr) auto auto)` で名前だけ省略記号、選択肢は `min-width:0`・`max-width:100%`、1500px 以下で余白を詰めトグルを 1 行 1 つ。崩れる構造は見当たらない(実ブラウザは見ていない = 持ち越し 2)。

## 6. Gnome の質問 4 つへの見立て

1. **`saveFinal:1` を戻さない件**: Gnome の形でよい。判定が 1 か所(本物の口)に集まり、server は材料を渡すだけ(②の中身に出来事の行を載せる指示とも整合)。戻すと判定が 2 か所になり、server がある種の「材料の絞り込み」を持つのでむしろ悪い。D のテストの題か注記に「偽の口に渡す材料の件数」と書いておくと次に読む人が迷わない(任意)。
2. **手動の「今日を記録」は出来事の行だけでも②を走らせる**: それでよい。明示の操作で、設計 §13.6 も判断 (1) も「最後の保存・途中保存」を対象にし、手動は対象外。止めない。
3. **準備のタブの見る窓の select は通話の間は固めたまま**: それでよい。設計 §13.4 は見る窓の操作の置き場をパネルに寄せている。サーバーはどちらからでも受けるので二重に持つ意味が薄く、案内文(`DISCORD_PREP_LOCKED_NOTE`)に「右のパネルで替えられる」と書いてある。
4. **名前の分からない人を「ほか N 人」と出す**: それでよい。チャッピーが人数を取り違えない利点がある(名前だけで並べると、分からない人が欠落して人数が減って見える)。J の文と語調も揃う。

## 7. 守りの決まりの確かめ結果

- 鍵: 差分・新規ファイルに `process.env`・鍵ファイルの読み取りなし。`.env.discord-chappy.local` はテストの偽の `currentKeyFile` の文字列としてだけ登場(J までの既存テストと同じ書き方。ファイルを開かない)。トークンはテストの偽物(`fake.discord-token_for-…`)。環境変数に入れる所なし。
- ID: 差分と新規ファイルに 15 桁以上の数字なし。テストの id は文字列の偽物(`guild-fake-k1` など)。ソースにサーバー・チャンネルの ID の直書きなし。
- ログ: 追加行に `console.*`・`process.stdout/stderr` なし。`announcePresent` は `say()` を呼ばず、catch は握りつぶし。名前は合図(`vc-people`)の中と出来事の行の本文にだけ。ログ・session-usage・control に名前と id が出ないことは `cockpit-server-discord-k.test.mjs` が本物の server で固定。
- 声の保存: 追加行に `writeFile`/`appendFile`/`createWriteStream` なし(新規テストは OS の一時フォルダの設定ファイルのみ)。
- 変更禁止の物: `_conventions.md`・種のファイル・`skills/`・②④の配信の文面・固定テストの fixture・`package.json`・`pnpm-lock.yaml` はすべて差分 0。J の `event:` 行の文面(`vc-people` を除く既存の語)も不変。
- 実データ: テストの置き場は OS の一時フォルダ(`mkdtempSync(tmpdir())`)。`cockpit-settings.local.json`・`memories/`・`roles/`・`session-usage/`(実データ)・`fire-diagnostics/` に触れる記述なし。

## 8. 機械ゲート(自分で走らせた)

- `apps/soul/agent` で `node --test`: **2277 / 2277 pass・fail 0・cancelled 0・skipped 0**(約 92 秒。Gnome の件数と一致)。
- リポジトリ根で `pnpm run check:soul-zone`: pass(1624 files scanned、境界違反なし)。
- 配信の固定テスト `stream-wording-pin.test.mjs` と `src/mind/fixtures/`: 差分 0・全体の中で pass。

## 9. 裁量の評価

Gnome 報告 §7 の 14 件はいずれも設計・計画に反せず可。とくに妥当な点: (3) `vc-reconnect` では出さない(つながり直しで人は変わらない)、(6) 目の起こし直しを `open` の間だけ(開く段・閉じる段との二重を避ける)、(7) 手動 Fire の VC 外の断りを `manualFireStreamView` に入れて運転のタブにも効かせた(サーバーの `not-in-vc` と揃い、設計 §13.3「手動の Fire はボタンを押せなくする」に沿う)、(8) `useDriveControls` の切り出し(「API も同じ・運転タブの部品を再利用」の要件を満たす最小の形)、(14) `countSpokenEntries` を `scripts/cockpit.mjs` に置く(保存の判定が 1 か所)。(5) の `channels.fetch()` を 20 秒ごとに呼ぶのは実機で回数を見る(持ち越し 3)。
