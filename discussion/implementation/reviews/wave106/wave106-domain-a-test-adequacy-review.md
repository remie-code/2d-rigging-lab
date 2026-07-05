# Wave106 Domain A — Test Adequacy レビュー（3レーンの3）

> レビュアー: Review-Sylph（opus、読み取り専任）。呼び出し元: Orch-Sylph（`wave106-core-replacement`）。
> レーン: Test Adequacy（Required tests の実効性 + fixtures 差分の局在 + golden の正当性）。
> オラクル: `discussion/design/dynamics-world-frame-chain.md` §3.6/§11、`discussion/implementation/orchestration/wave106-plan.md` §6/§11。
> 検証方式: Gnome 報告を鵜呑みにせず、テスト本文・fixtures 差分・golden・validator 実装/catalog を自分で読み、周期式・平衡点残留・golden 数値を独立に再計算。dynamics 系テストを実測実行。

## 判定: **要修正（軽微 / non-blocking 寄り）**

物理妥当性テスト群・スキーマ reject テスト・golden・fixtures 局在は**実効性を持ち、合格**。周期テストは式検証でありオウム返しでないことを独立検算で確認した。`.skip`/`todo`/空実装は**ゼロ**。

一方、Test Adequacy 観点で **2件の欠落（テストの穴）** と、それに紐づく **2件の実装残置（設計§5/§7 の適用漏れ、テストで捕捉されないため green と両立）** を検出した。いずれも実行時の検証・ソルバ挙動には影響しないが、設計要件（命名の完全適用・validator §7 改廃）の一部が**テストの網の外**に落ちている。Domain D の grep gate（旧識別子残置ゼロ）で拾える可能性はあるが、Domain A のうちに是正するのが筋。

---

## 1. 物理妥当性テストの実効性評価（合格）

対象: `packages/runtime-core/src/dynamics-evaluation.test.ts`（17 tests、実測 green を確認）。

### 1.1 平衡点テスト①②③（§3.6 症状の直接治療）— 実効性あり、ただし「動的収束」ではなく「reset 整列 + 静止の持続」を主に検証

- ①角度 φ=30° 保持 4000ステップ → `θ_local` を `toBeCloseTo(-30, 2)`（|誤差|<0.005°）で固定。
- ②positionX / positionY 保持 → `toBeCloseTo(0, 2)`。③複合（angle+positionX）→ `toBeCloseTo(-20, 2)`。
- ⑤kind が意味を持つ: 角度定常(−φ) と 並進定常(0) が `|差|>1°` で異なることを固定。

**独立検証で判明した構造的注記（穴ではないが要理解）**: ソルバの `createResetDynamicsState`（§3.4）は**現在のアンカー姿勢のピン直下に質点を真下整列**させる。入力を一定保持するシナリオでは、reset 直後に既に平衡（θ_world=0, θ_local=−φ）が成立しており、**過渡がほぼ生じない**。私がソルバを直接叩いて測ると、角度保持・並進保持・複合いずれも `20ステップ / 100ステップ / 4000ステップ` で残留 = **厳密に 0**（θ_local が最初から −φ / 0 に張り付く）。

- 含意（プラス）: v0 の症状（入力値へ引き戻すバネで別姿勢に収束）に対しては、この構造なら「−φ 整列が保たれること」自体が治療の証明になる。減衰時定数 τ≈2/damping=0.5s に対し総シミュ時間 66.7s（残留 exp(−133)）で、仮に過渡があっても許容誤差は天文学的マージンで満たす。許容誤差 `2桁` は緩すぎず、症状（別姿勢収束）が起きれば θ が −φ から大きく外れて確実に落ちる。
- 含意（限界）: これらのテストは「静定値の正しさ」を固定するが「**過渡を経た動的収束**」は主に検証していない。真に過渡を経た収束を検証するのは §1.2 周期テスト・§1.3 減衰テスト（手組み初期変位から始める）である。この分担で Verification Matrix はカバーされているため**欠落ではない**が、平衡点テストの許容誤差が「厳しい静定要求」として意味を持つ主因は damping と長時間ではなく reset 整列である、という点を記録する。

### 1.2 周期テスト（√則）— 式検証であり実装オウム返しでない（合格、独立検算済み）

