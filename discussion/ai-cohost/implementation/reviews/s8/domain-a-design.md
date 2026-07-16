# S8 Domain A レビュー — design 適合 / blocking レビュー基準レーン

> レビュアー: Review-Sylph（design 適合レーン・読み取り専任）
> 対象: `apps/soul/agent/src/mind/fire-orchestrator.mjs` / `apps/soul/agent/src/mind/barge-in.mjs`
> 判定基準: [s8-wave-plan.md](../../orchestration/s8-wave-plan.md) §2・§4、[s8-planning-inventory.md](../../orchestration/s8-planning-inventory.md) §2-1・§3
> Gnome 報告: [domain-a.md](../../waves/s8/domain-a.md)

## 判定: **合格**

`node --test`（`apps/soul/agent` を cwd）を独立再実行し 738/738 緑を確認（Gnome 報告と一致）。`fire-orchestrator.test.mjs` + `barge-in.test.mjs` のみの単独実行でも 77/77 緑を確認。`git status --porcelain` で `apps/soul/agent/src/mind/{barge-in,fire-orchestrator,fire-orchestrator.test}.mjs` の 3 ファイルのみが変更されていることを確認済み（器/packages/lockfile/package.json 不変）。

## blocking レビュー基準（§4）各項目の判定

### 1. キルの完全性 — 合格

`fire()`（fire-orchestrator.mjs:764-798）のガード列: `disposed`(:765-767) → `killed`(:768-772) → `busy`(:773-777) → `ears-not-running`(:778-783) → visionMode 分岐(:789-798)。`killed` ガードは disposed の直後・busy の直前に位置し、`fireVision`/`firePreferred`/`fireNormalCore` への分岐(:789-798)より**前**にある。これら 3 つの内部関数は戻り値オブジェクト（:756-819、`fire`/`interrupt`/`kill`/`revive`/`getKilled`/`getState`/`dispose` のみを公開）に露出しておらず、`fire()` を経由しない外部呼び出し経路は構造上存在しない。したがって:

- manual `fire()` → :768-772 のガードで弾かれる。
- 視覚 `fire({vision:true})` → 同ガード（visionMode 分岐より手前）で弾かれる。
- 自発 `fire({vision:"preferred"})` → 同上。
- in-flight（ask 撃った後にキル）→ `processAskedReply`(:318-436) 内、`parseExpressionTags` 実行(:326)・未知タグ診断 emit(:330-332) の**後**、`hasSpeech/hasEvents` 計算(:341-342)・`speakImpl` 呼び出し(:361) の**前**に `killed` 検査(:336-339) を配置。命中時は `speakImpl` に到達せず `{fired:false, reason:"killed-inflight", ...extra}` で return する。

4 経路すべてがテスト 1・3・6（`fire-orchestrator.test.mjs:1494`, `:1577`, `:1692`）で個別に `session.ask`/`captureImpl`/`speakImpl` 不呼び出しとして直接検証されている。独立再実行で緑を確認済み。

### 2. 即効性 — 合格

`severSpeaking(pb, note, diagnosticType, atMs)`（fire-orchestrator.mjs:452-530）の冒頭:

```
pb.interrupted = true;                         // :453
if (pb.timer != null) { clearTimeoutImpl(...); pb.timer = null; }  // :455-458
try { if (player && ...) player.stop(); } catch (err) { ... }       // :461-467（同期・try 内）
```

ここまでは `await` を一切挟まない同期処理であり、async 関数の仕様上、呼び出し側が `severSpeaking(...)` を呼んだ瞬間にこの区間は割り込み余地なく実行し切ってから、初めて最初の `await`（:472-473 の `channel.sendSet(...)`）に入る。`kill()`（:558-567）自体も `killed = true`(:559) → `currentPlayback` チェック(:560-563) → `severSpeaking` 呼び出し(:565) の間に `await` を挟まない。この構造は既存 `interrupt()` と完全に同一の外形（diff で確認済み・後述「無退行」節）であり、S6 barge-in で既に検証済みの即効性保証をそのまま継承している。

テスト 2（`:1519-1575`）で `player.stop` 呼び出し回数 1・`sendSet` 引数の厳密一致・`elapsedMs:350`（再生開始 1000ms + 350ms 経過でキル→ 1350 を渡した結果と整合）を直接 assert。

### 3. 耳の不干渉 — 合格

