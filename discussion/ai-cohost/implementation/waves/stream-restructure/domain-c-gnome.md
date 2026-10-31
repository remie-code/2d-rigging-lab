# 配信の組み直し Domain C — 体なしの声 完了報告

Gnome → Orch-Sylph(2026-10-31)。計画 [stream-restructure-wave-plan.md](../../orchestration/stream-restructure-wave-plan.md) §1 Domain C、設計 [stream-restructure.md](../../../architecture/stream-restructure.md) §4。ブランチ `ai-cohost/stream-restructure`(15bf9570 の上)。**コミットはしていない(stage もしていない)。**
実データには触れていない: `apps/soul/agent/cockpit-settings.local.json`(と `.bak*`)・`apps/soul/agent/memories/`・`apps/soul/agent/roles/`・`.env*.local` は読んでいない・書いていない。操縦席は起動していない(`scripts/cockpit.mjs` は `node --check` とテストからの import・文字列の読み取りだけ。`main()` は走らない)。テストは偽物(偽の engine・再生器・器・頭)と、器の URL を持たない `createLazyChannel`(接続しない)だけを使う。本物の LLM・外部 API・AivisSpeech・ElevenLabs は呼んでいない。作業後に `apps/soul/agent/roles/`・`memories.migrating-*`・`tmp/restructure-backups/` が無いことを確かめた。依存・lockfile は変えていない。

## 1. 判定

**done**

## 2. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **1782 pass / 0 fail / 0 cancelled / 0 skipped**(作業前に基準 1758 pass を確かめてから始めた。+24) |
| 根で `pnpm run check:soul-zone` | pass(1560 source files scanned) |
| 依存・lockfile | 変更なし |
| 判定の文面・②④の指示・`conventions-seed.md`・`skills/expression.md` の本文 | 差分なし(`git status` に出ない) |

## 3. 変えたファイル

パスは `apps/soul/agent/` 起点。新規ファイルは無い。

| ファイル | 要点 |
|---|---|
| `src/voice/speech-streamer.mjs` | 候補 2。運び手の約束を「器は任意」に。`channel` が null / 未指定なら体なし: `activate` は `openSpeech` を飛ばしてすぐ `player.open`(新しい内部関数 `openPlayer` に共通化)、`flush` は `appendSpeech` を飛ばし(時間割は `job.timeline` に貯めたまま)、終わりの `endSpeech` も飛ばし、口の release も呼ばない。器を渡すなら 3 つの口が要るのは今どおり(入口で投げる)。`speech.playback.activated` に体なしのときだけ `bodyless: true`。冒頭の説明と口の t=0 の約束のコメント、`speakOnce` の JSDoc を書き直した(`speakOnce` は channel を素通しするだけなのでコードは不変) |
| `src/mind/fire-orchestrator.mjs` | 候補 3。受理の資源に `body`(`acquireFireResources` の返りの `body`、無ければ新しい `options.body`、既定 true)。体なしの資源は `channel: null`(既定の channel にも戻らない)。`releaseMouth` / `streamReleaseMouth` は体なしなら何も送らず診断も出さない。返事の表情タグは剥がした上で捨てる(`applyExpressions` を呼ばない・envelope を送らない・`onExpression` を出さない・`expressions: []`)。体なしでタグだけの返事は `reason:"expression-only"`・`expressed:false` で静かに畳む。遅延の通知(`onLatency`)に体なしのときだけ `bodyless: true`。冒頭に体なしの節 |
| `src/mind/soul-skills.mjs` | 候補 6。`soulSkillNamesForBody(body)`(false なら `expression` を外した名前、それ以外は `SOUL_SKILL_NAMES` そのもの) |
| `scripts/cockpit.mjs` | 候補 4 と器の URL の確かめ。`CHANNEL_URL_NOT_SET_MESSAGE`(今と同じ文面)と `resolveFireChannel({ body, channel })` を新規 export(体ありは URL が無ければ断る・体なしは URL を見ず器を渡さない)。`createSessionProxy` に `hasBody`(省略時はいつも確かめる=今どおり)。`main()`: `currentBody = () => roleHooks.current().body !== false` を使う時点で読む / `acquireAcceptedFireResources` は `resolveFireChannel` で器・`body`・`channelUrl` を決める(体なしは `channelConnectionGeneration: null`)/ `applyDesiredFireSettings` の器の URL の差し替えは体があるときだけ / セッションを作るときに体なしなら `expression` を外した教えで①を作り、`sessionBody` を覚えて今のロールの体と違えば次の Fire の境目で作り直す / 会話指示の編集画面に見せる教えも体に合わせる / `channelStatus` に `body` / 起動の案内に体なしの文 / `formatReplyLatencyLine` に体なしのとき ` body=none`。冒頭の S2.5 の説明と `onSetRole` の説明に 1〜3 行 |
| `src/cockpit/view-logic/status.mjs` | `channelStatusView` は `body: false` なら URL や接続に関わらず `{ text: "体なし", className: "channel-status bodyless" }`。`body` を持たない・true は今どおり |
| `src/mind/fire-latency.mjs` | 説明だけ。「声」の区間は体なしだと器の往復を含まないこと、`bodyless: true` の印、`FireLatency` の型に `bodyless?: true` |
| `src/mind/session-usage-log.mjs` | `replyLatencyUsageRecord` はレコードの `bodyless === true` のときだけ `bodyless: true` を足す(体ありの行の形は変えない) |
| `src/cockpit/cockpit-server.mjs` | 遅延の札(`broadcastReplyLatency` の payload)に `inFire.bodyless === true` のときだけ `bodyless: true`(SSE "latency" と `onReplyLatency` の両方) |
| テスト 7 ファイル | §4(追加のみ) |

