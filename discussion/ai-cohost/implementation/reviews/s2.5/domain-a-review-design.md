# S2.5 Domain A レビュー（design レーン）: コクピットサーバ + 結線

> レビュアー: Review-Sylph（design レーン）。2026-07-12。
> 対象: `apps/soul/agent/src/cockpit-server.mjs` / `cockpit-server.test.mjs`（Gnome 実装記録: [../../waves/s2.5/domain-a.md](../../waves/s2.5/domain-a.md)）。
> 判定基準: [../../orchestration/s2-5-wave-plan.md](../../orchestration/s2-5-wave-plan.md) §2（設計の枠）/ §4（blocking レビュー基準）。

## 0. 総合判定: **PASS**（blocking ゼロ）

対象ファイルを読み、`git status`/`git diff` で既存コード非接触を独立に確認し、`node --test`（新規 21 件・全体 217 件）と `check:soul-zone`/`check:deps`/`check:source` を自分で実行して裏取りした。Gnome の実装記録（domain-a.md）の主張と実測が一致することを確認した。blocking 基準（wave-plan §4 の 1〜5）に抵触する差分はない。

## 1. 観点ごとの判定

### 1.1 127.0.0.1 バインド限定の構造的担保 — **適合**

- `createCockpitServer` の先頭で `const host = assertLoopbackHost(options.host ?? DEFAULT_COCKPIT_HOST);`（cockpit-server.mjs:266）。`assertLoopbackHost` は `LOOPBACK_HOSTS = {"127.0.0.1","::1","localhost"}` 以外を **構築時点で throw**（listen 前）。
- `listen()` は常にクロージャ変数 `host` を使う（cockpit-server.mjs:638 `server.listen(port, host, ...)`）。`options.host` を再参照する経路・`0.0.0.0` にフォールバックする分岐は存在しない。
- テストで固定済み: `assertLoopbackHost("0.0.0.0")` / `"192.168.1.10"` の throw、`createCockpitServer({ host: "0.0.0.0" })` の構築時 throw、実際の `listen(0)` の URL が `127.0.0.1` であることを検証（テスト 4〜6）。
- 独立実行で確認: `node --test` の該当 3 件が緑。

### 1.2 クリーンシャットダウン規律（S1/S2 教訓） — **適合**

- `close()`（cockpit-server.mjs:655〜685）は `if (closed) return; closed = true;` で冪等。2 回目呼び出しは no-op（テスト「close(): …冪等…」で検証・独立実行で緑）。
- 全 SSE 応答（`sseClients` の全 `res`）を `res.end()` → `sseClients.clear()`。`discardUnsub()` 呼び出し → `pipeline.dispose()` awaited（try/catch で best-effort）。最後に `server.closeAllConnections?.()` + `server.close(cb)`。
- `enumerateDevices` のタイムアウトタイマは `setTimeoutImpl` 生成後に `unref` 可能なら unref（cockpit-server.mjs:203-205）。子プロセス（デバイス列挙用の一時 ffmpeg）はタイムアウト時 `child.kill()`、通常時は `exit` で自然終了。ear-pipeline 本体の子プロセス/タイマ規律は既存コード（本ドメイン非接触）のまま。
- 実測: `node --test src/cockpit-server.test.mjs` は exit code 0 で自然終了（ハングなし・duration ≈ 244ms）。全体スイートも exit code 正常（217/217、duration ≈ 1005ms）。node:test がハングする型ではないことを独立に確認した。

### 1.3 UI を閉じても魂が生きる — **適合**

- `openSse()`（cockpit-server.mjs:607-621）の `req.on("close", () => sseClients.delete(res))` は購読者集合から外すのみで、`pipeline.dispose()` や `stopEars()` の呼び出しはコード上どこにも存在しない。
- 専用テスト「SSE 接続が切れても pipeline は生き続ける」（cockpit-server.test.mjs:517-537）: SSE クライアントを `close()` した後 60ms 待って `fake.record.disposed === false` と `/api/state` が `ears: "listening"` のままであることを検証。独立実行で緑。

### 1.4 新規 npm 依存ゼロ・ビルドチェーン非導入 — **適合**

- `apps/soul/agent/package.json` の `dependencies` は `@anthropic-ai/claude-agent-sdk` / `onnxruntime-node` のみ（変更なし。`git status` でクリーン確認済み）。
- cockpit-server.mjs の import は `node:http` / `node:child_process` / `node:fs/promises`（組み込み）+ 自 zone 相対（`./ear-pipeline.mjs`・`./ffmpeg-capture.mjs`・`./ears-cli.mjs`）のみ。express 等の混入なし（grep で独立確認）。
- `pnpm-lock.yaml` / `apps/soul/agent/package-lock.json` とも無差分（`git diff --stat` で独立確認、出力ゼロ）。

### 1.5 既存コード非接触 — **適合**

- `git status --porcelain` を `ear-pipeline.mjs` / `transcript-buffer.mjs` / `whisper-server.mjs` / `ffmpeg-capture.mjs` / `ears-cli.mjs` / `package.json` / 両 lockfile に対して独立実行 → 出力ゼロ（無変更）。新規ファイルは `cockpit-server.mjs` と `cockpit-server.test.mjs` の 2 件のみ。
- API 呼び出しの整合性をソース突合で確認: `createEarPipeline({ capture, onVadEvent, onTranscript, onDiagnostic })` の options 形は ear-pipeline.mjs の JSDoc と一致。`resolveFfmpegPath(optionPath, env)` / `normalizeDevice(device, inputFormat)` のシグネチャも実体と一致。`transcriptBuffer.stats()` / `.last(n)` / `.onDiscard(listener)` の呼び出しも transcript-buffer.mjs の公開 API と一致（購読・読み取りのみ、書き込み/削除 API には触れていない）。

