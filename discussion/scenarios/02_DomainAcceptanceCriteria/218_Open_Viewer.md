# シナリオ: Private Viewer

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/218_Open_Viewer.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/218_Open_Viewer.md)
> Status: Current for Private Prototype baseline.
> Filename note: historical filename retained for link stability.

## 0. 目的

Private viewerがproject-defined packageを読み込み、parameter操作、runtime snapshot、validation report確認を行えることを検証する。

## SC-VIEWER-001: private viewerでpackageを読み込んで表示できる

### Given

- Project-defined packageがvalidatorでPassまたはNeeds reviewとして保存済みである。

### When

1. ユーザーがprivate viewerでpackageを開く。
2. Private runtime coreが初期stateを評価する。
3. Viewerがdrawablesを表示する。

### Then

- 初期表示、parameter list、diagnosticsを確認できる。
- 既存外部viewer互換は成功条件にしない。

### 検証するAC

- AC-VIEWER-001

## SC-VIEWER-002: parameter操作とvalidation reportを確認できる

### Given

- Packageにはparameter、manual face grid、hairSway keyform、validation reportがある。

### When

1. ユーザーがparameter sliderを動かす。
2. Viewerがruntime snapshotを表示する。
3. ユーザーがvalidation reportを開く。

### Then

- Parameter操作に応じて表示が変わる。
- Model structure、runtime state、validation reportを同じstable IDで確認できる。

### 検証するAC

- AC-VIEWER-002
- AC-VIEWER-003
- AC-VIEWER-004
- AC-VIEWER-005
