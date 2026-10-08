# S6 Domain D: 操縦席 + 実SDK確認 + 計測 + docs（会話が続く・自発 ON/OFF トグル + 出力デバイス選択 + 実射確認）

> Status: 実装完了・機械ゲート緑・実 SDK 確認 5 ask 完了（2026-07-13）。人間ゲート（barge-in の実機
> 体感・呼びかけ/区切り/沈黙の実マイク運用・自発 OFF トグルの実操作・音響設営での実再生確認）は
> [human-gate-procedure.md](human-gate-procedure.md) に手順を用意済みだが**実行はユーザー**（未実施）。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝
> lockfile 不変）。
> 契約の正: [../../orchestration/s6-wave-plan.md](../../orchestration/s6-wave-plan.md) §1（人間ゲート
> ①〜⑥）・§3 Domain D・§4 blocking 基準・§5 choke point /
> [../../orchestration/s6-planning-inventory.md](../../orchestration/s6-planning-inventory.md) §6（検証・
> 計測項目）。
> 消費した Domain 成果物: [domain-a.md](domain-a.md)（`listAudioDevices`/`createAudioPlayer({deviceName})`
> の契約）・[domain-b.md](domain-b.md)（barge-in・`interrupt()`・soul 追記タイミング）・
> [domain-c.md](domain-c.md)（`setSelfFireEnabled`/`selfFireStatus`/`selfFireInitialEnabled` の継ぎ目）。

## 0. パイプライン（この Domain が敷いた線）

```
操縦席「Self-fire」トグル:
  GET /api/state（selfFire.enabled）→ checkbox の初期表示
  トグル操作 → POST /api/self-fire { enabled } → fireScheduler.setEnabled(enabled)
             → onSetSelfFireEnabled(enabled)（cockpit.mjs → settings.setSelfFireEnabled・永続化）
  起動時: settings.getSelfFireEnabled()（未記憶なら既定 false）→ selfFireInitialEnabled で scheduler 構築

操縦席「Voice output」出力デバイス選択:
  GET /api/audio-devices（listAudioDevices 列挙）→ <select> にオプション表示
  選択 → POST /api/audio-device { name } → onSetAudioDevice(name)
       → settings.setAudioDevice(name)（永続化）+ 既存 player を dispose・player=null
       （次回 fire 時に ensureFireResources() が新 deviceName で常駐プレイヤーを再生成＝その場再起動）

自発発火マーカー / スケジューラ診断のゴースト行（新規 SSE イベント "selfFire"）:
  fireScheduler.onFireRequest({kind}) → fireOrchestrator.fire()/fire({vision:true}) の結果を待って
    broadcast("selfFire", { kind, fired, reason })
    → fired:true  はタイムラインに自発発火マーカー行（kind 表示）
    → fired:false はタイムラインにスケジューラ診断のゴースト行（要求は出たが実際には発火しなかった）

barge-in 中断マーカー行（既存 diagnostic イベントのフィールド拡張）:
  fireOrchestrator.onDiagnostic({type:"bargeIn", elapsedMs, charsSpoken, totalChars, prefix})
    → 既存 SSE "diagnostic" のペイロードに elapsedMs/charsSpoken/totalChars/prefix を追加（additive）
    → ページが barge-in 専用マーカー行（切断点情報付き）を描く
  bargeInStopError / bargeInMouthCloseRejected / bargeInMouthCloseError は既存ゴースト行の型で表示

実 SDK 観測（新規スクリプト）:
  scripts/observe-conversation.mjs（写経元: observe-vision.mjs）
    → fire-orchestrator/fire-scheduler は実物・player/channel/speak は fake・session だけ実 SDK
    → barge-in 中断+続き・呼びかけ/区切り/沈黙の自発 3 種を fake clock で駆動し 5 ask で実射
```

`listAudioDevices`（Domain A）・`interrupt`/soul 追記（Domain B）・`fireScheduler`/`setSelfFireEnabled`
（Domain C）は一切改修せず import/注入して使うだけ（このドメインは cockpit-settings-store・
cockpit-server・cockpit.mjs・cockpit.html・実 SDK 観測スクリプト・docs のみを触った）。

## 1. 実装/変更ファイル一覧（すべて `apps/soul/agent/`・scope 内）

