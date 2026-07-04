# cp14 BodyZ 回転コア — 設計ログ（主役 = rotation2d 入れ子の初記録 + wrap drawable 指定の実挙動）

作業: `param_body_angle_z`（preset、−10..10、max=時計回りロール）に対し、**rotation2d の入れ子初例**——BodyZ 回転（rig_bodyz_upper_body）が FaceZ 回転（rig_facez_head、rotation2d）を子として包む——を新設。wrapChildren で塔 root 10本 + **素の drawable 1枚（back_hair 影）** を一括。キーは angleDegrees 三点（±6°、首かしげ ±10° より浅い控えめ開始 = gate ダイヤル）。**translation キーは1本も打っていない**（ピボット従属性の再適用、成立）。
ワークスペース: `C:/workspace/remie/rigging/llm-rigging`（開始 rev 401 → 終了 rev 404。開始時 working tree clean、終了時 clean）。**3 op = 3 git commit（[cp14]）、reject ゼロ（dry-run 全部一発通過）。目視イテレーション予算1回は未消費**。生成器 `gen-bodyz-rotation.mjs`（gen / snapshot / verify）が全数値の一次ソース。

## 本問題の新未知①: rotation2d の入れ子 — **無風で通った**

- **wrap payload に rotation2d の子として rotation2d（rig_facez_head）を混ぜても、構造 reject なし・diagnostics ゼロ**（`autoApproved: no-blocking-diagnostic`）。authoring-core の wrap 検証は kind 非依存（root 同士なら混載可、というのが唯一の制約）で、rotation2d 固有の分岐は存在しない（`packages/authoring-core/src/rig-control-mutations.ts` の createWrapRigControlChildrenPlan を事前読解して確認、実通過で裏づけ）
- modelDiff: added=[rig_bodyz_upper_body]、changed 14（本体 + roots + 10 parentId + back_hair childDrawableIds + package 行）。reversible: true
- **Runtime の合成則を数値で確定**（assert-bodyz.mjs の INFO 行）: BodyZ=+10 × FaceZ=+30 の同時適用で、入れ子側 drawable（face / headwear）の評価後頂点 =
  **R_body(P_body, +6°) ∘ R_face(P_face, +10°) · rest**（maxErr 4.2e-10 / 5.7e-10）。
  つまり**親→子の順に、両方とも rest 座標系の pivot でそのまま合成**される。pivot の座標変換（親回転後の pivot 追従）を設計者が考える必要はない——階層評価が処理する。直属メンバー（topwear/tie/neck/back_hair）は同時適用でも R_body のみ（2.1〜4.0e-10）
- 目視（nested-bodyzmax-facezmax / nested-bodyzmin-facezmin、記録のみ・修正なし = Runtime 責務ポリシー）: 首・襟の接続を保ったまま頭部が胴の 6° の上にさらに 10° 転がる。裂け・二重像・pivot 飛びなし

## 本問題の新未知②: wrapChildren の drawable 指定 — **構造は通るが「空メッシュの罠」がある**

- スキーマ・mutation とも `{ kind: "drawable", id }` を rigControl と混載可。未結線（どの rig control にも属さない）drawable は親判定に関与せず root 群 wrap に混ざれる。**op は一発通過**
- **罠**: back_hair 影 drawable のメッシュは**空のプレースホルダ**だった（`mesh_r0_1cea4f6f_f2691773_back_hair`、vertices 0。同種の空メッシュが 90 枚ある——未 rigging 部品は全部これ）。**空メッシュのまま deformer 配下に入ると、評価が頂点範囲ベースに切り替わり bounds {0,0,0,0}・頂点 n=0 になる**（rev 403 の `commands/assert-geom-rest-rev403-premesh.response.json` が現物証拠。rest では宣言 bounds 853,195,299,508 だったものが消える）。= **wrap の drawable 指定は「実メッシュがあること」が事実上の前提**
- 対処 = op3: `generateMesh`（レシピ01の method `auto-outline-v6d-adaptive-contour-constrainautor`、剛体ライダーなので densityHint low）→ 95 頂点。以後 back_hair も R(pivot,θ) に厳密随伴（maxErr 4e-10）

## pivot の決定過程

