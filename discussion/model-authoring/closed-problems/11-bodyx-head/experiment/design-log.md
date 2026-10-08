# cp11 BodyX 頭部の浅い同調 — 設計ログ（主役 = 仮説「パラメータ族は相似」の検証結果）

作業: `param_body_angle_x`（±10）の頭部18塔への一括 rigging。**設計ゼロ・式の再評価ゼロ**——committed FaceX キー（人間補正込みの現物）を α=0.6 で点対点コピーしただけ。生成器 **gen-bodyx-head.mjs が全数値の一次ソース**（gen / verify の2モード。定数は ALPHA=0.6 の1個だけ）。
ワークスペース: `C:/workspace/remie/rigging/llm-rigging`（開始 rev 325 → 終了 rev 361。開始時 working tree clean）。**36 op = 36 git commit（[cp11]）、reject ゼロ。目視イテレーション予算1回は未消費**（1回目のレンダで全軸成立）。

## 仮説の判定: **成立**（条件付きの限定なし——本モデル・本パラメータ対では完全成立）

> 頭部要素の BodyX 場 = α ×（その要素の committed FaceX 場）、α = 0.6（cp10 正典）

3 系統の証拠:

### 1. 首 junction の無編集接続（一次検証・数値）

- **静的予言**（コミット前、キー値レベル）: cp10 の首上端行（rig_bodyx_neck 5×5 の行0、y527）の committed 値と、α×FaceX 顔場（顎行 y577 の bilinear 標本）の**全5列の差 = 0.00px**（丸め残差 ≤0.005）。cp10 が首上端を「α·顎場」で打った瞬間に、cp11 の顔側が同じソースから同じ α で生成される——**接続は調整でなく構成で出る**
- **実測**（コミット後、巻尺 = 評価後頂点）: 顔 drawable 顎帯と首 drawable 上帯の列マッチング14対で、body ±10 の変位差 **平均 |gap| 0.34px、最悪 1.24px**（顎帯下端 y581 の1点。格子解像度差 7×7 vs 5×5 の再標本化 + メッシュ頂点位置の差による）。「数px 以内で無編集接続」の予言どおり
- レンダ zoom-junction-min/max: 顎と襟の間の首肌に裂け・段差なし

### 2. 頭部内の相対関係の保存（相似コピーの構造的帰結）

眼鏡は目に、帽子は髪に、口は顔に——**全て崩れず**。当然で、18塔全部が「同じ場の α 倍」を貰うので頭部内の相対 field は FaceX ±30 の 0.6 倍縮小版そのもの。目視（body-sweep7-full・body±10-full）でも FaceX で構築した位置関係が全部保たれている。**dy も運んだ**: 帽子の FaceX dy 場（人間補正 C10、max|dy| 30.5/32.1px）→ BodyX 18.3/19.3px（×0.6）、back_top_hair の dy 5点も同率。帽子が「回転で乗り上がる」演出が body でも 0.6 倍で再生される。

### 3. 髪×胴の重なり帯（新しく生じる接触の実測）

- 後ろ髪カーテンは FaceX 由来の **z<0 逆行**を α で継承: body max（画面右向き）で back_hair 肩帯 −1.2〜−4.4px（逆行）vs シャツ肩 +6.2px → **差動 4〜8px の滑り**。物理として正しい（頭が浅く回れば後頭の髪は逆パララックス）。髪は胴の奥に描画されるため滑りはほぼ遮蔽され、露出部（肩の外）はレンダで破綻なし（zoom-hairshoulderR/L-min/max）
- 前髪下端 ±11.5〜11.7px vs シャツ襟 ±6.0〜7.8px——前髪（半径大）が胸より先行する「浅い同調」の絵。cp10 設計ログの予言（鼻 18px > 胸 10px）と同型

## 「体を回すと頭も浅く付いてくる」

body-sweep7-full（全身7段 = BodyX 完結の通しゲシュタルト、gate 材料）: cp10 で織り込んだ「頭が静止したまま」の違和感は消えた。頭は胴より大きく振れる（鼻 18px vs 胸 10px）が、これは cp10 正典の導出どおり半径差の帰結（剛体寄り運搬）。対角監視2枚（diag-bodymax-xplus30 / diag-bodymin-ymin30）: BodyX×FaceX / BodyX×FaceY の合成に大きな破綻なし（記録のみ、判定はユーザー）。

## 実装（レシピ06「移植作法」の自家版——参照が「同一モデルの別パラメータ」である場合）

1. **格子の双子**: BodyX デフォーマの domain・格子次元 = その要素の FaceX デフォーマと同一 → restControlPoints が点対点で一致（assert GRID: 18塔全部の FaceX rest 格子が一様格子と誤差 1e-9 以下で一致 = ホストが生成する新格子と自動一致。verify で新 restControlPoints と FaceX の JSON 全一致も確認）
2. **積み順**: createWarpDeformer `wrapChildren:[{rigControl, rig_facey_*}]` ×18 → **BodyX > FaceY > FaceX > 要素**（ユーザー実作の慣例。1デフォーマ=1パラメータ責務、新パラメータが親）
3. **キー**: createEndsCenter 三点（−10/0/+10）、min = FaceX min(−30) patch × 0.6 / max = FaceX max(+30) × 0.6（**dx・dy 両成分、round2**）、center = 全零（BodyX=0 恒等 → 回帰バイト一致の根拠）。一様 α（α² 縮尺補正なし——gate 待ちの裁定どおり）
4. ソースは **committed keyforms.json の読み取り**であって生成器式の再評価ではない（帽子 X には人間補正が入っており式と一致しない——現物が正典）

