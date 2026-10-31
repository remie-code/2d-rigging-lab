# 配信の組み直し Domain D — 場（配信を始める / 終える） 完了報告

Gnome → Orch-Sylph（2026-10-31）。計画 [stream-restructure-wave-plan.md](../../orchestration/stream-restructure-wave-plan.md) §1 Domain D、設計 [stream-restructure.md](../../../architecture/stream-restructure.md) §3・§6・§9、決めごと [scope.md](../../../discord-vc/scope.md) §18〜§20。ブランチ `ai-cohost/stream-restructure`（7e9a04b0 の上）。**コミットはしていない（stage もしていない）。**
実データには触れていない: `apps/soul/agent/cockpit-settings.local.json`（と `.bak*`）・`apps/soul/agent/memories/`・`apps/soul/agent/roles/`・`.env*.local` は読んでいない・書いていない。操縦席は起動していない（`scripts/cockpit.mjs` は `node --check` とテストからの import・文字列の読み取りだけ。`main()` は走らない）。テストは偽物（偽の耳・orchestrator・判定・チャット器官・器の接続の口・頭のセッション・②）と本物の cockpit-server（loopback の HTTP）だけ。ファイルを書くテストは OS の一時フォルダだけ（`mkdtempSync(tmpdir())`）。本物の LLM・外部 API・マイク・runtime-player は呼んでいない。依存・lockfile は変えていない。作業後に `apps/soul/agent/roles/` が無いことを確かめた（`apps/soul/agent/tmp/discord-receive/` は作業前からあるもの・触っていない）。

## 1. 判定

**done**（止めた分岐なし。§9 に確かめてほしい読みを 2 つ）

## 2. 何を作ったか

### 2.1 場の関数と状態（`src/cockpit/cockpit-server.mjs`）

- 場の状態 `streamPhase`: `closed → opening → open → closing → closed`。snapshot に `stream: { phase, error, openedAtMs }`（`error` = 直近の「配信を始める」が始められなかった理由・次の始めるで消す）。
- **配信を始める `openStream(request)`**（場が閉じているときだけ。途中で失敗したら起こしたものを畳んで閉じた状態に戻し、理由を返す + `stream.error` に残す）。実際の順:
  1. `streamPhase = "opening"`（ここから閉じるまで `POST /api/role` は 409 = ロールを固める）
  2. `streamHooks.renewRecords`（cockpit.mjs: 場の番号を進める・記憶の本体のファイル名を作り直す・頭の文脈の記録のファイルを作り直す・保存の数え `lastRecordedSeq` / `lastRecordAtMs` を 0 / null・**そのロールの置き場の準備（git init・種）をここで待つ**）
  3. `killed = false` + `orchestrator.revive()`。判定部品（speak-now・コメント反応）を作り直す（`reset` + 古い部品の `dispose`）、弾く判定の待ち行列を捨てる、発火の予定を作り直す、思い出しの係を作り直す
  4. `startEars`（耳と会話の正本 → `onEarsStarted` で目と声の出口）
  5. `streamHooks.openSession`（頭のセッションを今のロールのモデルと指示で作る）
  6. `streamHooks.connectBody`（ロールに体があれば器につなぐ。URL が無い・つながらなければ場を開かない）
  7. 保存してある YouTube の URL があり、まだつないでいなければつなぐ（つながらなくても開く）
  8. `streamPhase = "open"`
- **配信を終える `closeStream()`**（場が開いているときだけ。閉じていれば何もしない）:
  1. 写し（`pipeline.transcriptBuffer.all()`）
  2. 畳む `foldStream`: YouTube → 判定部品（積み残しを捨てて dispose）→ 発火の予定（dispose・タイマ解除）→ 思い出しの係（dispose）→ 鳴っている / 考えている返事を止める（orchestrator が idle でなければ `kill()`）→ 目・耳（`stopEars`）→ `streamHooks.closeSession` → `streamHooks.closeBody`（**体の有無に関わらず**）
  3. `streamHooks.saveFinal(写し)`（この間 `stream.phase` は `"closing"` = 画面の「記録中…」）
  4. `streamPhase = "closed"`
