# シナリオ: Open Package Validator

> 参照元AC: [220_Open_Package_Validator.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/220_Open_Package_Validator.md)
> 状態: 新規Open Stackドメイン シナリオドラフト

## 0. このドラフトの目的

このファイルは、`AC-VALIDATOR` を Open Model Package が利用可能なモデル資産として成立しているかを検証するシナリオへ降ろす。

Validator の正は Open Model Format と Open Runtime に基づく。Cubism runtime asset 互換や `.moc3` 読み込みは初期成功条件にしない。

## 1. リポジトリ事実

- 参照元ACは、schema validation、asset reference validation、mesh/drawable validation、runtime load test、AI-readable validation report を要求している。
- `discussion/concept/modified_concept.md` は、Marketplaceや納品ワークフローより先に package validation を成立させる方針を示している。
- Open Package Validator は Open Viewer、SDK、AI Agent Interface の共通検証基盤になる。

## 2. 設計判断

- Validator は Pass / Fail だけでなく、Needs review と Not applicable を扱う。
- report は人間向け表示だけでなく、AIエージェントが修復候補を生成できる構造を持つ。
- runtime load test は、Open Runtime の初期化と初期評価までを対象にし、配信アプリ固有設定は別ドメインで扱う。

## 3. シナリオ記述方針

- Given: 正常package、壊れたpackage、schema、Runtime を書く。
- When: validation実行、参照解決、mesh検査、runtime load、report保存を書く。
- Then: status、対象ID、根拠、影響範囲、修復候補を観測可能に書く。

## SC-VALIDATOR-001: package schema と version を検証できる

### Given: 前提条件

- `MinimalAvatar_A.openpackage` は format version `0.1` と必須top-level fieldsを持つ。
- `BrokenAvatar_MissingRequiredField.openpackage` は `parameters` field を欠落させている。
- Validator は format schema と version compatibility rule を参照できる。

### When: Open Stack実用操作

1. ユーザーが `MinimalAvatar_A.openpackage` に Validator を実行する。
2. ユーザーが `BrokenAvatar_MissingRequiredField.openpackage` に Validator を実行する。
3. ユーザーが schema validation report を確認する。

### Then: Open Stack期待結果

- 正常packageは、schema、version、必須フィールド、型、参照形式が Pass になる。
- 欠落packageは、`parameters` field の欠落を Fail として報告する。
- report には、対象path、期待される型または構造、実際の値、format version、互換性判定が含まれる。
- version未対応の場合、Validator は読み込み不能、migration可能、Needs review を区別して報告できる。

### 検証するACの項目

- AC-VALIDATOR-001: package schema validation ができること
- AC-VALIDATOR-005: AI-readable validation report を出力できること

## SC-VALIDATOR-002: asset reference の存在と整合を検証できる

### Given: 前提条件

- `RiggedAvatar_A.openpackage` は texture、expression、motion、physics、metadata を参照している。
- `BrokenAvatar_MissingTexture.openpackage` は `textures/face.png` を欠落させている。
- `BrokenAvatar_BadMotionRef.openpackage` は存在しない parameter を motion から参照している。

### When: Open Stack実用操作

1. ユーザーが3つのpackageに Validator を実行する。
2. ユーザーが asset reference validation の項目を確認する。
3. ユーザーが report を AI-readable 形式で保存する。

### Then: Open Stack期待結果

- 正常packageでは、texture、expression、motion、physics、metadata の参照が Pass になる。
- texture欠落では、参照元drawable、欠落path、影響範囲が Fail として報告される。
- 不正motion参照では、motion ID、存在しない parameter ID、該当keyframeまたはtrackが Fail として報告される。
- report には、欠落資産の配置候補や不要参照削除などの修復候補を記録できる。

### 検証するACの項目

- AC-VALIDATOR-002: asset reference validation ができること
- AC-VALIDATOR-005: AI-readable validation report を出力できること

## SC-VALIDATOR-003: mesh / drawable の整合性を検証できる

### Given: 前提条件

