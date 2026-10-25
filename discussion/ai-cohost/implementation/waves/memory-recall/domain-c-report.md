# 記憶の作り直し Wave 2 / Domain C — ②書き出し役と保存の経路、古い搭載の撤去 完了報告

> Gnome → Undine(2026-10-21)。計画: [../../orchestration/memory-recall-wave-plan.md](../../orchestration/memory-recall-wave-plan.md) §2 Domain C・申し送り 1〜5。コミットはしていない。
> 本物の `apps/soul/agent/memories/` には書いていない(実機確認は OS temp の試験用フォルダ。終わったあとも本物の記憶の git は 2 コミット・作業ツリーは clean のまま)。記憶の中身・会話本文はこの報告に書かない。

## 1. 変更ファイル(すべて apps/soul/agent 配下・削除したファイルは無し)

| ファイル | 中身 |
|---|---|
| `src/mind/memory.mjs` | 作り直し。②書き出し役(`writeStreamRecord`)・今回の本体のファイル名(`createStreamRecordIdentity` ほか)。旧 `generateDigest`/`saveDigest`/`loadRecentDigests`/`composeSystemPrompt`/`DIGEST_GENERATION_INSTRUCTION`/`DEFAULT_DIGEST_COUNT`/`DEFAULT_MEMORIES_DIR` は削除。`formatTranscriptForDigest` は残す |
| `src/mind/memory.test.mjs` | 作り直し(22 件) |
| `src/mind/codex-session.mjs` | `APP_SERVER_ARGS` に `-c notify=[]` を足した(この 1 点だけ) |
| `src/mind/codex-session.test.mjs` | 起動引数のテストに notify を足した |
| `scripts/cockpit.mjs` | 保存の係(直列)・②の頭の決め方・起動時の準備・耳の Stop の結線・Ctrl+C・config/read の alert。ON/OFF と搭載の撤去 |
| `scripts/cockpit.test.mjs` | 記憶まわりを差し替え |
| `src/cockpit/cockpit-server.mjs` | `onEarsStopping` の口、`POST /api/memory` の撤去、`reportMcpConfigReadFailed()`・`memoryStatusChanged()` |
| `src/cockpit/cockpit-server.test.mjs` | 記憶まわりを差し替え・追加 |
| `src/cockpit/warnings.mjs` | 冒頭の種類の一覧に `mcp-config-read`(alert)を足した(コメントのみ) |
| `src/cockpit/cockpit-settings-store.mjs` / `.test.mjs` | `getMemoryEnabled`/`setMemoryEnabled` を削除(設定の永続化の撤去) |
| `src/cockpit/view-logic/settings.mjs` / `.test.mjs` | `memoryToggleView`・`memoryPostErrorText` を削除、`memoryStatusLabel` を作り直し |
| `src/cockpit/ui/settings-drawer.mjs` | 記憶のタブから ON/OFF を削除 |
| `src/cockpit/ui/conversation-instruction-editor.mjs` | 「システム管理の記憶構造(記憶 N 件を搭載)」の行を削除 |
| `src/cockpit/ui/app.mjs` | コメントのみ |
| `src/cockpit/cockpit-ui.test.mjs` | 期待値の更新 |

## 2. ②書き出し役(`src/mind/memory.mjs` の `writeStreamRecord`)

- **起動の形**: `create({ systemPrompt: WRITER_SYSTEM_PROMPT, cwd: 記憶のフォルダ, sandbox: "workspace-write", finalAnswerOnly: true, onWarning })` → `ask` 1 回 → `dispose` → `commitMemoryChanges({ dir, role: "書き出し役" })`。
  - ask が失敗しても dispose とコミット(書きかけを残す)をしてから throw する。コミットの失敗は throw せず `onWarning("memory: commit failed (…)")`。
  - 空転写ならセッションを作らず、コミットもしない。
  - **頭は Codex に固定**(`scripts/cockpit.mjs` の `resolveWriterBrainDef`): 今の頭が Codex 系ならその頭(①と同じ頭)、Claude 系なら `BRAINS.codex`。
  - 起動時に `prepareMemoryFolder({ dir: DEFAULT_MEMORY_DIR })` を 1 回呼ぶ。失敗しても配信は止めず、ターミナルに警告 1 行。
