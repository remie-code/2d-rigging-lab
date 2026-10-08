# S7 Domain A レビュー（test レーン）

> レーン: **test**（チャット器官 `src/chat/` の壊れ方全分類がテストで固定されているか・死んでも魂に無影響のテスト固定・
> 決定論・ネット純度）。
> レビュアー: Review-Sylph。呼び出し元: Orch-Sylph（S7 wave 実行責任者）。
> 対象: `apps/soul/agent`（`node --test`）／`src/chat/innertube.mjs`・`innertube.test.mjs`・
> `src/chat/live-chat-client.mjs`・`live-chat-client.test.mjs`・`src/chat/fixtures-innertube.mjs`。日付: 2026-07-14。
> 読み取り専任・自分で再実行した生数字を根拠にする。install/commit/器コード変更・実ネットに出るテストの新規作成は
> 一切実行していない。`.tmp/facex-*` は触っていない。
> **総合判定（再確認 3 巡目・最終）: PASS（blocking ゼロ）。** 2 巡目で挙げた blocking 1 件
> （追加テスト 2「stop() 後の想定外 throw は再接続しない」が false 分岐を実行を伴って検証していない）は、
> Gnome によるテスト 1 本のみの書き直し（ソース `live-chat-client.mjs` は不変）で解消を確認した（§0-3 参照）。
> 2 巡目（FAIL 判定時点）・1 巡目（内訳訂正前）の記録は末尾に保存。

## 0-3. 再確認（3 巡目）— blocking 解消確認

### 経緯

2 巡目で指摘した blocking: 追加テスト 2 が `client.stop()` を先に呼んでから `clock.advance()` していたため、
`stop()` の `clearTimer()` で次 poll タイマ自体が撤去され、仕込んだ 2 番目の boom レスポンスがそもそも fetch
されず、`launch()` catch-all 末尾ガード `if (!stopped && state !== "dead")`（live-chat-client.mjs L361）の
**false 分岐が一度も実行されていなかった**。Orch の裁定により、Gnome が**このテスト 1 本のみ**を書き直した
（ソースは不変）。

### 1. 書き直したテスト 2 が false 分岐を実経路で踏むか — **確認: 踏んでいる（PASS）**

`live-chat-client.test.mjs` L370-459（テスト名「poll 進行中に stop() が割り込み、その後 catch-all に想定外 throw
が落ちても終端のまま再接続しない」）を読み、`live-chat-client.mjs` の実装（`runPoll` L291-337・`launch` L344-373・
`stop()` L391-399）と突き合わせて検証した。

- テストは `makeClient()` ヘルパを使わず、**手動の deferred fetch**（L396-408）を独自に組んでいる。
  `get_live_chat` を含む URL のときは `resolveChatFetch` に resolver を退避したまま **pending の Promise を返す**
  （`await new Promise((resolve) => { resolveChatFetch = resolve; })`）。watch は即時成功。
- `client.start()` を **await せず**起動（L425）→ `chatRequested` を待って bootstrap 成功・`state==="live"`・
  初回 poll が `fetchLiveChat` の await で中断している地点まで進めたことを `chatCalls===1`/`watchCalls===1` で確認（L426-429）。
- **この中断中に `client.stop()` を割り込ませる**（L432）→ `stopped=true`・`state==="dead"` になったことを直接
  assert（L433）。
- その後 `resolveChatFetch({ ok:true, ..., json: async () => boom })` で fetch を解決（L439）→ `runPoll` の
  await が再開 → `json = boom` → try/catch の外で呼ばれる `parseLiveChatResponse(json)`（live-chat-client.mjs
  L309）が `boom.continuationContents` ゲッターで throw → `launch()` の catch-all（L346-364）に到達。
  **到達時点で `stopped===true` かつ `state==="dead"` が既に成立している**ため、L361 のガード
  `if (!stopped && state !== "dead")` は **false と評価される実行**を伴って踏まれる。
- assert 内容:
  - `internalError` 診断が出る・メッセージが `/late boom/` に一致（catch-all が実際に発火した証拠、L444-446）。
  - `extractFailed`＋`action:"retrying"` 診断が**出ていない**こと（`scheduleReconnect` が呼ばれなかった証拠、L449）。
  - `clock.pending()===0`（再接続タイマが一切スケジュールされていない、L451）。
  - `state==="dead"` のまま（L453・L456）。
  - `clock.advance(1_000_000)` 後も `watchCalls`/`chatCalls` が増えない（bootstrap 再取得も再 poll も無い、L456-458）。
