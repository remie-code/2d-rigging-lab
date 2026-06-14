# auto-outline-v5 Recursive Contour-Band Mesh Generation Algorithm

> Draft algorithm spec。`auto-outline-v4` 系の試行結果を受け、中心seedから広げる方式を破棄し、輪郭点群を覆う三角形帯を外側から内側へ帰納的に展開する次候補。Cubism互換や再現を主張しない。

## 1. 目的

`auto-outline-v4` の実装試行では、中心seedから広げる方式や、外輪・内輪を局所normal offsetで作る方式により、次の問題が残った。

- 輪郭付近で制御点が折り返され、三角形が重なる。
- 細い髪束や分岐した形状で、内部充填が失敗する。
- レイヤー矩形境界や局所的なalpha輪郭に引きずられ、直線的または不自然なmeshが出る。
- 問題箇所を品質filterで捨てると、面が欠ける。

V5の目的は、輪郭点を直接頂点化せず、輪郭を覆う三角形帯をまず閉じた周期構造として確定し、その内側へ同種の三角形帯を帰納的に縮めていくことで、折り返しと局所破綻を減らすことである。

## 2. 採用する考え方

V5では、輪郭点群を「mesh頂点」ではなく「覆うべき参照線」として扱う。

```text
outer contour ring
O0 ---- O1 ---- O2 ---- O3 ---- O0
 \    /  \    /  \    /  \    /
  \  /    \  /    \  /    \  /
   c0      c1      c2      c3      alpha contour reference
  /  \    /  \    /  \    /  \
 /    \  /    \  /    \  /    \
I0 ---- I1 ---- I2 ---- I3 ---- I0
inner contour ring
```

`c0..c3` はalpha輪郭上の参照点であり、mesh頂点ではない。輪郭線は三角形帯の高さ中央付近を通る。

この `outer contour ring -> inner contour ring` の帯を作った後、`inner contour ring` を次の外側ringとして扱い、さらに内側ringを作る。

```text
alpha contour reference
  -> ring 0: outer contour ring
  -> ring 1: inner contour ring
  -> ring 2
  -> ring 3
  -> ...
  -> center fill
```

つまりV5は、**輪郭帯を最外層に固定し、同じring-to-ring接続を内側へ繰り返す**方式である。

## 3. 捨てる考え方

### 3.1 中心seedから広げる方式

中心seedから三角格子を増やし、輪郭側へ到達させる方式はV5では使わない。

理由:

- 中心からの放射状構造が出やすい。
- 凹形状や髪束で長いspokeが出やすい。
- 最重要である輪郭付近を最後に偶然合わせる形になり、破綻時の制御が難しい。

### 3.2 局所normal offsetだけで輪郭帯を作る方式

各輪郭点でnormalを推定し、外側・内側へ点を置くだけの方式はV5では主戦略にしない。

理由:

- 局所的な凹凸や細い透明隙間でnormalが乱れ、ringが折り返す。
- 対応する外側点・内側点が近すぎたり交差したりする。
- 三角形が重なり、描画されない領域が出る。

V5では、ring全体を閉じた周期曲線として扱い、局所点ごとのoffsetではなく、ring間の自然な接続を優先する。

### 3.3 品質filterで穴を作る方式

悪い三角形を後から捨てることでmesh品質を作ることはしない。

品質filterは診断やfallback判断に使うが、主役は「最初から自然なring構造を作ること」である。

## 4. 入力と前処理

入力:

- Drawable RGBA。
- alpha threshold。
- density preset: `Large Motion`, `Standard`, `Low Motion`。
- Drawable texture bounds / stage bounds。

前処理:

1. alpha maskを作る。
2. 小さすぎるノイズ島を除去する。
3. contour loopを抽出する。
4. 主要な描画islandを1つだけに潰さない。複数loopを持つ場合は、loopごとにV5を適用し、最後にmeshをmergeする。
5. layer矩形境界はshape生成に使わない。UV clampや最終boundsには使ってよい。

重要:

- レイヤー矩形の左端・右端・上端・下端を輪郭として扱わない。
- alpha contourは参照線であり、mesh外周そのものではない。

## 5. Preset と基準辺長

V5はpresetごとに基準辺長 `L` を決める。`L` は輪郭点間隔から決めない。

初期候補:

| Preset | `L` の傾向 | 意図 |
|---|---:|---|
| Large Motion | medium-small | 動くパーツ向け。ただし過去V2/V4より粗めにする。 |
| Standard | medium | 汎用。 |
| Low Motion | large | 硬いパーツ向け。 |

