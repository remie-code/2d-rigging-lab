# S3 追撃 wave（小・domain-c）実装記録: soul 行二重表示の修正 + Channel URL の操縦席入力

> Status: 実装完了（2026-07-12, Gnome）。委任元: Orch-Sylph。対象: `apps/soul/agent`。
> スコープ（ユーザー承認済み）: (1) soul 発話行の SSE 二重放送バグの修正 + 重複防止の回帰テスト、
> (2) 器の Control Channel URL の操縦席入力（CLI を触らせない思想の徹底）、(3) 記録。
> commit / install はしていない（鉄の規律）。新規依存ゼロ・lockfile 不変・SDK 実消費ゼロ・実マイク不使用。

---

## 1. 二重表示バグ: 原因（Read で裏取りしたコード行根拠）と採用した修正

### 原因（2 経路の二重放送）

soul 発話 1 件が SSE `transcript`(speaker:"soul") として **2 回** broadcast される。音声(speak)は 1 回なので
「音は一回・表示だけ二重」。裏取りしたコード行:

- **経路 A（設計上の正経路）**: `src/mind/fire-orchestrator.mjs:161-163` — soul 発話を
  `buffer.append({... speaker:"soul"})` した直後 `emit(onSoulTranscript, appended.entry)`。
  → `src/cockpit/cockpit-server.mjs` の fireOrchestratorFactory 結線 `onSoulTranscript` フック（:688 付近）
  → `broadcastSoulTranscript`（:669-678）→ `broadcast("transcript", {... speaker:"soul"})`【1 回目】。
- **経路 B（意図せず混入）**: 同じ `buffer.append(soul)` が `src/ears/transcript-buffer.mjs:154-156` の
  appendListeners を発火 → `src/ears/ear-pipeline.mjs:179-181` の
  `buffer.onAppend((entry) => onTranscript(entry, ...))`（**話者無差別購読**）→ cockpit の `startEars` 内
  `onTranscript` フック（`cockpit-server.mjs:447` 付近）→ `broadcast("transcript", {... speaker:"soul"})`【2 回目】。

`fire-orchestrator.mjs` の旧コメント「soul の発話行は pipeline の onTranscript を通らない」は **誤り**だった:
soul も you と同じ transcriptBuffer に append されるため onAppend → onTranscript を必ず通る。かつ fire 成功は
耳起動中（pipeline≠null）が前提（`fire-orchestrator.mjs:126-129` で ears-not-running を弾く）なので、
**fire 成功時は必ず二重**になる。

### なぜ既存テスト・preflight が見逃したか

`src/cockpit/cockpit-server.test.mjs` の `makeFakePipeline` は `createTranscriptBuffer` を実体で持つが
**`buffer.onAppend` を購読しない**（テストが `record.options.onTranscript(...)` を手動発火する設計）。
`scripts/preflight-fire.mjs` の fake pipeline も同様。ゆえに fake では経路 B が再現されず、既存の縦貫通テスト
（`cockpit-server.test.mjs:679-739`）も soul transcript を `waitFor` で 1 個取るだけで**回数を固定していない**。
**実 ear-pipeline のみが二重を起こす**。

### 採用した修正箇所・理由

第一推奨（委任プロンプトの推奨）を採用した:

- **`src/cockpit/cockpit-server.mjs` の `startEars` 内 `onTranscript` ハンドラ先頭に
  `if (/** @type {any} */ (entry).speaker === "soul") return;` を追加**。soul の正経路は同一 cockpit 内の
  `broadcastSoulTranscript`（onSoulTranscript 経由）1 本に残し、耳の onTranscript 側で soul を除外して
  二重を断つ。
  - 理由: (1) S2 の ear-pipeline `onAppend` 契約を触らずに済み S2 テスト無退行を保ちやすい、(2) soul の
    正経路は cockpit 内 `broadcastSoulTranscript` であり、同一 cockpit 内で二重を断つのが局所的、
    (3) 最小変更。
  - `@type {any}` キャストは、同ファイルの既存 onVadEvent ハンドラ（untyped `e.type` アクセス）と同種の
    untyped-callback パターンでの新規 @ts-check プローブエラーを避けるため（§4 参照）。
