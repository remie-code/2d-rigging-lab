# 配信の組み直し Domain D — 場(配信を始める / 終える) レビュー

Review-Sylph → Orch-Sylph(2026-10-31)。対象: `7e9a04b0` からの未コミットの作業ツリー(`apps/soul/agent/` の 15 ファイルの M + 新規 `scripts/cockpit-stream.test.mjs` + Gnome 報告)。読み取り専任で、ソース・テストは直していない(ソースを書き換えて試すこともしていない)。

## 1. 判定

**pass**(止めた指摘 0 件)。Undine に上げる分岐も無い。Gnome の質問 2 件はどちらも裁量で足りる(§6)。

## 2. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | 自分で実行。**1817 tests / 1817 pass / 0 fail / 0 cancelled / 0 skipped**(基準 1782 + 35。Gnome 報告と一致) |
| 根で `pnpm run check:soul-zone` | pass(1561 source files scanned) |
| 依存・lockfile | `git diff 7e9a04b0 --stat` の 15 ファイルに `package.json`・`pnpm-lock.yaml` なし。変更なし |
| 守りの文面 | 差分は上の 15 ファイルだけ。`src/mind/`(`speak-now.mjs`・`comment-react.mjs`・`fire-scheduler.mjs`・`session-usage-log.mjs` など)・`src/memory/`(`memory.mjs`・`recall.mjs`・`conventions-seed.md`)・`skills/` の差分なし(`git diff 7e9a04b0 --stat` が空) |
| 実データ・鍵 | 開いていない。存在と更新日時だけ確認: `cockpit-settings.local.json`(10/29)・`.bak-20261027`・`memories/`(10/28、`.git` は 10/29)・`session-usage/`(最新 10/29)は作業前のまま。`apps/soul/agent/roles/` は存在しない。`tmp/` は `discord-receive` だけ。新規テストに `process.env`・`.env`・実データのパスの参照なし(書くのは `mkdtempSync(tmpdir())` だけ。偽の耳・orchestrator・判定・器・セッション・②と、本物の cockpit-server の loopback HTTP) |

## 3. 止めた指摘

0 件。

## 4. 設計適合・テスト適合の確認

### 4.1 設計 §3「始める」7 段

実装は `cockpit-server.mjs` の `openStream`(`streamPhase` が closed のときだけ)。

| 設計 §3 | 実装 | テスト |
|---|---|---|
| 1 ロールを固める | `streamPhase = "opening"`(以後 `POST /api/role` は `streamPhase !== "closed"` で 409) | 12・13 |
| 2 場の記録を作り直す | `streamHooks.renewRecords`(場の番号・本体のファイル名・頭の文脈の記録・保存の数えを 0 / null・置き場の準備を待つ) | 1・2・3 |
| 3 KILL OFF・積み残しを捨てる | `killed = false` + `revive()`、判定部品(speak-now・コメント反応)は `reset`+`dispose` して作り直し、弾く判定の待ち行列を捨てる、発火の予定・思い出しの係は作り直し | 1・4・5 |
| 4 耳・目・声 | `startEars`(→ `onEarsStarted`) | 1 |
| 5 頭のセッション | `openSession` hook(`openStreamSession` = 前のセッションを畳んでから作る) | 1・27(文字列) |
| 6 体があれば器 | `connectBody`(`hasBody()` = `currentBody` = `roleHooks.current().body`)。URL 無し / つながらない → `{ok:false}` → 場は開かない | 6・7・8 |
| 7 YouTube | `connectSavedChat`(保存の URL があり未接続ならつなぐ。throw も握って開く) | 10・11 |

実装の順は設計と一致し、テスト 1 が events の並びそのもの(usageLog.renew → memory.prepare → revive → scheduler.create → ears.start → eyes+voice.start → session.open → channel.getUrl → channel.connect → chat.start)で縛っている。

失敗時: `fail()` が `foldStream`(起こした耳・セッション・器)を畳んで `streamPhase = "closed"`、理由を `stream.error` と 500 の応答に残す。テスト 6 は本物の `createLazyChannel` に落ちる接続の口を渡し、(a) 文言が `BODY_CONNECT_FAILED_MESSAGE`(「体の器(runtime-player)につながらない — runtime-player が起動していないか、channel が開いていない…」)で正規表現でも「runtime-player が起動していないか、channel が開いていない」を確認、(b) 耳の dispose・セッションの close・目の stop・チャンネルの close が起きる、(c) ロールを選び直せて、もう一度始められる、を固定している。体なしは `getUrl`/`connect` が呼ばれると `assert.fail`(テスト 8)。YouTube がつながらなくても開く(テスト 10、器官は畳む)。

### 4.2 設計 §3「終える」4 段

