# シナリオ: Body and Secondary Motion Modeling

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/208_Body_and_Secondary_Motion_Modeling.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/208_Body_and_Secondary_Motion_Modeling.md)
> Status: Accepted draft for Private Prototype MVP.

## 0. 目的

このシナリオは、Private Prototypeで身体姿勢、接続部、髪・服・小物のsecondary motionを作成し、private seam handlingとjoint-area validationで検証する。

## 1. Source-of-Truth

### Design Decisions

- 接続部はprivate seam handlingとjoint-area validationとして扱う。
- Secondary motionはproject-defined dynamics groupとして保存する。
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

## SC-BODY-002: private seam handlingを設定できる

### Given

- 首と胴体、髪と顔、服と腕などに接続部がある。

### When

1. ユーザーがjoint areaを指定する。
2. ユーザーが接続部の補助mesh、mask、overlap、draw orderを調整する。
3. Validatorがjoint areaを検査する。

### Then

- 接続部の補助設定はpackageへ保存される。
- Validatorは隙間、過剰な重なり、mask不足、draw order不整合をreportする。
- 接続部の扱いはproject-defined構造で説明できる。

### 検証するAC

- AC-BODY-003

## SC-BODY-003: hair/cloth/accessoryのsecondary motionを設定できる

### Given

- Projectには髪、服、リボン、小物などの揺れ対象partがある。

### When

1. ユーザーがsecondary motion groupを作成する。
2. ユーザーが入力parameter、遅れ、減衰、制限、影響先controlを設定する。
3. Private runtime coreが評価tickごとにgroup状態を更新する。

### Then

- Secondary motion groupは保存・再読み込みできる。
- Runtime snapshotはgroup入力、出力、内部状態を含む。
- 過大な揺れ、未接続target、循環入力はvalidatorで報告される。

### 検証するAC

- AC-BODY-003
- AC-BODY-004
- AC-BODY-005

## 2. 未決事項

- MVPで扱うjoint-area validationの具体的な幾何検査。
- Secondary motion solverの最小パラメータ。
