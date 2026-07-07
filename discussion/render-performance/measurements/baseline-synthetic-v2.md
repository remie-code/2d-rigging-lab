# 合成ヘビーモデル ベースライン計測 v2（Perf Wave 1.2 — gap 細分化 + 呼び出し元タグ）

> Status: Recorded（2026-07-07）
> 計測担当: Gnome（サブエージェント委任 / 呼び出し元 Orch-Sylph, Perf Wave 1.2 / Domain P-B）。挙動不変・計測のみ。
>
> v1（`baseline-synthetic.md`）を、evaluation 全体の内側を **5 スパンに細分化**した新スパンで再実測した
> もの。加えて呼び出し元タグ（`canvas.evaluation.caller.*` カウンタ）を導入した。評価ホットパス
> （`createCanvasRenderProjection` → `createCanvasEvaluatedScene`）は Editor Canvas / Editor Viewer が
> 共有する実経路そのもの。**本 v2 の眼目は「gap（deformerVertex 区間外）の内訳を計測で埋め、実モデルの
> gap≈78% を合成で再現できるかを確かめる」こと。**

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
WebGL2 の実描画 submit は node 環境で実行不可のためベンチには含まれない（v1 §5 と同じ）。

## 2. 再現手順

```
# 決定性・非破壊・呼び出し元タグの単体テストのみ（計測は skip・CI 相当）
npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts

# 内訳計測を実行（PowerShell）
$env:RUN_PERF_BENCH = "1"; npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts

# 内訳計測を実行（bash）
RUN_PERF_BENCH=1 npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts
```

計測値は `console.table` で標準出力に出る（phase / count / totalMs / avgMs / maxMs）。coverage 行と
caller counter の table も併せて出力される。

規模パラメータ（`SyntheticHeavyModelScale`）:

| scale | drawableCount | verticesPerMesh | deformerChainDepth | keyformSetCount | rigControls（= draw × depth） |
|-------|--------------|-----------------|--------------------|-----------------|------------------------------|
| light    | 8   | 16  | 1 | 8   | 8 |
| medium   | 40  | 64  | 3 | 40  | 120 |
| heavy    | 120 | 256 | 6 | 120 | 720 |
| **rigHeavy**（新規 gap 再現 probe） | 200 | **4** | 8 | 200 | **1600** |

`rigHeavy` は Required impl #3 の gap 再現検証用に**1点だけ**追加した fixture。既存軸のみを使い
（fixture 生成ロジックは無変更・byte 一致テストは維持）、**頂点を絞って deformerVertex を枯らし、
rig control 数を最大化**して「deformerVertex 外のスパンが支配的になる gap 構造」を狙った。

## 3. 新スパン定義（区間の非オーバーラップ）

`createCanvasEvaluatedScene` の内側を、時系列で隙間なく連続する 5 スパンに分割した。各 record は次の
start の直前に隣接し、区間は重複しない（縫い目の実証は domain-pb-report §2）:

| # | stats キー | 測る区間（canvas-evaluation.ts） |
|---|-----------|--------------------------------|
| 1 | `canvas.evaluation.indexBuild.ms` | 関数冒頭の index/Map 群構築（partsById / meshesById / textureEntriesById / binaryEntriesByPath / createSourceLayerIndex / createStructureDrawOrderIndex） |
| 2 | `canvas.evaluation.keyform.ms`（既存） | `createEvaluatedParameterKeyformState` 1 区間 |
| 3 | `canvas.evaluation.rigControlEval.ms` | createEvaluationRigControls + rigControlsById + createRigControlEvaluationOrder + createDirectRigControlByDrawableId + createMaskSourceIndex + createMeshDraftIndex |
| 4 | `canvas.evaluation.deformerVertex.ms`（既存） | `drawables.map(...).filter(...).sort(...)` 全体（頂点変形 + clone + bounds） |
| 5 | `canvas.evaluation.artworkBoundsAndAssembly.ms` | unionRects（artworkBounds）+ createCanvasEvaluatedRigControls + maskRelations map（末尾 scene 構築） |

被覆率 = （1+2+3+4+5 の totalMs 合計）/ `canvas.evaluation.ms` totalMs。

## 4. 実測値（totalMs は 20 反復合計 / avgMs は 1 評価あたり）

### light（drawables=8, verticesPerMesh=16, chainDepth=1, rigControls=8）

