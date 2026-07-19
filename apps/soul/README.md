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
- **画面**（※ 単一ファイル vanilla HTML/CSS/JS の構成は**操縦席UI改定（2026-07-14・下記「操縦席UI改定」節）
  で三層 IA + preact+htm no-build 構成へ刷新**——以下は S2.5 当時の記録・機能は全て新 UI に保存されている）:
  ヘッダ（耳の Listening/Stopped + whisper/ffmpeg 死活・down は赤 + 理由）/ Microphone ドロップダウン
  （`--list-devices` の廃止置換）+ Start/Stop / Timeline（本文行 + (speaking) ライブ行・時刻/話者/本文/
  レイテンシ）/ footer（discarded・uptime）。正本はプロセス側で **タブを閉じても魂は死なない**
  （開き直せば `GET /api/state` で復元）。
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
  既定 5）/ `--fire-max-chars <n>`（注入上限・既定 4000）。Channel URL は `cockpit-settings.local.json`
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

#### S5: 目が開く（視覚発火）

「見たうえで発火」——通常 Fire（従来どおり・完全不変）とは**別の第二発火**として、操縦席で選んだ
対象ウインドウを 1 枚キャプチャし、直近の会話と合わせて画像込みで LLM に注入する。v0 は**単発・
その ask 限り**（画像を蓄積する機能は作らない・見比べは会話ログの言語痕跡で成立するという裁定）。

- **目の器官**（`src/eyes/`・Domain A）: `captureWindow(title)` が PowerShell（`System.Drawing`・
  .NET 内蔵・新規依存ゼロ）を 1 プロセス起動し、**PrintWindow(PW_RENDERFULLCONTENT)** で対象窓の
  composited 描画を取得 → 長辺 1024 に縮小 → JPEG(quality 75) → base64 を stdout で受け取る
  （**画像はディスクに一切書かない**）。`listWindows()` が起動中ウインドウ一覧（`{pid, processName,
  title}`）を返す（操縦席の「対象ウインドウ選択」の一覧取得ボタン用途）。対象未発見/最小化/
  キャプチャ失敗/タイムアウトは構造化エラー（`{error:{kind,message}}`）で正直に返す（成功を捏造
  しない）。gdigrab（ffmpeg）は DirectComposition 系描画が真っ白になる地雷があるため不採用
  （PrintWindow が唯一 composited 内容を撮れた経路・実測は
  `discussion/ai-cohost/implementation/waves/s5/domain-a.md` §6）。
- **視覚発火の結線**（`src/mind/fire-orchestrator.mjs`・Domain B）: `fire({ vision: true })` で起動
  する第二発火種別。対象未設定/キャプチャ失敗は **`session.ask` を呼ばずに中止**（「見て」と言われて
  盲目のまま答えるのは嘘になる、という裁定）。成功時は `[image(先行), text]` の content 配列を
  組み（会話窓 + 視覚指示「今の画面を見て、直近の会話と合わせて自然に反応してください。」）、通常
  Fire と完全共通のパーサ→speak→soul 記録→演出の経路へ渡す。画像は会話ログ（転写バッファ）へは
  一切積まない（speechText のみ append・ディスク非保存の流儀を会話ログにも適用）。`llm-session.mjs`
  の `ask(content)` は文字列に加え content ブロック配列（画像込み）も受理するよう拡張済み。
- **計器**（usage・裁定 2「計測できるようにして、早期検知」）: `session.ask` の戻り値 `usage`
  （`input_tokens`/`cache_read_input_tokens` 等）を通常 Fire・視覚発火の両方で `onUsage({usage,
  vision})` として通知する。操縦席は直近 1 回分の usage を表示する（累積グラフは持たない v0 最小
  実装）。
- **操縦席**（`src/cockpit/cockpit.html`・Domain C）: 「Vision target」セクション（一覧取得ボタン→
  `<select>`→対象設定・`cockpit-settings.local.json` に永続化＝Channel URL と同型）・「Fire
  (vision)」ボタン（`POST /api/vision-fire`）・「見た」マーカー行（縮小サムネ `<img>` 表示・データは
  SSE の `visionCaptured` イベントに載るだけでディスクには書かない）・失敗ゴースト行
  （`fireVisionError` の kind 表示）・usage 表示。
