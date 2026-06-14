# auto-outline-v4 Contour Band Mesh Generation Algorithm

> Draft algorithm spec。Cubismの三段階自動メッシュに近く見える「輪郭帯 + 内部三角形充填 + preset別target size」という振る舞いを、Private 2D Rigging Lab向けに定義する次候補。Cubism互換や再現を主張しない。

## 0. Status Note

この文書は、初期の `auto-outline-v4-contour-band` 構想と実装前提を記録する。

その後のユーザー確認により、輪郭点を頂点化する方式、形状非依存の三角格子を切り抜く方式、逐次greedyに三角形帯を伸ばす方式には問題があることが分かった。最新の議論スナップショットは [auto-outline-v4-recursive-offset-ring.md](auto-outline-v4-recursive-offset-ring.md) を参照する。

## 1. 目的

`auto-outline-v2.6-soft-apron` は、V2.5の内部密度を保ったままalpha輪郭外側に薄いapronを足す改善である。一方、Cubismの自動メッシュ結果を見ると、単にalpha内側を三角形化しているというより、次のような別系統の考え方に見える。

1. 輪郭を少し外側から包む。
2. 輪郭付近に、輪郭をまたぐ三角形の帯を作る。
3. 内側を比較的均一な三角形で敷き詰める。
4. presetによって、輪郭帯と内部充填の三角形サイズが変わる。

`auto-outline-v4-contour-band` の目的は、この「輪郭帯を先に設計し、その内側を埋める」発想を、V2系統とは別の生成候補として明文化することである。

重要な違い:

- V2 / V2.5 / V2.6 は、alpha領域とその近傍を主に守る。
- V4 は、最初から輪郭を少し外側から包む contour band を作る。
- V4 は、大きなenvelopeで全体を包むV3とは違い、輪郭近傍だけに限定する。

## 2. 観察ベースの仮説

添付されたCubism自動メッシュの三段階結果から、次を仮説として扱う。

### 2.1 輪郭帯

輪郭上にだけ点を置くのではなく、輪郭の少し外側と少し内側に点があるように見える。三角形は輪郭の内外をまたぎ、重心が輪郭付近に来る。

```text
outer safety contour
  o-----o-----o-----o
   \   / \   / \   /
    o-o---o-o---o-o      contour band
   /   \ /   \ /   \
  o-----o-----o-----o
inner alpha contour
```

この帯により、輪郭沿いの変形時に透明抜けや端の破綻が出にくくなる。

### 2.2 内部充填

輪郭帯の内側は、規則的な矩形gridではなく、比較的均一な三角形で敷き詰められているように見える。点群はPoisson disk / Delaunay的な均一間隔に近い。

### 2.3 Preset

三段階presetは、別アルゴリズムではなく、主にtarget edge length / contour sampling pitch / interior point spacing / quality thresholdを変えているように見える。

| Preset | 見え方 | V4上の意味 |
|---|---|---|
| Low Motion | 大きめの三角形、点数少なめ | target edge length大、contour sampling粗め |
| Standard | 中間 | 標準target edge length |
| Large Motion | 小さめの三角形、輪郭点も多い | target edge length小、contour sampling細かめ |

## 3. 非ゴール

- Cubismの自動メッシュを再現すること。
- Cubism互換、`.cmo3` / `.moc3` 互換を主張すること。
- PSD / 画像内容の意味推定でpresetを自動選択すること。
- V3のような大きな外側envelopeを作ること。
- clipping後の見た目を入力にすること。
- 手動頂点編集、辺追加削除、詳細mesh editor UIの同時設計。
- 複数Drawableを意味的に結合して1つのmeshにすること。

## 4. V2.6との差分

V2.6:

```text
alpha mask
  -> simplified contour
  -> V2.5 interior mesh
  -> thin soft apron refinement
```

V4:

```text
alpha mask
  -> simplified contour
  -> outer safety contour
  -> explicit contour band
  -> interior point fill
  -> constrained / quality triangulation
```

V2.6はV2.5の不足を補うrefinementである。V4は、輪郭帯を主構造として先に作る別系統である。

## 5. 推奨パイプライン

```text
RGBA bytes
  -> alpha mask thresholding
  -> mask cleanup / island selection
  -> contour extraction
  -> curvature-aware contour simplification
  -> contour resampling by preset target edge length
  -> outer safety contour offset
  -> inner support contour / boundary samples
  -> explicit contour-band triangles
  -> interior Poisson-like sampling
  -> constrained / quality triangulation
  -> triangle quality filtering
  -> deterministic ordering and stable IDs
  -> quality summary / fallback metadata
```

