# 記憶の整理(③整理役)— コードの棚卸し

> Status: 棚卸し(Sylph、2026-11-04、Undine の委任)。決定ではない。2026-11-04 のユーザーの決定(memory/_map.md §4)を実装する前に、今のコードがどこで何を前提にしているかを揃えるための材料。
> 凡例: **【事実】** コード・テストから読めること / **【推測】** Sylph の読み(確かめていない)。
> パスは断りが無ければ `apps/soul/agent/` からの相対。読んだのはコードとテストだけ。記憶の本体・`roles/` の中身・設定ファイルは読んでいない。テストは走らせていない。

## 1. 年・月の棚にしたとき、壊れる所・誤解を生む所

### 1.1 `src/mind/memory.mjs`(②書き出し役)

| 所 | 今の前提 | 年・月の棚で起きること |
|---|---|---|
| `topicDirs`(memory.mjs:102-111) | 記憶のフォルダの直下の、`.`・`_` で始まらないフォルダ = トピック | 年・月はトピックの下なので、トピックの一覧としてはそのまま動く。ただし直下にトピック以外のフォルダ(索引用など、`_` 始まりでないもの)を③が作れば、それもトピックと数える |
| `resolveStreamRecordBaseName`(memory.mjs:120-141) | 本体は `<topic>/<日付>[-N].md` の直下にある。全トピックの直下だけを見て、同じ日付の最大の番号 +1 を返す | `<topic>/2026/11/` の中は見ないので、棚に移った本体を数えない。③が同じ日の本体を棚に移したあとの場は、番号が `<日付>` から振り直しになり、棚の中の本体と同じ名前になる。決定でこの関数ごと要らなくなる |
| `findStreamRecordFiles`(memory.mjs:148-152) | 今回の本体は `<topic>/<baseName>.md`(直下) | 決まりに従って②が棚に直接書くと、見つけられない |
| `createStreamRecordIdentity`(memory.mjs:160-172) | 最初の保存のときに 1 回だけ名前を決めて、場の間は持ち回る | 決定で要らなくなる。代わりに「最初の保存のコミットで足されたファイル」を持ち回る所が要る(§4) |
| `detectWriterMiss`(memory.mjs:299-304) | 1 回目の保存の書き損じは、「どのトピックの直下にも `<baseName>.md` が無い」で見分ける | 棚に書いた本体・魂が決めない名前を見つけられない。毎回の 1 回目が「書き損じ」と判定されて、やり直しのあと `{ written: false, missing: true }` になる(memory.mjs:467-476)。記録の時刻が進まないので、次の保存がまた「1 回目」扱いになり、②に「まだありません」と頼む(memory.mjs:210)。2 本目の本体ができうる |
| `writeStreamRecord`(memory.mjs:444-452) | 頼む前に `findStreamRecordFiles` で「前回の保存の本体」を集め、`buildWriterRequest` に渡す | 上と同じ理由で、前回の保存の本体を渡せない |
| `buildWriterRequest`(memory.mjs:202-235) | ファイル名の段落(215-218)「このファイル名は魂が決めたもので、`_conventions.md` の `-2` の付け方よりこちらを優先します」。前回分の段落(205-210)は `<topic>/<名前>.md` の一覧 | 決定と食い違う(名前は②の裁量)。前回分の段落は、渡すパスが棚の中のパスになるだけなら形は保てる |
| 頭書きのコメント(memory.mjs:12-15・26-27) | 「魂がここで知っている置き場の形は `<topic>/<ファイル名>.md` だけ」 | 古い説明になる |

### 1.2 ほかの所(`src/`・`scripts/`)