- これにより 2 巡目で欠けていた「false 分岐の実行を伴った検証」（診断は出るが再接続はしない、という終端ガードの
  実効性）が直接固定された。前回指摘した「`stop()` を先に呼んでから `advance()` するため走らない」という構造上の
  欠陥は解消されている。

### 2. ソース不変 — **確認: 変更なし（PASS）**

- `git diff -- apps/soul/agent/src/chat/live-chat-client.mjs` を実行 → 出力 0 行（差分なし）。
- ただし `apps/soul/agent/src/chat/` はディレクトリごと未追跡（`git status --porcelain -- apps/soul/agent/src/chat/`
  → `?? apps/soul/agent/src/chat/`）のため、`git diff` は index/HEAD 比較であり untracked ファイルの差分検出には
  本質的に無力（常に空を返す）。そのため `git diff` の結果のみに頼らず、**2 巡目レビューが引用したコード片・行番号
  ・コメント文言**（`launch()` L344-373・`runPoll()` L291-337・`stop()` L391-399・catch-all ガード
  `if (!stopped && state !== "dead")`・関連コメント文言）を今回自分で読んだ現物のファイルと逐語照合し、**完全一致**
  することを確認した（本レビューの §0-3 冒頭・上記 §1 で引用した行番号・コード片は今回自分で読んだ実ファイルから
  そのまま起こしたもの）。以上 2 点を根拠に、ソースは 2 巡目時点から変更されていないと判断する。

### 3. 追加テスト 1（内部例外→internalError→retrying→回復）の温存 — **確認: 温存されている（PASS）**

- `live-chat-client.test.mjs` L331-368 に、2 巡目レビューで PASS 判定した内容と同一の実装（`boom` の
  `continuationContents` ゲッター throw・`internalError`＋`extractFailed`/`action:"retrying"` 診断・
  `nextDelay()===BACKOFF_BASE_MS`・`clock.advance()` 後の `watchCalls` 増分での回復確認）がそのまま存在することを
  確認した。書き直しはテスト 2 のみで、テスト 1 に手は入っていない。

### 4. 決定論・ネット純度 — **確認: 保たれている（PASS）**

- 書き直したテスト 2 の `fetchImpl`（L396-408）は `url` に応じて即時成功オブジェクトまたは pending Promise を
  返すだけの純粋な fake 関数で、実 `fetch`/`globalThis.fetch` の呼び出しは無い。`nowImpl`/`setTimeoutImpl`/
  `clearTimeoutImpl` は共通の `makeFakeClock()` を明示的に注入、`rng: () => 0` も固定（L415-420）。
  deferred な pending Promise は **同一プロセス内でテスト自身が resolver を呼ぶ**構造であり、実ネットワーク・
  実タイマ・実乱数への依存は無い。
- `grep -n 'fetch(' src/chat/live-chat-client.test.mjs` で `fetchImpl`/`fetchLiveChat`/`fetchWatchPage`/
  `makeFakeFetch`/`globalThis.fetch` 以外の直接 `fetch(` 呼び出しがヒットしないことを確認した。

### 5. 自分で再実行した機械ゲート生数字

`cd apps/soul/agent && node --test`（タイムアウト 300s・1 回で緑・空/interrupted なし・再試行不要）:

```
1..563
# tests 563
# pass 563
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1246.8738
```

`node --test src/chat/live-chat-client.test.mjs`:

```
1..20
# tests 20
# pass 20
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 99.4967
```

`node --test src/chat/innertube.test.mjs`:

```
1..25
# tests 25
# pass 25
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 92.6891
```

`grep -c '^test(' src/chat/live-chat-client.test.mjs` → `20`（本数は 2 巡目時点から変化なし。テスト 2 は書き直し
であり本数増減を伴う追加ではない）。全体 563/563・chat 分 25+20=45 は domain-a.md §6 の Claim・2 巡目レビュー時点
の数字と完全一致し、既存テストの退行は無い。

### 3 巡目 総合判定

