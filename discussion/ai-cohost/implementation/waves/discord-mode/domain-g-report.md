# Domain G 完了報告 — 画面(Orch-Sylph 2026-11-01)

> 判定: **pass**(ループ 1 回・止めた指摘 0・Review-Sylph が合格)。ただし設計に書かれていない隙間 1 つ(先につないだ YouTube の器官、§10 の質問 1)を Undine に上げる。G の合格には影響しない、とレビューは見ている。
> 計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain G。
> 実装: Gnome(opus)→ [domain-g-gnome.md](domain-g-gnome.md)。レビュー: Review-Sylph(sonnet)→ [../../reviews/discord-mode/domain-g.md](../../reviews/discord-mode/domain-g.md)。
> コミットはしていない(ブランチ `ai-cohost/discord-mode`、HEAD `90314e7b`)。鍵(`.env*.local`)は誰も読んでいない。実データには触れていない(レビューが mtime で確認)。本物の Bot・LLM・外部 API は呼んでいない。依存・lockfile の変更なし。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2173 / 2173 pass**(2127 から +46)。Gnome とレビューの両方で実行 |
| 根で `pnpm run check:soul-zone` | pass(1610 files) |
| 固定テスト `stream-wording-pin` と fixture、`src/mind/`・`skills/`・`src/voice/` | 差分 0 |
| `package.json`・`pnpm-lock.yaml` | 差分 0 |

## 2. 変更ファイル(`apps/soul/agent/` 起点)

- 実装の変更: `src/cockpit/cockpit-server.mjs`、`src/discord/discord-experience.mjs`、`src/cockpit/cockpit-settings-store.mjs`、`src/roles/role-store.mjs`、`scripts/cockpit.mjs`、`src/cockpit/ui/`(app・conversation・bottom-bar・header・control-bar・settings-drawer・styles)、`src/cockpit/view-logic/`(glance-meters・glance-timeline・ghost)
- 実装の新規: `src/cockpit/view-logic/discord.mjs`
- テストの新規(46 件): `src/cockpit/cockpit-server-discord-g.test.mjs`(9)、`src/cockpit/cockpit-ui-discord-g.test.mjs`(13)、`src/cockpit/view-logic/glance-discord-g.test.mjs`(10)、`src/discord/discord-experience-discord-g.test.mjs`(4)、`src/roles/role-store-discord-g.test.mjs`(5)、`src/cockpit/cockpit-settings-store-discord-g.test.mjs`(1)、`scripts/cockpit-discord-g.test.mjs`(4)
- 既存テストの変更: §3 の 7 ファイル

## 3. 期待値を変えた既存テスト(レビューが `git diff` と過不足なく一致を確認)

| ファイル:行 | 変更 | 理由 |
|---|---|---|
| `scripts/cockpit-discord-d.test.mjs:139` | main の正規表現に `currentKeyFileRefused` の行 | E の追認 (1)(catalog も断る)。認めた変更 |
| `src/roles/role-store-discord-e.test.mjs:52,65,72-73` | 書き戻しの値 `""` → 元の値 | E の追認 (4)。認めた変更 |
| `src/cockpit/cockpit-ui.test.mjs:608-610,615,631,650,657,659-661` | タブ 5 → 6、`prepare` の次が `"discord"`、キーボード操作の並び | タブ 1 つの追加(設計 §9) |
| `src/cockpit/cockpit-server.test.mjs:1919` | `/ears not running/` → `/venue not open/` | `chatBufferAbsent` の文面(裁量 10) |
| `src/cockpit/view-logic/ghost.test.mjs:46` | ログのタブのラベル | 同上 |
| `src/cockpit/cockpit-server-discord-d.test.mjs:207-208`、`scripts/cockpit-discord-e.test.mjs:159-160` | 期待値ではなく下準備(Discord の見る窓を選んでおく 1 行)を追加 | 見る窓を選んでいなければ目を起こさなくなったため。開く順の期待値(`eyes.start` を含む)は不変。レビューは骨抜きでないと確認(選んでいない場で目を起こさないことは server-g のテストが別に固定) |

