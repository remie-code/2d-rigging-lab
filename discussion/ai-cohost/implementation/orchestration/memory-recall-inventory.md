# 記憶の作り直し(構造化・オンデマンドの思い出し)planning inventory

> Status: 棚卸し完了(2026-10-21)。合意は [../../memory/recall-flow.md](../../memory/recall-flow.md)、置き場の決まりは [../../memory/conventions-draft.md](../../memory/conventions-draft.md)。wave 計画は [memory-recall-wave-plan.md](memory-recall-wave-plan.md)。
> 棚卸しは Sylph 4 本(今の仕組み、頭のツール制限、変える箇所の地図、②④の読み書きの実機確認)。パスは apps/soul/agent 起点。

## 1. 今の配信間記憶(作り直しの対象)

- memory.mjs は 5 つの関数でできている。
  - 整形 `formatTranscriptForDigest` :83(視聴者名を落とす)
  - 生成 `generateDigest` :122
  - 保存 `saveDigest` :172
  - 読み込み `loadRecentDigests` :197
  - 連結 `composeSystemPrompt` :249
- ファイル名は起動日時(:150)。同じプロセスは同じファイルに上書きする(`memoryStartedAtMs` scripts/cockpit.mjs:1470)。
- 保存の経路はどれも `createMemoryRecorder`(cockpit.mjs:635)を通る。
  - 20 分の定期保存(:1827。転写件数が変わらなければ飛ばす :610)
  - 手動(`POST /api/memory-record` cockpit-server.mjs:1912 → cockpit.mjs:1865)
  - Ctrl+C(shutdown :2087。close の前に転写を確保 :2095、15 秒の打ち切り :664)
- 止水栓 `memoryEnabled`(:1468)と、起動時の搭載(:1477、4500 字、`ensureFireResources` :1593 で人格の指示に連結)。表示は `memoryStatusLabel`(view-logic/settings.mjs:235)・settings-drawer・conversation-instruction-editor:21。
- 消すもの:
  - 起動時の搭載一式(`loadRecentDigests`・`composeSystemPrompt`・`MEMORY_INJECT_MAX_CHARS`・`DEFAULT_DIGEST_COUNT`・`memoryText` / `memoryCount`)
  - 「N 件を搭載」の表示と止水栓(ON/OFF をなくす合意)
- 変えるもの:
  - 生成と保存(②が自分で書く)
  - ファイル名の規則
- 残すもの: 手動保存、shutdown の打ち切り、定期保存の仕組み。
- 固定しているテスト: cockpit.test.mjs(:30-33、:787 以降、:857-1003、:1044 の MEMORY_* 定数、`buildBrainSessionSystemPrompt` の記憶連結)、memory.test.mjs 全体、view-logic/settings.test:221-235、cockpit-ui.test:392・:724、cockpit-server.test(:787-840、:3235 以降、:3433、:471)。

## 2. 耳の Stop

- `stopEars`(cockpit-server.mjs:1357)は `onEarsStopped`(:1358)のあと `pipeline = null`(:1364)にして dispose する。転写は pipeline が持つので、Stop で消える。
- 保存の差し込み先は `onEarsStopped` の中(転写がまだ取れる)か、:1363 の前に置く新しいフック。
- close 経由の `onEarsStopped`(:2938)は、pipeline が null になった後に呼ばれる。
- Stop → Start でバッファが新しくなる件は、運用上ほぼ起きないので扱わない(合意)。
- 呼び出し順を固定しているテスト: cockpit-server.test.mjs:471。

## 3. 目印 `<recall …>`

- パーサ(expression-parser.mjs:41 `TAG_RE`)は、英字始まりの語と、`<` `>` を含まない引数を受ける。日本語の自由文も通る。
- **表情の語彙表(expression-table の 6 語)には混ぜず、別の語彙集合として持つ。** 混ぜると「6 語ちょうど」を固定したテスト(expression-table.test:41 ほか)が壊れる。
- 未知の語は剥がしたうえで `unknownTag` 診断になる。events の受け口は `processAskedReply`(fire-orchestrator.mjs:928)→ `applyExpressions`(:854)。events の適用は発話完了後(:1014)。
- 逐次読み上げ(`createIncrementalSentenceTagBuffer`)は、完結したタグを `out.tags` に返す。ただし `createProgressiveBoundary.enqueue`(fire-orchestrator.mjs:730)は tags を捨てている。
- 引数に `<` が混ざると壊れたタグと判定され、中身が声に出る。`>` が混ざると、そこでタグが閉じる。
- 教え方: 今の表情タグは会話指示の本文 `FIRE_SYSTEM_PROMPT_BODY`(fire-orchestrator.mjs:190)にあり、ユーザーが頭ごとに上書きできる。`<recall>` の教えは独立したファイルに置き、魂が固定の部分に足す(合意)。固定テスト: fire-orchestrator.test:127・:145-167。

