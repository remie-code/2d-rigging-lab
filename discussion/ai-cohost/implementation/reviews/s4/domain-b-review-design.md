# S4 Domain B レビュー（design レーン）: シーム・結線・設計の健全性

> レビュア: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph。読み取り専任。
> 対象: S4 Domain B 実装（[../../waves/s4/domain-b.md](../../waves/s4/domain-b.md)）。
> 根拠: Domain A ワイヤ契約 [../../waves/s4/domain-a.md](../../waves/s4/domain-a.md) §7 / 対象ファイル差分 / 器 diff。
> 実施日: 2026-07-13。**実 SDK（observe-expressions）は走らせていない**（消費回避・コード構造の検証で足りる）。

## 総合判定: **PASS-with-nonblocking**

design レーンの 7 検証項目すべて PASS。blocking なし。non-blocking 2 件（args 縦貫通の dead path・既存テスト名ズレ、いずれも申し送り済み）。

---

## 器 diff 空の自分の確認結果

`git status --porcelain -- apps/runtime-player pnpm-lock.yaml package.json packages` を自分で実行 → **出力空**（器コード・lockfile・package.json・packages 不変を確認）。差分は `apps/soul` 配下 13 ファイルのみ（+759/-33）。器コードへの import も無し（変更ファイルの import は `src/mind` `src/channel` `src/ears` `src/test-support` に閉じる）。新規依存ゼロ。

---

## 検証項目（PASS/FAIL + 根拠）

### 1. onExpression 結線 — **PASS**
本番結線 `scripts/cockpit.mjs` を実際に確認。
- `cockpit-server.mjs:740`（差分）: fireOrchestratorFactory へ渡す hooks に `onExpression: (info) => broadcast("expression", info)` を追加（`onFire`→broadcast("fire") と同型）。
- `cockpit.mjs:275-288`: `createFireOrchestrator({ ...hooks, session, channel: lazyChannel, player, ... })`。`...hooks` を**先頭で** spread し、後続の session/channel/player は別キーなので上書き衝突なし。よって cockpit-server が渡す `onExpression` は無改修で orchestrator に届く（cockpit.mjs は onExpression を明示的に触っていない＝spread 経路が正しい）。
- channel は `lazyChannel`。`cockpit.mjs:140-143` で `sendEnvelope(intent)` を追加済み（`ensure()`→接続の `channel.sendEnvelope` へ委譲・sendSpeech と同型・1 接続共有）。orchestrator の `applyExpressions` が `channel.sendEnvelope` をスロット毎に呼び、`emit(onExpression, {word, applied, rejected})`（fire-orchestrator.mjs 差分 line 131/134）。
- 縦貫通経路: orchestrator.onExpression → broadcast("expression") → SSE → cockpit.html `addExpressionRow`。全区間ソースで確認。channel に sendEnvelope が無い相手には `expressionSendError` で握る防御あり（"channel has no sendEnvelope"）が、本番 lazyChannel は保持するため到達しない。

### 2. handleDiagnostic の tag フィールド追加 — **PASS**
`cockpit-server.mjs:416-427`（差分）: broadcast("diagnostic", {...}) に `tag: d?.tag ?? null` を**追加フィールド**として足しただけ。
- 既存の asrFailure 等（tag を持たない診断型）は `tag:null` になるだけで契約破壊なし。startMs/endMs（S2.5 domain-f）と同一手口。既存 diagnostic broadcast の他フィールド（type/message/reason/startMs/endMs）は不変。
- `expressionUnknownTag` の `tag` はページのゴースト行へ届く: cockpit.html 診断ハンドラ差分 `else if (d.type === "expressionUnknownTag") addGhostRow("(unknown tag: " + (d.tag || "?") + ")")`。経路正しい。

### 3. cockpit.html の行描画シーム — **PASS**
- `addExpressionRow` は**新規関数**。既存 `addTranscriptRow` / fire マーカー / diagnostic ハンドラを一切変更していない。
- SSE 購読追加 `es.addEventListener("expression", ...)` は新イベント名で、既存の soul/fire/diagnostic/transcript/discard 購読と衝突しない。
- 診断ハンドラの `expressionUnknownTag` 分岐は既存 `asrFailure`/`fireEmptyReply`/`fireError` 分岐の後ろに `else if` で追加。既存分岐の評価順・挙動不変。他の演出診断（expressionBrokenTag/expressionRejected/expressionSendError）は分岐を持たず no-op に落ちる（過剰表示回避の裁定）→ cockpit-page.test「other expression diagnostics do NOT add rows」で固定。
- CSS `.row.expression`（--accent）は新規セレクタ・既存 `.row.fire-marker` 等と独立。