- **誤っていた設計コメントを実態に合わせて修正**（実装挙動の変更なし・記述のみ）:
  - `src/mind/fire-orchestrator.mjs` ヘッダ「soul 記録の broadcast 経路」節。
  - `src/ears/ear-pipeline.mjs` ヘッダ「listener 例外契約」節に「onAppend は話者無差別・受け側で
    speaker:"soul" を除外せよ」の注意を追記。
  - `src/cockpit/cockpit-server.mjs` の broadcastSoulTranscript 周辺コメント。

代替案（ear-pipeline の onAppend listener 側で speaker 分岐）は S2 の確立モジュール契約変更になるため
不採用。第一推奨が S2 無退行の観点で優ると判断した（Orch/Review へ別解提案なし）。

---

## 2. 回帰テストの修正前（赤・2 件）/修正後（緑・1 件）の生出力

追加場所: `src/cockpit/cockpit-server.test.mjs` 末尾（fire 系テスト群に隣接・**新規追加のみ**）。
設計: 実 ear-pipeline の `onAppend → onTranscript` 契約を再現する **専用 pipeline double**
（`makeOnAppendPipeline`・`buffer.onAppend((entry) => options.onTranscript(entry, meta))` を購読）を用意。
既存 `makeFakePipeline` は多数の既存テストが共有するため**変更していない**。実 `createFireOrchestrator` を
fake session/speak/channel/player で結線し、`POST /api/ears/start` → you 発話 1 件 append → `POST /api/fire`。
決定論的収束点として **soul 状態が idle に戻るまで待って**から、収集済み SSE イベント配列の
`event==="transcript" && data.speaker==="soul"` の総数を数える（finally の idle 遷移は
`buffer.append(soul)` + `onSoulTranscript` の後に来るため両放送は既に発火済み）。加えて 50ms の有界猶予で
2 個目が遅れて来ないことを積極確認。

### 修正前（バグ状態・RED = 2 件で赤）

```
not ok 1 - cockpit /api/fire: soul 転写は二重放送されない（実 pipeline の onAppend→onTranscript 契約下で 1 回）
  ---
  error: |-
    soul transcript は 1 回だけ放送されるべき（実測 2）

    2 !== 1

  code: 'ERR_ASSERTION'
  expected: 1
  actual: 2
  operator: 'strictEqual'
  ...
1..1
# tests 1
# pass 0
# fail 1
```

### 修正後（GREEN = 1 件で緑）

```
ok 1 - cockpit /api/fire: soul 転写は二重放送されない（実 pipeline の onAppend→onTranscript 契約下で 1 回）
# tests 1
# pass 1
# fail 0
```

この赤→緑がバグ実在の証明（実 pipeline の onAppend 契約下でのみ二重が起き、修正で 1 回に固定される）。

---

## 3. Channel URL の操縦席入力の実装内容

### 変更/新規の要点

- **lazyChannel 拡張**（`scripts/cockpit.mjs` `createLazyChannel`）: `setUrl(url)` / `getUrl()` /
  `connectionStatus()` を追加。
  - `setUrl`: URL 変更時は既存の接続キャッシュ（`channelPromise`）を破棄し、旧接続を best-effort で畳み、
    次回 fire で新 URL に再接続。同一 URL は現状維持（接続を切らない）。空/null はクリア。
  - `getUrl()`: 生 URL（内部用）。UI/ログには必ず `redactToken` を通す。
  - `connectionStatus()`: `unset / idle / connecting / connected / error`。
  - **URL 未設定（null）で sendSpeech は明示エラー**（操縦席で URL を入れる前の発火を弾く）。
  - **失敗非キャッシュの既存挙動は維持**（初回 connect の throw で `channelPromise=null` → 次回再試行）。
  - 既存 3 テスト（lazy 接続・再利用 / 失敗非キャッシュ再試行 / close 冪等）は無変更で緑のまま。
