# cp12 FaceZ 回転コア — 設計ログ（主役 = rotation2d 操作様式の初記録 + ピボット従属性仮説の検証）

作業: `param_face_angle_z`（preset、−30..30、max=時計回りロール）に対し、**本ワークスペース初の回転デフォーマ（rotation2d）1基**を新設し、BodyX 頭部剛体14塔を wrapChildren で一括。キーは angleDegrees 三点（±10°、控えめ=上品開始）。**translation キーは1本も打っていない**（ピボット仮説の検証設計）。
ワークスペース: `C:/workspace/remie/rigging/llm-rigging`（開始 rev 361 → 終了 rev 363。開始時 working tree clean）。**2 op = 2 git commit（[cp12]）、reject ゼロ（dry-run 一発通過）。目視イテレーション予算1回は未消費**。生成器 `gen-facez-rotation.mjs`（gen / snapshot / verify の3モード）が全数値の一次ソース。

## rotation2d 操作様式（craft 新ページの原料——CLI 実通過で確定した形）

### createRotation2dRigControl の成功 payload（そのまま使える現物）

```json
{
  "operationType": "createRotation2dRigControl",
  "payload": {
    "displayName": "FaceZ Head",
    "pivot": { "x": 995.5, "y": 596 },
    "restAngleDegrees": 0,
    "wrapChildren": [ { "kind": "rigControl", "id": "rig_bodyx_face" }, "…(14本)" ]
  }
}
```

- 封筒は warp と完全同型（`ai-command-request-v1` → `operation-request-v1`、dryRunOperation → commitOperation の2プロセス。apply-op.mjs 無改造で通る）
- **必須は displayName / pivot / restAngleDegrees の3つ**（zod: pivot=Vec2 必須・restAngleDegrees=finite 必須。domainBounds・格子次元は無い——回転デフォーマは domain を持たない）
- `restTranslation {0,0}` / `restScale {1,1}` はホストが自動充填（payload で指定不可。生成後に updateRigControl で編集可能）
- `wrapChildren` は warp と同じ排他モード（childDrawableIds/childRigControlIds・insertBeforeChild と併用不可）。挙動も同一: 新デフォーマが root 化し、包んだ塔の parentId のみ書き換わる
- 生成 ID は displayName のスラグ: "FaceZ Head" → `rig_facez_head`
- modelDiff: added=[rig_facez_head]、changed 17（本体 + roots + 14 parentId + package 行）。reversible: true
- dry-run 診断: **ゼロ**（autoApproved: no-blocking-diagnostic）。reject 経験なし——warp で既知の様式（dry-run→commit、basePackageRevision 追跡）がそのまま通用し、rotation2d 固有の罠は現れなかった

### editKeyformKey（angleDegrees——rotation2d 専用プロパティ）の成功 payload

```json
{
  "operationType": "editKeyformKey",
  "payload": {
    "action": "createEndsCenter",
    "target": { "kind": "rigControl", "id": "rig_facez_head" },
    "targetProperty": "angleDegrees",
    "parameterId": "param_face_angle_z",
    "interpolation": "linear-1d-v1",
    "compositionMode": "replace",
    "statePatches": {
      "min":     { "propertyPath": "angleDegrees", "value": -10 },
      "default": { "propertyPath": "angleDegrees", "value": 0 },
      "max":     { "propertyPath": "angleDegrees", "value": 10 }
    }
  }
}
```

- **statePatch の value は素の数値1個**（warp の Vec2[] と違い、キー1本 = スカラー1個。ゲイン調整 = updateCurrent で数値2個を書き換えるだけ——warp の全格子点一括より2桁軽い）
- `translation` を打つ場合は value が Vec2 `{x,y}`（authoring-core 確認。rotation2d 専用。compositionMode は replace|additiveDelta の2択——warp controlPointOffsets と同じ）
- propertyPath は targetProperty と一致必須（不一致は statePatchPropertyMismatch reject）
- 生成された keyformSet: `keyset_rigcontrol_rig_facez_head_angledegrees_face_angle_z`、compositionMode replace（rest 角 0 を置換）

### 角度の符号（canvas-y-down-v1 での読み）

