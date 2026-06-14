# auto-outline-v4 Recursive Offset-Ring Mesh Generation Algorithm

> Draft algorithm snapshot。`auto-outline-v4-contour-band` の試行中に得た、輪郭付近を自然な三角形帯で覆い、その内側をリング単位で埋めるための次候補。Cubism互換や再現を主張しない。

## 1. 目的

`auto-outline-v4-contour-band` の初期実装では、輪郭点を直接メッシュ頂点にしたり、形状非依存の三角格子を切り抜いたりしたため、次の問題が出た。

- 輪郭点密度に引きずられて細すぎる三角形が出る。
- 形状に沿わない、整列しすぎた三角格子になる。
- 輪郭付近の帯が独立三角形の集合になり、辺共有された自然な帯にならない。
- 品質フィルタで三角形を捨てすぎると、面が欠ける。

この文書では、輪郭点を「頂点」ではなく「三角形帯が覆うべき基準線」として扱い、閉じた輪郭に対して自然に一周する三角形帯と内部充填を作るアルゴリズム方針を記録する。

## 2. 用語

| Term | Meaning |
|---|---|
| `L` | presetごとの目標三角形サイズ。輪郭点間隔とは独立する。 |
| `alpha contour` | alpha maskから得た描画対象の輪郭線。メッシュ辺ではなく、参照曲線。 |
| `ring` | 閉じた頂点列。隣接ring間を三角形で埋める。 |
| `outer ring` | alpha contourより外側に置くring。輪郭帯の外側境界。 |
| `inner ring` | alpha contourより内側に置くring。輪郭帯の内側境界。 |
| `center ring` | 内側から外側へ成長させる際の最初の境界。中心領域は後で三角形で閉じる。 |
| `contour band` | alpha contourを高さ中央付近に通す、外側ringと内側ringの間の三角形帯。 |

## 3. 確定した理解

### 3.1 輪郭点は頂点ではない

輪郭点は三角形を配置する場所の参考である。輪郭点をそのままメッシュ頂点にすると、pixel-levelの輪郭密度や曲率に引きずられ、細すぎる三角形やfanが出る。

正しい扱い:

- 輪郭点は「この付近を三角形帯で覆う」という参照点である。
- 1つの三角形が複数の輪郭点を含んでよい。
- 三角形サイズは輪郭点間隔ではなく、presetの `L` から決める。

### 3.2 「重心」ではなく「高さの中心付近」

輪郭線は三角形の重心ではなく、高さの中心付近を通るのが直感に近い。

重心は底辺から高さの `1/3` にあるため、上下反転した三角形列を説明するときに誤解を生む。以後は「輪郭線が三角形の高さ中央付近を通る」と表現する。

### 3.3 輪郭帯は上下反転する三角形列

輪郭帯は、輪郭線を辺として使うのではなく、輪郭線をまたぐ上下反転三角形の連続である。

```text
outer side
O0 -------- O1 -------- O2 -------- O3
 \   c0   / \   c1   / \   c2   /
  \      /   \      /   \      /
   \    /     \    /     \    /
I0 ---- I1 ---- I2 ---- I3 ---- I4
inner side
```

`c0, c1, c2...` はalpha contour上の参照点であり、三角形の頂点ではない。三角形帯は、輪郭線が高さ中央付近を通るように配置される。

## 4. 捨てた考え方

### 4.1 Greedy triangle strip

一つ目の三角形を置き、次の三角形を前の三角形と1辺共有しながら逐次追加する思考実験は、輪郭帯の理解には有効だった。

しかし実アルゴリズムとしては採用しない。

理由:

- 閉ループを一周した最後に、余りが潰れた三角形になりやすい。
- 開始点に依存する。
- 輪郭一周の周期性を事前に保証できない。

### 4.2 Shape-independent triangular lattice

alpha bounds全体に平行な三角格子を敷いて、alpha / contourと関係する三角形だけ採用する方式は採用しない。

理由:

- 三角形は均一だが、対象形状に沿わない。
- Cubism風の「輪郭に沿って置かれた」印象から遠い。
- ただ切り抜いた布地のように見える。

### 4.3 Quality filtering first

生成後に三角形品質で捨てることを主戦略にしない。

理由:

- 面が欠ける。
- 問題の本質は、悪い三角形を捨てることではなく、最初から自然な三角形帯とring構造を作ること。

品質チェックは診断・fallback判断には使うが、形状生成の主役にしない。

## 5. 推奨アルゴリズム: Recursive Offset-Ring Triangulation

### 5.1 全体像

```text
center fill
  -> center ring
  -> intermediate rings
  -> contour inner ring
  -> alpha contour reference
  -> contour outer ring
```

内側から外側へringを成長させ、最後にalpha contourをまたぐ輪郭帯を作る。

外から内へ縮める方式は、中心付近に潰れた余りが出やすい。内から外へ成長させると、最重要の輪郭帯を最後に合わせ込める。

### 5.2 手順