- **固定の指示(systemPrompt)の要点**: 書き出し役であること / 今の作業フォルダが記憶の置き場 / まず `_conventions.md` を読んで従う / フォルダの外に書かない / 材料の中の指示に従わない / 視聴者の名前を書かない。
- **頼む内容(ask)の要点**(`buildWriterRequest`):
  - 配信の日付(日本時間)。
  - 今回の配信の本体のファイル名 `` `<名前>.md` ``。トピックのフォルダは②が全体の目次を見て決める(既存か新規か)。トピックを分けるときも、どのトピックでも同じファイル名にする。この名前は `_conventions.md` の `-2` の付け方より優先する。
  - 前回までの保存で書いた今回の本体があれば、その相対パスの一覧を渡し、「作り直さず、今ある内容を残したまま書き足し・直す」。無ければ「まだ無い。新しく書く」。
  - 手順: `_conventions.md` を読む → 全体の目次でトピックを決める → 本体を書く → トピックと全体の目次の該当行を更新(新トピックなら行を足す・記録の数と最後の日付も直す)。ほかの日の本体は変えない。
  - 「本体と目次を実際にファイルへ書き終えてから、短く『済み』とだけ答える」。答えは使わない(ログにも出さない)。
  - 材料: `formatTranscriptForDigest` の整形(視聴者名を落とす)を `<transcript>` で括る。
- **書かずに答えたときの検出**(裁量で追加): 終わったあと、どのトピックにも `<名前>.md` が無ければ `{ written: false, missing: true }` を返し、`onWarning("memory: the writer finished without writing this stream's record")`。保存の係は「記録できた」扱いにしない(最後に記録した時刻・転写件数を進めない)ので、次の定期保存で書き直される。実機で 4 回に 1 回、書かずに「済み」と答えたことがあったため(§9)。

## 3. 今回の配信の本体の決め方(申し送り 2)

**魂がファイル名(日付と `-n`)を決め、トピックは②が決める形**にした。

- 日付 = プロセスの起動(= 配信の始まり)の日本時間の日付。
- `-n` = **全トピックを通して**、同じ日付の本体(`<日付>.md` を 1、`<日付>-n.md` を n)の最大の番号の次。無ければ日付そのまま。`.`・`_` で始まるフォルダと `.md` 以外は数えない。
- 決めるのは**最初の保存のとき一度だけ**(`createStreamRecordIdentity`)。以後は同じ名前を持ち回るので、保存のたびに `-2`・`-3` はできない。どのトピックに置かれても前の配信の本体とぶつからない。
- 2 回目以降の保存では、`<topic>/<名前>.md` が既にあるトピックの一覧を魂が調べて②に渡す。
- 注意: 全トピック通しの番号なので、あるトピックで `-2` が付いても、そのトピックに `<日付>.md` が無いことがありうる(`_conventions.md` §2 の「同じトピックで 2 回目なら -2」とは厳密には違う)。②には「魂の指定を優先」と伝えている。→ 質問 1。

## 4. 保存の経路と直列化

| 経路 | 結線 | 材料 | 飛ばす条件 |
|---|---|---|---|
| 定期(20 分) | `setInterval`(unref) | その時点のライブの転写 | 転写件数が前回の記録と同じ(今のまま) |
| 手動「今日を記録」 | `POST /api/memory-record` → `onMemoryRecord` | ライブの転写 | なし(空転写だけは走らせない) |
| **耳の Stop** | cockpit-server の `stopEars` で、**pipeline を null にする前**に新しい口 `onEarsStopping(transcriptBuffer.all())` を呼ぶ(待たない・throw は握る・耳が起動していなければ呼ばない・close 経由では呼ばない) | Stop の時点の転写 | 転写件数が前回の記録と同じ |
| Ctrl+C | shutdown で `server.close()` の前に転写を取る → close の後に保存の係へ | close 前の転写 | 転写件数が前回の記録と同じ |