| ファイル | 種別 | 役割 |
|---|---|---|
| `src/cockpit/cockpit-settings-store.mjs` | 変更 | `getAudioDevice()`/`setAudioDevice(name)`（vision target と同型）・`getSelfFireEnabled()`/`setSelfFireEnabled(enabled)`（bool 専用・未記憶と明示 false を区別するため `asStringOrNull` は使わない）を追加。既存 `writeMerged` に新キー 2 個（`audioDevice`/`selfFireEnabled`）を足すだけ。 |
| `src/cockpit/cockpit-settings-store.test.mjs` | 変更 | audio device（roundtrip・他キーとの同居・corrupt JSON・unwritable path）4 本 + self-fire enabled（roundtrip・同居・corrupt/非bool JSON・unwritable path）4 本を追加。既存 12 本は無変更。 |
| `src/cockpit/cockpit-server.mjs` | 変更 | `GET /api/audio-devices`（`listAudioDevicesImpl` 注入・既定 Domain A `listAudioDevices`）・`POST /api/audio-device`（`onSetAudioDevice` フック）・`POST /api/self-fire`（`fireScheduler.setEnabled` + `onSetSelfFireEnabled` 永続化フック）の 3 エンドポイントを追加。`snapshot()` に `audioDevice`（`audioDeviceStatus()`）を追加（`selfFire` は Domain C で既に露出済み）。`onFireRequest` の fire 結果を待って SSE `selfFire`（`{kind,fired,reason}`）を broadcast。`handleDiagnostic` の SSE payload に `elapsedMs`/`charsSpoken`/`totalChars`/`prefix`（barge-in 診断用）を追加。 |
| `src/cockpit/cockpit-server.test.mjs` | 変更 | `GET /api/audio-devices`（成功/失敗/未注入時デフォルト値）・`POST /api/audio-device`（未注入503/橋渡し+trim+クリア）・`POST /api/self-fire`（未生成503/切替+state反映/永続化フック橋渡し）・SSE `selfFire`（fired:true/false 両方）・SSE `bargeIn` 診断フィールド、の計 11 本追加。既存テストは 1 行も変更していない。 |
| `scripts/cockpit.mjs` | 変更 | `createAudioDeviceHooks(settings)`・`createSelfFireHooks(settings, defaultEnabled)` を新設・export（vision target と同型の薄い橋渡し層）。`main()` で `ensureFireResources()` の player 生成に `deviceName`（settings 経由）を渡すよう変更。`onSetAudioDevice(name)`（永続化 + 既存 player を dispose して次回再生成させる「その場再起動」）を新設し `createCockpitServer` へ配線。`selfFireHooks.resolveInitialEnabled()` を `selfFireInitialEnabled` として、`selfFireHooks.onSetSelfFireEnabled` を `onSetSelfFireEnabled` として配線。 |
| `scripts/cockpit.test.mjs` | 変更 | `createAudioDeviceHooks`（getAudioDevice透過・onSetAudioDevice橋渡し+クリア・audioDeviceStatus形状・throw握り）4 本 + `createSelfFireHooks`（未記憶フォールバック・defaultEnabled指定・記憶優先・永続化橋渡し・throw握り）5 本を追加。既存 18 本は無変更。 |
| `src/cockpit/cockpit.html` | 変更 | 「Conversation」セクション（Self-fire トグル checkbox + status 表示・Voice output `<select>` + Refresh/Set ボタン + status 表示）を追加。barge-in 中断マーカー行（`addBargeInMarkerRow`）・自発発火マーカー行（`addSelfFireMarkerRow`）・スケジューラ診断のゴースト行（selfFire fired:false）・barge-in 付随失敗のゴースト行（bargeInStopError 等）を追加。`applyState` が `selfFire`/`audioDevice` を反映するよう拡張。`init()` で `loadAudioDevices()` を呼び初期選択肢を取得。 |
| `scripts/observe-conversation.mjs` | 新規 | 実 SDK 観測スクリプト（machine test ではない・`.test.mjs` にしない）。observe-vision.mjs の写経。§5 参照。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・`apps/soul/agent/package.json`
は完全不変**（§6 の `git diff --stat` で確認・新規依存ゼロ）。`.tmp/facex-*`（別セッション領分）・
`src/voice/**`（Domain A）・`src/mind/barge-in.mjs`/`fire-orchestrator.mjs`（Domain B）・
`src/mind/fire-scheduler.mjs`（Domain C）は一切改修していない（import して使うだけ）。

## 2. 操縦席の新 UI/エンドポイント/永続化の契約（vision-target 写経との対応）

### 2-1. `POST /api/self-fire`（vision-target の `POST /api/vision-target` と同型）

