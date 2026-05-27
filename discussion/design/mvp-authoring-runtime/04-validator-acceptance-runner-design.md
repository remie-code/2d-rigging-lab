# Validator and Acceptance Runner Design

> 状態: Draft
> 目的: MVPで検出すべき解析可能な不可解状態、Editor内警告、runtime load test、代表parameter評価、AI-readable report、Acceptance Runnerの関係を固定する。

## 1. 根拠の分離

### 1.1 リポジトリ事実

- `AC-MVP-005` は、meshのvertex数、uv数、triangle index範囲、重複または退化triangle、texture範囲、drawable参照、保存後整合性を Validator と AI Agent が検証できることを要求する。
- `AC-MVP-007` は、mask参照先欠落、循環、無効対象、runtimeで解決不能なmaskを構造化して報告できることを要求する。
- `AC-MVP-009` は、rig controlの親子循環、親子サイズまたは対象範囲不整合、存在しないtarget ID、parameter未接続、runtime評価不能を報告できることを要求する。
- `AC-MVP-013` は、package schema、format version、必須ファイル、asset reference、rights metadata、provenance、texture / drawable / part、mesh、draw order、mask、parameter、keyform、rig control、runtime load test、代表parameter評価を検証対象にする。
- `AC-PHYS-001` から `AC-PHYS-006` は、Minimum Open Dynamics v1のdriver/output、fixed timestep、reset policy、deterministic snapshot、demo-safe表示を検証対象にする。
- `SC-MVP-004` は、validation reportを人間向け表示とAI-readable形式で保存し、AI Agentがreportとmodel structureを読めることを要求する。
- `SC-MVP-005` は、scriptだけで生成されたpackageや第三者形式対応実験をMVP達成と誤判定しないことを要求する。

### 1.2 公式・参照事実

- RigControl参照レポートは、親子循環、参照切れ、keyform range、NaN、warp foldover、child vertex outside warp domain、preview/runtime snapshot差分を解析的に検出可能な候補としている。
- Viewer / Preview参照レポートは、Editor warning、Viewer diagnostics、Validator report、AI-readable diffでdiagnostics語彙を共有することを推奨している。
- Runtime評価セマンティクス参照レポートは、severityを `info`, `warning`, `error`, `blocking` に分け、statusを `pass`, `warning`, `fail`, `needs_review`, `not_applicable` と分ける案を提示している。

### 1.3 設計仮定

- MVP Validator は、目視品質や商用品質ではなく、解析的に判定可能な構造的不整合を中心にする。
- Editor内警告はValidator coreのsubset profileとして実装する。
- Acceptance RunnerはValidatorより上位で、MVP scenario証拠を集約する。

## 2. 役割分担

| 層 | 役割 | 入力 | 出力 |
|---|---|---|---|
| Schema validator | ファイル構造、型、versionを検証する | package files | schema diagnostics |
| Package validator | manifest、asset reference、ID table、rights/provenanceを検証する | package directory | package diagnostics |
| Model semantic validator | drawable、mesh、part、parameter、keyform、rig control、mask、draw orderの意味的整合を検証する | model graph | semantic diagnostics |
| Runtime load validator | package loader + Shared Runtime coreで読み込み評価できるか検証する | package + profile | runtime diagnostics, snapshot |
| Representative parameter evaluator | scenario代表parameter setを評価する | normalized graph + parameter set | runtime snapshots, diffs |
| Dynamics sequence evaluator | fixed timestepのauthored input sequenceを評価する | normalized graph + dynamics initial state + input sequence | dynamics snapshots, deterministic comparison |
| Editor warning profile | 制作中に即時表示すべきsubsetを出す | dirty authoring graph | incremental warnings |
| AI-readable report generator | reportをstable ID、repair candidate、provenance付きで保存する | diagnostics + snapshots + diffs | `*.validation.json` |
| Acceptance Runner | AC / scenarioに対してMVP完了判定材料を集める | operation log, GUI evidence, package, reports, snapshots | Pass / Fail / Needs review / Not applicable |

## 3. MVPで検出すべき解析可能な不可解状態

### 3.1 Package / Asset / Rights

- `manifest.json` 欠落。
- `formatVersion` 不明。
- 必須model file欠落。
- asset file欠落。
- asset hash不一致。
- rights metadata欠落。
- redistribution statusが `blocked`。
- provenanceがsource assetからdrawable / textureへ追跡できない。
- AI編集結果にAI利用有無やoperation IDがない。

### 3.2 ID / Reference

- stable ID欠落。
- stable ID重複。
- ID prefix不一致。
- drawableが存在しないmesh / texture / partを参照する。
- meshが存在しないdrawableを参照する。
- keyform target IDが存在しない。
- mask source / target IDが存在しない。
- rig control parent / child IDが存在しない。

### 3.3 Drawable / Texture / Part / Draw Order

- visible drawableにtextureがない。
- drawableがpart未所属。
- draw orderが未定義。
- draw order tie breakerが不安定。
- runtime visibilityとeditor hideの混同。
- opacityが範囲外またはNaN。

### 3.4 Mesh

- vertex array欠落。
- uv array欠落。
- vertex数とuv数不一致。
- triangle indexが範囲外。
- 退化triangle。
- 重複triangle。
- NaN / Infinity vertex。
- UVが許容範囲外。
- texture bounds外のUV。
- mesh boundsが空。

### 3.5 Parameter / Keyform

- parameter min > max。
- defaultが範囲外。
- key valueがparameter範囲外。
- keyformに必要なdefault keyがない。
- keyform target propertyの型が不一致。
- missing parameter reference。
- 同一target propertyに複数writerがあり、compositionMode未定義。
- interpolation / evaluator versionが不明。

### 3.6 RigControl

