# Cubism Editor Preview Observable Features

> 調査日: 2026-05-25  
> 対象: Open Live2D Stack Editor preview / GUI Editor / Validator / AI Agent 設計のために、Cubism Editor の制作中 preview / modeling view で観測できる機能を整理する。  
> 非対象: Cubism Editor のUI配置、メニュー、ショートカット、画面模倣。

## 1. 要約

Cubism Editor の制作中 preview は、単なる runtime 表示確認ではなく、Modeling View の canvas、Parts / Deformer / Parameter / Inspector palette、mesh / keyform / deformer / draw order / clipping の編集状態、さらに warning / model statistics を重ねた authoring inspection 面である。

Open Live2D Stack では、Cubism UIを再現するのではなく、次の4種類を明確に分ける必要がある。

| 種類 | 例 | Open Stackでの扱い |
|---|---|---|
| Runtime-visible model state | drawable、mesh、texture、parameter、keyform、deformer、draw order、opacity、clipping / mask | Open Model Package と Runtime evaluator の正規データ |
| Runtime evaluation state | 現在parameter値、補間後vertex、visibility / opacity、mask解決、draw order、diagnostics | Editor preview / Viewer / AI runtime snapshot で共有 |
| Production support UI state | selection、lock、palette tree展開、solo、snapshot、canvas zoom / background / onion skin / multiview | GUI Editorの作業状態。runtime model state と混同しない |
| Diagnostics / validation state | mask warning、deformer overhang、empty deformer、mask count / permutations、integrity / load check | Validator report と Editor warning に構造化して保存 |

## 2. Official Facts

### 2.1 View area / Modeling View

- 公式マニュアルは View area を「Live2Dモデルが表示される領域」とし、ArtMesh の選択・canvas配置、mesh / deformer の移動に使う領域として説明している。Modeling View は、object変形、keyform作成、ArtMesh編集、parameter作成を行う view である。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/about-viewarea/
- Modeling View には、tab、drawable / deformer のlock、drawableのshow/hide、grid、solo、glue on/off、snapshot、record、random pose、draw order slider、view control がある。tabは複数作成でき、focus中のtabごとにparameter current valueを保持する。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/about-viewarea/
- View control は canvas background color / opacity、zoom、full scale、display all、focus display、canvas inversion、onion skin、multiview layout などを含む。これらは主に制作支援表示であり、モデルのruntime状態そのものではない。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/about-viewarea/
- object selection は canvas上のクリック、Shift複数選択、右クリックcontext menu、ArtMesh popup list で行う。右クリックcontext menuでは deformer parent-child hierarchy をtreeとして選択支援に使える。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/about-viewarea/
- View area では canvas 3D表示と draw order 3D表示があり、全体のdraw orderを視覚確認できる。ただし draw order group を使うpartsは、この3D表示に設定が反映されないという注意がある。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/about-viewarea/  
  Source: https://docs.live2d.com/en/cubism-editor-manual/draworder/
- 「Hide selection state」は、選択中objectのArtMesh vertices、mesh lines、deformer border linesなどのUI表示を隠す制作支援表示である。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/about-viewarea/

### 2.2 Parts palette

- Parts palette は、bangs、eyes、mouth などの大きな分類でobjectを管理し、imported PSD の layer order で表示される。objectの選択、表示、lock、所属partsの確認に使う。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/partspalatte/
- Parts palette には、text / ID filter、ArtMesh / ArtPath / warp deformer / rotation deformer / glue のshow/hide、show/hide all、lock/unlock all、expand/collapse all、selection連動tree展開、drag-and-drop禁止、part作成、deleteがある。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/partspalatte/
- lock は View area 上で選択・編集できなくする制作支援状態である。一方、palette上では移動、parent-child hierarchy設定、right-click menu操作が可能で、Inspector項目も設定次第でlockできる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/partspalatte/
- Parts palette内の順序を変更しても、canvas表示はdraw order値が優先される。同じdraw orderの場合はParts palette上で上にあるものがforegroundになる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/partspalatte/  
  Source: https://docs.live2d.com/en/cubism-editor-manual/draworder/

