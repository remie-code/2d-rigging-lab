# Cubism Viewer / Runtime Observable Features Report

> 調査日: 2026-05-25  
> 対象: Cubism Viewer / Cubism SDK runtime で観測できる runtime package 確認機能  
> 目的: Open Live2D Stack Viewer の設計に使うため、Cubism互換性ではなく package / runtime verification 観点を抽出する。

---

## 1. Scope

このレポートは、Cubism Viewer や Cubism SDK runtime が、埋め込み用データを読み込み、何を確認・操作・診断できるかを整理する。

Open Live2D Stack のMVPは Cubism互換を目的にしないため、ここでのCubism公式資料は「runtime package確認機能の先行例」として扱う。`.cmo3` / `.can3` の復元、Cubism SDK/Core 必須依存、`.moc3`互換出力は Open Stack MVP の成功条件ではない。

---

## 2. Official Facts

### 2.1 Viewerの役割と読み込み対象

Cubism Viewer (for OW) は、Cubismで作成したデータの検証用Viewerとして説明されている。確認対象として、Physics、Eye tracking、複数motion再生、facial expression settings、pose settings が挙げられている。一方、読み込めるモデルとmotionは埋め込み用にexportされたデータであり、編集用の `.cmo3` と `.can3` は読み込めない。

Cubism Viewer は `.moc3` または `.model3.json` をドラッグ&ドロップしてモデルを読み込める。`.model3.json` を読み込むと、motion、expression、physics などの設定ファイルもまとめて読み込める。ただし関連設定ファイルが別ドライブにある場合は読み込めないという注意がある。`.motion3.json` はドラッグで追加でき、motion項目をダブルクリックして再生できる。

Viewer種別は実装環境に合わせて選ぶものとされる。Viewerでmotionをシミュレートすることで、実機に近い環境で動作確認できる、という位置付けである。

出典:

- https://docs.live2d.com/en/cubism-editor-manual/cubism3-viewer-for-ow/
- https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/
- https://docs.live2d.com/en/cubism-editor-manual/selection-of-viewer/

### 2.2 埋め込み用packageの構成

Cubismの埋め込み用データでは、texture `.png`、model runtime data `.moc3`、それらを結び付ける `.model3.json` が基本になる。必要に応じて、physics `.physics3.json`、user data `.userdata3.json`、display information `.cdi3.json`、motion `.motion3.json` などが出力される。

Cubism Viewer (for OW) の基本手順では、modelingから texture / `.moc3` / `.model3.json` をexportし、animationから `.motion3.json` をexportし、Viewerに読み込んだ後に `.pose3.json` や `.exp3.json` を設定し、最終的に Viewer で作った設定を `.model3.json` としてexportできる。Viewerで作成・変更されたファイルは、model settings export時に保存対象になる。

出典:

- https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/
- https://docs.live2d.com/en/cubism-editor-manual/export-model3-json/
- https://docs.live2d.com/en/cubism-editor-manual/cubism3-viewer-for-ow/

### 2.3 Viewer画面で観測できる情報

Cubism Viewer (for OW) は、menu area、resource area、setting item area、model display area を持つ。menuではモデル読み込み、parameter操作、motion再生を行う。resource areaには読み込んだデータとViewerで作成したデータが表示され、setting item areaでは expression setting file や motion file に関する設定を変更・確認し、model settings fileへ保存できる。

MOC3 file information の表示では、MOC3ファイル名を選ぶことで Parameters、Parts、ArtMesh、Offscreen drawing、Draw order、Statistics を確認できる。ArtMesh、offscreen drawing、draw orderでは、polygon数やvertex数などをリスト形式で確認できる。ArtMeshを個別選択すると、対象ArtMeshがView上で青く点滅する。

Viewerには2つのMOC3 data information fileを比較する機能もある。比較対象には、Canvas、Parts、Parameter、ArtMeshが含まれる。ParameterではIDごとの min / default / max が比較され、ArtMeshでは blend mode、culling、texture number、draw order、ArtMesh draw order、mask、vertex count、polygon count などが比較される。

出典:

- https://docs.live2d.com/en/cubism-editor-manual/cubism3-viewer-for-ow/

### 2.4 Parameter操作とruntime update