runtime の回転行列は (a=cos, b=sin, c=−sin, d=cos)。**y-down キャンバスでは正の angleDegrees = 画面上で時計回り**。`param_face_angle_z` preset の符号規約（min=反時計回りロール / max=時計回りロール）と**そのまま符号一致**する——min キーに −10、max キーに +10 を素直に置けばよい（反転不要）。

## pivot の決定過程

素材実測（rev 361、inspectEvaluatedGeometry、rest）:

| 素材 | bbox |
|---|---|
| neck | x 944..1047（中心 995.5）、y 547..645（中心 596） |
| face（顔輪郭） | x 862..1138、顎下端 y 577 |
| neck_back | x 924..1073、y 566..639 |

**pivot = (995.5, 596)** = 首 bbox の中心。x は首の正中（顔中心 x=1000 と 4.5px 差で整合）、y は顎下端 577 から 19px 下 = 首の縦中心。「顎下・首の中心」の相場をそのまま実測に落とした。レンダ較正の必要は生じなかった（1回目で gate 材料まで成立）。

## ピボット従属性仮説の検証結果: **成立（translation 0 で首から外れない）**

> 仮説: 「傾けただけだと首から外れる」問題は、pivot を首の付け根に正しく置けば構成的に消える。ピボット P 周りの回転 = 原点回転 + 並進 (I−R)(P−O) が生成時 pivot 指定で自動化されるため、translation キーは不要のはず。

- **手順**: translation キーを一切打たず（restTranslation {0,0} のまま）、angleDegrees 三点キーのみで ±30 レンダ → 首の付け根ズーム（zoom-neckbase-min/max）を確認
- **結果**: ±10° の両端で顎と襟の間の首肌に裂け・段差・露出なし。顎は pivot 周りの弧で振れ、首（非メンバー）は静止のまま接続が保たれる。**pivot 再配置も translation 補正も不要だった**——補正手順は一度も発動していない（発動しなかったこと自体が検証データ）
- 数値の裏付け: 首 drawable の評価後頂点は全パラメータ値でバイト不変（assert-rotation.mjs の対照行）。顎側は正確な等長変換なので、付け根の相対ズレは「回転の幾何そのもの」だけ——±10° 級では顎下の重なり余白内に収まる
- **残余ダイヤルとしての translation は未使用のまま温存**（角度を ±20° 級に上げる場合は再検証が要る——露出は θ に対し単調に開く）

## 剛体性と「中間でも回転」の機械検証（assert-rotation.mjs——warp との本質差）

評価後頂点 = R(pivot, θ(v))·rest頂点 を全頂点で照合（θ(v) = v/30 × 10°）:

| param_face_angle_z | 期待θ | face maxErr | headwear maxErr | neck（非メンバー、期待θ=0） |
|---|---|---|---|---|
| +30 | +10° | 6.4e-11 | 1.2e-10 | 0（バイト不変） |
| **+15（中間）** | **+5°** | 1.3e-10 | 2.3e-10 | 0 |
| **+10（中間・非等分点）** | **+3.33°** | 1.6e-10 | 2.9e-10 | 0 |
| −30 | −10° | 6.5e-11 | 1.2e-10 | 0 |

- **中間パラメータでも厳密に「角度 θ(v) の剛体回転」**——keyform 補間が angle 空間で走る（linear-1d が角度を補間 → 行列は評価時に生成）ため、頂点は弦でなく**弧を描く**。warp の格子点線形補間では原理的に得られない性質（ユーザー指摘の実証）
- **剛体性は構成的**: 14塔が単一 rotation2d の子なので、頭部内の全相対関係（眼鏡×目・帽子×髪・口×顎）は全パラメータ値で同一の等長変換を共有する。要素ごとの field 設計はゼロ——warp 14枚で作っていたら不可能だった保証が、親1基で自動成立
- 目視確認: zoom-head-min/max/mid で帽子・眼鏡・目・眉・口・前髪・耳が一塊でロール。z-sweep7-full で頭部が弧を描く

## 不触の保証（gen-facez-rotation.mjs verify——全 PASS）

