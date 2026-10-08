# Wave106 事前在庫: dynamics v0 全面置換の破壊半径（Sylph 調査 2026-07-04）

> 設計本文: [../../design/dynamics-world-frame-chain.md](../../design/dynamics-world-frame-chain.md)
> 調査担当: Sylph（opus、読み取り専任）。判定タグ: **要変更** / **値差し替えのみ** / **無傷** / **判断要**（判断要は設計文書 §6 で全件裁定済み）

## 総括

- 4ノブ `{length, sway, reactionSpeed, convergenceSpeed}` は **package-format → operation-core payload → authoring-core mutation → runtime-core normalized graph → runtime-export → runtime-player tuning → editor tool** の全層を貫通。中間層はほぼ素通しコピーで、壊れ方は広いが浅い
- 実行時状態は**ディスク非永続**（純インメモリ）。ただし snapshot / diff evidence に投影される（`solverKind: "additivePendulumV0"` + `stateSummary`）
- **マイグレーション枠組みはリポジトリ全体に存在しない**（全ファイル種が schemaVersion 厳密一致 reject 方式）。`dynamics-file-v1` はコード上に存在しない（fixture 名の "v1" はシナリオ名）
- runtime-player tuning プロファイルのみ**ユーザーディスク永続**（`userData/dynamics-tuning-profiles/{fingerprint}.json`）。schemaVersion バンプで自動破棄（裁定 #2: 破棄受容）

## packages（要変更）

### package-format
- `src/model-files.ts:208-214` DynamicsPendulumSchema（4ノブ定義）/ `:225-233` DynamicsGroupSchema（pendulums `.length(1)`, outputs `.length(1)`）/ `:374-378` `schemaVersion: z.literal("dynamics-file-v2")`
- `src/runtime-export.ts:510-513` `RuntimeExportDynamicsGroupSchema = DynamicsGroupSchema`（直接再エクスポート。裁定 #6: 同一維持）/ `:131-138` solver 契約リテラル / `:162-172` capability `"dynamics-pendulum-solver-v1"`
- `src/package-document.ts:33` PackageDocument への組込み

### contracts
- `src/runtime-state.ts:5-12` 状態6フィールド（angle, angularVelocity, previousSource, previousSourceVelocity, tick, resetCounter）→ particles 配列へ
- `src/runtime-diff.ts:72-93` dynamicsChanges（angleBefore/After 等）

### runtime-core
- `src/dynamics-evaluation.ts:75-122` stepDynamics（唯一のソルバ、全面書換）/ `:158-174` computeDynamicsOutputOffsets / `:190-201` createResetDynamicsState
- `src/snapshot.ts:119-148` EvaluatedDynamicsGroupSchema（solverKind リテラル `:122`、stateSummary `:127-132`）/ `:472-530` createEvaluatedDynamics
- `src/snapshot-comparison.ts:58-134` dynamicsChanges 生成
- `src/state-compatibility.ts:56-64` / `src/initial-state.ts:24-31` 状態初期化
- `src/normalized-runtime-graph.ts:53-89` Normalized 型群

### authoring-core
- `src/runtime-graph-dynamics.ts:27-32`（素通しコピー）/ `src/dynamics-mutations.ts:25,97`（structuredClone、ロジック薄）

### operation-core
- `src/payloads/dynamics.ts:43-49, 60-80`（4ノブ + `.length(1)`）
- `src/operations/create-dynamics-group.ts:132-140, 163-165, 183-188`（カーディナリティ precondition + コピー）

### validator-core
- `src/validators/dynamics-semantic.ts` 全ルール一覧:
  - blocking: inputMissing `:92-101` / invalidPendulumCardinality `:103-112`（廃止対象）/ invalidOutputCardinality `:114-123`（廃止対象）/ normalizationInvalid `:125-130,328-352`（廃止対象）/ driverMissing `:275-298` / outputMissing `:300-326` / outputTargetDuplicate `:223-228,354-379` / runtimeEvidenceMismatch `:230-264`
  - warning: zeroInputInfluence `:164-173` / outputStrengthZero `:175-184` / outputLimitTooSmall `:186-195` / unstableSettings `:197-218`（4ノブ閾値、改定対象）

### ai-interface
- `src/ai-codex-proposal-operation-catalog.ts:264-273, 542-556` — 文言（"Dynamics v2 additive pendulum"）と requiredInputs キー名のみ。**要変更（軽微）**

## apps

