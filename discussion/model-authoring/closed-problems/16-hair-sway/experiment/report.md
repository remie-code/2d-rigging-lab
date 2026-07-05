# cp16 実験報告: 髪揺れ（揺れワープ6基 + キーフォーム + dynamics v3 グループ4個）

> 実施: 2026-07-05、実装 = Fable 二十六代目。rev 418 → **434**（16 op / 16 git commit、reject ゼロ）。
> 数値の一次ソース: [gen-hair-sway.mjs](gen-hair-sway.mjs)（キーフォーム）+ design-notes §3 verbatim（dynamics）。
> **→ fix1（ユーザー gate 後の改訂、末尾の fix1 節参照）で ±1 キーと dynamics 入力は v2 に置換済み。本文 §2/§3 相当の記述は歴史記録。現行数値の一次ソースは改訂後の gen-hair-sway.mjs（v1 実装は編集リポジトリ git 履歴）。**

## 判定: 完了（design-notes §5 の5点すべて green）

## 実行した op（1 op = 1 git commit、[cp16] 接頭辞）

| # | rev | op | 内容 |
|---|---|---|---|
| 1–6 | 419–424 | createWarpDeformer ×6 | rig_sway_hair_front / _hair_f_l / _hair_f_r / _back_hair_l / _back_hair_r / _tie。親 = 挿入親（rig_facex_* ×5, rig_bodyx_tie）、drawable を wrapChildren で包む。格子は親と双子（同 domain・同次元） |
| 7–12 | 425–430 | editKeyformKey ×6 | 各 Sway パラメータ createEndsCenter {−1, 0, +1}。0 = 全ゼロ（恒等）。±1 = 固定線ピンまわり ±30°×W(y) の真の2D回転 |
| 13–16 | 431–434 | createDynamicsGroup ×4 | dyn_hair_front_sway_x / dyn_hair_side_sway_x / dyn_hair_back_sway_x / dyn_tie_sway_x。design-notes §3 の表を数値 verbatim で payload 化 |

全 dry-run: `outcome success / autoApproved true / diagnostics 0`。

## 検証5点の結果

1. **dry-run → commit / 1 op = 1 コミット**: run-batch.mjs（basePackageRevision 自動充填）で16連、全て auto-approve。終了時 `git status` クリーン。
2. **0キー恒等（sha256 回帰）**: rest フルレンダ（cp15 FULL フレーム）
   - 着手前 `renders/pre-rest-full.png` = `c47fd144d62c50015bd3a71cdc7bc15f0793283949b5f14886a920fa97a48a25`
   - 全 op 後 `renders/post-rest-full.png` = **同一 sha256**（新ワープ6基 + 18キーで絵は1バイトも変わらない）
3. **人間補正ガード**: `gen-hair-sway.mjs verify` = **ALL PASS**。既存 keyformSet 88/88 バイト無傷（rig_bodyx_tie / rig_bodyx_topwear / rig_bodyz_topwear の名指しチェック含む）。rig-controls は挿入親6基の children 差し替えのみ（それ以外 78/78 バイト無傷）。meshes / drawables / draw-order / masks / parameters バイト無傷（createParameter 不使用——Sway 4本はプリセット常在の想定どおり keyform op がそのまま受理）。
4. **sweep 自己目視 + 巻尺**（`renders/sweep-*`、`measure-sway.mjs report` = ALL PASS）:
   - **固定線不動**: 固定線以上の格子行に対応する頂点は変位 0.000px（機械確認）。固定線が格子行に載っていない系統では最終静止行〜固定線間にバイリニア漏れ（front 22.9px / f_r 18.2px / back_r 6.4px / 他 ≤1.5px、craft 示唆1参照）
   - **回転弧**: 毛先帯の実測変位 = ピンまわり回転の予測と **誤差 0.0px** で一致（全6系統×両端）。front −1 で毛先 dy>0 は「ピン列より右に垂れた毛先が最下点へ向かう」正しい振り子弧（シアーなら dy≈0）
   - **左右同方向**: 房 L/R・後ろ L/R とも +1 で両側 +x（機械確認 + 目視）
   - **隠蔽維持**: 付け根は W=0 で場自体が絞られており、±1 ズームで生え際・結び目の露出なし
   - **+1 = 画面右**: 全系統で +1 が画面右への振り切り（機械 + 目視）。strip5（5段 sweep）で中間キーの弦縮み破綻なし
