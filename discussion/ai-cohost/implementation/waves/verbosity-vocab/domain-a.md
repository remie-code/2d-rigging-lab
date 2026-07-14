# 口数配線+コーディ語彙登録 wave Domain A: 口数モード実配線

> Status: 実装完了・機械ゲート緑（2026-07-14）。運転バーの「口数」プルダウン（控えめ/ふつう/おしゃべり）を
> 現在の no-op から fire-scheduler の定数束をモードで実行時差し替えする実配線につないだ。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/verbosity-vocab-wave-plan.md](../../orchestration/verbosity-vocab-wave-plan.md) §2・§3 Domain A・§4（blocking 基準） /
> [../../orchestration/verbosity-vocab-inventory.md](../../orchestration/verbosity-vocab-inventory.md) §A-1・A-2・A-3。

## 1. 実装/変更ファイル一覧（全て既存ファイルの編集・新規ファイルなし）

| ファイル | 役割 |
|---|---|
| `src/mind/fire-scheduler.mjs` | tunable 定数 9 個を `const`→`let` 化 + `VERBOSITY_BUNDLES`（3 モード×9 値のデータ定数）+ `setVerbosity(mode)`/`getVerbosity()` を公開口に追加。既存 export const・turn 検出・name variants は不変。 |
| `src/mind/fire-scheduler.test.mjs` | 口数モードの純ロジックテスト 9 本を追加（束切替・予算リセット・getVerbosity・blocking・turn 検出不変・無退行）。 |
| `src/cockpit/cockpit-server.mjs` | `verbosityInitialMode`/`onSetVerbosity` option 読み取り + scheduler 生成への配線 + `snapshot().verbosity` + `POST /api/verbosity`（self-fire 写経）。 |
| `src/cockpit/cockpit-server.test.mjs` | `POST /api/verbosity` の server test 5 本 + `selfFire` テストへの `verbosity:null` 確認 1 箇所を追加。 |
| `scripts/cockpit.mjs` | `createVerbosityHooks(settings, defaultMode)`（createSelfFireHooks 写経）+ 生成・`createCockpitServer` への注入。 |
| `scripts/cockpit.test.mjs` | `createVerbosityHooks` の純関数テスト 6 本を追加。 |
| `src/cockpit/cockpit-settings-store.mjs` | `getVerbosityMode()`/`setVerbosityMode(mode)`（getVisionTarget/setVisionTarget 写経・`verbosityMode` キー）。 |
| `src/cockpit/cockpit-settings-store.test.mjs` | round-trip・同居・corrupt JSON・unwritable path のテスト 4 本を追加。 |
| `src/cockpit/view-logic/control.mjs` | `verbosityPostErrorText`/`verbosityRequestErrorText`（selfFirePostErrorText/selfFireRequestErrorText 写経）。 |
| `src/cockpit/view-logic/control.test.mjs` | 上記 2 関数の fixture テスト 2 本を追加。 |
| `src/cockpit/ui/control-bar.mjs` | `VerbositySelect`（SelfFirePill と同型の hooks 非使用 controlled 部品）を新設。`ControlBar` の口数プルダウンを controlled 化（prop 駆動）+ `onChangeVerbosity`（onToggleSelfFire 写経・POST /api/verbosity）。 |
| `src/cockpit/cockpit-ui.test.mjs` | `VerbositySelect` の vnode テスト 1 本 + `settingsFromSnapshot` の `verbosity` フィールド確認を追加。 |
| `src/cockpit/ui/app.mjs` | `settingsFromSnapshot` に `verbosity` を追加 + `ControlBar` 呼び出しに `verbosity` prop を追加。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・`apps/soul/agent/package.json`・
`cockpit.html` は完全不変**（§5 で確認）。新規依存ゼロ・新規ファイルゼロ（全て既存ファイルの編集）。

## 2. 設計裁定の実装箇所（file:line）

### A-1. fire-scheduler.mjs

- **VERBOSITY_BUNDLES**（データ定数・3 モード×9 値）: `src/mind/fire-scheduler.mjs:252-289`。`normal` 束
  （:266-276）は既存 export const（`TURN_END_PROBABILITY` 等）への**参照**で定義（値の二重管理を避ける・
  無退行の鍵）。`quiet`（:254-264）/`chatty`（:278-288）はリテラル新規（inventory §A-2 の表と同値）。
- **isValidVerbosityMode**: `:297-299`（未知値判定・setVerbosity の no-op 判定と初期 mode 解決の両方で使用）。
- **既存 export const は全て不変**（TURN_END_SILENCE_MS 等 10 個・削除/改名なし）。
- **9 個の closure 束縛を const→let 化**: `turnEndProbability`/`turnEndRefractoryMs`/`silenceBaseMs`/
  `silenceJitterMs`/`silenceRefractoryMs`/`commentRefractoryMs`/`commentProbability`（:373-380）+ 既存 let の
  `silenceBudget`/`commentBudget`（:390,392）。初期値は `numberOr(options.x, initialBundle.x)` の形（:373-380,390,392）。
  `turnEndSilenceMs`（turn 検出・:362）は const のまま = モード不変。
