# 口数配線+コーディ語彙登録 wave Domain A レビュー — spec レーン（設計契約への適合）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph（口数配線+コーディ語彙登録 wave 実行責任者）。
> **読み取り専任**。日付: 2026-07-14。根拠: 契約文書・対象ファイル・working tree の実物・自分で実行した
> `node --test`／`git diff`／3チェック（Gnome の説明ではなく）。
> 契約の正: [../../orchestration/verbosity-vocab-wave-plan.md](../../orchestration/verbosity-vocab-wave-plan.md) §2・§3 Domain A・§4 /
> [../../orchestration/verbosity-vocab-inventory.md](../../orchestration/verbosity-vocab-inventory.md) §A-1・§A-2・§A-3 /
> [../../waves/verbosity-vocab/domain-a.md](../../waves/verbosity-vocab/domain-a.md)（Claim）。
> 対象コミット状態: Domain A は未コミット・working tree に存在。tracked 変更は既存 13 ファイルの編集のみ
> （新規ファイルゼロ）。

## 総合判定: **PASS**

wave-plan §4 の blocking 基準 1〜4（Domain A に該当する範囲）はすべて満たす。spec 検証項目 1〜4（逐条照合）
はすべて PASS。domain-a.md の全数字（706/706/0・ファイル別内訳・git diff --stat・3 チェック）を自分で
再実行・再計算し、**不一致ゼロ**で照合した。domain-a.md §3 の4件の §質問はいずれも契約違反ではなく、設計裁量
または wave 計画の既定方針への正当な言及と判定（non-blocking）。指摘は「barge-in の口数無影響について専用
テストが無い（構造的分離により実質充足・追加は任意）」の1点のみで、blocking ではない。

---

## 自分で走らせた生数字（すべて Review-Sylph が実行・タイムアウト付き・空/interrupted なし）

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s）:

```
# tests 706
# pass  706
# fail  0
```

→ **Claim（domain-a.md §4）の 706/706/0 と一致**。Orch 確定ベースライン 679 との算数も一致
（679 + 27 = 706。ベースライン 679 そのものは working tree を巻き戻せない読み取り専任の制約上、自分では
再実行していない — Orch 確定値と新規 27 本の実測差分から照合）。

個別ファイル実行（すべて自分で実行・タイムアウト 120s）:

```
node --test src/mind/fire-scheduler.test.mjs              → # tests 41 / pass 41 / fail 0
node --test src/cockpit/cockpit-server.test.mjs            → # tests 79 / pass 79 / fail 0
node --test scripts/cockpit.test.mjs                       → # tests 36 / pass 36 / fail 0
node --test src/cockpit/cockpit-settings-store.test.mjs    → # tests 28 / pass 28 / fail 0
node --test src/cockpit/view-logic/control.test.mjs        → # tests 10 / pass 10 / fail 0
node --test src/cockpit/cockpit-ui.test.mjs                 → # tests 34 / pass 34 / fail 0
```

→ **Claim §4 の内訳表と完全一致**（41/79/36/28/10/34）。差分算数の再計算: (41-32)+(79-74)+(36-30)+
(28-24)+(10-8)+(34-33) = 9+5+6+4+2+1 = **27** → 679+27=706 で一致（S7 レビューで起きたような内訳不一致は
今回ゼロ）。

**器不変・契約不変・lockfile 不変**（自分で実行）:

```
git status --short（apps/soul/agent 配下）:
  M apps/soul/agent/scripts/cockpit.mjs
  M apps/soul/agent/scripts/cockpit.test.mjs
  M apps/soul/agent/src/cockpit/cockpit-server.mjs
  M apps/soul/agent/src/cockpit/cockpit-server.test.mjs
  M apps/soul/agent/src/cockpit/cockpit-settings-store.mjs
  M apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs
  M apps/soul/agent/src/cockpit/cockpit-ui.test.mjs
  M apps/soul/agent/src/cockpit/ui/app.mjs
  M apps/soul/agent/src/cockpit/ui/control-bar.mjs
  M apps/soul/agent/src/cockpit/view-logic/control.mjs
  M apps/soul/agent/src/cockpit/view-logic/control.test.mjs
  M apps/soul/agent/src/mind/fire-scheduler.mjs
  M apps/soul/agent/src/mind/fire-scheduler.test.mjs

git diff --stat:
  13 files changed, 804 insertions(+), 39 deletions(-)
```