- **API**: `POST /api/stream/start`（body は今までの Start と同じ `{ device?, sttEngine?, ttsEngine? }`・省略は前回の選択）・`POST /api/stream/stop`。`/api/ears/start`・`/api/ears/stop` は後方互換の別名で同じ関数を通す（耳だけを起こす道は残さない）。開きかけ・閉じかけ・開いている間の始めるは 409、開きかけ・閉じかけの間の終えるは 409（旧 `transitioning` の型）。始めるの失敗は 500 `{ error, state }`（今の Start と同じ形）。終えるの応答は記憶の最後の保存が終わってから返る（その間 SSE の state が closing を流す）。
- 内部 JS API: `streamStatus()`・`startStream(request)`・`endStream()`（Ctrl+C 用。開きかけ・閉じかけなら終わるのを待ち、開いていれば終える）。
- 場が開いている間 / 閉じている間: `POST /api/role` は場が閉じていないと 409（旧 `earsState` の判定を差し替え）。マイク・文字起こしを替える口は始めるだけなので、開いている間の始めるを 409 にしてサーバの側で守る。`POST /api/memory-record` は場が開いていないと 409。YouTube の URL と Connect・ゲームの窓・器の URL・声の出力先は触れる（変更なし）。
- 起動時: 場は閉じた状態で生まれる。発火の予定は作ったあとすぐ dispose して値の置き場として残す（閉じている間は沈黙の予定のタイマを張らない）。
- 耳の Stop の記録の口（旧 `onEarsStopping`）は無くした（記憶の最後の保存は「配信を終える」の 1 本）。

### 2.2 場の口と場ごとの記録（`scripts/cockpit.mjs`）

- `createStreamVenueHooks(deps)`（新規 export）: server の `streamHooks`（`renewRecords` / `openSession` / `connectBody` / `closeSession` / `closeBody` / `saveFinal`）と、場ごとの保存の数え（`noteSaved` / `lastRecordAtMs()` / `lastRecordedSeq()`）、20 分ごとの保存の 1 回分（`checkpoint()`・場が開いている間だけ）、Ctrl+C の待ち（`waitForRunningSaves()` / `skipMemoryWait()`）。
- `BODY_CONNECT_FAILED_MESSAGE`（「体の器（runtime-player）につながらない — runtime-player が起動していないか、channel が開いていない。runtime-player を起動して channel を開いてから、もう一度「配信を始める」を押す。」）・`BODY_URL_NOT_SET_MESSAGE`（新規 export）。
- `createCockpitShutdown(deps)`（新規 export）: Ctrl+C / EOF の手順。2 回目は待ちの打ち切りだけ。場が閉じていなければ `server.endStream()`（終えると同じ道）→ `server.close()` → （場が閉じていたときだけ走っている保存を待つ・頼まない）→ 残りを畳む → `finalize`（必ず走る）。
- `createLazyChannel` に `connect()`（今の URL でつないでおく・失敗は投げて非キャッシュ）。`close()` は接続の状態を `idle` に戻す（URL は残し、次の場でつなぎ直せる）。
- `createRoleMemoryPlaces` に `beginStream(startedAtMs)`・`streamNo()`・置き場の `streamNo`（場の始まりで置き場の表を捨てて場の番号を進め、次の `place()` でそのときのロールの置き場を新しい本体のファイル名で作る・準備もそこでもう一度＝冪等）。
- `createMemoryRecorder` の `onSaved` に `place`（`getPlace` があるときだけ・頼んだ時点の置き場）。
- `main()`: `ensureFireResources` を `ensureSession` + `ensureVoiceResources` に分け、`disposeSession`・`openStreamSession`（前のセッションを畳んでから作る）を足した。`sessionUsageLog` を `let` にして場の始まりで作り直す。起動時と `onSetRole` の置き場の準備の await をやめた（場の始まりへ）。20 分ごとの保存は `streamVenue.checkpoint()`。`--channel` 起動の先充填（起動時の `ensureFireResources()`）をやめた。shutdown を `createCockpitShutdown` に。起動の案内・HELP の `--channel` の文面を直した（§7-8）。

### 2.3 画面（Domain D の分だけ）

