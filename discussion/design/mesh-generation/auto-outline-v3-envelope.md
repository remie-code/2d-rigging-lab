# auto-outline-v3 Envelope Mesh Generation Algorithm

> Draft algorithm spec。`auto-outline-v2` の次候補として、輪郭追従を強めるのではなく、Drawableのalpha形状を外側から包み込む envelope boundary を使う初期mesh生成方針を定義する。

## 1. 目的

`auto-outline-v2` は、矩形gridやv1の扇状集中から大きく改善し、自然なtriangular meshにかなり近づいた。

一方で、実サンプルでは次の課題が残る。

- Low Motionでもtriangleが細かく、Large Motionではさらに過密に感じる。
- 外周がalpha輪郭を追いすぎるため、輪郭付近に細かい点と細いtriangleが集まりやすい。
- Cubismの自動生成結果と比べると、外周が「輪郭をなぞる」方向に寄りすぎている。
- 変形用meshとして見ると、画像輪郭の完全再現より、透明領域を少し含んででも部品全体を包む膜の方が自然に見える。

`auto-outline-v3-envelope` の目的は、alpha輪郭そのものをmesh boundaryにするのではなく、alpha形状を外側からゆるく包む envelope boundary を作り、その内側を粗めで均質なtriangleにすることである。

Cubism互換や再現を主張しない。目標は、変形時に扱いやすく、見た目にも自然な初期meshを得ることである。

## 2. 非ゴール

- Cubismの自動mesh生成結果を再現すること。
- alpha輪郭をpixel-perfectに追うこと。
- 透明穴、細い髪束、細かな凹凸をすべて境界として保存すること。
- semantic recognitionやpart種別によるpreset自動選択。
- 手動頂点編集UI、詳細mesh editor UIの同時設計。
- clipping後の見た目を入力にすること。入力はDrawable自身のRGBA alpha maskを基本にする。

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
  - algorithm id: `auto-outline-v3-envelope`
  - preset
  - envelope parameters
  - fallback reason if any
  - quality metrics summary

## 4. 推奨パイプライン

```text
RGBA bytes
  -> alpha mask thresholding
  -> mask cleanup
  -> contour extraction
  -> contour simplification
  -> outward envelope generation
  -> envelope smoothing / resampling
  -> optional inner support ring
  -> coarse deterministic interior sampling
  -> constrained / clipped triangulation
  -> quality refinement
  -> coordinate / UV mapping
  -> deterministic ordering and stable IDs
```

## 5. Algorithm Details

### 5.1 Alpha Mask / Contour

Alpha maskと輪郭抽出は `auto-outline-v2` と同じ考え方でよい。

- `alpha > threshold` を塗り領域とする。
- 小さすぎるノイズ島は除去する。
- 最大islandまたは主要islandを輪郭対象にする。
- holesは初期V3では無視してよいが、summaryへ残す。

### 5.2 Contour Simplification

V3では輪郭をそのままboundaryにしない。まずalpha contourを単純化する。

方針:

- Douglas-Peucker相当、または曲率と距離閾値によるdeterministic simplificationを行う。
- 細かい凹凸やpixel-levelの揺れを落とす。
- 大きな角、くびれ、主要シルエットは残す。
- V2よりboundary候補点は少なくてよい。

期待効果:

- 外周の過密点を減らす。
- 後段のoutward envelopeが細かいノイズに引っ張られない。

### 5.3 Outward Envelope Generation

V3の中心である。単純化した輪郭を外側へ膨らませ、透明領域を少し含むmesh boundaryを作る。

```text
actual alpha contour
  -> simplified contour
  -> offset outward by padding
  -> smoothed envelope boundary
```

方針:

- offset量は固定pxだけでなく、alpha bounds sizeやpresetに応じて決める。
- 凹部は少し埋め、凸部は包む。
- 細い突起を完全には追わず、部品全体を包む膜として扱う。
- self-intersectionが起きた場合は、局所的にpaddingを下げるか、polygon union / cleanup相当を行う。
- envelopeはDrawable boundsを大きく逸脱しないようclampする。

期待効果:

- mesh boundaryがalpha輪郭に張り付きすぎない。
- 透明領域を含む自然な外周triangleができる。
- 外周付近の細すぎるtriangleを減らせる。

### 5.4 Envelope Resampling

Envelope boundaryは、alpha contourより粗く、かつ均等に再サンプリングする。

方針:

- boundary spacingはV2より大きめにする。
- Large Motionでも現在のV2より少し粗くする。
- 角や主要なカーブには最低限の点を残す。
- Cubism風の「外周を囲む点列」に近づけるが、再現は目標にしない。

### 5.5 Inner Support Ring

Envelopeだけで内部点へ直接triangulateすると、境界から中央へ長いtriangleが出る可能性がある。

そのため、必要に応じて実alpha輪郭付近またはenvelope内側へ薄いsupport ringを置く。

方針:

