# Domain G レビュー — 画面(設計 §9)(Review-Sylph 2026-11-01)

> 対象: ブランチ `ai-cohost/discord-mode`、土台 HEAD `90314e7b`、コミットされていない作業ツリー(`git diff HEAD` と未追跡ファイル)。Gnome 報告 [../../waves/discord-mode/domain-g-gnome.md](../../waves/discord-mode/domain-g-gnome.md)。
> 読み取り専任。ソース・テストは直していない。コミットも、ブランチの切り替えもしていない。

## 判定: 合格(ループ 1・止めた指摘 0)

止めてよい 4 種(設計とのずれ / 配信が壊れる / 約束のテスト不足 / 守りの決まり違反)のどれにも、根拠を添えて言えるものは無かった。
ただし Gnome の質問 1(先につないだ YouTube の器官)は設計の隙間で、**Undine に上げる分岐**として残す(下の「質問 1 の評価」)。合格の条件ではない。全体の突き合わせの前に決めてほしい。

## 1. 止めた指摘

なし。

## 2. 約束 1〜10 の適合とテスト

| # | 約束 | 実装(確かめた所) | テスト |
|---|---|---|---|
| 1 | 体験は場を開くときに選ぶ | メイン画面 `ConversationPanel` に `join`(入口があるときだけ)。`joinDiscord` は `POST /api/stream/start { experience: "discord" }`。起動時は何も選ばない | `cockpit-ui-discord-g` 58・247。`glance-discord-g` 53 |
| 2 | タブ 6 つ・Discord の準備の中身 | `SETTINGS_CATEGORIES` 6 つ(配信の準備が先頭)。サーバー・ボイスチャンネル(catalog の一覧から)・見る窓・文字起こし・下に VC に入る | `cockpit-ui-discord-g` 179・186・217。`cockpit-ui.test` のタブ(認めた変更) |
| 3 | Discord の場の目の選択 | `discordVisionTarget`(別キー)、`GET/POST /api/discord/vision-target`、体験の口の `eyesWanted()`。`startVenueEyes` は false なら起こさない。発火の見る窓は `createVenueVisionTarget`(Discord の場だけ Discord の窓、null は画像なしの道。`fire-orchestrator.mjs:87` で確認)。配信の口は `eyesWanted` を持たず今まで通り起こす | server-g 277・307・321。`discord-experience-g` 52。`settings-store-g`。`scripts/cockpit-discord-g` 26・139 |
| 4 | VC から抜ける(2 回押し)・途中の文言 | `endStreamButtonView` が Discord の場で「VC から抜ける」(armed あり)。開きかけ・閉じかけは `discordJoinView` の語。配信の文言は不変 | `glance-discord-g` 53・65・92。`cockpit-ui-discord-g` 82・104 |
| 5 | 接続の状態・入れない理由・YouTube まわり | 上の帯のチップ(`venueConnectionView`)、`stream.error` を中央に。Discord の場はコメントの列(`glance-main.solo`)・Connect・「忙しい間のコメント」を出さない | `glance-discord-g` 110・155。`cockpit-ui-discord-g` 82・142・231・247 |
| 6 | you の行を Discord の名前で | `youLabelFor`(Discord は `displayName`、無ければ「参加者」。配信・体験不明は「配信者」) | `glance-discord-g` 132 |
| 7 | `speakStartFixed` で方式を選ばせない・メーター | `SpeakStartSelect fixed`(speak-now 固定・押せない・断りの文面)。`driveSummaryView` は `speakStartFixed` を `role.speakStartMode` より先に見る。`SpeakStartSelect` の使い場所はロールのタブだけ(grep) | `cockpit-ui-discord-g` 104・159・170。`glance-discord-g` 155・220 |
| 8 | Connect を出さない・API も断る・コメント反応を判定しない | 画面は Discord の場で Connect を出さない。`POST /api/chat/connect` は `discordVenueActive()` で 409(開きかけ・閉じかけも)。コメント反応のガードは F の `!venueFixesSpeakNow()` を G のテストで固定 | server-g 375・401。`cockpit-ui-discord-g` 231 |
| 9a | catalog も形の合わない鍵のファイル名なら断る | `catalog()` が `currentKeyFileRefused`(読めなければ断る側)で、鍵を読まずログインせずに `keyFileName` の理由。main に結線(`roleDiscordBotKeyFileRefused` は import 済み、`node --check` ok) | `discord-experience-g` 76・108。server-g 340・360。`scripts/cockpit-discord-g` 63・139 |
| 9b | 形の合わない値を `""` にせず元の値を残す | 列挙されない symbol の内側の置き場。`roleToJson` / `writeRole` / 編集 / 写し / 読み直しを経ても残り、断るまま | `role-store-discord-g` 31・46・56・87・97。`scripts/cockpit-discord-g` 104 |
| 10 | `chatBufferAbsent` の文面 | `venue not open; …`(サーバ)・ログのタブのラベル | server-g 427 |

