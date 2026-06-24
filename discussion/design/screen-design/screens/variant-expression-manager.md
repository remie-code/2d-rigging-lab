# Variant / Expression Manager 画面仕様

> 状態: Revised draft screen spec。

## 1. 役割

Variant / Expression Managerは、表情差分、衣装差分、アクセサリ差分など、Runtimeで切り替えたいDrawable表示セットを管理する専用画面である。

この画面は、単一Drawableのvisibilityを編集するDrawable Inspectorではない。Parameter / Keyformで動くOpacityや、Rig Toolのdeformer編集でもない。ユーザーが「この差分を選んだとき、どのDrawableが表示対象になるか」を明示的に管理するための画面である。

重要な方針:

- Variantは既存visibilityを上書きしない。既存visibilityに追加でかかる表示条件として扱う。
- 表情差分と衣装差分は同時に適用されうるため、単一のflatなstate listにはしない。
- Variant Group単位で、`single select` または `multi toggle` の適用モードを持つ。
- Drawableは高々1つのVariant Groupにだけ所属できる。
- 同じGroup内では、1つのDrawableが複数Variantに所属してよい。
- Drawable Pool上の未所属Drawableは、素材候補でありVariant対象にはしない。

## 2. 用語

| 用語 | 意味 |
|---|---|
| Variant Group | Expression、Outfit、Accessoryなど、意味上ひとまとまりの差分グループ。 |
| Variant | Group内の選択肢。例: Smile、Sad、Hoodie、Jacket。 |
| Group mode | Groupの適用方式。`single select` または `multi toggle`。 |
| Target Drawable | Groupに追加されたDrawable。membership matrixの行になる。 |
| Membership | Target DrawableがどのVariantで表示対象になるかを示すチェック状態。 |
| Default active selection | Runtime Export / Runtime Player起動時に初期適用されるGroupごとのVariant選択。 |
| Preview active selection | Manager / Viewerで確認するための一時的なGroupごとのVariant選択。 |
| Variant-neutral Drawable | どのVariant Groupにも所属していないDrawable。Variant条件では常に通過する。 |
| Runtime graph Drawable | Deformer / rig control graphに所属し、Runtime Export対象になりうるDrawable。 |

## 3. 表示条件の意味論

Variantは「表示する/しない」を単独で決定しない。Canvas、Viewer、Runtimeには既に複数の表示条件があるため、Variantはその上に追加されるpredicateとして扱う。

概念式:

```text
finalVisible =
  existingVisibilityPredicates
  AND variantVisibilityPredicate
```

既存visibilityに含まれるもの:

- Drawable runtime visibility。
- Parts Container / ancestor hidden gate。
- Keyformによるvisibility / opacity評価。
- Runtime側のmask / clipping / opacity評価。
- Rendererが描画可能と判断するためのtexture / mesh / bounds条件。

Variant側のpredicate:

```text
if drawable is not assigned to any Variant Group:
  variantVisibilityPredicate = true

if drawable is assigned to a Variant Group:
  variantVisibilityPredicate =
    active Variant selection for that Group includes this drawable
```

したがって、Variantに含まれていないDrawableは「常に表示」ではない。正確には、Variant条件では落とされないだけで、既存visibilityには従う。

Keyform visibilityとの関係:

- Variant falseなら、Keyformがvisibleを返しても表示されない。
- Variant trueなら、最終表示はKeyform / Parts visibility / opacityなどの既存条件に従う。
- VariantはKeyformを置き換えない。

## 4. 基本UX

基本操作は次の流れにする。

```text
1. Variant Groupを作る
2. GroupにTarget Drawableを追加する
3. Group内にVariant列を作る
4. MatrixでDrawableとVariantの所属を編集する
5. Groupごとのdefault active selectionを設定する
6. Preview active selectionで切り替え結果を確認する
7. Viewer / Runtimeで完成品として確認する
```

作成と逆向きの操作も必須にする。

- Group削除。
- Variant削除。
- DrawableをGroupから除外。
- Group名 / Variant名 / Group modeの編集。

## 5. 開き方

Variant / Expression Managerはmodalではなく、Authoring Workspaceから開く専用Task / Manager画面として扱う。

```text
Authoring Workspace
  -> Toolbox / Variants
  -> Variant / Expression Manager
  -> Group / Variant / Matrixを編集
  -> Back
```

Viewer / Runtime Viewでは、完成品確認としてVariant切り替え結果を見られるようにする。Variant定義そのものの編集はこのManagerに集約する。