- メイン画面（`ui/conversation.mjs`・`ui/app.mjs`・`view-logic/glance-meters.mjs`）: 場が開いていない間は会話の場所の中央に「配信を始める」と横に「準備・設定」。始められなかった理由（`stream.error`・赤い枠・`role="alert"`）、開きかけは押せない「配信を始めています…」、閉じかけは押せない「配信を終えています…」と「記録中…」。場が開いているときは今のまま（会話の列）。「配信を始める」は `POST /api/stream/start {}`（マイク・文字起こし・声は前回の選択）。
- 「配信を終える」: 下の帯の歯車の左に小さく、場が開いている間だけ。2 回押し（1 回目で「もう一度押すと配信を終える」に変わり、4 秒で戻る）。
- 設定のダイアログ（`ui/settings-drawer.mjs`）: Start / Stop の行き先を `/api/stream/start`・`/api/stream/stop` に替えただけ。場が開いている間（開きかけ・閉じかけも）はマイクと文字起こしの select を `disabled`（`view-logic/settings.mjs` の `streamLocksInputs`）。タブ・見た目の組み直しはしていない（Domain E）。
- `settingsFromSnapshot` に `stream`。スタイルに `.prestream-*`・`.stream-end`。

## 3. 変えたファイル（`apps/soul/agent/` 起点）

| ファイル | 新規/変更 |
|---|---|
| `src/cockpit/cockpit-server.mjs` | 変更（場の状態・`openStream` / `closeStream` / `foldStream`・API・判定部品と発火の予定と思い出しの係の作り直し・role / memory-record の 409・`onEarsStopping` の撤去・snapshot の `stream`・内部 JS API） |
| `scripts/cockpit.mjs` | 変更（`createStreamVenueHooks`・`createCockpitShutdown`・`BODY_*` の文面・`createLazyChannel.connect`・`createRoleMemoryPlaces.beginStream`・recorder の `place`・`main()` の結線・HELP） |
| `src/cockpit/ui/app.mjs` | 変更（配信を始める / 終える・`settingsFromSnapshot.stream`） |
| `src/cockpit/ui/conversation.mjs` | 変更（中央の「配信を始める」「準備・設定」・理由・記録中） |
| `src/cockpit/ui/bottom-bar.mjs` | 変更（「配信を終える」） |
| `src/cockpit/ui/settings-drawer.mjs` | 変更（Start / Stop の行き先・マイクと文字起こしの固定） |
| `src/cockpit/ui/styles.mjs` | 変更（`.prestream-*`・`.stream-end`） |
| `src/cockpit/view-logic/glance-meters.mjs` | 変更（`streamPhaseOf`・`isPreStream(ears, stream)`・`streamStartView`・`endStreamButtonView`） |
| `src/cockpit/view-logic/settings.mjs` | 変更（`streamLocksInputs`） |
| `scripts/cockpit-stream.test.mjs` | **新規**（約束のテスト 29 件） |
| `scripts/cockpit.test.mjs` | 変更（§5 の 2 件・コメント） |
| `src/cockpit/cockpit-server.test.mjs` | 変更（§5 の 6 件） |
| `src/cockpit/cockpit-ui-glance.test.mjs` | 変更（§5 の 1 件 + 追加 2 件） |
| `src/cockpit/cockpit-ui.test.mjs` | 変更（§5 の 1 件） |
| `src/cockpit/view-logic/glance-meters.test.mjs` | 変更（追加 3 件） |
| `src/cockpit/view-logic/settings.test.mjs` | 変更（追加 1 件） |

`git diff --stat`（新規の `scripts/cockpit-stream.test.mjs` 約 1,190 行は含まない）:

```
 apps/soul/agent/scripts/cockpit.mjs                | 502 ++++++++++++++++-----
 apps/soul/agent/scripts/cockpit.test.mjs           |  58 ++-
 apps/soul/agent/src/cockpit/cockpit-server.mjs     | 483 +++++++++++++++++---
 .../soul/agent/src/cockpit/cockpit-server.test.mjs |  44 +-
 .../agent/src/cockpit/cockpit-ui-glance.test.mjs   |  61 ++-
 apps/soul/agent/src/cockpit/cockpit-ui.test.mjs    |   6 +-
 apps/soul/agent/src/cockpit/ui/app.mjs             |  72 ++-
 apps/soul/agent/src/cockpit/ui/bottom-bar.mjs      |  13 +-
 apps/soul/agent/src/cockpit/ui/conversation.mjs    |  20 +-
 apps/soul/agent/src/cockpit/ui/settings-drawer.mjs |  24 +-
 apps/soul/agent/src/cockpit/ui/styles.mjs          |  47 +-
 .../agent/src/cockpit/view-logic/glance-meters.mjs |  61 ++-
 .../src/cockpit/view-logic/glance-meters.test.mjs  |  53 +++
 .../soul/agent/src/cockpit/view-logic/settings.mjs |  11 +
 .../agent/src/cockpit/view-logic/settings.test.mjs |   9 +
 15 files changed, 1205 insertions(+), 259 deletions(-)
```