## 4. 足したテスト(24 件)と「必ず入れるテスト」の対応

| 必ず入れるテスト | テスト(ファイル: 名前の頭) |
|---|---|
| 体なしで運び手が器なしで手元の再生器だけで鳴らせる(`openSpeech`/`appendSpeech`/`endSpeech` を呼ばない・`play-failed` にならない) | `speech-streamer.test.mjs`: 「器なし(体なし): openSpeech を待たずに player.open → write → end…」(2 文・時間割を貯める・release しない・器の拒否/失敗の trace が無い)、「器なし(体なし): channel 未指定でも同じ…」、「器なし(体なし): 割り込み・キルは player.stop で止めて cancelled(play-failed ではない)…」。`fire-orchestrator.test.mjs`: 「体なし(一括の読み上げ・本物の speakOnce): 器へ何も送らず…ENDED で完了する(play-failed にならない)」(器を資源に渡しても使われない) |
| **割り込みの「どこまで声に出たか」が体なしでも体ありと同じ** | `fire-orchestrator.test.mjs`: 「体なし: 割り込みの『どこまで声に出たか』は体ありと同じ…」(本物の speakOnce・同じ時間割・STARTED 1000 / 割り込み 1350 → どちらも「こんに」・3 文字・350ms・soul の行も同じ)、「体なし(文ごとの読み上げ): …割り込みの声に出た分は体ありと同じ」(本物の運び手・`{ interrupted: true, charsSpoken: 3, prefix: "先行。" }` が一致)。`speech-streamer.test.mjs`: 「speakOnce 器なし(体なし): …切断点の材料(時間割と STARTED の時刻)は器ありと同じ」 |
| 体なしで表情タグが剥がされ、器に送られず、診断が出ない | `fire-orchestrator.test.mjs`: 「体なし: 表情タグは剥がして捨てる…」、「体なし: 表情タグだけの返事は…expression-only で静かに畳む…」、文ごとの読み上げのテスト(envelope 0)、「体の有無は受理のたびに読む…」 |
| 割り込み・キルで `…MouthCloseError` の診断が出ない | `fire-orchestrator.test.mjs`: 「体なし: 器を持たない speak の返り(stop なし)でも、割り込み・キルで …MouthCloseError を出さない(体ありは今どおり出す)」、本物の speakOnce の割り込み(診断は `bargeIn` だけ・sendSet も送らない) |
| 体なしで `expression` の教えが頭に渡らない(体ありでは今どおり渡る) | `soul-skills.test.mjs`: 「soulSkillNamesForBody: …」「体なしの教え: 表情の教えの本文が①に足されない…」。`cockpit.test.mjs`: 「buildRoleSessionSystemPrompt(体なし): …体ありは今と同じ①」「createConversationInstructionHooks(体なし): 編集画面に見せる教えに表情の教えが出ない」、`main()` の結線(下) |
| 体なしで器の URL が無くても頭に聞ける・発火を受理できる。体ありで URL が無ければ今どおり断る | `cockpit.test.mjs`: 「createSessionProxy(体なし): URL が無くても頭に聞ける・体ありは今どおり断る・体の有無は聞くたびに読む」、「resolveFireChannel: …今と同じ文面で断る…体なしは URL を見ず器を渡さない」、「体なしの受理(本番の器の取り方 + 本物の orchestrator): URL が無くても発火を受理して器なしで鳴らす・体ありは今どおり受理しない」、「体なしの結線(main): 体は使う時点で今のロールから読む…」(受理・頭に聞く・URL の差し替え・セッションの教えと作り直し・器の状態の結線を `main()` の文字列で固定) |
| 遅延の記録に「体なし」の印が付く | `fire-orchestrator.test.mjs`: 「体なし: 遅延の通知に bodyless: true の印が付く(体ありは付かない)」。`cockpit-server.test.mjs`: 「cockpit 体なし: 遅延のレコードに bodyless: true の印が載る(SSE と記録の両方・体ありは載らない)」。`session-usage-log.test.mjs`: 「遅延の 1 行(体なし): …」。`cockpit.test.mjs`: 「formatReplyLatencyLine(体なし): …body=none」 |
| 器の状態の表示が「体なし」 | `status.test.mjs`: 「channelStatusView(体なし): …『体なし』」。`main()` の `channelStatus` に `body` が載ることは結線のテストで固定 |

