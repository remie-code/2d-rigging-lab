# シナリオ: Deformation Control Structure

> 参照元AC: [204_Deformation_Control_Structure.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/204_Deformation_Control_Structure.md)
> 状態: 粒度確認用ドラフト

## 0. このドラフトの目的

このファイルは、`AC-DEF` を「人が Cubism Editor でデフォーマを設定するときの操作粒度」まで降ろした場合、Undine がどの程度のシナリオを書けるかを確認するための試作である。

ここでは、Cubism Editor の画面構成を模倣することを目的にしない。ただし、Cubism Editor での参照操作を明示し、その操作によって成立している制作能力を Open Editor の検証可能な期待結果として書く。

## 1. 公式事実

- Live2D Cubism には、複数頂点をまとめて編集するためのデフォーマがある。ワープデフォーマは内部のメッシュを面状に変形し、回転デフォーマは角度指定で内部のメッシュを回転させる。
  参照: [About Deformers](https://docs.live2d.com/en/cubism-editor-manual/deformer/)
- ワープデフォーマは、選択したオブジェクトの親として作成でき、パーツ、名前、追加先、ベジェ分割数、変換分割数、サイズなどを指定できる。
  参照: [Warp Deformer](https://docs.live2d.com/en/cubism-editor-manual/making-and-placement-of-warp-deformer/)
- 回転デフォーマは、作成後に位置、角度、ハンドル長を調整し、インスペクタから対象オブジェクトの親として設定できる。標準角度も設定できる。
  参照: [Rotation Deformer](https://docs.live2d.com/en/cubism-editor-manual/making-and-rotation-of-rotationdeformer/)
- デフォーマの親子関係では、親を動かすと子へ反映されるが、子を動かしても親には影響しない。
  参照: [Parent-Child Hierarchy Structure](https://docs.live2d.com/en/cubism-editor-manual/system-of-parent-child-relation/)
- 親子関係は、デフォーマ作成時の追加先、インスペクタ、デフォーマパレットで設定できる。
  参照: [Setting Up Parent-Child Hierarchies](https://docs.live2d.com/4.2/en/cubism-editor-manual/setting-of-parent-child-relation/)
- 親ワープデフォーマから子要素の頂点がはみ出す場合、動作自体は可能だが負荷が増えるため、ハイライト表示やデフォーマ検証で確認する。
  参照: [Validate Deformer Function](https://docs.live2d.com/en/cubism-editor-manual/convenient-function-deformer/), [Combination of Parent-Child Hierarchy](https://docs.live2d.com/en/cubism-editor-manual/combintion-of-parent-child-relation/)

## 2. シナリオ記述方針

各シナリオは、次の2層を分けて書く。

- Cubism参照操作: 人が Cubism Editor で行う操作を、手順が再現できる粒度で書く
- Open Stack期待結果: このプロジェクトの Open Editor が、UI模倣ではなく同等の制作能力として満たすべき観測・構造・検証結果を書く

## SC-DEF-001: 前髪ArtMeshをワープデフォーマに格納して面状にまとめて変形できる

### 前提条件

- 既存モデルが読み込まれている。
- 前髪に相当する ArtMesh `HairFront_L`, `HairFront_C`, `HairFront_R` が存在する。
- これらの ArtMesh は、まだ前髪用ワープデフォーマの子になっていない。
- パーツ `Hair` が存在する。

### Cubism参照操作

1. `HairFront_L`, `HairFront_C`, `HairFront_R` を選択する。
2. `[Create Warp Deformer]` を実行する。
3. 作成ダイアログで、挿入先パーツに `Hair` を指定する。
4. 名前に `Warp_HairFront_Sway` を指定する。
5. 追加先に `Set as parent of selected object` を指定する。
6. 変換分割数を `5 x 5`、ベジェ分割数を `2 x 2` にする。
7. 作成後、ワープデフォーマの外枠が前髪ArtMesh全体を覆うように位置とサイズを調整する。
8. 編集レベルを `2` にし、下側の制御点を左右に少し動かして、前髪全体が一体として面状に変形することを確認する。

### Open Stack期待結果

- `Warp_HairFront_Sway` が、種別 `warp deformer` の変形制御構造として作成される。
- `Warp_HairFront_Sway` は、`HairFront_L`, `HairFront_C`, `HairFront_R` を子として保持する。
- `Warp_HairFront_Sway` は、パーツ `Hair` に所属する。
- `Warp_HairFront_Sway` は、変換分割数 `5 x 5` とベジェ分割数 `2 x 2` を観測可能な属性として保持する。
- `Warp_HairFront_Sway` の面状変形を適用したとき、子ArtMeshの頂点状態が一体として変化する。
- 操作結果として、作成されたデフォーマID、子要素ID、所属パーツ、分割数、影響範囲、警告有無を構造化して取得できる。

### 検証するACの項目

- AC-DEF-001: 変形制御構造を持てること
- AC-DEF-003: 回転的変形と面変形を区別できること
- AC-DEF-005: 変形構造を検証可能であること

## SC-DEF-002: 頭部ArtMeshを回転デフォーマに格納して顎付近を軸に顔傾きを作れる

### 前提条件

- 既存モデルが読み込まれている。
- 頭部に相当する ArtMesh または既存デフォーマ群が存在する。
- 首、胴体、腕、脚に相当する要素は、頭部選択に含めない方針が決まっている。
- パーツ `Head` が存在する。

### Cubism参照操作

1. 首、胴体、腕、脚など、頭部回転に含めないパーツをロックする。
2. 頭部に含める ArtMesh と既存デフォーマを選択する。
3. `[Create Rotation Deformer]` を実行する。
4. 作成ダイアログで、挿入先パーツに `Head` を指定する。
5. 名前に `Rot_Head_Z` を指定する。
6. 追加先に `Set as parent of selected object` を指定して作成する。
7. 回転デフォーマの位置を顎付近へ移動する。
8. 回転ハンドルの向きと長さを、顔の傾き操作に使いやすいように調整する。
9. 必要に応じて、現在の角度を標準角度として設定する。
10. 回転ハンドルを左右に動かし、頭部全体が形を潰さず回転することを確認する。

### Open Stack期待結果

- `Rot_Head_Z` が、種別 `rotation deformer` の変形制御構造として作成される。
- `Rot_Head_Z` は、選択された頭部要素を子として保持し、首・胴体・腕・脚を子に含めない。
- `Rot_Head_Z` は、回転中心、現在角度、標準角度、ハンドル長に相当する情報を観測できる。
- `Rot_Head_Z` の回転操作では、子要素が回転的に移動し、面状ワープによる縮みや潰れとして扱われない。
- 操作結果として、子要素一覧、除外されたロック対象、回転中心、標準角度、影響範囲を構造化して取得できる。

### 検証するACの項目

- AC-DEF-001: 変形制御構造を持てること
- AC-DEF-002: 局所変形と大域変形を分離できること
- AC-DEF-003: 回転的変形と面変形を区別できること
- AC-DEF-005: 変形構造を検証可能であること

## SC-DEF-003: 頭部の大域回転の下に目の局所ワープを置き、親子伝播を確認できる

### 前提条件

- `Rot_Head_Z` が存在し、頭部全体の大域回転デフォーマとして機能している。
- 左目に相当する ArtMesh `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight` が存在する。
- 左目の局所変形用ワープデフォーマ `Warp_EyeL_Blink` が存在する、または作成可能である。

### Cubism参照操作

1. `Warp_EyeL_Blink` が存在しない場合、`EyeL_White`, `EyeL_Iris`, `EyeL_Highlight` を選択してワープデフォーマを作成する。
2. デフォーマパレットまたはインスペクタで、`Warp_EyeL_Blink` の親を `Rot_Head_Z` に設定する。
3. `Rot_Head_Z` の回転ハンドルを動かし、左目全体が頭部と一緒に移動・回転することを確認する。
4. `Warp_EyeL_Blink` の制御点を動かし、左目だけが局所的に変形することを確認する。
5. `Warp_EyeL_Blink` を変形しても、`Rot_Head_Z` の回転中心や角度が変化しないことを確認する。

### Open Stack期待結果

- `Rot_Head_Z -> Warp_EyeL_Blink -> EyeL_*` の親子階層を構造化して観測できる。
- 親である `Rot_Head_Z` の変形は、子である `Warp_EyeL_Blink` とその配下ArtMeshへ伝播する。
- 子である `Warp_EyeL_Blink` の変形は、親である `Rot_Head_Z` の回転中心、角度、標準角度を変更しない。
- `Rot_Head_Z` は大域変形、`Warp_EyeL_Blink` は局所変形として区別して説明できる。
- 操作前後の差分として、親変更、階層パス、伝播対象、非伝播対象を取得できる。

### 検証するACの項目

- AC-DEF-002: 局所変形と大域変形を分離できること
- AC-DEF-004: 変形制御構造の階層を管理できること
- AC-DEF-005: 変形構造を検証可能であること

## SC-DEF-004: 首の回転デフォーマ配下にワープデフォーマを置き、回転しながら形を変えられる

### 前提条件

- 首に相当する ArtMesh `Neck` が存在する。
- 頭部側の大域デフォーマ `Rot_Head_Z` が存在する。
- 首の形状補正用ワープデフォーマを新規作成できる。

### Cubism参照操作

1. `Neck` を選択する。
2. `Warp_Neck_Shape` を作成し、`Neck` の親にする。
3. `Rot_Neck_Base` を作成し、`Warp_Neck_Shape` の親にする。
4. `Rot_Neck_Base` の位置を首の根元付近に合わせる。
5. `Rot_Neck_Base` を回転させ、首全体が回転することを確認する。
6. `Warp_Neck_Shape` の制御点を編集し、回転時に首の太さや接続部を補正できることを確認する。

### Open Stack期待結果

- `Rot_Neck_Base -> Warp_Neck_Shape -> Neck` の階層を観測できる。
- 回転的変形を担う `Rot_Neck_Base` と、面状補正を担う `Warp_Neck_Shape` が別構造として保持される。
- `Rot_Neck_Base` の変形結果に、`Warp_Neck_Shape` の局所的な形状補正を重ねて評価できる。
- 階層内の各デフォーマについて、種別、親、子、影響範囲、対象描画要素を取得できる。

### 検証するACの項目

- AC-DEF-001: 変形制御構造を持てること
- AC-DEF-003: 回転的変形と面変形を区別できること
- AC-DEF-004: 変形制御構造の階層を管理できること
- AC-DEF-005: 変形構造を検証可能であること

## SC-DEF-005: 親ワープデフォーマからはみ出した子要素を検出できる

### 前提条件

- 親ワープデフォーマ `Warp_HairFront_Sway` が存在する。
- 子ArtMesh `HairFront_L`, `HairFront_C`, `HairFront_R` が `Warp_HairFront_Sway` の配下にある。
- いずれかの子ArtMeshまたは子ワープデフォーマの頂点が、親ワープデフォーマの範囲外へ出る状態を作れる。

### Cubism参照操作

1. `Warp_HairFront_Sway` のサイズを小さくする、または子要素の制御点を動かして、一部頂点が親ワープデフォーマの外へ出る状態にする。
2. `[Show]` メニューから、親デフォーマ外にはみ出した頂点のハイライト表示を有効にする。
3. `[Modeling] -> [Deformer] -> [Validate Deformer]` を実行する。
4. 検証ダイアログで、はみ出しがある対象だけに絞り込む。
5. 問題対象の親デフォーマ、子要素、頂点位置を確認する。

### Open Stack期待結果

- `Warp_HairFront_Sway` の範囲外にある子頂点を検出できる。
- 検証結果には、親デフォーマID、子要素ID、頂点IDまたは頂点位置、はみ出し量、警告種別が含まれる。
- はみ出しは、即時失敗ではなく、制作時に調整すべき警告として扱える。
- 検証結果から、対象デフォーマを選択・表示・修正するための情報を取得できる。

### 検証するACの項目

- AC-DEF-005: 変形構造を検証可能であること
