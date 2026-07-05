# 閉問題 18: 別衣装の rigging（rodos_ware / endoministrator = 場の空間再標本化）

> 状態: Problem defined（2026-07-05）
> 位置付け: 差分管理（Variant 機能、次の閉問題）の前提。衣装差分が本衣装と同じ物理で動く状態を作る

## この問題の新しい未知

**場の空間再標本化**: cp11 の相似則（同一格子の点対点コピー×α）を一歩進め、**committed 現物の変位場を「空間の関数」として読み、別素材の新しい格子位置で再標本化**する。同じパラメータ・同じ体の場所・違う素材——場は素材ではなく空間に属する、の実証。襟の人間補正キーも空間場として一緒に運ばれる（別形状の襟に合うかは gate で判定、崩れは人間仕上げ境界の領分）。

## スコープ（操作列）

対象: rodos_ware / endoministrator 各 part の **topwear + handwear-l/r**（計6 drawable。bottomwear は rigging 対象外 = 表示切替のみ。首は共有・ネクタイは通常衣装専用で差分管理側の扱い——いずれもユーザー決定 2026-07-05）。

各衣装 X について、現行の上半身構成（cp10/15）を複製:

```
rig_bodyz_upper_body（既存・共有）
  ⊃ rig_bodyz_topwear_X（BodyZ 補正。場 = rig_bodyz_topwear から再標本化）
    ⊃ rig_bodyx_topwear_X（BodyX。場 = rig_bodyx_topwear から再標本化——腰ピン・縫い付けアンカー・襟補正込み）
      ⊃ topwear_X
  ⊃ rig_bodyx_arm_l_X / rig_bodyx_arm_r_X（場 = rig_bodyx_arm_l/r から再標本化）⊃ handwear-l/r_X
```

- 両腕の BodyZ 補正は本衣装同様に省略（cp15 ユーザー判断の踏襲）
- メッシュ無き drawable は generateMesh（空メッシュの罠）
- キー位置（パラメータ値）はソースと同一。上半身に Y は無い（BodyY 未実装のまま）

## 判断の所在

| 判断 | 所在 |
|---|---|
| 再標本化の補間・外挿則 | Fable（design-notes が正。外挿はクランプ則 = 既存不変量） |
| 襟・裾の見た目の成立 | ユーザー gate（衣装トグルで確認）。崩れは人間仕上げ境界 |
| 差分の可視切替の正式管理 | 次の閉問題（Variant 機能） |

## 除外事項

- bottomwear（動かない）/ Variant グループの設定 / ネクタイの表示制御 / 新しい物理の設計（場は既存の再標本化のみ、新規設計ゼロが本問題の主張）

## 成功基準

- **A**: (i) 再標本化残差の機械検証（新格子点の場がソース場の補間値と一致、生成時 0 誤差 + committed 後の巻尺照合）(ii) rest レンダ sha 不変（衣装は非表示のまま）(iii) 既存キー・既存 rig バイト無傷（特に人間補正キーの名指しガード）(iv) 衣装を一時表示した sweep（BodyX/BodyZ 両端）で本衣装と同等の追従（一時表示→レンダ→非表示は実証済み運用）
- **B**: ユーザーが衣装トグルで BodyX/BodyZ を動かし満足

## A 調査済み事実

- 両衣装の drawable 構成は同一（topwear/bottomwear/handwear-l/r、graph.json 実測）
- ソース塔: rig_bodyz_topwear（BodyZ 補正）/ rig_bodyx_topwear（⚠襟の人間補正キー = 機械再生成禁忌、ただし**読み取っての再標本化は可**）/ rig_bodyx_arm_l/r
- 衣装 drawable のメッシュ有無は実験冒頭で確認
