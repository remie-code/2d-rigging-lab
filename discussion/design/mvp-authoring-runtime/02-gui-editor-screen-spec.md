# GUI Editor Screen Specification

> 状態: Draft
> 目的: GUI Editor MVP の画面領域、主要パネル、canvas、properties、parameter / keyform / rig control / mesh / texture / mask / draw order / diagnostics のUI責務、初心者導線、Editor-only state と runtime-visible state の分離、画面仕様の設計完了条件を固定する。

## 1. 根拠の分離

### 1.1 リポジトリ事実

- `AC-MVP-001` は、GUI Editorで素材読み込み、part / drawable選択、lock / hide / select、draw order、mesh編集、parameter / keyform / rig control編集、preview、保存、再読み込みを行えることを要求する。
- `AC-MVP-003` は、レイヤー構造付き素材または分割画像セットの受け入れ、配置、表示状態、グループ構造、ガイド画像、受け入れ時警告の観測を要求する。
- `AC-MVP-004` から `AC-MVP-010` は、drawable / texture / part、mesh、part管理、mask、parameter、keyform、rig control、基本制作能力の可動制作を要求する。
- `SC-MVP-001` は、`Head`, `Eye_L`, `Eye_R`, `Brow_L`, `Brow_R`, `Mouth`, `Hair_Front`, `Hair_Side`, `Body`, `Arm_L` を含む権利クリーン素材から制作を開始する。
- `SC-MVP-002` は、まばたき、眉、口、face roll、体、腕、髪、顔face yaw / pitchをGUI上でparameter / keyform / rig controlへ接続する。

### 1.2 過去調査資料の扱い

- Cubism Editor参照レポートは過去調査資料であり、画面配置、パレット構成、メニュー、用語の実装根拠にはしない。
- Viewer / Preview参照レポートは、selection、lock、hide、overlay、dirty operationなどを Editor-only state とし、runtime-visible state と分けることを推奨している。

### 1.3 設計仮定

- MVP GUI はWeb-firstの単一アプリ内に Editor mode、Preview surface、Viewer mode、Validation / AI report surfaceを持つ。
- Cubism Editorの画面配置やメニュー構成の模倣は目的ではない。
- MVPは初心者が基本制作能力を順に進められることを優先する。

## 2. 画面全体構成

MVP Editor は、次の領域を持つ。

| 領域 | 役割 | MVP必須 |
|---|---|---|
| App bar | package名、保存状態、mode切替、validation状態、主要command | 必須 |
| Left project panel | assets、parts、drawables、rig controls、masksのtree表示 | 必須 |
| Center canvas | 素材配置、mesh編集、rig control編集、preview、overlay表示 | 必須 |
| Canvas tool strip | select、pan、mesh、rig control、mask、draw order、preview操作 | 必須 |
| Right properties inspector | 選択対象のID、名前、参照、数値、rights/provenance、runtime-visible properties編集 | 必須 |
| Bottom parameter / keyform panel | parameter slider、keyform追加、key value、target property、preview controls | 必須 |
| Dynamics panel | Minimum Open Dynamics v1のgroup、driver/output、settings、preview/reset/simple graph | 必須 |
| Diagnostics drawer | Editor warning、Validator subset、target jump、repair candidate入口 | 必須 |
| Viewer / Runtime tab | 保存済みpackage load、parameter slider、runtime snapshot、diagnostics | 必須 |
| AI / Report tab | validation report、dry-run diff、repair candidate、provenance、revalidation | MVPでは最小必須 |

## 3. 主要パネル仕様

### 3.1 Import / Asset Panel

目的: 権利クリーン素材を受け入れ、保持できた情報、失われた情報、手動確認が必要な情報を表示する。

表示・操作:

- source asset list
- layer / split image preview
- placement and canvas bounds
- group / guide image mapping
- source provenance
- rights status
- import warnings
- convert to drawable / texture / part

MVPで避けること:

- 権利未確認素材を黙って cleared と扱う。
- 変換不能属性を成功扱いで捨てる。

### 3.2 Project / Parts / Drawable Tree

目的: part、drawable、rig control、mask relationをstable ID付きで操作する。

表示・操作:

- part作成、rename、並べ替え
- drawable所属変更
- lock / unlock
- editor hide / show
- select / multi-select
- stable ID copy
- runtime visibilityの表示。ただしeditor hideとは別操作にする
- rig control hierarchy表示
- mask relation表示
- target jump to canvas

Tree上の lock / editor hide / selected はEditor-only stateである。runtime-visible stateは別の明示操作にする。

### 3.3 Canvas

目的: 制作対象を直接編集し、preview結果を見ながら破綻を確認する。

Canvas mode:

- Select mode
- Mesh edit mode
- Rotation rig control mode
- Warp lattice rig control mode
- Mask relation mode
- Draw order preview mode
- Runtime preview mode

Overlay:

- selected target outline
- mesh vertices / triangles
- UV / texture bounds hint
- rig control bounds / pivot / lattice control points
- mask source / target highlight
- draw order labels
- diagnostics badges
- editor-only hide / lock indication

Canvasは、runtime snapshotの結果とEditor-only overlayを重ねて表示する。overlayはruntime stateへ混ぜない。

### 3.4 Properties Inspector

目的: 選択対象の詳細を構造化して編集する。

対象別の表示:

| 対象 | 表示・編集するもの |
|---|---|
| Source asset | path、hash、license、creator、AI use、redistribution、import warnings |
| Part | displayName、stable ID、runtime visibility方針、child drawables |
| Drawable | stable ID、texture、mesh、part、opacity、runtime visibility、base draw order、source provenance |
| Mesh | vertex count、triangle count、bounds、UV、validation summary、regenerate / edit entry |
| Parameter | stable ID、displayName、semanticRole、private `projectPresetAlias`、min / max / default / current、UI step |
| Keyform | target property、parameterId、key value、interpolation、composition mode |
| Dynamics group | stable ID、driver parameter、computed output parameter、stiffness、damping、max velocity、max amplitude、output limit、reset policy、enabled |
| Rotation rig control | pivot、angle、restAngle、translation、scale、children、parameter connection |
| Warp rig control | domain bounds、rows / columns、control points、interpolationMethod、children |
| Mask relation | mask drawables、target drawables、status、diagnostics |
| Package | formatVersion、packageRevision、rights summary、provenance summary |

### 3.5 Parameter / Keyform Panel

目的: 基本制作能力の可動を作る主作業面にする。

MVP操作:

- project-defined parameter preset作成: `eyeOpen`, `browForm`, `mouthOpen`, `faceRoll`, `bodyAngle`, `armLeft`, `hairSway`, `faceYaw`, `facePitch`
- min / max / default設定
- sliderでcurrent value操作
- keyform追加
- selected targetへkeyformを紐づけ
- interpolation preview
- keyform missing / out-of-range warning
- target property別のwriter表示

### 3.5.1 Dynamics Panel

目的: Minimum Open Dynamics v1として、髪・服・小物のsecondary motionをparameter-drivenに設定する。

MVP操作:

- dynamics group一覧
- group enable / disable
- driver parameter selector。`authoredInput` parameterだけを選べる
- output parameter selector。`computedDynamics` parameterだけを選べる
- stiffness / damping / max velocity / max amplitude / output limit
- reset policy
- preview start / stop / reset
- simple output graph
- current driver / output values
- validator warnings

MVPで避けること:

- Cubism Physics UI の再現。
- Cubism Physics、physics3、Live2D physics、pendulum、Cubism Physics group などの用語。
- mesh vertexやrig control propertyをDynamicsが直接変更するUI。

初心者向けには、parameter体系を一から作らせず、project-defined parameter presetを提供する。stable IDはproject-defined package内のIDを正とする。

### 3.6 Mesh Panel

目的: drawable mesh の生成、編集、検証を行う。

MVP操作:

- mesh auto generate またはmanual create
- vertex select / move
- triangle edit
- UV / texture bounds inspection
- degenerate triangle warning
- out-of-range index warning
- save keyform state when editing under parameter value

### 3.7 RigControl Panel

目的: warp / rotation rig controlをGUI上で作る。

MVP操作:

- create `rotation2d`
- create `warpLattice2d`
- bind selected drawable / child rig control
- move pivot
- set rotation handle
- edit warp domain
- set lattice rows / columns
- move control points
- connect to parameter / keyform
- show parent-before-child hierarchy
- show empty rig control / cycle / missing target / overhang warning

### 3.8 Texture / Mask / Draw Order Panels

Texture:

- texture atlas status
- drawable texture reference
- missing texture diagnostics
- source asset relationship

Mask:

- choose mask source drawables
- choose target drawables
- preview mask bounds
- show missing / hidden / zero-area mask diagnostics

Draw order:

- numeric draw order edit
- list reorder
- canvas preview
- tie-break stable order display
- keyform-driven draw order warning when used

### 3.9 Diagnostics Panel

目的: Editor内警告、Validator subset、runtime diagnostics、AI repair candidateを同じ語彙で表示する。

表示項目:

- check ID
- severity
- status
- target ID
- target path
- evidence
- related AC / scenario
- impact
- repair candidate
- jump to target
- rerun check

Editor内ではincremental warningを表示する。保存済みpackageのMVP判定はValidator / Acceptance Runnerで行う。

## 4. 初心者導線

