# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-10: Animation and Timeline Production

### 問い

Live2Dモデルにおけるアニメーションとは何か。
Open Editorは時間軸上のモデル状態変化をどう定義しなければならないか。

### AC-ANIM-001: モデルを時間軸上に配置できること

Open Editorは、作成済みまたは読み込み済みのモデルをアニメーション対象として扱えること。


### AC-ANIM-002: タイムライン上でパラメータ変化を記録できること

Open Editorは、時間軸上の特定時点におけるパラメータ値を記録できること。


### AC-ANIM-003: キーフレーム間の変化を再生できること

Open Editorは、キーフレーム間の変化を補間し、アニメーションとして再生できること。


### AC-ANIM-004: モーション資産を出力できること

Open Editorは、作成したアニメーションをランタイムまたは外部利用可能なモーション資産として出力できること。


### AC-ANIM-005: アニメーション品質を検証できること

Open Editorは、アニメーションの滑らかさ、意図しない急変、物理挙動との整合性を検証できること。
