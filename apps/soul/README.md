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

`src/` は器官構造（S3 前に移動、2026-07-12）: `ears/`（聴覚: VAD・ASR・転写バッファ）/ `voice/`
（発声: TTS・モーラ写像・再生）/ `mind/`（知性: LLM セッション・認証ガード）/ `channel/`（器との
契約クライアント）/ `cockpit/`（操縦席）/ `cli/`（入口）/ `test-support/`（テスト補助）。テストは
実装と同居（`.test.mjs`）。過去の wave 記録内の旧パスは歴史記録としてそのまま。

- **サブスク枠認証ガード**（`src/mind/env-guard.mjs`）: 起動時に `ANTHROPIC_API_KEY` /
  `ANTHROPIC_AUTH_TOKEN` / `CLAUDE_CODE_USE_*` が設定されていれば**起動拒否**（サブスク枠でなく
  API 従量課金になる事故の防波堤）。魂は `/login` のサブスク OAuth 資格情報で動かす前提。
- **常駐 LLM セッション**（`src/mind/llm-session.mjs`）: `query()` を常駐ストリーミング入力モードで使い
  1 プロセスを保持（毎回 `query()` の spawn コストを畳む）。`settingSources: []` / `tools: []` /
  `model: claude-opus-4-8` / `maxTurns: 1` / `persistSession: false`。
- **会話 CLI**（`src/cli/cli.mjs`）: stdin の一文 → 応答 → 器の口 + スピーカー（`speak.mjs`）。
- **計測**（`scripts/first-light.mjs` → `discussion/ai-cohost/experiments/`）: 枠消費（usage）+
  レイテンシ（TTFT / E2E）を記録し続ける。

install（ユーザーの作業）と起動:

```
cd apps/soul/agent && npm install    # 1 回だけ（lockfile は apps/soul/agent 内で完結）
node apps/soul/agent/src/cli/cli.mjs "ws://127.0.0.1:<port>/channel?token=<token>"
```

実器接続・実再生を伴う起動（CLI / `scripts/preflight-e2e.mjs`）は**人間ゲート**の領分
（手順は `discussion/ai-cohost/implementation/waves/s1/human-gate-procedure.md`）。

#### S2: 耳（ローカル常時 ASR → 転写バッファ）

マイク→ffmpeg（16kHz mono s16le）→ Silero VAD（onnxruntime-node・`src/ears/silero-vad.mjs`）→
発話セグメンタ（`src/ears/speech-segmenter.mjs`）→ PCM リング切り出し→ whisper.cpp `whisper-server`
（kotoba-whisper q5_0・CPU・localhost）→ **転写バッファ（正本・`src/ears/transcript-buffer.mjs`）**。
結線は `src/ears/ear-pipeline.mjs`（常駐・クリーンシャットダウン・ASR 直列キュー・死活監視）。

- **バイナリ/モデルは非コミット**（`vendor/` は .gitignore 済み）: whisper 一式 +
  `ggml-kotoba-whisper-v2.0-q5_0.bin` + `silero_vad.onnx` をユーザーが配置する。
- **レイテンシ既定**（実測根拠は `discussion/ai-cohost/experiments/s2-ears.md`）:
  whisper-server 6 スレッド + **発話長比例の動的 `audio_ctx`**（`src/ears/whisper-inference.mjs`）で
  発話終了→転写 ≈1.5〜2s（全窓のままだと ≈6.6〜9.5s）。
- **耳 CLI 診断**: `node apps/soul/agent/src/cli/ears-cli.mjs --device "マイク名"`（`--list-devices` で
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
- **画面**（`src/cockpit/cockpit.html`・単一ファイルの vanilla HTML/CSS/JS・**ビルドチェーン/CDN/npm 依存
  ゼロ**・ブラウザ組み込みの `EventSource`（SSE）+ `fetch` のみ）: ヘッダ（耳の Listening/Stopped +
  whisper/ffmpeg 死活・down は赤 + 理由）/ Microphone ドロップダウン（`--list-devices` の廃止置換）+
  Start/Stop / Timeline（本文行 + (speaking) ライブ行・時刻/話者/本文/レイテンシ）/ footer（discarded・
  uptime）。正本はプロセス側で **タブを閉じても魂は死なない**（開き直せば `GET /api/state` で復元）。
- **サーバ**（`src/cockpit/cockpit-server.mjs`・Domain A）: HTTP 静的配信 + 制御 API（デバイス列挙 / 耳 start
  /stop / 状態）+ SSE ライブチャネル。**127.0.0.1 限定**（非 loopback host は構築時に throw・認証なし）。
