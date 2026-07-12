# S3 Domain A レビュー（design レーン: 品質・自己完結・安全）

> レビュアー: Review-Sylph（design レーン）。委任元 Orch-Sylph。2026-07-12。
> 対象: `s3-wave-plan.md` §4 blocking 基準 / `waves/s3/domain-a.md` 実装記録。
> 根拠: git 実測・コード読解・preflight 実行・テストスイート実行（Gnome の説明に依存しない）。

## 判定: **PASS**（blocking なし・non-blocking 所見 2 件）

design レーンの 8 問すべて、対象ファイル・git 実測・preflight/テスト実測で裏が取れた。既存コード不変・
loopback 限定・新規依存ゼロ・失敗の握り・クリーンシャットダウンいずれも成立。

---

## 各問いへの根拠付き所見

### 問 1. 既存コード不変（llm-session / speak / ear-pipeline）— PASS

`git status --short` の全体（変更は 4 ファイルのみ・+ 新規 5 ファイル）:

```
 M apps/soul/agent/src/cockpit/cockpit-server.mjs
 M apps/soul/agent/src/cockpit/cockpit-server.test.mjs
 M apps/soul/agent/src/ears/transcript-buffer.mjs
 M apps/soul/agent/src/ears/transcript-buffer.test.mjs
?? apps/soul/agent/scripts/preflight-fire.mjs
?? apps/soul/agent/src/mind/fire-injection.mjs
?? apps/soul/agent/src/mind/fire-injection.test.mjs
?? apps/soul/agent/src/mind/fire-orchestrator.mjs
?? apps/soul/agent/src/mind/fire-orchestrator.test.mjs
?? discussion/ai-cohost/implementation/waves/s3/
```

3 ファイルの個別 status（空 = clean）:

```
git status --short src/mind/llm-session.mjs src/voice/speak.mjs src/ears/ear-pipeline.mjs
→ （出力なし = M なし・完全に不変）
```

`fire-orchestrator.mjs` の設計を実コードで確認: `session` は `options.session`（ask のみ使用・L147）、
`speakImpl` は `options.speakImpl ?? defaultSpeak`（L81）で**受け取るだけ**。session/speak を作らず/変えず、
所有もしない（`dispose()` は `disposed=true` のみで session/channel/player を畳まない・L184-186 とコメント明示）。

### 問 2. 127.0.0.1 限定バインド — PASS

- `assertLoopbackHost`（L66-73）と `host = assertLoopbackHost(options.host ?? DEFAULT_COCKPIT_HOST)`（L279）は
  **diff に含まれず不変**。`server.listen(port, host, …)`（L699）で loopback にのみ束縛。
- `POST /api/fire` は同一の `handleRequest`（L597 付近）内に追加され、同じ loopback バインドのサーバが提供。
  **新規サーバ・新規ポートは作られていない**（新規リスナ・別 host は diff に存在しない）。
- preflight 実測でバインド URL を正規表現検証: `^http://127\.0\.0\.1:\d+$` を通過（下記ログ `http://127.0.0.1:11575`）。
  外部露出ゼロ。

### 問 3. 新規依存ゼロ — PASS

```
git diff apps/soul/agent/package.json              → （出力なし = 差分ゼロ）
git diff --stat pnpm-lock.yaml apps/soul/agent/package-lock.json → （出力なし = 差分ゼロ）
```

import 実測:
- `fire-injection.mjs`: **import 行ゼロ**（純関数・依存ゼロ）。
- `fire-orchestrator.mjs`: `../voice/speak.mjs`・`./fire-injection.mjs`（自ゾーンのみ）。
- `preflight-fire.mjs`: `node:http` + 自ゾーン 3 本のみ。
- `cockpit-server.mjs` diff: 新規 import なし（結線コードのみ追加）。

### 問 4. 失敗の握り（常駐を殺さない）— PASS

- `fire()` は `try/catch/finally`（L146-175）。ask/speak の throw は catch で `onDiagnostic({type:"fireError"})` +
  `{fired:false, reason:"error", message}` を返し、**上へ投げない**。`finally` で `setState("idle")`（L174）——
  冪等 setState（同値は再通知しない・L105-109）ゆえ二重通知なし。空応答は発話せず idle 復帰（L151-154）。
- cockpit の `POST /api/fire` ハンドラ（L600 付近）は `await fireOrchestrator.fire()`。fire() は内部で例外を握り
  オブジェクトを返すので**ハンドラは 500 落ちしない**。加えて `createServer` コールバックが
  `handleRequest(req, res).catch(err → sendJson(res, 500, …))`（L530-531）で外郭ガード——万一の同期例外でも
  **プロセスは死なず** 500 を返すのみ。listener 呼び出しは `emit` が throw を握る（L95-102）。

### 問 5. クリーンシャットダウン — PASS（preflight 実測で裏取り）

- `close()`（L709 付近）は冪等（`if (closed) return`）で、`fireOrchestrator.dispose()` を try で囲って先に呼び
  （best-effort）→ SSE end → pipeline.dispose → server.close の順。orchestrator はタイマ・ハンドル・子プロセスを
  **所有しない**（純状態機械）ため dispose で残留物なし。
