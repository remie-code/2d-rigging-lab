# シナリオ: Parameter and Keyform Semantics

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/205_Parameter_and_Keyform_Semantics.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/205_Parameter_and_Keyform_Semantics.md)
> Status: Accepted draft for Private Prototype MVP.

## 0. 目的

このシナリオは、project-defined parameter preset、semantic role、keyform、補間、manual authored parameter gridをPrivate Prototypeの正として定義する。

## 1. Source-of-Truth

### Design Decisions

- Parameter名、範囲、roleはproject-definedである。
- 外部互換のための既定ID体系はMVP成功条件にしない。
- Face turnや表情は、手で作成したparameter gridとkeyformで検証する。

### Research Notes

- 旧標準IDや外部ツール互換の記述は、現在のMVP仕様ではなく過去調査扱いにする。

## SC-PARAM-001: project-defined parameter presetを作成できる

### Given

- Projectにはrig controlが存在する。

### When

1. ユーザーがparameterを作成する。
2. ユーザーがmin、max、default、unit、semantic roleを設定する。
3. ユーザーがparameter presetとして保存する。

### Then

- Parameter metadataはpackage内に保存される。
- Semantic roleはAI assistantやvalidatorが説明に使える。
- 範囲外default、重複ID、未使用parameterはvalidatorで報告される。

### 検証するAC

- AC-PARAM-001
- AC-PARAM-002

## SC-PARAM-002: keyformと補間を編集できる

### Given

- Projectにはparameterとrig controlがある。

### When

1. ユーザーがparameter値ごとのkeyformを作成する。
2. ユーザーがMVPで採用する`linear-1d-v1`補間を選ぶ。
3. Private runtime coreが中間値を評価する。

### Then

- Keyformは対象control、parameter値、補間設定を保持する。
- Runtime snapshotは評価に使ったparameter値と補間結果を確認できる。
- 欠けたkeyformや不連続が大きい区間はwarningになる。
- `step`、`smooth`、curve-based interpolationはPost-MVPとする。

### 検証するAC

- AC-PARAM-003

## SC-PARAM-003: manual authored parameter gridを保存できる

### Given

- ユーザーはfaceYawとfacePitchの組み合わせで顔向き風の変形を作りたい。

### When

1. ユーザーがちょうど2つのparameterを`parameter-grid-2d-v1`の軸として選ぶ。
2. ユーザーがgrid cellごとにkeyformを手で調整する。
3. Editorがgrid全体をpackageへ保存する。

### Then

- Gridはparameter軸、cell、keyform、補間設定を保存する。
- Runtimeはgrid内の中間状態を評価できる。
- 未調整cellや過大変形cellはvalidatorが報告する。
- 3つ以上のparameterを同一gridに割り当てる任意N次元gridはMVP外であり、validator warning / needs_review対象とする。

### 検証するAC

- AC-PARAM-004
- AC-PARAM-005

## SC-PARAM-004: `parameter-grid-2d-v1`を評価できる

### Given

- Projectには`faceYaw`と`facePitch`を軸にした`parameter-grid-2d-v1` keyform setがある。

### When

1. ユーザーがgridのcorner、edge、diagonal、centerに相当するparameter値をpreviewする。
2. Private runtime coreが`bilinear-grid-v1`で中間状態を評価する。
3. Validatorが欠けたcell、重複cell、過大変形を確認する。

### Then

- Runtime snapshotはsampled coordinates、target、keyform set ID、評価結果を含む。
- 欠けた周辺keyは`keyform.grid2dMissingKey`、重複座標は`keyform.grid2dDuplicateKey`として報告される。
- 3つ以上のparameterを同一gridに割り当てる任意N次元gridはMVP外である。

### 検証するAC

- AC-PARAM-007

## SC-PARAM-005: 複数parameter overrideを同時評価できる

### Given

- Projectには`faceYaw`、`facePitch`、`bodyAngle`、`hairSway`など複数parameterがある。

### When

1. ユーザーまたはAI dry-runが複数parameter overrideを同時に指定する。
2. Private runtime coreがauthored/computed/effective parameterを解決する。

### Then

- Runtime snapshotは同時指定されたparameter値と、影響したkeyform / rig control / dynamics outputを確認できる。
- MVPでは、同じtarget propertyに複数writerがある場合、compositionModeとcompositionOrderが未定義ならvalidator warningまたはfail候補になる。

### 検証するAC

- AC-PARAM-007

## SC-PARAM-006: projectPresetAliasとsemantic roleをinspectできる

### Given

- Projectにはprivate `projectPresetAlias` と `semanticRole` を持つparameterがある。

### When

1. ユーザーまたはAI assistantがparameterをinspectする。
2. ValidatorまたはAI assistantがparameterの意味と利用箇所を説明する。

### Then

- `projectPresetAlias` はprivate project/editor preset labelとして返り、外部互換parameter IDとして扱われない。
- `semanticRole` は説明、検索、validator reportに使える。

### 検証するAC

- AC-PARAM-001
- AC-PARAM-002

## SC-PARAM-007: single-key / endpoint-missing keyformを検出できる

### Given

- Projectにはsingle-key、endpoint-missing、または必要なdefault keyを欠くkeyformがある。

### When

- ユーザーがValidatorを実行する。

### Then

- Validatorは`keyform.missingEndpoint`をreportし、strict profileではfail候補として扱える。
- Reportは対象keyform set ID、parameter ID、欠けたendpointを示す。

### 検証するAC

- AC-PARAM-003

## 2. 未決事項

- Parameter gridの編集UIの具体レイアウト。
