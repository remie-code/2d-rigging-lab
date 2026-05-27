# DOMAIN-11: Project Package Save and Runtime Readiness

> Status: Current for Private Prototype baseline.

## 問い

Private GUI editorで制作したmodelを、何として保存すればprivate runtime core、private viewer、validatorで利用可能と確認できるか。

### AC-EXPORT-001: project-defined model packageを出力できること

Private GUI editorは、編集したmodelをproject-defined model packageとして保存できること。

### AC-EXPORT-002: モデル本体、テクスチャ、関連設定を整合した資産群として出力できること

Packageは、model graph、texture参照、rig control、parameter、keyform、dynamics、metadata、rights/provenanceを整合的に含むこと。

### AC-EXPORT-003: private runtime/viewerで読み込み・表示・操作できることを検証できること

Validatorまたはprivate viewerは、保存packageがprivate runtime coreで読み込め、初期表示とparameter操作に応答することを確認できること。

### AC-EXPORT-004: project-defined package内でのround-trip同等性を検証できること

Packageを読み込み、編集せずに再保存した場合、構造、参照、runtime評価結果が実用上同等であることを検証できること。

### AC-EXPORT-005: 編集反映性を検証できること

読み込み後に加えた編集がpackageに保存され、private runtime/viewerでも確認できること。

### AC-EXPORT-006: Cubism互換出力を実装スコープ外にすること

`.moc3`、`.model3.json`、`.cmo3`などの互換出力、変換、再構築を現在MVPの成功条件にしないこと。
