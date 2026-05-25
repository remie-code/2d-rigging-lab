# シナリオ: Model Verification

> 参照元AC: [212_Model_Verification.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/212_Model_Verification.md)
> 状態: 粒度確認用ドラフト

## 0. このドラフトの目的

このファイルは、`AC-VERIFY` を「人間またはAIエージェントが、Live2Dモデルの正しさを判断するために何を観測できるべきか」という検証シナリオへ降ろすための試作である。

ここでは、Cubism Editor / Cubism Viewer の画面構成を模倣することを目的にしない。ただし、Cubismで人が行う参照操作・実用操作を明示し、その操作によって成立している検証能力を Open Editor の観測可能な期待結果として書く。

データモデル、API、内部I/F、永続化形式、UI部品設計はこのドラフトの範囲外とする。必要な情報種別は書くが、スキーマ名・メソッド名・イベント設計は定義しない。

## 1. 公式事実

- Cubism の ArtMesh は、PSDレイヤー等に割り当てられたメッシュであり、頂点を動かすことで画像を変形して表情や動きを作る。
  参照: [About ArtMeshes](https://docs.live2d.com/en/cubism-editor-manual/concept-of-artmesh/)
- Parts は目・鼻などの構成要素ごとに分類する単位であり、ArtMeshやデフォーマを同じパーツに所属させることで、表示・非表示、ロック、選択などをパーツ単位で扱える。組み込み時もパーツIDで表示などを制御する。
  参照: [About Parts](https://docs.live2d.com/en/cubism-editor-manual/parts/)
- Parts パレットでは、ArtMesh、ArtPath、ワープデフォーマ、回転デフォーマ、グルー等の表示・非表示、ロック、名前またはIDによる絞り込み、Parts Settings などを扱える。
  参照: [Parts palette](https://docs.live2d.com/en/cubism-editor-manual/partspalatte/)
- Parameter パレットは、オブジェクトの変形度合いを数値に結び付けた「パラメータ」を管理する。パラメータには現在値、最小値、既定値、最大値、ID、キーなどがある。
  参照: [Parameter palette](https://docs.live2d.com/en/cubism-editor-manual/palametorpalatte/)
- Live2D公式は、特別な事情がない場合の標準パラメータID、最小値、既定値、最大値を示している。例として `ParamAngleX` は `-30 / 0 / 30`、目や口の開閉は通常閉じを `0`、通常開きを `1` とする方針が示されている。
  参照: [Standard Parameter List](https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/)
- 描画順は ArtMesh や ArtPath などの Drawable Object の重なり順を表し、値は `0` から `1000`、値が大きいほど前面に表示される。同じ値の場合は Parts パレット上で上にあるものが前面になる。描画順はパラメータ値に応じて変化させることもできる。
  参照: [About Draw Order](https://docs.live2d.com/en/cubism-editor-manual/draworder/)
- クリッピングマスクは、マスクに使う ArtMesh のIDを Clipping ID に指定して使用する。複数ArtMeshはカンマ区切りで指定できる。マスクの不正状態には警告があり、組み込み用ファイル出力後にSDKで読み込むと、アプリの強制終了、組み込み用ファイルの読み込み失敗、Cubism EditorとSDKの表示差異などが起きる可能性がある。
  参照: [Clipping Mask](https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/)
- Texture Atlas は、キャラクター等を構成する部品を平面上に並べた画像であり、組み込み時の最終段階で作成する。Texture Atlas 編集では、配置済み・未配置の画像一覧、Visible and Unplaced の絞り込み、Verify Placement、重なりや範囲外の確認ができる。ArtMesh が重なったりテクスチャ外へはみ出したりすると、モデル上の見た目が不正になる。
  参照: [Edit Texture Atlas](https://docs.live2d.com/en/cubism-editor-manual/texture-atlas-edit/)
- デフォーマ検証では、親ワープデフォーマからはみ出した子デフォーマや ArtMesh の頂点をハイライトできる。はみ出しは動作上ただちに問題を起こすものではないが、負荷やデータ量が増えるため、モデル作成時には調整が推奨される。
  参照: [Validate Deformer Function](https://docs.live2d.com/en/cubism-editor-manual/convenient-function-deformer/)
- Cubism の物理演算では、顔の振り向きに合わせた髪揺れなどをリアルタイムに設定・書き出しできる。物理演算はグループ単位で扱われ、入力設定、出力設定、物理モデル設定、計算FPS、振り子プレビューを持つ。計算FPSを変更すると物理演算の出力結果が変化するため、動きの確認が必要である。
  参照: [About Physics](https://docs.live2d.com/en/cubism-editor-manual/physics-operation/)
- 組み込み用データには `.moc3`、`.model3.json`、テクスチャ `.png`、`.physics3.json`、`.userdata3.json`、`.cdi3.json`、`.motion3.json` などがあり、`.model3.json` は MOC3 ファイルやテクスチャファイル等を結びつける情報を持つ。
  参照: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)
- Cubism Viewer (for OW) は Cubismで作成したデータを検証するためのViewerであり、物理演算、アイ・トラッキング、複数モーション再生、表情設定、ポーズ設定などを確認できる。読み込めるモデルとモーションは組み込み用に書き出したデータであり、編集用の `.cmo3` や `.can3` は読み込めない。
  参照: [About Cubism Viewer (for OW)](https://docs.live2d.com/en/cubism-editor-manual/cubism3-viewer-for-ow/)
- Cubism Viewer では、`.moc3` または `.model3.json` をドラッグ&ドロップしてモデルを読み込める。`.model3.json` を読み込むと、モーション、表情、物理演算などの設定ファイルもまとめて読み込める。
  参照: [Loading Models and Motion](https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/)

## 2. リポジトリ事実

- 参照元ACは `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/212_Model_Verification.md` である。
- `AC-VERIFY-001` は、描画要素、メッシュ、変形制御構造、パーツ、パラメータ、物理設定、表情、モーション等を構造化して観測できることを要求している。
- `AC-VERIFY-002` は、任意のパラメータ値におけるモデル状態を観測できることを要求している。
- `AC-VERIFY-003` は、編集操作の前後でモデル構造または状態がどう変化したかを観測できることを要求している。
- `AC-VERIFY-004` は、メッシュの不自然な潰れ、テクスチャの穴、隠れ部分の不足、描画順、クリッピング、パラメータ中間値、物理挙動、出力資産読み込み失敗などの破綻検出または検証支援を要求している。
- `AC-VERIFY-005` は、定義済みACまたは機能シナリオに基づく合否判断支援を要求している。

## 3. 仮説

- Live2D公式資料は、一般的な制作操作、表示・検証機能、出力ファイルの役割を説明しているが、「正しいLive2Dモデル」の全自動判定基準を一意には定義していない。
- メッシュ潰れ、隠れ部分の不足、描画順の破綻、パラメータ中間値での形状破綻、物理挙動の過剰振動または不自然な停止は、作品意図や対象アバター仕様に依存するため、最終的な閾値や合否ルールはACまたはシナリオ側で定義する必要がある。
- このドラフトで使う `Head`、`Hair`、`EyeL_White`、`ParamAngleX`、`idle.motion3.json` などの名前は、検証シナリオを具体化するための代表名であり、Live2D公式が必須名として要求しているものではない。ただし標準パラメータIDは公式リストに寄せる。
- Open Editor は Cubism UI を再現しなくてよいが、人間またはAIエージェントが同等以上にモデル構造・状態・差分・破綻候補・合否根拠を観測できる必要がある。

## 4. シナリオ記述方針

各シナリオは、次の3層を分けて書く。

- Given: モデル、出力資産、パラメータ値、破綻条件などの前提条件を書く。
- When: Cubism参照・実用操作として、人が Cubism Editor / Cubism Viewer で行う確認手順を再現できる粒度で書く。
- Then: Open Stack期待結果として、このプロジェクトの Open Editor が UI模倣ではなく同等の検証能力として満たすべき観測・差分・判定支援結果を書く。

Then では「何を観測できれば合否判断を支援できるか」を書き、内部スキーマ、API、永続化形式、画面部品は定義しない。

## SC-VERIFY-001: モデル全体の構造を棚卸しして観測できる

### Given: 前提条件

- 既存モデルが読み込まれている。
- モデルには、パーツ `Head`, `Hair`, `Body` が存在する。
- モデルには、ArtMesh `EyeL_White`, `EyeL_Iris`, `Mouth_Inside`, `HairFront_L`, `HairFront_R` が存在する。
- モデルには、デフォーマ `Rot_Head_Z`, `Warp_HairFront_Sway` が存在する。
- モデルには、パラメータ `ParamAngleX`, `ParamAngleY`, `ParamEyeLOpen`, `ParamMouthOpenY` が存在する。
- モデルには、物理演算グループ `HairFront_Physics`、表情 `exp_smile`、モーション `idle.motion3.json` が関連付いている。

### When: Cubism参照・実用操作

1. Parts パレットで `Head`, `Hair`, `Body` を展開し、ArtMesh、ワープデフォーマ、回転デフォーマの表示状態を確認する。
2. Parts パレットの名前またはID絞り込みで `EyeL`、`HairFront`、`Rot_Head` を検索する。
3. 対象 ArtMesh を選択し、所属パーツ、親デフォーマ、描画順、クリッピングID、表示状態を Inspector で確認する。
4. Parameter パレットで `ParamAngleX`, `ParamEyeLOpen`, `ParamMouthOpenY` のID、最小値、既定値、最大値、現在値、キー有無を確認する。
5. 物理演算設定で `HairFront_Physics` の入力設定、出力設定、物理モデル設定、計算FPSを確認する。
6. Cubism Viewer に組み込み用 `.model3.json` を読み込み、関連する表情、モーション、物理演算が読み込まれることを確認する。

### Then: Open Stack期待結果

- 描画要素、メッシュ、デフォーマ、パーツ、パラメータ、物理設定、表情、モーション、出力資産を、区別可能な構造として観測できる。
- 各描画要素について、名前またはID、種別、所属パーツ、親デフォーマ、描画順、クリッピング関係、表示状態を確認できる。
- 各パラメータについて、名前またはID、最小値、既定値、最大値、現在値、キー設定の有無を確認できる。
- 物理設定について、グループ、入力パラメータ、出力パラメータ、計算FPS、プレビュー対象を確認できる。
- 表情、モーション、物理設定、テクスチャなどの関連資産が、モデルと関連付いているかを確認できる。
- 構造の棚卸し結果から、未参照資産、存在しないID参照、空デフォーマ、空パーツ、未配置テクスチャなどの検証候補を提示できる。

### 検証するACの項目

- AC-VERIFY-001: モデル構造を観測できること
- AC-VERIFY-005: ACまたはシナリオに基づき合否判断できること

## SC-VERIFY-002: パラメータ値ごとのモデル状態を観測できる

### Given: 前提条件

- 既存モデルが読み込まれている。
- `ParamAngleX` は最小値 `-30`、既定値 `0`、最大値 `30` を持つ。
- `ParamEyeLOpen` は最小値 `0`、既定値 `1`、最大値 `1` を持つ。
- 左目に相当する ArtMesh `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight`, `EyeL_UpperLid` が存在する。
- `ParamAngleX` と `ParamEyeLOpen` によって、左目周辺の形状または表示状態が変化する。

### When: Cubism参照・実用操作

1. Parameter パレットで `ParamAngleX = 0`, `ParamEyeLOpen = 1` に設定し、左目周辺の基準状態を確認する。
2. `ParamEyeLOpen = 0` に設定し、閉じ目状態を確認する。
3. `ParamEyeLOpen = 0.5` に設定し、中間状態を確認する。
4. `ParamAngleX = -30`, `0`, `30` の各状態で、左目周辺の形状、描画順、クリッピング、表示状態を確認する。
5. 必要に応じて、同じパラメータ組み合わせを Cubism Viewer でも確認する。

### Then: Open Stack期待結果

- 任意のパラメータ値セットに対して、その時点のモデル状態を観測できる。
- 各状態について、現在のパラメータ値、表示中の描画要素、主要ArtMeshの頂点状態、描画順、透明度、クリッピング状態、デフォーマ適用後の見た目を確認できる。
- 最小値、既定値、最大値だけでなく、`ParamEyeLOpen = 0.5` のような中間値の状態も確認できる。
- 同じ状態を再観測したとき、合否判断に使える程度に一貫した結果を得られる。
- パラメータ範囲外の値を指定した場合は、検証不能、範囲外入力、または補正後値として扱ったことを区別して説明できる。

### 検証するACの項目

- AC-VERIFY-002: モデル状態をパラメータ値ごとに観測できること
- AC-VERIFY-004: 破綻を検出できること
- AC-VERIFY-005: ACまたはシナリオに基づき合否判断できること

## SC-VERIFY-003: 編集操作の前後差分を観測できる

### Given: 前提条件

- 既存モデルが読み込まれている。
- ArtMesh `HairFront_L` が存在し、所属パーツは `Hair` である。
- `HairFront_L` の描画順は `620` である。
- `HairFront_L` は親デフォーマ `Warp_HairFront_Sway` の子である。
- `ParamAngleX = 0`, `ParamEyeLOpen = 1` の基準状態を観測できる。

### When: Cubism参照・実用操作

1. 編集前の `HairFront_L` について、所属パーツ、親デフォーマ、描画順、クリッピングID、頂点状態、表示状態を確認する。
2. Inspector で `HairFront_L` の描画順を `620` から `760` に変更する。
3. 必要に応じて、`ParamAngleX = -30`, `0`, `30` の各状態で前髪が顔や目より前面に出るかを確認する。
4. 変更後の `HairFront_L` について、同じ観測項目を確認する。
5. 変更前後を比較し、描画順以外の構造が意図せず変わっていないかを確認する。

### Then: Open Stack期待結果

- 操作前後の差分として、`HairFront_L` の描画順が `620` から `760` に変更されたことを観測できる。
- 所属パーツ、親デフォーマ、クリッピングID、頂点状態、パラメータ範囲など、変更対象外の項目が変わっていないことを確認できる。
- 描画順変更によって、対象パラメータ値で前髪がどの描画要素の前後に移動したかを確認できる。
- 差分結果には、意図した変更、派生して見た目へ影響した変更、意図せず変化した候補を分けて提示できる。
- 差分は「編集操作の成功」だけでなく、「編集操作によってモデルの正しさが悪化していないか」を判断する根拠として使える。

### 検証するACの項目

- AC-VERIFY-003: 操作前後の差分を観測できること
- AC-VERIFY-004: 破綻を検出できること
- AC-VERIFY-005: ACまたはシナリオに基づき合否判断できること

## SC-VERIFY-004: パラメータ中間値でのメッシュ潰れを検出支援できる

### Given: 前提条件

- 既存モデルが読み込まれている。
- 口に相当する ArtMesh `Mouth_Upper`, `Mouth_Lower`, `Mouth_Inside` が存在する。
- `ParamMouthOpenY` は最小値 `0`、既定値 `0`、最大値 `1` を持つ。
- `ParamMouthOpenY = 0` では口閉じ、`ParamMouthOpenY = 1` では口開きのキー形状が設定されている。
- `ParamMouthOpenY = 0.5` 付近で、`Mouth_Inside` の一部三角形が極端に細くなる、反転する、または見た目上の穴を作る可能性がある。

### When: Cubism参照・実用操作

1. Parameter パレットで `ParamMouthOpenY = 0` に設定し、口閉じ状態を確認する。
2. `ParamMouthOpenY = 1` に設定し、口開き状態を確認する。
3. `ParamMouthOpenY = 0.25`, `0.5`, `0.75` に設定し、中間状態を確認する。
4. 中間状態で、`Mouth_Inside` のメッシュ線、テクスチャ表示、隣接 ArtMesh との隙間、描画順を確認する。
5. 必要に応じて、メッシュ編集表示または拡大表示で、頂点の交差や不自然な潰れを確認する。

### Then: Open Stack期待結果

- `ParamMouthOpenY` の複数サンプル値に対して、口周辺のモデル状態を連続的に観測できる。
- 中間値でだけ発生するメッシュ潰れ、極端に細い三角形、頂点交差、見た目上の穴、隣接部品との隙間を破綻候補として提示できる。
- 破綻候補が発生するパラメータ値、対象 ArtMesh、対象頂点または面、見た目への影響範囲を確認できる。
- `0` と `1` のキー状態が正常でも、`0.5` の中間補間で破綻するケースを検証対象に含められる。
- 合否判定では、シナリオで指定された許容範囲を超える潰れまたは穴を `Fail`、判断に人間確認が必要なものを `Needs review` として扱える。

### 仮説

- 三角形面積、頂点交差、穴、隙間のどれを「不自然な潰れ」としてFailにするかは、Live2D公式資料だけでは一意に決まらない。このシナリオでは、口内が見える用途で見た目上の穴または反転が生じるものを破綻候補として扱う。

### 検証するACの項目

- AC-VERIFY-002: モデル状態をパラメータ値ごとに観測できること
- AC-VERIFY-004: 破綻を検出できること
- AC-VERIFY-005: ACまたはシナリオに基づき合否判断できること

## SC-VERIFY-005: Texture Atlas の未配置・重なり・範囲外を検出支援できる

### Given: 前提条件

- 組み込み用出力を前提にしたモデルが読み込まれている。
- Texture Atlas が作成済みである。
- 表示状態の ArtMesh `EyeL_Highlight` が Texture Atlas に未配置である、または `HairBack_R` が他のArtMeshと重なっている。
- 出力対象には `.moc3`, `.model3.json`, テクスチャ `.png` が含まれる。

### When: Cubism参照・実用操作

1. `[Edit Texture Atlas]` を開く。
2. Model Guide Image List で `Visible and Unplaced` を選択し、表示中だが未配置の ArtMesh を確認する。
3. Texture Atlas 上で `HairBack_R` の配置を確認し、他ArtMeshとの重なりやテクスチャ範囲外へのはみ出しを確認する。
4. `[Verify Placement]` を実行し、現在のテクスチャに配置された ArtMesh の検証結果を確認する。
5. Canvas View を Texture Atlas View に切り替え、出力時の見た目を確認する。

### Then: Open Stack期待結果

- 表示状態かつ出力対象である ArtMesh が Texture Atlas に未配置の場合、対象を破綻候補として検出できる。
- Texture Atlas 上で ArtMesh が重なっている、またはテクスチャ範囲外へはみ出している場合、対象を破綻候補として検出できる。
- 破綻候補について、対象 ArtMesh、所属パーツ、配置状態、重なり相手、範囲外方向、出力見た目への影響を確認できる。
- 未配置や重なりが出力資産の読み込み失敗ではなく見た目の欠落・穴として現れる場合、その違いを説明できる。
- 出力前検証として、未配置・重なり・範囲外がないことをシナリオ合格条件にできる。

### 検証するACの項目

- AC-VERIFY-001: モデル構造を観測できること
- AC-VERIFY-004: 破綻を検出できること
- AC-VERIFY-005: ACまたはシナリオに基づき合否判断できること

## SC-VERIFY-006: 描画順の破綻をシナリオ基準で検出支援できる

### Given: 前提条件

- 既存モデルが読み込まれている。
- 左目周辺に ArtMesh `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight`, `EyeL_UpperLid` が存在する。
- シナリオ上の期待順序として、通常開き状態では `EyeL_Highlight` が `EyeL_Iris` より前面、`EyeL_Iris` が `EyeL_White` より前面であることが決まっている。
- `ParamAngleX` によって、目周辺の描画順または形状が変化する可能性がある。

### When: Cubism参照・実用操作

1. `ParamAngleX = 0`, `ParamEyeLOpen = 1` に設定し、左目の通常開き状態を確認する。
2. Inspector または Draw Order 表示で、`EyeL_White`, `EyeL_Iris`, `EyeL_Highlight`, `EyeL_UpperLid` の描画順を確認する。
3. `ParamAngleX = -30`, `30` に設定し、横向き状態でハイライトや黒目が白目の背面に隠れていないかを確認する。
4. 3D表示または描画順表示で、目周辺の重なり順を確認する。
5. 必要に応じて、描画順を変更した前後の状態を比較する。

### Then: Open Stack期待結果

- 対象パラメータ値ごとに、目周辺 ArtMesh の描画順と実際の前後関係を観測できる。
- シナリオで定義した期待順序に反して、`EyeL_Highlight` が `EyeL_Iris` または `EyeL_White` の背面に回る場合、描画順破綻候補として提示できる。
- 同じ描画順値を持つ ArtMesh がある場合、Parts パレット上の順序によって前後関係が決まることを考慮して説明できる。
- 描画順がパラメータに割り当てられている場合、どのパラメータ値で順序が変わるかを確認できる。
- 合否判定では、期待順序と観測順序の差分を根拠として提示できる。

### 仮説

- 「どのArtMeshが前面にあるべきか」は作品意図に依存する。Live2D公式資料は描画順の仕組みを説明しているが、目・髪・服などの正しい前後関係を一律には定義していない。

### 検証するACの項目

- AC-VERIFY-002: モデル状態をパラメータ値ごとに観測できること
- AC-VERIFY-004: 破綻を検出できること
- AC-VERIFY-005: ACまたはシナリオに基づき合否判断できること

## SC-VERIFY-007: クリッピングマスクの破綻を検出支援できる

### Given: 前提条件

- 既存モデルが読み込まれている。
- `EyeL_Iris` と `EyeL_Highlight` は、`EyeL_White` をマスクとして使う想定である。
- `EyeL_Iris` の Clipping ID には `EyeL_White` が指定されている。
- `EyeL_White` が非表示、削除済み、キー範囲外で不可視、または出力対象外になる状態を作れる。

### When: Cubism参照・実用操作

1. `EyeL_Iris` を選択し、Inspector の Clipping ID を確認する。
2. Clipping ID の参照先 `EyeL_White` を選択し、表示状態、所属パーツ、出力対象かどうかを確認する。
3. `ParamEyeLOpen = 0`, `0.5`, `1` の各状態で、マスクが可視または有効な状態にあるかを確認する。
4. Clipping Mask の警告が出る状態を作り、警告内容を確認する。
5. 組み込み用 `.model3.json` を Cubism Viewer に読み込み、Cubism Editor表示とViewer表示に差がないかを確認する。

### Then: Open Stack期待結果

- Clipping ID が存在しない ArtMesh を参照している場合、破綻候補として検出できる。
- マスク ArtMesh が非表示、出力対象外、キー範囲外で不可視、または削除済みの場合、状態と影響を区別して提示できる。
- 複数 Clipping ID が指定されている場合、参照先の存在、有効性、出力対象性を個別に確認できる。
- Cubism Editor上では許容されるが、組み込み用出力やSDK読み込みで問題化し得る警告として扱える。
- クリッピング破綻候補について、対象 ArtMesh、マスク ArtMesh、発生パラメータ値、出力資産への影響を確認できる。

### 検証するACの項目

- AC-VERIFY-001: モデル構造を観測できること
- AC-VERIFY-002: モデル状態をパラメータ値ごとに観測できること
- AC-VERIFY-004: 破綻を検出できること
- AC-VERIFY-005: ACまたはシナリオに基づき合否判断できること

## SC-VERIFY-008: 物理挙動の過剰振動または不自然な停止を検証支援できる

### Given: 前提条件

- 既存モデルが読み込まれている。
- 物理演算グループ `HairFront_Physics` が存在する。
- `HairFront_Physics` は `ParamAngleX` または `ParamBodyAngleX` を入力として扱う。
- `HairFront_Physics` は `ParamHairFrontSwing` を出力として扱う。
- 計算FPSは `60` に設定されている。
- シナリオ上の期待として、頭を左右に振った後、前髪揺れは一定時間内に収束し、停止時に不自然な跳ね返りを続けないことが決まっている。

### When: Cubism参照・実用操作

1. `[Modeling] -> [Open Physics Settings]` を開き、`HairFront_Physics` の入力設定、出力設定、物理モデル設定、計算FPSを確認する。
2. 振り子プレビューで、`ParamAngleX` を急に `-30` から `30` へ変化させた場合の揺れを確認する。
3. 同じ動きを Cubism Viewer で再生し、前髪の振動、収束、停止状態を確認する。
4. 計算FPSを変更した場合は、出力結果が変化することを確認し、シナリオの基準FPSへ戻して再確認する。
5. 必要に応じて、`idle.motion3.json` 再生中の前髪揺れを確認する。

### Then: Open Stack期待結果

- 物理演算グループ、入力パラメータ、出力パラメータ、計算FPS、物理モデル設定を観測できる。
- 指定した入力変化に対して、出力パラメータまたは対象部位の時系列状態を観測できる。
- 過剰振動、不自然な停止、収束しない揺れ、入力停止後の大きな跳ね返りを破綻候補として提示できる。
- 計算FPSの違いによる結果差を、物理設定の差分または検証条件の違いとして説明できる。
- 合否判定では、シナリオで指定された基準FPS、入力波形、許容振幅、収束時間を根拠として扱える。

### 仮説

- 「過剰振動」や「不自然な停止」の閾値は、Live2D公式資料だけでは一意に決まらない。このシナリオでは、対象用途ごとに基準FPS、入力波形、許容振幅、収束時間を定義する前提で検証支援を書く。

### 検証するACの項目

- AC-VERIFY-001: モデル構造を観測できること
- AC-VERIFY-002: モデル状態をパラメータ値ごとに観測できること
- AC-VERIFY-004: 破綻を検出できること
- AC-VERIFY-005: ACまたはシナリオに基づき合否判断できること

## SC-VERIFY-009: 組み込み用出力資産の読み込み失敗を検出支援できる

### Given: 前提条件

- 組み込み用出力として、`model.moc3`, `model.model3.json`, `texture_00.png`, `model.physics3.json`, `idle.motion3.json`, `exp_smile.exp3.json` がある。
- `model.model3.json` は、MOC3、テクスチャ、物理設定、表情、モーションへの参照を持つ。
- `texture_00.png` または `model.physics3.json` を欠落させた状態を作れる。
- Cubism Viewer で `.model3.json` を読み込める環境がある。

### When: Cubism参照・実用操作

1. Cubism Viewer を起動する。
2. `model.model3.json` を Viewer にドラッグ&ドロップし、モデルが読み込まれるかを確認する。
3. 表情 `exp_smile`、モーション `idle.motion3.json`、物理演算が読み込まれているかを確認する。
4. `texture_00.png` を欠落させた状態で再度 `model.model3.json` を読み込み、読み込み結果またはエラーを確認する。
5. `model.physics3.json` を欠落させた状態で再度 `model.model3.json` を読み込み、表示自体と物理挙動の違いを確認する。

### Then: Open Stack期待結果

- `.model3.json` から参照される MOC3、テクスチャ、物理設定、表情、モーションなどの資産存在を確認できる。
- 読み込み失敗、部分読み込み、表示はできるが物理設定が欠けている状態を区別して提示できる。
- 欠落資産がどの参照から必要とされているか、どの検証項目に影響するかを確認できる。
- Cubism Viewer で読み込み可能な出力資産と、編集用 `.cmo3` / `.can3` のようにViewer検証対象外の資産を区別できる。
- 合否判定では、シナリオで必須とした出力資産がすべて読み込めることを `Pass` 条件にできる。

### 検証するACの項目

- AC-VERIFY-001: モデル構造を観測できること
- AC-VERIFY-004: 破綻を検出できること
- AC-VERIFY-005: ACまたはシナリオに基づき合否判断できること

## SC-VERIFY-010: シナリオ基準に基づき Pass / Fail / Needs review を判断支援できる

### Given: 前提条件

- SC-VERIFY-001 から SC-VERIFY-009 までの検証結果がある。
- 検証結果には、構造棚卸し、パラメータ状態、操作差分、破綻候補、出力資産読み込み結果が含まれる。
- シナリオ上の合格条件として、次が決まっている。
  - 必須参照IDがすべて存在する。
  - 表示状態の出力対象 ArtMesh が Texture Atlas に配置されている。
  - 目周辺の期待描画順に違反がない。
  - クリッピングマスクに存在しない参照または出力対象外参照がない。
  - `ParamMouthOpenY` の中間値で口内に穴または反転がない。
  - `HairFront_Physics` は基準FPSで指定時間内に収束する。
  - `.model3.json` による出力資産読み込みが成功する。

### When: Cubism参照・実用操作

1. Cubism Editor で各破綻候補を個別に確認する。
2. Cubism Viewer で出力資産を読み込み、表情、モーション、物理演算、モデル表示を確認する。
3. 各シナリオの合格条件に対し、確認結果を照合する。
4. 人間判断が必要な見た目の違和感について、対象パラメータ値と対象部位を記録する。

### Then: Open Stack期待結果

- 各シナリオの観測結果を、`Pass`, `Fail`, `Needs review`, `Not applicable` のような判断状態へ整理できる。
- `Fail` について、該当AC、該当シナリオ、対象部位、対象パラメータ値、根拠となる観測結果を確認できる。
- `Needs review` について、人間が確認すべき見た目、対象状態、未確定の閾値を説明できる。
- `Not applicable` について、該当するモデル機能や出力資産が存在しないため検証対象外であることを説明できる。
- 合否判断は、公式資料の一般事実、リポジトリ上のAC、シナリオで定義した仮説・基準を混同せずに提示できる。

### 検証するACの項目

- AC-VERIFY-003: 操作前後の差分を観測できること
- AC-VERIFY-004: 破綻を検出できること
- AC-VERIFY-005: ACまたはシナリオに基づき合否判断できること

## SC-VERIFY-011: 検証結果を AI-readable report として出力できる

### Given: 前提条件

- `RiggedAvatar_A.openpackage` に対して、構造棚卸し、runtime state inspection、差分検証、破綻検出、シナリオ合否判断が実行済みである。
- 検証結果には、少なくとも1件の `Pass`、1件の `Fail`、1件の `Needs review`、1件の `Not applicable` が含まれる。
- 例として、欠落 texture、存在しない clipping mask 参照、parameter 中間値でのメッシュ潰れ、Cubism互換出力の非対象項目が含まれる。
- AIエージェントが後続レビューまたは修復提案に利用できる report 出力を要求している。

### When: Cubism参照・実用操作

1. Cubism では、Texture Atlas、Clipping Mask、Deformer validation、Viewer読み込み、MOC3整合性検証などを個別に確認する。
2. 検証者は、公式資料で確認できる事実と、作品固有の見た目判断、Open StackのAC/シナリオ基準を分けて記録する。

### When: Open Stack実用操作

1. ユーザーまたはAIエージェントが Open Package Validator で `RiggedAvatar_A.openpackage` を検証する。
2. ユーザーまたはAIエージェントが Open Viewer の runtime state inspection 結果を report に含める。
3. ユーザーまたはAIエージェントが、対象シナリオID、AC ID、対象ID、観測証拠、影響範囲、修復候補を含む AI-readable report を出力する。
4. AIエージェントが report を読み取り、Fail と Needs review の対象を抽出する。

### Then: Open Stack期待結果

- report は、`Pass`、`Fail`、`Needs review`、`Not applicable` などの状態を機械処理可能な形で保持する。
- 各検証項目には、check ID、対象ID、対象種別、関連AC、関連シナリオ、根拠、観測値、期待値、影響範囲が含まれる。
- `Fail` と `Needs review` には、修復候補、必要な人間確認、再検証手順が含まれる。
- Cubism公式資料に基づく参考事実、Open Stack の設計判断、未決事項、作品意図に依存する判断が混同されない。
- AIエージェントは report から、対象を安定IDで選択し、修復提案または追加レビューを開始できる。

### 参照資料

- 公式参考: [Clipping Mask](https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/)
- 公式参考: [Edit Texture Atlas](https://docs.live2d.com/en/cubism-editor-manual/texture-atlas-edit/)
- 公式参考: [Verify model integrity](https://docs.live2d.com/cubism-sdk-manual/moc3-consistency/)
- 公式参考: [Cubism Core API Reference](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/)

### 検証するACの項目

- AC-VERIFY-003: 操作前後の差分を観測できること
- AC-VERIFY-004: 破綻を検出または検証支援できること
- AC-VERIFY-005: ACまたはシナリオに基づき合否判断できること
- AC-VERIFY-006: 検証結果を AI-readable report として出力できること

## 5. 未決事項

- メッシュ潰れのFail閾値を、三角形面積、辺長比、頂点交差、見た目上の穴、またはレンダリング差分のどれで定義するか。
- 隠れ部分の不足を検出するための対象モーション範囲、想定トラッキング範囲、必須の裏塗り・余白基準をどこで定義するか。
- 物理挙動の「過剰振動」「不自然な停止」を、振幅、速度、加速度、収束時間、見た目レビューのどれで合否判定するか。
- 出力資産読み込み検証の基準環境を、Cubism Viewer (for OW)、Cubism Viewer for Unity、対象SDKランタイム、または複数環境のどれにするか。
- `Pass / Fail / Needs review / Not applicable` の判断語彙をこのプロジェクトの共通語彙として採用するか。