### 2.3 Deformer palette / deformer hierarchy

- Deformer palette は object の parent-child hierarchy を管理し、構築済み階層として表示する。object選択、表示、lock、parent-child確認に使う。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/deformerpalatte/
- Deformer palette は全体/個別のshow/hide、lock/unlock、expand/collapse、selection連動tree展開、drag-and-drop禁止、multi-selection、delete、drag-and-dropによるdeformer parent-child設定を持つ。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/deformerpalatte/
- 同じparent deformerを持つchild objectの順序は Deformer palette では変えられず、順序変更は Parts palette 側で行う。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/deformerpalatte/
- deformer hierarchy では、warp / rotation deformer を ArtMesh のparentにでき、parent変形はchildに反映されるが、child変形はparentに影響しない。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/system-of-parent-child-relation/

### 2.4 Inspector palette

- Inspector palette は ArtMesh / deformer の設定paletteであり、選択object種別に応じて表示内容が変わる。ArtMeshでは name、ID、part、deformer、clipping ID、reverse mask、draw order、opacity、multiply / screen color、blend、culling、user data、vertices info を扱う。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/inspector-palette/
- Warp deformerでは name、ID、part、parent deformer、opacity、multiply / screen color、conversion divisions、Bezier conversion compatibility などを扱う。Rotation deformerでは angle、standard angle、scale、opacity、vertices info、original shape auto update などを扱う。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/inspector-palette/

### 2.5 ArtMesh / mesh editing

- PSDをmodel workspaceに読み込むと、各layerまたはgroupにmeshが割り当てられ、canvas上にArtMeshとして配置される。ArtMeshはtextureにvertices / linesからなるpolygon meshを割り当て、vertex移動によって表情や動きを作る。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/concept-of-artmesh/
- mesh editing には、密度関連値から自動生成する Automatic Mesh generator と、点を1つずつ編集する manual edit がある。自動生成は個別ArtMeshにも適用でき、適用後もshape調整できる。ただしparameter設定後のauto generationはshapeが変わるため推奨されない。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/mesh-edit/
- manual mesh edit では、vertex / edgeの追加・削除、vertex selection、Shift複数選択、lasso selection、vertex移動、複数vertexの移動・拡縮・回転、merge vertices、undo / redo ができる。vertex移動はtexture自体ではなくmesh shapeを編集する。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/mesh-edit-manual/
- keyform editing の通常編集では、選択ArtMesh verticesをmove / rotate / scaleしてtextureを変形でき、source image形状へrevertできる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/how-to-edit/

### 2.6 Parameter / keyform

- Parameter は Angle X や Mouth Open/Close など特定のmovementを表す設定である。Parameterにkeyを追加すると、その変形shapeがkeyformとして登録され、key間のshapeは自動補間される。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/parameter/
- Parameter settings dialog では、parameterのorder、name、ID、minimum / default / maximum、repeat、blend shape、descriptionを一覧確認できる。公式は、仕様上のruleがない場合は Standard Parameter List のIDと値を使うことを推奨している。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/parameter/  
  Source: https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/
- Standard Parameter List には、ParamAngleX / Y / Z、eye open、eyeball X/Y、brow、mouth、body angle、breath、arm、hair sway、base X/Y などのID、min/default/max、説明がある。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/
- Parameter palette は、deformation degreeを数値に結び付けるparametersを管理する。key editing button、parameter bar、slider popup、parameter / group create/delete、parameter group、current value、key display、refine searchを持つ。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/palametorpalatte/
- Parameter slider display は current value と key を区別し、selected objectとの関連や複数objectでkeyform不一致の場合を表示で区別する。Refine Search は、選択object / deformerに関連するparameterだけを表示できる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/palametorpalatte/
- Add/Delete Keys page は、ArtMeshまたはdeformerを選択し、parameterを選び、2点/3点keyや手動keyを追加・削除・値編集できることを説明している。keyが1つだけの場合、そのparameterではobjectがそのkey値でのみ表示されるため、parameter移動中に常時表示したい場合は両端にもkeyを入れる注意がある。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/edit-parameters/
- X/Y keyform では、Angle X / Angle Y や eyeball X/Y のように2parameterを組み合わせ、3点 x 3点 = 9 patternsのkeyformsを扱う。combined display は表示方法だけを変え、設定自体には影響しない。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/keyform-xydirection/