**PASS（blocking ゼロ）**。2 巡目で挙げた唯一の blocking（追加テスト 2 が catch-all 終端ガードの false 分岐を
実行を伴って検証していない）は、Gnome によるテスト 1 本のみの書き直しで解消された。書き直したテストは
「poll 進行中（`fetchLiveChat` の await 中）に `stop()` が割り込み、その後 boom 解決で catch-all に落ちる」という
レースを手動 deferred fetch で実際にたどり、(a) `internalError` 診断発火、(b) 再接続不実行
（`extractFailed`+`retrying` 診断なし・`clock.pending()===0`・advance 後も fetch 再試行なし）、(c) `state==="dead"`
維持、をすべて直接 assert している。ソース（`live-chat-client.mjs`）は `git diff` 空・コード逐語照合の両方で
不変を確認、温存された追加テスト 1 も健在、決定論・ネット純度も保たれ、機械ゲートは 563/563 緑・退行なし。
以上により §0-2（2 巡目）で保留した blocking は解消済みと判断し、本レビューの最終判定を **PASS** とする。
非 blocking の残項目は §6（1 巡目の non-blocking 3 件、いずれも修正不要）を参照——2 巡目・3 巡目のいずれの
再確認によっても新規の non-blocking は発生していない。

---

## 0-2. 追修正 再確認（2 巡目・履歴）— catch-all 経路のテスト固定の検証

`live-chat-client.mjs` の `launch()`（L344-373）と `live-chat-client.test.mjs` に追加された 2 本
（L331-368・L370-393）を、実装コード（`innertube.mjs` の `parseLiveChatResponse` L361-365 含む）と
突き合わせて検証した。

### 追加テスト 1（L331-368）「parse が想定外 throw…internalError 診断 → retrying → 再接続で回復」— **PASS**

- 注入する `boom = { get continuationContents() { throw new Error("unexpected parse boom"); } }` は、
  `parseLiveChatResponse(json)`（innertube.mjs L365）の `json.continuationContents?.liveChatContinuation` という
  **実在するプロパティアクセス**を通じて本物の例外を発生させる（モックで `parseLiveChatResponse` 自体を差し替えたり
  `launch()` を直接呼んだりする迂回はしていない）。
- `runPoll()`（live-chat-client.mjs L291-337）は `fetchLiveChat` の呼び出しのみ try/catch で守られており、
  直後の `parseLiveChatResponse(json)`（L309）は try/catch の外——ここでの throw は `runConnect` 経由で
  `launch()` の catch-all（L346-364）まで素通りする、という domain-a.md §3 の設計主張どおりの経路を実際に踏む。
- 到達後の挙動（`internalError` 診断・メッセージが `/parse boom/` に一致・`extractFailed`+`action:"retrying"` 診断・
  `statuses` 末尾が `"retrying"`・`nextDelay()===BACKOFF_BASE_MS`）をすべて直接 assert し、さらに
  `clock.advance(BACKOFF_BASE_MS)` 後に **`fetcher.watchCalls()` が実際に増え**（＝バックオフタイマ発火で
  `launch(runConnect)` が再度呼ばれたことを外形から確認）、`state==="live"` に回復することまで確認している。
  「診断だけ出して実際には再接続していない」という偽装を watchCalls 増分で反証する設計になっており、質が高い。
- fake fetch / fake clock / rng=0 のみで構成され、決定論・ネット純度も他のテストと同様に保たれている。

### 追加テスト 2（L370-393）「stop() 後に想定外 throw が起きても再接続しない」— **blocking: 主張する経路を踏んでいない**

- テストの手順: `client.start()` → poll 成功で `live`（次 poll がタイマ予約される）→ `client.stop()` → `clock.advance(1_000_000)`
  → `state` が `"dead"` のまま・`internalError` 診断が無いことを確認。
- しかし `stop()`（live-chat-client.mjs L391-399）は `clearTimer()` を呼ぶため、`stop()` の時点で**予約済みの次 poll
  タイマ自体が破棄される**。したがって `clock.advance(1_000_000)` をしても `launch(runPoll)` は一切呼ばれず、
  スクリプトに仕込んだ 2 番目の `boom` チャットレスポンスは**そもそも fetch されない**。
  テスト自身のコメント（L392「そもそも poll が走らない」）もこれを認めている。
- つまりこのテストが実際に検証しているのは「`stop()` 後はタイマが残らずポーリングが再開しない」という、
  1 巡目レビューで既に PASS 判定済みの `stop() で dead・タイマ全撤去・再ポーリングなし`（L415-431）テストと
  **同一の主張の重複**であり、テスト名・domain-a.md §3/§4 が主張する「**想定外の throw が (すでに stopped/dead の
  状態で) catch-all に落ちても再接続しない**」という `launch()` の catch 節末尾のガード
  （`if (!stopped && state !== "dead") { scheduleReconnect(...); }`、L361-363）の **false 分岐そのものは
  一度も実行されていない**。
