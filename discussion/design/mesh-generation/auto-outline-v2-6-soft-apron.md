# auto-outline-v2.6 Soft Apron Mesh Generation Algorithm

> Draft algorithm spec。`auto-outline-v2.5-soft-boundary` の良い内部密度を維持しつつ、alpha輪郭の外側に薄い boundary apron を作り、頭頂部など輪郭付近でmeshが足りない領域を自然に包む次候補。

## 1. 目的

`auto-outline-v2.5-soft-boundary` は、V2と比べてLarge Motionのmesh密度と全体の自然さを大幅に改善した。現時点では、そのまま使ってもよい水準に近い。

一方で、実サンプルの目視確認では次の課題が残る。

- 頭頂部など、alpha輪郭の外側近傍にmeshが届かず、描画領域を包み切れていないように見える箇所がある。
- 境界付近をふわっとさせる際、無理に遠い内部点へ接続すると、長いtriangleや局所的な不自然さが出やすい。
- 境界改善のために全体密度を上げると、V2.5で得られた「粗さ」の利点を失う。

`auto-outline-v2.6-soft-apron` の目的は、V2.5の内部mesh密度を保ったまま、輪郭付近だけに薄い三角形の帯を追加して、描画領域を少し外側から自然に包むことである。

重要な方針:

- V2.5の内部sampling / densityを大きく変えない。
- alpha輪郭の外側に、bounds比率ベースの薄い apron 領域を作る。
- apron領域は、中央付近のtriangleと似たサイズの複数triangleで埋める。
- 境界点を遠い内部点へ無理につながない。
- V3のような大きな外側包絡にはしない。

## 2. 非ゴール

- Cubismの自動mesh生成を再現すること。
- `auto-outline-v3-envelope` のように大きなenvelopeで全体を包むこと。
- mesh密度を全体的に細かくして境界問題を隠すこと。
- 複数Drawableを意味的に結合して1つのmeshを作ること。
- clipping後の見た目を入力にすること。
- 手動頂点編集、辺追加削除、詳細mesh editor UIの同時設計。

## 3. V2.5からの差分

V2.5:

```text
alpha mask
  -> simplified contour
  -> ratio-based soft boundary
  -> boundary + interior points
  -> triangulation
```

V2.6:

```text
alpha mask
  -> simplified contour
  -> inner boundary / outer apron boundary
  -> apron ring points
  -> V2.5 interior points
  -> triangulation with apron-aware quality filters
```

主な差分は、soft boundaryを単なる外側輪郭として扱うのではなく、元輪郭と外側輪郭の間に「薄い境界帯」を明示的に作る点である。

## 4. 推奨パイプライン

```text
RGBA bytes
  -> alpha mask thresholding
  -> mask cleanup
  -> island selection / optional small-gap bridging
  -> contour extraction
  -> curvature-aware contour simplification
  -> inner contour resampling
  -> outward offset by ratio
  -> outer apron boundary
  -> apron ring sampling
  -> V2.5-style sparse interior sampling
  -> apron-aware triangulation
  -> long-edge / fan / skinny-triangle filtering
  -> local refill for boundary gaps
  -> coordinate / UV mapping
  -> deterministic ordering and stable IDs
```

## 5. Algorithm Details

### 5.1 Alpha Mask and Contour

入力はV2.5と同じくDrawable自身のRGBA alphaである。

- `alpha > threshold` を描画領域とする。
- 小さすぎるノイズ島は除去する。
- 大きく離れたisland同士を強引につなげない。
- 細い透明隙間は、mesh変形の扱いやすさのために軽くbridgeしてよい。

輪郭はpixel-levelの細かい揺れを落とし、主要な角、くびれ、髪先、装飾の大まかな形を残す。

### 5.2 Apron Boundary

V2.6では、元のalpha contourを直接mesh外周にしない。単純化した輪郭から、外側へ少しだけoffsetした `outer apron boundary` を作る。

```text
inner contour = simplified alpha contour
outer apron boundary = inner contour offset outward by ratio-based padding
```

paddingは固定pxではなく、alpha boundsまたはDrawable boundsの比率で決める。

初期候補:

```text
baseSize = min(alphaBounds.width, alphaBounds.height)
apronPadding = clamp(baseSize * presetApronRatio, minPadding, maxPadding)
```

比率の方向性:

| Preset | Apron ratio | 意図 |
|---|---:|---|
| Large Motion | 2.0% - 4.0% | 大きく動かす部品向けに、輪郭外側の余白を少し増やす |
| Standard | 1.5% - 3.0% | 汎用的な薄い境界帯 |
| Low Motion | 1.0% - 2.0% | 硬い部品向け。外側へ出しすぎない |

制約:

- outer apron boundaryはDrawable boundsを大きく逸脱しない。
- alpha contourから離れすぎる透明領域を含めない。
- concave形状を大きく埋めて、別物のシルエットにしない。
- self-intersectionが出る区間では、局所的にpaddingを下げる。

### 5.3 Apron Ring Sampling

