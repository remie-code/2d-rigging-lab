# Parts Tree コンポーネント仕様

> 状態: Draft component spec。part / drawable hierarchy、drawable list、draw order、基本row操作の画面上の役割を定義する。

## 1. 役割

Parts Treeは、Authoring Workspace左側のStructure / Partsペインに置く常設または即時展開可能な構造一覧である。

対象:

- part hierarchy
- PSD group由来のpart container
- drawable list
- hidden drawable row
- selected / locked / editor visibility / runtime visibility state
- draw order
- manual drawable create入口
- part / drawable direct manipulation

Parts TreeはToolboxではない。Toolboxは作業モードやtaskを呼び出すlauncherであり、Parts Treeはmodel構造を表示・選択・整理する場所である。

## 1.1 実装状況

Wave53 final integration report/review `pass` により、Parts Tree v0 は Authoring Workspace 左側の Structure / Parts surface として実装・統合済みである。既存 Layer Tree と Drawable List の selection、visibility、draw order callback contract を再利用している。

現時点では legacy Drawable Authoring support panel も残っているため、`drawable.list` / `drawable.row.*` / visibility / move hooks は Parts Tree と legacy panel の両方に出る。Wave54 Domain F/H により、e2e helper は Parts Tree と legacy Drawable Authoring を明示的に scope する形へ hardening 済みだが、将来 legacy list を狙うテストや helper も stable wrapper / selector scope helper を使う必要がある。manual drawable create 入口は legacy support で維持されており、Parts Tree 内の final create UI は未完了である。

## 2. 基本方針

- Parts TreeはAuthoring WorkspaceのStructure / Partsペインに置く。
- Draw OrderはParts Tree上の順序で表す。
- Tree上で上にあるdrawableほど前面に表示される。
- Tree上で下にあるdrawableほど背面に表示される。
- 描画処理としては、背面から前面へ、つまりTree下側から上側へ描画される。
- drawable作成、part membership、draw order変更、visibility row操作の主ホームはParts Treeである。
- 選択中drawableの詳細属性はDrawable Inspectorへ委譲する。

## 3. 配置

```text
+----------+---------------------+-----------------------+----------------------+
| Toolbox  | Structure / Parts   | Canvas / Preview      | Inspector            |
|          |                     |                       |                      |
| Select   | search / filter     | selected drawable     | selected details     |
| Mesh     | part rows           | visual preview        | Drawable Inspector   |
| Rig      | drawable rows       | selection outline     | or Active Tool       |
| Dynamics | hidden rows         |                       |                      |
| Params   | visibility icons    |                       |                      |
| Variant  | lock state          |                       |                      |
| Atlas    | draw order handles  |                       |                      |
+----------+---------------------+-----------------------+----------------------+
```

## 4. 表示するもの

- part rows
- drawable rows
- hidden drawable rows
- selected state
- locked state
- editor visibility
- runtime visibility
- part membership
- draw order
- row warning badge
- manual drawable create入口
- show in canvas action
- open Drawable Inspector action

## 5. 主操作

Parts Treeで扱う操作:

- part create / rename / reparent
- drawable create
- drawable select
- drawable reorder
- drawable part assignment
- editor visibility toggle
- runtime visibility toggle
- lock / unlock
- selected rowをCanvasへ表示
- selected rowをDrawable Inspectorへ送る

Parts Treeで扱わない操作:

- mesh頂点編集
- rig draft / keyform authoring
- dynamics coefficient編集
- texture atlas packing
- expression state matrix編集
- parameter定義管理

これらは各Active Tool、Task、Managerへ委譲する。

## 6. Drawable Creation / List / Layer Order

`UX-FEAT-010` のうち、drawable listとlayer orderはParts Treeを正式ホームとする。

manual drawable createは、Parts Tree内の軽量作成入口として扱う。PSD import由来のdrawable作成はPSD Import Taskが主導し、Parts Treeは生成後の構造確認と整理を担当する。

Drawable Inspectorとの分担:

- Parts Tree: list、selection、draw order、row state、create入口。
- Drawable Inspector: selected drawableのsource summary、opacity、mask、texture / mesh / atlas summary。

## 7. 他UIとの関係

| UI | Parts Treeとの関係 |
|---|---|
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

- manual drawable createの final UI をParts Tree内に置くか、Drawable Inspectorからも呼べるようにするか。Wave53 v0 では legacy support panel に入口を維持している。
- row reorder操作の具体UI。
- editor visibility / runtime visibilityのiconsとtooltip。
- large hierarchy時のsearch / filter / collapsed state保存。
