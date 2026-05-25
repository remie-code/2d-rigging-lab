# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-08: Body and Secondary Motion Modeling

### 問い

Live2Dモデルにおける身体の可動とは何か。
Open Editorは顔以外のモデル表現をどう支えなければならないか。

### AC-BODY-001: 身体の姿勢変化を定義できること

Open Editorは、身体の傾き、上下、回転、呼吸などの姿勢変化を定義できること。


### AC-BODY-002: 頭部と身体の連動を定義できること

Open Editorは、頭部、首、肩、胴体の連動関係を定義できること。


### AC-BODY-003: 髪の可動を定義できること

Open Editorは、髪の各部位について、手動可動または物理挙動の前提となる変形状態を定義できること。


### AC-BODY-004: 衣装・装飾品の可動を定義できること

Open Editorは、衣装、装飾品、アクセサリなどの副次部位の可動を定義できること。


### AC-BODY-005: 身体可動の整合性を検証できること

Open Editorは、身体可動において以下の整合性を検証できること。

- 部位同士の接続が破綻しない
- 隠れ部分が不自然に露出しない
- 親子変形が意図通りに伝播する
- 可動範囲内で形状が破綻しない
