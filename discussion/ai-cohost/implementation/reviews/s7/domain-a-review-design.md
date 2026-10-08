# S7 Domain A レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph。読み取り専任（唯一の書き込みは本成果物）。
> 日付: 2026-07-14（初回）／2026-07-14（追修正 再確認・2 巡目）。対象: `apps/soul/agent/src/chat/**`（S7 Domain A「チャット器官・YouTube Live チャット取得」実装）。
> 総合判定: **PASS**（追修正で §6-a の non-blocking 指摘は解消。残 non-blocking は §6-b/c・followup 系のみ）。

---

## 追修正 再確認（2 巡目）— 狭い再レビュー

対象差分: `apps/soul/agent/src/chat/live-chat-client.mjs`（`launch()` の catch 節）・
`apps/soul/agent/src/chat/live-chat-client.test.mjs`（テスト 2 本追加）・
`discussion/ai-cohost/implementation/waves/s7/domain-a.md`（§1/§3/§4/§6 更新）。
初回レビュー §6-a（`internalError` catch-all が診断のみで自動再接続をスケジュールせず、
`extractBootstrap`/`parseLiveChatResponse` の想定外 throw で器官が沈黙凍結しうる穴）が
Orch-Sylph の裁定で Gnome により追修正された。今回は**この穴が閉じたか・他に退行が無いか**のみを
自分でファイルを読み・自分でコマンドを実行して再確認した（Gnome の説明に依存せず）。

### 1. 穴が閉じたか — 解消（PASS）

`live-chat-client.mjs:344-373` の `launch()` を読んだ。catch 節は:
1. `internalError` 診断を出す（354-358 行、従来通り）。
2. 新規: `if (!stopped && state !== "dead") { scheduleReconnect("extractFailed", ...); }`（361-363 行）。

トレース結果:
- `runConnect` 内 `extractBootstrap`（266 行、try/catch 外）が想定外 throw → 呼び出し時点で `state==="connecting"`
  （244 行で既に設定済み）→ `!stopped && "connecting"!=="dead"` は true → `scheduleReconnect("extractFailed", ...)` が
  効き、`retrying` へ落ちてバックオフ再接続がスケジュールされる。
- `runPoll` 内 `parseLiveChatResponse`（309 行、try/catch 外）が想定外 throw → 呼び出し時点で `state==="live"` →
  同様に `retrying` へ落ちて再接続。
- **終端との整合**: `stop()` 経由（`stopped=true` + `state="dead"`）でも、`ended` 経由（`state="dead"` だが
  `stopped` は false のまま——初回レビュー §2/§6-c で指摘した非対称性）でも、`state !== "dead"` の条件だけで
  どちらの終端到達経路も正しく再接続を止める。**非対称性（stopped を立てない ended）がここでは実害化しない
  ことを、この一箇所に限り自分で確認した**（一般論としての非対称性自体は§6-c として残す）。
- **無限タイトループの回避**: `scheduleReconnect` は必ず `nextBackoffDelay()`（190-196 行）を経由し、
  `backoffAttempts` を毎回 +1 してから `min(base*2^attempts, cap)+jitter` を計算する（最小でも `backoffBaseMs`
  ≒1000ms、既定値では 0 遅延にならない）。internalError 経路も同じ関数を呼ぶため、他の 3 分類と同じバックオフ
  規律に従う。タイトループにはならない。

自分で追加テストを読んで実行し、上記トレースと一致することを確認した:
- `live-chat-client.test.mjs:331-368`「parse が想定外 throw…でも沈黙凍結せず internalError 診断 → retrying →
  再接続で回復」: 初回 poll で `boom`（`continuationContents` 参照で throw する fixture）を注入 →
  `state==="retrying"` ・ `internalError` 診断あり ・ `extractFailed`+`action:"retrying"` 診断あり ・
  バックオフ後に watch fetch が再試行され `state==="live"` に復帰、を機械的に固定・自分で `node --test` 実行し
  pass を確認済み（下記 §4）。**これが中核裁定（inventory §2 裁定 2「壊れたら診断＋器官内自動再接続」）を
  満たす直接証拠。**
