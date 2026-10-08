# S5 Domain C レビュー（design レーン）: 操縦席結線 + 実射スクリプト + docs の設計適合

> レビュア: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph。読み取り専任。
> 対象: S5 Domain C 実装（[../../waves/s5/domain-c.md](../../waves/s5/domain-c.md)、前半 C-impl + 後半 C-verify）。
> 根拠: wave 計画 [../../orchestration/s5-wave-plan.md](../../orchestration/s5-wave-plan.md) §2・§3 Domain C /
> 棚卸し [../../orchestration/s5-planning-inventory.md](../../orchestration/s5-planning-inventory.md) §2-4（挿入点地図） /
> Domain A 契約 [../../waves/s5/domain-a.md](../../waves/s5/domain-a.md) / Domain B 契約
> [../../waves/s5/domain-b.md](../../waves/s5/domain-b.md) / 対象ファイル直接 Read + `git diff` による差分確認。
> 比較用に `observe-expressions.mjs`（S4）を直接 Read。**実 SDK は走らせていない（このレビュー自体は消費ゼロ）**。
> 実施日: 2026-07-13。

## 総合判定: **PASS**

design レーンの 6 検証項目すべて PASS。blocking なし。non-blocking 所見 1 件（domain-c.md 自身が §7 で
申し送っている複数の設計裁量点は、いずれも design 観点で妥当な判断であり確認事項に留まる）。

---

## node --test 生数字（自分で実行）