- **初期 mode 解決**: `initialMode`（:368）= `isValidVerbosityMode(options.verbosity) ? options.verbosity : "normal"`。
  `currentVerbosity`（:371）= 初期値 `initialMode`。
- **setVerbosity(mode)**: `:572-589`（setEnabled の隣・:557-570 の直後）。未知 mode は no-op（:573）。既知
  mode は 7 個の let を再代入 + silenceBudget/commentBudget を新モードの満額へリセット（:575-583）+
  `currentVerbosity = mode`（:584）+ `if (enabled) armSilence()`（:585）。
- **getVerbosity**: 返り値オブジェクトの `getVerbosity: () => currentVerbosity`（:599）。`setVerbosity` も
  返り値に追加（:597）。JSDoc（:326-341）に追記済み。

### A-2. cockpit-server.mjs

- **option 読み取り**: `verbosityInitialMode`（:414）/`onSetVerbosity`（:415）を `selfFireInitialEnabled` の隣
  （:412 付近）に追加。JSDoc（:348-357）にも追記。
- **scheduler 生成**: `createFireScheduler({ enabled: selfFireInitialEnabled, verbosity: verbosityInitialMode, … })`
  （:1160 隣・:1158 enabled の直後）。
- **snapshot()**: `verbosity: fireScheduler ? fireScheduler.getVerbosity() : null`（:498・`selfFire` の隣）。
- **POST /api/verbosity**: `:898-923`（POST /api/self-fire の直後・POST /api/channel の手前）。scheduler 無し
  = 503（:900-903）。body.mode が非文字列/未知値なら 400 `invalid verbosity mode`（:906-909）。妥当なら
  `fireScheduler.setVerbosity(mode)`（:911）+ `onSetVerbosity` 呼び出し（失敗寛容・:914-920）+
  `broadcastState()` + `sendJson(res, 200, snapshot())`（:921-922）。

### A-3. scripts/cockpit.mjs

- **createVerbosityHooks(settings, defaultMode="normal")**: `:326-343`（createSelfFireHooks の隣）。
  `resolveInitialVerbosity`（:328-332）は記憶済み値が既知 3 モードでなければ `defaultMode` へフォールバック。
  `onSetVerbosity`（:335-341）は `settings.setVerbosityMode` へ橋渡し（失敗寛容）。
- **生成と注入**: `verbosityHooks`（:404）を生成し、`createCockpitServer` の options（:576-577）に
  `verbosityInitialMode: verbosityHooks.resolveInitialVerbosity()` + `onSetVerbosity: verbosityHooks.onSetVerbosity`
  を追加（selfFire 系オプションの隣）。**cockpit-server 側の option 名は `verbosityInitialMode` に統一**
  （cockpit.mjs 側で渡すキー名と一致）。

### A-4. cockpit-settings-store.mjs

- `getVerbosityMode()`（:148-150）/`setVerbosityMode(mode)`（:152-154）: getVisionTarget/setVisionTarget の
  写経（`asStringOrNull`・`verbosityMode` キー）。JSDoc（:26,29,73-74）にも追記。

### A-5. ui/control-bar.mjs・view-logic/control.mjs・ui/app.mjs

- **view-logic/control.mjs**: `verbosityPostErrorText`（:126-131）/`verbosityRequestErrorText`（:137-139）を
  selfFirePostErrorText/selfFireRequestErrorText の写経で追加。
- **ui/control-bar.mjs**:
  - `VerbositySelect`（:103-118）: SelfFirePill と同型の hooks 非使用 controlled 部品として新設（**設計判断・
    §3 質問1 参照**）。`value` は prop（`verbosity ?? "normal"`）駆動・`onChange` は呼び出し側ハンドラを素通し。
  - `ControlBar` の props に `verbosity` 追加（:129,132）。ローカル `useState("normal")` を廃止し、
    `onChangeVerbosity`（:194-213・onToggleSelfFire の写経）が `POST /api/verbosity` を呼ぶ。
  - render: `<${VerbositySelect} verbosity=${verbosity} onChange=${onChangeVerbosity} />`（:230）。
  - `VERBOSITY_OPTIONS` のコメント（:49 隣）と `VerbositySelect` の title 属性（:110-112）を「実配線済み」へ更新。
- **ui/app.mjs**: `settingsFromSnapshot` に `verbosity: (s && s.verbosity) ?? null`（:80）追加。`ControlBar`
  呼び出しに `verbosity=${settings.verbosity}`（:245）追加。

## 3. §質問（迷った裁定点・申し送り）

