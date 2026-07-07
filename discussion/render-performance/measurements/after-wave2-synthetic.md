# 合成ヘビーモデル ベンチ before/after（Perf Wave 2 — 案A+案D+案E 適用後）

> Status: Recorded（2026-07-08）
> 計測担当: Gnome（サブエージェント委任 / 呼び出し元 Orch-Sylph, Perf Wave 2 / Domain H）。**評価・描画ロジックは一切変更していない**（本 Domain は統合・再計測・ドキュメント整合のみ）。after 値は Domain F（案A: 選択駆動遅延化）+ Domain G（案D+E: deformerVertex 表示経路最適化）が適用済みの作業ツリーを、production/テスト双方を無改変のまま計測したもの。
>
> **before = v3（[baseline-synthetic-v3.md](baseline-synthetic-v3.md) §4）** = Perf Wave 1.3 時点（案A/D/E 未適用）の同一ベンチ実測値。
> **after = 本文書の再計測値** = 現状の作業ツリー（F+G 適用済み）。

---

## 0. 測定意味論（誤読を避けるための必読）

本ベンチ（`synthetic-heavy-model.bench.test.ts`）は **`selection: null`（= rig 非選択）** で評価する。これは Editor での **パラメータスライダー操作／rig ドラッグ操作の主経路**そのものである（実モデル計測002の caller は `canvas` のみ = この経路で二重評価が起きていた）。したがって after は次の2つの改善が同時に効いた値である:

- **案A（Domain F, 選択駆動遅延化）**: rig 非選択時は「必要 rig 集合」が空になり、`createCanvasEvaluatedRigControls`（= `assembly.rigControls` スパン、v3 で artworkBoundsAndAssembly の 99.84% を占めた主犯）が**丸ごとゼロ化**される。
- **案D+E（Domain G, 表示経路最適化）**: `deformerVertex` スパンの toFixed(12) 除去・3重クローン削減・unionRects spread 除去により deformerVertex コストが削減される。

**この after は「本番のスライダー操作の主経路（rig 非選択）」の値**であり、「rig を選択した状態の値」ではない。rig を1個選択した状態では案Aにより当該1個分の rig 評価だけが復活する（v3 の全1600件評価に対し、選択駆動で1件のみ）。契約（perf-wave2-plan §5 / improvement-design §5「rigHeavy で artworkBoundsAndAssembly がほぼ消えること」）が求める after は、この主経路の値である。

---

## 1. 実行環境

| 項目 | 値 | v3 との差 |
|------|----|----------|
| OS | Microsoft Windows 11 Home（10.0.26200 / Windows_NT） | 同一 |
| CPU | AMD Ryzen 7 5700X 8-Core（16 論理プロセッサ） | 同一 |
| Node | v22.14.0 | 同一 |
| ランナー | vitest 3.1.4（environment=node） | 同一 |
| 計測フラグ | `RUN_PERF_BENCH=1`（内部で `globalThis.__LIVE2D_PERF__ = true`） | 同一 |
| 反復回数 | 各 scale 20 回（totalMs は 20 回合計、avgMs = totalMs/20） | 同一 |

**v3 と同一マシン**。ただし絶対値は実行時の負荷で変動する（v3 §1 注記と同じ）。安定確認のため after は 2 回計測し、両者が近接していることを確認した（§4 に run1/run2 併記）。本文書の代表値は **run1**、run2 は再現性確認用。before（v3）は v3 文書の記録値をそのまま引用（再実行していない）。

計測終端は v3 と同じ `createRenderSceneFromCanvasProjection`（= `canvas.renderSceneAdapter.ms`）まで。WebGL2 実描画 submit は node 環境で不可のためベンチに含まれない。

## 2. 再現手順

```powershell
# 決定性・非破壊の単体テスト（計測 skip・CI 相当）
npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts

# 内訳計測を実行（PowerShell）
$env:RUN_PERF_BENCH = "1"; npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts
```

規模パラメータ（v2/v3 から無変更）:

| scale | drawableCount | verticesPerMesh | deformerChainDepth | keyformSetCount | rigControls |
|-------|--------------|-----------------|--------------------|-----------------|-------------|
| light    | 8   | 16  | 1 | 8   | 8 |
| medium   | 40  | 64  | 3 | 40  | 120 |
| heavy    | 120 | 256 | 6 | 120 | 720 |
| rigHeavy | 200 | 4   | 8 | 200 | 1600 |

---

## 3. before/after 比較表（全スパン・全 4 規模）

各セル: totalMs（20 反復合計）/ avgMs（1 評価あたり）。削減率は total 基準（avg 削減率は同一）。
before は v3 §4 の実測値、after は本再計測 run1。

### light（drawables=8, verticesPerMesh=16, chainDepth=1, rigControls=8）

