# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-16: Open Runtime / Core

### 問い

Open Runtime / Core は、Open Model Format をどのように読み込み、評価し、描画可能な状態にするべきか。

### AC-RUNTIME-001: Open Model Format を読み込めること

Open Runtime は、Open Model Package を読み込み、runtime state を初期化できること。


### AC-RUNTIME-002: parameter state を保持・更新できること

Open Runtime は、parameter 値を保持し、外部入力、motion、expression、physics に応じて更新できること。


### AC-RUNTIME-003: parameter に応じた vertex / drawable 状態を評価できること

Open Runtime は、parameter 値と keyform / deformer相当構造に基づき、評価後の vertex、drawable visibility、opacity、draw order、mask を計算できること。


### AC-RUNTIME-004: 描画統合できること

Open Runtime は、WebGL等の描画基盤に対して、texture、mesh、draw order、clipping / mask を反映した描画情報を提供できること。


### AC-RUNTIME-005: runtime state を観測できること

Open Runtime は、AIエージェントと検証ツールが runtime state、評価結果、警告、エラーを構造化して取得できること。