Cubism SDK の Parameter Operation では、parameter値を set / add / multiply するAPIが説明されている。Webでは `setParameterValueById`、`addParameterValueById`、`multiplyParameterValueById` のようなID指定操作が使われる。

Cubism SDK for Web の model manual では、textureをrendererにbindし、`CubismModelMatrix` と `getCanvasWidth()` / `getCanvasHeight()` を使って表示位置とscaleを調整する。parameter操作をArtMeshの頂点に反映するには `CubismModel.update()` を実行する。

Cubism Core API Reference は、Coreの役割を `.moc3` modelのparameterに応じてvertex情報を計算し、UVやopacityなど描画に必要な情報を返すことだと説明している。Core自体は描画機能を持たない。

出典:

- https://docs.live2d.com/en/cubism-sdk-manual/parameters/
- https://docs.live2d.com/en/cubism-sdk-manual/model-web/
- https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/

### 2.5 Motion確認

Viewerは `.motion3.json` を読み込み、motionを再生できる。Motion Settingsでは、fade-in / fade-out、fade override、group name、playback、motion FPS、target SDK type などを確認・設定できる。`Idle` groupを設定し、Idle Motionを有効化すると自動再生対象にできる。

SDKでは `.motion3.json` を `CubismMotion` として読み込み、motion manager が再生、model parameter更新、終了、user trigger受け取りを担う。motion再生の挙動はSDK targetやSDK versionの影響を受ける場合があり、公式資料は `.motion3.json` の再現性が悪化するケースと対策を説明している。したがって、Viewerでのmotion確認は「motion fileが読めるか」だけでなく、「どのSDK挙動で再生確認したか」も診断情報になる。

出典:

- https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/
- https://docs.live2d.com/en/cubism-editor-manual/motion-setting/
- https://docs.live2d.com/en/cubism-sdk-manual/motion/
- https://docs.live2d.com/en/cubism-sdk-manual/reproducibility-motion3-json/

### 2.6 Expression確認

Expression settingsでは、Animation Viewでexportした facial expression 用 `.motion3.json` を Cubism Viewer に Expression Motionとして読み込み、`.exp3.json` を作成する。Viewer上では、expression選択時にfade値と、expressionに設定されたparameter値を確認できる。必要に応じてparameter値を変更でき、exportしないと設定は保存されない。

SDKの expression motion は `CubismExpressionMotion` として読み込まれ、通常のmotionと同じく `ACubismMotion` 派生として扱える。ただし、expressionは時間変化を持たず、partsには影響できず、parameterへの計算方法として add / multiply / overwrite を指定できる。

出典:

- https://docs.live2d.com/en/cubism-editor-manual/setting-and-exporting-facial-expressions/
- https://docs.live2d.com/en/cubism-sdk-manual/expression/
- https://docs.live2d.com/en/cubism-sdk-manual/blending-expression/

### 2.7 Physics確認

Viewerでは `.physics3.json` をresource areaで選択すると、physics FPS、pendulum group概要、pendulum step数、input parameter IDs、output parameter IDs を確認できる。ただし、pendulum length、influence、inversion、magnificationなど一部詳細は省略される。

SDKでは `.physics3.json` を `CubismPhysics` として読み込み、modelに物理計算を適用する。gravity と wind は physics file内の値から `Options` に反映され、APIで取得・設定できる。Viewerの物理計算結果はFPSに依存し、`.physics3.json` にFPS情報がある場合はその値を使い、ない場合はViewer表示のframe rateを使う。

出典:

- https://docs.live2d.com/en/cubism-editor-manual/check-the-physics/
- https://docs.live2d.com/en/cubism-sdk-manual/physics/

### 2.8 Pose確認

Pose settingsでは、modelとmotion内で作った腕切り替えなどを反映するため、JSON形式のpose setting fileを作成する。pose groupでは、同じgroup番号に属する複数partのうち1つだけを表示する。parent IDを指定すると、親partと同じ切り替え挙動を持たせられる。

SDKのPose機能は `.pose3.json` に基づき、model update processの最後の段階で、virtual parameter値を参照しながらpart groupごとに表示するpartを決定する。

出典:

- https://docs.live2d.com/en/cubism-editor-manual/pose-setting/
- https://docs.live2d.com/en/cubism-sdk-manual/pose/

### 2.9 User data、event、texture確認

Viewerは `.userdata3.json` をresource areaで選択し、ArtMeshに設定されたuser dataをsetting item areaで表示できる。`.motion3.json` 内のevent informationはsetting item area下部に表示され、timeline上の時刻に応じてmodel display area右下にも表示される。

Texture settingsでは、texture fileの場所を開く、texture previewを確認する、color leakage prevention processingを適用する、といった確認・処理ができる。

出典:

- https://docs.live2d.com/en/cubism-editor-manual/userdata-event-information/
- https://docs.live2d.com/en/cubism-editor-manual/texture-setting/

### 2.10 Model integrity / MOC consistency

Cubism SDKには `.moc3` の整合性を確認する仕組みがあり、Webでは `CubismMoc.create(mocBytes, shouldCheckMocConsistency)` の中で `hasMocConsistency` を呼び、整合性が確認できなければ読み込みを中断する例が示されている。SDK sampleではデフォルトで読み込み時の整合性検証が有効だが、設定で無効化できる。

Open Stackは `.moc3` 互換をMVP条件にしないが、runtime package load前に整合性検証を行い、失敗時に診断を返す設計は直接参考になる。

出典:

- https://docs.live2d.com/cubism-sdk-manual/moc3-consistency/

---

## 3. Runtime-Visible State vs Authoring / Editor-Only State

| 種別 | Runtime / Viewerで観測しやすい状態 | Authoring側に残りやすい状態 |
|---|---|---|
| Package graph | entry file、relative asset refs、texture refs、physics / expression / pose / motion refs、存在確認 | 元PSD、source layer構造、制作履歴 |
| Model load | load success/failure、version、integrity、canvas、runtime counts | `.cmo3` project graph、Editor workspace |
| Parameters | ID、display name、min/default/max/current、slider操作、set/add/multiply、repeat/type | keyform authoring grid、どのform編集で作ったか |
| Parts | ID、opacity、parent/link、pose switching結果 | 制作中のlock / select、未export part |
| Drawables / ArtMesh | ID、texture index、opacity、visibility、vertex/index count、current vertices、UV、mask、draw/render order、blend/culling | mesh generator設定、手動編集履歴、deformer object hierarchy |
| Motion | loaded motions、group、fade、FPS、target SDK type、playback state、events | Animation project `.can3`、timeline編集状態 |
| Expression | parameter target values、fade、add/multiply/overwrite | expression authoring process |
| Physics | FPS、groups、input/output parameter IDs、gravity/wind、calculation enabled/disabled | physics tuning workflow全体、Viewerで省略される細部 |
| Pose | part group switching、parent links、computed part opacity | pose設定を作る判断経緯 |
| Diagnostics | missing refs、load errors、integrity failure、runtime update failure、mismatch checks | 「なぜそう作ったか」という制作意図 |

設計上の重要点は、Viewerで見えるものを「runtime observable state」として扱い、authoring stateの復元可能性を暗黙に約束しないことである。

---

## 4. Repository Requirements

### 4.1 MVP ACからの要求

`discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md` は、MVPを「権利的にクリーンな素材から GUI Editor で制作し、Open Model Packageとして保存し、Runtime / Viewerで表示し、ValidatorとAI Agentで検証できること」と定義している。

Viewerに直接関係する主な要求は次である。

- `AC-MVP-011`: Editor preview、保存、再読み込みが成立すること。
- `AC-MVP-012`: Open Runtime / Viewer が Open Model Package を読み込み、parameter一覧、範囲、初期値、現在値を表示し、slider操作で値を変えられること。
- `AC-MVP-012`: parameter操作の結果として、評価済みdrawable state、vertex、visibility、opacity、draw order、mask状態、diagnosticsが変化し、構造化runtime stateとして取得できること。
- `AC-MVP-013`: Validator は package schema、asset reference、mesh、drawable、parameter、deformer、mask、runtime load test、代表parameter評価を検証すること。
- `AC-MVP-014`: AI Agent は model structure inspection、runtime state snapshot、validation report、diff、repair候補を扱えること。
- `AC-MVP-015`: Cubism Editor、Cubism SDK/Core、`.cmo3`復元、`.moc3`互換出力を必須依存にしないこと。

