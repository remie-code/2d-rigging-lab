# Domain G Gnome 報告 — 画面（設計 §9）（Gnome 2026-11-01）

> 計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain G と Status の D・E・F の追認の持ち越し。
> ブランチ `ai-cohost/discord-mode`（HEAD `90314e7b`）。**コミットしていない**。ブランチも切り替えていない。
> 鍵（`.env*.local`）は読んでいない。実データ（`cockpit-settings.local.json`・`memories/`・`roles/`）には触れていない（mtime は作業前のまま）。操縦席を実データで起動していない。本物の Bot・LLM・外部 API は呼んでいない。依存・lockfile の変更なし。

## 1. 変更ファイル（`apps/soul/agent/` 起点）

### 変更（実装）

| ファイル | 中身 |
|---|---|
| `src/cockpit/cockpit-server.mjs` | `DISCORD_CHAT_CONNECT_REFUSED_MESSAGE`・`CHAT_BUFFER_ABSENT_MESSAGE` を export。`normalizeVenueExperience` に `visionTarget`・`eyesWanted` を足した。`startVenueEyes` は体験の口が「目を起こさない」と言えば起こさない。`GET / POST /api/discord/vision-target` を足した。`POST /api/chat/connect` は Discord の場の間 409。`chatBufferAbsent` の文面 |
| `src/discord/discord-experience.mjs` | `visionTarget = { get, set }`・`eyesWanted()`・`checkDiscordVisionTarget` / `normalizeDiscordVisionTarget`。`catalog()` は `currentKeyFileRefused` なら鍵を読まずログインせずに断る |
| `src/cockpit/cockpit-settings-store.mjs` | `getDiscordVisionTarget` / `setDiscordVisionTarget`（キー `discordVisionTarget`） |
| `src/roles/role-store.mjs` | 形の合わない `discordBotKeyFile` の元の値を列挙されない symbol の項目に持ち、書き戻しでそのまま書く |
| `scripts/cockpit.mjs` | `createVenueVisionTarget`（export）。`createDiscordVenueExperience` に `currentKeyFileRefused` と見る窓の置き場。main の Discord の体験の口に `currentKeyFileRefused`、発火の `getVisionTarget` を `venueVisionTarget` に |
| `src/cockpit/ui/app.mjs` | `venueExtrasFromSnapshot`（export）。`joinDiscord`。`ConversationPanel` に `join`。Discord の場はコメントの列を出さない（`glance-main solo`）。`BottomBar` / 設定のダイアログに `speakStartFixed`・`discordAvailable` |
| `src/cockpit/ui/conversation.mjs` | 「配信を始める」の横に「Discord の VC に入る」（`join.show` のときだけ） |
| `src/cockpit/ui/bottom-bar.mjs` | `speakStartFixed` を受けて `driveSummaryView` へ |
| `src/cockpit/ui/header.mjs` | Discord の場の間だけ接続の状態のチップ |
| `src/cockpit/ui/control-bar.mjs` | `SpeakStartSelect` に `fixed` |
| `src/cockpit/ui/settings-drawer.mjs` | タブ「Discord の準備」（6 つ目）。Discord の場の間は YouTube の Connect を出さない。ロールのタブの話し始めを `fixed` に |
| `src/cockpit/ui/styles.mjs` | `.venue-connection`・`.glance-main.solo` |
| `src/cockpit/view-logic/glance-meters.mjs` | `streamStartView`・`endStreamButtonView`・`driveSummaryView` を体験の語に（配信の文言は不変） |
| `src/cockpit/view-logic/glance-timeline.mjs` | you の行に `displayName` を持ち、`conversationRowsView` の `experience` で名前を出す |
| `src/cockpit/view-logic/ghost.mjs` | `chatBufferAbsent` のラベル |

### 新規（実装）

- `src/cockpit/view-logic/discord.mjs`（画面の Discord の表示導出。何も import しない）

### 新規（テスト・46 件）

