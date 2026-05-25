# シナリオ: Open Model Format

> 参照元AC: [215_Open_Model_Format.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/215_Open_Model_Format.md)
> 状態: 新規Open Stackドメイン シナリオドラフト

## 0. このドラフトの目的

このファイルは、`AC-FORMAT` を Open Live2D Stack の正となる Open Model Format と Open Model Package の検証シナリオへ降ろす。

`.cmo3` 復元や `.moc3` 互換出力は初期成功条件にしない。Cubism の各形式は参照オラクルとして扱えるが、このシナリオの正は Open Model Format 自身の仕様、package、validation、runtime 読み込みである。

## 1. リポジトリ事実

- 参照元ACは、公開仕様、authoring/runtime構造、AI-readable性、versioning/migration、package参照整合を要求している。
- `discussion/concept/modified_concept.md` は、Open Model Format を Open Live2D Stack の最初の正のひとつとして位置付けている。
- MotionSync / LipSync と Video Editor は当面スコープ外である。

## 2. 設計判断

- 初期の正は、Open Model Format、Open Runtime、Open Viewer、Open Package Validator が同じ package を扱えることで確認する。
- authoring format と runtime format を同一にするか分けるかは未決だが、シナリオでは両方に必要な概念が失われないことを検証対象にする。
- AIエージェント向けには、構造、差分、編集意図、validation result、provenance を第一級の検証対象として扱う。

## 3. シナリオ記述方針

- Given: format仕様、サンプルモデル、package、検証ツールの状態を書く。
- When: Open Stack の仕様記述、保存、読み込み、migration、diff取得の操作を書く。
- Then: schema上の観測結果、参照解決、runtime読み込み、AI-readableな差分と検証結果を書く。

## SC-FORMAT-001: 公開仕様として最小モデルの構造を定義できる

### Given: 前提条件

- Open Model Format の仕様ドラフトを作成する作業状態である。
- 最小モデル `MinimalAvatar_A` は、1つの texture、1つの drawable、三角形mesh、1つの parameter、2つ以上の keyform を持つ想定である。
- Open Package Validator が参照できる schema または schema相当の検証ルールを定義できる。

### When: Open Stack実用操作

1. 仕様作成者が Open Model Format の top-level 要素、ID規則、参照規則、数値単位、必須/任意フィールドを記述する。
2. 仕様作成者が `MinimalAvatar_A` の最小 package 例を仕様に添える。
3. 実装者がその仕様から loader と validator の最小検証ケースを起こす。

### Then: Open Stack期待結果

- 仕様には、model metadata、texture、part、drawable、mesh、parameter、keyform、package metadata の扱いが明記されている。
- `MinimalAvatar_A` の例は、未定義の暗黙フィールドに依存せずに schema validation できる。
- 実装者は仕様だけを読んで、必須フィールド欠落、型不一致、参照不一致を検出する validator ケースを作れる。
- AIエージェントは top-level 要素一覧、ID、参照関係、未決/拡張フィールドを構造化して取得できる。

### 検証するACの項目

- AC-FORMAT-001: オープンな仕様として定義できること
- AC-FORMAT-005: package と参照整合を定義できること

## SC-FORMAT-002: authoring と runtime に必要な構造を1つの package に保持できる

### Given: 前提条件

- `RiggedAvatar_A` には、顔、髪、胴体の drawable と mesh が存在する。
- `ParamAngleX`, `ParamEyeLOpen`, `ParamMouthOpenY` が定義されている。
- それぞれの parameter に keyform と、deformer相当構造による変形対象が紐付いている。
- expression、physics、motion は最小の検証用設定として存在する。

### When: Open Stack実用操作

1. ユーザーが `RiggedAvatar_A` を Open Model Package として保存する。
2. ユーザーが保存された model body と package metadata を検証する。
3. ユーザーが Open Runtime で package を読み込み、初期表示と parameter 評価を実行する。

### Then: Open Stack期待結果

- package には、texture、drawable、mesh、part、parameter、keyform、deformer相当構造、expression、physics、motion、metadata が参照可能な形で含まれる。
- authoring時に必要な編集対象IDと、runtime評価に必要な描画対象IDが対応付けられている。
- Open Runtime は、authoring情報をすべて理解できない場合でも、runtime評価に必要な構造を欠落なく初期化できる。
- Validator は、未使用のauthoring metadataとruntime必須構造を区別して報告できる。

