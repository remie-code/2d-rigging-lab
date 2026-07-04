# 閉問題 12: 結果（FaceZ 回転コア = rotation2d の初操作）

> 定義: [problem-definition.md](problem-definition.md) / 設計ログ: [experiment/design-log.md](experiment/design-log.md)（rotation2d 操作様式の完全記録）

## 経過（2026-07-04、一発通過・わずか 2 op）

十九代目（rev 361→363、reject ゼロ、予算未消費）: `createRotation2dRigControl`（pivot=(995.5,596)=首素材実測、wrapChildren=BodyX 14塔）+ angleDegrees 三点キー（±10°）。

## 仮説の判定（3つとも成立）

1. **中間でも回転**: 評価後頂点 = R(pivot,θ)·rest を非等分点込み全照合、誤差 1e-10——warp（線形補間 = 弦渡り）との本質差の機械証明
2. **ピボット従属性**: pivot 実測一発で translation 補正ゼロのまま首から外れず。並進キーは演出ダイヤルとして温存
3. **剛体性は構成的**（単一 rotation2d の子）

## 獲得（レシピ06「回転デフォーマ rotation2d」節へ反映済み）

- **warp は回転を表現できない**（keyform 線形補間の制約——ユーザー指摘が cp12 の設計を決めた）
- rotation2d は「field 設計ゼロ」: 設計対象 = pivot 1点 + 角度スカラーのみ。剛体グループは1基一括
- A 問題の復活は杞憂（op 実在・CLI 無修正で通過）。cp01 以来の A 調査が planning-gate の1 grep で済んだ
