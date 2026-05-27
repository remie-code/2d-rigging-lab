# DOMAIN-07: Facial Motion Modeling

> Status: Current for Private Prototype baseline.

## 問い

Private Prototypeは、目、眉、口、表情、顔向き風の変形をどう制作・検証するべきか。

### AC-FACE-001: 目の開閉を定義できること

Eye open / closeなどのproject-defined parameterとkeyformで目の状態を制作できること。

### AC-FACE-002: 視線・瞳移動を定義できること

Pupilやeye highlightの移動をproject-defined parameterで制作できること。

### AC-FACE-003: 眉の可動を定義できること

Brow raise、brow formなどのparameterとkeyformで眉の変形を制作できること。

### AC-FACE-004: 口の開閉を定義できること

Mouth openなどのparameterとkeyformで口の開閉を制作できること。

### AC-FACE-005: 口形状を定義できること

Mouth smile、vowel-like shapeなどの口形状をproject-defined semantic roleとして扱えること。

### AC-FACE-006: 表情状態を定義できること

Smile、surprisedなどの表情状態をparameter combinationまたはcompositionとして保存できること。

### AC-FACE-007: 顔の向きを定義できること

faceYaw、facePitch、faceRollはproject-defined scalar controlであり、manual authored parameter gridとして保存・評価できること。

### AC-FACE-008: 顔可動の整合性を検証できること

Validatorは、過大変形、未調整grid cell、左右不整合、重なり破綻をreportできること。
