# S3 追撃 wave（domain-c）レビュー: spec レーン（設計適合）

> Reviewer: Review-Sylph（spec = 設計適合）。委任元: Orch-Sylph。作成 2026-07-12。
> 対象: `apps/soul/agent`（domain-c 実装記録 [../../waves/s3/domain-c.md](../../waves/s3/domain-c.md)）。
> 判定基準: [../../screens/soul-cockpit.md](../../screens/soul-cockpit.md) §2.1 /
> [../../waves/s3/domain-a.md](../../waves/s3/domain-a.md) §2（ワイヤ契約）/
> [../../waves/s3/domain-b.md](../../waves/s3/domain-b.md) / [../../waves/s3/s3-followup.md](../../waves/s3/s3-followup.md)。
> 方法: Gnome の説明に依存せず、対象ファイルと差分（`git diff`・作業ツリー = domain-c 分）を Read で裏取り。
> 読み取り専任（コード変更なし・テスト実行は test レーン）。

## 判定: **合格**

差分（要修正）はゼロ。観点 1〜7 すべて設計に適合。裁量 1〜4 も妥当。以下、根拠付きで記す。
非ブロッキングの観察 1 件（発火マーカーと no-URL ゴースト行の順序）を「質問」に添える。

---

## 観点別の確認結果（根拠ファイル・行）

### 1. 二重表示修正の設計妥当性 — 適合

- **ガードの位置・条件が正しい**: `src/cockpit/cockpit-server.mjs` の `startEars` 内 `onTranscript`
  ハンドラの**先頭**に `if (/** @type {any} */ (entry).speaker === "soul") return;`（diff の
  `onTranscript` ブロック冒頭・broadcast 前）。soul を broadcast する前に確実に弾いており、位置・条件とも正しい。
- **soul の放送経路が 1 本に収束**: soul の SSE `transcript`(speaker:"soul") 放送は
  `broadcastSoulTranscript`（`onSoulTranscript` フック経由・cockpit-server.mjs の
  `fireOrchestratorFactory` 結線ブロック内 `onSoulTranscript: (entry) => broadcastSoulTranscript(entry)`）の
  **1 本だけ**になった。耳の onTranscript 経路は soul を return で除外するため二重放送は起きない。
- **you 発話は無退行**: ガードは `speaker === "soul"` のみを弾く。you（speaker `"you"` または未定義）は
  従来どおり onTranscript 経路で broadcast される。`toWireEntry` も `entry.speaker ?? "you"` で素通し。
- **コメント修正が実態と一致**: `src/mind/fire-orchestrator.mjs`（「soul は onTranscript を通らない」の旧誤記を
  「必ず通る・受け側で除外せよ」に訂正）・`src/ears/ear-pipeline.mjs`（onAppend は話者無差別・受け側で
  speaker:"soul" 除外の注意追記）とも、実装挙動（soul も同一 transcriptBuffer に append → onAppend →
  onTranscript を通る）と一致。誤解を残さない。実挙動の変更はコメントのみ（`git diff` で確認）。

### 2. Channel URL の責務境界 — 適合

- **cockpit-server（Domain A = 土台）は生 URL を保持/ログしない**: POST /api/channel ハンドラは body.url を
  trim し（空は null）、`await onSetChannelUrl(url)` へ橋渡しするのみ。ハンドラ外に URL を保持する変数はなく、
  ログ出力もない（diff で確認）。state には `channelStatusImpl()`（注入フックの返り）だけを載せる。
- **注入フック経由のみ**: `onSetChannelUrl` / `channelStatus` は options 注入。snapshot() の `channel` は
  `typeof channelStatusImpl === "function" ? (channelStatusImpl() ?? null) : null`。
- **channelStatus は redact 済みのみ**: `scripts/cockpit.mjs` の `channelStatus()` は
  `url: u != null ? redactToken(u) : null` を返す。生 URL は state に載らない。
