# シナリオ: Deformation Control Structure

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/204_Deformation_Control_Structure.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/204_Deformation_Control_Structure.md)
> Status: Accepted draft for Private Prototype MVP.

## 0. 目的

このシナリオは、Private Prototype内でdrawable meshを変形するためのrig control、親子関係、parameter接続、検証項目を定義する。

## 1. Source-of-Truth

### Design Decisions

- Active scenarioは `warpLattice2d`、`rotation2d`、mask、opacity、draw order、parent-child transformをproject-defined構造として扱う。
- 変形制御はprivate runtime coreで評価できる範囲に限定する。

### Research Notes

- 旧Cubism参照操作はprivate research archiveであり、同名概念や外部ツールの挙動を実装オラクルにしない。

## SC-DEF-001: warp latticeを作成しparameterへ接続できる

### Given

- Projectにはdrawable meshが登録されている。

### When

1. ユーザーがprivate GUI editorでdrawableを選択する。
2. ユーザーが`warpLattice2d` controlを作成する。
3. ユーザーがcontrol pointを編集し、project-defined parameterへkeyformを割り当てる。

### Then

- Controlは対象drawable、control point、parameter binding、keyform、interpolationを保存する。
- Runtime previewはparameter値に応じてmesh頂点を更新する。
- 範囲外変形や過大変形はvalidator reportに出る。

### 検証するAC

- AC-DEF-001
- AC-DEF-002

## SC-DEF-002: rotation controlと親子transformを評価できる

### Given

- Projectには頭、髪、首、肩などのpart階層がある。

### When

1. ユーザーが`rotation2d` controlを作成する。
2. ユーザーがpivot、影響対象、親子関係を設定する。
3. ユーザーがruntime previewでparameterを動かす。

### Then

- 子partは親transformの影響を受ける。
- Pivotや親子関係は保存・再読み込みできる。
- 循環参照、存在しないtarget、親子関係の破損はFailになる。

### 検証するAC

- AC-DEF-003
- AC-DEF-004

## SC-DEF-003: mask、opacity、draw orderを変形評価と同じsnapshotで確認できる

### Given

- Projectには複数の重なり合うdrawableがある。

### When

1. ユーザーがmask target、opacity keyform、draw order keyformを設定する。
2. Private runtime coreがparameter入力を評価する。
3. Viewerがruntime snapshotを表示する。

### Then

- Geometry、mask、opacity、draw orderが同じ評価tickのsnapshotに含まれる。
- 不正なmask targetやdraw order衝突はvalidatorで報告される。
- Editor previewとviewerで同じ結果を確認できる。

### 検証するAC

- AC-DEF-005

## 2. 未決事項

- Lattice resolutionのMVP上限。
- 複数parameterが同じcontrolへ作用する場合の合成規則。
