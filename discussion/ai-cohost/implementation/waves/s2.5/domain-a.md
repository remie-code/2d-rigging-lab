# S2.5 Domain A 実装記録: 魂のローカル Web コクピット・サーバ + 結線

> Status: 実装完了・機械テスト全緑（2026-07-12, Gnome）。install 不要（新規 npm 依存ゼロ）。
> スコープ: [../../orchestration/s2-5-wave-plan.md](../../orchestration/s2-5-wave-plan.md) §3 Domain A。
> UX の正: [../../screens/soul-cockpit.md](../../screens/soul-cockpit.md)（Accepted・source of truth）。
> 流儀の手本: S2 の spawn 差し替え + 合成 PCM テスト / [../s1](../s1) の最小 WS ダブル（ただし本ドメインは SSE 採用で WS ダブル不要）。

## 0. 判定サマリ

- **緑で裏取り済み**: cockpit サーバ（HTTP 静的配信 + 制御 API + SSE ライブ更新）+ 耳パイプライン結線 + デバイス列挙パース + クリーンシャットダウン。魂の全テスト **217/217 緑**（S1/S2 の 196 無退行 + 新規 21）。プロセスは close() 後に自然終了（ハングなし）。
- **3 モノレポチェック**: `check:soul-zone` 緑 / `check:deps` 緑 / `check:source` は**器（runtime-player）の既存違反 1 件で赤だが、これは本ドメイン外・本変更と無関係の pre-existing**（詳細 §7）。
- **lockfile 不変**: `pnpm-lock.yaml`・`apps/soul/agent/package-lock.json` ともに変更なし（新規依存ゼロ・§8）。
- **既存コードは 1 行も変更していない**: ear-pipeline / transcript-buffer / whisper-server / ffmpeg-capture / ears-cli は購読・呼び出しのみ（§9）。
- **Domain B が乗せるもの**: 実 HTML ページ本体・デバイス選択の file-backed 永続化実体・起動スクリプト（URL 表示）・preflight・docs。B が消費するワイヤ契約は §3〜§5 に明文化した。

## 1. 作成した全ファイル

すべて特区 `apps/soul/agent/` 内（pnpm workspace glob 対象外＝pnpm-lock.yaml 不変）。**新規 2 ファイルのみ・既存ファイルは無変更**。

| パス（絶対） | 新規/変更 | 役割 |
| --- | --- | --- |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit-server.mjs` | 新規 | コクピット・サーバ本体（`createCockpitServer` + `enumerateDevices` + `parseDshowDeviceList` + `createInMemorySettingsStore` + `assertLoopbackHost`）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit-server.test.mjs` | 新規 | 機械テスト 21 件（node:test フラット・全注入・実マイク/実 ffmpeg/実 whisper 不使用）。 |

依存グラフ: `cockpit-server.mjs` の import は自 zone 相対（`ear-pipeline.mjs`・`ffmpeg-capture.mjs` の `resolveFfmpegPath`・`ears-cli.mjs` の `normalizeDevice`）+ `node:http`/`node:child_process`/`node:fs/promises` のみ。器コードの相対 import ゼロ・新規 npm 依存ゼロ。

## 2. 伝送方式の選択と undici 回避の担保

- **SSE（Server-Sent Events）を採用**。ライブ更新は server→client の一方向 push（転写・discard・VAD・死活）だけで足り、制御は HTTP POST が担うため双方向 WS は不要。自作 WS を選ぶと機械テストのクライアントで既知の相性問題（undici `globalThis.WebSocket` が自作 WS サーバの `Sec-WebSocket-Accept` を "Incorrect hash received" で拒否・S2 記録）を避けるため `MinimalWebSocket` 注入が必要になるが、**SSE（`node:http` の `text/event-stream`）はこの問題自体が消える**。機械テストは素の `node:http` クライアントで event stream を読む（`cockpit-server.test.mjs` の `openSseClient`）。**undici WebSocket クライアントは一切使っていない**（禁止事項を構造的に満たす）。

## 3. ワイヤ契約: HTTP エンドポイント（Domain B 実装の正）

すべて `http://127.0.0.1:<port>`（既定 port `8181`・loopback 限定）。レスポンスは `application/json; charset=utf-8`（`GET /` を除く）・`cache-control: no-store`。