Authoring Workspaceには、v0では常設のVariant切り替えUIを置かない。モデル作成中にVariantを切り替える頻度は高くない想定であり、通常編集画面に常設するとParameter BarやToolboxの責務がぼやけるためである。

Authoring Workspaceに出す場合は、現在preview中のVariant状態を小さく表示し、クリックでVariant / Expression Managerへ移動する程度に留める。

```text
Variants: Expression Default / Outfit Hoodie
```

## 6. 画面配置

```text
+--------------------------------------------------------------------------------+
| <- Back   Variant / Expression Manager                         Preview in Viewer |
+----------------------+---------------------------------------------------------+
| Variant Groups        | Group: Outfit                              [Delete Group] |
|                      | Mode: Single select                                      |
| + New Group          |                                                         |
|                      | Variants                                                |
| Expression   single  | [Default] [Hoodie] [Jacket] [+ New Variant]              |
| Outfit       single  |                                                         |
| Accessory    multi   | Default active: Default                                 |
|                      | Preview active: Hoodie                                  |
|                      | Target Drawables                         [+ Add Drawables] |
|                      |                                                         |
|                      | Drawable                 Default   Hoodie   Jacket        |
|                      | -------------------------------------------------------- |
|                      | base_clothes            [x]       [ ]      [ ]           |
|                      | hoodie_body             [ ]       [x]      [ ]           |
|                      | jacket_body             [ ]       [ ]      [x]           |
|                      | shared_inner            [x]       [x]      [x]           |
|                      | hair_clip               [ ]       [x]      [x]  [Remove] |
+----------------------+---------------------------------------------------------+
| Check Strip: no conflicts                                                        |
+--------------------------------------------------------------------------------+
```

主領域:

| 領域 | 役割 |
|---|---|
| Header | 戻る、Viewer確認導線、保存状態を表示する。 |
| Variant Groups | Group一覧、作成、選択、削除入口を表示する。 |
| Group Settings | Group名、mode、削除を扱う。 |
| Variants | Variant列の作成、リネーム、削除、default active / preview active selectionを扱う。 |
| Target Drawables | Groupに属するDrawable行を管理する。 |
| Membership Matrix | Drawableごとに、どのVariantで表示対象になるかを編集する中心UI。 |
| Check Strip | 他Group重複、Variantなし、target不正などの決定論的警告を出す。 |

## 7. Variant Group

Groupは、差分の意味単位である。

代表例:

| Group | Mode | 意味 |
|---|---|---|
| Expression | `single select` | 通常顔、笑顔、困り顔など、同時に1つだけ選ぶ表情差分。 |
| Outfit | `single select` | Hoodie、Jacketなど、同時に1つだけ選ぶ衣装差分。 |
| Accessory | `multi toggle` | メガネ、猫耳、涙など、複数同時にON/OFFしうる差分。 |

Group作成時のtemplate:

- Expression: name `Expression`, mode `single select`。
- Outfit: name `Outfit`, mode `single select`。
- Accessory: name `Accessory`, mode `multi toggle`。
- Custom: userがnameとmodeを選ぶ。

これらは初期値を埋めるだけのtemplateであり、特別な内部挙動は持たない。

削除:

- Group削除は、Group、Variant、membershipを削除する。
- Drawable自体は削除しない。
- Group削除後、そのDrawableはvariant-neutralに戻る。

## 8. Variant

VariantはGroup内の列である。

`single select` Group:

- active Variantは1つだけ。
- Group作成時に `Default` Variantを自動作成する。
- 最後のVariant削除はブロックする。Groupごと消したい場合はGroup削除を使う。

`multi toggle` Group:

- 複数Variantを同時にactiveにできる。
- 各Variantは独立したON/OFF対象として扱う。

Variant削除:

- Variant列を削除する。
- 対象Variantのmembershipも削除する。
- activeだったVariantを消した場合、`single select`ではDefaultまたは先頭Variantへ戻す。

## 9. Active Variant State

active Variantには、意味の違う2種類を持たせる。

| State | 役割 | 保存 |
|---|---|---|
| Default active selection | Runtime Export / Runtime Player起動時の初期状態。Groupごとの初期Variant選択を表す。 | Project stateに保存する。Runtime Exportにも含める。 |
| Preview active selection | Manager / Viewerで切り替え結果を確認するための一時状態。 | 原則session-local。Project意味論としては保存しない。 |

`single select` Group:

- Default active selectionは1つのVariantを指す。
- Preview active selectionも1つのVariantを指す。
- Variant削除でdefault対象が消える場合は、Default Variantまたは先頭Variantへ移す。

`multi toggle` Group:

- Default active selectionはVariantごとのON/OFF mapを持つ。
- Preview active selectionもVariantごとのON/OFF mapを持つ。

Manager内のUX:

- Group選択中に、Default active selectionを設定できる。
- 同じ画面で、Preview active selectionを切り替えてCanvas / preview表示へ反映できる。
- Preview active selectionは、Matrix編集の確認用であり、通常のAuthoring Workspaceに常設する操作ではない。

Viewer / Runtime View:

- 完成品確認としてGroupごとのVariant切り替えUIを持つ。
- ここでの切り替えは確認用であり、Variant定義やmembership編集は行わない。
- Viewer側の切り替えはRuntime Controls内の折りたたみ可能なVariants sectionで扱い、render source modeの下、parameter searchの上に置く。
- Viewer側のactive selectionはsession-onlyであり、Projectのdefault active selectionを書き換えない。

Runtime Player:

- Runtime Exportに含まれるDefault active selectionを初期状態として使う。
- 配信中の差分切り替え、hotkey、preset操作はRuntime Player側の責務として扱う。

## 10. Target Drawable追加Picker

`+ Add Drawables` は、Parts Tree風のpickerを開く。

方針:

- Parts Containerの階層を表示する。
- Parts Containerは選択対象ではなく、折りたたみ/展開の単位にする。
- Containerはデフォルト折りたたみ。
- Container行には `eligible 3 / total 8` のような件数サマリを出す。
- Drawable行だけを選択できる。
- Runtime graphに入っていないDrawableは選択不可にする。
- 既に別Variant Groupに所属しているDrawableは選択不可にする。
- 既に同じGroupに追加済みのDrawableはchecked disabledにするか、表示から除外する。

Picker例:

```text
Add Drawables to: Outfit

[Search drawables...]

> hair_front                         eligible 2 / total 6
> face                               eligible 0 / total 12
v clothes                            eligible 5 / total 9
  [ ] hoodie_body                    bound
  [ ] hoodie_sleeve_l                bound
  [ ] jacket_body                    bound
  [-] draft_button                   not bound to deformer
  [-] smile_mouth                    already in Expression group

[Add selected] [Cancel]
```

デフォーマツリー構造は、対象判定の補助情報として扱う。pickerの主構造はParts Treeでよい。

補助表示として、必要ならDrawable行に以下を出す。

```text
Bound to: Body Warp > clothes
```

ただし、デフォーマツリーそのものを主UIにしない。ユーザーが差分を選ぶ時の認識単位は、PSD / Parts Container由来の「髪」「服」「顔」だからである。

## 11. Matrix編集

Membership Matrixはこの画面の中心UIである。

行:

- Target Drawable。

列:

- Group内のVariant。

セル:

- checked: そのVariantがactiveなとき、このDrawableはVariant条件を通過する。
- unchecked: そのVariantがactiveなとき、このDrawableはVariant条件で落ちる。

同じGroup内で共有されるDrawable:

```text
Drawable        Default   Outfit A   Outfit B   Outfit C
shared_ribbon   [ ]       [x]        [x]        [ ]
```

これは許可する。たとえばOutfit AとOutfit Bで共有し、Outfit Cでは表示しないパーツを表現できる。

別Groupへの重複所属:

- 禁止する。
- UI上で追加できないようにする。
- 既存データ読み込みで見つかった場合はValidation warningにし、どちらかのGroupから除外する修正導線を出す。

## 12. Capture From Current State

`Capture From Current State` はv0では採用しない。

理由:

- 現在表示されているDrawableのうち、どれが表情用で、どれが衣装用で、どれが通常表示なのかを決定論的に判断できない。
- 「このGroup内だけcapture」としても、ユーザーがGroup対象Drawableを正しく整理済みであることに依存し、事故が見えにくい。
- v0では明示的なGroup作成、Target Drawable追加、Matrix編集の方が理解しやすく、後続Runtime Exportとの意味論も安定する。

将来、captureを検討する場合でも、対象は「既にGroupに追加済みのTarget Drawableだけ」に限定する。

## 13. Clipping / Maskとの関係

Clipping関係にあるDrawableを別Groupに分けると、見た目が破綻しやすい。

v0の方針:

- Clipping / mask sourceを自動的に同Groupへ移動する挙動は作らない。
- ただし、運用としては、強い描画関係にあるDrawableは同じVariant Groupに入れるべきである。
- 決定論的に検知できる範囲では、後続Validationで「clipping関係の片側だけがVariant Groupに属している」警告を出す余地を残す。

## 14. Backward Compatibility / Existing Model Upgrade UX