- **未注入時 503**: `onSetChannelUrl` 未注入なら POST /api/channel は 503 `{ error: "channel control not available" }`。
  `createCockpitServer({})` 直接（S2.5 の器・テスト・preflight-cockpit）はこれを叩かない = 無退行。

### 3. redactToken 徹底 — 適合

- **redactToken の実装**（`src/channel/channel-client.mjs:192`）は `token` クエリを `<redacted>` に置換し、
  パース不能な URL は `<unparseable-url>` を返す。**どの経路でも生 token を漏らさない**。
- state snapshot / SSE（broadcastState 経由の channel）/ ログ（cockpit.mjs の `channel set: ${redactToken(url)}`・
  起動時 `redactToken(startupUrl)`）はすべて redact 済み。
- **UI の token 非残留**: `cockpit.html` の Set 成功後に `byId("channel-url").value = "";` で入力欄を空にし、
  生 URL（token）を DOM に残さない。表示（`applyChannel`）は redact 済み `state.channel` のみを描く。

### 4. settings 同居（read-modify-write）— 適合

- `cockpit-settings-store.mjs` は `readAll()` + `writeMerged(patch)` に再構成され、`setLastDevice` /
  `setLastChannelUrl` はいずれも `{ ...readAll(), ...patch }` で書く。**片方の set がもう片方を消さない**。
- 壊れた/未作成 JSON は `readAll` が `{}` 扱いで続行（失敗寛容を維持）。書き込み失敗も握って続行。
- 既定パスは `DEFAULT_SETTINGS_PATH = cockpit-settings.local.json`。`git check-ignore` で **IGNORED** を確認済み
  （token を含むため非コミット）。

### 5. S2.5 無退行 — 適合

- **session/player の遅延生成**: `scripts/cockpit.mjs` の `ensureFireResources()` が session/player を初回まで
  生成しない。`sessionProxy.ask` は `if (lazyChannel.getUrl() == null) throw`（**ensureFireResources を呼ぶ前**）で
  no-URL を弾くため、**URL 未設定ユーザーは LLM を spawn しない**。playerProxy.play は speak 後（= ask 成功後 =
  URL 設定済み）にしか到達しない。fireOrchestratorFactory は常時注入されるが、生成は proxy 越しで spawn を伴わない。
- **--channel 後方互換**: `initialUrl = args.channel ?? settings.getLastChannelUrl() ?? null`。`--channel` 指定時のみ
  起動末尾で `ensureFireResources()` を eager 呼び（従来の TTFT 先払い・S3 挙動不変）。指定 URL は
  `settings.setLastChannelUrl` にも載り次回復元。
- **無退行の器経路**: `createCockpitServer({})` 直接は onSetChannelUrl / channelStatus /
  fireOrchestratorFactory 未注入 = POST /api/channel も /api/fire も 503・channel:null。

### 6. スコープ遵守 — 適合

- **器コード不変**: `git diff --stat HEAD~1 -- apps/runtime-player/` は**空**（C4 契約
  `apps/runtime-player/src/main/control-channel/contract/` を含め runtime-player は一切不変）。
- **承認外の機能追加なし**: 変更はすべて (1) 二重表示修正 + 回帰テスト、(2) Channel URL 操縦席入力、
  (3) 記録、の承認スコープ内。
- **既存テスト無変更（追加のみ）**: 作業ツリー diff で test 4 ファイル（cockpit-server / cockpit-settings-store /
  cockpit-page / scripts/cockpit の各 .test.mjs）に**削除行ゼロ**を確認（`git diff | grep '^-'` が空）。
  共有 `makeFakePipeline` は不変・回帰テスト用に専用 `makeOnAppendPipeline` double を新設。

### 7. 記録の正確性 — 適合