### 3.1 `GET /`
- 用途: index.html 配信。Domain A は最小プレースホルダ（`indexHtml` 文字列 or `indexHtmlPath` ファイルパス注入で差し替え可能）。**Domain B が本体を供給**（`options.indexHtml` か `options.indexHtmlPath` に渡す）。
- レスポンス: `200` / `content-type: text/html; charset=utf-8` / body = HTML。

### 3.2 `GET /api/devices`
- 用途: マイクのドロップダウン（`--list-devices` の廃止置換）。
- レスポンス `200`:
```json
{
  "devices": [ { "name": "PicoStreamingMicrophone", "alternativeName": "@device_cm_{...}" } ],
  "inputFormat": "dshow",
  "lastDevice": "PicoStreamingMicrophone",
  "error": null
}
```
- `devices`: 音声デバイスのみ（video は除外）。`alternativeName` は dshow の別名（無ければ `null`）。
- `error`: 列挙失敗時に文字列（例 `"ffmpeg spawn failed: ..."`）・成功時 `null`。失敗でも `200`（`devices: []`）で返す（UI がドロップダウンを空表示 + エラー通知できるように）。
- `lastDevice`: settings store の記憶値（初期選択に使う）。

### 3.3 `GET /api/state`
- 用途: 現在状態の権威スナップショット（タブ開き直しの復元・ヘッダ/フッタ/タイムライン初期描画）。
- レスポンス `200`（**この形が state スナップショットの正**。SSE の `state` イベント data も同一形）:
```json
{
  "ears": "stopped",                         // "stopped" | "starting" | "listening"
  "device": "PicoStreamingMicrophone",       // 現在選択中デバイス（raw 値）| null
  "health": {
    "whisper": { "status": "up", "reason": null },   // status: "up" | "down" | "unknown"
    "ffmpeg":  { "status": "up", "reason": null }     // down 時 reason に理由文字列
  },
  "appended": 5,                             // 転写バッファ appended 件数
  "discarded": 2,                            // 空転写破棄数（footer）
  "uptimeMs": 12340,                         // listening 中のみ >0（stopped で 0）
  "transcripts": [                           // 直近 N 件（既定 200・履歴復元用）
    { "seq": 0, "startMs": 970, "endMs": 2100, "text": "こんにちは", "appendedAtMs": 1720000000000, "speaker": "you" }
  ]
}
```
- 注: `transcripts` の要素に `latencyMs`/`audioCtx` は**載らない**（レイテンシは live 限定の transient 情報。履歴エントリには持たない）。live の転写レイテンシは SSE の `transcript` イベントで届く（§4）。

### 3.4 `POST /api/ears/start`
- 用途: 選択デバイスで耳を起動。
- リクエスト: JSON body `{ "device": "PicoStreamingMicrophone" }`（または query `?device=...`）。**省略時は settings の `lastDevice` にフォールバック**。device は raw 名で渡す（dshow の `audio=` 前置はサーバが `normalizeDevice` で補う）。
- レスポンス:
  - 成功 `200`: state スナップショット（§3.3 と同形。`ears: "listening"`）。デバイスは settings store に記憶される。
  - 起動失敗 `500`: `{ "error": "<理由>", "state": <スナップショット・ears stopped・whisper down> }`。pipeline は自身で dispose 済み。
  - 遷移中 `409`: `{ "error": "ears are transitioning; retry shortly.", "state": <スナップショット> }`（start/stop の同時多重を弾く）。
  - 既に listening のとき `200`（冪等・現状 state を返す）。**デバイス変更は Stop→Start**。

### 3.5 `POST /api/ears/stop`
- 用途: 耳を停止（pipeline.dispose）。
- リクエスト: body 不要。
- レスポンス `200`: state スナップショット（`ears: "stopped"`・health unknown・uptime 0）。遷移中は `409`。

## 4. ワイヤ契約: SSE ライブチャネル（Domain B 実装の正）

- 接続: `GET /api/events`（`Accept: text/event-stream`）。`content-type: text/event-stream; charset=utf-8`。
- 接続直後: コメント行 `: connected` に続けて **初期 `state` イベント**（現在の state スナップショット）を 1 発送る（タブを開いた瞬間に fetch 無しで同期できる）。
- フレーム形式: 標準 SSE（`event: <type>\ndata: <JSON 1 行>\n\n`）。
- **クライアント切断は購読解除のみ**（`req` の `close` で購読者集合から外す）。**pipeline は畳まれない**（UI は使い捨て・魂は生存）。

