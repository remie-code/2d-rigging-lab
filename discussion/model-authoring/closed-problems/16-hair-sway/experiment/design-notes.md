# cp16 実験設計ノート（L0 実測定数と場の規定。実装者はこれを正とする）

> 実測: 2026-07-05、巻尺 = inspectEvaluatedGeometry（固定線行の格子制御点、rest との差分）。
> **px→cm スケール宣言: 18px = 1cm**（キャンバス 3072px・全身約160cm 想定の宣言値。以後の cm は全てこの換算）

## 1. 対象と挿入点（塔の最内側、drawable 直上）

| 系統 | drawable | 挿入親（現・最内側ワープ） | 固定線 y | 自由長 px | L_eff cm |
|---|---|---|---|---|---|
| 前髪 | draw_r0_1cea4f6f_21b4dac0_front_hair | rig_facex_hair_front | 540 | 233 | 8.6 |
| 房L | draw_r0_1cea4f6f_21b4da21_hair_f_l | rig_facex_hair_f_l | 505 | 461 | 16.5（L/R 平均） |
| 房R | draw_r0_1cea4f6f_21b4da82_hair_f_r | rig_facex_hair_f_r | 520 | 428 | 〃 |
| 後ろ髪L | draw_r0_1cea4f6f_f2691750_back_hair_l | rig_facex_back_hair_l | 540 | 1237 | 46.8（L/R 平均） |
| 後ろ髪R | draw_r0_1cea4f6f_f26916b1_back_hair_r | rig_facex_back_hair_r | 540 | 1290 | 〃 |
| ネクタイ | draw_r0_1cea4f6f_ea30e9c4_tie | rig_bodyx_tie | 710（結び目下端） | 513 | 19.0 |

L_eff = (2/3)×自由長cm（分布質量棒の等価振り子長）。固定線 y は正典値（cp13 の y_scalp: 房L505/R520・カーテン540、cp15 の結び目 y=710）。

## 2. 揺れモード場（キーフォームの正）

- 新ワープ6基: 親 = 挿入親、drawable を包む（塔がもう一段深くなる）。格子は挿入親と**双子**（同 domainBounds・同 latticeColumns/latticeRows。警告: warp レコードの格子フィールド名は `latticeColumns/latticeRows`、op payload は別名）
- キー: 各 Sway パラメータの {−1, 0, +1} の3キー。**0 = 恒等**（rest そのまま）
- ±1 の場: 固定線より下の格子点 p を、**ピン c = (x_c, y_fix) まわりの真の2D回転**（弧を描く、y も動く）で回す:

```
θ(p) = ±30° × W(y)
W(y) = smoothstep(clamp((y − y_fix) / h_band, 0, 1))    ※smoothstep = 3t²−2t³
h_band = 0.25 × 自由長px（系統ごと）
x_c = その系統の固定線行の水平中心（rest 格子から算出）
```

- 固定線より上（y ≤ y_fix）は**完全不動**（符号反転線を跨がない則の同型: 遷移帯は固定線の下側にのみ置く）
- **+1 = 画面右への振り切り**（y-down で時計回り = θ 正）。左右系統は同一パラメータ・同方向
- 隠蔽維持拘束・格子規則（レシピ06）は全て適用

## 3. dynamics グループ4個（数値確定済み。そのまま payload 化する）

共通: output = {segmentIndex: 1, scale: 0.0333, limit: 1}（ゲイン=1 規定: 1.0 = 30°）、gravityScale 1.0、rootOffset は cm。

| group id | 出力パラメータ | inputs（kind / scale） | rootOffset | segmentLengths | damping |
|---|---|---|---|---|---|
| dyn_hair_front_sway_x | param_hair_front_sway_x | FaceX posX **0.031** / BodyX posX **0.056** / FaceZ angle **0.3333** / BodyZ angle **0.6** / BodyZ posX **0.31** | (0, −3.1) | [8.6] | 2.5 |
| dyn_hair_side_sway_x | param_hair_side_sway_x | FaceX posX **0.037** / BodyX posX **0.067** / FaceZ angle **0.3333** / BodyZ angle **0.6** / BodyZ posX **0.31** | (0, −4.6) | [16.5] | 2.5 |
| dyn_hair_back_sway_x | param_hair_back_sway_x | FaceX posX **−0.006** / BodyX posX **−0.011** / FaceZ angle **0.3333** / BodyZ angle **0.6** / BodyZ posX **0.31** | (0, −3.1) | [46.8] | 2.2 |
| dyn_tie_sway_x | param_accessory_sway_x | BodyX posX **0.055** / BodyZ angle **0.6** | (−0.3, −23.0) | [19.0] | 3.0 |

### 数値の出自（全て実測 or 幾何、当てずっぽうゼロ）

