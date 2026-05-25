# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-15: Open Model Format

### 問い

Open Live2D Stack の正となるモデル形式は、何を第一級要素として持つべきか。

### AC-FORMAT-001: オープンな仕様として定義できること

Open Model Format は、実装者、制作者、AIエージェントが読める公開仕様として定義できること。


### AC-FORMAT-002: authoring と runtime に必要な構造を表現できること

Open Model Format は、drawable、mesh、part、parameter、keyform、deformer相当構造、expression、physics、motion、texture、metadata を表現できること。


### AC-FORMAT-003: AI-readable であること

Open Model Format は、AIエージェントが構造、差分、編集意図、validation result、provenance を扱える形で設計されること。


### AC-FORMAT-004: versioning と migration を扱えること

Open Model Format は、format version、互換性、migration、非推奨要素、将来拡張を扱えること。


### AC-FORMAT-005: package と参照整合を定義できること

Open Model Format は、モデル本体、texture、関連設定、外部参照、metadata を Open Model Package として整合的に扱えること。
