# シナリオ: Body and Secondary Motion Modeling

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/208_Body_and_Secondary_Motion_Modeling.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/208_Body_and_Secondary_Motion_Modeling.md)
> Status: Accepted draft for Private Prototype MVP.

## 0. 目的

このシナリオは、Private Prototypeで身体姿勢、接続部、髪・服・小物の最小揺れ表現を作成し、manual seam handlingとjoint-area validationで検証する。

## 1. Source-of-Truth

### Design Decisions

- 接続部はmanual overlap / mask / draw order / authored keyform / joint-area validationとして扱う。
- MVPの髪・服・小物の揺れは、Minimum Open Dynamics v1でdriver parameterから`hairSway`等のcomputed output parameterを生成し、通常keyform / rig control評価へ渡す。
- Full physics、direct vertex physics、direct rigControl physics output、cloth simulation、collision、IK、timeline bake、Cubism Physics互換はMVP外とする。
- 外部ツール固有の接着機能名や物理形式は、MVP仕様にしない。

### Research Notes

- 旧Cubism参照語彙は、現在の実装仕様ではなく過去調査扱いにする。

## SC-BODY-001: 首・肩・胴体の姿勢を編集できる

### Given

- Projectには首、肩、胴体、腕などのpartとdrawable meshがある。

### When

1. ユーザーがbodyLean、neckTilt、shoulderLiftなどのproject-defined parameterを作成する。
2. ユーザーがrotation controlとwarp latticeを設定する。
3. Runtime previewで姿勢変化を確認する。

### Then

- Body姿勢はkeyformとして保存される。
- 首・肩・胴体の親子関係はruntime snapshotで確認できる。
- 過大変形、接続部の隙間、めり込みはvalidator reportに出る。

### 検証するAC

- AC-BODY-001
- AC-BODY-002

## SC-BODY-002: manual seam handlingを設定できる

### Given

- 首と胴体、髪と顔、服と腕などに接続部がある。

### When

1. ユーザーがjoint areaをvalidation annotationとして指定する。
2. ユーザーが接続部を、手動で作成したoverlap、mask、draw order、keyform、drawable形状で調整する。
3. Validatorがjoint areaを検査する。

### Then

- Packageには、validatorが検査するjoint-area annotationと、通常のmesh/mask/drawOrder/keyformだけが保存される。
- Validatorは隙間、過剰な重なり、mask不足、draw order不整合をreportする。
- Runtimeは、cross-mesh connection solver や connection medium を評価しない。
- cross-mesh vertex binding、automatic seam solver、seam weight、display-state-specific connection table、runtime-driven part attachment、two-drawable weld / adhere / glue relation はMVPに含めない。

### 検証するAC

- AC-BODY-003

## SC-BODY-003: hair/cloth/accessoryの最小揺れ表現を設定できる

### Given

- Projectには髪、服、リボン、小物などの揺れ対象partがある。

### When

1. ユーザーが`hairSway`等のcomputedDynamics parameterを作成する。
2. ユーザーが`faceYaw`、`facePitch`、`bodyAngle`などのauthoredInput parameterをDynamics driverとして設定する。
3. ユーザーが髪・服・小物の手動keyformと通常rig controlを`hairSway`等へ接続する。
4. Private runtime coreがMinimum Open Dynamics v1をfixed timestepで評価し、computed output parameterを通常keyform / rig controlへ渡す。

### Then

- 髪・服・小物の最小揺れ表現は保存・再読み込みできる。
- Runtime snapshotはauthored/computed/effective parameter値、dynamics driver/output/state、keyform評価、rig control評価状態を含む。
- 過大なkeyform変形、未接続target、rig control循環、dynamics未接続driver/output、非決定的snapshotはvalidatorで報告される。
- DynamicsはMVPではmesh vertexやrig control propertyを直接変更しない。

### 検証するAC

- AC-BODY-003
- AC-BODY-004
- AC-BODY-005

## 2. 確定したMVP制約と未決事項

- Minimum Open Dynamics v1のsolverは`scalarDampedFollowV1`のみに絞る。
- Dynamicsはcomputed output parameterを生成し、mesh vertexやrig control propertyを直接書き換えない。
- 1 dynamics groupは1 computed output parameterだけを生成する。
- MVPで扱うjoint-area validationの具体的な幾何検査は未決。
