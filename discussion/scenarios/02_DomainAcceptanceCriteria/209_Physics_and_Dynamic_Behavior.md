# シナリオ: Open Dynamics and Secondary Motion

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/209_Physics_and_Dynamic_Behavior.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/209_Physics_and_Dynamic_Behavior.md)
> Status: Current MVP scenario for Minimum Open Dynamics v1.

## 0. 目的

このシナリオは、Minimum Open Dynamics v1の保存、評価、検証、demo-safe表示を定義する。Current MVPでは、髪・服・小物の揺れをparameter-driven deterministic secondary motionとして扱い、driver parameterからcomputed output parameterを生成して通常keyform / rig control評価へ渡す。

## 1. Source-of-Truth

### Design Decisions

- Current MVPでは、Minimum Open Dynamics v1をproject-defined dynamics groupとして扱う。
- Dynamics outputはcomputed output parameterに限定し、mesh vertexやrig control propertyを直接変更しない。
- Runtimeはfixed timestepでDynamicsを評価し、同じpackage、同じinitial state、同じauthored input sequenceならEditor previewとViewerで同じ結果を返す。
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
4. ユーザーがstiffness、damping、response、amplitude limit、reset policyを設定する。

### Then

- 設定は`model/dynamics.json`に保存される。
- Dynamics outputはmesh vertexやrig control propertyを直接変更せず、computed output parameterとして通常keyform / rig control評価へ渡される。
- 未接続driver、未接続output、範囲外出力、依存cycleはvalidatorがreportする。

### 検証するAC

- AC-PHYS-001
- AC-PHYS-002
- AC-PHYS-003

## SC-DYN-002: 同じ入力列でEditor previewとViewerが同じ結果を返す

### Given

- Dynamics group、初期state、fixed timestep、authored parameter input sequenceがある。

### When

1. Editor previewで入力列を再生する。
2. Private viewerで同じ入力列を再生する。
3. Validatorがsnapshot sequenceを比較する。

### Then

- 同じfixed timestepと初期状態なら、同じcomputed output parameter列が得られる。
- Runtime snapshotはgroup state、driver値、output値、tick、fixedStepMs、reset状態を含む。
- 非決定的な差分はvalidatorでFailまたはNeeds reviewになる。

### 検証するAC

- AC-PHYS-004
- AC-PHYS-005

## SC-DYN-003: dynamics validationを実行できる

### Given

- Dynamics groupにはdriver欠落、output欠落、output parameter範囲外、computed outputをdriverに使う依存、過大振幅、不安定設定、NaN stateのいずれかが含まれる。

### When

- ユーザーがValidatorを実行する。

### Then

- Validatorはdynamics check ID、severity、target、repair candidateをreportする。
- `dynamics.groupCycle`、`dynamics.nanState`、`dynamics.nonDeterministicSnapshot`などの受け入れ不可状態はstrict / acceptance profileでfailまたはblockingになる。

### 検証するAC

- AC-PHYS-002
- AC-PHYS-006

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

## 2. 未決事項

- MVP solverは`scalarDampedFollowV1`のみにする。
- Dynamics GUIはCubism Physics UIを再現せず、Open Dynamics / secondary motion / driver parameter / computed output parameterの語彙で設計する。
