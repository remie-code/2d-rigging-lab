# cp19 実験レポート（漸進書き）

> 実装: Fable 三十一代目（2026-07-06）。problem-definition.md が仕様の正。
> 対象パッケージ: C:/workspace/remie/rigging/llm-rigging（着手時 packageRevision 560、git クリーン確認済み）

## 工程ログ

### 0. 前提確認 + 棚卸し（済）

- rigging ワークスペース `git status` クリーン、packageRevision = 560（cp18 終了時と同値）
- pre rest フルレンダ（viewport 250,0 1500×2000）: renders/pre-rest-full.png
  sha256 = `edf41235c37955fe596a4d3fb11df17511cf55e8ef3b12e44126e04b499a830b`（**cp18 最終 sha と厳密一致** = 状態不動の証跡）
- snapshot-pre.json: rev=560, keyformSets=107, rigControls=103, meshes=132, drawables=132
- variants.json は空（variantGroups: []）
- 棚卸し（inventory.mjs、実 ID は design-values.json が一次ソース）:

| variant | drawable | 状態（着手時） |
|---|---|---|
| Default | ware/topwear `draw_r0_1cea4f6f_26f93e8b_topwear` | vis=true, 283v |
| Default | ware/bottomwear `draw_r0_1cea4f6f_26f93eaa_bottomwear` | vis=true, 308v |
| Default | ware/handwear-l `draw_r0_1cea4f6f_26f93ec9_handwear-l` | vis=true, 236v |
| Default | ware/handwear-r `draw_r0_1cea4f6f_26f93ee8_handwear-r` | vis=true, 231v |
| Default | tie `draw_r0_1cea4f6f_ea30e9c4_tie` | vis=true, 126v |
| Rodos | rodos_ware/topwear `draw_r0_1cea4f6f_a43f1585_topwear` | vis=false, 339v |
| Rodos | rodos_ware/bottomwear `draw_r0_1cea4f6f_a43f15a4_bottomwear` | **vis=true, 空メッシュ** |
| Rodos | rodos_ware/handwear-r `draw_r0_1cea4f6f_a43f1647_handwear-r` | vis=false, 249v |
| Rodos | rodos_ware/handwear-l `draw_r0_1cea4f6f_a43f1666_handwear-l` | vis=false, 250v |
| Endo | endoministrator/topwear `draw_r0_1cea4f6f_8b5c54ca_topwear` | vis=false, 339v |
| Endo | endoministrator/bottomwear `draw_r0_1cea4f6f_8b5c5469_bottomwear` | **vis=true, 空メッシュ** |
| Endo | endoministrator/handwear-r `draw_r0_1cea4f6f_8b5c542b_handwear-r` | vis=false, 246v |
| Endo | endoministrator/handwear-l `draw_r0_1cea4f6f_8b5c5408_handwear-l` | vis=false, 239v |

- **棚卸しの発見1（定義との差、解釈で処置）**: 定義の「通常の下衣 = bottoms part の衣類 drawable」に相当する描画実体は bottoms part に無い。bottoms part は legwear / footwear / tail（空メッシュ・可視・描画実績なし）+ endomi_back（空メッシュ・非表示）のみ。**通常下衣（スカート）は ware part 内の bottomwear**（cp18 レポートの「スカート＝本衣装 bottoms」もこれ）。定義の意図（今日の見た目の下衣）に従い ware/bottomwear を Default 所属とし、bottoms part の4枚は空メッシュ（描画実績なし・「今日の見た目」に不参加）としてターゲット外とした → 質問として最終報告に明記
- **棚卸しの発見2（罠の検出）**: 別衣装 bottomwear ×2 は cp18 の非表示化6枚に含まれず `runtimeVisibility=true` のまま空メッシュ。定義ステップ1の generateMesh をそのまま打つと rest レンダに出現する（cp18 §4-3 の罠の再演）。処置: **generateMesh の前に false へ倒す**（ステップ5の「8枚を true へ復元」の前提もこれで成立）
- reducer 実測（コード確認）: createVariantGroup(singleSelect) は initial variant を自動生成し defaultActive を自動設定 / addVariantTargetDrawable は空 membership を自動作成 / setVariantMembership・setVariantDefaultActiveSelection は同値で no-op reject → ステップ4の明示 op は**必ず no-op reject になる**ため、dry-run の reject メッセージ + committed variants.json 実測を「自動設定の確認」の証跡とする方針