- `live-chat-client.test.mjs:370-393`「stop() 後に想定外 throw が起きても再接続しない」: ただし読解すると、
  この特定テストは `stop()` が次 poll のタイマを `clearTimer()` で撤去するため、`boom` を注入した poll 自体が
  そもそも実行されない（コメント「そもそも poll が走らない」が示す通り）。つまり launch() の catch 節の
  `!stopped` 分岐を実際に throw で踏んで確認しているわけではなく、「stop 後はタイマが残らない」ことの確認に
  留まる。**test 品質としての軽微な指摘**（テスト名が示唆する検証内容と実際の経路にズレがある）だが、
  中核の穴閉じ確認は 1 本目のテストと私自身のコードトレースで十分に取れているため、design 判定には影響しない
  （non-blocking・test レーンへの申し送りに値する程度）。

**結論: §6-a の穴は閉じた。** blocking なし。

### 2. 退行が無いか — 退行なし（PASS）

- `scheduleReconnect`/`scheduleNextPoll`/`clearTimer` の呼び出し箇所（249, 260, 269, 271, 303, 313, 318, 336 行）は
  初回レビュー時と行番号・分岐とも一致（新規呼び出しは 362 行の 1 箇所のみ追加）。4 分類
  （notLive/ended/extractFailed/network）の帰結・`connecting/live/retrying/dead` の遷移は無変更。
- `scheduleReconnect` は毎回冒頭で `clearTimer()`（210 行）を呼ぶため、internalError 経路が追加されても
  タイマの二重張りは起きない（新設コードパス自体は `scheduleReconnect` を呼ぶだけで直接タイマ操作をしない）。
- `innertube.mjs`・`innertube.test.mjs` はファイル更新時刻が `live-chat-client.mjs`/`.test.mjs` より前
  （`ls -la` で確認: innertube 系 00:49-00:53、live-chat-client 系 01:11）かつ `internalError` という語自体が
  `innertube.mjs` に出現しない（grep 0 件）。**純部品層は今回の修正で一切触られていない**——差分は器官側の
  catch 節とテストと doc のみで、委任プロンプトの想定通り。

### 3. doc の正確性 — 一致（PASS）

自分で `cd apps/soul/agent && node --test` をフルおよび個別実行し、以下を実測した:
```
# tests 563 / # pass 563 / # fail 0
```
個別: `node --test src/chat/innertube.test.mjs` → **25/25**、
`node --test src/chat/live-chat-client.test.mjs` → **20/20**（25+20=45、既存 518 本無退行）。
domain-a.md §6（171-182 行）の生数字「563/563」「内訳 25+20=45」「初回実装時の内訳誤記（22+21=43）を
実測 25+20=45 に訂正」は実測と完全一致。§1（48-49 行）のファイル別本数表記・§3（125 行）の
internalError 自動再接続の記述・§4（141 行）の分類表 internalError 行（`launch()` の catch-all が
internalError 診断＋retrying へ落として自動再接続／dead・stopped は終端のまま再接続しない）も、実装・実測と
矛盾なし。**テスト内訳誤記は訂正済み。**

### 4. 自分で再実行した機械ゲート（2 巡目・生結果）

```
cd apps/soul/agent && node --test
```
→ `# tests 563` `# pass  563` `# fail  0`（1 回で緑・再試行不要）。

```
git diff --stat -- apps/runtime-player packages
```
→ 出力なし（器コード完全不変）。

```
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json
```
→ 出力なし（lockfile・依存不変）。

```
git status --porcelain -- apps/soul/agent
```
→ `?? apps/soul/agent/src/chat/`（新設ディレクトリのみ・未 commit。個別ファイル diff ではなく新規追加として
現れる——初回レビュー時と同じ状態、追修正も同じ新設ディレクトリ内で完結）。

### 5. 再確認の総括

