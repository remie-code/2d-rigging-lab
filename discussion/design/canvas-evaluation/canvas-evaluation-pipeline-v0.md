# Canvas Evaluation Pipeline v0

> Draft design basis。Authoring Workspace の Canvas / Preview で、parameterを動かしたときに絵そのものが変形して見えるための評価パイプラインを定義する。

## 1. 目的

次のUX上の主目標は、Parameter Barを動かしたときにCanvas上の絵そのものが変形・回転・フェードして見えることである。

現在までに、PSD import、Canvas表示、Mesh生成、Deformer作成、Parameter作成、Keyform設定、制御点編集の流れは成立しつつある。しかし、parameterを動かした結果がCanvas上の画像へ反映されないと、ユーザーには「設定を作っているだけ」に見えてしまう。

Canvas Evaluation Pipeline v0の目的は、保存されるAuthoringSessionを直接壊さず、Canvasに描くためだけの評価済み描画状態を作ることである。

```text
AuthoringSession
+ current parameter values
+ active draft state
+ active selection / overlay state
        ↓
CanvasEvaluatedScene
        ↓
CanvasRenderer
```

この層により、parameter scrub、keyform補間、deformer親子評価、Apply前preview、overlay追従、hit testを同じ考え方で扱えるようにする。

## 2. 基本方針

- Canvas evaluationは描画用の一時評価であり、model commitではない。
- `AuthoringSession` は保存済みの正本である。
- `parameterValues` は現在のpreview値であり、scrubしてもUndo履歴やdirty stateに入れない。
- Apply前draftやdrag中previewは、Canvasには反映するが、Apply / commitまではAuthoringSessionへ反映しない。
- Deformer Treeは変形評価ツリーであり、Parts Treeは描画順・構造管理のホームである。
- CanvasRendererは、可能な限り生のAuthoringSessionではなく `CanvasEvaluatedScene` を描く。

## 3. 主要データ形

実装上の型名は変更してよいが、概念として次を置く。

```ts
type CanvasEvaluatedScene = {
  drawables: EvaluatedDrawable[];
  overlays: EvaluatedOverlay[];
};

type EvaluatedDrawable = {
  drawableId: DrawableId;
  texture: TextureRef;
  evaluatedMesh: MeshDto;
  opacity: number;
  visible: boolean;
  drawOrder: number;
  clippingMaskIds: DrawableId[];
};
```

v0では最小限として、次を評価済みsceneに含める。

- 描画対象drawable。
- 評価後mesh頂点。
- 評価後opacity。
- visibility。
- draw order。
- selection / mesh / deformer overlay用の評価後座標。

## 4. 入力

Canvas evaluationの入力:

| 入力 | 内容 |
|---|---|
| `AuthoringSession` | committed model state |
| `parameterValues` | 現在のparameter preview値 |
| `meshDraft` | Apply前のmesh preview |
| `rigDraft` | Apply前のWarp / Rotation deformer draft |
| control point drag preview | pointer move中の一時offset |
| selection | 現在選択中のdrawable / part / rigControl |
| overlay toggles | grid / mesh / deformer / selection / isolateなど |

これらを合成して `CanvasEvaluatedScene` を作る。

## 5. Parameter / Keyform評価

v0では `linear-1d-v1` を対象にする。

評価方針:

- active parameterだけでなく、将来的に複数parameter値を持てる構造にする。
- keyform setはparameterIdごとに現在値を読む。
- 現在値がkeyform位置に一致する場合、そのkey statePatchを使う。
- keyform間では線形補間する。
- keyform範囲外はparameter定義のclamp方針に従う。初期はmin/maxへclampしてよい。

keyform対象:

- Drawable opacity。
- Warp Deformerのlattice / control point offsets。
- Warp Deformerのopacity multiplier。
- Rotation Deformerのangle。
- Rotation Deformerのopacity multiplier。

対象外:

- Mesh topology。
- Draw order。
- Visibility。
- Parts Container hierarchy。
- Parameter定義そのもの。

## 6. Deformer評価順

Deformer Treeを評価順として扱う。

```text
parent deformer
  -> child deformer
    -> bound drawable
```

評価ルール:

- 親Deformerの変形が先に適用される。
- 子Deformerは、親の変形結果の上に重なる。
- Drawableは、自分へ到達するDeformer chainを上から順に適用した結果として描画される。
- Deformer Treeに表示される親子構造が、ユーザーに見える評価構造である。

複数Deformerが同じDrawableに作用する場合、Tree上のchain順が結果を決める。別途隠れた評価順を持たせない。

## 7. Warp Deformer評価

v0のWarp Deformer評価:

- rest control pointsを基準にする。
- parameter-evaluated control point offsetsを加算する。
- draft / drag preview offsetがある場合は、committed keyform評価の上にpreviewとして合成する。
- 初期は既存のbilinear grid評価でよい。
- Bezier divisionsは保存されていても、v0評価で未使用なら「stored / future evaluation」として扱う。

Canvas上の絵は、評価後mesh頂点を使って描画する。overlayも評価後座標へ追従する。

## 8. Rotation Deformer評価

v0のRotation Deformer評価:

- pivotを中心にmesh頂点を回転する。
- angleはkeyform評価から得る。
- parent Deformerがある場合、親評価後の座標に対してRotationを適用する。
- rest translation / scaleが既存構造にある場合は扱ってよいが、v0の必須はangleである。

Rotation Deformerのpivot / angle編集UXは別途Rig Tool側で扱うが、Canvas evaluationは評価済みangleを描画に反映する。

## 9. Opacity / Visibility / Clipping

Opacity:

```text
effectiveOpacity =
  drawableBaseOpacity
  * evaluatedDrawableOpacityKeyform
  * product(evaluatedDeformerOpacityMultipliers in chain)
```

Visibility:

- Parts Tree / Inspectorのeditor visibilityはCanvas描画へ反映する。
- parameter keyformではvisibilityを扱わない。
- Runtime向けの表情差分 / 衣装差分切替はVariant / Expression Manager側で扱う。

Clipping:

- clippingは評価パイプライン上のcomposition stepとして位置付ける。
- v0実装で完全反映するかは実装計画時に切るが、後から差し込める場所を確保する。
- 将来的には、deformer評価後のdrawable shapeをmaskとして扱う。

## 10. Draft / Apply前Preview

Apply前状態もCanvasに反映する。

対象:

- Mesh draft。
- Warp Deformer draft。
- Rotation Deformer draft。
- keyform位置でのcontrol point drag preview。
- Inspectorで編集中だがApply前のDeformer bounds / divisions / pivotなど。

方針:

- draftはAuthoringSessionへcommitしない。
- Canvasには評価済みsceneとして反映する。
- 未確定であることは、必要ならInspector側の状態やApply buttonの存在で示す。
- ただし、未確定表示のためにInspectorの縦幅を増やすような常時説明文は置かない。

## 11. Overlay評価

overlayは評価後座標へ追従する。

v0対象:

- selected drawable bounds / outline。
- mesh overlay。
- Warp lattice overlay。
- Rotation pivot / guide。
- draft overlay。

通常表示では、評価後の位置を表示する。keyform編集時は、選択中Deformerの制御点を編集可能状態として強調する。

親Deformerの影響下にある子Deformerの制御点編集では、見えている評価後座標を掴めることを優先する。ただし、保存する値は対象Deformer自身のlocal offsetとして解釈できる形に戻す必要がある。

## 12. Hit Test / Selection

hit testは評価後座標を基準にする。

初期方針:

- v0では評価後mesh boundsで選択してよい。
- 可能ならtriangle hit testへ進める。
- hidden drawableは通常hit test対象にしない。
- topmost drawable selectionを基本にする。
- Deformer overlay上のcontrol pointは、drawable hit testより優先して掴める。

旧位置のrest boundsで選択されると、変形後の見た目と操作がずれるため避ける。

## 13. Undo / Redo境界

Undo / Redoの考え方:

| 操作 | AuthoringSession変更 | Undo対象 |
|---|---:|---:|
| Parameter scrub | なし | なし |
| keyform marker click | なし | なし |
| control point drag preview中 | なし | なし |
| control point drag commit | あり | あり |
| Add / Update / Delete keyform | あり | あり |
| Apply mesh draft | あり | あり |
| Apply deformer draft | あり | あり |
| Cancel draft | なし | なし |
| explicit Fit / Zoom | なし | なし |

Apply / commit後もCanvas viewportは維持する。明示的にFit Artwork / Fit Canvas / 1:1を押した場合のみviewportを変える。

## 14. 実装分離

推奨分離:

```text
editor-session-context
  owns: AuthoringSession, parameterValues, draft state, selection

canvas-evaluation
  owns: AuthoringSession + transient state -> CanvasEvaluatedScene

canvas-renderer
  owns: CanvasEvaluatedScene -> pixels / overlays

canvas interaction hooks
  owns: pointer -> selection/edit commands
```

これにより、CanvasRendererへparameter、keyform、draft、hit test、runtime previewの知識が直接積み上がることを避ける。

## 15. v0 Acceptance Criteria

UX上のAC:

- Parameter Barを動かすと、Canvas上の絵が変形・回転・フェードして見える。
- keyform間では補間結果がCanvasに表示される。
- keyform位置で制御点を動かすと、Apply前でも描画に反映される。
- 親子DeformerはDeformer Treeの親子順に作用する。
- overlayは評価後座標に追従する。
- 変形後の見た目に対してhit testできる。
- Apply後にCanvas viewportが勝手に全身フォーカスへ戻らない。

技術上のAC:

- evaluation helperはdeterministicである。
- parameter scrubはAuthoringSessionを変更しない。
- draft previewはAuthoringSessionを変更しない。
- commit操作だけがUndo対象になる。
- Rendererは評価済みsceneを描く方向へ寄せる。

## 16. 未決事項

- v0でclipping描画まで含めるか、pipeline上のcomposition slot定義に留めるか。
- Warp Deformerの正確なlocal / parent coordinate変換。
- Rotation Deformerのtranslation / scaleをv0必須に含めるか。
- hit testをboundsで始めるか、最初からtriangle hit testへ進めるか。
- CanvasEvaluatedSceneをEditor専用にするか、Viewer / Runtime Previewと共有するか。

