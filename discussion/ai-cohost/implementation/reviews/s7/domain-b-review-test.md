# S7 Domain B（合流 + 発火結線）レビュー — test レーン

> レビュアー: Review-Sylph（test レーン）。2026-07-14。
> 判定基準: [../../orchestration/s7-wave-plan.md](../../orchestration/s7-wave-plan.md) §3 Domain B・§4 blocking 基準。
> Gnome 成果物: [../../waves/s7/domain-b.md](../../waves/s7/domain-b.md)。
> 写経元（手口参照のみ）: `apps/soul/agent/src/mind/barge-in.test.mjs`。

## 判定: **PASS**

全 fake 縦貫通（fake clock + 注入 RNG + fake pipeline/orchestrator・実ネットワーク不出）・★二重発火/二重放送の
断ちが実テストで固定されている・S1〜S6 無退行（既存 563 本は diff 上 1 行も改変されず全緑）を自分の実行で
確認した。blocking 指摘なし。non-blocking の軽微なカバレッジの穴が 2 点ある（§5）。

## 1. 自分で実行した生数字

```
$ cd apps/soul/agent && node --test
# tests 583
# suites 0
# pass 583
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1233.1099
```
自然終了（プロンプト復帰・ハングなし）。domain-b.md §8 の主張（tests 583 / pass 583 / fail 0・563→583 の +20）
と完全一致。

個別 4 ファイルも単体実行で確認（すべて自然終了・fail 0）:

```
transcript-buffer.test.mjs : tests 17 / pass 17
fire-injection.test.mjs    : tests 10 / pass 10
fire-scheduler.test.mjs    : tests 32 / pass 32
cockpit-server.test.mjs    : tests 65 / pass 65
```

domain-b.md §1・§8 の主張（14→17・8→10・22→32・60→65）と一致。`git show HEAD:<file> | grep -c '^test('` で
HEAD 側の baseline も独立に数え、14/8/22/60 が実際に HEAD の内容と一致することを確認した（Gnome の申告数字を
鵜呑みにせず自分で数え直した）。

```
$ git status --porcelain -- apps/soul/agent
 M src/cockpit/cockpit-server.mjs
 M src/cockpit/cockpit-server.test.mjs
 M src/ears/transcript-buffer.mjs
 M src/ears/transcript-buffer.test.mjs
 M src/mind/fire-injection.mjs
 M src/mind/fire-injection.test.mjs
 M src/mind/fire-scheduler.mjs
 M src/mind/fire-scheduler.test.mjs
?? src/chat/               ← Domain A 成果物・未追跡・本 Domain は不触
```
変更は domain-b.md §1 が申告した 8 ファイルのみ（実装 4 + テスト 4）。scope 外の変更なし。

## 2. ★ 二重発火 / 二重放送のテスト固定確認（最重要観点）

domain-b.md §3 が主張する「viewer は同じ転写バッファへ append されるため handleTranscript も通るが、二重発火・
二重放送を 2 箇所で断つ」という設計を、実装（fire-scheduler.mjs / cockpit-server.mjs）とテストの両方で確認した。

**(a) 発火側の断ち**（`fire-scheduler.mjs` :410-414）:
```js
if (entry.speaker === "viewer") {
  // ★ S7 二重発火の断ち: ... 完全な no-op で抜ける ...
  return;
}
```
`fire-scheduler.test.mjs` の「★ 二重発火の断ち: handleTranscript(viewer) は no-op」（L543-568）が:
- 名前を含む viewer 転写（`viewer("コーディこれ見て", "Taro")` 等）を 2 件 `handleTranscript` に食わせても
  `reqs.length === 0`（call が出ない）ことを assert。
- **沈黙タイマの pending 数が武装前後で不変**（`clock.pending() === pendingBefore`）ことまで assert しており、
  「no-op」が単に call を出さないだけでなく armSilence の誤起動も無いことを機械的に固定している（domain-b.md
  §3 の主張「armSilence を誤起動しない」を裏付ける唯一の直接テスト）。
