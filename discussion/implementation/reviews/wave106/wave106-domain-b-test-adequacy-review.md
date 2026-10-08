# Wave106 Domain B (apps/editor) — Test Adequacy Review（レーン2）

- レビュー担当: Review-Sylph
- 対象: dynamics-file-v3（世界系 Verlet チェーン）への apps/editor 対応テスト群
- 判定基準: `discussion/design/dynamics-world-frame-chain.md` §3.5/§3.7/§4/§8、`wave106-plan.md` §7、Gnome 報告
- **総合判定: 合格（軽微な被覆ギャップの申し送りあり／要修正なし）**

---

## 1. テスト結果（自分で実行）

`npx vitest run apps/editor` 実行結果:

- **435 tests: 431 passed / 4 failed**（57 files: 56 passed / 1 failed）
- dynamics 関連テストはすべて green:
  - `dynamics-tool-state.test.ts` — pass（14 ケース、particles/chain/scale/segmentIndex・新診断・stepDynamics 整合・§8 プリセット）
  - `dynamics-tool-inspector.test.ts` — pass（5 ケース、Quick Tune v2 語彙・commit payload 形状）
  - `viewer-runtime-playback.test.ts` — pass（4 ケース、settled 新判定）
  - `viewer-runtime-screen.test.ts` — pass（settled loop / restart-from-idle 統合含む）
  - `canvas-projection.test.ts` / `parameter-manager-projection.test.ts` 他 — pass

### 失敗4件の切り分け（Domain B 起因でないことを自分で確認）

失敗はすべて `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts`:
- mesh warnings jump（test:25）
- deformer warnings jump（test:54）
- **dynamics** warnings jump（test:114）
- duplicate-output action hint（test:143）

失敗内容はすべて同一パターン: `expect(setActiveEntry).toHaveBeenCalledWith("import")` に対し実装が `"workspace"` を渡す（jump-actions.test.ts:49/78/138/178/184）。

**dynamics 起因でないことの根拠（失敗メッセージ＋ソースから判断）:**
1. 原因は entry 名リネーム `"import"` → `"workspace"`。`diagnostics-jump-actions.ts:125/138/166` は `setActiveEntry("workspace")` を呼ぶが、テストは旧名 `"import"` を期待。
2. `diagnostics-jump-actions.ts`（実装）と `diagnostics-jump-actions.test.ts`（テスト）はいずれも **working-tree 未変更**（`git status` に現れない = HEAD commit `6645c2fe wave104` 時点で既にこの不整合がコミット済み）。Domain B は両ファイルを触っていない。
3. 失敗は mesh/deformer/dynamics/duplicate の **横断的失敗**であり、dynamics スキーマ固有（particles/chain/segmentIndex/settled）のアサーションは1つも壊れていない。dynamics jump の失敗行(138)も `setActiveEntry` の entry 名のみが原因で、preview group 選択などの dynamics 固有処理は無関係。

→ Gnome の「着手前 HEAD で同一に 4 failed = B 起因でない」という切り分けは、失敗内容から見て妥当。（stash による baseline 再現は指示どおり Orch に委ねる。ただし両ファイルが working-tree 未変更である事実から、この 4 failed は HEAD 由来で確定。）

---

## 2. Required tests の実効性（計画 §7）

### 2.1 draft バリデーション新診断（`dynamics-tool-state.test.ts`）

- test "emits new v3 diagnostics and never the retired v0 diagnostics"（97-144）:
  - **正アサーション**: `outputSegmentIndexOutOfRange`（単一 segment に対し segmentIndex 3）/ `zeroInputScale`（input.scale 0）/ `outputScaleZero`（output.scale 0）/ `chainSegmentsInvalid`（segmentLengths []）を発火（114-125）。
  - **負アサーション**: 旧診断 8 種（normalizationInvalid, pendulumCardinalityInvalid, pendulumLengthInvalid, pendulumCoefficientInvalid, pendulumCoefficientExtreme, outputCardinalityInvalid, outputStrengthZero, inputInfluenceZero）が発火しないことを明示（128-140）。実装 `validateDynamicsToolDraft` はこれら旧コードを一切生成しないので負アサーションは実効。
- test "warns on unstable chain settings using the §7 revised basis"（146-157）: `damping 80 > 60` で `unstableSettings` を発火。§7 改定基準の実効。
- test "blocks duplicate output ownership"（159-181）: `outputOwnershipDuplicate` を維持系として固定。
- 判定: **必須の新/旧診断被覆は満たしている。**

### 2.2 プレビュー駆動 / stepDynamics 整合 / anchor 経由出力（§3.5）

