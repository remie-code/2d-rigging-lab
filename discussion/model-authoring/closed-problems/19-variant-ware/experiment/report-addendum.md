# cp19 追補レポート（cp19b: 下半身素材のデフォーマ所属）

> 実装: Fable 三十二代目（2026-07-06）。ユーザー指示 2026-07-06 が仕様の正:
> テクスチャアトラス生成は「デフォーマに属する素材」だけを対象とするため、動かさない下半身素材も
> キーフォーム無しデフォーマへ形式所属させる。cp19 未解決質問2への回答実装でもある。
> 対象パッケージ: C:/workspace/remie/rigging/llm-rigging

## 工程ログ

### 0. 前提確認 + 棚卸し（済）

- rigging ワークスペース `git status` クリーン、packageRevision = **601**（cp19 終了時と同値）
- pre レンダ renders/addendum-pre-rest-full.png sha256 =
  `edf41235c37955fe596a4d3fb11df17511cf55e8ef3b12e44126e04b499a830b` = **cp19 最終 sha と厳密一致**（状態不動の証跡）
- snapshot-pre-addendum.json: rev=601, keyformSets=107, rigControls=103, meshes=132, drawables=132
- 対象 drawable 棚卸し（実 ID は design-values-addendum.json が一次ソース）:

| 素材 | drawable | 着手時状態 |
|---|---|---|
| legwear | draw_r0_1cea4f6f_c7ac42f2_legwear | vis=true, 空メッシュ, rig 親なし |
| footwear | draw_r0_1cea4f6f_c7ac4230_footwear | vis=true, 空メッシュ, rig 親なし |
| tail | draw_r0_1cea4f6f_c7ac4211_tail | vis=true, 空メッシュ, rig 親なし |
| endomi_back | draw_r0_1cea4f6f_c7ac42d3_endomi_back | **vis=false**, 空メッシュ, rig 親なし |
| 通常 bottomwear | draw_r0_1cea4f6f_26f93eaa_bottomwear | vis=true, **308v メッシュ有り**, rig 親なし |
| rodos bottomwear | draw_r0_1cea4f6f_a43f15a4_bottomwear | vis=true(variant ゲートで隠蔽), 192v, rig 親なし |
| endo bottomwear | draw_r0_1cea4f6f_8b5c5469_bottomwear | vis=true(variant ゲートで隠蔽), 308v, rig 親なし |

- **導出判断1**: 通常 bottomwear は既にメッシュ有り → generateMesh 対象外（指示の「無ければ」条項該当せず）
- **導出判断2（可視旗）**: endomi_back は vis=false。variant ゲート = baseVisible AND 所属（cp19 実測）のため、
  検証2（Endoministrator 選択で出現）の成立には setRuntimeVisibility=true が必要。cp19 の
  「所属先行・可視旗後行」に従い、**最終 op で true 化**する（仕様に明示は無いが検証2の成立条件からの導出。報告に明記）
- **罠の予防（cp14 craft）**: 空メッシュを deformer 配下に入れると bounds ゼロ化で評価から消える
  → 順序 = 所属(E) → メッシュ生成(F) → デフォーマ作成(G) → 可視旗(H)。仕様の順序（所属→mesh→deformer）とも整合

### 計画 op 列（9 op、1 op = 1 git commit、[cp19b] 接頭辞）

- E1: addVariantTargetDrawable(vgrp_ware, endomi_back)
- E2: setVariantMembership(vgrp_ware, endomi_back, var_endoministrator, member=true)
- F1〜F4: generateMesh(legwear / footwear / tail / endomi_back)
- G1: createWarpDeformer "Bottoms Static"（ルート直下・キー無し・子6 = legwear/footwear/tail/通常bw/rodos bw/endo bw）
- G2: createWarpDeformer "Endomi Back Carrier"（rig_bodyz_upper_body 配下・キー無し・子 = endomi_back）
- H1: setRuntimeVisibility(endomi_back, true)

（以降、各バッチ実行後に漸進追記）

