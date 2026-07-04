# 閉問題 14: BodyZ 回転コア（腰から上を傾ける）

> 定義日: 2026-07-04。BodyZ 戦線の第一手（cp14 = 回転コア → cp15 = 補正ワープ群、の2分割をユーザー承認済み）。FaceZ（cp12）と同じ型。

## 位置づけ

**新未知は1つ: 回転デフォーマの入れ子**——BodyZ 回転（rotation2d）が **FaceZ 回転（rotation2d）を子として包む初例**。合成は Runtime の階層評価に委ねる（対角ポリシーと同じ信頼）。他は cp12 の型の再適用（pivot = 腰、角度正典 = ダイヤル）。

## 対象: BodyZ 回転デフォーマ1基 + メンバー一括（wrapChildren）

ユーザー指定のメンバー（積み順: BodyZ > FaceZ > BodyX > … ——ユーザー実作の塔と同じ）:

- **FaceZ 回転デフォーマ**（rig_facez_head——頭部一式はこれ経由で随伴）
- 房 L/R・後ろ髪 L/R（の FaceZ ワープ塔 = 各塔の現在の root）
- シャツ胴体（topwear 塔）・両腕（arm 塔）・ネクタイ（tie 塔）・首（neck 塔）
- **back_hair 背景 drawable**（back_hair Parts Container 内の影表現。鎮座しているだけだが体ごと動くとはみ出しかねないため回転に巻き込む——素の drawable なら wrapChildren の drawable 指定 or 単独塔化は実行時判断）

## キー設計

- パラメータ: BodyZ 系 preset（ID・レンジは実行時確認）
- pivot = **腰**（スカートのイン線・胴の正中の相場。素材実測から初期値、ダイヤル）
- angleDegrees 三点キー。±端の角度は控えめから（体の傾ぎは首かしげよりさらに浅い相場。gate ダイヤル）
- translation キーは 0 から（ピボット従属性の再適用）

## 判断の所在（【ユーザー gate】）

- 「**腰から上が一塊で傾ぐ**」——スカートから下は不動
- FaceZ 入れ子の合成が破綻しないか（BodyZ を振りながら FaceZ も振る監視レンダ——判定はポリシーどおり Runtime 委せ、記録のみ）
- **織り込み（cp15 が消す）**: ネクタイが斜めに固定・シャツがスカートにめり込む/隙間・髪の垂れ直しなし——**この段階ではそれが正しい**

## 成功基準

- **A**: createRotation2dRigControl + editKeyformKey で足りる見込み（rotation2d の入れ子 wrap が通るかは本問題で実証——reject ならそれ自体が発見）
- **B**: gate 通過 + 回帰無傷（rest / X / Y / Z / BodyX / 開閉——バイト一致、人間補正名指し）

## 実行様式

クリーン Fable 委任（封じ込め継続・状態確認は git status のみ可）、設計ログ義務（入れ子 wrap の様式・pivot 決定過程）、エスカレーション権、目視イテレーション予算1回。