| span | before total/avg | after total/avg | 削減率 |
|------|------------------|-----------------|--------|
| **canvas.evaluation.ms（全体）** | **16.710 / 0.835** | **5.461 / 0.273** | **−67.3%** |
| canvas.evaluation.indexBuild.ms | 0.847 / 0.042 | 0.609 / 0.030 | −28.1% |
| canvas.evaluation.keyform.ms | 0.571 / 0.029 | 0.509 / 0.025 | −10.9% |
| canvas.evaluation.rigControlEval.ms | 1.393 / 0.070 | 1.238 / 0.062 | −11.1% |
| canvas.evaluation.deformerVertex.ms | 8.551 / 0.428 | 2.731 / 0.137 | **−68.1%** |
| canvas.evaluation.artworkBoundsAndAssembly.ms（親） | 5.117 / 0.256 | 0.272 / 0.014 | **−94.7%** |
| └ assembly.rigControls.ms | 4.748 / 0.237 | 0.021 / 0.001 | **−99.6%** |
| └ assembly.artworkBounds.ms | 0.082 / 0.004 | 0.043 / 0.002 | −47.6% |
| └ assembly.rest.ms | 0.172 / 0.009 | 0.174 / 0.009 | +1.2%（ノイズ） |

### medium（drawables=40, verticesPerMesh=64, chainDepth=3, rigControls=120）

| span | before total/avg | after total/avg | 削減率 |
|------|------------------|-----------------|--------|
| **canvas.evaluation.ms（全体）** | **273.795 / 13.690** | **35.646 / 1.782** | **−87.0%** |
| canvas.evaluation.indexBuild.ms | 2.766 / 0.138 | 1.810 / 0.091 | −34.6% |
| canvas.evaluation.keyform.ms | 2.240 / 0.112 | 1.542 / 0.077 | −31.2% |
| canvas.evaluation.rigControlEval.ms | 16.508 / 0.825 | 14.519 / 0.726 | −12.0% |
| canvas.evaluation.deformerVertex.ms | 192.116 / 9.606 | 17.293 / 0.865 | **−91.0%** |
| canvas.evaluation.artworkBoundsAndAssembly.ms（親） | 59.890 / 2.994 | 0.339 / 0.017 | **−99.4%** |
| └ assembly.rigControls.ms | 59.070 / 2.953 | 0.014 / 0.001 | **−99.98%** |
| └ assembly.artworkBounds.ms | 0.337 / 0.017 | 0.153 / 0.008 | −54.6% |
| └ assembly.rest.ms | 0.374 / 0.019 | 0.132 / 0.007 | −64.7% |

### heavy（drawables=120, verticesPerMesh=256, chainDepth=6, rigControls=720）

| span | before total/avg | after total/avg | 削減率 |
|------|------------------|-----------------|--------|
| **canvas.evaluation.ms（全体）** | **4667.866 / 233.393** | **406.586 / 20.329** | **−91.3%** |
| canvas.evaluation.indexBuild.ms | 9.375 / 0.469 | 4.844 / 0.242 | −48.3% |
| canvas.evaluation.keyform.ms | 7.043 / 0.352 | 5.679 / 0.284 | −19.4% |
| canvas.evaluation.rigControlEval.ms | 100.298 / 5.015 | 73.711 / 3.686 | −26.5% |
| canvas.evaluation.deformerVertex.ms | 4032.552 / 201.628 | 321.076 / 16.054 | **−92.0%** |
| canvas.evaluation.artworkBoundsAndAssembly.ms（親） | 518.150 / 25.908 | 0.957 / 0.048 | **−99.8%** |
| └ assembly.rigControls.ms | 515.943 / 25.797 | 0.030 / 0.002 | **−99.99%** |
| └ assembly.artworkBounds.ms | 0.855 / 0.043 | 0.485 / 0.024 | −43.3% |
| └ assembly.rest.ms | 1.110 / 0.056 | 0.386 / 0.019 | −65.2% |

### rigHeavy（drawables=200, verticesPerMesh=4, chainDepth=8, rigControls=1600）— gap 再現 probe（核心）

| span | before total/avg | after total/avg | 削減率 |
|------|------------------|-----------------|--------|
| **canvas.evaluation.ms（全体）** | **1783.059 / 89.153** | **212.328 / 10.616** | **−88.1%** |
| canvas.evaluation.indexBuild.ms | 9.114 / 0.456 | 8.488 / 0.424 | −6.9% |
| canvas.evaluation.keyform.ms | 7.207 / 0.360 | 4.568 / 0.228 | −36.6% |
| canvas.evaluation.rigControlEval.ms | 224.162 / 11.208 | 160.939 / 8.047 | −28.2% |
| canvas.evaluation.deformerVertex.ms | 183.379 / 9.169 | 37.249 / 1.862 | **−79.7%** |
| canvas.evaluation.artworkBoundsAndAssembly.ms（親） | 1358.697 / 67.935 | 0.848 / 0.042 | **−99.94%** |
| └ **assembly.rigControls.ms** | 1356.475 / 67.824 | 0.024 / 0.001 | **−99.998%** |
| └ assembly.artworkBounds.ms | 0.927 / 0.046 | 0.516 / 0.026 | −44.3% |
| └ assembly.rest.ms | 1.032 / 0.052 | 0.262 / 0.013 | −74.6% |