- **AHK 第二ホットキー**: `scripts/fire-hotkey.ahk` に `Ctrl+Alt+G`（`FireVision()`）を追加
  （既存 `Ctrl+Alt+F` は不変）。
- **ツマミなし**: 縮小長辺（1024）・JPEG 品質（75）は固定値（v0 は操縦席に調整 UI を置かない裁定・
  S4 のゲイン CLI 撤去の教訓を踏襲）。
- **実 SDK 観測**（最大 5 ask）: `scripts/observe-vision.mjs`——自分で起動したメモ帳窓（特徴的な
  マーカー本文入り）を実キャプチャし、実 `createLlmSession` へ画像込みで実射。返事が画面内容に
  言及するか・レイテンシ内訳・**画像を含む履歴が以後の ask でどう再送されるか（input_tokens 推移 +
  cache 系フィールドの有無）**を観測した。結果は
  `discussion/ai-cohost/experiments/s5-vision.md`（**prompt caching が効いており、履歴再送分は
  cache-read として計上されることを実測で確認**）。
- **実ゲーム窓は使っていない**: 上記いずれのスクリプトも対象は自分で起動したウインドウ（メモ帳）
  のみ（鉄の規律「実キャプチャ対象は自分で起動した窓のみ」）。実ゲーム窓での composited 撮影の
  成否・最小化/被覆時の実挙動・DPI>100% は未検証のまま
  `discussion/ai-cohost/implementation/waves/s5/s5-followup.md` へ持ち越されている。
- **全器官起動（人間ゲート・ゲーム起動込み）の手順**:
  `discussion/ai-cohost/implementation/waves/s5/human-gate-procedure.md`。

#### S6: 会話が続く（barge-in + 自発発火）

「相手が話し始めたら声が止まり、しばらくすると勝手にも喋る」——**声の器官刷新（WinRT
MediaPlayer 化・途中停止+出力デバイス指定）**・**barge-in（VAD 機械弁による中断+切断点の正直記録）**・
**発火スケジューラ（呼びかけ/区切り/沈黙の自発 3 種・LLM 非依存の機械判定）**・**操縦席の配線
（自発 ON/OFF トグル+出力デバイス選択+タイムラインマーカー）**の 4 ドメインから成る。

- **声の器官刷新**（`src/voice/audio-player.mjs`・Domain A）: 常駐 `System.Media.SoundPlayer`
  （PlaySync・ブロッキング）を **WinRT `Windows.Media.Playback.MediaPlayer`**（非同期・
  PowerShell 5.1 内蔵・新規依存ゼロ）へ刷新。`play(wavPath)`/`stop()`（barge-in の声止め）/
  `isPlaying()`/出力デバイス指定（`deviceName` → env `SOUL_AUDIO_DEVICE_NAME`）/
  `listAudioDevices()`（列挙）を追加。`speak()` は `playbackStartedAtMs` を追加で返す（切断点算出
  材料）。既定デバイス再生は S1 と無退行。
- **barge-in**（`src/mind/barge-in.mjs`・Domain B）: 耳の `speechStart` から最小持続時間
  （既定 200ms・`speechCancel` が来なければ確定）の機械弁で、再生中の魂発話を中断する。中断時:
  ① `player.stop()` ② `channel.sendSet({slotId:"mouth-open", value:0, ttlMs:400})`（器の既存意味論
  で口を強制 release・契約拡張なし）③ モーラタイムライン×再生経過で「実際に声に出た文字」を
  正直に算出（過大評価しない設計）④ 会話ログへ「接頭辞 + "…（遮られた）"」を 1 回 append
  （append-only 維持）。**S6 で soul 追記のタイミングが「speak 直後」→「発話完了 or 中断時」へ
  変更**（barge-in が効く窓を実際の再生区間に一致させるための意図的な意味論変更）。「朗読と合いの手」
  wave で**運転バーの ON/OFF トグル（既定 ON・`POST /api/barge-in`・永続化）**と**切断猶予 2000ms**
  （200ms の弁を通過しても即切断せず、その後 2 秒だけ「見合う」——猶予中に発話が終われば切らず続行。
  副次効能として短い相槌（<2 秒）でも切れなくなる）を追加。詳細は下記「朗読と合いの手」節。