- **`scripts/cockpit.mjs` の `createRoleMemoryPlaces`**(cockpit.mjs:986-1057): 置き場ごとに `streamRecord: createIdentityImpl({ dir, startedAtMs })` を持つ(cockpit.mjs:1027)。場の始まり(`beginStream`、cockpit.mjs:1050-1054)で作り直す。保存は `place.streamRecord.get()` を `writeStreamRecord` に渡す(cockpit.mjs:3208-3211)。名前を魂が決めなくなると、ここは「この場で足されたファイル」を持つ所に変わる。
- **④思い出し役**(src/mind/recall.mjs): ファイルを並べない。たどり方は文面だけ。「全体の目次 `_map.md` → トピックの目次 → 本体」(recall.mjs:123)。目次の形をチャッピーに任せても、トピックの目次がある限り文面は正しい。目次をトピックごとでなく月ごとなどにすると、この文面と食い違う。`recall-desk.mjs` と `skills/*.md` に置き場の形の前提は無い(grep で `_map`・`トピック`・`目次`・`本体` が出ない)。
- **`src/memory/memory-store.mjs`**: 置き場の形を知らない(memory-store.mjs:23-24)。コミットは `status --porcelain --untracked-files=all` → `add --all` → `commit`(memory-store.mjs:311-323)なので、移しもそのまま 1 つのコミットに入る。ただし `readCommitAddedLines` は `--no-renames`(memory-store.mjs:408)。③のコミットを同じ化けの確かめにかけると、移した本体は全行が「足された行」になる(§4)。
- **`src/memory/memory-migration.mjs`**: 根の直下だけを見る(`inspectMemoryRoot`、memory-migration.mjs:75-82)。件数は再帰で数える(`countMemoryRecords`、memory-migration.mjs:90-101)。棚でも壊れない。
- **種 `src/memory/conventions-seed.md`**: §2 の形は直下(conventions-seed.md:13-19)。名前の決まりは「同じ日付が既にあれば次の番号」(:24)。整理役は「(今はまだいません)」(:8)。§5 は「書き出し役は…ほかの日の本体は変更・削除しません」(:42)。新しいロールのフォルダにだけ置かれる(memory-store.mjs:241-248)。チャッピーの実物は書き換えない(既にあるので)。
- **操縦席**: 記憶のファイルを並べる画面も API も無い。記憶のタブは置き場の札・「今日を記録」・「最後に記録: HH:MM:SS(記録中…)」だけ(src/cockpit/ui/settings-drawer.mjs:1488-1502、view-logic/settings.mjs:228-232)。サーバが返すのは `memoryStatus()` の `{ lastRecordAtMs, recording, available, roleId, roleName, dir }`(cockpit.mjs:3299-3308、cockpit-server.mjs:1600)。棚で壊れる所は無い。
- **`_map.md` を読むコード**: 無い。出てくるのは②④への文面(memory.mjs:223、recall.mjs:123)と、引っ越しの「根の直下に `.md` があるか」(memory-migration.mjs:12・75-78)だけ。

### 1.3 テスト(直下の形・魂の決める名前を前提にしているもの)

- `src/mind/memory.test.mjs`
  - :103-155: `resolveStreamRecordBaseName`・`findStreamRecordFiles`・`createStreamRecordIdentity` そのもの。
  - :166-192: `buildWriterRequest` の「本体のファイル名」「どのトピックでもこのファイル名」「すでにあります: topic-a/…」を正規表現で見る。
  - :201-225: 偽物の②は、頼みの文の「本体のファイル名: `…`」を拾って `fake-topic/<名前>` に書く。
  - :253-557: `writeStreamRecord` のテストは、ほぼこの偽物を使う(書き損じの判定 :350-480 を含む)。
- `src/mind/memory-garble.test.mjs:120-141`: 偽物の②が `${topic}/${baseName}.md` に書く。:147-366 の化けのテストがこれを使う。
- `scripts/cockpit-discord-f.test.mjs:51-100`: 同じ日の配信と通話で `-2`・`-3` になる(`createStreamRecordIdentity` → `resolveStreamRecordBaseName`)。
- `scripts/cockpit-stream.test.mjs:372-390`・`:1231-`、`scripts/cockpit.test.mjs:2959-2985`・`:3051-3053`: 場ごと・ロールごとに本体の名前(identity)を作り直す。
- `buildWriterRequest` を `baseName`・`existingFiles` 付きで呼ぶだけのもの(引数の形が変われば呼び方を直す。見ているのは別の行):
  - src/mind/wording-discord-c.test.mjs:120-131・223・237・390
  - src/mind/wording-discord-f.test.mjs:114
  - src/mind/venue-events-discord-j.test.mjs:177
  - src/mind/speaker-shape-discord-a.test.mjs:90
  - src/cockpit/cockpit-server-discord-j.test.mjs:435
