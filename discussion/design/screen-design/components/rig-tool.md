# Rig Tool コンポーネント仕様

> 状態: Draft component spec。あるべき画面レイアウトを中心に記録する。機能拡張そのものは後続waveの課題として扱う。

## 1. 役割

Rig Toolは、Authoring Workspace内で選択中part / drawable / meshに対してrig control、binding、parameter、keyformを作成・確認・編集するActive Toolである。

Rig Toolは、Editorがsemantic recognitionやauto-rig提案を行う場所ではない。ユーザーまたはCodexが対象と操作を明示し、Editorはその明示入力に基づくdraft、preview、commitを提供する。

## 2. 自動化方針との関係

Rig Toolで許可する自動処理は、明示対象に対する決定的な初期配置に限定する。

やること:

- 選択targetのboundsからrotation pivotやwarp lattice boundsの初期値を置く。
- 選択targetに対するrig draft overlayを中央Canvasに表示する。
- ユーザーが指定したprimitive、分割数、parameter、key valueに基づいてoperationをcommitする。

やらないこと:

- part名、layer名、画像内容からrig種類を推定する。
- 髪、目、口、体などのsemantic roleを自動分類する。
- deformer、parameter、keyform、physicsの一式を自動提案・自動構築する。
- Cubism互換のdeformer / physicsを主張する。

## 3. 基本フロー

```text
Parts Tree / Canvasでtargetを選択
  -> ToolboxのRigを選ぶ
  -> Rig Draftに入る
  -> Inspectorでrig primitiveと設定を選ぶ
  -> Canvasに未commit rig overlayが表示される
  -> Applyでrig control / bindingをcommit
  -> Keyform AuthoringまたはRig Editへ進む
```

逆順も許可する。

```text
ToolboxのRigを選ぶ
  -> target未選択ならempty tool stateを表示
  -> Parts Tree / Canvasでtargetを選ぶ
  -> Rig Draftまたは既存Rig Editへ進む
```

## 4. Workspace内の配置

Authoring Workspace全体の配置は [../screens/authoring-workspace.md](../screens/authoring-workspace.md) に委譲する。この文書では、Rig Tool固有の表示だけを扱う。

rig overlayは中央のCanvas / Preview領域に固定して表示する。専用画面、modal、別windowとしてrig editorを開く意図ではない。

領域ごとの役割:

- Toolbox: Rig toolがactiveであることを示す。
- Structure / Parts: rig対象となるpart / drawable / meshを選択する。既存rig controlの関連targetもここから辿れる。
- Canvas / Preview: 選択targetにrig overlayを重ねる。draft状態とcommitted状態を区別する。
- Inspector / Tool Panel: rig primitive、bounds、pivot、lattice分割数、binding、parameter、keyform操作を表示する。

## 4.1 Canvas Overlay

Canvas overlayは、中央Canvas / Preview内で選択targetに重ねて表示する編集表示である。

Rotation draft:

```text
+------------------------------------------------------------------+
| Canvas / Preview                                                  |
|                                                                  |
|          selected target bounds                                   |
|       +--------------------------------+                           |
|       |                                |                           |
|       |              x pivot           |                           |
|       |           ----+----            |                           |
|       |          /         \           |                           |
|       +--------------------------------+                           |
|              rotation arc / draft guide                            |
|                                                                  |
+------------------------------------------------------------------+
```

Warp / Lattice draft:

```text
+------------------------------------------------------------------+
| Canvas / Preview                                                  |
|                                                                  |
|          selected target bounds                                   |
|       +--------------------------------+                           |
|       | o----------o----------o        |                           |
|       | |          |          |        |                           |
|       | o----------o----------o        |                           |
|       | |          |          |        |                           |
|       | o----------o----------o        |                           |
|       +--------------------------------+                           |
|          lattice columns / rows reflect Inspector settings         |
|                                                                  |
+------------------------------------------------------------------+
```

表示するもの:

- 選択target bounds
- rotation pivot / guide
- warp lattice bounds
- lattice control points
- binding target highlight
- draft / committed状態
- hover / selected状態

表示しないもの:

- operation ID
- evidence refs
- generated refs全文
- raw runtime / validator payload

## 4.2 Rig Draft / Preview

Rig Draftでは、Inspector / Tool Panelで指定した設定に応じて、中央Canvasの未commit overlayを更新する。

Inspector / Tool Panelに置くもの:

- target summary
- rig primitive: Rotation / Warp Lattice
- display name
- binding target
- Rotation: pivot X / Y、rest angle
- Warp / Lattice: bounds、lattice columns、lattice rows、interpolation / mode
- Apply action
- Cancel / reset draft action

