# 配信の組み直し 仕上げ(Gnome)

Gnome → Orch-Sylph(2026-10-31)。ブランチ `ai-cohost/stream-restructure`(HEAD 1a585775 の上に作業ツリーの変更として。コミットはしていない)。

根拠: 計画 [../../orchestration/stream-restructure-wave-plan.md](../../orchestration/stream-restructure-wave-plan.md)(Status の E の行の Undine の追認)、設計 [../../../architecture/stream-restructure.md](../../../architecture/stream-restructure.md) §3、体験の素描の場面 3 と注記、全体の突き合わせ [../../reviews/stream-restructure/final.md](../../reviews/stream-restructure/final.md)。

## 1. やったこと

### 1. YouTube の自動接続(この起動で入れた・Connect した URL はつなぐ。前回の起動から欄に残っているだけの URL はつながない)

- サーバ(`src/cockpit/cockpit-server.mjs`):
  - `chatSourceThisBoot`(この起動で入れた source)を持つ。入るのは (a) 新しい `POST /api/chat/source`(欄に入れた値の保存。つなぎはしない)、(b) Connect(`connectChat`)の 2 つだけ。起動時に設定から読み戻した前回の値(`chatSourceStatus`)は入らない。
  - `POST /api/chat/source` `{ source: string | null }`: trim して保存(`onSetChatSource`)し、覚える。空または null は「つながない」(保存した値も消す・覚えたことも消す)。文字列でも null でもなければ 400 で何も変えない。場のどの状態でも通す(欄は場の間も触れる、設計 §3 の 7)。
  - `POST /api/chat/disconnect` は覚えたことを消す(自分で切ったものを次の場で勝手につなぎ直さない)。
  - `keepPreconnectedChat()` を `startChatForStream()` に替えた(始める 7): 器官があればそのまま持ち込む(作り直さない)→ 無ければ覚えた source へ `connectChat` → 生成や start が投げたら器官を畳み、ログのタブに 1 行(`chatDiagnostic` の `internalError`、「配信を始めるときに YouTube につなげなかった(…・Connect でつなぎ直せる)」)を出して、場は開く。
  - snapshot の `chat` に `enteredThisBoot`(boolean)を足した(additive)。
- 画面(`ui/settings-drawer.mjs`、`view-logic/status.mjs`、`view-logic/settings.mjs`):
  - YouTube の欄の `change`(入れ終えて欄を離れた・Enter)で `POST /api/chat/source`。ダイアログの「配信を始める」は、走っている保存が済んでから `/api/stream/start` を頼む(入れてすぐ押しても、サーバがこの起動で入れた URL を知っている順にする)。
  - 欄の下に案内 `chatAutoConnectHint`(場が閉じていて、つながっていないときだけ): この起動で入れた → 「配信を始めるとつなぐ」、前回の値が残っているだけ → 「前回の URL(自動ではつながない。今日の URL を入れるか Connect を押す)」。
  - `chatSourceSaveErrorText`、`requestErrorText("chatSource")` を足した。
- テスト(`scripts/cockpit-stream.test.mjs`、本物の server と本物の場の口):
  - 「配信を始める: 前回の起動から欄に残っているだけの YouTube の URL(保存値の読み込みだけ)にはつなぎにいかない(配信の組み直し 仕上げ)」 — 保存値だけ → つながない
  - 「配信を始める: この起動で入れた(POST /api/chat/source で保存した)YouTube の URL へ、始めるでつなぐ(器のあと・Connect は要らない)」 — この起動で入れた URL → つなぐ(器のあとの順も見る)
  - 「配信を始める: YouTube の URL が無ければつながない・場を開く前に Connect 済みならそのまま(作り直さない)」(既存のまま通る) — Connect 済み → そのまま
  - 「配信を始める: この起動で入れた YouTube の URL につながらなくても場は開く(器官は畳む・Connect でつなぎ直せる)」 — つながらなくても開く
  - 「配信を始める: 終えたあと次の場でも、この起動で入れた・Connect した URL ならまたつなぐ(新しい器官)。欄を空にして保存したら・Disconnect したらつながない」
  - 「POST /api/chat/source: 文字列か null だけ受ける(それ以外は 400 で何も変えない)・null は消す・場の途中でも保存できる(つなぎはしない)」
  - `cockpit-ui-settings.test.mjs`: 「配信の準備: YouTube の欄は離れたら保存する(POST /api/chat/source)・「配信を始める」は保存が済んでから頼む・欄の下に案内(配信の組み直し 仕上げ)」「chatAutoConnectHint: …」「chatConnectErrorText は 409 … ・chatSourceSaveErrorText は失敗だけ文言にする」