### 2.7 Deformer

- Cubismはmesh vertexを個別移動して顔向きや腕の動きを作れるが、deformerを使うとverticesをまとめて編集できる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/deformer/
- Warp deformer は内部objectをまとめて変形でき、swaying objectやface directionに有用である。size / opacityも調整できる。create dialogではparts、name、location、conversion divisions、Bezier divisions、child keyform shapeを考慮したsize、selected object center alignmentなどを設定できる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/making-and-placement-of-warp-deformer/
- Rotation deformer はparentに設定したobjectをangle指定で回転でき、scale handleによる拡縮もできる。create dialogでparts、name、locationを設定し、canvas上でposition / angleを合わせ、Inspectorでobjectのparent deformerとして設定する。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/making-and-rotation-of-rotationdeformer/
- Deformer for positioning はcopy/pasteやparts import/export時に必要に応じて一時挿入されるproduction support構造であり、位置決定後は削除するものとして説明されている。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/deformer/

### 2.8 Draw order

- Draw order は ArtMesh / ArtPath など drawable object のoverlap orderで、0から1000の値を持ち、高い値ほどforegroundに表示される。同値の場合はParts palette上で上にあるpartがforegroundになる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/draworder/
- Draw order はkeyform shapeと同様にparameterに割り当ててparameter値で変えられる。Inspectorで数値変更でき、View area左のdraw order sliderでも変更できる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/draworder/  
  Source: https://docs.live2d.com/en/cubism-editor-manual/about-viewarea/
- batch change / all ArtMeshes change により、Parts palette順序を基準にdraw orderを一括設定できる。3D display of draw order によりcanvas上で全体のdraw orderを視覚確認できる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/draworder/
- Draw order group はpart自体にdraw orderを設定し、内部objectをparent groupと同じdraw orderとして扱うことで、partを1枚のlayerのように扱う機能である。group内ではdraw orderがlocalになり、ungroupでglobal draw orderに戻る。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/drawing-order-group/

### 2.9 Clipping / mask

- Clipping mask はまばたきなどによく使われる。maskとして使うArtMeshのIDを、clipped ArtMeshのInspector [Clipping ID] に指定する。複数ArtMesh IDはcomma区切りで指定できる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/
- Clipping関係から、mask objectを選択する機能と、選択objectをmaskとして使っているobjectを逆引き選択する Reverse Clipping がある。これはinspectionに重要である。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/
- SDK利用時のclippingには、mask数制限、load / performance degradation、環境・display size差による見た目差がある。Editor上でも、File > Model Statistics でclipping数とmask permutation typesを確認できる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/
- Mask warning は、clipping maskに使うmaskが不正状態のときに出る。警告条件には、mask ArtMeshがparameter keyform外で見えない、hidden / underdrawのArtMeshがembedding export標準設定で出力されない、mask ArtMesh削除後にclipping列がnullになる、などがある。公式は「編集中は一時的に許容されても出力時には望ましくない状態」として警告すると説明している。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/

### 2.10 Model statistics / validation-related feedback