---

## 4. after run1 / run2 の再現性（安定確認）

evaluation 全体（`canvas.evaluation.ms`）の after 2 回計測。両者は近接し、改善は再現性がある。

| scale | after run1 total/avg | after run2 total/avg |
|-------|----------------------|----------------------|
| light    | 5.461 / 0.273 | 5.615 / 0.281 |
| medium   | 35.646 / 1.782 | 38.470 / 1.924 |
| heavy    | 406.586 / 20.329 | 401.824 / 20.091 |
| rigHeavy | 212.328 / 10.616 | 201.673 / 10.084 |

deformerVertex（`canvas.evaluation.deformerVertex.ms`）の after 2 回:

| scale | after run1 total | after run2 total |
|-------|------------------|------------------|
| light    | 2.731 | 2.818 |
| medium   | 17.293 | 19.937 |
| heavy    | 321.076 | 317.163 |
| rigHeavy | 37.249 | 34.712 |

主犯 `assembly.rigControls.ms` は両 run とも全 scale で 0.02〜0.03ms total（実質ゼロ）。案A の選択駆動遅延化が rig 非選択経路で確実に効いている。

---

## 5. 読み（何が消えたか）

### 主経路の主犯 `createCanvasEvaluatedRigControls`（案A）は消滅

- v3 で rig control 数 × chain 深さに比例して膨張していた `assembly.rigControls.ms` が、rig 非選択経路では全 scale で **実質ゼロ（0.02〜0.03ms total）** になった。rigHeavy では **67.824ms/eval → 0.001ms/eval（−99.998%）**。
- その親 `artworkBoundsAndAssembly.ms` も rigHeavy で **67.935 → 0.042ms/eval（−99.94%）** まで縮み、設計 §5「rigHeavy で artworkBoundsAndAssembly がほぼ消える」を満たした。残るのは artworkBounds（unionRects）と rest のみで、いずれも 1ms 未満。

### 第二標的 deformerVertex（案D+E）も大幅減

- deformerVertex は toFixed 除去・クローン削減で medium **−91%** / heavy **−92%** / rigHeavy **−79.7%** / light **−68.1%**。deformerVertex が支配的な medium/heavy で 90% 超の削減。

### evaluation 全体

- rig 非選択（本番スライダー操作の主経路）で evaluation 全体が **light −67.3% / medium −87.0% / heavy −91.3% / rigHeavy −88.1%** 削減。
- rigHeavy では案A で消える rigControls 主犯が大きく（before の 76.1% = artworkBoundsAndAssembly 67.935ms + rigControlEval 11.208ms のうち artworkBoundsAndAssembly 分）、それがゼロ化される寄与が支配的。heavy/medium では deformerVertex が支配的だったため案D+E の寄与が支配的。両案が異なる scale の主犯を分担して落としている。
- **注意**: after でも `rigControlEval.ms`（keyform 由来の別スパン、案A対象外）が rigHeavy で 8.047ms/eval 残存する。これは `createCanvasEvaluatedRigControls`（= `assembly.rigControls`, 案A で消えた）とは別の rig 評価スパンであり、案A/Dの標的外。実モデル計測002では rigControlEval は evaluation 全体の 2.3% と小さく、主犯ではなかった（主犯は artworkBoundsAndAssembly 75.8%）。

---

## 6. ベンチで測れないもの（v3 §8 と同じ・実モデルで補う）

- 描画 submit（WebGL2 bufferData / drawElements / マスク FBO 再描画）: node 不可 → 実モデルの webgl2 カウンタ。
- マスク付き drawable の毎フレーム FBO 再描画: 合成モデルはマスク未使用。
- StrictMode 二重評価: 合成ベンチは単一プロセスで1回評価。dev server の二重評価コストは実モデル計測003で読む（final-report §ユーザー実モデル計測003 参照）。

## 7. 本文書の計測での改変・復元確認

- production コード（canvas-evaluation.ts / canvas-projection.ts 等）・ベンチ（synthetic-heavy-model.bench.test.ts / synthetic-heavy-model.ts）・テストは **一切改変していない**。ベンチは `RUN_PERF_BENCH` を環境変数から読むため、計測に source 改変は不要。計測前後で `git status` が同一であることを確認済み（一時変更なし → 復元不要）。
- before（v3）は再実行していない。v3 文書の記録値をそのまま before として引用した（同一マシン・同一手順で記録されたもの）。
