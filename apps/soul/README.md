# apps/soul — 魂の特区 (Soul Zone)

> 憲章: [`discussion/ai-cohost/concept/mvp-boundary-amendment.md`](../../discussion/ai-cohost/concept/mvp-boundary-amendment.md) §6（改定二号: 魂の特区。Accepted 2026-07-11）。

このディレクトリは「魂（AI 共演者のオーケストレータ: LLM 呼び出し・知覚・ペルソナ・TTS 等）」が住む**特区**である。憲法「リポジトリ側は決定論の器、知性は外部」の「外部」の定義が、C4 で「リポジトリの外」から「境界の外」へ改まった帰結として、魂は本リポジトリ内のこのディレクトリに住むことを許される。

## この特区の 6 条（憲章 §6 の要約）

1. LLM プロバイダ統合・知覚（画面キャプチャ / 視覚モデル）は **`apps/soul` 配下でのみ**許される。特区外では従来どおり禁止。
2. 魂が import してよいのは**操縦チャネルの契約（型・fixture=JSON）だけ**。器のコードを直接 import しない。器と魂の会話は実行時の WebSocket 越しのみ。
3. **器側の何ものも魂を import しない**。依存の向きは一方向（魂 → 契約のみ）。
4. 決定論・provenance の規律は特区内には適用されない。逆に特区は器の決定論に一切触れられない（2・3 の帰結）。
5. **秘密（API キー等）はコミットしない**。特区の設定は環境変数 / ローカル設定で扱う。
6. 特区内のツールチェーンは特区の自由。

## 物理コストの回避（裁定 4 → 裁定 1 で更新）

**このディレクトリ（`apps/soul` **直下**）には `package.json` を置かない。** `apps/*` は
`pnpm-workspace.yaml` の workspace glob 内なので、直下に `package.json` を置くと `pnpm-lock.yaml`
の `importers:` が増え `pnpm install` が要る。この規律は維持する。

**ただしサブディレクトリの独立パッケージは容認する（裁定 1・2026-07-12）。** workspace glob（`apps/*`）
は 1 階層のみなので、`apps/soul/<サブディレクトリ>/package.json` は **workspace 対象外＝lockfile 不変**。
魂本体が実依存（Agent SDK 等）を持つ日が来たため、`apps/soul/agent/` を独自 `package.json` +
`package-lock.json` を持つ**独立 npm パッケージ**として置く。`pnpm-lock.yaml` は不変のまま、依存は
そのサブパッケージ内で完結する。**install はユーザーの作業**（`cd apps/soul/agent && npm install`。
エージェントは install しない）。既存チェック 3 種（check:soul-zone / check:deps / check:source）は
いずれもこのサブパッケージに非該当（bare specifier 対象外・node_modules 走査除外）。

## 住人

### `reference-driver/` — 参照ドライバ（特区の最初の住人。C4 Domain D）

LLM・知覚を持たない**疑似魂**。決定論的なシナリオ（注視 → 傾げ → 沈黙 → 再開 → 意図的切断 → 再接続）を操縦チャネルへ流す常駐プロセス。

- **依存ゼロ**: 素の Node 22 のグローバル `WebSocket`（undici 由来のクライアント）のみを使う。npm 依存なし、tsx 等のトランスパイラなし。
- **直実行**: `node apps/soul/reference-driver/reference-driver.mjs <url>`。
- 役割: ①C4 の持続駆動機械テストの駆動源 ②契約エルゴノミクスの検証（書く行為そのもの） ③C5 人間ゲートの証人 ④魂側開発への実行可能な手本。

起動例:

```
node apps/soul/reference-driver/reference-driver.mjs "ws://127.0.0.1:17310/channel?token=<token>"
```

（`<url>` は自律ホストの Channel ページで `Open Channel` した後に表示される Endpoint URL。）

### `agent/` — 魂の本体（S1 の住人・独立 npm パッケージ）

LLM（Agent SDK / Opus）で会話し、TTS（AivisSpeech）で声を作り、操縦チャネルへ intent.speech を
送って器の口を動かす**実物の魂**。参照ドライバと違い LLM・TTS を持つ。上記「物理コストの回避」の
とおり、`apps/soul/agent/` は独自 `package.json` を持つ **独立 npm パッケージ**（workspace glob
対象外＝`pnpm-lock.yaml` 不変）。ランタイム依存は `@anthropic-ai/claude-agent-sdk` のみ、本体は
依存最小の `.mjs` + `node:test`。

- **サブスク枠認証ガード**（`src/env-guard.mjs`）: 起動時に `ANTHROPIC_API_KEY` /
  `ANTHROPIC_AUTH_TOKEN` / `CLAUDE_CODE_USE_*` が設定されていれば**起動拒否**（サブスク枠でなく
  API 従量課金になる事故の防波堤）。魂は `/login` のサブスク OAuth 資格情報で動かす前提。
- **常駐 LLM セッション**（`src/llm-session.mjs`）: `query()` を常駐ストリーミング入力モードで使い
  1 プロセスを保持（毎回 `query()` の spawn コストを畳む）。`settingSources: []` / `tools: []` /
  `model: claude-opus-4-8` / `maxTurns: 1` / `persistSession: false`。