- `RiggedAvatar_A` には複数drawable、mesh、uv、triangle index、draw order、mask がある。
- `BrokenAvatar_BadTriangleIndex.openpackage` は存在しないvertex indexをtriangleから参照している。
- `BrokenAvatar_MaskCycle.openpackage` は mask参照に循環を含む。

### When: Open Stack実用操作

1. ユーザーが各packageに Validator を実行する。
2. ユーザーが mesh / drawable validation の詳細を確認する。
3. ユーザーが問題drawableを Viewer で選択できるリンク情報を確認する。

### Then: Open Stack期待結果

- 正常packageでは、vertex数、uv数、triangle index、drawable参照、draw order、mask参照が Pass になる。
- 不正triangleでは、対象mesh ID、triangle ID、範囲外index、許容index範囲が Fail として報告される。
- mask循環では、循環しているdrawable/mask IDの経路が Fail として報告される。
- report は、ViewerやAIエージェントが対象drawableを選択して修正に進めるIDを含む。

### 検証するACの項目

- AC-VALIDATOR-003: mesh / drawable validation ができること
- AC-VALIDATOR-005: AI-readable validation report を出力できること

## SC-VALIDATOR-004: Open Runtime での load test と初期評価を検証できる

### Given: 前提条件

- `RiggedAvatar_A.openpackage` は schema と参照検証が Pass している。
- `BrokenAvatar_RuntimeInvalidKeyform.openpackage` は schema上は読めるが、Runtime評価時に keyform補間が成立しない。
- Validator は Open Runtime を呼び出せる。

### When: Open Stack実用操作

1. ユーザーが runtime load test を有効にして Validator を実行する。
2. Validator が package を Runtime に読み込ませる。
3. Validator が初期parameterと代表parameter値で evaluation を実行する。
4. ユーザーが runtime load report を確認する。

### Then: Open Stack期待結果

- 正常packageでは、Runtime load、texture準備、初期evaluation、代表parameter evaluation が Pass になる。
- 不正keyform packageでは、Runtime評価時の対象parameter、keyform ID、失敗理由が Fail として報告される。
- Runtimeが警告付きで表示可能な場合、Validator は Fail と Needs review を区別できる。
- report は Open Runtime の diagnostics と Validator の判定を対応付ける。

### 検証するACの項目

- AC-VALIDATOR-004: runtime load test ができること
- AC-VALIDATOR-005: AI-readable validation report を出力できること

## SC-VALIDATOR-005: AI-readable validation report を保存できる

### Given: 前提条件

- `BrokenAvatar_Composite.openpackage` は、欠落texture、範囲外parameter初期値、未使用motion参照を含む。
- Validator は report出力形式として JSON または同等の構造化形式を提供する。
- AIエージェントは report を読み、修復候補を生成する。

### When: Open Stack実用操作

1. ユーザーが Validator を実行し、report を保存する。
2. AIエージェントが report を読み込む。
3. AIエージェントが Fail、Needs review、Not applicable を分類し、修復順を提案する。

### Then: Open Stack期待結果

- report には、check ID、status、対象ID、根拠、影響範囲、関連AC、修復候補、provenanceが含まれる。
- AIエージェントは、Fail項目を修復必須、Needs review項目を人間確認、Not applicable項目を対象外として分類できる。
- report は Viewer、SDK、AI Agent Interface から同じ対象IDで参照できる。
- 修復候補は実行結果ではなく提案として記録され、実際の変更とは区別される。

### 検証するACの項目

- AC-VALIDATOR-005: AI-readable validation report を出力できること
- AC-VALIDATOR-001: package schema validation ができること
- AC-VALIDATOR-002: asset reference validation ができること
- AC-VALIDATOR-003: mesh / drawable validation ができること
- AC-VALIDATOR-004: runtime load test ができること

## 4. 未決事項

- validation report の正式schema。
- Pass / Fail / Needs review / Not applicable の判定境界。
- runtime load test で代表parameter値をどう選ぶか。
- Validator をCLI、SDK API、Viewer内機能のどれとして最初に実装するか。