**blocking: なし。** §6-a（最重要 non-blocking 指摘）は追修正で解消したと自分のトレース・自分の追加テスト実行
・自分の doc/実装突合で確認した。他の状態遷移・器不変・依存不変に退行は無い。

**残 non-blocking（初回レビューから持ち越し。§6-a 以外は今回未変更なので評価も不変）**:
- (旧§6-b) 二重 start / stop 後の再入はコード読解で安全・専用テストなし（test レーン領分）。
- (旧§6-c) `ended` は `stopped` を立てない非対称性。今回の internalError 修正はこの非対称性があっても
  `state !== "dead"` 判定単独で正しく再接続を止めることを確認できたため、**この 1 箇所に限り実害はより
  確実に否定された**。ただし非対称性自体（将来の別経路が `stopped` を見て判断を変えた場合の脆さ）は
  記録として残す。
- (新) テスト `live-chat-client.test.mjs:370-393` の名称が示す検証意図（stop 後の想定外 throw への耐性）と、
  実際にテストが踏む経路（そもそも poll が走らずタイマが残らないことの確認）にズレがある。動作の正しさには
  影響しないが、test レーンへの軽微な申し送り。
- 旧§6 の残り（followup: notLive 内部 3 起因の粒度、公式 API 差し替えの楽観記述、タイムアウト発火の専用テスト
  欠如）は今回のスコープ外（変更されていない）ため再評価不要・据え置き。

**総合判定（2 巡目）: PASS。** blocking なし。§6-a は解消済み。

---

観点は wave-plan §2・§3 Domain A・§4 blocking 基準／inventory §2-2・§2-4・§3・§3-1／Gnome 成果物
`discussion/ai-cohost/implementation/waves/s7/domain-a.md` に対する適合。design レーンの 6 観点
（①壊れる前提の独立器官の整合 ②状態機械の妥当性 ③エラー分類の網羅と観測性 ④純部品層の抽象化
⑤決定論とタイムアウト ⑥堅牢性の穴）を、自分でファイルを読み・自分でコマンドを実行して確認した
（Gnome の報告値を転記していない）。

---

## 0. 自分で再実行した機械ゲート・器不変確認（生結果）

```
git diff --stat -- apps/runtime-player packages
```
→ 出力なし・EXIT=0（器コード完全不変）。

```
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json
```
→ 出力なし・EXIT=0（lockfile・依存不変＝新規依存ゼロ）。

```
git status --porcelain -- apps/soul/agent
```
→ `?? apps/soul/agent/src/chat/`（新設のみ・既存ファイル改変なし）。

```
node scripts/check-soul-zone-boundary.mjs
```
→ `Soul zone boundary guard passed: 1347 source files scanned; no 器→魂 imports and no 魂→器 code imports.`・EXIT=0。

```
cd apps/soul/agent && node --test
```
→ 全緑・ハングなくプロンプト復帰。
```
# tests 561
# pass  561
# fail  0
```
個別実行でも確認: `node --test src/chat/innertube.test.mjs` → **25/25 pass**、
`node --test src/chat/live-chat-client.test.mjs` → **18/18 pass**（25+18=43、既存 518 本無退行）。

```
grep -n "^import" apps/soul/agent/src/chat/innertube.mjs
grep -rn "import" apps/soul/agent/src/chat/innertube.mjs
```
→ `innertube.mjs` に import 文はゼロ（マッチはコメント内の説明文 1 件のみ）。
`live-chat-client.mjs` の import は `./innertube.mjs` の 1 本のみ（40-47 行）。
`grep -rln "chat" apps/soul/agent/src --include=*.mjs | grep -v "^.../chat/"` → 0 件（`src/chat/**` 以外のどのファイルも
`src/chat/**` を参照していない＝逆流路が構造的に存在しない）。
`grep -rn "writeFile|createWriteStream|fs\.write|appendFile" apps/soul/agent/src/chat` → 0 件（ディスク書き込みなし）。

---

## 1. 「壊れる前提の独立器官」設計の整合 — PASS