### 1. 設営（済）

- 実験様式は cp18 から複製（apply-op.mjs / run-batch.mjs / read-cmd.mjs / snapshot-model.mjs）
- design-values.json = 所属表の一次ソース。gen-batches.mjs が batch-a/b/c/d.json を機械生成（a=4, b=3, c=26, d=8、計41 op）

### 2. Batch A: 可視旗封じ + メッシュ生成（済）

- **順序を定義から一箇所補正**: hide ×2 を generateMesh ×2 の**前**に置いた（棚卸しの発見2の罠封じ。定義ステップ1は mesh 生成のみ言及だが、ステップ5「8枚を true へ復元」は8枚が false である前提なので整合）
- rev 560→564、dry-run 全 auto-approved、reject ゼロ
- 生成メッシュ: rodos bottomwear 192v / endo bottomwear 308v（静的・rigging なし、定義どおり）

### 3. Batch B: グループ + variant（済）

- createVariantGroup（vgrp_ware, "Ware", singleSelect, initialVariantId=var_default, initialVariantName="Default"）→ rev 565
- **自動生成の実測**: committed variants.json で initial variant（var_default/"Default"）の自動生成と defaultActive={singleSelect, var_default} の自動設定を確認
- createVariant var_rodos("Rodos") / var_endoministrator("Endoministrator") → rev 566/567

### 4. Batch C: 所属（済）+ ステップ4の確認

- addVariantTargetDrawable ×13（rev 568→580）→ setVariantMembership ×13 member=true（rev 581→593）。**可視旗はこの段階では未接触**（所属先行・可視旗後行）
- addVariantTargetDrawable が空 membership を自動作成するため、membership は各対象1 op で完結、reject ゼロ
- **ステップ4（setVariantDefaultActiveSelection=Default）**: reducer は同値設定を no-op reject する（コード実測）ため、明示 commit は構造的に不可能。dry-run を流して観測: `operation.setVariantDefaultActiveSelection.invalidDefaultActive` — "Variant Group vgrp_ware already has the requested default active selection."（commands/set-default-active.json.dryrun-response.json）。**この reject メッセージ自体が「defaultActive は既に Default」の証跡**であり、定義の「自動設定の確認込み」をこれで充足（commit なし・無傷）

### 5. Batch D: 別衣装8枚の可視旗復元（済）

- setRuntimeVisibility=true ×8（rodos 4 + endo 4、rev 594→601）。variant ゲート（baseVisible AND 所属）が Default 選択下で8枚を隠すため rest 不変——検証1で立証

### 6. 検証4点

#### 検証1 Default 不変（最重要）: **PASS**

- renders/post-rest-full.png（選択指定なし = defaultActive 解決）sha256 =
  `edf41235c37955fe596a4d3fb11df17511cf55e8ef3b12e44126e04b499a830b` = **pre と厳密バイト一致**（cp18 最終 sha とも一致）

#### 検証2 可視集合の機械 assert: **PASS**（verify-visibility.mjs）

- 4走（Default 明示 / Rodos / Endoministrator / 選択省略= defaultActive 解決）× 13 ターゲット、期待集合と**完全一致**、resolved variantSelections echo も全走一致:
  - Default: ware 4枚 + tie = visible、rodos 4 + endo 4 = hidden（**ネクタイは Default のみ true**）
  - Rodos: rodos 4枚のみ visible / Endoministrator: endo 4枚のみ visible
  - 選択省略走行が Default 明示と同一結果 = defaultActive の解決を実測確認

#### 検証3 切替レンダ自己目視: **PASS**（renders/switch-{rodos,endoministrator}-rest.png）

