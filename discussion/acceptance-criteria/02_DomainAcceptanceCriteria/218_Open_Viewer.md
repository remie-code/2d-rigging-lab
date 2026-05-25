# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-18: Open Viewer

### 問い

Open Viewer は、モデルが正しく読み込み・表示・操作できることをどう確認するべきか。

### AC-VIEWER-001: Open Model Package を読み込めること

Open Viewer は、Open Model Package を読み込み、表示できること。


### AC-VIEWER-002: parameter 操作を提供できること

Open Viewer は、parameter slider または同等の操作でモデル状態を変更し、結果を確認できること。


### AC-VIEWER-003: expression / motion / physics を確認できること

Open Viewer は、expression、motion、physics の適用結果を確認できること。


### AC-VIEWER-004: model structure と runtime state を inspect できること

Open Viewer は、drawable、mesh、part、parameter、draw order、clipping、runtime state を inspect できること。


### AC-VIEWER-005: validation report を表示・保存できること

Open Viewer は、Open Package Validator の結果を表示し、AI-readable report として保存できること。