- **settings 拡張**:
  - file-backed（`src/cockpit/cockpit-settings-store.mjs`）: `getLastChannelUrl` / `setLastChannelUrl` を追加。
    **read-modify-write** 化し `lastDevice` と `lastChannelUrl` が同一 JSON に同居しても片方の set が
    もう片方を消さないようにした。既定パス `apps/soul/agent/cockpit-settings.local.json`（.gitignore 済・
    `git check-ignore` 確認済み・token を含むため非コミット）。失敗寛容は維持。
  - in-memory（`src/cockpit/cockpit-server.mjs` `createInMemorySettingsStore`）: 第 2 引数 `initialChannelUrl` +
    同じ get/set 口を追加（テスト用）。
- **POST /api/channel + 責務境界**（`src/cockpit/cockpit-server.mjs`）: cockpit-server は channel の中身を
  知らない設計を保ち、**注入フック**で受ける:
  - `options.onSetChannelUrl?(url)`: POST /api/channel が受けた URL（trim 済み・空は null）を橋渡し。
    未注入なら 503。cockpit-server は生 URL を保持/ログしない。
  - `options.channelStatus?()`: state snapshot に載せる **redact 済み** channel 現況を返す
    （`{configured, url, connection}`・未注入なら `channel:null`）。
  - snapshot() に `channel` フィールドを追加。POST 後に broadcastState + snapshot を返す。
- **`scripts/cockpit.mjs` の結線**（Domain B・注入フックの実装）:
  - `fireOrchestratorFactory` を**常に注入**（fire は常時結線）。session は sessionProxy、player は
    playerProxy、channel は lazyChannel を渡す。
  - `onSetChannelUrl`: `lazyChannel.setUrl(url)` + `settings.setLastChannelUrl(url)`（token はログに
    redact して出す）。
  - `channelStatus`: `redactToken(lazyChannel.getUrl())` + `lazyChannel.connectionStatus()` を返す
    （生 URL を state に出さない）。
  - 初期 URL: `--channel`（後方互換）> settings の `lastChannelUrl`（前回起動の記憶）> 未設定。
    `--channel` 指定は settings にも載せて次回復元。
- **UI**（`src/cockpit/cockpit.html`）: Microphone と同格の Channel セクション（URL 入力 `#channel-url` +
  `Set` ボタン `#btn-channel-set` + 状態表示 `#channel-status`）を追加。`Set` で POST /api/channel、応答
  snapshot（redact 済み）で `applyChannel(s.channel)` を通じて状態表示を更新（connection の色分け:
  connected=緑 / error=赤 / connecting=アンバー）。**Set 成功後は入力欄を空にして生 URL（token）を DOM に
  残さない**。表示は redact 済み state のみ。

### S2.5 無退行の担保方法（絶対条件）

- session/player は `ensureFireResources()` で**遅延生成**（冪等・env ガードは session 初回生成時に一度）。
  - `--channel` 明示指定時のみ起動時に eager 生成（従来の TTFT 先払い・S3 挙動不変）。
  - それ以外（URL 未設定 / settings 復元 / 操縦席入力）は**初回 fire 時**に生成。
- 発火経路: orchestrator.fire() → getBuffer（耳）→ **sessionProxy.ask**（`lazyChannel.getUrl()==null` なら
  spawn せず明示 throw → orchestrator が fireError 診断に落とす・操縦席ゴースト行）→ speak →
  playerProxy.play。→ **URL も Fire も使わないユーザーは何も spawn しない**。
