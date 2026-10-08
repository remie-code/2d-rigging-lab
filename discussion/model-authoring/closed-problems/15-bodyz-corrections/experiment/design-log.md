# cp15 BodyZ 補正ワープ群 — 設計ログ（主役 = 「固定線」テンプレの3連適用が同じ一語で書けたこと + 回転内差分の厳密化）

作業: `param_body_angle_z`（±10 → θ=±6°、cp14 正典: pivot=(997.25,1124)）に対し、補正ワープ7基（前髪・房 L/R・後ろ髪 L/R・ネクタイ・シャツ胴体）を新設。各ワープは**その要素の現在の塔 root を wrapChildren で in-place 継承**（積み順: BodyZ 回転 > BodyZ ワープ > FaceZ ワープ/塔。前髪のみ rig_facez_head の中 = 二重回転の内側）。キーは createEndsCenter 三点（min/max のみ実値、センター全ゼロ）。**param_body_angle_z 戦線完結**。
ワークスペース: `C:/workspace/remie/rigging/llm-rigging`（開始 rev 404 → 終了 rev 418。開始時・終了時とも working tree clean）。**14 op = 14 git commit（[cp15]）、reject ゼロ（dry-run 全一発通過）。目視イテレーション予算1回は未消費（1回目で成立）**。生成器 `gen-bodyz-corrections.mjs`（gen / snapshot / verify、PRE assert 付き）が全数値の一次ソース、`assert-corrections.mjs` が評価後頂点の機械検証、`measure-tie-knot.mjs` が結び目実測、`diff-pixels.ps1`/`diff-rows.ps1` が画素局在化。

## 主役: 3連適用は本当に「同じ一語」だった

7基すべてが同一の文:

> **net(u,y) = Φ(y)·rot_B(u,y) + (1−Φ(y))·A(u)**、rot_B(p) = R(pivot_B,θ)·p − p

| 要素 | Φ | 固定線（実測根拠） | A(u) |
|---|---|---|---|
| 房R / 房L | W3 sharp 40px | y_scalp = **520 / 505**（cp13fix3 実測値を無修正流用） | rot_B(u, y_scalp)（重力 carry、X・Y 両成分） |
| 後ろ髪 R/L | W3 sharp 40px | y_scalp = **540**（同上） | 同上 |
| 前髪 | cp13 の W（500..773 smoothstep→wTip 0.7） | y=500（cp13 流用。**試走の既知の乖離ごと継承**——再走で y_scalp 正規適用予定の近似） | rot_B(u, 500) |
| ネクタイ | W sharp 40px | **結び目下端 y=710**（本問題の新実測、下記） | rot_B(u, 710)（結び目の変位を運ぶ） |
| シャツ胴体 | P（cp10fix の行スナップ pin） | フル可動 y≤1065.83（格子行10）→ **y=1116.92（行11）で 0**（スカートイン線 1124 の 7.08px 上） | **0**（縫い付けアンカー、static スカートへ） |

- 差は「Φ の形」と「A がどちらの支配則か」だけ: 髪・タイ = **固定線の変位を運ぶ**（重力）、シャツ = **ゼロへ収束**（縫い付け）。「固定線まで親の回転に従い、線から先は支配則が交代する」の一語が、生成器では `kind: "carry" | "anchor"` の分岐1個。恒等式 assert（IDENT）も全7基同型: `net − A == Φ·(rot_B − A)`
- **ゼロ帯が文字通りデータのゼロになった**（assert ZEROBAND）: Φ=1 の全ノード（頭皮帯・結び目帯・肩帯）は補正オフセット == 0。「結び目まで補正ゼロ（フル回転）」「肩帯フル回転」がキー内容の不在として実装され、縫い目同期（結び目×襟、頭皮×back_top）は構成的に保存される

### ネクタイ結び目下端の実測（measure-tie-knot.mjs、rev 404 テクスチャ）

