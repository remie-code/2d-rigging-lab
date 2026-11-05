# Domain D 報告(Gnome)— サブトピックと月の目次・上限の撤去

- 根拠: plan §4b(86〜126 行)・§1・§6、設計 organization.md §2・§3・§5、レビュー domain-b.md。
- 機械ゲート: `node --test`(apps/soul/agent)**2433/2433 pass**(土台 2428 → +5)。`pnpm run check:soul-zone` **pass**(1634 files・境界違反なし)。
- 依存・lockfile の変更なし。コミット・ブランチ操作・stash なし。実データ(`memories/`・`memory-backups/`・`roles/`・`cockpit-settings.local.json`・`session-usage/`・`fire-diagnostics/`・`.env*`)に触れていない。操縦席は起動していない。本物の LLM・外部 API は呼んでいない(テストは偽の頭・一時フォルダ)。`conventions-seed.md` は変えていない。一発の移行のコードは入れていない。
- 既存の未コミットの Domain A〜C の変更は消していない・戻していない(置き換えは各ファイルで「ちょうど 1 か所」を確かめてから行った)。CRLF のファイル(memory.mjs・recall.mjs・stream-wording-pin-expected.mjs・memory.test.mjs・recall.test.mjs)は CRLF のまま(LF だけの行 0)。

## 変更ファイル(apps/soul/agent/)
- `src/mind/memory-organizer.mjs`
  - 定数 `ORGANISER_REQUEST` → 純関数 `buildOrganiserRequest(dateJst)`(export)。文面は計画 96〜115 行。
  - `runOrganise` の最初(打ち切りの確認のすぐ後)に時計を 1 回読み(`startedAt`)、控えの名前と頼みの日付の行(`formatJstDate(startedAt.getTime())`・memory.mjs の既存の関数を再利用)に使う。
  - 待つ上限を外した: `DEFAULT_ORGANISE_ASK_TIMEOUT_MS`・`MAX_TIMEOUT_MS`・`ORGANISER_TIMEOUT_WARNING`・`askTimeoutMs`(型・既定・検査・持ち回り)・`"timeout"`(OrganiseSkipReason・askOrganiser の結果)・setTimeout の競争を削除。`askOrganiser` は signal が無ければ頼みの決着をそのまま待ち、あれば頼みと打ち切りだけを競わせる(dispose は今どおり finally で 1 回)。
  - コメント・JSDoc(冒頭・askOrganiser・rollBackAndSkip・organiseMemory)を「待つ上限は掛けない・止めるのは打ち切りだけ」に直した。
- `src/mind/memory.mjs`: `buildWriterRequest` の手順 4 の 1 行だけ。
- `src/mind/recall.mjs`: `buildRecallRequest` の手順 2 の 1 行だけ。
- `scripts/cockpit.mjs`: `createMemoryOrganiserRunner` の `deps.askTimeoutMs`(JSDoc の行と、startImpl へ渡す行)を削除。JSDoc の「③の頼みの上限は B の 30 分」を「③の頼みにも待つ上限は無い・止めるのは stop() の打ち切りだけ」に。
- テスト
  - `src/mind/memory-organizer-wording-pin.test.mjs`: 頼みの期待値を計画の文面に(手書きのテンプレート `expectedRequest(date)`・計画のコードブロックからスクリプトで書き写した)。純関数の固定(2026-11-05)と、`organiseMemory` に UTC 2026-11-05 15:30(= JST 2026-11-06 00:30)の時計を注入して頼んだ文面の固定を足した。timed out の警告の固定を外した。冒頭に 2026-11-05・ユーザー OK・Domain D の注記。
  - `src/mind/memory-organizer.test.mjs`: timeout のテストを外し、3 件を足した(下記)。頼みの確認を `buildOrganiserRequest("2026-11-05")` に。警告の一覧・引数の誤りの表・既定値のテストから timeout / `askTimeoutMs` / 30 分を外した。
  - `src/mind/fixtures/stream-wording-pin-expected.mjs`: `writer.request.new`・`writer.request.existing` の手順 4、`recall.request`・`recall.request.empty` の手順 2 だけ(計画の文面から作った文字列で置換・各 2 か所)。冒頭の注意書きに例外の 1 行を足した。ほかの期待値は触っていない。
  - `src/mind/recall.test.mjs`: 旧の手順 2 の正規表現を新しい文面に(旧のたどり方が無いことも確認)。
  - `src/mind/memory.test.mjs`: 手順 4 の新しい行を配信・通話の語の組の両方で確かめる 1 件。
  - `scripts/cockpit-organiser-c.test.mjs`: 係が③に上限を渡さない(`askTimeoutMs` を deps に渡しても startImpl に届かない・渡す鍵は 5 つだけ)1 件。

## 整理役の頼みの最終の全文(`buildOrganiserRequest("2026-11-05")` の出力)
計画 96〜115 行(行頭 3 文字を外し `${dateJst}` のまま)と出力 `buildOrganiserRequest("${dateJst}")` を byte 単位で照合して一致(3204 bytes)。括弧は全角。