5. **validatePackage strict**: dynamics 起因の新規診断 **ゼロ**（dynamics 系 checkId 出現 0）。error 94 → 100 の増分は `rigControl.runtimeEvidenceMissing` 84→90 = 新ワープ6基分（既知 runtime-evidence 系ファミリの自明増。warning / blocking ゼロ）。ベースライン: `validate-baseline.response.json`。

## dynamics dry-run で観測した診断

4グループとも diagnostics 0。**縮退発動なし**——同一 parameterId の kind 違い重複入力（param_body_angle_z の angle 0.6 + positionX 0.31）は無警告で受理され、BodyZ レバー差補償は設計どおり搭載された。コミット済み実体は design-notes §3 と canon 比較で一致（verify PASS）。

## sweep レンダ（`renders/`）

- 全身: `sweep-{front,side,back,tie}-{min1,rest,plus1}-full.png`（広域フレーム 0,0,2000×2000——後ろ髪毛先は ±645px 動く）
- フォーカス: `sweep-{front,side,back,tie}-{min1,rest,plus1}-zoom.png`
- 中間キー確認: `sweep-*-strip5.png`（−1/−0.5/0/+0.5/+1）

目視所見: 後ろ髪はカーテン全体が根本不動のまま大きく弧を描いて流れ、房は左右が同位相で胸前を渡る。タイは結び目が襟に留まり剣先だけ振れる。front の毛束テールは +1 で頬横に巻き上がる。±0.5 は自然な中間姿勢。

## 数値メモ（実測）

毛先帯（自由長の最深10%）の平均変位 @+1: front (86.8, −114.0) / 房L (205.9, −76.5) / 房R (203.3, −26.6) / 後L (569.6, −166.5) / 後R (629.9, −64.1) / タイ (235.0, −62.1) px。

## craft への示唆（新発見）

1. **固定線は格子行スナップが望ましい（cp10 の節点スナップ則の再確認）**: y_fix が格子行間に落ちると、固定線直上帯にバイリニア漏れが出る（front: 行間 63.8px・h_band 58.25px で最悪 22.9px）。今回は帽子・生え際の下で視認不能だが、露出する固定線（結び目など）では y_fix を行に載せるか行間を細かくするべき。タイは行がほぼ載っており漏れ 0.25px。
2. **design-notes の回転向きの注記は観測量と不整合だった**: 「y-down で時計回り = θ 正」は、真下に垂れた点には**左**移動を与える（時計回りは 下→左）。三度明記された観測量「+1 = 画面右への振り切り」と dynamics v3 出力規約（θ = atan2(dx, dy)、+x 側が正）を正として実装（`x' = x_c + dx cosA + dy sinA` 系、A>0 = 右振り）。機械 assert RIGHT + 目視で確認。用語ではなく観測量で向きを規定するのが正しい書式。
3. **createDynamicsGroup は kind 違いの同一 parameterId 入力を無警告で受理**する（v3 のレバー差線形化イディオムがそのまま使える）。dynamics レコードのフィールド名は `dynamicsGroupId`（op payload と同名。`id` ではない——verify 書式の罠）。
4. **プリセット常在パラメータは本当に常在**: parameters.json が空でも editKeyformKey / createDynamicsGroup が preset id を受理。createParameter 不要の想定が実証された。
5. displayName → id 導出（`rig_` + sanitize）は設計時に予測可能で、双子格子 + wrapChildren(drawable) の「塔を一段深くする」挿入は6基とも一発で通った（既存 drawable の包み直しは createWarpDeformer の wrapChildren で完結、専用 op 不要）。

## 残課題（本問題のスコープ外）

- 揺れの気持ちよさ（damping / outputScale 等の最終値）= ユーザーダイヤル領分（Editor Dynamics Tool → player プロファイル）。
- 成功基準 B（ユーザー満足）の gate は未実施（本報告は基準 A の達成報告）。

---

