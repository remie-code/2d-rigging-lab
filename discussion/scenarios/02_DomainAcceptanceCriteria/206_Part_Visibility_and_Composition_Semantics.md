# シナリオ: Part, Visibility, and Composition Semantics

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/206_Part_Visibility_and_Composition_Semantics.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/206_Part_Visibility_and_Composition_Semantics.md)
> Status: Current for Private Prototype baseline.

## 0. 目的

Part階層、表示状態、差し替え表現をproject-defined packageとprivate runtimeで扱えることを確認する。

## SC-PART-001: part階層とdrawable所属を編集できる

### Given

- Projectに複数partとdrawableがある。

### When

1. ユーザーがpart階層を編集する。
2. ユーザーがdrawableの所属partを変更する。
3. ユーザーがlock/hide/select状態を切り替える。

### Then

- Partとdrawableのstable IDは保持される。
- 制作状態とruntime visibilityは混同されない。

### 検証するAC

- AC-PART-001
- AC-PART-002

## SC-PART-002: compositionをruntimeで再現できる

### Given

- 表情差分や差し替え用drawableを持つprojectがある。

### When

1. ユーザーがcomposition stateを設定する。
2. Private runtime coreがstateを評価する。
3. Private viewerが同じparameter値で表示する。

### Then

- Visibility、opacity、draw order、mask関係が保存・再現される。
- 外部pose asset互換は成功条件にしない。

### 検証するAC

- AC-PART-003
- AC-PART-004
