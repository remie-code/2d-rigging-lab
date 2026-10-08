# Wave106 Domain A — Design / Development レビュー（Review-Sylph）

> レーン: Design / Development（3レーンの2）。命名の完全適用・廃止フィールドの完全撤去・不変であるべき枠組みの保全を、grep と diff で独立検証。
> 呼び出し元: Orch-Sylph（`wave106-core-replacement`）。
> オラクル: `discussion/design/dynamics-world-frame-chain.md` §4（スキーマ）・§5（命名表）・§7（validator 改廃）。
> 検証方式: Gnome 報告に依存せず、対象ファイル・grep・`git diff HEAD` を自分で読んで独立検証。

## 判定: **要修正（軽微・非ブロッキング 2件）**

packages 本体 src の**命名・廃止フィールド撤去・スキーマ形状・境界・枠組み保全は全て設計 §4/§5/§7 通りで合格**。ただし §7 validator 改廃の一部（診断カタログ）と evidence 命名の一部（テスト fixture の evaluatorVersions）に**旧名/旧ルールの残置が2件**ある。いずれも tsc/テストは通る（実行時破綻はしない）が、§5 命名表・§7 改廃の完全適用という設計要件には未達。詳細は末尾 §要修正一覧。

---

## 1. 命名表 §5 の各項目の適用確認（grep 結果）

| 対象 | 新名（§5） | 適用箇所（本体 src、非テスト） | 判定 |
|---|---|---|---|
| schemaVersion | `dynamics-file-v3` | `package-format/src/model-files.ts:353`（`z.literal`）、`authoring-core/src/{package-document-from-authoring-session.ts:42,102, package-document-model-files.ts:45, tutorial-mini-model-seed.ts:181}` | 合格 |
| solver 契約 | `runtime-dynamics-chain-v1` | `package-format/src/runtime-export.ts:132`、`authoring-core/src/runtime-export-materialization.ts:634` | 合格 |
| capability | `dynamics-chain-solver-v1` | `package-format/src/runtime-export.ts:168`、`authoring-core/src/runtime-export-materialization.ts:269` | 合格 |
| solverKind | `worldFrameChainV1` | `runtime-core/src/{snapshot.ts:123,507, runtime-options.ts:18,25, tutorial-evidence-summary-schema.ts:191}` | 合格 |
| stateSummary | `{particleCount, maxParticleSpeed, tipAngleLocalDeg}` | `runtime-core/src/snapshot.ts:131-133,513-515`、`contracts/src/runtime-diff.ts:81-86`（before/after）、`runtime-core/src/snapshot-comparison.ts:68-104` | 合格 |

**旧名の本体 src（非テスト）残置ゼロの証跡**: `grep -E "additivePendulumV0|dynamics-file-v2|runtime-dynamics-pendulum-v1|dynamics-pendulum-solver-v1"` を `packages/**/src/**/*.ts` に対して実行 → 本体 src（非 `.test.ts`）ヒット **0件**。

テスト側の残置は指示通り仕分け:
- `package-format/src/package-document.test.ts:191-193, 199-220` の `dynamics-file-v2` / `pendulums` / `influencePercent` / `invert` / `normalization` / `strength` → 「retired フィールドを reject する意図的テスト」（`it("rejects the retired dynamics-file-v2 schemaVersion")` / `it("rejects payloads carrying retired pendulum / normalization / strength fields")`）。**残置が正**。
- `validator-core/src/{validator-core.test.ts:387, rig-control-runtime-evidence.test.ts:752, rig-control-semantic.test.ts:674, mask-composition-diagnostics.test.ts:488}` の `evaluatorVersions.dynamics: "additivePendulumV0"` → **旧名残置（要修正#2、下記）**。

---

## 2. 廃止フィールド撤去の grep 結果（残置ゼロの証跡 / 残置箇所）

対象: `reactionSpeed` / `convergenceSpeed` / `influencePercent` / `normalization`（dynamics 文脈）/ `previousSource` / `previousSourceVelocity` / `angularVelocity` / dynamics output の `strength` / `pendulums` / `invert`（dynamics 文脈）。範囲: `packages/**/src/**/*.ts`。

