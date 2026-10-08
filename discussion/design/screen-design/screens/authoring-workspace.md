# Authoring Workspace 画面仕様

> 状態: Draft screen spec。

## 1. 役割

Authoring WorkspaceはEditorの中心shellである。workspace未open時のWorkspace Gate、PSD import後の通常編集状態、既存workspace open後の編集状態を扱う。

Workspace-first UXでは、起動直後に編集可能なtemporary draftを出さない。workspaceが作成またはopenされるまでは、既存Header領域にCreate / Open / Import Portable JSONのworkspace-level actionだけを横並びで表示し、Toolbox、Parts Tree、Canvas、Inspector、Parameter Barなどの編集領域は表示しない。Workspace Gateの詳細は [workspace-save-and-navigation.md](workspace-save-and-navigation.md) を参照する。

## 2. レイアウト

```text
+--------------------------------------------------------------------------------+
| App Bar: workspace identity / save state / workspace menu / undo / redo          |
+----------+---------------------+-----------------------+----------------------+
| Toolbox  | Structure / Parts   | Canvas / Preview      | Inspector            |
|          |                     |                       |                      |
| Import   | Parts tree          | Empty state or model  | Project / selection  |
| Mesh     | PSD group-derived   | preview               | details              |
| Rig      | part containers     |                       | Part / Drawable /    |
| Dynamics | drawables / hidden  |                       | Source details       |
| Params   | rows                |                       | Contextual controls  |
| Variant  | drawables / hidden  |                       | Source details       |
| Atlas    | drawables / hidden  |                       | Source details       |
| Validate | rows                |                       | Contextual controls  |
| Automate |                     |                       |                      |
+----------+---------------------+-----------------------+----------------------+
| Parameter Bar: active parameter / value slider / key markers / key actions      |
+--------------------------------------------------------------------------------+
| Diagnostics Strip: blocking/warning summary only                               |
+--------------------------------------------------------------------------------+
```

workspace未open時は、同じApp Bar / Header領域だけを使う。Create / Open / Import Portable JSONはHeader内で横並びに表示し、下部の編集paneは出さない。

```text
+--------------------------------------------------------------------------------+
| Private 2D Rigging Lab   [Create Workspace] [Open Workspace] [Import Portable]  |
+--------------------------------------------------------------------------------+
|                                                                                |
|                         No workspace is open                                   |
|                                                                                |
+--------------------------------------------------------------------------------+
```

Toolboxは機能を呼び出す場所であり、model構造を表示・選択する場所ではない。Parts Treeは常設または即時展開できるStructure / Partsペインとして扱う。Import後の構造整理、mesh対象選択、rig対象選択はこのParts Treeを起点にする。Parts Treeの詳細は [../components/parts-tree.md](../components/parts-tree.md) を参照する。Toolboxの詳細は [../components/toolbox.md](../components/toolbox.md) を参照する。Canvas / PreviewはPSD由来drawableをEditor rendererで表示し、zoom / pan / fit、selection、overlay toolbarを扱う中心領域である。Canvas / Previewの詳細は [../components/canvas-preview.md](../components/canvas-preview.md) を参照する。

Part Container選択時、InspectorはPart Container Inspectorとして、name、visibility gate、親子関係の確認を扱う。Part Containerを非表示にすると配下drawableのeffective visibilityはhiddenになるが、子Drawable個別のvisibility設定は変更しない。Part Container Inspectorの詳細は [../components/part-container-inspector.md](../components/part-container-inspector.md) を参照する。

Drawable選択時、InspectorはDrawable Inspectorとして、name、editor/runtime visibility、opacity、clipping / mask、texture / mesh / atlas summaryを扱う。Draw OrderはParts Tree上で上にあるdrawableほど前面とし、順序変更はParts Treeへ委譲する。Drawable Inspectorの詳細は [../components/drawable-inspector.md](../components/drawable-inspector.md) を参照する。

Parameter BarはToolboxやInspectorとは別の横断領域として、Canvas / Previewの下、Diagnostics Stripの上に置く。常時表示する対象は1つのactive parameterに限定し、全parameter確認は非モーダルのParameter Control Paletteで扱う。詳細は [../components/parameter-keyform.md](../components/parameter-keyform.md) を参照する。

## 2.1 実装状況

Wave53 final integration report/review `pass` により、このレイアウトの v0 skeleton は live App Shell に実装済みである。実装済み範囲は App Bar、左 Toolbox、左 Structure / Parts Tree、中央 Canvas / Preview、右 Inspector、下部 Parameter Bar、下部 Diagnostics Strip の基本配置に限る。PSD Import は Toolbox から既存 Task Shell task として開け、default always-visible workspace panel には戻っていない。