制約:

- `L` はbounds比率だけで過度に小さくしない。
- 大きなパーツでも小さなパーツでも、三角形サイズが極端に変わらないよう、presetごとの下限・上限を持つ。
- 輪郭点密度が高い髪先でも、三角形が輪郭点密度に追従して細かくならない。

## 6. 輪郭参照線の作成

alpha contourから、弧長基準で参照点列を作る。

```text
P = contour perimeter
N = round(P / L)
S = P / N
referenceSamples = pointAtContourDistance(i * S), i = 0..N-1
```

要求:

- `N` は閉ループを一周したときにぴったり周期接続できる数にする。
- 最後の余りだけ潰れた三角形にしない。
- 曲率が高い箇所を多少増やしてもよいが、輪郭点密度へ過剰追従しない。
- 参照点はmesh頂点ではない。

## 7. 最外輪郭帯

### 7.1 contour band の配置

最外層として、alpha contour referenceを高さ中央付近に通す三角形帯を作る。

```text
outer ring R0
O0 ---- O1 ---- O2 ---- O3 ---- O0
 \    /  \    /  \    /  \    /
  c0      c1      c2      c3
 /    \  /    \  /    \  /    \
I0 ---- I1 ---- I2 ---- I3 ---- I0
inner ring R1
```

`R0` と `R1` は同じ点数 `N` を持つ閉ringである。

### 7.2 ringの位置

初期仕様:

- `R0` はalpha contourより外側に置く。
- `R1` はalpha contourより内側に置く。
- alpha contourは `R0` と `R1` の中間付近を通る。
- 外側余白はやや甘めに許容する。

ただし、局所normalだけで点を置くと折り返すため、以下を守る。

- `R0` / `R1` は閉ringとしてself-intersectionしない。
- 隣接点間距離は概ね `L` 近傍に保つ。
- `R0[i] -> R1[i]` の対応線が極端に長くならない。
- `R0[i] -> R1[i]` と `R0[j] -> R1[j]` が交差しない。

### 7.3 ring生成の考え方

実装候補:

1. contour reference samplesを作る。
2. 各sampleに対して内外方向候補を作る。
3. 候補点をそのまま採用せず、ring全体の滑らかさ・隣接距離・交差なしを満たすように調整する。
4. 交差や折り返しが出る場合、局所offsetを弱める。
5. それでも閉ringが成立しないloopは、より粗い `N` で再試行する。

V5では、輪郭点を完全に正確になぞることより、自然な三角形帯が閉じることを優先する。

## 8. 内側への帰納的ring生成

最外輪郭帯で得た `R1` を、次の外側ringとして扱う。

```text
R0: outer contour ring
R1: inner contour ring
R2: inner recursive ring
R3: inner recursive ring
...
Rc: center ring
```

各step:

1. 現在ring `Rk` の内側に次ring `Rk+1` を作る。
2. `Rk` と `Rk+1` の間をring-to-ring triangle stripで埋める。
3. `Rk+1` が小さくなりすぎるまで繰り返す。
4. 最後はcenter fillで閉じる。

### 8.1 次ringの作り方

候補:

- ringの重心またはmedial centerへ向けて各点を移動する。
- 移動距離は `L * 0.75 - 1.0` 程度。
- 移動後、隣接距離が均一に近づくように軽くrelaxする。
- alpha mask内またはalpha近傍apron内に留める。

重要:

- 次ringも同じ点数 `N` を維持する初期実装でよい。
- 小さくなりすぎたら点数を減らすのではなく、そこでcenter fillへ移る。
- 点数変更は将来候補。v0では同点数ringで閉じる。

### 8.2 終了条件

次のいずれかでring生成を止める。

- ringの面積が `L * L * centerAreaFactor` 未満。
- ringの平均半径が `L * centerRadiusFactor` 未満。
- 追加ringを作るとself-intersectionする。
- ring間距離が短くなりすぎる。
- 最大ring数に達する。

## 9. Ring-to-Ring Triangulation

隣接ringは周期的なquad stripとして扱い、各quadを2つの三角形に割る。

```text
Rk[i] ---- Rk[i+1]
  |      /    |
  |    /      |
Rk1[i] -- Rk1[i+1]
```

diagonal選択:

- min angleが大きい方。
- max edge lengthが短い方。
- 既存triangleと交差しない方。
- どちらも悪い場合は、その局所の次ring生成を弱めて再試行する。

禁止:

