# シナリオ: Private Package Validator

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/220_Open_Package_Validator.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/220_Open_Package_Validator.md)
> Status: Current for Private Prototype baseline.
> Filename note: historical filename retained for link stability.

## 0. 目的

Validatorがproject-defined package、private runtime load、rights/provenance、demo-safe分類を検査できることを確認する。

## SC-VALIDATOR-001: schemaとasset参照を検証できる

### Given

- Packageにmanifest、model graph、assets、metadataが含まれる。

### When

1. Validatorがschema validationを実行する。
2. Validatorがasset referenceとrights/provenanceを確認する。

### Then

- 必須field、型、参照欠落、権利metadata不足をreportできる。

### 検証するAC

- AC-VALIDATOR-001
- AC-VALIDATOR-002

## SC-VALIDATOR-002: mesh/runtime/reportを検証できる

### Given

- Packageにはmesh、drawable、rig control、parameter、validation failure候補がある。

### When

1. Validatorがmesh/drawable整合を検査する。
2. Private runtime coreでload testと初期評価を行う。
3. ValidatorがAI-readable reportを保存する。

### Then

- ReportはPass / Fail / Needs review / Not applicable、対象ID、根拠、repair candidateを含む。

### 検証するAC

- AC-VALIDATOR-003
- AC-VALIDATOR-004
- AC-VALIDATOR-005