- preflight を自分で 1 回実行（60s タイムアウト付き・ハングせず即終了）:

```
[preflight-fire] server listening at http://127.0.0.1:11575 (loopback)
[preflight-fire] POST /api/ears/start → 200
[preflight-fire] POST /api/fire   → 202 fired=true reply=はーい、どうしたの？
[preflight-fire] SSE soul(thinking→speaking→idle) + soul transcript observed
[preflight-fire] RESULT: PASS (fire → ask → speak → soul recorded; SSE observed; no real SDK/TTS/mic)
[preflight-fire] server closed (no hang)
[preflight-fire] EXIT=0
PROCESS_EXIT=0
```

RESULT: PASS / EXIT=0 / PROCESS_EXIT=0・"server closed (no hang)"。event loop に残留ハンドルなし（プロセスは
`process.exit(0)` 到達前に close 完了）。

### 問 6. 実マイク/録音物/実 SDK 非使用 — PASS

- preflight: `session.ask` は fake（固定文字列返し）、`speakImpl` は fake（副作用なしのスタブ）、`channel`/`player`
  も fake、pipeline も fake（`fakePipelineFactory`）。実 query()・実 TTS・実器接続・実マイクに一切触れない
  （コード L119-139 で確認）。
- `fire-orchestrator.mjs` は `speak.mjs` を静的 import するが**呼ばない**（テスト・preflight とも `speakImpl` 注入で
  差し替え）。実 SDK/実 TTS はコードパス上で実行されない。

### 問 7. S2 挙動を汚さないか — PASS

- `transcript-buffer.mjs` diff: `speaker` は任意・**既定 "you"**（L120 相当 `input.speaker ?? "you"`）、不正値のみ
  `RangeError`（VALID_SPEAKERS = {you, soul}）。エントリは `Object.freeze` 維持（freeze 済みオブジェクトに speaker を
  含めるだけ）。**onDiscard の payload に speaker を足していない**（blank discard info は `{startMs, endMs, text, reason}`
  のまま = 既存 deepEqual を破らない）。append-only 契約不変。
- `cockpit-server.mjs` の `toWireEntry`: `speaker: "you"` ハードコード → `entry.speaker ?? "you"` に変更。you エントリは
  speaker="you" を持つ（追加的）ため wire 出力は "you" のまま——**既存 you 経路の観測結果は不変**。
- 回帰の実測: `node --test` = **tests 257 / pass 257 / fail 0**（TEST_EXIT=0）。baseline 231 → +26。既存 11
  (transcript) + 21 (cockpit) テストは書き換えられず全通過（wave 計画 §4-1「追加的変更でテスト無退行」を満たす）。

### 問 8. soul の startMs/endMs=0 と appendedAtMs 軸の設計判断 — 健全（non-blocking）

魂の発話は VAD ストリーム区間を持たないため startMs/endMs=0 とし、窓の時間軸を startMs ではなく壁時計
`appendedAtMs` に置く判断（fire-injection.mjs L10-14・transcript-buffer JSDoc）は**設計として健全**。you と soul を
単一の実時間軸で並べるには壁時計軸が必須で、この選択は必然。s2-followup の「遅延 append」前提とも整合的
（appendedAtMs は ASR 完了時刻 ≈ 直近の実会話時刻に十分近く、"直近 5 分の会話" の意味を保つ）。範囲としては
Domain A の設計裁量内で妥当。**non-blocking**（下記 non-blocking 所見 1 参照）。

---

## non-blocking 所見（blocking ではない・記録のみ）

1. **appendedAtMs 窓の遅延 append 感度（設計メモ）**: 窓は append 時刻基準ゆえ、ASR が大きく遅延した you 発話は
   実発話から見て窓の縁で前後しうる。既定 5 分に対しては実害の範囲外だが、将来 window を極端に短くした場合の
   感度として計測（Domain B の `experiments/s3-summon.md`）で観測しておくと良い。仕様上の欠陥ではない。

2. **preflight の npm script 未登録 / GET /api/fire の 405 化**（Gnome 質問 1・2）: いずれも Domain A の契約健全性には
   影響しない（`preflight-cockpit` の既存型踏襲・busy 保護は状態機械が担う）。405 明示化は Domain B の UX 裁量、
   script 登録は任意。design レーンとしては現状で問題なし。

---

## 実測サマリ（生数字）

| 項目 | 実測値 |
|---|---|
| git status（変更ファイル） | 4 M（cockpit-server / transcript-buffer + それぞれ .test）+ 5 新規 |
| llm-session / speak / ear-pipeline status | 空（M なし・不変） |
| package.json diff | 空（差分ゼロ） |
| lockfile diff（pnpm-lock / package-lock） | 空（差分ゼロ） |
| preflight-fire | RESULT: PASS / EXIT=0 / PROCESS_EXIT=0 / no hang |
| node --test | tests 257 / pass 257 / fail 0 / TEST_EXIT=0 |
