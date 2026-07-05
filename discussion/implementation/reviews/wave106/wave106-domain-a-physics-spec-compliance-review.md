# Wave106 Domain A レビュー: Physics / Spec Compliance

- レビュアー: Review-Sylph（読み取り専任）
- 委任元: Orch-Sylph（Wave106 Domain A `wave106-core-replacement`）
- オラクル: `discussion/design/dynamics-world-frame-chain.md` §3
- 主対象:
  - `packages/runtime-core/src/dynamics-evaluation.ts`
  - `packages/runtime-core/src/parameter-resolution.ts`
  - `packages/runtime-core/src/snapshot.ts`
  - `packages/runtime-core/src/dynamics-evaluation.test.ts`

## 判定: 合格

設計 §3.1〜§3.7 の全式が実装に正確に転写されている。独立検算1〜7すべて通過。裁量#1 追認可。物理式の齟齬・要修正事項なし。以下は根拠。

---

## §3.1〜§3.7 の式照合

### §3.1 座標系と定数 — 合格
- `GRAVITY_G0 = 980`（dynamics-evaluation.ts:19）＝ §3.1 の g0。
- `gravityScale` 乗算は `stepChain` の `gravityStep = GRAVITY_G0 * group.chain.gravityScale * dt²`（:218）。
- y-down（+y=重力方向）は重力ベクトルが `(0, +gravityStep)` に加算される（:229）ことで整合。
- 回転行列 `R(φ) = [[cosφ,−sinφ],[sinφ,cosφ]]` は computeAnchorPose の pin 計算（:135-138）で `x = tx + (cos·r0x − sin·r0y)`, `y = ty + (sin·r0x + cos·r0y)` と一字一句一致。

### §3.2 入力→アンカー姿勢 — 合格
- `contribution = (value − rest) · scale`（:120）。rest は parameterDefaults（=パラメータ default）（:119）。§3.2 の `(v_i − d_i)·scale_i` と一致。
- kind 分岐（angle→φ / positionX→T.x / positionY→T.y、:122-128）が §3.2 の Σ 分離と一致。
- `P = T + R(φ)·r0`（:135-138）一致。r0=`group.chain.rootOffset`。
- v0 の min/center/max・influencePercent・invert の痕跡なし（rest は default 固定、重み・反転は scale の値と符号のみ）。§3.2 の廃止規定と整合。

### §3.3 チェーンの状態と積分 — 合格（独立検算1・2で厳密検証、下記）
- Verlet（stepChain :221-231）:
  - `v_i = (x_i − x̂_i)·exp(−damping·dt)`: `velocityX = (particle.x − particle.px) · dampingFactor`（:222）、`dampingFactor = exp(−damping·dt)`（:217）。減衰は速度差に乗算。一致。
  - `x̂_i ← x_i`（更新前保存）: `px: particle.x, py: particle.y`（:227）。`.map` で新オブジェクト生成のため参照は常に旧値。保存タイミング正確。
  - `x_i ← x_i + v_i + (0, g0·gravityScale)·dt²`: `x: particle.x + velocityX`, `y: particle.y + velocityY + gravityStep`（:228-229）。重力は y 成分のみ。一致。
- 拘束射影（:234-257）:
  - `x_0 := P`: `previousX/Y = anchor.pin`（:234-235）。
  - root→tip 1パス、子のみ移動: forEach で `previousX/Y` を射影後の子で更新（:255-256）、親は前反復の確定値を使う。親を動かさない。一致。
  - 縮退 `|d|=0 → d=(0, L_i)`: `if (distance === 0) { deltaX=0; deltaY=segmentLength; distance=segmentLength; }`（:245-250）。真下。一致。
  - `x_i := x_{i−1} + d·(L_i/|d|)`: `projectedX = previousX + deltaX·(segmentLength/distance)`（:251-253）。一致。
- dt クランプ `clamp(dtMs, 0, MAX_STABLE_STEP_MS)/1000`（:268、MAX=100ms）。§3.3 の fixedStepMs/1000 に上限ガードを付けたもので、式の破壊ではない。