`closeStream`: 1 写し(`pipeline.transcriptBuffer.all()`)→ 2 `foldStream`(YouTube → 判定 → 発火の予定 → 思い出しの係 → 鳴っている返事を `kill()` → 目・耳 → セッション → 器)→ 3 `saveFinal`(この間 `stream.phase` は `closing` = 「記録中」)→ 4 `closed`。テスト 15 が events 全体の並び(chat.stop → scheduler.dispose → orchestrator.kill → eyes.stop → ears.dispose → session.close → channel.close → memory.write)と、保存待ちの間に `closing`・`memory.recording`・耳が止まっている・ロールが 409、解放後に `closed`・ロールを選べる、までを固定。

### 4.3 場の途中の制限

- ロール: `POST /api/role` を `streamPhase !== "closed"` で 409(サーバの側)。旧 `earsState` 判定を差し替え。既存テストの書き換えもこの仕様変更に伴うもの。
- マイク・文字起こし: 替える口は「始める」だけで、`handleStreamStart` が `streamPhase !== "closed"` なら 409(本文を読む前と後の 2 回確認)。`/api/ears/start` の別名も同じ。テスト 12 が `device`/`sttEngine` が変わらないこと、耳を作り直さないことまで見ている。UI は `streamLocksInputs` で select を `disabled`(見た目の整理は E)。
- YouTube の Connect・ゲームの窓は触れる(テスト 12 が通す)。
- 20 分ごとの保存: `checkpoint()` は `isStreamOpen()` のときだけ。「今日を記録」: `streamPhase !== "open"` で 409(閉じかけも断る)。テスト 14 が閉じている間の 409・`checkpoint()` false・開いている間の動作・増えていなければ頼まない・終えた後の 409 を固定。

### 4.4 Ctrl+C

`createCockpitShutdown`: 2 回目は `skipMemoryWait()` だけ(待ちが無ければ何もしない)。1 回目は `beforeClose`(隙間圧縮の見張り)→ 場が閉じていなければ `server.endStream()`(`endStreamForShutdown` = 進行中の始める / 終えるを待ち、開いていれば `closeStream` = 「配信を終える」と同じ関数)→ `server.close()` → 終えを通っていなければ走っている保存の残りを待つ(頼まない)→ `disposeRest` → `finalize`(`finally` なので必ず走る)。旧実装との比較: 旧「close 前に転写を確保 → close → 最後の保存」の並びは `endStream` が内部で担う(写し → 畳む → 保存)。旧 shutdown 型ハーネスのテスト 2 件は不変条件(直列・上限・後続 dispose は必ず走る)として残してあり、新しい形はテスト 18〜21・28 が固定している。2 回目の打ち切りの経路(`waitBounded` の `skipWait`)は旧 `skipMemoryWait` と同じ形で、テスト 20(ハングする保存 → 2 回目で打ち切り → `disposeRest`・`finalize`・`phase === "closed"`)が見ている。

### 4.5 持ち越しの全部(Domain A / B / C から)

| 持ち越し | 状態 |
|---|---|
| A: `/api/role` の 409 を場の状態で判定 | 済(`streamPhase !== "closed"`・テスト 12・13・サーバ単体のテスト) |
| B: 場ごとの本体のファイル名 | 済(`createRoleMemoryPlaces.beginStream` が置き場の表を捨てて `streamNo` を進め、次の `place()` で新しい `createIdentityImpl({dir, startedAtMs})`。テスト 2・26) |
| B: `lastRecordAtMs`・`lastRecordedSeq` を場ごと | 済(`createStreamVenueHooks` が持ち `renewRecords` で 0 / null。`noteSaved` が `place.streamNo` と今の `streamNo()` を比べ、前の場の遅れて終わった保存で上書きしない。テスト 23・24) |
| B: 置き場の準備を場の始まりへ | 済(`renewRecords` が `beginStream` → `place()?.ready` を待つ。起動時・`onSetRole` の await は消し、ソース照合のテストが両方向を固定。準備は冪等で場ごとにもう一度走る) |
| B: 最後の保存は頼んだ時点のロールの置き場 | 済(`createMemoryRecorder` は変わらず `getPlace()` を頼んだ時点で取り、`onSaved` に `place` を載せる。テスト 17・25) |
| C: 器につなぐかは `roleHooks.current().body` | 済(`hasBody: currentBody`、体なしは `getUrl`/`connect` を呼ばない) |
| C: 場の終わりの器の close は体の有無に関わらず | 済(`foldStream` が無条件に `closeBody`。テスト 15 体あり・16 体なし) |
| C: `--channel` の先充填・起動案内の文面 | 済(先充填をやめ、案内文・HELP を直した。「先充填済み」の文面はテスト 27 が無いことを確認) |

### 4.6 「場の終わりのあとに発火の予定が動かない」