- `src/memory/memory-migration.test.mjs`・`src/memory/memory-store.test.mjs:124-141`: `topic/_map.md` などを置くが、形の前提は無い。棚でも壊れない。

## 2. 場を閉じるときの流れ

### 2.1 最後の保存が走る所

- **配信を終える・通話を終える**: どちらも画面から `POST /api/stream/stop`(ui/app.mjs:432。「通話を終える」も中身は場を閉じる道のまま、view-logic/discord.mjs:30-33)→ `handleStreamStop` → `closeStream`(cockpit-server.mjs:3353-3356・3525)。
- **`closeStream`**(cockpit-server.mjs:3043-3101)の手順:
  1. phase を `"closing"` にして画面へ流す(:3046-3047)。
  2. 転写の写しを取る(:3057)。
  3. 器官を畳む(:3060)。
  4. `runRoleHooksAll("saveFinal", transcript)` を **await** する(:3062-3063)。場にいるロールごとに順に呼び、失敗は握る(:1235-1258)。
  5. `markVenueClosed()`(:3091)。
  6. 応答を返す。HTTP の応答は、閉じ終わるまで返らない。
- **`saveFinal`**(cockpit.mjs:1213-1222): 転写が前の保存から増えていれば保存を頼む。そして `waitBounded` で待つ。待ちの上限は `SHUTDOWN_MEMORY_TIMEOUT_MS = 90_000`(cockpit.mjs:167・1152-1165・1542-1547)。増えていなければ頼まず、走っている保存も無ければすぐ返る(:1220)。
- **Ctrl+C(SIGINT)・stdin の EOF**: `process.on("SIGINT", shutdown)`・`rl.on("close", shutdown)`(cockpit.mjs:3619-3622)→ `createCockpitShutdown`(cockpit.mjs:2503-2530)。
  - 場が閉じていなければ `server.endStream()` を呼ぶ。開きかけ・閉じかけは終わるのを待ち、開いていれば同じ `closeStream`(cockpit-server.mjs:3108-3118)。
  - 場が閉じていれば、走っている保存だけを待つ(`waitForRunningSaves`、cockpit.mjs:1265-1268)。
  - 2 回目の Ctrl+C は待ちを打ち切る(`skipMemoryWait`、cockpit.mjs:1273-1277・2506-2508)。
  - 最後は `finalize` で `process.exit(0)`(cockpit.mjs:3608-3617)。
- SIGHUP・SIGBREAK・`beforeunload` の手当ては無い(src・scripts を grep して該当なし)。

### 2.2 走っている間の画面

- 状態のピルは「記録中」(view-logic/glance-meters.mjs:188)。
- 中央は押せない「配信を終えています…」と「記録中…」(glance-meters.mjs:221-240)。Discord では「通話を終えています…」(view-logic/discord.mjs:28)。
- 記憶のタブは「(記録中…)」(view-logic/settings.mjs:231。`memory.recording` = 保存の係が走っている間、cockpit.mjs:3303)。
- 閉じかけの間は、始める・ロールの切り替えを断る。断りの文面は「…途中(記録中・少し待ってからもう一度)」(cockpit-server.mjs:210・2397・3828、discord-experience.mjs:1495)。
- snapshot の `stream` は `{ phase, error, openedAtMs, experience, … }`(cockpit-server.mjs:1537-1548・5086)。closing の中を分ける項目は無い。「整理中」を出すには、項目を足すか memory の現況に足す必要がある。

### 2.3 ③が終わるまで閉じずに待てるか

- **【事実】** 待てる形はある。`closeStream` は `saveFinal` を await し、その間ずっと phase は `"closing"` のまま(cockpit-server.mjs:3061-3063)。`saveFinal` の中で②に続けて③を待てば、閉じるのも③の後になる。
- **【事実】** ただし今の `saveFinal` は、待ちを 90 秒で打ち切る(cockpit.mjs:1221・1158-1161)。打ち切られても②は保存の係の中で走り続け、場はその前に閉じる(cockpit-server.mjs:3091)。③を同じ枠に入れると、この 90 秒が③にもかかる。
- **【事実】** 保存が要らない閉じ方(転写が増えていない)では、`saveFinal` は何も待たずに返る(cockpit.mjs:1217-1220)。週 1 回の③をここにつなぐなら、この道も考える必要がある。
- **【事実】** 保存の係 `createMemoryRecorder`(cockpit.mjs:847-951)は 1 本の直列の鎖。git の index.lock がぶつからないようにするため(:810-812)。材料は転写で、走らせるのは `writeImpl` だけ。③の仕事を同じ鎖に並べる口は、今は無い。
- **【推測】** 打ち切りの後に新しい場が開くと、その場の②は鎖の後ろに並ぶ。③が鎖に入っていれば、③の後に走る。

