# Dynamics v1: World-Frame Chain（dynamics-file-v3）

> Status: **Accepted / wave106 implemented**（ユーザー設計承認 2026-07-04 → Wave106 で全層実装完了・final clean integration review pass 2026-07-05。実装記録: [../implementation/waves/wave106/_map.md](../implementation/waves/wave106/_map.md)）
> 前身: dynamics v0 = `additivePendulumV0`（wave81、`dynamics-file-v2`）の**破壊的置換**
> 破壊半径の全量台帳: [../implementation/orchestration/wave106-blast-radius-inventory.md](../implementation/orchestration/wave106-blast-radius-inventory.md)

## 1. 経緯と診断（なぜ置換か）

ユーザー体感の症状: **「入力を止めて放置したとき、揺れ物が『真下』で静止せず、別の姿勢に収束する」**。

原因は v0 ソルバ（`packages/runtime-core/src/dynamics-evaluation.ts` の `stepDynamics`）の構造そのもの:

```
α = (source − θ)·reactionSpeed/length + a_source·sway − ω·convergenceSpeed
```

- 復元力が**入力値 `source` へ引き戻すバネ**であり、系の平衡点は常に「入力値」。重力方向という概念がコードに存在しない
- 入力スキーマの `kind (angle|positionX|positionY)` をソルバが読んでおらず、回転と並進が無差別にスカラー畳み込みされる。並進入力は物理的には定常寄与ゼロであるべきだが、v0 では永久に引かれ続ける（チューニングで治らない構造欠陥）
- `sway` / `reactionSpeed` という自由ノブの存在自体が、単位系の欠如の補償（本来、入力がどれだけ揺れを励起するかはアンカーの運動学から一意に決まり、調整対象ではない）

設計判断（ユーザー承認済み）: **互換を捨て、単位ベースの新スキーマ + 世界系 Verlet 質点チェーンへ全面置換する**。v0 設計文書（`screen-design/components/dynamics-tool.md` 189-204）自身が「演算式は実装固定ではない」と明記しており、Cubism Physics 互換は既に非目標（`mvp-authoring-runtime/03-runtime-evaluation-semantics.md` 335）。

## 2. 設計原理（不変の芯）

**シミュレーションは仮想世界座標で行い、重力は世界固定の真下。入力は「アンカー（頭）の世界姿勢」を動かすだけ。出力は「頭フレームから見た振り子角」。**

これにより:

- 角度入力を保持 → チェーンは世界で真下に静定し、頭フレームでは `−φ`（頭の回転の逆）に見える = 髪は頭が回っても世界では垂れたまま
- 並進入力を保持 → 静定出力は厳密に 0（過渡でのみ揺れる）
- 「揺れの励起の強さ」はピンの運動学から自動で生じ、専用ノブが不要になる

## 3. 物理仕様（正確な式。L0誤訳対策としてここが正）

### 3.1 座標系と定数

- 仮想 dynamics 空間: 2次元、**y-down**（+y = 重力方向 = 画面下）。単位 = 仮想 cm
- 重力定数 `g0 = 980`（cm/s²）。グループごとの `gravityScale` を乗じる
- 回転の正方向: +x を +y へ回す向き（y-down では**画面上の時計回り**。rigging の規約と同一）
- 回転行列 `R(φ) = [[cosφ, −sinφ], [sinφ, cosφ]]`

### 3.2 入力 → アンカー姿勢（毎サブステップ、現在のパラメータ値から直接計算）

各入力 i のパラメータ値 `v_i`、パラメータの default 値 `d_i`、入力の `scale_i`（符号で反転を表現）:

```
φ_deg = Σ_{kind=angle}     (v_i − d_i) · scale_i        [deg]
T     = ( Σ_{kind=positionX} (v_i − d_i) · scale_i ,
          Σ_{kind=positionY} (v_i − d_i) · scale_i )    [cm]
P     = T + R(φ) · r0        （ピン位置。r0 = rootOffset [cm]、回転中心→付け根）
```

- `scale` の単位は kind で決まる: angle = **deg / パラメータ単位**、position = **cm / パラメータ単位**
- v0 の min/center/max 正規化・influencePercent・invert は**廃止**（rest 基準は常にパラメータ default、重みと反転は scale の値と符号に一本化）
- 入力の微分（速度・加速度）の推定は**不要**。アンカー運動は拘束射影を通じて位置レベルでチェーンへ伝わる（previousSource / previousSourceVelocity が状態から消える機序）

### 3.3 チェーンの状態と積分（Verlet、固定ステップ）

状態: 自由質点 `x_1..x_N`（N = `segmentLengths.length`）とその前ステップ位置 `x̂_1..x̂_N`。`x_0 = P`（キネマティック、状態に持たない）。

毎サブステップ（`dt` 秒 = fixedStepMs/1000、既存のアキュムレータ機構は不変）:

