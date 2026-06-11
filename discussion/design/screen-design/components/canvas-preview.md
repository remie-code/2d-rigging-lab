# Canvas / Preview コンポーネント仕様

> 状態: Draft component spec。Authoring Workspace中央のCanvas / Preview領域に関する画面設計。

## 1. 役割

Canvas / Previewは、現在のEditor modelを視覚的に確認し、選択対象を見つけ、後続のMesh / Rig / Dynamics作業へ進むための中心領域である。

PSD import後に表示するものはPhotoshopのflatten previewそのものではなく、PSDから生成されたpart / drawable群をEditor rendererで合成した結果である。import直後は、そのEditor renderer結果がPSD由来の見た目に近い状態になることを目指す。

Canvas / Previewはペインティング機能を提供しない。PhotoshopやKritaのようなbrush、paint layer編集、pixel編集はスコープ外である。

## 2. Import後に表示するもの

MVPで表示するもの:

- PSD canvas sizeをStage基準領域として扱う。
- visible drawableをPSD boundsに従って配置する。
- source order / draw orderに従って描画する。
- layer opacityを反映する。
- normal alpha blendを反映する。
- clippingを反映する。
- hidden drawableは通常描画しない。
- Parts TreeまたはCanvasで選択されたpart / drawableのbounds / outlineを表示する。
- origin、axes、canvas bounds、gridは薄いoverlayとして表示できる。

MVPで表示しない、または後回しにするもの:

- Photoshop pixel perfect parity。
- multiply / screen / overlayなどのblend mode完全対応。
- group opacityの厳密再現。
- layer mask / vector mask。
- layer effects。
- smart object。
- Photoshop flatten結果との差分検証。

ただし、clippingは後回しにしない。キャラクターPSDでは髪影、肌赤み、服模様、目周辺などで頻出し、UX上「読み込んだ絵が見える」ことの基礎に近い。実装ではPSD固有の概念をrendererへ直結させず、Editor model側のclipping表現へ変換してから描画する。

## 3. 基本操作

Canvas / Preview v0の操作は「見る・拡大縮小する・移動する・選ぶ・選択状態を見る」までを対象にする。

必須操作:

- Wheel zoom。
  - マウス位置を基準に拡大縮小する。
  - trackpad / mouse wheelの両方で破綻しない操作感を目指す。
- Pan。
  - Space + left dragを基本操作にする。
  - middle dragも対応候補にする。
- Fit Artwork。
  - visible drawable群の実描画boundsが画面内に収まる倍率と位置にする。
  - import直後の自動fitは原則としてFit Artwork寄りにする。
- Fit Canvas。
  - PSD canvas全体が画面内に収まる倍率と位置にする。
  - 透明余白を含む座標系確認に使う。
- Toolbar zoom controls。
  - wheel操作が難しい環境でも操作できるよう、toolbarにzoom out / zoom % / zoom in / 100% / fit系を置く。
- Selection feedback。
  - Parts Treeでdrawable / partを選択すると、Canvas上にbounds / outlineを表示する。
  - Canvas上でdrawableをクリックすると、hit testにより対象を選択する。
- Visibility reflection。
  - Parts Tree / Inspectorのvisibility状態はCanvas描画へ反映する。
- Isolate Selected。
  - 選択対象を一時的に見やすくするCanvas表示モードを提供する。
- Overlay toggles。
  - grid、canvas bounds、selection boundsなどの表示を切り替えられるようにする。

Canvas上での移動、変形、複数選択、marquee selection、rotate view、rulers / guides、pixel inspectorはv0では扱わない。必要になった場合はMesh / Rigなどの専用tool UXで再検討する。

## 4. Hit Test / Selection

Canvas click selectionの推奨ルール:

- click位置に重なるvisible drawableのうち、最前面のdrawableを選択する。
- draw orderが同一に見える場合はEditor model上のsource order / tree orderを決定的に使う。
- hidden drawableは通常hit test対象にしない。
- part / groupは、直接の描画対象ではなく、配下drawableのhit結果またはParts Tree選択で扱う。
- lock機構が存在する場合は、locked drawableをhit test対象から外すか、選択不可表示にする。現時点でlock機構が未整備なら必須ではない。

重なったdrawableを循環選択するUXは将来候補とする。v0ではtopmost drawable selectionで十分とする。

## 5. Isolate Selected

Isolate Selectedはmodel stateを変更しないCanvas表示モードである。runtime visibilityやeditor visibilityを書き換えない。

推奨UX:

- 選択中drawableがある場合、そのdrawableを通常表示し、他drawableを15-25%程度へdimする。
- 選択中part / groupがある場合、その配下drawableを通常表示し、それ以外をdimする。
- clipped drawableを対象にする場合、見た目が破綻しないようclip target / clipping関係に必要なdrawableは描画計算上維持する。
- Isolate中であることはCanvas toolbar上のtoggle状態として示す。
- Isolate解除は同じbuttonの再押下、または選択解除で行える。

完全なsolo非表示よりもdim表示を優先する。対象と周辺の位置関係を失わずに作業できるためである。

## 6. Canvas Toolbar

Canvas toolbarはCanvas panel上部、panel header直下に固定配置する。描画stageの上に重ねるfloating toolbarは、画像上端のパーツや小さいPSDに干渉しやすいため、v0では採用しない。

toolbarの方針:

- 高さは32-36px程度に抑える。
- buttonは28px前後のicon buttonを基本にする。
- 文字ラベルは常時表示しない。意味はtooltipで示す。
- 関連機能ごとに小さくグルーピングする。

toolbar group:

```text
+--------------------------------------------------------------------------------+
| Canvas / Preview                                                              |
| [ - ] [ 100% ] [ + ] [ 1:1 ] [ Fit Artwork ] [ Fit Canvas ] | [ Grid ] [ Bounds ] [ Selection ] [ Mesh ] [ Deformer ] | [ Isolate ] |
+--------------------------------------------------------------------------------+
| Stage                                                                         |
| ...                                                                           |
+--------------------------------------------------------------------------------+
```

View controls:

- Zoom out。
- Zoom percentage。
- Zoom in。
- 100% / 1:1。
- Fit Artwork。
- Fit Canvas。

Overlay controls:

- Toggle Grid。
- Toggle Canvas Bounds。
- Toggle Selection Bounds。
- Toggle Mesh overlay。
- Toggle Deformer overlay。

Focus controls:

- Isolate Selected。

Mesh overlay / Deformer overlayは、対象toolや該当データがない場合はdisabledまたはinactiveにしてよい。

Mesh overlayの初期方針:

- overlay toggleは表示状態だけを変え、project stateを変更しない。
- v0では選択中Drawableのmeshだけを表示する。
- Mesh Tool中はpreview確認のためmesh overlayを表示する。
- Apply前のdraft meshは、committed meshと区別できる見た目にする。
- hidden DrawableをMesh Toolで扱う場合、編集previewとして一時表示してよいが、model visibilityは変更しない。

## 7. 関連画面

- Authoring Workspace: [../screens/authoring-workspace.md](../screens/authoring-workspace.md)
- Parts Tree: [parts-tree.md](parts-tree.md)
- Drawable Inspector: [drawable-inspector.md](drawable-inspector.md)
- Mesh Tool: [mesh-tool.md](mesh-tool.md)
- Rig Tool: [rig-tool.md](rig-tool.md)