素材実測（rev 401、inspectEvaluatedGeometry、rest）:

| 素材 | 実測 |
|---|---|
| bottomwear（スカート）上縁 | **x 914..1097 の帯で y=1124 フラット**（イン線が水平線として実在） |
| topwear | bbox x 782..1216（中心 999）、下端 y 1148（スカートと 24px 重なる） |
| neck | bbox x 944..1047（中心 995.5） |
| tie | bbox x 939..1046（中心 992.5） |

**pivot = (997.25, 1124)**。y はスカートのイン線実測値そのまま（bbox 角でなく胴中央帯の上縁プロファイルを読んだ——端は 1120 に上がるが腰帯は 1124 で水平）。x は「シャツ胴中心 999 と首中心 995.5 の平均」= 胴の正中。tie 中心とも 5px 以内で整合。レンダ較正は不要だった（1回目で gate 材料成立）。

## ピボット従属性: 再成立（translation 0 で腰から外れない）

±6° の全domainで、シャツ裾はスカートの 24px 重なり帯の中で回り、腰の接続は破れない（zoom-waist-min/max）。translation ダイヤルは未使用のまま温存。cp12 の ±10° に続き、**「pivot を関節実測に正しく置けば translation キーは不要」が2例目**。

## 剛体性と入れ子伝搬の機械検証（assert-bodyz.mjs — 全 PASS）

評価後頂点 = R(pivot, θ(v))·rest、θ(v) = v/10 × 6°。中間値含む4点 × 8 drawable:

| param_body_angle_z | 期待θ | direct 最大 maxErr（topwear/tie/neck/back_hair） | nested 最大 maxErr（face/headwear、BodyZ 単独適用） | bottomwear（非メンバー） |
|---|---|---|---|---|
| +10 | +6° | 4.0e-10 | 4.6e-10 | 0（バイト不変） |
| **+5（中間）** | **+3°** | 3.9e-10 | 4.5e-10 | 0 |
| **+3（中間・非等分点）** | **+1.8°** | 2.7e-10 | 3.1e-10 | 0 |
| −10 | −6° | 4.0e-10 | 4.6e-10 | 0 |

- **入れ子の子も BodyZ 単独適用時は外側回転を無劣化で透過**（FaceZ=0 で内側は恒等）——入れ子伝搬の gate 判定材料
- スカート（bottomwear、308頂点）は全パラメータ値でバイト不変 = 「スカートから下は不動」の機械証明。legwear は空メッシュ&非 wrap なので構成的に不動

## 回帰: keyform/モデルは完全無傷、レンダは back_hair リムのみ差分（原因は op3 の意図的リメッシュ）

- **verify 全 PASS**: 既存 keyformSet **80本全部 canonical 一致**（人間補正名指し: 帽子X・topwear・tie + cp12 FaceZ 角度キー + cp13 重力ワープ6本）。rig control は wrap 対象10本の **parentId のみ** 変化（parentId 除外 canonical 一致 + 期待値照合）、他66本バイト一致。メッシュは back_hair 1枚（空→実、意図した変化）以外 126 枚バイト一致。drawables.json バイト一致。roots = 10本除去 + BodyZ 追加のみ
- **レンダ回帰 11対（rest / X±30 / Y±30 / FaceZ±30 / BodyX±10 / 合成 / blink）は sha256 不一致**——ただし**全11対の差分画素を数値特定した結果、モデル座標 x≈936..1065, y≈283..610 の同一領域**（= back_hair 影が頭部シルエットから覗くリム、影 bbox x853..1152 y195..703 の内側）に限定。全身フレームで 147〜413 px（0.02〜0.05%）、ズームフレームは同じモデル領域が拡大されるため画素数だけ増える（blink 7054 px）。**空メッシュ quad 描画 → 実メッシュ描画のラスタ経路差**で、既存キーの挙動変化はゼロ（keyform canonical 一致が上位の証明）。**リメッシュを含む変更ではレンダのバイト一致は原理的に成立しない**——差分の数値局在化（画素 bbox をモデル座標に写像して対象 drawable の bbox と照合）が正しい回帰手続き
- validatePackage strict: **error 87 / blocking 0**。cp13 終了時（rev 401）の 86 に対し **+1 = rigControl.runtimeEvidenceMissing の機械的加算（新規1基分）**。既存3クラスのみ、新クラスなし

