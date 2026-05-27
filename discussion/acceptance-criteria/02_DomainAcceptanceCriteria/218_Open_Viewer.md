# DOMAIN-18: Private Viewer

> Status: Current for Private Prototype baseline.
> Filename note: the historical filename is kept for link stability; active content is private viewer.

## 問い

Private viewerは、project-defined packageをどう読み込み、表示し、parameter操作とvalidation結果を確認すべきか。

### AC-VIEWER-001: project-defined packageを読み込めること

Private viewerは、project-defined model packageを読み込み、private runtime coreで初期表示できること。

### AC-VIEWER-002: parameter操作を提供できること

Private viewerは、parameter sliderまたは同等の操作でmodel stateを変更し、結果を確認できること。

### AC-VIEWER-003: expression / motion / dynamicsを確認できること

Private viewerは、MVP内のexpression-like composition、manual parameter grid、secondary motionを確認できること。Timelineやproduction motionはMVP外である。

### AC-VIEWER-004: model structureとruntime stateをinspectできること

Private viewerは、drawable、mesh、part、parameter、draw order、mask、runtime snapshotをinspectできること。

### AC-VIEWER-005: validation reportを表示・保存できること

Private viewerは、validator reportを表示し、AI assistantが参照できる構造化reportとして保存できること。