### 1. Batch E: endomi_back の所属（済）

- addVariantTargetDrawable → rev 602 / setVariantMembership(var_endoministrator, member=true) → rev 603
- dry-run 全 auto-approved、reject ゼロ。メッシュ生成より先に所属を組む仕様順を厳守

### 2. Batch F: メッシュ生成 ×4（済）

- legwear **350v** / footwear **168v** / tail **209v** / endomi_back **346v**（rev 604→607）
- 実測 bbox（モデル座標）: legwear [768,1401]..[1223,2706] / footwear [829,2615]..[1147,2946] /
  tail [1070,1379]..[1422,2468] / endomi_back [723,566]..[1352,2259]

### 3. Batch G: キー無しワープ2基（済）

- **rig_bottoms_static** "Bottoms Static": ルート直下（parent=ROOT、rigControlRootIds に追加）、
  子6 = legwear/footwear/tail/通常bw(26f9)/rodos bw(a43f)/endo bw(8b5c)、lattice 6×13、
  domainBounds = 子6メッシュ union bbox+10px = {x:659, y:1107, w:793, h:1869} → rev 608
- **rig_endomi_back_carrier** "Endomi Back Carrier": rig_bodyz_upper_body 配下、子 = endomi_back、
  lattice 5×12、domainBounds = {x:713, y:556, w:669, h:1733} → rev 609
- 両方 bezier 2×2（既存101基の相場に一致）。**keyformSets は107本のまま・新 rig 参照ゼロ = キー無しの機械確認**

### 4. Batch H: endomi_back 可視旗（済、1回様式ミスあり）

- 初回 dry-run は**私の payload 様式ミス**（drawableId/visible と書いた。正= target{kind,id}+runtimeVisibility）で
  入口 ZodError → モデル無傷・commit なし。修正して rev 610 で commit
- 教訓: setRuntimeVisibility の payload は target ref 形式（cp19 の commands/show-*.json が一次ソース）

### 5. 集計（op フェーズ）

- committed op **9**（target 1 / membership 1 / mesh 4 / deformer 2 / show 1）、rev **601→610**、
  git commit 9（[cp19b] 接頭辞）、commit された reject ゼロ

### 6. 検証4点

#### 検証1 Default rest（legwear/footwear/tail 出現・endomi_back 不出現・差分局在）: **PASS**

- renders/addendum-post-rest-full.png（選択指定なし）sha256 = `49742d9b…`（pre から変化 = 意図した出現）
- 差分画素局在（cp14 手続き、cp15/17 diff-pixels.ps1 = LockBits 直読み）: **diff=46,111px、
  bbox=フレーム(265,797)..(588,1023) = ステージ座標 ≈ [768,1557]..[1398,1998]**
  - 期待領域（legwear/footwear/tail の union bbox のフレーム内部分 x[768,1422]×y[1379,2000]）に**完全内包**
  - 上端 y=1557 は「スカートに隠れる分は描画順が処理」の実証（スカート裾 y≈1595 の上は不変）
  - endomi_back 領域（上端 y=566 → フレーム y≈290）に差分ゼロ = **Default rest に背負い物は出現しない**
- 目視: ニーソ+ガーター（legwear）と縞尻尾（tail）がスカートの下に自然に出現。破綻なし

#### 検証2 Endoministrator 選択 + BodyZ 追従: **PASS**

- renders/addendum-endo-rest-full.png vs cp19 switch-endoministrator-rest.png: diff=44,463px、
  bbox 上端 = フレーム y=290 → ステージ y=566.4 = **endomi_back メッシュ上端(566)と厳密一致** = 出現の機械証跡
- 回転追従（inspectEvaluatedGeometry、Endo 選択 + param_body_angle_z=±10、pivot 997.25/1124 で回転フィット）:
  - **endomi_back: fitAngle = ±6.0000°、最大残差 0.000px** = 直接の子 back_hair と完全一致
  - = BodyZ 追従・キャリア warp の変形ゼロ（キー無し恒等）の数値証明
  - legwear（Bottoms Static の子）: BodyZ ±10 で **最大移動 0.000000px** = 静的デフォーマは動きを足さない
