# AI Agent Interface Design

> 状態: Draft
> 目的: AI Agent Interface の File-level、GUI-level、Structured API-level の3層方針、operation core / model core / validator core を正とする設計、AI dry-run、diff、repair candidate、provenance、再検証手順を固定する。

## 1. 根拠の分離

### 1.1 リポジトリ事実

- `AC-MVP-014` は、AI Agentが model structure inspection、runtime state snapshot、validation report読み込み、対象ID指定operation dry-run、model diff、runtime diff、validation diff、repair candidate、provenance、AC / scenario判定材料を扱えることを要求する。
- `SC-MVP-004` は、AI Agentが validation report と model structure を読み、`eyeOpen = 0` の閉眼keyformを対象に軽微な頂点補正operationをdry-runし、diffとrepair candidate、再検証手順をreportへ添えることを要求する。
- `AC-MVP-001` は、AI操作がGUI制作フローを置き換えるものではないと定めている。

### 1.2 公式・参照事実

- AI Agent接続方式と技術スタック文書は、File-level、GUI-level、Structured API-level の3層連携を方針としている。
- Viewer / Preview参照レポートは、GUI-level AI connectionには構造化DOM、snapshot、overlay metadataが必要と整理している。
- Runtime評価セマンティクス参照レポートは、AI dry-runも Shared Runtime core のevaluation profileとして扱えると整理している。

### 1.3 設計仮定

- MVPのAI Interfaceは、自然文の魔法ではなく、stable IDと構造化operationを中心にする。
- Structured APIのtransportは実装時に選べるが、operation schemaはtransport非依存にする。
- AI Agentによる実変更は、dry-run、diff、validation、ユーザー承認を経てoperation logへcommitする。

## 2. 3層方針

### 2.1 File-level AI Connection

AI Agent は project-defined model package のテキストファイル、operation log、validation report、runtime snapshotを直接読める。

提供する能力:

- package structure inspection
- stable ID検索
- rights / provenance確認
- validation report読み込み
- operation log追跡
- file diff生成

制約:

- file直接編集は可能だが、正規変更は operation core と Validator再実行で確認する。
- AIが手でJSONを書き換えた結果は、Validatorを通るまで信頼しない。
- GUI authoring evidenceの代替にはしない。

### 2.2 GUI-level AI Connection

AI Agent は、Web-first GUIをPlaywright等で操作できる。

GUIが提供すべき観測面:

- role / label / test id が安定したUI要素。
- Parts tree、Drawable list、Parameter panel、Inspector、Diagnostics panelが構造化DOMとして読める。
- Canvas内部の選択対象、runtime state、overlay情報をInspectorまたはsnapshotとして取得できる。
- GUI操作がoperation coreの同じoperationへ到達する。

制約:

- Canvas座標クリックだけに依存しない。
- GUI自動操作は人間制作フローの補助・検証であり、MVPのGUI制作証跡を捏造するために使わない。

### 2.3 Structured API-level AI Connection

AI Agentの本命入口は、構造化operationである。

Transport候補:

- in-process command bus
- local HTTP / REST
- WebSocket
- MCP

MVPではtransportを固定しすぎず、command schemaとoperation core境界を正とする。

最低限のcommand:

- `inspectModel`
- `inspectTarget`
- `getRuntimeSnapshot`
- `validatePackage`
- `dryRunOperation`
- `diffModel`
- `diffRuntime`
- `diffValidation`
- `createRepairCandidate`
- `explainProvenance`
- `rerunValidation`

## 3. Source of Truth

AI Interface の正は次である。

| Core | 正とするもの |
|---|---|
| Operation core | 変更可能なoperation、precondition、dry-run、commit、undo/redo、operation log |
| Model core | stable ID、authoring graph、runtime-visible state、Editor-only state分離 |
| Validator core | check ID、severity、status、repair candidate、AI-readable report |
| Shared Runtime core | runtime snapshot、runtime diff、diagnostics、representative evaluation |

GUI表示、AI自然文、file diffは派生物である。正規変更はoperation coreを通る。

## 4. AI Dry-run Procedure