- Deformer validation では、child deformer / ArtMesh のvertexがparent warp deformerからはみ出す場合、Show menu の highlight によってvertex colorがlight blueになる。operation上の問題ではないが、制作中に検知した場合は調整推奨とされる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/convenient-function-deformer/
- Validate Deformer dialog では overhanging vertex を持つdeformerを確認し、out-of-statusのみへ絞り込み、conversion divisions / Bezier divisionsを確認し、対象deformerやchild drawable objectを自動選択できる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/convenient-function-deformer/
- Model Statistics dialog から、child objectが設定されていない empty deformer 数を確認し、Select Uncompleted Deformer で対象を検出・自動選択できる。  
  Source: https://docs.live2d.com/en/cubism-editor-manual/convenient-function-deformer/
- Cubism SDK は model load前に MOC3 のintegrityを検証できる。`csmHasMocConsistency()` を使い、Cubism SDKのsampleではload時にintegrity verificationをデフォルト実行する。  
  Source: https://docs.live2d.com/en/cubism-sdk-manual/moc3-consistency/

### 2.11 Runtime-visible state in official SDK docs

- Cubism SDKのWeb model manualは、model情報は基本的にModelerで作られ、parameterに対するvertices等の動きは `.moc3` に記録されると説明する。`.model3.json` はmodel関連file referencesを保持する。  
  Source: https://docs.live2d.com/en/cubism-sdk-manual/model-web/
- Frameworkで `.moc3` から CubismModel instance を作り、userはparameterを操作しdrawing用informationを取得する。`CubismModel.update()` を実行すると、parameter operationがArtMesh verticesに反映される。  
  Source: https://docs.live2d.com/en/cubism-sdk-manual/model-web/
- SDK parameter operation では、parameter valueのset / add / multiply / get、ID指定またはindex指定、parameter valuesのsave / restore が説明されている。  
  Source: https://docs.live2d.com/en/cubism-sdk-manual/parameters/

## 3. Repository Requirements

この節は、指定基礎資料に基づくリポジトリ内要求であり、Cubism公式仕様ではない。

- MVPは「最小モデル表示」ではなく、GUI Editorで素材からLive2D的可動モデルを制作し、保存、再読み込み、Runtime / Viewer表示、Validator / AI Agent検証まで一周することを初期成功条件にしている。  
  Source: `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- Cubism Editorの画面配置やメニュー構成の模倣は目的ではない。再構築対象は、制作能力、制作途中の見通し、保存と再編集、runtime確認、構造化検証である。  
  Source: `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- MVP参照範囲は Cubism 基本チュートリアル1-5相当であり、チュートリアル6相当のAnimation mode、timeline、motion作成はMVP外である。  
  Source: `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`  
  Source: `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- Editor と Viewer は同一アプリ内機能とし、ValidatorはMVPではEditor内warningができれば十分とする。ただしRuntimeをEditor preview / Viewerで共有するかは品質特性から検討する。  
  Source: `discussion/design/initial-design-decisions-and-open-questions.md`
- Standard parameterは必須に近い位置付けで、初心者が標準parameter体系を一から構築する前提にはしない。  
  Source: `discussion/design/initial-design-decisions-and-open-questions.md`
- MVPでは lock / hide / select をproduction support stateとして扱い、runtimeに必要な表示状態やdraw orderと混同しない要求がある。  
  Source: `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- Validatorはschema、asset、mesh、drawable、parameter、deformer、mask、runtime load、rightsを対象にし、AI-readableなstructured reportを出す必要がある。AI Agentはmodel inspection、runtime snapshot、operation dry-run、diff、validation reportを扱う必要がある。  
  Source: `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`

## 4. Production Support UI State vs Runtime Model State