- **angle scale**: FaceZ は実回転 ±10° を param ±30 で駆動 → 10/30 = 0.3333 deg/unit。BodyZ は ±6°/±10 → 0.6
- **positionX scale**: 固定線行の実測並進 ÷ 18px/cm ÷ param 振幅。実測値: FaceX+30 → 前髪 16.9px / 房 (23.4+16.8)/2 / 後ろ (−6.9+0.2)/2。BodyX+10 → 前髪 10.1px / 房 (14.1+10.1)/2 / 後ろ (−4.1+0.1)/2 / タイ 9.8px
- 後ろ髪の負符号は実測由来（後頭部 z<0: ヨーで顔と逆方向に動く）
- **rootOffset**: 髪 = FaceZ ピボット (995.5, 596) 基準の固定線高さ差。タイ = BodyZ ピボット (997.25, 1124) 基準
- **BodyZ posX 0.31** = 回転レバー差の線形化。髪の rootOffset は FaceZ ピボット基準なので、BodyZ 回転（ピボット y=1124）の根本運搬 ≈ 29.3cm レバーが欠ける。dx/unit = 29.3 × (0.6°×π/180) ≈ 0.31 cm/unit。タイは rootOffset が BodyZ 基準なので不要
- **L_eff の 2/3 則**: 一様質量棒の等価単振り子長。周期目安: 前髪 0.59s / 房 0.81s / 後ろ 1.37s / タイ 0.87s

### 縮退時の指示

同一 parameterId の kind 違い重複入力（BodyZ angle + BodyZ posX）が dry-run で reject された場合: BodyZ posX 入力を3グループとも落として続行し、報告に「レバー差未補償」と明記。

## 4. パラメータについて

Sway 4本（param_hair_front_sway_x / param_hair_side_sway_x / param_hair_back_sway_x / param_accessory_sway_x、range −1..+1、default 0）は**プリセット常在**（parameters.json に無くてもサーフェスに存在）。createParameter は不要・禁止（プリセット id は locked）。

## 5. 検証（実装者の自己チェック）※fix1 では §6 の検証を優先

1. dry-run → commit、1 op = 1 コミット、コミットメッセージ [cp16] 接頭辞
2. **0キー恒等**: 全 Sway=0 の rest フルレンダが着手前レンダと sha256 一致（新ワープ挿入が絵を1px も変えないこと）
3. **人間補正ガード**: rig_bodyx_tie / topwear 系の既存キーは機械再生成禁忌（今回は触らないはずだが、diff で無傷をバイト確認）
4. sweep: 各 Sway −1/0/+1 のレンダ（全身 + 該当部フォーカス）で: 固定線不動 / 回転弧（水平シアーでなく弧）/ 左右同方向 / 隠蔽維持 / +1 が画面右
5. validatePackage: dynamics 起因の新規診断ゼロ（既存の runtime-evidence 系 error は既知・対象外）

---

## 6. fix1 改訂（2026-07-05 ユーザー gate による。§2 の場と §3 の inputs を上書きする正）

### 6.1 診断（何が悪かったか）

1. **重力の二重計上**: 静的 Z リグ（cp13/cp15）は重力の定常状態を既に焼き込んでいる（FaceZ 保持の静止絵 = 髪が世界で真下）。dynamics の angle 入力は保持で θ_local=−φ に静定するため、重力オフセットが二重に払われ、静定が真下を通り越す。**役割分担の正: 静的リグ = 定常、dynamics = 過渡のみ**。頭の傾きの真の励起は根本の弧並進だけなので、Z系入力も positionX（レバー並進）にする。angle kind は本モデルでは不使用
2. **板の回転**: ±1 の場が「固定線中央の1点ピンまわりの全格子回転」だったため、幅の広いカーテンで右端が沈み左端が浮く（斜め重力の見た目）+ 弧の伸縮。正しくは**列ごとの振り子**
3. 振れ始めの明確な境界（smoothstep 帯 + 帯外一定）→ 連続成長則へ

### 6.2 揺れモード場 v2（キーフォームの正、±1 キーのみ再生成。0 キーは恒等のまま）

各格子点 p = (x, y) について:

```
y ≤ y_fix: 完全不動
y > y_fix:
  s  = y − y_fix                     （px、列内の根からの深さ）
  θ(s) = ±30° × (s / L_free_px)^κ,  κ = 1.0（ワンノブ。既定は線形成長）
  dx = s · sin(θ(s))
  dy = s · (cos(θ(s)) − 1)           （弧の縮み上がり。これが伸縮の見た目を殺す）
```

- **ピンは列ごと**（各点の根 = 同じ x の固定線上の点）。単一ピンの全体回転は禁止
- 境界なし: θ は根で 0 から毛先 30° まで連続に育つ（フェードイン、折れ目なし）
- L_free_px は §1 の系統別自由長（L/R は各自の実長を使ってよい。振り切り角は共通 30°）
- +1 = 画面右（dx > 0）。左右系統は同方向

### 6.3 dynamics 設定 v2（updateDynamicsGroup ×4。全入力 positionX、angle 全廃）

