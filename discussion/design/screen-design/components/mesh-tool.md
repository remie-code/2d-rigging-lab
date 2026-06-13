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

選択対象ごとの分岐:

```text
Mesh Tool 起動
  if selected Drawable:
    -> Mesh Inspector: Drawable mesh workflow

  if selected Part Container:
    -> Mesh Inspector: Drawable picker within selected container

  if selected Project / none:
    -> Mesh Inspector: Select a Drawable
```

Part Container選択中は、Container自体へmeshを作らない。Container配下のDrawable候補一覧をInspectorに出し、ユーザーがその中から1つのDrawableを選ぶ。選択後は通常のDrawable mesh workflowへ移る。

Project / none選択中は、Parts TreeまたはCanvasでDrawableを選ぶ短いempty stateを表示する。長い説明文やdebug情報は出さない。

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
- edges / triangles
- editability状態
- preview / committed状態
- hover / selected状態。v0では手動頂点選択は必須ではない

表示しないもの:

- operation ID
- evidence refs
- generated refs全文
- raw parser / validator payload

Canvas overlayは表示確認用であり、overlay toggleはproject stateを変更しない。v0では選択中Drawableのmeshだけを表示対象にする。

Canvas toolbarとの関係:

- Canvas toolbarのMesh overlay buttonは、mesh overlayを表示 / 非表示する表示操作である。
- Mesh Tool中は、preview確認のためmesh overlayを表示する。
- Apply前のdraft meshは、committed meshと区別できる色・線種で表示する。
- Apply後はcommitted meshとして表示する。
- Mesh Tool内の `Show mesh overlay` toggleを置く場合も、Canvas toolbarと同じ表示状態を操作する。

将来候補:

- all / selected / hidden のoverlay表示範囲切替。
- vertex handle編集。
- edge / triangle単位の選択表示。

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

既存meshがある場合のRegenerate:

- 既存meshはApplyまで保持する。
- Regenerateを選ぶとreplacement draftを生成する。
- Canvasでreplacement draftをpreviewする。
- Applyで既存meshを置換する。
- Cancelでreplacement draftを破棄し、既存meshを保持する。

## 5. Tool State

| State | Canvas | Inspector / Tool Panel | 主な操作 |
|---|---|---|---|
| No Drawable Selected | 通常previewまたはempty state | drawable選択を促す | Parts Tree / Canvasでdrawable選択 |
| Container Selected | Container配下drawableのbounds / selection summary | 配下Drawable picker | 対象drawableを1つ選ぶ |
| Preset Preview | 選択presetの未commit preview mesh overlay | 3preset選択、preview summary、Apply / Cancel | preset切替、preview確認、mesh生成commit |
| Mesh Edit | committed mesh overlay、edge/triangle表示 | mesh status、Regenerate、overlay toggle | 確認、Regenerate開始 |
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

初期アルゴリズム方針:

- 3つの別アルゴリズムではなく、同じ決定的アルゴリズムをpreset値で変える。
- Wave61 v0はalpha-aware grid triangulationとして成立したが、これは「粗い矩形grid生成」であり、Cubism風の輪郭追従meshではない。
- DrawableのRGBA画像からalpha maskを読み、不透明ピクセルのboundsを取る。
- presetに応じた格子間隔で頂点gridを作る。
- grid cellを三角形2枚へ分割する。
- 完全透明に近い外側cellは可能な範囲で捨てる。
- vertex位置とUVを対応させる。
- 生成結果を未commit draftとしてCanvas overlayに表示する。
- Applyで既存meshまたはempty scaffoldを置換する。

preset差分:

| Preset | 密度 | 想定 |
|---|---|---|
| Large Motion | 細かい | 髪、袖、揺れ物など変形が大きい部品 |
| Standard | 中 | 多くの髪、顔、服パーツ |
| Low Motion | 粗い | 帽子、アクセサリ、硬い部品 |

UX:

- Drawable selected / Empty Mesh Scaffold状態で、Preset Previewフェーズに入る。
- ユーザーはInspector / Tool Panelでpresetを選ぶ。
- 選択presetに応じた未commit preview meshをCanvas overlayで確認できる。
- Applyするまでproject meshは変更しない。
- 生成後はMesh確認状態へ進む。
- 操作は取り消し可能な通常operationとして扱う方向が望ましい。
- hidden DrawableでもParts Treeから選択すればmesh生成できる。
- hidden DrawableをMesh Toolで扱う場合、編集previewとして一時表示してよい。ただしmodelのvisibilityは変更しない。
- clipping中Drawableのmeshは、clipping後の見た目ではなく、Drawable自身のtexture / alpha boundsから生成する。

### 6.1 Wave61 v0の限界

Wave61で実装された `auto-grid-v1` は、初期操作導線とpreview -> Apply UXを成立させるための最小生成である。期待するCubism風の「大きく動くパーツ」meshとは別物として扱う。

`auto-grid-v1` の性質:

- alphaを含む矩形範囲をもとにgridを作る。
- grid cellを固定対角線で三角形に割る。
- alphaを含まないcellを除外することはあるが、輪郭上へ頂点を吸着しない。
- 髪先、頬まわり、衣装端などの曲線輪郭へ沿った頂点列は作らない。
- 大きく動くパーツpresetでも、密度が上がるだけで輪郭追従meshにはならない。

