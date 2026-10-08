# cp18 実験設計ノート（場の空間再標本化の規定。実装者はこれを正とする）

## 1. 対象と対応表

| 新 drawable | 新ワープ（作成） | 場のソース（読むだけ・変更禁忌） |
|---|---|---|
| draw_r0_1cea4f6f_a43f1585_topwear (rodos) | rig_bodyz_topwear_rodos ⊃ rig_bodyx_topwear_rodos | rig_bodyz_topwear / rig_bodyx_topwear |
| draw_r0_1cea4f6f_a43f1647_handwear-r (rodos) | rig_bodyx_arm_r_rodos | rig_bodyx_arm_r |
| draw_r0_1cea4f6f_a43f1666_handwear-l (rodos) | rig_bodyx_arm_l_rodos | rig_bodyx_arm_l |
| draw_r0_1cea4f6f_8b5c54ca_topwear (endo) | rig_bodyz_topwear_endo ⊃ rig_bodyx_topwear_endo | rig_bodyz_topwear / rig_bodyx_topwear |
| draw_r0_1cea4f6f_8b5c542b_handwear-r (endo) | rig_bodyx_arm_r_endo | rig_bodyx_arm_r |
| draw_r0_1cea4f6f_8b5c5408_handwear-l (endo) | rig_bodyx_arm_l_endo | rig_bodyx_arm_l |

親: topwear_X の BodyZ 補正は rig_bodyz_upper_body 直下、BodyX はその下（現行と同型）。arm_X は rig_bodyz_upper_body 直下。

## 2. 新ワープの格子

- domainBounds = 新 drawable の bbox（+ソース格子ピッチの半分程度の余白は裁量可）
- 格子密度 = **ソース格子と同程度のピッチ**（ソースの物理を保持できる最小密度。格子規則）
- キー位置（パラメータ値の組）はソース keyformSet と**完全同一**（BodyX: ソースの全キー / BodyZ 補正: ソースの全キー）

## 3. 再標本化（キーごと）

ソースワープ S の rest 格子点 {q_ij} と対象キーの statePatch {d_ij} が変位場 F_S を定義する。新格子点 p について:

```
p が S の domain 内: F(p) = bilinear({q_ij, d_ij}, p)   （S の格子セル内の双一次補間）
p が S の domain 外: F(p) = F(clamp(p, S.domain))        （最近縁点の変位をそのまま運ぶ = 傾き1継続）
statePatch_new(p) = F(p)
```

- 外挿クランプは既存不変量「区分線形写像の外挿はクランプ」の適用
- **ソースは読むだけ**。rig_bodyx_topwear の襟人間補正キーは空間場として F に含まれて運ばれる（ソース自体の再生成は禁忌のまま）
- 生成スクリプトが数値一次ソース。同一スクリプトで S 自身の格子点を入力すると d_ij が厳密再現されること（恒等検算）をスクリプト内 assert にする

## 4. 検証

1. **恒等検算**: 再標本化関数にソース格子点を食わせて statePatch 完全一致（数値 0 誤差）
2. **committed 照合**: commit 後、新ワープの evaluatedControlPoints（own キー）を数点サンプルし、生成値と一致（巻尺）
3. **rest sha 不変**: 衣装は非表示のまま → rest フルレンダが現状と sha256 一致
4. **無傷**: ソース塔・全既存キー（襟人間補正の名指しガード含む）バイト無傷
5. **sweep**: 各衣装を一時表示（本衣装 topwear/handwear/tie を一時非表示にして重なりを避ける）→ BodyX ±端・BodyZ ±端のレンダ → 元に戻す。自己目視: 腰ピン不動・襟/袖の追従が本衣装と同等・体からの剥離なし
6. report.md は**漸進的に書く**（工程の節目ごとに追記）
