# シナリオ: Input Asset and Model Intake

> 参照元AC: [201_Input_Asset_and_Model_Intake.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/201_Input_Asset_and_Model_Intake.md)
> 状態: 精緻化ドラフト

## 0. このドラフトの目的

このファイルは、`AC-IN` を「人が入力素材または既存Live2D資産を受け取り、編集可能な対象として立ち上げるときの操作粒度」まで降ろした検証シナリオである。

ここでは、Cubism Editor や Cubism Viewer の画面構成を模倣することを目的にしない。ただし、Cubismでの参照操作または実務上の参照操作を明示し、その操作によって成立している制作能力を Open Editor の検証可能な期待結果として書く。

このドラフトでは、具体的なデータモデル、API、永続化形式、内部ID設計は扱わない。必要な情報を「観測できる」「保持できる」「検証できる」ことまでをシナリオ化する。

## 1. 公式事実

- Cubism Editor は PSD を Modeling Workspace の View area へドラッグ&ドロップ、または File メニューから開いて読み込める。PSDから新規モデルを作成すると、PSDレイヤーは ArtMesh としてキャンバス上に配置される。
  参照: [Import PSDs](https://docs.live2d.com/en/cubism-editor-manual/psd-import/)
- Cubism Editor では、Photoshop と同様のグループ階層を Parts palette に作成できる。グループ外のレイヤーも読み込み可能で、PSD内に下絵用の原画を含められる。
  参照: [Import PSDs](https://docs.live2d.com/en/cubism-editor-manual/psd-import/)
- Cubism では、読み込まれたPSD画像を Source Image と Model Guide Image の2段階で扱う。Source Image はPSDのレイヤー階層やレイヤー情報をできるだけ元の形で保持し、Model Guide Image は実際のモデルデータで使う単純化された画像である。
  参照: [About Source Image and Model Guide Image](https://docs.live2d.com/en/cubism-editor-manual/original-picture/)
- Cubism 3以降では、ArtMesh は Source Image ではなく Model Guide Image に対応付けられる。Model Guide Image は通常、元のPSDレイヤーとの関係と配置情報を保持する。
  参照: [About Source Image and Model Guide Image](https://docs.live2d.com/en/cubism-editor-manual/original-picture/)
- PSDから読み込まれた各レイヤーまたはグループにはメッシュが割り当てられ、ArtMesh として扱われる。ArtMesh は頂点と線で構成されるポリゴンの集合を画像に割り当て、頂点移動によって変形できる。
  参照: [About ArtMeshes](https://docs.live2d.com/en/cubism-editor-manual/concept-of-artmesh/)
- Cubism Editor のファイル種別では、`.cmo3` は Model Workspace が扱うモデルデータ、`.moc3` はプログラムで使用するLive2Dモデルデータ、`.model3.json` は `.moc3`、テクスチャ、物理設定などを関連付けるモデル設定ファイルとして説明されている。
  参照: [File Types and Extensions](https://docs.live2d.com/en/cubism-editor-manual/file-type-and-extension/)
- 組み込み用データの出力では、`.moc3`、`.model3.json`、Texture が標準で出力される。必要に応じて physics、motion-sync、user data、parameter/display information などの設定ファイルも出力対象になる。
  参照: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)
- Cubism Viewer では `.moc3` または `.model3.json` をドラッグ&ドロップしてモデルを読み込める。`.model3.json` を読み込むと、motion、facial expression、physics などの関連設定もまとめて読み込める。
  参照: [Loading Models and Motion](https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/)
- Texture Atlas は、キャラクター等を構成するパーツ画像を平面に配置した画像である。Texture Atlas 編集では、テクスチャの追加・削除、各パーツのサイズ変更、配置検証などを行える。
  参照: [Edit Texture Atlas](https://docs.live2d.com/en/cubism-editor-manual/texture-atlas-edit/)
- PSD作成上の注意として、PSD形式、RGB、8bit/channel などの条件が示されている。また、同名レイヤーは後工程の混乱要因になり得るため、素材分け段階で別名にすることが推奨されている。Opacity は反映されるが、Fill は再現されない。
  参照: [Notes on PSD creation](https://docs.live2d.com/en/cubism-editor-manual/precautions-for-psd-data/)

## 2. リポジトリ事実

- 参照元ACは `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/201_Input_Asset_and_Model_Intake.md` にあり、`AC-IN-001` から `AC-IN-006` までを定義している。
- `discussion/scenarios/02_DomainAcceptanceCriteria/204_Deformation_Control_Structure.md` は、公式事実、記述方針、Cubism参照操作、Open Stack期待結果を分ける粒度確認用ドラフトである。
- `discussion/scenarios/02_DomainAcceptanceCriteria/_map.md` では、本ファイルが「入力素材・既存モデル受け入れのシナリオ」として予定されている。

## 3. 仮説・未決事項

- 静的な2D素材の代表例として、このドラフトでは単層PSDを扱う。PNGなど非PSDの単体画像を正式な入力対象に含めるかは、AC上は読み取れるが、Live2D公式資料だけではこのドラフト内で確定しない。
- `.moc3` や `.model3.json` などの Cubism runtime package から、`.cmo3` やPSDと同等の編集履歴・制作構造を完全復元することは初期成功条件にしない。このドラフトでは、移行できる情報と欠落する authoring 情報を区別して扱う。
- AC-IN-006 の provenance が、手動入力、推定、Cubism由来情報、Open Model Format 変換結果をどの粒度で保持するかは未決である。
- Cubismのターゲットバージョン、ブレンドモード差異、古いモデル形式変換を、Open Stack がどこまで移行支援するかは未決である。

## 4. シナリオ記述方針

各シナリオは、Given-When-Then を次の3層で書く。

- Given: 入力素材、既存モデル、関連ファイル、既知の制約など、検証開始時の状態を書く
- When: Cubism参照操作または実務参照操作を書く。人が再現できる粒度にするが、Cubism UIの模倣は目的にしない
- Then: Open Stack期待結果を書く。内部形式やAPIではなく、編集・検証・再出力に必要な観測可能結果を書く

Cubism Editor で直接再現できるものは「Cubism参照操作」として書く。Cubism Viewer やファイルパッケージ確認のようなものは「実務参照操作」として書く。

## SC-IN-001: 単層PSDを静的な2D素材として受け取り、編集対象のArtMesh相当へ立ち上げられる

### Given: 前提条件

- 入力素材 `Body_Base_import.psd` が存在する。
- `Body_Base_import.psd` は、キャラクター胴体の静的な2D素材を1レイヤーで持つ。
- レイヤー名は `Body_Base` である。
- レイヤーはPSDキャンバス上の配置位置を持つ。
- この素材には、まだメッシュ編集、パーツ分類、パラメータ、物理設定、モーションは存在しない。

### When: Cubism参照操作

1. `Body_Base_import.psd` を Modeling Workspace の View area へドラッグ&ドロップする。
2. Model Settings で、PSDファイルから新規モデルを作成する。
3. キャンバス上に `Body_Base` の ArtMesh が配置されることを確認する。
4. Parts palette で、読み込まれた描画要素を選択する。
5. ArtMesh の初期メッシュが作成され、元画像と同じ位置関係で表示されることを確認する。

### Then: Open Stack期待結果

- Open Editor は `Body_Base_import.psd` を入力素材として受け取れる。
- `Body_Base` は、編集可能な描画要素として立ち上がる。
- `Body_Base` は、入力元レイヤー、元画像、キャンバス上の配置、初期メッシュを確認できる状態になる。
- 入力時点で存在しないパーツ分類、パラメータ、物理設定、モーションは、存在しない情報として区別される。
- 後続のメッシュ編集、パーツ分類、再出力に利用できる入力由来情報が保持される。

### 検証するACの項目

- AC-IN-001: 入力素材を受け取れること
- AC-IN-002: 素材を編集可能な内部表現へ変換できること
- AC-IN-006: 入力由来情報と欠落情報を保持できること

## SC-IN-002: レイヤー構造付きPSDを受け取り、パーツ構造と描画要素として立ち上げられる

### Given: 前提条件

- 入力素材 `Avatar_import.psd` が存在する。
- PSDには `Head`, `Hair`, `Eye_L`, `Eye_R`, `Mouth`, `Body` のグループがある。
- `Eye_L` グループには `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight` のレイヤーがある。
- `Hair` グループには `HairFront_L`, `HairFront_C`, `HairFront_R`, `HairBack` のレイヤーがある。
- `Guide_Rough` レイヤーは下絵として含まれている。

### When: Cubism参照操作

1. `Avatar_import.psd` を Cubism Editor で開く。
2. PSDファイルから新規モデルを作成する。
3. Parts palette で、PSDのグループ階層に対応するパーツ分類を確認する。
4. `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight` が個別の ArtMesh として配置されていることを確認する。
5. `Guide_Rough` が制作参照用の画像として扱われ、モデルの描画要素と混同されていないことを確認する。

### Then: Open Stack期待結果

- Open Editor は、レイヤー構造を持つPSDを入力素材として受け取れる。
- PSDのグループ階層は、編集時に参照できるパーツ構造として立ち上がる。
- PSDの各制作レイヤーは、個別の描画要素として確認できる。
- 下絵や参照画像は、必要に応じて入力由来情報として保持されるが、通常の可動対象と区別される。
- グループ、レイヤー、描画要素、元画像の対応関係を後続の編集・検証で追跡できる。

### 検証するACの項目

- AC-IN-001: 入力素材を受け取れること
- AC-IN-002: 素材を編集可能な内部表現へ変換できること
- AC-IN-006: 入力由来情報と欠落情報を保持できること

## SC-IN-003: PSD作成上の問題を検出し、受け入れ可否と保持できない情報を区別できる

### Given: 前提条件

- 入力素材 `Avatar_problematic.psd` が存在する。
- PSD内に同名レイヤー `Mouth` が2つある。
- 一部レイヤーに `Fill 50%` が設定されている。
- 一部レイヤーに Cubism 側で対応が不確かなブレンドまたはレイヤー効果がある。
- 一部パーツで線画、塗り、クリッピングマスクが分かれたままになっている。

### When: 実務参照操作

1. 制作者が、Cubism公式の PSD作成上の注意に照らして `Avatar_problematic.psd` を確認する。
2. 同名レイヤー、Fill、ブレンド、未統合の線画・塗り・マスクを問題候補として記録する。
3. Cubism Editor に読み込める場合は、読み込み後の色、透明度、レイヤー名、ArtMesh生成結果を確認する。
4. 読み込めない場合は、どの条件が入力失敗に関係したかを確認する。

### Then: Open Stack期待結果

- Open Editor は、入力素材を無条件に成功扱いにせず、読み込み可否、警告、保持できない情報を区別できる。
- 同名レイヤーは、後続編集で混乱し得る入力として検出される。
- `Fill` のようにCubismで再現されない可能性がある属性は、入力由来の注意点として報告される。
- ブレンド、レイヤー効果、クリッピングマスクなど、制作素材側の情報が編集対象へ変換される範囲を確認できる。
- 受け入れ可能な部分だけを編集対象へ立ち上げる場合でも、失われた情報や変換された情報を後続の検証で追跡できる。

### 検証するACの項目

- AC-IN-001: 入力素材を受け取れること
- AC-IN-002: 素材を編集可能な内部表現へ変換できること
- AC-IN-006: 入力由来情報と欠落情報を保持できること

## SC-IN-004: 既存の `.cmo3` を参照資料として受け取り、独立読み書き非要求を明示できる

### Given: 前提条件

- ユーザーが所有する既存モデル資産 `Avatar_Working.cmo3` が存在する。
- モデルには、パーツ `Head`, `Hair`, `Body` がある。
- Cubism Editor で開いた場合、複数の ArtMesh、メッシュ編集結果、デフォーマ、パラメータを確認できる。
- モデルには、物理設定が含まれている可能性がある。
- 元PSDが同じフォルダに存在するかどうかは不明である。

### When: Cubism参照操作

1. `Avatar_Working.cmo3` を Cubism Editor の Model Workspace で開く。
2. Parts palette で `Head`, `Hair`, `Body` を確認する。
3. キャンバス上で `HairFront_L` などの ArtMesh を選択し、メッシュ形状を確認する。
4. Parameter palette でモデルに設定済みのパラメータを確認する。
5. 物理設定がある場合は、物理設定の存在を確認する。

### Then: Open Stack期待結果

- Open Stack は `.cmo3` を独立解析・編集再開できることを初期成功条件にしない。
- `.cmo3` は、ユーザー所有の参照資料、手動移行元、または将来調査対象として登録できる。
- Open Stack は、`.cmo3` から直接確認できない情報を「未取得の authoring 情報」として扱い、推定済み情報と混同しない。
- ユーザーが Cubism Editor から手動で確認した構造情報、スクリーンショット、エクスポート済み runtime package を追加資料として紐付けられる。
- 読み込み失敗を曖昧なエラーにせず、`.cmo3` 独立読み書きが非対応であること、代替の移行経路、欠落情報を説明できる。

### 検証するACの項目

- AC-IN-004: Cubism runtime package を移行元・参照元として扱えること
- AC-IN-005: `.cmo3` の独立読み書きを初期成功条件にしないこと
- AC-IN-006: 入力由来情報と欠落情報を保持できること

## SC-IN-005: Cubism runtime package を受け取り、関連資産と移行限界を区別できる

### Given: 前提条件

- ランタイム向け出力フォルダ `Avatar_Runtime/` が存在する。
- フォルダには `Avatar.model3.json`, `Avatar.moc3`, `textures/texture_00.png` がある。
- フォルダには `Avatar.physics3.json`, `expressions/smile.exp3.json`, `motions/idle.motion3.json`, `Avatar.pose3.json` が含まれている。
- `.cmo3` と元PSDは、このフォルダには含まれていない。

### When: 実務参照操作

1. Cubism Viewer に `Avatar.model3.json` をドラッグ&ドロップする。
2. モデルが表示されることを確認する。
3. physics、expression、motion、pose などの関連資産が読み込まれることを確認する。
4. `Avatar.model3.json` が参照する `.moc3`、テクスチャ、関連設定ファイルの存在を確認する。
5. 元の `.cmo3` やPSDがないため、制作途中の編集履歴を直接確認できないことを確認する。

### Then: Open Stack期待結果

- Open Stack は `.model3.json` を入口として、Cubism runtime package を受け取れる。
- `.moc3`、テクスチャ、physics、expression、motion、pose などの関連資産を、入力パッケージの一部として確認できる。
- 表示・検証・移行支援に使える情報と、元制作データがないため復元できない authoring 情報を区別できる。
- runtime package 由来のモデルを Open Model Format へ移行する場合、完全な制作構造復元ではなく、移行可能な範囲と制限が明示される。
- 欠落した参照ファイルがある場合、モデル全体を曖昧に失敗扱いせず、欠落した資産種別と影響範囲を確認できる。

### 検証するACの項目

- AC-IN-004: Cubism runtime package を移行元・参照元として扱えること
- AC-IN-006: 入力由来情報と欠落情報を保持できること

## SC-IN-006: PSDの追加・差し替え時に、Source Image と Model Guide Image の対応を保持できる

### Given: 前提条件

- モデル `Avatar_Working.cmo3` は、`Face_t001_import.psd` から作成済みである。
- `Face_t001_import.psd` には `Mouth_Base`, `Mouth_Line`, `Cheek_L`, `Cheek_R` がある。
- 差し替え素材 `Face_t002_import.psd` が存在する。
- `Face_t002_import.psd` では `Mouth_Base` の画像内容が更新され、`Mouth_Shadow` が新規追加されている。
- 既存モデルには、`Mouth_Base` に対応する ArtMesh とメッシュ編集結果がある。

### When: Cubism参照操作

1. `Avatar_Working.cmo3` を開いた状態で、`Face_t002_import.psd` を読み込む。
2. Model Settings で、開いているモデルへPSDを追加または差し替える操作を選ぶ。
3. Re-import Settings で、既存PSDの差し替え対象を確認する。
4. Project palette で Source Image と Model Guide Image の対応を確認する。
5. `Mouth_Base` の ArtMesh が、新しい画像内容と既存の編集構造をどのように関連付けているかを確認する。
6. 新規レイヤー `Mouth_Shadow` が、追加された素材として確認できることを確認する。

### Then: Open Stack期待結果

- Open Editor は、開いているモデルに対してPSDを追加または差し替える入力操作を扱える。
- 差し替え前後の Source Image を区別し、どの Model Guide Image が現在の入力画像を参照しているかを確認できる。
- 既存ArtMeshに対応する画像が更新された場合、既存の編集構造を維持できる範囲と、再確認が必要な範囲を区別できる。
- 新規レイヤーは、新しく取り込まれた描画要素候補として確認できる。
- 削除、改名、追加、差し替えによって発生した対応不明の素材を、後続の検証対象として扱える。

### 検証するACの項目

- AC-IN-001: 入力素材を受け取れること
- AC-IN-002: 素材を編集可能な内部表現へ変換できること
- AC-IN-006: 入力由来情報と欠落情報を保持できること

## SC-IN-007: Texture Atlas 相当のテクスチャ配置と package metadata を保持し、Open Model Package 出力前に検証できる

### Given: 前提条件

- Open Model Package または移行中モデル `Avatar_Working_Open` が存在する。
- モデルには `texture_00` 相当の texture atlas metadata が作成済みである。
- `HairFront_L`, `EyeL_Iris`, `Mouth_Base` は Texture Atlas 上に配置済みである。
- `Sleeve_Alt` は非表示パーツに属している。
- Open Model Package 出力では、model format 本体、texture、package metadata を整合させる必要がある。

### When: Cubism参照操作

1. Cubism Editor で `Avatar_Working.cmo3` を開く。
2. Texture Atlas 編集を開く。
3. `texture_00` のサイズ、配置済みArtMesh、未配置ArtMeshを確認する。
4. Verify Placement を実行し、重なりやフレーム外はみ出しの有無を確認する。
5. Export as MOC3 file の設定で、出力対象、非表示パーツ、ガイド画像パーツの扱いを確認する。

### Then: Open Stack期待結果

- Open Stack は、入力モデルに含まれる Texture Atlas 相当のテクスチャ配置と参照情報を後続の Open Model Package 出力に利用できる形で保持できる。
- ArtMesh がどの Texture Atlas に配置されているか、未配置の要素があるかを確認できる。
- 非表示パーツやガイド画像パーツを、出力対象に含めるかどうか検証できる。
- Texture Atlas の重なり、フレーム外はみ出し、未配置要素を再出力前の問題として扱える。
- Open Model Format 本体、texture、package metadata などの出力に必要な入力由来メタデータを、失われた情報と区別して保持できる。

### 検証するACの項目

- AC-IN-002: 入力素材を Open Model Format の制作対象へ変換できること
- AC-IN-006: 入力由来情報と欠落情報を保持できること

## SC-IN-008: 既存 Open Model Package を読み込み、制作・表示・検証対象として観測できる

### Given: 前提条件

- 既存の Open Model Package `Avatar_OpenPackage_A/` が存在する。
- package には、Open Model Format のモデル本体、texture、package metadata、parameter、keyform、physics、motion、expression に相当する関連資産が含まれる。
- package は、別ツールまたは過去バージョンの Open Editor で作成されたものである。
- Open Editor、Open Viewer、Open Package Validator が利用できる。

### When: Open Stack実用操作

1. ユーザーが Open Editor で `Avatar_OpenPackage_A/` を開く。
2. ユーザーが model structure、texture 参照、parameter、keyform、physics、motion、expression、metadata を確認する。
3. ユーザーが Open Viewer で同じ package を読み込み、parameter 操作による runtime preview を確認する。
4. ユーザーが Open Package Validator を実行し、schema、参照解決、runtime load、metadata の検証結果を確認する。
5. ユーザーが読み込み元 package と読み込み後の編集対象の対応関係を確認する。

### Then: Open Stack期待結果

- Open Stack は、既存 Open Model Package を入力として読み込める。
- model format 本体、texture、関連設定、metadata の参照関係を制作・表示・検証対象として観測できる。
- 読み込んだ package は、Open Editor で編集可能な対象として扱え、Open Viewer で runtime preview できる。
- Validator は、package の必須資産、任意資産、未対応資産、欠落参照を区別して報告できる。
- 旧バージョンまたは別ツール由来の package である場合、互換変換、保持できた情報、欠落または推定した情報を区別できる。

### 参照資料

- 公式参考: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)
- 公式参考: [Loading Models and Motion](https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/)
- 公式参考: [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/)

### 検証するACの項目

- AC-IN-003: Open Model Package を読み込めること
- AC-IN-006: 入力由来情報と欠落情報を保持できること
