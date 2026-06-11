# Drawable Inspector コンポーネント仕様

> 状態: Draft component spec。選択中drawableの基本属性、描画順、visibility、opacity、clipping / maskの画面上の役割を定義する。

## 1. 役割

Drawable Inspectorは、Authoring Workspaceでdrawableを選択したときにInspectorへ表示される基本編集領域である。

Mesh、Rig、DynamicsのようなActive Toolではなく、選択中drawableに対する常用の属性編集UIとして扱う。

対象:

- drawable identity / source summary
- editor visibility
- runtime visibility
- opacity
- clipping / mask
- texture / mesh / atlas summaryへの入口

## 2. 基本方針

- Drawable Inspectorは専用画面やmodalではなく、Authoring Workspace右側のInspectorに表示する。
- Draw OrderはParts Tree / Structure Treeの順序を基準にする。
- Parts Tree上で上にあるdrawableほど前面に表示される。実際の描画は、下から上へ描画するものとして扱う。
- Visibilityは `Editor visibility` と `Runtime visibility` を別概念として扱う。
- Drawable Inspectorでは、最低限の常用編集としてname、visibility、opacity、clipping / maskを扱う。
- OpacityとClipping / Maskは、drawableに対するInspector sectionとして扱う。
- 描画順の変更はParts Treeへ委譲し、Drawable Inspectorでは大きなreorder UIを持たない。
- PSD source summaryは折り畳みまたは短いsummaryに留め、通常は前面に出しすぎない。
- 表情差分、パーツ差分、衣装差分のように複数targetをstateとしてまとめる場合は、Variant / Expression Managerの責務とする。
- デフォーマ / rig control配下の要素をまとめてフェードさせるparameter-driven subtree opacityは、Drawable InspectorではなくRig Toolの責務とする。
- `UX-FEAT-020` のmask relation authoringと `UX-FEAT-021` のsingle drawable opacity keyformは、当面Drawable Inspector内sectionとParameter / Keyform UIの協調で扱う。専用Composition / Opacity Toolは初期画面設計では作らない。
- raw evidence、operation ID、generated refs全文は通常表示しない。

## 2.1 実装状況

Wave53 final integration report/review `pass` により、Authoring Workspace 右側に Inspector v0 surface が実装・統合済みである。現時点の Inspector は project / selection / active tool の human-facing summary と callbacks を扱う v0 であり、この文書にある full Drawable Inspector section 群を完成したものではない。

Legacy support panels には既存の Drawable Authoring、composition、rig、dynamics、evidence/debug/Codex-heavy UI が残る。Operation log、evidence path、generated refs、package file set、raw diagnostics、Codex automation details を最終的に通常 UI から分離する作業は Diagnostics / Evidence View Separation と Codex / Automation View Separation の後続waveに残る。

## 3. 配置

Drawable選択時の基本配置:

```text
+----------+---------------------+-----------------------+----------------------+
| Toolbox  | Structure / Parts   | Canvas / Preview      | Drawable Inspector   |
|          |                     |                       |                      |
| Select   | parts / drawables   | selected drawable     | Identity / Source    |
| Mesh     | draw order rows     | visual preview        | Visibility           |
| Rig      | visibility icons    | selection outline     | Draw Order           |
| Dynamics | lock state          | mask highlight        | Opacity              |
| Atlas    | hidden rows         |                       | Clipping / Mask      |
+----------+---------------------+-----------------------+----------------------+
| Parameter Bar: active parameter / current value / key markers                   |
+--------------------------------------------------------------------------------+
| Diagnostics Strip: blocking/warning summary only                               |
+--------------------------------------------------------------------------------+
```

## 4. Draw Order

Draw Orderは、Parts Tree / Structure Tree上のdrawable順序で扱う。

採用する向き:

- Tree上で上にあるdrawableほど前面に表示される。
- Tree上で下にあるdrawableほど背面に表示される。
- 描画処理としては、背面から前面へ、つまりTree下側から上側へ描画される。

Drawable Inspectorに置くもの:

- Parts Treeで順序変更できることの導線

Drawable Inspectorに置かないもの:

- draw order editor
- 大規模なreorder専用UI
- 全drawableの完全な順序表
- low-level render order trace

順序変更の主操作はParts Treeで行う。Drawable Inspectorは、現在位置の確認とParts Treeへの導線を持つ。

## 5. Visibility

Visibilityは2層に分ける。

| 種類 | 役割 |
|---|---|
| Editor visibility | 編集中にCanvas / Parts Treeで見えるか。作業上の一時非表示を扱う。 |
| Runtime visibility | runtime / export時の初期表示状態。表情差分やパーツ差分の初期表示に関係する。 |

Editor visibility:

- 編集中の視認性を制御する。
- runtime packageやViewerの初期状態を直接意味しない。
- 作業しやすさのために一時的に非表示にできる。

Runtime visibility:

- runtime / Viewer / exportの初期表示状態を制御する。
- PSD由来のhidden drawableや表情差分、パーツ差分に関係する。
- hidden drawableでもruntime切り替え対象として保持される可能性がある。
- 複数drawable / part subtreeをstateとしてまとめる操作は、Variant / Expression Managerで扱う。

Drawable Inspectorに置くもの:

- name input
- editor visibility toggle
- runtime visibility toggle
- visibility inheritance / part hidden summary
- hidden reason summary
- Viewer / Runtime初期表示への影響説明

表示しないもの:

- visibility operation evidence
- runtime diff全文
- generated refs全文

## 6. Opacity

Opacityはdrawableの基本属性としてDrawable Inspectorで扱う。