```
1. アンカー姿勢を §3.2 で計算 → P
2. 各 i = 1..N（Verlet 積分）:
     v_i   = (x_i − x̂_i) · exp(−damping · dt)     （指数減衰。damping [1/s] ≥ 0）
     x̂_i  ← x_i                                    （更新前の位置を保存）
     x_i   ← x_i + v_i + (0, g0·gravityScale)·dt²
3. 拘束射影（根→先の一回前進パス、子のみ移動）:
     x_0 := P
     for i = 1..N:
       d = x_i − x_{i−1}
       |d| = 0 なら d = (0, L_i)                    （縮退時は真下）
       x_i := x_{i−1} + d · (L_i / |d|)
   射影は位置のみ修正し、速度へ再注入しない（Verlet が暗黙に処理）
```

- 積分器の選定理由: 位置ベース Verlet + 拘束射影は入力スパイクで爆発せず、剛性調整が不要で、N=1 で単振り子に退化する（1段の修正と多段解禁が同一コード）
- 決定論: 純関数・固定ステップ・射影1パス固定・乱数なし。既存のテスト方針（同一入力2回実行の完全一致）を維持

### 3.4 リセット / 初期状態

現在の入力から P を計算し、質点を真下に整列させ速度ゼロ:

```
x_i = P + (0, Σ_{j≤i} L_j),   x̂_i = x_i
```

`dt = 0` またはリセット適用時は状態据え置き（v0 と同じ）。

### 3.5 出力写像

出力 o（`segmentIndex = s`、`scale`、`limit`）:

```
d        = x_s − x_{s−1}
θ_world  = atan2(d.x, d.y)                （0 = 真下、+x 側が正）[rad → deg]
θ_local  = θ_world_deg − φ_deg            （頭フレームから見た角）
rawOffset = θ_local · scale               （scale: パラメータ単位 / deg。符号で反転）
offset    = clamp(rawOffset, −limit, +limit)
```

`offset` は既存どおりベースパラメータ値へ**加算**され、パラメータ範囲で再クランプされる（`parameter-resolution.ts` の加算合成は不変）。

### 3.6 平衡点の検算（受け入れの核）

- 角度入力を φ に保持 → チェーンは世界で真下に静定、`θ_world = 0`、`θ_local = −φ` → **髪は頭に対して逆回転 = 世界では垂れたまま**（v0 症状の直接治療）
- 並進入力を保持 → φ = 0、`θ_local = 0` → **定常寄与ゼロ**
- ピンが回転中心からオフセットしている（r0 ≠ 0）場合、頭の回転は付け根を弧に沿って並進させる（レバーアーム）——過渡の揺れとしてのみ現れ、静定は上と同じ

### 3.7 静定（settled）判定

`max_i |x_i − x̂_i| / dt`（最大質点速度 cm/s）が閾値未満、かつ出力オフセットの変化がパラメータ実効閾値未満、を静定とする。ピンが動けば根の質点が即座に動く（拘束にたわみがない）ため、質点変位だけで入力運動も捕捉できる。閾値定数は viewer 側（`VIEWER_RUNTIME_SETTLED_*` 相当）で再定義。

## 4. スキーマ（dynamics-file-v3）

`packages/package-format/src/model-files.ts` の置換形（Zod 概形）:

```ts
DynamicsInputSchema = {
  parameterId: ParameterId,
  kind: "angle" | "positionX" | "positionY",
  scale: number (finite)            // angle: deg/unit, position: cm/unit。符号=反転
}

DynamicsChainSchema = {
  rootOffset: { x: number, y: number },   // cm。回転中心→付け根。既定 {0,0}
  segmentLengths: number[] (min 1, 各 finite positive),  // cm
  damping: number (finite, ≥0),           // 1/s
  gravityScale: number (finite, ≥0)       // 1 = 素の重力
}

DynamicsOutputSchema = {
  parameterId: ParameterId,
  segmentIndex: int (≥1, 既定 1),          // どのセグメントの角を読むか
  scale: number (finite),                  // パラメータ単位/deg。符号=反転
  limit: number (finite, ≥0)               // オフセット絶対値クランプ [パラメータ単位]
}

DynamicsGroupSchema = {
  id, name?,
  inputs:  DynamicsInput[]  (min 1),
  chain:   DynamicsChain,                  // 旧 pendulums 配列の後継（グループに1本）
  outputs: DynamicsOutput[] (min 1)        // 複数解禁（セグメント別出力の口）
}

DynamicsFileSchema.schemaVersion = "dynamics-file-v3"
```

**廃止フィールド**: `pendulums`（length/sway/reactionSpeed/convergenceSpeed の4ノブ）、input の `influencePercent` / `invert` / `normalization`、output の `kind` / `strength` / `invert`。

実行時状態（`packages/contracts/src/runtime-state.ts`）:

```ts
RuntimeDynamicsGroupStateSchema = {
  particles: Array<{ x, y, px, py }>,   // px,py = 前ステップ位置。length = N
  tick, resetCounter                    // 据え置き
}
```

**廃止**: angle / angularVelocity / previousSource / previousSourceVelocity。

## 5. 命名（machine-readable identifiers）

