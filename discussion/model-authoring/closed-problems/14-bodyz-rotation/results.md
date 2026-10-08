# 閉問題 14: 結果（BodyZ 回転コア = rotation2d 入れ子の初例）

> 定義: [problem-definition.md](problem-definition.md) / 設計ログ: [experiment/design-log.md](experiment/design-log.md)

## 経過（2026-07-04、一発通過・100点・3 op）

二十四代目（rev 401→404、reject ゼロ、予算未消費）: `rig_bodyz_upper_body`（pivot=(997.25,1124)=スカートイン線実測、±6°）、wrapChildren で塔 root 10本 + back_hair 影 drawable。**ユーザー判定: 100点**（織り込み事項の存在込みで）。

## 獲得（レシピ06へ反映済み）

1. **rotation2d の入れ子は無傷で通る**: 合成 = R_outer∘R_inner（誤差 4e-10）、両 pivot とも rest 座標のまま Runtime 階層評価が処理——設計者負担ゼロ。「対角は Runtime 責務」ポリシーの数学的裏付け
2. **空メッシュの罠**: 空メッシュ drawable はデフォーマ配下に入ると bounds ゼロ化で評価から消える——**メッシュ→wrap の順序則**
3. ピボット従属性3例目（translation ゼロ）
4. **リメッシュ込み変更の回帰手続き**: レンダ sha256 一致は原理的に不成立——**差分画素の数値局在化**（差分をモデル座標で局在化し、意図変更領域に閉じることを示す）が正しい形
