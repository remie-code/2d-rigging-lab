# 配信の組み直し 全体の突き合わせ レビュー

Review-Sylph → Orch-Sylph(2026-10-31)。対象: ブランチ `ai-cohost/stream-restructure` の `git diff 719c6edb..1a585775`(主に `apps/soul/agent/`)。見たのはドメインの間のつなぎ目。読み取り専任で、ソースもテストも直していない。

根拠: 計画 [../../orchestration/stream-restructure-wave-plan.md](../../orchestration/stream-restructure-wave-plan.md)(Status・§1・§4・§5)、設計 [../../../architecture/stream-restructure.md](../../../architecture/stream-restructure.md)、scope §18〜§20、体験の素描、domain-a〜e の報告とレビューの持ち越し。

## 1. 判定

**pass**(止めた指摘 0 件)。

計画 §4 の 4 つの止める基準(設計とのずれ・今の配信が壊れる・約束のテストが足りない・守りの決まり違反)のどれにも、根拠を出せる指摘は無かった。YouTube の自動接続・`/api/verbosity` と `/api/speak-start` の 409・`closeStream` が例外のときの最後の保存の 3 つは、Undine が仕上げで直すと決めた既知の点なので、ここでは重ねて止めない(§4 で「既知」と触れるだけにした)。設計に書いていない分岐が 2 つあり、§6 で Undine に上げる。

## 2. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | 自分で実行。**1867 tests / 1867 pass / 0 fail / 0 cancelled / 0 skipped**(基準 1867 と同じ) |
| 根で `pnpm run check:soul-zone` | pass(1565 source files scanned、器→魂・魂→器の違反なし) |
| 依存・lockfile | `git diff --name-only 719c6edb..1a585775 -- '*package.json' pnpm-lock.yaml` は空。変更なし |
| 実データ | 開いていない。テストの実行の後に存在と更新日時だけを確かめた: `roles/` は無い。`memories/` は 10/28、`memories/.git` は 10/29、`cockpit-settings.local.json` は 10/29、`tmp/restructure-backups/` は無い。テストは実データに触れていない |
| git の無視 | `git check-ignore -v`: `roles/x/role.json` は `.gitignore:66 /roles/`、`memories/chappy/a.md` は `:41 memories/`、`memories.migrating-1/` は `:72`、`tmp/restructure-backups/…` は根の `.gitignore:19 tmp/` で無視される |

## 3. 見る点 1〜7

### 1. 場の始まり(`openStream`)でロール・体・記憶の置き場・頭のセッションが正しく使われるか — 適合

- 順番は設計 §3 の 1〜7 と同じ(`cockpit-server.mjs:1771-1838`)。phase を `opening` にする(ロールを固める。`/api/role`・`/api/role/edit`・`/api/role/new`・性格の指示の PUT/DELETE は `streamPhase !== "closed"` で 409)→ `renewRecords` → KILL を OFF にして `revive`・判定・発火の予定・思い出しの係を作り直す → `startEars`(`onEarsStarted` が目と声の出口を起こす)→ `openSession` → `connectBody` → YouTube。
- **記憶の置き場**: `renewRecords`(`scripts/cockpit.mjs:999-1006`)が `memoryPlaces.beginStream` で置き場の控えを消し、そこで `place()` を今のロールで作り直して `ready`(git init と種)を待つ。保存(`createMemoryRecorder` の `getPlace`)と思い出し(`recallRunner`)は、どちらもその時点のロールの置き場を使う。場の間はロールが固まっているので、置き場は場の途中で替わらない。
- **頭のセッション**: `openStreamSession`(`cockpit.mjs:2465`)は、前のセッションを畳んでから `ensureSession` を呼ぶ。`ensureSession`(`:2384-2440`)は、作るその時に `currentBrain`、`getCurrentRoleIdentity()`(`:2390`)、`getProfile(roleHooks.currentId()).body`(`:2418`)、`currentBody()`(`:2394`、体なしなら表情の教えを渡さない)を読む。
- **ロールの編集 → 次の場**: `onRoleEdited`(`:2679`)が `currentBrain`・`desiredTtsEngine` を新しいロールに揃え、`sessionContextRevision` を進める。サーバの側は `/api/role/edit` で `applyRoleResult`(`cockpit-server.mjs:2433`)が口数・話し始め・声の方式を受け取る。`openStream` はいつもセッションを作り直すので、revision の比べ方に関わらず、編集した名前・モデル・性格・体は次の場で効く。声は `voiceKey`(`roleVoice()`)で、話者や声の id が替われば `prepare` で作り直す。口数は、畳んだ発火の予定に `setVerbosity` で入れ、次の `renewFireScheduler` が引き継ぐ。話し始めは `makeFireScheduler` が作るときに `speakStartMode` を読む。hotwords は Start のたびに `localSttSettings` から、whisper の手がかりは発話のたびに読む。
- **声の方式の書き戻し**: `startEars` が `onSetTtsEngine(voiceKind)` で、サーバの `ttsEngine` を今のロールに書き戻す(`cockpit-server.mjs:1297-1305`)。ロールの選択・編集・新規のどれでも `applyRoleResult` がサーバの値を揃えるので、古い値で上書きすることは無い。
- テスト: `cockpit-stream.test.mjs:314・363・1079`、`cockpit-role-edit.test.mjs:238`(本物の server と本物の `createRoleHooks`)、`:350`(main の結線。ソースの文字列の照合)。main の中の `ensureSession` は文字列の照合でしか見られないので、人間ゲートの 4 で確かめる(§7)。

