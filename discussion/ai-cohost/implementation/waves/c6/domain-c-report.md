# C6 Domain C 完了報告: 最終統合(モノレポ検証・無変更確認・docs更新・比較ゲート手順) (`cohost-c6-final-integration`)

> 実装者: Gnome(Orch-Sylph からのサブエージェント委任)。2026-07-12。
> スコープ: モノレポ検証・無変更確認・関連 docs 更新・比較ゲート手順の整備。**Domain A/B の実装ロジックは無変更**(統合検証のみ)。clean review は別の Review-Sylph が行う。

## 1. モノレポ検証(生結果)

作業ツリー全体(Domain A+B の未コミット差分が同居)に対して実行。

### typecheck
- `cd apps/runtime-player && pnpm run typecheck`(`tsc --noEmit -p tsconfig.json`)→ **pass(0 error)**。

### test:unit(全体)
- `cd apps/runtime-player && pnpm run test:unit` → **137 files passed / 2 failed、904 tests passed / 2 failed**(Duration 11.63s)。
- **失敗2件の全列挙と分類**(いずれも既知 baseline・触らない):
  1. `src/main/broadcast-source/browser-source-server.test.ts` > "accepts the not-loaded response shape"(150:27)。
  2. `src/stage/browser-source/browser-source-server-message.test.ts` > `readBrowserSourceRuntimeExportResponse` > "accepts the not-loaded response shape"(216:9)。
  - **原因**: 両者とも期待 shape に `effectiveDynamicsTuning: null` が増えている差分(`- Expected / + Received` が `effectiveDynamicsTuning` 1 キーのみ)。**browser-source 系・`effectiveDynamicsTuning` 由来で control-channel と完全無関係**。Domain A 報告 §4・Domain B 報告 §4 が実装前 baseline として記録済み。C6 差分は 1 件も新規失敗を生んでいない(control-channel/speech-timeline の全テストは pass)。

### check:source(root)
- `pnpm run check:source`(`scripts/check-source-organization.mjs`)→ **違反1件のみ = `apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint`**。
  - これは **既知 C3 baseline の1件**(physiology barrel-only)。**新規違反ゼロ**(control-channel の追加ファイル 4 本・変更 13 本は違反を1件も足していない)。

### check:soul-zone(root)
- `node scripts/check-soul-zone-boundary.mjs` → **pass**(`1248 source files scanned; no 器→魂 imports and no 魂→器 code imports`)。参照ドライバ拡張は依存ゼロ .mjs のまま(`readFileSync` のみ)、境界侵犯なし。

### 既知 baseline のまとめ(触っていない)
- **browser-source 系2件**(`effectiveDynamicsTuning` 由来)+ **check:source の C3 既存1件**(physiology/index.ts barrel-only)。この3件以外の失敗・違反は無い。

## 2. 無変更確認(git 機械確認)

`git status --short` / `git diff --name-only` で作業ツリー全体を棚卸し。**C6 の変更は control-channel + reference-driver + discussion に完全限局**(下記)。

**変更(tracked, 13 ファイル)**: すべて `apps/runtime-player/src/main/control-channel/`(12)+ `apps/soul/reference-driver/reference-driver.mjs`(1)。
**新規(untracked)**: control-channel 配下 4 本(`channel-intent-speech-payload-schema.json`・`reference-driver-speech-timeline.test.ts`・`speech-timeline-state.ts`・`speech-timeline-state.test.ts`)+ `discussion/ai-cohost/implementation/reviews/c6/`・`waves/c6/`。