- 期待値はテスト本文内で `2*Math.PI*Math.sqrt(L/(g0*gravityScale))` として**式から計算**（マジックナンバー固定ではない）。
- 独立検算（私が同じ積分を再実装して実行）:
  - L=14, gs=1: 実測周期 **0.75100s** / 解析値 **0.75098s** / ratio **1.0000**（設計§8 参考周期 ≈0.75s と一致）。±3% 窓（0.97–1.03）に余裕で収まる。
  - **偽陽性検証**: 期待値を仮に2倍にすると ratio 0.500 となり ±3% 窓を確実に外れる → テストは式の誤りを捕捉できる（オウム返しなら常に通ってしまうが、そうなっていない）。
  - gs×4: 実測 ratio **0.5001**、テスト窓 0.48–0.52 に収まる → √則（T ∝ 1/√gs）を実際に検証。
- 判定: **式検証。実効性あり。**

### 1.3 減衰単調性 / 拘束剛性 / 多段+segmentIndex / clamp（合格）

- 減衰単調性: 手組み初期変位 0.3rad から damping=3 で |x| 極大列が単調非増加（数値マージン +1e-6）。damping=0 で 60000ステップ後も maxRadius < L+0.01（Verlet+剛拘束の有界性）。**手組み初期変位から始めるため過渡を確実に含む** → 動的挙動の実質的検証。
- 拘束剛性（§3.3）: N=3、200ステップ全てで各セグメント長 = L_i を `toBeCloseTo(L, 6)`（|誤差|<5e-7cm）。射影の正しさを厳密固定。
- 多段+segmentIndex: N=2 で出力2本が独立の θ_local（各 −φ）を返す。加えて手組みの折れチェーンで seg2 の角が「pin ではなく第1質点基準」で測られること（seg1=0°, seg2=90°）を `toBeCloseTo(_, 6)` で固定。これは `computeSegmentThetaWorldDeg` の親選択ロジックの正しさをピンポイントで突く良いテスト。
- clamp/scale: rawOffset の ±limit クランプ、deg→単位変換を固定。
- 決定論: 同一入力2回実行 `toEqual`。dt=0 据え置き `toEqual(initial)`。§3.4 reset 整列 `x_i=P+(0,ΣL_j)` を `toEqual` で固定。**v0 の2回実行一致テストは v3 で維持されている。**

## 2. `.skip` / 空実装 / 退化の有無（合格、grep 証跡）

- `grep -rniE '\.(skip|todo|only)\(|xit\(|xdescribe' packages/`（dynamics 系）: **0 件**。
- 廃止 validator ルールのテスト（`invalidPendulumCardinality` / `invalidOutputCardinality` / `normalizationInvalid`）は `dynamics-semantic.test.ts` から**削除され、新設ルール（`chainSegmentsInvalid` / `outputSegmentIndexOutOfRange` / `zeroInputScale` / `outputScaleZero`）のテストに置換済み**（各発火を実データで固定、計6箇所 assert）。改定 `unstableSettings`（新基準 gravityScale>10）も発火を固定。**退化・空実装なし。**

## 3. fixtures 差分の局在（合格、サンプル独立確認）

`git diff HEAD -- fixtures/` を全 numstat + 内容抽出で確認。

- 大半（約20ファイル）は `baseline-package.json` 等の **1行差分 = `dynamics-file-v2`→`v3` のみ**。
- 実質差分（golden）: `minimum-open-dynamics-v1-evidence/expected/*`、`preview-viewer-equivalence-keyform-dynamics/*`、`create-dynamics-group-*.request.json`。
- **schemaVersion 以外の変化行を全抽出**した結果、差分は**すべて dynamics 関連フィールドに局在**:
  - `solverKind: additivePendulumV0 → worldFrameChainV1`
  - `pendulums`/`influencePercent`/`invert`/`normalization` → `chain`/`scale`
  - `angle`/`angularVelocity`/`previousSource`/`previousSourceVelocity` → `particles:[{x,y,px,py}]`
  - stateSummary: `angleAfter` 等 → `particleCountAfter`/`maxParticleSpeedAfter`/`tipAngleLocalDegAfter`
  - debug: `rawTarget`/`source` → `anchorPhiDeg`/`pinX`/`pinY`
  - 派生: `effectiveValue`/`outputOffset` の数値更新、`drawable y`、`samplingStatus` の物理的帰結