- 対照として同じ本文を `handleChatMessage` に入れると `comment-call` が 1 件出ることを確認し、
  「viewer コメントの発火は handleChatMessage だけが担う」という設計意図をテストが能動的に区別している。

**(b) 放送側の断ち**（`cockpit-server.mjs` :573）:
```js
if (entry.speaker === "soul" || entry.speaker === "viewer") return;
```
耳の `onTranscript` 放送ハンドラで soul と並んで viewer を除外——viewer 行の唯一の放送元は
`ingestChatMessage`（:1046-1054）であることをソースで確認。

`cockpit-server.test.mjs` の 2 本がこれを縦串で固定:
- 「viewer コメント取り込みで append + viewer 行を 1 回だけ放送」（L1341-1377）: `makeOnAppendPipeline`（実
  ear-pipeline の `buffer.onAppend→onTranscript` 契約を再現する double・S3 追撃 domain-c の回帰テストで導入済み
  のヘルパーを再利用）を使い、`ingestChatMessage` 後に viewer 行 transcript SSE が **ちょうど 1 件**であること
  を assert。さらに 50ms 待って「遅れて 2 個目が来ない」ことまで積極確認（有界の猶予・タイムアウト依存にしない
  設計）。
- 「comment-call は fire を 1 回・selfFire kind が載る（★ 二重発火しない）」（L1379-1415）: 音声 needle にも
  テキスト needle にも命中する「コーディこれ見て」を `ingestChatMessage` に投げ、`fakeOrch.record.fireCount===1`
  ・selfFire SSE の `kind==="comment-call"` が 1 件・`kind==="call"` の selfFire が **0 件**・viewer 行
  transcript が 1 件、をすべて assert。コメント本文が「もし handleTranscript の you 経路（call 照合）を誤起動
  すれば fireCount=2 になる」ことをコメントで明記した上でその不成立を確認しており、退行検知力が高い。

いずれのテストも実装の該当分岐（:410-414 と :573）を直接踏む経路で書かれており、テストと実装の対応が明確。
★最重要観点は blocking 水準で満たされていると判断する。

## 3. domain-b.md §7「テストで固定した全分岐の一覧」逐条確認

| domain-b.md §7 の主張 | 対応する実テスト | 確認 |
|---|---|---|
| viewer+displayName 合流（soul 同型 0,0・frozen） | transcript-buffer.test.mjs L211-226 | ○（Object.isFrozen まで確認） |
| displayName 省略時 undefined（you/soul 従来同形） | 同 L228-234 | ○ |
| displayName 非文字列 throw | 同 L236-243 | ○（TypeError・size()=0 も確認） |
| you/soul/viewer 混在を `viewer(名前):` で seq 昇順整形 | fire-injection.test.mjs L64-77 | ○ |
| displayName 欠落・空白は `viewer: 本文` へ劣化 | 同 L79-86 | ○（欠落 undefined と空白 `"   "` の両方） |
| S7 v0 定数 export | fire-scheduler.test.mjs L407-412 | ○ |
| NAME_VARIANTS_TEXT_V0 命中/非命中（Cody/cody/CODY/全角/日本語/かな 命中・コピー等非命中） | 同 L414-430 | ○（`code review` の非命中まで含む） |
| comment-call 確実発火（不応期・確率・予算を無視・連続でも返す・予算消費しない） | 同 L451-463 | ○（`rngMiss`+`commentBudget:0` の悪条件下で確認） |
| comment-call busy・OFF 沈黙 | 同 L465-480 | ○ |
| comment 不応期+確率+予算（不応期内沈黙・跨いで発火） | 同 L482-499 | ○ |
| comment 確率外れ沈黙（予算も減らさない） | 同 L501-508 | ○ |
| comment 予算切れ沈黙（comment-call は予算切れでも返る） | 同 L510-526 | ○（対照確認込み） |
| comment 空文字・busy・OFF 沈黙 | 同 L528-541 | ○ |
| ★ handleTranscript(viewer) no-op | 同 L543-568 | ○（§2 で詳述） |
| コメント活動は沈黙タイマ再武装（lastFire は発火時のみ更新） | 同 L570-586 | ○（`commentProbability:0` で発火を起こさず活動効果だけ分離して確認） |
| viewer コメント取り込み＝append+viewer行1回（二重放送しない・自発OFFでfireなし） | cockpit-server.test.mjs L1341-1377 | ○ |
| comment-call が fire 1回・selfFire kind（二重発火しない） | 同 L1379-1415 | ○ |
| 耳未起動＝chatBufferAbsent 診断のみ・append/fire しない | 同 L1417-1440 | ○（viewer transcript 0 件まで確認） |
| broadcastChatStatus→chatStatus・broadcastChatDiagnostic→chatDiagnostic | 同 L1442-1461 | ○ |
| 空コメントは捨てる | 同 L1463-1485 | ○（buffer 0 件・fire 0 件・transcript SSE 0 件） |