`grep -n "ears" apps/soul/agent/src/mind/fire-orchestrator.mjs` の結果、コード上ヒットするのはコメント2箇所（:95, :554、いずれも「ears 系には触れない」という説明文）と `reason:"ears-not-running"` 文字列（:781-782、これは `getBuffer()` が null を返した場合の理由コードであり ears モジュールへの import ではない）のみ。import 一覧（:109-120）は `speak.mjs`/`fire-injection.mjs`/`expression-parser.mjs`/`expression-translator.mjs`/`window-capture.mjs`/`barge-in.mjs` の 6 本のみで `src/ears/` からの import はゼロ。`kill`/`revive`/`severSpeaking` が触れるのは `player`/`channel`/`pb.buffer.append`/`onDiagnostic`/`onSoulTranscript` のみで、いずれも既存 speak/barge-in 経路が既に触れていたもの（新規の耳への接触経路なし）。

テスト 8（`:1747-1766`）で kill 後も `buffer.append()` によって you 転写が積めることを直接確認。

### 5. 没の秘匿 — 合格

`killDiscarded` の emit 箇所は :337 の一箇所のみ: `emit(onDiagnostic, { type: "killDiscarded" });` — オブジェクトリテラルに `type` 以外のキーがなく、`speechText`/`replyText` 等の本文は一切含まれない。戻り値 `{ fired: false, reason: "killed-inflight", ...extra }`（:338）の `extra` は呼び出し元（`fireNormalCore`/`askWithVision`）が渡す `{injectedChars, includedCount}` または `{injectedChars, includedCount, vision:true}` のみで、いずれも応答本文を含まないメタ情報。

テスト 3（`:1577-1620`）で `killDiscarded` 診断オブジェクトのキーが `["type"]` のみであること、`JSON.stringify(diags)` / `JSON.stringify(result)` のいずれにも応答本文（テスト内のダミー文字列「こっそり」）が含まれないことを直接 assert。秘匿要件を最も具体的な形で検証している。

### 6. 復帰の健全性 — 合格

`revive()`（:575-577）は `killed = false;` のみで他の状態に触れない。再生中キルの経路: `severSpeaking` → `pb.resolve(info)`（:528）→ `processAskedReply` 内 `await new Promise(...)` が解決 → `currentPlayback = null` に戻し timer を解除(:399-404) → `completion.interrupted` 分岐(:412-425) → 呼び出し元（`fireNormalCore` 等）の `finally` で `setState("idle")`。この経路は `currentPlayback` を確実に null に戻し、`killed` フラグ以外の残留状態（`interrupted` はローカルな `pb` オブジェクトのプロパティであり `pb` 自体が破棄されるため次回 fire には影響しない）を作らない。

テスト 4（`:1622-1667`）で「再生中キル完走→ busy 固着なし→ キル中は弾かれる → revive → 次の fire が thinking→speaking→自然完了まで正常進行 → `interrupted` 汚染なし（`result.interrupted === undefined`）」を、テスト 5（`:1669-1690`）で idle キル版を、それぞれ直接検証。独立再実行で緑を確認済み。

## 無退行（barge-in）の確認

`git diff` で `interrupt()` の抽出前後を突き合わせた。差分は以下の点に限定されている:

- 関数名 `interrupt` → 共有ヘルパ `severSpeaking(pb, note, diagnosticType, atMs)` への抽出（`interrupt()` 自体は `pb`/`BARGE_IN_NOTE`/`"bargeIn"` を渡す薄いラッパとして再定義、:539-546）。
- 診断 type の文字列: `"bargeInStopError"` → `` `${diagnosticType}StopError` ``。`diagnosticType="bargeIn"` を渡すため展開結果は従来と 1 文字も変わらず `"bargeInStopError"`（`bargeInMouthCloseRejected`/`bargeInMouthCloseError`/`bargeIn` も同様に完全一致）。
- soul 追記文言: `BARGE_IN_NOTE` 決め打ち → `note` 引数化（`interrupt()` は引き続き `BARGE_IN_NOTE` を渡すため出力は不変）。
- ローカル変数名 `interruptAtMs` → `severAtMs`（挙動に影響なし）。
- `interrupt()` 自体の冒頭ガード（`if (!pb || pb.interrupted) return {interrupted:false, reason:...}`）はそのまま温存され、severSpeaking の中身には現れない（＝bargeIn の冪等 no-op 判定はこれまで通り interrupt() 側にある）。
- `processAskedReply` 内の `completion.interrupted` 分岐（二重 append 回避のコメント含め）は無変更。