- **無関係フィールドのバイト差は検出されず。** Orch の一次確認と独立に一致。

## 4. golden の正当性（合格、数値を式から再現）

対象: `fixtures/contracts/minimum-open-dynamics-v1-evidence/expected/*`（`dynamics-contract-evidence-fixture.test.ts` の golden、実測 2 tests green）。

入力: `param_face_yaw` value=1（default 0）、input scale=30、output scale=0.0333、limit=1。私が式から独立に再計算:

| golden 値 | 式 | 再計算 | 一致 |
|---|---|---|---|
| `anchorPhiDeg: 30` | (1−0)·30 | 30 | ✓ |
| `tipAngleLocalDeg: -30` | θ_world(=0) − φ(=30) | −30 | ✓（§3.6 平衡点 θ_local=−φ）|
| `rawOffset: -0.9990000000000001` | −30·0.0333 | −0.999… | ✓ |
| `effectiveValue: -0.999…` | 0 + (−0.999…) | −0.999… | ✓ |
| clamp | limit=1、|−0.999|<1 → 非発火 | 非発火 | ✓（張り付かず、正しく素通し）|
| `samplingStatus: clamped-min` / drawable y=0 | パラメータ範囲下限近傍のサンプリング帰結 | 筋が通る | ✓ |

**手書き推測ではなくソルバ実出力**であることを確認。物理的に整合（φ=30 で tip localAngle=−30、offset が limit に張り付かず素の −0.999）。Gnome-2 の「実出力を確認してから固定」の主張は裏付けられる。

## 5. Required tests のうち欠落しているもの（要修正 2件）

### 5.1 【穴A】check-catalog と実装発火 checkId の整合テストが無い（設計§7 の catalog 適用漏れを捕捉できない）

- **事実**: `packages/validator-core/src/check-catalog.ts` は Domain A で**一切変更されていない**（`git diff HEAD` の dynamics.* 行差分ゼロ）。その結果:
  - **実装 `validators/dynamics-semantic.ts` が発火するが catalog 未登録**: `chainSegmentsInvalid`, `outputSegmentIndexOutOfRange`, `zeroInputScale`, `outputScaleZero`（設計§7 新設4）。
  - **catalog に残るが実装が発火しない（廃止/旧名）**: `invalidPendulumCardinality`, `invalidOutputCardinality`, `normalizationInvalid`（§7 廃止3）、`zeroInputInfluence`（旧名→`zeroInputScale`）、`outputStrengthZero`（旧名→`outputScaleZero`）。description も "Dynamics v0 additive pendulum" のまま。
- **なぜ green と両立するか**: `defaultCheckCatalog`/`CheckCatalog` は validator-core 実装コード内で**一切消費されていない**（check-catalog.ts 自身以外の参照ゼロ、grep 確認）。検証パイプラインは catalog を引かず checkId/severity を直接埋め込むため、乖離しても実行時挙動は不変。かつ「発火 checkId が catalog に登録済みか」を assert するテストが存在しない。
- **Test Adequacy 観点の欠落**: 設計§7「新設4/廃止3/改定1」の**機械可読な公開面（catalog）が古い**という乖離を、どのテストも捕捉しない。catalog は外部公開メタデータ（severity/profiles/description/relatedAC）であり、新設ルールがそこから欠落している。
- **推奨**: (a) `check-catalog.ts` の dynamics 節を §7 の新旧へ更新（Design/Development レーン主管の実装作業）、かつ (b) 「`validateDynamicsSemantics` が発火し得る全 checkId が `defaultCheckCatalog.has(checkId)` を満たす」網羅テストを新設して乖離の再発を防ぐ（Test Adequacy 主管）。
- **重大度**: 実行時無害だが設計要件の適用漏れ。Domain D の grep gate（`additivePendulumV0` 等の残置ゼロ）とは別軸（catalog は checkId 文字列で旧識別子を含まないため grep 素通り）。**Domain A のうちに是正推奨。**

### 5.2 【穴B】無関係 evidence fixture の `evaluatorVersions.dynamics` 旧 solverKind 残置がテストで捕捉されない

