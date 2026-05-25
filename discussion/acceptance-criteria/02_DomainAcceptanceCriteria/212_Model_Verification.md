# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-12: Model Verification

### 問い

正しい Open Live2D モデルとは何か。
Open Live2D Stack は、人間またはAIエージェントが何を観測できれば、正しさを判断できるのか。

### AC-VERIFY-001: モデル構造を観測できること

Open Live2D Stack は、モデルの drawable、mesh、deformer相当構造、part、parameter、keyform、physics、expression、motion、metadata、package参照を構造化して観測できること。


### AC-VERIFY-002: runtime state をパラメータ値ごとに観測できること

Open Runtime / Viewer は、任意の parameter 値におけるモデル状態を観測できること。

観測対象には、評価後の vertex、drawable visibility、opacity、draw order、mask、physics state、expression/motion 適用結果を含める。


### AC-VERIFY-003: 操作前後の差分を観測できること

Open Live2D Stack は、編集操作または構造化操作の前後で、モデル構造、runtime state、validation result がどのように変化したかを観測できること。


### AC-VERIFY-004: 破綻を検出または検証支援できること

Open Package Validator / Viewer / Runtime は、少なくとも以下の破綻を検出または検証支援できること。

- mesh の不自然な潰れ
- texture 参照の欠落
- 隠れ部分の不足
- draw order の破綻
- clipping / mask の破綻
- parameter 中間値での形状破綻
- physics の過剰振動または不自然な停止
- Open Model Package の読み込み失敗
- runtime 評価結果と model format 定義の不整合


### AC-VERIFY-005: ACまたはシナリオに基づき合否判断できること

Open Live2D Stack は、定義されたACまたは機能シナリオに基づき、モデル状態、runtime state、出力資産、validation report の合否判断を支援できること。


### AC-VERIFY-006: 検証結果を AI-readable report として出力できること

検証結果は、Pass / Fail / Needs review / Not applicable などの状態、対象ID、根拠、影響範囲、修復候補を含む構造化レポートとして出力できること。
