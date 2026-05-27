# シナリオ: Model Verification

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/212_Model_Verification.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/212_Model_Verification.md)
> Status: Current for Private Prototype baseline.

## 0. 目的

Model structure、runtime snapshot、diff、validation reportを、validatorとAI assistantが同じIDで参照できることを検証する。

## SC-VERIFY-001: model structureとruntime stateを観測できる

### Given

- Project-defined packageがprivate runtime coreで読み込み済みである。

### When

1. Validatorがmodel structureを読み取る。
2. Private runtime coreが複数parameter値でsnapshotを返す。
3. AI assistantがreport説明を求められる。

### Then

- Part、drawable、mesh、parameter、keyform、rig control、runtime stateをstable IDで参照できる。
- AI assistantは観測結果に基づいて説明できる。

### 検証するAC

- AC-VERIFY-001
- AC-VERIFY-002
- AC-VERIFY-006

## SC-VERIFY-002: diffと合否判断を出せる

### Given

- Operation前後のpackageとvalidation reportがある。

### When

1. Validatorがmodel diff、runtime diff、validation diffを生成する。
2. ReviewerがAC/scenarioに基づき合否を確認する。

### Then

- Diffは変更対象、変更理由、影響範囲、severityを持つ。
- ResultはPass / Fail / Needs review / Not applicableで返る。

### 検証するAC

- AC-VERIFY-003
- AC-VERIFY-004
- AC-VERIFY-005