# fix1 報告: 場 v2（列振り子）+ dynamics 全 positionX 化

> 実施: 2026-07-05、実装 = Fable 二十七代目。rev 434 → **450**（16 op / 16 git commit、reject ゼロ、[cp16-fix1] 接頭辞）。
> 正 = design-notes **§6**。数値一次ソース = 改訂後 [gen-hair-sway.mjs](gen-hair-sway.mjs)（±1 格子 = batch-keys-fix1.json / dynamics = batch-dynamics-fix1.json / 期待値 = design-values-fix1.json）。

## 判定: 完了（design-notes §6.4 の4点すべて green）

## 実行した op

| # | rev | op | 内容 |
|---|---|---|---|
| 1–12 | 435–446 | editKeyformKey ×12 | 6ワープ × {−1, +1} を `updateCurrent` で置換。場 v2 = 列ごとの振り子: y≤y_fix 完全不動、s=y−y_fix、θ=±30°×(s/L_free)^κ (κ=1)、dx=s·sinθ、dy=s(cosθ−1)。0 キーは無接触 |
| 13–16 | 447–450 | updateDynamicsGroup ×4 | 全入力 positionX（angle 全廃）: front FaceX .031/BodyX .056/FaceZ .018/BodyZ .34、side .037/.067/.027/.36、back −.006/−.011/.018/.34、tie BodyX .055/BodyZ .24。rootOffset→(0,0)。chain 長・damping・outputs は payload から外して無接触 |

全 dry-run `success / autoApproved true / diagnostics 0`。updateCurrent は既存キー必須（無ければ reject）なので誤 upsert の余地なし。

## 検証4点（§6.4）の証跡

1. **既存キー無傷**: `gen-hair-sway.mjs verify` = ALL PASS。非 cp16 の 88 keyformSet バイト無傷（rig_bodyx_tie / rig_bodyx_topwear / rig_bodyz_topwear 名指しガード PASS）。cp16 6セットは 0 キーがバイト無傷 + ±1 が設計格子と canon 一致。rig-controls / meshes / drawables / draw-order / masks / parameters 全てバイト無傷
2. **静定不変量の機械 assert**: dynamics.json 全体で angle 入力 **0 件**（出現 kind = positionX のみ）。任意の入力保持での定常出力が構造的に 0 = 静的ポーズと一致
3. **巻尺（measure-sway.mjs = ALL PASS、6系統×±1 の12ケース）**: 移動頂点**全数**が列振り子場の格子行内挿と残差 **0.00px** で一致 / 毛先帯 vs 生の閉形式 (s·sinθ, s(cosθ−1)) 誤差 1.6–3.8px（行間離散化のみ）/ **左右端の dy 残差差 0.0px = 板回転の消滅**（v1 は幅/2×sin30° ≈ 60–165px の非対称が出る構図だった）/ 固定線以上 0.000px / +1 = 右・左右同方向
4. **rest sha256**: fix1-rest-full.png = `c47fd144d62c50015bd3a71cdc7bc15f0793283949b5f14886a920fa97a48a25` = pre/post（v1）と3世代同一

副次効果: 固定線直上帯のバイリニア漏れが v1 最悪 22.9px → **最悪 2.44px**（hair_f_r）に激減。連続成長則は θ が根本で 0 から立ち上がるため、行スナップされていない固定線でも漏れが小さい。

## fix1 レンダ（renders/fix1-*、21枚）と目視所見

- `fix1-rest-full.png`（sha 照合用）/ `fix1-{front,side,back,tie}-{min1,plus1}-{full,zoom}.png` / `fix1-*-strip5.png`
- **板回転は消えた**: 後ろ髪カーテンは根本鉛直のまま毛先へ連続に曲がり、下端が板のように傾かない。v1 +1 で見えた「取り残された中央毛先」も消滅
- **伸縮の見た目は消えた**: dy=s(cosθ−1) の縮み上がりで弧長が保たれ、タイは結び目固定のまま剣先が弧を描く（引き伸ばし感なし）
- **振れ始めの境界は消えた**: 帽子ライン・生え際・結び目のどこにも折れ目や段差なし。strip5 の ±0.5 も自然な中間姿勢