### 2. `/api/verbosity`・`/api/speak-start` は場が閉じていなければ 409

- 条件と返し方は `/api/role/edit` と同じ: `streamPhase !== "closed"`(開きかけ・開いている・閉じかけ)で `409 { error, state }`、何も変えず永続化も呼ばない。順も `/api/role/edit` と同じ(未注入の 503 → body を読む → 409 → 中身の 400)。
- 画面の側: この 2 つを叩く所は無い(grep で確認。口数・話し始めはロールのタブの編集の select で、`POST /api/role/edit` を通り、場の途中は `roleInputsDisabled` で押せない)。直しは要らなかった。
- テスト: `cockpit-server-domain-e.test.mjs`「POST /api/verbosity・/api/speak-start: 場が閉じていない間(開いている・閉じかけ)は 409 で何も変えない(永続化も呼ばない)・閉じていれば通る」。

### 3. `closeStream` で想定外の例外が出ても、最後の保存がまだなら 1 回だけ頼む

- `closeStream`: 写し(`transcript`)と「最後の保存を頼んだか」(`finalSaveRequested`、`saveFinal` を引く直前に立てる)を持つ。catch で、写しが取れていなければ耳が残っていればもう一度だけ写しを試し(取れなければ空)、畳み残しを畳み直してから、まだ頼んでいなければ 1 回だけ `saveFinal` を頼む。どの道でも最後に `closed` に戻す(今までどおり)。
- `foldStream` を段ごとに握る形にした: 1 つの段が投げても残りの段(耳・頭のセッション・器)を畳み、全部畳んだあとで最初の例外を投げ直す(呼び出し側は今までどおり「想定外のエラー」として扱う)。今までは段の途中で投げると後ろの段が畳まれず、畳み直しも同じ所で止まっていた。
- テスト(`cockpit-server-domain-e.test.mjs`):
  - 「配信を終える: 畳む途中で想定外の例外が出ても、記憶の最後の保存を 1 回だけ(その場の写しで)頼み、残りも畳んで closed に戻る・もう一度始められる」
  - 「配信を終える: 最後の保存を頼んだあとで投げても二度は頼まない・写しが取れずに投げたら空で 1 回だけ頼む・どちらも closed に戻る」

### 4. 古い記述を今の形に