## 織り込み事項の記録（= 正しい状態の確認。cp15 引き継ぎ材料）

- **ネクタイ斜め固定**: zoom-tie-bodyzmin/max——タイは剛体としてシャツごと回り、振り子の垂れ直しはしない（先端の赤い V がシャツに縫い付いたまま傾く）。cp15 でぶら下がり補正
- **シャツ×スカート境界**: zoom-waist-bodyzmin/max——裾はスカート上で回り、±6° では 24px の重なり帯内。両者黒服なので視覚破綻は薄いが、裾の遠端（pivot から x±220px、垂直変位 ≈23px）で重なりの食い方が左右非対称になるのが見て取れる。cp15 のめり込み/隙間補正の出発材料
- **髪の垂れ直しなし**: bodyz-min/max-full——房・後ろ髪はぶら下がりの再鉛直化をせず頭部ごと剛体で傾く（重力律則の適用は cp15 以降の判断）

## レンダ（renders/）

- bodyz-min10-full / bodyz-rest-full / bodyz-plus10-full / **bodyz-sweep7-full**（全身7段、gate 材料）
- **nested-bodyzmax-facezmax / nested-bodyzmin-facezmin**（入れ子合成監視2枚、記録のみ）
- zoom-waist-rest/bodyzmin/bodyzmax（腰ズーム = スカート境界の記録）
- zoom-tie-rest/bodyzmin/bodyzmax（ネクタイズーム = 斜め固定の記録）
- base-* / post-*（回帰11対。差分は back_hair リムに限定、本文の数値局在化参照）

## craft への指摘（レシピ06 rotation2d 節への追記骨子）

1. **rotation2d の入れ子は「ただの wrap」**——新しい op も payload 様式もない。合成は親→子の順で、**両方の pivot とも rest 座標のまま**評価される（数値実証 4e-10 級）。角度キーは各層が独立に angle 空間で補間される。設計者の追加負担ゼロ
2. **wrap の drawable 指定は実メッシュ前提**: 未 rigging 部品のメッシュ record は「存在するが空（vertices 0）」——素の drawable を wrap する前に `meshes.json` の vertices 長を確認し、空なら **先に generateMesh**（推奨順序: メッシュ → wrap。逆順でも直せるが、回帰レンダ基線をメッシュ後に取り直せない）。空メッシュのまま deformer 配下に入ると bounds {0,0,0,0} で評価から消える
3. **リメッシュを含む問題の回帰は「バイト一致」でなく「差分の数値局在化」**: 全レンダ対の差分画素 bbox をモデル座標に写像し、意図的に触った drawable の bbox 内であることを機械照合する。keyform/rig control の canonical 一致が挙動不変の一次証明で、レンダは補助
4. **BodyZ の相場**: pivot はスカートのイン線（上縁プロファイルの水平帯を実測——bbox 角を使わない）× 胴の正中（シャツ・首・タイ中心の合議）。角度は首かしげより浅く ±6° 開始
5. 差分画像を作る際、GDI+ の DrawImage 経由でコピーしてから比較すると色管理で偽陽性が出る（LockBits 直読みで比較する）——本ログの数値は全部 LockBits 直読み

## 実行 op 一覧

| # | op | rev | git |
|---|---|---|---|
| 1 | createRotation2dRigControl（BodyZ Upper Body、pivot=(997.25,1124)、wrap 10塔+影1枚） | 401→402 | aa70d9d [cp14] |
| 2 | editKeyformKey angleDegrees createEndsCenter（−6/0/+6°） | 402→403 | f99e17a [cp14] |
| 3 | generateMesh back_hair 影（空プレースホルダ→95頂点、low） | 403→404 | 58e4fff [cp14] |

## エスカレーション事項

なし。BodyZ preset は実在（param_body_angle_z、−10..10、group body）、rotation2d 入れ子は構造 reject なしで一発通過（A ギャップ発見なし）、wrap drawable 指定も通過。発見は「空メッシュの罠」（上記②）で、op 追加1発で問題内で解決済み。