Canvasに置くもの:

- 選択target
- 選択primitiveに応じたdraft overlay
- 未commitであることが分かるpreview表示

Applyするまでproject rig controlは変更しない。Apply後に通常operationとしてrig control / bindingをcommitする。

Keyform authoringでは、Parameter BarとRig Inspectorが協調する。Parameter Barはactive parameterとcurrent valueを扱い、Rig Inspectorはtarget / property / state patchを扱う。Parameter / Keyform UIの詳細は [parameter-keyform.md](parameter-keyform.md) を参照する。

## 5. Tool State

| State | Canvas | Inspector / Tool Panel | 主な操作 |
|---|---|---|---|
| No Target Selected | 通常previewまたはempty state | part / drawable / mesh選択を促す | Parts Tree / Canvasでtarget選択 |
| Rig Draft | 未commit rig overlay | primitive、bounds/pivot/lattice設定、Apply / Cancel | draft設定、preview確認、commit |
| Keyform Authoring | parameter valueに応じたpreview overlay | parameter選択/作成、key value、state patch、Add keyform | keyform作成 |
| Rig Edit | committed rig overlay | existing rig summary、binding、keyform list、編集入口 | rig確認・編集 |
| Blocked | 対象は表示するが編集不可状態を示す | disabled reasonを人間向けに表示 | mesh作成、unlock、visible化、別target選択 |

## 6. Rotation UX

Rotationは、選択part / drawableに対して回転制御を作るprimitiveである。

UX:

- InspectorでRotationを選ぶ。
- Canvasにtarget bounds、pivot、rotation guideを表示する。
- pivotはtarget boundsから初期配置するが、Inspectorから変更できる。
- Applyでrotation2d rig controlを作り、targetへbindする。
- keyform authoringではparameter、key value、angleを指定する。

現状実装との関係:

- `rotation2d` rig controlとangle keyformは既存概念として存在する。
- 画面設計上は、巨大なProject-defined Rig Controls panelではなく、Rig ToolのDraft / Keyform Authoringへ再配置する。

## 7. Warp / Lattice UX

Warp / Latticeは、選択targetに対して格子状の制御点を置き、controlPointOffsets keyformで変形するprimitiveである。

あるべき画面:

- InspectorでWarp / Latticeを選ぶ。
- Inspectorからlattice columns / lattice rowsを変更できる。
- columns / rowsを変更するとCanvasのlattice preview overlayが更新される。
- boundsはtarget boundsから初期配置されるが、Inspectorから変更できる。
- ApplyでwarpLattice2d rig controlを作り、targetへbindする。
- keyform authoringではparameter、key value、control point offsetsを編集する。

現状実装との関係:

- データ契約上、`warpLattice2d` は `latticeColumns` / `latticeRows` を持つ。
- 現行Editor draft UXは最小 `2x2` 固定であり、`bilinear-grid-v1` 固定である。
- Bezier分割数やBezier deformerは現行モデルにはない。後続で必要なら別primitiveまたは新しいmodel設計として扱う。

## 8. 表示する情報

- 選択target名
- rig status: none / draft / committed / blocked
- primitive: Rotation / Warp Lattice
- binding target
- parameter
- key value
- pivot / bounds
- lattice columns / rows
- control point count
- keyform count
- last operation summary
- warning count

## 9. 表示しない情報

- raw evidence全文
- operation ID全文
- generated refs全文
- source refs全文
- runtime evidence raw payload
- validator diagnostic raw payload

これらは必要に応じてDiagnostics / Evidence ViewやCodex-facing structured surfaceに置く。

## 10. 既存機能との対応

現在の実装には、project-defined `rotation2d` rig control、rig-control keyform、`controlPointOffsets` を持つ `warpLattice2d`、semantic bilinear warp evaluation、Minimum Open Dynamics v1が存在する。

画面設計上は、これらを巨大なProject-defined Rig Controls panelから分離し、Rig Active ToolのCanvas overlayとInspector / Tool Panelへ再配置する方向で考える。

## 11. 未決事項

- Rig Tool内でRotation / Warp Lattice以外のprimitiveをいつ扱うか。
- Warp / Latticeの分割数変更を初回実装に含めるか、後続waveに回すか。
- keyform authoringをRig Tool内に常設するか、parameter/keyform専用sub-panelに分けるか。
- DynamicsをRig Toolの一部として扱うか、別Active ToolまたはViewとして扱うか。
- Canvas overlayでcommitted rigとdraft rigをどう視覚的に区別するか。
