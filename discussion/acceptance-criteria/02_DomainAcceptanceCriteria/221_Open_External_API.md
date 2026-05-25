# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-21: Open External API

### 問い

外部アプリやAIエージェントは、Open Live2D Stack をどう操作できるべきか。

### AC-API-001: parameter 送受信 API を提供できること

Open External API は、parameter 値の取得、設定、購読、範囲確認を扱えること。


### AC-API-002: model state 取得 API を提供できること

Open External API は、model structure、runtime state、validation result、diagnostics を取得できること。


### AC-API-003: expression / motion 操作 API を提供できること

Open External API は、expression、motion、physics、placement などの操作を外部から実行できること。


### AC-API-004: automation API を提供できること

Open External API は、Editor / Viewer / VTuber App の操作を自動化するための構造化APIを提供できること。


### AC-API-005: WebSocket / HTTP / plugin 境界を定義できること

Open External API は、用途に応じた通信方式、認可、plugin境界、互換性を定義できること。