```
記憶の置き場を整理してください。

- 今日の日付（日本時間）: 2026-11-05

手順:
1. `_conventions.md` と全体の目次 `_map.md` を読む。
2. 各トピックの直下に本体があれば、名前の日付の `<YYYY>/<MM>/` へ動かす（例: `<topic>/2026-10-21.md` は `<topic>/2026/10/2026-10-21.md` へ）。本体の中身は一字も変えない。
3. 月の棚ごとに、時系列の目次 `<topic>/<YYYY>/<MM>/_map.md` をそろえる。その月の本体が載っていなければ足し、目次が無ければ作る。トピックの目次に時系列の行が残っていれば、月の目次へ移す。年のフォルダには目次を置かない。
4. どのサブトピックの目次にも載っていない本体を読み、当たるサブトピックの目次に足す。サブトピックは、トピックの中に作る、目次 `_map.md` だけを入れたフォルダです。サブトピックの中に、さらに細かいサブトピックを作ってもかまいません。サブトピックが無ければ作る。分け方とどこまで掘るかはあなたが決め、話題が増えたら分けたり合わせたりしてよい。本体はサブトピックのフォルダに入れず、年と月の棚に置いたまま目次から指す。1 件の本体を、いくつのサブトピックの目次に載せてもかまいません。
5. トピックの目次 `<topic>/_map.md` を、そのトピックの入口として書き直す。そのトピックが何の話かの一言と、すぐ下のサブトピックの一覧（名前と一言）を載せる。サブトピックの目次にも、すぐ下にサブトピックがあれば同じように一覧を載せる。全体の目次は、トピックごとの行を今の置き方に合わせて直す。
6. `_conventions.md` を、今の置き方・名前の付け方・目次のたどり方に合わせて書き換える。書き出し役と思い出し役は、これを読んで動く。書き出し役が新しい本体をどこに書き、どの目次に行を足すかも書く。サブトピックの目次が今日の整理までの本体を載せていることと、それより新しい本体は月の目次で探すことも書く。
7. 書き終えてから、短く「済み」とだけ答える。

守ること:
- 名前が `_` で始まらない `.md` は、すべて本体として扱われます。目次など本体でないファイルは、名前を `_` で始めてください。
- 本体のファイルは動かすだけで、中身は一字も変えないでください。整理のあと、魂が本体の中身が前と同じかを確かめます。違えば、整理はすべて取り消されます。
- 本体のファイルは、書き直さずに移動のコマンドで動かしてください（中身を通さないので、1 バイトも変わりません）。
- サブトピックのフォルダの名前は、トピックと同じく英小文字とハイフンにしてください。
- このフォルダの外には書かないでください。
- git のコマンドは使わないでください（コミットは魂がします）。
```

systemPrompt(`ORGANISER_SYSTEM_PROMPT`)は変えていない(固定テストもそのまま)。

## ②④の変えた行
- ② `src/mind/memory.mjs` 204 行(`buildWriterRequest` の手順 4)
  - 前: `` `4. トピックの目次と全体の目次の、今回の${w.venue}に当たる行を更新する（新しいトピックなら行を足す。記録の数と最後の日付も直す）。`, ``
  - 後: `` `4. \`_conventions.md\` の決まりに従って、今回の${w.venue}に当たる目次の行を更新する（新しいトピックなら行を足す。記録の数と最後の日付も直す）。`, ``
  - 計画 §4b-2(119 行)の中身と byte 一致を確認。
- ④ `src/mind/recall.mjs` 123 行(`buildRecallRequest` の手順 2)
  - 前: `"2. 全体の目次 \`_map.md\` → トピックの目次 → 本体、の順にたどって探す。頼みごとの言葉がずれていても、下の直近の会話も手がかりにする。",`
  - 後: `"2. \`_conventions.md\` のたどり方に従って、目次からたどって探す。頼みごとの言葉がずれていても、下の直近の会話も手がかりにする。",`
  - (上の 2 行の `\`` は Markdown の都合。コードの中は素のバッククォート。)計画 §4b-3(122 行)の文字列と、評価後の値で一致を確認。
- 両ファイルとも、ほかの行は変えていない(1 か所だけの置換)。

