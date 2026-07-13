# S5 Domain C: 操縦席 + ホットキー + 実SDK確認 + 計測 + docs（視覚発火の結線 + 実射確認）

> Status: **Domain C 全体（前半＝C-impl + 後半＝C-verify）完了（2026-07-13）**。前半（操縦席コード +
> ホットキー + fake テスト）に続き、後半（実 SDK 確認・実験記録・docs・followup 台帳）を本ドキュメント
> §実SDK確認（C-verify）に追記した。人間ゲート（ゲーム窓での実視認）は
> [human-gate-procedure.md](human-gate-procedure.md) に手順を用意済みだが**実行はユーザー**（未実施）。
> 担当: Gnome（Orch-Sylph 委任・前半/後半は別セッションのサブエージェント）。対象パッケージ:
> `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/s5-wave-plan.md](../../orchestration/s5-wave-plan.md) §2・§3 Domain C /
> [../../orchestration/s5-planning-inventory.md](../../orchestration/s5-planning-inventory.md) §2-4（挿入点地図）。
> 消費した Domain 成果物: [domain-a.md](domain-a.md)（`listWindows`/`captureWindow` の契約）・
> [domain-b.md](domain-b.md)（`fire({vision:true})`・`onVisionCaptured`/`onUsage`/`fireVisionError` のワイヤ契約）。

## 0. パイプライン（この Domain が敷いた線）

```
操縦席「Vision target」セクション:
  GET /api/windows（一覧取得ボタン相当）→ listWindowsImpl()（既定 = Domain A listWindows・実 PowerShell 起動）
    → { windows:[{pid,processName,title}] } | { windows:[], error }
    → <select> にオプション表示
  選択 → POST /api/vision-target { title } → onSetVisionTarget(title) → cockpit.mjs 側で settings.setVisionTarget(title)
    （次回起動で復元・Channel URL と同型の read-modify-write）
  → state.visionTarget = visionTargetStatus() = { title } を GET /api/state・SSE state に載せる（現在の対象表示）。

操縦席「Fire (vision)」ボタン / AHK Ctrl+Alt+G:
  POST /api/vision-fire
    → fireOrchestrator.fire({ vision: true })（Domain B の実装・§3-2〜3-5 の分岐仕様どおり）
    → 受理(fired:true) は 202・非受理(fired:false) は 200（既存 /api/fire と同型のステータス規約）

fire-orchestrator の hooks → cockpit-server の SSE broadcast（この Domain が新設した配線）:
  onVisionCaptured({title,width,height,jpegBase64,elapsedMs}) → broadcast("visionCaptured", info)
    → ページが「見た」マーカー行 + 縮小サムネ <img> を Timeline に描く（ディスクには一切書かない）。
  onUsage({usage, vision})                                    → broadcast("usage", info)
    → ページが直近 ask の input_tokens/output_tokens を控えめに表示（累積検知の最小計器）。
  onDiagnostic({type:"fireVisionError", kind, message})       → broadcast("diagnostic", {...,kind})
    → ページがゴースト行に "(vision fire: <kind> — <message>)" を表示（既存 diagnostic ハンドラの拡張）。