- `apps/soul/README.md`: S2.5(耳 start/stop → 場の API)、S3(Channel 欄・`--channel`・先充填)、S7(「マイクを Start してから Connect」)、多頭化(`POST /api/brain`・「頭脳」区画、第三の頭の手引きの 4)、配信間記憶(`memories/*.md`)に「※ 配信の組み直し…」の注記を足し、最後に「配信の組み直し: ロール・場・体なしの口(2026-10-31)」の節(ロール・場・体なし・記憶・起動時の引っ越し・画面)を足した。古い節は当時の記録として残した。
- `scripts/cockpit.mjs`: `--channel` の HELP(器の欄は「準備・設定」→「配信の準備」、体があるときだけ、起動時には何もつながない、体のないロールでは使わない)。頭の JSDoc(Start → 配信を始める、今の形の要約の節、eager 生成・lazy connect の節に「当時」の注記)。`createChatSourceHooks` の注記。
- `src/cockpit/view-logic/settings.mjs`: 頭の注記(5 タブ・旧タブ)、`earsStartFailureText`、圧縮・Codex の fast の置き場、文字起こし・声の方式の選択肢の注記(声の方式はロールの編集の select が使う)。
- `src/cockpit/cockpit-server.mjs`: `TTS_ENGINES`、`localSttModelCheck`・`localSttSettings`・`sttEngineInitial`・`onSetSttEngine`・`elevenLabsApiKeyProvider`・`ttsEngineInitial`・`onSetTtsEngine`・`onSetChatSource`・`chatSourceStatus` の JSDoc、圧縮・fast の snapshot の注記、`startEars` の 2 か所の注記、場の流れの頭の注記。
- `src/memory/memory-store.mjs`: 「上位文書」に stream-restructure.md §2.3 と「当時は `memories/` 直下、今は `memories/<role-id>/`」の注記。
- `discussion/ai-cohost/memory/recall-flow.md`: §2 に注記を足し、`memories/_map.md`・`memories/<topic>/_map.md`・`memories/_conventions.md` を `memories/<role-id>/…` に。§7 の「今ある 8 件の移し替え」に当時の置き場の注記。②④の指示の文面には触れていない(この文書にはもともと載っていない。説明文だけ)。

### 5. 全体の突き合わせの持ち越し

- 持ち越し 1(耳の後の想定外の例外の直接テスト): 「配信を始める: 耳を起こしたあとの想定外の例外でも、耳・目・頭のセッション・器を畳んで closed + error に戻る・もう一度始められる」を足した。頭のセッションを作る口を引いた瞬間に 1 回だけ投げる偽物(`streamHooks` の getter。`runStreamHook` の try の外 = 想定外の例外)で、耳の破棄・`onEarsStopped`・`closeSession`・`closeBody`・`closed` + `stream.error`・もう一度始められることを見る。コードの変更は無い(今の道が正しいことの確認)。
- 持ち越し 2(閉じかけの間の Connect): `POST /api/chat/connect` は開きかけ・閉じかけの間 409 `{ error: streamBusyMessage(), state }`(何も変えない・覚えたことにもしない)。開きかけも断るのは、始める 7 のつなぎと競らないため。閉じている間・開いている間は今のまま通す。画面は `chatConnectErrorText` が 409 のときサーバの文面(「配信を終えている途中(記録中・少し待ってからもう一度)」など)をそのまま出す。テスト「POST /api/chat/connect: 閉じかけ(記録中)の間は 409 で器官を作らない(場の外に残さない)・開きかけも 409・開いている間は通る」。
- 持ち越し 3: 1 の直しで解けた(`keepPreconnectedChat` は無くなった)。

## 2. 変えたファイル(`apps/soul/agent/` 起点。新規ファイルは無い)

| ファイル | 中身 |
|---|---|
| `src/cockpit/cockpit-server.mjs` | 1・2・3・持ち越し 2・JSDoc |
| `src/cockpit/ui/settings-drawer.mjs` | YouTube の欄の保存・始めるの順・案内 |
| `src/cockpit/view-logic/status.mjs` | `chatAutoConnectHint` と文面の定数 |
| `src/cockpit/view-logic/settings.mjs` | `chatConnectErrorText` の 409・`chatSourceSaveErrorText`・`chatSource` の前置き・JSDoc |
| `scripts/cockpit.mjs` | HELP・頭の JSDoc・注記(動作は不変) |
| `src/memory/memory-store.mjs` | 頭の注記(動作は不変) |
| `scripts/cockpit-stream.test.mjs` | 1 のテスト(1 件を書き換え・4 件を足した) |
| `src/cockpit/cockpit-server-domain-e.test.mjs` | 2・3・持ち越し 1・2 のテスト(5 件を足した) |
| `src/cockpit/cockpit-server.test.mjs` | 仕様変更による 3 件の書き換え(§3) |
| `src/cockpit/cockpit-ui-settings.test.mjs` | 画面のテスト(3 件を足した) |
| `../README.md`(`apps/soul/README.md`) | 4 |
| `discussion/ai-cohost/memory/recall-flow.md`(リポジトリの根から) | 4 |

