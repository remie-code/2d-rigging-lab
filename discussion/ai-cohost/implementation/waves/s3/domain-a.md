# S3 Domain A 実装記録: 会話ログ + 発火オーケストレーション（魂の胴体）

> Status: 実装完了・機械ゲート緑（2026-07-12・Gnome）。委任元 Orch-Sylph。
> 契約の正: [../../orchestration/s3-wave-plan.md](../../orchestration/s3-wave-plan.md) §3 Domain A。
> 鉄の規律: 実 SDK/実 TTS/実器/実マイク不使用（全 fake 注入）・新規依存ゼロ・既存挙動不変（S1/S2/S2.5）。

「AI は全部聞くが、全部では考えない」——聞くのは耳（常時）、考えるのは Fire のとき（この胴体）。
Fire 1 発を受け、直近の会話ログを LLM へ注入し、返った一言を声 + 口で発話し、その発話を会話ログへ
soul として追記するまでの縦串を実装した。

## 1. モジュールの責務と公開 API

### 1.1 会話ログ昇格 — `src/ears/transcript-buffer.mjs`（変更・追加的）

- `append(input)` に任意フィールド `speaker`（`"you" | "soul"`・**既定 "you"**）を追加。不正値は `RangeError`。
- 各エントリに `speaker` フィールドが付く（`Object.freeze` 済みを維持）。typedef `TranscriptEntry` に `speaker` を追加。
- **S2 挙動不変**: 既定 "you" ゆえ、speaker を渡さない既存呼び出し（耳の結線）は挙動不変。既存 11 テストは
  書き換えず全通過（speaker を渡さず既定 you で通り続ける）。speaker 分の新規テスト 3 件を追加。
- discard 情報（`onDiscard` の payload）には speaker を**足していない**（既存テストの deepEqual を破らない・
  空転写に話者は無意味）。

**設計判断**: soul エントリは VAD ストリーム時刻（startMs/endMs）を持たない（魂の発話は録音区間ではなく
Fire に応じて生成したテキスト）。よって発火オーケストレータは soul 追記時に `startMs:0, endMs:0` を渡す
（JSDoc に明記）。窓の時間軸は startMs ではなく壁時計 `appendedAtMs`——you と soul を同一の実時間軸で並べる。

### 1.2 注入整形の純関数 — `src/mind/fire-injection.mjs`（新規）

```
formatFireInjection(entries, { nowMs, windowMs?, maxChars? })
  → { text, includedCount, charCount, droppedByWindow, droppedByLimit }
export const FIRE_WINDOW_MS = 5 * 60 * 1000   // 直近 5 分
export const FIRE_MAX_CHARS = 4000            // 安全弁
```

- `entries` は `all()` が返す形（seq 昇順 = 時系列）。**純関数・I/O ゼロ・依存ゼロ・時計は引数 nowMs**。
- 手順: (a) `appendedAtMs >= nowMs - windowMs` の窓で絞る、(b) 話者ラベル付き整形（`you: …` / `soul: …` を
  改行区切り・seq 昇順）、(c) 文字数上限超過時は**古い（seq 小）方から落とす（新しい方優先）**。
- **設計判断**: 文字上限の削りは**最新 1 行は常に残す**（安全弁はベストエフォート・単一発話が上限超でも空注入に
  しない = 発火判定を殺さない）。空窓は `includedCount===0`・`text===""`（オーケストレータの ask 無駄撃ち回避の材料）。
- fixture テスト 8 件（`fire-injection.test.mjs`）: 窓の内外境界・空窓・空配列・you/soul 混在ラベル整形・
  文字上限で古い方落とし・最新 1 行保持・不正 nowMs throw。

### 1.3 発火オーケストレータ — `src/mind/fire-orchestrator.mjs`（新規）

```
createFireOrchestrator({
  getBuffer, session, speakImpl?, channel, player, speakDeps?,
  windowMs?, maxChars?, nowImpl?, onState?, onFire?, onDiagnostic?, onSoulTranscript?
}) → { fire(): Promise<object>, getState(): "idle"|"thinking"|"speaking", dispose() }
export const FIRE_SYSTEM_PROMPT   // 最小仮面 v0（§5）
```

- `getBuffer: () => buffer | null`（null = 耳未起動）。`session` = createLlmSession の返り（**ask のみ使う・
  このモジュールでは作らない/変えない**）。`speakImpl` 既定 = Domain B `speak`。channel/player/speakDeps は speak へ渡す。
