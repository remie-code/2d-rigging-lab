# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-11: Open Model Package Export and Runtime Readiness

### 問い

Open Live2D Stack は、制作したモデルを何として保存・出力できれば、Editor外の Runtime / Viewer / VTuber App / SDK で利用できるのか。

### AC-EXPORT-001: Open Model Package を出力できること

Open Editor または authoring tool は、編集したモデルを Open Model Package として出力できること。

Open Model Package は、Open Runtime / Viewer が読み込める model format、texture、関連設定、metadata を含む。


### AC-EXPORT-002: モデル本体、テクスチャ、関連設定を整合した資産群として出力できること

Open Live2D Stack は、モデル本体、テクスチャ、物理設定、モーション、表情、ポーズ相当の状態、metadata を、参照整合の取れた資産群として扱えること。

どの資産が必須で、どの資産が任意で、どの資産が未対応なのかを package metadata と validation report で説明できること。


### AC-EXPORT-003: Open Runtime / Viewer で読み込み・表示・操作できることを検証できること

Open Package Validator または Open Viewer は、出力した Open Model Package が Open Runtime で読み込めること、表示できること、parameter 操作に応答することを検証できること。


### AC-EXPORT-004: Open Model Format 内での round-trip 同等性を検証できること

Open Live2D Stack は、Open Model Package を読み込み、編集せずに再保存した場合、モデル構造、参照、runtime評価結果が実用上同等であることを検証できること。

同等性はバイト列一致ではなく、Open Model Format の意味論、runtime state、描画結果、validation result に基づいて判断する。


### AC-EXPORT-005: 編集反映性を検証できること

Open Live2D Stack は、読み込み後に加えた編集が Open Model Package に保存され、Open Runtime / Viewer 上でも確認できることを検証できること。


### AC-EXPORT-006: Cubism 互換出力を初期成功条件にしないこと

`.moc3`、`.model3.json`、Cubism Viewer、VTube Studio 互換は、参照・移行・将来拡張の対象として扱ってよい。

ただし、Open Live2D Stack の初期ACでは、Cubism 互換出力を成功条件にしない。

出力の正は Open Model Format と Open Runtime / Viewer の読み込み・評価・表示結果である。