- **デバイス選択の永続化**（`src/cockpit/cockpit-settings-store.mjs`）: 選んだマイクを
  `cockpit-settings.local.json`（.gitignore 済み・**非コミット**）に記憶し次回の初期選択に使う。
  読み書き失敗は握って続行（起動を止めない）。
- **preflight（マイク不要）**: `scripts/preflight-cockpit.mjs`——サーバを loopback に起動し
  `GET /`（HTML）/ `GET /api/state` / `GET /api/devices` が応答することを検証（耳の Start は押さない
  = 実デバイス非依存）。
- **実マイクを使う操縦は人間ゲートの領分**（手順は
  `discussion/ai-cohost/implementation/waves/s2.5/human-gate-procedure.md`）。

#### S3: 呼べば応える（発火 + 会話ログ注入）

「AI は全部聞くが、全部では考えない」——耳は常時聞いて会話ログ（転写バッファ・話者 you/soul）に
積み、**Fire の瞬間だけ**直近 X 分の会話ログを LLM に注入して一言を得、声 + 口で返す。
発火経路は操縦席の **Fire ボタン** / `POST /api/fire` / 同梱 AHK スクリプト。

- **発火オーケストレータ**（`src/mind/fire-orchestrator.mjs`・Domain A）: fire → 窓収集
  （`src/mind/fire-injection.mjs`・直近 5 分・4000 字上限は新しい方優先）→ ask（最小仮面
  `FIRE_SYSTEM_PROMPT`・claude-opus-4-8）→ speak（S1 経路）→ 会話ログへ speaker:"soul" 追記。
  busy 状態機械（idle/thinking/speaking・busy 中の fire は無視）。
- **fire 有効の操縦席起動**（`scripts/cockpit.mjs`・Domain B）: Channel URL は **操縦席（ブラウザ）の
  Channel 欄から入力**するのが標準（S3 追撃 domain-c・「CLI を触らせない」思想の徹底）。`--channel` は
  **後方互換の初期値**として残る:

  ```
  # 標準: --channel なしで起動し、ブラウザの Channel 欄に URL を入れて Fire を有効化（URL は記憶される）
  npm run cockpit --prefix apps/soul/agent
  # 後方互換: 初期 URL を CLI で渡す（起動時に LLM セッションを eager 生成・TTFT 先払い）
  npm run cockpit --prefix apps/soul/agent -- --channel "ws://127.0.0.1:<port>/channel?token=<token>"
  ```

  追加オプション: `--tts-base-url <url>` / `--speaker <id>` / `--fire-window-min <分>`（注入窓・
  既定 5）/ `--fire-max-chars <n>`（注入上限・既定 4000）/ `--expression-gain <倍率>`（演出の強さ・
  全 peak 一括スケール・既定 1.0・許容 0.1〜3.0・域外/非数値は起動時エラー・S4 追撃 domain-c）。
  Channel URL は `cockpit-settings.local.json`
  （.gitignore 済・token を含むため**非コミット**）に `lastChannelUrl` として記憶し次回起動で復元する。
  **S2.5 無退行**: URL も Fire も使わなければ LLM セッションの spawn（≈12s）は走らない（session/player は
  「実際に fire される時」まで遅延生成・`--channel` 明示時のみ起動時 eager）。**Channel は初回 Fire 時に接続**
  （失敗は操縦席に fire error として出て、次の Fire で再試行 = 器を後から立ててもよい。URL 変更時は
  既存接続を破棄して次回 Fire で再接続）。UI/ログは `redactToken` を通し token を平文で出さない。
  env ガード（サブスク枠）は session 初回生成時に明示的に通す。
- **操縦席の発火 UI**（`src/cockpit/cockpit.html`）: Fire ボタン（soul の thinking/speaking 中は
  disable + 状態表示）・発火マーカー行（受理の瞬間 + 注入量を Timeline に刻む）・soul 行（話者
  `soul`・青系ラベル）・発火失敗はゴースト行（`(fire: empty reply)` / `(fire error: …)`）。
- **グローバルホットキー（任意・AHK）**: `scripts/fire-hotkey.ahk`（AutoHotkey v2）。ゲーム中に
  操縦席タブが非フォーカスでも既定 Ctrl+Alt+F で `http://127.0.0.1:8181/api/fire` へ POST する
  （127.0.0.1 以外へは何も送らない・ポート/キーはファイル先頭で編集）。導入手順はファイル内
  コメント参照。AHK が無くてもゲートは Fire ボタンで成立する。