tie 描画域 y643..1199。幅プロファイル: 結び目の膨らみ w60 @ y667 → 単調収縮 → **幅極小プラトー w34 @ y708..711** → ブレードが単調拡幅（w41@723 → w96@1123）→ V 先端。**y_knot = 710**（プラトー中心）。ブレードの重心 x ドリフトは 400px で ~5px（≈0.7°）= **rest はほぼ鉛直に描かれている**——carry だけで鉛直保持が成り立つ前提をテクスチャが裏書き。

## 本問題の設計判断: 回転内差分の「厳密化」を採用（cp13 引き継ぎ節の初発動）

cp13 は素朴形 `c = net − rot` を採用し (R−I)c ≤ 2.4px を許容した（|c|≤17px・θ=10°）。cp15 は**全7基が回転の中**かつ、カーテンは pivot（腰）の下まで垂れるため補正が巨大: **|c| max 145.5px**（後ろ髪R 最下行——回転場が pivot の下で符号反転し、carry がそれを打ち消して頭の変位に置き換えるため）。素朴形の残差 |(R−I)c| は **max 15.2px**（機械計算、assert EXACT の INFO 行）——cp13 の「角度か補正量を上げるなら前置逆回転で厳密化」の条件が成立。よって

> **c(p) = R⁻¹·(p + net(p)) − p**（op コストゼロ、生成器の3行）

を採用。帰結（assert が利用した構成的性質）:

1. **Φ=1 帯: c ≡ 0 厳密**（素朴形でも 0 だが、厳密形でも保たれる）
2. **Φ=0 帯: c は (x,y) のアフィン関数**（R⁻¹ ∘ (恒等+アフィン) − 恒等）→ **bilinear 格子はノード間も厳密**（assert AFFINE: 全 Φ=0 ノードが3点フィットのアフィン写像に 1e-6 で一致）。シャツ裾の静止・タイの列一様 carry・髪の一様 carry が「格子分解能の議論なしで」ノード間まで厳密に届く
3. 遷移帯のみ smoothstep×アフィン = 行間隔へ軟化（cp13fix3 と同じ。境界行=標本行なので両端値がほぼ同一ベクトル、絵的コストは sub-px——タイ実測: 軟化域 710..821 の頂点は両端値のどちらかから max 0.757px）

## 検証（rev 418）

### 生成器 assert（gen 時、全 PASS）

- **PRE**: live BodyZ 回転 = cp14 正典（pivot 997.25/1124、キー −6/0/+6 @ ±10）バイト照合 = **場の導出元の人間補正ガード**。7 wrap 対象の存在・期待親・cp15 warp 不在・domain の live 整合（タイ/シャツ = 塔 domain の双子、髪 = FaceZ domain + 60px マージン）
- **IDENT / EXACT / ZEROBAND / AFFINE**: 上記
- **SIGNFLIP（2層）**: 全遷移が反転線 y=1124 より上で完結（マージン: シャツ **7.1px**（際まで攻める較正の維持）、タイ 374px、髪 351〜579px）+ 全ノードで「中間 Φ は 1124 より上」「1124 以下のノードは Φ=0（回転場を混ぜない）」

### 評価後頂点（assert-corrections.mjs、bz = −10 / +5 / +10、全 PASS）

- **MECH**: 7基とも evaluated == R_B(θ(v))·(rest + bilinear(補正格子(v))(rest))、maxErr **2.1e-10〜4.5e-10**（中間値 +5 込み——機構は完全に理解どおり）
- **BAND Φ=1**: 頭皮帯・肩帯 = 厳密回転から **0.000px**（前髪87・房R50・房L21・カーテンR25・カーテンL20・シャツ216頂点）。結び目帯（y≤710、行間軟化域）= 厳密回転から **max 0.170px**
- **BAND Φ=0**: 一様 carry からの偏差 max **0.003〜0.006px**（アフィン厳密の実測確認）。シャツ裾（y≥1116.9、47頂点）= rest から **max 0.005px = 完全静止**（中間値 +5 での裾ゆらぎは linear キー補間の固有項で max 0.284px、INFO 記録）
- **VERT（ゲート数値①）**: タイ懸垂帯の列内 dx 広がり max **0.050px**（12列）——rest オフセット保存の実測。**タイ軸の傾き: before（剛体ロール）= ±6.0°（構成的）→ after = 0.007°**
- **不漏れ**: 首・back_hair 影・顔（nested）= 厳密回転のまま（2.5〜4.0e-10）。スカート・legwear = **全 bz 値でバイト静止**