| ファイル | 件数 |
|---|---|
| `src/cockpit/cockpit-server-discord-g.test.mjs` | 9 |
| `src/cockpit/cockpit-ui-discord-g.test.mjs` | 13 |
| `src/cockpit/view-logic/glance-discord-g.test.mjs` | 10 |
| `src/discord/discord-experience-discord-g.test.mjs` | 4 |
| `src/roles/role-store-discord-g.test.mjs` | 5 |
| `src/cockpit/cockpit-settings-store-discord-g.test.mjs` | 1 |
| `scripts/cockpit-discord-g.test.mjs` | 4 |

### 変更（既存テスト）

§3 の一覧のとおり 7 ファイル。

## 2. テスト結果

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2173 / 2173 pass**（2127 から +46・約 92 秒） |
| 根で `pnpm run check:soul-zone` | pass（1610 files） |
| `git diff --stat -- src/mind skills src/voice` | 差分 0（固定テスト `src/mind/stream-wording-pin.test.mjs` と fixture・`skills/` は触っていない。固定テストは全件の中で pass） |
| 依存・lockfile | 差分 0 |
| `apps/soul/agent/tmp/` | 元からの 2 つだけ |

- 守りのテストのうち 1 つは、守りの 1 行（コメント反応の `!venueFixesSpeakNow()`）を一時的に外すと落ちることを確かめてから戻した。
- 目視の確認もした。偽の操縦席（一時フォルダの設定・偽の Discord・偽の耳・偽の窓の一覧。実データ・鍵には触れない）をブラウザで開いた。
  - 確かめた流れ: Discord の準備（読み込む → サーバー → チャンネル → 見る窓）→ VC に入る → 上の帯「VC に入っている」・コメントの列が消える・配信の準備の Connect が消える → 「VC から抜ける」2 回押し → 閉じた画面に戻る。
  - コンソールのエラーは 0。ターミナルの `discord:` 行に名前・id は出なかった。
  - 終わったあと、サーバを止め、一時フォルダを消した。

## 3. 期待値を変えた既存テスト

| ファイル:行 | 前 → 後 | 理由 | 認めたものか |
|---|---|---|---|
| `scripts/cockpit-discord-d.test.mjs:139` | main の `createDiscordVenueExperience({...})` の正規表現 3 行 → `currentKeyFileRefused` の行を足した 4 行 | 一覧の読み込みも鍵のファイル名で断る | **認めたもの**（E の追認 (1)・作るもの 9(a)） |
| `src/roles/role-store-discord-e.test.mjs:52`（題名）・`:65`・`:72-73` | `roleToJson(role).discordBotKeyFile === ""`・role.json の `discordBotKeyFile === ""`・「元の値を書かない」 → 元の値 `C:/keys/${FAKE_TOKEN}` のまま | 書き戻しで元の値を残す | **認めたもの**（E の追認 (4)・作るもの 9(b)）。頭のコメント `:8` も直した |
| `src/cockpit/cockpit-ui.test.mjs:608-610`・`:615` | タブの id / 名前の並び 5 つ → 6 つ（`discord` / 「Discord の準備」を 2 番目に）・`role="tabpanel"` の数 5 → 6 | 設計 §9 のタブを足した | **認めたもの**（「タブを 1 つ足すのは設計 §9 どおりなので可」） |
| `src/cockpit/cockpit-ui.test.mjs:631` | `settingsModalNextCategory("prepare","ArrowRight")` `"role"` → `"discord"` | 同上（タブが 1 つ増えた結果） | 同上 |
| `src/cockpit/cockpit-ui.test.mjs:650`・`:657`・`:659-661` | キーボードの偽のタブの列に `discord` を足し、位置の番号を 1 つずらした（`[0,ArrowRight]` `"role"` → `"discord"`、`[1,End]` → `[2,End]`、`[3,Home]` / `[3,ArrowRight]` → `[4,…]`） | 同上 | 同上 |
| `src/cockpit/cockpit-server.test.mjs:1919` | `/ears not running/` → `/venue not open/` | `chatBufferAbsent` の文面を場の語に | **裁量で認められたもの**（作るもの 10） |
| `src/cockpit/view-logic/ghost.test.mjs:46` | `"(chat: ears not running — comment did not merge)"` → `"(chat: venue not open — comment did not merge)"` | 同上（ログのタブのラベルも合わせた） | 同上（作るもの 10 の続き。ログのタブの英語の 1 行だけ） |

