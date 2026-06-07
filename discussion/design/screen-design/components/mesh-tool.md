# Mesh Tool コンポーネント仕様

> 状態: Draft component spec。実装済み機能と未実装の必須UX候補を分けて記録する。

## 1. 役割

Mesh Toolは、Authoring Workspace内で選択中drawableのmeshを作成・確認・編集するActive Toolである。

PSD import後の多くのdrawableは、texture / drawable / empty mesh scaffoldとして入る。Mesh Toolは、その状態から編集可能な初期meshを作り、必要に応じて頂点・三角形・UVを手動調整するための主導線になる。

## 2. 自動化方針との関係

preset-based initial mesh generationはEditorの責務に含める。

理由:

- これはsemantic recognitionやsmart suggestionではない。
- ユーザーまたはCodexが対象drawableとpresetを明示する。
- Editorは、bounds、texture / alpha情報、preset、cap policyに基づいて決定的なgeometryを生成する。
- Editorは「髪だから大きく動く」「目だから標準」などの意味推定をしない。

やること:

- 選択drawableに対して初期meshを生成する。
- presetごとに密度や境界処理の方針を変える。
- 生成後にCanvas overlayで確認し、手動調整へ進める。

やらないこと:

- part名や画像内容からpresetを自動選択する。
- rig、deformer、parameter、keyform、physicsを自動構築する。
- AI/LLMによる提案、auto-rig、semantic classificationをEditor側に置く。

## 3. 基本フロー

```text
Parts Tree / Canvasでdrawableを選択
  -> ToolboxのMeshを選ぶ
  -> mesh未生成 / empty scaffoldならPreset Previewに入る
  -> presetを選ぶとCanvasに未commit preview mesh overlayが表示される
  -> Applyでmeshを生成し、Mesh Editに入る
```

逆順も許可する。

```text
ToolboxのMeshを選ぶ
  -> drawable未選択ならempty tool stateを表示
  -> Parts Tree / Canvasでdrawableを選ぶ
  -> mesh未生成 / empty scaffoldならPreset Preview、生成済みmeshならMesh Edit
```

## 4. Workspace内の配置

Authoring Workspace全体の配置は [../screens/authoring-workspace.md](../screens/authoring-workspace.md) に委譲する。この文書では、Mesh Tool固有の表示だけを扱う。

mesh overlayは中央のCanvas / Preview領域に固定して表示する。専用画面、modal、別windowとしてmesh canvasを開く意図ではない。

領域ごとの役割:

- Toolbox: Mesh toolがactiveであることを示す。
- Structure / Parts: 対象drawableを選択する。hidden / locked / runtime-hiddenなどの状態もここで確認できる。
- Canvas / Preview: 選択drawableの見た目にmesh overlayを重ねる。overlayはこの中央領域に固定する。
- Inspector / Tool Panel: mesh生成preset、mesh status、vertex / topology / UV操作を表示する。

## 4.1 Canvas Overlay

Canvas overlayは、中央Canvas / Preview内で選択drawableに重ねて表示する編集表示である。

```text
+------------------------------------------------------------------+
| Canvas / Preview                                                  |
|                                                                  |
|              selected drawable visual bounds                      |
|          +----------------------------------------+                |
|          |  o---------o---------o                 |                |
|          |  | \       | \       |                 |                |
|          |  |  \      |  \      |                 |                |
|          |  o---\-----o---\-----o                 |                |
|          |  |    \    |    \    |                 |                |
|          |  |     \   |     \   |                 |                |
|          |  o---------o---------o                 |                |
|          +----------------------------------------+                |
|                 selected / hover handles are emphasized            |
|                                                                  |
+------------------------------------------------------------------+
```

表示するもの:

- 選択drawableのvisual bounds
- mesh vertices
- selected vertex handles
- edges / triangles
- editability状態
- hover / selected状態

表示しないもの:

- operation ID
- evidence refs
- generated refs全文
- raw parser / validator payload

Canvas overlayの細かい描画ルール、handle形状、edge色、triangle面表示、zoom / pan / hit target設計は、この文書ではまだ決めない。

## 4.2 Preset Preview

Mesh Tool起動時に、選択drawableがmesh未生成またはempty mesh scaffoldならPreset Previewフェーズに入る。

Preset Previewでは、3つのpresetのうち1つが選択状態になり、そのpresetで生成される未commitのpreview meshを中央Canvasにoverlay表示する。presetを切り替えると、中央Canvasのpreview meshも切り替わる。

```text
+-----------------------+        +----------------------+
| Canvas / Preview      |        | Inspector / Tool     |
| selected drawable     |        | Mesh preset preview  |
| +-------------------+ |        |                      |
| | preview mesh for  | |        | [Large Motion]       |
| | selected preset   | | <----> | [Standard*]          |
| | dashed/uncommitted| |        | [Low Motion]         |
| +-------------------+ |        |                      |
|                       |        | vertex/triangle est. |
|                       |        | Apply / Cancel       |
+-----------------------+        +----------------------+
```