- 既存三角形との重なり。
- 共有辺なしの交差。
- 1頂点に境界三角形が集中するfan。
- ringを跨ぐ長いspoke。

## 10. Center Fill

最後のcenter ring内部を閉じる。

初期候補:

- center point fan。
- ringが細長い場合は、中心点 + 追加補助点で小Delaunay。

中心部は輪郭付近ほど重要ではないため、v0はcenter point fanでよい。

```text
R0 --- R1 --- R2
 \   / \   /
   C --- 
 /   \ /   \
R5 --- R4 --- R3
```

## 11. 複数loop / island

alpha contour loopが複数ある場合、V5では主要loopだけを選んで他を捨てることを避ける。

方針:

- 一定面積以上の外周loopごとにV5 mesh fragmentを生成する。
- fragment同士は無理につなげない。
- 最後にvertices / uvs / triangles / stable IDsを1つのmeshへmergeする。
- 小さすぎるislandはnoiseとして除外してよい。

これにより、髪束のように複数の細い描画islandがあるDrawableで `interior-fill-failed` になりにくくする。

未決:

- hole contourをどう扱うか。
- 近接islandをbridgeするか、fragmentとして独立させるか。

## 12. UV と Bounds

形状生成とUV clampを分ける。

- shape geometryはalpha contourとring構造から作る。
- texture / layer矩形境界はshape生成に使わない。
- 頂点が少しtexture外へ出る場合、UVだけ `0..1` にclampする。
- stage vertex位置は、意図した外側余白を保持してよい。

これにより、レイヤー矩形端に沿った不自然な縦線・横線を避ける。

## 13. Metrics

V5で記録したい指標:

```ts
type MeshGenerationV5Metrics = {
  algorithmId: "auto-outline-v5-recursive-contour-band";
  loopCount: number;
  acceptedLoopCount: number;
  targetEdgeLength: number;
  referenceSampleCount: number;
  ringCount: number;
  contourBandTriangleCount: number;
  recursiveBandTriangleCount: number;
  centerFillTriangleCount: number;
  maxRingToRingEdgeLength: number;
  minTriangleAngleDegrees: number;
  maxVertexValence: number;
  rejectedOverlapTriangleCount: number;
  rejectedSelfIntersectionRingCount: number;
};
```

## 14. Fallback / Debug Policy

V5開発中は、黙ってV2系へfallbackすると評価不能になる。

推奨:

- V5を明示選択した場合、失敗時は失敗理由をconsole / UIに出す。
- fallbackはUI上でsourceが分かる場合のみ許可する。
- default mesh generationに採用するまでは、V5はsidecar候補として扱う。

失敗理由候補:

- `alpha-empty`
- `contour-extraction-failed`
- `no-accepted-contour-loop`
- `contour-band-ring-failed`
- `recursive-ring-failed`
- `ring-triangulation-failed`
- `center-fill-failed`
- `quality-threshold-failed`

## 15. Acceptance Criteria

自動テスト:

- same input / same presetでdeterministic output。
- presetごとの `L` がmetricsへ記録される。
- 複数loopを持つDrawableで、主要loop以外が全て捨てられない。
- triangle overlap guardにより、共有辺なしの交差が出ない。
- V5失敗時に明示的なreasonが出る。
- layer矩形境界をcontourとして採用しない。

人間visual check:

- 輪郭付近に、輪郭を覆う三角形帯が見える。
- 輪郭点密度に引きずられた極小三角形が出にくい。
- 中心から放射状に伸びるspokeが出にくい。
- 境界付近で点が折り返して重なる箇所が減る。
- 細い髪束でも、描画領域に対して三角形が途切れにくい。
- Cubism風の「輪郭を覆い、内側へ自然に敷き詰める」印象に近づく。

## 16. 実装境界

推奨配置:

- headless algorithm: `packages/authoring-core`。
- method ID: `auto-outline-v5-recursive-contour-band`。
- Editor UI: 初期はMesh Toolの候補または開発用選択肢として扱う。
- default切替: 人間visual check後に別途判断する。

次の実装では、V4の応急修正を積み増すのではなく、V5を別実装として作る。V4は比較・失敗知見として残す。

## 17. 未決事項

- `R0` / `R1` をどの最適化で安定化するか。
- 次ring生成で、重心方向だけで十分か、medial axis / distance transformが必要か。
- 同点数ringでどこまで自然に縮められるか。
- 細長い形状でcenter fillをfanにしてよいか。
- hole contourを保持するか、v0では無視するか。
- 複数islandをfragment mergeする際のstable ID規則。