- `createCockpitServer({})` 直接（テスト・preflight-cockpit）は onSetChannelUrl / channelStatus /
  fireOrchestratorFactory 未注入のまま = POST /api/channel は 503・POST /api/fire は 503・channel:null。
  S2.5 の器はこれらを叩かないため無退行。

---

## 4. 機械ゲートの生数字

- **`cd apps/soul/agent && node --test`（フル）**: `# tests 284 / # pass 284 / # fail 0 / # cancelled 0 /
  # skipped 0 / # todo 0`（ベースライン 269 + 新規 15 = 284・**全緑**）。
  - 新規 15 件内訳: cockpit-server.test.mjs +4（二重放送回帰 1・channel サーバ 3）/
    cockpit-settings-store.test.mjs +3（channel URL roundtrip・device 同居・corrupt tolerant）/
    cockpit-page.test.mjs +4（Channel 入力/Set/applyChannel/token 非残留）/
    scripts/cockpit.test.mjs +4（no-URL 明示エラー・setUrl 接続・URL 変更再接続・同一 URL no-op）。
- **`pnpm run check:deps`**: `Dependency guard passed.`（exit 0・緑）。
- **`pnpm run check:source`**: 既存 1 件のみ（`apps/runtime-player/src/main/physiology/index.ts: index.ts
  must remain a barrel-only entrypoint`）= 器 pre-existing。**S3 新規違反ゼロ**（.ts 限定走査で私の変更は
  すべて `apps/soul/agent` の .mjs/.html）= 無退行。
- **`pnpm run check:soul-zone`**: `Soul zone boundary guard passed: 1320 source files scanned; no 器→魂
  imports and no 魂→器 code imports.`（rc 0・緑）。
- **`pnpm run typecheck`**: rc 0（root `tsc --noEmit`・.ts）。root tsconfig は agent の .mjs を include しない
  ため、変更した @ts-check .mjs を standalone `tsc --strict --checkJs` で個別プローブ確認した:
  - 新規に書いた **`cockpit-settings-store.mjs` / `scripts/cockpit.mjs` はプローブエラー 0**。
  - `cockpit-server.mjs` の残プローブエラー（8 件）は**すべて既存関数**（onVadEvent :462-467 /
    serveIndex :661 / broadcastSoulTranscript :716）の untyped-callback パターンで、私が追加した
    channel 結線・二重放送修正行には起因しない（コメントのみ編集の ear-pipeline / fire-orchestrator でも
    同種プローブエラーが出ることが noise の証左）。私の追加行（onTranscript の speaker ガード）は
    `@type {any}` キャストで新規プローブエラーを出さない。→ **新規エラーゼロ**。
- **`node scripts/preflight-fire.mjs`**: `RESULT: PASS` / **EXIT=0**（Domain A 無退行）。
- **`node scripts/preflight-cockpit.mjs`**: `RESULT: PASS` / **exit=0**（S2.5 無退行。ffmpeg 未配置環境の
  `spawn ffmpeg ENOENT` は列挙 200 で吸収され PASS）。
- **`git diff --stat pnpm-lock.yaml apps/soul/agent/package.json`**: **差分ゼロ**（出力なし）。
  新規依存ゼロ（dependencies は `@anthropic-ai/claude-agent-sdk` + `onnxruntime-node` のまま）。
- 二重表示回帰テスト: **修正前 赤（実測 2）・修正後 緑（1）**（§2 の生出力）。
- **SDK 実消費ゼロ**（全 fake）・**実マイク不使用**。

---

## 5. 変更/新規ファイルの絶対パス一覧