- **発火スケジューラ**（`src/mind/fire-scheduler.mjs`・Domain C）: 「いつ喋るか」を LLM に一切
  問わず機械信号だけで決める純ロジック（import 文ゼロ = LLM/SDK への到達経路が構造的に存在しない）。
  ① **呼びかけ**（名前「こーでぃー」の文字列照合・不応期/確率なしで確実発火）② **区切り応答**
  （発話終了後 2 秒無音 + 不応期 8 秒 + 確率 35%）③ **沈黙**（45〜75 秒 + 長い不応期 90 秒 + セッション
  予算 6 回・視覚発火相当=画面を見て一言）④ **合いの手**（`interjection`・「朗読と合いの手」wave で
  追加。詳細は下記節）。数値は全部 v0 コード内定数（ツマミは作らない・人間ゲート
  の体感で直す前提）。
- **操縦席の配線**（`src/cockpit/cockpit.html`・Domain D）: 「Self-fire」トグル（`POST
  /api/self-fire`・手動 Fire は影響を受けない・`cockpit-settings.local.json` に永続化）・「Voice
  output」出力デバイス選択（`GET /api/audio-devices` → `<select>` → `POST /api/audio-device` で
  永続化。**適用は常駐プレイヤーのその場再起動**——次に声を出すときから新デバイスに切り替わる）・
  barge-in 中断マーカー行（切断点情報付き）・自発発火マーカー行（kind: call/turn-end/silence 表示）・
  スケジューラ診断のゴースト行（発火要求は出たが busy 等で実際には発火しなかった事実）。
- **実 SDK 観測**（5 ask・上限ちょうど使い切り）: `scripts/observe-conversation.mjs`——
  fire-orchestrator/fire-scheduler を実物のまま組み合わせ（player/channel/speak は fake・実
  TTS/実器/実マイクは不使用）、barge-in 中断+続きの発火・呼びかけ/区切り/沈黙の自発 3 種すべてを
  実 SDK ask で駆動した。結果は `discussion/ai-cohost/experiments/s6-conversation.md`（切断点の
  正直な算出・沈黙=視覚発火での画面言及・usage 推移を実測で確認。**barge-in の体感レイテンシは
  実マイク/実器が要るため未実施**として明記）。
- **人間ゲート手順（音響設営込み）**:
  `discussion/ai-cohost/implementation/waves/s6/human-gate-procedure.md`。

#### S7: 視聴者が混ざる（YouTube Live チャット合流）

「視聴者のコメントが会話に混ざる」——YouTube Live チャットを**壊れる前提の独立器官**として常駐取得し、
コメントを**転写バッファ正本の単一タイムライン**に `viewer(名前)` として合流させ、コメント到着を
**第 5 の発火語彙**（不応期 + 確率 + 予算）として扱う。コメント内「こーでぃー/Cody」呼びかけは
**確実に返す**（comment-call）。どのコメントに触れるかは LLM が選ぶ（機械信号は「来た」だけ）。

- **チャット器官**（`src/chat/`・Domain A）: 非公式 innertube（`youtube.com/watch?v=<ID>` →
  HTML 4 点抽出 → `get_live_chat` を continuation で回す）を**素の fetch のみ・新規依存ゼロ**で自前
  実装。状態機械（connecting/live/retrying/dead）・自動再接続（バックオフ・上限なし）・エラー分類
  （notLive=未開始は待ち続ける / ended=終了は終端 / extractFailed / network）・フック
  （onMessage/onStatus/onDiagnostic）。**魂の他部位への import ゼロ**（死んでも魂に無影響）・ディスク
  書き込みなし。取得経路は**ToS グレー**（非公式 API・ユーザー裁定で採用・開示済み）。公式 Data API
  v3 キーへの差し替えは器官内で完結する梯子（followup）。