配信の期待値の変更は、上の `chatBufferAbsent` のラベル以外 0。

## 4. 画面の流れ(ユーザーが押す順)

1. メイン画面(場が閉じている): 「配信を始める」「Discord の VC に入る」「準備・設定」が並ぶ(Discord の入口が無いサーバでは今の 2 つ)。
2. 「準備・設定」→ タブ「Discord の準備」(配信の準備の右)。
3. 「読み込む」→ ロールの Bot がログインしてサーバーとボイスチャンネルを読み、ログアウト。select に名前が並ぶ(id は option の value だけ)。選ぶとその場で保存(`POST /api/discord/prep`)。鍵のファイル名の形が合わなければここで断りの文面(ログインしない)。
4. 「見る窓(目)」: 先頭が「使わない(目を起こさない)」。選ぶとその場で保存(`POST /api/discord/vision-target`)。
5. 「文字起こし」: 選ぶとその場で保存。
6. タブの下の「Discord の VC に入る」か、メイン画面の同じボタン → `POST /api/stream/start { experience: "discord" }`。
7. 入っている途中: メイン画面に「VC に入っています…」、上の帯に「VC に入っている途中」のチップ。
8. 入った: 上の帯に「VC に入っている」。会話は横いっぱい(コメントの列なし)。you の行は Discord の名前(取れなければ「参加者」)。下の帯は「話し始め speak-now(固定)」、「忙しい間のコメント」なし、歯車の左に「VC から抜ける」。準備・設定では Discord の準備が固まり、配信の準備の YouTube の Connect は出ない、ロールのタブの話し始めは speak-now 固定で押せず断りの文面が出る。
9. 切れた: チップが赤く「VC から切れた(つなぎ直しを待っている)」。場は閉じない。戻れば「VC に入っている」。
10. 「VC から抜ける」→「もう一度押すと VC から抜ける」(4 秒で戻る)→ もう一度押す →「VC から抜けています…」「記録中…」→ 最初の画面へ。
11. 入れないとき: 場は開かず、メイン画面の中央(と Discord の準備のタブの下)に `stream.error` の文面が赤く出る。

## 5. 配信の画面が変わっていないことの確かめ方

- レビューが HEAD の `view-logic` を `git archive` で展開し、今のコードと同じ入力で 1666 件を比較(`streamStartView`・`endStreamButtonView`・`isPreStream`・`statusPillView`・`driveSummaryView`・`conversationRowsView`・`commentRowsView`・`diagnosticGhostLabel`)。差は `chatBufferAbsent` のラベル 1 件だけ(裁量 10)。
- レビューが `ui/*.mjs` の差分を 1 行ずつ読み、配信のときに増えるのはメイン画面のボタン 1 つとタブ 1 つだけ、残りは Discord の場の条件の中にあることを確認。
- Gnome の新しいテストが配信の側を名指しで固定: 「配信者」のまま、方式が選べる・BottomBar「従来」、「忙しい間のコメント」が出る、「配信を終える」2 回押し、`POST /api/chat/connect` が配信の場と閉じている間は 200、始めるの body は今のまま、タブの先頭は配信の準備、配信の場の目は Discord の見る窓に関わらず起こす、snapshot の `visionTarget` は配信の見る窓のまま、配信の speak-now ではコメント反応を判定する。
- 既存の画面のテストは §3 以外の期待値を変えずに通る。

## 6. G への持ち越しの各項目の扱い(全部済み)