テスト 22 は本物の `createFireScheduler` に偽のタイマ(`setTimeoutImpl`/`clearTimeoutImpl`)を注入し、起動直後 0 → 場が開くと 1 → 鳴らすと本当に発火を頼む → 終えるとタイマが 0 → 自発の ON/OFF・口数を変えても 0 のまま → `runAll()` が 0 件 → 発火回数が増えない → 値(自発・口数)は閉じている間も読み書きでき、次の場に引き継がれる、を見ている。`parkFireScheduler` の `dispose()` を外せば `timers.pending.size === 0` が崩れて落ちるので、実装を縛っている。判定部品の作り直し(テスト 4)は、走っている judge の resolve を次の場で呼んでも `fireCount` が増えないことを見ていて、`reset` だけの実装なら落ちる(`dispose` が結果を捨てる実装を直接検証)。思い出しの係(テスト 5)も同型。Gnome が書き換えて確かめたという 3 か所(判定部品の作り直し・発火の予定の dispose・場の終わりの `closeBody`)は、読んだ範囲で各テストの assert が該当の副作用を直接指しており、納得できる。

### 4.7 期待値を変えた既存テスト(Gnome 報告 §6 の 10 件)

差分と照合した。10 件すべて仕様変更に伴うもの。

- `cockpit-server.test.mjs`: `POST /api/role` の 409(文面と判定の置き換え)、耳の Stop の記録の口 → 配信を終える(`disposedAtCall` が false → true は「写しは畳む前・保存は畳んだあと」で設計 §3 の終えるの順そのもの)、throw の握り、`memory-record` 3 件(期待値そのものは不変・前提として場を開く 1 行と偽の耳を足しただけ)。
- `cockpit.test.mjs`: 「耳の Stop で保存される」を場の関数 + 本物の `createStreamVenueHooks` に書き直し、結線テストの「準備は起動時 / onSetRole で待つ」を「待たない・場の始まりで待つ」に反転(Domain B の置き場の準備の持ち越しの実施)。shutdown 型ハーネス 2 件は不変。
- `cockpit-ui-glance.test.mjs`・`cockpit-ui.test.mjs`: 設計 §6 のメイン画面、`settingsFromSnapshot` に `stream` を足した(null 許容)。
- `numstat` で削除行はこれらの書き換えの範囲に収まり、無関係なテストの弱体化は見当たらない。`/api/ears/start` を使う約 70 か所の既存テストは別名が同じ関数を通るのでそのまま通る(開いている間の 2 回目の start が 200 冪等 → 409 に変わったことは Gnome 裁量 2 で記録済み。`scripts/preflight-fire.mjs` は start を 1 回しか呼ばないので影響なし)。

## 5. 止めない指摘(持ち越し)

1. **`openStream` / `closeStream` の本体が想定外に throw したとき `streamPhase` が opening / closing のまま固まりうる**(`cockpit-server.mjs` の `run` に try/finally が無い)。フックの throw は `runStreamHook` が握り、`connectSavedChat` も握るので、残るのは `makeSpeakNow` などの工場関数の throw や `foldStream` の想定外の throw だけ。起きにくいが、起きるとロールが選べないまま再起動になる。`run` を try/catch して closed へ戻す(または closing を閉じる)1 か所の防御で足りる(作り直しの案)。
2. **場が閉じている間の手動 Fire**で頭のセッションが立ちうる(`applyDesiredFireSettings`/`ensureSession` は場に関わらず遅延生成する)。設計は閉じている間の Fire の扱いを書いていない。場の外で作られたセッションは次の「配信を始める」の `openStreamSession` が畳んで作り直し、Ctrl+C の `disposeRest` でも畳まれるので害は無いが、閉じている間の Fire を許すかは Domain E か仕上げで一言決めるとよい。同じ系で、場の終わりで `kill()` を呼んだ(idle でなかった)ときだけ orchestrator が内部で kill 済みとなり、閉じている間の手動 Fire が断られる。状況で変わる振る舞いになるので、E / 仕上げで揃えてよい。
3. **`main()` の結線テスト(27)・設定のダイアログの結線テスト(29)はソース文字列の照合**(Domain B・C と同じ流儀)。リファクタに弱い。部品(`createStreamVenueHooks`・`createCockpitShutdown`・`createLazyChannel.connect`・`beginStream`・server)は個別に挙動を見ている。人間ゲートで実機の確認が要る。
4. **`createCockpitShutdown` は `endStream` が想定外に throw すると `server.close()`・`disposeRest` を飛ばして `finalize` に行く**(`finally` なのでプロセスは終わるが、頭のセッション等を畳まない)。持ち越し 1 の防御が入れば実質起きない。
5. **「配信を終える」の HTTP 応答は記憶の最後の保存(最大 90 秒)まで保留される**。画面は SSE の `closing`(「記録中…」)で見えるので実害は小さい。設定のダイアログの Stop ボタンは `micBusy` のまま待つ。Domain E で設定のダイアログを組み直すときに見ておくとよい。
6. **Domain E へ(Gnome 報告 §8 のとおり)**: 設定のダイアログの「今日を記録」を場が開いている間だけ押せる見た目に、マイク・文字起こしの固定の見た目、上の帯の状態のピルを場の状態から読むか、始められなかった理由をメイン画面とマイクの行のどちらを正にするか。
7. **仕上げへ**: README の Start / Stop・`/api/ears/*`・`--channel` の記述、`view-logic/settings.mjs`・`cockpit-server.mjs` の JSDoc の古い言い方。
8. **人間ゲート(計画 §6)で見ること**: Gnome 報告 §8 の 5 項目に加え、(a) 体ありで runtime-player 無しの「配信を始める」→ 赤い枠の文言 → 起動して押し直すと開く、(b) 考えている最中に終えたときの頭のエラーの一回きりの警告(残リスク)、(c) 前の配信の YouTube の URL が残っているときの「チャットが切れている」の警告(§6 質問 1)、(d) 場を終えたあとに ElevenLabs の声の接続が残る(裁量 7)。