- **既存 keyformSet 74本全部 canonical 一致**——人間補正キー（帽子X = rig_facex_headwear、topwear・tie）を**名指しで確認**。新規は FaceZ の1本のみで内容も期待値一致
- **rig control**: 新規 rig_facez_head 以外は、**wrap の機構上変わる BodyX 14本の parentId のみ**が変化（**parentId 除外 canonical 一致 + parentId=rig_facez_head の期待値照合**——cp11 の教訓の型がそのまま rotation2d でも成立）。他56本はバイト一致。graph roots は「14本除去 + rig_facez_head 追加」のみ
- **メッシュ全数バイト一致**（cp12 はメッシュ op ゼロ）
- **レンダ回帰 9/9 バイト一致**（rest / X±30 / Y±30 / **BodyX±10** / 合成（X−30+半目+眼球−1）/ blink——FaceZ=0 で恒等、sha256 一致）
- validatePackage strict: **error 81 / blocking 0**——既存3クラスのみ、rigControl.runtimeEvidenceMissing 70→71 = 新規1基の機械的加算。新クラスなし

## 織り込み（仕様どおり付いてこないもの）

房 L/R（rig_bodyx_hair_f_l/r）・後ろ髪 L/R（rig_bodyx_back_hair_l/r）は回転メンバーから除外（重力律則——cp13 で専用ワープ）。首・胴体系も除外（回らない）。±30 全身レンダでは、側頭の房はほぼ鉛直のまま残るが付け根はおおむね頭髪に遮蔽され、全身スケールでの破綻感は小さい（【ユーザー gate】での織り込み確認事項。zoom-head-min/max の側頭部が判定材料）。

## レンダ（renders/）

- z-min30-full / z-rest-full / z-plus30-full / **z-plus15-full（中間）** / **z-sweep7-full**（全身7段、gate 材料）
- zoom-neckbase-rest/min/max（首の付け根ズーム = ピボット仮説の判定材料）
- zoom-head-rest/min/max/mid（頭部相対関係ズーム = 剛体性の判定材料）
- base-* / post-*（回帰9対、sha256 一致）

## craft への指摘（レシピ新ページ「回転デフォーマ」の骨子）

1. **rotation2d は「field 設計ゼロ」のデフォーマ**——設計対象は pivot（Vec2 1点）と角度スカラーだけ。warp の格子解像度・domain・z プロファイルの議論が全部消える。回転が画面内で起きるパラメータ（Z 系ロール）はこれ一択（warp 端点打ちは中間で弦に潰れる——本問題の出発点）
2. **pivot は生成時に正しく置く**: 巻尺で関節相当部（首の付け根 = 首 bbox 中心）を実測して初期値にする。pivot が正しければ translation キーは不要（本実証）。後から直す場合も updateRigControl に pivot がある
3. **キー作法**: targetProperty `angleDegrees`（スカラー）/ `translation`（Vec2）は rotation2d 専用、warp に打つと unsupportedTargetProperty reject（craft 既知の裏返し）。createEndsCenter + replace が基本形。**ゲイン調整は min/max の数値2個の updateCurrent**——warp より2桁軽い演出ダイヤル
4. **符号**: y-down では正角 = 画面時計回り。face/body の Z 系 preset（max=時計回りロール）と符号がそのまま一致
5. **剛体グループは wrapChildren 一括が正着**: 塔を1本ずつ包むのではなく1基で14塔を包む——剛体性が構成で出る。verify は cp11 の「parentId 除外 canonical + parentId 期待値」型がそのまま使える
6. **1 op での一括 wrap は modelDiff が読みやすい**（added 1 + changed 17）。warp 系18塔×各1 op（cp11）との違いは、回転が「1グループ = 1デフォーマ」であること——1要素×1パラメータ=1層の原則は「1剛体グループ×1パラメータ=1基」と読み替える

## 実行 op 一覧

| # | op | rev | git |
|---|---|---|---|
| 1 | createRotation2dRigControl（FaceZ Head、pivot=(995.5,596)、wrap 14塔） | 361→362 | 1974717 [cp12] |
| 2 | editKeyformKey angleDegrees createEndsCenter（−10/0/+10°） | 362→363 | 207f63e [cp12] |

## エスカレーション事項

なし。FaceZ preset は実在（param_face_angle_z、−30..30）、rotation2d は CLI を無修正で一発通過（A ギャップ発見なし——「op 実在確認済み・実通過は初」の残余不安は解消）、wrap も想定どおり。
