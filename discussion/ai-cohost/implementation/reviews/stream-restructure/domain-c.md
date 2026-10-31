# 配信の組み直し Domain C — 体なしの声 レビュー

Review-Sylph → Orch-Sylph(2026-10-31)。対象: `git diff 15bf9570` の作業ツリー(未コミット・`apps/soul/agent/` の 15 ファイル + Gnome 報告)。読み取り専任で、ソース・テストは直していない。

## 1. 判定

**pass**(止めた指摘 0 件)。Undine に上げる分岐も無い。

## 2. テスト

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | 自分で実行。**1782 pass / 0 fail / 0 cancelled / 0 skipped**(基準 1758 + 24。Gnome 報告と一致) |
| 根で `pnpm run check:soul-zone` | pass(1560 source files scanned) |
| 依存・lockfile | `git diff 15bf9570 --stat` に `package.json`・`pnpm-lock.yaml` なし。変更なし |
| 既存テストの書き換え | なし。`--numstat` でテストファイルの削除行は 0(追加のみ) |
| 守りの文面 | 判定の文面・②④の指示・`conventions-seed.md`・`skills/expression.md` は差分に出ない(`git status` は 15 ファイルの M と Gnome 報告のみ) |
| 実データ・鍵 | 開いていない。存在と更新日時だけ確認: `cockpit-settings.local.json`(10/29)・`.bak-20261027`・`memories/` は作業前のまま。`apps/soul/agent/roles/` は存在しない(作られていない)。`tmp/` は `discord-receive` だけ(`restructure-backups` なし)。追加テストに実データのパス・`process.env`・`.env` の参照なし(読むのは `cockpit.mjs` のソース文字列だけ)。偽の engine・player・器と、URL を持たない `createLazyChannel` だけを使う |

## 3. 止めた指摘

0 件。

## 4. 設計適合・テスト適合の確認

| 作るもの | 実装の場所 | テスト |
|---|---|---|
| 運び手の約束を「器は任意」に(器が無ければ送信を飛ばし、手元の再生器だけで鳴らす)。設計 §4 / 候補 2 | `speech-streamer.mjs`: `hasChannel`(入口の検査は「渡すなら 3 つの口」を維持)、`activate` が器なしなら `openPlayer(job, null)` へ直行、`flush` の時間割送信・`endSpeech`・`releaseMouth` を器なしでは飛ばす。時間割は `job.timeline` に貯めたまま。`speakOnce` は素通し | `speech-streamer.test.mjs`「器なし(体なし): openSpeech を待たずに player.open…」「…channel 未指定でも同じ」「…割り込み・キルは player.stop…cancelled(play-failed ではない)」。`fire-orchestrator.test.mjs`「体なし(一括の読み上げ・本物の speakOnce)…」。同期で `openPlayer` へ入るが、`advance` 側で `active`/`closed` を確認済みなので前提は崩れていない |
| 候補 1(何でも受け取る器の代わり)を使わない | `resources.channel` を `null` に固定。偽の器は作っていない。器を渡されても体なしなら使わない(`acquireResources` の `body ? … : null`) | 同上 + `speakOnce` の `deps.channel === null` を確認するテスト |
| 器の URL の確かめは体があるときだけ | `cockpit.mjs`: `resolveFireChannel`(体なしは `getUrl` を呼ばない)、`createSessionProxy` の `hasBody`(既定=いつも確かめる)、`applyDesiredFireSettings` の URL 差し替えも体ありのみ。断りの文面は `CHANNEL_URL_NOT_SET_MESSAGE` として元の一字一句と同じ | `cockpit.test.mjs`「createSessionProxy(体なし)…」「resolveFireChannel…」「体なしの受理(本番の器の取り方 + 本物の orchestrator)…体ありは今どおり受理しない」(`/Channel URL is not set/`、fires 0) |
| 表情タグは剥がして捨てる(診断を出さない) | `fire-orchestrator.mjs`: `bodyless` なら `events=[]`(`applyExpressions` を呼ばない・envelope なし・`onExpression` なし・`expressions: []`)。`speechText` は元から剥がし済み | 「体なし: 表情タグは剥がして捨てる…」「体なし(文ごとの読み上げ)…」(envelope 0・診断は `bargeIn` だけ) |
| 口閉じの診断を出さない | `releaseMouth`/`streamReleaseMouth` が `isBodyless` で黙る | 「体なし: 器を持たない speak の返り(stop なし)でも…MouthCloseError を出さない(体ありは今どおり出す)」(interrupt と kill の両方) |
| 頭へ表情の教えを渡さない | `soul-skills.mjs` `soulSkillNamesForBody`、`cockpit.mjs` のセッション作成と会話指示の編集画面の教えに適用。本文は不変 | `soul-skills.test.mjs`、`cockpit.test.mjs`「buildRoleSessionSystemPrompt(体なし)…体ありは今と同じ①」「createConversationInstructionHooks(体なし)…」 |
| 遅延の記録に「体なし」の印 | `fire-orchestrator.mjs` `onLatency`、`cockpit-server.mjs`(SSE と `onReplyLatency`)、`session-usage-log.mjs`、`formatReplyLatencyLine`(` body=none`)。体ありはキーを足さない | 「体なし: 遅延の通知に bodyless: true の印が付く(体ありは付かない)」「cockpit 体なし: 遅延のレコード…」「遅延の 1 行(体なし)…」「formatReplyLatencyLine(体なし)…」 |
| 器の状態の表示は「体なし」 | `view-logic/status.mjs` `channelStatusView`、`cockpit.mjs` `channelStatus()` に `body` を載せる(cockpit-server は素通しで snapshot に載せる) | `status.test.mjs`「channelStatusView(体なし)…」。`main()` の結線は文字列照合 |
| 割り込みの「どこまで声に出たか」が体なしでも同じ | 切断点の計算(`computeSpokenPrefix`)は無変更。入力は時間割と STARTED の時刻 | 下記 |
| 体ありの挙動は今と同じ | 体あり経路のコードは新しい分岐を通らないか、同じ値を返す(`channel`・`releaseMouth`・trace の形・`onLatency` のキー) | 既存 1758 件がそのまま通る。体なしの比較テストの多くは同じ条件で体ありを並走させている |