体のあるロールの挙動が今と同じことは、既存の 1758 件がそのまま通ることで確かめた(加えて、体なしのテストの多くは同じ条件で体ありを走らせて今の挙動を並べて確かめている)。

## 5. 期待値を変えた既存テスト

**なし。** 既存テストは 1 件も書き換えていない(テストファイルの変更は末尾への追加だけ。`git diff --numstat` でテストファイルの削除行は 0)。

- 棚卸しが「期待値が変わる」と見ていた `cockpit.test.mjs` の `createLazyChannel` の URL の断り(`:240-251`)は、`createLazyChannel` 自体を変えていない(体なしは器を渡さないだけ)ので不変。`createSessionProxy` の URL の断り(`:458-471`)は、`hasBody` を省略したときの既定を「いつも確かめる」にしたので、体ありの断りの確かめとしてそのまま通る。
- `speech-streamer.test.mjs` の「入口の検査」(`channel: { sendSpeech() {} }` で投げる)は、「渡すなら 3 つの口が要る」を残したのでそのまま通る。
- `replyLatencyUsageRecord` の `deepEqual`・遅延の通知の形を固定しているテストは、体ありのとき印を付けない形にしたので不変。

## 6. 裁量(設計に無いことを決めた所と理由)

1. **体の値を読む時点**: 持ち回らず、使う時点でいつも `roleHooks.current().body` から読む(`currentBody()`)。発火の受理(`acquireAcceptedFireResources`)・頭に聞くとき(`createSessionProxy` の `hasBody`)・器の URL の差し替え(`applyDesiredFireSettings`)・セッションを作るとき(教え)・器の状態(`channelStatus`)・起動の案内。理由: 耳が止まっている間に `POST /api/role` でロールを替えても古い値が残らない。体はセッションの①(表情の教え)にも効くので、セッションを作ったときの体を `sessionBody` に覚え、今のロールの体と違えば次の Fire の境目で作り直す(ロールの切り替えは前から `sessionContextRevision` で作り直すので、これは Domain E で体だけを編集したときの備え)。orchestrator 側は受理の時点の資源の `body` を 1 発の間ずっと使う(進行中の発話は受理の時点の形を最後まで使う、という既存の snapshot の流儀)。
2. **「体なし」の表し方**: 運び手には `channel: null` を渡す(器の有無 = 体の有無)。orchestrator の資源には `body: false` を明示して持たせ、`channel` は null に固定する(既定の `options.channel` にも戻らない)。器を渡されても体なしなら使わない。候補 1(何でも受け取る器の代わり)は採っていない。
3. **体なしの口の release**: 運び手は器が無ければ口の release(既定のものも `options.releaseMouth` も)を呼ばない(口が無いので `speech.mouth.released` も出さない)。orchestrator の `releaseMouth` / `streamReleaseMouth` も体なしなら黙る(stop を持たない speak の返りの経路でも `…MouthCloseError` を出さない)。
4. **体なしでタグだけの返事**: 空の返事(`fireEmptyReply` の診断)とは数えず、`{ fired: false, reason: "expression-only", expressed: false, expressions: [] }` で静かに畳む(speaking にしない・soul に積まない)。理由: 設計 §4 の「表情のタグは剥がして捨てる(診断は出さない)」を、タグから生じる診断を出さないと読んだ。頭には表情の教えを渡さないので、ふつうは起きない。
5. **未知タグ・壊れタグの診断(`expressionUnknownTag` / `expressionBrokenTag`)は体なしでも今どおり出す**: 体の有無ではなく返事の形の知らせ(声に出なかった文字がある)なので。捨てるのは 6 語の表情タグの適用だけ。
6. **遅延の印の形**: 体なしのときだけ `bodyless: true` を足し、体ありのときはキーを足さない(orchestrator の `onLatency`・SSE "latency"・`onReplyLatency`・session-usage の 1 行・`llm.response.parsed` / `speech.playback.activated` の trace)。理由: 「体があるときの記録の形は変えない」を文字どおり守るため(既存の `deepEqual` も不変)。ターミナルの遅延の 1 行は末尾に ` body=none`。
7. **器の状態の表示**: `channelStatus()` に `body`(true / false)を足し、`channelStatusView` は `body: false` なら「体なし」(className `channel-status bodyless`。色の CSS は足していないので既定の muted)。設定の器の URL 欄は今のまま(Domain E)。URL が入っていても体なしなら「体なし」と出す(器を使わないので、未設定や error を問題として見せない)。
8. **体なしの発火の metadata**: `configuration.channelUrl` は null、`metadata.channelConnectionGeneration` は null(器につながないので世代を予約しない)。`channelRevision` は今どおり載せる。
9. **器の URL の差し替え**: 体なしの間は `lazyChannel.setUrl` をしない(`appliedChannelRevision` も進めない)。体のあるロールに戻った最初の Fire の境目で効く。
10. **会話指示の編集画面に見せる教え**: ①に足すものと同じく、今のロールの体に合わせて `expression` を出さない(`createConversationInstructionHooks` の第 4 引数)。画面のコードは変えていない。
11. **起動の案内**: 今のロールが体なしなら「ロール <id> は体なし — 器(Channel)にはつながず、手元の再生器だけで声を出します(表情タグは使いません)」の 1 行。体ありは今の 2 通りの文面のまま。`--channel` を渡したときの起動時のセッションの先充填は体の有無に関わらず今どおり。
12. **`fire-orchestrator` の `options.body`**: `acquireFireResources` を使わない経路(テスト・既定)のための既定値として足した(本番は受理の資源の `body` が勝つ)。`FIRE_SYSTEM_PROMPT`(モジュールの定数)は体を知らないので今のまま(本番の①は `buildRoleSessionSystemPrompt` で作る)。