## 6. Algorithm Details

### 6.1 Alpha Mask

入力はDrawable自身のRGBA alphaである。

- `alpha > threshold` を描画領域とする。
- 小さすぎるノイズ島は除去する。
- 同じDrawable内で近接する小islandは、細い透明隙間を軽くbridgeしてよい。
- 大きく離れたisland同士は強引につなげない。
- 透明holeを完全に扱うのは将来候補。v0では小holeは埋め、大holeは外周contour対象から外す判断を許容する。

ここで重要なのは、V4もsemantic recognitionをしないことである。髪、帽子、目などの意味は見ない。

### 6.2 Contour Extraction and Simplification

alpha maskから主要な外周contourを抽出する。

要求:

- pixel-levelの細かい揺れを落とす。
- 角、くびれ、尖り、髪先などの大まかな形状は残す。
- simplified contourはpresetごとにresampleされる。

resampling pitch:

```text
contourSamplePitch = targetEdgeLength * contourPitchRatio
```

初期候補:

| Preset | target edge length | contour pitch ratio |
|---|---:|---:|
| Large Motion | small | 0.75 - 1.0 |
| Standard | medium | 0.9 - 1.15 |
| Low Motion | large | 1.0 - 1.35 |

実装時の値は画像scaleと既存preset density hintに合わせて調整してよい。

### 6.3 Outer Safety Contour

輪郭をそのままmesh外周にせず、少し外側へoffsetした `outer safety contour` を作る。

```text
outerOffset = clamp(
  min(alphaBounds.width, alphaBounds.height) * presetOuterOffsetRatio,
  minOffsetPx,
  maxOffsetPx
)
```

初期候補:

| Preset | outer offset ratio | 意図 |
|---|---:|---|
| Large Motion | 2.0% - 4.0% | 大きく動かしても輪郭外側に余裕を持たせる |
| Standard | 1.5% - 3.0% | 汎用的な輪郭余白 |
| Low Motion | 1.0% - 2.0% | 硬いパーツ向けに出しすぎない |

制約:

- Drawable boundsを大きく逸脱しない。
- concave形状を大きく埋めすぎない。
- self-intersectionが出る箇所ではoffsetを局所的に下げる。
- V3 envelopeのような大きな包絡へしない。

### 6.4 Contour Band

V4の中心である。輪郭付近に、外側contourと内側support contourをつなぐ三角形帯を作る。

```text
outer safety contour
  o-----o-----o-----o
   \   / \   / \   /
    o-o---o-o---o-o
   /   \ /   \ /   \
  o-----o-----o-----o
inner support contour
```

方針:

- contour bandは明示的な構造として作る。
- 三角形の重心が輪郭付近に来るようにする。
- 外側点から遠い内部点へ直接つなぐ長いspokeを避ける。
- 1つの点へ境界triangleが集中するfanを避ける。
- band幅はtarget edge lengthの0.75倍から1.5倍程度を初期候補にする。

実装候補:

1. simplified contourを弧長基準でresampleする。
2. 各contour pointに外向きnormalを推定する。
3. outer pointを `contour + normal * outerOffset` に置く。
4. inner support pointを `contour - normal * innerOffset` に置く。
5. 隣接するouter / inner点でquad stripを作る。
6. deterministic diagonalでtriangleに割る。
7. 曲率が高い箇所はsample密度を増やす。

inner offset候補:

```text
innerOffset = targetEdgeLength * 0.35 - 0.75
```

この値は、輪郭上の三角形が薄すぎず、かつ内部triangleと自然につながる程度にする。

### 6.5 Interior Fill

contour bandの内側を均一な三角形で埋める。

推奨:

- Poisson disk的な点間隔で内部点を配置する。
- target edge lengthはpresetで変える。
- jittered gridでもよいが、矩形grid感が出ないようにする。
- interior pointsはinner support contourの内側へ置く。
- alpha外側へ遠く出た点は置かない。

初期候補:

| Preset | interior point spacing |
|---|---:|
| Large Motion | target edge length * 0.9 |
| Standard | target edge length * 1.1 |
| Low Motion | target edge length * 1.4 |

Large Motionでも過密にしすぎない。ユーザー観察では、CubismのLarge Motionは細かいが、V2系の過密meshほど全体が詰まりすぎているわけではない。

### 6.6 Triangulation

理想はconstrained triangulationである。

制約:

