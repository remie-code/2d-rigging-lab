# Wave106 Domain A — Gnome-2 実装報告（テスト本文の dynamics-v3 化 / fixtures 再生成）

> 担当: Gnome-2（opus）。dynamics v0 → 世界系 Verlet 質点チェーン（`worldFrameChainV1` / `dynamics-file-v3`）破壊的置換の **テスト本文 inline データ / payload / golden fixture を新スキーマ形状へ揃える純作業** を引き継ぎ。
> 呼び出し元: Orch-Sylph（`wave106-core-replacement`）。
> 設計オラクル: `discussion/design/dynamics-world-frame-chain.md`（§4 スキーマ / §5 命名 / §7 診断）。

## 判定: **escalate（dynamics-v3 テスト化は完了。ただし `packages/ 0 failed` は本タスク単体では到達不能）**

**dynamics-v3 スキーマ形状に起因する赤テストは、私が触った全ファイルで green 化した。** しかし完了条件 `npx vitest run packages/` の 0 failed には **到達していない**。残る 13 ファイル / 14 テストは、調査の結果 **すべて committed HEAD（`dc9fae9c`）でも失敗する既存赤であり、かつ dynamics-v3 スキーマ形状とは無関係な別要因（本体 src バグ / 別フィーチャ variants / keyform 検証 / snapshot フィールド）に起因** する。これらは「テスト本文の v3 化」では直せず、本体 src 修正（Forbidden）または別ドメイン担当を要するため escalate する。

- **`npx tsc --noEmit`（リポジトリ全体）: error 0**（私の編集で不変。packages 本体 src 非改変）。
- **私が担当した dynamics-v3 テスト: 全 green**（下記 §テスト結果）。
- **残 13 ファイルは全て HEAD 由来の非 dynamics 既存赤**（下記 §残課題の根本原因分類 + escalate）。

---

## 1. 直したテストファイル一覧と修正種別