```
cd apps/soul/agent && node --test
# tests 411
# pass 411
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

domain-c.md の Claim（411/411/0、C-impl §8・C-verify §9-3 両方）と完全一致。1 回で緑（空/中断なし・
再試行不要）。

`git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json` は出力ゼロ
（自分で実行・器コード/契約/lockfile/package.json 完全不変を確認）。

---

## 検証項目（PASS/FAIL + 根拠）

### 1. エンドポイント配線の一貫性 — **PASS**

- **`POST /api/vision-target`**（cockpit-server.mjs:680-695）は `POST /api/channel`（:709-724）の写経で
  責務境界を守っている: `onSetVisionTarget` 未注入なら 503（:681-684）・title は trim して空ならクリア
  （null）・**title 自体をここで保持/ログしない**（:689 のコメントどおり）・フックへ橋渡しし
  `broadcastState()` → `snapshot()` を返すだけ。永続化実体（`settings.setVisionTarget`）を知らないという
  責務境界がコード上も貫かれている。
- **`POST /api/vision-fire`**（:696-708）は `POST /api/fire`（:656-668）と行単位でほぼ同型: busy 保護は
  orchestrator の状態機械に委譲・`fired` の真偽で 202/200 を出し分ける規約（:705）が `/api/fire`
  （:665）と完全一致。相違は `fire({ vision: true })` を渡す 1 点のみ（:703）。
- **`GET /api/windows`**（:669-679）は `listWindowsImpl`（既定 = Domain A の実 `listWindows`・
  cockpit-server.mjs:50 で import）を注入可能にしており、テスト（cockpit-server.test.mjs:936-977）は
  必ず fake 注入で実 PowerShell を一度も起動しない設計。未注入時デフォルト値の型確認テスト（:972-977）
  は「構築時に throw しない」ことのみを確認し実行はしない、とコメントで明記——テストが実機を引かない
  ことが構造的にもテストの自己申告としても一致している。常に HTTP 200 を返す設計（列挙失敗は「対象一覧が
  空」として扱う・:672-677）は Domain A の `listWindows` 契約（`{windows}` | `{error}`）を素直に写像した
  もので、致命的サーバエラーと区別する判断は妥当。

### 2. `createVisionTargetHooks` 抽出 — **PASS**

- cockpit.mjs:222-237 の `createVisionTargetHooks(settings)` は `getVisionTarget`/`onSetVisionTarget`/
  `visionTargetStatus` の 3 点セットを settings の getter/setter から作る薄い橋渡し層。`createSessionProxy`
  （cockpit.mjs:195-207・S3 追撃で main() から抽出済み）と同型の「main() から抽出してテスト可能にする」
  設計判断が繰り返し適用されており、既存の抽出パターンとの一貫性がある。
- `onSetVisionTarget` は `settings.setVisionTarget` の throw を try/catch で握って続行する
  （:227-232、`onSetChannelUrl` と同型の失敗寛容）。テスト（cockpit.test.mjs:333-341）が
  `settings.setVisionTarget` が throw する fake を注入し `assert.doesNotThrow` で固定——設計判断が
  テストで裏取りされている。
- main() 配線（cockpit.mjs:262-263, 335, 382-383）は `visionTargetHooks.getVisionTarget` を
  `fireOrchestratorFactory` へ、`onSetVisionTarget`/`visionTargetStatus` を `createCockpitServer` へ渡す
  だけで、`captureImpl` は差し替えていない（Domain A の既定実装のまま・コメントで明記）。

### 3. SSE broadcast 設計 — **PASS**

- `onVisionCaptured`（:811）→`visionCaptured`・`onUsage`（:813）→`usage` は完全新規のイベント種別で
  domain-b.md §4-1/§4-2 のペイロード形をそのまま透過（加工なし）。
- `fireVisionError` は新規イベント種別を切らず、既存 `diagnostic`（`handleDiagnostic`・:427-453）に
  `kind` フィールドを追加する形で相乗りしている。`kind: d?.kind ?? null`（:451）により、`kind` を持たない
  既存診断型（`asrFailure`/`fireError`/`expressionUnknownTag` 等）は `kind:null` になるだけで、既存の
  `diagnostic` 購読側（cockpit.html:582-598）を壊さない。この設計判断は「ゴースト行に落ちる失敗」という
  性質の共通性に基づくもので合理的——同種の拡張パターン（S3 で `tag` フィールドを追加した際の前例
  :450 コメント参照）を踏襲しており場当たり的ではない。
- `fireOrchestratorFactory` の呼び出し（:797-815）で `...hooks` を spread した上に `onVisionCaptured`/
  `onUsage` を明示的に追加する構造は、既存の `onExpression` 追加時（S4）と同型のパターンで、フック集合の
  拡張方法に一貫性がある。

### 4. UI 設計 — **PASS**

- サムネは `max-height:54px; max-width:96px`（cockpit.html:113）の CSS 制約で縮小表示のみ。
  `addVisionMarkerRow`（:372-392）は受け取った `jpegBase64` を `<img>` の `src` に直接渡すだけで、
  `localStorage`/`sessionStorage`/別要素へのコピー等の永続化経路が無い（構造的にディスク非保存の流儀を
  ブラウザ側まで貫通させている・domain-c.md §4 の主張どおり）。
- ゴースト行（:590-592）は `fireVisionError` の `kind`/`message` を表示するだけで、他の演出診断（S3/S4）
  と同じ抑制方針（過剰表示を避ける）を踏襲。
- usage 表示（:394-403 `applyUsage`）は直近 1 回分のみを `#usage-note` に上書き表示する最小実装で、
  累積グラフ・履歴保持を持たない——wave 計画 §2 裁定 6「ツマミなし」の精神と整合し、domain-c.md §7-1 で
  Gnome 自身がこの粒度を明示的に確認事項として申し送っている（design 観点では過不足のない最小実装として
  妥当）。
- **ツマミ不在の裁定を遵守**: `vision-target-select` は対象ウインドウ選択専用（:154-160）で、縮小長辺/
  JPEG 品質の調整 UI は cockpit.html のどこにも存在しない（grep で確認済み）。
- busy 中の disable（`applySoulState`:319-326）は `btn-fire` と `btn-vision-fire` を同一関数内で同時に
  制御しており、二重の防波堤（サーバ側の busy 保護 + クライアント側の disable）という既存パターン
  （S3 の `btn-fire` disable）をそのまま横展開している。

### 5. `observe-vision.mjs` の実射設計 — **PASS**

`observe-expressions.mjs`（S4・写経元）と行単位で構造比較した。

- **MAX_ASKS=5 ハードガード**（observe-vision.mjs:64, 238-241）: `measuringSession.ask` が
  `askCount>=MAX_ASKS` で同期 throw する構造は observe-expressions.mjs（:153-154）と同一。
  **リトライも 1 ask としてカウントされる**ことをコードで確認: `askWithRetry`（:247-267）の
  `for(;;)` ループは失敗/空応答のたびに `askWithTimeout(measuringSession, ...)` を再度呼び、その都度
  `measuringSession.ask` が実行されて `askCount` がインクリメントされる（リトライを「予算消費なしの
  無料再試行」として扱っていない）。実測ログ（domain-c.md §9-1）でも「実 ask は 5 回で完了・リトライは
  1 回も発生しなかった」と整合。