- **import ゼロ（構造）**: `innertube.mjs` は import 文ゼロ（依存ゼロ・状態ゼロの純部品層）。`live-chat-client.mjs`
  の import は `./innertube.mjs`（同ディレクトリ）のみ（live-chat-client.mjs:40-47）。魂の他部位（`../ears/**`・
  `../mind/**`）への import は 1 つも無い。§0 の grep で自分で確認済み。構造テスト
  （live-chat-client.test.mjs:426-442「独立性: chat 器官のソースは魂の他部位を import しない」）も同じ主張を機械的に固定。
- **逆流路の不在**: `src/chat/**` 以外のどのファイルからも `src/chat/**` への参照が無い（§0 grep）。これは
  Domain A の時点では「まだ誰も呼んでいない」ことの裏付けであり、かつ器官自身が import ゼロである以上、
  器官の側から魂へ手を伸ばす経路は構造的に存在しえない（Domain B の onMessage フック経由の外部合流を除く）。
- **ディスク書き込みなし**: `writeFile`/`createWriteStream`/`fs.write`/`appendFile` の類は `src/chat/**` に一切なし（§0 grep）。
- **フック throw 握り**: `emitGuarded`（live-chat-client.mjs:149-162）が onMessage/onStatus の throw を個別に catch し
  `listenerError` 診断に落とす。`emitDiagnostic`（133-141）自身は診断リスナの throw を再診断せず黙って飲む
  （ループ回避、設計コメントと一致）。テスト（369-422 行）で両方確認済み・実行して 18/18 pass に含まれることを確認。

## 2. 状態機械の妥当性 — PASS

- 状態集合 `idle/connecting/live/retrying/dead` の遷移をコードで追った:
  - `idle → connecting`: `start()`（371-379 行）は `stopped`/`state!=="idle"` の二重ガードで冪等。実行トレースを追うと
    `runConnect()` の `setState("connecting")`（244 行）は**最初の `await` より前に同期実行される**ため、
    `client.start(); client.start();` を同一 tick で連続呼び出しても 2 回目は `state!=="idle"` に阻まれる
    （JS のシングルスレッド・同期区間の性質を利用した設計。明示テストは無いが読解で安全性を確認——test レーン領分として申し送り）。
  - `connecting → retrying`: `scheduleReconnect()`（203-215 行）が `notLive`/`extractFailed`/`network` いずれからも到達。
  - `connecting → live`: bootstrap 成功（276-284 行）。
  - `live → retrying`: poll 中の `network`/`extractFailed`。
  - `live → dead`: `ended`（311-315 行、`clearTimer()` 後 `setState("dead")`）。
  - `retrying → connecting`: 再接続タイマ発火 → `launch(runConnect)`（211-214 行）。
  - `dead` は終端: `stop()`（382-390 行）は `stopped=true` を立ててから `setState("dead")`。`runConnect`/`runPoll` は
    冒頭で `if (stopped) return;` を持つため、`stop()` 後はどの経路からも状態遷移が起きない。
- **notLive＝retrying（待つ）／ended＝dead（終端）の区別**: inventory §2-4 の要求どおり実装されている
  （live-chat-client.mjs:110 のコメント + 267-273 行 / 311-315 行のコード分岐で確認）。
  テスト「notLive（未開始）は retrying で待ち、開始したら live に上がる」（243-255 行）と
  「配信終了は dead に落ち、タイマを残さない・1,000,000ms advance しても復活しない」（259-280 行）で両方固定・実行して pass 確認。
- **`ended` は `stopped` フラグを立てない**——`stop()` 経路の `stopped=true` とは非対称（314-315 行は `stopped` を触らない）。
  ただし実害は無いと判断した: (a) タイマは `ended` 到達直前に必ず `null` になっている（`scheduleNextPoll`/`scheduleReconnect`
  のコールバックが `timer=null` を先に実行してから `launch()` するため、再入可能な浮遊タイマが理論上存在しない）、
  (b) 再度 `start()` を呼んでも `state!=="idle"`（"dead"）で即 return するため復活しない。両者合わせて「終端后の再入」は
  実際には安全。ただし `stopped` の非対称性自体は将来の変更（例: 別経路からのタイマ発行）に対して脆いので non-blocking
  として指摘する（§6-c）。