```
body: { enabled: boolean }
→ 503 { error: "self-fire control not available" }   // fireScheduler 未生成（orchestrator 未注入）
→ 200 <state snapshot>（selfFire: { enabled } を含む）
```

- scheduler の切替は `fireScheduler.setEnabled(enabled)` を直接呼ぶ（Domain C が用意した継ぎ目）。
  **手動 Fire は影響を受けない**（scheduler 非経由の別経路・wave-plan §1 人間ゲート⑤）。
- 永続化は `onSetSelfFireEnabled`（未注入でも 503 にはならない——切替自体は scheduler があれば効く。
  永続化のみスキップされる、という設計判断。§7 質問 2 参照）。
- **起動時の初期値**は `scripts/cockpit.mjs` の `createSelfFireHooks(settings, false).resolveInitialEnabled()`
  が `settings.getSelfFireEnabled()`（未記憶なら bool でない=null → 既定 false）を解決して
  `selfFireInitialEnabled` として `createCockpitServer` へ渡す（Domain C オプションをそのまま消費）。

### 2-2. `GET /api/audio-devices` / `POST /api/audio-device`（vision-target の写経）

```
GET /api/audio-devices
→ 200 { devices: Array<{id,name}>, error: null } | 200 { devices: [], error: string }

POST /api/audio-device
body: { name: string }  // 空/空白のみは対象クリア（既定デバイスへ）
→ 503 { error: "audio device control not available" }   // onSetAudioDevice 未注入
→ 200 <state snapshot>（audioDevice: { name } を含む）
```

- `listAudioDevicesImpl`（既定 = Domain A `listAudioDevices`・**実 PowerShell を起動する**）の戻り値を
  そのまま `.devices`/`.error` に写すだけ（`GET /api/windows` と同型）。
- **デバイス変更の適用方式＝「その場再起動」**（設計判断・§7-1 で詳述）: `onSetAudioDevice` は
  永続化（次回起動でも復元）に加え、既存の常駐プレイヤーを `dispose()` して `player=null` に戻す。
  次に `ensureFireResources()` が呼ばれたとき（＝次の fire）に新しい `deviceName` で常駐プレイヤーが
  再生成される。

### 2-3. SSE イベント `selfFire`（新規）

```
{ kind: "call" | "turn-end" | "silence", fired: boolean, reason: string | null, message?: string }
```

- `fireScheduler.onFireRequest` が呼ばれた時点の `kind` を保持しつつ、`fireOrchestrator.fire()`/
  `fire({vision:true})` の**結果を待って**から broadcast する（best-effort・throw は握る）。
- `fired:true` → 操縦席は**自発発火マーカー行**（kind 表示）を描く。
- `fired:false` → 操縦席は**スケジューラ診断のゴースト行**（`self-fire: <kind> not fired — <reason>`）
  を描く（発火要求は出たが busy/no-target 等で実際には発火しなかった事実を正直に残す）。
- 既存の通常 `fire` イベント（`accepted:true/false`）は Domain C 実装のまま独立して飛ぶため、自発
  発火 1 回につき `fire`/`soul`/`transcript` 系イベントと `selfFire` イベントの両方が観測される
  （やや冗長だが、kind の情報を運ぶために新規イベント種別にした・§7-3 で申し送り）。

### 2-4. `diagnostic` イベントのフィールド拡張（barge-in マーカーの材料）

既存 `diagnostic` イベント（`fireVisionError` の `kind` 等と同じ additive 拡張の作法）に
`elapsedMs`/`charsSpoken`/`totalChars`/`prefix` を追加（`type:"bargeIn"` のときのみ非 null）。
操縦席は `type==="bargeIn"` を専用のマーカー行（`!! interrupted (N/M chars, Xms)`）として描き、
`bargeInStopError`/`bargeInMouthCloseRejected`/`bargeInMouthCloseError` は既存のゴースト行の型で
表示する。

## 3. 出力デバイス選択の永続化とプレイヤー再起動（Domain A §7-3 の申し送りへの回答）

`scripts/cockpit.mjs` の `onSetAudioDevice(name)`:

```js
const onSetAudioDevice = async (name) => {
  audioDeviceHooks.onSetAudioDevice(name);  // settings へ永続化（次回起動で復元）
  if (player != null) {
    try { player.dispose(); } catch {}
    player = null;                          // 次回 ensureFireResources() が新デバイス名で再生成
  }
};
```

