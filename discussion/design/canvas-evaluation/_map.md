# Canvas Evaluation Design Map

> Authoring Workspace の Canvas / Preview に描くための評価パイプライン、parameter-driven deformation、draft合成、overlay / hit test の設計トピック。画面上の配置やtoolbar UXは `screen-design/` に置き、ここでは「何をどう評価して描くか」を扱う。

## ファイル一覧

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | このディレクトリの入口地図 | Active |
| [canvas-evaluation-pipeline-v0.md](canvas-evaluation-pipeline-v0.md) | AuthoringSession + parameter values + draft state から CanvasEvaluatedScene を作る v0 評価パイプライン設計 | Implemented boundary (Wave66); design text remains the contract basis |

## 境界

- ここではCanvas toolbar、pan / zoom / fit button配置、Inspector layoutなどの画面仕様を扱わない。
- Canvas / Previewの画面仕様は [../screen-design/components/canvas-preview.md](../screen-design/components/canvas-preview.md) を正とする。
- Mesh生成アルゴリズムは [../mesh-generation/](../mesh-generation/_map.md) に置く。
- Runtime Viewerの専用画面仕様は [../screen-design/screens/viewer-runtime-view.md](../screen-design/screens/viewer-runtime-view.md) に置く。

## 現在の焦点

- `CanvasEvaluatedScene` と評価済み mesh / overlay / hit-test の境界は Wave66 で実装済み（`apps/editor/src/workspace/canvas/canvas-evaluation.ts`）。Apply 前 draft、keyform 編集状態、deformer chain の local-space 評価もこの経路に入る。
- Wave67 以降の renderer は生の `AuthoringSession` ではなく評価済み scene を入力にし、WebGL2 adapter と Canvas2D fallback が同じ評価結果を消費する。
- Editor Perf Wave2 はこの評価経路の選択駆動遅延化・表示経路最適化を実装してユーザー受け入れ済み。Canvas evaluation の「実装待ち」は残っていない。
- 残るのは semantic regression、実 GPU/pixel parity、Canvas2D sunset条件などの検証境界であり、新しい評価モデルを設計・実装する段階ではない。

## 次の作業候補

1. Wave66/67 の semantic evidence を維持し、評価済み scene の regression test を追加・更新する。
2. 実 GPU/readPixels または同等の pixel oracle を用いた WebGL2/Canvas2D parity を別途検証する（自動 semantic pass とは分離）。
3. Canvas2D fallback の sunset 条件と残存 overlay/debug 用途を `mesh-rendering` 側で裁定する。