期待値ではなく**下準備を足した**もの（期待値は不変）:

- `src/cockpit/cockpit-server-discord-d.test.mjs:207-208`
- `scripts/cockpit-discord-e.test.mjs:159-160`

どちらも Discord の場の見る窓を `settings.setDiscordVisionTarget("偽のゲームの窓")` で選んでおく 1 行。

- 理由: 作るもの 3（設計 §4.3 の 7）で、選んでいなければ Discord の場では目を起こさなくなった。
- この 2 つのテストは開く順（… → 再生器 → **目** → 頭）を固定するのが趣旨なので、期待値の `"eyes.start"` を消すのではなく、窓を選んだ場を作る形にした。
- 期待値で受けたいなら、`"eyes.start"` を外す形にも替えられる（質問 3）。

## 4. 画面の流れ

**準備（場が閉じている間）**

1. メイン画面の中央に「配信を始める」「Discord の VC に入る」「準備・設定」が並ぶ。Discord の入口が無いサーバでは、今の 2 つのまま。
2. 「準備・設定」 → タブ「Discord の準備」（配信の準備の右）。
3. 「読み込む」を押す。ロールの Bot がログインし、サーバーとボイスチャンネルを読んでログアウトする。
   - 「サーバー」「ボイスチャンネル」の select に名前が並ぶ。id は option の value だけ。
   - まだ読み込んでいなくても、保存したものは「保存したサーバー（「読み込む」で名前が出る）」として残る。
   - 選ぶとその場で保存される（`POST /api/discord/prep`）。サーバーを替えるとチャンネルは消える（D のまま）。
   - 鍵のファイル名の形が合わなければ、ここで `DISCORD_REASONS.keyFileName` の文面が出る。ログインはしない。
4. 「見る窓（目）」: 先頭が「使わない（目を起こさない）」、その下に窓の一覧（配信のゲームの窓と同じ一覧・別に保存）。選ぶとその場で保存（`POST /api/discord/vision-target`）。
5. 「文字起こし」: 選ぶとその場で保存。
6. いちばん下の「Discord の VC に入る」か、メイン画面の「Discord の VC に入る」を押す。どちらも `POST /api/stream/start { experience: "discord" }`。

**入っている途中**

- メイン画面: 「配信を始める」（押せない）、「VC に入っています…」（押せない）。
- 上の帯: 状態のピル「始めてる」と「VC に入っている途中」。

**入った**

- 上の帯に「VC に入っている」。
- 会話は横いっぱい（コメントの列は出さない）。you の行は Discord の名前（名前が取れなかった人は「参加者」）、チャッピーの行はロールの名前。
- 下の帯: 「話し始め speak-now（固定）」。「忙しい間のコメント」は出さない。歯車の左に「VC から抜ける」。
- 準備・設定:
  - Discord の準備は固まる（「VC に入っている間は Discord の準備を替えられない」）。
  - 配信の準備の YouTube の Connect は出さない（「Discord の通話の間は YouTube のコメントにつながない」）。Disconnect と欄はそのまま。
  - ロールのタブの話し始めは speak-now を出して押せない。断りの文面も出す。

**切れた**

- 上の帯のチップが赤く「VC から切れた（つなぎ直しを待っている）」になる。場は閉じない。戻れば「VC に入っている」。

**抜ける**

1. 「VC から抜ける」を押すと「もう一度押すと VC から抜ける」に変わる（4 秒で戻る）。
2. 続けて押すと抜ける。
3. 閉じかけはメイン画面に「VC から抜けています…」と「記録中…」。
4. 閉じたら最初の画面に戻る。

