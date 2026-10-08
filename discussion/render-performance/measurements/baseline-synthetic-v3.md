# 合成ヘビーモデル ベースライン計測 v3（Perf Wave 1.3 — artworkBoundsAndAssembly 内部分離）

> Status: Recorded（2026-07-07）
> 計測担当: Gnome（サブエージェント委任 / 呼び出し元 Orch-Sylph, Perf Wave 1.3 / Domain P-C）。挙動不変・計測のみ・最適化なし。
>
> v2（`baseline-synthetic-v2.md`）で **artworkBoundsAndAssembly が rigHeavy で 77.3% 支配**と判明したが、
> この区間は「unionRects + createCanvasEvaluatedRigControls + maskRelations map」の複合で、どれが支配かは
> 未分離だった（v2 §7 粒度限界）。**本 v3 の眼目は、この複合区間の内部を 3 子スパンに分離し、支配関数を
> 関数単位まで特定すること**。既存の親スパン `canvas.evaluation.artworkBoundsAndAssembly.ms` は保持し、
> その内側に 3 子スパンを刺した（親＝整合基準・子＝内訳）。評価結果・数値・順序は一切変えていない
> （純粋リファクタによる評価順の並べ替えのみ・結果 byte 一致は既存テストで実証済み・domain-pc-report §4）。

## 1. 実行環境

| 項目 | 値 |
|------|----|
| OS | Microsoft Windows 11 Home（Windows_NT） |
| CPU | AMD Ryzen 7 5700X 8-Core（16 論理プロセッサ） |
| Node | v22.14.0 |
| ランナー | vitest 3.1.4（environment=node） |
| 計測フラグ | `globalThis.__LIVE2D_PERF__ = true` |
| 反復回数 | 各 scale 20 回（totalMs は 20 回合計、avgMs = totalMs/20） |

計測終端は `createRenderSceneFromCanvasProjection`（= 既存 `canvas.renderSceneAdapter.ms`）まで。
WebGL2 の実描画 submit は node 環境で実行不可のためベンチには含まれない（v2 §1 と同じ）。

> 注: totalMs の絶対値は v2 と多少差がある（同一マシンでも実行時の負荷で変動）。本 v3 の主眼は絶対値では
> なく**区間内の相対構成（どの子スパンが支配か）と被覆率**であり、そこは全 scale で安定している。

## 2. 再現手順

```
# 決定性・非破壊・呼び出し元タグ・新 3 子スパン count の単体テストのみ（計測は skip・CI 相当）
npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts

# 内訳計測を実行（PowerShell）
$env:RUN_PERF_BENCH = "1"; npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts

# 内訳計測を実行（bash）
RUN_PERF_BENCH=1 npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts
```

計測値は `console.table` で標準出力に出る（phase / count / totalMs / avgMs / maxMs）。全体被覆率行、
**assembly inner-coverage 行（新規：3 子スパン合計 / 親 artworkBoundsAndAssembly）**、caller counter table も
併せて出力される。

規模パラメータ（`SyntheticHeavyModelScale`・v2 から無変更）:

| scale | drawableCount | verticesPerMesh | deformerChainDepth | keyformSetCount | rigControls（= draw × depth） |
|-------|--------------|-----------------|--------------------|-----------------|------------------------------|
| light    | 8   | 16  | 1 | 8   | 8 |
| medium   | 40  | 64  | 3 | 40  | 120 |
| heavy    | 120 | 256 | 6 | 120 | 720 |
| **rigHeavy**（gap 再現 probe） | 200 | **4** | 8 | 200 | **1600** |

`BENCH_SCALES` は v2 から無変更（4 点維持）。fixture 生成ロジック（`synthetic-heavy-model.ts`）も無変更
（byte 一致テスト維持）。

## 3. スパン定義（親スパン保持・内側に 3 子スパン）

`createCanvasEvaluatedScene` の evaluation 全体は v2 と同じ 5 スパン（indexBuild / keyform /
rigControlEval / deformerVertex / **artworkBoundsAndAssembly**）に分割されており、これらは互いに非オーバー
ラップで evaluation 全体を分割する。本 v3 で、その第 5 スパン `artworkBoundsAndAssembly` の**内側**を、
時系列で隙間なく連続する **3 子スパン**にさらに分割した。親スパンは保持している（親＝内訳と全体の整合基準）。