- **合流 + 発火結線**（`src/ears/`・`src/mind/`・Domain B）: 転写バッファに `speaker:"viewer"` +
  `displayName`（soul 同型 `startMs/endMs=0`・窓は appendedAtMs）。注入描画は `viewer(名前): 本文`。
  発火スケジューラ `handleChatMessage`（**comment**=不応期 8s + 確率 35% + 予算 30 / **comment-call**=
  呼びかけ命中で確実発火・予算/不応期を掛けない）。comment/comment-call はいずれも `fire({vision:
  "preferred"})`（視覚対象があれば画像付き・無/失敗は通常発火へ静かに劣化）。**数値は v0 コード内定数**。
- **操縦席**（`src/cockpit/cockpit.html` + `cockpit-server.mjs` + `scripts/cockpit.mjs`・Domain C）:
  「Live chat」セクション（配信 URL/ID 入力 → **Connect chat** / **Disconnect**・`cockpit-settings.
  local.json` に配信 source を永続化＝Channel URL と同型）・チャット状態表示（connecting/live/
  retrying/dead の色分け）・**viewer 行**（`viewer(名前): 本文`・別色）・コメント発火マーカー
  （selfFire に kind:comment/comment-call）・取得死ゴースト行（chatDiagnostic の notLive/ended/
  extractFailed/network）。**チャット器官の生成/Connect/停止は cockpit-server 所有の POST 駆動遅延
  起動**（`POST /api/chat/connect` で `createLiveChatClient({source})` を生成 start・
  `onMessage→ingestChatMessage` 等で合流・`POST /api/chat/disconnect` と close で stop+破棄）。
  factory 注入で機械テストは fake 器官のみ（実 YouTube/実ネットに出ない）。
- **★ 耳を起動した状態で Connect する**（重要）: 合流先の転写バッファは耳パイプライン所有ゆえ、
  **マイク（耳）未起動ではコメントが合流できず発火しない**（`chatBufferAbsent` ゴースト行）。cohost は
  どのみち声も拾うので「マイクを Start してから Live chat を Connect」が素直な運用。
- **実疎通（テスト配信でコメントを拾って返す）は人間ゲートの領分**（機械テストは全 fake・実 YouTube への
  HTTP は 1 バイトも踏まない）。手順は
  `discussion/ai-cohost/implementation/waves/s7/human-gate-procedure.md`・followup は
  `discussion/ai-cohost/implementation/waves/s7/s7-followup.md`。

#### 操縦席UI改定: コントロールルーム化（観測/運転/設定の三層 IA・preact+htm no-build）

S8 前の独立閉問題（能力 wave でなく**振る舞い保存のリファクタ + IA 再設計 + 外観刷新**・2026-07-14）。
設定項目が画面の半分を占めていた旧レイアウトを、**観測（常時見たい・主役）/ 運転（配信中に触る・
常駐バー: Fire・Fire+視覚・自発トグル・口数・KILL 枠）/ 設定（一度きり・⚙ で開く引き出し）**の三層
IA に再設計した。UX の正は `discussion/ai-cohost/implementation/screens/cockpit-redesign.md`
（§7 視覚仕様 = モック承認済み・ダーク基調 + teal の話者色分け）。

- **起動は不変**: `npm run cockpit --prefix apps/soul/agent` 一発（**ビルド段ゼロ・ソース = 実行物**）。
- **構成**（`src/cockpit/`）: `cockpit.html` は最薄エントリ（`<div id="app">` + inline module が
  `ui/app.mjs` の `mount()` を呼ぶだけ・`<script src>` 不使用）。UI 実体は IA 区画ごとの `ui/*.mjs`
  （app/header/feed/rows/styles/control-bar/settings-drawer = preact コンポーネント層）+
  `view-logic/*.mjs`（SSE→表示文字列・状態導出の **preact 非依存純関数**・node:test fixture が
  保存オラクルの表示側固定点）。スタイルは `ui/styles.mjs`（COCKPIT_CSS）を mount 時に注入
  （CSS カスタムプロパティ手書き・フレームワークなし）。