Variantは、新規モデル専用機能ではなく、既に作成済みのWorkspace / Runtime Exportに後付けできる拡張として扱う。

ユーザー体験として守ること:

- 既存Workspaceを開いた時点でVariant Groupが存在しなくても、これまで通り表示、編集、Texture Atlas生成、Runtime Exportができる。
- Variant Groupを作成しない限り、既存モデルのCanvas / Viewer / Runtime Export結果は変わらない。
- Variant Groupを追加しても、Groupに追加していないDrawableはvariant-neutralとして扱われ、従来通りの表示条件に従う。
- Variant対象Drawableだけが、Groupごとのactive selectionによって追加制御される。
- 既存Runtime ExportをRuntime Playerで読み込んだ場合、Variant情報がなくても従来通り再生できる。
- VariantありRuntime Exportは、Player側の追加UIを使わなくてもdefault active selectionで自然に再生できる。
- Runtime PlayerにVariant切り替えUIやhotkeyが追加された場合だけ、差分を追加操作として使える。

互換性の意味論:

```text
if runtime export has no variants:
  variantVisibilityPredicate = true for every drawable

if runtime export has variants:
  variantVisibilityPredicate is evaluated only for drawables assigned to a Variant Group
```

Editor側のロード方針:

- Workspace load時にVariant情報がなければ、空のVariant collectionとして扱う。
- 既存プロジェクトにVariantを追加しても、既存のmesh / deformer / keyform / dynamics / atlas / workspace save構造を破壊しない。
- Variant追加後、Runtimeで使われうるDrawable集合が変わる場合は、Texture Atlasをstaleにし、Export前に再生成を促す。

次の開発スコープ:

- 次の実装対象はEditor側のVariant Manager / project state / Workspace Save / Canvas previewまでを主範囲とする。
- Runtime Player側の配信中Variant操作、hotkey、Control Window UIは後続scopeに分離する。
- ただしEditor側の保存形式とRuntime Export設計は、後続Player追加が破綻しないようにVariant情報を落とさない。

## 15. Runtime / Exportとの関係

VariantはRuntimeで評価される表示条件であるため、Runtime Exportに含まれるGraphと整合している必要がある。

方針:

- Drawable Pool上の未所属DrawableはRuntime Export対象ではなく、Variant対象にもできない。
- hidden状態のDrawableでも、Runtime graphに属していればVariant対象になりうる。
- Texture Atlasは、現在activeなVariantだけでなく、Runtimeで使われうるVariant対象Drawableを含める必要がある。
- Runtime Exportは、Variant Group、Variant、membership、default active selectionを含める。
- Runtime Playerでは、Groupごとのactive selectionを受け取り、Variant predicateをRuntime評価に合成する。

## 16. 他UIとの関係

| UI | 関係 |
|---|---|
| Authoring Workspace | 通常編集画面。Variant切り替えUIは常設せず、必要なら現在preview状態の小表示とManagerへの導線だけを置く。 |
| Parts Tree | Drawableの意味的な位置を確認する主参照。Add Drawables pickerもParts Tree風にする。 |
| Deformer Tree | Runtime graph所属判定と補助情報に使う。Variantの主UIにはしない。 |
| Drawable Inspector | 単一Drawableのvisibility / opacity / clippingを扱う。Variant所属はManagerで扱う。 |
| Parameter / Keyform | Parameter-driven表示変化とはAND合成される。Variantはkeyformを置き換えない。 |
| Texture Atlas Task | Runtimeで使われうるVariant対象Drawableをatlas対象に含める必要がある。 |
| Runtime Export Task | Variant Group / Variant / membership / default active selectionをRuntime artifactへ出す。 |
| Viewer / Runtime View | Runtime Controls内の折りたたみ可能なVariants sectionで完成品確認としてVariantを切り替える。Variant定義やmembership編集は行わない。 |
| Runtime Player | 配信中の差分切り替え、hotkey、preset操作の受け皿になる。 |

## 17. 通常表示しないもの

- source refs全文。
- generated refs全文。
- operation ID。
- evidence path。
- raw runtime evidence。
- validator payload全文。
- state application trace全文。

これらは通常UIの視認性を悪化させるため、Diagnostics / Evidence ViewまたはCodex-facing structured surfaceへ分離する。

## 18. 未決事項

- Runtime Player側で、Variant Groupをどのような配信中操作UIとして見せるか。
- Variant Group / Variant / membershipの保存形式。
- Texture AtlasがVariant対象Drawableをどの粒度でstale判定するか。
- Clipping関係の片側だけがVariant Groupに属する場合のValidation警告をv0に含めるか。
