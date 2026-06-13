# Wave66 Preplan Inventory: Canvas Evaluation / Renderer / Parameter State

- Status: pass
- Scope: read-only delegated inventory
- Purpose: Wave66計画前に、Canvas上の絵そのものをparameterで変形して見せるための現状を棚卸する。

## 1. 根拠

- [Canvas Evaluation Pipeline v0](../../../design/canvas-evaluation/canvas-evaluation-pipeline-v0.md)
- [Canvas / Preview Component](../../../design/screen-design/components/canvas-preview.md)
- [Parameter / Keyform Component](../../../design/screen-design/components/parameter-keyform.md)
- [Rig Tool Component](../../../design/screen-design/components/rig-tool.md)

## 2. 主要事実

- `apps/editor/src/workspace/canvas/canvas-renderer.ts` はすでに `AuthoringSession` から独立しており、`CanvasRenderProjection` を描画している。
- 生の `AuthoringSession` 参照は主に `apps/editor/src/workspace/canvas/canvas-projection.ts` の `createCanvasRenderProjection` 周辺に集中している。
- したがって、`CanvasEvaluatedScene` 相当の境界は `createCanvasRenderProjection` の前後へ置くのが自然である。
- 現在の画像描画は、Drawable画像を矩形boundsへ `drawImage` する方式であり、mesh頂点に沿った実画像変形描画はまだない。
- 現在のmesh / deformer overlayは描画されているが、実画像の変形には使われていない。
- parameter / keyform評価は既にある程度存在し、Drawable opacity、Rig opacity、Rotation angle、Warp control point offsets を評価できる。
- `runtime-core` には keyform sampling、rig hierarchy evaluation、warp lattice vertex application、rotation transform、snapshot evaluation が存在する。
- editorは現時点で `runtime-core` を直接依存に持っていないため、再利用する場合は依存追加またはadapter設計が必要である。
- 現在のhit testは、評価後meshではなくraw/rest bounds寄りである。
- Warp control point interactionはscreen projection上でhit testできるが、保存値への戻し方はlocal offsetとして扱う必要がある。

## 3. 既存能力

- parameter preview値はeditor-local stateとして持てる。
- scrubは `AuthoringSession` を変更しない。
- linear keyformの補間が存在する。
- committed Warp / Rotation Deformer modelが存在する。
- Deformer親子構造とruntime側評価基盤が存在する。
- Warp control point drag preview / commit のUI基盤が存在する。
- Undo / Redo v0によりcommit操作の履歴境界がある。
- Apply後のviewport保持修正が存在する。

## 4. 不足能力

- Canvasに描かれる実画像を評価済みmeshで変形する描画経路。
- Canvas projection / scene 上の評価済みmesh vertices / triangles / bounds。
- 評価後座標に基づくselection bounds / hit test。
- 親Deformer影響下での子Deformer overlay / control point local変換の整理。
- `CanvasEvaluatedScene` の具体型。
- pre-Apply committed deformer inspector editをCanvasへpreviewする仕組み。

## 5. 推奨境界

Wave66本線では、editor-owned `canvas-evaluation` adapterを導入する。

```text
EditorSessionProvider
  -> Canvas evaluation adapter
  -> CanvasEvaluatedScene / CanvasRenderProjection
  -> CanvasRenderer
```

方針:

- `canvas-renderer.ts` は引き続きsession-freeに保つ。
- `CanvasEvaluation` は `AuthoringSession`、`parameterValues`、`meshDraft`、`rigDraft`、control point preview、selectionを入力にする。
- rendererへは評価済みdrawable、評価済みoverlay、texture refs / bytes、mask ids、draw orderを渡す。
- hit testはrendererと同じ評価済みsceneを基準にする。
- v0のhit testは評価後boundsでよい。triangle hit testは可能なら実装してよいが必須ではない。
- clippingはv0ではcomposition slot確保を優先し、deformed mask完全対応を必須にしない。
- Canvas2D triangle texture warpを最初の実装候補にする。WebGL renderer化はWave66の必須範囲にしない。

## 6. テスト観点

追加すべきテスト:

- `AuthoringSession + parameterValues + draft state -> CanvasEvaluatedScene` の純粋評価テスト。
- keyform exact / interpolation / clamp。
- Drawable opacity、Rig opacity multiplier、Rotation angle、Warp control point offsets。
- parent-before-child deformer chain。
- draft / drag preview がsessionを変更しないこと。
- hit testが評価後boundsへ追従すること。
- parameter scrub / draft preview / Apply-like changeでviewport auto-fitが走らないこと。

避けるべきテスト:

- screenshot / pixel oracle。
- 正確なvertex座標をE2Eで固定すること。
- CSS / DOM構造 / visual layoutをE2Eの主目的にすること。

## 7. 未解決だがWave66内で方針を切る事項

- `runtime-core` を直接再利用するか、editor-local evaluatorを薄く置くか。
  - 推奨: editor-owned adapterを置き、実装者判断で `runtime-core` 再利用を許可する。
- v0 clipping範囲。
  - 推奨: composition slot / 既存挙動保持まで。deformed clipping maskは必須にしない。
- hit test粒度。
  - 推奨: 評価後boundsを必須、triangle hitは任意。
- parent deformer下のcontrol point editingのlocal変換。
  - 推奨: 見えている評価後座標を掴めることを優先し、保存時に対象Deformer local offsetへ戻す。