| Feature | Cubismで観測できるもの | Production support UI state | Runtime-visible model state | Open Stackで保存/診断すべきもの |
|---|---|---|---|---|
| Canvas / View controls | zoom、background、focus、flip、onion skin、multiview、grid | はい | 原則いいえ | Editor workspace設定として任意保存。Package正規modelには入れない |
| Selection / lock / tree展開 | canvas selection、Parts/Deformer palette selection、lock、expand | はい | 原則いいえ | Editor session state。AI operation対象指定にはselection snapshotを渡せる |
| Solo / snapshot / hide selection UI | selected-only display、semi-transparent snapshot、mesh/deformer UI非表示 | はい | 原則いいえ | preview overlay state。model dataとは分離 |
| Parts hierarchy | part分類、part ID、object所属、palette order | 一部 | はい、構造として必要 | part / drawable stable ID、所属、order tie-breakerを保存 |
| Parts palette show/hide | editing中の表示/非表示 | はい | 要設計。runtime visibilityと混同不可 | authoring visibility と runtime visibility / opacity を別fieldにする |
| ArtMesh / mesh | layer由来ArtMesh、vertices、edges、triangulation、texture deformation | edit handlesはUI | はい | drawable、texture ref、mesh vertices/uv/triangles、source asset linkを保存。mesh diagnosticsを出す |
| Inspector ArtMesh fields | name、ID、part、deformer、clipping ID、draw order、opacity、blend、culling、user data、vertices info | Inspector UIはproduction | 多くはruntime state | model schemaで正規化し、AIがIDで参照できるようにする |
| Parameter settings | name、ID、min/default/max、repeat、blend shape、description、group | palette UIはproduction | parameter定義とcurrent valueはruntime evaluation state | definitionとcurrent/evaluated stateを分離。standard aliasを保持 |
| Keyforms | parameter上のkey、object/deformerに対応するshape、2D 3x3 keyform grid | key編集UIはproduction | はい | keyform value、target IDs、affected properties、multi-parameter compositionを保存 |
| Deformer | warp/rotation、parent-child hierarchy、conversion divisions、angle/scale、opacity | palette selection / lockはproduction | はい | deformer node、children、transform/control grid、parameter bindingを保存 |
| Deformer validation | overhang highlight、Verify Deformer dialog、empty deformer selection | warning UIはproduction | diagnostics派生 | check ID、target ID、severity、evidence、fix candidateとして保存 |
| Draw order | 0-1000、parameter-driven draw order、slider、batch、3D display | slider / 3D displayはproduction | はい | numeric draw order、tie-breaker、parameter binding、evaluated render orderを保存 |
| Draw order group | part単位draw order、local draw order、grouped icon | palette/group UIはproduction | 実装するならruntime state | MVP採否を決める。入れる場合はlocal/global orderの明確なruntime semanticsが必要 |
| Clipping / mask | Clipping ID、multiple IDs、reverse clipping、mask count、warnings | selection UIはproduction | はい | mask refs、resolved mask set、runtime platform warnings、mask diagnosticsを保存 |
| Model statistics | mask counts、mask permutations、empty deformer数、advanced feature stats | dialogはproduction | diagnostics派生 | Validatorのsummary metricsとして保存 |
| SDK integrity / load check | MOC3 consistency、load failure | いいえ | runtime load diagnostics | Open Packageのschema/integrity/load/evaluation checksとして実装 |

## 5. Design Implications

