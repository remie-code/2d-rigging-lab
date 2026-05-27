# DOMAIN-05: Parameter and Keyform Semantics

> Status: Current for Private Prototype baseline.

## 問い

Private Prototypeは、project-defined parameter、semantic role、keyform、manual authored parameter gridをどう扱うべきか。

### AC-PARAM-001: 可動軸をパラメータとして定義できること

Project-defined packageは、parameter ID、display name、semantic role、min、max、default、UI stepを保持できること。

### AC-PARAM-002: パラメータ範囲を持てること

Parameterは範囲、default、clamp、validation ruleを持ち、範囲外入力を検出できること。

### AC-PARAM-003: キーフォームを保持できること

Parameter値に対応するkeyformを保持し、target property、補間、provenanceと結び付けられること。

### AC-PARAM-004: パラメータ値に応じて中間状態を生成できること

Private runtime coreは、authorが作成したkeyformと補間に基づいて中間状態を評価できること。

### AC-PARAM-005: 複数パラメータの組み合わせを扱えること

Manual authored parameter gridを保存し、複数parameterの組み合わせ状態を評価・検証できること。

### AC-PARAM-006: project-defined parameter presetを扱えること

Presetはproject内の可読性と制作補助のために使い、外部runtime互換IDとして扱わないこと。

### AC-PARAM-007: パラメータ駆動状態を検証可能であること

Validatorは、未使用parameter、欠落keyform、過大補間、manual gridの未調整cellをreportできること。