| フィールド | 本体 src（非テスト）残置 | 判定 |
|---|---|---|
| `reactionSpeed` / `convergenceSpeed` | 0件（テスト `package-document.test.ts:219` の reject テストのみ） | 撤去済 |
| `influencePercent` | 0件（同上 `:214`） | 撤去済 |
| `previousSource` / `previousSourceVelocity` / `angularVelocity` | 0件 | 撤去済 |
| `pendulums` | 0件（コメント言及のみ: `model-files.ts:185` "successor of the old single-element pendulums array"、`payloads/dynamics.ts:9`、`runtime-graph-dynamics.ts:7` — いずれも歴史的言及で残置ではない） | 撤去済 |
| dynamics `normalization` | 0件（`render-software/src/raster/texture-sampler.ts:23` の `normalization` はテクスチャ正規化コメントで dynamics 無関係、除外） | 撤去済 |
| dynamics output `strength` / `invert` | 0件（`package-document.test.ts:215,220` の reject テストのみ） | 撤去済 |

**状態側（`contracts/src/runtime-state.ts`）**: `RuntimeDynamicsGroupStateSchema = { particles: Array<{x,y,px,py}>, tick, resetCounter }`（15-19行）へ完全移行。`angle` / `angularVelocity` / `previousSource` / `previousSourceVelocity` 消滅を確認。§4 末尾通り。

**注記（要修正#1）**: `validator-core/src/check-catalog.ts` に `dynamics.normalizationInvalid`（1668）が**カタログ定義として残存**。これはフィールド撤去の漏れではなく §7 validator 改廃の漏れ（下記 §3・§要修正#1）。

**レーン外の参考事実（packages 外・報告のみ）**: `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:384,467` に旧ノブ前提の editor ツール診断 `dynamicsTool.normalizationInvalid` / `dynamicsTool.outputStrengthZero` が残存。私のレーン（packages 本体 src）の対象外だが、廃止フィールド（`normalization`/`strength`）に依存する旧コードが editor に残っている事実として Orch へ申し送る（Domain A の packages 範囲か別ドメインかは Orch 判断）。

---

## 3. §7 validator 改廃の実装照合

**実装 `packages/validator-core/src/validators/dynamics-semantic.ts` は §7 に完全準拠（合格）**:

| 区分 | ルール | 実装箇所 | 判定 |
|---|---|---|---|
| 新設4 | `chainSegmentsInvalid`（空/非正、blocking） | `dynamics-semantic.ts:103-125`（`severity: "blocking"`） | 合格 |
| | `outputSegmentIndexOutOfRange`（blocking） | `:127-133, 335-360`（`severity: "blocking"`） | 合格 |
| | `zeroInputScale`（warning） | `:166-176`（`severity: "warning"`） | 合格 |
| | `outputScaleZero`（warning） | `:178-189`（`severity: "warning"`） | 合格 |
| 廃止3 | `normalizationInvalid` / `invalidPendulumCardinality` / `invalidOutputCardinality` | 実装に**不在**（grep 0件） | 合格 |
| 改定1 | `unstableSettings` 新基準 `damping>60 \|\| L<0.1 \|\| N>16 \|\| gravityScale>10` | `:203-225`（4条件の論理和を実装通り） | 合格 |
| 維持6 | `inputMissing` / `driverMissing` / `outputMissing` / `outputTargetDuplicate` / `runtimeEvidenceMismatch` / `outputLimitTooSmall` | `:92-101`（inputMissing）/`:282-305`（driverMissing）/`:307-333`（outputMissing）/`:362-387`（outputTargetDuplicate）/`:437-458`（runtimeEvidenceMismatch）/`:191-200`（outputLimitTooSmall） | 合格 |

**ただし診断カタログ `packages/validator-core/src/check-catalog.ts` は §7 未反映（要修正#1）**。実装 validator (`dynamics-semantic.ts`) はカタログを参照せず（`grep "check-catalog"` = 0件）、テスト (`dynamics-semantic.test.ts`) もカタログ整合性を検証しないため、tsc/テストは通る。しかしカタログは checkId レジストリ（診断の正典、`list(profile)` でプロファイル別一覧を返す）であり、以下の不整合が残る:

- **廃止すべき旧ルールが残存**: `dynamics.invalidPendulumCardinality`（1628、"v0 group must contain exactly one pendulum"）、`dynamics.invalidOutputCardinality`（1636、"v0 group must contain exactly one output"）、`dynamics.normalizationInvalid`（1668、"min < center < max"）。
- **旧名ルールが残存**（実装では新名）: `dynamics.zeroInputInfluence`（1676）→ 実装は `zeroInputScale`、`dynamics.outputStrengthZero`（1684）→ 実装は `outputScaleZero`。
- **新設4ルールが未登録**: `chainSegmentsInvalid` / `outputSegmentIndexOutOfRange` / `zeroInputScale` / `outputScaleZero` がカタログに不在。
- **旧文言残存**: `dynamics.inputMissing`（1625、"v0 additive pendulum group"）、`dynamics.unstableSettings`（1705、"pendulum coefficients"）。

これは §7「validator ルールの改廃」の一部欠落。両 Gnome 報告のファイル一覧・改廃対応表（Gnome-2 §2）はいずれも `check-catalog.ts` に言及しておらず、**どちらの Gnome も未更新**（担当漏れ）。実行時消費先は非テスト src に無く（`createCheckCatalog`/`defaultCheckCatalog`/`.list()` の grep は全てテスト + 定義元のみ、apps でも消費なし）、影響は「診断レジストリが実装とずれる」に留まるため**非ブロッキング**だが、§7 完全適用の観点で要修正。

---

## 4. 枠組み不変の確認

- **`parameter-resolution.ts` 加算合成算術**: `git diff HEAD -- packages/runtime-core/src/parameter-resolution.ts` を精査。加算合成の核は不変を確認:
  - `baseValue = clamp(authoredOrDefault, min, max)`（46行）
  - `rawEffectiveValue = baseValue + (outputOffset?.offset ?? 0)`（未変更）
  - `effectiveValue = clamp(rawEffectiveValue, min, max)`（58行）
  - `clamp = Math.min(Math.max(value, min), max)`（116行、未変更）
  - diff の変更は (a) `getDynamicsOutputOffsetForParameter` の署名に `graph` / `authoredParameterValues` を追加、(b) `createEnabledDynamicsByOutputParameterId` を `outputs[0]` 単一 → 全 outputs 走査（裁定#3 複数出力解禁）へ。**算術（base+offset の再クランプ）は一切変更なし**。設計 §3.5「加算合成は不変。変更は offset 算出が graph/authoredValues を受け取る点のみ」と整合。合格。
- **`runtime-core.ts` advanceRuntimeState / 固定ステップ**: `git diff HEAD -- packages/runtime-core/src/runtime-core.ts` = **空**。`advanceRuntimeState`・`fixedStepMs`/`maxSubSteps`/アキュムレータ機構は無変更を確認。合格。
- **runtime-export スキーマ共有（裁定#6）**: `runtime-export.ts:510` = `export const RuntimeExportDynamicsGroupSchema = DynamicsGroupSchema;`（`.strict()` 等の再定義なし、`= DynamicsGroupSchema` の同一維持）。裁定#6 通り。合格。

---

## 5. 境界非緩和の確認

設計 §4 のスキーマ制約が緩められず実装されているか、`model-files.ts`（v3 スキーマ）と `payloads/dynamics.ts`（operation payload）で照合。

| 制約（§4） | `model-files.ts` | `payloads/dynamics.ts` | 判定 |
|---|---|---|---|
| segmentLengths min1・各 finite positive | `:188` `z.array(z.number().finite().positive()).min(1)` | `:30` 同一 | 合格 |
| damping ≥0（nonnegative） | `:189` `z.number().finite().nonnegative()` | `:31` 同一 | 合格 |
| gravityScale ≥0 | `:190` 同上 | `:32` 同上 | 合格 |
| segmentIndex int ≥1（既定1） | `:197` `z.number().int().min(1).default(1)` | `:38` 同一 | 合格 |
| output limit ≥0 | `:199` `z.number().finite().nonnegative()` | `:40` 同一 | 合格 |
| rootOffset 既定 {0,0} | `:187` `Vec2Schema.default({x:0,y:0})` | `:29` 同一 | 合格 |
| inputs / outputs min1 | `:208,210` `.min(1)` | payload は optional min1（部分更新のため妥当） | 合格 |
| scale finite（符号=反転） | input `:181`, output `:198` `z.number().finite()` | `:18,39` 同一 | 合格 |

境界の緩和は無し。設計 §4 通り。`authoring-core/src/runtime-graph-dynamics.ts` の DTO→Normalized 射影も新形状の構造的コピー（inputs.scale / chain / outputs.segmentIndex+scale+limit）で、廃止フィールド・旧名なしを確認。合格。