**入れないとき**

- 場は開かない。メイン画面の中央（と Discord の準備のタブの下）に `stream.error` の文面がそのまま赤く出る。
- 例:「Discord の準備でサーバーとボイスチャンネルを選んでいない」「VC に入れない（時間切れ・権限・満員など）」。

## 5. 配信の画面が変わっていないことの確かめ方

- 既存の画面のテスト（`cockpit-ui*.test.mjs`・`view-logic/*.test.mjs`）は、§3 の表のもの以外は期待値を変えずに通る。
  - `ConversationPanel` のボタンの並び `["prestream-start","prestream-open"]`
  - `streamStartView` / `endStreamButtonView` の deepEqual
  - BottomBar の文言
  - `settingsFromSnapshot` の deepEqual（新しい値は `venueExtrasFromSnapshot` に分けて、項目を増やしていない）
  - `.glance-main` の 60fr / 36fr
- 新しいテストで配信の側を名指しで確かめた。
  - 「配信者」のまま（名前が載っていても・体験が null / stream / 既定）。
  - 方式が選べる（`SpeakStartSelect` の fixed でない形・BottomBar「従来」）。
  - 「忙しい間のコメント」が出る。
  - 「配信を終える」2 回押し。
  - 配信の Connect がソースに残り、`POST /api/chat/connect` が配信の場と閉じている間は 200。
  - 配信の始めるの body は `{}` / `{ device, sttEngine }` のまま。
  - タブの先頭は配信の準備で、開くと配信の準備。
  - 配信の場の目は Discord の見る窓に関わらず起こす。
  - snapshot の `visionTarget` は配信の見る窓のまま。
  - `driveSummaryView` は第 2 引数なしでも同じ。
  - 配信の speak-now ではコメント反応を判定する。
- 配信のときに増えたのは、メイン画面のボタン 1 つ（Discord の入口があるとき）とタブ 1 つ。上の帯のチップ・コメントの列を隠す・Connect を隠すは、Discord の場の間だけ。

## 6. G への持ち越し各項目の扱い

1. **体験は場を開くときに選ぶ**: 済み。メイン画面の「Discord の VC に入る」。起動時は何も選ばない。ロール・運転・記憶・ログのタブは共通のまま。`POST /api/stream/start { experience: "discord" }`。
2. **準備・設定のタブ**: 済み。「配信の準備 / Discord の準備 / ロール / 運転 / 記憶 / ログ」。中身はサーバー・ボイスチャンネル（読み込む）・見る窓・文字起こし、いちばん下に「Discord の VC に入る」。
3. **Discord の場の目**:
   - 済み。保存は `discordVisionTarget`。API は `GET / POST /api/discord/vision-target`（body `{ title }`・null / "" で消す・400 / 409 / 503）。
   - 体験の口の `eyesWanted()` が false なら、場の段（始める 7）で目を起こさない。
   - 発火の見る窓は `createVenueVisionTarget` で Discord の場だけ Discord の見る窓にした。選んでいなければ null で、orchestrator の今の「対象未設定 = 画像なし」の道を通る。
   - 配信の目と配信の見る窓は不変。