**保護対象の diff ゼロ個別確認**(`git diff --stat` が空 = 無変更):
- `apps/runtime-player/src/main/physiology/` 配下 → **無変更**(生理 golden・生成器の純度)。
- `apps/runtime-player/src/main/live-mapping/headless-slot-resolver.ts` → **無変更**(リゾルバ)。
- Editor(`apps/editor/`)→ **無変更**。package-format / Runtime Export schema → 変更ファイル一覧に不在=**無変更**。`pnpm-lock.yaml` → **無変更**(lockfile)。
- 心臓 seam: `apps/runtime-player/src/main/role-composition/autonomous-frame-heart.ts` / `input-subsystem.ts`(実パス確認済み)→ **無変更**(merge seam/cadence)。
- physiology golden テスト(`physiology-generator.test.ts`・`blink-behavior*.test.ts`・`gaze-behavior.test.ts`・`posture-behavior.test.ts`・`head-behavior.test.ts`・`physiology-coupling.test.ts`・`physiology-config.test.ts`・`deterministic-noise.test.ts`)・リゾルバテスト(`headless-slot-resolver.test.ts`)・トラッキング経路テスト(`runtime-parameter-frame.test.ts`・`runtime-parameter-frame-equivalence.test.ts`)は**ソース無変更 & §1 の test:unit で pass**(137 pass files に含まれ、失敗は browser-source 系2件のみ=これらは全て通過)。
- `apps/soul` に package.json 不在: `find apps/soul -name package.json` → **空(不在)**。
- 実行時 role 分岐: `git diff | grep -E "role ===|if \(role" ...` → **一致ゼロ**(C6 差分に `if (role === ...)` 等のロール分岐は無い)。

## 3. 更新した docs

1. **`discussion/ai-cohost/implementation/orchestration/c6-wave-plan.md`** §1 Status: 「Ready to launch」→「**実装完了(Domain A/B 合格、Domain C 統合)**」。機械ゲート充足・最終審=比較ゲートはユーザー人間ゲート待ち・各ドメイン報告へのリンク・**オープン項目(後着置換 direction(a) の delete vs release=Undine 裁定待ち)**を明記(決着させていない)。
2. **`discussion/ai-cohost/architecture/c6-mouth-phoneme-timeline.md`** §7 に §7.1「実装後の状況」を追記: §7 の留保に対し**機械ゲート(凸恒等・再調音ディップ・undershoot・512拒否・無退行)が実装・検証で満たされた事実**を短く記録。**比較ゲート(§5 二体並置)は未実施=ユーザー人間ゲート待ち**と明記。オープン項目 direction(a) も記載。
3. **`discussion/ai-cohost/implementation/waves/c6/c6-comparison-gate.md`**(新規): 比較ゲート実運用手順(§4 で詳述)。

**発見したドキュメント矛盾(黙って直さず列挙・要判断)**:
- wave計画 §8 Acceptance Criteria の「既知baseline=**Wave21** browser-source系2件」の **"Wave21" ラベルが不確実**。実測では失敗2件は `effectiveDynamicsTuning: null` 差分(dynamics-tuning 由来)であり、Domain A 報告 §4 も「初回 Wave21 としたが不確実——dynamics-tuning コミット `4627bbd` 由来の疑い、ラベルは保留」と記録済み。**実害なし**(分類=browser-source 系 baseline は確定事実)だが、§8 の "Wave21" 表記は正確でない可能性。修正は判断が要るため未修正で報告(命名の正は Orch-Sylph/Undine が決めるべき)。
- 棚卸し §4 が挙げた設計討議のギャップ(相補式未記載・タイムライン長上限の言及なし・attack フィールドの有無・母音経路の新設不要)は、すべて設計 §7 の裁定と Domain A/B 実装で解消済み。**新たな未解消矛盾は発見せず**。

## 4. 比較ゲート手順ファイル

**パス**: `discussion/ai-cohost/implementation/waves/c6/c6-comparison-gate.md`(domain-c-report からもこのパスを参照)。実コード(`reference-driver.mjs`・`channel-url.ts`・`channel-server.ts`・`channel-page.tsx`・`mapping-page.tsx`)から起動コマンド・URL 取得法を抽出。

