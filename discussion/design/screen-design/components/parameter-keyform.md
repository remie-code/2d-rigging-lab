# Parameter / Keyform コンポーネント仕様

> 状態: Draft component spec。Parameter Bar、Parameter Control Palette、Quick Create、keyform authoringの画面上の役割を定義する。

## 1. 役割

Parameter / Keyform UIは、Authoring Workspace全体で共有されるparameter value contextを扱う。

Rig、Mesh deformation、Opacity、Subtree opacity、Dynamics、Viewer確認は、いずれも「現在どのparameterのどの値を見ているか」に依存する。そのため、Parameter UIは特定toolのInspector内に閉じ込めず、workspace横断の操作領域として扱う。

Parameter definitionそのものは、Parameter Managerで管理する。Parameter Barはcurrent value操作、Parameter Control Paletteは動作確認、Quick Createは作業中の最低限作成入口である。

## 1.1 実装状況

Wave53 final integration report/review `pass` により、Authoring Workspace 下部に Parameter Bar v0 surface が実装・統合済みである。現時点の v0 は、1つの active parameter の summary、current value slider、key marker summary、reset / add-update / quick create / Parameter Manager launcher callbacks を扱う。

これは full Parameter Manager、Parameter Control Palette、全parameter一覧、全keyform table、2D/grid parameter editing の完成ではない。Parameter Manager / Variant / Expression Manager / advanced keyform authoring は後続waveの範囲である。

## 2. 基本方針

- 常時表示する対象は、1つのactive parameterに限定する。
- 全parameterを常時横並び・縦並びにはしない。
- keyform詳細、parameter一覧、複雑な2D操作は展開UIへ逃がす。
- Canvas / Previewの確認を妨げない。
- Rig / Mesh / Opacity / Subtree opacity / Dynamicsなどのtool-specific操作はInspectorに置き、parameter current valueはParameter Barに置く。
- parameter定義、stable id、grouping、usage referenceの詳細管理はParameter Managerへ送る。
- Keyform専用Inspectorは作らない。選択中対象のInspectorをparameter-awareにし、そこでkeyform保存・更新・削除を扱う。
- 補間中の値を見ているときは、対象Inspectorに補間結果を表示するが、対象propertyの編集はlockする。編集したい場合は現在値にkeyformを追加する。
- Parameter preset、group分類、camera capture / runtime inputとの対応はParameter Manager側の別論点として扱い、本コンポーネント仕様では深掘りしない。

## 3. Parameter Bar

Parameter Barは、現在authoring対象になっている1つのactive parameterを表示・操作する細い帯である。

配置:

- Authoring Workspace下部。
- Canvas / Previewの下、Diagnostics Stripの上。
- 高さは固定または上限付きにし、layoutを押し広げない。

```text
+------------------------------------------------------------------------------------------------+
| Parameter Bar | [Manage] [ParamAngleX v] [Reset] [... ] | -30 |====●====| 30 | 0.00 |
|               | [Add] [Update] [Delete] [Ends] [Ends+Center] | key markers on slider   |
+------------------------------------------------------------------------------------------------+
```

領域:

| 領域 | 表示するもの |
|---|---|
| Left | open Parameter Manager、active parameter selector、parameter名 |
| Center | current value slider、min/default/max、key markers、selected key marker、numeric input |
| Right | add / update / delete current keyform、preset keyform actions、reset actions、overflow menu |

表示するもの:

- active parameter名
- current value
- min / default / max
- key marker
- selected key marker
- add / update / delete current keyform action
- add ends action
- add ends + center action
- previous / next key action
- reset active parameter to default action
- reset all parameters to default action
- quick create入口
- open Parameter Manager入口

配置方針:

- Parameter Barは1行横長を基本とし、Canvas / Previewの縦幅を圧迫しない。
- Barの高さは固定し、ボタンの折り返しで縦に伸ばさない。
- 画面幅が足りない場合は、低頻度操作をoverflow menuへ畳む。

常時表示を優先するもの:

- active parameter selector
- current value slider
- numeric input
- Add / Update / Delete current keyform
- Reset active parameter

overflow menuへ畳んでよいもの:

- Reset All
- Add Ends
- Add Ends + Center
- Open Parameter Manager

表示しないもの:

- 全parameter一覧
- 全keyform table
- raw evidence
- operation ID
- generated refs
- validator raw payload

## 4. Keyform Authoring

Keyform authoringは、Parameter Barと現在のActive Tool Inspector / Selection Inspectorが協調して行う。