- **停止後の再開は新インスタンスで**（domain-a.md §7-2 の設計どおり・`restart()` 無し）。設計として妥当
  （operation 側の裁量は Domain C 領分）。

## 3. エラー分類の網羅と観測性 — PASS

- 4 分類（notLive/ended/extractFailed/network）+ `listenerError` + 観測補助
  （`ignoredRenderers`/`connected`/`stopped`/`internalError`）が live-chat-client.mjs:112-120 の表どおりに
  コード上で発生源を持つ（scheduleReconnect 呼び出し 3 箇所 kind 別・ended 専用分岐・emitGuarded の listenerError）。
- **「抽出失敗＝観測可能な死」**: `scheduleReconnect()`（203-215 行）は呼ばれるたびに必ず `emitDiagnostic` してから
  タイマを張るため、失敗が続く限り診断が出続ける（inventory §2-2 の要求と一致）。ゴースト行の材料として十分。
- **`notLive` の内部分岐が 3 種混在**（innertube.mjs:181-204 `readLiveChatBootstrap`）: (1) `liveChatRenderer` 不在、
  (2) `isReplay===true`、(3) `liveChatRenderer` は存在するが初期 `continuation` が取れない、の 3 つがすべて
  `notLive` に丸められる。(3) は「レンダラーはあるのに continuation だけ無い」という**スキーマ変化に近い症状**にも
  読めるが、機械テストは (1)(2) しか固定していない（(3) の単体テストは innertube.test.mjs に無い）。
  もっとも (3) が `notLive` と `extractFailed` のどちらに転んでも live-chat-client.mjs 側の帰結は同じ「retrying」なので、
  **状態機械上は無害**（診断ラベルの精度の問題に留まる）。non-blocking。
- **paid（本文なし）の除外**: `parseMessageItem`（innertube.mjs:319-326）で本文なし paid を `ignored` に落とし、
  `ignoredRenderers` 診断へ。テスト（innertube.test.mjs:144-153・live-chat-client.test.mjs:175-197）で固定・pass 確認。

## 4. 純部品層の抽象化（followup の梯子） — PASS（将来梯子の記述は楽観に注意・non-blocking）

- `innertube.mjs` は状態を一切持たない純関数 + fetchImpl 注入の薄いラッパのみ（`normalizeSource`/`extractBootstrap`/
  `parseLiveChatResponse`/`joinRuns`/`parseMessageItem`/`fetchWatchPage`/`fetchLiveChat`）。`live-chat-client.mjs` は
  これらを名前でインポートするのみ（40-47 行）で、状態機械・バックオフ・タイマは器官側に閉じている。
  「差し替えは器官内で完結する」という plan/inventory の裁定に対する**構造の裏付け**は取れている。
- ただし domain-a.md §7-6 が言う「`fetchWatchPage`+`extractBootstrap`+`fetchLiveChat`+`parseLiveChatResponse` を
  公式版に置換すれば client の状態機械は不変で流用できる」は**やや楽観**: 公式 Data API v3 は
  「HTML から 4 点抽出」という bootstrap 手順自体が無く（`videos.list`→`activeLiveChatId` の 1 API 呼び出しで済む）、
  現在の「watch ページ GET → 4 点抽出 → POST ループ」という 2 段構造そのものが官式経路には存在しない。
  状態機械の概念（connecting/live/retrying/dead）と純部品境界の**発想**は転用できるが、関数シグネチャ・呼び出し順は
  現行のままでは嵌まらない可能性が高い。設計判断としては blocking ではない（followup であり今回未実装・v0 は
  非公式経路のみが裁定）が、将来梯子の記述を額面通り信じない方がよい、という non-blocking の申し送り。

## 5. 決定論とタイムアウト — PASS

