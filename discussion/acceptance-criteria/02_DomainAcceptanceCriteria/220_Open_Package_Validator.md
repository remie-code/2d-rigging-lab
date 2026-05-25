# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-20: Open Package Validator

### 問い

Open Model Package は、何を満たせば利用可能なモデル資産として合格できるのか。

### AC-VALIDATOR-001: package schema validation ができること

Open Package Validator は、Open Model Package の schema、version、必須フィールド、型、参照形式を検証できること。


### AC-VALIDATOR-002: asset reference validation ができること

Open Package Validator は、texture、motion、expression、physics、metadata などの参照先が存在し、整合していることを検証できること。


### AC-VALIDATOR-003: mesh / drawable validation ができること

Open Package Validator は、mesh、vertex、uv、triangle index、drawable、draw order、mask の整合性を検証できること。


### AC-VALIDATOR-004: runtime load test ができること

Open Package Validator は、Open Runtime で package を読み込み、初期評価できることを検証できること。


### AC-VALIDATOR-005: AI-readable validation report を出力できること

Open Package Validator は、Pass / Fail / Needs review / Not applicable、対象ID、根拠、影響範囲、修復候補を含むレポートを出力できること。