→ **Claim §4 の「13 files changed, 804 insertions(+), 39 deletions(-)」と完全一致**。新規ファイルはゼロ
（`??` は `.tmp/facex-*` 系と wave 文書自体のみ・不干渉対象）。

```
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json apps/runtime-player packages \
  discussion/ai-cohost/contracts apps/soul/agent/cockpit.html
→ 出力なし（EXIT=0）
```

→ lockfile・package.json・器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・cockpit.html は
**完全不変**を自分で確認した。

**3 チェック**（repo ルートで自分で実行）:

```
node scripts/check-dependencies.mjs
→ Dependency guard passed. EXIT=0

node scripts/check-soul-zone-boundary.mjs
→ Soul zone boundary guard passed: 1377 source files scanned; no 器→魂 imports and no 魂→器 code imports. EXIT=0

node scripts/check-source-organization.mjs
→ Source organization violations found:
  - apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
  EXIT=1
```

→ **Claim §4 と完全一致**。唯一の違反ファイル `apps/runtime-player/src/main/physiology/index.ts` は
`git diff --stat` で本 wave の変更に一切含まれず（diff 出力なし）、最終更新コミット日時は
`2026-07-12 07:52:00`（本 wave 開始前）— **器側ベースラインの既存違反であり本 wave 由来ではない**ことを
自分で確認した。

---

## spec 検証項目（逐条照合・PASS/FAIL + 根拠 file:line）

### 1. wave-plan §2/§3 Domain A の各要求が実装に反映されているか — **PASS**

| 検査 | 結果 | 根拠（自分で読んだ file:line） |
|---|---|---|
| (a) fire-scheduler の const→let 化 + setVerbosity(mode)/getVerbosity を setEnabled 隣に追加・3 モードの定数束を宣言テーブルとして定義・setVerbosity は束代入+残予算を新 max へリセット・createFireScheduler の初期 mode 受け口（既定 normal） | PASS | `VERBOSITY_BUNDLES`（fire-scheduler.mjs:252 開始・Object.freeze 3 モード）。`isValidVerbosityMode`（:297）。9 個の tunable を const→let 化（turnEndProbability 等 7 個 + 既存 let の silenceBudget/commentBudget 2 個）。`initialMode`（:368）= `isValidVerbosityMode(options.verbosity) ? options.verbosity : "normal"`。`currentVerbosity`（:371）。`setVerbosity`（:572、setEnabled:545 の直後に定義）は 7 let 再代入 + silenceBudget/commentBudget を新モード満額へリセット + `currentVerbosity = mode`+ `if (enabled) armSilence()`（:585・setEnabled:553 の同型写経）。`getVerbosity: () => currentVerbosity`（:599）。turnEndSilenceMs（turn 検出・const のまま）は不変。 |
| (b) inventory A-2 表の 9 値が quiet/normal/chatty で表と完全一致 | **PASS（自分で VERBOSITY_BUNDLES を読んで表と突き合わせ済み）** | quiet: turnEndProbability 0.15／turnEndRefractoryMs 15,000／silenceBaseMs 90,000／silenceJitterMs 30,000／silenceRefractoryMs 120,000／silenceBudget 3／commentProbability 0.15／commentRefractoryMs 15,000／commentBudget 15 = 表と完全一致。normal: 全 9 値が既存 export const への**参照**（TURN_END_PROBABILITY 等）＝現行値と単一の源で一致（値の二重管理なし）。chatty: 0.70／4,000／25,000／20,000／60,000／12／0.70／4,000／60 = 表と完全一致。 |
| (c) cockpit-server の POST /api/verbosity（self-fire 写経）・snapshot.verbosity・初期 mode 配線 | PASS | option 読み取り `verbosityInitialMode`/`onSetVerbosity`（cockpit-server.mjs:414-415）。`snapshot().verbosity: fireScheduler ? fireScheduler.getVerbosity() : null`（:498、selfFire:497 の隣）。`POST /api/verbosity`（:898-923）: scheduler 無し 503（:900-903 相当）→ mode 妥当性検査 400（:906-909 相当）→ `fireScheduler.setVerbosity(mode)`（:911 相当）→ `onSetVerbosity` 呼び出し（:914-920、失敗寛容 try/catch）→ `broadcastState()` + `sendJson(res,200,snapshot())`（:921-922 相当）。scheduler 生成時 `verbosity: verbosityInitialMode`（:1160、enabled の直後）。 |
| (d) cockpit.mjs の createVerbosityHooks（createSelfFireHooks 写経） | PASS | `createVerbosityHooks(settings, defaultMode="normal")`（cockpit.mjs:326、createSelfFireHooks の隣）。`resolveInitialVerbosity`（既知 3 モード以外は defaultMode フォールバック）+ `onSetVerbosity`（:336、`settings.setVerbosityMode` へ橋渡し・失敗寛容 try/catch）。生成（:404）+ `createCockpitServer` options への注入（:576-577）。 |
| (e) settings-store の getVerbosityMode/setVerbosityMode（getVisionTarget 写経） | PASS | `getVerbosityMode()`（cockpit-settings-store.mjs:148）= `asStringOrNull(readAll().verbosityMode)`。`setVerbosityMode(mode)`（:152）= `writeMerged({ verbosityMode: mode ?? null })`。既存 getVisionTarget/setVisionTarget と同型（asStringOrNull・read-modify-write）。 |
| (f) control-bar の controlled 化 + POST + title 更新 | PASS | `ControlBar` のローカル `useState("normal")` を廃止し `verbosity` prop 駆動に変更（control-bar.mjs diff）。`onChangeVerbosity`（:194、onToggleSelfFire の写経）が `POST /api/verbosity` を呼び成功時 `applySnapshot`。render で `<${VerbositySelect} verbosity=${verbosity} onChange=${onChangeVerbosity} />`（:230）。title 属性が「控えめ/ふつう/おしゃべりで自発発火の頻度が変わる（コメント応答の変化は YouTube 合流時に体感）」へ更新（旧「実配線は将来課題」から書き換え済み）。`VERBOSITY_OPTIONS` 上のコメントも「実配線済み」へ更新。 |