MVPの制作導線は、2Dキャラクターリギングの基本制作能力をPrivate Prototype独自の操作として提供する。

1. Import
   権利クリーン素材を開き、layer / split image、配置、rights、provenance、warningを確認する。

2. Parts / Drawables
   `Head`, `Eye`, `Brow`, `Mouth`, `Hair`, `Body`, `Arm` をpartへ整理し、drawableとtextureへ変換する。

3. Mesh
   各drawableへmeshを生成し、必要な頂点をGUI上で修正する。

4. Draw Order / Mask
   目、眉、髪、口、体の前後関係を整え、瞳または同等部位にmask relationを設定する。

5. Parameters
   推奨parameter templateを追加し、min / max / defaultを確認する。

6. Keyforms
   まばたき、眉、口開閉のkeyformを作り、sliderで補間を確認する。

7. RigControls
   顔・体・腕・髪に `rotation2d` または `warpLattice2d` を作り、parameterへ接続する。

8. Face face yaw / pitch
   顔の左右・上下・斜め方向を確認する。2D keyform evaluatorは `parameter-grid-2d-v1` としてMVP採用済みであり、実装時はGUI編集導線とfixture期待値を固定する。

9. Dynamics
   `faceYaw`、`bodyAngle`などのdriver parameterから、`hairSway`、`clothSway`、`ribbonSwing`などのcomputed output parameterを生成するMinimum Open Dynamics v1 groupを作り、preview/reset/simple graphで確認する。

10. Preview
   Editor previewで代表parameterを動かし、mesh、mask、draw order、rig control、warningsを確認する。

11. Save / Viewer / Validate
    project-defined model packageとして保存し、再読み込みし、Viewerでruntime load、parameter操作、runtime snapshot、diagnosticsを確認する。

## 5. Editor-only State と Runtime-visible State

| 状態 | Editor-only | Runtime-visible | 保存場所候補 |
|---|---:|---:|---|
| selection | yes | no | `model/editor-state.json` |
| lock | yes | no | `model/editor-state.json` |
| editor hide | yes | no | `model/editor-state.json` |
| tree expansion | yes | no | `model/editor-state.json` |
| active tool | yes | no | `model/editor-state.json` |
| overlay preference | yes | no | `model/editor-state.json` |
| drawable opacity | no | yes | `model/drawables.json` / keyforms |
| runtime visibility | no | yes | `model/drawables.json` / keyforms |
| draw order | no | yes | `model/draw-order.json` / keyforms |
| mesh rest vertices | no | yes | `model/meshes.json` |
| rig control graph | no | yes | `model/rig-controls.json` |
| dynamics group definitions | no | yes | `model/dynamics.json` |
| dynamics preview state | yes | no | preview session / runtime state |
| parameter current for preview | mixed | no for package default | preview session / snapshot |
| parameter default / range | no | yes | `model/parameters.json` |
| diagnostics | mixed | yes as report/snapshot | validation / runtime snapshot |

## 6. 画面仕様の設計完了条件

実装前に、画面仕様では少なくとも次を決める。

- 各主要パネルが担当するMVP AC項目。
- Stable IDを人間が確認・コピーできる場所。
- Editor-only state と runtime-visible state の名前、保存場所、操作UI。
- Selection model と multi-select操作の対象。
- Mesh / rig control / mask / draw order の編集modeとCanvas overlay。
- Parameter / keyform作成の最短導線。
- Dynamics panelのgroup / driver / output / settings / preview reset導線。
- 推奨parameter templateの初期セット。
- Diagnostics panel の check ID、severity、target jump、repair candidate表示。
- Save、reload、Viewer open、Validator run、AI dry-runの画面遷移。
- operation logへ記録されるGUI commandの粒度。

## 7. 実装前に決めるべき未決事項

- 顔 face yaw / pitch の斜め方向UIを、2本の1D parameter合成で見せるか、2D keyform gridとして見せるか。
- 初期warp lattice解像度を 2x2 とするか 3x3 とするか。
- `layered-character-psd-profile-v1`をMVP primary import、`split-png-fallback-v1`をfallback / debug / fixture / PSDを持たない素材の互換入口とする判断は確定済み。
- Canvas上のmask previewを、alpha合成結果まで表示するか、source / target relation overlayに留めるか。
- Editor warningのうち、blocking状態で操作を止めるものと、警告表示だけにするもの。

## 8. Post-MVPでよい未決事項

- Animation timeline、motion作成、motion export。
- expression asset、full physics asset、pose assetの制作UI。
- 外部エディタのpalette配置、メニュー、ショートカット互換。
- advanced mesh generator、高度な自動提案UI。MVPではassistant / validator / dry-run / diff / repair suggestionに限定する。
- multi-view、recording、random pose、高度なcomparison preview。