### 2.4 プロセスや窓が閉じたとき、走っている②はどうなるか

- **【事実】** Ctrl+C では最大 90 秒待ち(2 回目で打ち切り)、`process.exit(0)` する(cockpit.mjs:2503-2530・3616)。Codex の App Server は `detached` なしで spawn している(codex-session.mjs:928-932)。
- **【推測】** Windows の Node(libuv)は、親が終わると detached でない子も一緒に終わらせる。なので②の Codex はコミット前に止まり、書きかけのファイルがコミットされずに残る。
- **【事実】** 次にどれかの役がコミットすると、それも一緒に入る(`add --all`、memory-store.mjs:315)。③が途中で止まった移しも、次の②のコミット(役名「書き出し役」)に混ざる。③の確かめを通らない。
- **【推測】** ターミナルの窓を閉じると、Windows では Node に SIGHUP が届く。手当てが無いので既定どおり終わり、最後の保存も待たない。git の途中で止まれば `index.lock` が残りうる。
- **【事実】** ブラウザの窓を閉じても、サーバ側では何も起きない(`beforeunload` などの手当ては無い)。場も開いたまま。

### 2.5 20 分ごとの途中保存のタイマー

- `setInterval(() => streamVenue.checkpoint(), MEMORY_CHECKPOINT_TICK_MS)` を起動時に 1 回だけ張る。1 分ごとで、`unref()` している(cockpit.mjs:3267-3270、TICK は cockpit.mjs:156)。
- 頼むかは `checkpoint()` が決める(cockpit.mjs:1231-1244)。場が開いていること・転写が増えていること・`isMemoryCheckpointDue` で 20 分たったこと(cockpit.mjs:784-790・149)。
- **【推測】** 決定では③は「閉じるときに、前の整理から 1 週間たっていれば」なので、このタイマーに並べる必要は無い。判定を置く所は `saveFinal`(cockpit.mjs:1213)か `closeStream` の手順 3 の後。

## 3. 頭

- **ロールの頭の決まり方**: `roles/<role-id>/role.json` の `brain` に、頭の表の id を書く(role-store.mjs:9-21)。読むときは `BRAIN_IDS` に無ければ既定の `"claude"`(role-store.mjs:78-84・185)。頭の表は `src/mind/brains.mjs:52-105` の 6 つ: `claude`・`claude-opus-55`・`codex`(GPT-5.6 Terra)・`codex-56-sol`・`codex-astra`・`codex-61-sol`。
- **②の頭の決まり方**: `resolveWriterBrainDef(currentBrain)`(cockpit.mjs:800-805)。今のロールの頭が Codex 系(`codex` か `codex-` で始まる、cockpit.mjs:2281-2283)ならその頭、そうでなければ `BRAINS.codex` を使う。
  - `BRAINS.codex` は `createCodexSession` の既定で、モデル `gpt-5.6-terra`・effort `none`(codex-session.mjs:87-88・649-650)。
  - ②は model・effort を渡さないので、頭の表の行の値になる(memory.mjs:251-259)。例: `codex-61-sol` なら `gpt-6.1-sol`・effort `low`(brains.mjs:97-104)。
  - `currentBrain` はロールの切り替え・編集で更新される(cockpit.mjs:2681・3121・3143)。②の頭は、頼んだときではなく `writeImpl` が走るときに読む(cockpit.mjs:3207)。
  - ④も同じ決め方(cockpit.mjs:3286)。