§7 に列挙された分岐は 1 件残らず対応する実テストが存在し、テストの内容も主張どおりの挙動を固定していることを
コード上で確認した。齟齬なし。

## 4. 決定論・全 fake の確認

- `fire-scheduler.test.mjs`: `makeFakeClock()`（barge-in.test.mjs と同型の手動 fake タイマ）+ `rngHit`/
  `rngMiss`/`makeSeededRng`（線形合同法）を全面使用。コメント関連の新規テストも `nowImpl`/`rng`/
  `setTimeoutImpl`/`clearTimeoutImpl` を注入したスケジューラのみで検証しており、裸の `Math.random(`・
  裸の `setTimeout(`・`Date.now()` の実呼び出しは grep で見当たらない（既存の LLM 非依存テスト L633-640 が
  `readFileSync` で `fire-scheduler.mjs` の import ゼロ・`.ask(` 不在・SDK 参照不在をソース照合しており、
  この構造チェック自体は S6 から不変・S7 でも再度緑）。
- `cockpit-server.test.mjs`: 新規 5 本はすべて `makeOnAppendPipeline`/`makeFakeOrchestrator`（既存 in-memory
  fake ヘルパーの再利用）+ ローカル loopback HTTP/SSE クライアントのみで完結。4 ファイルの import 文を確認した
  ところ `fetch(` の実呼び出しは 1 件も無く、`src/chat/**`（Domain A のチャット器官）への import も無い
  （grep 0 件）——実 YouTube・実チャット器官へ一切出ていないという domain-b.md の主張と一致。
- `transcript-buffer.test.mjs`/`fire-injection.test.mjs`: 純関数・純データ構造のテストで時計/RNG/I/O 不要
  （nowImpl 注入のみ）。

## 5. S1〜S6 無退行の確認

各テストファイルの diff を精査し、既存テストの**期待値**が 1 件も変更されていないことを確認した。

- `transcript-buffer.test.mjs`: 変更は (i) 既存テストのタイトル文字列 1 箇所
  `"you/soul 以外"→"you/soul/viewer 以外"`（アサーション本文・期待値は無改変）と (ii) ファイル末尾への 3 本
  追加のみ。deletions は上記タイトル差し替え 1 行のみ。
- `fire-injection.test.mjs`: 変更は (i) ヘルパー `entry()` の第 4 引数 `displayName=undefined` 追加
  （既存呼び出しは影響なし・後方互換）と (ii) 2 本追加のみ。
- `fire-scheduler.test.mjs`: 変更は (i) import リストへの追加（既存 import の並び替え・削除なし）・
  (ii) `viewer()` ヘルパー追加・(iii) ファイル末尾ブロックへの 10 本追加のみ。
- `cockpit-server.test.mjs`: `git diff` で **deletions 0**（純粋な追加のみ・155 insertions）。既存 60 本は
  1 行も触れられていない。

