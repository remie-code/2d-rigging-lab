# シナリオ: Private Runtime Core

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/216_Open_Runtime_Core.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/216_Open_Runtime_Core.md)
> Status: Current for Private Prototype baseline.
> Filename note: historical filename retained for link stability.

## 0. 目的

Private runtime coreがproject-defined packageを読み込み、parameter入力に応じてdrawable stateとruntime snapshotを返せることを確認する。

## SC-RUNTIME-001: packageを読み込みruntime stateを初期化できる

### Given

- Project-defined packageが保存済みである。

### When

1. Private viewerがpackageを選択する。
2. Private runtime coreがmanifest、assets、model graphを読み込む。
3. Runtime snapshotを取得する。

### Then

- Runtime stateはparameter default、drawable state、draw order、mask、diagnosticsを含む。
- Missing referenceやschema mismatchはdiagnosticsとして返る。

### 検証するAC

- AC-RUNTIME-001
- AC-RUNTIME-005

## SC-RUNTIME-002: parameterに応じてdrawable stateを評価できる

### Given

- Packageにはparameter、keyform、manual authored parameter grid、rig control、dynamicsがある。

### When

1. ユーザーがprivate viewerでparameterを変更する。
2. Private runtime coreがvertex、visibility、opacity、draw order、maskを評価する。

### Then

- 同じ入力列は同じruntime snapshotを返す。
- Editor previewとprivate viewerの評価結果が一致する。

### 検証するAC

- AC-RUNTIME-002
- AC-RUNTIME-003
- AC-RUNTIME-004