守りのテスト(コメント反応)は、Gnome の報告どおり守りの 1 行を外すと落ちる作りに読める。

## 3. テスト結果

- `apps/soul/agent` で `node --test`: **tests 2173 / pass 2173 / fail 0 / skipped 0**(約 92 秒)。自分で走らせた。
- 根で `pnpm run check:soul-zone`: pass(1610 files)。
- `node --check scripts/cockpit.mjs`: ok。
- `git diff HEAD --stat` で `src/mind/`(`stream-wording-pin.test.mjs` と fixture を含む)・`skills/`・`src/voice/`・`package.json`・`pnpm-lock.yaml` の差分は 0。

## 4. 配信の画面が変わっていないことの確かめ方と結果

1. **HEAD と今の純関数を並べて比べた**(HEAD の `src/cockpit/view-logic` を `git archive` でスクラッチパッドに展開し、同じ入力で両方を実行。リポジトリには書いていない)。
   - 対象: `streamStartView`・`endStreamButtonView`・`isPreStream`・`statusPillView`・`driveSummaryView`(第 2 引数なし / `{speakStartFixed: null}` / `{speakStartFixed: false}`)・`conversationRowsView`(`experience` なし / `null` / `"stream"`、名前付き you を含む)・`commentRowsView`・`diagnosticGhostLabel`。
   - 入力は stream の phase(closed / opening / open / closing / 不明)× experience(undefined / null / "stream")× connection × error に加え、null / undefined / `{}`。1666 件比較。
   - 差は **1 件だけ**: `chatBufferAbsent` のラベル(`ears not running` → `venue not open`)。約束 10 で認められた変更。あとは完全一致(you の行は配信で名前が載っていても「配信者」)。