- **preflight（SDK 不要・マイク不要）**: `scripts/preflight-fire.mjs`——fake session/speak/channel/
  player で実 orchestrator + 実 HTTP/SSE の縦貫通を検証。
- **計測**: `scripts/measure-fire.mjs`——**実 SDK を最大 5 ask**（ハードガード付き）で fire→ask の
  TTFT / usage / 注入文字数を計測（speak/channel/player は fake）。結果は
  `discussion/ai-cohost/experiments/s3-summon.md`。サブスク枠を消費するので不用意に走らせない。
- **全器官起動（人間ゲート）の手順**:
  `discussion/ai-cohost/implementation/waves/s3/human-gate-procedure.md`。

#### S4: 表情が乗る（演出語彙 + インラインタグ）

「AI は全部聞くが、全部では考えない」の**返事に、内容に応じた表情がついてくる**。LLM の応答に
ごく短い**表情タグ**（半角山括弧の語）が混ざると、魂がそれを剥がして読み上げ文と分け、器の
`intent.envelope`（ADS カーブ束）へ翻訳して**発話開始と同時に**目・視線・頭・体を動かす。

- **タグ語彙 6 語**: `<smile>` / `<troubled>` / `<surprised>` / `<nod>` / `<look-away>` / `<look-camera>`。
  最小仮面 `FIRE_SYSTEM_PROMPT` に「感情が動いたときだけ添える」教示を足しただけ（人格の作り込みは
  persona の領分・引き続き貧しく）。**実 SDK 観測で 5/5 の応答にタグが乗った**（未知タグ 0・記録は
  `discussion/ai-cohost/experiments/s4-expressions.md`）。
- **パイプライン**（`src/mind/`・Domain A）: `expression-parser.mjs`（タグ剥離・純関数・`<` `>` が
  読み上げ文に残らない性質テストで固定）→ `expression-table.mjs`（**6 語 → スロット演出束・唯一の
  数値の在り処**）→ `expression-translator.mjs`（語 → envelope payload 列・**強さ係数**適用 + 域クランプ）
  → `fire-orchestrator.mjs`（発話開始時に `channel.sendEnvelope` をスロット毎に送出・器拒否/送出失敗は
  診断へ握って**発話を止めない**＝部分適用は正常系）。タグのみ応答は「発話せず演出のみ」。
- **操縦席の可視化**（`src/cockpit/cockpit.html`）: 演出適用を**演出イベント行**（`expr` ラベル・
  `語 ✓適用/✗拒否` スロット数）で Timeline に刻む。語彙外タグは**ゴースト行**（`(unknown tag: …)`・
  淡色）で痕跡を残す（声にも演出にも出ないが「無言の消失」にしない）。
- **調整の在り処**: 演出**強さ係数**（全 peak 一括スケール・既定 1.0）は
  `createFireOrchestrator({ expressionIntensity })` のオプション。**操縦席には調整 UI を置かない**裁定
  （運用面は CLI/設定限定）。符号（向き）と各語の数値を触りたいときは `expression-table.mjs` の該当行
  だけを直す（数値はここ 1 箇所）。
- **現素材の制約（正直な注記）**: `mouth-smile` は現素材で keyform 未設定＝**見えない**（標準語彙
  としては書く）。**見える本命は目・視線・頭・体**。`nod` は v0 は ADS 単峰＝「下げて保持して戻す」
  近似（多峰の頷きは将来）。head/gaze/body の符号（正がどちらの向きか）は**リグ依存で未確定**——
  実機での見え方は人間ゲートで確定する。
- **観測**（SDK 実消費・最大 5 ask）: `scripts/observe-expressions.mjs`——タグ教示入り
  `FIRE_SYSTEM_PROMPT` で**タグの実出現率・出現位置・未知タグ率**を観測（発話・器・チャネルは使わず
  ask の生応答だけ）。結果は `discussion/ai-cohost/experiments/s4-expressions.md`。
- **preflight（SDK 不要・マイク不要）**: `scripts/preflight-fire.mjs` に演出縦貫通を追加——fake の
  タグ込み応答が `sendEnvelope`（fake accepted）→ SSE `expression` まで通ることを実 HTTP/SSE で確認。
- **全器官起動（人間ゲート）の手順**:
  `discussion/ai-cohost/implementation/waves/s4/human-gate-procedure.md`（S3 の手順に「感情が動く話題を
  振る → 返事に表情が乗るのを見る」を足したもの）。
