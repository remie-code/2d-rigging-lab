# Runtime Evaluation Semantics

> 状態: Draft
> 目的: MVP Runtime の parameter -> keyform -> rig control -> drawable mesh -> opacity / visibility -> mask -> draw order -> snapshot / diagnostics の評価pipeline、snapshot粒度、diagnostics severity、invalid model / missing reference / out-of-range parameter / unsupported feature の扱いを固定する。

## 1. 根拠の分離

### 1.1 リポジトリ事実

- `AC-MVP-008` は、parameter、範囲、keyform、補間、slider操作時の連続的な見た目変化を要求する。
- `AC-MVP-009` は、warp / rotation相当rig control、親子階層、parameter接続、runtime評価不能なrig controlの報告を要求する。
- `AC-MVP-011` は、Editor previewで keyform、rig control、clipping、draw order、part表示状態が制作意図通りに反映されることを要求する。
- `AC-MVP-012` は、Viewerで parameter操作に応じた評価済みdrawable state、vertex、visibility、opacity、draw order、mask状態、diagnosticsを構造化runtime stateとして取得できることを要求する。
- `AC-MVP-015` は、Cubism SDK/Core必須依存なしで一周できることを要求する。

### 1.2 公式・参照事実

- Runtime評価セマンティクス参照レポートは、parameter操作後にmodel updateを行うruntime layer順序を参考にしつつ、Private Prototypeでは独自の評価pipelineを明文化する必要があると整理している。
- RigControl参照レポートは、`rotation2d` と `warpLattice2d`、`bilinear-grid-v1`、`rig controlLocalRest` bind、parent-before-child評価をMVP候補としている。
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
4. Parameter base stateを初期化する。
5. MVP外future layer slotsを無効として記録する。
6. Keyform samplerを評価する。
7. RigControl treeを parent-before-child で評価する。
8. Drawable meshを評価する。
9. Opacity / visibilityを評価する。
10. Clipping / maskを解決する。
11. Draw order と draw listを確定する。
12. Runtime snapshot と diagnosticsを返す。

この順序は、Editor preview、Viewer、Validator runtime load test、AI dry-runで共通に使う。

### 2.2 Parameter

Parameterは入力値と評価値を分ける。

| Field | 意味 |
|---|---|
| `id` | stable ID |
| `displayName` | 人間向け名 |
| `semanticRole` | project-defined preset内の説明・検証用role |
| `min` / `max` / `default` | package定義 |
| `rawInput` | UI / API / dry-run から受け取った値 |
| `value` | clamp / normalization 後に評価へ使う値 |
| `clamped` | raw input が範囲外だったか |
| `sources` | `default`, `viewerOverride`, `editorPreviewOverride`, `operationDryRun` など |

既定方針:

- GUI sliderは範囲外値を作らない。
- file / structured API / AI dry-runの範囲外値は、Preview / Viewerでは clamp して `warning` を出す。
- Validator strict / Acceptance Runnerでは、代表parameter評価に必要な範囲外値を `fail` にできる。
- missing required parameter reference は `blocking` とする。
- 外部入力にだけ存在する未宣言parameterは `warning` 付き no-op とする。

### 2.3 Keyform

Keyformは target property の評価関数である。

MVP baseline:

- `linear-1d-v1`
- target ID
- target kind
- target property
- parameter ID
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

顔 face yaw / pitch の斜め方向はMVP scenarioが要求するため、`linear-1d-v1` の独立合成で足りるか、`bilinear-parameter-grid-v1` をMVPに含めるかを実装前に決める。

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
- `warpLattice2d` のbind spaceは `rig controlLocalRest` をMVP既定とする。
- undefined interpolation、NaN、Infinityは `blocking` または対象単位の `error` とする。
- child vertexが親warp domain外へ出る状態は、評価可能なら `warning` とする。

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
- `keyform_sampling`
- `rig control_evaluation`
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
| child vertex outside warp domain | `warning` | warning or needs_review |
| unknown evaluator version | `blocking` | fail |

## 6. Unsupported Diagnostics

Motion、expression asset、full physics、poseはMVP外に置く。

Packageや入力がこれらを含む場合の扱い:

- MVP runtimeは該当layerを評価しない。
- Snapshotの `disabledFutureLayers` に記録する。
- featureが存在するだけなら `info` または `not_applicable`。
- packageがそのfeatureを必須依存として宣言している場合は `warning` または `error`。
- MVP完了判定では、timeline / motion作成未対応をfailにしない。
- parameter-driven expression、parameter-driven hair sway相当はMVP内のkeyform / rig controlとして扱い、unsupportedにしない。

## 7. 実装前に決めるべき未決事項

- 顔 face yaw / pitch の斜め方向を `linear-1d-v1` 独立合成で扱うか、`bilinear-parameter-grid-v1` をMVPへ入れるか。
- 同じtarget propertyに複数writerがある場合の `compositionMode` 初期セット。
- mask sourceが opacity 0 だが visibility true の場合のseverity。
- missing textureを常に `blocking` とするか、visible drawable単位の `error` として部分表示を許すか。
- CPU evaluatorとRenderer backendの許容誤差 `epsilonPolicy`。

## 8. Post-MVPでよい未決事項

- motion / expression / physics / pose runtime layer。
- Bezier / bicubic / MLS / cage evaluator。
- SDK target specific mask packing。
- advanced draw order group / sorting layer。
- platform-specific renderer conformance。