- fetch/clock/timer/RNG 全注入（`fetchImpl`/`nowImpl`/`setTimeoutImpl`/`clearTimeoutImpl`/`rng`、87-105 行）。
- **リクエストタイムアウト**: `withTimeout()`（177-187 行）が `AbortController` + 注入 `setTimeoutImpl` で構成し、
  `runConnect`/`runPoll` はいずれも `try { await fetch... } finally { guard.clear(); }` で確実に clear
  （254-264 行・297-307 行）。abort 理由は `err instanceof Error` 判定を経て `network` 診断に落ちる
  （タイムアウトも network 扱いで retrying へ——設計として一貫）。**ただし実際にタイマが timeoutMs 後に abort し、
  それが network 診断に正しく落ちることを確認する専用テストは無い**（fake fetch はどれも即座に resolve/reject するのみ）。
  コード読解では正しいと判断したが、test レーンで拾うべき欠落として申し送る（non-blocking・design 上の欠陥ではない）。
- **バックオフ**: `nextBackoffDelay()`（190-196 行）は `base*2^attempts` を `cap` で `Math.min` してから `[0, 20%)` の
  ジッターを**加算**する。つまり実際の遅延上限は `cap` そのものではなく `cap*1.2` 程度になる——domain-a.md/live-chat-client.mjs
  の「cap で頭打ち + ジッター」という記述と数式は一致しており、これは設計通りの挙動で bug ではない（用語の綾に過ぎない）。
  `attempts` は bootstrap 成功・poll 成功でリセット（280 行・331 行）。`2**attempts` が理論上 `Infinity` に発散しても
  `Math.min(Infinity, cap)` で正しく `cap` に丸まるため、超長時間の連続失敗でも数値的に破綻しない（оverflow 安全）。
  rng=0 の決定論テストで `[1000,2000,4000,4000]`（cap=4000 設定）を実測・pass 確認（live-chat-client.test.mjs:331-345）。

## 6. 堅牢性の穴 — 1 件の non-blocking 指摘（最重要）＋ 軽微 2 件

### (a) `internalError` フォールバックは診断は出すが再接続しない（設計ギャップ・non-blocking だが重要）

`launch()`（live-chat-client.mjs:344-364）は `runConnect`/`runPoll` 内で捕捉されなかった例外を最終防波堤として
`internalError` 診断に落とすが、**その後 `scheduleReconnect` も `scheduleNextPoll` も呼ばない**。トレースすると:

- `runConnect` 内で `extractBootstrap(...)`（266 行）は try/catch の外にある。
- `runPoll` 内で `parseLiveChatResponse(json)`（309 行）も try/catch の外にある。

どちらも「入力を検証して判別可能な戻り値を返す」設計で通常は throw しない（`extractBootstrap`/`parseLiveChatResponse`
はいずれも非文字列・非オブジェクト入力を明示的に弾く防御コードを持つ）ため、**実際にここへ到達するには実装バグが要る**。
しかしもし到達すれば: `runPoll` 側で発生した場合、`state` は直前の `"live"` のまま凍りつき、`getState()` は
「生きている」と偽陽性を返し続ける一方、実際にはもう二度とポーリングされない（タイマ未設定）。`runConnect` 側で
発生した場合も `"connecting"` のまま凍りつく。いずれも `internalError` 診断が 1 回出るだけで、以後は**沈黙したまま
自動再接続しない**——「壊れる前提=死んだら診断+器官内自動再接続」という inventory §2 裁定 2 の後半（自動再接続）を
この一系統だけ満たしていない。

blocking としなかった理由: wave-plan §4-3 の「壊れ方全分類がテストで固定され…」は notLive/ended/extractFailed/network
の 4 分類（+独立性）を指しており、この `internalError` はその 4 分類の**外側**にある防御的キャッチオール
（真の意味での「想定外」）である。4 分類自体は全て正しく retrying/dead に着地することを確認済み。したがって
blocking 基準の文言には抵触しないと判断した。とはいえ「壊れても魂に影響しない」という謳い文句の完全性という点では
穴であり、followup として **`internalError` 発生時も `scheduleReconnect("extractFailed", ...)` 相当で再接続を試みる**
（または少なくとも `retrying` へ落として診断を出し続ける）よう直す価値があると考える。現状のテスト（43 本）に
`internalError` を踏む経路のテストは無い（grep で `internalError` は live-chat-client.mjs:351 のソース 1 箇所のみで
テストファイルに出現なし・自分で確認済み）。