**直列化**(`scripts/cockpit.mjs` の `createMemoryRecorder`、戻りは `{ record, isRecording, whenIdle }`):

- 走っていなければすぐ 1 回。走っている間に来たら 1 件だけ待たせ、終わってから 1 回だけ走らせる。待っている間にさらに来たら、待っている材料を新しい方に差し替える。ただし**件数が減る差し替えはしない**(Stop で取った転写を、後から来る空や短い転写で消さないため)。空の転写は走らせない。
- 1 回の失敗は onError に渡して続ける(待たせた分も走る・呼び出し元は reject されない)。
- `onRecordingChange` で走り始めと全部終わったときに `server.memoryStatusChanged()`(SSE の state)を押す。
- 定期保存の「転写件数が変わらなければ飛ばす」は残した。耳の Stop と Ctrl+C にも同じ判定を足した(裁量 3)。

**Ctrl+C の打ち切り: 15 秒 → 90 秒**(`SHUTDOWN_MEMORY_TIMEOUT_MS = 90_000`)。

- 理由: ②は使い捨ての Codex を起こしてツールで読み書きする。書き出しの turn だけで約 21 秒、起動から後片付けまで約 41 秒(棚卸し §6・Wave 1 A)。今回の実機でも 1 回 12〜26 秒(短いダミーの材料)。配信 1 本分の材料ではもう少し延びうるうえ、Ctrl+C の時点で定期保存や Stop の保存が走っていれば、その終わりを待ってから最後の 1 回が走る(直列)。そこで 1 回分の約 2 倍にした。
- 待つのは「保存が走っているとき」だけ。待っている間は「記録を書き出し中…(最大 90 秒・もう一度 Ctrl+C で待たずに終了)」を出し、**もう一度 Ctrl+C で待たずに終わる**(裁量 4)。耳を Stop してから Ctrl+C する流れでは、最後の 1 回は走らない(転写が空)が、Stop の保存が走っていればその終わりを待つ。

## 5. 撤去したもの

- 起動時の直近 3 件の搭載一式: `loadRecentDigests`・`composeSystemPrompt`(と記憶の見出し)・`MEMORY_INJECT_MAX_CHARS`・`DEFAULT_DIGEST_COUNT`・`memoryText`/`memoryCount`。①の人格の指示は「名前 + 会話指示」だけ(`buildBrainSessionSystemPrompt(brainId, overrides)` に引数を変更)。
- 旧 `generateDigest`/`saveDigest`/`DIGEST_GENERATION_INSTRUCTION`/`DEFAULT_MEMORIES_DIR`(置き場の既定は memory-store の `DEFAULT_MEMORY_DIR` に一本化)。
- 記憶の ON/OFF: 止水栓 `memoryEnabled`(定期・Ctrl+C のガード、Fire の configuration の `memoryEnabled`)、`createMemoryHooks`、`onSetMemoryEnabled`、`POST /api/memory`(今は 404)、settings store の `getMemoryEnabled`/`setMemoryEnabled`、UI のトグル・`memoryToggleView`・`memoryPostErrorText`・`requestErrorText("memory")`。古い設定ファイルに `memoryEnabled` が残っていても読まない(他のキーは今どおり読める)。
- 「記憶 N 件を搭載」の表示: 記憶のタブの文言と、会話指示の編集ページの「システム管理の記憶構造」の行。

## 6. 操縦席の記憶の欄