### 2. blocking 基準（wave-plan §4）の逐条充足 — **PASS**

| 基準 | 判定 | 根拠 |
|---|---|---|
| §4-1 器コード・契約 JSON・lockfile・package.json 完全不変・新規依存ゼロ・S1〜S7/操縦席既存挙動不変（mode 未指定で現行値） | PASS | `git diff --stat` の pathspec 確認（lockfile/package.json/器コード/契約 JSON/cockpit.html）が出力なし。normal 束が既存 export const への参照ゆえ mode 未指定時の挙動は現行値と数学的に同値（二重管理なし）。新規 import はゼロ（diff に import 追加なし）。 |
| §4-2a setVerbosity の束切替・予算リセットが純ロジックテストで固定 | PASS | fire-scheduler.test.mjs「setVerbosity: 実行時切替で束が即座に切り替わる」「setVerbosity: 予算を新モードの満額へリセットする（消費後の残予算ではなく満額）」「getVerbosity: 既定 normal・setVerbosity で変わる・未知 mode は no-op」の3本で固定（自分で全読・全緑確認済み）。 |
| §4-2b 呼びかけ（call）・comment-call・turn 検出が口数の影響を受けないことがテストで固定 | PASS | 「blocking: comment-call は口数（quiet）の影響を受けない」（予算 0・不応期無視で確実に発火）／「blocking: 呼びかけ（call）は口数（quiet）の影響を受けない」（rng 外れ値でも確実発火）／「blocking: turn 検出（turnEndSilenceMs）は口数モードに関わらず TURN_END_SILENCE_MS で不変」（quiet/normal/chatty の3モードループ）の3本で明示的に固定（自分で全読）。 |
| §4-2b barge-in が口数の影響を受けないこと | **PASS（構造的分離により充足・専用テストは無い＝non-blocking 指摘、下記参照）** | barge-in ロジックは `src/mind/barge-in.mjs`（独立モジュール）が保有し、fire-scheduler.mjs は barge-in 概念を持たない（grep 一致はコメント1箇所のみ「:474 speechCancel はスパイク棄却の retraction（barge-in gate の領分）。スケジューラは触らない」）。本 wave の diff は barge-in.mjs／barge-in.test.mjs に一切触れておらず（git status に出現せず）、706/706 全緑の中で barge-in.test.mjs も無変更のまま緑。構造的に口数束が barge-in へ触れようがないことは file:line で確認済みだが、「口数モード変更後も barge-in が正常発火する」ことを明示的に確認する統合テストは新規追加されていない。 |
| §4-2c POST /api/verbosity の server test 無退行 | PASS | cockpit-server.test.mjs に5本追加（503・妥当切替・無効 mode 400・初期 mode 反映・onSetVerbosity 永続化フック）+ 既存 selfFire テストへの `verbosity:null` 確認1箇所。全て自分で全読・79/79 緑を自分で実行確認。 |
| §4-4 3 チェック無退行・終了処理 | PASS | 3 チェック自分で再実行し Claim と完全一致（唯一の違反は器側ベースライン既存・本 wave 由来ではないことを diff で確認）。fire-scheduler.test.mjs は全テストで `sch.dispose()` 呼び出しを維持（既存規律通り）。server test は try/finally `await server.close()` パターンを維持。 |

