# Part Container Inspector コンポーネント仕様

> 状態: Draft component spec。選択中part containerの基本属性、表示gate、配下drawableとの関係を定義する。

## 1. 役割

Part Container Inspectorは、Authoring Workspaceでpart containerを選択したときにInspectorへ表示される基本編集領域である。

PSD group由来のpart containerや、ユーザーが作成・整理したpart containerを対象にする。

対象:

- part container identity
- name
- editor visibility gate
- parent / child relationship summary
- Parts Tree上の位置確認

Part Container Inspectorは、mesh、rig、dynamics、variant管理の専用UIではない。配下のdrawableをまとめてrig対象にする操作はRig Toolへ委譲し、表情差分や衣装差分のstate set管理はVariant / Expression Managerへ委譲する。

## 2. 基本方針

- Part Container Inspectorは専用画面やmodalではなく、Authoring Workspace右側のInspectorに表示する。
- Part Containerの表示トグルは、配下要素のeffective visibilityを制御するgateとして扱う。
- Part Containerを非表示にしても、子Drawable個別のvisibility設定は変更しない。
- Part Containerを再表示すると、子Drawableごとの表示状態が復元される。
- 配下Drawableを一括で表示 / 非表示に書き換えるsubtree操作は初期UXに含めない。
- container opacityは初期UXに含めない。
- 子要素数やmesh済み数などの状態サマリは通常表示しない。
- raw evidence、operation ID、generated refs全文は通常表示しない。

## 3. 表示するもの

- name input
- editor visibility toggle
- parent part container名
- Parts Tree上での位置確認への導線
- 配下のeffective visibilityが親表示状態に影響されることを示す短い状態表示

表示しないもの:

- 子要素数
- 子Drawableの状態サマリ
- subtree一括表示 / 一括非表示操作
- container opacity
- source refs全文
- operation evidence
- validator payload全文

## 4. Visibility

Part Container visibilityは、配下drawableのeffective visibilityに影響する。

例:

- 親part containerがvisible、子drawableがvisibleならCanvasに表示される。
- 親part containerがhiddenなら、子drawableがvisibleでもCanvasには表示されない。
- 親part containerをvisibleへ戻すと、子drawableの個別visibility設定に従って再表示される。

この挙動は「親の表示gate」と「子Drawable個別のvisibility」を分けるためのものであり、子設定を破壊しない。

## 5. 他UIとの関係

| UI | Part Container Inspectorとの関係 |
|---|---|
| Parts Tree | part containerの選択、折り畳み、表示トグル、reparent、順序整理の主ホーム。 |
| Drawable Inspector | 子drawable単体のname、visibility、opacity、clipping / maskを扱う。 |
| Canvas / Preview | part container visibility gateの結果として配下drawableの表示 / 非表示を確認する。 |
| Mesh Tool | 選択中part配下のdrawableを対象候補にできるが、mesh作成自体はMesh Toolで扱う。 |
| Rig Tool | part containerや配下drawableをrig対象にする。subtree opacity effectもRig Toolで扱う。 |
| Variant / Expression Manager | part subtreeの表示状態をstate setとして管理する場合の正式ホーム。 |

## 6. 関連機能ID

- `UX-FEAT-002`: selected item details
- `UX-FEAT-008`: Part / layer tree overview and part management
- `UX-FEAT-009`: Layer tree direct manipulation
- 一部 `UX-FEAT-019`: PSD structural scaffold後のpart hierarchy確認

## 7. 未決事項

- Part Container visibilityをruntime / export初期状態へどう反映するか。
- Part Container visibilityの永続化形式。
- Parts Tree上のvisibility icon / tooltipの具体形。