### 2. Ctrl+C の道と「配信を終える」の道が同じか — 適合

- 画面の「配信を終える」は `POST /api/stream/stop` → `handleStreamStop` → `closeStream`(`cockpit-server.mjs:1841`)。Ctrl+C と stdin の EOF は `createCockpitShutdown`(`cockpit.mjs:2092-2120`)→ phase が closed でなければ `server.endStream()` → `endStreamForShutdown`(`cockpit-server.mjs:1884-1894`。開きかけ・閉じかけなら終わるのを待ち、open なら同じ `closeStream`)。別の道は残っていない。
- 記憶の最後の保存: `closeStream` は写し → `foldStream` → `saveFinal`(`:1855`)の順。`saveFinal`(`cockpit.mjs:1040-1046`)は転写が増えていれば `record` を頼み、上限つきで待つ。この間 phase は `closing`(画面の「記録中」)。もう一度の Ctrl+C で待ちを打ち切れる。`record` は reject しない(`runOnce` が握る)ので、待たずに返る分岐でも未処理の reject は出ない。
- 場が閉じているときの Ctrl+C: 保存は頼まない。`server.close()` → 走っている保存だけを上限つきで待つ(`:2113`)→ `disposeRest`。テスト `cockpit-stream.test.mjs:902・920・935・953・1159`。
- D の持ち越し 4(`endStream` が投げると `disposeRest` を飛ばす)は、E の try/catch で `closeStream` と `endStreamForShutdown` が投げなくなったので、実際には起きない。
- 既知 (c): `closeStream` の中で想定外の例外が出たとき、`saveFinal` を飛ばす(`:1856-1864`)。仕上げで直すと決まっているので、ここでは止めない。

### 3. 起動時の引っ越しの流れの全体 — 適合