| # | stats キー | 種別 | 測る区間（canvas-evaluation.ts） | 並べ替え |
|---|-----------|------|--------------------------------|---------|
| 5-a | `canvas.evaluation.assembly.rigControls.ms` | 新規 | `createCanvasEvaluatedRigControls(rigControls, rigControlsById)`（rig control 全量再構築 + chain 適用 + cloneVec2） | **あり**（scene リテラル外へ引き上げ・先頭で評価） |
| 5-b | `canvas.evaluation.assembly.artworkBounds.ms` | 新規 | `unionRects(visible drawables の bounds)`（artworkBounds 計算） | なし（元位置） |
| 5-c | `canvas.evaluation.assembly.rest.ms` | 新規 | 残り assembly = `resolveEvaluationCanvasBounds`（canvasBounds）+ scene オブジェクトリテラル構築 + maskRelations map | なし |
| — | `canvas.evaluation.artworkBoundsAndAssembly.ms` | 既存・保持 | 上記 5-a + 5-b + 5-c の合計（内訳と親の整合基準） | — |

- **並べ替えの内容**: v2 では scene オブジェクトリテラルの中で `createCanvasEvaluatedRigControls` が評価され
  ていた（unionRects の後・maskRelations map の直前）。v3 では時系列分離のため、この呼び出しを scene リテラル
  の**外**に出して**先頭で** const `evaluatedRigControls` に束ね、リテラルは `rigControls: evaluatedRigControls`
  で参照するだけにした。したがって実行順は「rigControls 再構築 → unionRects → scene リテラル（canvasBounds →
  artworkBounds spread → maskRelations map）」に変わったが、3 者は互いに独立・副作用なしのため、生成される
  `scene` オブジェクトは byte 一致（フィールド挿入順も v2 と同一）。純粋リファクタの証明は domain-pc-report §4。
- 内側被覆率 = （5-a + 5-b + 5-c の totalMs 合計）/ `canvas.evaluation.artworkBoundsAndAssembly.ms` totalMs。

## 4. 実測値（totalMs は 20 反復合計 / avgMs は 1 評価あたり）

各 scale 表で、まず evaluation 全体の 5 スパン、続いて artworkBoundsAndAssembly の 3 子スパン（インデント
相当）を並べる。**親の直後 3 行（5-a/5-b/5-c）が親の内訳**。

### light（drawables=8, verticesPerMesh=16, chainDepth=1, rigControls=8）

| phase | count | totalMs | avgMs | maxMs |
|-------|-------|---------|-------|-------|
| canvas.evaluation.ms（全体） | 20 | 16.710 | 0.835 | 1.408 |
| canvas.evaluation.indexBuild.ms | 20 | 0.847 | 0.042 | 0.149 |
| canvas.evaluation.keyform.ms | 20 | 0.571 | 0.029 | 0.078 |
| canvas.evaluation.rigControlEval.ms | 20 | 1.393 | 0.070 | 0.118 |
| canvas.evaluation.deformerVertex.ms | 20 | 8.551 | 0.428 | 0.728 |
| **canvas.evaluation.artworkBoundsAndAssembly.ms（親）** | 20 | **5.117** | 0.256 | 0.493 |
| └ canvas.evaluation.assembly.rigControls.ms | 20 | **4.748** | 0.237 | 0.456 |
| └ canvas.evaluation.assembly.artworkBounds.ms | 20 | 0.082 | 0.004 | 0.012 |
| └ canvas.evaluation.assembly.rest.ms | 20 | 0.172 | 0.009 | 0.019 |
| **全体被覆率** | | 16.478 / 16.710 | | **98.61%（残余 1.39%）** |
| **内側被覆率** | | 5.002 / 5.117 | | **97.75%（残余 2.25%）** |

### medium（drawables=40, verticesPerMesh=64, chainDepth=3, rigControls=120）