`node --test` 全体 583/583 緑（既存 563 本 + 新規 20 本）を自分の実行で確認しており、既存テストの改変によって
退行が隠蔽される余地はない。加えて `handleTranscript`（you/soul 分岐）・`formatFireInjection` の you/soul
整形・`transcriptBuffer` の you/soul 検証など、S1〜S6 が固定してきた分岐のソースコードそのものも読み、
viewer 分岐が既存分岐の**手前**（you/soul 判定より先）に追加されているだけで、you/soul の判定ロジックに
変更が入っていないことも確認した（fire-scheduler.mjs L401-425）。

## 6. non-blocking の指摘

1. **displayName が偶然「Cody」等を含むケースの否定テスト不在**: comment-call 判定は `msg.text` のみを
   `commentNeedles` に照合し `displayName` は照合に使わない（domain-b.md §2-3・fire-scheduler.mjs :437 の
   コメントで明記）。しかし `fire-scheduler.test.mjs` には「`displayName:"Cody"` だが `text` に呼びかけを
   含まないコメントは comment-call にならない」ことを直接固定するテストが見当たらない（grep で該当ケース
   0 件）。実装（:445 `textMatchesName(msg.text, commentNeedles)`）を読む限り displayName は本当に無関係な
   ので実害は無いが、「displayName は照合に使わない」という設計判断自体をテストで積極的に守ってはいない。
   non-blocking（次の追撃 wave か followup 台帳向き）。
2. **paid（スーパーチャット）kind の合流経路テスト不在**: domain-b.md §9-5 が明記する通り v0 は `kind` を
   区別せず text/displayName だけで合流する設計であり、`ingestChatMessage` のシグネチャも `{text, displayName}`
   のみを見る（:1028-1060）。実テスト（cockpit-server.test.mjs の S7 チャット取り込み節）は `kind:"text"` を
   渡す呼び出ししかなく、`kind:"paid"` を渡しても text/displayName だけで同じ扱いになる（kind 無視）ことを
   直接固定したテストは無い。ソース上は `msg.kind` を読んでいないので実害は無いが、「kind を意図的に無視する」
   という設計判断の正当性をテストが明示的に守ってはいない。non-blocking（Domain C の裁定領分・§9-5 で申し
   送り済みの内容と表裏）。

いずれも blocking 基準（全 fake 縦貫通・★二重発火/二重放送の断ち・決定論・S1〜S6 無退行）には抵触しない
付随的な穴であり、機械ゲートを止める理由にはならないと判断した。

## 7. 無音・ハング

`node --test`（全体・個別 4 ファイルとも）すべて自然終了しプロンプトへ復帰した。SSE クライアントの
`waitFor` はすべて `ms` 付きタイムアウト（既定 3000ms・`timer.unref()` 済み）で有界。実マイク・実チャット
器官・実ネットワークへの到達経路はソース上・実行ログ上ともに見当たらない。

## 8. §質問（Orch への申し送り）

- なし。test レーンとして判断に迷う点は無かった。domain-b.md §9 の§質問（バッファ所有権 escalate・comment
  予算 30 の妥当性・混在ケース・視覚優先発火・paid 扱い・状態表示材料・人間ゲート申し送り）はいずれも設計/
  spec レーンまたは Domain C の領分であり、test レーンの判定には影響しない。§6 の non-blocking 2 点は
  追加テストの提案として記載したのみ。

## 結論

- **判定: PASS（blocking 指摘なし）**。
- ★二重発火/二重放送の断ち（handleTranscript(viewer) no-op・viewer 放送除外）は実装・テストの両方で確認済み
  で最も強い根拠を持つ。
- domain-b.md §7 の全分岐一覧は実テストと 1 件残らず対応しており齟齬なし。
- S1〜S6 無退行（既存 563 本 diff 上無改変・583/583 緑）を自分の実行で確認した。
- non-blocking: displayName 非照合の否定テスト・paid kind 無視の否定テストの追加を推奨（次の追撃 wave か
  followup 台帳向き）。