- `main()` は、設定ストアを作る前に `runStartupMigration` を 1 回呼ぶ(`cockpit.mjs:2156-2168`)。設定の分(`roles/` が無いときだけ)と記憶の分(直下に記録があって `memories/chappy/` が無いときだけ)は、条件を混ぜずに順に判定する(`role-migration.mjs:265-269`)。写しのフォルダはこの起動で 1 つにし、両方をそこに置く。
- 移す前の写し: 設定は `COPYFILE_EXCL` でロールを書く前に取る(A のレビューで確認済み)。記憶は `backupMemories` で `.git` ごと写し、失敗したら移さない(`memory-migration.mjs:180-183・200-211`)。続きの処理でも写しを取り直す。
- 2 回目は何もしない: `role-migration.test.mjs:157`、`memory-migration.test.mjs:131`。写しも取らない。
- 失敗したとき: `available: startupMigration.memories.status !== "failed"`(`cockpit.mjs:2284`)で `place()` と `placeInfo()` が null を返す。保存と思い出しは投げて警告になるだけで、配信は止めない。`DEFAULT_MEMORY_DIR` を使うのは引っ越しと置き場の根だけ(`prepareMemoryFolder` も `commitMemoryChanges` も `dir` を省けない)なので、記憶の根を読み書きする道は無い。上の帯の警告は `startupWarnings: startupMigrationWarnings(startupMigration)`(`:2976`、テスト `cockpit-role-edit.test.mjs:319`)。結果の行はターミナルとログのタブに出る。
- 引っ越しの後: 移した `memories/chappy/` には `_conventions.md` があるので、種は書かない(一字も変わらない)。新しいロールのフォルダだけが、最初の「配信を始める」の `renewRecords` で、種の「チャッピー」をそのロールの呼び名に差し替えて書く。

### 4. 体なしの道 — 適合

- 器の URL を確かめるのは体があるときだけ: `connectBody`(`cockpit.mjs:1015-1024`)、受理の `resolveFireChannel`(`:397-402・2589`)、`createSessionProxy` の `hasBody`。
- 表情タグ: 受理の時点の `body` を orchestrator が受け、剥がして捨てる。適用の診断は出さない(`fire-orchestrator.mjs:619-` と `:1036-1045`)。表情の教えは、セッションを作るときに `soulSkillNamesForBody` で外す。
- `bodyless` の記録: orchestrator(`:521`)→ サーバの遅延の放送(`cockpit-server.mjs:2725`)→ ターミナルの 1 行 `body=none`(`cockpit.mjs:2069`)と、頭の文脈の記録(`session-usage-log.mjs`)。
- 割り込みの数え方は、時間割と再生器の STARTED から求める。C のテストで固定してある。
- 場の終わりの器の close は、体の有無に関わらず行う: `foldStream` の最後で無条件に `closeBody`(`cockpit-server.mjs:1709`)、テスト `cockpit-stream.test.mjs:839`。体ありで場を開けなかったときも畳む(`:498`)。

### 5. `openStream` で耳などを起こしたあとの例外の畳み — 適合(テストは持ち越し)

ソースで追った:
- 予定どおりの失敗: 耳の前(`renewRecords`)と耳の失敗では、まだ何も起こしていないので `fail(…, {})`。`startEars` は自分の失敗を畳んで返し、`onEarsStarted` は呼ばれない。耳の後(`openSession`・`connectBody`)では `fail(…, { ears: true, session: true })`(`:1810・1813`)。
- 想定外の例外は、どこで出ても catch で `fail(…, { ears: true, session: true })`(`:1822-1827`)。`foldStream` は判定・発火の予定・思い出しの係を畳み、鳴っていれば `kill` し、`stopEars`(`onEarsStopped` で目を止める)、`closeSession`、`closeBody` を順に呼ぶ。`stopEars` は耳が無くても安全で、`closeSession` と `closeBody` は冪等で握るので、耳の前の例外でも後の例外でも畳み残しは出ない。
- 畳まないもの: (a) 場を開く前に Connect してあった YouTube は `chat: false` で残す。`openStream` がつないだものではないので、筋は通る。(b) 声の再生器と engine。`closeStream` でも畳まない(D の裁量 7)ので、扱いは揃っている。
- テスト: 想定外の例外は耳の前(工場関数)だけ(`cockpit-server-domain-e.test.mjs:294`)。耳の後の畳みは、予定どおりの失敗の道(器につながらない、`cockpit-stream.test.mjs:498`)で見ていて、同じ `fail` に同じ印を渡す。耳の後の想定外の例外を直接見るテストは無い(§5 の持ち越し 1)。

### 6. 守りの違反 — 違反なし

