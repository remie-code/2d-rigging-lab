# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-13: AI-native Operation

### 問い

Open Live2D Stack が AI-native であるとは何か。
人間向け Editor を単に自動操作することと、何が違うのか。

### AC-AI-001: Stack 全体の中核操作を構造化操作として表現できること

Open Live2D Stack は、model format authoring、runtime evaluation、viewer inspection、package validation、VTuber app configuration などの中核操作を、AIエージェントが呼び出せる構造化操作として表現できること。


### AC-AI-002: 操作対象を安定識別できること

Open Live2D Stack は、AIエージェントが drawable、mesh、vertex、deformer相当構造、part、parameter、keyform、motion、expression、physics、package asset、runtime state を安定して識別できること。


### AC-AI-003: 操作結果を構造化応答として返せること

Open Live2D Stack は、AIエージェントの操作に対して、成功/失敗、変更内容、影響範囲、警告、validation result、runtime result、修復候補を構造化して返せること。


### AC-AI-004: 探索空間をAC・仕様・シナリオで制約できること

Open Live2D Stack は、AC、仕様、シナリオ、validation rule を用いて、AIエージェントの編集・設計・レビューにおける探索空間を制約できること。


### AC-AI-005: AIによるレビューを可能にすること

Open Live2D Stack は、AIエージェントが model structure、runtime state、dynamic behavior、package readiness、rights hygiene をレビューするための観測情報を提供できること。


### AC-AI-006: AI操作と人間操作が同じモデル正解に収束すること

Open Live2D Stack は、人間が行う編集とAIエージェントが行う編集が、同じ model format、同じAC体系、同じvalidation ruleに基づいて扱われること。


### AC-AI-007: provenance を追跡できること

Open Live2D Stack は、入力、変換、編集、生成、検証、修復提案の由来を provenance として追跡できること。