### イベント種別

| `event:` | 発火契機 | `data:` の形（JSON） |
| --- | --- | --- |
| `state` | 接続直後・耳 start/stop・死活変化 | §3.3 の state スナップショット全体（権威）。ヘッダ/フッタ/タイムライン履歴の同期に使う。 |
| `vad` | pipeline の `onVadEvent`（(speaking) ライブ行） | `{ "type": "speechStart"\|"speechEnd"\|"speechCancel", "tMs": <number>, "startMs": <number\|null>, "endMs": <number\|null>, "durationMs": <number\|null>, "reason": <string\|null> }` |
| `transcript` | pipeline の `onTranscript`（正経路・append） | `{ "seq", "startMs", "endMs", "text", "appendedAtMs", "speaker": "you", "latencyMs": <number\|null>, "audioCtx": <number\|null>, "appended": <number>, "discarded": <number> }` |
| `discard` | `transcriptBuffer.onDiscard`（空転写破棄） | `{ "startMs", "endMs", "reason": "blank", "appended": <number>, "discarded": <number> }` |
| `diagnostic` | pipeline の `onDiagnostic`（任意表示用） | `{ "type": <string>, "message": <string\|null>, "reason": <string\|null> }`（health は変えない補助情報） |

- タイムライン更新は `transcript`（本文行）+ `vad`（(speaking) ライブ行）で駆動。footer の discarded/uptime は `state`（uptime）+ `transcript`/`discard` の `discarded` フィールドから更新できる（再 fetch 不要）。
- ヘッダの Listening/Stopped と whisper/ffmpeg up/down（down は赤 + reason）は `state` イベントで駆動。

## 5. settings store 注入インターフェース（Domain B が供給する実体の契約）

`options.settingsStore` に注入。**Domain A の既定は in-memory**（`createInMemorySettingsStore(initial?)`・no-op 永続）。**Domain B は file-backed 実体**（`apps/soul/agent/` 内・gitignore 対象ファイル）を同じ形で供給する:

```ts
interface SettingsStore {
  getLastDevice(): string | null | Promise<string | null>;  // 起動時の初期選択・start の device 省略時フォールバック
  setLastDevice(device: string | null): void | Promise<void>; // start 成功時に記憶（raw デバイス名）
}
```
- サーバは get/set を **`await` する**（同期実装でも Promise 実装でも動く）。
- `setLastDevice` の I/O 失敗（ディスク書き込み失敗等）は **起動を止めない**（握って続行）。`getLastDevice` の失敗は `null` にフォールバック。B の file-backed 実体はこの寛容契約に乗せてよい。

## 6. テスト結果（生の数字）

- **新規テストのみ**: `node --test src/cockpit-server.test.mjs` → `tests 21 / pass 21 / fail 0 / cancelled 0`（`duration_ms ≈ 243`）。プロセスは自然終了（ハングなし）。
- **全スイート（無退行確認）**: `apps/soul/agent` で `node --test` → `tests 217 / pass 217 / fail 0 / cancelled 0 / skipped 0`（`duration_ms ≈ 1019`）。**S1/S2 の 196 件無退行 + 新規 21 件 = 217**。
- 新規 21 件の内訳:
  - パース単体 3（`parseDshowDeviceList` 新形式 `(audio)`・旧形式セクション見出し・空/雑テキスト）。
  - `enumerateDevices` spawn 注入 3（正常パース・spawn error・spawnImpl throw）。
  - loopback 固定 3（`assertLoopbackHost` throw/許容・構築時 throw・listen が 127.0.0.1）。
  - HTTP エンドポイント 8（`GET /` プレースホルダ・`GET /` 差し替え・`/api/devices`・`/api/state` 初期・start→stop ライフサイクル + デバイス記憶 + uptime・start 失敗 500・device 省略フォールバック・履歴復元・404）。
  - SSE 疎通 1（初期 state + vad + transcript + discard + whisperDown→health down を 1 接続で縦貫通）。
  - UI 切断で pipeline 生存 1（blocking 基準 5）。
  - クリーンシャットダウン 1（close で dispose・冪等・close 後リクエスト拒否）。

## 7. 3 モノレポチェックの結果