- 鍵: 差分の中の `process.env` は、テストで `GIT_*` を落とすための写し(`memory-migration.test.mjs`)と、前からある Claude の env ガードだけ。`.env*.local` を読む新しい道は無い。ElevenLabs のキーは前からの Start ごとのコード内の読み口のまま。テストのキーは fake。
- 文面: `conventions-seed.md`・`skills/`・`recall.mjs`(④)・`speak-now*.mjs`・`comment-guard.mjs`・`comment-react.mjs` は差分なし。`mind/memory.mjs`(②)の差分は `dir` を必須にしただけで、指示の文面は変えていない。種の名前の差し替えは書き出す中身だけで、種のファイルそのものは読むだけ。
- 引っ越しの前の写し: §3 のとおり。
- 実データ: テストが `DEFAULT_*` を参照するのは、パスの形を確かめる assert と、`dir` を省くと失敗することの確かめだけ。テストの実行の後も実データの日時は変わらず、`roles/` もできていない。
- 本物の LLM や API: 新しいテストは fake の頭・耳・器・判定・②、一時フォルダ、ループバックの HTTP だけを使う。

### 7. その他のつなぎ目

- **phase と 409 の揃い**: 閉じていなければ 409 になるのは role・role/edit・role/new・性格の指示の書き込み・stream/start。開いていなければ 409 になるのは fire・vision-fire・memory-record。stream/stop は、閉じていれば何もしない 200、途中なら 409。閉じかけの間も揃っている。既知 (b): `/api/verbosity` と `/api/speak-start` は今いつでも通る(仕上げで直す)。
- **YouTube の自動接続**: 今は `keepPreconnectedChat()` が戻り値を捨てる実質何もしない関数(`:1720`)で、前もって Connect したものだけが場に残る。既知 (a): 仕上げで「この起動で入れた、または Connect した URL はつなぐ」に直す。
- **KILL の状態**: 場の終わりに考えている最中なら `kill()` を呼び、orchestrator の中は kill 済みのまま閉じる。閉じている間の手動の Fire は E で 409 になったので、D の持ち越し 2 の「状況で変わる振る舞い」はもう表に出ない。次の場の始まりで `revive` する。
- **`/api/ears/start` の別名**: body の `ttsEngine` が今のロールに書き戻される(E の持ち越し、後方互換)。画面はこれを使わない。
- 見つけた分岐 2 つ(器の URL を場の途中で変えられる、開きかけの間の自発の発火)は §6 に書いた。

## 4. 止めた指摘

なし。

既知(仕上げで直すと決まっている。重ねて止めない):
- (a) YouTube の自動接続(`cockpit-server.mjs:1720・1815`)。
- (b) `/api/verbosity`・`/api/speak-start` は場が閉じていなければ 409 にする(`cockpit-server.mjs:2243・2270`。今は phase を見ていない)。
- (c) `closeStream` で想定外の例外が出ても、最後の保存がまだなら 1 回だけ頼む(`:1856-1864`)。
- README・HELP・JSDoc の古い記述(A の持ち越し 4、D の持ち越し 7、E の持ち越し 2・3)。

## 5. 持ち越し(止めない)

1. **耳の後の想定外の例外を直接見るテストが無い**(見る点 5)。【仕上げで済む】たとえば `startServer` に、耳の Start の後に投げる fake(2 回目の `makeRecallDesk` は耳の前なので、`nowImpl` の 2 回目の呼び出しで投げる形など)を入れて、`ears.record.disposed`・`closeSession`・`closeBody` が呼ばれ、`phase` が `closed` になり、もう一度始められることを見る。コードの道は予定どおりの失敗と同じ `fail` なので、今の害は無い。
2. **閉じかけの間の YouTube の Connect**: `/api/chat/connect` は phase を見ないので、閉じかけの間(`foldChatClient` の後)に押すと器官が場の外に残り、次の場にそのまま持ち込まれる。害は小さい(閉じている間のコメントは「耳が無い」の行になるだけ)。(a) の直しと一緒に「閉じかけは断る」にするかを決めるとよい。【仕上げで済む】
3. **`keepPreconnectedChat()` の呼び出し**(E の持ち越し 4)。(a) の直しで中身が入るはず。【仕上げで済む】
4. **main の結線のテストはソースの文字列の照合**(D・E と同じ)。`ensureSession` が作るときに今のロールを読むことは、文字列の照合と人間ゲートでしか確かめられない。
5. **ロールの引っ越しだけが失敗し、記憶の引っ越しが成功した起動**: 既定のロール(手元だけ)で動き、記憶はそのロールの id のフォルダに新しく作られる。移したチャッピーの記憶は `memories/chappy/` に残るので失われないが、その起動の記録はチャッピーの記憶に入らない。上の帯に「ロールへの引っ越しに失敗した」が出るので、気づける。起きにくい組み合わせ。

