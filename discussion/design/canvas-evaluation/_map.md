# Canvas Evaluation Design Map

> Authoring Workspace の Canvas / Preview に描くための評価パイプライン、parameter-driven deformation、draft合成、overlay / hit test の設計トピック。画面上の配置やtoolbar UXは `screen-design/` に置き、ここでは「何をどう評価して描くか」を扱う。

## ファイル一覧

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | このディレクトリの入口地図 | Active |
| [canvas-evaluation-pipeline-v0.md](canvas-evaluation-pipeline-v0.md) | AuthoringSession + parameter values + draft state から CanvasEvaluatedScene を作る v0 評価パイプライン設計 | Draft design basis |

## 境界

- ここではCanvas toolbar、pan / zoom / fit button配置、Inspector layoutなどの画面仕様を扱わない。
- Canvas / Previewの画面仕様は [../screen-design/components/canvas-preview.md](../screen-design/components/canvas-preview.md) を正とする。
- Mesh生成アルゴリズムは [../mesh-generation/](../mesh-generation/_map.md) に置く。
- Runtime Viewerの専用画面仕様は [../screen-design/screens/viewer-runtime-view.md](../screen-design/screens/viewer-runtime-view.md) に置く。

## 現在の焦点

- 次のUX上の主目標は、Parameter Barを動かしたときにCanvas上の絵そのものが変形・回転・フェードして見えることである。
- Canvas rendererが生のAuthoringSessionを直接読み続けるのではなく、Canvas用の評価済みsceneを描く方向へ寄せる。
- Apply前のdraftやkeyform編集中の一時状態も、保存済みmodelとは分けてCanvas previewへ反映する。
- Deformer Treeの親子関係を評価順として扱い、親Deformerの結果に子Deformer / bound Drawableが乗る。

## 次の作業候補

1. `CanvasEvaluatedScene` / `EvaluatedDrawable` / `EvaluatedOverlay` の最小型を実装候補として具体化する。
2. Warp / Rotation / Opacity keyform の v0 評価順をheadless helperとして切り出す。
3. Canvas rendererを評価済みscene入力へ寄せるため、既存renderer依存を棚卸する。
4. Apply前draft、control point drag preview、parameter scrubの履歴境界をテスト可能にする。