ここで扱うopacityは、選択中drawable単体のopacityである。rig control / deformer配下の複数drawableをまとめてfadeさせる場合は、Rig Toolのsubtree opacity effectを使う。

表示するもの:

- current opacity
- default opacity
- opacity slider / numeric input
- reset action
- keyform対象になり得ることの導線

Parameter / Keyformとの関係:

- 静的opacityはDrawable Inspectorで編集する。
- parameter-driven opacity keyformを扱う場合、Parameter Barでactive parameter / current valueを決め、Drawable Inspectorまたは将来のOpacity sectionでtarget propertyを指定する。
- opacity keyform authoringは、Parameter / Keyform UIと協調する。
- deformer配下の一括fadeは、Rig Toolのsubtree opacity effectとして扱う。

表示しないもの:

- 全keyform table
- operation ID
- raw evidence

## 7. Clipping / Mask

Clipping / Maskはdrawableに対するInspector sectionとして扱う。

`UX-FEAT-020` の正式ホームはこのsectionである。semantic mask relationという棚卸上の名前に引きずられず、ユーザーまたはCodexが明示したmask source drawableとtarget drawableの関係を編集する。

表示するもの:

- mask enabled state
- mask source drawable selector / list
- selected mask sources
- mask mode summary
- selected mask sourceをParts Treeで表示するaction
- Canvas上でmask sourceをhighlightするaction
- invalid / missing mask warning

初期UIの考え方:

- 専用画面や専用Toolにはしない。
- checkboxだけではなく、mask source drawableを選ぶ小さなselector / listを持つ。
- Canvasでは、選択中drawableとmask sourceの関係を軽くhighlightしてよい。

表示しないもの:

- mask render evidence全文
- generated refs全文
- low-level compositing trace
- validator payload全文

## 8. Texture / Mesh / Atlas Summary

Drawable Inspectorは、選択中drawableのtexture / mesh / atlas状態をsummaryとして表示してよい。

表示するもの:

- source texture summary
- mesh status
- atlas placement status
- stale / missing / unplaced warning
- Mesh Toolを開く導線
- Texture Atlas Taskを開く導線

Drawable Inspector自体でmesh編集やatlas配置を行わない。

## 8.1 Single Drawable Opacity Keyform

`UX-FEAT-021` のsingle drawable opacity keyformは、Drawable InspectorとParameter / Keyform UIが協調して扱う。

役割分担:

- Drawable Inspector: target drawableとopacity propertyを扱う。
- Parameter Bar: active parameterとcurrent valueを扱う。
- Canvas / Preview: current valueでのopacity previewを表示する。
- Diagnostics / Evidence View: raw evidenceやoperation payloadを扱う。

このUXは、rig control / deformer配下のsubtree opacity effectとは別である。subtree opacity effectはRig Toolで扱う。

## 9. 他UIとの関係

| UI | Drawable Inspectorとの関係 |
|---|---|
| Parts Tree | draw order、part membership、selection、editor/runtime visibility状態の主な一覧表示。 |
| Part Container Inspector | 親part containerのvisibility gateを扱う。親がhiddenの場合、子drawableのeffective visibilityにも影響する。 |
| Canvas / Preview | selected drawable、mask relation、opacity、visibility状態を視覚確認する。 |
| Mesh Tool | 選択中drawableのmesh作成・編集を行うActive Tool。 |
| Rig Tool | 選択part / drawable / meshに対するrig authoringと、parameter-driven subtree opacity effectを行うActive Tool。 |
| Dynamics Tool | drawable propertyやrig controlがdynamics output候補になる可能性がある。 |
| Parameter / Keyform | opacity keyformなど、drawable propertyのparameter-driven編集で協調する。 |
| Variant / Expression Manager | 表情差分、パーツ差分、衣装差分のstate setとState Matrixを扱う。 |
| Texture Atlas Task | atlas placementは専用Taskで扱い、Drawable Inspectorはsummaryと導線を持つ。 |
| Viewer / Runtime View | runtime visibility、opacity、maskの結果をruntime相当で確認する。 |

## 10. 通常表示しないもの

- source refs全文
- generated refs全文
- operation ID
- evidence path
- raw runtime evidence
- validator payload全文
- low-level render trace

これらは通常UIの視認性を悪化させるため、Diagnostics / Evidence ViewまたはCodex-facing structured surfaceへ分離する。

## 11. 関連機能ID

- `UX-FEAT-002`: selected item / source details
- `UX-FEAT-003`: drawable authoring
- `UX-FEAT-008`: Part / layer tree overview and part management
- `UX-FEAT-009`: Layer tree direct manipulation
- `UX-FEAT-010`: Drawable creation / drawable list / layer orderの選択詳細とsummary。list / orderの主ホームはParts Tree。
- `UX-FEAT-020`: Composition mask relation authoring
- `UX-FEAT-021`: Drawable opacity keyforms
- 一部 `UX-FEAT-011` / `UX-FEAT-012`: mesh / texture関連summary
- 一部 `UX-FEAT-028` / `UX-FEAT-029`: validation

## 12. 未決事項

- Runtime visibilityがpart visibility継承を持つ場合の表示方法。
- Opacity keyform authoringをDrawable Inspector内sectionで扱うか、将来Composition / Opacity Toolとして分けるか。
- デフォーマ配下のsubtree opacity effectと、将来のVariant / Expression fadeをどこまで共通化するか。
- mask modeの最小セット。
- mask sourceの複数選択UIの具体形。
- Parts Tree reorder操作の具体UI。