**「次回起動から適用」ではなく「その場再起動」を採った**。理由: wave-plan §5 choke point（配信中に
アームマイクが声を拾っていると気づいてからデバイスを切り替える運用）を考えると、次回起動待ちは
現実的でない。トレードオフ: 再生中の発話は barge-in の `interrupt()` を経由せず、単に古いデバイスの
まま完了する可能性がある（次に声を出すときから新デバイスに切り替わる）。これは容認できる範囲と
判断した（人間ゲート⑥で違和感を確認してほしい・followup §10 に明記）。

## 4. 自発 OFF トグルの永続化（Domain C 継ぎ目の消費）

`createSelfFireHooks(settings, defaultEnabled)`:

```js
resolveInitialEnabled()  → settings.getSelfFireEnabled()（bool でなければ defaultEnabled=false へ）
onSetSelfFireEnabled(enabled) → settings.setSelfFireEnabled(enabled===true)（失敗寛容）
```

`cockpit-settings-store.mjs` の `getSelfFireEnabled`/`setSelfFireEnabled` は bool 専用（`vision`/
`audioDevice` の `asStringOrNull` とは異なる判別関数を使う——「未記憶（null）」と「明示 false」を
区別する必要があるため）。既存キー（`lastDevice`/`lastChannelUrl`/`visionTarget`/`audioDevice`）との
同居はテストで固定済み（§8）。

## 5. 実 SDK 確認（`scripts/observe-conversation.mjs`）— 実施内容と実測生数字

**実施した ask 数: 5（wave全体の上限ちょうど・A/B/C は 0 消費だったのでこの Domain D で全枠を使った）。
リトライは 1 回も発生しなかった。** env ガード（`assertSubscriptionAuthEnv`）は正常通過
（`ANTHROPIC_API_KEY` 等すべて未設定・`ANTHROPIC_BASE_URL` は既定値と一致で warning 0 件・
apiKeySource=`none`）。詳細・生ログ相当の全データは
[../../../experiments/s6-conversation.md](../../../experiments/s6-conversation.md) に記録済み。
以下は要点の再掲（生数字はそちらが正）。

### 5-1. 何を撃ったか（fire-orchestrator/fire-scheduler は実物・player/channel/speak は fake）

1. **ask #1・#2（barge-in）**: `orchestrator.fire()` で発話開始 → speaking 到達後 1200ms 待って
   `orchestrator.interrupt()` → 実測 `elapsedMs=1203ms, charsSpoken=6/16, prefix="今日の配信、"`。
   soul 行に `"今日の配信、…（遮られた）"` が実際に append された。次の `fire()`（ask #2）で
   「さっき遮っちゃってごめんね」への応答「ううん大丈夫、今日はコメントもいっぱいで盛り上がった
   よね」を実観測（機械的なキーワード一致は取れなかったが文脈的には自然な応答）。
2. **ask #3（呼びかけ=call）**: `createFireScheduler` を実物のまま生成し、`buffer.append({text:
   "コーディ、聞いてる?"})` → `handleTranscript` の名前照合が命中 → `onFireRequest({kind:"call"})`
   → `fireOrchestrator.fire()` が実際に実 SDK ask を撃つことを確認（返事「うん、聞いてるよ」）。
3. **ask #4（区切り応答=turn-end）**: fake clock（このスクリプトが注入する論理時計）を
   `TURN_END_REFRACTORY_MS` 分だけ進めて不応期をクリアし、`handleVadEvent({type:"speechEnd"})` →
   `turnEndSilenceMs` 分 advance → 条件成立（`rng()=0` に固定して確率判定を確実に通過させた）→
   実際に `fire()` が実 SDK ask を撃つことを確認（返事「ほんとだね、こういう日は気持ちいいな」）。
4. **ask #5（沈黙=silence・視覚発火）**: fake clock を `SILENCE_REFRACTORY_MS` 超まで進め（沈黙
   タイマの不成立→再武装→成立という連鎖を 1 回の `advance()` で処理）、自分で起動したメモ帳窓
   （マーカー本文入り）を対象に `fire({vision:true})` が実キャプチャ（Domain A `captureWindow`・
   実 PowerShell/PrintWindow）+ 実 SDK ask を撃つことを確認。返事「なにこれ、青いペンギンが宇宙
   飛んでるって、すごい発想だね」がマーカー本文のキーワード（ペンギン/青/宇宙）に言及した。

### 5-2. usage 推移（S5 usage 計器と同型・全 5 ask）

`input_tokens` はテキストのみの ask #1〜4 で単調増加（416→525→674→831）——S5（画像込み履歴）とは
異なり、画像を含まない履歴では素の `input_tokens` 加算になることを実測。ask #5（画像込み・cold）は
`input_tokens=2` に落ち `cache_creation_input_tokens=1788` が新規発生（S5 の cold ask と同型の挙動）。
`ask_ms` は 3.1〜7.3 秒のレンジ（劣化傾向は観測されず・短時間の観測のため長時間の重さは範囲外）。

### 5-3. 未実施項目（正直な明記・人間ゲート/L0 委譲）

- **barge-in の「体感レイテンシ」**（実マイク発話開始→実際に声が止まるまで）: 実マイク・実器・
  実 WinRT MediaPlayer が要るため**未実施**。fake player の `stop()` 呼び出し自体はコード実行時間
  のみで実体感とは無関係。→ 人間ゲート①（[human-gate-procedure.md](human-gate-procedure.md) §6）。
- **口閉じの実機の見え方**（release が自然か）: 全 fake ゆえ「sendSet が正しい payload で 1 回
  飛ぶ」までしか確認していない。→ 人間ゲート①。
- **呼びかけ照合の実人声命中率**: 転写は `buffer.append({text:...})` で直接注入しており、実マイク
  →ASR の転写揺れは経由していない。→ 人間ゲート②。
- **自発発火の実配信での頻度体感**: fake clock で条件成立を 1 回ずつ実証したのみ。→ 人間ゲート③④。

## 6. 器不変・依存ゼロ・チェック無退行の確認

```
git diff --stat -- apps/runtime-player packages                              → 出力なし（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json               → 出力なし（lockfile・依存不変）
git diff --stat -- apps/runtime-player/src/main/control-channel/contract     → 出力なし（契約 JSON 不変）

