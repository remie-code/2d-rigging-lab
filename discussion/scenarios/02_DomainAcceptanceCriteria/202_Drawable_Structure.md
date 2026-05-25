# シナリオ: Drawable Structure

> 参照元AC: [202_Drawable_Structure.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/202_Drawable_Structure.md)
> 状態: 精緻化ドラフト

## 0. このドラフトの目的

このファイルは、`AC-DRAW` を「人が Cubism Editor で描画要素を整理・表示調整・描画順制御・クリッピング設定するときの操作粒度」まで降ろし、Open Editor が満たすべき検証可能な制作能力として書き直すためのドラフトである。

ここでは、Cubism Editor の UI やファイル形式を模倣することを目的にしない。ただし、Cubism Editor での参照操作を明示し、その操作によって成立している描画要素管理能力を Open Editor の期待結果として書く。

このドラフトでは、具体的なデータモデル、永続化形式、API、内部インターフェース設計は扱わない。

## 1. 公式事実

- Cubism Editor では、モデルワークスペースに読み込まれた PSD 画像の各レイヤーまたはグループが ArtMesh として配置される。ArtMesh はテクスチャに対応するメッシュで、頂点を動かすことで画像を変形できる。
  参照: [About ArtMeshes](https://docs.live2d.com/en/cubism-editor-manual/concept-of-artmesh/)
- ArtPath は、イラストの主線をモデル上で線素材として扱うための機能であり、対象バージョンが `SDK(N/A)/Latest Cubism` の場合に利用できる。
  参照: [About ArtPaths](https://docs.live2d.com/en/cubism-editor-manual/artpath/)
- Parts は、目・鼻・口などの構成要素ごとにまとめるためのグループであり、フォルダとして多階層にできる。ArtMesh やデフォーマを同じ Parts に所属させることで、表示・ロック・選択などを部位単位で扱いやすくできる。
  参照: [About Parts](https://docs.live2d.com/en/cubism-editor-manual/parts/)
- Parts palette は、読み込まれた PSD のレイヤー順に表示され、オブジェクトの選択、表示・非表示、ロック、所属 Parts の確認に使われる。
  参照: [Parts palette](https://docs.live2d.com/en/cubism-editor-manual/partspalatte/)
- Inspector palette では、選択した ArtMesh について、名前、ID、所属 Parts、所属 Deformer、Clipping ID、反転マスク、描画順、不透明度、色合成、カリングなどを変更できる。ArtPath についても、所属 Parts、Clipping ID、描画順、不透明度などを扱える。
  参照: [Inspector palette](https://docs.live2d.com/en/cubism-editor-manual/inspector-palette/)
- 描画順は ArtMesh や ArtPath などの Drawable Object の重なり順を表し、値は `0` から `1000` の範囲で、大きい値の Drawable Object が前面に表示される。値が同じ場合は、Parts palette 一覧で上にある Parts が前面に表示される。
  参照: [About Draw Order](https://docs.live2d.com/en/cubism-editor-manual/draworder/)
- Clipping Mask は、マスクとして使う ArtMesh の ID を、切り抜かれる側の ArtMesh の `Clipping ID` に指定して設定する。複数の ArtMesh をマスクとして指定する場合はカンマ区切りで指定できる。
  参照: [Clipping Mask](https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/)
- Clipping Mask では、マスク輪郭の半透明部分の不透明度が、切り抜かれる ArtMesh に適用される。非表示や下描き設定の ArtMesh をマスクに使う場合は、組み込み用出力で問題になる可能性がある。
  参照: [Clipping Mask](https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/)
- Texture Atlas は、キャラクターなどを構成する部品を平面上に並べた画像である。Texture Atlas 編集では、テクスチャの追加・削除、各部品のサイズ変更、表示状態の ArtMesh のみの配置、全 ArtMesh の配置、未配置状態からの開始、配置検証などを扱える。
  参照: [Edit Texture Atlas](https://docs.live2d.com/cubism-editor-manual/texture-atlas-edit/?locale=en_us)

## 2. リポジトリ事実

- 対象ACは [202_Drawable_Structure.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/202_Drawable_Structure.md) である。
- `AC-DRAW-001` は、描画要素をテクスチャ、表示状態、描画順、所属 Parts、マスク・クリッピングなどの描画制約と結びつけて管理できることを求めている。
- `AC-DRAW-002` は、描画要素がどの Parts または構造に所属するかを管理できることを求めている。
- `AC-DRAW-003` は、表示・非表示、不透明度、描画順を制御できることを求めている。
- `AC-DRAW-004` は、ある描画要素を別の描画要素の範囲内に制限する表現を含む描画制約を扱えることを求めている。

## 3. 仮説・未確定事項

- AC本文は `描画要素` の具体型を限定していない。このドラフトでは ArtMesh を必須対象とし、ArtPath は対象バージョンが許す場合に扱うべき描画要素として仮置きする。
- AC本文は、非表示状態、不透明度 `0%`、Texture Atlas 未配置の関係を定義していない。このドラフトでは、それらを同一視せず、別々に観測・説明できることを期待結果として置く。
- AC本文は、描画順が同値の場合のタイブレーク方針を定義していない。このドラフトでは、Cubism 参照操作では公式仕様を示し、AI-native 期待結果ではプロジェクト側の方針として説明可能であることに留める。
- ArtPath を正式サポート対象に含めるか、Cubism 5 最新ターゲット限定の追加能力として扱うかは未決である。

## 4. シナリオ記述方針

各シナリオは、次の2層を分けて書く。

- Cubism参照操作: 人が Cubism Editor で行う実用操作を、手順が再現できる粒度で書く
- Open Stack期待結果: このプロジェクトの Open Editor が、UI模倣ではなく同等の制作能力として満たすべき観測・制御・検証結果を書く

各シナリオは `Given / When / Then` を明示する。`When` は Cubism 参照操作、`Then` は AI-native 期待結果に対応する。

## SC-DRAW-001: PSD由来のArtMeshを描画要素として識別・管理できる

### Given / 前提条件

- 既存モデルが読み込まれている。
- 左目周辺の PSD レイヤー由来の ArtMesh `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight` が存在する。
- それぞれの ArtMesh には、テクスチャに対応するメッシュと、モデル上で区別できる名前またはIDがある。

### When / Cubism参照操作

1. Parts palette で `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight` を順に選択する。
2. Inspector palette で、各 ArtMesh の名前、ID、所属 Parts、所属 Deformer、Clipping ID、描画順、不透明度を確認する。
3. View area 上で各 ArtMesh を選択し、選択対象のメッシュが対応する画像領域と結びついていることを確認する。
4. Texture Atlas 編集を開き、各 ArtMesh がモデル用画像として扱われるか、未配置であれば未配置として確認できることを確認する。

### Then / Open Stack期待結果

- `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight` を、モデル内の個別の描画要素として識別できる。
- 各描画要素について、テクスチャ由来の画像領域、メッシュ、表示状態、描画順、不透明度、所属 Parts、クリッピング設定の有無を観測できる。
- 描画要素が Texture Atlas 上に配置済みか未配置かを、表示・非表示や不透明度とは別の状態として説明できる。
- 描画要素を選択したとき、どの画像領域が描画される対象なのかをユーザーが確認できる。

### 検証するACの項目

- AC-DRAW-001: 描画要素を管理できること

## SC-DRAW-002: 描画要素をParts階層へ所属させ、部位単位で整理できる

### Given / 前提条件

- 既存モデルが読み込まれている。
- Parts `Head` が存在する。
- Parts `Head` の下に、左目用の子 Parts `Eye_L` を作成または選択できる。
- ArtMesh `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight` は、まだ `Eye_L` に整理されていない。

### When / Cubism参照操作

1. Parts palette で `Head` の配下に `Eye_L` を用意する。
2. `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight` を選択する。
3. Parts palette の移動操作、または Inspector palette の所属 Parts 指定で、選択した ArtMesh を `Eye_L` に所属させる。
4. Parts palette 上で `Head -> Eye_L -> EyeL_*` の階層として確認する。
5. `Eye_L` を選択して、左目に属する描画要素だけを選択・表示・ロック操作の対象にできることを確認する。

### Then / Open Stack期待結果

- `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight` が `Head/Eye_L` に所属する描画要素として扱われる。
- 描画要素の所属 Parts を変更しても、描画要素そのもののテクスチャ、メッシュ、描画順、不透明度、クリッピング設定は意図せず失われない。
- Parts 階層から、部位単位で対象描画要素を列挙・選択・説明できる。
- Parts 階層による整理と、描画順による前後関係を混同せずに扱える。

### 検証するACの項目

- AC-DRAW-001: 描画要素を管理できること
- AC-DRAW-002: 描画要素の階層・所属を扱えること

## SC-DRAW-003: 表示・非表示と不透明度を別々に制御できる

### Given / 前提条件

- 既存モデルが読み込まれている。
- ArtMesh `Mouth_Inside`, `Mouth_Teeth`, `Mouth_Lip` が存在する。
- これらの ArtMesh は Parts `Mouth` に所属している。

### When / Cubism参照操作

1. Parts palette で `Mouth_Teeth` の表示を非表示に切り替える。
2. View area で `Mouth_Teeth` だけが表示されなくなることを確認する。
3. Inspector palette で `Mouth_Lip` の不透明度を `100%` から `40%` に変更する。
4. View area で `Mouth_Lip` が半透明として表示され、`Mouth_Inside` の表示状態は変わらないことを確認する。
5. Parts `Mouth` 全体の表示を切り替え、配下の描画要素が部位単位で表示・非表示になることを確認する。

### Then / Open Stack期待結果

- 描画要素ごとの表示・非表示を制御できる。
- 描画要素ごとの不透明度を制御できる。
- 非表示状態と不透明度 `0%` を、制作上の状態として区別して説明できる。
- Parts 単位の表示切り替えが、配下の描画要素へどう反映されているかを確認できる。
- 表示・非表示や不透明度の変更後も、描画順、所属 Parts、クリッピング設定は意図せず変更されない。

### 検証するACの項目

- AC-DRAW-001: 描画要素を管理できること
- AC-DRAW-003: 描画順と表示状態を制御できること

## SC-DRAW-004: 描画順を変更して前後関係を制御できる

### Given / 前提条件

- 既存モデルが読み込まれている。
- ArtMesh `Face_Base`, `HairFront_Lock`, `EyeL_Iris` が存在し、同じ画面領域で重なって見える状態を作れる。
- 初期状態では `Face_Base` が顔の土台、`EyeL_Iris` が目、`HairFront_Lock` が前髪として表示される想定である。

### When / Cubism参照操作

1. Inspector palette で `Face_Base` の描画順を `300` にする。
2. Inspector palette で `EyeL_Iris` の描画順を `500` にする。
3. Inspector palette で `HairFront_Lock` の描画順を `700` にする。
4. View area で、`HairFront_Lock` が `EyeL_Iris` より前面に表示され、`EyeL_Iris` が `Face_Base` より前面に表示されることを確認する。
5. `HairFront_Lock` の描画順を `450` に下げ、前髪が目より背面に回ることを確認する。
6. 必要に応じて描画順の3D表示または描画順スライダーを使い、前後関係を視覚的に確認する。

### Then / Open Stack期待結果

- 描画要素ごとの描画順を変更できる。
- 重なり合う描画要素について、描画順の値に基づく前後関係を確認できる。
- 描画順変更は、表示・非表示、不透明度、所属 Parts、クリッピング設定とは独立した制御として扱われる。
- 描画順が同値の場合の扱いは、公式 Cubism 参照仕様またはプロジェクト側の採用方針として説明できる。
- 描画順の変更前後で、どの描画要素の前後関係が変わったかをユーザーが確認できる。

### 検証するACの項目

- AC-DRAW-001: 描画要素を管理できること
- AC-DRAW-003: 描画順と表示状態を制御できること

## SC-DRAW-005: 白目ArtMeshをマスクとして黒目とハイライトをクリッピングできる

### Given / 前提条件

- 既存モデルが読み込まれている。
- ArtMesh `EyeL_White` が左目の白目領域として存在する。
- ArtMesh `EyeL_Iris` と `EyeL_Highlight` が、白目領域からはみ出し得る位置に存在する。
- `EyeL_Iris` と `EyeL_Highlight` は、まだ `EyeL_White` でクリッピングされていない。

### When / Cubism参照操作

1. `EyeL_White` を選択し、Inspector palette で ID を確認またはコピーする。
2. `EyeL_Iris` を選択し、Inspector palette の `Clipping ID` に `EyeL_White` の ID を指定する。
3. `EyeL_Highlight` を選択し、同じく `Clipping ID` に `EyeL_White` の ID を指定する。
4. View area で、黒目とハイライトが白目領域内に制限されることを確認する。
5. `EyeL_White` を選択した状態で Reverse Clipping を実行し、`EyeL_White` をマスクとして使用している描画要素を確認する。

### Then / Open Stack期待結果

- `EyeL_White` をマスク描画要素として、`EyeL_Iris` と `EyeL_Highlight` をクリッピングされる描画要素として扱える。
- クリッピング関係を、描画要素間の制約として確認できる。
- クリッピング結果として、黒目とハイライトの表示領域が白目の範囲に制限されていることを確認できる。
- マスク側の描画要素と、マスクを参照している描画要素を相互にたどれる。
- クリッピング設定の追加後も、各描画要素の所属 Parts、描画順、不透明度は意図せず変更されない。

### 検証するACの項目

- AC-DRAW-001: 描画要素を管理できること
- AC-DRAW-004: マスク・クリッピング等の描画制約を扱えること

## SC-DRAW-006: 複数ArtMeshを組み合わせたクリッピング制約を確認できる

### Given / 前提条件

- 既存モデルが読み込まれている。
- ArtMesh `Mask_Eyelid_Upper` と `Mask_Eyelid_Lower` が、まぶた形状のマスクとして存在する。
- ArtMesh `EyeL_Shadow` が、上下まぶたの内側だけに表示したい影として存在する。

### When / Cubism参照操作

1. `Mask_Eyelid_Upper` と `Mask_Eyelid_Lower` の ID を確認する。
2. `EyeL_Shadow` を選択する。
3. Inspector palette の `Clipping ID` に、上下まぶたのマスクIDをカンマ区切りで指定する。
4. View area で、`EyeL_Shadow` が指定したマスク範囲内に制限されることを確認する。
5. 片方のマスク ArtMesh の表示や不透明度を変更した場合に、マスクとして使う描画要素の制作意図が崩れていないか確認する。

### Then / Open Stack期待結果

- 1つの描画要素に対して、複数のマスク描画要素を参照するクリッピング制約を扱える。
- クリッピングされる描画要素から、参照している複数のマスク描画要素を確認できる。
- マスクとして使われる描画要素から、それを参照している描画要素を確認できる。
- マスク描画要素の表示状態や不透明度が、通常描画とクリッピング結果にどう影響するかをユーザーに説明できる。
- 複数マスクの指定が不正、欠落、削除済み参照を含む場合、制作時に修正すべき問題として確認できる。

### 検証するACの項目

- AC-DRAW-004: マスク・クリッピング等の描画制約を扱えること

## SC-DRAW-007: Texture Atlas上の配置状態を描画要素の管理情報として確認できる

### Given / 前提条件

- 既存モデルが読み込まれている。
- ArtMesh `Ribbon_L`, `Ribbon_R`, `HairBack` が存在する。
- `Ribbon_L` と `Ribbon_R` は表示状態、`HairBack` は非表示状態である。
- Texture Atlas 編集を開ける状態である。

### When / Cubism参照操作

1. Texture Atlas 編集を開く。
2. 新規 Texture Atlas 設定で、表示状態のモデル用画像のみを配置する設定を選ぶ。
3. `Ribbon_L` と `Ribbon_R` が Texture Atlas に配置され、非表示の `HairBack` が未配置として扱われることを確認する。
4. `HairBack` を表示状態に戻し、Texture Atlas のモデル用画像リストで未配置の描画要素として確認する。
5. 配置検証を実行し、重なりや枠外配置がある場合に対象 ArtMesh を確認する。

### Then / Open Stack期待結果

- 描画要素が参照するテクスチャまたは Texture Atlas 上の配置状態を確認できる。
- Texture Atlas への配置済み、未配置、表示状態による配置対象外を区別して説明できる。
- 表示・非表示を切り替えた描画要素が、Texture Atlas 上でどの扱いになるかを確認できる。
- Texture Atlas 上の重なりや枠外配置を、描画要素に紐づく制作上の検証結果として扱える。
- Texture Atlas の配置状態を確認しても、描画要素の所属 Parts、描画順、クリッピング設定は意図せず変更されない。

### 検証するACの項目

- AC-DRAW-001: 描画要素を管理できること

## SC-DRAW-008: ArtPathを対象バージョン限定の描画要素として扱える

### Given / 前提条件

- モデルの対象バージョンが ArtPath を利用できる設定である。
- 頬の主線に相当する ArtPath `CheekLine_L` が存在する、または作成できる。
- Parts `Face` が存在する。

### When / Cubism参照操作

1. ArtPath Tools で `CheekLine_L` を作成する、または既存の `CheekLine_L` を選択する。
2. Parts palette で `CheekLine_L` が描画オブジェクトとして表示されることを確認する。
3. Inspector palette で `CheekLine_L` の所属 Parts を `Face` にする。
4. Inspector palette で `CheekLine_L` の描画順と不透明度を変更する。
5. View area で、主線の表示、前後関係、不透明度が意図した状態になることを確認する。

### Then / Open Stack期待結果

- 対象バージョンが許す場合、ArtPath を ArtMesh とは異なる種類の描画要素として扱える。
- `CheekLine_L` の所属 Parts、表示状態、描画順、不透明度を確認・制御できる。
- ArtPath が対象外のモデルでは、サポート外または変換不能な描画要素として理由を説明できる。
- ArtMesh と ArtPath の違いを保ったまま、共通の描画要素管理対象として選択・表示・前後関係確認を行える。

### 検証するACの項目

- AC-DRAW-001: 描画要素を管理できること
- AC-DRAW-002: 描画要素の階層・所属を扱えること
- AC-DRAW-003: 描画順と表示状態を制御できること