- 実際にこの分岐を検証するには、`stopped`/`state==="dead"` が既に成立した**後**に catch-all が例外を拾う状況
  （例: `clock.advance()` でタイマを発火させ `launch(runPoll)` の非同期関数が `fetchLiveChat` の await で一旦
  中断している最中に `client.stop()` を呼び、その後にマイクロタスクが流れて `parseLiveChatResponse` の boom throw が
  catch-all に落ちる、という「stop がポーリング進行中に割り込む」レース）を組む必要があるが、現状のテストは
  `stop()` を先に呼んでから `advance()` しているため、このレースは一切発生しない。
- 影響: このガード分岐（stopped/dead 時に catch-all が誤って再接続してしまわないこと）は**現状どのテストによっても
  実行を伴って検証されていない**。コードの見た目は正しそうだが、「テストで固定した」という domain-a.md §3/§4 の
  主張（表の該当セル「dead・stopped は終端のまま再接続しない」）は、少なくともこの追加テストに関しては**未達成**。
  設計・テスト両レーンが指摘した穴（「テスト未固定」）が、この一点について厳密には再発している。

### 3. 決定論・ネット純度・退行なし — **PASS**

- 追加 2 本とも `fetchImpl`/`nowImpl`/`setTimeoutImpl`/`clearTimeoutImpl`/`rng` を `makeClient()` 経由で注入するのみで、
  実 fetch・実タイマ・実乱数への依存は無い（grep でも `fetch(` の直接呼び出しは追加テスト中に無いことを確認済み）。
- 自分で `cd apps/soul/agent && node --test` を実行（1 回で緑・空/interrupted なし・再試行不要）:
  ```
  1..563
  # tests 563
  # pass 563
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  # duration_ms 1543.935
  ```
  `node --test src/chat/live-chat-client.test.mjs` → `1..20 / pass 20 / fail 0`。
  `node --test src/chat/innertube.test.mjs` → `1..25 / pass 25 / fail 0`。
  いずれも domain-a.md §6 の Claim（563/563・25+20=45）と完全一致。`grep -c "^test("
  live-chat-client.test.mjs` も 20 で一致。
- 既存 561 本（1 巡目レビュー時点）+ 追加 2 本 = 563 が全緑で、既存テストの退行は無い（個別ファイル実行の
  20/20・25/25 も全緑）。

### 総合判定（2 巡目・履歴——3 巡目で解消済み。§0-3 参照）

**FAIL（blocking 1 件）**: 追加 2 本のうち 1 本（「stop() 後の想定外 throw は再接続しない」）は、
`launch()` catch 節の `stopped`/`dead` ガード分岐を実行を伴って検証しておらず、domain-a.md が主張する
「catch-all が既に終端状態で発火しても再接続しない」ことのテスト固定は**未達成**。もう 1 本
（内部例外→internalError→retrying→回復）は堅牢に固定できている。全体の機械ゲートは 563/563 緑・退行なし・
決定論・ネット純度は保たれている。

**Orch への申し送り**: このガード分岐を実行込みで検証するには、poll 進行中（`fetchLiveChat` の await 中）に
`client.stop()` を割り込ませ、その後で boom レスポンスが解決して catch-all に落ちる、というレースを組んだ
テストを追加する必要がある（例: `clock.advance()` でタイマ発火直後・`await` 完了前に `stop()` を呼ぶ）。
この 1 点のみの狭い追加修正で足りると判断する。

---

## 1 巡目（初回）レビュー本文（参考保存・以下は追修正前の判定）

> 以下は追修正前（内部例外の catch-all テスト追加前）の 1 巡目レビューの本文。§0 の生数字・§1 の内訳等は
> 当時のもの（561/561・43/43、内訳訂正後 25+18）であり、追修正後の現状（563/563・25+20）とは異なる。
> 参考のため保存する。総合判定は上記 2 巡目のものを正とする。

## 0. 自分で再実行した `node --test` 生数字

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s 付き・1 回で緑・空/interrupted なし・再試行不要）:

```
1..561
# tests 561
# suites 0
# pass 561
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1250.6987
```