2. **ui/*.mjs の差分を 1 行ずつ読んだ**。配信のとき増えるのは次の 2 つだけ。
   - `join.show` が真のときのボタン 1 つ(入口が無ければ何も足さない)。
   - タブ 1 つ。
   - それ以外はすべて `isDiscordVenue` / `speakStartFixed === true` / `fixed` の条件の中。配信のときは null / 既定値。
   - 配信の準備の Connect は Discord の場の間だけ隠す。配信の準備の「配信中」の文言は同じ文字。`startStream` の body は変えていない。
3. 既存の画面のテストは、§5 の表のもの以外を変えずに通る。配信側を名指しで確かめる新しいテストも付いている(`cockpit-ui-discord-g` 127・159・231・247、`glance-discord-g` 92・132・155)。
4. ブラウザ起動はしていない。Gnome の目視(偽の操縦席・一時フォルダ)は報告を信じ、私は実データに触れないことを優先した。

## 5. 期待値を変えた既存テストの突き合わせ

`git diff HEAD` の既存テストファイルの変更は 7 ファイルで、Gnome の報告 §3 の一覧と**過不足なく一致**した。

| ファイル | 変更 | 評価 |
|---|---|---|
| `scripts/cockpit-discord-d.test.mjs` | main の結線の正規表現に `currentKeyFileRefused` の行を足した(1 か所) | 認めた変更(E の追認 (1)・9a) |
| `src/roles/role-store-discord-e.test.mjs` | `""` の期待値 → 元の値のまま(題名・コメント含む) | 認めた変更(E の追認 (4)・9b) |
| `src/cockpit/cockpit-ui.test.mjs` | タブ 5 → 6、`tabpanel` 5 → 6、`settingsModalNextCategory`・キーボードの偽のタブの位置を 1 つずらした | タブを 1 つ足した結果で、設計 §9 どおり。ほかの配信の期待値は変えていない |
| `src/cockpit/cockpit-server.test.mjs` | `/ears not running/` → `/venue not open/` | 約束 10(裁量) |
| `src/cockpit/view-logic/ghost.test.mjs` | ログのタブのラベル 1 行 | 約束 10 の続き |
| `cockpit-server-discord-d.test.mjs`・`scripts/cockpit-discord-e.test.mjs` | `setDiscordVisionTarget("偽のゲームの窓")` を 1 行足しただけ(期待値は不変) | **骨抜きではない**。両テストの趣旨は開く順(… → 再生器 → 目 → 頭)の固定で、「窓を選んだ場」を作ったので `eyes.start` を含む順がそのまま検査される。選んでいない場で目を起こさないことは server-g 307 が別に固定。`"eyes.start"` を消す形に替える必要は無い |

これ以外に配信の期待値を変えた既存テストは無い。

## 6. 守りの決まりの確かめ方と結果

差分から独立に確かめた。**違反なし**。

- **鍵**: 追加行に `process.env` の代入・`.env*.local` を読む所は無い(grep)。テストの `.env.discord*.local` はファイル名の文字列と差し替えた `loadToken` だけ。catalog の断りは鍵を読まない(`tokenFiles` 空・ログイン 0 をテストが固定)。
- **id**: 追加行(差分と未追跡ファイル)に 15 桁以上の数字は無い。画面の選択肢は label が名前か決まった文面、id は `value` のみ。snapshot は `discord: { available: true }` だけで準備の id・見る窓の名前を載せない(server-g 446)。
- **ログ・SSE・画面**: 追加の出力は `catalog: key file name refused` の 1 行(値なし)だけ。見る窓の API はログを書かない。ログのタブの `speakerLabel` は変えていない(you に名前を足さない)。メイン画面の会話の行の Discord の名前は設計 §9 どおり。
- **手書きの鍵のファイル名の元の値**: `Object.defineProperty` で `enumerable: false` の symbol の項目。JSON・spread・snapshot・`DISCORD_REASONS.keyFileName` の理由に出ない。出るのは `roleToJson` / `writeRole` が role.json に書き戻すときだけ(もともとユーザーがそこに書いた値)。テストで検証済み。
- **声**: 追加行に書き込みは無い。
- **テストの置き場**: 新規・変更テストの `mkdtemp` は `os.tmpdir()` だけ。`readFileSync` はソース照合か一時フォルダ。
- **実データ**: `cockpit-settings.local.json` は 2026-11-01 08:24、`memories/chappy/.git` の最終更新は 08:33(人間ゲート 1 の配信)。`roles/`・`memories/` 直下は 10-31。HEAD のコミット(10:32)以降に更新されたものは 0(`find -newermt`)。鍵のファイルの mtime は 10-30 以前。
- **残骸**: `apps/soul/agent/tmp/` は元からの 2 つ(`discord-receive`・`restructure-backups`)だけ。OS の一時フォルダに G の残骸なし。未追跡ファイルは報告の一覧どおりの 9 つだけ。
- **依存・lockfile**: 差分 0。

## 7. Gnome の質問 1〜3 の評価

### 質問 1: 先につないだ YouTube の器官を持ったまま Discord の場を開く

**事実の確認**(コードで確かめた)。
- 「場を開く前に Connect してあれば、その器官をそのまま場に持ち込む」のは配信の既存仕様(`startChatForStream` の注記)。
- `ingestChatMessage` → `commitComment` は `venueTranscript` があれば `viewer` 行を積んで放送し、Discord の場でもそのまま通る。`discordVenueActive()` の判定は無い。
- 積まれたあとは次の 3 つが起きる。
  - 発火の予定は `parkFireScheduler` が畳んでいるので無視する。
  - コメント反応は守りで判定しない。
  - 正本には viewer 行が残る。そのため speak-now の判定入力・④の最近の会話・②の記憶(通話の記録)に YouTube のコメントが混ざりうる。
- 器官は場を閉じても残る(Discord の口に片付けが無い。配信の `foldStream` は配信の場の閉じるだけ)。
- 新しい `say` の出力は無く、守りの決まり(ログ・id)の問題にはならない。

**止めてよい指摘に当たるか: 当たらないと判断した(止めない)。** 理由は次のとおり。
- 設計 §4.3 の表の「開いたあと: なし」は Discord の口が YouTube を新しくつながないことを言っている。計画 F の追認 (2)「Discord の場にはコメントが無い」は、Connect を断る根拠として書かれた。
- どちらも「閉じている間につないだ器官が先にある場合」を規定していない。つまり設計に反するというより、**設計に書かれていない隙間**。計画 §4 のとおり、設計に無い分岐は Gnome の裁量でもなく、Undine に上げる側。
- 計画 §5 の「同じ日の配信と通話の記録が混ざらない」は日付ごとの記録の話で、この件は「通話の記録の中身に viewer の行が入る」話。つなぎ目として全体の突き合わせで見る価値はあるが、G の合格条件にする根拠までは言えない。
- 手順が稀(YouTube を先に Connect して、配信を始めずに VC に入る)で、害は記憶・判定文脈への混入に限られる。

**直し方の選択肢(新しい製品判断を要する分岐。Undine へ)**
- (a) Discord の場(`discordVenueActive()`)の間は `ingestChatMessage` の入口でコメントを捨てる(積まない・放送しない・判定しない)。器官は残る。5 行程度で、既存の「コメントは Discord の場に無い」の素直な実装。診断の文面(捨てたことを ghost に出すか、静かに捨てるか)が小さな裁量。**推奨**。
- (b) Discord の場を開く段で器官を畳む。確実だが、ユーザーの Connect を黙って切ることになる(配信に戻ったとき再接続が要る)。製品判断。
- (c) このままにして人間ゲート 2 のあとに決める(Gnome の提案)。
- 私は (a) を、全体の突き合わせの前か中で入れることを推奨する。(a) は「Discord の場にコメントは無い」の決定をそのまま実装するだけで、(b) のような新しいふるまいを足さない。

### 質問 2: 配信の準備のタブの固めの案内が「配信の途中は…」のまま

可。配信の準備のタブの文言なので、配信の文言を変えない側を取ったのは正しい。

### 質問 3: 下準備の形(窓を選んでおく)

可。§5 のとおり骨抜きではない。

## 8. Gnome の裁量(報告 §8)の評価

1〜15 は設計に反しない。

- 1〜4(別の道と別のキー・`eyesWanted`・`createVenueVisionTarget`・Discord の場の間は見る窓の書き換えを 409): 設計 §4.3 の 7(選んでいなければ起こさない)・§9 と整合。D のテストが `prep` の 3 項目を deepEqual で固定している事情も妥当。`server?.venueContext()` はクロージャ内で呼ばれるので TDZ にならない(`let server` は発火時点で初期化済み)。
- 5・13・14(`venueExtrasFromSnapshot` の分離・symbol の置き場・catalog の断りは 502 のまま): 可。13 の「内側の置き場を落とした spread 済みのロールだけ E の形(`""`)」は、断るまま・値を出さない側に倒れていて安全。
- 6(ログのタブの `speakerLabel` に名前を足さない): 設計 §10「画面のログに名前を出さない」と整合。
- 7(名前の無い you は「参加者」): F の判定ラベルと揃っている。可。
- 8〜12(チップの置き場・下の帯・コメントの列を隠す・Connect の断りの 409 の形・理由の出し方): 設計 §9 の範囲。開きかけ・閉じかけも断るのは `discordVenueActive()` を使った素直な結果。
- 15(`venue not open` の文面): 約束 10 の範囲。

## 9. 持ち越し(止めない指摘)

1. **質問 1**(上記)。Undine へ。(a) を推奨。全体の突き合わせの「配信と Discord の場の切り替え」に載せる。
2. Discord の場の間も配信の準備のタブの「忙しい間のコメント」の欄(`CommentBusySelect`)は出ているか未確認(下の帯は出さない)。Discord の場にコメントが無いので、出ていれば畳む方が素直。見た目の話なので止めない。
3. 準備・設定のモーダルは `discordAvailable` のときマウント時に `GET /api/discord/prep` と `GET /api/discord/vision-target` を呼ぶ(読み取りのみ・副作用なし)。モーダルを開いたときまで遅らせる案もあるが、好みの範囲。
4. Discord の準備のタブが入口の無い構成でも出る(案内だけ)。設計 §9 の「タブ 1 つ」と整合。入口が無いときに隠すかは好み。
5. `stream.error` の出し分け(中央と Discord の準備のタブの下に同じ値)は、配信の場の失敗理由も Discord の準備のタブに出うる。体験に依らず「直近の始めるの失敗」を共有する作り(Gnome の裁量 12)。人間ゲート 2 で見て気になれば直す。

## 10. 人間ゲート 2 で見る所

Gnome の §10 の 9 項目(本物の Bot での「読み込む」・入る / 切れる / 戻るの見え方・Discord の名前・見る窓の有無での発火・固定の見え方・抜けてから配信に戻る・1280 前後の幅・手書きの鍵のファイル名の断りと書き戻し)に加え、次を足す。

1. 「VC から抜ける」のあと「配信を始める」で、配信の画面(コメントの列・Connect・「配信者」・方式の選択・「忙しい間のコメント」)が元に戻るか。
2. YouTube を Connect してから VC に入る手順を踏んだとき、画面に何も出なくても通話の記録に viewer 行が入らないか(質問 1 を直すなら、直した版で)。
3. 見る窓を選ばずに VC に入り、「画面を見て」系の発火をしたときに、画像なしで返事が返るか。

## 11. 質問(Orch-Sylph / Undine へ)

1. 質問 1 の扱い(上記 (a) / (b) / (c))。(a) を G に含めて直すのか、全体の突き合わせで拾うのかを決めてほしい。私の判定は、どちらでも G は合格。
2. 持ち越し 2(Discord の場の間の「忙しい間のコメント」の欄)を直すかどうか。