このため、次の改善対象は既存 `auto-grid-v1` の微調整ではなく、輪郭抽出を含む新しい生成モードとして定義する。

### 6.2 Mesh生成アルゴリズム参照

この文書はMesh ToolのUXを扱う。Drawable RGBA alpha maskからどのように初期meshを生成するかの詳細アルゴリズムは、画面仕様ではなく [../../mesh-generation/](../../mesh-generation/_map.md) 配下のアルゴリズム設計を正とする。

現時点の主候補は、`auto-outline-v2` を基礎に、輪郭付近だけをbounds比率ベースのsoft boundaryで少し包み、triangle密度を大幅に粗くする [../../mesh-generation/auto-outline-v2-5-soft-boundary.md](../../mesh-generation/auto-outline-v2-5-soft-boundary.md) である。次のrefinement候補は、V2.5の内部密度を維持し、境界外側に薄いapron triangle帯を追加して頭頂部などの境界不足を補う [../../mesh-generation/auto-outline-v2-6-soft-apron.md](../../mesh-generation/auto-outline-v2-6-soft-apron.md) である。さらに、Cubism三段階自動メッシュの観察をもとに、V2系統とは別に輪郭帯を主構造として作る [../../mesh-generation/auto-outline-v4-contour-band.md](../../mesh-generation/auto-outline-v4-contour-band.md) を次wave sidecar候補として扱う。`auto-outline-v3-envelope` は実験候補として残すが、外側包絡が強すぎるとDrawable描画領域から外れやすい。

Mesh Tool側が持つ責務:

- presetを選ばせる。
- preview mesh overlayを表示する。
- Applyするまでproject meshを変更しない。
- Regenerate draftを既存meshとは区別して表示する。
- fallback / blocked / warningを人間向けに短く表示する。

アルゴリズム側が持つ責務:

- Drawable自身のRGBA alpha maskを入力にする。
- semantic recognitionやpreset自動選択を行わない。
- presetに応じて輪郭点、内部点、triangle品質を決定的に生成する。
- 同じ入力から同じmeshを返す。
- fallback条件とquality summaryを返す。

現在の生成モードの位置付け:

| Algorithm | 位置付け | 備考 |
|---|---|---|
| `auto-grid-v1` | Wave61以前の最小fallback | 矩形grid由来。Cubism風輪郭追従ではない |
| `auto-outline-v1` | Wave62の輪郭追従初期版 | 矩形gridより大きく改善。ただし扇状集中、大きすぎるtriangle、grid由来の矩形感が残る |
| `auto-outline-v2` | Wave63の改善版 | 自然なtriangular meshへかなり近づいた。ただし全体的に細かく、外周がalpha輪郭を追いすぎる |
| `auto-outline-v2.5-soft-boundary` | 現在の主候補 | V2を基礎に、輪郭付近だけsoft boundaryで少し包み、V2より大幅に粗いtriangle密度を目指す |
| `auto-outline-v2.6-soft-apron` | 次のrefinement候補 | V2.5の内部密度を保ち、境界外側に薄いapron triangle帯を追加して境界不足を補う |
| `auto-outline-v3-envelope` | 実験候補 | alpha輪郭そのものではなく外周を含むenvelope boundaryで包むが、包絡が強すぎるリスクがある |
| `auto-outline-v4-contour-band` | 次wave sidecar候補 | 輪郭帯を明示生成し、その内側をpreset別target sizeで三角形充填する別系統候補 |

UX上のAcceptance Criteria:

- Large Motion presetで、alpha輪郭に沿った境界頂点列が生成される。
- 透明領域だけを大きく覆う矩形三角形が主結果にならない。
- Standard / Low MotionではLarge Motionより頂点・三角形数が少ない。
- preview -> Applyの既存UXを保つ。
- Apply前はproject meshを変更しない。
- 既存meshがある場合はRegenerate draftとして表示し、Applyで置換する。
- hidden Drawableは編集previewとして一時表示できるが、visibility状態は変更しない。
- fallbackがあり、bytes欠落などで操作全体が壊れない。

当面不要:

- 手動頂点編集。
- 辺 / 頂点追加削除。
- 詳細な分割数UI。
- 複数Drawableへの一括生成。
- presetのsemantic自動選択。

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

Container選択中のDrawable pickerに表示するもの:

- 配下Drawable名
- mesh状態
- visibility状態
- texture / renderable状態の簡潔なbadge

Container選択中のDrawable pickerに表示しないもの:

- 一括生成操作
- source refs全文
- generated refs全文
- raw evidence

pickerでDrawableを選んだ場合、global selectionもそのDrawableへ移る。

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

- `auto-outline-v1` で採用するtriangulation library。
- `auto-outline-v1` のpresetごとの輪郭簡略化値、内部点間隔、最大頂点数。
- alpha thresholdの初期値。
- preview meshを生成するタイミングを、preset hover、preset focus、preset clickのどれにするか。
- preset名を英語表記にするか、日本語表記にするか。
- Mesh Tool内でTopology / UVを後続機能としてどこに置くか。
