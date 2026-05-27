# DOMAIN-22: AI Assistant Interface

> Status: Current for Private Prototype baseline.
> Filename note: the historical filename is kept for link stability; active content is AI assistant interface.

## 問い

AI assistantは、Private Prototypeのmodel structure、operation、diff、validation、repair suggestionをどう扱うべきか。

### AC-AGENT-001: model structure inspectionを提供できること

AI assistantは、project-defined packageとruntime snapshotからmodel structureを安定IDでinspectできること。

### AC-AGENT-002: operation commandを提供できること

AI assistantは、編集提案をdry-run operationとして表現できること。

### AC-AGENT-003: diff extractionを提供できること

AI assistantは、model diff、runtime diff、validation diffを取得し説明できること。

### AC-AGENT-004: scenario-based test executionを提供できること

AI assistantは、ACとscenarioに基づく検証手順を支援できること。ただし外部公開automation APIはMVP外である。

### AC-AGENT-005: repair suggestionとprovenance trackingを提供できること

AI assistantは、repair suggestion、根拠、ユーザー判断、適用結果のprovenanceを記録できること。