- outer safety contourを外周制約として扱う。
- contour band triangleは保持する。
- interior fillはDelaunayまたはquality triangulationで整える。
- contour bandとinterior fillの接続で長辺やskinny triangleを抑える。

現実的な初期実装:

- contour band triangleを明示生成する。
- interior pointsをV2系と同じDelaunay系で三角形化する。
- band内側とinteriorの境界だけ、edge length / angle / valenceでfilterまたはlocal refillする。

禁止したい形:

- alpha輪郭付近から中央の1点へ伸びる長いfan。
- contour bandより外側に大きく飛び出すtriangle。
- 透明領域だけを大きく覆うtriangle。
- 矩形grid由来に見える規則的な長方形帯。

### 6.7 Quality Filtering

最低限の品質指標:

- max edge length。
- max boundary-to-interior edge length。
- min angle。
- max triangle area。
- max vertex valence。
- contour band coverage。
- transparent-only triangle ratio。

V4固有metric候補:

```ts
type MeshGenerationContourBandMetrics = {
  algorithmId: "auto-outline-v4-contour-band";
  contourPointCount: number;
  outerContourPointCount: number;
  contourBandTriangleCount: number;
  interiorPointCount: number;
  interiorTriangleCount: number;
  maxBoundaryToInteriorEdgeLength: number;
  maxVertexValence: number;
  transparentOnlyTriangleRatio: number;
};
```

## 7. Preset Parameters

V4では、presetは次の値をまとめて変える。

| Parameter | Large Motion | Standard | Low Motion |
|---|---:|---:|---:|
| target edge length | small | medium | large |
| contour sample pitch | dense | medium | coarse |
| outer offset ratio | larger | medium | smaller |
| contour band width | medium | medium | small |
| interior point spacing | dense | medium | coarse |
| max vertex count cap | high | medium | low |

大事なのは、presetが輪郭帯と内部充填の両方に効くことである。輪郭だけ細かくして内部が粗すぎる、または内部だけ細かくして輪郭が粗すぎる状態を避ける。

## 8. Fallback

推奨fallback:

```text
auto-outline-v4-contour-band
  -> auto-outline-v2.6-soft-apron
  -> auto-outline-v2.5-soft-boundary
  -> auto-outline-v2
  -> auto-outline-v1
  -> bounds-grid
```

fallback reason候補:

- `alpha-empty`
- `contour-extraction-failed`
- `contour-band-generation-failed`
- `contour-offset-self-intersection`
- `interior-fill-failed`
- `triangulation-failed`
- `quality-threshold-failed`

fallback時も、どこで落ちたかをquality summary / provenanceに残す。

## 9. Acceptance Criteria

自動テスト:

- same inputでdeterministic output。
- `auto-outline-v4-contour-band` のsource / algorithm id / metricsが記録される。
- preset順にvertex / triangle countが増減する。
- contour band triangle countが0ではない。
- contour band coverageがV2.6より増える。
- max boundary-to-interior edge lengthが閾値内。
- max vertex valenceが閾値内。
- transparent-only triangle ratioが閾値内。
- V3のような大きなenvelopeにならない。
- fallback chainが記録される。

人間visual check:

- 輪郭の少し外側に点が並び、輪郭を包むように見える。
- 輪郭付近に三角形帯がある。
- 内部は比較的均一な三角形で埋まる。
- Low / Standard / Large Motionで三角形サイズが自然に変わる。
- Large Motionでも過密すぎない。
- 透明領域だけを大きく覆う三角形が主結果にならない。
- V2.6よりCubism風の「輪郭をかぶせる」印象に近い。

## 10. 実装境界

推奨配置:

- headless algorithm: `packages/authoring-core`。
- operation integration: `packages/operation-core`。
- method schema / provenance: 必要に応じて `packages/package-format`。
- UI: 初期はEditor defaultにしない。Mesh Toolから明示的に選べるか、sidecar比較として扱う。

次waveのsidecarとして扱う場合:

- Domain本線から分離する。
- V4をdefaultにしない。
- V2.6と比較可能な状態で実装する。
- headless testsを先に通す。
- 人間visual check後にdefault切替を議論する。

## 11. 未決事項

- contour offsetの具体値。
- inner support contourを必ず置くか、輪郭上点 + outer点だけでbandを作るか。
- constrained triangulation libraryを使うか、既存Delaunay + explicit stripで始めるか。
- large transparent holeを保持するか、v0では埋めるか。
- contour bandとinterior triangulationの接続方法。
- `auto-outline-v4-contour-band` を正式method idにするか。
