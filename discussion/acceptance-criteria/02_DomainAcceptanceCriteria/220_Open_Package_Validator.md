# DOMAIN-20: Private Package Validator

> Status: Current for Private Prototype baseline.
> Filename note: the historical filename is kept for link stability; active content is private package validator.

## 問い

Project-defined packageは、何を満たせばPrivate Prototypeで利用可能なmodel assetとして合格できるか。

### AC-VALIDATOR-001: package schema validationができること

Validatorは、project-defined packageのschema、version、必須フィールド、型、参照形式を検証できること。

### AC-VALIDATOR-002: asset reference validationができること

Validatorは、texture、metadata、rights/provenance、demo-safe分類などの参照先が存在し、整合していることを検証できること。

### AC-VALIDATOR-003: mesh / drawable validationができること

Validatorは、mesh、vertex、uv、triangle index、drawable、draw order、maskの整合性を検証できること。

### AC-VALIDATOR-004: private runtime load testができること

Validatorは、private runtime coreでpackageを読み込み、初期評価できることを検証できること。

### AC-VALIDATOR-005: AI-readable validation reportを出力できること

Validatorは、Pass / Fail / Needs review / Not applicable、対象ID、根拠、影響範囲、repair candidateを含むreportを出力できること。
