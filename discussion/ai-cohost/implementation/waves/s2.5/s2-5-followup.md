# S2.5 follow-up 記録: wave 内で対応しない持ち越し事項

> Status: 記録開始（2026-07-12, Gnome / S2.5 Domain B）。台帳の流儀は
> [../s2/s2-followup.md](../s2/s2-followup.md) を踏襲（各項目は発生源レビュー/契約へのリンクで根拠を辿れる）。
> 出典: [../../reviews/s2.5/domain-a-review.md](../../reviews/s2.5/domain-a-review.md) non-blocking notes +
> [domain-a.md](domain-a.md) §10 質問。Domain B（ページ本体・永続化・起動・preflight・docs）は完了。

## 1. Domain A レビュー non-blocking のうち Domain B で拾わなかったもの（台帳）

Domain B は「ページ・永続化・起動導線・preflight・docs」を Domain A サーバの上に乗せる範囲であり、
**Domain A のサーバコード（`cockpit-server.mjs`）とその機械テスト（`cockpit-server.test.mjs`）は
変更しない**（利用のみ）。ゆえに以下の Domain A レビュー non-blocking は Domain B の scope では
回収できず、S3 以降へ持ち越す:

1. **`409`（transitioning）経路の機械テストが無い**。start/stop の同時多重を弾く `409` 応答は
   Domain A に実装済みだが、それを固定するテストが `cockpit-server.test.mjs`（変更禁止）に無い。
   ページ側は start/stop 中にボタンを disable（`setBusy`）して多重発火を UI で抑止しているが、
   これは `409` 契約の**テスト固定**ではない。回収するなら Domain A テストにケース追加（サーバの
   `transitioning` 中に 2 発目を投げて `409` + state を assert）が素直。Domain B からは触れない。

2. **`GET /api/devices` の列挙失敗（error 文字列 + `devices: []`・HTTP は 200）の HTTP レベル固定が
   無い**。`enumerateDevices` の失敗自体はユニットで固定済みだが、「失敗しても `/api/devices` が
   `200` で `{devices:[], error:"…"}` を返す」ことを HTTP 経由で assert するテストは Domain A に無い。
   **Domain B の `preflight-cockpit.mjs` は実 ffmpeg 不在時に `GET /api/devices → 200 deviceCount=0
   error="ffmpeg spawn failed: … ENOENT"` を実測で確認済み**（機械ゲートの生ログに残る）が、これは
   preflight であってテストスイートの回帰固定ではない。恒久固定は Domain A テストに 1 ケース
   （`enumerateDevicesImpl` を error 返しに注入 → HTTP 200 + error 文字列を assert）が素直。

3. **履歴レイテンシの非対称は【設計どおり・回収不要】**。`GET /api/state` の `transcripts[]` には
   `latencyMs` が載らない（レイテンシは live 限定の transient 情報・[domain-a.md](domain-a.md) §3.3 注 /
   レビュー N3）。**Domain B のページはこの非対称を正しく消費する**——SSE `transcript` の live 行だけ
   `(1.5s)` を描き、履歴復元行はレイテンシ無しで描く（`cockpit.html` の `latencyMs != null` 分岐・
   `cockpit-page.test.mjs` で固定）。これは持ち越しではなく「契約どおりに実装した」記録。

4. **SSE `res.write` 失敗時の除去を `req 'close'` 任せにしている**。Domain A の `broadcast` は
   `res.write` を try/catch で握るだけで、書き込み失敗そのものでは購読者集合から即座に外さない
   （切断は `req.on("close")` が拾う前提）。実害は「切断済み接続へ次フレームまで空 write を試みる」
   程度で、`closeAllConnections` を持つ close 経路とも整合するため v0 では問題にならない。長時間配信で
   死んだ接続が溜まる兆候が出たら、write 失敗時にも購読解除する明示ガードを Domain A に足す
   （[../../reviews/s2.5/domain-a-review.md](../../reviews/s2.5/domain-a-review.md)）。Domain B は
   サーバを触らないので未回収。

5. **`scripts/cockpit.mjs`（本番起動エントリ）の起動導線に機械テストが無い**（Domain B testレビュー §3-2 追記・Orch 2026-07-12）。`server.close()` 本体は Domain A の `cockpit-server.test.mjs` で固定済みだが、起動スクリプト固有の配線——URL 標準出力表示・SIGINT/stdin EOF での `shutdown()`→`server.close()`→`process.exit(0)`——を直接叩く機械テストは無い。wave 計画 §4-5「UI を閉じても魂が生きる」テストは Domain A（サーバ本体）で充足済みで、これはあくまで起動スクリプトの signal 配線の網羅補強候補（実挙動は preflight-cockpit + 人間ゲートの Ctrl+C 終了で担保）。非 blocking。回収するなら子プロセス spawn + SIGINT 送出 → clean exit を assert するスクリプトテストが素直。

## 2. Domain B の設計判断で S3 以降に効く持ち越し

1. **uptime はクライアント側の 1s ローカル刻み**（`cockpit.html`）。サーバの `state` イベントは
   start/stop/死活変化でしか飛ばないため、ページは `state` 到着時の `uptimeMs` を anchor にして
   ローカル時計で刻む（listening 中のみ・stopped で 0 リセット）。サーバ時刻とのドリフトは実用上
   無視できる（診断面の目安表示）。厳密な uptime が要るなら定期 `state` push か専用 tick イベントを
   Domain A に足す設計余地がある（S3 のコストメーター/レイテンシ実測と同時が素直）。

2. **拡張予約の DOM は「枠だけ」置いた**（screens/soul-cockpit.md §3・作り込まない）。話者ラベルは
   `you`/`soul` を扱える `speaker-*` クラス構造、各転写行に空の `.marker` span（発火マーカーの余地）、
   SSE `diagnostic` の購読口（未表示）を用意してあるが、v0 では `you` のみ・マーカー空・診断非表示。
   S3 で AI 応答合流（話者 `soul`）・発火マーカー・発火ボタン/キー状態を乗せるときの取り付け点。

3. **タブ開き直しの履歴復元と live のあいだに理論上の取りこぼし窓がある**。ページは load 時に
   `GET /api/state` で履歴を描き、直後に `EventSource` を開く。この 2 手のあいだに append された転写は
   （SSE 接続前なので）live 行として来ず、次の開き直しまで見えない。正本（転写バッファ）には残るので
   データ喪失ではなく「その瞬間の表示に出ない」だけ。UI は使い捨てのビューという設計（§1）の許容範囲。
   厳密同期が要るなら SSE 接続確立後に一度 `state` で履歴を差し替える等の手当てを検討（v0 では不要）。
