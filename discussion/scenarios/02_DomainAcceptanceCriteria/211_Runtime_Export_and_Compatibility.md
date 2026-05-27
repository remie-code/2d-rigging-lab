# シナリオ: Project Package Save and Runtime Readiness

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/211_Runtime_Export_and_Compatibility.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/211_Runtime_Export_and_Compatibility.md)
> Status: Current for Private Prototype baseline.

## 0. 目的

Private GUI editorで制作したproject-defined packageを保存し、private runtime core、private viewer、validatorで成立確認できることを検証する。

## SC-EXPORT-001: project-defined packageを保存しprivate viewerで読み込める

### Given

- Projectにはdrawable、mesh、parameter、keyform、rig control、rights/provenanceがある。

### When

1. ユーザーがproject-defined packageとして保存する。
2. ユーザーがprivate viewerでpackageを開く。
3. Validatorがpackage schemaと参照整合を検査する。

### Then

- Packageはprivate viewerで初期表示できる。
- Missing texture、壊れた参照、rights/provenance不足はreportされる。

### 検証するAC

- AC-EXPORT-001
- AC-EXPORT-002
- AC-EXPORT-003

## SC-EXPORT-002: round-trip同等性と編集反映性を検証できる

### Given

- Packageを読み込み、編集せずに再保存する操作と、軽微な編集を加える操作がある。

### When

1. Validatorが再保存前後のstructureとruntime snapshotを比較する。
2. ユーザーがparameter keyformを編集して再保存する。
3. Private viewerが編集前後のpackageを同じparameter値で表示する。

### Then

- 編集なしの再保存は実用上同等と判定できる。
- 編集ありの保存はruntime snapshotとvalidation diffで確認できる。
- Cubism互換出力の有無は評価条件にしない。

### 検証するAC

- AC-EXPORT-004
- AC-EXPORT-005
- AC-EXPORT-006