- **Rodos**（sha b7f370a6...）: ベルト付き黒ジャケット+ショートパンツ+ストラップに完全置換。通常シャツ・ネクタイ・スカートの残留なし、重なり・欠けなし。手は素手（rodos handwear）
- **Endoministrator**（sha 8df21a95...）: ロングコート+白セーター+黒下衣に完全置換。残留・重なり・欠けなし
- 所見: 両衣装で首元にチェーン状アクセサリが見える（Default ではシャツ襟とネクタイの下に隠れる共有 drawable）。ターゲット外の共有パーツが衣装差で露出する自然な挙動であり破綻ではない。endomi_back（bottoms part、空メッシュ・非表示・ターゲット外）による欠けは目視上認められない

#### 検証4 既存無傷: **PASS**（verify-intact.mjs + validatePackage）

- keyformSets 107 本・rigControls 103 基とも**全バイト無傷**
- meshes 差分 = 宣言済み2件（bottomwear ×2 の空→生成）のみ / drawables 差分 = 6件（cp18 で false にされた6枚の runtimeVisibility false→true のみ。bottomwear ×2 は true→false→true でネット無変化 = バイト一致）
- model ファイル変化 = drawables.json / meshes.json / variants.json のみ（keyforms / parameters / rig-controls / dynamics / masks / draw-order / graph は sha 不変）
- validatePackage strict: success, **diagnostics 0**

### 7. 集計

- committed op **41**（hide 2 / mesh 2 / group 1 / variant 2 / target 13 / membership 13 / show 8）、rev **560→601**、git commit 41、commit された reject ゼロ（dry-run のみの意図的 reject 1 = ステップ4の証跡）
- 最終所属表 = committed variants.json 実測: targets 13、memberships 全13が期待 variant と一致、defaultActive = {singleSelect, var_default}
- rigging ワークスペース git status クリーン

### 8. craft への示唆

1. **variant 運用の正順が実証された**: 所属先行・可視旗後行。加えて「メッシュ生成の前に可視旗を明示化」（cp18 示唆3の運用形）——bottomwear ×2 が vis=true のまま空メッシュで残っていた罠を棚卸しで検出し、hide→mesh の順で rest 不変のまま通した
2. **createVariantGroup(singleSelect) は initial variant + defaultActive を自動設定する**。明示の setVariantDefaultActiveSelection（同値）は no-op reject（invalidDefaultActive）になる——「確認」は committed variants.json 実測か dry-run reject の観測で行う。setVariantMembership も同値 no-op reject があるが、addVariantTargetDrawable が空 membership を自動作成するため「add → member=true ×1」の列なら reject は出ない
3. **レンダベース検証の3点セット**（validator に variant 検査が無い間の代役）: ①選択省略レンダの sha 不変（defaultActive の見た目保証）②inspectEvaluatedGeometry ×全選択×全ターゲットの visible 完全一致 + resolved echo 照合 ③切替レンダ目視。verify-visibility.mjs / verify-intact.mjs は次の variant 問題にそのまま流用可能
4. **inspect / render の応答は aiCommandResponse.payload 配下**（operation 応答と構造が違う）。read-cmd.mjs の「payload keys:」が空表示なのはこのため（要改善）
5. 共有 drawable（首元チェーン等）は variant ターゲット外でも「衣装差で露出」しうる。所属表を組むとき「Default の衣装に隠れているだけの共有パーツ」の存在を切替レンダで確認する工程は必須

## 未解決の質問（ユーザー / L0 へ）

1. **通常下衣の所在**: 定義は「bottoms part の衣類 drawable」だが、実体（スカート）は ware part の bottomwear だった。ware/bottomwear を Default 所属とした——この解釈で良いか
2. **bottoms part の4枚**（legwear / footwear / tail = 空メッシュ・可視、endomi_back = 空メッシュ・非表示）はターゲット外のまま残置。特に endomi_back は名前から endo 衣装の背面素材と推測される——将来 mesh 生成して var_endoministrator に所属させる意図があるか
3. 成功基準 B（Editor プレビュー + runtime-player ライブ切替のユーザー gate）は未実施——ユーザーの目を待つ
