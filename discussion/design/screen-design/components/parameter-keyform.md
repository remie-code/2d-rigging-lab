# Parameter / Keyform コンポーネント仕様

> 状態: Draft component spec。Parameter Bar、Parameter Control Palette、Quick Create、keyform authoringの画面上の役割を定義する。

## 1. 役割

Parameter / Keyform UIは、Authoring Workspace全体で共有されるparameter value contextを扱う。

Rig、Mesh deformation、Opacity、Subtree opacity、Dynamics、Viewer確認は、いずれも「現在どのparameterのどの値を見ているか」に依存する。そのため、Parameter UIは特定toolのInspector内に閉じ込めず、workspace横断の操作領域として扱う。

Parameter definitionそのものは、Parameter Managerで管理する。Parameter Barはcurrent value操作、Parameter Control Paletteは動作確認、Quick Createは作業中の最低限作成入口である。

## 2. 基本方針

- 常時表示する対象は、1つのactive parameterに限定する。
- 全parameterを常時横並び・縦並びにはしない。
- keyform詳細、parameter一覧、複雑な2D操作は展開UIへ逃がす。
- Canvas / Previewの確認を妨げない。
- Rig / Mesh / Opacity / Subtree opacity / Dynamicsなどのtool-specific操作はInspectorに置き、parameter current valueはParameter Barに置く。
- parameter定義、stable id、grouping、usage referenceの詳細管理はParameter Managerへ送る。

## 3. Parameter Bar

Parameter Barは、現在authoring対象になっている1つのactive parameterを表示・操作する細い帯である。

配置:

- Authoring Workspace下部。
- Canvas / Previewの下、Diagnostics Stripの上。
- 高さは固定または上限付きにし、layoutを押し広げない。

```text
+--------------------------------------------------------------------------------+
| Parameter Bar                                                                  |
| [Parameter selector] [ value slider + key markers ---------------- ] [actions]  |
+--------------------------------------------------------------------------------+
```

領域:

| 領域 | 表示するもの |
|---|---|
| Left | active parameter selector、parameter名、min/default/max summary |
| Center | current value slider、default marker、key markers、selected key marker |
| Right | add/update key、previous/next key、reset default、open details |

表示するもの:

- active parameter名
- current value
- min / default / max
- key marker
- selected key marker
- add / update keyform action
- previous / next key action
- reset default action
- quick create入口
- open Parameter Manager入口

表示しないもの:

- 全parameter一覧
- 全keyform table
- raw evidence
- operation ID
- generated refs
- validator raw payload

## 4. Keyform Authoring

Keyform authoringは、Parameter Barと現在のActive Tool Inspectorが協調して行う。

役割分担:

- Parameter Bar: どのparameterのどの値を見ているかを決める。
- Tool Inspector: どのtarget / propertyへkeyformを打つかを決める。
- Canvas / Preview: 現在値における見た目を確認する。

例: Rig Tool

```text
Rig Inspector: target=rig_head_warp / property=controlPointOffsets
Parameter Bar: parameter=ParamAngleX / current value=30
Canvas: current value 30 のdraft deformation preview
Action: Add keyform
```

例: Rig Tool / Subtree Opacity

```text
Rig Inspector: target=head_turn_deformer / property=subtreeOpacity
Parameter Bar: parameter=ParamAngleX / current value=25
Canvas: current value 25 のdescendant subtree fade preview
Action: Add / Update opacity keyform
```

基本フロー:

```text
Active Toolでtarget/propertyを選ぶ
  -> Parameter Barでactive parameterを選ぶ
  -> sliderでcurrent valueを選ぶ
  -> Canvasで見た目を調整・確認する
  -> Add / Update keyform
```

## 5. Parameter Control Palette

Parameter Control Paletteは、全parameterを動かしてCanvas / Preview上の挙動を確認するための確認用パレットである。

Parameter Barとは別物として扱う。

- Parameter Bar: authoring中の1つのactive parameterを操作する。
- Parameter Control Palette: 全parameterを動かして挙動確認する。

Paletteはmodalではなく、非モーダルのfloating / dockable paletteを基本候補にする。目的は「parameterを動かしながら背後のCanvasを見る」ことなので、中央Canvasを塞がないことを優先する。