| 対象 | 旧 | 新 |
|---|---|---|
| ファイル schemaVersion | `dynamics-file-v2` | `dynamics-file-v3` |
| solver 契約（runtime-export） | `runtime-dynamics-pendulum-v1` | `runtime-dynamics-chain-v1` |
| required capability | `dynamics-pendulum-solver-v1` | `dynamics-chain-solver-v1` |
| snapshot solverKind | `additivePendulumV0` | `worldFrameChainV1` |
| tuning profile schemaVersion | `runtime-player-dynamics-tuning-profile-v1` | `runtime-player-dynamics-tuning-profile-v2` |

evidence の `stateSummary` は `{ particleCount, maxParticleSpeed, tipAngleLocalDeg }` へ置換（diff の `dynamicsChanges` も同フィールドの before/after へ）。

## 6. 判断要7件の裁定（2026-07-04 ユーザー確認済み）

| # | 論点 | 裁定 |
|---|---|---|
| 1 | マイグレーション | **書かない**。`dynamics-file-v3` 新設、旧 v2 データは reject（リポジトリ全体が schemaVersion 厳密一致方式で、移行実装の前例なし）。フィクスチャ21件は書き換え |
| 2 | player 保存済みプロファイル | **破棄受容**。profile schemaVersion バンプで自動破棄。ユーザーの現行配信は旧モデル+旧ビルドの凍結ベースラインで運用されており影響なし |
| 3 | カーディナリティ | pendulums 1固定 → **チェーン1本・セグメント N≥1**。outputs も **複数解禁**（segmentIndex で紐付け） |
| 4 | solverKind / capability | §5 の新名へ更新。旧名の残置なし |
| 5 | settled 判定 | §3.7 の質点速度ベースへ再設計 |
| 6 | runtime-export スキーマ共有 | **同一維持**（`RuntimeExportDynamicsGroupSchema = DynamicsGroupSchema` のまま） |
| 7 | テスト51ファイルの精密分類 | wave 実装者が各ドメイン内で処理 |

## 7. validator ルールの改廃

- **維持**: `dynamics.inputMissing` / `driverMissing` / `outputMissing` / `outputTargetDuplicate` / `runtimeEvidenceMismatch` / `outputLimitTooSmall`
- **廃止**: `normalizationInvalid`（フィールド消滅）、`invalidPendulumCardinality`、`invalidOutputCardinality`
- **新設**: `chainSegmentsInvalid`（空 or 非正、blocking）、`outputSegmentIndexOutOfRange`（blocking）、`zeroInputScale`（warning）、`outputScaleZero`（warning）
- **改定**: `unstableSettings`（warning）の新基準 = `damping > 60 || segmentLengths.some(L < 0.1) || N > 16 || gravityScale > 10`

## 8. プリセット初期値（Editor Dynamics Tool。較正前提の初期値）

| preset | segmentLengths [cm] | damping [1/s] | gravityScale | 参考周期* |
|---|---|---|---|---|
| hair | [14] | 2.5 | 1.0 | ≈0.75s |
| ribbon | [10] | 1.2 | 0.8 | ≈0.71s |
| softCloth | [18] | 4.0 | 1.0 | ≈0.85s |
| rigidAccessory | [6] | 8.0 | 1.0 | ≈0.49s |

*周期 = 2π√(L/(g0·gravityScale))。出力側の既定は「パラメータ 1.0 = 30°」（scale ≈ 0.0333）を起点に UI で提示。数値は実装後に Editor プレビュー（ユーザーのざっくり確認導線）で較正する。

## 9. runtime-player チューニングプロファイル v2

配信時オーバーライドの語彙を新ノブへ置換:

```ts
override = { enabled?, outputScale?, limit?, damping?, gravityScale?, lengthScale? }
```

- `outputScale` = 出力 scale への乗数、`lengthScale` = 全セグメント長への乗数（周期の微調整）
- 旧 v1 プロファイルは schemaVersion 検証で自動破棄（裁定 #2）
- **適用規則（wave106 Domain C の裁量を正典化）**: オーバーライド固有の合成ノブ（`outputScale`・`lengthScale`）は**乗数**として合成し、モデル定義の実フィールドと同名のもの（`limit`・`damping`・`gravityScale`・`enabled`）は**置換**する。数値テストで固定済み。Editor の Quick Tune も同一の5語彙・同一の意味論を採用する（wave106 Domain B）

## 10. 運用導線（ユーザー合意 2026-07-04）

- **設計・設定**: headless CLI（既存の dynamics operation 経路。CLI コードは無傷、payload スキーマ差し替えのみ）で L0/Fable が数値設計
- **ざっくり確認**: Editor Dynamics Tool プレビュー（ユーザー）
- **微調整**: runtime-player チューニングプロファイル（ユーザー、配信時）
- 使用例: FaceZ（±10、deg 語義）→ `kind: angle, scale: 1.0`。FaceX（±1.0 正規化）→ `kind: positionX, scale: 3.0`（頭の振りを 3cm/unit の並進として振り子に伝える）

## 11. 未決事項

- 風・外乱入力（将来。世界系の外力として自然に追加できる設計余地のみ確保）
- 多セグメント（N≥2）+ セグメント別出力の実運用検証（スキーマ・ソルバは対応、リグ側の複数 Sway パラメータ設計が前提）
- プリセット数値の較正（実装後、Editor プレビューで）