- rig control kind不明。
- parent-child cycle。
- topological sort不能。
- child drawable / child rig control参照切れ。
- parameter未接続rig control。
- empty rig control。
- `rotation2d` pivot / angle / scaleがNaNまたはInfinity。
- `rotation2d` transformがsingularまたは過度に縮退。
- `warpLattice2d` rows / columnsが最小未満。
- control point数不一致。
- control pointのNaN / Infinity。
- warp cell foldover疑い。
- child vertexが親warp domain外。
- unknown interpolation method。

### 3.6.1 Minimum Open Dynamics v1

- dynamics group欠落。
- driver parameter欠落。
- output parameter欠落。
- driverが`authoredInput` parameterではない。
- outputが`computedDynamics` parameterではない。
- output parameterが範囲外またはclamp不能。
- output parameterが同じgroupまたは他groupのdriverに使われている。
- dynamics group間依存またはcycle。
- Dynamics stateがNaN / Infinity。
- stiffness / damping / max velocity / max amplitude / output limitが不安定。
- fixed timestepやmaxSubStepsがruntime/profileと一致しない。
- 同じ入力列・同じinitial stateでpreview/viewer snapshotが一致しない。
- demo-safe画面にCubism Physics、physics3、内部solver詳細を示す名称が出ている。

### 3.7 Mask

- mask source欠落。
- mask target欠落。
- mask sourceがruntime visibility false。
- mask source boundsがzero-area。
- mask relationが自己参照または循環的に解決不能。
- mask対象がrenderableではない。

### 3.8 Runtime Load / Representative Evaluation

- package loaderがnormalized graphを作れない。
- Runtime coreがsnapshotを返せない。
- representative parameter setでblocking diagnosticsが出る。
- preview snapshotとviewer snapshotが同じ入力で一致しない。
- dynamics output sequenceが同じfixed timestep/input sequenceで一致しない。
- final vertex hash / boundsが非決定的。
- draw listが空。
- diagnostics phaseが欠落して原因追跡不能。

### 3.9 AI Interface Evidence

- AI-readable reportがない。
- reportにcheck ID、target ID、severity、evidence、related AC / scenarioがない。
- dry-runがpackage本体を上書きしている。
- model diff / runtime diff / validation diff がstable IDで対応できない。
- repair candidateにprovenanceまたは再検証手順がない。

## 4. Editor内警告、Runtime Load Test、代表Parameter評価の関係

```text
Editor operation
  -> dirty authoring graph
  -> editor warning profile
  -> inline warning + diagnostics panel

Save package
  -> schema/package/model semantic validation
  -> validation report

Viewer open / Validator runtime load
  -> package loader
  -> shared runtime core
  -> runtime snapshot + load diagnostics

Acceptance representative evaluation
  -> scenario parameter sets
  -> full / targeted snapshots
  -> runtime diff + validation diff
```

Editor内警告は制作中の早期発見用であり、MVP完了判定そのものではない。MVP完了判定には、保存済みpackageに対するValidator reportと代表parameter評価が必要である。

## 5. Validation Report Schema 方針

AI-readable reportはJSONを第一候補にする。

必須フィールド:

- `reportId`
- `createdAt`
- `packageId`
- `packageRevision`
- `packageHash`
- `validatorVersion`
- `profile`
- `relatedScenarios`
- `summary`
- `checks[]`

各check:

- `checkId`
- `status`
- `severity`
- `phase`
- `targetId`
- `targetKind`
- `targetPath`
- `evidence`
- `relatedAC`
- `relatedScenario`
- `impact`
- `repairCandidates`
- `provenance`
- `snapshotIds`
- `operationIds`

Repair candidate:

- `candidateId`
- `operationType`
- `targetIds`
- `preconditions`
- `payload`
- `expectedModelDiff`
- `expectedRuntimeDiff`
- `expectedValidationDiff`
- `requiresUserApproval`

## 6. Acceptance Runner

Acceptance Runner は、Validatorの結果に加えて、MVP scenarioの証拠を集約する。

### 6.1 判定対象

- GUI authoring evidenceがあるか。
- 権利クリーン素材から開始しているか。
- drawable / texture / part / mesh / parameter / keyform / rig control / dynamics / mask / draw orderをGUIで編集した証拠があるか。
- 保存、再読み込み、Viewer表示、runtime snapshotがあるか。
- Validator reportがあるか。
- AI dry-run、model diff、runtime diff、validation diffがあるか。
- Cubism SDK/Core、`.moc3`、`.cmo3` 復元を必須依存にしていないか。

### 6.2 Status

- `pass`: 証拠が揃い、blocking/errorがない。
- `fail`: 必須証拠が欠落、またはblocking診断がある。
- `needs_review`: 解析的には判断できない、またはwarningがMVP品質に影響する可能性がある。
- `not_applicable`: MVP外項目。例: timeline / motion作成。

### 6.3 GUIなし生成の誤判定防止

Script生成packageは、Viewer表示できても、GUI authoring evidenceがない場合はMVP達成にしない。補助fixtureまたはruntime smoke testとして扱う。

## 7. 実装前に決めるべき未決事項

- Editor warning profile と Validator strict profile のcheck IDを同一registryで管理するか。
- `warning` を Acceptance Runner で fail候補にする閾値。
- GUI authoring evidenceとして operation logだけで十分か、Playwright traceやsession metadataも必要か。
- Representative parameter setの具体値。
- Dynamics representative input sequence、fixedStepMs、reset policyの具体値。
- Preview snapshot と Viewer snapshot の一致判定を full vertexで行うか、hash + bounds + diagnosticsで行うか。

## 8. Post-MVPでよい未決事項

- CI batch validation。
- 独立Validator GUI。
- commercial model quality metrics。
- automatic repair apply。
- registry / marketplace向けpackage certification。