| phase | count | totalMs | avgMs | maxMs | 全体比 |
|-------|-------|---------|-------|-------|-------|
| canvas.evaluation.ms（全体） | 20 | 24.558 | 1.228 | 3.223 | 100% |
| canvas.evaluation.indexBuild.ms | 20 | 1.214 | 0.061 | 0.268 | 4.9% |
| canvas.evaluation.keyform.ms | 20 | 0.860 | 0.043 | 0.127 | 3.5% |
| canvas.evaluation.rigControlEval.ms | 20 | 1.771 | 0.089 | 0.179 | 7.2% |
| canvas.evaluation.deformerVertex.ms | 20 | 14.411 | 0.721 | 2.759 | 58.7% |
| canvas.evaluation.artworkBoundsAndAssembly.ms | 20 | 6.126 | 0.306 | 0.868 | 25.0% |
| canvas.projection.ms | 20 | 27.947 | 1.397 | 3.419 | — |
| canvas.renderSceneAdapter.ms | 20 | 1.889 | 0.094 | 0.487 | — |
| **被覆率** | | 24.381 / 24.558 | | | **99.28%（残余 0.72%）** |

### medium（drawables=40, verticesPerMesh=64, chainDepth=3, rigControls=120）

| phase | count | totalMs | avgMs | maxMs | 全体比 |
|-------|-------|---------|-------|-------|-------|
| canvas.evaluation.ms（全体） | 20 | 264.151 | 13.208 | 14.246 | 100% |
| canvas.evaluation.indexBuild.ms | 20 | 1.954 | 0.098 | 0.147 | 0.7% |
| canvas.evaluation.keyform.ms | 20 | 1.840 | 0.092 | 0.112 | 0.7% |
| canvas.evaluation.rigControlEval.ms | 20 | 14.865 | 0.743 | 1.261 | 5.6% |
| canvas.evaluation.deformerVertex.ms | 20 | 183.156 | 9.158 | 10.237 | 69.3% |
| canvas.evaluation.artworkBoundsAndAssembly.ms | 20 | 62.080 | 3.104 | 3.613 | 23.5% |
| canvas.projection.ms | 20 | 276.774 | 13.839 | 15.067 | — |
| canvas.renderSceneAdapter.ms | 20 | 6.722 | 0.336 | 1.370 | — |
| **被覆率** | | 263.894 / 264.151 | | | **99.90%（残余 0.10%）** |

### heavy（drawables=120, verticesPerMesh=256, chainDepth=6, rigControls=720）

| phase | count | totalMs | avgMs | maxMs | 全体比 |
|-------|-------|---------|-------|-------|-------|
| canvas.evaluation.ms（全体） | 20 | 3820.175 | 191.009 | 212.520 | 100% |
| canvas.evaluation.indexBuild.ms | 20 | 5.188 | 0.259 | 0.615 | 0.1% |
| canvas.evaluation.keyform.ms | 20 | 13.051 | 0.653 | 8.356 | 0.3% |
| canvas.evaluation.rigControlEval.ms | 20 | 80.458 | 4.023 | 5.996 | 2.1% |
| canvas.evaluation.deformerVertex.ms | 20 | 3304.959 | 165.248 | 187.055 | 86.5% |
| canvas.evaluation.artworkBoundsAndAssembly.ms | 20 | 415.970 | 20.799 | 23.398 | 10.9% |
| canvas.projection.ms | 20 | 3892.806 | 194.640 | 218.852 | — |
| canvas.renderSceneAdapter.ms | 20 | 43.704 | 2.185 | 6.024 | — |
| **被覆率** | | 3819.625 / 3820.175 | | | **99.99%（残余 0.01%）** |

### rigHeavy（drawables=200, verticesPerMesh=4, chainDepth=8, rigControls=1600）— gap 再現 probe

| phase | count | totalMs | avgMs | maxMs | 全体比 |
|-------|-------|---------|-------|-------|-------|
| canvas.evaluation.ms（全体） | 20 | 1343.920 | 67.196 | 71.023 | 100% |
| canvas.evaluation.indexBuild.ms | 20 | 6.829 | 0.341 | 1.099 | 0.5% |
| canvas.evaluation.keyform.ms | 20 | 5.526 | 0.276 | 0.744 | 0.4% |
| canvas.evaluation.rigControlEval.ms | 20 | 158.883 | 7.944 | 9.446 | 11.8% |
| canvas.evaluation.deformerVertex.ms | 20 | 132.705 | 6.635 | 11.185 | **9.9%** |
| canvas.evaluation.artworkBoundsAndAssembly.ms | 20 | 1039.505 | 51.975 | 54.813 | **77.3%** |
| **被覆率** | | 1343.448 / 1343.920 | | | **99.97%（残余 0.03%）** |

## 5. 被覆率（内訳合計 vs 全体・残余%・目標達成）

| scale | breakdownTotalMs | wholeTotalMs | 被覆率 | 残余 | 目標 <10% |
|-------|-----------------|-------------|-------|------|----------|
| light    | 24.381   | 24.558   | 99.28% | 0.72% | ✅ |
| medium   | 263.894  | 264.151  | 99.90% | 0.10% | ✅ |
| heavy    | 3819.625 | 3820.175 | 99.99% | 0.01% | ✅ |
| rigHeavy | 1343.448 | 1343.920 | 99.97% | 0.03% | ✅ |

