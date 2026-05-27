# シナリオ: Open Dynamics and Secondary Motion

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/209_Physics_and_Dynamic_Behavior.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/209_Physics_and_Dynamic_Behavior.md)
> Status: Current MVP scenario for Minimum Open Dynamics v1.

## 0. 目的

このシナリオは、Minimum Open Dynamics v1の保存、評価、検証、demo-safe表示を定義する。Current MVPでは、髪・服・小物の揺れをparameter-driven deterministic secondary motionとして扱い、driver parameterからcomputed output parameterを生成して通常keyform / rig control評価へ渡す。

## 1. Source-of-Truth

### Design Decisions

- Current MVPでは、Minimum Open Dynamics v1をproject-defined dynamics groupとして扱う。
- Dynamics outputはcomputed output parameterに限定し、mesh vertexやrig control propertyを直接変更しない。
- Runtimeはhidden mutable stateを持たず、previous `RuntimeStateDto` を入力し、`RuntimeSnapshotDto` と next `RuntimeStateDto` を返す。
- Runtimeはfixed timestepでDynamicsを評価し、同じpackage、同じinitial `RuntimeStateDto`、同じ`RuntimeSequenceFrameDto[]`ならEditor previewとViewerで同じ結果を返す。
- Runtimeはpackage load、preview restart、validation run start、demo capture startでinitial `RuntimeStateDto`を生成できる。Initial group stateはcurrent targetへpositionを合わせ、velocity=0、tick=0、resetCounter=1で始まる。
- `RuntimeStateDto`はpackage identityを持ち、state mismatch / missing group / unknown group / timestep mismatchをdiagnostic evidenceとして残す。
- 1つのdynamics groupは、MVPではちょうど1つのcomputedDynamics output parameterだけを生成する。同じcomputed output parameterへの複数group出力は禁止する。
- 複数driverはweighted sumで合成する。
- Cubism Physics互換、`.physics3.json`、外部solver互換、Cubism Viewer一致、Cubism Editor Physics UI再現はMVP成功条件に含めない。

### Research Notes

- Cubism由来の物理形式や外部solver挙動への過去参照はprivate research archiveであり、現在のpackage仕様ではない。

## SC-DYN-001: dynamics groupを作成・保存できる

### Given

- Projectには髪、服、小物のpart、authoredInput parameter、computedDynamics parameterがある。

### When

1. ユーザーがDynamics panelでdynamics groupを追加する。
2. ユーザーが`faceYaw`、`facePitch`、`bodyAngle`、`headMoveX`などのdriver parameterを選ぶ。
3. ユーザーが`hairSway`、`clothSway`、`ribbonSwing`、`accessorySwing`などのcomputed output parameterを選ぶ。
4. ユーザーがstiffness、damping、maxVelocity、maxAmplitude、output min/max、reset policyを設定する。

### Then

- 設定は`model/dynamics.json`に保存される。
- 保存されるsolverは`scalarDampedFollowV1`であり、runtime evaluatorのsource of truthに`response`は含めない。GUIでresponseを見せる場合はUI-only preset / derived descriptionとして扱う。
- Dynamics groupは`output`を1つだけ持つ。複数outputが必要な場合は別groupを作る。
- Dynamics outputはmesh vertexやrig control propertyを直接変更せず、computed output parameterとして通常keyform / rig control評価へ渡される。
- 未接続driver、未接続output、範囲外出力、output target重複、computed parameter producer欠落、依存cycleはvalidatorがreportする。

### 検証するAC

- AC-PHYS-001
- AC-PHYS-002
- AC-PHYS-003

## SC-DYN-002: 同じ入力列でEditor previewとViewerが同じ結果を返す

### Given

- Dynamics group、package identity付きinitial `RuntimeStateDto`、fixed timestep、`RuntimeSequenceFrameDto[]`入力列がある。

### When

1. Editor previewで`frames`入力列を再生する。
2. Private viewerで同じ`frames`入力列を再生する。
3. Validatorがsnapshot sequence、next `RuntimeStateDto` sequence、final `RuntimeStateDto` evidenceを比較する。

### Then

- 同じfixed timestepと初期状態なら、同じcomputed output parameter列が得られる。
- Runtime snapshotはgroup state、driver値、output値、tick、fixedStepMs、reset状態を含む。`targeted` / `full` detailではrawTarget、clampedTarget、outputClamped、resetApplied、resetReasonsを含められる。
- Operation/validator evidenceには単一state用の `runtime/states/initial.runtime-state.json`、`runtime/states/expected-next.runtime-state.json`、またはsequence用の `runtime/state-sequences/expected.runtime-state-sequence.json` への参照が残る。
- Runtime diffは`dynamicsChanges`でposition、velocity、tick、resetCounter、outputParameterIdの差分を説明できる。
- 非決定的な差分はvalidatorでFailまたはNeeds reviewになる。

### 検証するAC

- AC-PHYS-004
- AC-PHYS-005

## SC-DYN-003: dynamics validationを実行できる

### Given

- Dynamics groupにはdriver欠落、output欠落、output target重複、output parameter範囲外、computed outputをdriverに使う依存、producer欠落、過大振幅、不安定設定、NaN state、timestep overflowのいずれかが含まれる。

### When

- ユーザーがValidatorを実行する。

### Then

- Validatorはdynamics check ID、severity、target、repair candidateをreportする。
- `dynamics.outputTargetDuplicate`、`dynamics.computedParameterProducerMissing`、`dynamics.groupCycle`、`dynamics.nanState`、`dynamics.nonDeterministicSnapshot`などの受け入れ不可状態はstrict / acceptance profileでfailまたはblockingになる。

### 検証するAC

- AC-PHYS-002
- AC-PHYS-003
- AC-PHYS-005

## SC-DYN-004: demo-safeにsecondary motionを見せられる

### Given

- Demo表示可の自作素材とDynamics設定がある。

### When

- ユーザーがcapture用viewer sceneを開く。

### Then

- 髪・服・小物が遅れて揺れる結果と高レベルなdriver/output UIだけを見せられる。
- Cubism Physics、`.physics3.json`、内部solver詳細、既存モデル比較、Live2D互換の物理という表現は表示されない。

### 検証するAC

- AC-PHYS-006

## 2. 確定したMVP制約

- MVP solverは`scalarDampedFollowV1`のみ。
- MVP Dynamicsは1 group = 1 computed output parameter。
- `response` はruntime evaluator入力ではなく、必要な場合だけUI-only preset / derived descriptionとして扱う。
- Runtime coreはinitial `RuntimeStateDto`を生成でき、previous `RuntimeStateDto`を入力し、snapshotとnext `RuntimeStateDto`を返す。
- Dynamics GUIはCubism Physics UIを再現せず、Open Dynamics / secondary motion / driver parameter / computed output parameterの語彙で設計する。