本 Domain の変更ファイル（git diff --stat・Domain A/B/C の未コミット成果物を除く）:
   M apps/soul/README.md
   M apps/soul/agent/scripts/cockpit.mjs                        (+127 -1)
   M apps/soul/agent/scripts/cockpit.test.mjs                   (+109 -1)
   M apps/soul/agent/src/cockpit/cockpit-server.mjs             (+199 -1)
   M apps/soul/agent/src/cockpit/cockpit-server.test.mjs        (+346)
   M apps/soul/agent/src/cockpit/cockpit-settings-store.mjs     (+34 -1)
   M apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs (+142)
   M apps/soul/agent/src/cockpit/cockpit.html                   (+169)
  ?? apps/soul/agent/scripts/observe-conversation.mjs
```

- `audio-player.*`/`speak.*`/`fake-media-player.mjs`/`preflight-voice.mjs`（Domain A）・
  `barge-in.mjs`/`.test.mjs`・`fire-orchestrator.mjs`/`.test.mjs`・`channel-client.*`・
  `ws-double.mjs`（Domain B）・`fire-scheduler.mjs`/`.test.mjs`（Domain C）の変更は**先行 Domain の
  未コミット成果物**であり本 Domain では 1 バイトも触れていない（読んで契約を消費しただけ）。
- 構造チェック 3 種（このセッション実行・リポジトリ root）:
  - `check:deps`（`node scripts/check-dependencies.mjs`）: **passed**。
  - `check:soul-zone`（`node scripts/check-soul-zone-boundary.mjs`）: **passed**（1342 files・器↔魂
    越境 import なし）。
  - `check:source`（`node scripts/check-source-organization.mjs`）: EXIT=1 だが唯一の違反は
    `apps/runtime-player/src/main/physiology/index.ts`（器コード・本 Domain 含め本 wave 全体で
    不変＝ブランチ既存の pre-existing 課題・Domain A/B/C の申し送りどおり）。**私のスコープ
    （soul/agent）には違反ゼロ**。
- `.tmp/facex-*`（別セッション領分）は一切触っていない。実 SDK は §5 で明記した 5 ask のみ・実マイク・
  実 PowerShell（audio-player の常駐プロセス）・実 AivisSpeech TTS はいずれも呼んでいない
  （観測スクリプトの player/channel/speak は fake・視覚発火の captureWindow のみ実 PowerShell 実行・
  対象は自分で起動したメモ帳のみ）。実行後の後始末（notepad プロセス・一時ファイル）は自己確認済み
  （§5・experiments/s6-conversation.md §9）。

## 7. §質問（Orch / レビューへの申し送り・迷った裁定点）

1. **出力デバイス変更の適用方式＝「その場再起動」**（§3 参照）: 「次回起動から適用」の方が単純だが、
   配信中の緊急切り替え運用（wave-plan §5 choke point）には合わないと判断した。再生中の発話が
   古いデバイスのまま完了しうる点は容認できる範囲と判断したが、人間ゲート⑥で違和感が無いか確認して
   ほしい。
2. **`server.setSelfFireEnabled()`（プログラム的呼び出し・Domain C の継ぎ目）は永続化フックを呼ばない**
   設計にした: HTTP エンドポイント `POST /api/self-fire` のみが `onSetSelfFireEnabled` を呼ぶ。
   既存 Domain C テスト（`server.setSelfFireEnabled(false)` を直接呼ぶ同期 API として検証済み）の
   互換性を優先したが、将来この API 自体に永続化を連動させたい用途が出たら見直しが要る。
3. **自発発火マーカーは SSE `selfFire` を新設イベントにした**（既存 `fire`/`visionCaptured` とは
   別枠）。1 回の自発発火につき `fire`（or `visionCaptured`）イベントと `selfFire` イベントの
   両方が飛ぶ（kind の情報を運ぶ専用イベントが必要と判断したため・やや冗長）。既存 `fire` イベント
   の payload に kind を足す選択肢もあったが、fire-orchestrator 自身は呼び出し元（scheduler 経由か
   手動か）を知らない設計（Domain B/C の意図的な責務分離）なので、結線層側で別イベントとして表現
   する方が自然と判断した。レビューでこの選択が適切か確認してほしい。
4. **診断イベントのフィールド拡張（elapsedMs 等）を bargeIn 専用にせず全診断型に一律追加した**:
   `fireVisionError` の `kind` と同じ「新規イベント種別を増やさず既存に相乗り」の作法を踏襲。
   他の診断型では null になるだけで契約破壊はない。
5. **実 SDK 観測（observe-conversation.mjs）の fake clock は fire-scheduler 専用**で、
   fire-orchestrator（completion タイマ・barge-in のタイミング）は実時間のまま実装した。2 つの
   独立したクロック系が共存する設計だが、barge-in の「発話の途中で遮る」という体感は実時間で
   自然に表現でき、自発発火の「45〜95 秒待つ」は論理時間で圧縮できる、という使い分けの妥当性は
   レビューで確認してほしい。
6. **沈黙発火の fake clock advance 量（95000ms）は境界値ぎりぎりの安全マージン計算に依存**している
   （`SILENCE_REFRACTORY_MS=90000` と次周期 `+SILENCE_BASE_MS=45000` の間に収まる値を選んだ・
   §5-1 参照）。この計算はスクリプト内コメントに明記したが、fire-scheduler の定数（followup §3 で
   調整対象）が変わった場合はこのスクリプトの advance 量も見直しが要る（壊れやすい依存関係として
   記録しておく）。

## 8. 機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・新規込み総数・タイムアウト 300s 付きで実行）:

```
# tests 507
# pass  507
# fail  0
# cancelled 0
# skipped 0
# todo 0
```

**S6 Domain C 後ベースライン 479 → 507（+28）**。内訳:
- `src/cockpit/cockpit-settings-store.test.mjs`: 12 → 20（**+8**）。audio device 4 本（roundtrip・
  他キーとの同居・corrupt JSON・unwritable path）+ self-fire enabled 4 本（同型）。
- `src/cockpit/cockpit-server.test.mjs`: 49 → 60（**+11**）。`GET /api/audio-devices` 3 本・
  `POST /api/audio-device` 2 本・`POST /api/self-fire` 3 本・SSE `selfFire`（fired:true/false）
  2 本・SSE `bargeIn` 診断フィールド 1 本。
- `scripts/cockpit.test.mjs`: 18 → 27（**+9**）。`createAudioDeviceHooks` 4 本 + `createSelfFireHooks`
  5 本。
- 他ファイル（fire-orchestrator・barge-in・fire-scheduler・audio-player・speak・cli 等の既存テスト）
  は**期待値変更ゼロで全通過**（本 Domain は結線層/永続化層/操縦席のみを触り、Domain A/B/C の実装
  コードには 1 バイトも触れていない）。

実 SDK・実 PowerShell（常駐プレイヤー）・実 AivisSpeech TTS・実マイクはいずれも `node --test` の
実行経路では呼んでいない（全 fake・無音）。実 SDK 消費は §5 の 5 ask（`observe-conversation.mjs`
実行時のみ・machine test の対象外）。実行後、`node --test` を再実行し 507/507 の無退行を確認した。