```text
+--------------------------------------------------------------+
| Canvas / Preview                                             |
|                                                              |
|      model preview / rig overlay                             |
|                                                              |
|                         +----------------------------+       |
|                         | Parameter Controls         |       |
|                         | Search / group filter      |       |
|                         | Angle X   [------|----]    |       |
|                         | Angle Y   [---|-------]    |       |
|                         | Mouth     [-----|-----]    |       |
|                         | Reset all / close          |       |
|                         +----------------------------+       |
+--------------------------------------------------------------+
| Parameter Bar: active parameter only                         |
+--------------------------------------------------------------+
```

Paletteに置くもの:

- parameter search
- group / category filter
- 全parameter slider
- reset all
- reset selected
- defaultへ戻す
- active parameterへ送る action
- close / collapse

Paletteに置かないもの:

- keyform tableの詳細編集
- rig / mesh / opacity のtarget-specific controls
- raw evidence
- operation ID

Paletteは全parameterを動かせるが、keyform authoringの主UIにはしない。keyformを打つ場合は、対象parameterをactiveにしてParameter BarとTool Inspectorで行う。

## 6. 2D / 複合Parameter

2D parameter pairやgrid keyformは、Parameter Barを横に広げて複数sliderを常時並べない。

collapsed状態:

```text
[ Param Pair: Angle X/Y v ] [ 2D position mini indicator ] [ +key reset expand ]
```

expanded状態:

- 2D pad
- pair axis details
- key marker
- grid keyform summary

2D / 複合parameterの詳細編集は、expanded panelまたはTool Inspector側の専用sectionに逃がす。

## 7. 他Toolとの関係

| Tool / View | Parameter UIとの関係 |
|---|---|
| Rig Tool | Parameter Barのcurrent valueを使ってrotation / warp lattice / subtree opacity keyformをauthoringする。 |
| Mesh Tool | 将来mesh deformation keyformを扱う場合、Parameter Barのcurrent valueを使う。 |
| Drawable Inspector / Opacity | 静的opacityはDrawable Inspectorで扱い、opacity keyform authoringではParameter Barのcurrent valueと協調する。 |
| Dynamics Tool | active input parameterはParameter Barで扱い、group / binding / coefficientはDynamics Inspectorで扱う。本格的なruntime確認はViewer / Runtime Viewへ送る。 |
| Parameter Manager | parameter定義、stable id、display name、min/default/max、grouping、usage referenceを管理する専用画面。 |
| Viewer / Runtime View | より本格的なruntime確認view。Parameter Control Paletteより広い検証文脈を扱う。 |

## 8. Quick Create / Select

Quick Create / Selectは、Rig Tool、Dynamics Tool、Parameter Barなどからparameterが必要になった時に使う軽量入口である。

`UX-FEAT-003` のparameter作成はQuick CreateとParameter Managerが担う。直近operation status、operation log、reload label、diagnosticsの詳細はDiagnostics / Evidence Viewへ分離し、通常UIでは必要なsummaryだけを出す。

置くもの:

- existing parameter selector
- create scalar parameter
- display name
- stable id auto suggestion
- min / default / max
- group
- create action
- open Parameter Manager

置かないもの:

- usage reference詳細
- stable id refactor
- duplicate id解消の詳細UI
- validation report全文

Quick Createは作業を止めないための入口であり、Parameter Managerの代替ではない。

## 9. Tool State

| State | Parameter Bar | Palette | Canvas / Preview |
|---|---|---|---|
| No Active Parameter | selector empty、create/select入口 | closed | tool-specific preview |
| Active Parameter | slider、key markers、actions | closed | current value preview |
| Keyform Authoring | add/update key enabled | optional | target/property preview |
| Palette Open | active parameterは維持 | 全parameter slider表示 | all parameter overrides反映 |
| Blocked | disabled reason表示 | disabled rowsあり | warning / unchanged preview |

## 10. 未決事項

- PaletteをCanvas右側floatingにするか、dockable panelにするか。
- parameter group / category の分類方法。
- key markerが多い場合の密度表現。
- 2D / grid parameter編集をParameter Bar拡張に置くか、別panelに置くか。
- Parameter Control Paletteでの値変更をsession-only previewにするか、viewer/runtime overrideと同じ扱いにするか。
- Quick Createでstable id auto suggestionをどこまで行うか。