### 4.2 既存設計判断からの要求

`discussion/design/initial-design-decisions-and-open-questions.md` は、EditorとViewerを同一アプリ内機能とし、RuntimeをEditor previewとViewerで共有するかを品質特性から判断するとしている。MVPのValidatorはEditor内警告でも十分だが、解析的に判定可能な不可解状態を検出することが中心である。

したがって、Open Stack Viewer は単なる見た目確認ではなく、Runtime / Validator / AI Agent が同じruntime評価結果を読める検証面を持つ必要がある。

---

## 5. Design Implications for Open Stack Viewer

### 5.1 Viewerの責務

Open Stack Viewer は、Cubism Viewerと同じく「runtime packageを実行環境に近い形で確認する場所」として設計する。ただし、目的はCubism互換性ではなく、Open Model Package のruntime verificationである。

MVPでは次の責務を持たせるのが妥当である。

- Open Model Package のentry manifestを読み込む。
- 必須assetとoptional sidecarの存在、version、参照関係を表示する。
- Runtime load testを実行し、失敗時にもpackage graphと診断を返す。
- Parameter一覧、範囲、初期値、現在値を表示し、slider / numeric inputで操作できる。
- Parameter操作後のruntime state snapshotを取得できる。
- 評価済みdrawable state、mask、draw order、texture usage、computed bounds、diagnosticsを構造化して返す。
- ValidatorとAI Agentが使えるJSON report / snapshotを出力できる。

### 5.2 Package graphとruntime stateを分ける

Cubismの `.model3.json` と sidecar構造からの示唆として、Open Stack Viewerも次を分離した方がよい。

- `packageFacts`: manifest、asset refs、rights / provenance、schema version、file existence。
- `runtimeFacts`: load result、canvas、parameters、parts、drawables、evaluated vertices、opacity、visibility、mask、orders。
- `derivedDiagnostics`: missing refs、orphan refs、range violations、invalid indices、texture mismatch、runtime load failure。
- `unavailableAuthoringData`: runtimeからは復元しないauthoring-only情報。

これにより、runtimeが読み込めないpackageでも「どこまで読めたか」をValidator / AI Agentへ渡せる。

### 5.3 Viewer UIはruntime stateを説明できる必要がある

Cubism ViewerのMOC3 information listやdiff機能は、Viewerが目視確認だけでなく、parameters / parts / ArtMesh / draw order / statistics をinspection対象にしていることを示している。Open Stack Viewerでも、model displayだけでなく、少なくとも次のinspection paneが必要である。

- Load diagnostics pane。
- Package asset graph pane。
- Parameter pane。
- Drawable / texture / mask pane。
- Runtime snapshot / JSON export pane。

motion / expression / physics / poseの詳細paneは、Open Stack MVPではoptionalまたはMVP外に置ける。ただし、package graph上にそれらの有無と未対応理由を出す診断は有用である。

---

## 6. MVP Candidates

### 6.1 MVPに入れるべきViewer機能

| Candidate | 理由 |
|---|---|
| Package load diagnostics | MVPはOpen Model Package保存・再読み込み・Runtime表示を必須にしているため、entry file、schema、asset ref、存在確認、load phase別エラーが必要。 |
| Non-empty runtime render | Viewerが実際に非空モデルを表示できることは `AC-MVP-012` の中心条件。 |
| Parameter list and operation | Cubism Viewer / SDKでも基本確認対象であり、Open Stack MVPのkeyform / deformer / interpolation確認に必須。 |
| Runtime state snapshot | ValidatorとAI Agentが同じ評価結果を扱うため、parameter values、drawable state、visibility、opacity、draw order、mask、diagnosticsを構造化する必要がある。 |
| Drawable / texture / mask inspection | `AC-MVP-004` から `AC-MVP-007` までの確認に直結する。 |
| Runtime load test as Validator input | Validatorがpackage構造だけでなく、代表parameter評価を確認するために必要。 |
| Source-attributed diagnostics | package由来、runtime由来、computed、unavailableを分けることでAI Agentが誤修復しにくくなる。 |
| Authoring-only unavailable list | Cubism runtime調査でdeformer hierarchyやkeyform authoring gridがruntimeから復元困難であるため、Open Stackでも可視状態と制作状態を分ける必要がある。 |