```

`listWindows`（Domain A）・`fire({vision:true})`/`onVisionCaptured`/`onUsage`/`fireVisionError`（Domain B）は
一切改修せず import/注入して使うだけ（このドメインは操縦席・cockpit-server・cockpit.mjs・AHK のみを触った）。

## 1. 実装/改修したファイル一覧（すべて `apps/soul/agent/`）

| ファイル | 種別 | 変更点 |
|---|---|---|
| `src/cockpit/cockpit-settings-store.mjs` | 改修 | `getVisionTarget()`/`setVisionTarget(title)` を既存 `getLastChannelUrl`/`setLastChannelUrl` と同型で追加（`writeMerged` に JSON キー `visionTarget` 1 個を足すだけ・read-modify-write は既存 `writeMerged` をそのまま再利用）。 |
| `src/cockpit/cockpit-settings-store.test.mjs` | 改修 | vision target の set→get roundtrip / device・channel URL・vision target の 3 者同居（read-modify-write で他を消さない）/ 壊れた JSON → null / 書き込み失敗を握る、の 4 本追加。既存 8 本は無変更。 |
| `src/cockpit/cockpit-server.mjs` | 改修 | `GET /api/windows`（`listWindowsImpl` 注入・既定は Domain A `listWindows`）・`POST /api/vision-target`（`onSetVisionTarget` フック）・`POST /api/vision-fire`（`fireOrchestrator.fire({vision:true})`）の 3 エンドポイントを追加。`snapshot()` に `visionTarget`（`visionTargetStatus()` の結果）を追加。`handleDiagnostic` の SSE `diagnostic` ペイロードに `kind` フィールドを追加（`fireVisionError` の kind を運ぶ・既存診断型は `kind:null` になるだけで契約破壊なし）。`fireOrchestratorFactory` 呼び出し時の hooks に `onVisionCaptured`/`onUsage` を追加し、それぞれ SSE `visionCaptured`/`usage` として broadcast。 |
| `src/cockpit/cockpit-server.test.mjs` | 改修 | `GET /api/windows`（成功/失敗/未注入時デフォルト値の型確認）・`POST /api/vision-target`（未注入 503・フック橋渡し+trim+クリア+state 反映）・`POST /api/vision-fire`（未注入 503・`fire({vision:true})` で呼ばれることの固定・no-target 系）・SSE 3 種（`visionCaptured`・`usage`・`diagnostic` の `kind`）の計 11 本追加。`makeFakeOrchestrator` ヘルパーを `fire(fireOptions)` の引数を記録できるよう拡張（記録追加のみ・既存呼び出し `fire()` の挙動は不変）。既存テストは 1 行も変更していない。 |
| `scripts/cockpit.mjs` | 改修 | `createVisionTargetHooks(settings)` を新設・export（`getVisionTarget`/`onSetVisionTarget`/`visionTargetStatus` の 3 点セットを settings から作る薄い橋渡し層・`createSessionProxy` と同じ「テスト可能化のための抽出」設計）。`main()` で `visionTargetHooks` を生成し、`fireOrchestratorFactory` へ `getVisionTarget` を、`createCockpitServer` へ `onSetVisionTarget`/`visionTargetStatus` を配線。`captureImpl` は既定（Domain A `captureWindow`）のまま渡していない。Channel URL・sessionProxy・既存 fire 配線は無変更。 |
| `scripts/cockpit.test.mjs` | 改修 | `createVisionTargetHooks` のテスト 4 本追加（getVisionTarget 透過・onSetVisionTarget 橋渡し+クリア・visionTargetStatus 形状・settings 側 throw を握る）。既存 14 本は無変更。 |
| `src/cockpit/cockpit.html` | 改修 | 「Vision target」セクション（`<select>` + Refresh windows + Set target ボタン + 現況表示）・「Fire (vision)」ボタン・usage 表示（`#usage-note`）を追加。「見た」マーカー行（`addVisionMarkerRow`・サムネ `<img>` 込み）・fireVisionError のゴースト行（kind 表示）を追加。`applySoulState` が `btn-vision-fire` も disable 制御するよう拡張（busy 中の二重防波堤）。`init()` で `loadWindows()` を呼び初期選択肢を取得。 |
| `scripts/fire-hotkey.ahk` | 改修 | `^!g:: FireVision()`（Ctrl+Alt+G）を追加。`FireVision()` は `FireSoul()` の写経で POST 先だけ `/api/vision-fire` に変更。既存 `^!f:: FireSoul()` は不変。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・`apps/soul/agent/package.json` は
完全不変**（`git diff --stat` 出力ゼロで確認・§8）。`.tmp/facex-*` 配下・`src/eyes/**`（Domain A 成果物）・
`src/mind/fire-orchestrator.mjs`/`llm-session.mjs`（Domain B 成果物）・`discussion/ai-cohost/implementation/reviews/s5/`
は一切触っていない（import/参照のみ）。