- **busy 状態機械**: `idle →(fire)→ thinking →(応答)→ speaking →(発話完了)→ idle`。状態遷移ごとに `onState(state)`。
  `setState` は同値なら再通知しない（冪等）。
- `fire()` の順序: (1) state≠idle → `{fired:false, reason:"busy", state}` + `onFire({accepted:false, reason:"busy"})`
  即返し。(2) getBuffer()===null → `{fired:false, reason:"ears-not-running"}`。(3) 窓収集 includedCount===0 →
  `{fired:false, reason:"empty-window"}`（ask 無駄撃ちしない）。(4) `thinking` + `onFire({accepted:true, injectedChars,
  includedCount, atMs})` → `session.ask(injectedText)`。(5) 応答空 → `onDiagnostic({type:"fireEmptyReply"})` +
  `{fired:false, reason:"empty-reply"}`。(6) `speaking` → `speakImpl(replyText, {channel, player, ...speakDeps})`。
  (7) `buffer.append({startMs:0, endMs:0, text:replyText, speaker:"soul"})` → `onSoulTranscript(entry)`。(8) `idle` →
  `{fired:true, replyText, injectedChars, includedCount}`。
- **失敗の握り**: ask/speak が throw → `onDiagnostic({type:"fireError", message})` + `{fired:false, reason:"error", message}`
  （例外を上へ投げずサーバを殺さない）。**finally で必ず idle へ戻す**（冪等 setState ゆえ二重発火なし）。speak が
  落ちた場合 soul 記録はしない。
- 縦貫通テスト 9 件（`fire-orchestrator.test.mjs`・実 SDK/実 TTS/実器不使用・全テスト timeout 付き）:
  thinking→speaking→idle の onState 列・soul append・注入に直近 you 発話・busy 中 2 発目無視・空窓で ask 未呼び出し・
  ears-not-running・空応答 fireEmptyReply・ask throw の idle 復帰 + fireError・speak throw の idle 復帰・dispose 後拒否。

### 1.4 cockpit-server 結線 — `src/cockpit/cockpit-server.mjs`（変更・追加的）

- `createCockpitServer(options)` に任意 `fireOrchestratorFactory` 注入点を追加。**未注入時は既存挙動不変**
  （POST /api/fire は 503 "fire not available"・S2.5 テストは /api/fire を叩かない = 無退行）。
- 注入時、cockpit が `getBuffer=()=>pipeline?.transcriptBuffer ?? null` と broadcast フックを factory に渡し、
  返った orchestrator の `fire()` を POST /api/fire で await。
- `toWireEntry` の speaker ハードコードを `entry.speaker ?? "you"` に修正（you/soul を素通し・既定 you）。
- 返り値に `fireState()`（idle/thinking/speaking・未注入なら null）を追加。close() で orchestrator.dispose()。
- cockpit 既存 21 ケースは無変更・新規 6 ケースを追加（未注入 503・受理 202・busy 200・close dispose・
  SSE soul/fire/soul-transcript・実 orchestrator 結線の縦貫通）。**127.0.0.1 限定バインドの内側**（assertLoopbackHost 不変）。

**soul transcript の broadcast 経路の選択**: soul の発話行は耳の `onTranscript` を通らない（耳の転写経路ではない）。
選択肢 (a) orchestrator の `onSoulTranscript(entry)` フック、(b) `buffer.onAppend` で `speaker==="soul"` を拾う、の
うち **(a) を採用**。理由: (b) は you 転写（onTranscript で既に broadcast 済み）を二重に拾う risk があり、
you/soul の分岐フィルタが要る。(a) は soul のみを明示的に受け、cockpit が既存 `transcript` イベント（speaker:"soul"）
として再利用 broadcast するだけで済む。

### 1.5 最小仮面 v0 — `FIRE_SYSTEM_PROMPT`（`fire-orchestrator.mjs` に export）

`"あなたは配信の相方です。直前の会話を踏まえ、短く自然な日本語で一言だけ返してください。箇条書き・記号・長い説明はしないでください。"`
**意図的に貧しく**（凝るのは persona の領分）。本番結線（Domain B）が createLlmSession に渡す想定。orchestrator 自身は
session を受け取るだけ。

### 1.6 preflight — `scripts/preflight-fire.mjs`（新規）

