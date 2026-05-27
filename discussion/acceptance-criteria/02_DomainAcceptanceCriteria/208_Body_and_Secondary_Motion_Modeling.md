# DOMAIN-08: Body and Secondary Motion Modeling

> Status: Current for Private Prototype baseline.

## 問い

Private Prototypeは、身体姿勢、接続部、髪・服・小物の最小揺れ表現をどう制作・検証するべきか。

### AC-BODY-001: 身体の姿勢変化を定義できること

Body lean、neck tilt、shoulder movementなどをproject-defined parameterとrig controlで制作できること。

### AC-BODY-002: 頭部と身体の連動を定義できること

Head、neck、bodyのparent-child relationを保存し、private runtime coreで評価できること。

### AC-BODY-003: 髪の可動を定義できること

Hair partのkeyform、`hairSway`等のproject-defined scalar parameter、通常rig controlを保存・評価できること。

### AC-BODY-004: 衣装・装飾品の可動を定義できること

Cloth、ribbon、accessoryなどの可動は、MVPではproject-defined parameter、手動keyform、通常rig controlとして保存できること。Full Open Dynamics、dynamics group、secondary motion solverはPrivate Optional / Post-MVPである。

### AC-BODY-005: 身体可動の整合性を検証できること

Joint-area validation、過大なkeyform変形、接続部の隙間やめり込みをvalidatorでreportできること。

### AC-BODY-006: 接続部をruntime solverにしないこと

Private seam handling は、manual overlap / mask / draw order / authored keyform / validator annotation の集合であること。cross-mesh vertex binding、automatic seam solver、connection medium、seam weight、display-state-specific connection table、runtime-driven part attachment、two-drawable weld / adhere / glue relation はMVP package/runtimeに含めないこと。