- 記憶のタブ: 「今日を記録」ボタン(押している間は無効・今のまま) と、その下に `最後に記録: HH:MM:SS`(まだなら `最後に記録: まだ記録なし`)。保存が走っている間は末尾に `(記録中…)` が付く(定期・Stop・Ctrl+C の保存でも付く)。エラー欄は今のまま(503 などの配線の失敗だけ)。
- state snapshot の `memory` は `{ lastRecordAtMs, recording }`(以前は `{ enabled, count, lastRecordAtMs }`)。
- 会話指示の編集ページ: 識別名だけを読み取り専用で出す(記憶の行は無い)。

## 7. notify と alert

- **notify**: `APP_SERVER_ARGS` に `-c notify=[]`(①②④すべてに効く)。確かめ方(実機・ダミー文のみ・`createCodexSession` に spawn の差し替えを入れて引数を足した):
  1. `-c notify=[<node>, <印のファイルを書く小さなスクリプト>]` を**後ろに**足して 1 turn → `config/read` の実効値はその印のスクリプト、turn の後に印が **1 回**書かれた(App Server でも turn ごとに notify が動き、`-c` がユーザー設定に勝つことの確認)。
  2. 同じ印の `-c` を**前に**置き、魂の `-c notify=[]` を後ろに置いて 1 turn → 実効値は `[]`、印は **0 回**(下の層に notify があっても空にできる)。
  3. 魂の引数そのままで 1 turn → 実効値は `[]`(ユーザーの 2 要素の notify が空に置き換わる)、印 0 回。
  - ユーザーの notify の中身は表示していない(Wave 1 A の報告どおり 2 要素の配列であることだけ既知)。ユーザーの通知プログラムそのものが動かないことは、プログラムを特定しないため直接は観測していない(1〜3 からの推論)。
- **config/read 失敗の alert**: codex-session の既存の警告文言(`could not read the MCP server list`)を cockpit.mjs の `isMcpConfigReadFailureWarning` で拾い、`server.reportMcpConfigReadFailed()` が警告の掲示板に**一回きりの出来事・alert**(kind `mcp-config-read`、文言「MCP の一覧を読めなかった(ユーザーの MCP が起動しうる)」、detail なし、60 秒・続けば回数)を出す。会話は続ける(今のまま)。①と②の両方の onWarning を通す。codex-session.mjs は notify の 1 点しか変えない指示なので、文言の一致は cockpit.test で codex-session.mjs のソースから文言を読んで固定した。→ 質問 2。

## 8. テスト

- `apps/soul/agent` で `node --test`: **1507 件すべて合格**(Wave 1 後は 1516。古い記憶のテストを畳んだ分で減った)。
- リポジトリルートで `pnpm run check:soul-zone`: 合格(1513 ファイル)。
- 新しい挙動のテスト(偽物の頭):
  - memory.test: 撤去(旧の口が無い)/ 日本時間の日付 / ファイル名の決め方(無し・他の日付・全トピック通しの最大+1・`.git`/`_` を数えない・不正な日付)/ 既存の本体の一覧 / 一度だけ決めて持ち回る / 固定の指示と頼む内容(日付・ファイル名・手順・既存の本体)/ ②の起動の引数(cwd・workspace-write・finalAnswerOnly・systemPrompt)と ask→dispose→commit の順・役名「書き出し役」・視聴者名が入らない / 空転写 / ask 失敗 / コミット失敗 / 書かずに答えた / onWarning の受け渡し / 引数の誤り / **本物の git の通し**(試験用フォルダで prepare → 偽物の②が書く → 書き出し役のコミットが 1 つ・作業ツリーが clean)。
  - cockpit.test: 撤去 / ②の頭の決め方 / config/read 失敗の判定と codex-session の文言の一致 / 保存の係(1 回・空・**直列(同時は 1 つ・待ちは 1 件で最新の材料)**・件数を減らす差し替えをしない・失敗の扱い・written:false・override)/ **耳の Stop で保存される**(本物の cockpit-server と偽物の pipeline で、Stop の転写が②の材料になり、Stop の後は空回りしない)/ Ctrl+C のハーネス(close 前に転写・走っている保存の後に最後の 1 回・ハングでも抜ける)/ 定数(20 分・90 秒)/ 人格の指示に記憶が足されない。
  - cockpit-server.test: Stop で畳む前の転写を渡す(起動していない Stop と close では呼ばない)/ 口の throw で Stop が止まらない / `memoryStatusChanged` / `reportMcpConfigReadFailed` が alert・回数 / `POST /api/memory` が 404 で旧フックを呼ばない。
  - codex-session.test: 起動引数に `-c notify=[]`。
  - view-logic・settings-store: 撤去と新しい表示。

