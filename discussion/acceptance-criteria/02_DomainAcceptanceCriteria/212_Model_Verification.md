# DOMAIN-12: Model Verification

> Status: Current for Private Prototype baseline.

## 問い

Private Prototypeは、model graph、runtime state、diff、validation resultをどう観測して合否判断するべきか。

### AC-VERIFY-001: モデル構造を観測できること

ValidatorとAI assistantは、part、drawable、mesh、parameter、keyform、rig control、dynamics、rights/provenanceを構造化して観測できること。

### AC-VERIFY-002: runtime stateをパラメータ値ごとに観測できること

Private runtime coreは、parameter inputごとのruntime snapshotを出力できること。

### AC-VERIFY-003: 操作前後の差分を観測できること

Operation前後のmodel diff、runtime diff、validation diffを取得できること。

### AC-VERIFY-004: 破綻を検出または検証支援できること

Validatorは、mesh破綻、参照欠落、parameter/keyform不整合、demo-safe warningをreportできること。

### AC-VERIFY-005: ACまたはシナリオに基づき合否判断できること

Validation resultは、Root/MVP ACとscenarioに紐付いたPass / Fail / Needs review / Not applicableを返せること。

### AC-VERIFY-006: 検証結果をAI-readable reportとして出力できること

Reportは、AI assistantが説明、dry-run、diff、repair suggestionに使える構造を持つこと。
