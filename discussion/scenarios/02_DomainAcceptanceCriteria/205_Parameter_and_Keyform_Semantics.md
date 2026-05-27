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
2. ユーザーがlinear、step、smoothなどの補間を選ぶ。
3. Private runtime coreが中間値を評価する。

### Then

- Keyformは対象control、parameter値、補間設定を保持する。
- Runtime snapshotは評価に使ったparameter値と補間結果を確認できる。
- 欠けたkeyformや不連続が大きい区間はwarningになる。

### 検証するAC

- AC-PARAM-003

## SC-PARAM-003: manual authored parameter gridを保存できる

### Given

- ユーザーはfaceYawとfacePitchの組み合わせで顔向き風の変形を作りたい。

### When

1. ユーザーが2つ以上のparameterをgridとして選ぶ。
2. ユーザーがgrid cellごとにkeyformを手で調整する。
3. Editorがgrid全体をpackageへ保存する。

### Then

- Gridはparameter軸、cell、keyform、補間設定を保存する。
- Runtimeはgrid内の中間状態を評価できる。
- 未調整cellや過大変形cellはvalidatorが報告する。

### 検証するAC

- AC-PARAM-004
- AC-PARAM-005

## SC-PARAM-004: 複数parameterの影響を追跡できる

### Given

- 1つのdrawableに複数parameterが作用している。

### When

1. ユーザーがdebug previewを開く。
2. ユーザーがparameterを動かす。
3. Editorが影響したcontrol、keyform、drawableを表示する。

### Then

- どのparameterがどのcontrolに作用したかを追跡できる。
- 意図しない同時作用はwarningとして確認できる。
- AI assistantは影響範囲を説明し、repair suggestionをdry-runで返せる。

### 検証するAC

- AC-PARAM-007

## 2. 未決事項

- MVPで採用する補間種別の最小集合。
- Parameter gridの保存形式と編集UI。