| phase | count | totalMs | avgMs | maxMs |
|-------|-------|---------|-------|-------|
| canvas.evaluation.ms（全体） | 20 | 273.795 | 13.690 | 14.738 |
| canvas.evaluation.indexBuild.ms | 20 | 2.766 | 0.138 | 0.688 |
| canvas.evaluation.keyform.ms | 20 | 2.240 | 0.112 | 0.255 |
| canvas.evaluation.rigControlEval.ms | 20 | 16.508 | 0.825 | 1.328 |
| canvas.evaluation.deformerVertex.ms | 20 | 192.116 | 9.606 | 10.760 |
| **canvas.evaluation.artworkBoundsAndAssembly.ms（親）** | 20 | **59.890** | 2.994 | 3.973 |
| └ canvas.evaluation.assembly.rigControls.ms | 20 | **59.070** | 2.953 | 3.920 |
| └ canvas.evaluation.assembly.artworkBounds.ms | 20 | 0.337 | 0.017 | 0.038 |
| └ canvas.evaluation.assembly.rest.ms | 20 | 0.374 | 0.019 | 0.039 |
| **全体被覆率** | | 273.520 / 273.795 | | **99.90%（残余 0.10%）** |
| **内側被覆率** | | 59.780 / 59.890 | | **99.82%（残余 0.18%）** |

### heavy（drawables=120, verticesPerMesh=256, chainDepth=6, rigControls=720）

| phase | count | totalMs | avgMs | maxMs |
|-------|-------|---------|-------|-------|
| canvas.evaluation.ms（全体） | 20 | 4667.866 | 233.393 | 374.608 |
| canvas.evaluation.indexBuild.ms | 20 | 9.375 | 0.469 | 2.849 |
| canvas.evaluation.keyform.ms | 20 | 7.043 | 0.352 | 0.677 |
| canvas.evaluation.rigControlEval.ms | 20 | 100.298 | 5.015 | 8.083 |
| canvas.evaluation.deformerVertex.ms | 20 | 4032.552 | 201.628 | 340.887 |
| **canvas.evaluation.artworkBoundsAndAssembly.ms（親）** | 20 | **518.150** | 25.908 | 31.171 |
| └ canvas.evaluation.assembly.rigControls.ms | 20 | **515.943** | 25.797 | 31.065 |
| └ canvas.evaluation.assembly.artworkBounds.ms | 20 | 0.855 | 0.043 | 0.204 |
| └ canvas.evaluation.assembly.rest.ms | 20 | 1.110 | 0.056 | 0.078 |
| **全体被覆率** | | 4667.418 / 4667.866 | | **99.99%（残余 0.01%）** |
| **内側被覆率** | | 517.909 / 518.150 | | **99.95%（残余 0.05%）** |

### rigHeavy（drawables=200, verticesPerMesh=4, chainDepth=8, rigControls=1600）— gap 再現 probe（核心）

| phase | count | totalMs | avgMs | maxMs |
|-------|-------|---------|-------|-------|
| canvas.evaluation.ms（全体） | 20 | 1783.059 | 89.153 | 101.233 |
| canvas.evaluation.indexBuild.ms | 20 | 9.114 | 0.456 | 0.748 |
| canvas.evaluation.keyform.ms | 20 | 7.207 | 0.360 | 0.614 |
| canvas.evaluation.rigControlEval.ms | 20 | 224.162 | 11.208 | 14.448 |
| canvas.evaluation.deformerVertex.ms | 20 | 183.379 | 9.169 | 14.802 |
| **canvas.evaluation.artworkBoundsAndAssembly.ms（親）** | 20 | **1358.697** | 67.935 | 77.300 |
| └ **canvas.evaluation.assembly.rigControls.ms** | 20 | **1356.475** | **67.824** | 77.202 |
| └ canvas.evaluation.assembly.artworkBounds.ms | 20 | 0.927 | 0.046 | 0.271 |
| └ canvas.evaluation.assembly.rest.ms | 20 | 1.032 | 0.052 | 0.072 |
| **全体被覆率** | | 1782.559 / 1783.059 | | **99.97%（残余 0.03%）** |
| **内側被覆率** | | 1358.435 / 1358.697 | | **99.98%（残余 0.02%）** |

