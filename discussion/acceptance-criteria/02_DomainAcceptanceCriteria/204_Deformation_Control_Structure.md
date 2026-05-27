# DOMAIN-04: Deformation Control Structure

> Status: Current for Private Prototype baseline.

## 問い

Private Prototypeは、drawable meshをparameterに応じて変形させる制御構造をどう扱うべきか。

### AC-DEF-001: 変形制御構造を持てること

Project-defined packageは、warp lattice、rotation control、mask、opacity、draw orderなどのrig controlを保持できること。

### AC-DEF-002: 局所変形と大域変形を分離できること

Local mesh deformationとparent-child transformを分離し、評価順と影響範囲をdebugできること。

### AC-DEF-003: 回転的変形と面変形を区別できること

Rotation controlとwarp latticeを区別し、pivot、対象drawable、parameter binding、keyformを保存できること。

### AC-DEF-004: 変形制御構造の階層を管理できること

Rig controlは親子関係、target、dependency、evaluation orderを持ち、循環参照をvalidatorで検出できること。

### AC-DEF-005: 変形構造を検証可能であること

Validatorは、未接続target、範囲外変形、破損したbinding、過大変形をreportできること。