### (b) 二重 start / stop 後の再入 — コード読解では安全、専用テストなし（test レーン領分・non-blocking）

§2 で述べた通り、同期区間の性質と `stopped`/`state` の二重ガードにより二重 start・stop 後の再 start はいずれも
安全と読めるが、明示的なテストが無い。design 上の欠陥ではなく test レーンへの申し送り。

### (c) `ended` は `stopped` を立てない非対称性（§2 参照・non-blocking）

実害は確認できなかったが、将来コードが変わったときに再接続タイマが誤って張られるリスクの芽として記録しておく。

---

## 7. blocking / non-blocking の総括（初回レビュー時点の記録。2 巡目の結論は冒頭「追修正 再確認」節を参照）

**blocking 指摘: なし。** 独立器官の構造的整合（import ゼロ・逆流路なし・ディスク書き込みなし）・状態機械の
notLive/ended 区別・4 分類の観測性・決定論注入・バックオフの数値健全性、いずれも自分でファイルを読み・
コマンドを実行して確認した。

**non-blocking（設計裁量・followup・他レーンとの重複含む）**:
1. `internalError` フォールバックが再接続をスケジュールしない設計ギャップ（§6-a）。4 分類の外側だが「壊れても
   自動再接続する」という謳い文句の穴。followup 台帳への記載を推奨。
2. `notLive` 内部の 3 起因（不在/isReplay/continuation 欠落）のうち 3 番目は `extractFailed` 寄りにも読めるが
   状態機械上は無害（§3）。
3. 公式 API キー経路への差し替えが「器官内で完結する」という domain-a.md §7-6 の記述はやや楽観
   （bootstrap 手順自体が官式経路に存在しないため）（§4）。
4. リクエストタイムアウト（AbortController 発火 → network 診断）を実際に発火させて検証する専用テストが無い
   （§5）。design 上のロジックは正しいと判読。
5. 二重 start・stop 後の再入・`ended` と `stopped` の非対称性（§6-b, c）は読解で安全と判断したが、専用テストなし。
6. **domain-a.md §6 のテスト内訳記載の誤り**: 「`innertube.test.mjs` 22 本 + `live-chat-client.test.mjs` 21 本」は
   自分で `node --test` を個別実行して数えた実数（**25 本 + 18 本 = 43**）と一致しない。合計 43・総数 561 は
   正しいが、ファイル別内訳は誤記。test レーン（domain-a-review-test.md）も独立に同じ誤りを検出済みで、私の
   実測（§0）と一致する。コードの正しさには影響しないが、「実行していない数字を書かない」という鉄の規律に
   照らして Gnome 側の記載修正を推奨する（non-blocking・ドキュメント正確性の指摘）。

## 8. §質問（Orch への申し送り・初回レビュー時点。2 巡目で Q1/Q2 とも解消）

- Q1（解消済み）: `internalError` フォールバックを再接続させるよう直すか — Orch の裁定により Gnome が追修正。
  2 巡目で自分のトレース・追加テスト実行により穴が閉じたことを確認した（冒頭節参照）。
- Q2（解消済み）: domain-a.md §6 のテスト本数内訳誤記（22/21 → 実際 25/18、追修正後は 25/20）修正を Gnome に
  依頼するか — domain-a.md §6 が実測（25+20=45・総数 563）に一致するよう訂正済みであることを 2 巡目で確認した。

初回レビュー時点の判定は **PASS-with-nonblocking**（blocking なし）。
**2 巡目（追修正 再確認）の最終判定は本ファイル冒頭「追修正 再確認」節の通り PASS。**
このファイル全体としての現時点の総合判定: **PASS**（blocking なし。残るのは §6-b/c・test レーン申し送り・
followup 記述の粒度に関する non-blocking のみ）。