- **env ガード遵守**: `assertSubscriptionAuthEnv(process.env)`（:202）を `main()` 冒頭で無条件に呼び、
  バイパス経路（try/catch で握り潰す等）が無い。
- **ask タイムアウト/再試行**: `ASK_TIMEOUT_MS=90_000`・`MAX_RETRIES=3`（:66,68）は
  observe-expressions.mjs と同値・同型（`askWithTimeout`（:116-123）も `Promise.race` + `unref` の
  実装が一字一句同じパターン）。
- **画像を .jpg/.png に書かない**: `captureMarkerWindow`（:130-199）は `capture.jpegBase64` を変数保持
  のみで、`fs.writeFileSync`/`fs.writeFile` 相当の呼び出しは `tmpFile`（マーカー**本文テキスト**、
  :133）にしか使われていない（grep で `fs.write` 系呼び出しがこの 1 箇所のみであることを確認）。
  ログ出力（:173-176）も `base64Len`（数値）のみで base64 文字列自体は出力しない。
- **自起動窓の後始末**: `finally` 節（:178-196）が `windowOwnerPid` と `notepad.pid` の**両方**を
  `pidsToKill` に集めて `taskkill /F /T` する設計は、domain-a.md §6/§7-4 で報告された「spawn pid ≠
  実ウインドウ所有 pid」の実機観測を踏まえた対応になっている（Domain A の申し送りが Domain C 後半の
  実装に反映されている一貫性）。`tmpFile` も `fs.unlinkSync` で削除（:191-195）。
- **observe-expressions.mjs との一貫性**: ログ関数・`round1`・定数命名・`measuringSession` 予算ガード・
  JSON SUMMARY 出力パターンがほぼ同型で、新規に追加された `askWithRetry`/`captureMarkerWindow`/
  `cacheFieldsOf` は S5 固有の観測要件（キャプチャ後始末・cache フィールド抽出）に対応する自然な拡張。

### 6. 既存器官との一貫性 — **PASS**

- `// @ts-check` は改修/新規ファイルすべての先頭に維持（cockpit-server.mjs:1, cockpit.mjs:1,
  cockpit-settings-store.mjs:1, observe-vision.mjs:1 で確認）。JSDoc は新規オプション
  （`onSetVisionTarget`/`visionTargetStatus`/`listWindowsImpl`/`onVisionCaptured`/`onUsage` 等）すべてに
  型・意味・責務境界の注記が付いている（cockpit-server.mjs:277-306）。
- 日本語コメント密度は既存箇所と同水準（「── 見出し ──」形式のヘッダコメントを踏襲・S5 固有の追記は
  「S5「目が開く」」の接頭辞で既存コメントと区別可能に統一されている）。
- **責務境界の遵守**: Domain A（`src/eyes/**`）・Domain B（`src/mind/fire-orchestrator.mjs`・
  `llm-session.mjs`）は import/注入のみで一切改修していないことを `git status --porcelain` で確認
  （変更ファイルは cockpit 系 8 ファイル + `observe-vision.mjs` + docs のみ）。`cockpit-settings-store.mjs`
  の `writeMerged`（既存 read-modify-write）に `visionTarget` キー 1 個を足しただけで、既存の
  `lastDevice`/`lastChannelUrl` の getter/setter パターンと同型（:94-100）。

---

## non-blocking 所見

1. **domain-c.md §7 の複数の設計裁量点は design 観点でいずれも妥当**: usage 表示の粒度（直近 1 回のみ）・
   `GET /api/windows` の実機一覧取得が machine test 未検証（fake 注入のみ）・サムネ非書き込みの直接証跡が
   構造的担保に留まる・`fireVisionError` を diagnostic 拡張にした設計・`visionTargetStatus` を
   `channelStatus` と非対称にした理由（token を含まないため redact 不要）・`POST /api/vision-target` を
   タイトル文字列限定にした点（同名ウインドウの識別性は担保しない）——いずれも Gnome 自身が Orch/レビュー
   へ確認事項として明記済みで、コード自体に矛盾や設計の破綻は無い。人間ゲート/followup での確認事項として
   残すのが妥当（domain-c.md §7-2・§7-3 は実機での一覧取得確認を明示的に求めている）。

---

## blocking

なし。
