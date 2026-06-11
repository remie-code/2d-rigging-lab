# Parts Tree コンポーネント仕様

> 状態: Draft component spec。part / drawable hierarchy、drawable list、draw order、基本row操作の画面上の役割を定義する。

## 1. 役割

Parts Treeは、Authoring Workspace左側のStructure / Partsペインに置く常設または即時展開可能な構造一覧である。

対象:

- part hierarchy
- PSD group由来のpart container
- drawable list
- hidden drawable row
- selected / editor visibility / runtime visibility state
- draw order
- part / drawable direct manipulation

Parts TreeはToolboxではない。Toolboxは作業モードやtaskを呼び出すlauncherであり、Parts Treeはmodel構造を表示・選択・整理する場所である。

## 1.1 実装状況

Wave53 final integration report/review `pass` により、Parts Tree v0 は Authoring Workspace 左側の Structure / Parts surface として実装・統合済みである。既存 Layer Tree と Drawable List の selection、visibility、draw order callback contract を再利用している。

現時点では legacy Drawable Authoring support panel も残っているため、`drawable.list` / `drawable.row.*` / visibility / move hooks は Parts Tree と legacy panel の両方に出る。Wave54 Domain F/H により、e2e helper は Parts Tree と legacy Drawable Authoring を明示的に scope する形へ hardening 済みだが、将来 legacy list を狙うテストや helper も stable wrapper / selector scope helper を使う必要がある。manual drawable create 入口は legacy support で維持されており、Parts Tree 内の final create UI は未完了である。

## 2. 基本方針

- Parts TreeはAuthoring WorkspaceのStructure / Partsペインに置く。
- Part Containerの折り畳み / 展開を扱う。
- Part Containerの表示トグルを扱う。
- Drawableの表示トグルを扱う。
- Draw OrderはParts Tree上の順序で表す。
- Tree上で上にあるdrawableほど前面に表示される。
- Tree上で下にあるdrawableほど背面に表示される。
- 描画処理としては、背面から前面へ、つまりTree下側から上側へ描画される。
- part membership、draw order変更、visibility row操作の主ホームはParts Treeである。
- Tree選択とCanvas選択は同期する。
- 名前変更はParts Tree上のinline editまたはInspectorで扱う。
- 選択中part containerの詳細属性はPart Container Inspectorへ委譲する。
- 選択中drawableの詳細属性はDrawable Inspectorへ委譲する。
- 検索 / filter、右クリックmenu、大きなcontext menuは初期UXに含めない。

## 3. 配置

```text
+----------+---------------------+-----------------------+----------------------+
| Toolbox  | Structure / Parts   | Canvas / Preview      | Inspector            |
|          |                     |                       |                      |
| Select   | part rows           | selected drawable     | selected details     |
| Mesh     | part rows           | visual preview        | Drawable Inspector   |
| Rig      | drawable rows       | selection outline     | or Active Tool       |
| Dynamics | hidden rows         |                       |                      |
| Params   | visibility icons    |                       |                      |
| Variant  | collapse state      |                       |                      |
| Atlas    | draw order handles  |                       |                      |
+----------+---------------------+-----------------------+----------------------+
```

## 4. 表示するもの

- part rows
- drawable rows
- hidden drawable rows
- selected state
- editor visibility
- runtime visibility
- part membership
- draw order
- row warning badge
- collapse / expand state

## 5. 主操作

Parts Treeで扱う操作:

- part rename / reparent
- drawable select
- part container select
- drawable reorder
- drawable part assignment
- editor visibility toggle
- runtime visibility toggle
- part container visibility toggle
- part container collapse / expand
- Canvas selectionとの同期
- drag and dropによる並び替え
- drag and dropによるcontainer間移動

Parts Treeで扱わない操作:

- 子Drawableのvisibilityを一括で書き換えるsubtree操作
- 右クリックmenuや大きなrow action menu
- search / filter
- selected drawableをCanvas上で追加highlightする専用action
- lock / unlock
- part / drawable delete
- duplicate
- isolate
- mesh頂点編集
- rig draft / keyform authoring
- dynamics coefficient編集
- texture atlas packing
- expression state matrix編集
- parameter定義管理

これらは各Active Tool、Task、Managerへ委譲する。

## 6. Drawable Creation / List / Layer Order

`UX-FEAT-010` のうち、drawable listとlayer orderはParts Treeを正式ホームとする。

manual drawable createは将来候補とし、初期UXではPSD Import Taskがdrawable作成を主導する。Parts Treeは生成後の構造確認、選択、表示、並び替え、移動を担当する。

Drawable Inspectorとの分担:

- Parts Tree: list、selection、draw order、row state、part membership。
- Drawable Inspector: selected drawableのsource summary、opacity、mask、texture / mesh / atlas summary。
- Part Container Inspector: selected part containerのname、visibility gate、parent relationship。

## 7. 他UIとの関係

| UI | Parts Treeとの関係 |
|---|---|
| Part Container Inspector | Parts Treeで選択したpart containerの基本属性を表示・編集する。 |
| Drawable Inspector | Parts Treeで選択したdrawableの詳細属性を表示・編集する。 |
| Mesh Tool | Parts Treeで選択したdrawableをmesh編集対象にする。 |
| Rig Tool | Parts Treeで選択したpart / drawable / meshをrig対象にする。 |
| Dynamics Tool | Parts Treeで選択したtargetをdynamics authoring候補にする。 |
| Variant / Expression Manager | Parts Treeのpart / drawable / hidden drawableをstate targetとして使う。 |
| Texture Atlas Task | Parts Treeのvisible / hidden stateがatlas include判断に関係する。 |
| Viewer / Runtime View | runtime visibilityやdraw orderの結果を確認する。 |

## 8. 通常表示しないもの

- source refs全文
- generated refs全文
- operation ID
- evidence path
- raw runtime evidence
- validator payload全文
- low-level render trace

これらは通常UIの視認性を悪化させるため、Diagnostics / Evidence ViewまたはCodex-facing structured surfaceへ分離する。

## 9. 関連機能ID

- `UX-FEAT-008`: Part / layer tree overview and part management
- `UX-FEAT-009`: Layer tree direct manipulation
- `UX-FEAT-010`: Drawable creation / drawable list / layer order
- 一部 `UX-FEAT-019`: PSD structural scaffold後のpart / drawable hierarchy確認

## 10. 未決事項

- row reorder操作の具体UI。
- editor visibility / runtime visibilityのiconsとtooltip。
- collapsed state保存。
- manual drawable createの final UI。
- large hierarchy時にsearch / filterが必要になるタイミング。