**全 scale で残余 < 1%。目標（残余 < 10%）を大幅にクリア**。v1 で heavy 約 13% あった「deformerVertex
区間外の未計測」は、indexBuild / rigControlEval / artworkBoundsAndAssembly の 3 スパンでほぼ完全に
説明されるようになった。残余（<1%）は 5 スパンの record と次スパンの start の間の関数呼び+null 比較の
オーバーヘッド、および全体 record 直前の caller counter 記録に相当する（無視できる大きさ）。

## 6. 呼び出し元カウンタ

ベンチは `createCanvasRenderProjection(session, null, { parameterValues })` を呼び、`evaluationCaller`
タグを渡していない。よって全 scale で:

| counter | count |
|---------|-------|
| `canvas.evaluation.caller.unknown` | 20（= BENCH_ITERATIONS = evaluation count） |

caller counter の総和が `canvas.evaluation.ms` の count に一致する（未タグ評価は "unknown" に集計され、
どの評価も取りこぼさない）。3 経路（canvas / viewerRuntime / viewerCleanStage）のタグが**正しいカウンタ
に振り分けられる**ことは常時実行の単体テスト「evaluation caller counters」で別途実証している（実モデル
での二重評価切り分けは domain-pb-report §4）。

## 7. gap の再現有無 と 支配項の読み（最重要）

### 通常 scale（light/medium/heavy）: 実モデルの gap 構造を再現できない

- deformerVertex が全体の 58.7% → 69.3% → 86.5% と、規模拡大につれ支配度を増す（v1 と同じ傾向。
  O(Σ 頂点数 × chain 深) と整合）。
- deformerVertex 外（gap の中身）: **artworkBoundsAndAssembly が最大（heavy 10.9%）**、次いで
  rigControlEval（heavy 2.1%）。indexBuild / keyform は各 0.1〜0.3% とほぼ無視できる。
- **実モデルは deformerVertex が 17% に留まり gap≈78% が支配的**だったのに対し、通常 scale の合成では
  deformerVertex が 86.5% で支配的。**通常の合成モデルは実モデルの gap 構造を再現できていない**（v1 の
  結論を、細分化した内訳で改めて確認）。理由: 合成モデルは頂点数（deformerVertex 因子）と rig control 数
  （gap 因子）が同じ chainDepth に連動して伸びるため、頂点コストが常に支配してしまう。

### rigHeavy probe: gap 構造を再現できた（重要な発見）

- 頂点を 4 まで絞り rig control を 1600 まで増やすと、**deformerVertex が 9.9% に陥落**し、
  **artworkBoundsAndAssembly が 77.3% で支配項に躍り出た**（rigControlEval 11.8% と合わせ deformerVertex
  外が約 90%）。
- この profile は**実モデルの「deformerVertex 17% / gap≈78%」と構造的に一致する**。すなわち
  **合成でも「rig control 過多 / 頂点少」の条件下では、実モデルと同じ gap 支配構造を再現できる**。
- 含意: 実モデルの gap の主犯は、頂点変形本体ではなく **artworkBoundsAndAssembly 区間内の
  `createCanvasEvaluatedrigControls`（rig control 数 × chain 適用 + `cloneVec2` の全量再構築）である
  可能性が濃厚**。実モデルは「頂点数は中程度だが rig control 数と chain が多い」構造とみられる。

### 粒度限界（正直な報告）

`artworkBoundsAndAssembly` は unionRects（artworkBounds）+ createCanvasEvaluatedRigControls + maskRelations
map の**複合区間**。rigHeavy で支配したのがこの 3 者のどれか（ほぼ確実に createCanvasEvaluatedRigControls
だが unionRects の可能性も残る）は、現状の粒度では**分離していない**。この区間を更に割ると、maskRelations
map や unionRects の `.map()`（ホットループ）内側に計測を刺す必要が生じ OFF時ゼロコストが崩れる懸念がある
ため、本 wave では複合区間に留めた（domain-pb-report §7 に詳細）。実モデル計測でも同じ区間として読む
（`artworkBoundsAndAssembly` が gap の主犯なら、その先の分離は次 wave の課題）。

## 8. ベンチで測れないもの（v1 §5 と同じ・実モデルで補う）

- 描画 submit（WebGL2 bufferData / drawElements / マスク FBO 再描画）: node 不可 → 実モデルの webgl2 カウンタ。
- マスク付き drawable の毎フレーム FBO 再描画（仮説C）: 合成モデルはマスク未使用。
