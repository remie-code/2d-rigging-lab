# auto-outline-v2.5 Soft Boundary Mesh Generation Algorithm

> Draft algorithm spec。`auto-outline-v2` をベースにし、輪郭付近だけを少し外側へ包む soft boundary で改善する次候補。`auto-outline-v3-envelope` のように大きな外側包絡へ寄せすぎず、Drawable alphaの実描画領域と自然に一致する初期meshを目指す。

## 1. 目的

`auto-outline-v2` は `auto-grid-v1` / `auto-outline-v1` より自然なtriangular meshへ近づいた。一方で、実サンプルでは次の課題が残る。

- Large Motionでもtriangleが細かすぎる。
- alpha輪郭を直接追うため、輪郭付近が硬く、細かい点が増えやすい。
- 前髪などのパーツで、描画領域に対するmeshの見え方がまだ不自然になることがある。

`auto-outline-v2.5-soft-boundary` の目的は、V2のalpha-awareな形状把握を残したまま、輪郭付近だけを少し外側へふわっと包むことである。

重要な方針:

- 大きなconvex hullや広いenvelopeで包まない。
- Drawable単体のalpha maskを正とする。
- 輪郭の外側に、bounds比率ベースの小さな余白を持たせる。
- 三角形密度はV2より大幅に粗くする。
- Cubism再現ではなく、方向性として「描画領域を自然に包む初期mesh」を目指す。

## 2. 非ゴール

- Cubismの自動mesh生成を再現すること。
- `auto-outline-v3-envelope` のように大きな外側包絡線を作ること。
- clipping後の見た目を入力にすること。
- 複数Drawableを意味的にまとめて1つのmeshにすること。
- 髪、顔、服などのsemantic分類やpreset自動選択。
- 手動頂点編集、辺追加削除、詳細mesh editor UIの同時設計。

## 3. 入力と出力

入力:

- Drawable texture RGBA bytes。
- texture width / height。
- Drawable bounds。
- preset: `large-motion` / `standard` / `low-motion`。
- alpha threshold。
- deterministic seed。

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
  - algorithm id: `auto-outline-v2.5-soft-boundary`
  - preset
  - soft boundary parameters
  - fallback reason if any
  - quality metrics summary

## 4. 推奨パイプライン

```text
RGBA bytes
  -> alpha mask thresholding
  -> mask cleanup
  -> island selection / optional small-gap bridging
  -> contour extraction
  -> curvature-aware contour simplification
  -> ratio-based soft boundary offset
  -> boundary resampling
  -> sparse interior sampling
  -> Delaunay / constrained-like triangulation
  -> soft-boundary triangle filtering
  -> quality cleanup
  -> coordinate / UV mapping
  -> deterministic ordering and stable IDs
```

## 5. Algorithm Details

### 5.1 Alpha Mask / Island Selection

入力maskはDrawable自身のRGBA alphaである。

- `alpha > threshold` を描画領域とする。
- 小さすぎるノイズ島は除去する。
- 複数islandがある場合、初期は主要island群を扱う。ただし、大きく離れたislandを強引につなげない。
- 前髪の左右束のように本来別パーツに分かれるべきものは、別Drawableであることを前提にする。

小さな透明穴や細い隙間:

- 完全に忠実に穴を保存する必要はない。
- 近接する細い隙間は、mesh変形しやすさのために軽くbridgeしてよい。
- ただし、広い透明領域をまたいで巨大な外形を作ってはいけない。

### 5.2 Contour Extraction / Simplification

V2と同様にalpha contourを抽出するが、そのままboundaryにしない。

方針:

- marching squaresまたは境界pixel tracingで輪郭を取る。
- 曲率が低い直線区間は強めに単純化する。
- 髪先、角、深いくびれなど主要シルエットは残す。
- pixel-levelの細かい揺れは落とす。

V2.5では、輪郭点の過密さを避ける。V2の自然さは残すが、点密度はかなり下げる。

### 5.3 Ratio-Based Soft Boundary Offset

V2.5の中心である。単純化したalpha contourを、bounds比率で少しだけ外側へ膨らませる。

```text
actual alpha contour
  -> simplified contour
  -> offset outward by ratio-based padding
  -> soft boundary
```

paddingは固定pxではなく、alpha boundsまたはDrawable boundsから決める。

初期候補:

```text
baseSize = min(alphaBounds.width, alphaBounds.height)
padding = clamp(baseSize * presetPaddingRatio, minPadding, maxPadding)
```

比率の方向性:

| Preset | Padding ratio | 意図 |
|---|---:|---|
| Large Motion | 1.5% - 3.0% | 変形余地を少し持たせる。ただし大きく包まない |
| Standard | 1.0% - 2.0% | 汎用的な薄い外周余白 |
| Low Motion | 0.5% - 1.5% | 硬い部品向け。ほぼalphaに近い |

制約:

- soft boundaryはDrawable boundsを大きく逸脱しない。
- alpha contourから遠すぎる透明領域を含めない。
- concaveな形状をすべて埋めて巨大なpolygonにしない。
- offset後にself-intersectionが起きる場合は、局所的にpaddingを下げるか、該当区間だけ元のcontourへ戻す。

### 5.4 Boundary Resampling

