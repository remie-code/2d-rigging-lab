# Mesh Rendering Design Map

> Mesh内画像描画方式、renderer contract、texture preparation、WebGL2 backend、Canvas2D撤退条件を扱う設計トピック。Meshを「どう生成するか」は `mesh-generation/` に置き、ここでは「生成済みmeshで画像をどう破綻なく描くか」を扱う。

## ファイル一覧

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | このディレクトリの入口地図 | Active |
| [mesh-image-rendering-architecture.md](mesh-image-rendering-architecture.md) | Mesh image rendering contract、WebGL2 primary renderer、texture preparation / atlas境界、Canvas2D撤退条件の設計 | Draft architecture basis |

## 境界

- ここではmesh生成アルゴリズムを扱わない。生成アルゴリズムは [../mesh-generation/](../mesh-generation/_map.md) を正とする。
- ここではAuthoring Workspace上のtoolbar配置、pan / zoom / fit操作などの画面仕様を扱わない。画面仕様は [../screen-design/components/canvas-preview.md](../screen-design/components/canvas-preview.md) を正とする。
- ここではEditor専用Canvas2D実装を正本にしない。現在のCanvas2D triangle描画は暫定draft / migration aidとして扱う。
- ここではPhotoshop pixel-perfect flatten reproductionを目標にしない。

## 現在の焦点

- Meshは画像を分割して見せるためのものではなく、画像変形のための幾何情報である。
- 三角形境界、白線、二重合成、欠け、透明境界のにじみが表示結果に出ない描画契約を定義する。
- Primary rendering stackはWebGL2とする。
- Editor PreviewとViewerは同じrenderer contractを共有する。
- Texture Preparationは、PSD layer assetとWebGL2 texture uploadの間に置き、alpha edge padding / color dilation / premultiplied alpha / atlas allocationを扱えるようにする。
- Canvas2D rendererは短期移行足場であり、新機能追加先にしない。

## 次の作業候補

1. 次waveの本線として、[mesh-image-rendering-architecture.md](mesh-image-rendering-architecture.md) をbasisにWebGL2 renderer foundationを設計・実装する。
2. `RenderScene` は詳細型をノームに委ねつつ、本文書の不変条件を満たすことをACにする。
3. `auto-outline-v4-contour-band` はmesh形状品質のsidecarとして進め、描画品質問題とは切り分けて比較する。
4. 親子Deformer評価は、renderer入力となる評価済みmesh座標の正しさとして別domainで扱う。