Inspector / Tool Panelに置くもの:

- 3つのpreset選択UI。
- 選択presetの説明。
- preview meshの概算vertex count / triangle count。
- Apply action。
- Cancel / reset preview action。

Canvasに置くもの:

- 選択drawable。
- 選択presetに基づくpreview mesh overlay。
- 未commitであることが分かるpreview表示。

比較方法:

- 初期案では、3presetを同時に中央Canvasへ並べるのではなく、選択中presetのpreviewを1つ表示する。
- ユーザーはInspectorのpresetを切り替えて、同じdrawable上のoverlay差分を見る。
- 必要であれば後続で、Inspector内に小さなthumbnail previewや比較表示を追加する。

Applyするまでproject meshは変更しない。Apply後に通常operationとしてmesh生成をcommitし、Mesh Edit状態へ進む。

## 5. Tool State

| State | Canvas | Inspector / Tool Panel | 主な操作 |
|---|---|---|---|
| No Drawable Selected | 通常previewまたはempty state | drawable選択を促す | Parts Tree / Canvasでdrawable選択 |
| Preset Preview | 選択presetの未commit preview mesh overlay | 3preset選択、preview summary、Apply / Cancel | preset切替、preview確認、mesh生成commit |
| Mesh Edit | mesh overlay、vertex handles、edge/triangle表示 | selected vertex count、position、step、last result | vertex選択、drag、nudge |
| Topology / UV Edit | mesh overlay、選択vertex/triangle表示 | add/remove vertex、add/remove triangle、UV nudge、triangle list | bounded topology / UV edit |
| Blocked | 対象は表示するが編集不可状態を示す | disabled reasonを人間向けに表示 | unlock、visible化、別drawable選択 |

## 6. Initial Mesh Generation

Initial mesh generationはUX上必須の未実装候補である。PSD import後のempty mesh scaffoldから、ユーザーが最初に行う自然な操作として扱う。

Preset draft:

| Preset | 用途 | 生成方針 |
|---|---|---|
| Large Motion | 大きく変形するパーツ向け | 密度高め、境界追従強め、変形余地を確保 |
| Standard | 通常パーツ向け | 標準密度、汎用的な初期mesh |
| Low Motion | あまり動かないパーツ向け | 密度低め、単純な形状を優先 |

UX:

- Drawable selected / Empty Mesh Scaffold状態で、Preset Previewフェーズに入る。
- ユーザーはInspector / Tool Panelでpresetを選ぶ。
- 選択presetに応じた未commit preview meshをCanvas overlayで確認できる。
- Applyするまでproject meshは変更しない。
- 生成後はMesh Edit状態へ進む。
- 操作は取り消し可能な通常operationとして扱う方向が望ましい。

初期実装単位の推奨:

1. 選択中drawableに対するpreset-based initial mesh generation。
2. 生成meshのCanvas overlay確認。
3. vertex drag / nudge による微調整。

後続候補:

- 選択part配下のdrawableへ一括生成。
- mesh未生成drawableすべてへ一括生成。
- alpha境界を利用したより精密な初期mesh生成。

## 7. 表示する情報

- 選択drawable名
- mesh status: none / empty scaffold / generated / blocked
- preset
- vertex count
- triangle count
- selected vertex count
- bounds summary
- locked / hidden / runtime-hidden / editor-hidden の人間向けstatus
- last operation summary
- warning count

## 8. 表示しない情報

- raw evidence全文
- operation ID全文
- generated refs全文
- source refs全文
- mesh hash
- materialized bytes詳細
- parser payload
- validator diagnostic raw payload

これらは必要に応じてDiagnostics / Evidence ViewやCodex-facing structured surfaceに置く。

## 9. 既存機能との対応

現在の実装には、mesh vertex select / drag / nudge、bounded topology / UV edit、runtime/preview evidenceが存在する。画面設計上は、これらを巨大なDrawable Authoring panelから分離し、Mesh Active ToolのCanvas overlayとInspector / Tool Panelへ再配置する方向で考える。

Wave50時点では、PSD structural scaffoldはleaf drawableにempty mesh scaffoldを作るが、preset-based initial mesh generationは未実装である。

## 10. 未決事項

- initial mesh generationでtexture alphaをどこまで参照するか。
- preview meshを生成するタイミングを、preset hover、preset focus、preset clickのどれにするか。
- preset名を英語表記にするか、日本語表記にするか。
- batch generationを初回実装に含めるか、後続waveに回すか。
- Mesh Tool内でTopology / UVを常時表示するか、詳細accordionにするか。
