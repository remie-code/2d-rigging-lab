# DOMAIN-08: Body and Secondary Motion Modeling

> Status: Current for Private Prototype baseline.

## 問い

Private Prototypeは、身体姿勢、接続部、髪・服・小物のsecondary motionをどう制作・検証するべきか。

### AC-BODY-001: 身体の姿勢変化を定義できること

Body lean、neck tilt、shoulder movementなどをproject-defined parameterとrig controlで制作できること。

### AC-BODY-002: 頭部と身体の連動を定義できること

Head、neck、bodyのparent-child relationを保存し、private runtime coreで評価できること。

### AC-BODY-003: 髪の可動を定義できること

Hair partのkeyformとsecondary motion groupを保存・評価できること。

### AC-BODY-004: 衣装・装飾品の可動を定義できること

Cloth、ribbon、accessoryなどのsecondary motionと制限をproject-defined構造として保存できること。

### AC-BODY-005: 身体可動の整合性を検証できること

Private seam handling、joint-area validation、過大な揺れ、接続部の隙間やめり込みをvalidatorでreportできること。