### §3.4 リセット/初期状態 — 合格
- `x_i = P + (0, Σ_{j≤i} L_j)`: createResetDynamicsState で cumulativeLength を累積し `{ x: pin.x, y: pin.y + cumulativeLength }`（:176-179）。一致。
- `x̂_i = x_i`: `px: position.x, py: position.y`（:179）。一致。
- `dt=0 またはリセット時は据え置き`: stepDynamics :281 で `dtSeconds === 0 || resetApplied` のとき previousState を返し stepChain を呼ばない。一致。
  （テスト "holds the state when dt = 0" :475-488 が `result.state === initial` を検証）
- 速度ゼロ: px=x のため初回 v=0。

### §3.5 出力写像 — 合格（独立検算3・4で厳密検証、下記）
- `d = x_s − x_{s−1}`: computeSegmentThetaWorldDeg で child=particles[s−1]、parent=（s−1===0 ? pin : particles[s−2]）、`delta = child − parent`（:357-367）。x_0=pin をキネマティックに扱う。一致。
- `θ_world = atan2(d.x, d.y)`: `Math.atan2(deltaX, deltaY)`（:368）。引数順 (x, y) で 0=真下。一致（独立検算3）。
- `θ_local = θ_world_deg − φ_deg`: `thetaLocalDeg = thetaWorldDeg − anchor.phiDeg`（:385）。φ を引く。一致（独立検算4）。
- `rawOffset = θ_local · scale`（:386）、`offset = clamp(rawOffset, −limit, +limit)`（:387-388）。limit は `Math.abs(output.limit)`。一致。

### §3.6 平衡点の検算 — 合格
- 角度入力保持 → θ_world→0, θ_local→−φ: テスト :146-152 が damping=4, φ=30, 4000step で `toBeCloseTo(−30, 2)`。独立検算5・6 参照。
- 並進入力保持 → θ_local→0: テスト :154-171（positionX scale3, positionY scale2）。
- 組み合わせ入力で φ 支配: テスト :173-189。
- kind が意味を持つ（angle の −φ ≠ translation の 0）: テスト :191-207。設計原理の芯（v0 症状の直接治療）を検証。

### §3.7 静定（settled） — snapshot.ts 側で照合、合格
- `max_i |x_i − x̂_i| / dt`: snapshot.ts:498-501 `maxParticleSpeed = max( hypot(x−px, y−py) / dtSeconds )`。§3.7 の最大質点速度式と一致。`dtSeconds = state.fixedStepMs/1000`（:497）。
- `tipAngleLocalDeg`: 末尾 output の thetaLocalDeg（:502, :515 `tipOffset = outputOffsets[last]`）。§5 の stateSummary 定義（particleCount/maxParticleSpeed/tipAngleLocalDeg）と一致。
- 閾値定数そのものは viewer 側で定義（§3.7 明記）であり、runtime-core の責務外。本レーンの対象式は算出のみで正しい。

---

## 独立検算 1〜7

### 1. 積分順序 — 通過
§3.3 の「減衰→x̂保存→位置更新」の順が実装(:221-231)で正確。`.map` による新オブジェクト生成が「更新前の値を参照」を保証し、保存タイミングのズレ（典型バグ）は存在しない。減衰は速度差 `(x−px)` にのみ乗算され、重力ステップ `gravityStep` には乗算されない（重力は減衰対象外＝物理的に正しい）。

### 2. 射影が子のみ移動 — 通過
`previousX/Y` は各反復で「射影後の子」に更新され（:255-256）、親（x_{i−1}）の座標は前反復で確定した値を読むだけで書き換えない。x_0=P は固定（:234-235）。縮退 |d|=0 で d=(0, L_i) 真下（:245-250）。テスト "keeps every segment length equal to L_i"（:369-395、N=3）と "reads the second segment angle relative to the first particle, not the pin"（:420-433）が拘束剛性と親基準を裏付ける。

### 3. atan2 引数順 — 通過
`Math.atan2(deltaX, deltaY)`（:368）＝ atan2(d.x, d.y)。標準の atan2(y, x)（0=右）ではなく、0=真下・+x側が正。y-down 座標系で「真下がゼロ角」になる。テスト :430-432 の手構築ケース（真下=0°、+x方向=atan2(10,0)=90°）で独立確認済み。

