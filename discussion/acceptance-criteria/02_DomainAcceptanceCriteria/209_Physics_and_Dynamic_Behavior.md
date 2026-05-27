# DOMAIN-09: Open Dynamics and Secondary Motion

> Status: Private Optional / Post-MVP. Not a current MVP implementation gate.

## 問い

Private Prototypeは、将来Open Dynamics / secondary motion solverを再開する場合、髪・服・小物などの動的挙動をどう保存・評価・検証するべきか。

## 方針

このdomainの現在名は互換性維持のため残す。Current MVPではfull Open Dynamics、dynamics group、secondary motion solverを実装しない。髪・服・小物の最小表現は、project-defined scalar parameter、手動keyform、通常rig control、runtime snapshot、validator warningで扱う。

Open Dynamicsを再開する場合は、package / operation / runtime / validator contractを追加してからPrivate Optional / Post-MVPとして扱う。Cubism由来の物理形式や外部solver挙動の再現は目的にしない。

### AC-PHYS-001: optional dynamics groupを定義できること

Private Optionalとして再開する場合、project-defined packageは、入力parameter、出力control、遅れ、減衰、制限、reset条件を持つdynamics groupを定義できること。

### AC-PHYS-002: 入力パラメータと出力パラメータを定義できること

Private Optionalとして再開する場合、dynamics groupは、どのparameterやruntime stateを入力にし、どのcontrolやparameterへ出力するかを明示できること。

### AC-PHYS-003: 遅延・慣性・揺れを表現できること

Private Optionalとして再開する場合、secondary motionとして、遅延、減衰、振幅制限、resetを表現できること。

### AC-PHYS-004: 計算条件を設定できること

Private Optionalとして再開する場合、private runtime coreは、決定的に再現できるsolver設定、tick、initial stateを扱えること。

### AC-PHYS-005: 動的挙動を保存・出力できること

Private Optionalとして再開する場合、dynamics groupはproject-defined packageへ保存され、private viewerで再現できること。

### AC-PHYS-006: 動的挙動を検証できること

Private Optionalとして再開する場合、validatorは、循環依存、未接続target、過大な揺れ、非決定的snapshot差分をreportできること。