1. Editor preview と Viewer は、同じ runtime evaluator を共有するのが望ましい。Cubism公式でもparameter操作後にmodel updateでverticesへ反映しrendererでdrawする流れがあり、Open Stackでも「parameter値からevaluated drawable stateを得る」中心APIをEditor preview / Viewer / AI snapshotで共有すると差分を減らせる。
2. Editor preview は runtime view に overlay / inspection layer を重ねる構成にする。mesh vertices、deformer borders、selection bounds、draw order debug、mask relation highlight、warning highlightはruntime model stateではなくinspection overlayである。
3. Package schema は authoring state と runtime state を分ける必要がある。特に lock / hide / select / palette expansion / tab current values / canvas zoom を drawable visibility / opacity / draw order と混ぜると、ValidatorとRuntimeの判定が不安定になる。
4. Parameter / keyform はGUI操作向け表現とruntime評価向け表現を同じIDで結ぶ必要がある。標準parameter alias、min/default/max、current value、keyform targets、multi-parameter keyform gridをAI-readableにする。
5. Mask / clipping はMVPでもdiagnosticsを強めに扱うべきである。公式が「編集中は許容でも出力時に望ましくない」mask warningを明示しているため、Open Stackでも `mask_ref_missing`、`mask_hidden_in_export_profile`、`mask_outside_keyform`、`mask_permutation_count_high` のようなcheckを持つべきである。
6. Deformer validation は「runtime fatal」ではなく「production quality warning」として扱う余地がある。公式はoverhang自体はoperation問題ではないが調整推奨としているため、severityは `warning` または `info` から始め、runtime評価不能やcycleとは区別する。
7. AI Agent向けには、画面スクリーンショットよりも structured observation が重要である。最低限、selected IDs、model tree、parameter definitions/current values、keyform map、evaluated drawable state、diagnostics、source/provenance、operation diff を取得できる必要がある。

## 6. MVP Candidates

- Single Modeling Preview canvas: model表示、pan/zoom、background、selection、focused object、mesh/deformer overlay、warning overlay。
- Parts inspection: part / drawable tree、stable ID、所属、authoring lock / hide / select、runtime visibility / opacityとの分離。
- Inspector-equivalent structured property panel: drawable/deformerのID、name、part、parent deformer、draw order、opacity、clipping refs、mesh statsを編集・確認。
- Mesh MVP: ArtMesh生成、vertices / UV / triangles保持、手動vertex移動、簡易自動mesh生成、退化triangle / index範囲 / texture範囲 diagnostics。
- Parameter / keyform MVP: standard parameter preset、ID/name/min/default/max/current value、2/3 key追加、keyform編集、補間preview、selected objectに関連するparameter絞り込み。
- Multi-parameter keyform MVP: Angle X/YまたはEyeball X/Yの3x3 grid相当をデータとして表現し、previewで斜め方向を確認。
- Deformer MVP: warp / rotation相当node、parent-child hierarchy、target children、parameter binding、basic overhang / empty deformer diagnostics。
- Draw order MVP: numeric draw order、parameter-driven draw order、tie-breaker rule、preview反映、debug overlayまたは一覧でのrender order確認。
- Clipping / mask MVP: clipping refs、mask reverse lookup、mask count / permutations、missing / hidden / keyform外mask warning。
- Model statistics MVP: drawable数、mesh vertex/triangle数、parameter/keyform数、deformer数、empty deformer数、mask count/permutation、diagnostic summary。
- Editor warning MVP: warning marker、target selection、human-readable summary、AI-readable report entry。
- AI observation MVP: model structure inspection、runtime state snapshot、validation report、dry-run operation diff。

## 7. MVP-out Candidates

- Cubism Editorのpalette配置、menu構成、shortcut、icon、exact UI behaviorの模倣。
- Animation View、timeline、motion作成、record parameter operationsからanimation生成、Form Animation。
- SnapshotをParts paletteへ画像保存する機能、random pose、multiview、onion skinの完全再現。
- Draw order groupの完全互換、local/global draw order表示のCubism互換再現。
- Auto generation of full-body deformer、auto facial motion、auto sway motion、3D rotation expression、advanced blend shape、offscreen drawing、Cubism 5.3 advanced blend/offscreen performance UI。
- Cubism `.cmo3` authoring state復元、`.moc3` / `.model3.json`互換出力、Cubism SDK/Core必須runtime。
- Cubism Viewer互換のmotion / expression / physics / pose / playlist管理。MVPではEditor preview調査対象外であり、別Viewer調査に委ねる。

## 8. Open Questions