## 下の層の上限の調査(③の ask の turn の完了待ち)
結論: **整理役の ask の turn の完了待ちに既定の上限が掛かる道は無い。codex-session.mjs は変えていない。**
- 頭: `cockpit.mjs:3444` `getCreate: () => resolveWriterBrainDef(currentBrain).create` → `cockpit.mjs:812-817` → `brains.mjs:72,88,94,102`(どれも `createCodexSession({...options, model, effort})` に素通し。ラッパーで上限は足していない)。
- `codex-session.mjs` の setTimeout は 5 か所だけ:
  - `543-550` `request()` の RPC 応答待ち(既定 `rpcTimeoutMs` 15 秒・`664`)。ask の中では `initialize`(`469`)・`config/read`(MCP の名前)・`thread/start`(`1035`)・`turn/start`(`1148`)の**応答**だけに掛かる。turn/start は turn を始めた応答が返れば済む。
  - `600`・`603` dispose 時のプロセスの片付け(`shutdownTimeoutMs`)。
  - `1115` 圧縮の処理中に来た ask の待ち(`compactionWaitMs` 60 秒)。`compactionProcess` は `compact()`(`1232-1243`)の中でしか立たず、`compact()` を呼ぶのは `src/mind/context-compactor.mjs:176`(①の文脈の圧縮)だけ。③の使い捨てセッションでは立たない。しかも超えたときは「待つのをやめて turn を始める」で、失敗にはしない。
  - `1256-1258` 圧縮の turn の完了の上限(`compactionTimeoutMs`)。圧縮の turn だけ。
- turn の完了待ち: `1170` `const result = await terminal;`。`terminal`(`1139`)は `turn/completed` の通知(`894` 付近 → `916` `active.resolve`)か `failTurn`(`747`・接続の致命的な失敗 `937` の onFatal や通知の不整合)でだけ決着し、タイマーは無い。
- 参考(ask ではない): 記憶の git の呼び出しは 1 回ごとに `DEFAULT_GIT_TIMEOUT_MS` 30 秒(`memory-store.mjs:110`・`runGit`)。控え・見張り・コミットの git に掛かるもので、頼みの待ちではない(変えていない)。
- ②の閉じの 90 秒(`SHUTDOWN_MEMORY_TIMEOUT_MS`・`cockpit.mjs:168`)、④の上限(`recall.mjs:199`)、①の上限は変えていない。

## テスト
- 件数: 2428 → **2433**(+5)。
  - `memory-organizer.test.mjs` +2(timeout の 1 件を外し、3 件を足した):
    1. 「頼みに待つ上限は無い」: `t.mock.timers`(setTimeout・setInterval)を有効にし、決着しない頭で頼ませ、偽の時計を 365 日進めても done が決着しない・dispose されない・警告も戻しも無い → `abort()` で `{ skipped, "aborted" }`・dispose 1 回・走る前の先頭へ戻す・警告は stopped の 1 行。(旧コードなら 30 分のタイマーが偽の時計で発火して落ちる形。)
    2. 「setTimeout を使わない・長くかかった頼みも答えが来れば進む」: `t.mock.method(globalThis, "setTimeout")` で、頼みの最中も終わりまでも呼び出し 0 回。答えが来たら organised。
    3. 「日付の行は始めたときの注入した時計の JST の日付」: UTC 2026-12-31 15:00(= JST 2027-01-01 00:00・年の変わり目)で、頼みは `buildOrganiserRequest("2027-01-01")`・`2026-12-31` を含まない・控えの名前も `2027-01-01_00-00-00.bundle`。
    - 上の 3 件は git を呼ばない差し替え口(`stubbedImpls`)で走らせる(偽の時計の下で git の子プロセスを動かさないため)。
  - `memory-organizer-wording-pin.test.mjs` +1(頼みの固定が純関数の 1 件と、時計を注入した 1 件の 2 件に)。
  - `memory.test.mjs` +1、`cockpit-organiser-c.test.mjs` +1。
  - `recall.test.mjs`・`stream-wording-pin.test.mjs` は件数そのまま(期待値だけ)。
- `pnpm run check:soul-zone`: pass。

## 裁量判断
1. 形: `ORGANISER_REQUEST` を `buildOrganiserRequest(dateJst)` に(②の `buildWriterRequest`・④の `buildRecallRequest` と同じ「頼みを組む純関数」の流儀)。定数は残していない(日付の無い頼みを誤って使わせないため)。
2. 時計を読むのは `runOrganise` の最初の 1 回にし、控えの名前と頼みの日付の行の両方に使う(前は控えを作るときに読んでいた。差はミリ秒・「整理を始めたとき」をそろえるため)。コミットの本文の時刻は今どおりコミットの直前に読む。
3. `askTimeoutMs` を渡されても TypeError にはせず、黙って無視する(もう持たない引数。呼び出しは本番に無い)。係も通さない。
4. signal が無い `organiseMemory` は頼みの決着をそのまま待つ(打ち切りの口が無ければ止める手段も無い = 設計どおり上限なし)。
5. stream-wording-pin の注記の例外の行は「手順 4 と手順 2 だけ」と、変えたキー 4 つを名指しで書いた。

## 残リスク
- Codex の App Server(外のプロセス)自身に turn の上限やストリームの切断があるかは soul のコードの外で、ここでは確かめられない。あれば `failTurn` → `ask-failed` で走る前の先頭へ戻る(壊れはしない)。
- 上限が無いので、頭が決着しないまま固まると、閉じは Ctrl+C まで `closing`(「整理中」)のまま。設計どおり(ユーザーの指定)。

## 質問
- なし。