### 4. observe-expressions.mjs の健全性 — **PASS**
- env-guard: `main()` 冒頭 line 127 で `assertSubscriptionAuthEnv(process.env)`。ガード違反で throw = 起動拒否（ANTHROPIC_API_KEY 等検出時は数字を捏造せず未実測として記録する構造）。
- **5 ask ハードガード**: `MAX_ASKS=5`（line 44）。`measuringSession.ask` は `askCount >= MAX_ASKS` で throw（line 153-154）＝6 回目は必ず拒否。ループも `i < MAX_ASKS`（line 164）で二重に上限。
- タイムアウト: `askWithTimeout` の `Promise.race`（`ASK_TIMEOUT_MS=90s`・`setTimeout().unref?.()` でハング保険）。
- 空/タイムアウト再試行→正直停止: `MAX_RETRIES=3`（line 48）。空応答・throw とも attempt を数え、`attempt >= MAX_RETRIES` で throw して正直停止（line 178/184）。捏造せず実観測のみを `observations` に積み、集計は観測配列から算出（line 220-243）。
- measure-fire.mjs 型踏襲: `session.dispose()` を finally で保証・`round1`・`usage ?? null` パススルー・onInit で initMessage 捕捉・純関数 parseExpressionTags/translateExpression を本番と同一使用。健全。

### 5. preflight-fire の演出足し — **PASS**
- fake `sendEnvelope`（全スロット accepted・`sentEnvelopes` へ push）を fake channel に追加（差分 line 131-...）。fake ask が `"はーい、どうしたの？<smile>"` を返し、parseExpressionTags→translateExpression→channel.sendEnvelope→SSE `expression` の**縦貫通**を実 HTTP/SSE で確認。実 SDK/実器を要さない。
- assert: SSE expression(smile) 到達・`applied>0 && rejected===0`・smile=4 スロット（sentEnvelopes.length===4）。演出表 smile の束と整合。
- 既存 assert（spokenText・soul entry）は**剥離後 speechText**（"はーい、どうしたの？"）を見るため不変＝既存 preflight 挙動を壊さない。domain-b.md §4 の RESULT: PASS/EXIT=0 と整合（本レビューでは実行せずソース構造で確認）。

### 6. 器コード・C4/C5 契約・lockfile・package.json 不変 — **PASS**
上記「器 diff 空の自分の確認結果」参照。`git status --porcelain` 空を自分で実行確認。器 import なし・新規依存ゼロ・Node 組み込みのみ。

### 7. 調整 UI 不在 — **PASS**
- cockpit.html の addExpressionRow はコメントで「調整 UI（強さ係数スライダー等）は操縦席に置かない裁定——ここは表示のみ」と明記。ページに強さ係数等のノブ・スライダー・入力欄の追加なし（差分は行描画関数 + SSE 購読 + CSS のみ）。
- `expressionIntensity` は orchestrator オプション（Domain A・既定 1.0）に留まり、操縦席 UI へ露出していない。裁定と整合。

---

## non-blocking 所見

1. **args の縦貫通が v0 では dead path（S5 で要接続）**: cockpit.html `addExpressionRow` と cockpit-page.test は `d.args` を扱えるが、Domain A の onExpression summary は `{ word: ev.word, applied, rejected }` で **args を含めていない**（fire-orchestrator.mjs 差分 line 131）。契約 §7 は `args?` オプショナルで、v0 の 6 語は全て引数不要のため実害なし。ただし「expression row shows args when present」テストは `addExpressionRow` を直接叩くのみで、実 emit 経路では args が乗らない。**S5 で args 対応語を足す際、Domain A 側 summary に `...(ev.args ? {args: ev.args} : {})` を足さないとページに args が出ない**点を s4-followup へ（既に §3-2 のタグ位置同期近傍で扱える）。design 上のシーム破壊ではないため non-blocking。

2. **cockpit-page.test の既存ケース名ズレ**: 「asrFailure adds a ghost row; others do not」は expressionUnknownTag 追加で名前がさらにズレるが、既存テスト変更禁止規律で未修正（domain-b.md §7 Q4 / s4-followup §3-1 で申し送り済み）。追加コメントで注記済み・挙動は正しい。non-blocking。

---

## blocking

なし。