- **会話 CLI**（`src/cli.mjs`）: stdin の一文 → 応答 → 器の口 + スピーカー（`speak.mjs`）。
- **計測**（`scripts/first-light.mjs` → `discussion/ai-cohost/experiments/`）: 枠消費（usage）+
  レイテンシ（TTFT / E2E）を記録し続ける。

install（ユーザーの作業）と起動:

```
cd apps/soul/agent && npm install    # 1 回だけ（lockfile は apps/soul/agent 内で完結）
node apps/soul/agent/src/cli.mjs "ws://127.0.0.1:<port>/channel?token=<token>"
```

実器接続・実再生を伴う起動（CLI / `scripts/preflight-e2e.mjs`）は**人間ゲート**の領分
（手順は `discussion/ai-cohost/implementation/waves/s1/human-gate-procedure.md`）。

#### S2: 耳（ローカル常時 ASR → 転写バッファ）

マイク→ffmpeg（16kHz mono s16le）→ Silero VAD（onnxruntime-node・`src/silero-vad.mjs`）→
発話セグメンタ（`src/speech-segmenter.mjs`）→ PCM リング切り出し→ whisper.cpp `whisper-server`
（kotoba-whisper q5_0・CPU・localhost）→ **転写バッファ（正本・`src/transcript-buffer.mjs`）**。
結線は `src/ear-pipeline.mjs`（常駐・クリーンシャットダウン・ASR 直列キュー・死活監視）。

- **バイナリ/モデルは非コミット**（`vendor/` は .gitignore 済み）: whisper 一式 +
  `ggml-kotoba-whisper-v2.0-q5_0.bin` + `silero_vad.onnx` をユーザーが配置する。
- **レイテンシ既定**（実測根拠は `discussion/ai-cohost/experiments/s2-ears.md`）:
  whisper-server 6 スレッド + **発話長比例の動的 `audio_ctx`**（`src/whisper-inference.mjs`）で
  発話終了→転写 ≈1.5〜2s（全窓のままだと ≈6.6〜9.5s）。
- **耳 CLI 診断**: `node apps/soul/agent/src/ears-cli.mjs --device "マイク名"`（`--list-devices` で
  デバイス列挙・`--help` 参照）。実マイク起動は人間ゲートの領分
  （手順は `discussion/ai-cohost/implementation/waves/s2/human-gate-procedure.md`）。
- **preflight（マイク不要の実機疎通）**: `scripts/preflight-vad.mjs`（実 ONNX）/
  `scripts/preflight-asr.mjs`（実 whisper）/ `scripts/preflight-ears.mjs`（縦貫通）/
  `scripts/bench-asr.mjs`（レイテンシ計測格子）。音声素材は TTS 合成 or 正弦波のみ
  （**実マイク・録音物は使わない**）。

#### S2.5: 操縦席（魂のローカル Web コクピット）

配信という利用シチュエーション（OBS + ゲーム + 器二体と並走）では「デバイス名を調べて打って起動」は
成立しない。そこで魂が **127.0.0.1 に小さな HTTP を立て、ユーザーはブラウザで開く**（「エンジンが
自分の顔を持つ」型）。器（runtime-player）には作らない（憲章「器は魂を知らない」）。UX 定義は
`discussion/ai-cohost/implementation/screens/soul-cockpit.md`（Accepted）。

- **起動（1 コマンド）**: `npm run cockpit --prefix apps/soul/agent`（既定 `http://127.0.0.1:8181/`・
  `-- --port N` でポート変更）。起動時にアクセス URL を標準出力に表示。**Ctrl+C / EOF で clean 終了**。
- **画面**（`src/cockpit.html`・単一ファイルの vanilla HTML/CSS/JS・**ビルドチェーン/CDN/npm 依存
  ゼロ**・ブラウザ組み込みの `EventSource`（SSE）+ `fetch` のみ）: ヘッダ（耳の Listening/Stopped +
  whisper/ffmpeg 死活・down は赤 + 理由）/ Microphone ドロップダウン（`--list-devices` の廃止置換）+
  Start/Stop / Timeline（本文行 + (speaking) ライブ行・時刻/話者/本文/レイテンシ）/ footer（discarded・
  uptime）。正本はプロセス側で **タブを閉じても魂は死なない**（開き直せば `GET /api/state` で復元）。
- **サーバ**（`src/cockpit-server.mjs`・Domain A）: HTTP 静的配信 + 制御 API（デバイス列挙 / 耳 start
  /stop / 状態）+ SSE ライブチャネル。**127.0.0.1 限定**（非 loopback host は構築時に throw・認証なし）。
- **デバイス選択の永続化**（`src/cockpit-settings-store.mjs`）: 選んだマイクを
  `cockpit-settings.local.json`（.gitignore 済み・**非コミット**）に記憶し次回の初期選択に使う。
  読み書き失敗は握って続行（起動を止めない）。
- **preflight（マイク不要）**: `scripts/preflight-cockpit.mjs`——サーバを loopback に起動し
  `GET /`（HTML）/ `GET /api/state` / `GET /api/devices` が応答することを検証（耳の Start は押さない
  = 実デバイス非依存）。
- **実マイクを使う操縦は人間ゲートの領分**（手順は
  `discussion/ai-cohost/implementation/waves/s2.5/human-gate-procedure.md`）。
