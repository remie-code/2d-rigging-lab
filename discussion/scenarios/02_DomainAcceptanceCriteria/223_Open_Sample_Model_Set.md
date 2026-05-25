# シナリオ: Open Sample Model Set

> 参照元AC: [223_Open_Sample_Model_Set.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/223_Open_Sample_Model_Set.md)
> 状態: 新規Open Stackドメイン シナリオドラフト

## 0. このドラフトの目的

このファイルは、`AC-SAMPLE` を Open Source 公開可能な検証・学習・実装用モデルセットのシナリオへ降ろす。

Open Sample Model Set は、公式Live2Dサンプル、既存商用モデル、再配布条件が不明な素材に依存しない。Open Model Format、Runtime、Viewer、Validator、VTuber App、AI Agent Interface の検証に使える権利クリーンなサンプルを正とする。

## 1. リポジトリ事実

- 参照元ACは、権利的にクリーンなサンプル、最小サンプル、機能別サンプル、validation failure sample、sample provenance を要求している。
- `discussion/concept/modified_concept.md` は、Open Source として公開可能な権利関係・依存関係・設計境界を持つことを新コンセプトに含めている。
- MotionSync / LipSync と Video Editor は当面スコープ外であり、サンプルセットの初期必須対象にしない。

## 2. 設計判断

- サンプルモデルは、機能検証のための小さく明確なfixtureとして扱う。
- 見た目の完成度より、format/runtime/validator/API/AI操作の検証に必要な構造と権利記録を優先する。
- 権利状態が不明な素材は、ローカル実験には使えても Open Sample Model Set には入れない。

## 3. シナリオ記述方針

- Given: sample asset、license/provenance、検証対象機能を書く。
- When: sample作成、package保存、validation、runtime/viewer確認、権利確認を書く。
- Then: 公開可能性、検証用途、失敗fixture、provenance記録を観測可能に書く。

## SC-SAMPLE-001: 権利的にクリーンなサンプルモデルを公開候補にできる

### Given: 前提条件

- `SampleAvatar_Clean_A` の画像素材、モデル設定、motion、expression はプロジェクト内で作成されたもの、またはOpen Source公開可能な素材から作成されたものである。
- 各素材には、出典、作成者、ライセンス、生成/編集手順を記録するmetadata欄がある。
- 公式Live2Dサンプル、商用モデル、再配布不可SDK資産は含めない方針である。

### When: Open Stack実用操作

1. ユーザーが `SampleAvatar_Clean_A` を Open Model Package として保存する。
2. ユーザーが sample rights metadata を確認する。
3. ユーザーが Open Package Validator と rights hygiene check を実行する。
4. ユーザーが公開候補として sample catalog に登録する。

### Then: Open Stack期待結果

- sample package は、モデル本体、texture、設定、検証データの権利状態をmetadataとして持つ。
- rights hygiene check は、再配布不可資産、出典不明素材、公式サンプル依存がないことを確認できる。
- sample catalog には、用途、機能範囲、ライセンス、provenance、検証済みstatusが記録される。
- 権利状態が未確認の素材が含まれる場合、公開候補ではなく Fail または Needs review として扱われる。

### 検証するACの項目

- AC-SAMPLE-001: 権利的にクリーンなサンプルモデルを持つこと
- AC-SAMPLE-005: sample provenance を記録できること

## SC-SAMPLE-002: 最小サンプルモデルで format / runtime / viewer を検証できる

### Given: 前提条件

- `MinimalAvatar_A` は、1 texture、1 part、1 drawable、三角形mesh、1 parameter、2 keyform を持つ。
- `MinimalAvatar_A` は Open Source 公開可能な素材だけで構成される。
- Open Model Format、Open Runtime、Open Viewer、Open Package Validator が最小検証対象である。

### When: Open Stack実用操作

1. ユーザーが `MinimalAvatar_A` を Open Model Package として保存する。
2. ユーザーが Validator を実行する。
3. ユーザーが Viewer で読み込み、parameterを最小値と最大値へ動かす。
4. ユーザーが runtime state snapshot を保存する。

### Then: Open Stack期待結果

- package は schema、参照解決、mesh/drawable、runtime load test を Pass する。
- Viewer でモデルが表示され、parameter操作に応じて評価済みvertexが変化する。
- snapshot には、入力parameter、評価済みdrawable state、diagnostics が含まれる。
- 最小サンプルは、SDKやAI Agent Interfaceの初期fixtureとして再利用できる。

