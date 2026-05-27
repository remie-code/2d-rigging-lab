# DOMAIN-13: AI Assistant Operation

> Status: Current for Private Prototype baseline.

## 問い

AI assistantは、Private Prototypeの制作・検証をどこまで支援できるべきか。

## 方針

AIはautomatic complete rig generationではなく、inspect、explain、validate、dry-run、diff、repair suggestion、provenance記録を担うassistant / validatorとして扱う。

### AC-AI-001: 中核操作を構造化操作として表現できること

Editor操作、validator実行、package保存、repair suggestionを構造化operationとして表現できること。

### AC-AI-002: 操作対象を安定識別できること

AI assistantは、stable IDでpart、drawable、mesh、parameter、keyform、rig control、validation itemを参照できること。

### AC-AI-003: 操作結果を構造化応答として返せること

AI assistantは、説明、diff、validation result、repair candidateを構造化応答で返せること。

### AC-AI-004: 探索空間をAC・仕様・シナリオで制約できること

AI assistantは、Root/MVP AC、Domain AC、scenario、validator reportに基づいて提案範囲を制約できること。

### AC-AI-005: AIによるレビューを可能にすること

AI assistantは、model stateやvalidation reportを説明し、根拠付きで問題点を示せること。

### AC-AI-006: AI操作と人間操作が同じモデル正解に収束すること

AI提案はdry-runとdiffを通し、人間が承認した場合だけpackageへ反映されること。

### AC-AI-007: provenanceを追跡できること

AI提案、ユーザー判断、適用結果、関連validation itemを後から追跡できること。
