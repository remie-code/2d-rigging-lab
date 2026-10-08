# Runtime Evaluation Semantics

> 状態: Draft
> 目的: MVP Runtime の parameter -> keyform -> rig control -> drawable mesh -> opacity / visibility -> mask -> draw order -> snapshot / diagnostics の評価pipeline、snapshot粒度、diagnostics severity、invalid model / missing reference / out-of-range parameter / unsupported feature の扱いを固定する。

## 1. 根拠の分離

### 1.1 リポジトリ事実

- `AC-MVP-008` は、parameter、範囲、keyform、補間、slider操作時の連続的な見た目変化を要求する。
- `AC-MVP-009` は、warp / rotation相当rig control、親子階層、parameter接続、runtime評価不能なrig controlの報告を要求する。
- `AC-MVP-011` は、Editor previewで keyform、rig control、clipping、draw order、part表示状態が制作意図通りに反映されることを要求する。
- `AC-MVP-012` は、Viewerで parameter操作に応じたauthored/computed/effective parameter、dynamics state、評価済みdrawable state、vertex、visibility、opacity、draw order、mask状態、diagnosticsを構造化runtime stateとして取得できることを要求する。
- `AC-PHYS-001` から `AC-PHYS-006` は、Minimum Open Dynamics v1のgroup、computed output parameter、fixed timestep、deterministic snapshot、demo-safe表示を要求する。
- `AC-MVP-015` は、Demo-safe capture の分離を要求する。
- `AC-MVP-016` は、Cubism形式、Cubism SDK/Core、既存Cubismモデルを使わずに Authoring-to-Viewer の一周が成立することを要求する。

### 1.2 公式・参照事実

- Runtime評価セマンティクス参照レポートは、parameter操作後にmodel updateを行うruntime layer順序を参考にしつつ、Private Prototypeでは独自の評価pipelineを明文化する必要があると整理している。
- RigControl参照レポートは、`rotation2d` と `warpLattice2d`、`bilinear-grid-v1`、`rigControlLocalRest` bind、parent-before-child評価をMVP候補としている。
- Viewer / Preview参照レポートは、Editor preview と Viewer が同じ Shared Runtime evaluation core と snapshot schema を共有することを推奨している。

### 1.3 設計仮定

- MVP Runtime は Cubism Core の再現を目標にしない。
- MVP Runtime は deterministic evaluation を優先する。
- RendererはRuntime snapshotを入力にして描画する。

## 2. 設計判断

### 2.1 MVP ordered evaluation pipeline

MVP Runtime の評価順序を次で固定する。

1. Package / dirty authoring graph inputを受け取る。
2. Schema、manifest、asset reference、rights / provenance の load diagnosticsを作る。
3. Runtime graphを正規化し、ID table、rig control tree、mask relation、draw order stable orderを解決する。
4. Authored parameter stateを初期化し、入力overrideを適用する。
5. Authored parameter値をparameter範囲へclampする。
6. Minimum Open Dynamics v1をauthored parameter値、前回dynamics state、fixed timestepで評価する。
7. Computed output parameter値を生成し、範囲へclampする。
8. Authored + computed parameterをeffective parameter stateへmergeする。
9. MVP外future layer slotsを無効として記録する。
10. Keyform samplerを評価する。
11. RigControl treeを parent-before-child で評価する。
12. Drawable meshを評価する。
13. Opacity / visibilityを評価する。
14. Clipping / maskを解決する。
15. Draw order と draw listを確定する。
16. Runtime snapshot と diagnosticsを返す。

この順序は、Editor preview、Viewer、Validator runtime load test、AI dry-runで共通に使う。

### 2.2 Parameter

Parameterは、値の決定者と評価値を分ける。

| Field | 意味 |
|---|---|
| `id` | stable ID |
| `displayName` | 人間向け名 |
| `semanticRole` | project-defined preset内の説明・検証用role |
| `projectPresetAlias` | private project/editor preset label。外部互換parameter IDではない |
| `valueSource` | `authoredInput`, `computedDynamics`, `debugOverride` |
| `min` / `max` / `default` | package定義 |
| `authoredParameterValues` | UI / API / dry-run から受け取った直接入力値 |
| `computedParameterValues` | Dynamicsが生成した値 |
| `effectiveParameterValues` | clamp / merge 後に評価へ使う値 |
| `clamped` | raw input が範囲外だったか |
| `sources` | `default`, `viewerOverride`, `editorPreviewOverride`, `operationDryRun` など |

既定方針:

- GUI sliderは範囲外値を作らない。
- file / structured API / AI dry-runの範囲外値は、Preview / Viewerでは clamp して `warning` を出す。
- Validator strict / Acceptance Runnerでは、代表parameter評価に必要な範囲外値を `fail` にできる。
- missing required parameter reference は `blocking` とする。
- 外部入力にだけ存在する未宣言parameterは `warning` 付き no-op とする。

### 2.2.1 Minimum Open Dynamics v1

Minimum Open Dynamics v1 は、driver parameterからcomputed output parameterを生成するparameter-driven deterministic secondary motionである。

MVP範囲:

- solverKindは`scalarDampedFollowV1`のみ。
- Driverは`valueSource="authoredInput"` parameterだけを参照できる。
- Outputは`valueSource="computedDynamics"` parameterだけへ書き込める。
- 1 dynamics groupは、MVPではちょうど1つのcomputedDynamics output parameterだけを生成する。
- 同じcomputed output parameterを複数groupが出力対象にすることは禁止する。
- 複数driverはweighted sumで決定的に合成する。
- Output parameterを同じgroupまたは他groupのdriverに使うことは禁止する。
- Dynamics group間依存は禁止する。
- Dynamicsはmesh / rig control / drawable / mask / renderer stateを読まない。
- Dynamicsはmesh vertex、rig control property、drawable visibility / opacity / draw order、mask stateを直接書き換えない。

Timestepとreset:

- Dynamicsはfixed timestepで評価する。raw variable deltaTimeをsolverへ直接入れない。
- 既定値は`fixedStepMs = 16.6666667`、`maxSubSteps = 4`。
- Runtime coreはhidden mutable stateを持たず、initial `RuntimeStateDto`を生成し、previous `RuntimeStateDto`を入力し、`RuntimeSnapshotDto`とnext `RuntimeStateDto`を返す。
- `RuntimeStateDto`は`schemaVersion`、`packageId`、`packageRevision`、任意の`packageHash`、`frameIndex`、`fixedStepMs`、`accumulatorMs`、groupごとの`position`、`velocity`、`tick`、`resetCounter`を持つ。
- Initial group stateは現在のdriver値から計算したcurrent targetへ`position`を合わせ、`velocity=0`、`tick=0`、`resetCounter=1`で始める。
- Resetはpackage load、user reset command、preview restart、large input jump、validation representative run start、demo capture startで発生できる。
- 同じpackage、initial dynamics state、authored input sequence、fixedStepMsならEditor previewとViewerは同じoutput sequenceを返す。

### 2.3 Keyform

Keyformは target property の評価関数である。

MVP baseline:

- `linear-1d-v1`
- `parameter-grid-2d-v1`
- target ID
- target kind
- target property
- parameter ID / parameter IDs
- key values
- key states
- interpolation evaluator version

Target property例:

- mesh vertex absolute state
- mesh vertex delta
- rig control local state
- opacity
- runtime visibility
- draw order

同じ target property に複数writerがある場合は、明示的な `compositionMode` と `compositionOrder` がない限り diagnostic にする。

`parameter-grid-2d-v1` は、project-defined scalar parameter space 上で、作者が手動で作成した2軸keyform gridを補間するための evaluator である。これは view direction model、angle-based multi-view synthesis、automatic diagonal generation、Cubism face-turn behavior の再現ではない。

### 2.4 RigControl

MVP Runtime は次のrig control nodeを評価する。

| Node | 評価 |
|---|---|
| `rotation2d` | pivot、angle、optional translation / scale から local affine matrixを作り、子へ伝播する |
| `warpLattice2d` | rest domain、lattice rows / columns、rest control points、keyform control point positions、`bilinear-grid-v1` で変形する |

方針:

- parent-before-childでtopological sortする。
- cycleは `blocking`。
- missing parent / child は `blocking`。
- `warpLattice2d` のbind spaceは `rigControlLocalRest` をMVP既定とする。
- nested warp の所属判定は、変形済みcurrent座標ではなく、stableなrest / bind座標で行う。
- nested warp の変形適用先は、子rig controlで既に変形されたcurrent座標とする。
- undefined interpolation、NaN、Infinityは `blocking` または対象単位の `error` とする。

#### 2.4.1 Nested warp membership

親子関係を持つ `warpLattice2d` では、「その頂点が親warpの対象か」と「親warpの変形をどの座標へ適用するか」を分ける。

設計判断:

- 対象判定とlattice sampling weightは、親warp作成時または評価時に決まるstableなrest / bind座標から求める。
- 子warp / 子rotation / mesh keyformなどによって頂点のcurrent座標が親warpのvisual domain外へ出ても、それだけを理由に親warpの対象外にしない。
- 親warpが生成した変形量は、子の変形結果であるcurrent座標へ重ねて適用する。
- rest / bind座標の時点で親warp対象外だった頂点は、親warpの対象外としてよい。
- domain boundsはruntime時の動的な切り捨て領域ではなく、rest / bind座標をlatticeへ対応付ける基準領域として扱う。

評価イメージ:

```text
rest / bind vertex
  -> child rig controls produce current vertex
  -> parent warp samples lattice by rest / bind coordinate
  -> parent warp applies its displacement to current vertex
  -> final vertex
```

この方針により、FaceX のような子warpで目の頂点が大きく横へ動いた後でも、FaceY のような親warpはその頂点へ継続して作用する。現在座標でinside/outsideを判定して突然pass-throughする挙動は、nested warpの既定セマンティクスとしては採用しない。

実装上の注意:

- Editor preview と Viewer / Runtime Export は同じmembership semanticsを使う。
- persisted per-vertex bindingを持つか、評価時にdeterministicに導出するかは実装時に決める。
- mesh再生成、domain bounds変更、child rig hierarchy変更時には、bindingの再導出またはstale診断が必要になる可能性がある。
- 単純なdomain拡張 / refitは作成時UXの補助として有効だが、このnested warp問題の本質的な解決とはみなさない。

### 2.5 Drawable Mesh

Drawable mesh評価は、rest meshからfinal vertexを作る。

- rest meshは `vertices`, `uvs`, `triangles`, `textureId`, `partId` を持つ。
- Runtimeはrest vertexへrig control chainを適用する。
- UVはMVPでは変形しない。
- triangle index範囲外、退化triangle、NaN vertex、missing textureはdiagnosticsにする。
- Snapshotは既定で vertex count、bounds、hash、sampleを返し、必要時にfull vertex arrayを返す。

### 2.6 Opacity / Visibility

Opacity と visibility は分ける。

- `opacity` は `0.0` から `1.0` の連続値。範囲外はclampとdiagnostic。
- `runtimeVisibility` は描画対象かどうかのboolean。
- `editorHidden`, `locked`, `selected`, `activeTool` はShared Runtime coreへ入れない。
- opacity `0` はvisibility `false` と同義にしない。mask sourceとして意味を持つ場合がある。

### 2.7 Mask

MVP clipping / maskは、mask relationをdeterministicに解決できることを重視する。

- targetは `maskDrawableIds` をstable ID listとして持つ。
- mask source drawableも通常のruntime evaluationを受ける。
- mask groupは同じmask ID setを共有するtargetをまとめてよい。
- SDK target固有のmask packingはMVP外。

Invalid handling:

| 状態 | 既定severity | 扱い |
|---|---|---|
| mask source missing | `blocking` or `error` | target drawableのmask解決不能。MVP reviewではfail候補 |
| mask source visibility false | `error` | Viewerは部分表示可。MVP reviewではfail候補 |
| mask source opacity 0 | `warning` or `error` | 実装前にprofile規則を確定する |
| mask zero-area | `error` | target mask無効 |
| mask relation cycle-like invalid reference | `blocking` | graph normalization fail |

### 2.8 Draw Order

- `drawOrder` はruntime-visible numeric fieldとする。
- 低い値を奥、高い値を手前とする。
- renderer draw listは昇順に並べる。
- tieはpackage stable order、さらに必要ならstable ID lexical orderで決める。
- evaluated drawOrderとbase drawOrderをsnapshotで分ける。
- visibility false のdrawableは描画しないが、diagnosticsとinspection用にsnapshotへ残せる。

## 3. Snapshot 粒度

Snapshotは常にfull vertexを返さない。MVPでは3段階にする。

| Detail | 用途 | 内容 |
|---|---|---|
| `summary` | Viewer通常表示、Editor preview通常表示 | parameter state、drawable bounds/hash/sample、draw list、diagnostics summary |
| `targeted` | 選択対象、AI dry-run、diagnostics jump | summary + target IDsのfull detail、keyform sample、rig control local state |
| `full` | Validator strict、runtime diff、acceptance evidence | 全drawable vertex、rig control evaluated state、mask details、full diagnostics、trace |

Snapshot必須フィールド:

- `schemaVersion`
- `runtimeCoreVersion`
- `snapshotId`
- `source.surface`
- `packageId`
- `packageRevision`
- `packageHash`
- `authoringRevision`
- `dirty`
- `evaluation.profile`
- `evaluation.snapshotDetail`
- `evaluation.evaluatorVersions`
- `parameters`
- `dynamics`
- `keyformSamples`
- `rig controls`
- `drawables`
- `masks`
- `drawList`
- `diagnostics`
- optional `trace`

## 4. Diagnostics Severity

MVP diagnostics は、人間向け warning と AI-readable report で同じseverityを使う。

| Severity | 意味 | MVP扱い |
|---|---|---|
| `info` | 評価継続に影響しない観測情報 | Pass |
| `warning` | 評価は継続できるが、意図違い、品質低下、strict profile failの可能性がある | Preview / Viewer表示。Strictではfail候補 |
| `error` | 対象要素は壊れているが、fallbackまたは対象除外でsnapshot生成は可能 | 部分表示可。MVP reviewではfail候補 |
| `blocking` | deterministic evaluationまたはpackage loadが成立しない | 該当評価をfail |

Check statusはseverityと分ける。

- `pass`
- `warning`
- `fail`
- `needs_review`
- `not_applicable`

Phase:

- `package_load`
- `graph_normalization`
- `parameter_resolution`
- `dynamics_evaluation`
- `keyform_sampling`
- `rigControl_evaluation`
- `mesh_evaluation`
- `opacity_visibility`
- `mask_resolution`
- `draw_order_resolution`
- `render_preparation`
- `validation`
- `ai_dry_run`

## 5. Invalid State Handling

| 状態 | Preview / Viewer | Validator strict / Acceptance Runner |
|---|---|---|
| schema不正 | `blocking` | fail |
| 必須asset欠落 | `blocking` | fail |
| optional thumbnail欠落 | `warning` | warning |
| duplicate stable ID | `blocking` | fail |
| missing drawable reference | `blocking` | fail |
| missing texture for visible drawable | `error` or `blocking` | fail |
| mesh triangle index out of range | `blocking` for drawable | fail |
| degenerate triangle | `error` or `warning` | fail or needs_review by profile |
| rig control cycle | `blocking` | fail |
| missing parameter referenced by keyform | `blocking` | fail |
| out-of-range parameter raw input | clamp + `warning` | fail for strict representative evaluation |
| empty rig control | `warning` | warning or needs_review |
| current vertex outside warp visual domain after child deformation | `info` or no diagnostic | rest / bind membershipで評価できる限り正常 |
| rest / bind vertex outside expected warp domain | `warning` | authoring bounds / binding確認対象 |
| unknown evaluator version | `blocking` | fail |

## 6. Unsupported Diagnostics

Motion、expression asset、full physics、pose、direct vertex physics、direct rigControl physics output、cloth simulation、collision、IK、timeline bakeはMVP外に置く。

Packageや入力がこれらを含む場合の扱い:

- MVP runtimeは該当layerを評価しない。
- Snapshotの `disabledFutureLayers` に記録する。
- featureが存在するだけなら `info` または `not_applicable`。
- packageがそのfeatureを必須依存として宣言している場合は `warning` または `error`。
- MVP完了判定では、timeline / motion作成未対応をfailにしない。
- parameter-driven expression、parameter-driven hair/cloth/accessory swayはMVP内のkeyform / rig control / Minimum Open Dynamics v1として扱い、unsupportedにしない。
- Cubism Physics互換、`.physics3.json`、Cubism Viewer一致、Cubism Editor Physics UI再現はunsupported / out-of-scopeとして扱う。

## 7. 実装前に決めるべき未決事項

- `parameter-grid-2d-v1` のGUI編集最小UIとfixture期待値。
- Dynamics panelのpreview/reset/simple graphの最小UIと`minimal-dynamics-hairSway` fixture期待値。
- 同じtarget propertyに複数writerがある場合の `compositionMode` 初期セット。
- mask sourceが opacity 0 だが visibility true の場合のseverity。
- missing textureを常に `blocking` とするか、visible drawable単位の `error` として部分表示を許すか。
- CPU evaluatorとRenderer backendの許容誤差 `epsilonPolicy`。

## 8. Post-MVPでよい未決事項

- motion / expression / full physics / pose runtime layer。
- direct vertex physics / direct rigControl physics output / cloth simulation / collision / IK / timeline bake。
- Bezier / bicubic / MLS / cage evaluator。
- SDK target specific mask packing。
- advanced draw order group / sorting layer。
- platform-specific renderer conformance。