- **Codex に固定する理由**(memory.mjs:23、cockpit.mjs:793-796): 「Claude の頭は cwd / sandbox / finalAnswerOnly を黙って無視する」。
  - 実際の `createLlmSession`(Claude の頭)が受ける項目は env・systemPrompt・model・maxTurns・queryImpl・skipEnvGuard・onInit・onWarning だけ(llm-session.mjs:162-172)。
  - SDK には `tools: []`・`maxTurns: 1`・`settingSources: []` を渡す(llm-session.mjs:186-198)。
  - つまり Claude の頭は、ファイルを読むことも書くこともできない。
  - Codex の頭は cwd・`sandbox: "workspace-write"`(書ける所は cwd だけ・ネットなし、codex-session.mjs:157-162)・`ephemeral`・`finalAnswerOnly` を受ける(codex-session.mjs:31-50・651-659)。
- **③にも同じ縛りがあるか**: 【事実】ある。③はフォルダを読み、移し、目次と `_conventions.md` を書くので、ツールが要る。今の Claude の頭ではできない。`resolveWriterBrainDef` を③にも使えば、ロールが Claude のとき③は既定の Codex(Terra・effort none)で動く。決定の「ロールの頭」は、今のコードでは「Codex 系ならロールの頭、Claude なら Terra」という意味になる。
- **【推測】** ③は②より長く走りうる。Codex の頭の ask に、全体の打ち切りは無い(rpc の 15 秒だけ、codex-session.mjs:664)。打ち切りは呼び出し側で持つ必要がある(④は `RECALL_TIMEOUT_MS` を自分で持つ、recall.mjs:44・197-200)。

## 4. コミットで足されたファイルを読む

- **今あるもの**(memory-store.mjs):
  - `readCommitAddedLines` は `git diff-tree --root -r -p --no-commit-id --no-color --no-ext-diff --no-textconv --no-renames --unified=0 <commit> --` の、足された行だけを返す(memory-store.mjs:391-418)。ファイル名は返さない(`parseAddedLines` は見出しを読み飛ばす、:360-376)。
  - `revertMemoryCommit` は `git revert --no-edit`(:435-452)。
  - `git` を呼ぶ `runGit` は外に出していない(:136)。出しているのは `pinnedGitArgs`(:168-170)だけ。
- **足された・変えたファイルの一覧**: 【事実】今は無い。同じ形(`checkCommitTarget` → `runGit(pinnedGitArgs(...))`)で `git diff-tree --root -r --name-status --no-renames <commit>` を足すだけで作れる。今の部品のすぐ隣に置ける。
  - 【調査・git の挙動】日本語などのファイル名は、既定(`core.quotepath`)で引用符と 8 進のエスケープになる。`-z` で読むのが安全。今の種はトピック名を英小文字に決めている(conventions-seed.md:22)。本体の名前を②の裁量にすると、この前提は無くなる。
  - ③の確かめ(HEAD が変わらない・本体の中身の集まりが変わらない)に要る「HEAD を読む」「木の中のファイルと中身のハッシュを並べる」(`rev-parse HEAD` / `ls-tree -r` など)も、外に出した部品は無い。`rev-parse HEAD` は `commitMemoryChanges` の中にだけある(:325)。
- **書き出し役のコミット**(`commitMemoryChanges`、memory-store.mjs:291-328):
  - 変更が無ければ `{ ok: true, committed: false }`。あれば `add --all` → `commit -m "<役名> <YYYY-MM-DD HH:MM:SS +09:00>"`(`buildCommitMessage`・`formatJst`、:261-278)。作者は `soul <soul@memory.invalid>`(:97-98)。
  - 返すのはコミットのハッシュ(`rev-parse HEAD`)。
  - 本文に場の id・ファイル名は入らない。
- **どの保存のコミットかを、魂がどう知るか**: 【事実】戻り値だけで知る。
  - `writeStreamRecord` は最後の回の `commit` を返す(memory.mjs:469・473・476)。
  - 保存の係が `onSaved` に渡し(cockpit.mjs:886-893)、main はターミナルに `commit <7 桁>` を出すだけ(cockpit.mjs:3218-3221)。
  - 置き場(`place`)にも、ファイルにも残さない。git の履歴だけからは、どの場の保存かは分からない(本文は役名と時刻だけ)。