実装（`apps/soul/agent`）:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-server.mjs`
  （onTranscript の soul 除外ガード・channel 注入フック `onSetChannelUrl`/`channelStatus`・snapshot の
  `channel` フィールド・POST /api/channel・in-memory settings の channel 口・コメント修正）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-settings-store.mjs`
  （read-modify-write 化・`getLastChannelUrl`/`setLastChannelUrl` 追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit.html`
  （Channel URL 入力欄 + Set + 状態表示・applyChannel・POST /api/channel・token 非残留・CSS）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\fire-orchestrator.mjs`
  （**コメントのみ**: 誤っていた broadcast 経路の記述を実態へ修正）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\ears\ear-pipeline.mjs`
  （**コメントのみ**: onAppend が話者無差別である注意を追記）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\scripts\cockpit.mjs`
  （createLazyChannel 拡張 setUrl/getUrl/connectionStatus + no-URL 明示エラー・session/player 遅延生成・
  fire 常時結線・onSetChannelUrl/channelStatus 実装・--channel 後方互換初期値・settings 復元・ヘッダ/HELP 更新）

テスト（新規ケースの追加のみ・既存ケース無変更）:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-server.test.mjs`
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-settings-store.test.mjs`
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-page.test.mjs`
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\scripts\cockpit.test.mjs`

記録（docs）:
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\s3\domain-c.md`（本ファイル・新規）
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\s3\s3-followup.md`（§3 追記: S8 出力デバイスノブ持ち越し 他）
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\screens\soul-cockpit.md`（§2.1 に Channel URL 入力欄を追記・503 記述の更新注記）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\README.md`（S3 節: Channel URL 操縦席入力手順・--channel 後方互換の更新）

---

## 6. 裁量判断・注意事項・Orch/Review への質問

### 裁量判断

1. **Fire ボタンの channel-gating を UI に足さなかった**。既存 `cockpit-page.test.mjs` が
   `applySoulState` の `btn-fire.disabled = st !== "idle"` を厳密にピン留めしており、既存テスト変更禁止の
   規律に抵触するため。URL 未設定での Fire は sessionProxy.ask が spawn 前に弾き
   `(fire error: Channel URL is not set …)` のゴースト行で明示する（無言の失敗にしない）。ボタン自体を
   disable したくなったら当該行を触る wave でテスト名/内容も合わせて更新するのが素直（s3-followup §3-3）。
2. **session/player の遅延生成方針**は「`--channel` 明示時のみ eager・それ以外は初回 fire 時」とした。
   委任プロンプトの「実際に fire される時まで生成を遅延する等で」を、`--channel` の従来 TTFT 先払いを
   壊さずに満たす落とし所。純粋 S2.5 ユーザー（URL も fire も使わない）は何も spawn しない。
3. **回帰テスト用に専用 pipeline double（makeOnAppendPipeline）を新設**し、共有 `makeFakePipeline` は
   一切変更していない（onAppend 購読を足すと既存の手動 onTranscript 発火が二重になり既存テストを壊すため）。
4. **onTranscript の soul ガードに `@type {any}` キャスト**を付けたのは、standalone `--strict --checkJs`
   プローブでの新規エラーをゼロにするため（同ファイルの既存 onVadEvent は untyped だが、私の追加行だけは
   新規プローブエラーを出さない方針を優先）。実挙動への影響なし。

### 注意事項

- `apps/soul/agent/cockpit-settings.local.json` はこのリポの作業ツリーに存在するが .gitignore 済み・
  git status に出ない。テストはすべて temp パスを注入し実ファイルに触れない。私は cockpit.mjs を実起動して
  いないため実ファイルは書き換えていない。
- s3-followup §2-1「lazy channel は接続成功後の切断を自動回復しない」は本 wave でも**未回収**（私の
  setUrl は URL 変更時のキャッシュ破棄であり、同一 URL での接続断の自動回復ではない）。当該項目は
  引き続き有効。

### Orch/Review への質問

- なし。委任スコープ内で判断が閉じた。強いて挙げれば裁量 1（Fire ボタン UI gating の見送り）が
  レビューで「UI で明示 disable すべき」と判断される可能性はある。その場合は既存 cockpit-page.test の
  `applySoulState` 行のピン留めを更新する前提での小 wave として切り出すのが安全（s3-followup §3-3 に台帳化済み）。