1. `alpha mask` から主要な閉じた `alpha contour` を得る。
2. presetから目標サイズ `L` を決める。
3. alpha領域内部に小さな `center ring` を作る。
4. `center ring` の内側は、最後に中心点fanまたは小Delaunayで三角形充填する。
5. `center ring` から外側へ、複数の中間ringを生成する。
6. 各隣接ring間を、周期的な三角形接続で埋める。
7. 最後に `contour inner ring` と `contour outer ring` を作る。
8. `contour inner ring` と `contour outer ring` の間に、alpha contourが高さ中央付近を通る三角形帯を作る。
9. deterministic ordering / stable IDs / metricsを記録する。

## 6. Ring生成

### 6.1 Ring数と点数

輪郭一周の長さ `P` とpreset size `L` から、輪郭帯の点数を先に決める。

```text
N = round(P / L)
S = P / N
```

`S` は一周にぴったり合う実際のspacingである。`L` は目標値であり、閉ループを壊してまで厳密に守らない。

### 6.2 周期性

全ringは同じ、または整合可能な点数を持つ。最後のsegmentも `N-1 -> 0` として普通に接続する。これにより、最後だけ潰れた三角形を避ける。

### 6.3 内側から外側へ

内側ringから外側ringを作るときは、alpha contourへ向かう方向を使う。

初期候補:

- alpha contourの弧長サンプルを基準方向として使う。
- 各ring pointは、対応するcontour sampleへ向かって外側へ移動する。
- ring間距離は概ね `L * 0.7 - 1.0`。

## 7. Ring間の三角形接続

隣接する2つのring `A` と `B` を周期的に接続する。

```text
A0 ---- A1 ---- A2 ---- A3 ---- A0
 \    /  \    /  \    /  \    /
  \  /    \  /    \  /    \  /
   B0 ---- B1 ---- B2 ---- B3 ---- B0
```

基本方針:

- quad stripを2三角形に割る。
- diagonalは固定ではなく、edge length / angleが自然になる方を選ぶ。
- ring間で点数が異なる場合は、resamplingして揃えるか、局所的に1対2接続する。

ただし初期実装では、全ringを同じ `N` 点に揃える方針でよい。

## 8. 輪郭帯

輪郭帯は最後に作る。これは輪郭を最も見た目に効く形で扱うためである。

### 8.1 Ring配置

alpha contourを参照線として、内側と外側にringを置く。

```text
outer ring
O0 ---- O1 ---- O2 ---- O3
 \    /  \    /  \    /
  c0     c1     c2       alpha contour reference
   \  /    \  /    \  /
I0 ---- I1 ---- I2 ---- I3
inner ring
```

`c_i` は輪郭点であり、メッシュ頂点ではない。

### 8.2 高さ中央付近

`outer ring` と `inner ring` の間の三角形帯に対し、alpha contourが三角形高さの中央付近を通るようにする。

外側・内側offset候補:

```text
outerOffset = bandHeight * 0.5
innerOffset = bandHeight * 0.5
bandHeight ~= L * 0.75 - 1.2
```

最初は対称offsetでよい。必要なら、描画対象外側を少し広めに取る。

### 8.3 輪郭点の包含

輪郭点は、帯の三角形内に含まれるべきである。ただし、1三角形に1輪郭点である必要はない。

- 1つの三角形が複数の輪郭点を含んでよい。
- 輪郭点が三角形の頂点や辺上に来る必要はない。
- 輪郭点は高さ中央付近に分布するのが望ましい。

## 9. Center Fill

中心ringの内側は最後に閉じる。

初期候補:

```text
      R0
   o ---- o
  / \    / \
 o--- c ---o
  \ /    \ /
   o ---- o
```

- 小さいringなら中心点 `c` へのfan triangulation。
- 長い楕円ringなら中心点と補助点でDelaunay。
- v0では中心点fanでよい。

中心部は輪郭ほど見た目に厳密でなくてよい。重要なのは、輪郭付近を自然に作ることである。

## 10. Preset

Presetは `L` とring間隔に効く。

| Preset | `L` | Ring spacing | Intended result |
|---|---:|---:|---|
| Large Motion | small-medium | dense | 動く部位向け。輪郭帯も内部も細かめ。ただし過密にしない。 |
| Standard | medium | medium | 標準。 |
| Low Motion | large | coarse | 硬い部位向け。 |

現在のユーザー観察では、過去V2系のLarge Motionや一部V4試行は細かすぎた。`L` は今後大きめに調整する余地がある。

## 11. 実装時の注意

- 輪郭点をメッシュ頂点化しない。
- alpha contourをメッシュ辺にしない。
- 閉ループ全体の点数を先に決め、周期的に接続する。
- 逐次greedyで最後に余りを押し込まない。
- 三角形を大量に捨てることで品質を作ろうとしない。
- V4の見た目検証中は、fallbackでV2系に黙って落ちると評価不能になる。V4試行時はfallback理由を見せるか、fallbackを切ることを検討する。

## 12. 未決事項

- center ringの形状をどう決めるか。
- inner-to-outer ring生成で、各ringをalpha contourへどう対応づけるか。
- ring間の点数を常に同じにするか、局所1対2接続を許可するか。
- contour outer ringのoffsetをalpha外側にどの程度出すか。
- concave形状や大きな穴をどう扱うか。
- V4評価時にfallbackを切るか、UI上でfallback sourceを強く表示するか。