4. **入る / 抜ける**: 済み。「VC から抜ける」は 2 回押しで、置き場は今と同じ。途中の文言は「VC に入っています…」「VC から抜けています…」。配信の文言は不変。
5. **接続の状態**: 済み。上の帯のチップ（入っている途中・入っている・切れた）。入れない理由は `stream.error` をそのまま中央へ。Discord の場の間はコメントの列・YouTube の Connect・「忙しい間のコメント」を出さない。
6. **会話の行のあなたの名前**: 済み。Discord の場は行の `displayName`、無ければ「参加者」（F の判定のラベルと同じ語）。配信は「配信者」。`transcript.mjs` の `speakerLabel`（ログのタブ）は見たうえで変えていない（§8 の 6）。
7. **話し始めの方式**: 済み。`speakStartFixed === true` で、ロールのタブの select は speak-now 固定・押せない・断りの文面（F の `DISCORD_SPEAK_START_FIXED_MESSAGE` と一字同じ写しをテストで固定）。下の帯のメーターは「speak-now（固定）」で、`role.speakStartMode` より先に `speakStartFixed` を見る。
8. **YouTube の Connect**: 済み。画面は Discord の場の間 Connect を出さない。サーバは 409 `{ error: DISCORD_CHAT_CONNECT_REFUSED_MESSAGE, state }`（開きかけ・閉じかけの既存の 409 と同じ形）。コメント反応を Discord の場で判定しない守りのテストも付けた（守りを外すと落ちることを確認）。
9. **サーバ側の直し**:
   - (a) 済み。`catalog()` が `currentKeyFileRefused` を見て、鍵を読まずログインせずに `DISCORD_REASONS.keyFileName`（502）。投げたら断る側に倒す。
   - (b) 済み。編集・写し・`update`（口数などの書き戻し）・`roleToJson` / `writeRole`・読み直しを経ても元の値が role.json に残り、断るまま。理由の文面に値は出ない。元の値は JSON・spread・snapshot に出ない。
10. **`chatBufferAbsent` の文面**: 直した。`venue not open; viewer comment cannot merge into transcript buffer (no fire).` とログのタブのラベル。期待値の変更 2 か所は §3。

## 7. 守りの決まりの確かめ方

- **鍵**
  - テストの鍵は全部 `loadToken` の差し替え（明らかな偽の文字列）。
  - `process.env` への代入は無い（差分を grep で確認）。
  - 鍵のファイル名の断りは鍵を読まない（`tokenFiles` が空・ログイン 0 をテストで固定）。
- **id**
  - テストの id は `guild-fake-g1` などの偽物。差分と新しいファイルに 15 桁以上の数字は無い（grep で確認）。
  - 画面の select の label は名前か決まった文面だけ（「fake」を含む label が無いことをテストで固定）。
  - snapshot と放送に準備の id・鍵が無いことをサーバのテストで固定。
- **ログ**
  - 新しいログは `catalog: key file name refused` の 1 行だけ（値なし）。
  - 見る窓の API はログを書かない。
- **実データ**
  - テストの設定・ロールは OS の一時フォルダだけ（終わったら消す）。
  - 実データの mtime は HEAD のコミットより前のまま（`cockpit-settings.local.json` 08:24・`memories/` `roles/` 10-31）。
- **画面**: ui は cockpit-server / mind を import しない（`view-logic/discord.mjs` は何も import しない）。soul-zone も pass。

## 8. 裁量（設計に無いことを決めた所）