- **vendor**: `src/cockpit/vendor/htm.preact.standalone.mjs`（preact+htm standalone バンドル・
  1 ファイル・hooks 込み・bare import ゼロ）をコミットして持つ**凍結ファイル**（編集しない）。
  ブラウザが読むだけで、**実行時 npm 依存ゼロ・devDep ゼロ・lockfile 不変**は維持（S2.5 の
  「単一自己完結 HTML」思想は操縦席については引退——引き継ぐ本当の制約はビルドなし・ソース=実行物・
  新規 npm 依存ゼロで、分割 .mjs の静的配信が全て満たす）。
- **配信**: cockpit-server に UI アセット静的ルートを追加（`/vendor/*.mjs`・`/ui/*.mjs`・
  `/view-logic/*.mjs` のみ・トラバーサル防止・`text/javascript`）。**既存 16 エンドポイント×13 SSE×
  6 設定キーのワイヤ契約は不変**（無退行の背骨 = `cockpit-server.test.mjs` 74 本が全緑のまま）。
- **機能は全て保存**（振る舞い保存 wave）: 行種 9 つ（転写 you/soul/viewer・speaking・ゴースト・
  発火/演出/視覚/barge-in/自発マーカー）・usage/discarded/uptime・Fire/Fire+視覚（busy disable）・
  自発トグル・Channel（token 秘匿）/YouTube/マイク/声の出力先/視界の全設定・タブ開き直し履歴復元。
  改定で加わった導線: 観測フィードの自動スクロールは上へスクロールで停止 +「最新へ↓」・**初回
  （設定空）だけ設定引き出しが自動展開・二回目以降は観測フィードへ直行**。口数モードは**場所のみ**
  （選択しても挙動は変わらない・実配線は s6-followup §12 の将来課題）・KILL は **S8 予約の枠のみ**。
- 人間ゲート手順: `discussion/ai-cohost/implementation/waves/cockpit-redesign/human-gate.md` /
  followup 台帳: 同 `followup.md` / wave 記録: 同 `domain-{a,b,c,d}.md`。

#### S8: 配信に耐える（安全弁）

「事故った時に止められるか」——S 系列最後の必須問題。実体は 3 つの安全弁: **キルスイッチ**（声の
即切断 + 全発火 OFF）・**NG 最終検査**（既知の最悪語を声にする前に落とす）・**AI 開示**（視聴者への
開示文言）。

- **キルスイッチ**（`src/mind/fire-orchestrator.mjs`・Domain A / `src/cockpit/*`・
  `scripts/fire-hotkey.ahk`・Domain B）: `kill()`/`revive()` が `fire()` 冒頭の唯一の合流点で
  manual・視覚・自発 preferred の全発火経路を閉じる。再生中のキルは `interrupt()`（barge-in）と
  同じ切断ヘルパ（`severSpeaking()`）を共有し、**player.stop 即時（同期呼び）+ 口を閉じる +
  soul へ「接頭辞 + 強制停止注記」を 1 回追記**して声を止める。ホットキー **`Ctrl+Alt+K`
  （`^!k`）は kill 専用**（revive は送らない・誤操作で配信中に解除しない安全弁）。復帰は**操縦席の
  KILL ボタン（一クリック）**のみ。耳/転写バッファは無影響（in-memory のみ・プロセス不殺）。