## 2. 新エンドポイントの契約

### 2-1. `GET /api/windows`

```
→ 200 { windows: Array<{pid:number, processName:string, title:string}>, error: null }
   | 200 { windows: [], error: string }   // listWindowsImpl が {error:{kind,message}} を返した場合
```

- `listWindowsImpl`（既定 = Domain A `listWindows`・**実 PowerShell を起動する**）の戻り値をそのまま
  `.windows`/`.error` に写すだけ（cockpit-server は列挙ロジックを持たない）。
- 常に HTTP 200（列挙失敗は「対象一覧が空」として UI 側で表示するだけで、致命的なサーバエラーではないため）。

### 2-2. `POST /api/vision-target`

```
body: { title: string }  // 空/空白のみは対象クリア
→ 503 { error: "vision target control not available" }   // onSetVisionTarget 未注入
→ 200 <state snapshot>（visionTarget: { title } を含む）
```

- `POST /api/channel` の写経: title を trim し、空なら `null`（クリア）にして `onSetVisionTarget(title)` を呼ぶ。
  **cockpit-server は永続化の実体を知らない**（責務境界・実体は `scripts/cockpit.mjs` の
  `createVisionTargetHooks` が `settings.setVisionTarget` へ橋渡しする）。

### 2-3. `POST /api/vision-fire`

```
→ 503 { error: "fire not available" }                       // fireOrchestrator 未注入
→ 202 { fired:true, replyText, expressions, injectedChars, includedCount, vision:true, state }
→ 200 { fired:false, reason:"vision-no-target" | "vision-capture-failed" | "busy" | "ears-not-running" | ..., state }
```

- `POST /api/fire` の写経: `fireOrchestrator.fire({ vision: true })` を呼ぶだけ（busy 保護・診断発行は
  Domain B の orchestrator が担う）。`fired` の真偽で 202/200 を出し分ける規約は既存 `/api/fire` と共通。

### 2-4. SSE イベント 3 種

| event | ペイロード | 発生源 |
|---|---|---|
| `visionCaptured` | `{ title, width, height, jpegBase64, elapsedMs }`（domain-b.md §4-1 そのまま） | `onVisionCaptured` フック |
| `usage` | `{ usage, vision }`（domain-b.md §4-2 そのまま・`usage` は SDK の usage を無加工透過） | `onUsage` フック（通常 Fire・視覚発火の両方で発火） |
| `diagnostic`（既存イベント種別の拡張） | 既存フィールド + `kind`（`fireVisionError` のときのみ非 null。他の診断型は `kind:null`） | 既存 `onDiagnostic`/`handleDiagnostic` 経路（新規イベント種別を増やさず既存に相乗り） |

`visionCaptured`/`usage` は完全新規の SSE イベント種別。`fireVisionError` は「新規イベント種別」ではなく
既存の `diagnostic` イベントに `kind` フィールドを追加しただけ（既存の `diagnostic` 購読側の後方互換を壊さない
設計判断）。

## 3. 対象ウインドウ設定の永続化（`visionTarget` キー）

- `cockpit-settings-store.mjs` の `writeMerged`（read-modify-write）にキーを 1 個足しただけ。保存先は既存
  `cockpit-settings.local.json`（.gitignore 済み）と同一ファイルで、`lastDevice`/`lastChannelUrl` と共存する
  （§1 テストで 3 者同居を固定）。読めない/壊れた JSON は `null`、書き込み失敗は握って続行（既存の失敗寛容
  契約をそのまま踏襲・新規の分岐を増やしていない）。
- `scripts/cockpit.mjs` の `createVisionTargetHooks(settings)` が settings の getter/setter を
  `getVisionTarget`（fire-orchestrator へ渡す関数）・`onSetVisionTarget`/`visionTargetStatus`
  （cockpit-server へ渡すフック）の 3 点セットへ変換する薄い層（`createSessionProxy` と同型の「main() から
  抽出してテスト可能にする」設計判断）。