判定の文面（`speak-now.mjs`・`comment-react.mjs`）・②④の指示（`memory.mjs`・`recall.mjs`）・`conventions-seed.md`・`skills/`・`package.json`・`pnpm-lock.yaml` は差分なし（`git diff --quiet` で確かめた）。

## 4. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **1817 pass / 0 fail / 0 cancelled / 0 skipped**（作業前に基準 1782 pass を確かめてから始めた。+35） |
| 根で `pnpm run check:soul-zone` | pass（1561 source files scanned） |
| 依存・lockfile | 変更なし |

約束のテストが効いていることは、実装を一時的に壊して確かめた（終わったら元に戻し `cmp` で一致を確認）: 判定部品の作り直しを `reset` だけに戻す → テスト 4 が落ちる / 場の終わりの発火の予定の dispose を外す → テスト 15・22 が落ちる / 場の終わりの `closeBody` を外す → テスト 6・15・16・18 が落ちる。

## 5. 約束のテストの対応表

テストの番号は `scripts/cockpit-stream.test.mjs` の上からの順（名前は §5 の末尾の一覧）。

| 約束（委任 §7 / 持ち越し §3） | テスト |
|---|---|
| 1. 始めるの順と中身（KILL が OFF・積み残しを捨てる・本体のファイル名と頭の文脈の記録が場ごとに新しい・頭のセッションを場の始まりで作る） | 1（順・KILL・セッション・発火の予定の作り直し）、2（本体のファイル名・記録のファイル・準備）、3（本物の `createSessionUsageLog` で別ファイル）、4（speak-now の走っている判定・忙しい間の積み残し・取っておいたコメント・弾く判定の待ちが次の場に混ざらない）、5（思い出しの係の作り直し）、27（main の結線） |
| 2. 体ありで器につながらない → 開かない・案内・畳む / 体なし → 器を見ない | 6（本物の `createLazyChannel` + つながらない接続の口・500・文面・`stream.error`・耳とセッションと目を畳む・ロールを選び直せる）、7（URL が無い）、8（体なし）、9（`createLazyChannel.connect`） |
| 3. YouTube の URL があってつながらない → 開く | 10、11（URL が無ければつながない・Connect 済みは作り直さない） |
| 4. 開いている間: role 409・マイク / 文字起こし不可・Connect は通る。閉じている間: 20 分ごと・「今日を記録」が動かない | 12、13（閉じかけ = 記録中の間も断る・同時の操作）、14 |
| 5. 終えるの順（写し → 畳む（器の close は体の有無に関わらず）→ 「記録中」→ 閉じる → ロールを選び直せる） | 15、16、17 |
| 6. Ctrl+C（開いていれば同じ道・閉じていれば保存を頼まない・2 回目で待ちを打ち切る） | 18、19、20、21、28 |
| 7. 場の終わりのあとに発火の予定のタイマが発火を頼まない（棚卸し §5・設計 §9） | 22（偽のタイマを注入した本物の `createFireScheduler`: 閉じている間は張らない → 開くと沈黙の予定 → 発火を頼む → 終えるとタイマが 0 → 自発の切り替え・口数の変更でも張らない → 発火を頼まない） |
| 8. 2 つ目の場（前の場の `lastRecordedSeq` で飛ばさない・ロールを替えてから始めると新しいロールの置き場） | 23、24（前の場の遅れた保存で上書きしない）、25、26 |
| 9. メイン画面（閉じているとき「配信を始める」と「準備・設定」・開いているときは今のまま） | `cockpit-ui-glance.test.mjs`「ConversationPanel: 配信前（場が閉じている間）は…」「ConversationPanel: 始められなかった理由…と、閉じかけの「記録中…」」「BottomBar: 「配信を終える」は…」、`glance-meters.test.mjs`「streamPhaseOf / isPreStream(ears, stream)」「streamStartView」「endStreamButtonView」、`settings.test.mjs`「streamLocksInputs」、29（設定のダイアログの行き先と固定・App の結線）、既存の「ConversationPanel: 会話の行・…」（開いているときは今のまま） |
| (A) role の 409 を「場が開いているか」に | 12・13、`cockpit-server.test.mjs`「cockpit POST /api/role: 場が開いている間は 409 …」 |
| (B) 場の始まりで本体のファイル名を作り直す口 | 2、26 |
| (B) `lastRecordAtMs` / `lastRecordedSeq` を場ごとに | 23、24 |
| (B) 置き場の準備を場の始まりへ（場の始まりで用意されている） | 2、25、`cockpit.test.mjs`「記憶をロールごとにの結線…」 |
| (B) 最後の保存は頼んだ時点のロールの置き場（壊さない） | 17、25、既存の `createMemoryRecorder` の置き場のテスト |
| (C) 器につなぐかは `roleHooks.current().body` | 1・6（体あり）、8（体なし）、27（`hasBody: currentBody`） |
| (C) 場の終わりの器の close は体の有無に関わらず | 15（体あり）、16（体なし） |
| (C) `--channel` の先充填と案内の文面 | 27（先充填と「先充填済み」の文面が無い） |