### 4. θ_local の符号 — 通過
`thetaWorldDeg − anchor.phiDeg`（:385）。φ を引く（足していない・反転していない）。平衡（θ_world=0）で θ_local=−φ となり、§3.6「髪は頭に対して逆回転＝世界では垂れたまま」が成立。

### 5. 周期の独立計算 — 通過（数値照合済み）
手計算 `T = 2π√(L/(g0·gravityScale))`:
| L | gravityScale | 解析周期 T |
|---|---|---|
| 14 | 1 | **0.75098 s** |
| 14 | 4 | 0.37549 s |
| 10 | 0.8 | 0.70961 s |
| 18 | 1 | 0.85154 s |
| 6 | 1 | 0.49163 s |

- テスト :264 の期待値 `2π√(14/980) = 0.75098s` は手計算と一致。
- §8 プリセット表の参考周期（hair≈0.75 / ribbon≈0.71 / softCloth≈0.85 / rigidAccessory≈0.49）とも全て一致。
- **実装式を Python で独立再現**（Verlet+拘束射影, dt=1ms, angle=0.03rad, ダウンクロッシング法で周期実測）:
  - 実測 gs=1: **0.75100s**（解析値比 1.0000、誤差 +0.003%）→ テストの ±3%（0.97〜1.03）に十分収まる。
  - gs ×4 の周期比: **0.5001**（√則 T∝1/√gravityScale）→ テストの 0.48〜0.52 に収まる。四倍で半周期の √則を独立確認。

### 6. 平衡点の許容誤差の妥当性 — 通過
- 平衡テストは `toBeCloseTo(−φ, 2)`（小数第2位、|誤差|<0.005°）。damping=4, 4000step(≈66.7s相当) で十分収束し、緩すぎず、症状（別姿勢への収束）を確実に捕捉する厳しさ。
- 周期テストは ±3%。有限ステップ誤差(独立再現で +0.003%)＋大振幅補正(0.03rad で約 +0.006%)を吸収しつつ、桁ズレ級のバグは弾く妥当な幅。
- クランプテスト :445 `toBeCloseTo(−45, 0)` は raw≈−45 の粗検証だが、offset の厳密値は :446 `toBeCloseTo(−10, 6)` で担保。
- 多セグメントテスト :414-415 は `toBeCloseTo(−φ, 1)`（damping=4, 6000step）。N=2 の収束はやや遅いため桁1は合理的。

### 7. 裁量#1 の追認 — 追認可
`git diff dc9fae9c` で確認:
- 加算合成算術は **不変**: `rawEffectiveValue = baseValue + (outputOffset?.offset ?? 0)` → `clamp(…, min, max)`（parameter-resolution.ts:57-58）は差分ゼロ。
- 変更は2点のみ:
  1. `getDynamicsOutputOffsetForParameter` に `graph` と `authoredParameterValues` を渡す引数追加（offset 算出が φ＝アンカーを知るため。§3.5 の θ_local=θ_world−φ に φ が必要という設計要請そのもの）。
  2. `createEnabledDynamicsByOutputParameterId` を「outputs[0] のみ」→「全 outputs をループ」へ変更（dynamics-file-v3 の複数 output・segmentIndex 対応、§4）。多重駆動パラメータは曖昧として drop する既存挙動を保持。
- offset 算出が graph/authoredValues を受け取るだけで、式 §3.5 の算術には触れていない。追認可。

---

## 発見した差分

物理式に関する設計との齟齬は **なし**。

補足（要修正ではない観察、参考）:
- dt に上限ガード `MAX_STABLE_STEP_MS = 100`（dynamics-evaluation.ts:20, :268）が入っている。§3.3 は明記していないが、これは式の破壊ではなく大 dt 時の爆発防止であり、fixedStepMs は通常 100ms 未満（プリセット周期 0.49〜0.85s に対し十分小）なので実害なし。設計 §3.3 の「入力スパイクで爆発しない」意図と整合する保守的ガード。

## 質問（呼び出し元へ）

なし。§3 の式に複数解釈が生じる箇所はなく、全て一意に照合できた。