V2.6の中心である。inner contourとouter apron boundaryの間を、中央付近のtriangleと近いサイズの複数triangleで埋める。

```text
outer apron boundary
  o---o---o---o
   \ / \ / \ /
    o---o---o     apron ring
   / \ / \ / \
  o---o---o---o
inner contour
```

方針:

- apron領域に1本から2本の中間ringを置く。
- ring spacingは内部meshの代表edge lengthに近づける。
- 境界点から遠い内部点へ長く接続しない。
- 扇状に1点へ集まるtriangleを避ける。
- 境界帯だけが過密にならないよう、V2.5のLarge Motionより細かくしない。

実装候補:

1. inner contourとouter apron boundaryを同じ弧長基準でresampleする。
2. 各サンプル位置について、内外の対応点を作る。
3. apron幅がtarget edge lengthより広い箇所だけ中間ringを追加する。
4. 隣接する内外点をquad stripとして扱い、deterministic diagonalで三角形化する。
5. その後、内部点と合わせて局所Delaunayまたはedge flipで品質を整える。

この方式により、境界帯は「遠くの内部点へ無理につなぐ」のではなく、中央付近に近いサイズのtriangleを複数並べて埋められる。

### 5.4 Interior Sampling

内部samplingはV2.5を維持する。

重要な判断:

- V2.6は、内部mesh密度を上げるための案ではない。
- Large Motionの密度は、現在のV2.5 Large Motionを大きく超えない。
- 境界不足はapron ringで補い、内部samplingの過密化で解決しない。

### 5.5 Apron-Aware Triangulation

理想:

- outer apron boundaryを外周制約としたconstrained triangulation。
- inner contourからouter apron boundaryまでを安定したtriangle stripとして保持する。

現実的な初期実装:

- apron stripは明示的に生成する。
- interior pointsはV2.5と同様にtriangulateする。
- apron stripとinterior meshの接続部だけ、長辺・細長triangleを避けるように補助点またはedge flipで整える。

禁止したい形:

- outer boundaryの点から遠い内部点へ伸びる長いtriangle。
- 1つの内部点へ多数のboundary triangleが集中するfan。
- 境界帯に極端に細長いtriangleが並ぶ状態。
- alphaから遠く離れた透明領域だけを覆うtriangle。

### 5.6 Boundary Gap Refill

V2.5で見られた「頭頂部などmeshに含まれていない領域」は、apron生成後にgapとして検出できる可能性がある。

初期候補:

```text
for each contour segment:
  if distance from contour to nearest mesh edge is too small inward-only
     or contour protrudes outside generated mesh:
       add apron samples around that segment
       retriangulate local strip
```

ただし、gap refillは局所的に行う。全体を大きく包み直してはいけない。

## 6. Acceptance Criteria

自動テストで見るべきもの:

- outputがdeterministicである。
- V2.5と同程度の内部密度を保つ。
- V2.5より境界外側のcoverageが増える。
- outer apron boundaryがDrawable boundsを大きく逸脱しない。
- 長すぎるboundary-to-interior edgeが閾値内に抑えられる。
- high valenceなfan集中が増えない。
- triangle countがV2.5から大幅に増えすぎない。
- fallback reasonとquality summaryが残る。

人間visual checkで見るべきもの:

- 頭頂部などの外周近傍が、V2.5より自然にmeshに含まれる。
- 境界付近に、中央付近と似たサイズのtriangle帯が並ぶ。
- V3のような大きな包絡にならない。
- 前髪などの複雑形状で、描画領域から大きく外れた三角形群にならない。
- Large Motionでも密度が細かくなりすぎない。
- 境界帯が扇状集中や長いspokeに見えない。

## 7. V2.5 / V3との関係

| Algorithm | 位置付け |
|---|---|
| `auto-outline-v2.5-soft-boundary` | 現在の主候補。内部密度と全体形状は十分良い |
| `auto-outline-v2.6-soft-apron` | V2.5の境界不足だけを狙う次候補 |
| `auto-outline-v3-envelope` | 実験候補。外側包絡が強すぎるため、現在の方向性からは遠い |

V2.6はV2.5の密度や全体方針を捨てない。V2.5で得られた自然な粗さを守りつつ、輪郭外側の薄いapronだけを追加する。

## 8. 実装境界

推奨配置:

- headless algorithm: `packages/authoring-core`。
- operation integration: `packages/operation-core`。
- UI preview / Apply: `apps/editor`。

Editor側はalgorithm id / preset選択、preview、Apply、fallback / warning表示だけを扱う。apron ring samplingやtriangulation詳細をUI componentへ入れない。

実装時は、V2.5を既定として残したまま、V2.6を比較可能な別methodとして追加するのが望ましい。人間visual checkで明確に優位と判断してから既定切替を行う。

## 9. 未決事項

- apron ratioの具体値。
- apron ringを1本にするか、幅に応じて2本まで増やすか。
- apron stripを明示三角形化するか、全点Delaunay後に品質filterするか。
- gap refillを初期実装に含めるか。
- V2.6を `auto-outline-v2.6-soft-apron` と呼ぶか、より短いmethod idにするか。
