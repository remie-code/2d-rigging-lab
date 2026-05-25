# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-17: Open SDK

### 問い

外部アプリは Open Runtime をどのように組み込み、制御できるべきか。

### AC-SDK-001: Web / TypeScript SDK を優先して提供できること

Open SDK は、初期段階では Web / TypeScript から Open Runtime を利用できるAPIを提供すること。


### AC-SDK-002: model loading API を提供できること

Open SDK は、Open Model Package の読み込み、初期化、解放、エラー取得を扱えること。


### AC-SDK-003: parameter control API を提供できること

Open SDK は、parameter 値の取得・設定・範囲確認・更新通知を扱えること。


### AC-SDK-004: rendering integration API を提供できること

Open SDK は、アプリ側の描画ループやキャンバスへ Open Runtime を統合できること。


### AC-SDK-005: validation / inspection API を提供できること

Open SDK は、runtime state、drawable、parameter、diagnostics を取得する inspection API を提供できること。
