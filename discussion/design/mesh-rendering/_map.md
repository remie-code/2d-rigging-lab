# Mesh Rendering Design Map

> Mesh内画像描画方式、renderer contract、texture preparation、WebGL2 backend、Canvas2D撤退条件を扱う設計トピック。Meshを「どう生成するか」は `mesh-generation/` に置き、ここでは「生成済みmeshで画像をどう破綻なく描くか」を扱う。

## ファイル一覧

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | このディレクトリの入口地図 | Active |
| [mesh-image-rendering-architecture.md](mesh-image-rendering-architecture.md) | Mesh image rendering contract、WebGL2 primary renderer、texture preparation / atlas境界、Canvas2D撤退条件の設計 | Implemented foundation (Wave67); pixel/sunset criteria remain open |
| [boundary-transparent-margin-design.md](boundary-transparent-margin-design.md) | 輪郭メッシュが drawable 境界外へ延ばした頂点付近のにじみを、覆いマージン透明化(A1)で根絶する設計。生成UV非クランプ + Texture Prep/Atlas透明gutter + LINEAR化。§9 edge-extrude を覆いマージンについて上書き。export不可侵層に触れる | **Implemented (Wave108, Option E) + Wave109 preflight reconcile** — clean review PASS・権威検証 green。実機 atlasRuntime 目視はユーザー gate。([Wave108 final](../../implementation/waves/wave108/wave108-final-integration-report.md), [Wave109 Domain A](../../implementation/waves/wave109/wave109-domain-a-uvrect-preflight-report.md)) |

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
- Wave67 で `render-core` / `render-webgl2` と Editor adapter が実装済み。WebGL2 は primary、Canvas2D は fallback/overlay/debug 用途として残る。
- Wave101 で `single-page-skyline-v1` が新規 Atlas preview/apply の default になり、旧 shelf artifact は読み取り互換を維持する。
- Wave108 Option E で生成 UV 非クランプ、層サイズ依存の透明 padding/gutter、LINEAR parity、content-inset が editor/export/runtime の共通データ契約になった。Wave109 は non-zero inset の uvRect preflight を共有 helper で整合させた。

## 次の作業候補

1. 実 GPU/readPixels または同等の pixel oracle で WebGL2/Canvas2D parity、seam/AA/mask 品質を確認する（semantic/fake-GL pass とは別 gate）。
2. Canvas2D fallback の sunset 条件と、overlay/debug に残す責務を明文化する。完全撤退は未決であり、自動実装完了から推論しない。
3. Wave108/109 の Atlas Runtime 実機目視（透明 margin、cross-bleed、LINEAR端 AA）と `original` inset 表示の再現確認を必要時に行う。
4. `RenderScene` / parent-child deformer semantics は現行 contract として維持し、mesh形状候補（V4等）は [../mesh-generation/_map.md](../mesh-generation/_map.md) の historical evidence として切り分ける。