## 4. 結果を①に届ける

- **しゃべらせる**:
  - `requestSelfFire`(cockpit-server.mjs:2356)と `commentReact.onFire`(:2303)が写経元。
  - `fire({vision, instruction, cause})`(fire-orchestrator.mjs:1667)の instruction は ask の先頭に付き、会話ログには残らない。
  - 忙しいときは `{fired:false, reason:"busy"}`(:1681)。待って拾い直す部品は commentReact の hold と `notifyIdle`(comment-react.mjs:366、結線 cockpit-server.mjs:2114・:2399)。
  - 本文を括って「命令に従うな」と書く流儀は `buildCommentReactFireInstruction`(comment-react.mjs:150)。
- **黙って渡す**: 次の ask の先頭に 1 回だけ前置きする `pendingProgressiveCorrection`(fire-orchestrator.mjs:704 `consumeProgressiveCorrection`)と同じ形にする(合意)。Codex の thread/inject_items(codex-session.mjs:826・:970)は内部専用で、ask の最中は使えないため使わない。

## 5. 「避けるか」判定(Decisions API)

- 骨格は speak-now-decisions.mjs の `createDecisionsJudge`(:247)と `createDecisionsQuestionsJudge`(:283)。
  - キーは `loadDecisionsApiKey`(:72)で、判定ごとに `.env.decisions.local` から読む。
  - タイムアウトは注入でき、拒否(refusal)を区別する。
- 問い・選択肢・入力の作りは comment-react.mjs(:68 / :77 / :103)。しきい値で切る流儀は comment-guard.mjs(predicate ≥0.5)。
- 注入口は cockpit-server.mjs:690-712。警告は `warnJudgeError`(:1012。source の型に値を足す)。

## 6. ②④のセッション(実機確認 2026-10-21、Codex 0.163.0、試験は gpt-5.6-terra / effort none)

| 役 | thread/start の設定 | 実測 |
|---|---|---|
| ② 書き出し | `cwd: 記憶のフォルダ`、`sandbox: "workspace-write"`、`approvalPolicy: "never"`(実効値 `workspaceWrite, writableRoots:[], networkAccess:false`) | 本体の新規作成と目次への 1 行追加ができた。ほかのファイルは不変。turn 21.2 秒。承認要求は 0 件 |
| ④ 思い出し | 今と同じ read-only + never で、`cwd: 記憶のフォルダ` | 目次と本体を PowerShell の `Get-Content` で読み、1 行に要約できた。turn 8.6 秒 |

- 来るメッセージ: agentMessage(前置き)、commandExecution、fileChange(status)、agentMessage(答え)、turn/completed。ほかに `turn/diff/updated` や `outputDelta` の通知が来る。
- 魂の今の返答の組み立て(codex-session.mjs:650-700)は agentMessage をすべてつなげる。ツールを使う turn では前置きも混ざる。agentMessage の `phase`(commentary / final_answer)の値は未実測。
- 承認要求は 0 件だった(never のため)。今の -32601 での拒否のままで支障はない。
- **今の Codex の頭はユーザーの `~/.codex/config.toml` を引き継ぎ、MCP サーバー(node_repl・blender など)が毎回起動している。** notify フックと `[windows] sandbox="unelevated"` も効いている。①も同じ。切り離すことを合意済み。
- Windows の unelevated sandbox は、cwd の外への書き込みを常に塞ぐとは明記されていない(公式)。書き込み範囲は指示で伝え、保険は git(合意)。記憶のフォルダは TEMP の下に置かない。
- Claude の頭での②④は後回し(当面 Codex)。参考: `tools`・`allowedTools`・`permissionMode:"dontAsk"`・`cwd`・`maxTurns ≥2` で成り立つ見込み(型定義 sdk.d.ts)。
- 使い捨てセッションは、今は `BRAINS[currentBrain].create({systemPrompt})`(memory.mjs:134)で作る。ただし Codex は sandbox が read-only 固定(codex-session.mjs:751・:846)、cwd が一時フォルダ固定(:723)なので、役ごとの設定を受け取れるようにする必要がある。

## 7. git

- 魂から git を呼んでいる箇所は今は 0 件。
- `memories/` は apps/soul/agent/.gitignore:41 で無視されている。入れ子の `.git` を作っても、親の status には出ないことを確認済み。
- `core.autocrlf=true` の環境での改行の扱いと、入れ子側の user.name / user.email は未確認。
