# Rig Tool コンポーネント仕様

> 状態: Draft component spec。あるべき画面レイアウトを中心に記録する。機能拡張そのものは後続waveの課題として扱う。

## 1. 役割

Rig Toolは、Authoring Workspace内で選択中part / drawable / meshに対してrig control、binding、parameter、keyform、subtree opacity effectを作成・確認・編集するActive Toolである。

Rig Toolは、Editorがsemantic recognitionやauto-rig提案を行う場所ではない。ユーザーまたはCodexが対象と操作を明示し、Editorはその明示入力に基づくdraft、preview、commitを提供する。

## 2. 自動化方針との関係

Rig Toolで許可する自動処理は、明示対象に対する決定的な初期配置に限定する。

やること:

- 選択targetのboundsからrotation pivotやwarp lattice boundsの初期値を置く。
- 選択targetに対するrig draft overlayを中央Canvasに表示する。
- ユーザーが指定したprimitive、分割数、parameter、key valueに基づいてoperationをcommitする。
- ユーザーが指定したrig control / deformer相当targetのdescendant subtreeに対し、parameter-driven opacity effectをcommitする。

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
- Structure / Parts: rig対象となるpart / drawable / meshを選択する。Rig Tool中は左ペイン内でParts / Deformersを切り替え、既存rig controlの関連targetも辿れる。
- Canvas / Preview: 選択targetにrig overlayを重ねる。draft状態とcommitted状態を区別する。
- Inspector / Tool Panel: rig primitive、bounds、pivot、lattice分割数、binding、parameter、keyform操作、subtree visibility / opacity effectを表示する。

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

subtree opacity effectも、この協調の中で扱う。Rig Inspectorは対象subtreeとopacity propertyを扱い、Parameter Barはどのparameterのどの値でopacityを確認・keyform化するかを扱う。

## 4.3 Deformer Tree / Drawable Pool

Rig Tool中の左ペインは、Parts TreeとDeformer Treeを切り替えて使う。Parts Treeはpart / drawableの所属、描画順、構造を扱う。Deformer Treeはdeformer hierarchyとbindingを扱う。両者は同じモデルを別の観点で見るUIであり、Deformer Tree上のdrawable表示はParts Treeの実体移動ではなくbinding referenceである。

Deformer viewの基本構造:

```text
Deformers
  Deformer Hierarchy
    - headwear Warp Deformer
      - headwear
      - child Warp Deformer

  Drawable Pool  [collapsed by default]
    - Unbound Drawables
      - hair_f_l
      - hair_f_r
      - mouth
```

`Drawable Pool` は必要に応じて折りたためる領域にし、初期状態では折りたたむ。理由は、通常作業では既存deformer hierarchyを確認する時間の方が長く、全drawable候補を常時表示するとDeformer Treeの視認性を壊すためである。

`Unbound Drawables` は「Parts Treeに未所属」という意味ではない。ここでのunboundは、deformerにまだbindされていない、または現在のdeformer hierarchy上でbinding先を持たないdrawable referenceを指す。UI文言として日本語にする場合も「未所属」ではなく「未バインドDrawable」など、Parts所属と混同しない表現を使う。

Deformer Tree内のDnD:

- `Drawable Pool` のdrawableをdeformer rowへDnDすると、そのdrawableをdeformerへbindする。
- 既存のbound drawable referenceを別deformer rowへDnDすると、binding先deformerを変更する。
- deformer rowを別deformer rowへDnDすると、parent deformerを変更する。
- これらの操作はParts Tree上のpart所属、drawable所属、draw orderを変更しない。
- 循環するdeformer parent変更、存在しないtargetへのdrop、同じbindingの重複などは無効化する。

表示上の注意:

- Deformer Tree内のdrawable rowは、Parts Treeのdrawable実体ではなくbinding referenceとして見える必要がある。
- Drawable Poolは候補置き場であり、通常のhierarchy本体より視覚的に一段控えめにする。
- Drawable Poolを展開したままでも、Deformer Hierarchyが主役であることが崩れないようにする。

## 4.4 Deformer Creation / Insertion