## 4. サムネ base64 を SSE に載せる/ディスクに書かない担保

- `onVisionCaptured` フックが運ぶ `jpegBase64` は `broadcast("visionCaptured", info)` で SSE フレームの
  JSON にそのまま載る（`res.write` で送るだけ・サーバ側でファイルへ書く経路を追加していない）。
- `cockpit.html` 側は受け取った `jpegBase64` を `<img src="data:image/jpeg;base64,...">` に渡すだけで、
  `localStorage`/`sessionStorage`/ダウンロード等のディスク相当の永続化コードは一切書いていない（ブラウザの
  メモリ上の DOM に一時的に存在するのみ・Domain A/B のディスク非保存の流儀をページまで貫通させた）。
- `cockpit-server.test.mjs` の SSE テスト（§1）は `jpegBase64` の値がフレームにそのまま届くことを固定して
  いるが、**ファイルシステムへの書き込みが起きないことの直接テストはしていない**（このドメインのコード自体が
  書き込み処理を持たないという構造的な担保に留まる・後半 Gnome の実 SDK 確認時に実データで確認してほしい・
  §7 質問 3）。

## 5. AHK 第二ホットキー

`scripts/fire-hotkey.ahk` に `^!g:: FireVision()`（Ctrl+Alt+G）を追加。`FireVision()` は `FireSoul()` の
写経で POST 先だけ `/api/vision-fire` に変更（非同期送信・応答を読まない・例外は通知なしで握る、という
既存の設計をそのまま踏襲）。既存 `^!f:: FireSoul()` は 1 行も変更していない。**AHK は `node --test` の対象外
のため構文レビューのみ（実行して確認していない・手動確認は人間ゲート/後半の領分）**。

## 6. UI の要点（v0 裁定の遵守）

- **ツマミは置いていない**: 縮小長辺/JPEG 品質の調整 UI は作らない（wave-plan §2 裁定 6 のゲイン CLI の
  教訓をそのまま踏襲）。`vision-target-select` は「対象ウインドウを選ぶ」ためだけの UI で、キャプチャ
  パラメータの調整口ではない。
- 「見た」マーカー行はサムネを**縮小表示**するのみ（CSS `max-height:54px; max-width:96px`）で、フル解像度の
  画像をページに保持する経路は無い（`<img>` の `src` に base64 を直接渡すだけ・別要素へのコピーはしていない）。
- usage 表示は「直近 ask の input_tokens/output_tokens」のみの最小表示（累積グラフ・履歴は持たない・
  裁定2「計測できるようにして、問題が起きるかを早期に検知できる方向性」の最小実装。累積を追う手段が
  要るなら後半/followup の領分・§7 質問1）。

## 7. §質問（Orch / Domain C 後半 Gnome への申し送り）

1. **usage 表示の粒度**: wave-plan §2 裁定 2 は「input_tokens 等の推移を可視化」を求めているが、この
   ドメインは「直近 1 回分」だけを `#usage-note` に上書き表示する最小実装に留めた（累積グラフ・履歴保持は
   していない）。実 SDK 確認（後半・上限 5 ask）で input_tokens の ask 毎推移を実測する際、「早期検知」に
   直近値だけで足りるか、簡単な履歴（例: 直近 N 件のスパークライン相当）が要るかは実測結果を見て判断して
   ほしい。もし要るなら、cockpit.html 側に配列を持たせるだけの小さな変更で足りるはず。
2. **`GET /api/windows` が実 PowerShell を起動する点のテスト方針**: このドメインのテストは
   `listWindowsImpl` を必ず fake 注入し、Domain A の実 `listWindows`（実 PowerShell 起動）を一度も
   呼んでいない（§1 テストの `未注入時は既定実装が使われる` は「構築時に throw しないことの型確認」のみで
   実行はしていない）。実機での一覧取得（Refresh windows ボタンを押したときに実際にウインドウが列挙
   されるか）は Domain A の `preflight-eyes.mjs` の対象外（あちらは `captureWindow` 単体の疎通）でもあり、
   後半 Gnome の実 SDK 確認 or 人間ゲートのどちらかで一度実地確認しておくべきだと考える。