### 6.2 MVPでの最小UI案

MVP Viewerは次の画面要素を持てば、Cubism Viewerの本質的なruntime確認能力に対応できる。

- model canvas。
- package / load diagnostics sidebar。
- parameter controls。
- selected drawable inspector。
- snapshot export / copy panel。
- Validator result panelへの接続点。

motion timeline、expression manager、physics editor、pose editorはこの段階では必須にしない。

---

## 7. MVP-Out Candidates

次はCubism Viewerでは重要だが、Open Stack MVPでは後回しにできる。

| Candidate | MVP外に置く理由 |
|---|---|
| `.motion3.json`相当のmotion playback / idle motion group | 現MVP ACは基本チュートリアル6相当のanimation / timeline / motion作成をMVP外としている。 |
| Expression asset authoring / `.exp3.json`相当 | MVP外項目に expression asset の完全制作が明示されている。parameter駆動表情そのものはMVP内だが、expression file systemは後続でよい。 |
| Full physics simulation editor | MVPでは髪揺れはparameter駆動または簡易deformerでよく、full physicsは必須でない。 |
| Pose switching editor | 腕や衣装切り替えは有用だが、MVPミニモデルの必須一周には含めなくてよい。 |
| User data / event inspector | motionやSDK event連携が強く、MVPの中心ではない。 |
| Motion curve image / waveform comparison | Cubism motion再現性確認には有用だが、Open Stack MVPのruntime package確認には過剰。 |
| Two-package runtime diff UI | Validator / AI diffの基盤は必要だが、Viewer内GUIとしての比較機能はpost-MVPでよい。 |
| Texture color leakage processing | Cubism embedded workflow特有のtexture処理であり、Open Stack MVPではtexture参照・表示・検証を優先する。 |
| Motion-sync / audio / voice playback | MVP外。 |
| SDK target compatibility toggles | Open StackはCubism SDK target互換を目的にしないため、同等概念が必要になるまでは不要。 |

---

## 8. Diagnostics to Expose for Validator and AI Agent

Open Stack Viewerは、少なくとも次の構造化diagnosticsを出すべきである。

### 8.1 Package diagnostics

- `package.schema.invalid`
- `package.version.unsupported`
- `asset.reference.missing`
- `asset.reference.unused`
- `asset.texture.missing`
- `asset.texture.unused`
- `rights.provenance.missing`
- `manifest.optionalSidecar.unsupported`

### 8.2 Runtime load diagnostics

- `runtime.load.failed`
- `runtime.load.emptyModel`
- `runtime.canvas.invalid`
- `runtime.parameter.rangeInvalid`
- `runtime.parameter.defaultOutOfRange`
- `runtime.drawable.textureIndexInvalid`
- `runtime.drawable.indexBufferInvalid`
- `runtime.drawable.vertexBufferInvalid`
- `runtime.mask.referenceMissing`
- `runtime.mask.cycleOrUnsupported`
- `runtime.drawOrder.invalid`
- `runtime.update.failed`

### 8.3 Snapshot fields

Minimum snapshot:

- `packageId`
- `packageVersion`
- `runtimeVersion`
- `loadStatus`
- `diagnostics[]`
- `canvas`
- `parameters[]`: id, name, min, max, default, current。
- `parts[]`: id, opacity, visibility or effective visibility。
- `drawables[]`: id, textureId, vertexCount, triangleCount, opacity, visibility, drawOrder, renderOrder, masks, computedBounds。
- `evaluationInput`: parameter overrides used for the snapshot。
- `sourceLabels`: `package`, `runtime`, `computed`, `unavailable`。

Optional detail mode:

- full vertex arrays。
- full UV arrays。
- triangle indices。
- dynamic flags。
- per-drawable before/after diff。
- rendered image hash or thumbnail reference。

### 8.4 AI Agent向けの注意