- **NG 最終検査**（`src/mind/ng-words.mjs`・Domain C）: TTS 直前（speechText 確定後〜speak 呼び出し
  前・キル検査と同じ検問所）で **最小リスト（差別語級の最悪語のみ・3〜5 語）**を NFKC 正規化 +
  部分一致の素朴形で照合する。命中したら発話は**丸ごと没**——speak せず、命中語・応答本文は soul
  本文・診断・戻り値・ログのどこにも残さない（秘匿）。正本へは固定の事実文字列「（発話を没にした:
  NG検査）」だけを 1 件追記する。**このリストはユーザーが人間ゲートで最終確認/編集する starter
  （v0）**——語数・語彙を触りたいときは `NG_WORDS`（`src/mind/ng-words.mjs`）のこの 1 箇所だけを
  触る。URL/電話番号の読み上げ抑止・軽度の悪態・語形変化対応は v0 外。
- **AI 開示**: 概要欄への開示文言 + 配信前チェックリストは**コードを持たない wave 外の作業**として
  L0 が別途起草する（`discussion/ai-cohost/operations/pre-stream-checklist.md`・ユーザーが概要欄へ
  貼る運用）。
- **人間ゲート（縮小裁定）**: ①発話中にキル → 声が即切れ・以後の発火が全て弾かれる → 一クリック
  復帰 → 次の発火が普通に動く ②弁が通常の発話を一切邪魔しない、の 2 点。手順・申し送りは
  `discussion/ai-cohost/implementation/waves/s8/s8-followup.md`。

#### 多頭化: 頭脳の差し替え（Claude / Codex Terra）

「差し替わるのは魂やなく**頭脳**だけ」——耳・声・発火・転写・演出・操縦席・安全弁（キル/NG 検問所）
は頭に依存しない魂の資産のまま不変で、LLM だけを差し替えられる。議論正本は
`discussion/ai-cohost/soul/brain-swap.md`。

- **頭の選び方**: 配信前に操縦席（⚙ 設定引き出し）の「頭脳」区画で選ぶ（`Claude (Opus 4.8)` /
  `Codex (GPT-5.6 Terra)` のフラット 2 択・`POST /api/brain`）。**配信前選択が本線**——「魂を起動し、
  LLM を選び、動作確認をして、配信を開始する」の正のフローどおり、配信中の差し替えは運用外。
- **頭の表**（`src/mind/brains.mjs`）: `BRAINS` registry が唯一の宣言箇所（id・表示札・create・
  資格情報ファイルパス）。Claude 頭（`src/mind/llm-session.mjs`）は多頭化で無変更のままこの 1 項目に
  なる。
- **Codex 頭**（`src/mind/codex-session.mjs`）: `@openai/codex-sdk` 経由でスレッド継続（暗黙記憶 +
  キャッシュ平坦レイテンシ）。**配信中は記憶を持つ**（Claude 頭と同型の「暗黙記憶 + 直近窓」の二重
  構造・二頭のメンタルモデルは対称）が、**配信後（dispose 時）にディスク上の rollout ファイル
  （`~/.codex/sessions/...`）を自分の thread_id 分だけ掃除する**（記憶は配信中・秘匿は配信後、の
  時間軸分離。ユーザー自身の rollout には一切触れない・完全一致のみ・起動時 sweep でクラッシュ残骸も
  掃除）。
- **資格情報**: 操縦席は資格情報そのものを扱わない。「ログイン確認済み / 未検出（`codex login`
  してや）」の**存在確認のみ**（`~/.claude/.credentials.json` / `~/.codex/auth.json` の中身は
  読まない・ログ/SSE にも出さない）。
- **観測**: 操縦席の soul 行・usage 表示に、どの頭が応答したか（brain 札）+ 応答レイテンシ
  （`latencyMs` 実測・自然完了時のみ）が additive に乗る。

##### 第三の頭を足すとき（provider 追加手引き）

1. `src/mind/` に頭固有のアダプタ（例: `xxx-session.mjs`）を作り、知性契約
   `{ ask(content) → {replyText, usage, ttftMs|null, elapsedMs}, dispose() }`（`src/mind/brains.mjs`
   の JSDoc typedef が正）に準拠させる。