## 5. 内側被覆率（3 子スパン合計 vs 親 artworkBoundsAndAssembly・全 4 scale）

| scale | childBreakdownMs | artworkBoundsAndAssemblyMs | 内側被覆率 | 残余 | 目標 ≥90% |
|-------|-----------------|----------------------------|-----------|------|----------|
| light    | 5.002    | 5.117    | 97.75% | 2.25% | ✅ |
| medium   | 59.780   | 59.890   | 99.82% | 0.18% | ✅ |
| heavy    | 517.909  | 518.150  | 99.95% | 0.05% | ✅ |
| rigHeavy | 1358.435 | 1358.697 | 99.98% | 0.02% | ✅ |

**全 scale で内側被覆率 ≥ 97.75%、目標（残余 < 10%）を大幅にクリア**。残余（最大でも light の 2.25% ＝
0.115ms）は 3 子スパンの record と次 start の間の関数呼び + null 比較 + 親 record 直前のオーバーヘッドに
相当し、無視できる大きさ。

## 6. 支配関数の読み（核心成果）

### rigHeavy probe: 支配関数は createCanvasEvaluatedRigControls で確定

- rigHeavy の親 artworkBoundsAndAssembly = 1358.697ms のうち、**`assembly.rigControls`
  （createCanvasEvaluatedRigControls）が 1356.475ms ＝ 親の 99.84%** を占める。
- 残る 2 子スパンは無視できる: `assembly.artworkBounds`（unionRects）0.927ms（親の 0.07%）、
  `assembly.rest`（canvasBounds 解決 + scene リテラル + maskRelations map）1.032ms（親の 0.08%）。
- すなわち **artworkBoundsAndAssembly の支配項は `createCanvasEvaluatedRigControls`（rig control 数 × chain
  適用 + cloneVec2 の全量再構築）で確定**。v2 で「ほぼ確実に createCanvasEvaluatedRigControls だが unionRects
  の可能性も残る」とした粒度限界は解消され、**unionRects の寄与は 0.07% と極小で棄却**された。

### 全 scale で同構造（支配は常に rigControls）

- light 92.79% / medium 98.63% / heavy 99.57% / rigHeavy 99.84% と、**どの scale でも親の大半が
  `assembly.rigControls`** で占められる。artworkBounds と rest は全 scale で合計 1% 未満（light のみ
  4.96% とやや大きいが、これは絶対値が極小（0.254ms）で相対比が振れているだけ）。
- したがって **artworkBoundsAndAssembly ≒ createCanvasEvaluatedRigControls** と読んでよい。この区間を
  縮めたいなら、標的は unionRects でも maskRelations でもなく **createCanvasEvaluatedRigControls 一点**。

### 実モデルへの含意（改善設計の標的確定）

- 実モデル計測002で artworkBoundsAndAssembly が evaluation 全体の 75.8%（平均 96.4ms/評価）で主犯確定。
  本 v3 で、その内部の支配は createCanvasEvaluatedRigControls（rig control 全量再構築）と関数単位まで確定。
- **改善設計の標的は createCanvasEvaluatedRigControls**。具体的には rig control 数 × chain 適用 + cloneVec2
  の全量再構築（毎評価で全 rig control を再クローン）。ここのメモ化・差分再構築・cloneVec2 削減が処方候補。
- **本 wave は計測のみ**（createCanvasEvaluatedRigControls を速くしていない）。処方は次の設計対話へ。

## 7. 呼び出し元カウンタ（v2 から不変）

ベンチは `evaluationCaller` タグを渡さないため、全 scale で `canvas.evaluation.caller.unknown = 20`
（= BENCH_ITERATIONS = evaluation count）。3 経路タグの振り分けは常時実行の単体テスト
「evaluation caller counters」で別途実証済み（v2 §6 と同一）。

## 8. ベンチで測れないもの（v2 §8 と同じ・実モデルで補う）

- 描画 submit（WebGL2 bufferData / drawElements / マスク FBO 再描画）: node 不可 → 実モデルの webgl2 カウンタ。
- マスク付き drawable の毎フレーム FBO 再描画: 合成モデルはマスク未使用。