- **「最初の保存のコミットで足されたファイル」を使うときに引っかかる所(事実)**:
  - ②の頼みは、2 回目以降の保存でも「新しい話題で別のトピックに分けるときだけ、そのトピックに…本体を足します」と言っている(memory.mjs:209)。2 回目以降の保存でも本体が足されうるので、最初の保存だけでは足りないことがある。
  - ask が失敗した回でもコミットはする(memory.mjs:261-273)が、そのあと throw するのでハッシュは呼び出し側に届かない(memory.mjs:459-463、cockpit.mjs:3223-3227 は警告だけ)。この回で足された本体を、魂は知らないままになる。
  - 化けた回は revert の後にやり直す。返る `commit` はやり直しの回のもの(memory.mjs:457-469)なので、その回の足されたファイルを見ればよい。
  - `add --all` なので、そのコミットには②以外の未コミットの変更(種の `_conventions.md`、前の回に止まった書きかけ)も入りうる(memory.mjs:392-393 の「限界」)。
- **③のコミットを化けの確かめにかけると**: 【事実】`--no-renames` なので、移した本体は削除と追加に分かれて、全行が足された行として出る(memory-store.mjs:408)。【推測】古い本体に `????` だけの行が 1 行でもあれば、移しただけの③が化けと判定される(本体は読んでいないので、そういう行があるかは分からない)。

## 5. 文面の固定(②④)

- **一字一句を固定しているもの**: `src/mind/stream-wording-pin.test.mjs`。期待値は `src/mind/fixtures/stream-wording-pin-expected.mjs`、呼び出しは `src/mind/fixtures/stream-wording-pin-calls.mjs`。
  - ②: `writer.systemPrompt`・`writer.transcript`・`writer.request.new`(calls:75-78、expected:36)・`writer.request.existing`(calls:79-83、expected:38。`PIN_EXISTING_FILES` は `elden-ring/2026-10-31.md, zatsudan/2026-10-31.md`)。
  - ④: `recall.systemPrompt`・`recall.request`・`recall.request.empty`・`recall.result.*`、それに `skills/recall.md`(calls:85-96)。
  - 期待値の頭書きに「このブランチの最後まで変えない…文面が替わったのなら、それは配信の文面が壊れたということ」(expected:7-8)。
- **Discord(通話)の文面**: 一字一句の固定は無い。`wording-discord-c.test.mjs` は、通話の語で組んだ文を配信の語に戻すと配信の文と一致することを見る(:110-140・218-238)。`wording-discord-f.test.mjs:109-124` は通話の②の頼みの決まった行(1 行目・日付・手順 1・3・材料)を見る。
- **ファイル名の段落を「前回の保存ではこのファイルに書いた: …」に替えたら**:
  - `writer.request.new`・`writer.request.existing` の期待値が合わなくなる(どちらも「本体のファイル名: `…`。…`-2` の付け方よりこちらを優先します。」を含む)。「まだありません」「すでにあります: …」の行の形を変えても同じ。
  - 手順 1〜4・材料の行に触らなければ、④の固定(recall.*)と、`wording-discord-c`・`wording-discord-f` の見ている行は変わらない。
  - 正規表現で見ているテストも合わなくなる: memory.test.mjs:174-175(「本体のファイル名: `2026-10-21-2.md`」「どのトピックでもこのファイル名」)、:189・292・444(「すでにあります: topic-a/…」)。偽物の②は「本体のファイル名: `…`」で書く場所を決めている(memory.test.mjs:214)ので、これを使う `writeStreamRecord` のテスト一式が書く場所を失う。
  - 頼みの組み立ての引数が変われば、§1.3 の「呼ぶだけ」の 5 ファイルも呼び方を直す。
  - 【事実】ユーザーは「②④の指示と `_conventions.md` のほかの言い回しは一字も変えない」としてきた(organization-inventory-2026-11.md §2.3 の 17〜19)。今度の決定はファイル名の段落を替えるので、固定の期待値を書き換えることになる。どの行まで替えてよいかは、決定の文からは読めない(§7)。

## 6. 「最後に整理した時刻」を残す