### 3. mode 未指定=現行値の無退行 — **PASS**

- 「無退行: normal 束は既存 export 定数と完全同値・mode 未指定生成の既定は normal」テスト（fire-scheduler.test.mjs）で、`VERBOSITY_BUNDLES.normal.*` の全9値が `TURN_END_PROBABILITY` 等の既存 export const と `assert.equal` で固定されている（自分で全読）。かつ `createFireScheduler({...})`（verbosity 未指定）で `getVerbosity()` が `"normal"` を返すことも同テストで確認。
- 既存 fire-scheduler.test.mjs の明示 options（`silenceBudget`, `commentRefractoryMs` 等）が今回も numberOr/intOr の優先順位（明示値 > バンドル既定値）で生きていることを、diff のコメント（「options.x を明示指定すればそちらが優先される」）と実装（`numberOr(options.x, initialBundle.x)` の形）の両方で確認。既存テストの記述を変更せず全緑（fire-scheduler.test.mjs 41/41）であることが、この優先順位が壊れていないことの実証。
- `createFireScheduler` に `verbosity` オプションに未知値/非文字列を渡すケース（"bogus", 123, null, undefined, ""）を全て `"normal"` にフォールバックさせるテストも追加済み（自分で全読・防御的実装の固定）。

### 4. 成果物主張の正直性 — **PASS（不一致ゼロ）**

- 706/706/0（全体）・41/79/36/28/10/34（ファイル別）・13 files/804(+)/39(-)・3 チェック（passed/passed/1377 files・器側既存赤1件）— **すべて自分の再実行・再計算と一致**。
- Orch 確定ベースライン 679/679/0 との算数（679+27=706、個別差分の合計 9+5+6+4+2+1=27）も一致。
- domain-a.md §2 に記載された file:line（VERBOSITY_BUNDLES:252-289、isValidVerbosityMode:297-299、initialMode:368、currentVerbosity:371、setVerbosity:572-589、getVerbosity:599、cockpit-server.mjs の option 読み取り:414-415、snapshot:498、POST ハンドラ:898-923、scheduler 生成:1160、cockpit.mjs の createVerbosityHooks:326-343・注入:576-577、cockpit-settings-store.mjs:148-154、control-bar.mjs の VerbositySelect:103-118・onChangeVerbosity:194-213・render:230）を自分で grep して突き合わせ、**すべて記載通りの行に実在**することを確認した（±1行程度の誤差もなし）。

---

## blocking / non-blocking の分離

### blocking — **ゼロ件**

### non-blocking — 1 件（対処任意）

**barge-in の口数無影響について専用テストが無い**（wave-plan §4-2「呼びかけ・comment-call・barge-in・
turn 検出が口数の影響を受けないこと」の barge-in 部分）。実態は `src/mind/barge-in.mjs` という独立モジュール
がロジックを保有し、fire-scheduler.mjs はこの wave で barge-in 概念に一切触れていない（コメント1箇所のみ）
ため、口数束の変更が barge-in に影響しようがないことは構造的に自明であり、diff・grep で確認済み。ただし
「口数モード変更後も barge-in が正常発火する」ことを明示的に固定する統合テストは今回追加されていない。
将来 wave（S7 YouTube 実ゲート・器官統合）でのリスクは低いが、Domain B または将来の追加テスト整備時に
1本足すと保険になる（任意）。