**割り込みの一致テストの条件(自分で確かめた点)**:
- 一括: `fire-orchestrator.test.mjs:4175`。体あり・体なしで同じ `makeOneShotRig()`(同じ engine=同じ時間割)・同じ返事・STARTED `atMs: 1000`・`interrupt(1350)`。差は `acquireFireResources`(`body:false`)だけ。`prefix/charsSpoken/elapsedMs`、結果、soul の行が一致し、「こんに」と 3 文字で固定。体なしは器へ何も送らず(`sent` が空)、診断は `bargeIn` だけ、体ありは `sendSet` が 1 回。本物の `speakOnce` を使う。
- 文ごと: `:4304`。同じ progressive の engine・player・session で `body` だけ替え、`{ interrupted:true, charsSpoken:3, prefix:"先行。" }` が体ありと一致。
- 運び手単体: `speech-streamer.test.mjs`「speakOnce 器なし(体なし)…切断点の材料(時間割と STARTED の時刻)は器ありと同じ」。
- 条件を片側だけ有利にしている所は見つからなかった。

**ロールを替えたあとに古い体が残らないか**: `currentBody()` は `roleHooks.current().body` を毎回読む(持ち回りなし)。受理・頭に聞くとき・URL 差し替え・セッション作成・器の状態・起動案内のすべてがそれを呼ぶ。セッションは `sessionBody !== currentBody()` で次の Fire の境目に作り直す(`applyDesiredFireSettings`、`acquireAcceptedFireResources` と `sessionProxy.ask` のどちらからも先に呼ばれる)。orchestrator は受理時点の資源の `body` を 1 発の間使う(進行中の発話は受理時の形を最後まで使う、という既存の snapshot の流儀)。テスト「体の有無は受理のたびに読む…」で同じ orchestrator の体あり→体なし→体ありを確認済み。`main()` 側は文字列照合のテスト(下の持ち越し 1)。

## 5. 裁量