- **今ある、起動をまたいで残す形**:
  - `cockpit-settings-store.mjs`。1 つの JSON(`cockpit-settings.local.json`)に、キーごとに `get…`/`set…` で読み書きし、マージして書く(cockpit-settings-store.mjs:1-60・263-413)。
    - 時刻を残しているキーは無い(`AtMs` のキーは無い)。
    - ロールごとではない(1 つのファイルに全体の設定)。
    - オブジェクトを入れるキーの例は `getDiscordPrep`/`setDiscordPrep`(:404-413)。
  - ロールごとに残す所は `roles/<id>/role.json`(role-store.mjs:9-11)。中身は設定で、時刻の項目は無い。
  - 「最後に記録」の時刻は、プロセスの中と場の中だけ(`lastRecordAtMs`、cockpit.mjs:1138・1262。場の始まりで null に戻す、:1172)。ファイルには残さない。
  - 写しの置き場の前例は `apps/soul/agent/tmp/restructure-backups/`(role-migration.mjs:46-49。`tmp/` は .gitignore)。`git bundle` を使うコードは無い。
- **記憶の git の履歴だけから出せるか**: 【事実】材料はある。
  - コミットの本文は `<役名> <日本時間の日時>` の 1 行(memory-store.mjs:276-278)。作者の日時も残る。
  - 役名を「整理役」にすれば、本文が「整理役 」で始まる最後のコミットとして引ける。git はロールごと(memoryDirForRole、memory-store.mjs:68-72)なので、時刻も自然にロールごとになる。
  - 引っかかる所:
    - (a) 取り消しは `Revert "<元の本文>"` の本文で積まれる(memory-store.mjs:428-429)。失敗を revert で戻すなら、「整理役」のコミットの後に、それを取り消すコミットがあるかも見ないと、失敗した回を成功と数える。
    - (b) 「全部うまくいったときだけ進める」の「全部」に git の外の手順(bundle の写し・確かめ)が入るなら、コミットがあることだけでは成功と言えない。
    - (c) 何も変えなかった③(変更なし → コミットなし、memory-store.mjs:313)は履歴に残らないので、時刻が進まない。
    - (d) git の履歴を読む部品は今は無い(§4 と同じく、隣に足す形になる)。

## 7. 分からないこと

1. ③の確かめ(HEAD が変わらない・本体の中身の集まりが変わらない)と取り消しは、魂がコミットする前に作業ツリーで確かめて戻すのか、コミットした後に revert するのか。決定の「Domain L の化けの取り消しと同じように」は後者に読めるが、前者なら §6 の (a) は起きない。
2. Codex の `workspace-write` の中で、③(や②)が `git` を自分で叩けるか(`.git` に書けるか)。コードでは確かめられない(codex-session.mjs:157-162 は `writableRoots: []` だけ)。「HEAD が変わらない」の確かめがどれだけ要るかに関わる。
3. 「前回の保存ではこのファイルに書いた」に載せるのは、最初の保存のコミットで足されたものだけか、この場の保存のコミット全部で足されたものか(§4。2 回目以降の保存でも本体が足されうる)。ask が失敗した回のコミットをどう拾うかも決まっていない。
4. 1 回目の保存の書き損じ(`detectWriterMiss`)を、名前を決めない形でどう見分けるか。例えば「その回のコミットで、`_` で始まらない `.md` が足されたか」。魂が中身を判断しない範囲に収まるかの判断が要る。
5. 週 1 回の③を、保存の要らない閉じ方(転写が増えていない・場が開いていなかった Ctrl+C)でも走らせるか。90 秒の打ち切り(`SHUTDOWN_MEMORY_TIMEOUT_MS`)を③にも当てるか、2 回目の Ctrl+C で③を打ち切るか。
6. ③が途中で止まった(プロセスの終わり・窓を閉じた)とき、残った移しを次の②のコミットに混ぜないための手当て(起動時や場の始まりに作業ツリーを確かめる、など)が要るか。
7. 固定の期待値(stream-wording-pin-expected.mjs の `writer.request.new`・`writer.request.existing`)をユーザーの決定として書き換えてよいか。替えてよいのはファイル名の段落と前回分の段落だけで、ほかの行は一字も変えない、という読みでよいか。
8. 古い本体に `????` だけの行があるか(本体を読んでいないので分からない)。③のコミットに今の化けの確かめをそのままかけるかに関わる(§4)。
9. 種(conventions-seed.md)の §2 の形・名前の決まり・§1 の「整理役(今はまだいません)」を、新しいロールのために書き換えるか。チャッピーの実物の `_conventions.md` は、魂ではなく③(か人)が書き換える前提でよいか。