`cd apps/soul/agent && node --test src/chat/innertube.test.mjs src/chat/live-chat-client.test.mjs`（chat 分のみ）:

```
1..43
# tests 43
# suites 0
# pass 43
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 110.5835
```

- domain-a.md §6 の Claim（tests 561 / pass 561 / fail 0・chat 分のみ 43/43）と自分の実行結果（総数・pass/fail）は
  **完全一致**。skipped 0 / todo 0 のため緑の偽装は無い。1 回の実行で安定して緑（再試行不要）。
- **内訳照合（訂正）**: domain-a.md §1 は「`innertube.test.mjs` 22 本 + `live-chat-client.test.mjs` 21 本 = 43」と
  記載しているが、`grep -n '^test('` で自分で機械的に数えたところ **`innertube.test.mjs` は 25 本、
  `live-chat-client.test.mjs` は 18 本（25+18=43）**であり、ファイル単位の内訳配分が domain-a.md の記載と異なる
  （合計 43 は一致）。個別テストの内容（§1 の逐条照合）自体には過不足なく対応しており挙動固定の正当性に影響は
  無いため blocking にはしないが、domain-a.md §1 の本数記載は不正確であり non-blocking として §6 に記載する。

## 1. domain-a.md §4「壊れ方全分類」表 vs 実テスト — 逐条照合（blocking 基準の核心） — **PASS**

domain-a.md §4 の表の各行について、対応する実テストの存在と主張内容の一致を個別に確認した。

| 分類（domain-a.md §4） | 実テスト（ファイル:関数） | 確認結果 |
|---|---|---|
| 4 点抽出成功 | `innertube.test.mjs`「生きた配信 HTML から 4 点を抽出」(L81-88)・`live-chat-client.test.mjs` happy path (L133-155) | 一致。apiKey/clientVersion/continuation/videoId が合成 fixture から取れることを直接 assert |
| continuation ループ | `live-chat-client.test.mjs`「bootstrap で live に上がり…ページを跨いでメッセージを配信」(L133-155) | 一致。C0→C1→C2 と continuation が前進し、"one"→"two" のメッセージがページを跨いで配信されることを確認。`nextDelay()===5000` で timeoutMs 尊重も同一テストで固定 |
| timeoutMs 欠落/床 | 「timeoutMs 欠落時は defaultPollIntervalMs、床 POLL_FLOOR_MS を下回らない」(L157-171) | 一致。欠落→default 4000ms、10ms→床 1000ms の両方を個別 assert |
| renderer 分岐（text/paid/無視） | 「text と paid（本文あり）を配信し、無視種別は ignoredRenderers 診断へ」(L175-197) | 一致。text/paid(本文あり) が messages に、membership と paid(本文なし) が ignored に正しく分岐 |
| 抽出失敗（HTML に 4 点なし） | 「4 点抽出失敗は retrying…再接続で回復」(L211-227) | 一致。extractFailed 診断・`delayMs===BACKOFF_BASE_MS`・バックオフ後 live 復帰を確認 |
| スキーマ変化（レスポンス全崩れ） | 「get_live_chat が JSON オブジェクトでない…extractFailed → retrying」(L231-239) | 一致 |
| スキーマ耐性（継続あり・新着なし） | 「継続はあるが actions が空（新着なし）は healthy＝live 継続」(L199-207) | 一致。空 actions がエラーではなく健全な無音ポールとして扱われることを直接確認（parseLiveChatResponse 側の同趣旨テストも innertube.test.mjs L180-184 で重複固定） |
| notLive（未開始/リプレイ） | 「notLive（未開始）は retrying で待ち、開始したら live に上がる」(L243-255)・`extractBootstrap` 系 (innertube.test.mjs L110-118) | 一致。未開始/isReplay=true の両パターンが notLive として extractBootstrap 単体でも client 縦貫通でも固定されている |
| ended（配信終了） | 「配信終了（次 continuation なし）は dead に落ち、タイマを残さない」(L259-280) | 一致。dead 到達・`pending()===0`・1,000,000ms advance しても復活しないことまで確認（「終端で本当に終わる」ことを積極的に反証しようとする良いテスト） |
| ネットワーク死→retrying遷移 | 「bootstrap の fetch 失敗は network → retrying」(L284-298)・「poll 中の fetch 失敗も…」(L300-317)・「HTTP 非 2xx も network」(L319-327) | 一致。3 パターン（bootstrap reject / poll reject / 非2xx）を個別に固定、poll 中失敗は bootstrap からやり直すフローまで検証 |
| バックオフ遷移 | 「連続失敗でバックオフが base→2x→4x と増え、cap で頭打ち」(L331-345) | 一致。rng=0 固定で `[1000,2000,4000,4000]` を直接 assert（ジッター 0 の決定論値） |
| timeoutMs 尊重・欠落時の床 | 上記「timeoutMs 欠落時は…」と同一テストで固定 | 一致（表の重複項目） |
| stop() でタイマ全撤去 | 「stop() で dead・タイマ全撤去・再ポーリングなし」(L349-365) | 一致。`pending()===0`・advance してもメッセージが来ない("two" が来ない)ことを確認 |
| フック throw 握り | 「onMessage が throw しても listenerError 診断に落ちて常駐は続く」(L369-396)・「onStatus / onDiagnostic の throw も器官の外へ漏れない」(L398-422) | 一致。`start()` が reject しないこと・状態が live 維持されることを直接確認 |
| 独立性（構造・import ゼロ） | 「chat 器官のソースは魂の他部位（親ディレクトリ）を import しない」(L426-442) | 一致。正規表現で `./` 以外の相対 import（`../`）が無いことを機械的に照合。自分でも `innertube.mjs`/`live-chat-client.mjs` を読み、実際に import 文が `./innertube.mjs` の 1 本のみであることを目視確認済み |