### 1.6 undici 回避の担保 — **適合**

- cockpit-server.mjs / cockpit-server.test.mjs を grep した限り、実コードに `WebSocket` は一切登場しない（コメント中の設計判断の説明のみ）。
- ライブチャネルは SSE のみ。機械テストの SSE クライアント（`openSseClient`）は素の `node:http`（`http.request`）で実装されており、undici の `WebSocket`/`fetch` は使用していない。自作 WS も `MinimalWebSocket` 注入も不要（SSE 採用によりこの問題自体が構造的に発生しない）。

### 1.7 SSE 実装の正しさ — **適合**

- フレーミングは標準形 `event: <type>\ndata: <JSON 1 行>\n\n`（`broadcast()`, cockpit-server.mjs:333-343、および `openSse()` 内の直書き）。
- 接続直後: コメント行 `: connected` → 初期 `state` イベントを 1 発送出（cockpit-server.mjs:613-615）。テスト「初期 state・転写/VAD/死活がクライアントへ届く」で `waitFor(e => e.event === "state")` が最初の待ちとして機能することを確認。
- 複数購読者への配信: `sseClients` は `Set`、`broadcast()` は全件に `write`。個別 `write` は try/catch で保護され、1 クライアントの失敗が他クライアントの配信を止めない。
- エラー時のクライアント除去: `req.on("close", ...)` で購読解除。`write` 失敗時点では即時除去せず `close` イベント任せ（best-effort、コメントに明記）。実運用上は妥当な設計だが、以下「裁量許容」に記載。

### 1.8 エラー処理・状態遷移 — **適合**

- 遷移中多重（409）: `transitioning` フラグを最初の `await` 前に同期的にセット（cockpit-server.mjs:554-566, 569-581）。Node のシングルスレッド性から、2 件目のリクエストハンドラが走る時点では既に `transitioning === true` になっており、409 を確実に返す。ロジックはコード読解で正しさを確認したが、**この 409 パスを直接叩く専用テストは無い**（1.8 テストギャップとして下記に記載・非 blocking）。
- 起動失敗（500 + dispose）: `startEars()` の `p.start()` throw 時、`ear-pipeline.mjs` の `start()` 自体が失敗時に自身の `dispose()` を呼んでから throw する契約（ear-pipeline.mjs:373-380）に乗っており、cockpit 側は `pipeline = null` に落として `earsState = "stopped"` + `health.whisper = "down"` を返すのみ（二重 dispose を避ける設計として整合）。テスト「start 失敗は 500 + error・状態は stopped に畳む」で確認、独立実行で緑。
- 死活解釈: `whisperDown` 診断 → `health.whisper = "down"`。`ffmpegExit` は `willRestart === false`（恒久死）のときのみ `down`、`willRestart === true`（transient）は `up` のまま。この解釈は ear-pipeline.mjs の既存診断契約（`onDiagnostic` の `type`/`willRestart` フィールド）をそのまま読んでいるだけで、既存 API の意味を変えていない。設計判断としては裁量域（Gnome の質問 1 として Orch/Undine に投げられている）。

## 2. 裁量許容（blocking ではないが記録）

- **SSE write 失敗時の即時除去なし**（§1.7）: `write` が例外を投げても `close` イベント任せで除去する。TCP 切断は通常 `close` を発火させるため実害は薄いが、理論上「書き込みは失敗し続けるが close が来ない」ケースでは古い `res` が `sseClients` に残り続ける余地がある。v0 の許容範囲と判断する。
- **既定ポート 8181・裁量ロジックの死活解釈**（§1.8）: wave 契約に明記がなく Gnome の設計判断域。Domain B/Orch での確認待ち（Gnome の質問 1 と重複）。

## 3. 質問（Orch/Undine へ）

1. **`POST /api/ears/start`・`/stop` の 409 多重リクエストパスに専用テストが無い**。コード読解では正しい（`transitioning` フラグが最初の await 前に同期セットされるため JS のシングルスレッド性で安全）と判断したが、blocking 基準には明記されていないため PASS 判定に含めた。Domain B 完了前後で回帰保険としてテストを 1 本足す価値があるかは Orch の裁量判断を仰ぎたい（blocking ではない）。
2. **`check:source` の器側 pre-existing 違反**（Gnome の質問 3 と同一事象）: `apps/runtime-player/src/main/physiology/index.ts` の barrel 違反は本ドメインと無関係（`git status` でこのファイルが無変更であることを独立確認済み）だが、`pnpm run check` 全体の緑化が S2.5 の「3 チェック無退行」ゲート判定にどう影響するかは Orch 側の扱い待ち。design レーンとしては「本ドメインが原因ではない」ことのみ保証する。

## 4. 実行ログ（裏取りの生数字）

- `node --test src/cockpit-server.test.mjs`（`apps/soul/agent`）→ `tests 21 / pass 21 / fail 0`、exit code 0、duration ≈ 244ms。
- `node --test`（`apps/soul/agent` 全体）→ `tests 217 / pass 217 / fail 0`、exit code 0、duration ≈ 1005ms。
- `pnpm run check:soul-zone` → 緑（`1306 source files scanned; no 器→魂 imports and no 魂→器 code imports.`）。
- `pnpm run check:deps` → 緑（`Dependency guard passed.`）。
- `pnpm run check:source` → 赤（`apps/runtime-player/src/main/physiology/index.ts` のみ・本ドメイン非接触を `git status` で確認済み）。
- `git status --porcelain` 対象既存 5 ファイル + package.json + 両 lockfile → 出力ゼロ（無変更）。