Z系レバー = |y_fix − pivot_y|/18 cm × (deg/unit × π/180)。FaceZ pivot y=596（0.3333°/unit）、BodyZ pivot y=1124（0.6°/unit）。rootOffset は angle 入力が無くなるため不活性 → (0,0) に更新（混乱防止）。chain・output・damping は変更なし。

| group | inputs（全て positionX、cm/unit） |
|---|---|
| dyn_hair_front_sway_x | FaceX **0.031** / BodyX **0.056** / FaceZ **0.018** / BodyZ **0.34** |
| dyn_hair_side_sway_x | FaceX **0.037** / BodyX **0.067** / FaceZ **0.027** / BodyZ **0.36** |
| dyn_hair_back_sway_x | FaceX **−0.006** / BodyX **−0.011** / FaceZ **0.018** / BodyZ **0.34** |
| dyn_tie_sway_x | BodyX **0.055** / BodyZ **0.24** |

（導出: front/back FaceZ = 3.11cm×0.005818rad ≈ 0.018、房 4.64cm→0.027。BodyZ フルレバー: front/back 32.4cm×0.010472 ≈ 0.34、房 34.0cm→0.36、tie 23.0cm→0.24。旧 0.31 は rootOffset 補償前提の部分レバーだったため置換）

### 6.4 fix1 の検証

1. ±1 キー再生成6基 + updateDynamicsGroup 4個。0 キーと既存キー（88 keyformSet）はバイト無傷
2. **静定不変量（新・機械保証の言明）**: 全入力が positionX のため、任意の入力保持での定常出力は構造的に 0 = 静的ポーズと一致。dynamics 定義に angle 入力が1つも無いことを機械 assert
3. sweep ±1: 各列の毛先変位が (s·sinθ, s(cosθ−1)) と一致（巻尺）/ 板回転の消滅（左右端の dy が対称）/ 固定線不動 / 隠蔽維持
4. rest フルレンダ sha256 が現状と一致（±1 キーと dynamics 定義だけの変更で rest の絵は不変）

---

## 7. fix2 改訂（2026-07-05 ユーザー gate 第2round。§6.2 の場を上書きする正）

### 7.1 診断

fix1 の場（点ごとの弦: 深さ s の点をピンから距離 s に置く）は、θ が s とともに育つため**隣接点間隔が伸びる**——伸長率 √(1+(s·θ′)²)、毛先で約13%の実伸び。ユーザー指摘「X方向遷移しか持たず毛が伸びて見える」は実測可能な伸びである。**揺れモード場は等長写像でなければならない**（揺れ根元からの毛の長さ不変の拘束。新不変量）。

### 7.2 揺れモード場 v3（等長の振り子曲線。±1 キーのみ再生成、0 キー恒等）

各格子列（x 固定）、固定線より下の点 p = (x, y)、s = y − y_fix について:

```
θ(t) = ±30° × (t / L_free_px)^κ,   κ = 0.5（剛性ダイヤル: →0 剛体振り子 / 1 鞭）
位置(s) = (x, y_fix) + ∫₀ˢ ( sin θ(t), cos θ(t) ) dt
```

- 接線が常に単位長 → **弧長厳密保存（伸びゼロの構造保証）**。毛先は弧を描いて上（−y）へ持ち上がる（κ=0.5 の毛先目安: dx ≈ 0.34·L_free、dy ≈ −0.07·L_free）
- 数値積分: 刻み ≤1px の台形則（決定論）。y ≤ y_fix は完全不動
- +1 = 画面右、左右同方向、隠蔽維持は従前どおり

### 7.3 前髪の固定線引き上げ（額の房を揺れ域に入れる）

- 前髪のみ y_fix **540 → 454**（格子第5行に行スナップ。目と目の間の房が揺れ域に入る）
- L_free_front = 773 − 454 = **319px**。他5系統の y_fix・L_free は不変
- 整合更新（updateDynamicsGroup、front のみ）: chain.segmentLengths **[11.8]**（= 2/3×319/18）、inputs の FaceZ posX **0.046**（=(596−454)/18×0.005818）、BodyZ posX **0.39**（=(1124−454)/18×0.010472）。FaceX/BodyX の実測 scale・damping・output は不変

### 7.4 fix2 の検証

1. **等長 assert（新設・最重要）**: 各列の折れ線長（固定線→毛先）が rest と一致（誤差 ≤0.1%）を全列×±1 で機械確認
2. **毛先の持ち上がり**: 各系統 ±1 で毛先行の dy < 0（上方遷移の存在）を巻尺確認
3. 固定線以上 0.000px / 0キー・既存キー（88 keyformSet + 人間補正名指し）バイト無傷 / rest フルレンダ sha256 現状一致 / dynamics に angle 入力ゼロ維持
4. sweep レンダ（fix2- 接頭辞）: 前髪フォーカスで額の房が揺れること、伸びの見た目の消滅