1. **VerbositySelect という新規コンポーネントを新設した（設計判断・要確認）**: タスク指示は「controlled 化
   （selfFire pill と同型）」と述べるのみで、独立コンポーネント抽出は明示していない。既存の
   `cockpit-ui.test.mjs` の規律（§10 コメント）では「ControlBar/SettingsDrawer 本体は hooks を使うため
   vnode 走査で固定できない」と明記されており、`SelfFirePill`/`FireButtons`/`KillSwitch` のように hooks
   非使用の葉コンポーネントだけが vnode 走査でテスト可能。「verbosity が controlled（prop 駆動）であること
   をテストで固定する」という要求を満たすため、口数プルダウンを `VerbositySelect` として独立させた
   （SelfFirePill と文字通り同型の構造）。この判断が意図と合うか確認を。
2. **ControlBar 内の onChangeVerbosity（実際に fetch する部分）は直接テストしていない**: 既存の
   `onToggleSelfFire`/`fireWith` も同様に、ControlBar 自体は hooks 使用のため vnode 走査や直接呼び出しで
   テストできない（既存規律の限界）。そのため「onChange で POST が飛ぶこと」は次の 3 点の組み合わせで
   間接的に固定した: (a) `VerbositySelect` の vnode テストで onChange prop が正しく素通しされること、
   (b) `verbosityPostErrorText`/`verbosityRequestErrorText` の view-logic fixture テストでエラー文言分岐、
   (c) `cockpit-server.test.mjs` の `POST /api/verbosity` 統合テストでサーバー側の受理/拒否。ControlBar 内部の
   fetch 呼び出しコード自体（`onChangeVerbosity` の実装）は、既存の `onToggleSelfFire` 同様に**手動/実ブラウザ
   検証の領分**として残る。これは既存パターンの限界であり、本 wave で新規に導入した妥協ではない旨を明記する。
3. **comment 系の実効性は untested（wave 計画 §1 の既定方針どおり）**: `commentProbability`/`commentBudget`/
   `commentRefractoryMs` は口数束に含めて実装・純ロジックテスト済みだが、人間ゲートでの体感確認は S7 YouTube
   実ゲート保留のため対象外（wave 計画の既定方針。実装漏れではない）。
4. **人間ゲート申し送り**: 全器官起動→運転バーの口数プルダウンを控えめ/ふつう/おしゃべりで切替え、自発発火
   （区切り応答・沈黙）の頻度が体感で変わることを確認してください。次回起動時に選択したモードが復元される
   ことも確認対象です（`cockpit-settings.local.json` の `verbosityMode` キー）。コメント応答の変化は
   YouTube 合流時まで確認不要です。

## 4. 機械ゲート生数字（実行済み・タイムアウト付き）

### `cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s）

```
# tests 706
# pass  706
# fail  0
```

**実装前ベースライン 679/679/0 → 実装後 706/706/0（+27・全緑）**。追加内訳（ファイル別）:

| ファイル | 実装前 | 実装後 | 追加 |
|---|---|---|---|
| `src/mind/fire-scheduler.test.mjs` | 32 | 41 | +9 |
| `src/cockpit/cockpit-server.test.mjs` | 74 | 79 | +5 |
| `scripts/cockpit.test.mjs` | 30 | 36 | +6 |
| `src/cockpit/cockpit-settings-store.test.mjs` | 24 | 28 | +4 |
| `src/cockpit/view-logic/control.test.mjs` | 8 | 10 | +2 |
| `src/cockpit/cockpit-ui.test.mjs` | 33 | 34 | +1 |
| **合計** | **679** | **706** | **+27** |

各ファイル単体実行でも全緑を個別確認済み（`node --test <file>` を 1 本ずつ実行・fail 0 を確認）。

### 3 チェック（リポジトリルートで実行・タイムアウト付き）

```
node scripts/check-dependencies.mjs
→ Dependency guard passed.
→ EXIT=0

node scripts/check-soul-zone-boundary.mjs
→ Soul zone boundary guard passed: 1377 source files scanned; no 器→魂 imports and no 魂→器 code imports.
→ EXIT=0（ベースライン 1377 files・新規ファイルなしのため件数不変）

node scripts/check-source-organization.mjs
→ Source organization violations found:
  - apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
→ EXIT=1（唯一の既知違反=器側ベースライン・本 wave の変更は全て .mjs のため source-org 検査は非対象・無退行）
```

### `git diff --stat`（器不変・依存不変の確認）

```
13 files changed, 804 insertions(+), 39 deletions(-)
```

変更ファイルは全て `apps/soul/agent/{scripts,src}/**` の既存ファイル（一覧は §1）。
`git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json apps/runtime-player packages
discussion/ai-cohost/contracts` → **出力なし**（lockfile・package.json・器コード・契約 JSON は完全不変）。
`cockpit.html` にも触れていない。新規ファイルはゼロ（`git status --short` の `??` 該当なし）。

### SDK/実マイク/実ネット不使用

全テストは fake fetch（node:http 実クライアント + 実 listen(0) loopback）/ fake clock（fire-scheduler の
`makeFakeClock`）/ 注入 RNG / fake settings のみ。実 SDK・実マイク・実 YouTube・実 whisper-server は一切
起動していない。
