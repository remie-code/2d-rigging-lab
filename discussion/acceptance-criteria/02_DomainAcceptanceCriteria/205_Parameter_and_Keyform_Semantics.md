# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-05: Parameter and Keyform Semantics

### 問い

Live2Dモデルにおける「動きの正体」は何か。
Open Editorは可動仕様をどのように定義し、保持し、再生しなければならないか。

### AC-PARAM-001: 可動軸をパラメータとして定義できること

Open Editorは、モデルの形状・表情・姿勢・表示状態を変化させる可動軸をパラメータとして定義できること。


### AC-PARAM-002: パラメータ範囲を持てること

Open Editorは、各パラメータに対して最小値、最大値、既定値などの範囲情報を保持できること。


### AC-PARAM-003: キーフォームを保持できること

Open Editorは、特定のパラメータ値における描画要素または変形制御構造の状態をキーフォームとして保持できること。


### AC-PARAM-004: パラメータ値に応じて中間状態を生成できること

Open Editorは、定義済みキーフォーム間の中間状態を生成し、パラメータ値に応じたモデル状態を表示・出力できること。


### AC-PARAM-005: 複数パラメータの組み合わせを扱えること

Open Editorは、複数パラメータが同時に作用するモデル状態を扱えること。


### AC-PARAM-006: 標準的なパラメータ識別子を扱えること

Open Editorは、外部ランタイムや既存ワークフローとの互換性を考慮し、標準的なパラメータ識別子を扱えること。


### AC-PARAM-007: パラメータ駆動状態を検証可能であること

Open Editorは、あるパラメータ値におけるモデル状態を観測・比較・検証できること。