AI dry-run は、package本体を上書きしない。

手順:

1. Baseline packageを読み込む。
2. Baseline validation reportとruntime snapshotを取得する。
3. AIがstable IDで対象を指定する。
4. `dryRunOperation` をoperation coreへ送る。
5. operation coreがtemporary model revisionを作る。
6. Shared Runtime coreがdry-run snapshotを作る。
7. Validator coreがdry-run validationを実行する。
8. model diff、runtime diff、validation diffを返す。
9. repair candidateとして保存する。
10. ユーザー承認または明示commandがあるまでpackage本体へcommitしない。

Dry-run response必須項目:

- `dryRunId`
- `basePackageRevision`
- `temporaryRevision`
- `operation`
- `preconditionResult`
- `modelDiff`
- `runtimeDiff`
- `validationDiff`
- `diagnostics`
- `repairCandidateId`
- `provenance`
- `revalidationCommand`

## 5. Diff 方針

### 5.1 Model diff

Stable IDを軸にする。

- added / removed / changed objects
- target ID
- field path
- before / after
- operation ID
- provenance ID

### 5.2 Runtime diff

Snapshot比較を軸にする。

- parameter values
- keyform samples
- rig control evaluated state
- drawable bounds / vertex hash / optional full vertices
- opacity / visibility
- mask status
- draw list
- diagnostics delta

### 5.3 Validation diff

Check IDとtarget IDを軸にする。

- new failures
- resolved failures
- severity changes
- status changes
- repair candidate impact
- related AC / scenario impact

## 6. Repair Candidate

Repair candidateは、AIの提案であり、実変更ではない。

必須項目:

- `candidateId`
- `createdBy`
- `targetIds`
- `problemCheckIds`
- `rationale`
- `operationDraft`
- `expectedModelDiff`
- `expectedRuntimeDiff`
- `expectedValidationDiff`
- `risk`
- `requiresUserApproval`
- `provenance`
- `revalidationSteps`

Repair candidateは、Validator report、Diagnostics panel、AI / Report tabから参照できる。

## 7. Provenance

AI操作のprovenanceは、asset provenanceとは別にoperation provenanceとして記録する。

記録するもの:

- actor
- tool / agent name
- input reports
- prompt or instruction summary
- target IDs
- dry-run ID
- diff IDs
- user approval status
- applied operation ID
- validation report ID after apply

権利metadataと関係するAI生成・編集assetの場合は、`assets/provenance.json` と operation provenanceの両方へリンクする。

## 8. Revalidation Procedure

AI提案またはAI適用後は、必ず再検証手順を持つ。

1. Apply前: baseline validation reportを確認する。
2. Dry-run: model/runtime/validation diffを取得する。
3. Approval: userまたは明示policyで承認する。
4. Commit: operation logへappendし、packageRevisionを更新する。
5. Reload: package loaderで再読み込みする。
6. Runtime: representative parameter evaluationを実行する。
7. Validate: Validator strictまたはscenario profileを実行する。
8. Report: before / after validation diffとprovenanceを保存する。

## 9. Safety / Scope

- AI Agent はGUI制作フローを置き換えない。
- AI Agent はstable IDなしに曖昧な対象変更をしない。
- AI dry-runは本体を上書きしない。
- Repair candidateは自動適用しない。
- AI-readable reportは自然文要約だけにしない。
- File-level編集の結果もValidatorとRuntime load testを通す。

## 10. 実装前に決めるべき未決事項

- MVP structured API transportを in-process command bus、local HTTP、WebSocketのどれで始めるか。
- GUI-level AI用の test id 命名規則。
- AI dry-run結果をViewerでも確認できるようにするか、Editor preview / AI Report tabに限定するか。
- Repair candidateの承認UI。
- Provenanceにprompt本文を保存するか、要約とhashにするか。

## 11. Post-MVPでよい未決事項

- MCP serverとしての正式公開。
- 自動修復のpolicy-based auto-apply。
- 複数repair案のランキング。
- 自然言語レビュー統合。
- 外部AI Agent向け権限モデル。