soft boundary上の点は、Cubism風に輪郭の外側を囲むが、過密にしない。

方針:

- boundary spacingはV2より大きくする。
- 曲率が高い箇所だけ点を少し増やす。
- 外周の点数はvisualに必要な最低限へ抑える。
- 輪郭点から内部点へ扇状に集中しないよう、後段のinterior spacingと近い密度にする。

### 5.5 Sparse Interior Sampling

内部点はV2より大幅に粗くする。

重要なユーザー判断:

- `Large Motion` でも、現状のV2 `Low Motion` より粗いくらいが望ましい。

初期候補:

```text
targetSpacing = sqrt(alphaArea) * presetSpacingRatio
```

比率の方向性:

| Preset | Interior spacing | 意図 |
|---|---|---|
| Large Motion | V2 Low Motionより少し粗い | 動く部品でも過密にしない |
| Standard | Large Motionより粗い | 多くの部品の初期値 |
| Low Motion | さらに粗い | 硬い部品向け |

sampling方式:

- deterministic jittered hex sampling、またはPoisson-like sampling。
- alpha mask内部、またはsoft boundary内部かつalphaに近い領域に点を置く。
- alphaから遠い透明領域には内部点を置かない。
- boundary点に近すぎる点は除外する。

### 5.6 Triangulation

理想はsoft boundaryを制約にしたconstrained triangulationである。

現実的実装:

- soft boundary点 + sparse interior pointsをDelaunay triangulationする。
- triangle centroidがsoft boundary外にあるものは除外する。
- alphaから遠すぎる透明領域だけで構成されるtriangleは除外する。
- soft boundary外周と内部点の間に自然なtriangle帯を作る。

V2.5では、alpha外のtriangleを完全排除しない。soft boundary内で、alpha輪郭の近傍にある透明領域は許容する。

ただし、次は避ける:

- 大きな透明領域をまたぐtriangle。
- 描画領域から大きく離れたtriangle。
- 1つの頂点に極端にtriangleが集中する扇状構造。
- 細長すぎるtriangle。

### 5.7 Quality Cleanup

品質指標:

- vertex count
- triangle count
- max edge length
- max triangle area
- min angle
- max vertex valence
- alpha distance summary
- soft boundary outside triangle count

補正方針:

- 「細かくしすぎない」ことを優先する。
- 大きすぎるtriangleだけ局所的に補助点を追加する。
- 細すぎるtriangleはedge flip、点除外、局所再triangulateで抑える。
- high valence頂点は局所再triangulateまたは点配置見直しで抑える。
- refinement iteration上限を持つ。

## 6. Preset方針

V2.5では、全presetでV2より粗くする。

| Preset | Boundary | Interior | Padding | 方針 |
|---|---|---|---|---|
| Large Motion | 粗め | V2 Low Motionより粗い | 中 | 変形余地は残すが過密にしない |
| Standard | より粗い | 粗い | 小〜中 | 汎用初期mesh |
| Low Motion | かなり粗い | かなり粗い | 小 | 硬い部品向け |

このpreset名は「細かさ」だけを意味しない。Large Motionは大きく動かすための余白と品質を持つが、現状のV2より密度を上げない。

## 7. V2 / V3との関係

| Algorithm | 位置付け |
|---|---|
| `auto-outline-v2` | 現状の安定候補。alpha-awareで自然だが細かすぎる |
| `auto-outline-v3-envelope` | 実験候補。外側包絡が強すぎるとDrawable描画領域から外れやすい |
| `auto-outline-v2.5-soft-boundary` | 次の主候補。V2を基礎に、輪郭付近だけsoft boundary化して粗くする |

V2.5はV3を置き換えるというより、V3の反省をV2へ戻して取り込む案である。

## 8. Acceptance Criteria

自動テストで見るべきもの:

- outputがdeterministicである。
- V2よりvertex / triangle countが明確に少ない。
- preset順の粗さが保たれる。
- soft boundary外triangleが残らない。
- alphaから遠すぎる透明領域だけのtriangleが主結果に残らない。
- fallback reasonとquality summaryが残る。

人間visual checkで見るべきもの:

- 選択Drawableの描画領域とmesh領域が自然に対応している。
- 前髪などの細いパーツで、巨大な三角形外形に膨らまない。
- 外周が少し余白を持って包まれている。
- triangle密度が現状V2より明確に粗い。
- Large Motionでも過密に見えない。
- 輪郭付近のtriangleが細かすぎたり、扇状集中したりしない。

## 9. 実装境界

推奨配置:

- headless algorithm: `packages/authoring-core`。
- operation integration: `packages/operation-core`。
- UI preview / Apply: `apps/editor`。

Editor側はalgorithm id / preset選択、preview、Apply、fallback / warning表示だけを扱う。soft boundary offsetやtriangulation詳細をUI componentへ埋め込まない。

## 10. 未決事項

- padding ratioの具体値。
- alphaから「遠すぎる」透明領域の距離閾値。
- multiple islandを初期V2.5でどこまで扱うか。
- constrained triangulation libraryを導入するか。
- V2.5を別method名として出すか、V2実装を置換するか。
- 実装後、V3を残すか実験扱いへ下げるか。
