# DOMAIN-09: Open Dynamics and Secondary Motion

> Status: Current for Private Prototype baseline.

## 問い

Private Prototypeは、髪・服・小物などの動的挙動をどう保存・評価・検証するべきか。

## 方針

このdomainの現在名は互換性維持のため残すが、active requirementはOpen Dynamics / secondary motionである。Cubism由来の物理形式や外部solver挙動の再現は目的にしない。

### AC-PHYS-001: dynamics groupを定義できること

Project-defined packageは、入力parameter、出力control、遅れ、減衰、制限、reset条件を持つdynamics groupを定義できること。

### AC-PHYS-002: 入力パラメータと出力パラメータを定義できること

Dynamics groupは、どのparameterやruntime stateを入力にし、どのcontrolやparameterへ出力するかを明示できること。

### AC-PHYS-003: 遅延・慣性・揺れを表現できること

Secondary motionとして、遅延、減衰、振幅制限、resetを表現できること。

### AC-PHYS-004: 計算条件を設定できること

Private runtime coreは、決定的に再現できるsolver設定、tick、initial stateを扱えること。

### AC-PHYS-005: 動的挙動を保存・出力できること

Dynamics groupはproject-defined packageへ保存され、private viewerで再現できること。

### AC-PHYS-006: 動的挙動を検証できること

Validatorは、循環依存、未接続target、過大な揺れ、非決定的snapshot差分をreportできること。