## 6. 裁量の評価と Gnome の質問への意見

### 質問 1: YouTube の「URL が前もって入っていれば」

**設計の判断の分岐ではない。裁量で足りる**(Undine に上げない)。根拠:

- 設計 §3 の 7 は「YouTube の URL が前もって入っていればつなぐ。つながらなくても場は開く。ふだんは場を開いたあとで URL を入れて Connect する」。scope §19 は「場を開いたあとで、コメントを拾う URL を入れることがほとんど」。この 2 つは「保存の URL が欄に戻っているなら自動でつなぐ。つながらなくても開く。ふだんはその前提が空」という一つの読みに素直に収まる。どちらの読み(保存の値 / この起動で入れた値)でも、設計が縛っている「つながらなくても場は開く」と「場が開いている間も触れる」は満たされる。
- 「入っている」の観測点として snapshot の `chat.source`(設定のダイアログの欄に戻る値)を使うのは、画面で見えている欄と実際の動作が一致するので筋が通る。
- 失敗しても場は開き、器官は畳んで診断を出すだけ(テスト 10)。外から見える違いは、古い URL のときに警告が 1 件出うることだけで、挙動を取り返しのつかない形で固定しない。「Connect 済みならそのまま」(テスト 11)も安全側。

注意として残すのは §5 の 8(c)。人間ゲートで古い URL の警告が邪魔なら、「この起動で入力した URL だけ」または「場の終わりで保存の URL を使わない」への切り替えは `connectSavedChat` の数行で済む。

### 質問 2: 判定部品を `reset` ではなく作り直した

**筋が通る。裁量で可**。計画の「`reset` が無いものは作り直す」より強いが、設計 §3 の 3「判定…の積み残しを捨てる」の趣旨(前の場の判定が次の場に混ざらない)を満たすために必要で、`reset` は忙しい間の積み残ししか捨てず、走っている judge の結果が次の場で返ると発火する(テスト 4 が `reset` のみなら落ちる形で再現している)。`reset` を呼んだ上で古い部品を `dispose` して新しい部品を作るので、既存の `reset` を使う経路(話し始めの方式の切り替え)は壊していない。判定の文面(`speak-now.mjs`・`comment-react.mjs`)は差分なし。

### その他の裁量(Gnome 報告 §7)

筋が通ると認め、記録で足りる(Undine の追認は必須でない)。

- 1 hook 経由の橋渡し(cockpit-server は記録・セッション・器・記憶の中身を知らない)、2 API の名前と `/api/ears/*` の別名(「耳だけを起こす道は残さない」を満たす・UI 側は別名を使わない)、3 場の状態の名前、5 閉じている間の発火の予定を畳んだ実体で値の置き場にする、6 終えるときの鳴っている声を `kill()` で止め、`killed` の表示は替えず次の `revive()` で戻す、7 声のプレイヤー・engine を場の終わりで畳まない(設計 §3 の畳む列に無い。次の場で作り直す / 持ち越して害がない)、8 `--channel` の先充填をやめ文面を直した、9 置き場の準備を場の始まりに、10 場ごとの保存の数え、11 終えるの待ちの上限を既存の 90 秒に揃え、2 回目の Ctrl+C で打ち切る、13 体ありで URL 無しは別の文面で断る、14 「配信を終える」を下の帯の歯車の左・2 回押し、15 設定のダイアログは行き先の差し替えとマイク・文字起こしの `disabled` だけ、16 閉じかけの間の操作は 409 で、Ctrl+C の `endStream` だけは待つ。

## 7. Undine に上げるべき分岐

なし。設計に書いていない判断の分岐は見当たらない(Gnome も止めた分岐なしと報告)。

## 8. 質問

なし。