2. `src/mind/brains.mjs` の `BRAINS` registry へ 1 項目足す（`{id, label, create, credentialPath}`）。
3. サブスク枠認証ガードが要るなら `src/mind/env-guard.mjs` に provider 別の sibling 関数を足す
   （`assertSubscriptionAuthEnvOpenAI` と同型）。
4. 操縦席側（`src/cockpit/ui/settings-drawer.mjs` の「頭脳」区画の select・
   `src/cockpit/view-logic/health.mjs` の `BRAIN_LABELS`・`src/cockpit/cockpit-server.mjs` の
   `POST /api/brain` 妥当性検証）に頭 id を追記する。cockpit 層は責務境界により `brains.mjs` を
   import しない（id・表示札を各層が直書きする規律・verbosity の quiet/normal/chatty と同じ）ため、
   `BRAINS` registry が唯一の正で、cockpit 層はそれと**同じ値**を保つ責任を負う。
5. **ローカルファイルしか読めない頭（画像を `local_image` でしか受けない等）を足す場合**、Codex
   アダプタ（`codex-session.mjs`）の base64→一時ファイル橋渡しは共有ヘルパへ昇格できる
   （`discussion/ai-cohost/soul/brain-swap.md` §5 参照）。

議論正本・詳細設計は `discussion/ai-cohost/soul/brain-swap.md`。wave 記録は
`discussion/ai-cohost/implementation/waves/brain-swap/`。followup 台帳は同ディレクトリの
`brain-swap-followup.md`。

#### 朗読と合いの手（barge-in トグル + 第 7 の発火語彙）

実配信フィードバック（アークナイツ朗読セッション）発の閉問題。「barge-in が朗読では邪魔（気づかず
喋り続けるとこーでぃーの発話が止まる）」「連続朗読は既存 6 語彙のどれの守備範囲にも入らない空白地帯
（区切りは完全無音待ち・沈黙は活動リセットで永遠に来ない）」の 2 点を解消する。

- **barge-in トグル**（`src/mind/barge-in.mjs`・運転バー）: 既定 **ON**（selfFire トグルの既定 OFF とは
  非対称）。OFF にすると割り込み判定自体を止め、進行中の弁/猶予も畳む（かぶりを完全に許容する）。
  `POST /api/barge-in`（`{enabled:bool}`・`cockpit-settings.local.json` に永続化）。**born-disabled**:
  起動時に永続 OFF が記憶されていれば、gate は生成された瞬間から OFF（構築後の後追い setEnabled は
  行わない = 起動直後に割り込み窓が開く隙を作らない）。
- **切断猶予 2000ms**（`BARGE_IN_GRACE_MS`）: 既存 200ms のノイズ弁（`speechCancel` 待ち）を通過しても
  即座に切断せず、続けて 2000ms「見合う」。猶予中に発話が終われば（`speechEnd`）切らずに続行する。
  超えてなお発話が続いていれば確定（切断）。副次効能として、短い相槌（2 秒未満）はこの猶予に吸収され
  無害になる。
- **合いの手（interjection・第 7 の発火語彙）**（`src/mind/fire-scheduler.mjs`）: 「沈黙の対」——場が
  流れ続けている（連続発話 run が続いている）ときに軽く一言。連続発話 run は `speechStart` で開始し、
  間隙が `turnEndSilenceMs`（2 秒）未満なら継続、2 秒以上で終了して区切り応答の管轄へ引き継ぐ（2 秒
  境界を共有し、両語彙が同時発火しない構造）。run が基礎 30/60/120 秒（おしゃべり/ふつう/控えめ）+
  ジッター 15/30/60 秒続いたら候補になり、不応期 15/30/60 秒（**発火する瞬間の最低間隔チェックのみ**
  ——累積は止めない）を満たせば発火。**予算なし・確率なし**（頻度が低いので上限の害の方が大きいという
  裁定）。vision は他語彙と同じ preferred（対象があれば画像付き・失敗は静かに劣化）。kind は既存
  `selfFire` SSE にそのまま素通し（server/UI は無改修）。