**起動コマンド要旨**:
- **(a) トラッキング側実発話**: 本番 Runtime Export モデルをロード → コントロールウィンドウ **Mapping ページ**の「**Vowel lipsync**」トグル(`VowelLipsyncToggle`、モデルが母音リグを持つ `vowelLipsyncSupported` 時に出現)を **ON** → ユーザーが「これじっさいのところどうなってるの」を実発話。
- **(b) 自律側ドライバコマンド**:
  - dry-run(WS 不要): `node apps/soul/reference-driver/reference-driver.mjs --scenario=speech --print-timeline`(15 モーラ列を印字して exit 0)。
  - live 送信: `node apps/soul/reference-driver/reference-driver.mjs "<ws-url>" --scenario=speech`。
  - **`<ws-url>`(token 込み)取得**: 自律ホストの **Channel ページ**で「**Open Channel**」→ **Endpoint** 行に `ws://127.0.0.1:<port>/channel?token=<token>`(`createControlChannelWebSocketUrl`、既定ポート例 17310)→「**Copy Channel URL**」でコピー → ドライバ位置引数に貼る。ドライバは `loadContract()` で契約 JSON を読み `supportedKinds` に `intent.speech` を自己照合。
- **テストモデル前提**: ロードするモデルが `mouth.vowel.a/i/u/e/o` + `mouth.open` を external-input リグに持つこと(auto-mapping が target 一致で `enabled`。無いと自律側の母音書込が `slotNotWritable`)。裁定 7 でテストモデル = ユーザー本番 Runtime Export。
- **観察 4 点**: ①並置(b が a と同種の生き物か)/②「のところど」o×5 で拍ごとに動くか(再調音ディップ)/③終端で口がすっと閉じるか(release)/④途中 kill で口が閉じ呼吸だけ残るか(切断 releaseAll)。

## 5. 裁量判断・escalate / 質問

**裁量判断**:
1. docs 更新は最小限・事実ベースに留めた。wave計画は §1 Status のみ、設計は §7 に §7.1 追記のみ(既存記述は改変せず追記で対応)。
2. 比較ゲート手順は「機械ゲートは済・人間ゲートは未実施」の切り分けを明記し、機械が保証できる範囲(性質)と保証できない範囲(生きて見えるか)を分離した。

**escalate / オープン項目**:
- **後着置換 direction(a)(Undine 裁定待ち)**: `setSpeech` 時の口 per-slot 曲線の **delete vs release**(Domain A 報告 §5-5)。Domain C は**触らず現状維持**(現状 delete で専有、口 idle の常況では連続)。裁定は Undine の領分。docs にオープン項目として明記済み(勝手に決着させていない)。
- **escalate なし**(検証・無変更確認は全て想定通り。`pnpm install` 不要=依存解決済みのまま検証できた)。

**質問(Orch-Sylph へ)**:
- wave計画 §8 の "Wave21" ラベル(§3 の矛盾)を "dynamics-tuning 由来" 等へ正すか、それとも "browser-source 系 baseline" とだけ表記するか。実害はないため本ドメインでは未修正。
- clean review(別 Review-Sylph)の後、コミット可否と後着置換 direction(a) 裁定の取り込み順は Orch-Sylph の判断待ち。

## 6. 規約遵守の自己申告

- `pnpm install` **不使用**(回避工作なし)。依存追加なし。
- **`apps/soul` に package.json・依存を置いていない**(`find` で不在確認)。
- **無変更を維持**: Editor・package-format・Runtime Export schema・lockfile・`headless-slot-resolver.ts`・`physiology/`・心臓 seam・**Domain A/B の実装ロジック**。docs 更新は §3 の範囲(wave計画 §1・設計 §7.1・比較ゲート新規)のみ。
- 後着置換 direction(a) を**決着させていない**(Undine 裁定待ちとして明記のみ)。
- 実行時 role 分岐を**新設していない**(grep で C6 差分に不在を確認)。拒否コードを足していない。無関係な既存差分の revert なし。変更は control-channel + reference-driver + discussion に限局。