## craft への示唆（fix1 の新発見）

1. **y のみに依存する場（行内一定格子）は、warp 評価器が行間の区分線形内挿を厳密に再現する**（全頂点残差 0.00px）。列振り子のような1次元場は格子行の閉形式値だけで完全に規定できる——検証も「行値の内挿 vs 実測」の全数照合が成立する
2. **連続成長則（境界なし θ フェードイン）は隠蔽維持・漏れ対策としても優れる**: 遷移帯方式より固定線直上のバイリニア漏れが一桁小さい（22.9px→2.44px）。露出する固定線では帯方式より優先してよい
3. **updateDynamicsGroup は部分 payload が効く**: inputs + chain だけ渡せば outputs は無接触（verify で pre とバイト一致を確認）。「触らない値は payload に載せない」が無傷保証の最短経路
4. **updateCurrent は既存キー前提の置換**で、キー集合の形（[−1,0,+1]）を変えずに ±1 だけ差し替える用途に正確に合う。0 キー恒等はバイトレベルで無接触のまま
5. 役割分担の正（静的リグ = 定常、dynamics = 過渡のみ→全入力 positionX）は「dynamics 定義に angle が1つも無い」という**ファイル全体の機械 assert** に落ちる。以後の揺れ系はこの不変量を検証項目に常備すべき

## 残課題（v1 から不変）

- 揺れの気持ちよさ（damping / outputScale 等の最終値）= ユーザーダイヤル領分
- 成功基準 B（ユーザー満足）の gate は未実施（本報告は fix1 設計の達成報告）

---

# fix2 報告: 場 v3（等長振り子曲線）+ 前髪固定線 454 引き上げ

> 実施: 2026-07-05、実装 = Fable 二十八代目。rev 450 → **463**（13 op / 13 git commit、reject ゼロ、[cp16-fix2] 接頭辞）。
> 正 = design-notes **§7**。数値一次ソース = 改訂後 [gen-hair-sway.mjs](gen-hair-sway.mjs)（±1 格子 = batch-keys-fix2.json / dynamics = batch-dynamics-fix2.json / 期待値 = design-values-fix2.json。fix1 実装は編集リポジトリ git 履歴）。

## 判定: 完了（design-notes §7.4 の4点すべて green）

## 実行した op

| # | rev | op | 内容 |
|---|---|---|---|
| 1–12 | 451–462 | editKeyformKey ×12 | 6ワープ × {−1, +1} を `updateCurrent` で置換。場 v3 = 等長振り子曲線: θ(t)=±30°×(t/L_free)^0.5、位置 = 固定線から単位接線 (sinθ, cosθ) の積分（台形則、刻み ≤1px）。接線が常に単位長 → 弧長厳密保存。前髪のみ y_fix 540→454（格子第5行に厳密スナップ）・L_free 319px。0 キーは無接触 |
| 13 | 463 | updateDynamicsGroup ×1 | dyn_hair_front_sway_x のみ: segmentLengths [11.8]、FaceZ posX 0.046、BodyZ posX 0.39。FaceX .031 / BodyX .056 / damping 2.5 / outputs は payload 外で無接触。他3グループは op 自体なし |

全 dry-run `success / autoApproved true / diagnostics 0`。

## 検証4点（§7.4）の証跡