これは final visual redesign ではない。legacy support panels には既存の Project Storage、Product Preflight、Viewer / Runtime、Codex/AI support、operation/evidence/debug 系UIが残る。duplicate drawable-list hooks は現時点で非blockingだが、将来 legacy Drawable Authoring list を対象にするテストは `drawableAuthoring.panel` などの stable wrapper で scope する必要がある。

## 3. Workspace Gate / Empty State

Workspace Gateはworkspace未open時の状態であり、通常のempty project編集状態ではない。ユーザーはここでCreate Workspace、Open Workspace、Import Portable JSONのいずれかを選び、workspaceを確定してから編集へ進む。

Gateで表示するもの:

- App Bar / Headerのアプリ名
- Create Workspace
- Open Workspace
- Import Portable JSON
- workspace未openであることを示す簡潔な空表示

Gateで表示しないもの:

- Toolbox
- Parts Tree
- Canvas / Preview
- Inspector
- Parameter Bar
- PSD Import
- Mesh / Rig / Dynamics
- Texture Atlas
- Validate
- Viewer
- Save

workspace作成後またはopen後に、初めてAuthoring Workspaceの通常編集レイアウトへ入る。

## 3.1 Workspace Open後の空Project State

表示するもの:

- 空projectであること
- PSDを読み込む入口
- tutorialを開始する入口
- Stage empty stateではPSD importを主導線として扱う

表示しないもの:

- operation log
- evidence path
- package file set
- reload summary
- raw diagnostics

## 4. Import後の通常状態

表示するもの:

- parts treeにPSD group由来のpart container
- canvasにimportされたdrawable。PSD canvas sizeをStage基準にし、visible drawableをbounds / source order / opacity / normal alpha blend / clippingに従って表示する
- inspectorに選択中part/drawable/sourceの編集情報
- diagnostics stripに重要warningのみ
- import完了feedback: modal close / Parts Tree update / generated root selection / optional toast

表示しないもの:

- source refs全文
- generated refs全文
- materialized bytes詳細
- operation/evidence path
- package file set
- reload summary

Import直後は、通常編集状態の中でもPost-Import Review状態として扱う。最初の導線はParts Treeでimport結果を確認し、次に編集対象を選ぶことである。

Canvas / Previewは、import直後にFit Artwork相当の表示へ寄せる。透明余白を含むPSD座標系を確認したい場合はFit Canvasを使う。Canvas上部には小さいtoolbarを置き、zoom系、fit系、overlay toggle、Isolate Selectedをまとめる。Canvas上での移動・変形・複数選択・marquee selectionはこの段階の通常操作に含めない。

Import先は、初回importまたは選択なしならproject root直下、part選択中なら選択中part配下、drawable選択中ならその親part配下にする。初期UXではimport先選択をユーザーに求めず、PSD Import Review上で決定済みdestinationを短く表示する。

Import完了後は、生成されたimport root / part groupを選択状態にする。Inspectorは専用のImport Summaryではなく、選択されたpart / groupの通常情報を表示する。Import完了feedbackは、modalが閉じること、Parts Treeに実構造が表示されること、生成rootが選択されることを主にし、必要なら短いtoastに留める。raw refs、operation ID、warning count、diagnostics詳細は通常表示しない。

主要操作:

1. 構造整理
   - Parts TreeでPSD group由来のpart container、drawable、hidden rowを確認する。
   - drawable list、draw order、editor/runtime visibility row操作、part container visibility、折り畳み / 展開はParts Treeを主ホームにする。
   - selectionに応じてInspectorへrename、visibility、opacity、clipping / mask、source summaryなどの基本編集情報を出す。
   - Canvasは選択中drawableの位置と可視状態を確認する場所として使う。
2. Mesh作成・調整
   - Parts TreeまたはCanvasでdrawableを選択し、ToolboxのMeshを開く。
   - Inspectorは選択drawableのmesh状態、bounds、texture/source summary、mesh作成・編集に必要な controls を出す。
   - empty mesh scaffold や未生成meshの場合、preset-based initial mesh generationへ進む導線を出す。
   - empty mesh scaffold や未生成meshは人間向けstatusとして表示するが、raw evidenceは表示しない。
   - Mesh Toolの詳細は [../components/mesh-tool.md](../components/mesh-tool.md) を参照する。
