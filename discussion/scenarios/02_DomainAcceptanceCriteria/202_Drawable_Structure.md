# シナリオ: Drawable Structure

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/202_Drawable_Structure.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/202_Drawable_Structure.md)
> Status: Current for Private Prototype baseline.

## 0. 目的

Drawableをproject-defined packageの安定した描画単位として作成、保存、評価、検証できることを確認する。

## SC-DRAW-001: drawableをpartとtextureへ結び付けられる

### Given

- Rights-cleanなlayered character artがimport済みである。

### When

1. ユーザーがprivate GUI editorでlayerからdrawableを作成する。
2. ユーザーがpart、texture、bounds、display nameを確認する。
3. ユーザーがpackageを保存して再読み込みする。

### Then

- Drawableはstable ID、part所属、texture参照、mesh参照、boundsを保持する。
- Editor preview、private viewer、validatorが同じIDでdrawableを参照できる。

### 検証するAC

- AC-DRAW-001
- AC-DRAW-002

## SC-DRAW-002: draw order、visibility、mask関係を検証できる

### Given

- 複数drawableが重なり、mask関係を持つprojectがある。

### When

1. ユーザーがdraw order、visibility、opacity、mask relationを編集する。
2. Private runtime coreがruntime snapshotを返す。
3. Validatorがdrawable関係を検査する。

### Then

- Runtime snapshotにdraw order、visibility、opacity、mask relationが含まれる。
- 欠けたtarget、循環、表示不能状態はreportされる。

### 検証するAC

- AC-DRAW-003
- AC-DRAW-004