`scripts/cockpit-stream.test.mjs` のテスト名（上から）:
1 配信を始める: ロールを固める → 場の記録を作り直す → KILL を OFF → 積み残しを捨てる → 耳・目・声 → 頭のセッション → 器 → YouTube の順 / 2 配信を始める: 記憶の本体のファイル名・頭の文脈の記録のファイルは場ごとに新しくなる（置き場の準備も場の始まりで待つ）/ 3 頭の文脈の記録（本物の createSessionUsageLog・一時フォルダ）: 場の始まりの時刻ごとに別のファイルになる / 4 配信を始める: 前の場の積み残し（走っている speak-now の判定・忙しい間の積み残し・取っておいたコメント・弾く判定の待ち）は次の場に混ざらない / 5 配信を始める: 思い出しの係は作り直す（前の場で走っていた④の結果は次の場に届けない）/ 6 配信を始める（体あり）: 器につながらなければ場は開かず「runtime-player が起動していないか、channel が開いていない」を返し、起こしたものを畳む / 7 配信を始める（体あり）: 器の URL が入っていなければ場は開かず、URL を入れる案内を返す / 8 配信を始める（体なし）: 器を見ない・つながない（URL が無くても開く）/ 9 createLazyChannel.connect: … / 10 配信を始める: 保存してある YouTube の URL につながらなくても場は開く（器官は畳む）/ 11 配信を始める: YouTube の URL が無ければつながない・場を開く前に Connect 済みならそのまま（作り直さない）/ 12 場が開いている間: ロール・マイク・文字起こしは替えられない（409）。YouTube の Connect・ゲームの窓は触れる / 13 場が閉じかけ（記録中）の間も: … / 14 場が閉じている間: 「今日を記録」は断る（409・保存を頼まない）・20 分ごとの保存は何もしない。開いている間は動く / 15 配信を終える: 写し → 畳む（…）→ 記憶の最後の保存を待つ間は「記録中」→ 閉じる → ロールを選び直せる / 16 配信を終える（体なし）: 器の close は体の有無に関わらず行う / 17 配信を終える: 最後の保存は頼んだ時点のロールの置き場に書く・前の保存から増えていなければ頼まない / 18 Ctrl+C: 場が開いていれば「配信を終える」と同じ道… / 19 Ctrl+C: 場が閉じていれば保存を頼まない / 20 Ctrl+C: 2 回目の Ctrl+C で記録の待ちを打ち切る / 21 Ctrl+C: 待ちが無いときの 2 回目は何もしない・保存の待ちの上限は SHUTDOWN_MEMORY_TIMEOUT_MS / 22 発火の予定: 場が閉じている間はタイマを張らず、場の終わりで畳んだあとは発火を頼まない / 23 2 つ目の場: 前の場の lastRecordedSeq で新しい場の保存が飛ばされない / 24 2 つ目の場: 前の場の最後の保存が遅れて終わっても… / 25 2 つ目の場: ロールを替えてから始めると、新しいロールの置き場に書く / 26 createRoleMemoryPlaces.beginStream: … / 27 場の結線（main）: … / 28 Ctrl+C: 場が閉じていても、走っている保存は待つ / 29 設定のダイアログの Start / Stop は場の関数を通り…

## 6. 期待値を変えた既存テスト（仕様変更に伴うもの・計 10 件）