- Editor preview と Viewer は同一runtime evaluatorを共有する方針でよいか。共有する場合、Editor-only invalid stateをruntime evaluatorがどこまで受け入れるか。
- Open Stackで `hide` をauthoring visibilityとしてのみ扱うか、runtime visibility / export inclusion としても扱うか。特にmask ArtMeshがhiddenの場合の診断とexport profileの関係を決める必要がある。
- Draw order group相当をMVPに入れるか。入れる場合、local draw order、global draw order、parameter-driven group order、debug displayのsemanticsを最初から固定する必要がある。
- Parameter current valueをEditor tabごとに保持するか。Cubismはtab focusごとにcurrent valueを持つが、Open Stackではworkspace state、preview state、package stateのどこに置くか未決。
- Standard parameter aliasesをどの程度強制するか。MVP設計判断では標準parameterは必須に近いが、Open Stack固有IDとの対応表をどこに保存するか未決。
- Multi-parameter keyform gridを汎用N次元keyformとして持つか、MVPでは2D gridだけを特別扱いするか。
- Deformer overhangをValidatorで `warning` にするか `info` にするか。runtime評価不能なdeformer cycle / missing targetとはseverityを分けるべきだが、閾値は未決。
- Model statisticsのMVP最小セットをどこまでにするか。mask permutations、empty deformer、mesh complexity、advanced blend/offscreen countのうち、MVPで必要なものを決める必要がある。
- AI Agentが取得するpreview observationに、pixel snapshotを含めるか。構造化stateだけで十分か、またはvisual diff用にrendered imageも必要か。

## 9. Source URLs

Official Live2D docs:

- View area: https://docs.live2d.com/en/cubism-editor-manual/about-viewarea/
- Parts palette: https://docs.live2d.com/en/cubism-editor-manual/partspalatte/
- Deformer palette: https://docs.live2d.com/en/cubism-editor-manual/deformerpalatte/
- Inspector palette: https://docs.live2d.com/en/cubism-editor-manual/inspector-palette/
- ArtMesh: https://docs.live2d.com/en/cubism-editor-manual/concept-of-artmesh/
- Automatic Mesh generator: https://docs.live2d.com/en/cubism-editor-manual/mesh-edit/
- Edit Mesh manually: https://docs.live2d.com/en/cubism-editor-manual/mesh-edit-manual/
- How to edit keyforms: https://docs.live2d.com/en/cubism-editor-manual/how-to-edit/
- Parameter: https://docs.live2d.com/en/cubism-editor-manual/parameter/
- Parameter palette: https://docs.live2d.com/en/cubism-editor-manual/palametorpalatte/
- Add/Delete Keys: https://docs.live2d.com/en/cubism-editor-manual/edit-parameters/
- Keyforms X/Y: https://docs.live2d.com/en/cubism-editor-manual/keyform-xydirection/
- Standard Parameter List: https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/
- Deformer: https://docs.live2d.com/en/cubism-editor-manual/deformer/
- Warp Deformer: https://docs.live2d.com/en/cubism-editor-manual/making-and-placement-of-warp-deformer/
- Rotation Deformer: https://docs.live2d.com/en/cubism-editor-manual/making-and-rotation-of-rotationdeformer/
- Parent-Child Hierarchy: https://docs.live2d.com/en/cubism-editor-manual/system-of-parent-child-relation/
- Validate Deformer Function: https://docs.live2d.com/en/cubism-editor-manual/convenient-function-deformer/
- Draw Order: https://docs.live2d.com/en/cubism-editor-manual/draworder/
- Draw Order Group: https://docs.live2d.com/en/cubism-editor-manual/drawing-order-group/
- Clipping Mask: https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/
- SDK Model Web: https://docs.live2d.com/en/cubism-sdk-manual/model-web/
- SDK Parameter Operation: https://docs.live2d.com/en/cubism-sdk-manual/parameters/
- SDK MOC3 consistency: https://docs.live2d.com/en/cubism-sdk-manual/moc3-consistency/

Repository basis documents:

- `discussion/_conventions.md`
- `discussion/reports/viewer-preview-reference/_map.md`
- `discussion/design/initial-design-decisions-and-open-questions.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