1. **Discord の見る窓の置き場と API**: 準備（`GET /api/discord/prep`）の形を変えずに別の道 `/api/discord/vision-target` と別のキー `discordVisionTarget` にした。D のテストが `prep` の形（3 項目）を deepEqual で固定しているため。
2. **目を起こさない仕組み**: 体験の口の `eyesWanted()`（配信の口は持たない = 今まで通り起こす）。main の `onEyesStart: () => residentCapture.start()`（B のテストが固定）は変えていない。
3. **発火の見る窓**: `createVenueVisionTarget` が場の体験で選ぶ（Discord の場で選んでいなければ null = 画像なしの発火・配信の窓は撮らない）。
4. **見る窓の書き換え**: Discord の場の間は 409（準備と同じく場が閉じている間に選ぶ）。配信の見る窓は場の間も替えられるが、Discord では目の寿命を開くときに決めるので揃えた。
5. **画面の新しい値の受け取り**: snapshot の `discord`・`speakStartFixed` は `settingsFromSnapshot` に足さず、`venueExtrasFromSnapshot` に分けた（`settingsFromSnapshot` の deepEqual の期待値を変えないため）。
6. **ログのタブ（`transcript.mjs` の `speakerLabel`）**: you に名前を足さない（設計 §10「画面のログに名前を出さない」）。名前を出すのはメイン画面の会話の行だけ。
7. **名前が無い you の行**: 「参加者」（F の判定の入力のラベルと揃えた）。
8. **接続の状態の置き場**: 上の帯、状態のピルの横の小さなチップ。「切れた」は赤。
9. **Discord の場の下の帯**: 「話し始め speak-now（固定）」とし、「忙しい間のコメント」は出さない（コメントが無いため）。
10. **コメントの列**: Discord の場の間は出さず、会話を横いっぱいに（`.glance-main.solo`）。
11. **Connect の断り**: 409 `{ error, state }`。文面は「Discord の通話の間は YouTube のコメントにつながない（VC から抜けてから）」。開きかけ・閉じかけも断る（`discordVenueActive()` を使ったので）。配信の準備の Disconnect と欄は残した（閉じている間につないだ器官を切れるように）。
12. **入れない理由の出し方**: 理由はメイン画面の中央と Discord の準備のタブの下。どちらも `streamStartView` の `errorText` を共有し、体験に依らず「直近の始めるの失敗」を出す。
13. **形の合わない鍵のファイル名の元の値の持ち方**: 列挙されない symbol の項目にして、JSON・spread・snapshot に出ない形にした。値は JSON の写しを持つ。内側の置き場を落とした spread 済みのロールだけは E の形（`""`）に倒れる（断るまま）。
14. **一覧の読み込みの断り**: 状態コードは今の 502（読めないときと同じ）のまま。
15. **`chatBufferAbsent` の英語の文面**: `venue not open`（ログのタブのラベルも）。

## 9. 質問

1. **閉じている間につないだ YouTube の器官を持ったまま Discord の場を開いたとき**、コメントは今のコードでは Discord の場の正本に viewer の行として積まれる。
   - コメント反応の判定はしない（守りあり）。
   - 気になる所: 記憶（②）に「視聴者」の行が混ざりうる。閉じたあとも器官は残る（Discord の口には YouTube の片付けが無い）。
   - 計画は Connect を断るところまでなので、今回は手を入れていない。Discord の場を開くときに器官を畳むか、Discord の場ではコメントを積まない形にするか。推奨は人間ゲート 2 のあと。滅多に起きない手順（YouTube を先につないでから VC に入る）。
2. 配信の準備のタブの「マイク・文字起こし」の固めの案内は「配信の途中は…」のまま（Discord の場の間も同じ文面）。配信の準備のタブの文言なので、配信の文言を変えない方を取った。
3. §3 の下準備 2 か所（D・E のテストで Discord の見る窓を選んでおく）は、期待値ではなく下準備を足す形にした。期待値の `"eyes.start"` を消す形の方が好ましければ替える。

## 10. 人間ゲート 2 で見る所（偽物で確かめきれない所）

1. 本物の Bot で「読み込む」→ サーバー・チャンネルの名前が並ぶか。権限の無いチャンネル・ステージが出ないか。
2. 「Discord の VC に入る」→ 上の帯の「VC に入っている途中」→「VC に入っている」の移り変わりの速さ。
3. 接続を切ったとき（Wi-Fi を切るなど）に「VC から切れた」が出て、戻ると「VC に入っている」に戻るか。
4. 会話の行のあなたの名前が Discord の表示名で出るか（サーバーのニックネームの扱い）。
5. 見る窓を選んだとき・選ばないときの「画面を見る」発火（ココフォリアなど）。選ばなければ画像なしで返事するか。
6. 下の帯「speak-now（固定）」・ロールのタブの話し始めの固定の見え方。
7. 「VC から抜ける」2 回押し → 記録中 → 閉じる。そのあと「配信を始める」で、配信の画面（コメントの列・Connect・「配信者」・方式）が元に戻るか。
8. 狭い画面幅（1280 前後）で、メイン画面のボタン 3 つと上の帯のチップが崩れないか。
9. 形の合わない `discordBotKeyFile` を手で書いたとき、「読み込む」と「VC に入る」の両方で同じ断りの文面が出るか。ロールを画面で保存しても role.json の手書きの値が残っているか。
