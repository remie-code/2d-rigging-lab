# シナリオ: MVP Acceptance Criteria

> 参照元AC: [03_MVP_Acceptance_Criteria.md](../acceptance-criteria/03_MVP_Acceptance_Criteria.md)
> 状態: GUI Editor 必須 Authoring-to-Runtime MVP シナリオドラフト

## 0. このドラフトの目的

このファイルは、MVP AC を「権利的にクリーンな素材から GUI Editor で Live2D 的な可動モデルを制作し、保存し、Runtime / Viewer で表示し、Validator と AI Agent で検証する」横断シナリオへ降ろす。

Cubism Editor のUI模倣、`.cmo3` 復元、`.moc3` 互換出力、Cubism SDK/Core 必須依存は検証対象にしない。

## 1. 公式事実

- Cubism Editor チュートリアルの基本チュートリアルは、1から6までの講座として案内されている。
  参照: https://docs.live2d.com/cubism-editor-tutorials/top/
- 基本チュートリアル1は、Live2Dでイラストを動かす最初の加工手順を扱う。
  参照: https://docs.live2d.com/cubism-editor-tutorials/psd/
- 基本チュートリアル2は、PSD読み込み後にメッシュを割る準備を扱う。
  参照: https://docs.live2d.com/cubism-editor-tutorials/import/
- 基本チュートリアル3は、目の開閉、眉毛の変形、口の開閉を扱い、パーツロック、parameter、key追加、変形パス、clipping mask を参照している。
  参照: https://docs.live2d.com/cubism-editor-tutorials/expression/
- 基本チュートリアル4は、deformerを使った体の動き付けを扱う。
  参照: https://docs.live2d.com/cubism-editor-tutorials/deformer/
- 基本チュートリアル5は、deformerを使った顔の Angle X / Y と斜め方向の動き付けを扱う。
  参照: https://docs.live2d.com/cubism-editor-tutorials/xy/
- 基本チュートリアル6は、Animation mode、timeline、keyframe を使った motion 作成を扱う。
  参照: https://docs.live2d.com/cubism-editor-tutorials/animator/
- PSD import、ArtMesh、mesh、parts、draw order、clipping、parameter、keyform、deformer、Viewer、runtime loading、model integrity は公式マニュアルの関連項目として参照できる。
  参照: https://docs.live2d.com/en/cubism-editor-manual/psd-import/
  参照: https://docs.live2d.com/en/cubism-editor-manual/concept-of-artmesh/
  参照: https://docs.live2d.com/en/cubism-editor-manual/mesh-edit/
  参照: https://docs.live2d.com/en/cubism-editor-manual/mesh-edit-manual/
  参照: https://docs.live2d.com/en/cubism-editor-manual/parts/
  参照: https://docs.live2d.com/en/cubism-editor-manual/draworder/
  参照: https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/
  参照: https://docs.live2d.com/en/cubism-editor-manual/parameter/
  参照: https://docs.live2d.com/en/cubism-editor-manual/edit-parameters/
  参照: https://docs.live2d.com/en/cubism-editor-manual/keyform-xydirection/
  参照: https://docs.live2d.com/en/cubism-editor-manual/deformer/
  参照: https://docs.live2d.com/en/cubism-editor-manual/making-and-placement-of-warp-deformer/
  参照: https://docs.live2d.com/en/cubism-editor-manual/making-and-rotation-of-rotationdeformer/
  参照: https://docs.live2d.com/en/cubism-editor-manual/system-of-parent-child-relation/
  参照: https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/
  参照: https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/
  参照: https://docs.live2d.com/en/cubism-sdk-manual/model-web/
  参照: https://docs.live2d.com/en/cubism-sdk-manual/parameters/
  参照: https://docs.live2d.com/cubism-sdk-manual/moc3-consistency/

## 2. リポジトリ事実