### 検証するACの項目

- AC-FORMAT-002: authoring と runtime に必要な構造を表現できること
- AC-FORMAT-005: package と参照整合を定義できること

## SC-FORMAT-003: 編集差分と provenance を AI-readable に取得できる

### Given: 前提条件

- `RiggedAvatar_A` の `ParamEyeLOpen` には、開眼と閉眼の keyform が存在する。
- 編集前 package には、作成者、生成手順、使用素材、直近の validation result が metadata として記録されている。
- AI Agent Interface または同等の diff 抽出ツールが利用できる。

### When: Open Stack実用操作

1. AIエージェントが `ParamEyeLOpen = 0` の keyform に対して、左目上まぶたの vertex を3点だけ下方向に補正する操作を実行する。
2. AIエージェントが編集後 package を保存する。
3. AIエージェントが編集前後の model diff と validation result を取得する。

### Then: Open Stack期待結果

- diff には、変更された parameter ID、keyform ID、drawable ID、vertex ID、変更前後の値が含まれる。
- provenance には、操作主体、操作時刻または操作順、編集意図、生成/修正の由来、参照した validation result が含まれる。
- validation result は、編集対象外の texture、drawable、parameter、physics、motion が変化していないことを確認できる。
- AIエージェントは、差分を自然文だけでなく構造化データとしてレビューに渡せる。

### 検証するACの項目

- AC-FORMAT-003: AI-readable であること
- AC-FORMAT-002: authoring と runtime に必要な構造を表現できること

## SC-FORMAT-004: format version migration を検証できる

### Given: 前提条件

- `MinimalAvatar_A` は format version `0.1` の package として存在する。
- format version `0.2` では、`parameter.default` が `parameter.initialValue` に名称変更され、旧フィールドは非推奨として扱われる。
- migration tool または loader 内 migration が利用できる。

### When: Open Stack実用操作

1. ユーザーが version `0.1` package を version `0.2` 対応 loader で読み込む。
2. ユーザーが migration report を保存する。
3. ユーザーが migration 後 package を Open Viewer と Open Package Validator で確認する。

### Then: Open Stack期待結果

- loader は source format version、target format version、適用した migration step を報告する。
- `parameter.default` は `parameter.initialValue` に移行され、旧フィールド使用は warning として記録される。
- migration 後 package は、Open Viewer で migration 前と同じ初期姿勢を表示できる。
- semantic diff には、互換維持のための名称変更と、実際のモデル挙動に影響する差分が分離して表示される。

### 検証するACの項目

- AC-FORMAT-004: versioning と migration を扱えること
- AC-FORMAT-003: AI-readable であること

## SC-FORMAT-005: Open Model Package の外部参照を整合的に扱える

### Given: 前提条件

- `RiggedAvatar_A.openpackage` は、model body、texture、physics、motion、expression、package metadata を含む。
- model body は `textures/body.png` と `textures/face.png` を参照している。
- package metadata は、format version、package ID、sample/provenance情報、検証日時を保持できる。

### When: Open Stack実用操作

1. ユーザーが package を別ディレクトリへ移動する。
2. ユーザーが package 内の相対参照を解決する。
3. ユーザーが `textures/face.png` を意図的に削除した検証用 package を作る。
4. ユーザーが Open Package Validator を実行する。

### Then: Open Stack期待結果

- 移動後も package 内の相対参照は解決できる。
- `textures/face.png` を削除した package では、欠落した参照元フィールド、参照先path、影響を受ける drawable が報告される。
- 参照欠落は Open Model Format の package整合違反として扱われ、Cubism形式との互換有無では判定されない。
- report は AIエージェントが修復候補を生成できる粒度で、欠落資産、参照元、期待される配置を返す。

### 検証するACの項目

- AC-FORMAT-005: package と参照整合を定義できること
- AC-FORMAT-003: AI-readable であること

## 4. 未決事項

- Open Model Package の実ファイル拡張子とディレクトリ構成。
- authoring format と runtime format を同一にするか、分けるか。
- semantic diff の正規化規則。
- migration tool を独立CLIにするか、loader/validatorに内包するか。