- support ringはalpha contourそのものを過密に追わない。
- Large Motion / Standardでは1 ringを候補にする。
- Low Motionでは0 ringまたは非常に粗いringでよい。
- support ringは外周を補助するためのもので、輪郭点密集を復活させない。

期待効果:

- envelope boundaryと内部点の間に自然なtriangle帯ができる。
- 外周から中央への長辺を減らせる。

### 5.6 Coarse Interior Sampling

V3ではV2より内部点密度を下げる。

方針:

- deterministic Poisson-like / jittered hex samplingを使う。
- target spacingは全presetでV2より大きめにする。
- Low Motionはさらに粗くする。
- Large Motionでも、現V2のLow Motion程度か、それより少し粗い密度を候補にする。
- ただしmax edge / max areaが大きすぎる場合は局所的に補助点を追加する。

期待効果:

- triangleが細かすぎる印象を減らす。
- 変形用meshとして扱いやすい密度にする。
- grid由来ではない、粗めで均質なtriangular meshにする。

### 5.7 Triangulation

理想は、envelope boundaryを制約にしたconstrained triangulationである。

現実的fallback:

- 通常Delaunay後、envelope外triangleを除外する。
- boundary stripを先に作り、内部をtriangulateする。
- full constrained triangulationが未実装の場合は、summaryにinterim pathとして明示する。

V3ではalpha mask外triangleを完全に避ける必要はない。envelope内であれば、透明領域を含むtriangleは許容する。描画はtexture alphaで抜けるためである。

ただし、envelope外のtriangleは除外する。

### 5.8 Quality Refinement

品質指標:

- max edge length
- max triangle area
- min angle
- max vertex valence
- boundary triangle aspect ratio
- envelope outside triangle count
- support ring usage

補正方針:

- V2より「細かくしすぎない」ことを優先する。
- 長すぎるedgeや巨大triangleだけ局所補正する。
- valenceが高すぎる頂点には補助点追加または局所再triangulateを行う。
- refinement iteration上限を持つ。

## 6. Preset方針

数値は実装前調整対象である。V3では、全presetでV2より粗めにする。

| Preset | Envelope padding | Boundary spacing | Support ring | Interior spacing | 方針 |
|---|---|---|---|---|---|
| Large Motion | 中 | 中 | 1 ring | 中 | 動く余地は確保するが、現V2ほど細かくしない |
| Standard | 中 | やや粗い | 0〜1 ring | やや粗い | 汎用初期mesh。外周包絡を優先 |
| Low Motion | 小〜中 | 粗い | 0 ring | 粗い | 硬い部品向け。triangle数を抑える |

初期チューニング方針:

```text
envelopePadding = f(alphaBoundsSize, presetPaddingFactor)
boundarySpacing = f(sqrt(alphaArea), presetBoundaryDensity)
interiorSpacing = f(sqrt(alphaArea), presetInteriorDensity)
```

V2との違い:

- boundaryはalpha contourではなくenvelope。
- alpha外triangleを完全排除しない。
- triangle密度を全体的に下げる。
- 外周を包む膜として扱う。

## 7. Acceptance Criteria

`auto-outline-v3-envelope` の合格条件:

- alpha輪郭そのものではなく、外側に膨らませたenvelope boundaryを生成する。
- transparent pixelsを少し含むtriangleが許容される。
- V2より全体のtriangle数が少ない、または同等以下である。
- Large Motionでも現V2より細かすぎる印象が減る。
- 外周付近に細いtriangleが密集しすぎない。
- Cubism再現ではなく、方向性として「外周を含むように包むmesh」に見える。
- outputはdeterministicである。
- fallback時は `auto-outline-v2` または既存fallbackへ明示的に戻る。

自動テストで見るべきもの:

- deterministic output。
- V3 triangle count / vertex countがV2より過剰に増えない。
- envelope外triangleが残らない。
- preset順の密度差が保たれる。
- fallback reasonがsummaryに残る。

人間のvisual checkで見るべきもの:

- 外周をなぞるのではなく、外周を包むmeshに見えるか。
- Low Motionが十分粗いか。
- Large Motionでも細かすぎないか。
- 境界付近のtriangleが極端に細くないか。

## 8. 実装境界

推奨配置:

- headless algorithm: `packages/authoring-core` 側。
- operation integration: `packages/operation-core` 側。
- UI preview / Apply: `apps/editor` 側。

Editor側は、algorithm id / preset選択、preview、Apply、fallback / warning表示を扱う。envelope生成やtriangulation詳細をUI componentへ埋め込まない。

## 9. 未決事項

- envelope offsetの具体式。
- self-intersection cleanupの方式。
- support ringをalpha contour基準にするか、envelope inward offset基準にするか。
- full constrained triangulationを導入するか。
- V2とV3を別algorithmとして併存するか、V3でV2を置換するか。
- V3を `auto-outline-v3-envelope` と呼ぶか、`auto-envelope-v1` と呼ぶか。