- `pnpm run check:soul-zone` → **緑**（`1306 source files scanned; no 器→魂 imports and no 魂→器 code imports.`）。新規 2 ファイルは自 zone 相対 import + node 組み込みのみ。
- `pnpm run check:deps` → **緑**（`Dependency guard passed.`）。
- `pnpm run check:source` → **赤（pre-existing・本ドメイン外）**。唯一の違反は `apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint`。この器（runtime-player）ファイルは**本変更で 1 バイトも触れていない**（`git status` でクリーン）。新規 cockpit ファイルはこのチェックで**違反ゼロ**（catch-all 名でも barrel でもない）。→ 本ドメインの導入による退行ではなく、既存の器側の状態。Orch へエスカレーション（本ドメインの受け入れとは独立に扱うべき既存事象）。

## 8. lockfile 不変の確認方法と結果

- `git status --porcelain | grep -i lock` → 該当なし（`(no lockfile changes)`）。
- `git diff --stat -- pnpm-lock.yaml apps/soul/agent/package-lock.json` → 出力なし（差分ゼロ）。
- 新規依存ゼロ（`package.json` も無変更）。vanilla + Node 組み込み（`node:http`/`node:child_process`/`node:fs/promises`）のみ。express 等は足していない。

## 9. 設計判断・裁量箇所・既存コードへの非接触

- **既定ポート `8181`**（裁量）: whisper 8178 / AivisSpeech 10101 / editor 5173 系と離した loopback ポート。`options.port` で上書き・`0` で自動割当（テスト）。UX に指定はなく B が起動スクリプトで確定・URL 表示する領分。
- **バインドは 127.0.0.1 固定**: `assertLoopbackHost` が非 loopback host を構築時点で throw（`0.0.0.0` 等でうっかり公開しない）。listen は常に loopback。テストで固定（blocking 基準 3）。
- **ffmpeg 死活の解釈**（裁量・要確認候補）: pipeline の `ffmpegExit` 診断は `willRestart` を持つ。`willRestart === false`（再起動予算切れ＝恒久死）のときのみ ffmpeg を `down` にする。`willRestart === true`（capture が自己回復する transient blip）は `up` のまま。ffmpeg の「復帰した」を告げる既存フックが無いため、これが既存 API で表現できる最も正直な死活。
- **whisper 死活**: start 成功で楽観的 `up`。`whisperDown` 診断で `down` + reason（2 経路監視の GUI 反映）。stop で `unknown` にリセット。
- **転写レイテンシは live 限定**: `/api/state` の履歴エントリには載せず、SSE `transcript` イベントにのみ付ける（buffer entry に latency フィールドが無いのに合わせた・正本を汚さない）。
- **CLI 起点（main）は未作成**: 本番起動の薄い main は Domain B の領分（npm script 登録・URL 表示）。Domain A はテスト可能な DI 関数（`createCockpitServer`・`enumerateDevices`・`parseDshowDeviceList`）に全ロジックを寄せ、main は作っていない。
- **既存コードへの非接触（明示）**: `ear-pipeline.mjs`・`transcript-buffer.mjs`・`whisper-server.mjs`・`ffmpeg-capture.mjs`・`ears-cli.mjs` は**読み取り import のみ**（`resolveFfmpegPath`・`normalizeDevice`・`createEarPipeline` を利用）。結線は既存の `onVadEvent`/`onTranscript`/`onDiagnostic` コールバックと `transcriptBuffer.onDiscard`/`stats()`/`last()` の購読だけで成立し、**既存挙動を変える外部通知フックの追加は不要だった**（結線不能箇所なし）。

## 10. 質問（Orch/Undine へ）

1. **ffmpeg 死活の transient 表現**（§9）: 現状は `willRestart === true` の再起動を UI に出さず `up` のままにしている。配信中に一瞬でも ffmpeg が再起動したことを操縦席で見せたい（例: 一時的な黄色/blip 表示）なら、S3 以降で `state` に `restarting` 相当のサブ状態を足す設計余地がある。v0 は「恒久死のみ赤」で足りるという理解で合っているか。
2. **`/api/state` の transcripts 上限**: 既定 200 件（`transcriptHistory`）にした。長時間配信で 200 を超える履歴を UI 初期描画で全部見せる要件があるか（B のページ設計次第。ページングは v0 で作っていない）。
3. **check:source の器側 pre-existing 違反**（§7）: 本ドメインとは独立だが、`pnpm run check` 全体が赤のままだと S2.5 機械ゲートの「3 チェック無退行」判定に干渉する。この既存違反の扱い（別途修正 / 既知として容認）を Orch 側で確定してほしい。