1. **等長 assert（新設・最重要）**: 全6系統 × 全格子列 × ±1 で、列折れ線長（固定線→毛先）と rest 長 L_free の誤差 **最大 0.0700%**（hair_f_l −1）≤ 0.1% gate。誤差の正体は格子行の弦離散化（弧>弦）のみで、committed 格子値そのもの（round2 後）で機械確認
2. **毛先の持ち上がり（巻尺、measure-sway.mjs = ALL PASS）**: 毛先帯平均 dy @±1 = front **−19.8px** / 房L **−26.6** / 房R **−24.8** / 後L **−72.1** / 後R **−76.7** / タイ **−29.4**（全12ケースで dy<0、±で同値 = MIRROR）。毛先帯 dx: front ±101.7 / 房L ±138.5 / 房R ±128.9 / 後L ±376.0 / 後R ±397.9 / タイ ±153.5px
3. **固定線・無傷・angle**: 固定線以上 0.000px（全12ケース）。前髪は行スナップの効果で固定線直上のバイリニア漏れ **0.00px**（非スナップ系統は従前どおり、最大 4.08px = hair_f_r）。`gen-hair-sway.mjs verify` = ALL PASS（38項目）: 非 cp16 88 keyformSet バイト無傷（bodyx_tie / topwear 名指しガード含む）、cp16 0キー無傷、±1 = fix2 設計と canon 一致、front 以外の3 dynamics グループ**丸ごとバイト無傷**、front outputs 無傷、**dynamics 全体で angle 入力 0 件維持**。rig-controls / meshes / drawables / draw-order / masks / parameters バイト無傷
4. **rest sha256 + sweep**: fix2-rest-full.png = `c47fd144d62c50015bd3a71cdc7bc15f0793283949b5f14886a920fa97a48a25` = pre/post/fix1 と**4世代同一**。sweep 全頂点が v3 場の格子行内挿と残差 **0.00px** で一致 / +1 = 右・左右同方向 / 板回転なし（左右端 dy 残差差 0.0px）/ 毛先帯 vs 生積分の誤差 0.3–1.0px（行間離散化のみ）

## fix2 レンダ（renders/fix2-*、24枚）と目視所見

- `fix2-rest-full.png`（sha 照合）/ `fix2-{front,side,back,tie}-{min1,plus1}-{full,zoom}.png` / `fix2-*-strip5.png` / **前髪フォーカス** `fix2-front-face-{min1,rest,plus1}.png`（顔クロップ 700,250,620×560）
- **額の房は揺れる**: face クロップ比較で、目の間の房とメガネ脇の細い毛束が ±1 で左右に振れる（付け根 y=454 直下は微小・毛先ほど大きい連続成長。折れ目なし）
- **伸びの見た目は消えた**: 毛先が弧を描いて持ち上がる（dy<0）ため、房・後ろ髪・タイのどれも「引き伸ばされた」印象がない。後ろカーテンは根本鉛直→毛先で最大 30° の自然な鞭のしなり
- strip5 の ±0.5 も自然な中間姿勢（弦縮み破綻なし）

## craft への示唆（fix2 の新発見）

1. **揺れモード場は等長写像で書くのが正**: 「点ごとの弦配置」(dx=s·sinθ(s)) は θ が s で育つ限り必ず伸びる（伸長率 √(1+(s·θ′)²)、fix1 は毛先で ~13%）。**単位接線の積分**として場を書けば弧長保存が構造保証になり、検証も「列折れ線長 vs rest ≤0.1%」という1行の不変量に落ちる。以後の揺れ系はこの書式を既定とすべき
2. **κ（剛性ダイヤル）は場の形を変えても等長性を壊さない**: θ(t) のプロファイルだけ差し替えれば剛体振り子（κ→0）〜鞭（κ=1）まで同一の検証群がそのまま通る。ワンノブ設計と等長保証の直交が確認できた
3. **固定線の格子行スナップは漏れをゼロにする**（cp10 節点スナップ則 / v1 示唆1の完結）: front y_fix=454 = 第5行ちょうどで、固定線直上バイリニア漏れが 22.9px(v1) → 2.44px(fix1 連続成長) → **0.00px(fix2 スナップ)**。固定線は行に載せられるなら載せるのが最善
4. **±1 キーの台形積分値（刻み≤1px、N=ceil(s)・h=s/N の規約）は決定論で再現可能**: gen と巻尺の双方に同一実装すれば、期待値と実測が 0.00px で照合できる。数値積分を含む場でも「同じ規約の再計算 = 検証」が成立する
5. **触らないグループには op を出さないのが最強の無傷保証**: fix2 は front 1 op のみ発行し、他3 dynamics グループは canon 丸ごと一致で無傷確認（部分 payload の無傷保証より一段強い）

## 残課題（fix1 から不変）

- 揺れの気持ちよさ（damping / outputScale 等の最終値）= ユーザーダイヤル領分
- 成功基準 B（ユーザー満足）の gate は未実施（本報告は fix2 設計の達成報告）