### editor（Dynamics Tool）
- `src/workspace/panels/dynamics-tool-inspector.tsx` — Pendulum セクション `:1228-1255`（4 NumberField）、Quick Tune `:684-708, 803-890, 892-958, 974-983`（6フィールド前提）
- `src/features/editor-session/model/dynamics-tool-state.ts` — プリセット `:98-147`（hair/ribbon/softCloth/rigidAccessory の4ノブ値）、`:69` 状態型直接保持、`:846-898` stepDynamics 直接呼び、`:900-932` 出力サマリ、`:349-495` draft バリデーション、`:1013-1085` clone/compare
- `src/workspace/viewer/viewer-runtime-playback.ts:208-252` — **唯一の settled 判定**（angle/angularVelocity/previousSourceVelocity 前提、閾値 `:30-36`）。`:313-322` listPlayableDynamicsGroups（`pendulums.length > 0` 条件）

### runtime-player（tuning、結合深い）
- `src/preload/dynamics-tuning-bridge-contract.ts:1-2, 14-22, 35-43` — profile schemaVersion リテラル + override 7フィールド（enabled/strength/limit/4ノブ）
- `src/stage/runtime-evaluation/effective-dynamics-tuning.ts:43-72` — override 適用
- `src/main/dynamics-tuning-profiles/` — parser `:33-38`（version 厳密一致 → 旧は自動破棄）`:128-177`、store `:49-63,153`（userData 保存）、groups `:160-227`、state、signature（署名対象フィールドが変わると旧 fingerprint は stale 化）
- `src/main/dynamics-tuning-bridge-request-validation.ts:15-36` — IPC 検証

## fixtures（21ファイル、要書換）

- `fixtures/contracts/minimum-open-dynamics-v1-evidence/`（baseline + request 2種 + expected 一式。※ "v1" はシナリオ名）
- `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/`（runtime-graph + expected summary）
- `fixtures/contracts/minimal-valid-package/model/dynamics.json`（+ runtime snapshot summary）
- `fixtures/e2e/wave22-asset-io-boundary/package-document.json`
- `fixtures/contracts/{wave33,wave32,wave29,wave28,wave27}-*/baseline-package.json`
- `fixtures/contracts/{rig-control-keyform-angle-operation, psd-unsupported-layer, psd-import-happy-path, parent-child-rigControl-diagonal, invalid-rigControl-cycle, imported-source-package-evidence-preview-consistency, binary-asset-package-local-reference, source-asset-rights-provenance-validator}/{baseline-,}package*.json`

## テスト在庫（51ファイル接触。Grep ヒット数ベースの粗分類、精密分類は各ドメイン実装者が行う）

- **書き直し必須（約30）**: runtime-core の dynamics-evaluation(12)/initial-state(10)/evidence 系(5,9,6,5)、contracts diff-envelopes(4)、validator dynamics-semantic(28)、operation-core create-dynamics-group(32)/lifecycle(21)/schemas(6)、authoring-core mutations(20)/adapter(8)/export(6)/bundle(17)、package-format package-document(9)、editor dynamics-tool-state(38)/inspector(11)/viewer-runtime-screen(29)/context-history(21)、runtime-player effective-tuning(17)/default-pose(14)/eval-cache(15)/bridge-handlers(16)/profiles 3種(18,17,17)/control 2種(13,10)
- **値差し替えのみ**: parameter-resolution(14)、tutorial 系(4,10)、rig-control evidence 系(11,17)、editor canvas/diagnostics(10,8)
- **無傷〜極軽微**: mesh-generation 等(1-4)、editor 周辺 UI 列挙系(1-4)、player browser/broadcast-source(2-3)

## 無傷と確認済み

- authoring-host CLI（operation runner は汎用。dynamics 専用コードなし。リクエスト fixture のみ要書換）
- `parameter-resolution.ts` の加算合成の枠組み（offset の中身が変わるだけ）
- 固定ステップ + アキュムレータ機構（`advanceRuntimeState`、fixedStepMs/maxSubSteps）
- 実行時状態のディスク永続経路（存在しないことを確認。host-state-store に dynamics 状態なし、generatedRuntimeStateRefs は空配列運用）

## 未確認で残した点

- settled 判定の viewer 側消費者（viewer-runtime-screen の idle throttle 実装）の呼び出し経路詳細
- `dynamics-tuning-signature.ts` の署名対象フィールド詳細
- テスト各本文の精密分類
