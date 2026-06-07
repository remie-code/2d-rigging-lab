# Authoring Workspace 画面仕様

> 状態: Draft screen spec。

## 1. 役割

Authoring WorkspaceはEditorの中心画面である。起動直後のempty state、PSD import後の通常編集状態、既存project load後の編集状態を扱う。

## 2. レイアウト

```text
+--------------------------------------------------------------------------------+
| App Bar: project / save state / mode / key actions / Viewer / Storage           |
+----------+---------------------+-----------------------+----------------------+
| Toolbox  | Structure / Parts   | Canvas / Preview      | Inspector            |
|          |                     |                       |                      |
| Import   | Parts tree          | Empty state or model  | Project / selection  |
| Mesh     | PSD group-derived   | preview               | details              |
| Rig      | part containers     |                       | Part / Drawable /    |
| Dynamics | drawables / hidden  |                       | Source details       |
| Atlas    | drawables / hidden  |                       | Source details       |
| Validate | rows                |                       | Contextual controls  |
| Automate |                     |                       |                      |
+----------+---------------------+-----------------------+----------------------+
| Parameter Bar: active parameter / value slider / key markers / key actions      |
+--------------------------------------------------------------------------------+
| Diagnostics Strip: blocking/warning summary only                               |
+--------------------------------------------------------------------------------+
```

Toolboxは機能を呼び出す場所であり、model構造を表示・選択する場所ではない。Parts Treeは常設または即時展開できるStructure / Partsペインとして扱う。Import後の構造整理、mesh対象選択、rig対象選択はこのParts Treeを起点にする。Toolboxの詳細は [../components/toolbox.md](../components/toolbox.md) を参照する。

Drawable選択時、InspectorはDrawable Inspectorとして、draw order、editor/runtime visibility、opacity、clipping / mask、texture / mesh / atlas summaryを扱う。Draw OrderはParts Tree上で上にあるdrawableほど前面とする。Drawable Inspectorの詳細は [../components/drawable-inspector.md](../components/drawable-inspector.md) を参照する。

Parameter BarはToolboxやInspectorとは別の横断領域として、Canvas / Previewの下、Diagnostics Stripの上に置く。常時表示する対象は1つのactive parameterに限定し、全parameter確認は非モーダルのParameter Control Paletteで扱う。詳細は [../components/parameter-keyform.md](../components/parameter-keyform.md) を参照する。

## 3. Empty State

表示するもの:

- 空projectであること
- PSDを読み込む入口
- 既存projectを開く入口
- tutorialを開始する入口

表示しないもの:

- operation log
- evidence path
- package file set
- reload summary
- raw diagnostics

## 4. Import後の通常状態

表示するもの:

- parts treeにPSD group由来のpart container
- canvasにimportされたdrawable
- inspectorに選択中part/drawable/sourceの編集情報
- diagnostics stripに重要warningのみ
- import完了summary: generated parts / drawables / hidden drawables / warning count

表示しないもの:

- source refs全文
- generated refs全文
- materialized bytes詳細
- operation/evidence path
- package file set
- reload summary

Import直後は、通常編集状態の中でもPost-Import Review状態として扱う。最初の導線はParts Treeでimport結果を確認し、次に編集対象を選ぶことである。

主要操作:

1. 構造整理
   - Parts TreeでPSD group由来のpart container、drawable、hidden rowを確認する。
   - selectionに応じてInspectorへrename、draw order summary、editor/runtime visibility、opacity、clipping / mask、lock、source summary、削除/隔離などの編集情報を出す。
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
5. Texture Atlas作成・確認
   - ToolboxのTexture Atlasを開き、visible drawableをtexture pageへ配置する専用Taskへ進む。
   - Texture Atlas Taskでは、drawable対象一覧、page settings、padding、layout preview、unplaced / overflow warningを確認する。
   - Generate Layout Previewはuncommittedであり、Apply Atlasでproject stateへcommitする。
   - Texture Atlas Taskの詳細は [texture-atlas-task.md](texture-atlas-task.md) を参照する。

## 5. 関連機能ID

- App Bar: `UX-FEAT-001`, `UX-FEAT-026`, `UX-FEAT-027`
- Parts Tree: `UX-FEAT-008`, `UX-FEAT-009`
- Canvas / Preview: `UX-FEAT-004`, `UX-FEAT-005`, `UX-FEAT-011`, `UX-FEAT-012`
- Inspector: `UX-FEAT-002`, `UX-FEAT-003`, `UX-FEAT-010`〜`UX-FEAT-012`, `UX-FEAT-020`〜`UX-FEAT-025`
- Drawable Inspector: `UX-FEAT-002`, `UX-FEAT-003`, `UX-FEAT-008`, `UX-FEAT-009`, `UX-FEAT-010`〜`UX-FEAT-012`, 一部 `UX-FEAT-020`〜`UX-FEAT-023`
- Dynamics Tool: `UX-FEAT-024`, `UX-FEAT-025`
- Texture Atlas Task: 専用IDは未採番。関連: `UX-FEAT-004`, `UX-FEAT-008`, `UX-FEAT-009`, `UX-FEAT-019`

## 6. 未決事項

- Toolboxは左端固定か、上部toolbarか。
- Parts Treeを常に左に置くか、empty stateではcanvas側の導線を優先するか。
- Inspectorは右固定か、選択中対象に応じてdrawer/side panelとして切り替えるか。