### 検証するACの項目

- AC-SAMPLE-002: 最小サンプルモデルを持つこと
- AC-SAMPLE-001: 権利的にクリーンなサンプルモデルを持つこと

## SC-SAMPLE-003: 機能別サンプルを段階的に追加できる

### Given: 前提条件

- sample catalog は、機能別sampleの用途、依存機能、検証対象ACを記録できる。
- 初期候補として、`MeshDeformSample_A`, `FaceExpressionSample_A`, `BodyMotionSample_A`, `PhysicsHairSample_A`, `VTuberMappingSample_A` がある。
- MotionSync / LipSync と Video Editor 用sampleは初期対象外である。

### When: Open Stack実用操作

1. ユーザーが各sampleを Open Model Package として保存する。
2. ユーザーが各sampleに対応する validation と Viewer確認を実行する。
3. ユーザーが sample catalog に機能タグ、対応AC、確認済みツールを登録する。
4. ユーザーが未実装機能に依存するsampleを Needs review として扱う。

### Then: Open Stack期待結果

- 機能別sampleは、mesh deformation、parameter、face、body、physics、expression、motion、VTuber app の検証対象を区別して持つ。
- 各sampleは、どのAC/シナリオのfixtureとして使えるかを catalog から確認できる。
- 未実装機能に依存するsampleは、Pass として誤登録されず、必要機能と未決事項が記録される。
- 権利metadataとprovenanceは、最小sampleと同じ基準で保持される。

### 検証するACの項目

- AC-SAMPLE-003: 機能別サンプルを持つこと
- AC-SAMPLE-005: sample provenance を記録できること

## SC-SAMPLE-004: validation failure sample で Validator と reviewer を検証できる

### Given: 前提条件

- `BrokenAvatar_MissingTexture`, `BrokenAvatar_BadTriangleIndex`, `BrokenAvatar_BadMotionRef` は、意図的に壊したpackageである。
- 各failure sample は、どのチェックを失敗させるためのfixtureかをmetadataで記録している。
- failure sample にも、公開可能な素材だけを使う。

### When: Open Stack実用操作

1. ユーザーが各failure sampleに Validator を実行する。
2. ユーザーが期待する Fail / Needs review が出ているか確認する。
3. AIエージェントが validation report を読み、修復候補を生成する。

### Then: Open Stack期待結果

- `BrokenAvatar_MissingTexture` は asset reference validation で Fail する。
- `BrokenAvatar_BadTriangleIndex` は mesh validation で Fail する。
- `BrokenAvatar_BadMotionRef` は motion参照またはruntime load test で Fail する。
- report には、意図的failureであること、期待されるcheck ID、修復候補、権利metadataが含まれる。

### 検証するACの項目

- AC-SAMPLE-004: validation failure sample を持つこと
- AC-SAMPLE-001: 権利的にクリーンなサンプルモデルを持つこと

## SC-SAMPLE-005: sample provenance を追跡できる

### Given: 前提条件

- `SampleAvatar_Clean_A` は、画像生成、手動編集、mesh作成、parameter設定、validation の履歴を持つ。
- provenance schema は、素材ID、作成者、生成手段、編集操作、ライセンス、検証結果を記録できる。
- AIエージェントが一部のkeyformを補正した履歴がある。

### When: Open Stack実用操作

1. ユーザーが sample provenance を表示する。
2. ユーザーが AIエージェントによる補正箇所の diff と operation log を確認する。
3. ユーザーが sample package を再保存し、provenance を更新する。
4. ユーザーが公開候補checkを実行する。

### Then: Open Stack期待結果

- provenance には、素材、作成手順、ライセンス、生成過程、編集履歴、validation結果が含まれる。
- AIエージェントの編集は、操作主体、対象ID、編集意図、diff、承認状態として記録される。
- 再保存後も過去のprovenanceが失われず、公開候補checkから参照できる。
- 出典不明またはライセンス未確認の要素がある場合、公開候補checkは Needs review または Fail を返す。

### 検証するACの項目

- AC-SAMPLE-005: sample provenance を記録できること
- AC-SAMPLE-001: 権利的にクリーンなサンプルモデルを持つこと

## 4. 未決事項

- sample catalog の正式な配置場所とschema。
- 画像素材を手描き、生成、プログラム生成のどれで初期作成するか。
- failure sample の破損内容をどこまで自動生成するか。
- sample license の標準表記。