### 期待値を変えた既存テスト(仕様変更に伴うものだけ)

- `src/mind/codex-session.test.mjs`: 「起動引数で…既定の thread/turn は今と同じ」(引数に notify を足し、名前に notify を足した)。
- `src/mind/memory.test.mjs`: 全面差し替え。残したのは `formatTranscriptForDigest` の 4 件(期待値は同じ)。消したのは generateDigest 6 件・saveDigest 4 件・DEFAULT_MEMORIES_DIR 1 件・loadRecentDigests 6 件・composeSystemPrompt 4 件・DIGEST_GENERATION_INSTRUCTION 1 件。
- `scripts/cockpit.test.mjs`: createMemoryHooks 5 件(削除→撤去の 1 件)/ createMemoryRecorder 6 件(新しい係のテストに差し替え)/ 決め打ち定数(15 秒→90 秒、MEMORY_INJECT_MAX_CHARS を外す)/ shutdown ハーネス 2 件(直列を含む形に)/ 「buildBrainSessionSystemPrompt: override follows identity and precedes optional memory」(記憶の引数を外し、記憶が足されないことに)/ 「conversation instruction revision … preserves brain/memory/TTS」(memoryText の確認 4 行を外し、名前から memory を外した)。
- `src/cockpit/cockpit-server.test.mjs`: 会話指示の秘匿の通しテスト(memoryStatus の形、`POST /api/memory` を外す、`count`→`lastRecordAtMs`)/ `POST /api/memory` 6 件(撤去の 1 件に)/ `POST /api/memory-record` 2 件と snapshot.memory 2 件(memory の形)。
- `src/cockpit/cockpit-settings-store.test.mjs`: memoryEnabled 4 件(撤去の 1 件に)。
- `src/cockpit/view-logic/settings.test.mjs`: memoryToggleView 2 件・memoryPostErrorText・requestErrorText("memory")・memoryStatusLabel 2 件(撤去と新しい文言に)。
- `src/cockpit/cockpit-ui.test.mjs`: settingsFromSnapshot の例の memory の形 / 会話指示の編集ページの vnode(記憶の行が無いことに)。

## 9. 実機確認(OS temp の試験用フォルダ・ダミーの文字起こし・片付け済み)

`prepareMemoryFolder` → `createStreamRecordIdentity` → 本物の `createCodexSession`(gpt-5.6-terra / none、台帳は試験用の一時ファイル)で `writeStreamRecord` を 2 回(2 回目は 1 行足した転写)。これを 4 回行った(最後の 1 回は §2 の検出を足した後)。

- 結果(最後の回): 1 回目 約 22 秒、2 回目 約 21 秒。どちらも `書き出し役 <日時>` のコミットが積まれ(計 2)、作業ツリーは clean。フォルダは `_conventions.md`・全体の `_map.md`・1 トピックの `_map.md` と本体 `<日付>.md` の 1 本(2 回目は同じ本体を更新し、`-2` はできなかった)。本体に視聴者の名前(ダミー)は入らなかった。警告(未対応の通知を除く)は 0 件。
- **4 回中 1 回、1 回目の保存で②が何も書かずに「済み」と答えた**(所要 12.5 秒。コミットは種の `_conventions.md` だけ)。その回も 2 回目の保存では正しく書いた。これを受けて §2 の「書かずに答えたときの検出」と、頼む内容の「実際にファイルへ書き終えてから」を足した。足した後の 1 回は問題なし。
- notify の確認は §7。turn は計 3 回(各 9 秒前後)。
- 試験用フォルダ・台帳は消した(temp に残りなし)。本物の記憶の git は 2 コミット・clean のまま、リポジトリの `codex-rollouts.local.json` は更新していない。

