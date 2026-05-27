# シナリオ: Open Dynamics and Secondary Motion

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/209_Physics_and_Dynamic_Behavior.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/209_Physics_and_Dynamic_Behavior.md)
> Status: Accepted draft for Private Prototype MVP.

## 0. 目的

このシナリオは、Private Prototypeの動的挙動をOpen Dynamics / secondary motionとして扱い、project-defined dynamics group、runtime snapshot、validatorで検証する。

## 1. Source-of-Truth

### Design Decisions

- Active scenarioでは、project-defined dynamics groupだけを扱う。
- Dynamicsはprivate runtime coreで決定的に評価できる必要がある。
- 外部形式や外部solver互換はMVP成功条件に含めない。

### Research Notes

- Cubism由来の物理形式や外部solver挙動への過去参照はprivate research archiveであり、現在のpackage仕様ではない。

## SC-DYN-001: dynamics groupを作成できる

### Given

- Projectには髪や服などのsecondary motion対象がある。

### When

1. ユーザーがdynamics groupを作成する。
2. ユーザーが入力parameter、出力control、遅れ、減衰、制限、reset条件を設定する。
3. Editorがruntime previewで動きを確認する。

### Then

- Group設定はproject-defined packageに保存される。
- 入力と出力の対応をinspectorで確認できる。
- 未接続target、循環依存、範囲外出力はvalidatorがreportする。

### 検証するAC

- AC-PHYS-001
- AC-PHYS-002
- AC-PHYS-003

## SC-DYN-002: private runtime coreで決定的に評価できる

### Given

- 同じpackage、同じinitial state、同じparameter入力列がある。

### When

1. Editor previewがdynamicsを評価する。
2. Private viewerが同じ入力列でdynamicsを評価する。
3. Validatorがsnapshotを比較する。

### Then

- Editor previewとviewerは同じ評価結果を返す。
- Runtime snapshotはgroup state、入力、出力、tick、reset状態を含む。
- 非決定的な差分はvalidatorでFailまたはNeeds reviewになる。

### 検証するAC

- AC-PHYS-004
- AC-PHYS-005

## SC-DYN-003: demo-safe capture前にdynamic behaviorを検査できる

### Given

- ユーザーは配信デモ用のviewer sceneを準備している。

### When

1. ユーザーがdemo-safe preflightを実行する。
2. Validatorがsecondary motionの過大振幅、破綻、rights/provenance、表示名を確認する。

### Then

- 視覚的な破綻や過大な揺れはwarningとして確認できる。
- Internal namingや外部形式を示唆する表示はdemo-safe対象外になる。
- Capture対象はrights-clean素材とproject-defined dynamicsだけに限定される。

### 検証するAC

- AC-PHYS-006

## 2. 未決事項

- MVP solverの数値安定性基準。
- Snapshot比較の許容誤差。