## 3. 期待値を変えた既存テスト(4 件、どれも仕様変更)

| テスト | 変えたこと | 理由 |
|---|---|---|
| `cockpit-stream`「配信を始める: 保存してある前回の YouTube の URL だけではつなぎにいかない(この起動で場を開く前に Connect したものだけ・配信の組み直し Domain E)」 → 「配信を始める: 前回の起動から欄に残っているだけの YouTube の URL(保存値の読み込みだけ)にはつなぎにいかない(配信の組み直し 仕上げ)」 | 前半(保存値だけではつながない・場の途中の Connect でつながる)は残した。後半の「前の場で Connect した器官は次の場に持ち込まない(次の場は connected: false)」を外した | Undine の言い直し(この起動で Connect した URL はつなぐ)で逆になった。次の場でまたつなぐことは新しいテスト「終えたあと次の場でも…」で見る |
| `cockpit-server`「cockpit POST /api/speak-start: 503(scheduler 無し)・400(無効値)・切替で scheduler のスイッチと永続化フックへ」 | 400 と speak-now への切り替えを場を開く前に、従来への切り替えを「終える → 替える → 始める」に並べ替えた。期待値(判定の数・発火の数・永続化の並び)は不変 | 場の途中の話し始めの変更は 409 になった |
| `cockpit-server`「cockpit speak-now: 口数は問いの性格の 1 文にだけ効く(POST /api/verbosity の後の判定から)」 | 口数の変更の前後に「終える」「始める」を足した。期待値は不変 | 場の途中の口数の変更は 409 になった |
| `cockpit-server`「cockpit コメント反応: 話し始めを従来に切り替えると取っておいたコメントを捨て、反応する判定を呼ばない」 | 場の途中の切り替えが 409 であることの assert を足し、「終える(取っておいた分は畳むときに捨てる) → 従来に替える → 始める」の順にした。最後の期待値(反応する判定を呼ばない)は不変 | 同上 |

## 4. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **1879 tests / 1879 pass / 0 fail / 0 cancelled / 0 skipped**(基準 1867 + 足した 12) |
| 根で `pnpm run check:soul-zone` | pass(1565 source files scanned、器→魂・魂→器の違反なし) |
| 依存・lockfile | 変えていない(`package.json`・lockfile の差分なし) |
| 実データ | 開いていない・書いていない。テストのあとに存在と日時だけ見た: `cockpit-settings.local.json` 10/29、`memories/` 10/28、`roles/` と `tmp/restructure-backups/` は無い。操縦席は実データで起動していない(`--help` を表示しただけ。`main()` は HELP を出して終わる) |
| 鍵 | `.env*.local` は読んでいない |
| 文面 | `_conventions.md`・`conventions-seed.md`・②④の指示・判定の文面・`skills/` は変えていない |

## 5. 裁量で決めたこと