fake session/speak/channel/player で組んだ**実** orchestrator を cockpit に結線し、実 HTTP + 実 SSE で
POST /api/ears/start（fake）→ you 発話 append → POST /api/fire → soul(thinking→speaking→idle) + soul transcript を
確認 → clean close。`RESULT: PASS` / `EXIT=0` を標準出力。実 SDK/実 TTS/実器/実マイク不使用。

## 2. ワイヤ契約 §（Domain B が消費する）

Domain B（操縦席拡張）はこの契約に対して UI を実装する。

### 2.1 POST /api/fire

- **req**: body 不要（`{}` で可）。
- **res**:
  - 受理・発話成功: **202** `{ fired: true, replyText, injectedChars, includedCount, state: "idle" }`。
  - 非受理: **200** `{ fired: false, reason, state }`。`reason` ∈
    `"busy" | "ears-not-running" | "empty-window" | "empty-reply" | "error"`（error 時は `message` も付く）。
    `state` は現在の発火状態（getState() から補完・常に載る）。
  - orchestrator 未注入: **503** `{ error: "fire not available" }`。

### 2.2 SSE `/api/events` 追加イベント（既存 state/vad/transcript/discard/diagnostic に追加）

- `soul`: `{ state: "idle" | "thinking" | "speaking" }`（onState を broadcast・操縦席の busy 表示連動）。
- `fire`: `{ accepted, reason?, injectedChars?, includedCount?, atMs? }`（onFire を broadcast・発火マーカーの材料）。
  - accepted:true → `{ accepted:true, injectedChars, includedCount, atMs }`。
  - accepted:false → `{ accepted:false, reason }`（reason は §2.1 と同じ集合の一部: busy/ears-not-running/empty-window）。
- `transcript`（**既存イベントの再利用**）: soul の発話行は `speaker: "soul"` で流れる（you と同じ data 形・
  `{ seq, startMs:0, endMs:0, text, appendedAtMs, speaker:"soul", latencyMs:null, audioCtx:null, appended, discarded }`）。
  操縦席の Timeline は既存の transcript 描画に speaker で行スタイルを分岐すればよい。

### 2.3 発火状態のポーリング

`GET /api/state` は現状 soul の発火状態を載せていない（載せるかは Domain B の裁量・SSE `soul` イベントで足りる想定）。
`server.fireState()` はプロセス内 API として存在（HTTP 未露出）。

## 3. 機械ゲートの生数字（Gnome が実行）

- `cd apps/soul/agent && node --test`: **tests 257 / pass 257 / fail 0**（baseline 231 → +26）。
  - 内訳（新規）: fire-injection.test.mjs **8**、fire-orchestrator.test.mjs **9**、transcript-buffer.test.mjs **+3**、
    cockpit-server.test.mjs **+6**。
- `node scripts/preflight-fire.mjs`: **RESULT: PASS / EXIT=0**（process exit 0 を確認）。
- `git diff --stat pnpm-lock.yaml apps/soul/agent/package-lock.json`: **差分ゼロ**（出力なし）。package.json も未変更
  （dependencies 不変・新規依存ゼロ）。

変更ファイル（絶対パス）:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\ears\transcript-buffer.mjs`（変更）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\ears\transcript-buffer.test.mjs`（変更・追加のみ）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\fire-injection.mjs`（新規）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\fire-injection.test.mjs`（新規）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\fire-orchestrator.mjs`（新規）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\fire-orchestrator.test.mjs`（新規）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-server.mjs`（変更・追加のみ）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-server.test.mjs`（変更・追加のみ）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\scripts\preflight-fire.mjs`（新規）

## 4. 質問（Orch/Review へ）

1. **preflight の npm script 登録**: `preflight-cockpit.mjs` 同様、package.json scripts へは登録していない
   （直接 `node scripts/preflight-fire.mjs` で実行・既存の型踏襲）。登録を望むなら scripts 追加は可（dependencies は不変）。
2. **/api/fire のメソッド保護**: GET /api/fire は現状 404（未知ルート扱い）。busy 保護は状態機械が担うので冪等問題は
   ないが、GUI からの誤 GET を明示的に 405 にするかは Domain B/Review の判断に委ねる。
3. **fire イベントの reason 集合**: SSE `fire` の accepted:false は現状 busy/ears-not-running/empty-window のみ流れる
   （empty-reply/error は onDiagnostic 経由の diagnostic イベントに落ちる）。操縦席が empty-reply/error も fire マーカーで
   見せたいなら、orchestrator の onFire に失敗系も足す拡張余地あり（現状は onDiagnostic で観測可能）。Domain B の UX 次第。