- 表の 14 行すべてに対応する実テストが実在し、domain-a.md の主張どおりの挙動を固定していることを確認した。**テスト未固定の壊れ方分類は無い。**
- `internalError`（想定外の内部例外を握るフォールバック）と `connected`/`stopped`/`ignoredRenderers` 診断は domain-a.md §4 の表自体が
  「壊れ方全分類」として契約していない（§3 の診断一覧には載るが §4 テスト表には無い）ため、テスト不在は契約との不一致ではない
  （§ non-blocking 2 で軽微観察として触れる）。

## 2. 器官が死んでも魂に影響しないことのテスト固定 — **PASS**

- **フック throw の非漏洩**: 上記 L369-396 / L398-422 で onMessage・onStatus・onDiagnostic いずれの throw も `start()` を reject させず、
  常駐（`state==="live"`）が継続することを直接確認した。`live-chat-client.mjs` L149-162 の `emitGuarded` 実装
  （try/catch → `listenerError` 診断）と、L133-141 の `emitDiagnostic`（診断リスナ自身の throw はループ回避のため握るだけ）を読み、
  テストの期待値と 1 対 1 で対応することを確認した。
- **独立性（構造）**: L426-442 のテストは正規表現でファイル内の相対 import を全数抽出し `./` 以外（`../`）が無いことを機械照合している。
  自分で `innertube.mjs`・`live-chat-client.mjs` の import 文を目視確認し、`live-chat-client.mjs` が `./innertube.mjs` のみを import、
  `innertube.mjs` は import 文なし（依存ゼロ）であることを確認した。魂の他部位（`../ears/**`・`../mind/**` 等）への import は
  実装・テストともにゼロ。
- **逆流路の不在**: 器官が提供するのは `onMessage`/`onStatus`/`onDiagnostic`（購読・フック）のみで、器官から魂側へ直接呼び出す
  経路は無い（合流は Domain B が外部から onMessage 経由で行う設計）。これはテストというより構造上の性質だが、
  独立性テストの import ゼロ確認と合わせて「合流点は 1 箇所（フック経由）に限定される」ことの担保になっている。

## 3. 決定論 — **PASS**

- `live-chat-client.test.mjs` の `makeFakeClock()`（L24-62）は `fire-scheduler.test.mjs` 写経のネスト scheduling 対応版
  （手動 `advance(ms)` で最も早いタイマから順に発火・同時刻はタイマ ID 昇順）で、実時間待ちが一切ない。561 本全体の
  `duration_ms` が 1250ms 程度に収まっていること自体が、chat 分のバックオフ待ち（cap 30000ms 含む）が実時間で
  待たれていないことの傍証になっている。
