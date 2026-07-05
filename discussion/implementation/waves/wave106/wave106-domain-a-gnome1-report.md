# Wave106 Domain A — Gnome-1 実装報告（package-format / contracts / runtime-core）

> 担当: Gnome-1（opus）。dynamics v0（`additivePendulumV0`）→ 世界系 Verlet 質点チェーン（`worldFrameChainV1`）への破壊的置換のうち、スキーマ + 状態 + ソルバ + evidence 投影レイヤ。
> 呼び出し元: Orch-Sylph（`wave106-core-replacement`）。
> 設計オラクル: `discussion/design/dynamics-world-frame-chain.md`（§3 物理 / §4 スキーマ / §5 命名 / §6 裁定）。

## 判定: **completed（自ドメイン境界内）** — 下記「テスト結果」の但し書きを要確認

自スコープ（package-format / contracts / runtime-core）の **非テスト src は tsc 0 error**、**自己完結テストは全 green**。残る赤テストは全て **Gnome-2 が担当する fixtures/** と authoring-core ビルダーに依存**しており、私のスコープでは green にできない（fixtures/** は Forbidden）。Gnome-2 完了後に green 化する想定。詳細は下記。

---

## 1. 作成/変更したファイル一覧（全27ファイル、すべて自スコープ内）

### package-format（スコープ A）
- `packages/package-format/src/model-files.ts` — v3 スキーマ本体（下記 §2.1）
- `packages/package-format/src/runtime-export.ts` — solver 契約リテラル `runtime-dynamics-chain-v1` / capability `dynamics-chain-solver-v1`（§5）。`RuntimeExportDynamicsGroupSchema = DynamicsGroupSchema` は裁定#6 通り再エクスポートのまま無変更。
- テスト: `model-variants.test.ts`, `package-document.test.ts`, `runtime-export.test.ts`

### contracts（スコープ B）
- `packages/contracts/src/runtime-state.ts` — `RuntimeDynamicsParticleSchema` 新設 + `RuntimeDynamicsGroupStateSchema = { particles, tick, resetCounter }`（§4末尾）
- `packages/contracts/src/runtime-diff.ts` — `dynamicsChanges` の before/after を新 stateSummary フィールド（`particleCount/maxParticleSpeed/tipAngleLocalDeg`）へ置換（§5）
- テスト: `contracts-integration.test.ts`, `diff-envelopes.test.ts`, `runtime-evidence.test.ts`

### runtime-core（スコープ C）
- `packages/runtime-core/src/dynamics-evaluation.ts` — **ソルバ全面書換**（§3.2〜§3.5、下記 §2.2）
- `packages/runtime-core/src/normalized-runtime-graph.ts` — Normalized 型群を v3 スキーマへ（`NormalizedDynamicsChain` 追加、`NormalizedDynamicsPendulum`/`NormalizedDynamicsNormalization` 撤去、input=`{parameterId,kind,scale}`、output=`{parameterId,segmentIndex,scale,limit}`）
- `packages/runtime-core/src/snapshot.ts` — `EvaluatedDynamicsGroupSchema`（solverKind `worldFrameChainV1`、stateSummary 新3フィールド、debug をアンカー姿勢へ）+ `createEvaluatedDynamics` 再実装
- `packages/runtime-core/src/snapshot-comparison.ts` — `dynamicsChanges` 生成を新フィールドへ
- `packages/runtime-core/src/state-compatibility.ts` — 欠損グループ初期化を particles 化（`createResetDynamicsStateFromGraph`）
- `packages/runtime-core/src/initial-state.ts` — 初期状態を particles 化（同上）。旧 `computeDynamicsSource` 再エクスポートを撤去
- `packages/runtime-core/src/parameter-resolution.ts` — 出力オフセットをアンカー認識版に接続（下記 §5 裁量判断）
- `packages/runtime-core/src/runtime-options.ts` — `evaluatorVersions.dynamics` を `worldFrameChainV1` へ（§5）
- `packages/runtime-core/src/tutorial-evidence-summary-schema.ts` — `solverKind` リテラルを `worldFrameChainV1` へ（§5）
- テスト: `dynamics-evaluation.test.ts`（新設・物理妥当性テスト群）, `initial-state.test.ts`, `parameter-resolution.test.ts`, `runtime-core.test.ts`, `viewer-evaluation.test.ts`, `tutorial-evidence-summary.test.ts`, `snapshot-comparison.test.ts`, `dynamics-contract-evidence-fixture.test.ts`（フィールド参照のみ機械的更新、実行時は Gnome-2 fixtures 待ち）

（`discussion/design/_map.md` と `.../orchestration/_map.md` は私が起動された時点で working tree に既に M だった既存差分。私は触っていない。）

---

## 2. 実装した式の要点（設計 §3 のステップ → 実装対応）

### 2.1 スキーマ（§4）— `packages/package-format/src/model-files.ts`
- `DynamicsInputSchema = { parameterId, kind, scale:finite }`（influencePercent/invert/normalization 撤去、rest=default・重み反転=scale 符号に一本化 §3.2）
- `DynamicsChainSchema = { rootOffset:Vec2 既定{0,0}, segmentLengths:number[] (min1, 各finite positive), damping:≥0, gravityScale:≥0 }`（旧 pendulums 配列の後継、グループに1本）
- `DynamicsOutputSchema = { parameterId, segmentIndex:int≥1 既定1, scale:finite, limit:≥0 }`（kind/strength/invert 撤去）
- `DynamicsGroupSchema`: 既存 `dynamicsGroupId/displayName/enabled/presetId` 維持、`inputs(min1) / chain / outputs(min1)`
- `DynamicsFileSchema.schemaVersion = z.literal("dynamics-file-v3")`

### 2.2 ソルバ（§3.2〜§3.5）— `packages/runtime-core/src/dynamics-evaluation.ts`
- **§3.2 アンカー姿勢** → `computeAnchorPose`: `φ_deg = Σ_{angle}(v_i − d_i)·scale`、`T=(Σ_x, Σ_y)`、`P = T + R(φ)·r0`（`R(φ)=[[cosφ,−sinφ],[sinφ,cosφ]]`、φ は deg→rad 変換）。`d_i` はパラメータ default。
- **§3.4 リセット/初期状態** → `createResetDynamicsState`: `x_i = P + (0, Σ_{j≤i}L_j)`、`x̂_i = x_i`。resetCounter インクリメント則は v0 と同一。
- **§3.3 Verlet + 拘束射影** → `stepChain`: `v_i=(x_i−x̂_i)·exp(−damping·dt)` → `x̂_i←x_i` → `x_i←x_i+v_i+(0,g0·gravityScale)·dt²`（`g0=980`）→ 根→先1パス、子のみ移動、縮退時 `(0,L_i)`。`dt=0`/reset 時は据え置き。dt は 0..100ms でクランプ（v0 の maxStableStepMs を踏襲）。
- **§3.5 出力写像** → `computeSegmentThetaWorldDeg` + `computeDynamicsOutputOffsetsWithAnchor`: `d = x_s − x_{s−1}`、`θ_world = atan2(d.x, d.y)·(180/π)`、`θ_local = θ_world − φ_deg`、`rawOffset = θ_local·scale`、`offset = clamp(rawOffset, −limit, +limit)`。
- **§3.7 settled 用の evidence** → `stateSummary.maxParticleSpeed = max_i |x_i−x̂_i|/dt` を snapshot 側で算出（閾値判定自体は Domain B の viewer 側）。
- `advanceDynamicsGroupState` の外形（固定ステップ + アキュムレータが呼ぶ純関数）と `parameter-resolution` の加算合成算術（`base+offset` 再クランプ）は不変。

### 2.3 状態（§4末尾）
- `RuntimeDynamicsGroupState = { particles:[{x,y,px,py}], tick, resetCounter }`。`angle/angularVelocity/previousSource/previousSourceVelocity` 完全撤去。

### 2.4 evidence（§5）
- snapshot `solverKind: "worldFrameChainV1"`、`stateSummary:{particleCount, maxParticleSpeed, tipAngleLocalDeg}`（tip = 最終セグメントの θ_local）、debug をアンカー姿勢（`anchorPhiDeg/pinX/pinY`）へ。diff の `dynamicsChanges` も同フィールド before/after へ同期。

---

## 3. テスト結果（実行コマンド + 件数）

コマンド: `npx vitest run packages/<pkg> [--exclude packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts]`

| パッケージ | 結果 | 備考 |
|---|---|---|
| contracts | **135 passed / 135（全 green）** | — |
| package-format | 107 passed / 136（**29 fail**） | fail 全29件は下記フィクスチャ依存10ファイル（Gnome-2） |
| runtime-core | 135 passed / 140（**5 fail**） | fail 全5件は下記フィクスチャ/authoring-core 依存4ファイル（Gnome-2） |

### 3.1 自己完結テスト（私が green を保証する分）— **全 green**
`dynamics-evaluation.test.ts`(17) / `initial-state.test.ts`(2) / `parameter-resolution.test.ts`(2) / `runtime-core.test.ts`(11) / `viewer-evaluation.test.ts`(4) / `tutorial-evidence-summary.test.ts`(3) / `snapshot-comparison.test.ts`(4) = 43/43 green。contracts 135/135 green。package-format のうち `model-variants` / `package-document`(14) / `runtime-export` = green。

### 3.2 物理妥当性テスト（本 wave の核）と許容誤差の設定値・根拠
`packages/runtime-core/src/dynamics-evaluation.test.ts`（新設、17テスト、全 green）。期待値は式から独立に導出（実装のオウム返しではない）。

- **平衡点（§3.6 症状の直接治療）**:
  - ① 角度入力 φ=30° 保持 4000ステップ → `θ_local ≈ −30°`、許容 `toBeCloseTo(-30, 2)`（= |誤差| < 0.005°）。damping=4 で十分減衰する時間を確保。
  - ② positionX 入力保持 → `θ_local ≈ 0`（`toBeCloseTo(0, 2)`）。③ positionY 同様。
  - ③ 複合（角度+並進同時保持）→ `θ_local ≈ −φ`（`toBeCloseTo(-20, 2)`）。
  - kind が意味を持つ: 角度定常(−φ) と 並進定常(0) が **|差| > 1°** で異なることを固定。
  - 誤差根拠: 2 桁精度は「4000ステップ後の残留過渡が 0.005° 未満」を要求する厳しめの値。減衰系の静定を実質的に確認できる。
- **振り子周期（√則）**: N=1、微小初期変位 0.03rad、damping=0。x の下向きゼロ交差間隔から全周期を実測し `2π√(L/(g0·gravityScale))` と比較。許容 **±3%**（`> expected*0.97 && < expected*1.03`）。根拠: 有限ステップ積分誤差 + 微小角近似からの逸脱を吸収する最小限。独立検算（`node` スクリプト）で L=14/gs=1 の実測周期は解析値と 4 桁一致（ratio 1.0000）を確認済み。gravityScale ×4 → 周期 ×0.5 を **±2%**（`0.48–0.52`）で固定（独立検算 ratio 0.5001）。
- **減衰単調性**: damping=3 で |x| の連続する極大（包絡）が単調非増加（許容 `+1e-6` の数値マージン）。damping=0 で 60000 ステップ後も最大半径 < L+0.01（Verlet+剛拘束の有界性）。
- **拘束剛性（§3.3）**: N=3、200ステップ全てで各セグメント長 = L_i（`toBeCloseTo(L, 6)`、= |誤差| < 5e-7 cm）。射影1パスで長さが厳密保存されることを確認。
- **多段+segmentIndex**: N=2 で出力2本（segmentIndex 1/2）が独立の θ_local を返す。手組みの折れチェーンで seg2 の角が「pin ではなく第1質点基準」で測られることを確認（seg1=0°、seg2=90°）。
- **出力 clamp/scale**: rawOffset の ±limit クランプ、deg→パラメータ単位の scale 変換。
- **決定論**: 同一入力2回実行の完全一致（`toEqual`）。dt=0 据え置き。§3.4 リセット整列（`x_i=P+(0,ΣL_j)`）。

### 3.3 **赤のまま残る14テスト（全て Gnome-2 依存、私のスコープでは green 化不能）**
すべて `fixtures/**`（Forbidden、Gnome-2）または authoring-core ビルダー（Gnome-2）に依存。失敗原因は「fixture の `dynamics.json` が `dynamics-file-v2`」「fixture の expected snapshot が `additivePendulumV0`」「`tutorial-mini-model-seed.ts`（authoring-core）が旧 pendulum 形状」。私のスキーマは正しく v2 を reject している（＝期待通りの失敗）。

- runtime-core（4）: `dynamics-contract-evidence-fixture.test.ts` / `runtime-grid2d-keyform-fixture.test.ts` / `runtime-keyform-contract-fixture.test.ts` / `wave30-tutorial-mini-model-contract-fixtures.test.ts`
- package-format（10）: `binary-asset.test.ts` / `binary-asset-fixture.test.ts` / `minimal-contract-fixture.test.ts` / `package-binary-file-set.test.ts` / `package-file-set.test.ts` / `portable-package-bundle.test.ts` / `portable-package-bundle-contract.test.ts` / `source-asset-rights-fixture.test.ts` / `workspace-file-set.test.ts` / `workspace-save-plan.test.ts`

これらの package-format 10ファイルは dynamics DTO をインラインで持たず（grep で inline dynamics 参照 0）、共有 fixture パッケージの `dynamics.json` を読むだけ。Gnome-2 が 21 fixture を v3 再生成すれば green 化する。runtime-core 4ファイルのうち `dynamics-contract-evidence-fixture.test.ts` は本文のフィールド参照（`stateSummary.angle`→新3フィールド、pendulums→chain）を私が機械的に更新済みなので、fixture が揃えば追加編集なしで通る想定。他3ファイルは fixture の expected JSON 差し替えのみで通る。

## 4. tsc 結果

- コマンド: `npx tsc --noEmit`（root。root tsconfig の include は `packages/*/src` のみ、apps は各自 tsconfig なので対象外）
- **自スコープ3パッケージ src+test の error = 0**（`grep -E "^packages/(runtime-core|contracts|package-format)/"` で 0 件を確認）
- root 全体 exit = 1、**残 53 error は全て authoring-core / operation-core / validator-core（Gnome-2 スコープ）**。内訳: authoring-core `runtime-graph-dynamics.ts`(11) 他、validator-core `dynamics-semantic.ts`(9)、operation-core `create/update-dynamics-group.ts`(3) 等。**apps の tsc が割れるのは Domain 計画通り想定内**。
- 検証中に一時 `tsconfig.gnome1.json`（自3パッケージのみ include）を root に置いて slice を確認し、完了後に削除済み（tracked ファイル無し）。

## 5. 裁量判断（設計未定義を合理的に補った箇所）

1. **`parameter-resolution.ts` の出力ルーティングをアンカー認識版へ接続**（要レビュー）。設計 §3.5 は `θ_local = θ_world − φ_deg` を要求するが、φ（アンカー）は状態（`{particles,tick,resetCounter}`、§4）に**持たない**設計。従って出力オフセットは「現在の入力から §3.2 でアンカーを再計算」して得る必要がある。`getDynamicsOutputOffsetForParameter` の署名を `(graph, group, state, authoredParameterValues, parameterId)` に変更し、`resolveEffectiveParameterValues`（graph と authoredParameterValues を保持済み）から呼ぶよう接続した。**加算合成の算術（`base+offset` 再クランプ）は一切不変**であり、変更したのは「offset の算出が φ を知る」点のみ。これがないと平衡点テスト①（角度→−φ）が成立せず、症状が治らない。設計の不変条件（加算合成枠組み）には抵触しないと判断したが、`parameter-resolution.ts` が名指しの不変対象だったため escalate ではなく裁量として明記する。**式は変えていない（§3.5 の通り）。**
2. **`createEnabledDynamicsByOutputParameterId` を全 output 走査へ**。旧実装は `group.outputs[0]` のみを索引していた（単一出力前提）。§4 で outputs 複数解禁・segmentIndex 紐付けになったため、全 output を parameter→group 索引に登録するよう変更（多段+segmentIndex テストの前提）。曖昧パラメータ（複数出力が同一パラメータを駆動）は従来通り drop。合成算術は不変。
2. **snapshot の単一出力 evidence フィールドを「代表（先頭）出力」として維持**。§5 は stateSummary の置換のみ規定。`outputParameterId/outputOffset/effectiveOutputValue`（単数）は tutorial-evidence-summary が消費するため撤去せず「先頭 output の代表値」として残置。`stateSummary.tipAngleLocalDeg` は最終セグメントの θ_local を採用。
3. **snapshot debug 3フィールドの意味付け**。旧 `rawTarget/source`（スカラ源）は消滅するため、debug を `anchorPhiDeg/pinX/pinY`（§3.2 アンカー姿勢）に置換。診断用途で有用な世界系の可観測量。
4. **状態形状不一致時のリセット**。`isStateShapeCompatible`（particles.length ≠ segmentLengths.length）でチェーン長が変わった旧状態を検出し、ステップ時に自動リセット（縮退回避）。設計未定義の防御。
5. **`createResetDynamicsState(..., resetApplied=false)` を snapshot の欠損グループ表示に使用**。resetCounter を増やさず現姿勢のサマリを作るため。

## 6. Basis Coverage Self-Report（設計 §3/§4/§5 → 実装ファイル対応）

| 設計項目 | 実装箇所 |
|---|---|
| §3.1 座標系/g0=980/R(φ) | `dynamics-evaluation.ts` `computeAnchorPose`（R(φ)）, `GRAVITY_G0` |
| §3.2 アンカー姿勢（φ_deg, T, P=T+R(φ)r0、rest=default） | `dynamics-evaluation.ts` `computeAnchorPose` |
| §3.3 Verlet（指数減衰→位置保存→積分）+ 根→先1パス子のみ射影・縮退真下 | `dynamics-evaluation.ts` `stepChain` |
| §3.4 リセット（真下整列・速度0）、dt=0 据え置き | `createResetDynamicsState` / `stepDynamics`（dt=0 分岐） |
| §3.5 出力（atan2(d.x,d.y)、θ_local=θ_world−φ、clamp±limit、per-segmentIndex、per-output scale） | `computeSegmentThetaWorldDeg` / `computeDynamicsOutputOffsetsWithAnchor` |
| §3.6 平衡点検算 | `dynamics-evaluation.test.ts`（平衡点テスト群） |
| §3.7 settled 用 maxParticleSpeed | `snapshot.ts` `createEvaluatedDynamics`（stateSummary） |
| §4 DynamicsInput/Chain/Output/Group、schemaVersion v3、廃止フィールド撤去 | `model-files.ts` |
| §4末尾 RuntimeDynamicsGroupState = {particles,tick,resetCounter} | `contracts/runtime-state.ts` |
| §5 solverContract `runtime-dynamics-chain-v1` / capability `dynamics-chain-solver-v1` | `package-format/runtime-export.ts` |
| §5 solverKind `worldFrameChainV1` | `snapshot.ts` / `runtime-options.ts` / `tutorial-evidence-summary-schema.ts` |
| §5 stateSummary {particleCount,maxParticleSpeed,tipAngleLocalDeg}（diff 同期） | `snapshot.ts` / `contracts/runtime-diff.ts` / `snapshot-comparison.ts` |
| §6#6 RuntimeExportDynamicsGroupSchema 同一維持 | `runtime-export.ts`（`= DynamicsGroupSchema` 無変更） |
| 加算合成・固定ステップ枠組み不変 | `parameter-resolution.ts`（算術不変）/ `runtime-core.ts advanceRuntimeState` 無変更 |
| 廃止識別子の残置ゼロ（自スコープ src） | grep で `additivePendulumV0/dynamics-file-v2/pendulum-solver/pendulums/influencePercent/angularVelocity` = 0 件確認 |

## 7. escalate / 質問

**escalate 相当なし（式の複数解釈・parameter-resolution 枠組み変更・install 要件・Forbidden 侵入は発生せず）**。ただし Orch-Sylph の裁定を仰ぎたい判断が1点:

- **Q1（境界確認）**: 「あなたのスコープの全テストが green」を字義通り取ると、自パッケージ内でも `fixtures/**` / authoring-core ビルダーに依存する14テストファイル（§3.3）は Gnome-2 完了まで green にできない（fixtures/** は私の Forbidden）。本報告は「自己完結テスト全 green + 非テスト src tsc 0 error」をもって Gnome-1 完了とみなしたが、この14ファイルの green 化を Gnome-2 の完了条件（fixture 再生成 + 残る expected JSON 差し替え）に含める理解で問題ないか。含めるなら、`dynamics-contract-evidence-fixture.test.ts` は本文更新済み・`runtime-grid2d/keyform-fixture` は expected JSON 差し替えのみで通る旨を Gnome-2 委任文に転記されたい。
- **Q2（裁量#1の追認）**: §5「裁量判断」#1 の `parameter-resolution.ts` 出力ルーティング接続（合成算術は不変、offset 算出が φ を知るだけ）を Physics/Spec レビューで追認いただきたい。これがないと平衡点が成立しない構造的必然だが、名指しの不変対象への接続変更であるため。

## 8. 次段（Gnome-2）への申し送り

- Normalized 型（`NormalizedDynamicsGroup/Input/Chain/Output`）は本 wave で確定。Gnome-2 は authoring-core `runtime-graph-dynamics.ts` / `to-runtime-graph.ts` の DTO→Normalized マッピングを新形状（input.scale / chain / output.segmentIndex）へ。
- `createResetDynamicsStateFromGraph(graph, group, authoredValues, prevCounter, resetApplied)` を状態初期化の共通口として公開済み。
- validator §7・operation payload・ai-interface 文言・fixtures 21件は Gnome-2 スコープ。fixtures 再生成後に §3.3 の14テストが green 化する。