AI Agentには、runtime-visible stateとauthoring stateを明示的に分けて渡す必要がある。例えば、runtime verticesが変化したことは観測できても、それがどのkeyform編集・deformer階層・制作操作から来たかは別情報である。AI修復候補は、runtime symptom、source package node、可能な編集operation、未確認のauthoring intentを分けて提示するべきである。

---

## 9. Open Questions

- Open Stack MVP Viewerで、full vertex arraysを常時snapshotに含めるか、counts / bounds中心にしてdetail modeへ送るか。
- Runtime snapshotの代表parameter setを、Validator profileで固定するか、モデル側metadataで指定できるようにするか。
- Editor previewとViewerが完全に同じRuntime評価APIを共有するか、Viewerだけdiagnostic用の追加instrumentationを持つか。
- MVPで髪揺れ相当をparameter-drivenに限定する場合、Viewer diagnostics上はphysics sidecarをどのseverityで「未対応 / MVP外」と表示するか。
- Cubism標準parameter名をOpen Stackの推奨aliasとして採用する範囲をどこまでにするか。
- Viewer内のtwo-package diffをpost-MVPに送るとして、Validator / AI Agentのdiff schemaだけはMVPに先行して定義するか。
- Package graphのoptional sidecar構造を、Cubismの `.model3.json` 的な単一manifest+sidecarsに寄せるか、Open Stack独自の分割責務を優先するか。
- Authoring-only stateのうち、Open Stack package内でruntimeにも持たせるべき最小情報は何か。特にdeformer hierarchyとkeyformはOpen StackではMVP内制作対象であり、Cubism runtimeと違ってViewerから観測できるように設計できる可能性がある。

---

## 10. Sources

Official Live2D sources:

- Selection of Cubism Viewer: https://docs.live2d.com/en/cubism-editor-manual/selection-of-viewer/
- About Cubism Viewer (for OW): https://docs.live2d.com/en/cubism-editor-manual/cubism3-viewer-for-ow/
- Loading Models and Motion: https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/
- Motion Settings: https://docs.live2d.com/en/cubism-editor-manual/motion-setting/
- Pose Settings: https://docs.live2d.com/en/cubism-editor-manual/pose-setting/
- Expression Settings and Export: https://docs.live2d.com/en/cubism-editor-manual/setting-and-exporting-facial-expressions/
- Exporting Model Setting Files: https://docs.live2d.com/en/cubism-editor-manual/export-model3-json/
- Check Physics Information: https://docs.live2d.com/en/cubism-editor-manual/check-the-physics/
- Check User Data and Event Information: https://docs.live2d.com/en/cubism-editor-manual/userdata-event-information/
- Texture settings: https://docs.live2d.com/en/cubism-editor-manual/texture-setting/
- Data for Embedded Use: https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/
- About Models (Web): https://docs.live2d.com/en/cubism-sdk-manual/model-web/
- Parameter Operation: https://docs.live2d.com/en/cubism-sdk-manual/parameters/
- About Motion: https://docs.live2d.com/en/cubism-sdk-manual/motion/
- About Expression Motion: https://docs.live2d.com/en/cubism-sdk-manual/expression/
- Physics: https://docs.live2d.com/en/cubism-sdk-manual/physics/
- About Pose: https://docs.live2d.com/en/cubism-sdk-manual/pose/
- Cubism Core API Reference: https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/
- Verify model integrity: https://docs.live2d.com/cubism-sdk-manual/moc3-consistency/
- Reproducibility of `.motion3.json`: https://docs.live2d.com/en/cubism-sdk-manual/reproducibility-motion3-json/
- Expression transition processing: https://docs.live2d.com/en/cubism-sdk-manual/blending-expression/

Repository basis documents:

- `discussion/_conventions.md`
- `discussion/reports/viewer-preview-reference/_map.md`
- `discussion/design/initial-design-decisions-and-open-questions.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/reports/cubism-sdk-runtime-structure/_map.md`
- `discussion/reports/cubism-sdk-runtime-structure/official-sdk-runtime-api-report.md`
- `discussion/reports/cubism-sdk-runtime-structure/web-framework-runtime-observation-report.md`
- `discussion/reports/cubism-sdk-runtime-structure/structured-output-field-map.md`
- `discussion/reports/cubism-sdk-runtime-structure/runtime-structure-summary.md`
