# cp18 実験レポート（漸進書き）

> 実装: Fable 三十代目（2026-07-06）。design-notes.md が仕様の正。
> 対象パッケージ: C:/workspace/remie/rigging/llm-rigging（着手時 packageRevision 512、git クリーン確認済み）

## 工程ログ

### 0. 前提確認（済）

- rigging ワークスペース `git status` クリーン、packageRevision = 512
- 対象6 drawable は全て**空メッシュ**（vertices=0）→ generateMesh 6基が先行（空メッシュの罠 = メッシュ→wrap の順序）
- ソース塔の committed 実測:
  - rig_bodyz_topwear: 13×13, domain (739,555) 516×613, keys param_body_angle_z -10/0/+10（statePatch 配列169点）
  - rig_bodyx_topwear: 13×13, 同domain, keys param_body_angle_x -10/0/+10（襟人間補正は ±10 パッチに焼き込み済み——名指しガード対象: `keyset_rigcontrol_rig_bodyx_topwear_controlpointoffsets_body_angle_x`）
  - rig_bodyx_arm_l: 9×13, domain (1029,640) 488×972 / rig_bodyx_arm_r: 9×13, domain (477,640) 488×973
  - 全ソース rest 格子は厳密一様（一様式との maxErr = 0）→ 再標本化のセル特定は一様格子計算で厳密
- rig_bodyz_upper_body（rotation2d, pivot 997.25,1124）: param_body_angle_z ±10 → angleDegrees ±6
- 別衣装 drawable は全て runtimeVisibility=true だが描画順 107-114 で本衣装（115-118）の下 → rest レンダ不変はレンダ sha で確認する
- op 型: createWarpDeformer（parentRigControlId 指定可）/ editKeyformKey（createEndsCenter）/ setRuntimeVisibility

### 1. 設営 + pre スナップショット（済）