- `makeFakeFetch(script)`（L72-97）は URL に `get_live_chat` を含むかで watch/chat を振り分け、キュー方式で応答を返す
  fake fetch。全テストヘルパ `makeClient()`（L100-120）が `fetchImpl: fetcher.fetchImpl` を必ず明示的に注入しており、
  `createLiveChatClient` の既定値 `globalThis.fetch`（`live-chat-client.mjs` L92）にフォールバックする経路はテストでは
  一度も使われない。
- RNG は全テストで `rng: () => 0`（無ジッター）に固定。バックオフのジッター `[0,20%)` が乱数依存で不安定にならないよう
  排除されており、`[1000,2000,4000,4000]` という厳密な数値 assert が成立する根拠になっている。
- 時計は `nowImpl: clock.now`（fake clock の内部カウンタ）で、`Date.now`/`performance.now` の直接使用はテスト・実装
  いずれにも無い（`live-chat-client.mjs` は `nowImpl` を診断の `atMs` にのみ使用）。
- タイマは `setTimeoutImpl`/`clearTimeoutImpl` を fake clock のものに差し替えており、実 `setTimeout` は使われない
  （`client.idle()` による進行中サイクルの settle 待ちも Promise ベースで実時間に依存しない）。

## 4. ネット純度（最重要） — **PASS**

- `grep` で `apps/soul/agent/src/chat/` 配下の `fetch(` / `globalThis.fetch` 出現箇所を確認した結果、ヒットは
  `live-chat-client.mjs` L65（JSDoc コメント）と L92（`const fetchImpl = options.fetchImpl ?? globalThis.fetch;` という
  **既定値定義**のみ）で、テストファイル（`innertube.test.mjs`・`live-chat-client.test.mjs`）内には `fetch(` の直接呼び出しも
  `globalThis.fetch` の参照も一切無い。
- 全 43 本の chat テストで `fetchImpl` が明示的に fake 関数として注入されている（`fetchWatchPage`/`fetchLiveChat` の単体テストは
  無名 async 関数を直接渡し、`live-chat-client.test.mjs` は `makeFakeFetch()` を経由）ことを確認した。実 YouTube への HTTP は
  どのテストからも発生し得ない。
- `git status --porcelain -- apps/soul/agent` は `?? apps/soul/agent/src/chat/`（新設ディレクトリのみ）で、
  chat 器官は新規追加であり既存の器官・器コードには手が入っていない（この観点は本来 spec/design レーンの主眼だが、
  ネット純度確認のついでに新設スコープの外形を確認した）。
- 実配信を要するテスト・preflight は `src/chat/` 配下に存在しない（`node --test` の全 561 本がネットワークタイムアウトや
  DNS 解決の兆候なく 1.25 秒で完了していることも傍証）。

## 5. fixture の質 — **PASS（軽微観察 1 件は non-blocking）**

- `fixtures-innertube.mjs` 冒頭のコメントで「実 YouTube ページ由来のバイト列ではない」ことが明記されており、
  実装（`ytcfgBlock`/`ytInitialDataBlock`/`textAction`/`paidAction`/`ignoredAction`/`liveChatResponse`）を読んだ結果、
  実際に手書きの合成オブジェクトを `JSON.stringify` で組み立てているのみで、実ページの HTML を丸写ししたような
  痕跡（実際の apiKey 値・実際の continuation トークン・実際のユーザー名等）は無いことを確認した。
- fixture は innertube のスキーマ要点（ytcfg の 2 キー・`ytInitialData` の `conversationBar.liveChatRenderer`・
  `continuations[0]` の reload/invalidation/timed 種別・`continuationContents.liveChatContinuation` の
  continuations/actions・renderer 種別分岐）を過不足なく模しており、`extractInitialData` の
  「ネストと `}` を含む文字列を跨いで JSON を切り出す」テスト（innertube.test.mjs L68-72）は fixture 生成ではなく
  直接手書きの JSON でブレース走査の頑健性（貪欲/怠惰 regex では取れないケース）を突いており、fixture への
  過度な依存に逃げず実装の穴を狙ったテストになっている。