| ファイル | テスト | なぜ |
|---|---|---|
| `src/cockpit/cockpit-server.test.mjs` | 「cockpit POST /api/role: 耳が動いている間は 409 …」→「場が開いている間は 409 …・配信を終えたあとは選べる」 | (A) 409 の判定を「場が開いているか」に替えた。断りの文面の正規表現を「配信の途中はロールを替えられない」に |
| 同 | 「cockpit 耳の Stop: pipeline を畳む前の転写を onEarsStopping に渡す…」→「cockpit 配信を終える: 畳む前の転写の写しを saveFinal に渡す…」 | 耳の Stop の記録の口を「配信を終える」の saveFinal に 1 本化。写しは畳む前・保存は畳んだあと（設計 §3 の終えるの順）なので `disposedAtCall` の期待を true に |
| 同 | 「cockpit 耳の Stop: onEarsStopping が throw しても Stop は成り立つ」→「cockpit 配信を終える: saveFinal が throw しても場は閉じる」 | 同上 |
| 同 | 「cockpit POST /api/memory-record: onMemoryRecord を呼び・…」「…throw しても 200 …」「…broadcastState が飛ぶ…」の 3 件 | 「今日を記録」は場が開いている間だけ。偽の耳を渡し、先に `POST /api/stream/start` で場を開くようにした（期待値そのものは不変） |
| `scripts/cockpit.test.mjs` | 「耳の Stop で保存される: …」→「配信を終えると保存される: 終えるときの転写が②の材料になり、終えた後の定期保存は空回りしない」 | 「同じ並びの最小ハーネス」を場の関数（本物の server + 本物の `createStreamVenueHooks`）に合わせて書き直した |
| 同 | 「記憶をロールごとにの結線: …」 | (B) 置き場の準備を起動時・`onSetRole` から場の始まりへ移した。起動時の `await memoryPlaces.place()?.ready` と `onSetRole` の準備の確かめを、「起動時と onSetRole では待たない・`createStreamVenueHooks` の renewRecords で `beginStream` → `place()?.ready` を待つ」に替えた |
| `src/cockpit/cockpit-ui-glance.test.mjs` | 「ConversationPanel: 配信前は会話の場所の中央に「準備・設定を開く」…」→「配信前（場が閉じている間）は…「配信を始める」と「準備・設定」…」 | 設計 §6 のメイン画面 |
| `src/cockpit/cockpit-ui.test.mjs` | 「settingsFromSnapshot: 設定系現況の取り出し…」 | `stream` を足した（欠落は null） |

`/api/ears/start` を使う既存テスト（約 70 か所）は、別名が同じ場の関数を通るのでそのまま通る。shutdown 型ハーネス（`cockpit.test.mjs` の 2 件）は保存の待ち方の不変条件として残し、コメントで新しい形（`createCockpitShutdown` → `endStream`）の固定場所を示した。

## 7. 裁量（設計に無いことを決めた所と理由）