- 実験様式は cp17 から複製（apply-op.mjs / run-batch.mjs / read-cmd.mjs）
- snapshot-pre.json: rev=512, keyformSets=99, rigControls=95, meshes=132, drawables=132（id→JSON 文字列の完全写し + model/*.json の sha256）
- pre rest フルレンダ（viewport 250,0 1500×2000）: renders/pre-rest-full.png
  sha256 = `edf41235c37955fe596a4d3fb11df17511cf55e8ef3b12e44126e04b499a830b`

### 2. メッシュ生成（6基、済）

- batch-mesh.json: generateMesh ×6（auto-outline-v6d medium、cp10 と同法）
- rev 512→518、dry-run 全て auto-approved、reject ゼロ

### 3. gen スクリプト + 恒等検算（済）

- gen-alt-outfit.mjs が数値一次ソース。再標本化 = ソース一様格子上の双一次補間、domain 外は clamp（傾き1継続）
- **恒等検算 PASS（design-notes §4-1、厳密 === 比較で 0 誤差）**: 4ソース全キー全点
  - rig_bodyz_topwear/param_body_angle_z: 3キー×169点 exact
  - rig_bodyx_topwear/param_body_angle_x: 3キー×169点 exact（襟人間補正込みの committed パッチを場として読む）
  - rig_bodyx_arm_l / arm_r: 各3キー×117点 exact
- 新ワープ設計（domain = メッシュ bbox + ソース半ピッチ余白 / ピッチ = ソース同程度）:
  - rig_bodyx_topwear_rodos / rig_bodyz_topwear_rodos: 17×34, domain (634,535) 708×1661
  - rig_bodyx_arm_r_rodos: 8×14 (462,618) 456×1043 / rig_bodyx_arm_l_rodos: 8×14 (1072,619) 449×1042
  - rig_bodyx_topwear_endo / rig_bodyz_topwear_endo: 25×38, domain (484,547) 1041×1911
  - rig_bodyx_arm_r_endo: 8×13 (475,642) 457×1013 / rig_bodyx_arm_l_endo: 8×14 (1075,642) 454×1013
- 別衣装 topwear はソース domain（高613）より丈が長い→下側はクランプ則で最下行の場（イン線アンカー ≈ 静止）が運ばれる = 腰ピンの物理が裾まで継続
- 中心キー(0)の再標本化が全点 0 であることも assert 済み

### 4. ワープ作成（8基）+ キー打ち（8セット、済）

- **craft 発見（reject 1件、無傷）**: `wrapChildren + parentRigControlId` は「wrap する子が既にその親の直下にいる」in-place 挿入専用（cp15 の用法）。root の子を包んで別親に付けようとすると `operation.createWarpDeformer.parentChildMismatch`（"Wrap parent ... does not match a root selected group"）で reject される。**新しい塔は create モード**: `childRigControlIds` による養子縁組（cp17 母音チェーンで実証済み）+ `parentRigControlId` bind が正しい経路。gen を修正して再走（冪等化: 既 commit の warp は設計一致を assert してスキップ）
- ワープ8基: rev 518→526（create-bodyx-topwear-rodos は初回走で 519）。全 dry-run auto-approved
- 塔の形を committed 現物で確認: design-notes §1 と完全一致（rodos/endo とも BodyZ topwear ⊃ BodyX topwear ⊃ drawable、arm×4 は rig_bodyz_upper_body 直下）
- キー8セット（createEndsCenter -10/0/+10、再標本化パッチ、1e-6px 丸め）: rev 526→534、reject ゼロ
- ここまで committed op 合計 22（mesh 6 + warp 8 + key 8）、git commit 22

### 5. 検証（design-notes §4）

#### §4-1 恒等検算: PASS（gen 内 assert、4ソース×全キー×全点、厳密 === で 0 誤差）

#### §4-2 committed 照合: PASS（verify-committed.mjs）

- バイト照合: 8新セットとも keys=[-10,0,10]、committed statePatch と生成値の maxErr = **0**
- 巻尺照合: inspectEvaluatedGeometry の evaluatedControlPoints、own キー全点で maxResidual = **0.000e+0**（BodyX 6基 @X±10 / BodyZ 2基 @Z±10 / X ポーズ時の BodyZ 基 rest 確認も 0）
- **craft 発見**: evaluatedControlPoints は**親合成前のローカル値**（rest + own offsets）を返す。ソース rig_bodyz_topwear @Z+10 で判定——local 残差 0.000 / 回転合成仮説 R± は 60.9px。world 系の検証は drawable 頂点で行うべし（cp15 は drawable 頂点を使っていた——本問題で初めてワープ制御点を直接照合して判明）

#### §4-4 無傷: PASS

- 既存 keyformSets 99 本すべてバイト無傷。**名指しガード** `keyset_rigcontrol_rig_bodyx_topwear_controlpointoffsets_body_angle_x`（襟人間補正込み）バイト一致 PASS
- 既存 rigControls 94 基バイト無傷（唯一の例外 = rig_bodyz_upper_body の childRigControlIds に新6基の追記のみ、他フィールド不変を機械 assert）
- 既存メッシュ無傷（6対象の空→生成のみ）/ validatePackage strict: success, diagnostics 0

#### §4-3 rest sha: **初回 FAIL → 原因確定 → 処置（下記逸脱）**

- post-rest-full.png sha = 5526a6e6...（pre edf41235... と不一致）
- 原因: 別衣装6 drawable は runtimeVisibility=true のまま**空メッシュによってのみ事実上非表示**だった。§1-2 のメッシュ生成（rigging の必須前提）で、本衣装から食み出す画素（丈の長い裾等）が rest に出現した
- **逸脱判断（要ユーザー gate）**: design-notes §4-3 の前提「衣装は非表示のまま」を旗として明示化する——6 drawable を setRuntimeVisibility=false（committed）。これで rest レンダは pre と厳密一致するはず（空メッシュ=描画なし、非表示=描画なし）。可視切替の正式管理（Variant 機能）は次の閉問題の領分であり、これはその場つなぎの明示化。sweep の「一時表示」もこの状態を出発点とする

#### §4-3 続き: 非表示化後 rest sha = **PASS**

- batch-hide-alt.json: setRuntimeVisibility=false ×6（rev 534→540）
- renders/post-rest-full-hidden.png sha = `edf41235...` = pre と**厳密一致**
- これで §1-2〜§3 の全変更（メッシュ6 + ワープ8 + キー8）が rest の画素に一切影響しないことも同時に立証（差分の原因は可視化のみだった）

#### §4-5 sweep: PASS（完全復元込み）

- 手順: 本衣装4枚（topwear 3 / handwear-l/r 3 / tie）一時非表示 → rodos 3枚表示 → rest/BodyX±10/BodyZ±10 レンダ → rodos 非表示・endo 表示 → 同5レンダ → endo 非表示・本衣装4枚復元（batch-sweep-1/2/3.json、計20 op、rev 540→560）
- 復元検証: final-rest-full.png sha = pre と**厳密一致** / drawables 全132枚照合——pre との差は設計どおり「別衣装6枚の runtimeVisibility=false」のみ（想定外 0）
- validatePackage strict（最終状態）: success, diagnostics 0
- **自己目視所見**（renders/sweep-{rodos,endo}-{rest,bx±10,bz±10}.png）:
  - **腰ピン不動**: スカート（本衣装 bottoms）は全ポーズ不動。両衣装とも腰付近の裾はスカートに自然に接し、ズレ・剥離なし
  - **BodyZ±10**: 上半身（頭・髪・衣装・袖）が一体で ±6° 回転、破綻なし。rodos ジャケットの裾・endo ロングコートの裾とも裂けなし
  - **BodyX±10**: 設計どおり subtle（胸前 10px 級）。顔の同調と整合し、袖は手に付いて追従
  - **襟人間補正場 × 別衣装の襟**: rodos = 立ちジップ襟 / endo = タートルネック——いずれも首との間に隙間・スパイクなし。シャツ襟用に人間が補正した場が、空間位置ベースで別形状の襟にも自然に乗った（本問題の主張「場は素材ではなく空間に属する」の目視面の裏付け）
  - **gate 判断点（要ユーザー確認）**: endo のロングコートは「イン済みシャツの腰ピン場」をクランプで裾まで受け継ぐため、BodyZ で裾が体と一緒に振れず腰下で留まる性格になる。破綻ではないが、羽織り物の物理としては人間仕上げ境界の領分

### 6. 集計

- committed op 48（mesh 6 / warp 8 / key 8 / 非表示化 6 / sweep 可視 20）、rev **512→560**、git commit 48、reject 1（dry-run のみ・無傷、§4 craft 発見に転化）
- 検証6点: ①恒等検算 0誤差 PASS ②committed 照合 maxErr=0・巻尺 maxResidual=0 PASS ③rest sha 厳密一致 PASS（逸脱1件明示） ④無傷 PASS（襟人間補正キー名指しガード含む） ⑤sweep + 完全復元 PASS ⑥本レポート漸進書き

### 7. craft への示唆

1. **wrapChildren + parentRigControlId は in-place 専用**。root の子を包んで別親へ付けるのは reject（"Wrap parent ... does not match a root selected group"）。新しい塔は create モードの childRigControlIds 養子縁組 + parentRigControlId bind（レシピ06/09 の warp 作法に追記候補）
2. **inspectEvaluatedGeometry の rigControl.evaluatedControlPoints は親合成前のローカル値**（rest + own offsets）。回転親の下でも回らない。world 検証は drawable 頂点で
3. **「空メッシュ = 事実上の非表示」は罠の新型**。runtimeVisibility=true のまま空メッシュで隠れている素材は、メッシュ生成の瞬間に出現する。rigging 前に可視旗を明示化するのが正順（空メッシュの罠の系）
4. **再標本化の実装は ~30 行**（一様格子 assert + セル snap + 双一次 + クランプ）で、恒等検算が厳密 0 誤差になる。相似則（cp11 の点対点）から一歩進んだ「格子非依存の場の運搬」が成立——キー値・物理・人間補正が設計コストゼロで別素材に移った
