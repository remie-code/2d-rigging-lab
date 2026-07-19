# 配信間記憶 Domain B「配線 + 操縦席 + docs」— test レーン レビュー報告

> レビュアー: Review-Sylph（test レーン・テスト適合/実消費ゼロ/ワイヤ additive）。
> 対象: Gnome 完了報告 `discussion/ai-cohost/implementation/waves/stream-memory/domain-b.md`。
> 根拠文書: `discussion/ai-cohost/soul/stream-memory.md`（裁定7件）・`stream-memory-inventory.md`（L0設計判断7件）・
> `stream-memory-wave-plan.md`（§3 Domain B・§4 blocking基準）。

## 1. テスト設計の網羅（file:line 根拠）

| 要求項目 | 実装/テスト箇所 | 判定 |
|---|---|---|
| settings キー memoryEnabled(4種) | `cockpit-settings-store.mjs:188-195`(get/set)・`cockpit-settings-store.test.mjs:660,677,702,718`(roundtrip・他キー同居・壊れたJSON→null・書込不能パス) | 適合 |
| createMemoryHooks(既定ON・写経) | `cockpit.mjs:396-412`・`cockpit.test.mjs:528,534,540,547,555`(5種: 未記憶→既定true・defaultEnabled明示・記憶済みbool優先・onSet橋渡し・throw握り) | 適合 |
| POST /api/memory サーバテスト | `cockpit-server.mjs:1132-1148`・`cockpit-server.test.mjs:2675,2687,2710,2727,2745,2760`(6種: 503未注入・enabled切替反映・非boolean強制・永続化フック橋渡し・throw握り200・SSE broadcastState) | 適合 |
| POST /api/memory-record サーバテスト | `cockpit-server.mjs:1150-1165`・`cockpit-server.test.mjs:2782,2794,2816,2831`(4種: 503未注入・呼出+broadcastState+snapshot反映・throw握り200・SSE broadcastState) | 適合 |
| snapshot.memory の形 | `cockpit-server.mjs:571-572`・`cockpit-server.test.mjs:2849,2860`(未注入null・注入時{enabled,count,lastRecordAtMs}そのまま) | 適合 |
| getTranscript(additive内部API) | `cockpit-server.mjs:1599-1606`・`cockpit-server.test.mjs:2873`(pipeline未生成→空配列・start後はtranscriptBuffer.all()・防御的コピー確認) | 適合 |
| shouldSkipMemoryCheckpoint | `cockpit.mjs:423-425`・`cockpit.test.mjs:568,573`(2種: 不変→true・変化→false) | 適合 |
| shutdown が固まらない(blocking#3) | `cockpit.mjs:477-482`(raceMemoryRecordWithTimeout)・`cockpit.test.mjs:738,744,751,756`(race自体4種)+`785,822`(shutdown型ハーネス2種:ハング/reject いずれも後続dispose必ず走る・事象順序をassert.deepEqualで固定) | 適合(§2で詳述) |
| OFF の完全性(blocking#4) | `createMemoryRecorder`の`isEnabled()`ガード(`cockpit.mjs:450`)・`cockpit.test.mjs:584`(OFF→generateDigest/saveDigest 呼ばれない) | 適合(§2で詳述) |
| view-logic memory ヘルパー単体 | `view-logic/settings.mjs:183-230`・`view-logic/settings.test.mjs:199,214,229,242,248,253`(6種: toggleView null/undefined・enabled true/false・PostErrorText 2関数・requestErrorText prefix・StatusLabel null/undefined・count/lastRecordAtMs組立) | 適合 |
| cockpit-ui.test.mjs (settingsFromSnapshot) | `ui/app.mjs:94-95`・`cockpit-ui.test.mjs:357,369`(既存テストへ memory フィールドを追記・新規テスト数0) | 適合(Gnome申告どおり既存拡張のみ) |

**新規/変更テスト数の独立クロスチェック**（`grep -c '^test('` で自分で数え、domain-b.md §4 の内訳と完全一致）:
- `cockpit-settings-store.test.mjs`: 40（→+4）
- `scripts/cockpit.test.mjs`: 69（→+20）
- `src/cockpit/cockpit-server.test.mjs`: 118（→+13）
- `src/cockpit/view-logic/settings.test.mjs`: 17（→+6）
- `src/cockpit/cockpit-ui.test.mjs`: 39（→+0・既存拡張のみ）

内訳の中身（cockpit.test.mjs の +20）も個別に file:line で数え、domain-b.md の申告（createMemoryHooks5・shouldSkipMemoryCheckpoint2・createMemoryRecorder6・raceMemoryRecordWithTimeout4・定数固定1・shutdown型ハーネス2 = 20）と一致することを確認した。

## 2. blocking #3/#4 の機械的証明の検証

### blocking #3（shutdown が固まらない）
`cockpit.mjs` の実際の `shutdown`（:1001-1042）の事象順序を確認: `finalMemoryEntries` 確保(:1008)→`server.close()`(:1010)→`memoryEnabled` なら `raceMemoryRecordWithTimeout(recordMemory(...), 15000)`(:1015)→`session.dispose`(:1020)→`player.dispose`(:1027)→`lazyChannel.close`(:1034)→`finally{process.exit(0)}`。

`cockpit.test.mjs:785-820`「shutdown型ハーネス」はこの同じ順序を fake で再現し、`hangingRecordMemory`（絶対に解決しない promise）を `raceMemoryRecordWithTimeout` に通しても `events` 配列が `["finalEntries:3","server.close","session.dispose","player.dispose","lazyChannel.close"]` と**事象順序どおりに完走する**ことを `assert.deepEqual` で固定している。`cockpit.test.mjs:822-832`はreject版も同様に後続 `session.dispose` が走ることを固定。ハーネスは手作りだが、**timeout の中核 (`raceMemoryRecordWithTimeout`) は実装そのもの（cockpit.mjs からの exported 実関数）を使っており**、単なる作文ではない。実 `shutdown` 関数自体は main() のクロージャで export されていないため直接呼べないが、これは本ファイルの既存規律（`createSessionProxy`+手組みハーネスで「brain切替×in-flight」を検証する既存パターン、:962-1038）と同型であり、Domain B 固有の後退ではない。妥当と判定する。

### blocking #4（OFF の完全性）
三経路（手動 `onMemoryRecord`・チェックポイントタイマー・shutdown最終版）はいずれも共通の `recordMemory`（`createMemoryRecorder` の戻り値）を経由し、その先頭で `if (!deps.isEnabled()) return;`（:450）を通る。`cockpit.test.mjs:584-605`がこの1点を直接固定しているため、三経路すべてに機械的に効く（コードリーディングで確認・呼び出し元は`cockpit.mjs:820`(recordMemory定義)・`:839-844`(チェックポイントtimer、`if (!memoryEnabled) return;`の冗長二重防御あり)・`:884`(onMemoryRecord)・`:1014-1016`(shutdown、`if (memoryEnabled)`の外側ガードあり)）。
注入停止（`memoryEnabled ? memoryText : ""`・:715）は main() 内のインライン三項演算子で、Domain B のテストでは単体抽出されていない（1行の単純分岐のため目視確認レベル）。これは既存の同型実装（brain切替の仮面合成等）と同じ抽象度であり、テスト網羅の穴として指摘するほどのリスクではないと判断する。

## 3. fake の徹底（自分で確認）

`scripts/cockpit.test.mjs`・`src/cockpit/cockpit-server.test.mjs` を含む Domain B 全テストファイルに `mind/memory` の import が無いことを確認した:

```
$ grep -rn "mind/memory" scripts/cockpit.test.mjs src/cockpit/cockpit-server.test.mjs src/cockpit/cockpit-settings-store.test.mjs src/cockpit/view-logic/settings.test.mjs src/cockpit/cockpit-ui.test.mjs src/cockpit/cockpit-static-assets.test.mjs
(no output)
```

`createMemoryRecorder`/`raceMemoryRecordWithTimeout` のテストはすべて `generateDigestImpl`/`saveDigestImpl`/`setTimeoutImpl` を明示的に fake 注入しており、実 LLM・実 TTS・実ネット・実マイクへの到達経路は無い。`/tmp/memories` 等の文字列は fake 関数への引数として渡るだけで実ディスク I/O は発生しない（`saveDigestImpl` 自体が `() => "/tmp/x.md"` 等の何もしない fake）。

## 4. テスト非汚染（自分で実行して実測）

テスト実行前後で `apps/soul/agent/memories/` が存在しないことを実測した:

```
$ ls -la memories
ls: cannot access 'memories': No such file or directory
（node --test 実行前）

$ ls -la memories 2>&1; echo "exit:$?"
ls: cannot access 'memories': No such file or directory
exit:2
（node --test 実行後）
```

`~/.codex` への書き込みは、Domain B テストが `mind/memory`（実 generateDigest/saveDigest）を一切 import していないことから構造的に発生し得ないと判断した（brains registry の `create` すら fake で置き換わっているテストが大半・`createMemoryRecorder` テストは `getBrainDef: () => ({ create: () => ({}) })` で常にダミー）。

## 5. ワイヤ additive の独立実証(自分で grep/diff)

```
$ grep -cE 'method === "(GET|POST)" && pathname ===' cockpit-server.mjs
22
```
→ domain-b.md の主張（22）と一致。`git diff` で確認すると新規 if ブロックは `/api/memory`・`/api/memory-record` の2本のみ（既存分岐は無改変）。

```
$ grep -oE 'broadcast\("[a-zA-Z]+"' cockpit-server.mjs | sort -u
broadcast("chatDiagnostic" / chatStatus / diagnostic / discard / expression / fire / selfFire / soul / state / transcript / usage / vad / visionCaptured
```
→ 13 種、domain-b.md の主張と一致。`git diff` 上でも新規 `broadcast(...)` 呼び出しは追加されておらず、`/api/memory`・`/api/memory-record` はいずれも既存の `broadcastState()` を呼ぶのみであることを確認した。

`git diff -- src/cockpit/cockpit-server.mjs` で snapshot() への追加行は `memory: typeof memoryStatusImpl === "function" ? ... : null`（:572）の**1行のみ**であることを確認（brain キー等の既存行は無変更）。

## 6. `node --test` の裏取り（自分で実行）

```
$ cd apps/soul/agent && node --test
...
1..957
# tests 957
# suites 0
# pass 957
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6515.9894
```

domain-b.md §4 の申告（957/957・ベースライン914からの+43）と完全一致。テストの質についても、代表サンプル（`createMemoryRecorder`の成功経路テスト`cockpit.test.mjs:630-662`、shutdown型ハーネス`:785-832`、POST /api/memory の非boolean強制テスト`cockpit-server.test.mjs:2710-2725`等）を読み、単なる緑取り用の空アサートではなく、呼び出し順序・引数内容・SSEイベント内容まで具体的に検証していることを確認した。

## 7. 差分・要修正

なし。テスト適合・ワイヤ additive・fake徹底・非汚染のいずれも、Gnome の完了報告どおりであることを独立に裏取りできた。`cockpit-static-assets.test.mjs` の「16→22」コメント修正はコメントのみでテスト挙動に影響しないことも確認済み（実アサートに数値のハードコードなし）。

## 8. 判定

**合格**

## 9. 質問

なし。domain-b.md §8 の3つの質問（memoryCount非更新・lastRecordAtMs非引継・静的配信コメント是正の越権）はいずれも設計/実装レーンの判断範疇であり、test レーンのレビュー観点（テスト適合・fake・非汚染・ワイヤ additive・数字の裏取り）には抵触しないと判断した。Orch-Sylph 側で design/impl レーンの判定と合わせて最終可否を決めることを推奨する。