## 不触の保証（機械検証、gen-bodyx-head.mjs verify）

- **既存 keyformSet 56本全部バイト一致**——帽子 X（人間補正 C10)・topwear/tie（cp10fix+人間仕上げ）・首（α 正典の相方）・rig_neck_back_warp_deformer を**名指しで確認**。新規18セットは design-values.json と全一致
- **rig control**: 新規18基（FaceX 双子格子・FaceY を単独子に持つ・root）以外は、**wrap の機構上変わる FaceY 18本の parentId のみ**が変化（parentId を除いた canonical JSON 全一致を機械確認）。他34本はバイト一致。graph roots は FaceY→BodyX の置換のみ
- **メッシュ全数バイト一致**（cp11 はメッシュ op ゼロ）
- **cp10 胴体の挙動回帰**: 7 drawable（neck/neck_back/topwear/bottomwear/handwear×2/tie）の評価後頂点を rest/−10/+10 で**コミット前後バイト比較 → 全一致**（頭側の追加が胴体の場を汚していない）
- **レンダ回帰 7/7 バイト一致**（rest / X±30 / Y±30 / 合成 / blink——BodyX=0 恒等）。reg-body-blink（BodyX−10+両目閉）: 目の状態切替塔が新 BodyX 層の下で無傷
- validatePackage strict: **error 80 / blocking 0**——既存3クラスのみ、rigControl.runtimeEvidenceMissing 52→70 = 新規18基の機械的加算。新クラスなし

## レンダ（renders/）

- body-min10-full / body-rest-full / body-plus10-full / **body-sweep7-full**（全身7段、最終ゲシュタルト gate 材料）
- zoom-junction-rest/min/max（首 junction ズーム）・zoom-hairshoulderR/L-rest/min/max（髪×肩の重なりズーム）
- diag-bodymax-xplus30 / diag-bodymin-ymin30（対角監視、記録のみ）・reg-body-blink
- base-* / post-*（回帰7対、sha256 一致）

## 「パラメータ族は相似」の適用条件の言語化（craft 新節候補）

**成立条件（本問題で実証された形）**:

1. **同じ回転軸の向き**（X→X。転置ではなく相似——軸が同じだから弦・偶性・dy 例外則の幾何が全部そのまま通用する）
2. **浅い方のパラメータが「同じ運動のゲイン違い」と物理的に読めること**（ユーザー証言「首から上に限れば FaceX のゲイン違いでしかない」が仮説の資格審査だった。剛体寄りの運搬 = 頭は首に載って回る）
3. **α が接合点の変位連続から導出済み**であること（cp10 で襟運搬 ÷ FaceX 顎場 = 0.609 → 0.6。α を独立に演出で決めると junction が構成で繋がらない）
4. **ソースは committed 現物**（人間補正込み）。式の再評価は人間補正を消す（禁忌、cp10 の PRE assert の教訓と同族）
5. **格子の双子化**で点対点コピー（domain+次元同一 → rest 格子一致。再標本化ゼロ = 誤差ゼロ・帽子の 13×13 人間補正場も無劣化で運べる）

**このとき junction は「調整」でなく「構成」で繋がる**——境界の相方（cp10 首）が同じソース×同じ α で打たれていれば、接続誤差は丸めと格子解像度差だけ（実測 0.34px 平均）。**折れた点: なし**（目視イテレーション予算未消費。反証データなし）。

**将来パラメータへの示唆**: FaceZ・BodyY 等も「既存パラメータ族の committed 場 × 接合連続から導いた α」で機械生成できる見込み。ただし条件1（軸の向き）に注意——BodyY は FaceY の相似が候補で、Y 系で消滅する dy 例外則等は FaceY 側に既に織り込み済みのはず（転置は済んだものを相似コピーする、が正しい順序）。

**運用ノート（craft 指摘）**: wrap 型の一括新設では「既存 rig control 全数バイト一致」の verify テンプレ（cp10 型）が成立しない——wrapped root の parentId だけは必然的に変わる。**「parentId を除く canonical 一致 + parentId の期待値照合」**が wrap 問題の不触保証の正しい形。

## エスカレーション事項

なし。FaceX/FaceY の格子食い違い（例: face 7×7 vs 9×9）は存在したが、**点対点の前提は BodyX↔FaceX 間**にしか要らず（FaceY は wrap されるだけ）、前提は崩れていない。wrap の親子も想定どおり（FaceY 18本全部が root で単独子 FaceX を持つ、を assert TOPO で事前機械確認）。

## 観察事項（cp11 非起因・スコープ外の記録)

- 首 junction の最悪 gap 1.24px は顔格子（7×7）と首格子（5×5）の解像度差による再標本化差が主因。知覚不能レベルだが、将来「接合帯の格子ピッチを揃える」とさらに縮む（不要と判断）
- スカート・脚・尻尾・靴は未 rig のまま（BodyX の下半身応答は別問題）
- rig_neck_back_warp_deformer（ユーザーが cp10 後に再構成した首裏塔）は名指しバイト不変確認済み