1. 体験は場を開くときに選ぶ: メイン画面の「Discord の VC に入る」。起動時は選ばない。ロール・運転・記憶・ログは共通。
2. タブ「配信の準備 / Discord の準備 / ロール / 運転 / 記憶 / ログ」。
3. Discord の場の目: キー `discordVisionTarget`、API `GET/POST /api/discord/vision-target`(`{ title }`、400/409/503)。体験の口の `eyesWanted()` が false なら目を起こさない。発火の見る窓は `createVenueVisionTarget` が選び、Discord の場で未選択なら null(画像なしの発火)。配信は不変。
4. 「VC から抜ける」(2 回押し)、途中の文言は「VC に入っています…」「VC から抜けています…」。
5. 接続の状態のチップ(入っている途中・入っている・切れた)、入れない理由は `stream.error`。Discord の場ではコメントの列・Connect・「忙しい間のコメント」を出さない。
6. you の行は `displayName`、無ければ「参加者」。配信は「配信者」。ログのタブの `speakerLabel` は変えていない(設計 §10)。
7. `speakStartFixed` で方式を選ばせない(断りの文面は F の `DISCORD_SPEAK_START_FIXED_MESSAGE` と一字同じことをテストで固定)。メーターは `speakStartFixed` を先に見て「speak-now(固定)」。
8. Connect: 画面に出さない。サーバは 409 `{ error: DISCORD_CHAT_CONNECT_REFUSED_MESSAGE, state }`。コメント反応を Discord の場で判定しない守りのテスト付き(守りを外すと落ちることを Gnome が確認)。
9. (a) catalog も合わない鍵のファイル名なら鍵を読まずログインせずに断る(502、`DISCORD_REASONS.keyFileName`)。(b) 編集・写し・update・`writeRole`・読み直しを経ても元の値が role.json に残り、断るまま。元の値は列挙されない symbol の項目に持ち、JSON・spread・snapshot・理由の文面に出ない。
10. `chatBufferAbsent` の文面を `venue not open` に直した。
- C の持ち越し(①と編集画面の 2 本の道)は追認どおりそのまま。Discord の場の間に編集画面に体験の教えが出る見え方は人間ゲート 2 で見る。

## 7. 守りの決まりの確かめ方

- Review-Sylph が差分から独立に: 追加行に `process.env` の代入・`.env*.local` を読む所が無い、15 桁以上の数字が無い、新しいログは値の無い `catalog: key file name refused` の 1 行だけ、鍵のファイル名の元の値が snapshot・JSON・spread・理由の文面に出ない(出るのは role.json への書き戻しだけ)、声をファイルに書く所が無い、テストは OS の一時フォルダだけ、実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)は HEAD のコミット以降に更新 0、`apps/soul/agent/tmp/` は元からの 2 つだけ、依存・lockfile の差分 0。
- Gnome のテスト: 鍵は `loadToken` の差し替え、断りでは `tokenFiles` が空・ログイン 0、select の label に偽の id が出ない、snapshot と放送に準備の id・鍵が無い。
- Gnome は偽の操縦席(一時フォルダ・偽の Discord・偽の耳)をブラウザで開いて目で確かめ、そのあとサーバを止めて一時フォルダを消した。レビューは実データの mtime で触れていないことを確認。
- Orch-Sylph は `git status` で、変更が `apps/soul/agent` の上記と discussion の 2 本(gnome 報告・レビュー)だけであることを確認。

## 8. 人間ゲート 2 で見る所(Gnome の 9 項目 + レビューの 3 項目)

1. 本物の Bot で「読み込む」→ サーバー・チャンネルの名前が並ぶか(権限の無いチャンネル・ステージが出ないか)。
2. 接続の状態の移り変わりと「切れた」の表示。
3. Discord の表示名の出方(取れない人は「参加者」)。
4. 見る窓の有無による発火の違い(見る窓なしで画像なしの返事が返るか)。
5. 話し始めの固定の表示(ロールのタブと下の帯)。
6. 抜けたあと配信の画面が元に戻るか。
7. 狭い画面幅での崩れ。
8. 合わない鍵のファイル名のときの断り(一覧の読み込み・VC に入る)。
9. role.json に手で書いた鍵のファイル名がロールの編集のあとも残ること。
10. YouTube を先に Connect してから VC に入ったとき、通話の記録に viewer の行が入るか(§10 の質問 1。直さなければ入る)。
11. Discord の場の間、会話指示の編集画面に体験の教えが出る見え方(C の持ち越し)。