## 10. 裁量で決めたこと

1. 本体のファイル名は**全トピック通しの番号**で魂が決める(§3)。トピックの判断を②に残しつつ、保存のたびに同じ名前を使えて、どのトピックでも前の配信とぶつからないため。
2. **書かずに答えたときの検出**(§2): 魂は中身を判断せず、「今回のファイル名の本体があるか」だけを見る。
3. 耳の Stop と Ctrl+C にも「転写件数が前回の記録と同じなら飛ばす」を足した(「今日を記録」の直後の Stop や終了で②を空回りさせない)。手動は飛ばさない。
4. Ctrl+C の待ちを 90 秒に延ばす代わりに、**もう一度 Ctrl+C で待たずに終わる**口を足した(待つのは保存が走っているときだけ)。
5. config/read 失敗の警告は**一回きりの出来事(60 秒)**にした(状態として残すと、直ったことを codex-session が知らせないので消せない)。
6. 保存の失敗(②・コミット)は今までどおりターミナルの警告だけ(上の帯には出していない)。
7. settings store の `getMemoryEnabled`/`setMemoryEnabled` も消した(「設定の永続化」の撤去。src/cockpit/ 配下)。
8. 記憶の欄の「記録中…」のために、snapshot の memory に `recording` を足し、`memoryStatusChanged()` で押すようにした。
9. 「今日を記録」ボタンは記録中も押せる(待ちの 1 件に入る)。
10. ②の答えは「済み」だけにした(書いたファイル名は答えさせない。答えはログに出さず、本体の有無は魂がファイルで見る)。

## 11. 残るリスク

- ②がまれに書かずに答える(§9)。検出して次の定期保存で書き直すが、**最後の保存(Stop・Ctrl+C)で起きると、その配信の記録が残らない**(警告はターミナルに出る)。必要なら、検出したときに 1 回だけやり直す手がある(未実装)。
- Ctrl+C を 90 秒で打ち切る、またはもう一度 Ctrl+C で抜けると、②の App Server の子プロセスが残りうる(Windows では親の終了で子が自動では止まらない。以前の 15 秒でも同じ)。書きかけは次の保存のコミットに入る。
- 耳を Stop → Start し直すと転写が新しくなる。2 回目以降の保存の材料は新しい転写だけになるが、②には「今ある内容を残して書き足す」と頼んでいる(この運用は扱わない合意)。
- Windows の unelevated sandbox が cwd の外への書き込みを常に塞ぐかは未確定のまま(棚卸し §6)。保険は git。
- config/read 失敗の判定は文言の一致に依る。文言が変わると alert にならない(テストで気づく)。

## 12. 質問

1. 本体の `-n` を全トピック通しで付ける形(§3)でよいか。`_conventions.md` の「同じトピックで 2 回目なら -2」と厳密には違う。合わせるなら、種と記憶のフォルダの `_conventions.md` の一文を直す(例:「同じ日付の本体が既にあれば、どのトピックかに関わらず番号を進める」)か、魂がトピックを知る形に変える必要がある。
2. config/read 失敗の検出を、codex-session の警告文言の一致で行っている。codex-session.mjs に判定用の定数(または専用のコールバック)を足してよいなら、そちらに寄せたい(今回は「notify の 1 点のみ」の指示に従った)。
3. ②が書かずに答えたとき、その場で 1 回だけやり直すか(Stop・Ctrl+C の最後の保存で記録が抜けないように。②の所要時間が倍になりうる)。