## 7. 持ち越し

- **Domain D(場)**: 「配信を始める」で体があれば器につなぐ(つながらなければ場を開かない)ときは、`resolveFireChannel` と同じく `roleHooks.current().body` を見る。体なしは何もしない。場の終わりで器(`lazyChannel.close()`)を畳むのは体ありのときだけでよい(体なしは接続していない)。`--channel` 起動の先充填と案内の文面は場の始まりへ寄せるときに見直す。
- **Domain E(画面)**: ロールの編集で体を切り替えたとき、追加の配線は要らない(体は使う時点で読み、セッションは `sessionBody` の違いで次の Fire の境目に作り直す)。ただし編集 API が `sessionContextRevision` を進めるかどうかは E で決めてよい。器の URL 欄を体があるときだけ出す件は `state.channel.body`(または `state.role.body`)が使える。`.channel-status.bodyless` の色は必要なら styles で足す。
- **仕上げ**: `scripts/cockpit.mjs` の HELP の `--channel` の説明(「URL を入力すれば Fire が有効化される」)は体ありの話のまま。README の Channel の記述も同様。
- **人間ゲート**: 計画 §6 の 4(体を「使わない」にして「配信を始める」→ 体なしでしゃべる・割り込みも効く)で、(1) runtime-player を起動していなくても声が出る、(2) 割り込みで声に出た分が soul の行に正しく残る、(3) 表情タグが声に出ない・診断のゴースト行が出ない、(4) 設定の器の状態が「体なし」、(5) ターミナルの遅延の行の末尾に `body=none` が付き、「声」の区間が体ありより短い(器の往復が無い)ことを見てほしい。体のロールを替えた直後の最初の Fire でセッションが作り直される(①の教えが替わる)。

## 8. 質問

なし(判断の分岐は §6 の裁量に書いた。特に 4 のタグだけの返事の扱いと、6 の印を体なしのときだけ付ける形は、別の扱いを望むなら教えてほしい)。
