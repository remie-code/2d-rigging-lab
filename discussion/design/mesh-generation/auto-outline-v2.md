# auto-outline-v2 Mesh Generation Algorithm

> Draft algorithm spec。Mesh ToolのUXから参照される、Drawable RGBA alpha maskベースの初期mesh生成候補。これは画面仕様ではなく、決定的な幾何処理の設計である。

## 1. 目的

`auto-outline-v2` は、PSD import後のDrawableに対して、手動編集前の自然な初期meshを生成するためのアルゴリズム候補である。

Wave62で実装された `auto-outline-v1` は、`auto-grid-v1` と比べて輪郭追従が大きく改善した。一方で、実際の出力には次の不自然さが残る。

- 輪郭点から少数の内部点へ三角形が扇状に集中する。
- 1つの頂点に接続する三角形が多すぎる。
- 内部の三角形が大きすぎる。
- grid由来の長方形領域や固定対角線の印象が残る。
- 輪郭付近と内部の密度差が急で、変形時に折れやすそうに見える。

`auto-outline-v2` の目的は、Cubismの結果を再現することではない。目的は、方向性として「矩形gridを切ったもの」ではなく「画像形状から生成された自然なtriangular mesh」に見える初期状態へ近づけることである。

## 2. 非ゴール

- Cubism互換のmesh生成を主張しない。
- Photoshop / Clip Studio Paint等の合成結果完全再現を前提にしない。
- パーツ名、画像内容、semantic roleからpresetを自動選択しない。
- 顔、髪、服などの意味理解をしない。
- 手動頂点編集、辺追加削除、詳細mesh editor UIを同時に設計しない。
- clipping後の見た目を使ったmesh生成を初期要件にしない。入力はDrawable自身のRGBA alpha maskを基本にする。

## 3. 入力と出力

入力:

- Drawable texture RGBA bytes。
- texture width / height。
- Drawable bounds。
- preset: `large-motion` / `standard` / `low-motion`。
- alpha threshold。
- deterministic seed。通常はDrawable id、texture digest、preset、thresholdから作れる。

出力:

- `MeshDto`
  - vertices
  - uvs
  - triangles
  - vertex stable ids
  - triangle stable ids
  - bounds
  - generation provenance
- generation summary
  - algorithm id: `auto-outline-v2`
  - preset
  - fallback reason if any
  - quality metrics summary

## 4. 推奨パイプライン

```text
RGBA bytes
  -> alpha mask thresholding
  -> mask cleanup
  -> contour extraction
  -> curvature-aware boundary resampling
  -> inset ring generation
  -> blue-noise / Poisson-like interior sampling
  -> constrained triangulation
  -> triangle quality refinement
  -> alpha / polygon clipping validation
  -> coordinate / UV mapping
  -> deterministic ordering and stable IDs
```

### 4.1 Alpha Mask

- `alpha > threshold` を塗り領域とする。
- 初期thresholdは低めでよい。v1互換では8前後を候補にできる。
- 完全透明、bytes欠落、dimension不整合の場合はfallbackまたはblocked resultにする。
- 小さすぎるノイズ島はpreset非依存の最小面積閾値で除去してよい。
- 1px程度の穴やノイズが輪郭を乱す場合、deterministicなmorphological close / open相当を検討する。

### 4.2 Contour Extraction

- alpha maskから外周輪郭を抽出する。
- marching squaresまたは境界pixel tracingでよい。
- 複数islandがある場合は、最大islandのみを使うのか、主要islandをすべて扱うのかを明示する。
- 穴は初期実装では無視してよいが、穴を無視したことをgeneration summaryへ残す。
- すべての輪郭点はpixel座標で保持し、後段でstage座標へ写す。

### 4.3 Curvature-Aware Boundary Resampling

輪郭点を単純な等間隔だけで間引くと、角やくびれが潰れる。`auto-outline-v2` では、輪郭を曲率に応じて再サンプリングする。

方針:

- 直線に近い区間では点間隔を広くする。
- 曲率が大きい角、くびれ、髪先、細い突起では点間隔を狭くする。
- presetごとに最小間隔と最大間隔を変える。
- 同じ入力で同じ結果になるように、局所曲率計算と点選択順序を固定する。

期待効果:

- 形状の特徴が残る。
- 外周に不要な点が増えすぎない。
- 扇状集中の原因になる過密/過疎の急変を抑える。

### 4.4 Inset Ring Generation

輪郭点から内部の少数点へ直接三角形を張ると、扇状集中と長い三角形が起きる。これを避けるため、輪郭の内側に1〜2周のinset ringを作る。

方針:

- contour pointごとに内向きnormalまたはdistance field gradientからinset方向を求める。
- ring spacingはpresetごとのtarget spacingから決める。
- `large-motion` は2ring、`standard` は1ring、`low-motion` は0〜1ringを候補にする。
- self-intersectionやmask外へ出る点は除外または局所fallbackする。
- inset ring点は輪郭点より少し粗くしてよいが、輪郭から内部への密度変化が急にならないようにする。

期待効果:

- 境界付近に自然な三角形帯ができる。
- 1頂点へ多数の三角形が集まる扇状構造を減らせる。
- 変形時に輪郭だけが硬く折れる状態を避けやすい。

### 4.5 Interior Sampling

内部点は矩形gridを主役にしない。最初からPoisson disk / blue-noise風の点群を作るのが望ましい。

実装候補:

- deterministic Poisson disk sampling。
- jittered hex grid + minimum distance rejection。
- distance fieldに基づくadaptive sampling。

方針:

- presetごとにtarget spacingを変える。
- 点はalpha mask内部にのみ置く。
- 既存のboundary / inset ring点と近すぎる点は除外する。
- 完全な乱数ではなく、texture digest等から作ったdeterministic seedを使う。
- 広い内部領域に大きな三角形が残らない密度を確保する。

期待効果:

- 長方形grid感が減る。
- 内部trianglesが均等に近くなる。
- 大きすぎる四角/三角領域が減る。

### 4.6 Constrained Triangulation

推奨はconstrained Delaunay triangulationである。境界polygonを制約として、boundary edgesを保ったまま内部点を三角形化する。

理想:

- 外周輪郭edgeを制約として保持する。
- inset ringと内部点を含めてDelaunay品質に近い三角形を作る。
- 穴を扱う場合、hole boundaryも制約として扱う。

現実的fallback:

- 通常Delaunay triangulation後、alpha mask外やpolygon外のtriangleを除外する。
- boundary edgeが崩れる場合は、boundary triangle stripを先に作ってから内部をtriangulateする。
- 依存ライブラリを導入する場合はdependency policyに従う。不要な手製triangulationで品質を落とさない。

### 4.7 Triangle Quality Refinement

triangulation後に、品質指標でmeshを補正する。

候補指標:

- max edge length
- max triangle area
- min angle
- max vertex valence
- triangle centroidがalpha mask内にあるか
- triangle edgesが大きくmask外を横切っていないか

補正候補:

- 長すぎるedgeをsplitする。
- 大きすぎるtriangleの重心またはcircumcenter付近へ点を追加して再triangulateする。
- 極端に細いtriangleをedge flipまたは点追加で改善する。
- valenceが高すぎる頂点周辺に補助点を追加し、再triangulateする。
- Laplacian smoothingを行う場合はboundary点を固定し、mask外へ出る移動を禁止する。

品質補正は無限loopにしない。iteration上限を持ち、上限到達時はgeneration summaryへ残す。

### 4.8 Coordinate Mapping / Determinism

- pixel座標をDrawable boundsへ線形変換する。
- UVはtexture座標から決定する。
- 座標丸め規則を固定する。
- 点、edge、triangleのsort順を固定する。
- stable idはalgorithm id、preset、ordered point index等から決定的に作る。
- 同じRGBA、同じpreset、同じthresholdなら同じmeshになる。

## 5. Preset方針

数値は実装前調整対象であり、この表は初期チューニング方針を示す。

| Preset | Boundary spacing | Inset ring | Interior spacing | Quality target |
|---|---|---|---|---|
| Large Motion | 細かい | 2 rings | 細かい | 輪郭と内部の密度を高くし、長辺と高valenceを強く抑える |
| Standard | 中 | 1 ring | 中 | 汎用的に破綻しにくい密度 |
| Low Motion | 粗い | 0〜1 ring | 粗い | 軽量で硬い部品向け。ただし透明矩形や巨大triangleは避ける |

実装時のパラメータは、固定pixel値だけでなく、alpha bounds sizeやalpha areaから正規化して決めるのが望ましい。

例:

```text
targetSpacing = f(sqrt(alphaArea), presetDensity)
maxEdgeLength = targetSpacing * presetMaxEdgeFactor
maxTriangleArea = targetSpacing * targetSpacing * presetAreaFactor
```

## 6. Acceptance Criteria

`auto-outline-v2` の合格条件:

- Drawableのalpha輪郭に沿った境界頂点列が生成される。
- 輪郭点から少数の内部点へ大量に集まる扇状trianglesがv1より明確に減る。
- 内部trianglesが大きすぎず、広い長方形grid領域に見えない。
- 1頂点に接続するtriangle数が極端に多い箇所を抑える。
- triangle centroidがalpha mask外にあるtriangleを主結果に残さない。
- `Large Motion` は `Standard` / `Low Motion` より細かい境界 / 内部点を持つ。
- outputはdeterministicである。
- bytes欠落、完全透明、triangulation失敗時は明示fallbackまたはblocked resultになる。
- preview -> Apply / Regenerate -> Apply のUXを壊さない。

自動テストで見るべきもの:

- deterministic output。
- vertex / triangle countがpreset順に増減する。
- max edge length / max area / max valenceが閾値内またはsummaryに記録される。
- alpha外triangle除外。
- fallback条件。

人間のvisual checkで見るべきもの:

- Cubism再現ではなく、方向性として自然な三角形meshに見えるか。
- 扇状集中や矩形grid感が目立たないか。
- 輪郭付近の密度が急に変わりすぎないか。

## 7. 実装境界

推奨配置:

- headless algorithm: `packages/authoring-core` 側。
- operation integration: `packages/operation-core` 側。
- UI preview / Apply: `apps/editor` 側。

Editor側はpreset選択、preview、Apply、fallback / warning表示を扱う。アルゴリズム詳細をUI componentへ埋め込まない。

## 8. 未決事項

- constrained triangulationに使う依存ライブラリを導入するか。
- holesと複数islandを初期v2でどこまで扱うか。
- presetごとの具体値。
- quality refinementのiteration上限。
- valence閾値をhard failureにするか、quality warningにするか。
- inset ring生成にdistance fieldを使うか、contour normalだけで始めるか。