3. Rig準備
   - Parts Treeでpart/drawableを選択し、ToolboxのRigを開く。
   - Inspectorはrig primitive、draft settings、binding、parameter/keyform接続、subtree opacity effectに必要な controls を出す。
   - Parameter Barでactive parameterとcurrent valueを操作し、Canvasでその値のpreviewを確認する。
   - RotationやWarp / Latticeのdraft overlayはCanvasに表示し、Applyするまでproject rig controlは変更しない。
   - rig control / deformer配下の要素をまとめてfadeさせる場合は、Rig ToolのSubtree Visibility / Opacity sectionで扱う。
   - 自動semantic推定やauto-rig提案はEditor通常UIの責務ではない。
   - Rig Toolの詳細は [../components/rig-tool.md](../components/rig-tool.md) を参照する。
4. Dynamics作成・確認
   - Parts TreeまたはCanvasでpart / drawable / rig control / parameterを選択し、ToolboxのDynamicsを開く。
   - Inspectorはdynamics group、input parameter、output binding、coefficient、軽いpreview sampleを出す。
   - 常設の大きなSimulation Controlsは置かず、本格的な時間再生や複数parameter確認はViewer / Runtime Viewへ委譲する。
   - Canvasには選択中dynamics groupの影響範囲、出力方向、sample valueに対する簡易preview overlayを表示してよい。
   - Dynamics Toolの詳細は [../components/dynamics-tool.md](../components/dynamics-tool.md) を参照する。
5. Parameter定義・整理
   - ToolboxのParameter Managerを開き、parameter定義、stable id、display name、min/default/max、grouping、usage referenceを管理する専用画面へ進む。
   - Rig Tool、Dynamics Tool、Parameter BarなどからはQuick Create / Selectを提供し、詳細整理はParameter Managerへ送る。
   - Parameter Barはcurrent value操作のUIであり、parameter定義そのものの管理画面ではない。
   - Parameter Managerの詳細は [parameter-manager.md](parameter-manager.md) を参照する。
6. Variant / Expression管理
   - ToolboxのVariant / Expressionを開き、表情差分、パーツ差分、衣装差分のstate setを管理する専用画面へ進む。
   - 初期はexclusive setを基本にし、同時適用 / additive setは将来候補として扱う。
   - hidden drawableやpart subtreeをState Matrixで管理し、Preview Canvasでstate切り替え結果を確認する。
   - Variant / Expression Managerの詳細は [variant-expression-manager.md](variant-expression-manager.md) を参照する。
7. Texture Atlas作成・確認
   - ToolboxのTexture Atlasを開き、visible drawableをtexture pageへ配置する専用Taskへ進む。
   - Texture Atlas Taskでは、drawable対象一覧、page settings、padding、layout preview、unplaced / overflow warningを確認する。
   - Generate Layout Previewはuncommittedであり、Apply Atlasでproject stateへcommitする。
   - Texture Atlas Taskの詳細は [texture-atlas-task.md](texture-atlas-task.md) を参照する。

## 5. 関連機能ID

- App Bar: `UX-FEAT-001`, `UX-FEAT-026`, `UX-FEAT-027`
- Parts Tree: `UX-FEAT-008`, `UX-FEAT-009`, `UX-FEAT-010`
- Canvas / Preview: `UX-FEAT-004`, `UX-FEAT-005`, `UX-FEAT-011`, `UX-FEAT-012`
- Inspector: `UX-FEAT-002`, `UX-FEAT-003`, `UX-FEAT-010`〜`UX-FEAT-012`, `UX-FEAT-020`〜`UX-FEAT-025`
- Part Container Inspector: `UX-FEAT-002`, `UX-FEAT-008`, `UX-FEAT-009`
- Drawable Inspector: `UX-FEAT-002`, `UX-FEAT-003`, `UX-FEAT-010`〜`UX-FEAT-012`, `UX-FEAT-020`, `UX-FEAT-021`
- Dynamics Tool: `UX-FEAT-024`, `UX-FEAT-025`
- Parameter Manager: `UX-FEAT-002`, `UX-FEAT-003`, 関連: `UX-FEAT-007`, `UX-FEAT-020`〜`UX-FEAT-025`
- Variant / Expression Manager: 専用IDは未採番。関連: `UX-FEAT-004`, `UX-FEAT-007`, `UX-FEAT-008`, `UX-FEAT-009`
- Texture Atlas Task: 専用IDは未採番。関連: `UX-FEAT-004`, `UX-FEAT-008`, `UX-FEAT-009`, `UX-FEAT-019`

## 6. 未決事項

- ToolboxとParts Treeは Wave53 v0 では左側配置済みだが、final visual / accessibility policy は未確定。
- Empty stateでcanvas側の導線をどこまで優先するか。
- Inspectorは右固定か、選択中対象に応じてdrawer/side panelとして切り替えるか。