- test "matches runtime-core stepDynamics for a representative preview step"（242-275）: editor の `advanceDynamicsToolPreviewSimulation` の結果を、runtime-core の `stepDynamics` に同一 `parameterDefaults`/`inputValues`/`dtMs` を渡した `expected.state` と `toEqual` で厳密一致検証。**editor preview が runtime-core と一致することを固定**。実効。
- test "uses non-driver defaults, local driver values, and additive anchor-based output offset"（183-209）:
  - driver=30 → `anchor.phiDeg === 30`（§3.2）
  - 真下静定で `thetaLocalDeg ≈ −30`（§3.5 θ_local = θ_world − φ = 0 − 30）
  - output scale 1/30 → `offset ≈ −1`、`effectiveValue`/parameterValues への加算合成を固定。
  - 期待値 `EXPECTED_REST_OFFSET_AT_30DEG = −1` は冒頭コメント(33-36)で手計算導出されており、**実装のコピーではなく独立構成**。出力 offset が anchor 経由（θ_local = θ_world − φ）で算出されることを固定できている。
- test "uses session-local definition overrides for immediate Quick Tune preview"（357-398）: output.scale を 2 倍 → offset が −1 → −2 に線形に倍化。override/clear の往復を固定。
- 判定: **stepDynamics 整合・anchor 経由出力ともに実効的に固定されている。**

### 2.3 §8 プリセット値

- test "uses the §8 preset chain values"（58-80）: hair[14]/2.5/1.0、ribbon[10]/1.2/0.8、softCloth[18]/4.0/1.0、rigidAccessory[6]/8.0/1.0、rootOffset{0,0} を固定。§8 表と一致。実効。
- test "derives v3 input scale defaults and output scale/limit defaults"（39-56）: input `{kind:"angle",scale:1}`、output `{segmentIndex:1, scale:1/30, limit:range/2=20}` を固定。裁量既定を固定。

### 2.4 clone / compare の v3 対応

- `dynamics-tool-state.ts` の clone 群（`cloneDynamicsChain` 978-983 / `cloneDynamicsOutput` 985-990 / `cloneDynamicsInput` 972-976）は v3 全フィールド（rootOffset/segmentLengths/damping/gravityScale, segmentIndex/scale/limit）を deep clone。compare 群（`sameDynamicsChain` 1029-1038 / `sameDynamicsOutputs` 1040-1054）も v3 全フィールドを比較。
- `editor-session-context-history.test.ts` が undo/redo を **v3 payload**（chain.segmentLengths[14], output.limit の 20→12→20）で検証（460-486）。preset 変更 undo（506-519）も v3 chain で検証。
- 判定: **clone/compare/undo/redo の v3 対応はテストで固定されている。**

---

## 3. オウム返し評価（最重要）— settled/idle テスト

**結論: トートロジーではない。実装の閾値定数（1.0 / 0.001 / 36）を直接アサートするのではなく、particle 座標・driver 値を独立に置き、実装ロジックとは独立に手計算した期待真偽を固定している。**

settled 実装（`viewer-runtime-playback.ts:211-259`）は 2 項の AND:
- (A) `maxParticleSpeed = max_i hypot(x−px, y−py)/dt ≤ 1.0`
- (B) `maxOutputOffsetDelta ≤ 0.001`（前フレーム particles を px,py から復元し、θ_local 差分を anchor 経由で算出）
かつ min-frames ガード（36）。

各ケースを実装から独立に検算（`viewer-runtime-playback.test.ts`）:

| ケース | 状態（独立構成） | 手計算 | 期待 | 判定 |
|---|---|---|---|---|
| rest（31-42） | `{x:0,y:10,px:0,py:10}`, φ=0 | speed=0; θ_world=atan2(0,10)=0, 前後同一 → delta=0 | **true** | 真下静止を独立構成。非オウム返し |
| swinging（44-57） | `{x:4,y:20,px:0,py:10}`, φ=0 | speed=hypot(4,10)/dt≈646 ≫ 1.0 | **false** | tip が速く動く状態。非オウム返し |
| output changing（59-74） | `{x:3,y:9,px:1,py:9.5}`, φ=30 | speed=hypot(2,-0.5)/dt≈124 ≫ 1.0 | **false** | 横振れ状態。非オウム返し |
| pre-min-frames（76-87） | rest, frameCount=MIN−1 | ガードで即 false | **false** | 閾値ガードを固定 |

**独立性の評価:**
- rest/swinging/pre-min は独立に構成した物理状態から期待真偽を書いており、明確に非トートロジー。
- rest ケースの (B) 項（delta=0）と (A) 項（speed=0）の両方が真であることで true を確定させており、両項を同時に固定。

**留意（オウム返しではないが精度上の注記）:**
- "output changing" ケース（59-74）は、コメントでは「particle-speed と output-offset-delta の両項が not-settled をフラグする」と述べているが、実際には (A) 速度項だけで既に speed≈124 ≫ 1.0 となり false が確定する。**(B) output-offset-delta 項を単独で false に落とすことを分離検証してはいない**（速度項が支配的）。結論の false は物理的に正しく独立構成だが、(B) 項単独の実効性を保証するテストではない。→ 被覆ギャップ §5 に記載。