以上より、bargeIn 経路の外形・診断 type 名・soul 二重 append 回避・冪等 no-op は 1 ビットも変わっていないことをコード上確認した。`fire-orchestrator.test.mjs`/`barge-in.test.mjs` の既存 bargeIn 系テストも独立再実行で全緑（新規 9 件を含む 77/77）。

## kill 再生中の fire() 戻り値について（Domain B への申し送り・blocking ではない）

Gnome 報告の裁量判断 4（`severSpeaking` が `interrupt()` と同じ `pb.resolve({interrupted:true,...})` 経路を共有するため、再生中に `kill()` した場合の `fire()` 全体の戻り値が `{fired:true, interrupted:true, replyText:<声に出た接頭辞>}` になる一方、`kill()` 自身の戻り値は `{killed:true, severed:true, elapsedMs, charsSpoken, prefix}` になる）について、意見を述べる。

DRY を優先し bargeIn と全く同じ意味論的経路を再利用した設計判断そのものは妥当と考える。ただし、`fire()` の Promise だけを見ている呼び出し側からは「barge-in によって中断されたのか kill によって中断されたのか」を区別するフィールドが戻り値に存在しない（`reason` フィールドが無く、`interrupted:true` としか分からない）。区別が必要な場合は `onDiagnostic` の `type`（`"bargeIn"` か `"kill"` か）を見るしかない。

Domain B が `POST /api/kill` のレスポンスとして `kill()` 自身の戻り値（`{killed:true, severed:true, elapsedMs, charsSpoken, prefix}`）を使う設計であれば、この点は問題にならない（Gnome の想定通り・こちらを推奨）。一方、もし `POST /api/fire` 側のレスポンスハンドラや操縦席 UI が `fire()` の Promise 解決を監視して「発火の結果」を表示するような設計を Domain B が取る場合、キル直後の `POST /api/fire` は `fired:true, interrupted:true` を返す（bargeIn と見分けがつかない）ため、UI 上「キルしたのに発火成功のように見える」表示不整合が起きうる。Orch-Sylph は Domain B 着手時にこの点を明確化すること（`kill()` の戻り値のみで完結させる設計を推奨・`fire()` の Promise 待ちは不要）を推奨する。

## initialKilled の判定

`let killed = options.initialKilled === true;`（fire-orchestrator.mjs:217）。厳密等価 `===true` により `undefined`/`null`/`false`/`0`/`"true"`（文字列）等、真値であっても non-strict-true な値はすべて `false` に判定される（デフォルト false 側に倒す安全な判定）。これは spec の「キル中に遅延生成される orchestrator はキル済みで生まれる（ゲート漏れ防止）」という要求を、Domain B が生成時に正しく `initialKilled: true` を渡す前提で満たす。判定ロジック自体に問題はない。テスト 7（`:1727-1745`）で `initialKilled:true` → `getKilled()===true` → 直後の `fire()` が `reason:"killed"` で弾かれることを直接確認。

## 軽微な申し送り（blocking ではない）

`kill()` は `severSpeaking` の完了（`await channel.sendSet(...)` を含む口閉じ処理まで）を待ってから Promise を解決する。即効性要件（基準 2）が求める「`player.stop()` までに await の割り込み余地がない」ことと、「`kill()` の呼び出し元が受け取る Promise 自体が同期的に解決するか」は別の話であり、後者は非同期（口閉じの channel 往復・最大 `MOUTH_CLOSE_TTL_MS=400ms` 相当）で構わない設計（bargeIn の `interrupt()` も同様）。Domain B が `POST /api/kill` で `await orchestrator.kill()` する場合、HTTP レスポンスは口閉じ完了まで待ってから返る形になるが、声自体は `kill()` 呼び出し直後の同期区間で既に止まっているため、人間ゲート要求（「声が即座に切れる」）には影響しない。念のため Domain B 実装時に体感確認することを推奨する。

## 質問

1. Gnome 報告の裁量判断 4・質問と同一内容（上記「kill 再生中の fire() 戻り値について」節）。Domain B が `kill()` の戻り値と `fire()` の戻り値のどちらを kill API のレスポンス正本にするかは、Domain B 着手前に Orch-Sylph が明確化する必要がある。spec レーンレビュー（`domain-a-spec.md`）の質問 1 と同一論点であり、両レーンから同じ申し送りが上がっている点を踏まえて優先的に扱うことを推奨する。
2. 判断に迷う不足情報・design 適合上の懸念点は上記以外になし。