1. **「入れた」を伝える口**: 新しい `POST /api/chat/source`(保存だけ・つながない)を足し、画面は欄の `change`(離れた・Enter)で呼ぶ。メイン画面の「配信を始める」は欄の値を知らないので、入れた時点でサーバに覚えてもらう形にした。
2. **ダイアログの「配信を始める」**は、走っている保存が済んでから頼む(入れてすぐ押した順を守る)。メイン画面の「配信を始める」は欄を離れた時点で保存が始まっているので、待ちは入れていない。
3. **次の場**: 同じ起動の間は、前の場で入れた・Connect した URL へ次の場でもまたつなぐ(器官は作り直す)。「この起動で入れた URL はつなぐ」を素直に読んだ形。
4. **Disconnect** と **欄を空にして保存** は「つながない」(覚えたことを消す)。欄と保存した値は Disconnect ではそのまま。
5. **Connect 済みの器官があれば、そのあと欄に別の URL を入れても持ち込むのは Connect 済みのもの**(作り直さない)。
6. 自動接続は始めるの中で `client.start()` まで待つ(Connect ボタンと同じ `connectChat`)。器官の契約上、notLive / network は中で再試行を予約してすぐ返る。つながらない(投げた)ときは器官を畳み、ログのタブに 1 行、場は開く。
7. 開きかけの間の Connect も 409 にした(持ち越し 2 は閉じかけだけだが、始める 7 のつなぎと競らないため)。`/api/chat/source` と Disconnect はどの状態でも通す。
8. `foldStream` を段ごとに握る形にした(3 の「畳む途中で投げても」を本当に畳み切るため)。最初の例外を投げ直すので、呼び出し側の扱い(500・`stream.error`)は今までどおり。
9. `closeStream` で写しが取れずに投げたときは、耳が残っていればもう一度だけ写しを試し、それでも取れなければ空で保存を頼む(保存の口が空をどう扱うかは cockpit.mjs の `saveFinal` のまま)。
10. 画面に案内(`chatAutoConnectHint`)を足した。文面は §1 の 1。設計にも素描にも案内の文面は無いので、要らなければ外せる(1 行)。
11. README は古い節を消さず「※」の注記と最後の節で今の形を書いた(README は節ごとの経緯の記録になっているため)。

## 6. やらなかったこと

- 全体の突き合わせの持ち越し 4(main の結線のテストが文字列の照合)・持ち越し 5(ロールの引っ越しだけ失敗した起動)。指示どおり手を付けていない。
- Undine に上げる分岐 2 つ(場の間の器の URL の変更、開きかけの間の自発の発火)。手を付けていない。
- README の S2(ローカルの文字起こし)の「次の Start から効く」などの古い言い方は、当時の記録として残した(最後の節で今の形を書いた)。
- `view-logic/control.mjs` の `verbosityPostErrorText`・`speakStartPostErrorText` は 409 を個別に扱っていない(画面から呼ぶ所が無いため)。
- `cockpit-server.mjs` の JSDoc の「耳の Start」という言い方は、内部の `startEars` を指すので残した(「配信を始める」の 4 と添えた所はある)。

## 7. 人間ゲートで確かめる点

- 前回の起動の YouTube の URL が欄に戻っているとき: 欄の下に「前回の URL(自動ではつながない…)」が出て、「配信を始める」でつながない。
- 欄に今日の URL を入れて欄を離れる(または Enter)→ 案内が「配信を始めるとつなぐ」に変わる → ダイアログを閉じてメイン画面の「配信を始める」→ YouTube がつながる(状態が connecting / live)。ダイアログの「配信を始める」を入力の直後に押しても同じ。
- 間違った URL・ネットが無いとき: 場は開き、ログのタブに `(chat: …)` の行が出る。Connect でつなぎ直せる。
- 同じ起動で 2 回目の配信: 前の配信の URL へまたつなぎにいく(YouTube の側で終わっていれば ended の行が出る)。今日の URL を入れ直してから始めれば、そちらへつなぐ。
- 「配信を終える」の記録中に Connect を押すと、「配信を終えている途中(記録中・少し待ってからもう一度)」が出て、つながない。
- 配信の途中は口数・話し始めが替えられない(ロールのタブで押せない)。

## 8. 質問

1. 裁量 3(同じ起動の 2 回目の配信で、前の配信の URL へまたつなぎにいく)でよいか。配信ごとに URL が替わる前提だと、2 回目の配信で今日の URL を入れ忘れると、前の配信の URL へつなぎにいく(害は ended の行が出るだけ)。「終えたら覚えたことを消す」(次の場は入れ直すか Connect)にもできる。
2. 裁量 4(Disconnect で覚えたことを消す)でよいか。
3. 裁量 10 の案内の文面と置き場(YouTube の欄の状態の右)でよいか。
4. 裁量 6: 自動接続を始めるの中で待つ形でよいか。YouTube の最初の取得が遅いと、その分「始めてる」が長くなる(器官の契約では notLive / network はすぐ返る)。待たずに投げっぱなしにもできる。