**viewer-runtime-screen.test.ts の統合テスト（idle throttle）:**
- "stops the Viewer Dynamics playback loop after settled state"（762-784）: settled で `pendingCount()===0`（RAF 停止）を挙動として固定。
- "restarts Viewer Dynamics playback from idle when a driver value changes"（786-816）: idle 後に driver=30 変化 → `pendingCount()===1` かつ requestCount 増加、描画 boundsX が 0 → 非0 に変化。**RAF 再起動を実挙動で固定**。
- "restarts Reset simulation while preserving Runtime Controls overrides"（818-852）: reset で RAF 再起動しつつ override 保持。
- これらは particle 状態のオウム返しではなく、ループの起動/停止という**観測可能な副作用**を固定しており実効的。
- "advances Viewer Dynamics over runtime frames and keeps motion after driver stops"（417-463）: 121 フレーム進めて maxParticleSpeed(settled) < maxParticleSpeed(first) を固定（減衰の単調性）。
- "injects Dynamics output offsets into the Viewer Clean Stage"（635-676）: pin=R(30°)·(5,0)、真下 particle 配置 → θ_local=−30 → clamp(±10)=−10 → warp offset −4 → boundsX=−4。§3.5 の end-to-end を手計算で固定。**非オウム返し**。

---

## 4. 既存テスト非退行の切り分け妥当性

§1 で自分で実行・確認済み。431 pass / 4 fail、失敗 4 件は `diagnostics-jump-actions.test.ts` の entry 名リネーム由来（mesh/rig/dynamics 横断、両ファイル working-tree 未変更 = HEAD 由来）。dynamics スキーマとは無関係。Gnome の切り分けは妥当。

---

## 5. 被覆ギャップ（欠けていても fail ではない申し送り）

1. **多段 N≥2 の物理出力**: `inspector.test.ts` は segmentLengths `[14,10]` で chain 行が 2 本描画されることを UI 検証するが、**多段チェーンの output θ_local（segmentIndex≥2 の角読み）を物理評価で固定するテストは editor 側に無い**。§4/§3.5 は N≥2・segmentIndex 別出力を解禁しているが、editor preview/viewer で 2 段目の角を読む経路の値固定は未被覆。（設計 §11 でも「多セグメント実運用検証は未決」とされており、スキーマ・ソルバは runtime-core 側で対応済みと推測。）

2. **複数 output**: editor の draft/preview/UI はすべて **単一 output** 前提（`updateDynamicsDraftOutput` は `outputs[0]` 固定、`createPreviewOutputSummary` は `group.outputs[0]` のみ評価）。§4 は outputs 複数解禁だが、editor で複数 output を同時に扱う経路・テストは無い。現行 UI が 1 output 設計なら整合的だが、複数 output のスキーマ往復（clone/compare/validate の複数エントリ）を固定するテストは無い。

3. **settled (B) 項（output-offset-delta）の単独検証**: §3 記載のとおり。速度項がゼロ／微小で **かつ** output-offset-delta だけが閾値超過となる状態（例: particle は静止に近いが anchor φ が動いて θ_local が変化する縮退ケース）を分離して false に落とすテストが無い。(B) 項の回帰を守るには、speed≤1.0 だが delta>0.001 となる state を構成するテストが望ましい。

4. **rootOffset は非ゼロを被覆済み**（`{x:5,y:0}` を state/screen 両テストで使用）。y 成分非ゼロや負値の rootOffset は未被覆だが優先度低。

---

## 6. 判定

**合格。** 計画 §7 の必須テスト（新診断の正/負アサーション、stepDynamics 整合、anchor 経由出力 §3.5、§8 プリセット、clone/compare v3、settled 新判定単体＋統合）はすべて実在し、意味のあるアサーションを持つ。settled/idle テストはトートロジーではなく、独立に構成した物理状態・観測可能なループ挙動を固定している。既存赤 4 件は dynamics 無関係の pre-existing（entry 名リネーム由来）で、Domain B 起因ではないことを失敗内容・git 状態から確認した。

被覆ギャップ（§5）はいずれも「即 fail」ではない申し送りであり、修正差分の指示は無し。特に §5-1（多段物理出力）と §5-3（settled B 項単独）は、将来 N≥2 を実運用する際・settled 判定を触る際の回帰リスクとして Orch/後続 wave に記録を推奨。

## 質問（呼び出し元 Orch-Sylph へ）

- 被覆ギャップ §5-1（多段 N≥2 の editor 物理テスト）・§5-2（複数 output）は、本 wave のスコープ（editor を v3 対応させる最小）では意図的に単一 segment/output に絞っている可能性がある。多段・複数 output の editor 対応が本 wave の受け入れ範囲に含まれるか（含まれるなら追加テスト要求、含まれないなら次 wave 申し送りで可）を確認したい。
- settled (B) 項単独テスト（§5-3）を本 wave で追加要求するか、それとも settled 判定の実効性は現状（速度項＋統合挙動）で足りると判断するか、Orch の裁量を確認したい。