### 回帰

- **レンダ回帰 11/11 バイト一致**（rest / X±30 / Y±30 / FaceZ±30 / BodyX±10 / 合成 / blink——全部 BodyZ=0、rev404 基線 vs rev418、sha256）。今回はリメッシュなしなので**バイト一致がそのまま成立**（cp14 の back_hair リム差の許容枠は使わずに済んだ）。ズーム5フレームの rest 対も全て一致、bodyzmin/max 対は全て相違 = 補正が現物に乗っている
- **verify（gen-bodyz-corrections.mjs、ALL PASS）**: 既存 keyformSet **81本全部 canonical 一致**（人間補正名指し: 帽子X・topwear/tie BodyX・FaceZ 回転+ワープ5本・BodyZ 角度キー）。新規7セットのみ、設計格子と厳密一致・センター全ゼロ。rig control: 変化は wrap 7本の parentId + 両親（rig_bodyz_upper_body / rig_facez_head）の childRigControlIds **スロット in-place 置換**のみ、他68本バイト一致。メッシュ・drawables 全数バイト一致。**graph roots 不変**（全 wrap が既存親の下への挿入のため——cp13 の「中間挿入」型が7連発で再現）
- **validatePackage strict: error 94 / blocking 0** = cp14 終了時 87 + **7（rigControl.runtimeEvidenceMissing の新規7基分の機械的加算）**。既存3クラスのみ、新クラスなし

### シャツ×スカート境界の画素局在化（ゲート数値②、腕・タイを除外した清浄窓）

WAIST フレーム（stage 620,950 760×460 → 1024×620px、1.348px/stage）。腕被覆（x604..836 / x1160..1391）とタイ可動域（±45px）を実測で外した窓 **x845..885 / x1095..1155**、rest との差分画素を行別カウント:

| ケース | before（cp14 剛体） | after（cp15 pin） |
|---|---|---|
| 沈み側（min×左窓 / max×右窓） | 差分が **row 279 = 裾縁+13.4px 下**まで全幅継続 = 裾がスカート帯に食い込む | 差分は **row 261 = rest 裾縁（y≈1143.6）で消滅**（縁行のカウント ≤16、以下0） |
| 浮き側（max×左窓 / min×右窓） | 裾縁行まで全幅 55/55 差分（縁が 14px 掃引しスカートが露出） | 縁行付近 ≤4px（AA レベル）で消滅 |

裾より上の布内部の差分（全幅 ~50/55）は**遷移帯の頂点移動が三角形内テクスチャ補間で漏れる正常な描画挙動**であり、境界の主張（裾縁で変化が止まる）とは独立。幾何側の証明（裾頂点 0.005px + スカートバイト静止）が一次、画素は「縁での消滅 vs 14px 突破」の対比で補助。

## プラム項の要否判定（報告義務）

**不要と判定（実装せず）**。タイ: rest がほぼ鉛直（実測 0.7° リーン）+ 列一様 carry でズーム目視も鉛直（before の斜め固定が解消）。カーテン: 一様 carry は形の凍結だが、BodyZ の変位場は毛束スケールでほぼ一様（θ=6°、|A|≈63px の純並進）で「作画の嘘」を暴かず、zoom-curt before/after で不自然さなし。FaceZ 側のプラム緩流（cp13fix1）は FaceZ キーに載っており本問題は不触——合成時はそのまま加算される。

## レンダ（renders/）