役割分担:

- Parameter Bar: どのparameterのどの値を見ているかを決める。
- 対象Inspector: 選択中targetのpropertyを編集し、その状態をkeyformとして保存・更新・削除する。
- Canvas / Preview: 現在値における見た目を確認する。
- Keyform専用Inspector: 作らない。

例: Rig Tool

```text
Warp Deformer Inspector: target=rig_head_warp / property=controlPointOffsets
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

### 4.1 Parameter-aware Inspector

選択中対象のInspectorは、通常property編集領域に加えてParameter Binding sectionを持つ。

Warp Deformer選択時の例:

```text
+--------------------------------+
| Warp Deformer                  |
| Name                           |
| Parent Deformer                |
| Opacity                        |
| Transform divisions            |
| Bezier divisions               |
+--------------------------------+
| Parameter Binding              |
| Active parameter: ParamAngleX  |
| Current value: 0.00            |
| Keyform: Exists                |
|                                |
| [Add] [Update] [Delete]        |
| [Ends] [Ends + Center]         |
+--------------------------------+
```

Drawable / Deformer / Rotation Deformerなど、対象ごとにkeyform化できるpropertyは異なる。ただし操作の形は共通化する。

- 対象の通常propertyを編集する。
- active parameterとcurrent valueを確認する。
- 現在値にkeyformがあるかを表示する。
- 現在値へAdd / Update / Deleteする。
- よく使う初期配置としてEnds / Ends + Centerを提供する。

Parameter Binding sectionに置く基本操作:

| 操作 | 意味 |
|---|---|
| Add | 現在のparameter値にkeyformを追加する。 |
| Update | 現在のparameter値にあるkeyformを、現在の対象状態で更新する。 |
| Delete | 現在のparameter値にあるkeyformを削除する。 |
| Ends | min / max にkeyformを作る。 |
| Ends + Center | min / default / max にkeyformを作る。 |

### 4.2 Keyform位置以外の編集lock

current valueがkeyform位置ではない場合、Canvas / PreviewとInspectorには補間結果を表示する。

ただし、補間中のpropertyを直接編集すると「補間結果を編集している」のか「新しいkeyformを作っている」のかが曖昧になるため、対象propertyの編集はlockする。

```text
Parameter Binding
Active parameter: ParamAngleX
Current value: 0.34
Keyform: None

Interpolated values are shown.
Editing is locked until a keyform is added.

[Add Keyform Here]
```

この状態では、通常property欄は補間値を表示するがdisabledにする。操作可能なのは `Add Keyform Here` である。

`Add Keyform Here` 後は、そのcurrent valueにkeyformが作られ、対象property編集が有効になる。

### 4.3 Keyform対象property

v0のkeyform対象は、parameterで連続的に変化する必要があるpropertyだけに絞る。

Parts Tree上の静的構造、描画順、mesh topology、parameter定義そのものはkeyform対象にしない。parameter keyform authoringの主文脈はDeformer Treeであり、Parts Treeは構造・描画順・静的属性のホームとして扱う。

| 対象 | keyform化するもの | keyform化しないもの |
|---|---|---|
| Drawable | opacity | visibility、clipping、draw order、name、texture、mesh topology |
| Parts Container | 対象外 | visibility gate、name、hierarchy |
| Warp Deformer | lattice / control point positions、opacity multiplier | transform divisions、bezier divisions、parent、bounds、name |
| Rotation Deformer | rotation angle、opacity multiplier | pivot、parent、name |
| Mesh | 対象外 | vertex topology、UV、source texture |
| Parameter | 対象外 | Parameterはkeyformの軸であり、keyform対象ではない |

Drawable opacityは例外的にDrawableを対象とするが、基本的にはDeformer Tree内のbound Drawable ref文脈で扱う。Parts Treeから任意のDrawable propertyをparameter化できる設計にはしない。

Visibilityはparameter keyform対象にしない。連続的な表示変化はopacity keyformで扱い、表情差分・衣装差分・状態切替はVariant / Expression Manager側で扱う。

Inspectorごとの表示方針:

| Inspector | Parameter-aware section |
|---|---|
| Drawable Inspector | opacity keyform sectionのみ |
| Warp Deformer Inspector | lattice keyform、opacity multiplier keyform |
| Rotation Deformer Inspector | angle keyform、opacity multiplier keyform |
| Parts Container Inspector | parameter bindingなし |
| Mesh Tool / Mesh Inspector | parameter bindingなし |

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