3. **サムネがディスクに書かれないことの直接証跡**: §4 の通りこのドメインのコードは書き込み経路を持たない
   という構造的な担保に留まっている（`git status`/`git diff` で新規ファイルが生まれていないことの間接
   確認はできるが、ブラウザ側の挙動は machine test の対象外）。後半の実 SDK 確認で実際にブラウザを開いて
   視覚発火した際、DevTools 等でネットワーク/ストレージにサムネが残らないことを一度目視してほしい
   （wave-plan §1 機械ゲート「画像のディスク非書き込み」の一部）。
4. **`fireVisionError` を diagnostic イベントの拡張にした設計判断**: 新規イベント種別（例えば
   `visionError`）を切る選択肢もあったが、既存 `diagnostic` ハンドラ（`asrFailure`/`fireError`/
   `expressionUnknownTag` 等）と同じ「ゴースト行に落ちる失敗」という性質が共通していたため、`kind`
   フィールドを 1 個足す形の相乗りにした。domain-b.md §7 質問 4（「サムネを SSE にどう載せるか」への
   申し送り）に対するこのドメインの回答が上記の設計になる。後半/レビューでこの選択が適切か確認してほしい。
5. **`visionTargetStatus` を `channelStatus` と非対称にした理由**: Channel URL は token を含むため
   `channelStatus()` が redact 済みの値を返す設計（cockpit-server は生 URL を知らない）。vision target は
   タイトル文字列のみで機密情報を含まないため、redact 相当の処理を挟まず `{ title }` をそのまま返す
   設計にした。この非対称性が適切か（例えば将来ウインドウタイトルにユーザー名等が含まれるケースを
   気にすべきか）は判断が割れうるため申し送る。
6. **`POST /api/vision-target` の入力形をタイトル文字列限定にした点**: `GET /api/windows` は
   `{pid, processName, title}` を返すが、`POST /api/vision-target` は `title` のみを受ける（pid はサーバに
   送らない）。Domain B の `getVisionTarget` 契約が「タイトル文字列を返す関数」を期待している（domain-b.md
   §7 質問 6 とも整合）ためこの形にしたが、同名ウインドウが複数存在するケース（同一プロセス複数窓・
   同名アプリ複数起動）の識別性は担保していない。Domain A の制約（プロセスごと主窓 1 個のみ列挙）と
   合わせて、実運用で問題になるかは後半/followup の領分として申し送る。

## 8. 機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・新規込み総数・タイムアウト 300s 付きで実行）:

