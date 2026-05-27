# シナリオ: Project-defined Model Package

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/215_Open_Model_Format.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/215_Open_Model_Format.md)
> Status: Current for Private Prototype baseline.
> Filename note: historical filename retained for link stability.

## 0. 目的

Project-defined model packageをPrivate Prototypeの制作、runtime、validation、AI assistantの共有境界として扱えることを確認する。

## SC-FORMAT-001: package仕様をPrivate Prototype内で定義できる

### Given

- 実装者がpackage layoutとDTOを設計している。

### When

1. 実装者がmanifest、model graph、assets、metadata、rights/provenanceを定義する。
2. Validatorがschema validationを実行する。

### Then

- Package仕様はPrivate Prototypeの実装者とAI assistantが読める。
- 公開標準仕様化や外部互換は現在MVPの成功条件ではない。

### 検証するAC

- AC-FORMAT-001
- AC-FORMAT-005

## SC-FORMAT-002: authoring/runtime/AIに必要な構造を保持できる

### Given

- Projectにはdrawable、mesh、part、parameter、keyform、rig control、dynamicsがある。

### When

1. ユーザーがpackageを保存する。
2. Private runtime coreがpackageを読み込む。
3. AI assistantがdiffとvalidation reportを参照する。

### Then

- Authoring情報とruntime評価情報が同じstable IDで結び付く。
- Versioning、migration、provenanceを追跡できる。

### 検証するAC

- AC-FORMAT-002
- AC-FORMAT-003
- AC-FORMAT-004