- **事実**: 以下4テストは Domain A で `dynamics-file-v2 → v3` に更新されている（差分あり = 触れている）にもかかわらず、同一 snapshot fixture 内の `evaluatorVersions.dynamics: "additivePendulumV0"` が**旧名のまま残置**:
  - `packages/validator-core/src/mask-composition-diagnostics.test.ts:488`
  - `packages/validator-core/src/rig-control-semantic.test.ts:674`
  - `packages/validator-core/src/validator-core.test.ts:387`
  - `packages/validator-core/src/rig-control-runtime-evidence.test.ts:752`
- **なぜ green か**: これらは mask/rig-control 検証を対象とし、`evaluatorVersions.dynamics` の値を assert しないリテラル。実行時検証に影響しない。
- **設計との抵触**: 設計§5 命名表は `additivePendulumV0 → worldFrameChainV1` を必須とし、wave106-plan §9 Domain D は「旧識別子 `additivePendulumV0` の残置 grep = fixtures 履歴以外ゼロ」を最終ゲートに置く。これらは fixtures 履歴でなく**テスト本文のリテラル**なので、Domain D の grep gate で**赤旗として検出される**見込み。Domain A が触ったファイル内の見落としであり、Domain A のうちに是正するのが筋。
- **推奨**: 4箇所を `worldFrameChainV1` へ機械置換（solverKind の別軸なので schemaVersion 置換の sed から漏れた）。
- **重大度**: 軽微（無害だが命名の完全適用に反し、Domain D ゲートを赤にする）。

## 6. Orch 引き継ぎ事項の独立確認

- **残14赤が dynamics 無関係か**: Gnome-2 の根本原因分類（A recipe×preset `param_mouth_open` 衝突 / B variants `model/variants.json` golden 未更新 / C createParameter semanticRole 欠落 / D keyform 検証・snapshot baseValue）は、いずれも dynamics スキーマ形状と独立した別要因であり、私が読んだ範囲で dynamics 由来と疑う material は**無い**。特に (B) variants は git working tree の別フィーチャ差分（`variant-selection-resolution.ts` 等）と符合し、dynamics とは無関係。**この14赤を Domain A の欠陥として数えない**という Orch の整理を支持する。ただし §5 の穴A/穴B は「HEAD 由来の既存赤」ではなく **Domain A が新規に持ち込んだ/残した不整合**なので、14赤とは別に扱うこと。

## 7. 差分一覧（要修正）

| # | 種別 | 場所 | 内容 | 主管レーン | 重大度 |
|---|---|---|---|---|---|
| 穴A-impl | 実装漏れ | `validator-core/src/check-catalog.ts` dynamics 節 | 新設4未登録・廃止3/旧名2残置・description が "v0 pendulum" のまま | Design/Dev（横断報告） | 中（実行時無害・公開メタ古い） |
| 穴A-test | テスト欠落 | validator-core（新設テスト無し） | 発火 checkId ⊆ catalog の網羅テストが無く乖離が永続 | Test Adequacy | 中 |
| 穴B | テスト本文残置 | mask-composition-diagnostics:488 / rig-control-semantic:674 / validator-core.test:387 / rig-control-runtime-evidence:752 | `evaluatorVersions.dynamics: "additivePendulumV0"` を `worldFrameChainV1` へ | Test Adequacy / Design | 軽微（Domain D grep gate を赤化） |

## 8. 質問（Orch へ）

1. 穴A（check-catalog 更新 + 網羅テスト新設）は、実行時無害だが設計§7 の適用漏れである。Domain A の是正対象（追加 Gnome 委任）とするか、Domain D のクリーンアップに送るか、Orch の裁定を仰ぐ。私見: catalog 更新は §7 の直接適用であり Domain A の Allowed scope（`validator-core/src/**`）内なので **Domain A で閉じるのが筋**。
2. 穴B の4箇所は機械置換で済むが、Domain D grep gate が拾う前提なら Domain D に委ねる選択もある。私見: Domain A が触ったファイル内の見落としのため **Domain A で潰す**方が孤児を残さない。

## 判定: 要修正（穴A・穴B。いずれも実行時挙動・物理妥当性には影響せず、物理妥当性テスト群/golden/fixtures 局在は合格。修正は命名の完全適用と catalog 整合に限定）