- **軽微観察（non-blocking）**: `ytInitialDataBlock` のコメント（fixtures-innertube.mjs L35）に「合成なので
  `</script>` を含めない」とある通り、実際の watch ページでは `ytInitialData` の JSON 文字列内に `</script>` が
  含まれる場合にエスケープ（`<\/script>`）される可能性があるが、この経路は fixture・テストのどちらでも踏まれていない。
  `sliceBalancedObject`（innertube.mjs L115-146）はブレースと文字列状態・`\` エスケープは追跡するが、
  `<\/script>` 特有のエスケープパターンを想定したテストは無い。domain-a.md §7 の§質問5「実疎通で cookie/consent 等が
  必要になるかは人間ゲートで確認」と同種の「実ページ固有の細部は機械テストでは踏み切れない」領域であり、
  blocking にはしない。

## 6. blocking / non-blocking の分離

**blocking: ゼロ。**

- 壊れ方全分類（14 項目）はすべて実テストで固定され、domain-a.md §4 の主張と一致。
- 器官が死んでも魂に無影響であることが、フック throw 握りテストと独立性（import ゼロ）の構造テストで固定されている。
- 全テストが fake clock / fake fetch / 定数 rng で決定論的。実時間・実乱数・実ネットへの依存は無い。
- ネット純度: 実 YouTube への HTTP はテストのどこからも発生しない。fixture は手書き合成でありバイト列の持ち込みも無い。

**non-blocking（軽微観察・修正不要）:**

1. **fixture が `</script>` エスケープパターンを踏んでいない**（§5 参照）。実ページでの `ytInitialData` 直後の
   エスケープ挙動は機械テストの対象外（fixture コメントで意図的に明記済み）。人間ゲートの実疎通（§質問4/5 の領分）で
   初めて確認される事項であり、followup 台帳向きの観察。
2. **`internalError` 診断パスの直接テストが無い**: `live-chat-client.mjs` の `launch()`（L344-364）は「想定外の内部例外」を
   `internalError` 診断に落とすフォールバックだが、通常は各段の try/catch（bootstrap/poll 個別）で握られるため
   到達しにくい防御的コードであり、domain-a.md §4 のテスト表自体もこの分類を「固定すべき壊れ方」として契約していない。
   カバレッジの空白ではあるが、契約外のため blocking にはしない。
3. **domain-a.md §1 のファイル別テスト本数記載が不正確**（§0 参照）: 「innertube.test.mjs 22 本 + live-chat-client.test.mjs
   21 本」という記載は、自分で `grep -n '^test('` を実行して数えた実数（25 本 + 18 本）と一致しない。合計 43 は正しく、
   個別テストの内容も §1 の逐条照合で過不足なく対応しているため挙動固定の正当性には影響しないが、契約文書の
   記述精度としては訂正価値がある。

## 総合判定

**PASS**（blocking ゼロ）。自分で実行した生数字 561/561/0（全体）・43/43/0（chat 分のみ）は domain-a.md §6 の Claim と
合計値で完全一致・いずれも 1 回で緑・ハングなし（ファイル別内訳の記載精度のみ non-blocking 3 で訂正）。
domain-a.md §4 の「壊れ方全分類」表の 14 行すべてに対応する実テストが実在し、主張どおりの挙動（continuation ループの
前進・renderer 分岐・notLive は retrying で待つ／ended は dead で終端・ネットワーク死からの回復・バックオフの厳密な
数値遷移・stop() の完全撤去・フック throw の非漏洩・独立性の機械照合）を固定していることを実テストコードで逐条確認した。
決定論（fake clock/fetch/rng 全注入）とネット純度（`fetchImpl` 注入以外の実 fetch 呼び出しがテストに一切無い・
fixture は手書き合成でバイト列の持ち込みなし）もコードと grep で確認済み。non-blocking 3 件（`</script>` エスケープ
未踏・`internalError` パス未直接テスト・domain-a.md §1 のファイル別本数記載の誤り）はいずれも修正不要または
軽微な文書訂正であり、blocking 基準には抵触しない。

## §質問（Orch への申し送り）

1. domain-a.md §7 の§質問5（実疎通で cookie/consent 処理が必要になる可能性）は、本レビューの non-blocking 1
   （`</script>` エスケープ未踏）と同根の「実ページ固有の細部は機械テストでは踏み切れない」領域だと判断した。
   人間ゲートでの実疎通時にこの 2 点をまとめて followup 台帳の同一項目として扱ってよいか、Orch の裁定を仰ぎたい。
2. `internalError` 診断パス（non-blocking 2）は防御的フォールバックでありテスト表の契約外と判断したが、
   Domain B/C 側でこの診断 kind を UI 表示等に使う予定がある場合は、直接テストを足す価値が出るかもしれない
   （現時点では test レーンとして blocking 化する根拠はないため申し送りのみ）。
