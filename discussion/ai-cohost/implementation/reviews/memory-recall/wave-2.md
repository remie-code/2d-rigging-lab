# 記憶の作り直し Wave 2 軽いレビュー(Review-Sylph)

> 対象: 未コミットの作業ツリー(Wave 1 = 344198c5 の上)。基準: wave-plan §0・§2 Domain C・申し送り、recall-flow.md、domain-c-report.md。軽め・1 レーン。コードは変更していない。記憶の本文は読んでいない。

## 判定: 合格(要修正なし)

契約の食い違い・明らかな不具合は見つからなかった。下の「注記」は Wave 3 以降または Undine の判断事項。

## テスト

- `apps/soul/agent` で `node --test`: 1507 件、pass 1507 / fail 0(報告と一致)。
- リポジトリルートで `pnpm run check:soul-zone`: 合格(1513 ファイル)。
- 本物の `apps/soul/agent/memories/`: `git status --short` は 0 行(clean)、`git log` は 2 コミット(移し替え前・移し替え)。テスト後も変化なし。リポジトリ側に増えた未追跡ファイルなし(報告書以外)。

## 見る点ごとの結果

1. ②の起動: `writeStreamRecord`(memory.mjs)が `create({ systemPrompt, cwd: dir, sandbox: "workspace-write", finalAnswerOnly: true, onWarning })` → ask → dispose → `commitMemoryChanges({ role: "書き出し役" })`。ask が失敗してもコミットしてから throw する。頭は `resolveWriterBrainDef`(今が Codex 系ならその頭、Claude 系なら `BRAINS.codex`)。頼みの本文には日付(JST)・本体のファイル名・既存の本体の相対パス・手順・`formatTranscriptForDigest` 整形(viewer 行は名前を描かない)の文字起こしが入る。OK。
2. 保存の 4 経路: 定期(20 分・unref)/ 手動 / 耳の Stop / Ctrl+C がすべて `createMemoryRecorder` を通る。直列(同時 1・待ち 1・件数が減る差し替えはしない・失敗は握る)をコードで確認。耳の Stop は `stopEars` の `pipeline = null` の前に `onEarsStopping(p.transcriptBuffer.all())`(`all()` は slice のコピー)を呼ぶ。待たず、throw は握り、耳が起動していなければ呼ばない(`!pipeline` で先に return)。Ctrl+C は `server.getTranscript()` を `server.close()` の前に取り、close 後に record + whenIdle を待つ。90 秒の打ち切り(`SHUTDOWN_MEMORY_TIMEOUT_MS`)と、待っている間だけ有効な `skipMemoryWait`(二度目の Ctrl+C)が成り立つ。保存が走っていなければ待たない。OK。
3. 撤去: `memoryEnabled`・`loadRecentDigests`・`composeSystemPrompt`・`MEMORY_INJECT_MAX_CHARS`・`saveDigest`・`generateDigest`・`memoryText`・`memoryCount`・`getMemoryEnabled`/`setMemoryEnabled`・`createMemoryHooks`・`POST /api/memory` を src / scripts で grep。実コードには残りなし(残りはコメントと「無いこと」を確かめるテストのみ)。①の人格の指示は `buildFireSystemPrompt(identity, 会話指示)` で記憶は連結されない。「N 件を搭載」はUIから消えている(テストで固定)。
4. notify と alert: `APP_SERVER_ARGS` に `-c notify=[]`(テストで固定)。config/read 失敗の警告文言を `isMcpConfigReadFailureWarning` が拾い、`onBrainWarning`(①②共通)→ `server.reportMcpConfigReadFailed()` → 警告の掲示板に alert(kind `mcp-config-read`)。`let server`(1489 行)は `onBrainWarning`(1517 行)より前なので TDZ の心配なし。文言の一致は codex-session.mjs のソースから読むテストで固定されている。OK。
5. 書かずに答えた検出: 終わったあと、どのトピックにも `<baseName>.md` が無ければ `{ written: false, missing: true }` + onWarning。保存の係は `written` が真のときだけ `lastRecordAtMs`/`lastRecordedSeq` を進めるので、次の定期保存でやり直される。OK(限界は注記 2)。

## 差異(要修正)

なし。

## 注記

1. **Q1(`-n` が全トピック通し)**: `_conventions.md` 24 行は「同じトピックで同じ日に 2 回目なら `-2`」と書いており、魂の指定(全トピック通し)と厳密には違う。頼みの本文で魂の指定を優先すると明示しているので動作上は問題ない。④は読むだけで本体の名前に依存しないため、Wave 3 の支障にもならない。揃えるなら `_conventions.md`(種 `apps/soul/agent/src/memory/conventions-seed.md` と記憶のフォルダ側の 2 か所)の一文を「同じ日付の本体が既にあれば、どのトピックかに関わらず番号を進める」に直す。後回しで可。記憶のフォルダ側を直すときはコミットが 1 つ増える。
2. **検出の限界**: 2 回目以降の保存では、本体が前回の保存で既にあるため、②が何も書かずに答えても「あった」と見なされる(検出は 1 回目だけ有効)。必要なら `commit.committed === false`(変更なし)も「書けなかった」の手がかりにできる。Q3(その場で 1 回やり直す)は未実装のままで、Stop・Ctrl+C の最後の保存で起きると記録が残らないという報告のリスクは妥当。やり直しは Undine の判断でよい(推奨: 検出時に 1 回だけ再 ask。所要が倍になるのは Ctrl+C の 90 秒枠に収まる)。
3. **件数の一致判定**: スキップ判定は `currentSeq === lastRecordedSeq`(等号のみ)。耳を Stop → Start し直して転写が新しくなり、件数がたまたま前回の記録時と同じになると、1 回飛ばされうる。まれで、次の保存で救われる。
4. **Q2(判定の定数化)**: 文言の一致で判定している。codex-session.mjs に専用のコールバックまたは定数を足す形にするのは妥当で、Wave 3 で ④ を足すときに同時にやると安い。
5. **stale な設定ファイル**: `apps/soul/agent/cockpit-settings.local.json`(gitignore 済み)に `memoryEnabled: true` が残っているが、読まれないので無害。`fire-orchestrator.test.mjs` の `configuration: { memoryEnabled: label }` はテストの任意キーで、実コードには依存なし(掃除してもよい程度)。
6. **Wave 3 へのつなぎ**:
   - ④は `create({ systemPrompt, cwd: DEFAULT_MEMORY_DIR, sandbox: "read-only", finalAnswerOnly: true, onWarning: onBrainWarning })` をそのまま使える。頭の決め方は `resolveWriterBrainDef` を流用(名前は書き出し役専用に見えるので、共通名にするか別名で包むとよい)。
   - ②が書いている最中に④が同じフォルダを読むことがある(読むだけなので index.lock とは無関係だが、書きかけの本体を読みうる)。④の要約が不完全でも許容する前提でよいか、Wave 3 で一言決めておく。
   - ②のコミットは役名「書き出し役」固定。④はコミットしない(合意どおり)。
   - `onBrainWarning` は ①② 共通の入口なので、④の onWarning もここに通すと config/read の alert が自動で効く(60 秒の一回きり・続けば回数)。
7. **Ctrl+C と Windows(参考・未検証)**: 走っている途中の ②(定期保存など)の子プロセスは、同じコンソールで Ctrl+C を受けて落ちうる。落ちた場合は ask が失敗 → 書きかけをコミット → 待ちの最後の 1 回が新しいセッションで走る、で整合する。対処不要。