## 9. 裁量(レビューは設計に反しないと評価。全 15 項目は gnome §8)

主なもの: 見る窓の API を準備の API と分けた(D のテストが準備の 3 項目の形を固定しているため)、目を起こさない仕組みを体験の口の `eyesWanted()` にした、Discord の場の間は見る窓の書き換えを 409、画面の新しい値は `venueExtrasFromSnapshot` に分けた(`settingsFromSnapshot` の deepEqual を変えないため)、ログのタブに名前を出さない、名前の無い you は「参加者」、接続の状態は上の帯のチップ、Connect の断りは 409 `{ error, state }`(配信の準備の Disconnect と欄は残す)、catalog の断りは 502、`chatBufferAbsent` は `venue not open`。

## 10. 質問(Undine へ)

1. **先につないだ YouTube の器官(設計に書かれていない隙間)**: 場が閉じている間に Connect した器官は場に持ち込まれる(配信の既存仕様)。`ingestChatMessage` / `commitComment` に Discord の場の判定が無いので、Discord の場でも viewer の行が正本に積まれて放送される。コメント反応の判定と発火の予定は止まっているが、通話の記憶(②)・④の最近の会話・speak-now の判定の入力にコメントが混ざりうる(計画 §5 の「同じ日の配信と通話の記録が混ざらないこと」に関わる)。レビューは設計 §4.3「開いたあと: なし」・F の追認 (2) は先につないだ器官の場合を書いていないので「設計とのずれ」ではなく隙間とし、止める指摘にしなかった。私も同じ見立てで、計画 §4 の「設計に書いていない判断の分岐は Undine に上げる」に従い G では直していない。選択肢:
   - (a) **推奨**(レビュー・私): Discord の場の間はコメントの入口(`ingestChatMessage`)で捨てる。5 行程度で「Discord の場にコメントは無い」(設計 §4.3)をそのまま実装するだけ。ユーザーの Connect は切らない。
   - (b) Discord の場を開く段で器官を畳む(ユーザーの Connect を黙って切るので製品判断が要る)。
   - (c) 人間ゲート 2 のあとに決める(Gnome の推奨。滅多に起きない手順のため)。
   (a) にするなら、G の追加の直し(Gnome に小さく頼む)か、全体の突き合わせの前に入れるかを決めてほしい。
2. 配信の準備のタブの「配信の途中はマイク・文字起こしを替えられない」案内は、Discord の場の間も同じ文面のまま(配信の文言を変えない方を取った)。レビューは可。このままでよいか。
3. D・E のテストに見る窓の下準備を足した形(期待値から `eyes.start` を外す形ではなく)。レビューは可。

## 11. 持ち越し(止めない指摘)

- §10 の質問 1。
- 準備・設定のモーダルはマウント時に読み取り API を 2 本呼ぶ。
- 入口の無い構成でも Discord の準備のタブが出る(タブの数を体験の有無で変えない形。メイン画面のボタンは入口があるときだけ)。
- `stream.error` を Discord の準備のタブの下にも共有して出している(体験に依らず直近の始めるの失敗)。
- E からの持ち越し(ENDED の見張りの限界・`startedDelayMs` の置き場)と D の質問 1(ElevenLabs の短い発話)は人間ゲート 2 のあとのまま。

## 12. 起動した子

| 役 | モデル | agentId | 状態 |
|---|---|---|---|
| Gnome(実装) | opus | `a2e6b69fc2d5ce509` | 完了(domain-g-gnome.md と hand-back を受け取った) |
| Review-Sylph(レビュー 1 回目) | sonnet | `a5fd8753fcbcfd5da` | 完了(reviews/discord-mode/domain-g.md と hand-back を受け取った) |

生き残りの子は無い(どちらも SubagentHandback で終了済み)。