Explore 委任で別途検証した以下12ファイルも全件合格（廃止フィールド残置なし / 旧名残置なし / 新スキーマ形状準拠 / 境界緩和なし / schemaVersion 全て `dynamics-file-v3`）:
`operation-core/src/payloads/dynamics.ts`, `operation-core/src/operations/{create,update}-dynamics-group.ts`, `authoring-core/src/{runtime-graph-dynamics, dynamics-mutations, runtime-export-materialization, tutorial-mini-model-seed, package-document-from-authoring-session}.ts`, `runtime-core/src/{normalized-runtime-graph, state-compatibility, initial-state}.ts`, `ai-interface/src/ai-codex-proposal-operation-catalog.ts`。

---

## 要修正一覧

いずれも**非ブロッキング**（tsc error 0・dynamics テスト green・実行時破綻なし）だが、§5 命名表・§7 改廃の完全適用に未達。

### 要修正#1（§7 validator 改廃の一部欠落）: `packages/validator-core/src/check-catalog.ts`
診断カタログ（checkId レジストリ）が §7 未反映。両 Gnome とも未更新（担当漏れ）。
- 追加すべき新設4: `chainSegmentsInvalid`(blocking) / `outputSegmentIndexOutOfRange`(blocking) / `zeroInputScale`(warning) / `outputScaleZero`(warning)。
- 削除すべき廃止3: `dynamics.invalidPendulumCardinality`(1628) / `dynamics.invalidOutputCardinality`(1636) / `dynamics.normalizationInvalid`(1668)。
- 改名すべき旧名2: `dynamics.zeroInputInfluence`(1676)→`zeroInputScale`、`dynamics.outputStrengthZero`(1684)→`outputScaleZero`（実装 validator は新名を発火）。
- 旧文言是正: `inputMissing`(1625 "v0 additive pendulum")・`invalidPendulumCardinality`/`invalidOutputCardinality`(1633/1641 "v0 ... exactly one pendulum/output")・`unstableSettings`(1705 "pendulum coefficients")。
- 影響範囲: 実装 validator はカタログを参照しないため実行時影響は「レジストリと実装のずれ」のみ。ただし catalog が診断の正典であり、実装が発火する `chainSegmentsInvalid` 等がレジストリに存在しない状態は §7 不履行。

### 要修正#2（§5 命名の一部残置）: fixture の evaluatorVersions
4テストファイルの `evaluatorVersions.dynamics: "additivePendulumV0"`（旧 solverKind）が残置。§5 では solverKind は `worldFrameChainV1`。
- `packages/validator-core/src/validator-core.test.ts:387`
- `packages/validator-core/src/rig-control-runtime-evidence.test.ts:752`
- `packages/validator-core/src/rig-control-semantic.test.ts:674`
- `packages/validator-core/src/mask-composition-diagnostics.test.ts:488`
- tsc/テストを通る理由: これらが消費する `snapshot.ts:166` の `evaluatorVersions: z.record(z.string(), z.string())` は緩い string record で、`RuntimeEvaluationOptionsSchema`（`runtime-options.ts:18` の `z.literal("worldFrameChainV1")`）とは別経路。string なので parse も通る。
- 影響: 実行時破綻なしだが、evidence 内に旧 solverKind 文字列が残り §5 命名表と不整合。Gnome-2 の group1 機械置換（schemaVersion v2→v3）が evaluatorVersions 側の旧名までは拾えていない漏れ。

---

## 付記: 私のレーンで確認した「合格」の芯

- 命名表 §5 の5項目すべて本体 src で正しく適用、旧名の本体 src 残置ゼロ。
- 廃止フィールド（pendulums/reactionSpeed/convergenceSpeed/influencePercent/dynamics normalization/output strength/invert/angle/angularVelocity/previousSource/previousSourceVelocity）の本体 src 残置ゼロ、状態は particles 化完了。
- 枠組み不変: parameter-resolution 加算合成算術不変、advanceRuntimeState/固定ステップ diff 空、runtime-export スキーマ共有（裁定#6）同一維持。
- 境界非緩和: segmentLengths min1+positive、damping/gravityScale/limit ≥0、segmentIndex int≥1 が §4 通り、model-files と payload で一致。
- 残る2件（check-catalog §7 未反映・fixture evaluatorVersions 旧名）は非ブロッキングだが完全適用未達につき要修正。