```
# tests 411
# pass 411
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

（S5 Domain B 完了時点のベースライン 392 → +19。内訳: `cockpit-settings-store.test.mjs` +4 /
`cockpit-server.test.mjs` +11 / `cockpit.test.mjs` +4。既存テストは 1 本も変更していない＝無退行。）

`git diff --stat -- apps/runtime-player packages` / `git diff --stat -- pnpm-lock.yaml
apps/soul/agent/package.json` はいずれも出力なし（差分ゼロ）。`git status --porcelain` で変更ファイルは
`apps/soul/agent/scripts/cockpit.mjs` / `cockpit.test.mjs` / `fire-hotkey.ahk` /
`apps/soul/agent/src/cockpit/cockpit-server.mjs` / `cockpit-server.test.mjs` /
`cockpit-settings-store.mjs` / `cockpit-settings-store.test.mjs` / `cockpit.html` の 8 ファイルのみで
あること（Domain A/B が既に変更していた `src/mind/fire-orchestrator.mjs`・`llm-session.mjs` 等は
このドメインでは触れていない・当該ファイルの diff はこのセッション以前の Domain B 実装分のまま）を確認した。
`.tmp/facex-*`・`src/eyes/**`・`discussion/ai-cohost/implementation/reviews/s5/` の他 wave/他ドメイン
成果物は一切触っていない。実 SDK・実 PowerShell・実マイク・実 TTS はいずれも呼んでいない
（capture/session/channel/listWindows すべて fake 注入）。AHK・HTML は `node --test` の対象外のため
構文的に妥当な追記に留め、実起動はしていない（手動確認は人間ゲート/後半 Gnome の領分）。

---

## 9. §実SDK確認（C-verify・Domain C 後半・別セッションの Gnome が追記）

> 前半（§0〜§8）の実装（操縦席・cockpit-server・cockpit.mjs・cockpit-settings-store・AHK）は
> **一切改修していない**（Domain A/B/C-impl のコードは import して使うだけ、という鉄の規律に従う）。
> 後半が新規に書いたのは実 SDK 観測スクリプト 1 本（`scripts/observe-vision.mjs`）とドキュメント
> （experiments・README・人間ゲート手順書・followup 台帳）のみ。

### 9-1. 何を実射したか

`apps/soul/agent/scripts/observe-vision.mjs`（新規・`observe-expressions.mjs`/`measure-fire.mjs` の
写経）を実行し、**wave で唯一の実 SDK 消費**を行った:

1. 自分で起動したメモ帳窓（特徴的なマーカー本文入り）を Domain A の実 `captureWindow`（実
   PowerShell・PrintWindow）で 1 枚撮影 → 撮影直後に窓を閉じる（後始末を SDK 実射より前に済ませる）。
2. Domain B の実 `createLlmSession`（サブスク OAuth・`claude-opus-4-8`・`FIRE_SYSTEM_PROMPT`）へ
   `[image(先行), text]` の content 配列で ask #1（視覚発火）。
3. 同一常駐セッションでテキストのみの ask #2〜5（通常 Fire 相当）を継続し、画像込み履歴の再送
   コストを観測。

**env ガード（`assertSubscriptionAuthEnv`）は正常に通過**（`ANTHROPIC_API_KEY`/
`ANTHROPIC_AUTH_TOKEN`/`CLAUDE_CODE_USE_*` すべて未設定。`ANTHROPIC_BASE_URL` は既定値
`https://api.anthropic.com` と完全一致のため warning 0 件）。**実 ask は 5 回で完了**（ハード
ガード上限ちょうど・リトライは 1 回も発生しなかった）。

### 9-2. 観測結果の要点（実数字・詳細は experiments/s5-vision.md）

- **(a) 画面言及: 確認できた**。ask #1 の返事「紫のタコが自転車で虹くぐってる〈surprised〉もう
  カオスだね。」が、メモ帳に書いたマーカー本文（「紫色のタコが自転車に乗って虹をくぐっている」）の
  キーワード 6 語中 4 語（タコ/自転車/紫/虹）に触れた。
- **(b) レイテンシ内訳**: キャプチャ 630ms（domain-a.md の実測レンジ 598〜660ms と整合）・base64
  29116 文字（≈21.8KB）。vision ask #1（cold・画像込み初回）は TTFT 4824.2ms / ask 往復
  6798.1ms。ask #2〜5（テキストのみ・warm）は TTFT 1226.2〜3068.7ms / ask 往復
  3067.3〜5641.2ms（s1-first-light.md の warm レンジと概ね同じ桁）。
- **(c) input_tokens 推移 + cache 観測**: `input_tokens` は 5 ask とも一定（常に 2）。代わりに
  **`cache_read_input_tokens` が 0→1184→1333→1492→1692 と単調増加**した。**prompt caching が
  常駐セッション内で明確に効いており、画像込み履歴の再送コストは cache-read として計上される**
  ことを実測で確認（棚卸し §2-3 未確定 (a) の解消）。`cache_creation_input_tokens` も ask ごとに
  発生（149〜242）。TTL は `ephemeral_1h_input_tokens` にのみ値が乗り `ephemeral_5m_input_tokens`
  は常に 0 だった。

### 9-3. node --test 無退行確認

`cd apps/soul/agent && node --test`（タイムアウト 300s 付き）を実行し、C-impl 完了時点のベースライン
411 テストが無退行であることを確認した:

```
# tests 411
# pass 411
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

後半は新規テストを追加していない（実射スクリプト + docs のみのフェーズのため・数値は前半 §8 と
同一）。

### 9-4. 器コード不変・後始末の自己確認

- `git diff --stat -- apps/runtime-player packages` / `git diff --stat -- pnpm-lock.yaml
  apps/soul/agent/package.json` はいずれも出力なし（差分ゼロ）。
- 新規追加は `apps/soul/agent/scripts/observe-vision.mjs` と `discussion/` 配下のドキュメント
  （`experiments/s5-vision.md`・`apps/soul/README.md` への追記・`waves/s5/human-gate-procedure.md`・
  `waves/s5/s5-followup.md`・本ファイルへの追記）のみ。`.tmp/facex-*`・`src/eyes/**`・
  `src/mind/fire-orchestrator.mjs`/`llm-session.mjs`・前半が触ったファイル（cockpit 系）は一切
  改修していない（import のみ）。
- **画像はディスクへ一切書いていない**（`observe-vision.mjs` は `jpegBase64` を変数保持のみ・
  ログにも先頭文字列を出さない設計・キャプチャ元の一時テキストファイルはマーカー本文であり画像
  ではない）。
- **実行後の残留プロセス確認**: `Get-Process notepad` を実行し、該当プロセスが存在しないこと
  （非 0 終了コード＝該当なし）を確認した。

### 9-5. 成果物パス（後半が新規作成/追記したもの）

| 種別 | パス |
|---|---|
| 実 SDK 観測スクリプト | `apps/soul/agent/scripts/observe-vision.mjs` |
| 実験記録 | `discussion/ai-cohost/experiments/s5-vision.md` |
| docs（README 追記） | `apps/soul/README.md`（「S5: 目が開く（視覚発火）」節を追記） |
| 人間ゲート手順書 | `discussion/ai-cohost/implementation/waves/s5/human-gate-procedure.md` |
| followup 台帳 | `discussion/ai-cohost/implementation/waves/s5/s5-followup.md` |

### 9-6. §質問（後半 Gnome から Orch / レビューへの申し送り）

1. **VISION_INSTRUCTION_TEXT をコピーして使った判断**: `fire-orchestrator.mjs` 内部の
   `VISION_INSTRUCTION_TEXT` は非 export のため、`observe-vision.mjs` は同一文字列をスクリプト内に
   コピーして使った（Domain B のコードを改修して export を増やすのは「Domain A/B/C-impl のコードは
   改修せず import して使うだけ」という鉄の規律に抵触すると判断したため）。文字列の重複が将来の
   ドリフト源になりうる（fire-orchestrator.mjs 側でこの文言を変更しても observe-vision.mjs は
   追随しない）。次にこの文言を変更する機会があれば、両者を同期するか、observe 系スクリプトが
   読める形（export 済み定数）に昇格するかを検討してほしい。
2. **input_tokens 単調増加という当初想定が実測で覆った点**: wave-plan・棚卸しの文面は
   「input_tokens の ask 毎推移」を主要な観測項目として指定していたが、実測では
   `input_tokens` 自体は一定（常に 2）で、代わりに `cache_read_input_tokens` が単調増加した
   （§9-2 (c)）。これは prompt caching が s1 計測時（cache フィールド無し）から今回までの間に
   有効化された、または当時から効いていたが観測対象に含めていなかった、のどちらかと推測される
   （このドメインでは原因の特定はしていない）。s1-first-light.md との整合性（両者は同じ
   `createLlmSession` 経路を使っているはずなのに usage の形が異なって見える）を疑問点として
   記録しておく——s6 以降で会話管理（転写バッファ・context 制御）を扱う際に参照してほしい。
3. **人間ゲートの実施は未着手のまま**: §9 は機械ゲート相当の実 SDK 確認であり、
   [human-gate-procedure.md](human-gate-procedure.md) の実ゲーム窓での視認は依然としてユーザーの
   作業として残っている。wave の完了判定（人間ゲート合格）はこの Domain の範囲外。