- 目視（addendum-endo-bodyzmax-full.png）: コート・セーター・肩の黄色い機構部（endomi_back）が一体で傾き、脚部不動

#### 検証3 可視集合 assert 14ターゲット: **PASS**（verify-visibility14.mjs）

- 4走（Default 明示 / Rodos / Endoministrator / 選択省略）× **14ターゲット**（cp19 の13 + endomi_back）完全一致
- Default/implicit: 5枚可視（ware4+tie）/ Rodos: 4枚 / **Endoministrator: 5枚（endo4 + endomi_back）**
- resolved variantSelections echo も全走一致（implicit = var_default 解決）

#### 検証4 既存無傷 + validatePackage: **PASS**（verify-intact-addendum.mjs）

- keyformSets **107本全バイト無傷**（新 rig への参照ゼロ = キー無しの構造証明）
- rigControls 差分 = 宣言3件のみ: 新規2基（rig_bottoms_static / rig_endomi_back_carrier）+
  rig_bodyz_upper_body の childRigControlIds 末尾追加のみ（他フィールドはバイト一致）。既存103基中102基バイト一致
- meshes 差分 = 宣言4件（legwear/footwear/tail/endomi_back の空→生成）のみ / drawables 差分 = endomi_back
  runtimeVisibility false→true の1件のみ
- 変化ファイル = drawables/graph/meshes/rig-controls/variants の5つのみ（keyforms/parameters/dynamics/masks/draw-order 不変）
- validatePackage strict: **success・diagnostics 0**（想定した runtimeEvidenceMissing 系すら出ず、cp19 終了時と同水準を維持）

### 7. 集計（最終）

- committed op **9** / rev **601→610** / git commit 9（[cp19b]）/ commit された reject ゼロ / rigging ワークスペース git クリーン
- 入口エラー1回（Batch H 初回、setRuntimeVisibility payload 様式ミス = ZodError、モデル無傷・修正後通過）

### 8. craft への示唆

1. **「動かさない素材もデフォーマへ形式所属」の様式が確立**: createWarpDeformer をキー無しで打つだけ。
   キー無し warp は恒等（fitAngle 残差 0.000px / 頂点移動 0px で実証）で、validatePackage strict も diagnostics 0 のまま
   ——アトラス対象化のための所属は描画に対して完全に無害
2. **順序則の追補**: 所属(variant)→メッシュ→デフォーマ→可視旗。cp14 の「空メッシュを deformer 配下に入れると
   bounds ゼロ化」を、仕様側の「所属をメッシュより先に」（variant ゲートで rest 出現を封じる）と合成した4段
3. **setRuntimeVisibility の payload は target ref 形式**（{target:{kind,id}, runtimeVisibility}）。
   スキーマ外 payload は host 入口の ZodError（envelope エラー・diagnostics 0）になり operation reject とは形が違う
   ——「dryrun: outcome=error, diagnostics=0」を見たら payload 様式を過去 commands/ で照合する
4. 追従だけさせたい素材は「親 rig の直下にキー無し warp を挟んで子にする」で足りる（endomi_back = BodyZ 追従・
   変形なし）。回転は親 rotation2d が処理し、warp は所属の器として振る舞う
5. 検証様式の流用性: cp19 の verify-visibility/verify-intact は所属表を design-values(+addendum) に差し替えるだけで
   再利用できた。差分画素局在は「期待領域 = 対象メッシュ union bbox のフレーム内クリップ」との内包判定が機械形

## 残タスク（ユーザー / L0 へ）

- 成功基準のユーザー gate（Editor プレビュー / runtime-player でのライブ確認）は未実施——ユーザーの目を待つ
- cp19 未解決質問2（endomi_back の将来処置）は本追補で回答済み: mesh 生成 + var_endoministrator 所属 +
  BodyZ 追従キャリア配下として実装