---

## §質問（domain-a.md §3）の spec 判定 — いずれも non-blocking

| # | 質問 | spec 判定 |
|---|---|---|
| 1 | VerbositySelect という新規コンポーネントを新設した | **non-blocking（妥当な設計裁量）**。wave-plan §3 の指示は「controlled 化（selfFire pill と同型）」であり独立コンポーネント抽出を明示していないが、既存 cockpit-ui.test.mjs の規律（ControlBar/SettingsDrawer は hooks 使用のため vnode 走査で固定できない）を踏まえると、hooks 非使用の葉コンポーネントとして独立させたことは「verbosity が controlled であることをテストで固定する」要求を満たすための合理的な手段。SelfFirePill と文字通り同型であることも自分で diff・テストの両方で確認した。 |
| 2 | onChangeVerbosity（実際に fetch する部分）は直接テストしていない | **non-blocking（既存パターンの限界・新規の妥協ではない）**。既存の onToggleSelfFire も同じ制約（ControlBar 自体は hooks 使用のため vnode 走査や直接呼び出しでテスト不可）を持つことを自分で control-bar.mjs を読んで確認した。VerbositySelect の vnode テスト + verbosityPostErrorText/verbosityRequestErrorText の fixture テスト + cockpit-server.test.mjs の POST 統合テストの組み合わせで間接的に固定する設計は妥当。 |
| 3 | comment 系の実効性は untested | **non-blocking（wave 計画 §1 の既定方針どおり）**。wave-plan §1 に「コメント反応の変化はS7 YouTube実ゲート保留のため今回は体感対象外(配線はする=untested)」と明記されている。commentProbability/commentBudget/commentRefractoryMs は口数束に含めて実装され純ロジックテスト済み（getVerbosity 等のテストで confirmed）。 |
| 4 | 人間ゲート申し送り | **non-blocking（確認済み）**。domain-a.md §3-4 の記載（運転バーの口数プルダウンで自発発火頻度の体感差・次回起動時のモード復元・`cockpit-settings.local.json` の `verbosityMode` キー）は wave-plan §1 の人間ゲート定義と整合。setVerbosityMode の永続化テスト（roundtrip・他キーとの同居・corrupt JSON・unwritable path）4本を自分で全読し、記述通りの動作を確認した。 |

---

## Orch への申し送り

- spec レーンとして Domain A は wave-plan §2/§3 Domain A/§4・inventory §A-1/§A-2/§A-3 の要求を逐条で
  満たす。fire-scheduler（VERBOSITY_BUNDLES 9値×3モードの表完全一致・setVerbosity/getVerbosity・
  turn検出/name variants不変）・cockpit-server（POST /api/verbosity・snapshot・初期mode配線）・
  cockpit.mjs（createVerbosityHooks）・settings-store（getVerbosityMode/setVerbosityMode）・UI
  （VerbositySelect controlled化）のいずれも自分でソース/diff/実行結果を file:line まで確認した。
- **Claim の全数字が自分の再実行と一致**（706/706・41/79/36/28/10/34・804(+)/39(-)・13 files・3 チェック・
  1377 files）。domain-a.md 記載の file:line もすべて実ファイルと一致（誤差ゼロ）。成果物の正直性は高い。
- ベースライン 679 のみ自分では再実行していない（読み取り専任で working tree を巻き戻せないため）。
  Orch 確定値 679 と実測 +27 の算数一致（679+27=706）で照合した。
- non-blocking 指摘は1件のみ（barge-in 専用テスト不在・構造的に実質充足・対処任意）。
- 人間ゲート（口数モード切替の体感確認・次回起動時の復元）は Domain A 完了後の実ゲートとして未実施
  （wave-plan §5 choke point・このレビューの対象外）。

## §質問（Review-Sylph からの申し送り事項）

なし。判断に迷う点は見当たらなかった。