1. **関数と hook の置き場**: 場の状態と `openStream` / `closeStream` は cockpit-server に置いた（耳・判定・発火の予定・思い出しの係・KILL・YouTube・snapshot・API がそこにあるため）。記録・頭のセッション・器・記憶の保存は cockpit.mjs の `createStreamVenueHooks` が `streamHooks` として渡す（server は中身を知らない・今の「hook で橋渡し」の流儀）。`main()` を走らせずにテストできるよう、cockpit.mjs 側は export した工場に寄せた。
2. **API の名前と別名**: `POST /api/stream/start`・`/api/stream/stop`。`/api/ears/start`・`/api/ears/stop` は消さずに同じ関数の別名にした（`scripts/preflight-fire.mjs` と既存テストが使う・「別の道を残さない」は満たす）。挙動は変わる: 開いている間の 2 回目の start は今まで 200（冪等）→ 409。
3. **場の状態の名前**: `closed` / `opening` / `open` / `closing`。始められなかった理由は snapshot の `stream.error` に残し、次の始めるで消す（メイン画面から押したときも、設定のダイアログから押したときも同じ所に出る）。
4. **判定部品（speak-now・コメント反応）も作り直す**: 計画は「`reset` があるものは reset」だが、`reset` は忙しい間の積み残ししか捨てず、**走っている判定の結果が次の場で返ると発火してしまう**（テスト 4 で再現。`reset` だけに戻すと落ちる）。`reset` を呼んだ上で古い部品を `dispose`（返ってきた結果を無視する）し、新しい部品を作る。場の終わりでも積み残しを捨てて dispose する。発火の予定・思い出しの係は計画どおり作り直す（どちらも `reset` が無い）。
5. **閉じている間の発火の予定**: 起動時と場の終わりで dispose し、畳んだ実体を自発の ON/OFF・口数の置き場として残す（snapshot・`/api/self-fire`・`/api/verbosity`・ロールの切り替えの口数は今のまま動く・タイマは張らない）。次の始めるで、その値を引き継いで作り直す。起動時にも張らないので、起動直後の「耳が無いのに沈黙の予定が発火を頼む」も消えた。
6. **終えるときの鳴っている声**: orchestrator が idle でなければ `kill()` で止める（キルと同じ切り方）。KILL の表示（`killed`）は替えず、次の始めるの `revive()` で戻す。
7. **声のプレイヤーと声の engine は場の終わりで畳まない**: 設計 §3 の「畳む」の列に入っていない。次の場の始まりで `onEarsStarted` → `ensureVoiceResources` が落ちたプレイヤーを作り直し、engine は `voiceKey` の違いで作り直すので持ち越して害がない（Ctrl+C では今どおり畳む）。鳴っている声は 6 の `kill()` で止まる。
8. **`--channel` の先充填（持ち越し C）**: やめた。頭のセッションは `--channel` の有無に関わらず「配信を始める」で作る（設計 §3 の 5）。起動の案内は「LLM セッション（と Channel の接続）は「配信を始める」で作ります（Channel につながらなければ配信は始まりません）」に揃え、HELP の `--channel` の「起動時に eager 生成し Fire を先充填」も直した（直さないと嘘になるため最小限）。
9. **置き場の準備（持ち越し B）**: 場の始まり（renewRecords）へ寄せた。起動時と `onSetRole` では待たない（ロールの切り替えの応答を git init で遅らせない）。準備は場ごとにもう一度走る（`prepareMemoryFolder` は冪等・前の失敗も次の場で試し直せる）。
10. **場ごとの保存の数え**: `lastRecordedSeq` / `lastRecordAtMs` は `createStreamVenueHooks` が持ち、場の始まりで 0 / null に戻す。保存の係の `onSaved` に置き場（`streamNo` つき）を渡し、**頼んだ時点の場の保存だけ**を数える（前の場の最後の保存が上限で打ち切られて新しい場で終わっても、新しい場の数えを上書きしない・テスト 24）。snapshot の `memory.lastRecordAtMs` も場ごと（新しい場の始まりは「まだ記録なし」）。
11. **終えるの記憶の待ち**: 上限は今の Ctrl+C と同じ `SHUTDOWN_MEMORY_TIMEOUT_MS`（90 秒）を、画面の「配信を終える」にも使う。上限で閉じても保存そのものは続く（直列の保存の係）。待ちの打ち切り口（`skipMemoryWait`）は cockpit.mjs が持ち、2 回目の Ctrl+C で効く。Ctrl+C で終えるを通ったときは、そこで待ったのでもう一度は待たない。場が閉じていたときだけ、走っている保存の残り（前の場の分）を上限つきで待つ（新しく頼まない）。
12. **YouTube の「入っていれば」**: 設定に保存してある URL（`chatSourceStatus().source`・設定のダイアログの欄に戻る値）と読んだ。場を開く前に Connect 済みなら作り直さない。場の終わりで畳む。→ §9 の確かめ 1。
13. **器の URL が無いとき**: 体のあるロールで URL が無ければ、つなぐ前に別の文面（`BODY_URL_NOT_SET_MESSAGE`「URL が入っていない — Channel 欄に入れてから」）で断る（つながらないとき（`BODY_CONNECT_FAILED_MESSAGE`）と取り違えないため）。器の URL は場の始まりで今の値に揃えてから確かめる（場の途中の URL の差し替えは今どおり次の Fire の境目）。
14. **「配信を終える」の置き場**: 下の帯の歯車の左に小さく、場が開いている間だけ・2 回押し（1 回目で赤みの枠の「もう一度押すと配信を終える」・4 秒で戻る）。KILL のある上の帯や会話の場所から離し、ふだん目と手が行かない所にした。
15. **設定のダイアログ**: Start / Stop の行き先を替え、マイクと文字起こしの select を場が開いている間 `disabled` にしただけ（声の select は替えていない・ロールの持ち物で Domain E が扱う）。開いている間に Start を押すと 409 の文面がエラー欄に出る。
16. **閉じかけの間の操作**: 終えるの最中の始める・終える・ロールの選択は 409（「配信を終えている途中（記録中・少し待ってからもう一度）」）。Ctrl+C の `endStream` だけは断らずに待つ。