- **人間ゲート観点**: ①トグル OFF で朗読→かぶってもこーでぃーが最後まで言い切る ②ON で猶予→かぶって
  2 秒以内に発話をやめれば続行・続ければ切断（見合いの体感） ③おしゃべりで朗読→30〜45 秒ごとに合いの手
  が入る ④通常会話の無退行（呼びかけ/区切り/沈黙/コメントが従来どおり）。
- 議論正本: `discussion/ai-cohost/implementation/orchestration/reading-interjection-wave-plan.md` /
  `reading-interjection-inventory.md`。wave 記録・followup 台帳は
  `discussion/ai-cohost/implementation/waves/reading-interjection/`。

#### 配信間記憶（セッションダイジェストと自動搭載）

「これ、さっきのやつだよね」の配信間バージョン——「昨日のアークナイツの続きやな」が言える相方。
**相方は記憶を選ばへん。覚えとるのが自然な状態で、忘れさせるのが例外操作**（起動時に直近 3 件の
ダイジェストを自動搭載・選択の儀式なし）。議論正本は `discussion/ai-cohost/soul/stream-memory.md`。

- **何を覚えるか**（`src/mind/memory.mjs`）: 配信で起きた出来事（ゲーム・進行・ハイライト）・交わした
  話題やジョーク・言い回し（callback の種）・配信者について分かったこと、を日本語の短いダイジェスト
  （目安 1500 字程度）として使い捨てセッションに書かせる（`create → ask 一発 → dispose`・常駐の履歴は
  一切汚さない）。**視聴者の名前・個人を特定できる情報は保存しない**（整形段階で displayName を
  完全に落とす第一防御 + 生成指示で明記する第二防御の二重構え）。
- **三つの引き金・一つの操作**(`scripts/cockpit.mjs`): ①**定期チェックポイント**（20 分ごと・自動・
  転写が前回記録から増えていなければスキップ=空回しでトークンを燃やさない）②**手動「今日を記録」
  ボタン**（操縦席「記憶」区画・`POST /api/memory-record`）③**Ctrl+C（SIGINT）の最終版**
  （`server.close()` の直後・常駐 dispose の前に best-effort + timeout(15s) で試みる——失敗/timeout
  しても後始末は必ず最後まで走る=終了が固まらない）。**同一配信セッションは同一ファイルへ上書き**
  （起動時刻から導いたファイル名）ので、①〜③のどれで記録しても最新の 1 本に収束する。
- **OFF スイッチ**（操縦席「記憶」区画のトグル・既定 **ON**・`POST /api/memory`・
  `cockpit-settings.local.json` に永続化）: OFF にすると**注入も生成もチェックポイントも全部止まる**
  （「記憶なしで起動」の直感どおり・止水栓）。切替は頭脳切替と同じ「現セッションを dispose→null にし、
  次の発火から新しい仮面（記憶あり/なし）が効く」ホットスワップ。
  ON に戻すと直近ダイジェストを読み直して再搭載する。
- **記憶の主権はファイルシステム**: `apps/soul/agent/memories/*.md`（1 配信 1 ファイル・
  `.gitignore` 済み・コミットしない）に人間可読 Markdown で書く。読める・直せる・消せる——
  気に入らない記憶はエディタで開いて直接編集するか、ファイルごと消せばよい（UI に「記憶の編集」
  機能は無い・ファイルシステムが正）。
- **起動時の自動搭載**: 記憶 ON なら起動時に直近 3 件のダイジェストを読み、仮面（システムプロンプト）
  へ合成してからセッションを作る（`composeSystemPrompt`・Claude/Codex どちらの頭でも同じ注入点）。
  操縦席の「記憶」区画に「記憶 N 件を搭載（最新: HH:MM:SS）」で現況が出る。
- 議論正本: `discussion/ai-cohost/soul/stream-memory.md`。wave 計画・棚卸しは
  `discussion/ai-cohost/implementation/orchestration/stream-memory-wave-plan.md` /
  `stream-memory-inventory.md`。wave 記録・followup 台帳は
  `discussion/ai-cohost/implementation/waves/stream-memory/`。