筋が通ると認め、記録で足りる(Undine の追認は必須でない):
1. **体なしでタグだけの返事を `{ fired:false, reason:"expression-only", expressed:false, expressions:[] }` で畳む**(Gnome 裁量 4)。設計 §4 は「タグは剥がして捨てる(診断は出さない)」までで、タグだけの返事は規定外。ただし「判断の分岐」には当たらない。理由: (a) 設計の文言と矛盾せず、空の返事の診断 `fireEmptyReply` を出すより「診断は出さない」に沿う。(b) `reason` を読む消費側は `fire.completed` の記録(`fireDiagnostics.finish`)だけで、`expression-only` は元から存在する値、`expressed:false` を足しただけ。(c) 起きにくい(体なしは表情の教えを渡さない)。別の扱い(`empty-reply`)にしても外から見える違いは診断 1 件だけなので、後から差し替えやすい。
2. **印は体なしのときだけ `bodyless: true` を足し、体ありはキーを足さない**(裁量 6)。設計 §4「記録に『体なし』と分かる印」と、体ありの記録の形を変えない約束の両方に合う。既存の `deepEqual` も不変。
3. **未知タグ・壊れタグの診断は体なしでも今どおり出す**(裁量 5)。設計の「診断は出さない」を「表情を適用できなかった」系の診断と読むなら筋が通る(未知・壊れは返事の形の知らせ)。ただし文言上は「タグ由来の診断を全部出さない」とも読めるので、Undine が「未知タグも黙る」と決めるなら `bodyless` で診断を抑える 1 行の変更で済む。今は止めない。
4. **体の値を持ち回らず使う時点で読む / `sessionBody` で作り直す / 体なしの発火の `channelUrl`・`channelConnectionGeneration` を null にする / 体なしの間は `lazyChannel.setUrl` をしない / `options.body` の既定 true**(裁量 1・2・8・9・12)。いずれも設計 §4 と Domain A 申し送り 9 の趣旨(古い体の値を残さない)に沿い、設計の分岐ではない。
5. **口の release を体なしでは呼ばない**(`speech.mouth.released` も出さない)・**`channelStatusView` は URL があっても体なしなら「体なし」**・**起動案内の 1 行**(裁量 3・7・11)。筋が通る。

Undine の追認がほしい項目: 3 の「未知タグ診断を残す」だけ(任意)。

## 6. 持ち越し(止めない指摘)

1. **`main()` の結線テストは `cockpit.mjs` のソース文字列の照合**(`cockpit.test.mjs` の「体なしの結線(main)」)。`main()` を走らせられない制約と、Domain B の「記憶をロールごとにの結線」と同じ流儀なので止めない。リファクタ時に壊れやすい(書き方の好み・作り直しの案)。部品(`resolveFireChannel`・`createSessionProxy`・`soulSkillNamesForBody`・orchestrator)は個別に挙動のテストがある。人間ゲートで実機の確認が要る。
2. **Domain D**: 「配信を始める」で体があれば器につなぐ(つながらなければ場を開かない)は `resolveFireChannel` と同じく `roleHooks.current().body` を見ること。体なしは接続しない。場を終えるときの `lazyChannel.close()` は、体なしに替える前に張った接続が残りうる(体ありの Fire のあとロールを体なしへ替えた場合に器の接続は開いたまま)ので、終わりの畳みで体の有無に関わらず `close` してよい。`--channel` 起動の先充填(`cockpit.mjs:2460`)と起動案内の文面は、場の始まりへ寄せるときに見直す。体なし + `--channel` の起動案内は「初回 Fire 時に生成」と出るが先充填は体に関わらず走る(文面の小さなずれ)。
3. **Domain E**: 器の URL 欄の出し分けは `state.channel.body` が使える。`.channel-status.bodyless` の色の CSS は未追加(既定の muted)。ロール編集で体だけを変えたとき、`roleHooks.current()` が最新の `role.json` を返すかは E で確かめる(今は `onSetRole` の更新に頼る)。体の変更が `sessionBody` の比較で次の Fire の境目に効くのは確認済み。
4. **仕上げ**: `--channel` の HELP と README の Channel の記述は体ありの話のまま(Gnome も記載)。
5. **人間ゲート**: Gnome 報告 §7 の 5 項目(runtime-player 無しで声が出る・割り込みの soul の行・表情タグが声や診断のゴースト行に出ない・設定の器の状態が「体なし」・遅延行に `body=none` と声の区間の短さ)に加え、体ありのロールに戻した最初の Fire でセッションが作り直され、表情の教えが戻ること。

## 7. 質問

なし。
