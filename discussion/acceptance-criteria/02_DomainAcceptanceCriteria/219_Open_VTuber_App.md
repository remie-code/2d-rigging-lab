# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-19: Open VTuber App

### 問い

Open Model Format を前提にした配信利用アプリは、何を満たせば成立するのか。

### AC-VTUBER-001: Open Model Package を配信用モデルとして読み込めること

Open VTuber App は、Open Model Package を読み込み、配信利用可能なモデルとして表示できること。


### AC-VTUBER-002: tracking input を parameter へ mapping できること

Open VTuber App は、webcam 等の tracking input を model parameter へ mapping できること。


### AC-VTUBER-003: smoothing と calibration を扱えること

Open VTuber App は、入力値の smoothing、基準姿勢、感度、範囲補正を扱えること。


### AC-VTUBER-004: expression hotkey と model placement を扱えること

Open VTuber App は、expression hotkey、model position、scale、rotation、background transparency を扱えること。


### AC-VTUBER-005: 外部APIとAI設定補助を提供できること

Open VTuber App は、外部制御APIと、AIエージェントによる設定補助・検証を提供できること。