Drawable、Part Container、既存Deformerのどれを選んでいるかで、Create操作の意味は変わる。

Drawable選択時:

- Inspectorには `Create Rotation Deformer` と `Create Warp Deformer` の両方を出す。
- 作成されるdeformerは選択drawableをbound childにする。
- 選択drawableが既存deformer配下にある場合、新しいdeformerは既存親deformerとdrawableの間に挿入する。

```text
Before:
  headwear Warp Deformer
    headwear

Action:
  select headwear -> Create Warp Deformer

After:
  headwear Warp Deformer
    headwear Warp Deformer 2
      headwear
```

この挿入動作により、既存のdeformer hierarchyを保ったまま、選択drawableだけに追加のdeformerを重ねられる。root直下に同じdrawableをbindしたsibling deformerを作る挙動は、通常のCreate操作としては避ける。

既存Deformer選択時:

- Inspectorには `Create Parent Rotation Deformer` と `Create Parent Warp Deformer` を出せる。
- parent作成は、選択deformerの上位に新しいdeformerを挿入する操作である。
- child deformerを新規作成する操作が必要な場合は、別の明示actionとして扱う。

Part Container選択時:

- Container自体はDrawableではないため、直接meshやdrawable変形対象にはしない。
- 配下drawableまたは配下deformerを選ぶpickerを出すか、container配下をまとめるparent deformer作成として扱う。
- どちらにするかは操作名で明示し、暗黙にsemantic groupingやauto-rigをしない。

## 5. Tool State

| State | Canvas | Inspector / Tool Panel | 主な操作 |
|---|---|---|---|
| No Target Selected | 通常previewまたはempty state | part / drawable / mesh選択を促す | Parts Tree / Canvasでtarget選択 |
| Rig Draft | 未commit rig overlay | primitive、bounds/pivot/deformer設定、Apply / Cancel | draft設定、preview確認、commit |
| Keyform Authoring | parameter valueに応じたpreview overlay | parameter選択/作成、key value、state patch、Add keyform | keyform作成 |
| Rig Edit | committed rig overlay | existing rig summary、binding、keyform list、編集入口 | rig確認・編集 |
| Blocked | 対象は表示するが編集不可状態を示す | disabled reasonを人間向けに表示 | mesh作成、unlock、visible化、別target選択 |

## 6. Rotation UX

Rotationは、選択part / drawableに対して回転制御を作るprimitiveである。

UX:

- InspectorでRotationを選ぶ。
- Drawable選択時のRig Inspectorには、Warp DeformerだけでなくRotation Deformer作成入口も出す。
- Canvasにtarget bounds、pivot、rotation guideを表示する。
- pivotはtarget boundsから初期配置するが、Inspectorから変更できる。
- Applyでrotation2d rig controlを作り、targetへbindする。
- keyform authoringではparameter、key value、angleを指定する。

現状実装との関係:

- `rotation2d` rig controlとangle keyformは既存概念として存在する。
- 画面設計上は、巨大なProject-defined Rig Controls panelではなく、Rig ToolのDraft / Keyform Authoringへ再配置する。

## 7. Warp Deformer UX

Warp Deformerは、選択targetに対して2D変形領域を作り、子Drawable / 子Deformerを変形するprimitiveである。

ユーザー向け概念として、Bezier編集は別primitiveではなくWarp Deformerが持つ機能として扱う。内部的には、Warp Deformerは「編集しやすいBezier edit surface」と「実際に変形を評価するtransform grid / lattice」を持つ。

```text
Warp Deformer
  Bezier edit surface
    - Bezier divisions
    - Bezier edit type
    - Bezier control points / handles

  Transform grid / lattice
    - Transform divisions
    - Evaluation control points
    - Child drawable / child deformer deformation
```

この分離はユーザーに別primitiveとして見せるためではなく、Inspector項目と内部model構造を整理するためのものである。

あるべき画面:

- InspectorでWarp Deformerを選ぶ。
- InspectorからTransform divisionsを変更できる。
- InspectorからBezier divisionsを変更できる。
- Transform divisionsやBezier divisionsを変更するとCanvasのdeformer preview overlayが更新される。
- boundsはtarget boundsから初期配置されるが、Inspectorから変更できる。
- ApplyでWarp Deformer rig controlを作り、targetへbindする。
- keyform authoringではparameter、key value、control point offsetsを編集する。

現状実装との関係:

- データ契約上、`warpLattice2d` は `latticeColumns` / `latticeRows` を持つ。
- 現行Editor draft UXは最小 `2x2` 固定であり、`bilinear-grid-v1` 固定である。
- Wave62候補では、Warp Deformerを最初からTransform divisionsとBezier divisionsを持つ構造として扱う。これは将来UI項目ではなく、内部構造に関わる初期設計対象である。

### 7.1 Transform Divisions

Transform divisionsは、Warp Deformerが子Drawable / 子Deformerを実際に変形評価するための格子解像度である。

Cubism風UIの「変換の分割数」に相当する。ユーザー向けには「変形をどれだけ細かく計算するか」と説明できる。

Inspectorに置くもの:

- Transform columns
- Transform rows
- Cell count summary
- Reset to preset

設計上の注意:

- `columns / rows` が制御点数なのかcell数なのかをUI文言で曖昧にしない。
- 初期UIでは `Transform divisions: 5 x 5` のように扱ってよいが、内部modelでは control point count と cell count の関係を明確にする。
- 変換分割数を変更すると、既存keyformやrest control pointsとの互換が壊れる可能性があるため、生成済みkeyformがある場合は確認またはdisabledにする。

### 7.2 Bezier Divisions

Bezier divisionsは、Warp Deformerの形状をユーザーが曲線的に編集するための編集面の分割数である。

これは別primitiveではなく、Warp Deformerの編集しやすさを支える上位表現として扱う。Bezier edit surfaceから、実際に評価されるTransform grid / latticeへ変換される。

Inspectorに置くもの:

- Bezier columns
- Bezier rows
- Bezier edit type
- Reset bezier control points

Canvas overlayに置くもの:

- Bezier control points
- Bezier handles / control lines
- Transform gridとの対応が分かる補助表示

設計上の注意:

- Bezier divisionsを変更するとBezier control points / handlesの数が変わる。
- Bezier edit surfaceとTransform gridの対応を決定的にする。
- 初期実装ではBezier control pointの高度な手動編集まで完了しなくてもよいが、Warp Deformerのmodel構造には最初からBezier edit surfaceを考慮する。
- Bezier edit typeは、初期は1種類に固定してreadonly表示でもよい。ただし将来の編集type追加を妨げない形にする。

### 7.3 Warp Deformer Inspector項目の層分け

Warp Deformerが設定可能な項目と、初期Inspectorで触れる項目は分けて考える。

設定可能な項目:

- name
- stable id
- parent deformer
- bound children
- domain bounds
- opacity multiplier
- multiply color
- screen color
- Transform divisions
- Bezier divisions
- Bezier edit type
- Bezier control points / handles
- rest shape
- compatibility / migration metadata

初期Inspectorで触る項目:

- name
- parent deformer
- bound children summary
- domain bounds
- Transform divisions
- Bezier divisions
- Bezier edit type readonly or fixed default
- opacity multiplier
- reset / fit actions
- Apply / Cancel

初期Inspectorでは通常隠す項目:

- stable id
- rest shape raw data
- compatibility metadata
- raw control point arrays
- operation / evidence refs

Appearance項目として後続に回してよいもの:

- multiply color
- screen color

Deformer Inspectorで扱うopacityは、選択deformer subtreeにかかる静的なopacity multiplierである。これはparameter値に応じてfadeするSubtree Visibility / Opacityとは別であり、Keyform Authoringなしに常時効く基本属性として扱う。

Deformer Inspectorの編集方針:

- nameは後から変更できる。
- parent deformerは後から変更できる。ただし循環する変更は無効化する。
- bound childrenはsummaryを表示し、追加 / 移動はDeformer TreeのDnDやDrawable Poolから行う。
- domain boundsはfit / resetできる。数値編集を置く場合も、raw payloadではなく人間向けのboundsとして出す。
- Transform divisionsとBezier divisionsは後から変更できる。ただしkeyformやrest surfaceとの互換が壊れる場合は確認またはdisabledにする。
- opacity multiplierは静的な見た目調整として編集できる。
- Bezier edit typeは初期ではreadonlyまたは固定defaultでよい。

## 8. Subtree Visibility / Opacity UX

Subtree Visibility / Opacityは、選択中rig control / deformer相当targetの配下要素を、parameter valueに応じてまとめてフェードさせるためのRig Tool内sectionである。

このUXは、単一drawableの静的opacityを編集するものではない。個々のdrawableへ同じopacity keyformを大量に打つ代わりに、rig control / deformer配下のsubtreeへopacity multiplierを適用する。

扱うシナリオ:

```text
Rig Inspector: target=head_turn_deformer / property=subtreeOpacity
Parameter Bar: parameter=ParamAngleX / current value=25
Canvas: current value 25 におけるdescendant subtreeのfade preview
Action: Add / Update opacity keyform
```

Inspectorに置くもの:

- effect enabled
- affected subtree summary
- scope: selected rig control descendants
- opacity property: subtree opacity multiplier
- active parameter summary
- key value / opacity value pairs
- interpolation / fade behavior summary
- add / update keyform action
- reset effect action
- Open in Viewer

最小表現:

```text
Subtree Visibility / Opacity
  Scope: this rig control descendants
  Parameter: ParamAngleX
  Keys:
    20 -> opacity 1.0
    30 -> opacity 0.0
```

「ある値を境にフェードアウトする」表現は、boolean switchではなく、近接したparameter key間のopacity interpolationとして扱う。たとえば `20 -> 1.0`、`30 -> 0.0` のように置くことで、20から30の間で徐々にfadeする。

Canvasに置くもの:

- affected subtree highlight
- current opacity preview
- selected rig control / deformer relation
- disabled / invalid state warning

表示しないもの:

- descendant drawable全件のraw list
- 各drawableへ展開されたlow-level opacity operation全文
- raw runtime evidence
- operation ID

Part単位の表情差分やパーツ差分の切り替え・フェードは、将来のVariant / Expression管理とも関係する。ただし「デフォーマ以下の要素をparameter値でフェードする」シナリオは、Rig Toolのsubtree opacity effectとして扱う。

## 9. 表示する情報

- 選択target名
- rig status: none / draft / committed / blocked
- primitive: Rotation / Warp Deformer
- binding target
- parameter
- key value
- subtree opacity effect status
- pivot / bounds
- lattice columns / rows
- control point count
- keyform count
- last operation summary
- warning count

## 10. 表示しない情報

- raw evidence全文
- operation ID全文
- generated refs全文
- source refs全文
- runtime evidence raw payload
- validator diagnostic raw payload

これらは必要に応じてDiagnostics / Evidence ViewやCodex-facing structured surfaceに置く。

## 11. 既存機能との対応

現在の実装には、project-defined `rotation2d` rig control、rig-control keyform、`controlPointOffsets` を持つ `warpLattice2d`、semantic bilinear warp evaluation、Minimum Open Dynamics v1が存在する。

画面設計上は、これらを巨大なProject-defined Rig Controls panelから分離し、Rig Active ToolのCanvas overlayとInspector / Tool Panelへ再配置する方向で考える。

## 12. 未決事項

- Rig Tool内でRotation / Warp Deformer以外のprimitiveをいつ扱うか。
- Warp Deformerの分割数変更、parent変更、opacity multiplier編集、Drawable Pool binding DnDをどのwaveで実装するか。
- keyform authoringをRig Tool内に常設するか、parameter/keyform専用sub-panelに分けるか。
- subtree opacity effectを初期実装に含めるか、後続waveに回すか。
- subtree opacity effectのscopeをrig control descendantsだけに限定するか、part subtreeも含めるか。
- Dynamicsの詳細なcoefficient / output binding設計。Dynamics自体は別Active Toolとして扱う。
- Canvas overlayでcommitted rigとdraft rigをどう視覚的に区別するか。