## 8. 持ち越し

- **Domain E へ**:
  - 設定のダイアログの「今日を記録」ボタンは今は押せ、場が閉じていれば 409 の文面がエラー欄に出る（記憶のタブで「場が開いている間だけ」押せる見た目にするのは E）。マイクと文字起こしの固定は `disabled` だけ（たたむ等は E）。
  - 「配信を始める」の失敗の理由はメイン画面の中央に出る。設定のダイアログの Start の失敗は今どおりマイクの行のエラー欄（`start failed: …`）にも出る。どちらを正にするかは E で決めてよい。
  - 上の帯の状態のピルは耳の状態のまま（場の状態は見ていない）。上の帯にロールの名前を出すときに、場の状態（開きかけ・記録中）を出すかは E で。
  - snapshot の `stream` と `memory.recording` が使える。`view-logic/glance-meters.mjs` の `streamPhaseOf` を使うと古いサーバでも耳から読める。
- **仕上げへ**: README の Start / Stop・`/api/ears/*`・`--channel` の記述、`view-logic/settings.mjs` の JSDoc の「POST /api/ears/start」の言い方（動作は別名で同じ）、`cockpit-server.mjs` の JSDoc の一部（`sttEngineInitial` の「Start ごと」）は古い言い方のまま。`main()` の結線テストは Domain B・C と同じくソースの文字列の照合で書き換えに弱い。
- **人間ゲートへ**（計画 §6 の 2・3・5）:
  - runtime-player を起動しないで「配信を始める」→ 中央に赤い枠で「体の器（runtime-player）につながらない — runtime-player が起動していないか、channel が開いていない。…」が出て、場は開かない（耳も止まったまま）。runtime-player を起動して channel を開いてから押し直すと開く。
  - 「配信を始める」を押してから声が出るまで、頭のセッションの立ち上げ（Codex / Claude の起動 ≈12 秒）が場の始まりに乗る（最初の発火まで遅らせない設計 §3 の 5）。場はすぐ開くが、最初の返事はセッションの立ち上がりを待つ。
  - 「配信を終える」は 2 回押し。押したあと中央に「配信を終えています…」「記録中…」が出て、記録が終わると「配信を始める」に戻る（最大 90 秒）。`memories/chappy/` の git にコミットが積まれる。Ctrl+C でも同じ並び（ターミナルに「配信を終えます（記録してから畳みます…）」）。
  - 喋っている最中に終えると、声はキルと同じく切れる。考えている最中に終えると、頭のセッションを畳むので、その返事は頭のエラーとして上の帯に一回きりの警告が出うる（→ 残リスク）。
  - 保存してある YouTube の URL（前回 Connect した URL）があれば、「配信を始める」で自動でつなぐ。前の配信の URL だと「チャットが切れている」の警告が出うる（新しい URL を入れて Connect すれば作り直す）。
- **残リスク**:
  - 考えている最中（thinking）に終えると、セッションを畳むことで返事の ask が失敗し、「頭のエラー」の一回きりの警告が出うる（場は正しく閉じる）。
  - 場の終わりで声のプレイヤーと engine を残すので、ElevenLabs の声の接続は場の間もつながったまま（Ctrl+C で畳む）。

## 9. 質問（どれも止めた分岐ではない。別の読みならすぐ直せる）

1. **YouTube の「URL が前もって入っていれば」**を「設定に保存してある前回の URL」と読んだ（§7-12）。前回の配信の URL が残っていると、場を開くたびに古い URL につなぎにいき、配信が終わった動画なら「チャットが切れている」の警告が出る（場は開く）。「この起動で場を開く前に入れた URL だけ」と読むなら、始めるでは保存の値を見ずに「Connect 済みならそのまま」だけにする（数行で直せる）。
2. **speak-now・コメント反応の判定部品を `reset` ではなく作り直した**（§7-4）。計画の「`reset` が無いものは作り直す」より強い。`reset` だけだと走っている判定の結果が次の場で発火する（テスト 4）ため。`reset` のまま + 別の手当てを望むなら教えてほしい。