## 6. Undine に上げる分岐

設計に書いていない判断の分岐が 2 つある。どちらも今の害は小さいので止めない。

1. **器(Channel)の URL を、場が開いている間に変えられる**。設計 §3(計画 Domain D)は、場の途中で変えられないもの(ロール・マイク・文字起こし)と、触れるもの(YouTube の URL と Connect・ゲームの窓)を挙げているが、器の URL はどちらにも無い。今は `/api/channel` が phase を見ず、設定のダイアログの欄(`settings-drawer.mjs:953-963`)も固まらない。体のあるロールなら、次の発火の境目で新しい URL に張り直す(`applyDesiredFireSettings`)。つながらなければ、場は開いたまま発火だけが失敗する。決めること: 「場が開いている間は器の URL を固める(マイクと同じ)」か、「触れる(張り直しは次の発火から)」か。
2. **開きかけの間の自発の発火**: `startEars` が済んでから `connectBody` が終わるまでの間、耳はもう聞いていて、speak-now やコメント反応の判定は新しい部品で動く。`requestSelfFire` は phase を見ないので、器につながる前に返事が始まりうる。器につながらずに場が開かなかった場合は、`foldStream` の `kill` がその返事を止める。手動の Fire は open 以外を断るので、扱いが揃っていない。ふつうはつながるかどうかがすぐ決まり、窓は短い。決めること: 「open になるまで自発の発火は頼まない(判定の結果を捨てる)」か、「今のまま」か。

## 7. 人間ゲートで確かめる点

計画 §6 の 1〜6 に、つなぎ目の分として次を足す。

- 1(引っ越し)のとき、ターミナルとログのタブに「使った指示・記録 N 件・写しの置き場(`tmp/restructure-backups/restructure-<日時>/`)」が 1 回だけ出る。写しのフォルダに `cockpit-settings.local.json` と `memories/` の両方がある。2 回目の起動では何も出ず、写しも増えない。
- 4(体なし)の前に、ロールのタブで名前・モデル・性格の指示・体を直して保存 → 「配信を始める」で、新しい名前・指示で答える。名前や話者を変えたら、その声で鳴る。ターミナルの遅延の行に `body=none` が出る。
- 5(終える)は、画面の「配信を終える」と Ctrl+C の両方で、上の帯の状態のピルが「記録中」になり、`memories/chappy/` の git にコミットが 1 つ積まれる。場が閉じている間の Ctrl+C では、記録の行が出ずにすぐ終わる。
- runtime-player 無しで始めて断られた直後に、起動して押し直すと開く(器・耳・頭のセッションの畳み残しが無いこと。ターミナルに二重の起動の警告が出ない)。
- 新しいロールを作って最初の「配信を始める」→ `memories/<新しい id>/_conventions.md` ができていて、呼び名が新しいロールの名前になっている(チャッピーの `_conventions.md` は変わらない)。
- 場を終えた後に ElevenLabs の声の接続が残るか(D の持ち越し 8(d))。前の配信の YouTube の URL が欄に残っているときの見え方(既知 (a) の直しの後で)。

## 8. 質問

1. §6 の 2 つの分岐は、仕上げの範囲に入れるか、人間ゲートの後に回すか(Undine の判断)。
2. 持ち越し 1 のテスト(耳の後の想定外の例外)を、仕上げの (c) の直しと一緒に足すか。(c) の直しで `closeStream` の例外の道にもテストが要るので、まとめて足すと手間が少ない。
