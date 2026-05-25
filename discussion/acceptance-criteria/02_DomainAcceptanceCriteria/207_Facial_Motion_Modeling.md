# Open Live2D Stack Acceptance Criteria System Draft

# 2. Domain Acceptance Criteria

## DOMAIN-07: Facial Motion Modeling

### 問い

Live2Dモデルにおける顔の可動とは何か。
Open Editorは顔のどの表現能力を支えなければならないか。

### AC-FACE-001: 目の開閉を定義できること

Open Editorは、左右の目について開眼・閉眼およびその中間状態を定義できること。


### AC-FACE-002: 視線・瞳移動を定義できること

Open Editorは、瞳または視線方向の可動を定義できること。


### AC-FACE-003: 眉の可動を定義できること

Open Editorは、眉の上下、傾き、表情変化を定義できること。


### AC-FACE-004: 口の開閉を定義できること

Open Editorは、口の開閉状態を定義できること。


### AC-FACE-005: 口形状を定義できること

Open Editorは、母音または発話表現に対応する口形状を定義できること。


### AC-FACE-006: 表情状態を定義できること

Open Editorは、笑顔、怒り、困り、驚きなどの表情状態を定義・切り替えできること。


### AC-FACE-007: 顔の向きを定義できること

Open Editorは、顔の左右・上下・傾きなどの向きを定義できること。


### AC-FACE-008: 顔可動の整合性を検証できること

Open Editorは、顔可動において以下の整合性を検証できること。

- 輪郭が破綻しない
- 目、鼻、口、眉の位置関係が顔向きと整合する
- 隠れ部分の露出が破綻しない
- 髪や顔周辺パーツとの前後関係が破綻しない
- パラメータの中間値で不自然な潰れや反転が起きない