- `discussion/concept/modified_concept.md` は、Open Live2D Stack を Editor、Model Format、Runtime、Viewer、Validator、AI Agent Interface などを含む制作・実行基盤として定義している。
- `discussion/acceptance-criteria/01_RootAcceptanceCriteria.md` は、Open Editor がモデルを制作・編集できること、Cubism非依存であること、Open Source公開可能な権利境界を持つことを要求している。
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md` は、MVPを GUI Editor 必須の Authoring-to-Runtime 一周として再定義している。
- Domain ACは `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/` にあり、MVP対応表と変更候補はMVP AC本文に記録されている。

## 3. 設計判断

- MVPは GUI Editor で制作できることを必須にする。CLI、script、AI操作、手書きJSONだけで生成された package は、単独ではMVP達成にならない。
- MVPでは Cubism 基本チュートリアル1-5相当を制作能力の参照範囲とする。
- 基本チュートリアル6相当の animation mode、timeline、motion作成は MVP+1 / 将来候補とする。
- 髪揺れは、MVPでは parameter駆動または簡易deformer駆動の揺れ相当でよい。フル物理シミュレーションは必須にしない。
- AI Agent は GUI制作フローを置き換える存在ではなく、観測、検証、補助編集、diff、repair候補を担当する。

## 4. シナリオ記述方針

- Given: 権利クリーン素材、GUI Editor、Runtime、Viewer、Validator、AI Agent、検証用モデルの状態を書く。
- When: GUI上の制作操作、保存、再読み込み、Viewer確認、Validator実行、AI diff確認を書く。
- Then: 目視表示だけでなく、構造化state、report、diff、provenanceで検証できる期待結果を書く。

## SC-MVP-001: GUI Editorで権利クリーン素材からMVPミニモデルを制作できる

### 前提条件

- 権利的にクリーンな入力素材 `MVPAvatar_Clean_Source/` が存在する。
- 素材は、レイヤー構造付きPSDまたは分割PNGセットとして、少なくとも `Head`, `Eye_L`, `Eye_R`, `Brow_L`, `Brow_R`, `Mouth`, `Hair_Front`, `Hair_Side`, `Body`, `Arm_L` を含む。
- 各素材には、出典、作成者、ライセンス、生成・編集手順、再配布可否を示す provenance がある。
- GUI Editor、Open Runtime、Open Viewer、Open Package Validator、AI Agent Interface が利用できる。

### 操作列

1. ユーザーが GUI Editor で `MVPAvatar_Clean_Source/` を開く。
2. ユーザーが入力素材のレイヤーまたは分割画像、配置、グループ、ガイド画像、権利metadataを確認する。
3. ユーザーが素材を drawable、texture、part へ変換し、顔、目、眉、口、髪、体、腕のpart構造を整理する。
4. ユーザーが各drawableに mesh を生成し、必要に応じて頂点をGUI上で編集する。
5. ユーザーが part / drawable の lock、hide、select、multi-select を使って編集対象を限定する。
6. ユーザーが draw order を調整し、目、眉、髪、口、体の前後関係を preview で確認する。
7. ユーザーが瞳または同等の部位に clipping / mask を設定し、mask対象と被mask drawable の関係を確認する。

### 期待結果

- GUI Editor は入力素材を制作対象として受け入れ、受け入れ時の警告、保持できた情報、失われた情報、権利metadataを表示できる。
- 各drawableは、元素材、texture、mesh、part、draw order、表示状態、stable ID と対応付く。
- lock / hide / select は制作支援状態として扱われ、runtime表示状態やdraw orderと混同されない。
- mesh は vertex、uv、triangle index を持ち、GUI上で編集できる。
- clipping / mask の参照は、Editor preview と後続Validatorで追跡できる。

### 検証するACの項目

- AC-MVP-001: GUI Editor を必須の制作入口にすること
- AC-MVP-002: 権利的にクリーンな素材とサンプルで完結すること
- AC-MVP-003: レイヤー素材または分割画像を制作入力として受け入れられること
- AC-MVP-004: drawable / texture / part 化できること
- AC-MVP-005: mesh を生成・編集・検証できること
- AC-MVP-006: part管理、lock / hide / select、draw order を扱えること
- AC-MVP-007: clipping / mask を扱えること

## SC-MVP-002: 基本チュートリアル1-5相当の可動をGUI Editorで制作できる

### 前提条件

- `SC-MVP-001` の制作途中モデルが GUI Editor で開かれている。
- モデルには、顔、目、眉、口、髪、体、腕の drawable と mesh がある。
- GUI Editor は parameter、keyform、warp / rotation 相当 deformer、親子階層を編集できる。

### 操作列

1. ユーザーが `ParamEyeOpen` を作成し、まばたきの開閉keyformを追加する。
2. ユーザーが `ParamBrowForm` を作成し、眉の上下または困り眉・驚き相当のkeyformを追加する。
3. ユーザーが `ParamMouthOpenY` を作成し、口開閉keyformを追加する。
4. ユーザーが顔または頭部に rotation 相当deformerを追加し、`ParamAngleZ` または顔Z相当parameterに接続する。
5. ユーザーが体に warp または rotation 相当deformerを追加し、体上下、体傾き、片腕の可動を parameter に接続する。
6. ユーザーが髪partに warp 相当deformerを追加し、髪揺れ相当の parameter または簡易sway keyformを作る。
7. ユーザーが顔の各partに Angle X / Y 用のdeformer階層を作り、左右・上下・斜め方向の変化を確認する。
8. ユーザーが各parameterをGUI上のsliderまたは同等操作で動かし、Editor previewを確認する。

### 期待結果

- parameter は ID、表示名、最小値、最大値、初期値、現在値を持つ。
- keyform は対象parameter、値、対象drawableまたはdeformer、編集済みmeshまたは変形状態を持つ。
- keyform間の中間値は preview 上で連続的な見た目の変化として確認できる。
- warp / rotation 相当deformerは、対象、親子階層、parameter接続を持つ。
- まばたき、眉、口開閉、顔Z、体上下 / 傾き、腕、髪揺れ、顔 Angle X / Y が制作済み可動として観測できる。
- 公式Cubismの標準parameter名と完全一致しなくても、Open Stack 内のstable IDと必要に応じた参考aliasで識別できる。

### 検証するACの項目

- AC-MVP-008: parameter、範囲、keyform、補間を制作できること
- AC-MVP-009: warp / rotation 相当 deformer、親子階層、parameter接続を制作できること
- AC-MVP-010: 基本チュートリアル1-5相当のミニモデル可動を制作できること
- AC-MVP-011: Editor preview、保存、再読み込みが成立すること

## SC-MVP-003: Editor保存、再読み込み、Runtime / Viewer表示まで一周できる

### 前提条件

- `SC-MVP-002` のMVPミニモデルが GUI Editor preview で確認済みである。
- Open Model Package の保存先 `MVPAvatar_Clean.openpackage/` が用意されている。
- Open Runtime / Viewer は Open Model Package を読み込める。

### 操作列

1. ユーザーが GUI Editor で `MVPAvatar_Clean.openpackage/` として保存する。
2. ユーザーが GUI Editor を閉じ、同じ package を再読み込みする。
3. ユーザーが再読み込み後に、素材対応、drawable、texture、part、mesh、parameter、keyform、deformer、clipping、draw order、rights metadata、provenance を確認する。
4. ユーザーが Open Viewer で同じ package を開く。
5. ユーザーが Viewer の parameter slider で、まばたき、口開閉、顔Angle X/Y、髪揺れ相当を操作する。
6. ユーザーが Runtime state snapshot を保存する。

### 期待結果

- GUI Editor の保存と再読み込み後に、制作構造と権利metadataが保持される。
- Viewer は package を読み込み、非空のモデル表示を生成する。
- Viewer の parameter 操作により、表示と runtime state が変化する。
- runtime state には、parameter値、評価済みdrawable state、vertex、visibility、opacity、draw order、mask状態、diagnosticsが含まれる。
- Runtime / Viewer は Cubism SDK/Core や `.moc3` に依存せず、Open Model Package を正として扱う。

### 検証するACの項目

- AC-MVP-011: Editor preview、保存、再読み込みが成立すること
- AC-MVP-012: Runtime / Viewer で表示し parameter 操作できること
- AC-MVP-015: Cubism非依存の一周として成立すること

## SC-MVP-004: Validator と AI Agent でMVPミニモデルを検証できる

### 前提条件

- `MVPAvatar_Clean.openpackage/` は `SC-MVP-003` で保存・再読み込み・Viewer表示済みである。
- Open Package Validator は schema、asset reference、mesh、drawable、parameter、deformer、mask、runtime load、rights を検証できる。
- AI Agent Interface は model structure inspection、operation command、diff extraction、validation report 読み込みを提供している。

### 操作列

1. ユーザーが `MVPAvatar_Clean.openpackage/` に Validator を実行する。
2. ユーザーが validation report を人間向け表示とAI-readable形式で保存する。
3. AI Agent が validation report と model structure を読み込む。
4. AI Agent が `ParamEyeOpen = 0` の閉眼keyformを対象に、軽微な頂点補正operationをdry-runする。
5. AI Agent が dry-run 前後の model diff、runtime diff、validation diff を取得する。
6. AI Agent が修復候補、影響範囲、provenance、再検証手順を report に添える。

### 期待結果

- Validator report には、check ID、status、severity、target ID、根拠、関連ACまたはシナリオ、影響範囲、修復候補、provenance が含まれる。
- rights metadata、asset reference、mesh、draw order、mask、parameter、keyform、deformer、runtime load test の結果が区別される。
- AI Agent は自然文だけでなく、stable ID に基づいて対象を選択できる。
- dry-run operation は、未承認の実変更として package 本体を上書きしない。
- diff は、変更対象parameter、keyform、drawable、vertex、runtime state、validation status を構造化して返す。

### 検証するACの項目

- AC-MVP-013: Validator が構造化レポートを出力できること
- AC-MVP-014: AI Agent が観測、編集operation、diff、検証を扱えること
- AC-MVP-015: Cubism非依存の一周として成立すること

## SC-MVP-005: GUIなし生成やCubism互換をMVP達成と誤判定しない

### 前提条件

- `ScriptGenerated_Minimal.openpackage/` は、scriptだけで生成され、Viewerでは表示できる。
- `CubismCompatible_ExportAttempt/` は、`.moc3` 互換出力を目標にした実験成果である。
- `MVPAvatar_Clean.openpackage/` は、GUI Editor で制作されたMVP候補である。

### 操作列

1. ユーザーが3つの成果物をMVP判定対象として並べる。
2. Validator またはMVP review tool が、それぞれの制作経路、GUI authoring evidence、保存・再読み込み、Viewer表示、AI-readable report を確認する。
3. ユーザーがMVP外項目の判定を確認する。

### 期待結果

- `ScriptGenerated_Minimal.openpackage/` は、Viewer表示できても GUI Editor 制作証跡がないためMVP未達または補助fixture扱いになる。
- `.moc3` 互換出力実験は、成功しても失敗してもMVP必須条件ではない。
- `MVPAvatar_Clean.openpackage/` は、GUI制作、保存、再読み込み、Runtime / Viewer表示、Validator report、AI diff が揃う場合のみMVP候補になる。
- MVP review は、基本チュートリアル6相当の timeline / motion 作成を Not applicable または MVP+1 として扱い、MVP Fail にしない。

### 検証するACの項目

- AC-MVP-001: GUI Editor を必須の制作入口にすること
- AC-MVP-015: Cubism非依存の一周として成立すること
- MVP外項目

## 5. 未決事項

- MVP用の権利クリーン素材を、手描き、生成画像、プログラム生成画像のどれで初期作成するか。
- GUI Editor の制作証跡を package metadata、operation log、provenance のどこに保持するか。
- MVPで扱う髪揺れ相当を parameter-driven deformer に限定するか、簡易physicsを含めるか。
- 顔Z相当parameterを `ParamAngleZ` の推奨aliasとして扱うか、Open Stack固有名にするか。
- MVP review tool を Validator のprofileとして実装するか、独立した acceptance runner として扱うか。
