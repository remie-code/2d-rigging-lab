# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-09: Physics and Dynamic Behavior

### 問い

Live2Dモデルにおける動的挙動とは何か。
Open Editorは手動キーフォームではなく、入力に応じた遅延・揺れ・慣性をどう扱わなければならないか。

### AC-PHYS-001: 物理挙動グループを定義できること

Open Editorは、髪、衣装、装飾品などの揺れ物に対して物理挙動グループを定義できること。


### AC-PHYS-002: 入力パラメータと出力パラメータを定義できること

Open Editorは、物理挙動の入力となるパラメータと、結果が反映される出力パラメータを定義できること。


### AC-PHYS-003: 遅延・慣性・揺れを表現できること

Open Editorは、顔向き、身体動作、呼吸などに応じて、副次部位が遅延・慣性・揺れを伴って動く表現を定義できること。


### AC-PHYS-004: 物理計算条件を設定できること

Open Editorは、物理挙動の計算条件を設定できること。


### AC-PHYS-005: 物理挙動を保存・出力できること

Open Editorは、定義された物理挙動をモデル資産の一部として保存し、ランタイム利用可能な形式で出力できること。


### AC-PHYS-006: 物理挙動を検証できること

Open Editorは、物理挙動の結果を再生・観測・検証できること。