- **soul-cockpit.md §2.1**: 「Channel URL 入力欄」節が実装（場所・POST /api/channel・注入フック責務境界・
  redactToken・token 非残留・--channel 後方互換・S2.5 無退行の遅延生成）と一致。503 案内の更新注記
  （cockpit.mjs 経路では fire 常時結線ゆえ 503 は出ず `(fire error: …)` ゴースト行になる）も実装と一致。
- **s3-followup.md §3**: (3-1) S8 出力デバイスノブ持ち越し・(3-2) fake pipeline 二重非再現の経緯・
  (3-3) Fire ボタン UI gating 見送りの台帳化、いずれも実装判断と一致。
- **apps/soul/README.md**: 「操縦席の Channel 欄入力が標準・--channel は後方互換初期値」「settings 記憶」
  「S2.5 無退行の遅延生成」「redactToken」の記述が実装と一致。

---

## 裁量判断（domain-c.md §6）の妥当性評価

1. **Fire ボタンの channel-gating を UI に足さなかった** — **妥当**。既存 `cockpit-page.test.mjs` の
   `applySoulState`（`btn-fire.disabled = st !== "idle"`）のピン留めに抵触せず、かつ URL 未設定での Fire は
   `sessionProxy.ask` が spawn 前に弾き `(fire error: …)` ゴースト行で明示する（無言の失敗にしない）。
   重要なのは、この挙動は **soul-cockpit.md §2.1 が Accepted な UX 定義として明記している**
   （「URL 未設定での Fire は spawn せず `(fire error: …)` のゴースト行で示す」）ため、裁量ではなく
   承認済み UX に沿っている。UI disable 化は s3-followup §3-3 に台帳化済みで、次にテストを触る wave で回収が素直。
2. **session/player の遅延生成方針（--channel eager・他は初回 fire）** — **妥当**。S2.5 無退行（spawn 回避）と
   --channel の TTFT 先払い後方互換を両立する最小の落とし所。純 S2.5 ユーザーは何も spawn しない（観点 5 で裏取り済み）。
3. **専用 pipeline double（makeOnAppendPipeline）新設・makeFakePipeline 不変** — **妥当**。共有 fake に onAppend
   購読を足すと既存の手動 onTranscript 発火が二重化して既存テストを壊す。局所 double が正しい選択。
4. **soul ガードの `@type {any}` キャスト** — **妥当**。実挙動に影響なく、standalone `--strict --checkJs` プローブの
   新規エラーをゼロに保つための整形。同ファイルの既存 untyped-callback パターンと同種で、規律（新規違反ゼロ）に沿う。

---

## 質問（非ブロッキング）

1. **発火マーカーと no-URL ゴースト行の順序**: URL 未設定 + 耳起動中 + 非空窓で Fire すると、orchestrator は
   `onFire({accepted:true, injectedChars, includedCount})` を **ask の前**（thinking 遷移時）に broadcast するため、
   操縦席に `fired (N lines, M chars injected)` の**発火マーカー行が先に出て**、直後に sessionProxy.ask が
   no-URL で throw して `(fire error: Channel URL is not set …)` ゴースト行が続く。「injected」と出た直後に
   error が出るのは軽い違和感がありうる。ただしこれは **domain-a のワイヤ契約（onFire accepted:true は thinking
   遷移時に発火）どおりの挙動**で、domain-c が導入した退行ではない。ゴースト行で失敗は明示されるため実害は小。
   意図どおりか（URL 未設定時はマーカーを抑制したい等の要望があるか）だけ確認したい。要望があれば domain-a
   側の onFire タイミング/no-URL 早期 return の小 wave として切り出すのが素直（現状は修正不要と判断）。

---

## 機械ゲート（spec レーンの管掌外・test レーン確認事項として付記）

- test 実行・件数（284/284 緑・回帰赤→緑）は test レーンの管掌。spec レーンでは設計適合のみ判定した。
- commit / install はしていない（作業ツリーは未コミット = domain-c 分が M、domain-c.md が untracked）。本レビューも同様。