### グループ1: `dynamicsGroups: []`（空）で schemaVersion 文字列 v2→v3 の機械置換のみ（15ファイル、`sed` 一括）
すべて green 化を確認。
- `packages/validator-core/src/binary-asset-validator.test.ts`
- `packages/validator-core/src/mask-composition-diagnostics.test.ts`
- `packages/validator-core/src/mesh-topology-diagnostics.test.ts`
- `packages/validator-core/src/parameter-keyform-package.test.ts`
- `packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
- `packages/validator-core/src/portable-bundle-integrity.test.ts`
- `packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts`
- `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts`
- `packages/validator-core/src/psd-source-profile.test.ts`
- `packages/validator-core/src/psd-structural-scaffold-diagnostics.test.ts`
- `packages/validator-core/src/rig-control-semantic.test.ts`
- `packages/validator-core/src/tutorial-readiness-validator.test.ts`（※ 機械置換 + 手動 v3 化。下記グループ2参照）
- `packages/validator-core/src/validator-core.test.ts`
- `packages/validator-core/src/viewer-evidence.test.ts`
- `packages/validator-core/src/rig-control-runtime-evidence.test.ts`（※ sed 適用済み。ただし本体 keyform 検証由来で赤のまま。§残課題）
- `packages/validator-core/src/warp-lattice-diagnostics.test.ts`（※ sed 適用済み。ただし本体 keyform 検証由来で赤のまま。§残課題）

> 注: `rig-control-runtime-evidence` / `warp-lattice-diagnostics` の 2 件は dynamics-file-v2 文字列（無関係パッケージ fixture 内）を v3 へ機械置換した。その置換自体は正しく無害だが、この 2 ファイルの赤は **keyform 検証（`keyform.unsupportedTargetProperty`）由来の別要因**であり dynamics とは無関係（HEAD でも赤）。

### 機械置換の副作用の是正（1ファイル）
- `packages/package-format/src/package-document.test.ts` — sed が「**retired v2 を reject する**」意図的 v2 テスト（`rejects the retired dynamics-file-v2 schemaVersion`）まで v3 に書換えてしまったため、当該箇所のみ v2 に**復旧**。他の同ファイル箇所は v3 chain/input/output で正。→ green（14 tests）。

### グループ2: 実データ / 診断を持つ手動 v3 化（5ファイル、すべて green）
- `packages/validator-core/src/dynamics-semantic.test.ts` — **§7 診断の全面改定**。ヘルパー `createDynamicsGroup`（pendulums→chain）/ `createDynamicsInput`（influencePercent/invert/normalization→scale）/ `createDynamicsOutput`（kind/strength/invert→segmentIndex/scale）を v3 化。`createDynamicsChain` 新設。runtime snapshot ヘルパーを `worldFrameChainV1` + stateSummary（particleCount/maxParticleSpeed/tipAngleLocalDeg）+ evaluatorVersions.dynamics=`worldFrameChainV1` へ。廃止診断テスト（invalidPendulumCardinality / invalidOutputCardinality / normalizationInvalid）を新設診断テスト（chainSegmentsInvalid / outputSegmentIndexOutOfRange / zeroInputScale）へ差し替え。改定診断（unstableSettings 新基準 gravityScale>10 で発火）/ 維持診断（inputMissing, driverMissing, outputMissing, outputTargetDuplicate, outputLimitTooSmall, runtimeEvidenceMismatch）を v3 形状で再固定。10 tests green。**期待値はソルバ/バリデータの実出力に合わせて固定**（手書き推測せず、実行結果で確認して固定）。
- `packages/validator-core/src/tutorial-readiness-validator.test.ts` — inline dynamics group（v2: influencePercent/normalization/pendulums/strength）を v3（scale/chain/segmentIndex）へ手動置換。6 tests green。
- `packages/operation-core/src/operations/create-dynamics-group.test.ts` — payload ヘルパー 3 種（`createDynamicsGroupRequest` / `createPresetDynamicsGroupRequest` / `createPresetDynamicsGroupUpdateRequest`）を v3 payload（inputs.scale / chain / outputs.segmentIndex+scale）へ。廃止 operation 診断名 `operation.createDynamicsGroup.invalidOutputCardinality` を現行 `operation.createDynamicsGroup.missingOutputBinding` へ是正。5 tests green。
- `packages/operation-core/src/operation-lifecycle.test.ts` — createDynamicsGroup payload を v3 化。green。
- `packages/operation-core/src/operation-schemas.test.ts` — createDynamicsGroup payload を v3 化。green。

### グループ3: golden fixture 再生成（1テスト + 3 golden JSON、green）
- `packages/runtime-core/src/dynamics-contract-evidence-fixture.test.ts` — テスト本文は Gnome-1 が v3 フィールド参照へ更新済み。私は **golden 期待値を v3 ソルバ実出力へ再生成**:
  - `fixtures/contracts/minimum-open-dynamics-v1-evidence/expected/runtime-snapshot-summary.json`
  - `fixtures/contracts/minimum-open-dynamics-v1-evidence/expected/runtime-diff-summary.json`
  - `fixtures/contracts/minimum-open-dynamics-v1-evidence/expected/editor-facing-evidence-summary.json`
  - 実出力（input `param_face_yaw=1`, scale=30 → anchorPhiDeg=30, tip localAngle=-30°, outputOffset=-0.999（limit=1 でクランプ）→ hair_sway effectiveValue=-0.999, keyform sample が `clamped-min` へ、drawable y は 0）を一時ダンプで確認してから固定。v2 golden（angle/angularVelocity/rawTarget, outputOffset=1, y=0.5）を v3 semantics へ置換。2 tests green。

### グループ4: authoring-core 境界テスト（1ファイル、green）
- `packages/authoring-core/src/dependency-boundary.test.ts` — 先行 Gnome が `portable-project-bundle.test.ts` に runtime-core の `evaluateViewerRuntimeSnapshot` import を追加した（v3 dynamics 往復テストのため妥当）。既存の runtime-core import 許可リスト（`runtime-graph-adapter.test.ts` 等の同種テスト先例あり）に `portable-project-bundle.test.ts` を追加。1 test green（`portable-project-bundle.test.ts` 自体も 3 tests green を確認）。

---

## 2. validator §7 診断 改廃対応表（`packages/validator-core/src/validators/dynamics-semantic.ts` 実装に照合）

| 区分 | 診断 checkId | テスト側の対応 |
|---|---|---|
| **新設4** | `dynamics.chainSegmentsInvalid` | dynamics-semantic.test.ts「reports missing inputs and an invalid empty chain」で `segmentLengths: []` → 発火を固定 |
| | `dynamics.outputSegmentIndexOutOfRange` | 「reports an out-of-range output segment index」で `segmentIndex: 3`（N=1）→ 発火を固定 |
| | `dynamics.zeroInputScale` | 「reports zero input scale as a warning」で `scale: 0` → 発火を固定 |
| | `dynamics.outputScaleZero` | 「reports additive dynamics warnings…」で output `scale: 0` → 発火を固定 |
| **廃止3** | `dynamics.invalidPendulumCardinality` | 該当テストを削除し chainSegmentsInvalid へ置換 |
| | `dynamics.invalidOutputCardinality`（validator） | 該当テストを削除。※ operation 側の同名 checkId は `missingOutputBinding` に是正（別レイヤ） |
| | `dynamics.normalizationInvalid` | 該当テストを削除し zeroInputScale へ置換 |
| **改定1** | `dynamics.unstableSettings` | 新基準（`damping>60 \|\| L<0.1 \|\| N>16 \|\| gravityScale>10`）を `gravityScale: 20` で発火させ、warnings テストの期待順（zeroInputScale, outputScaleZero, outputLimitTooSmall, unstableSettings, runtimeEvidenceMismatch）を固定 |
| **維持6** | `dynamics.inputMissing` / `dynamics.driverMissing` / `dynamics.outputMissing` / `dynamics.outputTargetDuplicate` / `dynamics.runtimeEvidenceMismatch` / `dynamics.outputLimitTooSmall` | v3 形状で期待値を再固定（evidence 文言・targetPath を実装に照合） |

（`outputStrengthZero` → `outputScaleZero`、`zeroInputInfluence` → `zeroInputScale` の命名移行も反映済み。）

---

## 3. テスト結果

### 私が担当した dynamics-v3 テスト（8 代表 + group-1 13 = 全 green）
```
$ npx vitest run <上記グループ1(green13)+2(5)+3(1)+4(1)>
Test Files  ... passed
Tests       ... passed   （dynamics 起因の赤は 0）
```
個別確認（抜粋）:
- dynamics-semantic.test.ts: `Tests 10 passed`
- tutorial-readiness-validator.test.ts: `Tests 6 passed`
- create-dynamics-group.test.ts: `Tests 5 passed`
- operation-lifecycle + operation-schemas: `Tests 23 passed`
- dynamics-contract-evidence-fixture.test.ts: `Tests 2 passed`
- dependency-boundary + portable-project-bundle: `Tests 4 passed`
- package-document.test.ts: `Tests 14 passed`
- group-1 sed 13ファイル: `Tests 147 passed`（rig-control-runtime-evidence / warp-lattice を除く 13/15）

### packages 全体（完了条件・未達）
```
$ npx vitest run packages/
Test Files  13 failed | 220 passed (233)
Tests       14 failed | 1407 passed (1421)
```
開始時（本タスク着手前・先行 Gnome working tree）は `21 failed / 41 tests failed`。→ dynamics-v3 テスト化で **8 ファイル削減、赤テスト 41→14 に減**。残 14 は全て非 dynamics（§4）。

### tsc（完了条件・達成）
```
$ npx tsc --noEmit   → 出力 0 行 = error 0（リポジトリ全体、packages 含む）
```

---

## 4. 残課題 13 ファイル / 14 テストの根本原因分類（全て HEAD 由来の既存赤・非 dynamics）

`git stash`（packages+fixtures 退避）で **committed HEAD（`dc9fae9c`）単体を実測**したところ、HEAD 時点で既に **16 ファイル / 18 テストが赤**。残 13 は全てこの HEAD 赤集合の部分集合であり、dynamics-v3 スキーマ形状とは無関係。根本原因は 4 系統:

### (A) 本体 recipe × preset レジストリ衝突（`duplicateParameter: param_mouth_open`）— **本体 src 要修正**
- 影響: `operation-core/wave30-tutorial-mini-model-contract-fixtures`, `operation-core/wave30-tutorial-mini-model-recipe`, `runtime-core/wave30-tutorial-mini-model-contract-fixtures`, `validator-core/wave30-tutorial-mini-model-contract-fixtures`（4ファイル）
- 原因: `packages/operation-core/src/tutorial-mini-model-recipe.ts` が `createParameter`(op_tutorial_create_parameter_mouth_open) で `param_mouth_open` を生成するが、`param_mouth_open` は **wave64 で登録済みの preset パラメータ**（`packages/package-format/src/parameter-presets.ts:67`）。`hasInitializedParameter` が preset を初期化済みと判定 → recipe が `operation.createParameter.duplicateParameter` で reject → recipe 適用が mouth_open で throw し dynamics 到達前に停止。
- 判断: これは runtime reject（golden 差異ではない）であり、**テスト本文の v3 化では直せない**。recipe 側で別 param id を使う／createParameter が preset 再宣言を許容する／recipe が preset を createParameter せず参照する、のいずれかの **本体 src 判断**が必要。Forbidden につき自分では触れず escalate。

### (B) 別フィーチャ `model/variants.json` 追加による package file-set entryCount のずれ — **fixtures 再生成で解消可能だが dynamics 対象外**
- 影響: `operation-core/persisted-operation-evidence-fixture`（entryCount 20→21）, `operation-core/imported-source-package-evidence-preview-consistency`（33→34）, `operation-core/rig-control-keyform-operation-fixture`（fileSetEntryCount 18→19）, `operation-core/runtime-validation-evidence-fixture`, `operation-core/wave32-warp-lattice2d-contract-fixtures`（同系の deep-equal golden 差）
- 原因: パッケージが新たに `model/variants.json` を materialize（git working tree に `variant-selection-resolution.ts` / `variant-visibility-gate.test.ts` / `ai-variant-selection.ts` 等の別フィーチャ差分あり）。golden の期待ファイル数が +1 されていない。
- 判断: これは **variants フィーチャの golden 未更新**であって dynamics-v3 とは無関係。fixtures/** は私の Allowed だが、これらを「私が dynamics として」書き換えると variants 担当の意図と衝突しうるため、**variants ドメイン / Orch 判断待ち**として escalate（勝手な横断書換を避ける）。

### (C) 本体 `createParameter` の semanticRole 欠落 — **本体 src バグ疑い**
- 影響: `operation-core/minimal-operation-fixture`
- 原因: fixture request は `semanticRole: "mouth"` を渡すが、commit 後のパラメータから semanticRole が脱落（golden は正しく "mouth" を期待）。これは stale golden ではなく **本体 createParameter/materialization の semanticRole 保持の退行**の疑い。
- 判断: 本体 src 要調査。dynamics 無関係。escalate。

### (D) 本体 keyform 検証の追加チェック / snapshot baseValue フィールド — **本体 src 由来**
- 影響: `validator-core/rig-control-runtime-evidence` + `validator-core/warp-lattice-diagnostics`（余分な `keyform.unsupportedTargetProperty` 発火）, `runtime-core/runtime-grid2d-keyform-fixture`（snapshot parameter に新フィールド `baseValue` が出現し golden 未反映）
- 判断: keyform 検証追加 / snapshot baseValue はいずれも本体 src（または別フィーチャ）由来。dynamics 無関係。escalate。

---

## 5. 本体 src 非改変の確認

- 私が編集したのは **テストファイル（`*.test.ts`）21件 + golden fixture JSON 3件（`minimum-open-dynamics-v1-evidence/expected/*`）のみ**。
- `packages/*/src/**` の **非テスト src（スキーマ / ソルバ / 型 / validator 実装 / payload / recipe / preset）は一切改変していない**。git working tree に見える本体 src の M 差分（`model-files.ts`, `dynamics-evaluation.ts`, `validators/dynamics-semantic.ts`, `payloads/dynamics.ts`, `tutorial-mini-model-recipe.ts` 等）は **すべて先行 Gnome（Gnome-1 等）由来**で私は触れていない。
- `parameter-resolution.ts` / `advanceRuntimeState` 非改変。`apps/**` 非改変。新規依存 / install なし。`.skip` / 回避工作なし。
- 一時的に挿入したデバッグ（console.error ダンプ / REGEN writer）は **すべて除去済み**（grep で残存 0 を確認）。

---

## 6. 裁量判断

1. **golden fixture 再生成の正当性**: dynamics-contract-evidence の golden を v3 ソルバ実出力へ再生成する際、「コードが出す値をそのまま snapshot する」危険を避けるため、実出力の semantics（anchorPhiDeg=30, tip=-30°, offset クランプ→-0.999, keyform clamped-min→drawable y=0）を確認し、**物理的に整合していること**を検証してから固定した。手書き推測はしていない。
2. **dependency-boundary 許可リスト追加**: `portable-project-bundle.test.ts` の runtime-core import は v3 dynamics 往復（export→import→evaluate）検証のため妥当で、既存の許可リスト（`runtime-graph-adapter.test.ts` 等テストの先例）と同種。境界ポリシーの精神に反しないと判断し許可リストへ追加した。
3. **(B) variants golden を書き換えなかった判断**: fixtures/** は Allowed だが、variants は別フィーチャであり、その golden 更新を dynamics タスクの一環として勝手に行うと担当境界を跨ぐ。かつ (A)(C)(D) の本体 src ブロッカーが残る以上、(B) だけ直しても `packages/ 0 failed` には到達しないため、(B) 単独修正の価値が低いと判断し escalate に含めた。

---

## 7. escalate 事項（Orch-Sylph へ）

**完了条件 `npx vitest run packages/` 0 failed は本タスク（dynamics-v3 テスト化）単独では到達不能**。理由: 残 13 ファイルの赤は全て **committed HEAD 由来の既存赤**かつ **非 dynamics** で、本体 src 修正または別ドメイン担当を要する（上記 §4 A〜D）。

要判断:
1. **(A) recipe × preset 衝突（`param_mouth_open`）**: 本体 `tutorial-mini-model-recipe.ts` / `parameter-presets` / `createParameter` のいずれで解消するか。dynamics スコープ外・本体 src につき別 Gnome または方針判断が必要。（最重要ブロッカー。4ファイルを封じている）
2. **(B) variants `model/variants.json` の golden 未更新**: variants ドメイン担当が golden entryCount を +1 更新すべき。dynamics 対象外。
3. **(C) createParameter の semanticRole 欠落**: 本体 src 退行の疑い。要調査。
4. **(D) keyform 検証追加 / snapshot baseValue**: 本体 src / 別フィーチャ由来。要担当割当。

私の側で dynamics-v3 スキーマ形状に起因する赤は **0** にした（tsc も 0）。上記 A〜D が解消されれば packages 全 green に到達する見込み。

## 判定: **escalate**
（dynamics-v3 テスト化＝完了 / packages 全 green＝非 dynamics 本体要因により未達・要 Orch 判断）