- **bodyz-min10-full / bodyz-rest-full / bodyz-plus10-full / bodyz-sweep7-full**（BodyZ 完結の通し——gate 材料。体が腰から傾ぎ、タイは結び目から鉛直、裾はスカートに留まり、髪は生え際から先が垂れ直して頭に付いていく）
- **before-zoom-* / after-zoom-*** × {waist, tie, hairR, hairL, curt} × {rest, bodyzmin, bodyzmax}（before = rev404 = cp14 剛体状態の同フレーム再現。rest 対はバイト一致、min/max 対が before/after の証拠。cp14 の zoom-waist/zoom-tie と同一ビューポート）
- **nested-bodyzmax-facezmax / nested-bodyzmin-facezmin**（BodyZ×FaceZ 合成監視、記録のみ: 首・襟接続保持、裂け・二重像なし。前髪補正の O(θ_F·c) 交差項 ≤1.5px 級は知覚されず）
- base-* / post-*（回帰11対、sha256 一致）

## 実行 op 一覧（rev 404→418、全 [cp15]、reject ゼロ）

| # | op | rev |
|---|---|---|
| 1–5 | createWarpDeformer BodyZ Hair Front 11×11（rig_facez_head の中へ挿入）/ Hair F R/L 7×11 / Back Hair R/L 11×13（wrap、in-place） | 404→409 |
| 6–7 | createWarpDeformer BodyZ Tie 5×7 / BodyZ Topwear 13×13（wrap、in-place） | 409→411 |
| 8–14 | editKeyformKey createEndsCenter ×7（param_body_angle_z、controlPointOffsets、min/max = 設計格子・センター全ゼロ） | 411→418 |

## craft への指摘（レシピ06 追補の原料）

1. **「固定線テンプレ」は3クラス統一の一語として確定**: `net = Φ·場 + (1−Φ)·A`、A ∈ {固定線行の場のコピー（重力 carry）, 縫い付け相手の場（アンカー、static なら 0）}。髪・タイ・シャツの差は Φ の形と A の選択だけで、恒等式・ZEROBAND・SIGNFLIP の assert 群も同型で書ける。固定線の実測レシピに**「結び目下端 = 幅プロファイルの極小プラトー」**を追加（生え際=食い込み反転行、イン線=相手衣服の最初の幅広行、に続く第3の測り方）
2. **回転内差分の厳密化 c = R⁻¹(p+net)−p はデフォルトにしてよい**: 発動条件（cp13 の「角度か補正量」）は「補正が回転場の符号反転を跨いで運ぶとき」に必ず成立する（|c| ≈ 2|rot| 級になる）。厳密形は素朴形と同じ1行コストで、(a) Φ=1 帯のゼロは保存 (b) **Φ=0 帯が (x,y) アフィンになり bilinear がノード間まで厳密**——「裾の完全静止」「タイの列一様」が格子分解能の議論なしで手に入る。副作用なし
3. **ピン検証の画素手続きは「縁での消滅行」で読む**: 布の内部は遷移帯頂点のテクスチャ補間で全幅 sub-px 差分が出る（頂点静止 ≠ 画素静止）。機械化するのは「rest 縁行で差分カウントが 0 に落ちる vs 縁を N px 突破する」の対比 + 幾何側（縁頂点・相手衣服の静止）を一次証明に置く役割分担。腕・タイ等の可動同居物は実測 bbox で窓から外す
4. **wrap 挿入の domain は「子の変位込み」で張る**: 回転の中に積むワープの入力は既に子ワープで変位している（FaceZ ≤~60px）。髪は FaceZ domain + 60px マージンで張った。ただし帯別に見ると、Φ=1 帯は c≡0（域外クランプ/外挿でも厳密）、Φ=0 帯はアフィン（線形外挿なら厳密）なので、**マージン不足が実害になるのは遷移帯だけ**——「域外挙動の帯別無害性」を確認すればマージンは遷移帯被覆分で足りる
5. **warp レコードの格子フィールド名は latticeColumns/latticeRows**（transformColumns は op payload 側の名前。verify を書くときの罠——本問題で1敗、コード修正のみで解消）

## エスカレーション事項

なし。シャツの「イン線際まで攻める」×「反転線を跨がない」は両立した（cp10fix の行スナップ 1065.83→1116.92 がそのまま 1124 の 7.08px 上で完結——構造矛盾は発生せず）。プラム項は上記のとおり不要判定（実装なし・報告のみ）。wrapChildren の in-place 挿入は rig_facez_head の中（二重回転の内側）でも想定どおり動いた。
